// Service class to handle primary owner logic
public class FinancialAccountPrimaryOwnerService {
    
    /**
     * Determines the primary owner from a list of Financial Account Roles
     * @param financialAccountRoles List of Financial Account Roles to evaluate
     * @return FinancialAccountRole The primary owner role record, or null if none found
     */
    public static FinancialAccountRole determinePrimaryOwner(List<FinancialAccountRole> financialAccountRoles) {
        if (financialAccountRoles == null || financialAccountRoles.isEmpty()) {
            return null;
        }
        
        // Define priority order of role codes (adjust these based on your business rules)
        Map<String, Integer> rolePriority = new Map<String, Integer>{
            'PRIMARY_OWNER' => 1,
            'BENEFICIAL_OWNER' => 2,
            'TRUSTEE' => 3,
            'CUSTODIAN' => 4
        };
        
        FinancialAccountRole primaryOwnerRole;
        Integer highestPriority = Integer.MAX_VALUE;
        
        for (FinancialAccountRole role : financialAccountRoles) {
            if (role.RoleCode == null) continue;
            
            Integer currentPriority = rolePriority.get(role.RoleCode);
            if (currentPriority != null && currentPriority < highestPriority) {
                highestPriority = currentPriority;
                primaryOwnerRole = role;
            }
        }
        
        return primaryOwnerRole;
    }
}

// Batch class to process Financial Accounts
public class UpdateFinancialAccountPrimaryOwnerBatch implements Database.Batchable<sObject>, Database.Stateful {
    
    private Integer recordsProcessed = 0;
    private Integer recordsUpdated = 0;
    
    public Database.QueryLocator start(Database.BatchableContext BC) {
        // Query all Financial Accounts that need processing
        return Database.getQueryLocator([
            SELECT Id, PrimaryOwner__c
            FROM FinancialAccount
        ]);
    }
    
    public void execute(Database.BatchableContext BC, List<FinancialAccount> scope) {
        // Store Financial Account IDs
        Set<Id> financialAccountIds = new Set<Id>();
        for (FinancialAccount fa : scope) {
            financialAccountIds.add(fa.Id);
        }
        
        // Query related Financial Account Roles
        Map<Id, List<FinancialAccountRole>> faRolesMap = new Map<Id, List<FinancialAccountRole>>();
        for (FinancialAccountRole far : [
            SELECT Id, FinancialAccountId, RoleCode, AccountId
            FROM FinancialAccountRole
            WHERE FinancialAccountId IN :financialAccountIds
        ]) {
            if (!faRolesMap.containsKey(far.FinancialAccountId)) {
                faRolesMap.put(far.FinancialAccountId, new List<FinancialAccountRole>());
            }
            faRolesMap.get(far.FinancialAccountId).add(far);
        }
        
        // Process each Financial Account
        List<FinancialAccount> accountsToUpdate = new List<FinancialAccount>();
        
        for (FinancialAccount fa : scope) {
            recordsProcessed++;
            
            List<FinancialAccountRole> roles = faRolesMap.get(fa.Id);
            if (roles != null) {
                FinancialAccountRole primaryOwner = FinancialAccountPrimaryOwnerService.determinePrimaryOwner(roles);
                
                if (primaryOwner != null && fa.PrimaryOwner__c != primaryOwner.AccountId) {
                    fa.PrimaryOwner__c = primaryOwner.AccountId;
                    accountsToUpdate.add(fa);
                    recordsUpdated++;
                }
            }
        }
        
        // Update Financial Accounts if needed
        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }
    }
    
    public void finish(Database.BatchableContext BC) {
        // Send email notification with results
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        String[] toAddresses = new String[] { UserInfo.getUserEmail() };
        mail.setToAddresses(toAddresses);
        mail.setSubject('Financial Account Primary Owner Update Complete');
        mail.setPlainTextBody(
            'Batch process completed.\n' +
            'Records processed: ' + recordsProcessed + '\n' +
            'Records updated: ' + recordsUpdated
        );
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
}
