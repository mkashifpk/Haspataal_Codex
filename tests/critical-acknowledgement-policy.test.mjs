import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {acknowledgementBody,acknowledgementSnapshot,criticalReport,doctorCriticalAccess,doctorCriticalWork} from '../src/critical-acknowledgement-policy.ts';
const {criticalAlarmRecord}=createRequire(import.meta.url)('../electron/critical-alarm.cjs');
const r={critical_result_id:4,patient_id:5,source:'Lab',result_id:10,requisition_id:5,imaging_order_id:null,mrn:'DEMO',test_name:'Synthetic',finding:'SIMULATION',row_version:3,status:'Open',communications:[],acknowledged_by:null,acknowledged_at:null,action_taken:null};
test('acknowledgement always includes the exact version and bounded actual action; final results cannot submit',()=>{
 assert.deepEqual(acknowledgementBody(r,' DEMO action '),{action_taken:'DEMO action',expected_version:3});
 for(const action of ['','  ','ab','a'.repeat(2001)])assert.throws(()=>acknowledgementBody(r,action),/3–2000/);
 assert.throws(()=>acknowledgementBody({...r,status:'Acknowledged'},'DEMO action'),/already acknowledged/);
 for(const row_version of [0,undefined,1.5])assert.throws(()=>acknowledgementBody({...r,row_version},'DEMO action'),/current server version/);
});
test('acknowledgement review binds source report link and final action as well as patient/version/history',()=>{
 for(const change of [{patient_id:6},{row_version:4},{requisition_id:9},{imaging_order_id:12},{source:'Imaging'},{acknowledged_by:8},{action_taken:'other'},{communications:[{communication_id:1}]}])assert.notEqual(acknowledgementSnapshot(r),acknowledgementSnapshot({...r,...change}));
});
test('doctor work/view/report permission is not a guessed role, facility category or patient ownership',()=>{
 const p=['diagnostics.critical.view','diagnostics.critical.acknowledge'];
 for(const view of ['full','open_work'])assert.equal(doctorCriticalAccess(p,view).acknowledge,true);
 assert.deepEqual(doctorCriticalAccess(p,'records'),{read:true,work:false,acknowledge:false});
 for(const view of ['hidden','setup','','unknown'])assert.deepEqual(doctorCriticalAccess(p,view),{read:false,work:false,acknowledge:false});
 assert.equal(doctorCriticalAccess(['diagnostics.critical.view'],'full').acknowledge,false);
 assert.equal(criticalReport(r,[]),undefined);assert.equal(criticalReport(r,['lab.result.view']).path,'/lab/requisitions/5/report/pdf');
 assert.equal(criticalReport({...r,source:'Imaging',imaging_order_id:12},['imaging.order.view']).path,'/imaging/orders/12/report/pdf');
 assert.equal(criticalReport({...r,requisition_id:null},['lab.result.view']),undefined);
 const rows=[{kind:'CriticalToAcknowledge',critical_result_id:1},{kind:'CriticalToCommunicate',critical_result_id:2},{kind:'CriticalToAcknowledge',critical_result_id:null}];assert.deepEqual(doctorCriticalWork(rows),[rows[0]]);
});
test('doctor alarm accepts exact current imaging and Lab, laboratory default still refuses Imaging',()=>{
 const im={critical_result_id:12,source:'Imaging',status:'Open'};
 assert.equal(criticalAlarmRecord(im,12,['Lab','Imaging']),true);assert.throws(()=>criticalAlarmRecord(im,12));
 assert.equal(criticalAlarmRecord({...im,status:'Acknowledged'},12,['Lab','Imaging']),false);
});
