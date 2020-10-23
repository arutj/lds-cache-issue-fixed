public with sharing class AccDataSvc {

    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts(String accType){
        
        String query = 'SELECT Id, Name, Type FROM Account WHERE Type != NULL';
        if(String.isNotBlank(accType)){
            query += ' AND Type = :accType';
        }
        query += ' WITH SECURITY_ENFORCED';    
        
        return Database.query(query);
    }
    
    @AuraEnabled(cacheable=true)
    public static List<String> getAccTypes(){
        
        List<Account> accounts = [SELECT Type FROM Account WITH SECURITY_ENFORCED ORDER BY Type];
        List<String> accTypes = new List<String>();

        for(Account acc: accounts){
            if(String.isNotBlank(acc.Type) && !accTypes.contains(acc.Type)){
                accTypes.add(acc.Type);
            }
        }        

        return accTypes;
    }
}