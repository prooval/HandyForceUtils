type SalesforceRecord = Record<string, any>;

function cleanObject<T extends SalesforceRecord>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => {
            // Check for null or undefined
            if (value === null || value === undefined) return false;
            
            // Check for empty string
            if (value === '') return false;
            
            // Check for empty array
            if (Array.isArray(value) && value.length === 0) return false;
            
            // Check for empty object (no keys)
            if (value && typeof value === 'object' && !Array.isArray(value) && 
                Object.keys(value).length === 0) return false;
            
            return true;
        })
    ) as Partial<T>;
}

// Example usage:
const transformedRecords: SalesforceRecord = {
    id: '001',
    name: '',
    email: 'test@example.com',
    phone: null,
    tags: [],
    metadata: {},
    status: undefined,
    description: 'Active account'
};

const cleanedRecords = cleanObject(transformedRecords);
console.log(cleanedRecords);
// Output:
// {
//     id: '001',
//     email: 'test@example.com',
//     description: 'Active account'
// }

/**
 * Removes all empty, null, or undefined values from an object
 * @param obj The input object to clean
 * @returns A new object with empty values removed
 */
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => {
            // Check for null or undefined
            if (value === null || value === undefined) return false;
            
            // Check for empty string
            if (value === '') return false;
            
            // Check for empty array
            if (Array.isArray(value) && value.length === 0) return false;
            
            // Check for empty object (no keys)
            if (value && typeof value === 'object' && !Array.isArray(value) && 
                Object.keys(value).length === 0) return false;
            
            return true;
        })
    ) as Partial<T>;
}

// Example usage with different types:

// With a custom interface
interface User {
    id: string;
    name: string;
    email: string | null;
    phone?: string;
    metadata: Record<string, unknown>;
}

const user: User = {
    id: '001',
    name: '',
    email: null,
    metadata: {}
};

const cleanedUser = cleanObject(user);
// Output: { id: '001' }

// With a simple object
const data = {
    title: 'Hello',
    description: '',
    tags: [],
    count: 0,  // Note: 0 is preserved as it's a valid value
    isActive: false  // Note: false is preserved as it's a valid value
};

const cleanedData = cleanObject(data);
// Output: { title: 'Hello', count: 0, isActive: false }

/**
 * Validates SSN/Tax ID format based on account type
 * @param ssnTaxId - The SSN or Tax ID to validate
 * @param isPersonAccount - Whether this is a person account (true) or business account (false)
 * @returns boolean indicating if the format is valid
 */
function isValidSsnTaxId(ssnTaxId: string, isPersonAccount: boolean): boolean {
    // Handle empty cases
    if (!ssnTaxId || typeof ssnTaxId !== 'string') {
        return false;
    }

    // Remove all non-alphanumeric characters
    const cleaned = ssnTaxId.replace(/[^0-9]/g, '');
    
    if (isPersonAccount) {
        // Person account must follow SSN format [0-9]{3}-[0-9]{2}-[0-9]{4}
        return /^[0-9]{3}[0-9]{2}[0-9]{4}$/.test(cleaned);
    } else {
        // Business account must follow EIN format [0-9]{2}-[0-9]{7}
        return /^[0-9]{9}$/.test(cleaned);
    }
}

// Format function to standardize the display
function formatSsnTaxId(ssnTaxId: string, isPersonAccount: boolean): string {
    if (!isValidSsnTaxId(ssnTaxId, isPersonAccount)) {
        return '';
    }

    const cleaned = ssnTaxId.replace(/[^0-9]/g, '');
    
    if (isPersonAccount) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    } else {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    }
}

// Example usage:
console.log(isValidSsnTaxId('123-45-6789', true));  // true
console.log(isValidSsnTaxId('12-3456789', false));  // true
console.log(isValidSsnTaxId('12345', false));       // false
console.log(isValidSsnTaxId('', true));             // false

console.log(formatSsnTaxId('123456789', true));     // '123-45-6789'
console.log(formatSsnTaxId('123456789', false));    // '12-3456789'