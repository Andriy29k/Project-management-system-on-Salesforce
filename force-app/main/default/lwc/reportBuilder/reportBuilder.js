import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import runBatchJob from '@salesforce/apex/ReportBuilderController.runBatchJob';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ReportBuilder extends LightningElement {
    @api recordId; // Automatically populated when placed on a record page
    objectApiName; // To store the SObject type
    selectedProjectId = '';
    selectedAssignmentId = '';
    selectedMilestoneId = '';
    selectedResourceId = '';
    startDate = '';
    endDate = '';
    isLoading = false;

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            // Extract the SObject type from the recordId's URL
            const sobjectApiName = currentPageReference.attributes.objectApiName;
            this.objectApiName = sobjectApiName;
        }
    }

    get isProjectPage() {
        return this.objectApiName === 'Project__c';
    }

    get isAssignmentPage() {
        return this.objectApiName === 'Assignment__c';
    }

    get isMilestonePage() {
        return this.objectApiName === 'Milestone__c';
    }

    get isResourcePage() {
        return this.objectApiName === 'Resource__c';
    }

    get isRecordPage() {
        return !!this.currentRecordId;
    }

    get hiddenFieldLabel() {
        return `${this.currentObjectType} ID`;
    }

    handleProjectSelected(event) {
        this.selectedProjectId = event.detail;
    }

    handleAssignmentSelected(event) {
        this.selectedAssignmentId = event.detail;
    }

    handleMilestoneSelected(event) {
        this.selectedMilestoneId = event.detail;
    }

    handleResourceSelected(event) {
        this.selectedResourceId = event.detail;
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
    }

    handleSubmit() {
        this.isLoading = true;
        if(this.objectApiName === 'Project__c') {
            this.selectedProjectId = this.recordId;
        } else if(this.objectApiName === 'Assignment__c') {
            this.selectedAssignmentId = this.recordId;
        } else if(this.objectApiName === 'Milestone__c') {
            this.selectedMilestoneId = this.recordId;
        } else if(this.objectApiName === 'Resource__c') {
            this.selectedResourceId = this.recordId;
        }

        runBatchJob({
            projectId: this.selectedProjectId,
            assignmentId: this.selectedAssignmentId,
            milestoneId: this.selectedMilestoneId,
            resourceId: this.selectedResourceId,
            startDate: this.startDate,
            endDate: this.endDate
        })
            .then(result => {
                // Handle successful report generation, maybe show a success message or navigate
                console.log(result);
                // Handle response
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Report generating. You will receive results via email.',
                        variant: 'success'
                    })
                );
                this.isLoading = false;
            })
            .catch(error => {
                // Handle error
                console.error(error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error,
                        variant: 'error'
                    })
                );
                this.isLoading = false;
            });
    }
}