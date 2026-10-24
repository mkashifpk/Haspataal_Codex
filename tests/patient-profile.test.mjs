import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePatientMaster} from '../src/patient-profile.ts';
const record=(id,extra={})=>({patient_id:id,master_patient_id:id,merged_into_id:null,registration_type:'Regular',...extra});
test('an audited merged identity is followed to the authoritative master and its actual facts',async()=>{
 const calls=[],source=record(10,{master_patient_id:20,merged_into_id:20,registration_type:'Merged',full_name:'Retained identity'}),master=record(20,{full_name:'Current identity'});
 const actual=await resolvePatientMaster(10,async id=>{calls.push(id);return id===10?source:master});
 assert.deepEqual(calls,[10,20]);assert.equal(actual,master);
});
test('a stale selection stops lookup before another identity is requested',async()=>{
 let active=true;const calls=[];
 const actual=await resolvePatientMaster(10,async id=>{calls.push(id);active=false;return record(id,{master_patient_id:20})},()=>active);
 assert.equal(actual,undefined);assert.deepEqual(calls,[10]);
});
test('cycles and unresolved merged identities fail closed rather than expose an editable duplicate',async()=>{
 await assert.rejects(resolvePatientMaster(10,async id=>record(id,{master_patient_id:id===10?20:10,registration_type:'Merged'})),/could not be resolved/);
 await assert.rejects(resolvePatientMaster(10,async id=>record(id,{registration_type:'Merged'})),/could not be resolved/);
});
test('a failed master read stays a visible error instead of returning the retained source',async()=>{
 const failure=new Error('Actual master read failed');
 await assert.rejects(resolvePatientMaster(10,async id=>{if(id===20)throw failure;return record(id,{master_patient_id:20})}),e=>e===failure);
});
