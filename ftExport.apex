public class FieldTripAnalyzer {
    public static String generateFieldAnalysisJson(String fieldTripName, Decimal minPopulationPercentage) {
        // Query Field Trip results
        List<Field_Trip__c> fieldTripResults = [
            SELECT Object_Name__c, Field_API_Name__c, Field_Name__c, Population_Percent__c, Record_Count__c
            FROM Field_Trip__c 
            WHERE Name = :fieldTripName 
            AND Population_Percent__c >= :minPopulationPercentage
            ORDER BY Object_Name__c, Population_Percent__c DESC
        ];
        
        // Create map to group fields by object
        Map<String, List<Map<String, Object>>> objectToFields = new Map<String, List<Map<String, Object>>>();
        
        for(Field_Trip__c result : fieldTripResults) {
            if(!objectToFields.containsKey(result.Object_Name__c)) {
                objectToFields.put(result.Object_Name__c, new List<Map<String, Object>>());
            }
            
            Map<String, Object> fieldInfo = new Map<String, Object>{
                'apiName' => result.Field_API_Name__c,
                'label' => result.Field_Name__c,
                'populationPercent' => result.Population_Percent__c,
                'recordCount' => result.Record_Count__c
            };
            
            objectToFields.get(result.Object_Name__c).add(fieldInfo);
        }
        
        return JSON.serializePretty(objectToFields);
    }
    
    // Example usage
    public static void example() {
        String json = generateFieldAnalysisJson('YourFieldTripName', 40);
        System.debug(json);
        
        // To write to a file in Developer Console
        System.debug('To copy to a file:\n' + json.replace('"', '\\"'));
    }
}
