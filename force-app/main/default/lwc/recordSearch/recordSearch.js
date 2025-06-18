import { LightningElement, api, track } from 'lwc';
import searchRecords from '@salesforce/apex/RecordSearchController.searchRecords';

export default class RecordSearch extends LightningElement {
    @api type; // Object API name
    @api label = 'Search'; // Default label
    @track searchTerm = ''; // Input value
    @track searchResults = []; // Search results
    @track showDropdown = false; // Toggle dropdown visibility
    @track noResults = false; // Show "No results found" message

    handleInputChange(event) {
        this.searchTerm = event.target.value;

        if (this.searchTerm.trim().length > 0) {
            searchRecords({ objectName: this.type, searchTerm: this.searchTerm })
                .then((results) => {
                    this.searchResults = results.map((record) => ({
                        id: record.Id,
                        label: record.Name, // Adjust this to use the display field for the object
                    }));
                    this.noResults = this.searchResults.length === 0;
                    this.showDropdown = true;
                })
                .catch((error) => {
                    console.error('Error fetching search results:', error);
                    this.clearResults();
                });
        } else {
            this.clearResults();
        }
    }

    handleSelect(event) {
        const recordId = event.currentTarget.dataset.id;
        const selectedRecord = this.searchResults.find((result) => result.id === recordId);

        const recordSelectedEvent = new CustomEvent('recordselected', {
            detail: recordId,
        });
        this.dispatchEvent(recordSelectedEvent);

        this.searchTerm = selectedRecord.label;
        this.clearResults();
    }

    clearResults() {
        this.searchResults = [];
        this.showDropdown = false;
        this.noResults = false;
    }
}