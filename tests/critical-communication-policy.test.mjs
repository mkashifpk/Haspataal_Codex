import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {communicationBody,criticalAccess,criticalFilters,criticalSnapshot,benchCriticalWork} from '../src/critical-communication-policy.ts';
const {criticalAlarmRecord}=createRequire(import.meta.url)('../electron/critical-alarm.cjs');
test('communication requires actual recipient, a completed call and read-back for Telephone/InPerson',()=>{
 for(const means of ['Telephone','InPerson'])assert.throws(()=>communicationBody(means,'RequestingDoctor','DEMO clinician',false,'',true),/read the result back/);
 assert.throws(()=>communicationBody('Written','HealthAuthority','DEMO authority',false,'',false),/Tell the recipient first/);
 assert.throws(()=>communicationBody('Electronic','Invented','DEMO authority',false,'',true),/actual means/);
 assert.throws(()=>communicationBody('Electronic','HealthAuthority',' ',false,'',true),/recipient name/);
 assert.throws(()=>communicationBody('Written','Patient','DEMO patient',false,'a'.repeat(1001),true),/1000/);
 assert.deepEqual(communicationBody('Telephone','OnCallDoctor',' DEMO doctor ',true,' simulation ',true),{means:'Telephone',recipient_role:'OnCallDoctor',recipient_name:'DEMO doctor',read_back:true,note:'simulation'});
 assert.equal(communicationBody('Written','HealthAuthority','DEMO authority',false,'',true).read_back,false);
});
test('critical service and permissions preserve existing work while retiring and fail closed elsewhere',()=>{
 const p=['diagnostics.critical.view','diagnostics.critical.communicate'];
 for(const v of ['full','open_work'])assert.equal(criticalAccess(p,v).communicate,true);
 assert.deepEqual(criticalAccess(p,'records'),{read:true,work:false,communicate:false});
 for(const v of ['hidden','setup','','unknown'])assert.deepEqual(criticalAccess(p,v),{read:false,work:false,communicate:false});
 assert.equal(criticalAccess(['diagnostics.critical.view'],'full').communicate,false);
 assert.equal(criticalAccess(['diagnostics.critical.communicate'],'full').read,false);
});
test('review binds patient/result/version/history and does not make elapsed minutes a clinical edit',()=>{
 const r={critical_result_id:1,source:'Lab',result_id:9,patient_id:2,mrn:'DEMO-2',test_name:'RBS',finding:'Synthetic',row_version:1,status:'Open',authority_pending:false,notifiable_disease:null,communicate_due_at:'2026-10-26T15:00:00Z',communications:[]};
 assert.equal(criticalSnapshot(r),criticalSnapshot({...r,minutes_to_communicate:40,is_overdue:true}));
 for(const c of [{patient_id:3},{result_id:10},{status:'Acknowledged'},{row_version:2},{authority_pending:true},{communications:[{communication_id:5}]}])assert.notEqual(criticalSnapshot(r),criticalSnapshot({...r,...c}));
});
test('bench worklist retains only Lab communication and priority-disease handovers without invented ids/order',()=>{
 const rows=[{area:'Lab',kind:'LabOverdue'},{area:'Lab',kind:'PriorityDiseaseToNotify',critical_result_id:5},{area:'Imaging',kind:'CriticalToCommunicate'},{area:'Lab',kind:'CriticalToCommunicate',critical_result_id:9},{area:'Lab',kind:'CriticalToAcknowledge'}];
 assert.deepEqual(benchCriticalWork(rows),[rows[1],rows[3]]);
});
test('bounded critical filters reject impossible/reversed dates and malformed limits',()=>{
 for(const n of ['0','1001','12x','1.5','1e2','Infinity'])assert.throws(()=>criticalFilters(n,'',''));
 assert.throws(()=>criticalFilters('200','2026-02-30',''));
 assert.throws(()=>criticalFilters('200','2026-10-27','2026-10-26'));
 assert.deepEqual(criticalFilters('1','2026-10-26','2026-10-26'),{limit:1,date_from:'2026-10-26',date_to:'2026-10-26'});
});
test('alarm is allowed only for the exact current open Lab record, never a handled or mismatched result',()=>{
 assert.equal(criticalAlarmRecord({critical_result_id:2,source:'Lab',status:'Open'},2),true);
 for(const status of ['Communicated','Acknowledged'])assert.equal(criticalAlarmRecord({critical_result_id:2,source:'Lab',status},2),false);
 assert.throws(()=>criticalAlarmRecord({critical_result_id:2,source:'Lab',status:'Open'},3));
 assert.throws(()=>criticalAlarmRecord({critical_result_id:2,source:'Imaging',status:'Open'},2));
});
