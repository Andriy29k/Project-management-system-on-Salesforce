import {api, LightningElement, track} from 'lwc';
import uploadImage from '@salesforce/apex/ProductImagesController.uploadFiles';
import {ShowToastEvent} from "lightning/platformShowToastEvent";

export default class ImageUploadHandler extends LightningElement {
    @api isPreviewImage = false;
    @api imgUrlToReplace = '';
    @api path = '/';
    @api seasonOptions;
    @api maxImageSizeInMB;
    @api disableSeasonalImages;
    @api maxDetailImagesToUpload;

    isImageUploaded = false;
    uploadedImageURLs = [];
    uploadedFiles = [];
    uploadResults = [];

    @track progress = 0;
    @track isUploading = false;
    @track currentFileName = '';

    selectedSeason = '';
    previewUploadMessage = 'You can have 1 single preview or 1 preview image per season. If you want to upload seasonal preview, please select season.';

    handleChange( event ) {
        this.selectedSeason = event.detail.value;
    }

    handleFileChange( event ) {
        let selectedFiles = [...event.target.files];
        if( selectedFiles.length > this.maxDetailImagesToUpload ) {
            this.showToast( 'Error', "You cannot upload more than " + this.maxDetailImagesToUpload + " files", 'error' );
            return ;
        }

        this.uploadedFiles = selectedFiles;
        this.uploadedFiles.forEach( curFile => {
            if( this.bytesToMB( curFile.size ) < this.maxImageSizeInMB ) {
                this.uploadedImageURLs.push( window.URL.createObjectURL( curFile ) );
            } else {
                this.showToast( 'Error', "File " + curFile.name + " is too big. You cannot upload files more than " + this.maxImageSizeInMB + " MB", 'error' );
            }
        });

        if( this.uploadedImageURLs.length > 0 ) {
            this.isImageUploaded = true;
        }
    }

    bytesToMB( bytes ) {
        return bytes / (1024 * 1024);
    }

    uploadFile() {
        if( !this.uploadedFiles || this.uploadedFiles.length === 0 ) {
            this.showToast( 'Error', 'Please select a file to upload.', 'error' );
            return;
        }

        this.isUploading = true;
        this.processFiles( this.uploadedFiles )
            .then( () => {
                this.dispatchEvent( new CustomEvent('upload', { detail: this.uploadResults } ) );
                this.isUploading = false;
                this.progress = 0;
            })
            .catch( error => {
                this.showToast( 'Error', error.body ? error.body.message : error.message, 'error' );
                this.isUploading = false;
                this.progress = 0;
            });
    }

    async processFiles( files ) {
        for( let i = 0; i < files.length; i++ ) {
            const file = files[i];
            this.currentFileName = file.name;
            try {
                const base64String = await this.readFileAsBase64( file );
                const result = await this.sendFileToApex( base64String, this.path,  file.name );
                const imageObject = {
                    url: result,
                    season: this.selectedSeason,
                    main: this.isPreviewImage,
                    fileType: file.type,
                    name: file.name
                };
                this.uploadResults.push( {
                    oldURL: this.imgUrlToReplace,
                    imgObj: imageObject
                });
                this.progress = Math.round(((i + 1) / files.length) * 100);
            } catch( error ) {
                throw error;
            }
        }
    }

    readFileAsBase64( file ) {
        return new Promise(( resolve, reject ) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve( reader.result.split(',')[1] ); // Extract base64 string from data URL
            };
            reader.onerror = ( error) => {
                reject( error );
            };
            reader.readAsDataURL( file );
        });
    }

    async sendFileToApex( base64String, path, imageName ) {
        try {
            // Call an Apex method to process the file
            return await uploadImage({ base64String: base64String, path: path, fileName: imageName });
        } catch (error) {
            throw error; // Rethrow the error to be caught by the caller
        }
    }

    get isMultipleUploadAllowed() {
        return !this.isPreviewImage && !this.imgUrlToReplace;
    }

    get isSeasonalPreviewAllowed() {
        return this.isPreviewImage && !this.disableSeasonalImages;
    }

    closeModal() {
        this.dispatchEvent( new CustomEvent('close') );
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