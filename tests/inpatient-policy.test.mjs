import test from 'node:test';
import assert from 'node:assert/strict';
import {inpatientActionAllowed,inpatientSnapshot,inpatientEventMatches} from '../src/inpatient-policy.ts';
const row={admission_id:10,patient_id:20,row_version:1,status:'Admitted',admission_reason:null,provisional_diagnosis:null,bed_id:30,discharge:{started:false,blocked_on:null}};
test('one-shot admission details and clinical discharge respect state, view and independent permissions',()=>{
 assert(inpatientActionAllowed('details',row,'full',['ipd.admission.request']));
 assert(inpatientActionAllowed('details',{...row,status:'CodeRedActive'},'open_work',['ipd.discharge.initiate']));
 assert(!inpatientActionAllowed('details',{...row,admission_reason:'Already recorded'},'full',['ipd.admission.request']));
 for(const status of ['Discharged','Cancelled'])assert(!inpatientActionAllowed('details',{...row,status},'full',['ipd.admission.request']));
 for(const view of ['records','hidden','setup',undefined])for(const action of ['details','discharge'])assert(!inpatientActionAllowed(action,row,view,['ipd.admission.request','ipd.discharge.initiate']));
 assert(inpatientActionAllowed('discharge',row,'open_work',['ipd.discharge.initiate']));
 for(const status of ['AdmissionPending','BedReserved','CodeRedActive','DischargeInProgress','Discharged','Cancelled'])assert(!inpatientActionAllowed('discharge',{...row,status},'full',['ipd.discharge.initiate']));
 assert(!inpatientActionAllowed('discharge',row,'full',['ipd.admission.request']));
 assert(!inpatientActionAllowed('details',row,'full',['ipd.admission.view']));
});
test('review snapshot detects another terminal changing state, clinical details, patient or bed',()=>{
 for(const change of [{row_version:2},{status:'DischargeInProgress'},{admission_reason:'Recorded elsewhere'},{patient_id:21},{bed_id:31},{discharge:{started:true,blocked_on:'PharmacyClearance'}}])assert.notEqual(inpatientSnapshot(row),inpatientSnapshot({...row,...change}));
});
test('events update the list without interrupting a different admission review',()=>{
 assert(inpatientEventMatches(row,{admission_id:10}));
 assert(!inpatientEventMatches(row,{admission_id:11}));
 assert(inpatientEventMatches(row,{patient_id:20}));
 assert(!inpatientEventMatches(row,{patient_id:21}));
 assert(!inpatientEventMatches(undefined,{admission_id:10}));
 assert(inpatientEventMatches(row,{}));
});
