import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getTimecardsByUser from '@salesforce/apex/TimecardController.getTimecardsByUser';
import getCurrentResource from '@salesforce/apex/TimecardController.getCurrentResource';
import deleteTimecard from '@salesforce/apex/TimecardController.deleteTimecard';
import submitForApproval from '@salesforce/apex/TimecardController.submitTimecard';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import ID_FIELD from '@salesforce/schema/Timecard__c.Id';
import NAME_FIELD from '@salesforce/schema/Timecard__c.Name';
import PROJECT_FIELD from '@salesforce/schema/Timecard__c.Project__c';
import ASSIGNMENT_FIELD from '@salesforce/schema/Timecard__c.Assignment__c';
import MILESTONE_FIELD from '@salesforce/schema/Timecard__c.Milestone__c';
import TYPE_FIELD from '@salesforce/schema/Timecard__c.Type__c';
import MONDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Monday_Hours__c';
import TUESDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Tuesday_Hours__c';
import WEDNESDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Wednesday_Hours__c';
import THURSDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Thursday_Hours__c';
import FRIDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Friday_Hours__c';
import SATURDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Saturday_Hours__c';
import SUNDAY_HOURS_FIELD from '@salesforce/schema/Timecard__c.Sunday_Hours__c';


export default class TimecardHistory extends LightningElement {
    @api recordId;
    @api columnsView;

    @track timecards = [];
    @track currentWeekInfo = '';
    @track objectApiName;
    @track isCurrentWeekSelected = true;
    @track isModalOpen = false;
    @track targetRecordId = null;
    currentStartDate;
    currentEndDate;
    resourceId;

    timecardExist = false;
    columns = [];
    weekInfo = [];
    holidays;
    absenceInfo;
    absenceColumns = [
        { label: 'Absence Type', fieldName: 'name' },
        { label: 'Used Days', fieldName: 'used' },
        { label: 'Allowed Days', fieldName: 'allowed' },
        { label: 'Remaining Days', fieldName: 'remaining' },
    ]

    idField = ID_FIELD;
    nameField = NAME_FIELD;
    projectField = PROJECT_FIELD;
    assignmentField = ASSIGNMENT_FIELD;
    milestoneField = MILESTONE_FIELD;
    typeField = TYPE_FIELD;
    mondayHoursField = MONDAY_HOURS_FIELD;
    tuesdayHoursField = TUESDAY_HOURS_FIELD;
    wednesdayHoursField = WEDNESDAY_HOURS_FIELD;
    thursdayHoursField = THURSDAY_HOURS_FIELD;
    fridayHoursField = FRIDAY_HOURS_FIELD;
    saturdayHoursField = SATURDAY_HOURS_FIELD;
    sundayHoursField = SUNDAY_HOURS_FIELD;

    hoursFields = [ 'Monday_Hours__c', 'Tuesday_Hours__c', 'Wednesday_Hours__c', 'Thursday_Hours__c', 'Friday_Hours__c', 'Saturday_Hours__c', 'Sunday_Hours__c' ];

