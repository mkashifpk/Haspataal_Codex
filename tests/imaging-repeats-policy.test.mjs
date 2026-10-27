import test from 'node:test';import assert from 'node:assert/strict';
import {repeatAccess,repeatBody,repeatPeriod,repeatRecoveryPeriod,repeatStageAllowed,repeatOrderSnapshot,repeatReasons} from '../src/imaging-repeats-policy.ts';
test('repeat records require a matched past exposure, enumerated reason and whole bounded count',()=>{
 assert.throws(()=>repeatBody('Positioning','1','',false),/already occurred/);
 for(const n of ['0','21','1.5','1e1','-1','Infinity',''])assert.throws(()=>repeatBody('Positioning',n,'',true),/1 to 20/);
 assert.throws(()=>repeatBody('invented','1','',true),/actual reason/);
 for(const reason of repeatReasons)assert.equal(repeatBody(reason,'20',' factual ',true).reason,reason);
 assert.deepEqual(repeatBody('Positioning','1','',true),{reason:'Positioning',exposures:1});
 assert.throws(()=>repeatBody('Other','1','   ',true),/requires a note/);assert.throws(()=>repeatBody('Other','1','x'.repeat(501),true),/500/);
 assert.equal(repeatBody('Other','2',' note ',true).note,'note');
});
test('only performed stages accept quality repeats; record-service history and permissions fail closed',()=>{
 for(const s of ['InProgress','Completed','Reported'])assert(repeatStageAllowed(s));for(const s of ['Ordered','Scheduled','Outsourced','Cancelled','unknown'])assert(!repeatStageAllowed(s));
 const p=['imaging.order.view','imaging.order.update'];for(const v of ['full','open_work'])assert(repeatAccess(v,p).work);
 assert.deepEqual(repeatAccess('records',p),{visible:true,register:true,read:true,work:false});
 assert(repeatAccess('full',['diagnostics.quality.view']).register);assert(!repeatAccess('full',['diagnostics.quality.view']).work);
 for(const v of ['hidden','setup','bad',undefined])assert(!repeatAccess(v,p).visible);
});
test('period filters reject impossible/missing/reversed dates rather than silently changing scope',()=>{
 for(const d of ['','2026-02-30','2026-2-1','x'])assert.throws(()=>repeatPeriod(d,'2026-10-27'));
 assert.throws(()=>repeatPeriod('2026-10-28','2026-10-27'));
 assert.deepEqual(repeatPeriod('2026-10-27','2026-10-27'),{date_from:'2026-10-27',date_to:'2026-10-27'});
});
test('review snapshot binds source order/patient/version/stage and clinical identifiers',()=>{
 const o={imaging_order_id:1,patient_id:3,mrn:'DEMO',patient_name:'DEMO',row_version:1,status:'InProgress',accession_number:'A1',modality:'XRay',body_part:'Wrist',laterality:'Left'};
 for(const c of [{imaging_order_id:2},{patient_id:4},{mrn:'other'},{row_version:2},{status:'Cancelled'},{accession_number:'A2'},{modality:'CT'},{laterality:'Right'}])assert.notEqual(repeatOrderSnapshot(o),repeatOrderSnapshot({...o,...c}));
});

test('uncertain-repeat history covers authenticated UTC and hospital-day midnight boundaries',()=>{
 assert.deepEqual(repeatRecoveryPeriod('2026-10-27','2026-10-28T01:00:00Z','2026-10-27'),{date_from:'2026-10-27',date_to:'2026-10-28'});
 assert.deepEqual(repeatRecoveryPeriod('2026-10-27','2026-10-27T23:30:00Z','2026-10-28'),{date_from:'2026-10-27',date_to:'2026-10-28'});
 assert.deepEqual(repeatRecoveryPeriod('2026-10-27','2026-10-27T15:00:00Z','2026-10-27'),{date_from:'2026-10-27',date_to:'2026-10-27'});
 assert.throws(()=>repeatRecoveryPeriod('invalid','2026-10-27T15:00:00Z','2026-10-27'));
});
