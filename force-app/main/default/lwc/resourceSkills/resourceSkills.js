import { LightningElement, track, wire } from 'lwc';
import getSkillsByUser from '@salesforce/apex/SkillsController.getSkillsByUser';
import USER_ID from '@salesforce/user/Id';

const SKILL_COLUMNS = [
    { label: 'Name', fieldName: 'Name' },
    { label: 'Rating', fieldName: 'Rating__c' }
];

const CERTIFICATION_COLUMNS = [
    { label: 'Name', fieldName: 'Name' },
    { label: 'Date Of Receipt', fieldName: 'Date_of_Receipt__c' },
    { label: 'Expiration Date', fieldName: 'Expiration_Date__c' }
];
export default class ResourceSkills extends LightningElement {
    @track skills = [];
    @track certifications = [];
    @track skillsColumns = SKILL_COLUMNS;
    @track certificationColumns = CERTIFICATION_COLUMNS;
    userId = USER_ID; // Current User ID

    @wire(getSkillsByUser, { userId: '$userId' })
    wiredSkills({ error, data }) {
        if (data) {
            console.log(data);
            if(data.Skill) {
                this.skills = data.Skill.map( skill => { return {...skill, Name: skill.Skill__r.Name}; });
            }
            if (data.Certification) {
                this.certifications = data.Certification.map( cert => { return {...cert, Name: cert.Skill__r.Name}; });
            }
        } else if (error) {
            console.error(error);
        }
    }
}