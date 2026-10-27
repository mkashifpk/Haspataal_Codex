import test from 'node:test';
import assert from 'node:assert/strict';
import {walkinPublicationMatches} from '../src/lab-event-policy.ts';
test('Reception publication is an exact positive patient/order ID hint, independent of names, values or priority',()=>{
 const shown={patientId:12,reqId:34};
 assert(walkinPublicationMatches(shown,{patient_id:12,requisition_id:35}));
 assert(walkinPublicationMatches(shown,{patient_id:13,requisition_id:34}));
 for(const p of [{patient_id:13,requisition_id:35},{patient_id:'12',requisition_id:'34'},{patient_name:'Same display name',test_name:'CBC',has_critical_value:true,priority:'critical'},{}])assert.equal(walkinPublicationMatches(shown,p),false);
 assert.equal(walkinPublicationMatches({patientId:0,reqId:0},{patient_id:0,requisition_id:0}),false);
});
