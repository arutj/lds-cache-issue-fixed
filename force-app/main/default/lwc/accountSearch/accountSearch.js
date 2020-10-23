import { LightningElement, track, wire } from 'lwc';
import getAccTypes from '@salesforce/apex/AccDataSvc.getAccTypes';
import getAccounts from '@salesforce/apex/AccDataSvc.getAccounts';
import { updateRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
    { label: 'Type', fieldName: 'Type', type: 'text' }
];
const SUCCESS_TITLE = 'Success';
const SUCCESS_MSG = 'Record Updates Succeeded!';
const SUCCES_VARIANT = 'success';
const ERROR_TITLE = 'Error';
const ERROR_VARIANT = 'error';

export default class AccountSearch extends LightningElement {
    
    selectedTypeLabel = '';
    @track typeOptions;
    @track accounts;
    columns = COLUMNS;

    isLoading = false; 
    error = undefined;

    // Local storage for account type as key and array of record IDs as value
    cacheMap = new Map(); 
    // Local storage for account type as key and data fetched by wire adapater as value.
    // This map is used to store the actual reference to the LDS cache entries.
    cacheRef = new Map(); 
    updatedIDs = undefined; // Store the updated record IDs during every DML
    
    @wire(getAccTypes)
    accTypes({error, data}){
        if(data){
            this.error = undefined;
            this.typeOptions = data.map(type => {
                return { label: type, value: type.replace(/ /g, '_')}
            });
            this.typeOptions.unshift({ label: 'All Types', value: ''});            
        }
        else if(error){
            this.typeOptions = undefined;
            this.error = error;
        }
    }

    @wire(getAccounts, {accType: '$selectedTypeLabel'})
    wiredAccounts(result){
        this.accounts = result;  
        
        // Everytime the wire adapter fetches data, store the filter value (key)
        // and the result set ref or result set record IDs (value) in the JS maps.
        if(result.data){
            this.cacheMap.set(this.selectedTypeLabel, 
                this.accounts.data.slice().map(rec => { 
                    const fields = Object.assign({}, rec); return fields.Id; 
                })
            );
            this.cacheRef.set(this.selectedTypeLabel, this.accounts);
        }
    }

    handleTypeChange(event){
        this.isLoading = true;
        this.selectedTypeLabel = event.detail.value ? event.detail.value.replace(/_/g, ' '): '';
        this.isLoading = false;
    }

    handleSave(event){
        const recordInputs = event.detail.draftValues.slice().map(draft => {
            const fields = Object.assign({}, draft);
            return {fields};
        });

        // Capture all the record IDs on which DML is being performed. As a best practice, 
        // this needs to be done after the promises are resolved, but capturing it here since
        // this is a demo component.
        this.updatedIDs = recordInputs.map(record => record.fields.Id);

        const promises = recordInputs.map(recordInput => updateRecord(recordInput));
        Promise.all(promises)
        .then(() => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: SUCCESS_TITLE, 
                    message: SUCCESS_MSG, 
                    variant: SUCCES_VARIANT
                })
            );

            this.refresh(); 
        })
        .catch(error =>{
            this.dispatchEvent(
                new ShowToastEvent({
                    title: ERROR_TITLE, 
                    message: error.body.message, 
                    variant: ERROR_VARIANT
                })
            );
        });
    }

    refresh(){
        // Array to capture the specific filter keys that resulted with updated records
        let refreshKeys = []; 

        // Loop thru the 'cacheMap' and find the filter keys have updated record's IDs
        this.cacheMap.forEach((value, key) => {
            refreshKeys.push(value.some(element => {return this.updatedIDs.includes(element);})? key : null);
        });

        // For each filter key, locate the corresponding entry in 'cacheRef' and invoke refreshApex 
        // method. Value in the `cacheRef` entry serves as reference to the LDS cache entry
        refreshKeys.forEach(async key => {
            this.isLoading = true;
            await refreshApex(this.cacheRef.get(key));
            this.isLoading = false;
        });       
    }   
}