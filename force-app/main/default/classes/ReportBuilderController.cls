public with sharing class ReportBuilderController {

    @AuraEnabled
    public static void runBatchJob(String projectId, String assignmentId, String milestoneId,
            String resourceId, String startDate, String endDate) {
        TimecardSummaryBatch batchJob = new TimecardSummaryBatch(startDate, endDate, resourceId, projectId, assignmentId, milestoneId );
        System.debug( projectId );
        System.debug( assignmentId );
        System.debug( milestoneId );
        System.debug( resourceId );
        System.debug( startDate );
        System.debug( endDate );
        Database.executeBatch(batchJob);
    }
}