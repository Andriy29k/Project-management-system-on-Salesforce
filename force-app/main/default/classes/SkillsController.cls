public with sharing class SkillsController {

    @AuraEnabled(cacheable=true)
    public static Map<String, List<Resource_Skill__c>>  getSkillsByUser(Id userId) {
        Map<String, List<Resource_Skill__c>> skillsByType = new Map<String, List<Resource_Skill__c>>();
        Resource__c resource = [SELECT Id FROM Resource__c WHERE User__c = :userId LIMIT 1];

        if (resource != null) {
            List<Resource_Skill__c> skills = [
                    SELECT Skill__r.Name, Skill__r.Type__c, Rating__c, Date_of_Receipt__c, Expiration_Date__c
                    FROM Resource_Skill__c
                    WHERE Resource__c = :resource.Id
            ];

            for( Resource_Skill__c curSkill : skills ) {
                if( !skillsByType.containsKey( curSkill.Skill__r.Type__c ) ) {
                    skillsByType.put( curSkill.Skill__r.Type__c, new List<Resource_Skill__c>() );
                }
                skillsByType.get( curSkill.Skill__r.Type__c ).add( curSkill );
            }
            return skillsByType;
        }
        return new Map<String, List<Resource_Skill__c>>();
    }
}