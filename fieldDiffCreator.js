public async createDiffFieldsInTargetOrg(outputFolderPath: string): Promise<void> {
    try {
        // Read the differences file
        const diffFilePath = path.join(process.cwd(), 'field-differences.json');
        const diffContent = await fs.readFile(diffFilePath, 'utf8');
        const { differences } = JSON.parse(diffContent) as FieldSyncOutput;

        // Create output directories
        await fs.mkdir(outputFolderPath, { recursive: true });

        // Generate metadata files for each field
        for (const diff of differences) {
            const objectPath = path.join(outputFolderPath, 'objects', diff.objectName, 'fields');
            await fs.mkdir(objectPath, { recursive: true });

            for (const field of diff.fieldsToCreate) {
                const fieldMetadata = this.generateFieldMetadataXml(diff.objectName, field);
                const fieldPath = path.join(objectPath, `${field.name}.field-meta.xml`);
                await fs.writeFile(fieldPath, fieldMetadata, 'utf8');
                console.log(`Generated metadata for ${diff.objectName}.${field.name}`);
            }
        }

        // Generate package.xml
        await this.generatePackageXml(differences, outputFolderPath);
        console.log('Generated package.xml');

        // Generate permission set
        await this.generatePermissionSet(differences, outputFolderPath);
        console.log('Generated permission set');

    } catch (error) {
        console.error('Error creating diff fields:', error);
        throw error;
    }
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

private generatePackageXml(differences: ObjectFieldDiff[], outputFolderPath: string): Promise<void> {
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

    return fs.writeFile(
        path.join(outputFolderPath, 'package.xml'),
        packageXml,
        'utf8'
    );
}

private generatePermissionSet(differences: ObjectFieldDiff[], outputFolderPath: string): Promise<void> {
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
    return fs.mkdir(permissionSetPath, { recursive: true })
        .then(() => fs.writeFile(
            path.join(permissionSetPath, 'diffPermissionSet.permissionset-meta.xml'),
            permissionSet,
            'utf8'
        ));
}
