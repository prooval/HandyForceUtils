public class DuplicateJobAnalyzer {
    public static void analyzeDuplicateJob(Id jobId) {
        List<Map<String, Object>> results = new List<Map<String, Object>>();
        Set<Id> allDuplicateRecordIds = new Set<Id>();
        
        List<DuplicateRecordSet> duplicateSets = [
            SELECT Id, RecordCount, (
                SELECT Id, RecordId, Name, CreatedDate 
                FROM DuplicateRecordItems
            )
            FROM DuplicateRecordSet
            WHERE DuplicateJobId = :jobId
            AND RecordCount > 10 AND RecordCount < 50
        ];
        
        for (DuplicateRecordSet drs : duplicateSets) {
            Map<String, Object> setInfo = new Map<String, Object>{
                'duplicateRecordSetId' => drs.Id,
                'recordCount' => drs.RecordCount,
                'duplicateRecords' => new List<Map<String, Object>>()
            };
            
            for (DuplicateRecordItem dri : drs.DuplicateRecordItems) {
                allDuplicateRecordIds.add(dri.RecordId);
                Map<String, Object> recordInfo = new Map<String, Object>{
                    'duplicateRecordId' => dri.RecordId,
                    'name' => dri.Name,
                    'createdDate' => dri.CreatedDate.format()
                };
                ((List<Map<String, Object>>)setInfo.get('duplicateRecords')).add(recordInfo);
            }
            
            results.add(setInfo);
        }
        
        // Query Contact details
        Map<Id, Contact> contactDetails = new Map<Id, Contact>([
            SELECT Id, Name, Email, Phone, AccountId, Account.Name, 
                   CustomerNumber__c // Assuming CustomerNumber__c is the field name for customer number
            FROM Contact
            WHERE Id IN :allDuplicateRecordIds
        ]);
        
        // Add Contact details to the results
        for (Map<String, Object> setInfo : results) {
            List<Map<String, Object>> duplicateRecords = (List<Map<String, Object>>)setInfo.get('duplicateRecords');
            for (Map<String, Object> recordInfo : duplicateRecords) {
                Id recordId = (Id)recordInfo.get('duplicateRecordId');
                Contact con = contactDetails.get(recordId);
                if (con != null) {
                    recordInfo.put('contactDetails', new Map<String, Object>{
                        'name' => con.Name,
                        'email' => con.Email,
                        'phone' => con.Phone,
                        'customerNumber' => con.CustomerNumber__c,
                        'accountName' => con.Account?.Name
                    });
                }
            }
        }
        
        String jsonOutput = JSON.serializePretty(results);
        System.debug(LoggingLevel.INFO, jsonOutput);
    }
}