    selectedRecordIds = [];
    isSubmitDisabled = true;

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.objectApiName = currentPageReference.attributes.objectApiName;
        }
    }

    connectedCallback() {
        this.columns = COLUMNS_VIEW[this.columnsView];
        this.setCurrentWeek();

        getCurrentResource()
            .then(result => {
            this.resourceId = result;
        })
            .catch(error => {
            this.showToast('Error', 'Error fetching timecards: ' + error, 'error');
        });
    }

    setCurrentWeek() {
        const currentDate = new Date();
        const startOfWeek = this.getStartOfWeek(currentDate);
        const endOfWeek = this.getEndOfWeek(currentDate);

        this.currentStartDate = this.formatDate(startOfWeek);
        this.currentEndDate = this.formatDate(endOfWeek);
        this.isCurrentWeekSelected = true;

        this.fetchTimecards(this.currentStartDate, this.currentEndDate);
    }

    handlePreviousWeek() {
        const startDate = new Date(this.currentStartDate);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(this.currentEndDate);
        endDate.setDate(endDate.getDate() - 7);

        this.currentStartDate = this.formatDate(startDate);
        this.currentEndDate = this.formatDate(endDate);
        this.isCurrentWeekSelected = false;

        this.fetchTimecards(this.currentStartDate, this.currentEndDate);
    }

    handleNextWeek() {
        const startDate = new Date(this.currentStartDate);
        startDate.setDate(startDate.getDate() + 7);
        const endDate = new Date(this.currentEndDate);
        endDate.setDate(endDate.getDate() + 7);

        this.currentStartDate = this.formatDate(startDate);
        this.currentEndDate = this.formatDate(endDate);
        this.isCurrentWeekSelected = false;

        this.fetchTimecards(this.currentStartDate, this.currentEndDate);
    }

    fetchTimecards(startDate, endDate) {
        getTimecardsByUser({
            startDate: startDate,
            endDate: endDate,
            objectApiName: this.objectApiName,
            recordId: this.recordId
        })
            .then(result => {
                this.timecards = result.timecards;
                if( result.timecards.length > 0 ) {
                    this.timecardExist = true;
                } else {
                    this.timecardExist = false;
                }

                this.weekInfo = result.scheduledTime;
                this.holidays = result.holidays;
                this.absenceInfo = result.absences;
            })
            .catch(error => {
                console.log( error )
                this.showToast('Error', 'Error fetching timecards: ' + error, 'error');
            });
    }

    handleCurrentWeek() {
        this.setCurrentWeek();
    }

    getStartOfWeek(date) {
        const day = date.getDay(),
            diff = date.getDate() - day + (day == 0 ? -6 : 1); // Adjust if Sunday
        return new Date(date.setDate(diff));
    }

    // Get the end of the week (Sunday)
    getEndOfWeek(date) {
        const startOfWeek = this.getStartOfWeek(date);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
        return endOfWeek;
    }

    // Format the date to YYYY-MM-DD
    formatDate(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2); // Adds leading zero
        const day = ('0' + date.getDate()).slice(-2); // Adds leading zero
        return `${year}-${month}-${day}`;
    }

    // Show toast messages
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }

    // Handle the row action event
    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        switch (actionName) {
            case 'edit':
                this.handleEdit(row);
                break;
            case 'delete':
                this.handleDelete(row);
                break;
            case 'submit_for_approval':
                this.handleSubmitForApproval(row);
                break;
            default:
                break;
        }
    }

    handleEdit(row) {
        this.targetRecordId = row.Id;
        this.openModal();
    }

    handleDelete(row) {
        if( row.status !== 'Approved' ) {
            deleteTimecard({
                timecardId: row.Id
            })
                .then( () => {
                    this.showToast('Success', 'Timecard deleted successfully!', 'success');
                    this.fetchTimecards(this.currentStartDate, this.currentEndDate);
                })
                .catch(error => {
                    this.showToast('Error', 'Error fetching timecards: ' + error, 'error');
                });
        } else {
            this.showToast('Error', 'You can not delete a approved timecard!', 'error');
        }
    }

    handleSubmitForApproval(row) {
        if( row.status !== 'Approved' ) {
            submitForApproval({
                timecardIds: [ row.Id ]
            })
                .then( () => {
                    this.showToast('Success', 'Timecard submitted for approval!', 'success');
                    this.fetchTimecards(this.currentStartDate, this.currentEndDate);
                })
                .catch(error => {
                    this.showToast('Error', 'Error on time card approval: ' + error, 'error');
                });
        } else {
            this.showToast('Error', 'Timecard already approved!', 'error');
        }
    }

    openModal() {
        this.isModalOpen = true;
    }

    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;
        fields.Start_Date__c = this.currentStartDate;
        fields.End_Date__c = this.currentEndDate;
        fields.Status = 'New';
        console.log(this.resourceId)  ;
        fields.Resource__c = this.resourceId;

        this.hoursFields.forEach( curField => {
            if( !fields[curField] ) {
                fields[curField] = 0;
            }
        });
console.log( fields );
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    // Close modal
    closeModal() {
        const inputFields = this.template.querySelectorAll(
            'lightning-input-field'
        );
        if (inputFields) {
            inputFields.forEach(field => {
                field.reset();
            });
        }
        this.isModalOpen = false;
    }

    // Success handler
    handleSuccess(event) {
        // Handle the success scenario (e.g., show toast, reset fields)
        const toastEvent = new ShowToastEvent({
            title: "Success",
            message: "Timecard created successfully!",
            variant: "success"
        });
        this.dispatchEvent(toastEvent);
        this.fetchTimecards(this.currentStartDate, this.currentEndDate);
        this.closeModal();
    }

    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        console.log( selectedRows );
        this.selectedRecordIds = selectedRows.map(row => row.id);
        console.log( this.selectedRecordIds );

        this.isSubmitDisabled = this.selectedRecordIds.length === 0;
    }

    submitSelectedRowsForApproval() {
        console.log( JSON.parse( JSON.stringify( this.selectedRecordIds )));
        const datatable = this.template.querySelector('lightning-datatable');
        const selectedRows = datatable.getSelectedRows();
        let selectedRecordIds = [];
        selectedRows.forEach( row => {
            selectedRecordIds.push( row.Id );
        });

        submitForApproval({
            timecardIds: selectedRecordIds
        })
            .then( () => {
                this.showToast('Success', 'Timecards submitted for approval!', 'success');
                this.fetchTimecards(this.currentStartDate, this.currentEndDate);
            })
            .catch(error => {
                this.showToast('Error', 'Error on submitting: ' + error, 'error');
            });
    }
}

