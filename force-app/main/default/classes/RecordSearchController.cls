public with sharing class RecordSearchController {
    @AuraEnabled(cacheable=true)
    public static List<SObject> searchRecords(String objectName, String searchTerm) {
        if (String.isEmpty(objectName) || String.isEmpty(searchTerm)) {
            throw new AuraHandledException('Invalid input parameters');
        }

        try {
            String formattedSearchTerm = '%' + searchTerm + '%';
            String query = 'SELECT Id, Name FROM ' + String.escapeSingleQuotes( objectName ) + ' WHERE Name LIKE :formattedSearchTerm LIMIT 10';
            return Database.query(query);
        } catch (Exception ex) {
            System.debug('Error executing query: ' + ex.getMessage());
            throw new AuraHandledException('Failed to execute search. Contact your admin.');
        }
    }
}