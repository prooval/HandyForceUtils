import { Connection } from "jsforce";
import { Logger } from "../services/logger";
import { LookupConfig } from "./types";
import { BaseStandardFields } from "./types/salesforce/base";
import { SalesforceRecord } from "./types/salesforce/core";

export class LookupCache {
    private cache: Map<string, Map<string, any>>;
    private sourceConn: Connection;
    private batchSize: number;
    private logger: Logger;

    constructor(sourceConn: Connection, logger: Logger) {
        this.cache = new Map();
        this.sourceConn = sourceConn;
        this.batchSize = 10000;
        this.logger = logger;
    }

    async loadLookupData(lookupKey: string, records: SalesforceRecord<any>[], config: LookupConfig): Promise<void> {
        // Initialize object cache if it doesn't exist
        if (!this.cache.has(lookupKey)) {
            this.cache.set(lookupKey, new Map());
        }
        const objectCache = this.cache.get(lookupKey)!;

        // Extract IDs from records using keyField
        const lookupIds = records.map(record => record[config.keyField]).filter(id => id != null);
        
        if (lookupIds.length === 0) {
            return; // No IDs to look up
        }

        // Split IDs into chunks to handle SOQL length limits
        const idChunks = this.chunkArray(lookupIds, 1000); // Salesforce has limits on IN clause

        for (const idChunk of idChunks) {
            let query = `SELECT ${config.fields.join(", ")} FROM ${config.objectName}`;
            query += ` WHERE ${config.keyField} IN ('${idChunk.join("','")}')`;

            if (config.whereClause) {
                query += ` AND ${config.whereClause}`;
            }

            try {
                let chunkRecords: SalesforceRecord<any>[] = [];

                await this.sourceConn.query(query)
                    .on('record', (record) => {
                        chunkRecords.push(record);
                    })
                    .on('end', () => {
                        this.logger.logLookupProgress(config.objectName, chunkRecords.length);
                    })
                    .on('error', (err) => {
                        throw new Error(`Failed to load lookup data for ${lookupKey}: ${err}`);
                    })
                    .run({ autoFetch: true, maxFetch: this.batchSize });

                // Apply filtering if configured
                if (config.filterFn) {
                    chunkRecords = chunkRecords.filter(config.filterFn);
                }

                // Add to existing cache
                for (const record of chunkRecords) {
                    objectCache.set(record[config.keyField], record);
                }

            } catch (error) {
                throw new Error(`Failed to load lookup data for ${lookupKey} chunk: ${error}`);
            }
        }
    }

    async getValue<T extends BaseStandardFields>(lookupKey: string, recordId: string): T | undefined {
        const objectCache = this.cache.get(lookupKey);
        if (!objectCache) {
            throw new Error(`No cache found for lookup key: ${lookupKey}`);
        }
        return objectCache.get(recordId) as T | undefined;
    }

    async bulkGetValues<T extends BaseStandardFields>(lookupKey: string, recordIds: string[]): Promise<Map<string, T>> {
        const results = new Map<string, T>();
        const objectCache = this.cache.get(lookupKey);

        if (!objectCache) {
            throw new Error(`No cache found for lookup key: ${lookupKey}`);
        }

        for (const recordId of recordIds) {
            const value = objectCache.get(recordId) as T;
            if (value) {
                results.set(recordId, value);
            }
        }
        return results;
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    // Clear specific lookup key cache
    clear(lookupKey?: string): void {
        if (lookupKey) {
            this.cache.delete(lookupKey);
        } else {
            this.cache.clear();
        }
    }

    // New method to get cache statistics
    getCacheStats(): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        for (const [key, value] of this.cache.entries()) {
            stats[key] = value.size;
        }
        return stats;
    }
}
