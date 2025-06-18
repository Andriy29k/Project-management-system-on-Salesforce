public with sharing class Utilities {

    public static Set<Date> getHolidays( Id workCalendarId ) {
        Set<Date> holidays = new Set<Date>();
        List<Holidays__c> holidaysList = [SELECT Date__c FROM Holidays__c WHERE Work_Calendar__c = :workCalendarId];
        for (Holidays__c holiday : holidaysList) {
            holidays.add(holiday.Date__c);
        }
        return holidays;
    }

    public static Work_Calendar__c getWorkCalendarForRegion( Id regionId ) {
        return [
                SELECT Id, Monday_Hours__c, Tuesday_Hours__c, Wednesday_Hours__c,
                        Thursday_Hours__c, Friday_Hours__c, Saturday_Hours__c, Sunday_Hours__c
                FROM Work_Calendar__c
                WHERE Id IN (SELECT Work_Calendar__c FROM Region__c WHERE Id = :regionId)
                LIMIT 1
        ];
    }

    public static Work_Calendar__c getWorkCalendar( Id calendarId ) {
        return [
                SELECT Id, Monday_Hours__c, Tuesday_Hours__c, Wednesday_Hours__c,
                        Thursday_Hours__c, Friday_Hours__c, Saturday_Hours__c, Sunday_Hours__c
                FROM Work_Calendar__c
                WHERE Id = :calendarId
                LIMIT 1
        ];
    }

    public static Map<String, Decimal> getRequiredHours( Work_Calendar__c workCalendar ) {
        Map<String, Decimal> dailyHours = new Map<String, Decimal>{
                'Monday'    => workCalendar.Monday_Hours__c,
                'Tuesday'   => workCalendar.Tuesday_Hours__c,
                'Wednesday' => workCalendar.Wednesday_Hours__c,
                'Thursday'  => workCalendar.Thursday_Hours__c,
                'Friday'    => workCalendar.Friday_Hours__c,
                'Saturday'  => workCalendar.Saturday_Hours__c,
                'Sunday'    => workCalendar.Sunday_Hours__c
        };

        return dailyHours;
    }

    public static Map<String, Internal_Activities__c> getInternalActivitiesProjectMap() {
        Map<String, Internal_Activities__c> internalActivitiesProjectMap = new Map<String, Internal_Activities__c>();
        for( Internal_Activities__c internalActivity : Internal_Activities__c.getAll().values() ) {
            internalActivitiesProjectMap.put( internalActivity.Name, internalActivity );
        }
        return internalActivitiesProjectMap;
    }

    public static Id createAbsence( String type, Date startDate, Date endDate, Id userId ) {
        Internal_Activities__c targetActivity = getInternalActivitiesProjectMap().get( type );
        String resourceQuery = 'SELECT Id, Region__c, Region__r.Work_Calendar__c' + ( String.isNotBlank( targetActivity.Availability_Field__c ) ? ( ', ' + targetActivity.Availability_Field__c ) : '' ) + ' FROM Resource__c WHERE User__c = :userId LIMIT 1';
        Resource__c currentResource = Database.query( resourceQuery );
        Integer availableAbsences = null;
        if( String.isNotBlank( targetActivity.Availability_Field__c ) ) {
            availableAbsences = Integer.valueOf( currentResource.get( targetActivity.Availability_Field__c ) );
        }
        if (currentResource == null) {
            throw new IllegalArgumentException('Resource not found for the current user');
        }
        List<Timecard__c> timecardsToInsert = new List<Timecard__c>();
        Set<Date> holidays = Utilities.getHolidays( currentResource.Region__r.Work_Calendar__c );
        Map<String, Decimal> requiredHours = getRequiredHours( getWorkCalendarForRegion( currentResource.Region__c ) );

        Project__c curProject = [SELECT Id, OwnerId FROM Project__c WHERE Id = :targetActivity.Project_Id__c LIMIT 1];

        Integer daysCounter = 0;
        Date currentStartDate = startDate;
        while( currentStartDate <= endDate ) {
            Date startOfWeek = currentStartDate.toStartOfWeek();
            Integer currentDayOfWeek = startOfWeek.daysBetween( currentStartDate );
            Date endOfWeek = startOfWeek.addDays( 6 );
            Timecard__c curCart = new Timecard__c(
                    Resource__c = currentResource.Id,
                    Type__c = type,
                    Start_Date__c = startOfWeek,
                    End_Date__c = endOfWeek,
                    Status__c = 'New',
                    Project__c = targetActivity.Project_Id__c,
                    Monday_Hours__c = 0,
                    Tuesday_Hours__c = 0,
                    Wednesday_Hours__c = 0,
                    Thursday_Hours__c = 0,
                    Friday_Hours__c = 0,
                    Saturday_Hours__c = 0,
                    Sunday_Hours__c = 0
            );

            for( Integer i = currentDayOfWeek; i < 7; i++ ) {
                Date currentDate = startOfWeek.addDays( i );
                if( holidays.contains( currentDate ) ) {
                    continue;
                }

                if( currentDate > endDate ) {
                    break;
                }
                // Populate hours based on the day of the week
                switch on i {
                    when 0  { curCart.Monday_Hours__c    = requiredHours.get('Monday'); if( requiredHours.get('Monday') != 0 ) { daysCounter++; } }
                    when 1  { curCart.Tuesday_Hours__c   = requiredHours.get('Tuesday'); if( requiredHours.get('Tuesday') != 0 ) { daysCounter++; } }
                    when 2  { curCart.Wednesday_Hours__c = requiredHours.get('Wednesday'); if( requiredHours.get('Wednesday') != 0 ) { daysCounter++; } }
                    when 3  { curCart.Thursday_Hours__c  = requiredHours.get('Thursday'); if( requiredHours.get('Thursday') != 0 ) { daysCounter++; } }
                    when 4  { curCart.Friday_Hours__c    = requiredHours.get('Friday'); if( requiredHours.get('Friday') != 0 ) { daysCounter++; } }
                    when 5  { curCart.Saturday_Hours__c  = requiredHours.get('Saturday'); if( requiredHours.get('Saturday') != 0 ) { daysCounter++; } }
                    when 6  { curCart.Sunday_Hours__c    = requiredHours.get('Sunday'); if( requiredHours.get('Sunday') != 0 ) { daysCounter++; } }
                }

                if( availableAbsences != null && availableAbsences < daysCounter ) {
                    throw new IllegalArgumentException('Unable to book Absence. Not enough available days.');
                }
            }

            timecardsToInsert.add(curCart);

            currentStartDate = currentDayOfWeek == 0 ? currentStartDate.addDays( 7 ) : currentStartDate.addDays( 7 - currentDayOfWeek );
        }

        insert timecardsToInsert;

        if( String.isNotBlank( targetActivity.Availability_Field__c ) && availableAbsences != null ) {
            Integer remainingAbs =  availableAbsences - daysCounter;
            currentResource.put( targetActivity.Availability_Field__c, Decimal.valueOf( remainingAbs.toString() ) );
            update  currentResource;
        }

        // Submit for approval and assign a specific user or queue as the approver
        List<Approval.ProcessRequest> recordsForApproval = new List<Approval.ProcessRequest>();
        for( Timecard__c curCart : timecardsToInsert ) {
            Approval.ProcessSubmitRequest req = new Approval.ProcessSubmitRequest();
            req.setObjectId( curCart.Id );
            List<Id> approverIds = new List<Id>{ curProject.OwnerId };
            req.setNextApproverIds(approverIds);

            recordsForApproval.add( req );
        }

        List<Approval.ProcessResult> result = Approval.process( recordsForApproval );
        for( Approval.ProcessResult res : result ) {
            if( !res.isSuccess() ) {
                System.debug( 'Error: ' + res.getErrors()[0].getMessage() );
            }
        }

        return timecardsToInsert[0]?.Id;
    }
}