import { LightningElement, api } from 'lwc';

const ACTIONS = {
    close: "close",
    previous: "previous",
    next: "next",
    replace: "replace",
    delete: "delete",
    update: "update"
}

export default class ImageModal extends LightningElement {
    @api imageUrl;

    closeModal() {
        this.dispatchCustomEvent( ACTIONS.close );
    }

    showPrevious() {
        this.dispatchCustomEvent( ACTIONS.previous );
    }

    showNext() {
        this.dispatchCustomEvent( ACTIONS.next );
    }

    handleReplace() {
        this.dispatchCustomEvent( ACTIONS.replace );
    }

    handleDelete() {
        this.dispatchCustomEvent( ACTIONS.delete );
    }

    handleCopyrightsUpdate() {
        this.dispatchCustomEvent( ACTIONS.update );
    }

    handleMouseOver(event) {
        event.target.closest('.navigation-icon').classList.add('focused');
    }

    handleMouseOut(event) {
        event.target.closest('.navigation-icon').classList.remove('focused');
    }

    dispatchCustomEvent( action ) {
        const eventDetail = {
            action: action,
            currentImgSource: this.imageUrl
        };
        this.dispatchEvent(new CustomEvent('fullsizeaction', { detail: eventDetail }));
    }
}