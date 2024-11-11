import { Connection } from 'jsforce';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ObjectMapping {
    sourceObjName: string;
    targetObjName: string;
}

interface FieldDefinition {
    name: string;
    type: string;
    label: string;
    length?: number;
    precision?: number;
    scale?: number;
    referenceTo?: string[];
    picklistValues?: Array<{ label: string; value: string; default?: boolean }>;
    defaultValue?: any;
    inlineHelpText?: string;
    required?: boolean;
    unique?: boolean;
    externalId?: boolean;
    description?: string;
}

interface ObjectFieldDiff {
    objectName: string;
    fieldsToCreate: FieldDefinition[];
}

interface FieldSyncOutput {
    timestamp: string;
    differences: ObjectFieldDiff[];
}

export class CrossOrgFieldSync {
    private sourceConn: Connection;
    private targetConn: Connection;
    private systemFields: Set<string>;

    constructor(sourceConn: Connection, targetConn: Connection) {
        this.sourceConn = sourceConn;
        this.targetConn = targetConn;
        this.systemFields = new Set([
            'Id', 'CreatedById', 'CreatedDate', 'LastModifiedById',
            'LastModifiedDate', 'SystemModstamp', 'IsDeleted', 'LastActivityDate',
            'LastViewedDate', 'LastReferencedDate', 'OwnerId'
        ]);
    }

    private async describeObject(conn: Connection, objectName: string): Promise<any> {
        try {
            return await conn.describe(objectName);
        } catch (error) {
            console.error(`Error describing object ${objectName}:`, error);
            throw error;
        }
    }

    private isCustomField(fieldName: string): boolean {
        return fieldName.endsWith('__c');
    }

    private transformToTargetFieldName(sourceName: string): string {
        // Remove the __c suffix if it exists
        const baseName = sourceName.replace(/__c$/, '');
        
        // Split by underscore and capitalize each part
        const parts = baseName.split('_');
        const capitalizedParts = parts.map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        );
        
        // Join and add the AFS390 prefix and __c suffix
        return `AFS390_${capitalizedParts.join('')}__c`;
    }

    private extractFieldDefinition(field: any): FieldDefinition {
        const definition: FieldDefinition = {
            name: this.transformToTargetFieldName(field.name),
            type: field.type,
            label: field.label,
        };

        // Add optional properties only if they exist
        if (field.length) definition.length = field.length;
        if (field.precision) definition.precision = field.precision;
        if (field.scale) definition.scale = field.scale;
        if (field.referenceTo?.length > 0) definition.referenceTo = field.referenceTo;
        if (field.picklistValues?.length > 0) {
            definition.picklistValues = field.picklistValues.map((p: any) => ({
                label: p.label,
                value: p.value,
                default: p.defaultValue || false
            }));
        }
        if (field.defaultValue) definition.defaultValue = field.defaultValue;
        if (field.inlineHelpText) definition.inlineHelpText = field.inlineHelpText;
        if (!field.nillable) definition.required = true;
        if (field.unique) definition.unique = true;
        if (field.externalId) definition.externalId = true;
        if (field.description) definition.description = field.description;

        return definition;
    }

    public async identifyFieldsForCreationInTargetOrg(
        objectMappings: ObjectMapping[]
    ): Promise<string> {
        const differences: ObjectFieldDiff[] = [];

        for (const mapping of objectMappings) {
            try {
                console.log(`Processing mapping: ${mapping.sourceObjName} -> ${mapping.targetObjName}`);
                
                // Get field descriptions from both orgs
                const sourceDesc = await this.describeObject(this.sourceConn, mapping.sourceObjName);
                const targetDesc = await this.describeObject(this.targetConn, mapping.targetObjName);

                // Create sets of field names for quick lookup
                const targetFields = new Set(
                    targetDesc.fields
                        .filter((f: any) => this.isCustomField(f.name))
                        .map((f: any) => f.name)
                );

                const sourceSystemIdFieldName = 'AFS390_SOURCESYSTEMID__c';
                // Define the source system ID field that should exist in all target objects
                const sourceSystemIdField: FieldDefinition = {
                    name: 'AFS390_SOURCESYSTEMID__c',
                    type: 'text',
                    label: 'Source System Id',
                    length: 100,
                    required: false,
                    unique: true,
                    externalId: true,
                    description: 'External ID field for cross-org data migration'
                };

                // Find fields that exist in source but not in target
                let fieldsToCreate = sourceDesc.fields
                    .filter((field: any) => {
                        return this.isCustomField(field.name) && 
                               !targetFields.has(field.name) &&
                               !this.systemFields.has(field.name);
                    })
                    .map((field: any) => this.extractFieldDefinition(field));
                
                // Add AFS390_SourceSystemId__c if it doesn't exist in target
                if (!targetFields.has(sourceSystemIdFieldName)) {
                    console.log(
                        `Adding required ${sourceSystemIdFieldName} field to ${mapping.targetObjName}`
                    );
                    fieldsToCreate = [sourceSystemIdField, ...fieldsToCreate];
                }

                if (fieldsToCreate.length > 0) {
                    differences.push({
                        objectName: mapping.targetObjName,  // Use target object name for creation
                        fieldsToCreate
                    });
                }

            } catch (error) {
                console.error(`Error processing mapping ${mapping.sourceObjName} -> ${mapping.targetObjName}:`, error);
                throw error;
            }
        }

        const output: FieldSyncOutput = {
            timestamp: new Date().toISOString(),
            differences
        };

        // Create the output file
        const outputPath = path.join(process.cwd(), 'field-differences.json');
        await fs.writeFile(
            outputPath,
            JSON.stringify(output, null, 2),
            'utf8'
        );

        return outputPath;
    }
}
