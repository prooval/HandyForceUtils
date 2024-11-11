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

    private generateFieldMetadataXml(objectName: string, field: FieldDefinition): string {
        const fieldType = this.getSalesforceFieldType(field);
        
        let fieldMetadata = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${field.name}</fullName>
    <label>${field.label}</label>
    <type>${fieldType}</type>`;

        // Add type-specific elements
        switch (fieldType) {
            case 'Text':
                fieldMetadata += `
    <length>${field.length || 255}</length>`;
                break;
            case 'Number':
                if (field.precision) {
                    fieldMetadata += `
    <precision>${field.precision}</precision>`;
                }
                if (field.scale) {
                    fieldMetadata += `
    <scale>${field.scale}</scale>`;
                }
                break;
            case 'Picklist':
                if (field.picklistValues && field.picklistValues.length > 0) {
                    fieldMetadata += `
    <valueSet>
        <valueSetDefinition>`;
                    field.picklistValues.forEach(value => {
                        fieldMetadata += `
            <value>
                <fullName>${value.value}</fullName>
                <default>${value.default}</default>
                <label>${value.label}</label>
            </value>`;
                    });
                    fieldMetadata += `
        </valueSetDefinition>
    </valueSet>`;
                }
                break;
            case 'LongTextArea':
                fieldMetadata += `
    <length>${field.length || 32768}</length>
    <visibleLines>3</visibleLines>`;
                break;
            case 'Lookup':
                if (field.referenceTo && field.referenceTo.length > 0) {
                    fieldMetadata += `
    <referenceTo>${field.referenceTo[0]}</referenceTo>
    <relationshipLabel>${field.label}</relationshipLabel>
    <relationshipName>${this.generateRelationshipName(field.name)}</relationshipName>`;
                }
                break;
        }

        // Add common optional elements
        if (field.required) {
            fieldMetadata += `
    <required>${field.required}</required>`;
        }
        if (field.unique) {
            fieldMetadata += `
    <unique>${field.unique}</unique>`;
        }
        if (field.externalId) {
            fieldMetadata += `
    <externalId>${field.externalId}</externalId>`;
        }
        if (field.defaultValue !== undefined) {
            fieldMetadata += `
    <defaultValue>${field.defaultValue}</defaultValue>`;
        }
        if (field.description) {
            fieldMetadata += `
    <description>${field.description}</description>`;
        }
        if (field.inlineHelpText) {
            fieldMetadata += `
    <inlineHelpText>${field.inlineHelpText}</inlineHelpText>`;
        }

        // Close the root element
        fieldMetadata += `
</CustomField>`;

        return fieldMetadata;
    }

    private getSalesforceFieldType(field: FieldDefinition): string {
        const typeMapping: { [key: string]: string } = {
            'string': 'Text',
            'text': 'Text',
            'boolean': 'Checkbox',
            'int': 'Number',
            'double': 'Number',
            'currency': 'Currency',
            'date': 'Date',
            'datetime': 'DateTime',
            'email': 'Email',
            'phone': 'Phone',
            'url': 'Url',
            'textarea': 'TextArea',
            'longtextarea': 'LongTextArea',
            'picklist': 'Picklist',
            'multipicklist': 'MultiselectPicklist',
            'reference': 'Lookup',
            'percent': 'Percent'
        };

        return typeMapping[field.type.toLowerCase()] || 'Text';
    }

    private generateRelationshipName(fieldName: string): string {
        // Remove AFS390_ prefix and __c suffix
        let baseName = fieldName
            .replace(/^AFS390_/, '')
            .replace(/__c$/, '');
        
        // If the field ends with "Id", remove it
        baseName = baseName.replace(/Id$/, '');
        
        return baseName;
    }

    private async generatePackageXml(
        differences: ObjectFieldDiff[], 
        outputFolderPath: string
    ): Promise<void> {
        let packageXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <name>CustomField</name>`;
        
        // Add all fields
        differences.forEach(diff => {
            diff.fieldsToCreate.forEach(field => {
                packageXml += `
        <members>${diff.objectName}.${field.name}</members>`;
            });
        });

        packageXml += `
    </types>
    <types>
        <name>PermissionSet</name>
        <members>diffPermissionSet</members>
    </types>
    <version>58.0</version>
</Package>`;

        await fs.writeFile(
            path.join(outputFolderPath, 'package.xml'),
            packageXml,
            'utf8'
        );
    }

    private async generatePermissionSet(
        differences: ObjectFieldDiff[], 
        outputFolderPath: string
    ): Promise<void> {
        let permissionSet = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Permission set for migrated fields</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>Migration Diff Permission Set</label>`;

        // Add field permissions
        differences.forEach(diff => {
            diff.fieldsToCreate.forEach(field => {
                permissionSet += `
    <fieldPermissions>
        <editable>true</editable>
        <field>${diff.objectName}.${field.name}</field>
        <readable>true</readable>
    </fieldPermissions>`;
            });
        });

        permissionSet += `
</PermissionSet>`;

        const permissionSetPath = path.join(outputFolderPath, 'permissionsets');
        await fs.mkdir(permissionSetPath, { recursive: true });
        await fs.writeFile(
            path.join(permissionSetPath, 'diffPermissionSet.permissionset-meta.xml'),
            permissionSet,
            'utf8'
        );
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

    private transformToTargetFieldName(sourceName: string): string {
        // Handle special case for source system ID field
        if (sourceName.toLowerCase() === 'afs390_sourcesystemid__c') {
            return 'AFS390_SOURCESYSTEMID__c';
        }
    
        // Remove the __c suffix if it exists
        const baseName = sourceName.replace(/__c$/, '');
        
        // Remove any existing prefix patterns like AFS390_ if they exist
        const cleanName = baseName.replace(/^(AFS390_|afs390_)/, '');
        
        // Split by underscore and capitalize each part
        const parts = cleanName.split(/[_\s]+/);  // Split by underscore or spaces
        const capitalizedParts = parts.map(part => {
            // Convert the part to uppercase if it's an abbreviation (all caps)
            if (part.toUpperCase() === part && part.length > 1) {
                return part.toUpperCase();
            }
            // Otherwise capitalize first letter and lowercase the rest
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        });
        
        // Join and add the AFS390 prefix and __c suffix
        return `AFS390_${capitalizedParts.join('')}__c`;
    }
}

