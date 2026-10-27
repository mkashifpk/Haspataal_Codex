import test from 'node:test';
import assert from 'node:assert/strict';
import {radiologyAccess,imagingActionAllowed,imagingSnapshot,radiologyBody,emptyRadiologyDraft} from '../src/radiology-policy.ts';
const order={imaging_order_id:37,row_version:4,patient_id:28,mrn:'SYNTHETIC-28',patient_name:'Synthetic',status:'Scheduled',accession_number:'ACTUAL-SYNTHETIC',modality:'CT',pregnancy_check_needed:true};
test('start requires actual identity proof, site/side, server-required pregnancy question and Pregnant decision',()=>{
 const draft={...emptyRadiologyDraft(),identity:'TwoIdentifiers',asked:true,site:true,pregnancy:'NotPregnant'};
 assert.deepEqual(radiologyBody('InProgress',order,draft),{status:'InProgress',site_confirmed:true,identity_note:null,identity_check:'TwoIdentifiers',pregnancy_status:'NotPregnant',pregnancy_note:null});
 for(const change of [{identity:''},{asked:false},{site:false},{pregnancy:''},{pregnancy:'Pregnant',pregnancyNote:''}])assert.throws(()=>radiologyBody('InProgress',order,{...draft,...change}));
 assert.equal(radiologyBody('InProgress',order,{...draft,pregnancy:'Pregnant',pregnancyNote:'Synthetic documented decision by responsible clinician'}).pregnancy_status,'Pregnant');
 assert.throws(()=>radiologyBody('InProgress',order,{...draft,identity:'WristbandScan',band:'HMS:PT:SYNTHETIC-28'},[],false));
 assert.equal(radiologyBody('InProgress',order,{...draft,identity:'WristbandScan',band:'HMS:PT:SYNTHETIC-28'},[],true).wristband_code,'HMS:PT:SYNTHETIC-28');
 assert.throws(()=>radiologyBody('InProgress',order,{...draft,identity:'EmergencyOverride',identityNote:'Synthetic'},[],false,false));
 assert.equal(radiologyBody('InProgress',order,{...draft,identity:'EmergencyOverride',identityNote:'Synthetic'},[],false,true).identity_check,'EmergencyOverride');
});
test('completion needs explicit contrast outcome; actual contrast and selected numeric doctor never become guessed defaults',()=>{
 const o={...order,status:'InProgress'},d=emptyRadiologyDraft();
 assert.throws(()=>radiologyBody('Completed',o,d));
 assert.deepEqual(radiologyBody('Completed',o,{...d,contrastChoice:'None'}),{status:'Completed'});
 for(const id of ['', '0','1x','1e2','-1'])assert.throws(()=>radiologyBody('Completed',o,{...d,contrastChoice:'Given',contrast:'Synthetic agent/dose/route',doctorId:id}));
 assert.deepEqual(radiologyBody('Completed',o,{...d,contrastChoice:'Given',contrast:'Synthetic only; no contrast administered',doctorId:'19'}),{status:'Completed',contrast:'Synthetic only; no contrast administered',contrast_doctor_id:19});
 assert.throws(()=>radiologyBody('link',o,d));
 assert.deepEqual(radiologyBody('link',o,{...d,linkCompletionChecked:true}),{});
});
test('state machine, finality and runtime service/permission gates refuse unsupported clinical actions',()=>{
 assert(imagingActionAllowed({status:'Ordered'},'Scheduled'));
 assert(!imagingActionAllowed({status:'InProgress'},'Cancelled'));
 for(const status of ['Reported','Cancelled'])for(const action of ['Scheduled','InProgress','Completed','Cancelled','link','report'])assert.equal(imagingActionAllowed({status},action),false);
 assert.equal(radiologyAccess('full',['imaging.order.update']).report,false);
 assert.equal(radiologyAccess('open_work',['imaging.order.update']).update,true);
 const records=radiologyAccess('records',['imaging.order.view','imaging.order.update','imaging.report.enter']);assert(records.read&&!records.list&&!records.update&&!records.report);
 for(const view of [undefined,'hidden','setup','unsupported'])assert.equal(radiologyAccess(view,['imaging.order.view']).read,false);
});
test('report bounds/active modality findings, cancellation and manual study input preserve actual clinical data',()=>{
 const o={...order,status:'Completed'},d={...emptyRadiologyDraft(),report:'Synthetic report',finding:'9'};
 const f={finding_id:9,is_active:true,modality:'CT'};
 assert.equal(radiologyBody('report',o,d,[f]).critical_finding_id,9);
 assert.throws(()=>radiologyBody('report',o,d,[{...f,modality:'MRI'}]));
 assert.throws(()=>radiologyBody('report',o,d,[{...f,is_active:false}]));
 assert.throws(()=>radiologyBody('report',o,{...d,report:'a'.repeat(20001)},[f]));
 assert.throws(()=>radiologyBody('Cancelled',order,emptyRadiologyDraft()));
 assert.equal(radiologyBody('Cancelled',order,{...emptyRadiologyDraft(),reason:'Synthetic cancellation'}).reason,'Synthetic cancellation');
 assert.throws(()=>radiologyBody('link',order,{...emptyRadiologyDraft(),linkMode:'manual'}));
 assert.deepEqual(radiologyBody('link',order,{...emptyRadiologyDraft(),linkMode:'manual',uid:'actual supplied UID'}),{study_instance_uid:'actual supplied UID'});
});
test('frozen review detects changed order, patient, site, pregnancy need, state and version',()=>{
 for(const changed of [{row_version:5},{status:'Reported'},{patient_id:99},{mrn:'OTHER'},{body_part:'other site'},{laterality:'Left'},{pregnancy_check_needed:false},{accession_number:'OTHER'}])assert.notEqual(imagingSnapshot(order),imagingSnapshot({...order,...changed}));
 assert.equal(imagingSnapshot(order),imagingSnapshot(structuredClone(order)));
});
