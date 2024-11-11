import { Connection } from 'jsforce';
import { FieldDefinition, FieldMetadata } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MappingFile {
    filename: string;
    content: string;
}

interface ObjectMapping {
    sourceObject: string;
    targetObject: string;
    fieldMappings: FieldMapping[];
}

interface FieldMapping {
    sourceField: string;
    targetField: string;
    required?: boolean;
    comment?: string;
}

export class FieldMappingGenerator {
    private sourceConn: Connection;
    private targetConn: Connection;
    
    constructor(sourceConn: Connection, targetConn: Connection) {
        this.sourceConn = sourceConn;
        this.targetConn = targetConn;
    }

    private async describeObject(conn: Connection, objectName: string): Promise<any> {
        try {
            return await conn.describe(objectName);
        } catch (error) {
            console.error(`Error describing object ${objectName}:`, error);
            throw error;
        }
    }

    private isSystemField(fieldName: string): boolean {
        const systemFields = [
            'CreatedById', 'CreatedDate', 'LastModifiedById', 
            'LastModifiedDate', 'SystemModstamp', 'IsDeleted'
        ];
        return systemFields.includes(fieldName);
    }

    private async generateObjectMapping(objectName: string): Promise<ObjectMapping> {
        const sourceDesc = await this.describeObject(this.sourceConn, objectName);
        const targetDesc = await this.describeObject(this.targetConn, objectName);

        const fieldMappings: FieldMapping[] = [];
        const processedFields = new Set<string>();

        // Process source fields
        for (const sourceField of sourceDesc.fields) {
            if (this.isSystemField(sourceField.name)) continue;

            const targetField = targetDesc.fields.find(
                (f: any) => f.name === sourceField.name
            );

            const mapping: FieldMapping = {
                sourceField: sourceField.name,
                targetField: sourceField.name,
            };

            if (!targetField) {
                mapping.comment = 'NotInTargetOrg';
            } else if (targetField.nillable === false) {
                mapping.required = true;
                mapping.comment = 'RequiredField';
            }

            fieldMappings.push(mapping);
            processedFields.add(sourceField.name);
        }

        // Check for target fields not in source
        for (const targetField of targetDesc.fields) {
            if (
                !processedFields.has(targetField.name) && 
                !this.isSystemField(targetField.name)
            ) {
                fieldMappings.push({
                    sourceField: targetField.name,
                    targetField: targetField.name,
                    comment: 'NotInSourceOrg'
                });
            }
        }

        return {
            sourceObject: objectName,
            targetObject: objectName,
            fieldMappings
        };
    }

    private generateTypeDefinitionContent(objectName: string, fields: any[]): string {
        const fieldsContent = fields
            .filter(field => !this.isSystemField(field.name))
            .map(field => {
                const fieldType = this.getSalesforceFieldType(field);
                return `    ${field.name}: ${fieldType};${field.nillable ? '' : ' // RequiredField'}`;
            })
            .join('\n');

        return `
import { ${this.getRequiredTypeImports(fields)} } from "../common/types/salesforce/fieldTypes";

export interface ${objectName}Fields {
${fieldsContent}
}
`;
    }

    private getSalesforceFieldType(field: any): string {
        const typeMapping: { [key: string]: string } = {
            'string': 'SalesforceString',
            'boolean': 'SalesforceBoolean',
            'int': 'SalesforceNumber',
            'double': 'SalesforceNumber',
            'date': 'SalesforceDate',
            'datetime': 'SalesforceDateTime',
            'email': 'SalesforceEmail',
            'phone': 'SalesforcePhone',
            'url': 'SalesforceUrl',
            'textarea': 'SalesforceTextArea',
            'picklist': 'SalesforcePicklist<string>',
            'multipicklist': 'SalesforceMultiSelect<string>',
            'reference': 'SalesforceLookup',
            'id': 'SalesforceId',
            'currency': 'SalesforceCurrency',
            'percent': 'SalesforcePercent',
            'base64': 'SalesforceBase64',
            'location': 'SalesforceLocation',
            'address': 'SalesforceAddress'
        };

        return typeMapping[field.type] || 'SalesforceString';
    }

    private getRequiredTypeImports(fields: any[]): string {
        const typeSet = new Set<string>();
        
        fields.forEach(field => {
            const fieldType = this.getSalesforceFieldType(field);
            typeSet.add(fieldType.replace(/<.*>/, '')); // Remove generic type parameters
        });

        return Array.from(typeSet).sort().join(', ');
    }

    private generateMappingContent(mapping: ObjectMapping): string {
        const fieldMappingsStr = mapping.fieldMappings
            .map(fm => {
                let mappingStr = `    {
        sourceField: '${fm.sourceField}',
        targetField: '${fm.targetField}'`;
                
                if (fm.required) {
                    mappingStr += `,
        required: true`;
                }

                mappingStr += ` // ${fm.comment}`;
                
                return mappingStr + '    }';
            })
            .join(',\n');

        return `
import { MigrationObjectConfig } from '../common/types/migration';
import { ${mapping.sourceObject} as Source${mapping.sourceObject} } from './source';
import { ${mapping.targetObject} as Target${mapping.targetObject} } from './target';

export const config: MigrationObjectConfig<Source${mapping.sourceObject}, Target${mapping.targetObject}> = {
    sourceObject: '${mapping.sourceObject}',
    targetObject: '${mapping.targetObject}',
    fieldMappings: [
${fieldMappingsStr}
    ]
};
`;
    }

    public async generateMapping(objectNames: string[]): Promise<MappingFile[]> {
        const mappingFiles: MappingFile[] = [];

        for (const objectName of objectNames) {
            try {
                const sourceDesc = await this.describeObject(this.sourceConn, objectName);
                const targetDesc = await this.describeObject(this.targetConn, objectName);
                const mapping = await this.generateObjectMapping(objectName);
                const lowerObjectName = objectName.toLowerCase();

                // Generate source type definition
                mappingFiles.push({
                    filename: `${lowerObjectName}/source.ts`,
                    content: this.generateTypeDefinitionContent(objectName, sourceDesc.fields)
                });

                // Generate target type definition
                mappingFiles.push({
                    filename: `${lowerObjectName}/target.ts`,
                    content: this.generateTypeDefinitionContent(objectName, targetDesc.fields)
                });

                // Generate mapping configuration
                mappingFiles.push({
                    filename: `${lowerObjectName}/${lowerObjectName}migration.ts`,
                    content: this.generateMappingContent(mapping)
                });

            } catch (error) {
                console.error(`Error generating mapping for ${objectName}:`, error);
                throw error;
            }
        }

        return mappingFiles;
    }

    public async writeMapping(baseDir: string, objectNames: string[]): Promise<void> {
        try {
            const mappingFiles = await this.generateMapping(objectNames);

            for (const file of mappingFiles) {
                const fullPath = path.join(baseDir, file.filename);
                const dirPath = path.dirname(fullPath);

                await fs.mkdir(dirPath, { recursive: true });
                await fs.writeFile(fullPath, file.content, 'utf8');

                console.log(`Successfully written: ${fullPath}`);
            }

            console.log('All mapping files have been written successfully.');
        } catch (error) {
            console.error('Error writing mapping files:', error);
            throw error;
        }
    }
}
