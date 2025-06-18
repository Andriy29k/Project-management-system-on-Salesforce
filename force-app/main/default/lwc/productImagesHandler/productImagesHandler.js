import {api, LightningElement, track, wire} from 'lwc';
import {getRecord, updateRecord} from "lightning/uiRecordApi";
import {ShowToastEvent} from "lightning/platformShowToastEvent";
import {refreshApex} from "@salesforce/apex";
import deleteImage from '@salesforce/apex/ProductImagesController.deleteFile';

const ACTIONS = {
    close: "close",
    previous: "previous",
    next: "next",
    replace: "replace",
    delete: "delete",
    update: "update"
}

const MESSAGES = {
    previewImagesConflict: "Preview images are incorrect. You can have 1 single preview or 1 preview image per season.",
    duplicateImages: "Duplicate image.",
    imagesUpdated: "Images updated",
    unableToDelete: "Unable to delete image: "
}

const SEASONS = {
    winter: "winter",
    summer: "summer",
    winterLabel: "Winter",
    summerLabel: "Summer"
}

export default class ProductImagesHandler extends LightningElement {
    @api recordId;
    @api imagesJsonFieldApiName = 'Images_JSON__c';
    @api isSyncedFieldApiName;
    @api updateDisplayUrl;
    @api maxFileSize = 5; // in MB
    @api disableSeasonalImages = false;
    @api skuFieldApiName;
    @api maxDetailImagesToUpload;
    @api skipQueryImageData = false;
    @api allowCopyrightsForPreview = false;

    @track isSinglePreview = false;
    @track isSummerPreview = false;
    @track isWinterPreview = false;
    @track numberOfDetailImages = 0;

    recordData;

    imagesData = [];
    path;

    isOrderChanged = false;
    isPreviewUpload = false;
    urlForReplace = '';

    showFullSizeImage = false;
    currentImageSource = '';

    showUploadModal = false;
    showSpinner = true;

    @wire( getRecord, { recordId: '$recordId', layoutTypes: 'Full'} )
    wiredRecord( { error, data} ) {
        if( error ) {
            this.showToast( 'Error', error.body[0].message, 'error' );
        } else if( data ) {
            this.recordData = data;
            this.path = '/' + this.recordData.apiName + '/' + this.recordId + '/';
            const imagesJSON = this.recordData.fields[this.imagesJsonFieldApiName].value;
            if( imagesJSON ) {
                this.imagesData = JSON.parse( imagesJSON );
                this.checkDuplicates();
            }
            this.showSpinner = false;
        }
    }

    get detailImages() {
        if( this.imagesData ) {
            this.numberOfDetailImages = 0;
            return this.imagesData.filter( curImage => {
                if( !curImage.main ) {
                    this.numberOfDetailImages++;
                    return curImage;
                }
            });
        }
    }

    get isDetailImagesUploadAllowed() {
        return this.numberOfDetailImages >= this.maxDetailImagesToUpload;
    }

    checkDuplicates() {
        const urlMap = new Map();

        for( const item of this.imagesData ) {
            if( !item.errors ) {
                item.errors = [];
            }

            if( urlMap.has( item.url ) ) {
                item.isError = true;
                item.errors = [ MESSAGES.duplicateImages ];

                if( !urlMap.get( item.url ).isError ) { // unable to clean up, changes not saved in imagesData
                    urlMap.get( item.url ).isError = true;
                    urlMap.get( item.url ).errors = [ MESSAGES.duplicateImages ];
                }
            } else {
                urlMap.set( item.url, item );
            }
        }
    }

    handleUploadResults( event ) {
        this.showSpinner = true;
        const imagesToUpdate = [...event.detail];

        imagesToUpdate.forEach( curImage => {
            if( curImage.oldURL ) {
                this.imagesData.forEach( curItem => {
                    if( curItem.url === curImage.oldURL ) {
                        curItem.url = curImage.imgObj.url;
                    }
                });
            } else {
                if( curImage.imgObj.main ) {
                    curImage.imgObj.sortOrder = 0;
                    this.imagesData.unshift( curImage.imgObj );
                } else {
                    curImage.imgObj.sortOrder = this.imagesData.length + 1;
                    this.imagesData.push( curImage.imgObj );
                }


            }
        });

        this.updateImagesData();
        this.closeUploadModal();
        this.showSpinner = false;
    }