const COLUMNS_VIEW = {
    resource: [
        { label: 'Project', fieldName: 'projectName' },
        { label: 'Monday Hours', fieldName: 'mondayHours' },
        { label: 'Tuesday Hours', fieldName: 'tuesdayHours' },
        { label: 'Wednesday Hours', fieldName: 'wednesdayHours' },
        { label: 'Thursday Hours', fieldName: 'thursdayHours' },
        { label: 'Friday Hours', fieldName: 'fridayHours' },
        { label: 'Saturday Hours', fieldName: 'saturdayHours' },
        { label: 'Sunday Hours', fieldName: 'sundayHours' },
        { label: 'Total Hours', fieldName: 'totalHours' },
        { label: 'Milestone', fieldName: 'milestoneName' },
        { label: 'Status', fieldName: 'status' },
        {
            type: 'action',
            typeAttributes: {
                rowActions: [
                    { label: 'Edit', name: 'edit' },
                    { label: 'Submit for Approval', name: 'submit_for_approval' },
                    { label: 'Delete', name: 'delete' },
                ]
            }
        }
    ],
    company: [
        { label: 'Resource', fieldName: 'resourceName' },
        { label: 'Project', fieldName: 'projectName' },
        { label: 'Assignment', fieldName: 'assignmentName' },
        { label: 'Milestone', fieldName: 'milestoneName' },
        { label: 'Total Hours', fieldName: 'totalHours' },
        { label: 'Status', fieldName: 'status' },
        { label: 'Monday Hours', fieldName: 'mondayHours' },
        { label: 'Tuesday Hours', fieldName: 'tuesdayHours' },
        { label: 'Wednesday Hours', fieldName: 'wednesdayHours' },
        { label: 'Thursday Hours', fieldName: 'thursdayHours' },
        { label: 'Friday Hours', fieldName: 'fridayHours' },
        { label: 'Saturday Hours', fieldName: 'saturdayHours' },
        { label: 'Sunday Hours', fieldName: 'sundayHours' }
    ],
    project: [
        { label: 'Card #', fieldName: 'Id' },
        { label: 'Resource', fieldName: 'resourceName' },
        { label: 'Assignment', fieldName: 'assignmentName' },
        { label: 'Milestone', fieldName: 'milestoneName' },
        { label: 'Total Hours', fieldName: 'totalHours' },
        { label: 'Status', fieldName: 'status' },
        { label: 'Monday Hours', fieldName: 'mondayHours' },
        { label: 'Tuesday Hours', fieldName: 'tuesdayHours' },
        { label: 'Wednesday Hours', fieldName: 'wednesdayHours' },
        { label: 'Thursday Hours', fieldName: 'thursdayHours' },
        { label: 'Friday Hours', fieldName: 'fridayHours' },
        { label: 'Saturday Hours', fieldName: 'saturdayHours' },
        { label: 'Sunday Hours', fieldName: 'sundayHours' }
    ],
    assignment: [
        { label: 'Milestone', fieldName: 'milestoneName' },
        { label: 'Total Hours', fieldName: 'totalHours' },
        { label: 'Status', fieldName: 'status' },
        { label: 'Monday Hours', fieldName: 'mondayHours' },
        { label: 'Tuesday Hours', fieldName: 'tuesdayHours' },
        { label: 'Wednesday Hours', fieldName: 'wednesdayHours' },
        { label: 'Thursday Hours', fieldName: 'thursdayHours' },
        { label: 'Friday Hours', fieldName: 'fridayHours' },
        { label: 'Saturday Hours', fieldName: 'saturdayHours' },
        { label: 'Sunday Hours', fieldName: 'sundayHours' }
    ],
    milestone: [
        { label: 'Card #', fieldName: 'Id' },
        { label: 'Resource', fieldName: 'resourceName' },
        { label: 'Total Hours', fieldName: 'totalHours' },
        { label: 'Status', fieldName: 'status' },
        { label: 'Monday Hours', fieldName: 'mondayHours' },
        { label: 'Tuesday Hours', fieldName: 'tuesdayHours' },
        { label: 'Wednesday Hours', fieldName: 'wednesdayHours' },
        { label: 'Thursday Hours', fieldName: 'thursdayHours' },
        { label: 'Friday Hours', fieldName: 'fridayHours' },
        { label: 'Saturday Hours', fieldName: 'saturdayHours' },
        { label: 'Sunday Hours', fieldName: 'sundayHours' }
    ]
}