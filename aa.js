function getSalesforceRole(roleCode: string): string {
    // Standardize input: trim whitespace and convert to uppercase
    const code = roleCode.trim().toUpperCase();
    
    switch (code) {
        // Exact matches
        case 'AGT':
            return 'Agent';
        case 'SIG':
            return 'Authorized Signer';
        case 'BEN':
            return 'Beneficial Owner';  // Note: Could also be 'Beneficiary' based on context
        case 'POD':
            return 'Beneficiary';
        case 'BUS':
            return 'Business Manager';
        case 'COB':
            return 'Co-Borrower';
        case 'CON':
            return 'Controlling Party';
        case 'COM':
            return 'Corporation';
        case 'CUS':
            return 'Authorized User';
        case 'GUD':
            return 'Guardian';
        case 'GTR':
            return 'Guarantor';
        case 'MIN':
            return 'Minor';
        case 'POA':
            return 'Power of Attorney';
        case 'SOL':
            return 'Sole Owner';
        case 'TRU':
            return 'Trustee';
        case 'OTH':
            return 'Other';
        case 'ADM':
            return 'Accountant';
        case 'EXC':
            return 'Executor';
        case 'NSP':
            return 'Non-Individual';
            
        // Default case for unmatched codes
        default:
            return 'Other';
    }
}

// Example usage:
/*
console.log(getSalesforceRole('SIG'));  // Returns: "Authorized Signer"
console.log(getSalesforceRole('POA'));  // Returns: "Power of Attorney"
console.log(getSalesforceRole('ABC'));  // Returns: "Other"
*/