    updateImagesData() {
        const fields = {};
        fields.Id = this.recordId;
        fields[this.imagesJsonFieldApiName] = JSON.stringify( this.imagesData );

        const recordInput = { fields };
        updateRecord( recordInput )
            .then( () => {
                this.showToast( 'Success', MESSAGES.imagesUpdated, "success");
                return refreshApex( this.recordData );
            })
            .catch( ( error ) => {
                console.log( error );
                this.showToast( 'Error', error.body[0].message, 'error' );
            })
            .finally( () => {
                this.showSpinner = false;
                this.isOrderChanged = false;
            });
    }

    handleImageClick( event ) {
        this.currentImageSource = event.currentTarget.dataset.id;
        this.showFullSizeImage = true;
    }

    handleUploadClick( event ) {
        this.showUploadModal = true;
    }

    closeUploadModal() {
        this.isPreviewUpload = false;
        this.urlForReplace = '';
        this.showUploadModal = false;
    }

    handleReplace( event ) {
        this.urlForReplace = event.currentTarget.dataset.id;
        this.showUploadModal = true;
    }

    handleDelete( event ) {
        this.deleteImage( event.currentTarget.dataset.id );
    }

    deleteImage( targetImage ) {
        this.showSpinner = true;

        deleteImage({ path: this.path, imageUrl: targetImage } )
            .then( () => {
                this.imagesData = this.imagesData.filter( ( curObj ) => curObj.url !== targetImage );
                this.updateImagesData();
            })
            .catch( ( error ) => {
                this.showToast( 'Error', MESSAGES.unableToDelete + error.body.message, 'error' );
                this.showSpinner = false;
            });
    }

    handleMoveLeft( event ) {
        const url = event.currentTarget.dataset.id;
        const index = this.imagesData.findIndex(image => image.url === url);
        if( index > 0 ) {
            this.changeOrder( index, index - 1 );
        }
    }

    handleMoveRight( event ) {
        const url = event.currentTarget.dataset.id;
        const index = this.imagesData.findIndex( image => image.url === url );
        if( index < this.imagesData.length - 1 ) {
            this.changeOrder( index, index + 1 );
        }
    }

    changeOrder( oldIndex, newIndex ) {
        const oldSortOrder = this.imagesData[oldIndex].sortOrder;
        const newSortOrder = this.imagesData[newIndex].sortOrder;
        const temp = this.imagesData[newIndex];

        this.imagesData[newIndex] = this.imagesData[oldIndex];
        this.imagesData[newIndex].sortOrder = newSortOrder;
        this.imagesData[oldIndex] = temp;
        this.imagesData[oldIndex].sortOrder = oldSortOrder;
        this.imagesData = [...this.imagesData];
        this.isOrderChanged = true;
    }

    handleFullSizeAction( event ) {
        const eventDetail = event.detail;
        if( eventDetail.action === ACTIONS.close ) {
            this.showFullSizeImage = false;
        } else if( eventDetail.action === ACTIONS.replace ) {
            this.urlForReplace = event.currentTarget.dataset.id;
            this.showFullSizeImage = false;
            this.showUploadModal = true;
        } else if( eventDetail.action === ACTIONS.delete ) {
            this.showFullSizeImage = false;
            this.deleteImage( eventDetail.currentImgSource );
        } else {
            const index = this.imagesData.findIndex( image => image.url === eventDetail.currentImgSource );
            if( eventDetail.action === ACTIONS.next ) {
                const newIndex = index < ( this.imagesData.length - 1 ) ? index + 1 : 0;
                this.currentImageSource = this.imagesData[newIndex].url;
            } else if( eventDetail.action === ACTIONS.previous ) {
                const newIndex = index !== 0 ? index - 1 : ( this.imagesData.length - 1 );
                this.currentImageSource = this.imagesData[newIndex].url;
            } else if( eventDetail.action === ACTIONS.update ) {
                this.updateImagesData();
            }
        }
    }

    get showSaveButton() {
        return this.isOrderChanged;
    }

    get saveButtonLabel() {
        return "Save Sort Order Changes";
    }

    saveImageAdditionalData() {
        this.updateImagesData();
    }

    showToast( title, message, variant ) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}