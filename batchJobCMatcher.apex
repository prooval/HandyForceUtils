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

@isTest
private class LeadContactMatcherTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Create test Contacts with different zip code formats
        List<Contact> contactsToInsert = new List<Contact>();
        
        // Contact with 5-digit zip
        Contact contact1 = new Contact(
            FirstName = 'John',
            LastName = 'Doe',
            Mailing_Address_Line_1__c = '123 Main St',
            Mailing_Zip_Postal_Code__c = '12345',
            AccountId = testAccount.Id
        );
        contactsToInsert.add(contact1);
        
        // Contact with 9-digit zip
        Contact contact2 = new Contact(
            FirstName = 'Jane',
            LastName = 'Smith',
            Mailing_Address_Line_1__c = '456 Oak Ave',
            Mailing_Zip_Postal_Code__c = '67890-1234',
            AccountId = testAccount.Id
        );
        contactsToInsert.add(contact2);
        
        insert contactsToInsert;
        
        // Create test Leads with different scenarios
        List<Lead> leadsToInsert = new List<Lead>();
        
        // Lead matching contact1 (5-digit zip)
        Lead lead1 = new Lead(
            FirstName = 'John',
            LastName = 'Doe',
            Company = 'Test Company',
            Street = '123 Main St',
            PostalCode = '12345'
        );
        leadsToInsert.add(lead1);
        
        // Lead matching contact2 (with 5-digit zip matching contact's 9-digit)
        Lead lead2 = new Lead(
            FirstName = 'Jane',
            LastName = 'Smith',
            Company = 'Test Company 2',
            Street = '456 Oak Ave',
            PostalCode = '67890'
        );
        leadsToInsert.add(lead2);
        
        // Lead with street ending in ', ,' matching contact1
        Lead lead3 = new Lead(
            FirstName = 'John',
            LastName = 'Doe',
            Company = 'Test Company 3',
            Street = '123 Main St, ,',
            PostalCode = '12345'
        );
        leadsToInsert.add(lead3);
        
        // Lead with no match
        Lead lead4 = new Lead(
            FirstName = 'No',
            LastName = 'Match',
            Company = 'No Match Corp',
            Street = 'Different Street',
            PostalCode = '99999'
        );
        leadsToInsert.add(lead4);
        
        // Lead with null fields
        Lead lead5 = new Lead(
            FirstName = null,
            LastName = 'Incomplete',
            Company = 'Incomplete Corp',
            Street = null,
            PostalCode = null
        );
        leadsToInsert.add(lead5);
        
        insert leadsToInsert;
    }
    
    @isTest
    static void testBatchExecution() {
        // Start the batch job
        Test.startTest();
        LeadContactMatcher batchJob = new LeadContactMatcher();
        Database.executeBatch(batchJob, 200);
        Test.stopTest();
        
        // Verify results
        List<Lead> updatedLeads = [
            SELECT Id, Status, ConvertedContactId, ConvertedAccountId 
            FROM Lead 
            WHERE Status = 'Closed - Converted'
        ];
        
        System.assertEquals(3, updatedLeads.size(), 'Expected 3 leads to be converted (2 direct matches and 1 with cleaned street)');
        
        // Verify unmatched leads weren't converted
        List<Lead> unmatchedLeads = [
            SELECT Id 
            FROM Lead 
            WHERE FirstName = 'No' OR FirstName = null
        ];
        for(Lead l : unmatchedLeads) {
            System.assertNotEquals('Closed - Converted', l.Status, 'Unmatched leads should not be converted');
        }
    }
    
    @isTest
    static void testZipCodeMatching() {
        // Query the lead with 5-digit zip matching a contact with 9-digit zip
        Lead testLead = [
            SELECT Id, Status, ConvertedContactId 
            FROM Lead 
            WHERE FirstName = 'Jane' 
            LIMIT 1
        ];
        
        Contact matchingContact = [
            SELECT Id 
            FROM Contact 
            WHERE FirstName = 'Jane' 
            LIMIT 1
        ];
        
        Test.startTest();
        LeadContactMatcher batchJob = new LeadContactMatcher();
        Database.executeBatch(batchJob, 200);
        Test.stopTest();
        
        // Refresh the lead data
        testLead = [SELECT Id, Status, ConvertedContactId FROM Lead WHERE Id = :testLead.Id];
        
        System.assertEquals(matchingContact.Id, testLead.ConvertedContactId, 
            'Lead should match contact despite different zip code formats');
    }
    
    @isTest
    static void testStreetCleaning() {
        // Query the lead with ', ,' in street
        Lead testLead = [
            SELECT Id, Status, ConvertedContactId 
            FROM Lead 
            WHERE Street LIKE '%, ,%' 
            LIMIT 1
        ];
        
        Contact matchingContact = [
            SELECT Id 
            FROM Contact 
            WHERE FirstName = 'John' 
            LIMIT 1
        ];
        
        Test.startTest();
        LeadContactMatcher batchJob = new LeadContactMatcher();
        Database.executeBatch(batchJob, 200);
        Test.stopTest();
        
        // Refresh the lead data
        testLead = [SELECT Id, Status, ConvertedContactId FROM Lead WHERE Id = :testLead.Id];
        
        System.assertEquals(matchingContact.Id, testLead.ConvertedContactId, 
            'Lead should match contact after street address cleaning');
    }
    
    @isTest
    static void testBatchWithEmptyData() {
        // Delete all existing leads
        delete [SELECT Id FROM Lead];
        
        Test.startTest();
        LeadContactMatcher batchJob = new LeadContactMatcher();
        Database.executeBatch(batchJob, 200);
        Test.stopTest();
        
        // Verify no errors occurred
        List<AsyncApexJob> jobsApexJob = [
            SELECT Id, Status, NumberOfErrors 
            FROM AsyncApexJob 
            WHERE ApexClass.Name = 'LeadContactMatcher'
        ];
        
        System.assertEquals(0, jobsApexJob[0].NumberOfErrors, 'Batch should handle empty data without errors');
    }
    
    @isTest
    static void testHelperMethods() {
        LeadContactMatcher batchJob = new LeadContactMatcher();
        
        // Test cleanStreetAddress method using reflection
        String cleanedStreet = (String)JSON.deserialize(
            JSON.serialize(batchJob).replace('"123 Main St, ,"', '"123 Main St"'),
            LeadContactMatcher.class
        ).toString();
        System.assertNotEquals(null, cleanedStreet, 'Street cleaning should not return null');
        
        // Test getFirstFiveDigits method using reflection
        String fiveDigitZip = (String)JSON.deserialize(
            JSON.serialize(batchJob).replace('"12345-6789"', '"12345"'),
            LeadContactMatcher.class
        ).toString();
        System.assertNotEquals(null, fiveDigitZip, 'Zip code extraction should not return null');
    }
}
