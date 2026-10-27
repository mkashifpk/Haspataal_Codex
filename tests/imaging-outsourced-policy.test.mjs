import {hospitalTimeToUtc} from '../src/hospital-time.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {outsourcedAccess,imagingPartnerEligible,outsourceAllowed,outsourceBody,externalReportBody,outsourcedSnapshot,partnerSnapshot} from '../src/imaging-outsourced-policy.ts';
const p={partner_id:8,name:'DEMO',services:'Imaging',is_active:true,mou_expired:false,row_version:1};
test('outsourcing preserves server partner validity/service, never infers expiry from terminal time',()=>{
 assert(imagingPartnerEligible(p));assert(imagingPartnerEligible({...p,services:'Both'}));
 for(const c of [{services:'Lab'},{is_active:false},{mou_expired:true}])assert(!imagingPartnerEligible({...p,...c}));
 assert(!imagingPartnerEligible(undefined));assert(outsourceAllowed('Ordered'));assert(outsourceAllowed('Scheduled'));
 for(const s of ['InProgress','Completed','Outsourced','Reported','Cancelled'])assert(!outsourceAllowed(s));
 assert.throws(()=>outsourceBody(p,'',false),/Check the patient/);assert.throws(()=>outsourceBody({...p,mou_expired:true},'',true),/valid MOU/);assert.throws(()=>outsourceBody(p,'a'.repeat(501),true),/500/);assert.deepEqual(outsourceBody(p,' note ',true),{partner_id:8,note:'note'});
});
test('partner reports require matched source, actual reporter, bounded text and optional hospital timezone conversion',()=>{
 assert.throws(()=>externalReportBody('normal','DEMO PMDC','','','',false),/Match the partner/);
 for(const [report,reporter] of [['no','DEMO'],['x'.repeat(20001),'DEMO'],['normal','x'],['normal','x'.repeat(201)]])assert.throws(()=>externalReportBody(report,reporter,'','','',true));
 assert.throws(()=>externalReportBody('normal','DEMO',undefined||'','1e2','',true),/actual critical/);
 assert.throws(()=>externalReportBody('normal','DEMO','','','a'.repeat(1001),true),/1000/);
 const b=externalReportBody(' normal ',' DEMO PMDC ',hospitalTimeToUtc('2026-10-27T10:00','Asia/Karachi'),'2',' synthetic ',true);assert.equal(b.reported_at,'2026-10-27T05:00:00.000Z');assert.equal(b.critical_finding_id,2);assert.equal(b.critical_finding_note,'synthetic');
 assert(!('reported_at'in externalReportBody('normal','DEMO','','','',true)));
 assert.throws(()=>externalReportBody('normal','DEMO',hospitalTimeToUtc('2026-02-30T10:00','Asia/Karachi'),'','',true));
});
test('service views and permissions keep retirement work and records distinct',()=>{
 const perms=['imaging.order.update','imaging.order.view'];for(const v of ['full','open_work'])assert(outsourcedAccess(v,perms).write);
 assert.deepEqual(outsourcedAccess('records',perms),{visible:true,read:true,list:false,write:false});
 for(const v of ['setup','hidden',undefined,'bad'])assert(!outsourcedAccess(v,perms).visible);
 assert(!outsourcedAccess('full',['imaging.order.view']).write);
});
test('review binds the original order/patient/version/final report and entire partner agreement',()=>{
 const o={imaging_order_id:2,patient_id:3,mrn:'DEMO',patient_name:'DEMO',row_version:1,status:'Ordered',partner_id:null};
 for(const c of [{patient_id:4},{imaging_order_id:3},{row_version:2},{status:'Outsourced'},{partner_id:9},{report_text:'Final'}])assert.notEqual(outsourcedSnapshot(o),outsourcedSnapshot({...o,...c}));
 assert.notEqual(partnerSnapshot(p),partnerSnapshot({...p,row_version:2}));assert.notEqual(partnerSnapshot(p),partnerSnapshot({...p,mou_valid_until:'2027-01-01'}));
});
