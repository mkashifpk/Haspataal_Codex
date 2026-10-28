import test from 'node:test';import assert from 'node:assert/strict';
import {bandAccess,bandBody,bandScanCode,bandHistoryKey} from '../src/wristband-policy.ts';
const s={kind:'admission',id:101,patient_id:201,name:'POLICY ONLY',mrn:'POLICY-ONLY',number:'POLICY-ONLY',status:'Admitted'};
test('a band is for exactly the selected actual stay, with explicit patient check',()=>{
 assert.deepEqual(bandBody(s,[],'',true),{admission_id:101});assert.throws(()=>bandBody(s,[],'',false),/Confirm/);assert.throws(()=>bandBody({...s,id:0},[],'',true),/actual patient stay/);assert.deepEqual(bandBody({...s,kind:'er'},[],'',true),{er_visit_id:101});
});
test('current band across another stay requires a replacement reason; no typed request patient/user IDs',()=>{
 const current={patient_id:s.patient_id,is_current:true,wristband_id:301,admission_id:999,row_version:1};
 assert.throws(()=>bandBody(s,[current],' ',true),/current band/);assert.deepEqual(bandBody(s,[current],' damaged ',true),{admission_id:101,replacement_reason:'damaged'});assert.throws(()=>bandBody(s,[{...current,patient_id:999}],'damaged',true),/another patient/);assert.throws(()=>bandBody(s,[current],'x'.repeat(301),true),/300/);assert.notEqual(bandHistoryKey([current]),bandHistoryKey([{...current,row_version:2,is_current:false}]));
});
test('records view can reprint but cannot issue, hidden/setup have no work; only permissions decide',()=>{
 const p=['patient.view','patient.wristband.print','medication.safety.view'];assert.equal(bandAccess('full',p).issue,true);assert.equal(bandAccess('open_work',p).issue,true);assert.equal(bandAccess('records',p).print,true);assert.equal(bandAccess('records',p).issue,false);for(const v of ['hidden','setup',undefined])assert.equal(bandAccess(v,p).read,false);assert.equal(bandAccess('full',['patient.view']).issue,false);assert.equal(bandAccess('full',['patient.view']).worklist,false);
});
test('scanner input accepts patient code only within declared bounds; no global keystroke interception',()=>{
 assert.equal(bandScanCode(' HMS:PT:policy-only '),'HMS:PT:policy-only');assert.throws(()=>bandScanCode('x'),/3–80/);assert.throws(()=>bandScanCode('x'.repeat(81)),/3–80/);
});
