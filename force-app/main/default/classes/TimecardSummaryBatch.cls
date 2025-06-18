public class TimecardSummaryBatch implements Database.Batchable<SObject>, Database.Stateful {

    public String startDate;
    public String endDate;
    public String resourceId;
    public String projectId;
    public String assignmentId;
    public String milestoneId;

    public Map<String, List<Timecard__c>> resourceToTimecardMap = new Map<String, List<Timecard__c>>();

    public TimecardSummaryBatch(String startDate, String endDate, String resourceId, String projectId, String assignmentId, String milestoneId ) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.resourceId = resourceId;
        this.projectId = projectId;
        this.assignmentId = assignmentId;
        this.milestoneId = milestoneId;

    }

    public Database.QueryLocator start(Database.BatchableContext BC) {
        if( String.isBlank(startDate) && String.isBlank(endDate) && String.isBlank(resourceId) && String.isBlank(projectId) && String.isBlank(assignmentId) && String.isBlank(milestoneId) ) {
            System.abortJob( BC.getJobId() );
        }
        System.debug( projectId );
        System.debug( resourceId );
        System.debug( assignmentId );
        System.debug( milestoneId );
        String query = 'SELECT ' +
                'Assignment__c, Assignment__r.Name,' +
                'End_Date__c,' +
                'Friday_Hours__c,' +
                'Milestone__c, Milestone__r.Name,' +
                'Monday_Hours__c,' +
                'Name,' +
                'Project__c,Project__r.Name,' +
                'Resource__c, Resource__r.Name,' +
                'Saturday_Hours__c,' +
                'Start_Date__c,' +
                'Status__c,' +
                'Sunday_Hours__c,' +
                'Thursday_Hours__c,' +
                'Total_Billiable_Amount__c,' +
                'Tuesday_Hours__c,' +
                'Type__c,' +
                'Wednesday_Hours__c,' +
                'Id, ' +
                'Total_Hours__c ' +
                'FROM Timecard__c ';

        query += 'WHERE Status__c = \'Approved\' ';
        if (String.isNotBlank(startDate) && String.isNotBlank(endDate)) {
            // Convert the startDate and endDate from String to Date
            Date startDateObj = Date.valueOf(startDate);
            Date endDateObj = Date.valueOf(endDate);
System.debug(startDateObj);
            System.debug(endDateObj);
            query += ' AND Start_Date__c >= :startDateObj AND End_Date__c <= :endDateObj ';
        }
        if ( String.isNotBlank(resourceId)) {
            query += 'AND Resource__c = :resourceId ';
        }

        if ( String.isNotBlank(projectId)) {
            query += 'AND Project__c = :projectId ';
        }

        if ( String.isNotBlank(assignmentId)) {
            query += 'AND Assignment__c = :assignmentId ';
        }

        if ( String.isNotBlank(milestoneId) ) {
            query += 'AND Milestone__c = :milestoneId';
        }
System.debug( query );
        System.debug(Database.query( query ));
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<Timecard__c> scope) {
        for( Timecard__c curCard : scope ) {
            String key = curCard.Resource__c;
            if( !resourceToTimecardMap.containsKey( key ) ) {
                resourceToTimecardMap.put( key, new List<Timecard__c>() );
            }
            resourceToTimecardMap.get( key ).add( curCard );
        }

    }

    public void finish(Database.BatchableContext BC) {
        Decimal billGrandTotal = 0;
        String billableDataCSV = 'Resource, Total Hours, Total Billable Amount\n';
        String detailedTimeReport = 'Resource, Total Hours, Total Billable Amount, Project Name, Milestone Name, Assignment Name, Start Date, End Date, Type, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday\n';
        if( !resourceToTimecardMap.isEmpty() ) {
            for( String key : resourceToTimecardMap.keySet() ) {
                List<Timecard__c> curTimecards = resourceToTimecardMap.get( key );
                if( curTimecards == null || curTimecards.isEmpty() ) {
                    continue;
                }
                Decimal totalHours = getTotalHours( curTimecards );
                Decimal totalBillableAmount = getTotalBillableAmount( curTimecards );
                billGrandTotal += totalBillableAmount;
                billableDataCSV += curTimecards[0].Resource__r.Name + ', ' + totalHours + ', ' + totalBillableAmount + '\n';
                detailedTimeReport += getDetailedReportCSV( curTimecards );
            }
            billableDataCSV += 'Grand Total, , ' + billGrandTotal;
        }

        sendEmail( billableDataCSV, detailedTimeReport );
    }

    private Decimal getTotalHours( List<Timecard__c> timecards ) {
        Decimal totalHours = 0;
        for( Timecard__c curCard : timecards ) {
            totalHours += curCard.Total_Hours__c;
        }
        return totalHours;
    }

    private Decimal getTotalBillableAmount( List<Timecard__c> timecards ) {
        Decimal totalBillableAmount = 0;
        for( Timecard__c curCard : timecards ) {
            totalBillableAmount += curCard.Total_Billiable_Amount__c;
        }
        return totalBillableAmount;
    }

    private String getDetailedReportCSV( List<Timecard__c> timecards ) {
        String csvContent = '';
        for( Timecard__c curCard : timecards ) {

            String csvRow = String.join(new List<String> {
                    curCard.Resource__r.Name,
                    curCard.Total_Hours__c.toString(),
                    curCard.Total_Billiable_Amount__c.toString(),
                    curCard.Project__r != null ? curCard.Project__r.Name : 'N/A',
                    curCard.Milestone__r != null ? curCard.Milestone__r.Name : 'N/A',
                    curCard.Assignment__r != null ? curCard.Assignment__r.Name : 'N/A',
                    String.valueOf(curCard.Start_Date__c),
                    String.valueOf(curCard.End_Date__c),
                    curCard.Type__c,
                    curCard.Monday_Hours__c.toString(),
                    curCard.Tuesday_Hours__c.toString(),
                    curCard.Wednesday_Hours__c.toString(),
                    curCard.Thursday_Hours__c.toString(),
                    curCard.Friday_Hours__c.toString(),
                    curCard.Saturday_Hours__c?.toString(),
                    curCard.Sunday_Hours__c?.toString()
            }, ',');

            csvContent += csvRow + '\n';
        }

        return csvContent;
    }

    private void sendEmail( String billableDataCSV, String detailedTimeReport ) {
        String emailBody = 'Please find the summarized timecard data attached as a CSV.\n\n';
        if( String.isNotBlank( projectId ) ) {
            emailBody += ' Project: ' + [SELECT Name FROM Project__c WHERE Id = :projectId]?.Name + '\n';
        }

        if(  String.isNotBlank( milestoneId ) ) {
            emailBody += ' Milestone: ' + [SELECT Name FROM Milestone__c WHERE Id = :milestoneId]?.Name + '\n';
        }

        if(  String.isNotBlank( resourceId ) ) {
            emailBody += ' Resource: ' + [SELECT Name FROM Resource__c WHERE Id = :resourceId]?.Name + '\n';
        }

        if(  String.isNotBlank( assignmentId ) ) {
            emailBody += ' Assignment: ' + [SELECT Name FROM Assignment__c WHERE Id = :assignmentId]?.Name + '\n';
        }

        if(  String.isNotBlank( startDate ) && String.isNotBlank( endDate ) ) {
            emailBody += ' Date range: ' + startDate + ' to ' + endDate + '\n';
        }

        Id userId = UserInfo.getUserId();  // Get the current user ID
        User runningUser = [SELECT Email FROM User WHERE Id = :userId LIMIT 1];

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[] {runningUser.Email }); // Set recipient
        mail.setSubject('Timecard Summary Report');
        mail.setPlainTextBody(emailBody);

        Messaging.EmailFileAttachment billableAttachment = new Messaging.EmailFileAttachment();
        billableAttachment.setFileName('Billable Report.csv');
        billableAttachment.setBody(Blob.valueOf( billableDataCSV ));

        Messaging.EmailFileAttachment detailedReport = new Messaging.EmailFileAttachment();
        detailedReport.setFileName('Detailed Report.csv');
        detailedReport.setBody(Blob.valueOf( detailedTimeReport ));

        mail.setFileAttachments(new Messaging.EmailFileAttachment[] { billableAttachment, detailedReport });
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] {mail});
    }
}