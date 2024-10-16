global class LeadContactMatcher implements Database.Batchable<sObject>, Database.Stateful {
    
    private Date oneYearAgo = Date.today().addYears(-1);
    private Integer matchedLeadsCount = 0;
    
    global Database.QueryLocator start(Database.BatchableContext BC) {
        return Database.getQueryLocator([
            SELECT Id, FirstName, LastName, PostalCode, Street, ConvertedContactId
            FROM Lead
            WHERE CreatedDate >= :oneYearAgo
            AND IsConverted = false
        ]);
    }
    
    global void execute(Database.BatchableContext BC, List<Lead> scope) {
        Set<String> firstNames = new Set<String>();
        Set<String> lastNames = new Set<String>();
        Set<String> postalCodes = new Set<String>();
        Set<String> streets = new Set<String>();
        
        for (Lead l : scope) {
            if (l.FirstName != null) firstNames.add(l.FirstName);
            if (l.LastName != null) lastNames.add(l.LastName);
            if (l.PostalCode != null) postalCodes.add(l.PostalCode);
            if (l.Street != null) streets.add(l.Street);
        }
        
        // Query for potential matching Contacts
        List<Contact> potentialMatches = [
            SELECT Id, FirstName, LastName, Mailing_Zip_Postal_Code__c, Mailing_Address_Line_1__c, AccountId
            FROM Contact
            WHERE FirstName IN :firstNames
            AND LastName IN :lastNames
            AND Mailing_Zip_Postal_Code__c IN :postalCodes
            AND Mailing_Address_Line_1__c IN :streets
        ];
        
        // Create a map for efficient matching
        Map<String, Contact> matchKeyToContact = new Map<String, Contact>();
        for (Contact c : potentialMatches) {
            String matchKey = (c.FirstName + '|' + c.LastName + '|' + c.Mailing_Zip_Postal_Code__c + '|' + c.Mailing_Address_Line_1__c).toLowerCase();
            matchKeyToContact.put(matchKey, c);
        }
        
        List<Lead> leadsToUpdate = new List<Lead>();
        
        for (Lead l : scope) {
            if (l.FirstName != null && l.LastName != null && l.PostalCode != null && l.Street != null) {
                String leadMatchKey = (l.FirstName + '|' + l.LastName + '|' + l.PostalCode + '|' + l.Street).toLowerCase();
                if (matchKeyToContact.containsKey(leadMatchKey)) {
                    Contact matchedContact = matchKeyToContact.get(leadMatchKey);
                    l.ConvertedContactId = matchedContact.Id;
                    l.ConvertedAccountId = matchedContact.AccountId;
                    l.Status = 'Closed - Converted';
                    leadsToUpdate.add(l);
                    matchedLeadsCount++;
                }
            }
        }
        
        if (!leadsToUpdate.isEmpty()) {
            update leadsToUpdate;
        }
    }
    
    global void finish(Database.BatchableContext BC) {
        // Send an email with the results
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        String[] toAddresses = new String[] {'your-email@example.com'};
        mail.setToAddresses(toAddresses);
        mail.setSubject('Lead Contact Matcher Results');
        mail.setPlainTextBody('The batch process has completed. ' + matchedLeadsCount + ' leads were matched and updated.');
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
}

// ----------

// Query for a sample of Leads
List<Lead> leadsToProcess = [
    SELECT Id, FirstName, LastName, PostalCode, Street, ConvertedContactId
    FROM Lead
    WHERE CreatedDate >= LAST_N_DAYS:365
    AND IsConverted = false
    LIMIT 200
];

// Collect unique values for each field
Set<String> firstNames = new Set<String>();
Set<String> lastNames = new Set<String>();
Set<String> postalCodes = new Set<String>();
Set<String> streets = new Set<String>();

for (Lead l : leadsToProcess) {
    if (l.FirstName != null) firstNames.add(l.FirstName);
    if (l.LastName != null) lastNames.add(l.LastName);
    if (l.PostalCode != null) postalCodes.add(l.PostalCode);
    if (l.Street != null) streets.add(l.Street);
}

// Query for potential matching Contacts
List<Contact> potentialMatches = [
    SELECT Id, FirstName, LastName, Mailing_Zip_Postal_Code__c, Mailing_Address_Line_1__c, AccountId
    FROM Contact
    WHERE FirstName IN :firstNames
    AND LastName IN :lastNames
    AND Mailing_Zip_Postal_Code__c IN :postalCodes
    AND Mailing_Address_Line_1__c IN :streets
];

// Create a map for efficient matching
Map<String, Contact> matchKeyToContact = new Map<String, Contact>();
for (Contact c : potentialMatches) {
    String matchKey = (c.FirstName + '|' + c.LastName + '|' + c.Mailing_Zip_Postal_Code__c + '|' + c.Mailing_Address_Line_1__c).toLowerCase();
    matchKeyToContact.put(matchKey, c);
}

// Process Leads and find matches
List<Lead> leadsToUpdate = new List<Lead>();
Integer matchedLeadsCount = 0;

for (Lead l : leadsToProcess) {
    if (l.FirstName != null && l.LastName != null && l.PostalCode != null && l.Street != null) {
        String leadMatchKey = (l.FirstName + '|' + l.LastName + '|' + l.PostalCode + '|' + l.Street).toLowerCase();
        if (matchKeyToContact.containsKey(leadMatchKey)) {
            Contact matchedContact = matchKeyToContact.get(leadMatchKey);
            l.ConvertedContactId = matchedContact.Id;
            l.ConvertedAccountId = matchedContact.AccountId;
            l.Status = 'Closed - Converted';
            leadsToUpdate.add(l);
            matchedLeadsCount++;
        }
    }
}

// Output results
System.debug('Total Leads processed: ' + leadsToProcess.size());
System.debug('Matched Leads: ' + matchedLeadsCount);
System.debug('Leads to update: ' + leadsToUpdate.size());

// Uncomment the following line to actually update the Leads
// update leadsToUpdate;

