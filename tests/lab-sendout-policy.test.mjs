import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {assertManifestSample,dispatchBody,manifestItemSnapshot,partnerEligible,partnerReportFields,pendingSnapshot,sendOutAccess,sendOutLimit} from '../src/lab-sendout-policy.ts';
const {sendOutHtml,assertSendOut}=createRequire(import.meta.url)('../electron/sendout-print.cjs');
const partner={partner_id:3,is_active:true,mou_expired:false,services:'Lab',row_version:2};
const pending=[{sample_id:5,barcode:'DEMO5',sample_status:'Collected',lab_requisition_item_id:8,requisition_id:2,item_status:'SampleCollected',mrn:'DEMO',partner_id:3}];
test('dispatch binds unique current samples, one eligible actual partner and bounded courier/note',()=>{
 assert.deepEqual(dispatchBody(partner,[5],pending,' DEMO courier ',' note '),{partner_id:3,sample_ids:[5],courier:'DEMO courier',note:'note'});
 for(const ids of [[],[5,5],[6],[0],[1.1]])assert.throws(()=>dispatchBody(partner,ids,pending,'',''),/current pending/);
 for(const p of [{...partner,is_active:false},{...partner,mou_expired:true},{...partner,services:'Imaging'},undefined])assert.throws(()=>dispatchBody(p,[5],pending,'',''),/valid MOU/);
 assert.throws(()=>dispatchBody(partner,[5],pending,'x'.repeat(201),''));assert.throws(()=>dispatchBody(partner,[5],pending,'','x'.repeat(501)));
 assert.equal(partnerEligible({...partner,services:'Both'}),true);
});
test('sample and manifest snapshots reject changed identity, dispatch/result state and partner binding',()=>{
 const item={...pending[0],sample_status:'Dispatched',item_status:'Processing',result_entered_at:null};
 const scan={sample:{sample_id:5,barcode:'DEMO5',status:'Dispatched',send_out_id:4},item:{lab_requisition_item_id:8,status:'Processing'},patient:{mrn:'DEMO'}};
 assert.doesNotThrow(()=>assertManifestSample(scan,item,4));
 for(const s of [{...scan,sample:{...scan.sample,send_out_id:9}},{...scan,patient:{mrn:'OTHER'}},{...scan,item:{...scan.item,status:'PendingVerification'}}])assert.throws(()=>assertManifestSample(s,item,4));
 assert.notEqual(pendingSnapshot(pending[0]),pendingSnapshot({...pending[0],partner_id:7}));assert.notEqual(manifestItemSnapshot(item),manifestItemSnapshot({...item,result_entered_at:'2026-10-26T00:00:00Z'}));
});
test('result metadata and list bounds preserve required report context without local due-time arithmetic',()=>{
 assert.throws(()=>partnerReportFields('','',''),/reference/);assert.throws(()=>partnerReportFields('x'.repeat(101),'date',''));
 assert.deepEqual(partnerReportFields(' DEMO ','2026-10-26T00:00:00Z',' note '),{partner_report_ref:'DEMO',partner_reported_at:'2026-10-26T00:00:00Z',interpretation:'note'});
 for(const n of ['0','501','5x','1.5','1e2'])assert.throws(()=>sendOutLimit(n));assert.equal(sendOutLimit('500'),500);
});
test('permission and runtime views preserve history/print separately from result entry and existing work',()=>{
 const p=['lab.sendout.manage','lab.result.enter'];for(const view of ['full','open_work'])assert.deepEqual(sendOutAccess(p,view),{read:true,work:true,result:true,print:true});
 assert.deepEqual(sendOutAccess(p,'records'),{read:true,work:false,result:false,print:true});
 for(const view of ['hidden','setup','unknown',''])assert.deepEqual(sendOutAccess(p,view),{read:false,work:false,result:false,print:false});
 assert.equal(sendOutAccess(['lab.sendout.manage'],'full').result,false);assert.equal(sendOutAccess(['diagnostics.quality.view'],'full').work,false);assert.equal(sendOutAccess(['diagnostics.quality.view','lab.result.enter'],'full').result,true);
});
test('A4 manifest preserves actual identity/header/samples and courier signature lines; escapes untrusted text',()=>{
 const p={document_type:'send_out_manifest',printer_role:'document',fields:{send_out_id:4,manifest_number:'DEMO-M4',hospital:{name:'DEMO <script>',phc_number:'PHC-DEMO',issue_line:'Issued DEMO'},partner_name:'DEMO Partner',items:[{sample_id:5,barcode:'DEMO5',mrn:'DEMO',patient_name:'فرضی <img>',test_name:'DEMO vitamin',code:'DEMO',requisition_number:'DEMO-R'}]}};
 assert.throws(()=>assertSendOut(p,9),/identity/);assert.throws(()=>assertSendOut({...p,document_type:'lab_report'},4));
 const en=sendOutHtml(p,'font','en'),ur=sendOutHtml(p,'font','ur');for(const value of ['DEMO-M4','DEMO5','PHC-DEMO','Issued DEMO','Courier received / signature','size:A4'])assert(en.includes(value));assert(!en.includes('<script>'));assert(!en.includes('<p> · </p>'));assert(en.includes('PHC-DEMO · Issued DEMO'));const noIssue=sendOutHtml({...p,fields:{...p.fields,hospital:{...p.fields.hospital,issue_line:''}}},'font','en');assert(!noIssue.includes('PHC-DEMO ·'));assert(en.includes('&lt;script&gt;'));assert(ur.includes('dir="rtl"'));assert(ur.includes('وصولی / دستخط'));assert(ur.includes('@font-face'));assert(ur.includes('font-family:Urdu,Arial'));
});
