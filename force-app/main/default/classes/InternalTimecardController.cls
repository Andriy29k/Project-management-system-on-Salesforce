public with sharing class InternalTimecardController {
    @AuraEnabled(cacheable=true)
    public static List<String> getTimecardTypes() {
        List<String> timecardTypes = new List<String>();
        Schema.DescribeFieldResult fieldResult = Timecard__c.Type__c.getDescribe();

        // Retrieve picklist values and filter out "Client Project"
        for (Schema.PicklistEntry entry : fieldResult.getPicklistValues()) {
            if (entry.getValue() != 'Client Project') {
                timecardTypes.add(entry.getValue());
            }
        }
        return timecardTypes;
    }

    @AuraEnabled
    public static Id createTimecard(String type, Date startDate, Date endDate, Id userId) {
        return Utilities.createAbsence(type, startDate, endDate, userId);
    }

}