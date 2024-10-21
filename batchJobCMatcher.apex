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
            if (l.PostalCode != null) {
                postalCodes.add(l.PostalCode);
                postalCodes.add(getFirstFiveDigits(l.PostalCode));
            }
            if (l.Street != null) streets.add(cleanStreetAddress(l.Street));
        }
        
        // Query for potential matching Contacts
        List<Contact> potentialMatches = [
            SELECT Id, FirstName, LastName, Mailing_Zip_Postal_Code__c, Mailing_Address_Line_1__c, AccountId
            FROM Contact
            WHERE FirstName IN :firstNames
            AND LastName IN :lastNames
            AND (Mailing_Zip_Postal_Code__c IN :postalCodes 
                 OR Mailing_Zip_Postal_Code__c IN (SELECT PostalCode FROM Lead WHERE Id IN :scope))
        ];
        
        // Create a map for efficient matching
        Map<String, Contact> matchKeyToContact = new Map<String, Contact>();
        for (Contact c : potentialMatches) {
            String fullZipMatchKey = (c.FirstName + '|' + c.LastName + '|' + c.Mailing_Zip_Postal_Code__c + '|' + cleanStreetAddress(c.Mailing_Address_Line_1__c)).toLowerCase();
            String partialZipMatchKey = (c.FirstName + '|' + c.LastName + '|' + getFirstFiveDigits(c.Mailing_Zip_Postal_Code__c) + '|' + cleanStreetAddress(c.Mailing_Address_Line_1__c)).toLowerCase();
            matchKeyToContact.put(fullZipMatchKey, c);
            matchKeyToContact.put(partialZipMatchKey, c);
        }
        
        List<Lead> leadsToUpdate = new List<Lead>();
        
        for (Lead l : scope) {
            if (l.FirstName != null && l.LastName != null && l.PostalCode != null && l.Street != null) {
                String fullZipLeadMatchKey = (l.FirstName + '|' + l.LastName + '|' + l.PostalCode + '|' + cleanStreetAddress(l.Street)).toLowerCase();
                String partialZipLeadMatchKey = (l.FirstName + '|' + l.LastName + '|' + getFirstFiveDigits(l.PostalCode) + '|' + cleanStreetAddress(l.Street)).toLowerCase();
                
                if (matchKeyToContact.containsKey(fullZipLeadMatchKey) || matchKeyToContact.containsKey(partialZipLeadMatchKey)) {
                    Contact matchedContact = matchKeyToContact.get(fullZipLeadMatchKey) != null ? 
                                             matchKeyToContact.get(fullZipLeadMatchKey) : 
                                             matchKeyToContact.get(partialZipLeadMatchKey);
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
    
    private String cleanStreetAddress(String street) {
        return street.endsWith(', ,') ? street.substring(0, street.length() - 3).trim() : street.trim();
    }
    
    private String getFirstFiveDigits(String postalCode) {
        return postalCode.length() >= 5 ? postalCode.substring(0, 5) : postalCode;
    }
}
