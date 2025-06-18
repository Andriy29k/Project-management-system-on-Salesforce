public with sharing class ViolationJob implements Database.Batchable<SObject>, Schedulable  {

    public Database.QueryLocator start(Database.BatchableContext bc) {
        // Get Timecards from last week
        Date lastSunday = Date.today().toStartOfWeek().addDays(-1);
        Date lastMonday = lastSunday.addDays(-6);

        return Database.getQueryLocator([
                SELECT Id, Region__r.Work_Calendar__r.Total_Hours__c, Email__c, User__r.Email, (SELECT Id, Total_Hours__c FROM Timecards__r WHERE Start_Date__c =: lastMonday AND End_Date__c =: lastSunday) FROM Resource__c WHERE Is_Resource_Active__c = TRUE AND  Is_Resource__c = TRUE
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Resource__c> scope) {
        List<Violation__c> violationsToInsert = new List<Violation__c>();
        List<Messaging.SingleEmailMessage> violationMessages = new List<Messaging.SingleEmailMessage>();
        for (Resource__c curRes : scope) {
            List<Timecard__c> relatedTimecards = curRes.Timecards__r;
            if( relatedTimecards == null || relatedTimecards.isEmpty() ) {
                violationsToInsert.add( new Violation__c(
                        Resource__c = curRes.Id,
                        Week_Start_Date__c = Date.today().toStartOfWeek().addDays(-7),
                        Week_End_Date__c = Date.today().toStartOfWeek().addDays(-1),
                        Total_Hours__c =  curRes.Region__r.Work_Calendar__r.Total_Hours__c
                ));
            }

            Decimal totalHours = 0;
            for( Timecard__c curCart : relatedTimecards ) {
                totalHours += curCart.Total_Hours__c;
            }

            if ( totalHours < curRes.Region__r.Work_Calendar__r.Total_Hours__c ) {
                violationsToInsert.add( new Violation__c(
                        Resource__c = curRes.Id,
                        Week_Start_Date__c = Date.today().toStartOfWeek().addDays(-7),
                        Week_End_Date__c = Date.today().toStartOfWeek().addDays(-1),
                        Total_Hours__c = ( curRes.Region__r.Work_Calendar__r.Total_Hours__c - totalHours )
                ));

                if( String.isNotBlank( curRes.Email__c ) ||  String.isNotBlank( curRes.User__r.Email ) ) {
                    Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();

                    mail.setToAddresses(new String[] { String.isNotBlank( curRes.Email__c ) ? curRes.Email__c : curRes.User__r.Email });
                    mail.setSubject('Timelog Violation Notification');
                    mail.setPlainTextBody('You timelog not completed for previous week. Please fix it. Remaining hours to log: ' + ( curRes.Region__r.Work_Calendar__r.Total_Hours__c - totalHours ) );
                    violationMessages.add(mail);
                }
            }
        }
        System.debug( violationMessages );
        System.debug( violationsToInsert );
        insert violationsToInsert;
        Messaging.sendEmail( violationMessages );
    }

    public void finish(Database.BatchableContext bc) {

    }

    public void execute(SchedulableContext context) {
        ViolationJob batch = new ViolationJob();
        Database.executeBatch(batch, 200);
    }
}