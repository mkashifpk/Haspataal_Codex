# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// One actual labelled synthetic outside attachment to existing patient21; no registration/payment.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-outside-document-check-2026-10-24.json',resume=process.argv.includes('--resume-rejected');assert(resume||!fs.existsSync(file),'Reconcile original document upload before repeating');
const j=resume?JSON.parse(fs.readFileSync(file)):{patient_id:21,run:'DEMO-OUTSIDE-DOCUMENT-'+Date.now()},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));if(resume)assert(j.refused_upload?.status===422&&!j.upload_pending&&!j.document_id,'Only a confirmed refused upload may resume');save();
let s=await session('phase2-outside-document-reception','demo.reception');
try{
 const p=s.p;await s.nav('Patient document vault');await p.getByLabel('Patient name, mobile, CNIC or MRN',{exact:true}).fill('MRN-2026-000018');await p.getByRole('button',{name:'Search',exact:true}).click();await p.getByRole('button').filter({hasText:'MRN-2026-000018 · DEMO-P2-HANDOVERS-'}).click();
 await expect(p.getByRole('heading',{name:'Stored patient documents',exact:true})).toBeVisible();
 assert.equal((await s.trace()).requests.filter(r=>r.path.includes('/download')).length,0);
 const existing=await s.native('api',{method:'GET',path:'/patients/21/documents'});assert(!existing.some(d=>d.title===j.run),'Reconcile original saved attachment instead of uploading again');
 const png=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=250;c.height=70;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,250,70);x.fillStyle='#000';x.font='14px sans-serif';x.fillText('DEMO external attachment',10,28);x.fillText('Software test - no clinical report',10,52);return c.toDataURL('image/png').split(',')[1]}),'base64');
 await p.getByLabel('Choose outside reports',{exact:true}).setInputFiles({name:'DEMO-outside-fixture.png',mimeType:'image/png',buffer:png});
 const draft=p.getByText('DEMO-outside-fixture.png',{exact:true}).locator('..');
 await draft.getByRole('button',{name:'Upload report',exact:true}).click();await expect(draft).toContainText('Enter report title, issuing facility and the date on the document.');
 assert.equal((await s.trace()).requests.filter(r=>r.method==='POST').length,0);
 await draft.getByLabel('Report title',{exact:true}).fill(j.run);await draft.getByLabel('Issued by facility',{exact:true}).fill('DEMO external facility software fixture');await draft.getByLabel('Document date',{exact:true}).fill('2026-10-24');
 await help(s,draft.getByLabel('Report title',{exact:true}),'Patient document vault');
 j.upload_pending=true;save();await draft.getByRole('button',{name:'Upload report',exact:true}).click();await expect(draft.getByRole('button',{name:'Report uploaded',exact:true})).toBeVisible();
 j.upload=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path==='/api/v1/patients/21/documents');assert.equal(j.upload.status,201);j.document_id=j.upload.result.data.document_id;j.upload_pending=false;save();
 const docs=await s.native('api',{method:'GET',path:'/patients/21/documents'}),doc=docs.find(d=>d.document_id===j.document_id);assert(doc);assert.equal(doc.is_outside,true);assert.equal(doc.source_facility,'DEMO external facility software fixture');assert.equal(doc.document_date,'2026-10-24');j.document=doc;save();
 await expect(p.locator('main')).toContainText('Outside: DEMO external facility software fixture, 2026-10-24');
 assert.equal((await s.trace()).requests.filter(r=>r.path.includes('/download')).length,0);
 await p.getByRole('button',{name:j.run+' · #'+j.document_id,exact:true}).click();await expect(p.getByRole('dialog').getByRole('img',{name:'Patient document',exact:true})).toBeVisible();await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 j.reception_trace=await s.trace();assert(j.reception_trace.requests.some(r=>r.path===`/api/v1/patient-documents/${j.document_id}/download`&&r.status===200));save();s.pass('Missing outside metadata ZEROPOST; one separate real upload201, actual Outside/facility/date label; ZERO downloads until explicit open, then actual200');
 await s.close();s=null;s=await session('phase2-outside-document-doctor','demo.doctor');const q=s.p;
 await s.nav('Consultation (EMR)');await q.getByLabel('OPD slip number',{exact:true}).fill('OPD-2026-000015');await q.getByRole('button',{name:'Open slip',exact:true}).click();
 await q.getByText('Patient documents / outside reports',{exact:true}).click();await expect(q.getByRole('button',{name:j.run,exact:true})).toBeVisible();await expect(q.locator('main')).toContainText('Outside document — not a hospital result');
 assert.equal((await s.trace()).requests.filter(r=>r.path.includes('/download')).length,0);await q.getByRole('button',{name:j.run,exact:true}).click();await expect(q.getByRole('dialog').getByRole('img',{name:'Patient document',exact:true})).toBeVisible();
 j.doctor_trace=await s.trace();assert(j.doctor_trace.requests.some(r=>r.path==='/api/v1/patients/21/documents'&&r.status===200));assert(j.doctor_trace.requests.some(r=>r.path===`/api/v1/patient-documents/${j.document_id}/download`&&r.status===200));assert.equal(j.doctor_trace.requests.filter(r=>r.method!=='GET').length,0);
 const results=await s.native('api',{method:'GET',path:'/lab/patients/21/results'});assert(results.every(r=>r.interpretation!==j.run));j.passed=true;save();s.pass('Consultation real document list/download200 only on explicit request, Outside label retained and not reclassified as hospital result; ZERO clinician businessPOST');
}catch(e){j.error=e.stack;if(s){j.trace=await s.trace();j.failure_ui=await s.p.locator('body').innerText()}save();console.error(e.stack);process.exitCode=1}finally{if(s)await s.close();j.finished=new Date().toISOString();save()}

```
