public with sharing class TimecardController {

    // Method to fetch timecards for the current user
    @AuraEnabled
    public static WeekWrapper getTimecardsByUser(String startDate, String endDate, String objectApiName, String recordId) {
        Date startDateValue = Date.valueOf(startDate);
        Date endDateValue = Date.valueOf(endDate);

        List<Internal_Activities__c> absences = getAbsenceFieldsInQuery();
        String abnseceFields = '';

        for( Internal_Activities__c curActivity : absences ) {
            abnseceFields += ' , ' + curActivity.Allowed_Absence_Field__c;
            abnseceFields += ' , ' + curActivity.Availability_Field__c;
        }

        // Fetch the current user's Resource
        Id userId = UserInfo.getUserId();
        String resourceQuery = 'SELECT Id, Region__c, Region__r.Work_Calendar__c ' + abnseceFields + ' FROM Resource__c WHERE User__c = :userId LIMIT 1';
        Resource__c currentResource = Database.query( resourceQuery );
        Id currentResourceId = currentResource.Id;


        // Base query to fetch timecards for the user
        String query = 'SELECT Id, Name, Resource__r.Name, ' +
                'Monday_Hours__c, Tuesday_Hours__c, ' +
                'Wednesday_Hours__c, Thursday_Hours__c, ' +
                'Friday_Hours__c, Saturday_Hours__c, ' +
                'Sunday_Hours__c, Total_Billiable_Amount__c, ' +
                'Start_Date__c, End_Date__c, Type__c, ' +
                'Project__r.Name, Assignment__r.Name, ' +
                'Milestone__r.Name, Total_Hours__c, Status__c ' +
                'FROM Timecard__c WHERE Resource__c = :currentResourceId ' +
                'AND Start_Date__c >= :startDateValue AND End_Date__c <= :endDateValue';

        // Conditionally add filters based on the objectApiName passed (e.g., Project, Assignment)
        if (objectApiName != null) {
            if (objectApiName == 'Project__c') {
                query += ' AND Project__c =: recordId';
            } else if (objectApiName == 'Assignment__c') {
                query += ' AND Assignment__c  =: recordId';
            } else if (objectApiName == 'Milestone__c') {
                query += ' AND Milestone__c  =: recordId';
            }
        }

        // Filter by the recordId if necessary
        if (recordId != null) {
            query += ' AND (Project__c = :recordId OR Assignment__c = :recordId)';
        }

        List<Timecard__c> timecards = Database.query(query);

        List<TimecardWrapper> timecardData = new List<TimecardWrapper>();

        for (Timecard__c tc : timecards) {
            TimecardWrapper tw = new TimecardWrapper();
            tw.timecardName = tc.Name;
            tw.resourceName = tc.Resource__r.Name;
            tw.mondayHours = tc.Monday_Hours__c;
            tw.tuesdayHours = tc.Tuesday_Hours__c;
            tw.wednesdayHours = tc.Wednesday_Hours__c;
            tw.thursdayHours = tc.Thursday_Hours__c;
            tw.fridayHours = tc.Friday_Hours__c;
            tw.saturdayHours = tc.Saturday_Hours__c;
            tw.sundayHours = tc.Sunday_Hours__c;
            tw.totalHours = tc.Total_Hours__c;
            tw.totalBillableAmount = tc.Total_Billiable_Amount__c;
            tw.projectName = tc.Project__r.Name;
            tw.assignmentName = tc.Assignment__r.Name;
            tw.milestoneName = tc.Milestone__r.Name;
            tw.type = tc.Type__c;
            tw.status = tc.Status__c;
            tw.Id = tc.Id;
            timecardData.add(tw);
        }
        WeekWrapper result = new WeekWrapper();
        result.holidays = getHolidays(startDate, endDate, currentResource.Region__r.Work_Calendar__c);
        result.scheduledTime = getScheduledTime(currentResourceId);
        result.timecards = timecardData;

        List<AbsenceWrapper> absenceWrappers = new List<TimecardController.AbsenceWrapper>();
        for( Internal_Activities__c curActivity : absences ) {
            AbsenceWrapper curAbs = new AbsenceWrapper();
            curAbs.name = curActivity.Name;
            curAbs.allowed = currentResource.get( curActivity.Allowed_Absence_Field__c ).toString();
            curAbs.remaining = currentResource.get( curActivity.Availability_Field__c ).toString();
            curAbs.used = String.valueOf( ( Decimal ) currentResource.get( curActivity.Allowed_Absence_Field__c ) - ( Decimal ) currentResource.get( curActivity.Availability_Field__c ) );
            absenceWrappers.add( curAbs );
        }
System.debug(absenceWrappers);
        result.absences = absenceWrappers;


        return result;
    }

    public static List<ScheduledWeekTime> getScheduledTime( Id resourceId ) {
        List<ScheduledWeekTime> result = new List<ScheduledWeekTime>();
        List<Assignment__c> existingAssignments = [SELECT Id, Project__r.Name, Project__r.Daily_Timecart_Notes_Required__c, Overtime__c, Percent_Allocated__c FROM Assignment__c WHERE Resource__c = :resourceId AND Status__c = 'Active'];
        for( Assignment__c assignment : existingAssignments ) {
            ScheduledWeekTime swt = new ScheduledWeekTime();
            swt.projectName = assignment.Project__r.Name;
            swt.requiredHours = String.valueOf( 40 * assignment.Percent_Allocated__c / 100);
            swt.isDailyNotesRequired = assignment.Project__r.Daily_Timecart_Notes_Required__c;
            swt.isOvertime = assignment.Overtime__c;
            result.add(swt);
        }
        return result;
    }

    public static List<Internal_Activities__c> getAbsenceFieldsInQuery() {
        List<Internal_Activities__c> result = new List<Internal_Activities__c>();
        for( Internal_Activities__c curActivity : Utilities.getInternalActivitiesProjectMap().values() ) {
            if( String.isNotBlank( curActivity.Allowed_Absence_Field__c ) && String.isNotBlank( curActivity.Availability_Field__c ) ) {
                result.add( curActivity );
            }
        }
        return result;
    }

    @AuraEnabled
    public static String getCurrentResource() {
        Resource__c currentUser = [SELECT Id FROM Resource__c WHERE User__c = :UserInfo.getUserId() LIMIT 1];
        return currentUser.Id;
    }

    @AuraEnabled
    public static void deleteTimecard( Id timecardId ) {
        delete new Timecard__c( Id = timecardId );
    }

    @AuraEnabled
    public static void submitTimecard( List<Id> timecardIds ) {
        List<Timecard__c> timecards = [SELECT Id, Project__r.OwnerId, Status__c FROM Timecard__c WHERE Id IN :timecardIds];
        List<Approval.ProcessRequest> recordsForApproval = new List<Approval.ProcessRequest>();
        for( Timecard__c curCart : timecards ) {
            if( curCart.Status__c != 'Approved' && curCart.Status__c != 'Submitted' ) {
                Approval.ProcessSubmitRequest req = new Approval.ProcessSubmitRequest();
                req.setObjectId( curCart.Id );
                List<Id> approverIds = new List<Id>{ curCart.Project__r.OwnerId };
                req.setNextApproverIds(approverIds);

                recordsForApproval.add( req );
            }
        }

        String errors = '';
        List<Approval.ProcessResult> result = Approval.process( recordsForApproval );
        for( Approval.ProcessResult res : result ) {
            if( !res.isSuccess() ) {
                errors += res.getErrors()[0].getMessage() + '\n';
            }
        }

        if( String.isNotBlank( errors ) ) {
            throw new AuraHandledException( errors );
        }

    }

    public class WeekWrapper {
        @AuraEnabled
        public List<ScheduledWeekTime> scheduledTime;
        @AuraEnabled
        public List<TimecardWrapper> timecards;
        @AuraEnabled
        public List<Holidays__c> holidays;
        @AuraEnabled
        public List<AbsenceWrapper> absences;
    }

    public class ScheduledWeekTime {
        @AuraEnabled
        public String projectName;
        @AuraEnabled
        public String requiredHours;
        @AuraEnabled
        public Boolean isDailyNotesRequired;
        @AuraEnabled
        public Boolean isOvertime;
    }

    public class AbsenceWrapper {
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String used;
        @AuraEnabled
        public String allowed;
        @AuraEnabled
        public String remaining;
    }

    public class TimecardWrapper {
        @AuraEnabled
        public String timecardName;
        @AuraEnabled
        public String resourceName;
        @AuraEnabled
        public Decimal mondayHours;
        @AuraEnabled
        public Decimal tuesdayHours;
        @AuraEnabled
        public Decimal wednesdayHours;
        @AuraEnabled
        public Decimal thursdayHours;
        @AuraEnabled
        public Decimal fridayHours;
        @AuraEnabled
        public Decimal saturdayHours;
        @AuraEnabled
        public Decimal sundayHours;
        @AuraEnabled
        public Decimal totalHours;
        @AuraEnabled
        public Decimal totalBillableAmount;
        @AuraEnabled
        public String projectName;
        @AuraEnabled
        public String assignmentName;
        @AuraEnabled
        public String milestoneName;
        @AuraEnabled
        public String type;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public String Id;
    }

    public static List<Holidays__c> getHolidays(String startDate, String endDate, Id workCalendarId) {
        Date startDateValue = Date.valueOf(startDate);
        Date endDateValue = Date.valueOf(endDate);

        List<Holidays__c> holidays = [SELECT Id, Name, Date__c FROM Holidays__c WHERE Date__c >= :startDateValue AND Date__c <= :endDateValue AND Work_Calendar__c = :workCalendarId];

        return ( holidays != null && holidays.size() != 0 ) ? holidays : null;
    }

}