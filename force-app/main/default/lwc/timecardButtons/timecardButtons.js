import { LightningElement, track, wire } from 'lwc';
import getTimecardTypes from '@salesforce/apex/InternalTimecardController.getTimecardTypes';
import createTimecard from '@salesforce/apex/InternalTimecardController.createTimecard';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import userId from '@salesforce/user/Id';

export default class TimecardButtons extends LightningElement {
    @track timecardTypes = [];
    @track showModal = false;
    @track selectedType = '';
    @track startDate = null;
    @track endDate = null;

    createdTimeCardId;
    timecardsCreated = false;

    @wire(getTimecardTypes)
    wiredTypes({ error, data }) {
        if (data) {
            this.timecardTypes = data;
        } else if (error) {
            console.error('Error retrieving timecard types:', error);
        }
    }

    handleButtonClick(event) {
        this.selectedType = event.target.dataset.type;
        this.showModal = true;
    }

    handleCloseModal() {
        this.showModal = false;
        this.startDate = null;
        this.endDate = null;
        this.createdTimeCardId = '';
        this.timecardsCreated = false;
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
    }

    handleSubmit() {
        createTimecard({ type: this.selectedType, startDate: this.startDate, endDate: this.endDate, userId: userId })
            .then(( data ) => {
                this.createdTimeCardId = data;
                console.log(data);
                this.timecardsCreated = true;
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Timecard created and submitted for approval.',
                        variant: 'success'
                    })
                );
                //this.handleCloseModal();
            })
            .catch(error => {
                console.error('Error creating timecard:', error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: 'An error occurred while creating the timecard.',
                        variant: 'error'
                    })
                );
            });
    }
}