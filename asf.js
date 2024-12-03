import { Connection } from 'jsforce';
import { Transform, TransformCallback } from 'stream';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { RecordResult } from 'jsforce';

// Types for the lookup cache
interface LookupCache {
    [objectName: string]: {
        [externalId: string]: string;  // Map of external ID to Salesforce ID
    };
}

interface MigrationResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Error[];
}

export abstract class BaseCSVMigrationObject {
    protected lookupCache: LookupCache;
    protected targetConn: Connection;
    protected readonly BATCH_SIZE = 20000;
    
    constructor(targetConn: Connection) {
        this.targetConn = targetConn;
        this.lookupCache = {};
    }

    // Abstract methods that need to be implemented by concrete classes
    protected abstract getObjectName(): string;
    protected abstract transformRecord(record: any): Promise<any>;
    protected abstract getExternalIdField(): string;

    // Get the file stream for CSV processing
    protected getFileStream(filename: string) {
        return createReadStream(filename)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            }));
    }

    // Initialize lookup cache for a specific object
    protected async initializeLookupCache(
        objectName: string,
        externalIdField: string,
        whereClause?: string
    ): Promise<void> {
        this.lookupCache[objectName] = {};
        
        let query = `SELECT Id, ${externalIdField} FROM ${objectName}`;
        if (whereClause) {
            query += ` WHERE ${whereClause}`;
        }

        let records = await this.targetConn.query(query);
        records.records.forEach(record => {
            this.lookupCache[objectName][record[externalIdField]] = record.Id;
        });

        // Handle pagination if needed
        while (!records.done) {
            records = await records.nextRecords();
            records.records.forEach(record => {
                this.lookupCache[objectName][record[externalIdField]] = record.Id;
            });
        }
    }

    // Lookup helper method
    protected async lookupId(
        objectName: string,
        externalId: string,
        externalIdField: string
    ): Promise<string | null> {
        // Check cache first
        if (this.lookupCache[objectName]?.[externalId]) {
            return this.lookupCache[objectName][externalId];
        }

        // If not in cache, query Salesforce
        const result = await this.targetConn.query(
            `SELECT Id FROM ${objectName} WHERE ${externalIdField} = '${externalId}' LIMIT 1`
        );

        if (result.records.length > 0) {
            // Update cache
            if (!this.lookupCache[objectName]) {
                this.lookupCache[objectName] = {};
            }
            this.lookupCache[objectName][externalId] = result.records[0].Id;
            return result.records[0].Id;
        }

        return null;
    }

    // Main migration execution method
    public async executeMigration(filename: string): Promise<MigrationResult> {
        const result: MigrationResult = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        let currentBatch: any[] = [];
        
        // Create a transform stream for processing records
        const processStream = new Transform({
            objectMode: true,
            async transform(chunk: any, encoding: string, callback: TransformCallback) {
                try {
                    currentBatch.push(chunk);
                    
                    if (currentBatch.length >= this.BATCH_SIZE) {
                        await this.processBatch(currentBatch, result);
                        currentBatch = [];
                    }
                    
                    callback();
                } catch (error) {
                    callback(error);
                }
            }
        });

        return new Promise((resolve, reject) => {
            this.getFileStream(filename)
                .pipe(processStream)
                .on('finish', async () => {
                    try {
                        // Process remaining records
                        if (currentBatch.length > 0) {
                            await this.processBatch(currentBatch, result);
                        }
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Process a batch of records
    private async processBatch(batch: any[], result: MigrationResult): Promise<void> {
        try {
            // Transform records
            const transformedRecords = await Promise.all(
                batch.map(record => this.transformRecord(record))
            );

            // Create bulk job
            const job = this.targetConn.bulk.createJob(this.getObjectName(), 'insert');
            const batch = job.createBatch();

            // Execute batch
            const batchResult = await new Promise<RecordResult[]>((resolve, reject) => {
                batch.execute(transformedRecords)
                    .on('error', reject)
                    .on('queue', (batchInfo) => {
                        batch.poll(1000, 20000)
                            .on('complete', (results: RecordResult[]) => resolve(results))
                            .on('error', reject);
                    });
            });

            // Update results
            result.totalProcessed += batchResult.length;
            batchResult.forEach(record => {
                if (record.success) {
                    result.successful++;
                } else {
                    result.failed++;
                    result.errors.push(new Error(record.errors.join(', ')));
                }
            });

            await job.close();

        } catch (error) {
            result.failed += batch.length;
            result.errors.push(error as Error);
        }
    }
}

// Example implementation
export class AccountMigration extends BaseCSVMigrationObject {
    protected getObjectName(): string {
        return 'Account';
    }

    protected getExternalIdField(): string {
        return 'External_ID__c';
    }

    protected async transformRecord(record: any): Promise<any> {
        // Example transformation
        return {
            Name: record.AccountName,
            External_ID__c: record.ExternalId,
            BillingStreet: record.Street,
            BillingCity: record.City,
            BillingState: record.State,
            BillingPostalCode: record.PostalCode,
            BillingCountry: record.Country
        };
    }
}

// Usage example
async function runMigration() {
    const conn = new Connection({
        // connection config
    });
    
    await conn.login('username', 'password');
    
    const migration = new AccountMigration(conn);
    
    // Initialize lookup cache if needed
    await migration.initializeLookupCache('Account', 'External_ID__c');
    
    const result = await migration.executeMigration('accounts.csv');
    console.log('Migration completed:', result);
}