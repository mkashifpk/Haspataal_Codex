# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV: two NEW Card-paid UI registrations and clinician handovers. No physical care/cash.
// Durable result stores original bodies/keys; --resume only reuses the original cases.
import { session, expect, help } from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file='docs/phase2-handover-check-2026-10-24.json';
const resume=process.argv.includes('--resume');
assert(resume || !fs.existsSync(file),'Existing fixture: reconcile and --resume; never create replacements');
const j=resume?JSON.parse(fs.readFileSync(file)): {run:'DEMO-P2-HANDOVERS-'+Date.now(),cases:{},checks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=t=>{j.checks.push(t);save();console.log('PASS '+t)};
let s;
async function selectTicket(ticket){
 await s.nav('Consultation (EMR)');
 await s.p.getByLabel('Scan OPD ticket barcode',{exact:true}).fill(ticket.ticket_number);
 await s.p.getByLabel('Scan OPD ticket barcode',{exact:true}).press('Enter');
 await expect(s.p.getByRole('button',{name:'New note',exact:true})).toBeVisible();
}
try {
 s=await session('phase2-handover-reception','demo.reception');
 const services=await s.native('api',{method:'GET',path:'/finance/service-catalog?category=OPD'});
 const service=services.find(x=>x.is_active && x.doctor_name==='Dr. Ahmed Khan');assert(service);
 for(const kind of ['admission','waiver']){
  let c=j.cases[kind];
  if(c?.registration){
   const actual=await s.native('api',{method:'GET',path:`/opd-tickets/${c.registration.data.ticket_id}`});
   assert.equal(actual.patient_id,c.registration.data.patient_id);continue;
  }
  assert(!c?.registration_pending,'Original registration may have committed: inspect reception trace and original key before resuming');
  c=j.cases[kind]={name:j.run+' '+kind};save();
  await s.nav('New registration + OPD slip');
  const again=s.p.getByRole('button',{name:'Start another registration',exact:true});if(await again.count())await again.click();
  await s.p.getByLabel('Full name',{exact:true}).fill(c.name);
  await s.p.getByLabel('Age in years',{exact:true}).fill('32');
  await s.p.getByLabel('Mobile',{exact:true}).fill('03000000000');
  await s.p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
  await s.p.getByLabel('Collect full payment now',{exact:true}).check();
  await s.p.getByLabel('Payment method',{exact:true}).selectOption('Card');
  await s.p.getByLabel('Card / bank reference',{exact:true}).fill(c.name+' simulation');
  c.registration_pending=true;save();
  await s.p.getByRole('button',{name:'Register and collect payment',exact:true}).click();
  await expect(s.p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();
  const req=(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1/reception/registrations').at(-1);
  assert.equal(req.status,201);c.registration=req.result;c.registration_key=req.key;c.registration_body=req.body;c.registration_pending=false;save();
 }
 pass('Two new synthetic registrations through Reception UI, each Card paid once, photo optional; original identifiers/keys saved');
 await s.close();s=null;
 s=await session('phase2-handover-doctor','demo.doctor');
 const p=s.p,modal=()=>p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Confirm clinical action',exact:true})});
 for(const kind of ['admission','waiver']){
  const c=j.cases[kind],id=c.registration.data.ticket_id;
  const ticket=await s.native('api',{method:'GET',path:`/opd-tickets/${id}`});
  assert.equal(ticket.patient_name,c.name);
  await s.nav('My live queue');
  const card=p.locator('.doctor-token').filter({hasText:ticket.ticket_number});
  if(ticket.status==='Waiting'){
   await card.getByRole('button',{name:'Call patient',exact:true}).click();
   await p.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
   await expect(card).toContainText('InConsultation');
  }
  await card.getByRole('button',{name:'Open consultation',exact:true}).click();
  await expect(p.locator('main h1')).toHaveText('Consultation (EMR)');
  let notes=await s.native('api',{method:'GET',path:`/opd-tickets/${id}/clinical-encounters`});
  if(!notes.length){
   await p.getByLabel('Chief complaint',{exact:true}).fill(c.name+' software simulation, no actual examination');
   await p.getByRole('button',{name:'Not examined',exact:true}).click();
   await p.getByLabel('Diagnosis',{exact:true}).fill('DEV software verification only');
   await p.getByLabel('Plan / treatment / referral',{exact:true}).fill('No actual care or medication; demonstrate software handover only');
   await p.getByRole('button',{name:'Add diagnosis code',exact:true}).click();
   await p.getByLabel('Code prefix or diagnosis words',{exact:true}).fill('CA40');
   await p.locator('[data-help-screen="icd_picker"] .list-row').first().click();
   await p.getByRole('button',{name:'Choose this diagnosis code',exact:true}).click();
   await p.getByRole('button',{name:'Submit consultation',exact:true}).click();
   await expect(p.getByRole('heading',{name:/Note #\d+ · Final/})).toBeVisible();
   notes=await s.native('api',{method:'GET',path:`/opd-tickets/${id}/clinical-encounters`});
  } else {
   assert.equal(notes.length,1);assert.equal(notes[0].status,'Final');
   await p.getByRole('button').filter({hasText:`#${notes[0].encounter_id} ·`}).first().click();
  }
  assert.equal(notes.length,1);c.note=notes[0];save();
  assert(notes[0].icd_terms[0].title);assert(notes[0].icd_codes.every(x=>typeof x==='string'));
  await expect(p.locator('main')).toContainText(notes[0].icd_terms[0].title);
  const noteReq=(await s.trace()).requests.find(x=>x.method==='POST'&&x.path==='/api/v1/clinical-encounters'&&x.body.patient_id===ticket.patient_id);
  if(noteReq){assert(noteReq.body.icd_codes.every(x=>typeof x==='string'));assert.equal(noteReq.body.icd_terms,undefined);c.note_request=noteReq;save();}
  if(c.handover_pending && !c.handover)throw new Error('Reconcile original handover trace/key before resuming; no automatic replacement');
  if(c.handover){pass(kind+' original confirmed handover re-read; no replacement');continue;}
  await p.getByRole('button',{name:kind==='admission'?'Admit':'Convert to VIP waiver',exact:true}).click();
  if(kind==='admission'){
   await expect(modal().getByLabel('Admission reason',{exact:true})).toHaveValue(notes[0].chief_complaint);
   await expect(modal().getByLabel('Provisional diagnosis',{exact:true})).toHaveValue(notes[0].diagnosis);
   await modal().getByLabel('Admission reason',{exact:true}).fill('');
   await modal().getByRole('button',{name:'Confirm clinical action',exact:true}).click();
   await expect(modal()).toContainText('admission reason and provisional diagnosis are required');
   await modal().getByLabel('Admission reason',{exact:true}).fill(c.name+' TEST ONLY no physical admission');
   await modal().getByLabel('Vitals interval (minutes, optional)',{exact:true}).fill('60');
  }else{
   await modal().getByRole('button',{name:'Confirm clinical action',exact:true}).click();
   await expect(modal()).toContainText('waiver reason are required');
   await modal().getByLabel('Reason',{exact:true}).fill(c.name+' TEST ONLY no actual cash handover');
  }
  await help(s,modal().getByRole('button',{name:'Confirm clinical action',exact:true}),'Consultation (EMR)');
  const target=kind==='admission'?'/admissions':`/opd-tickets/${id}/vip-waiver-post-consult`;
  await s.fault({failPath:target,failMethod:'POST',once:true});
  c.handover_pending=true;save();
  await modal().getByRole('button',{name:'Confirm clinical action',exact:true}).evaluate(b=>{b.click();b.click()});
  const retry=modal().getByRole('button',{name:'Retry original request',exact:true});await expect(retry).toBeVisible();
  let reqs=(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+target);
  assert.equal(reqs.length,1);assert.equal(reqs[0].status,201);c.original_handover=reqs[0];save();
  await retry.evaluate(b=>{b.click();b.click()});
  await expect(modal()).toHaveCount(0);
  await expect(p.getByRole('heading',{name:kind==='admission'?'Admission request recorded':'Waiver request recorded',exact:true})).toBeVisible();
  reqs=(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+target);
  assert.equal(reqs.length,2);assert.equal(reqs[1].key,reqs[0].key);assert.deepEqual(reqs[0].body,reqs[1].body);assert.equal(reqs[1].replay,'true');
  c.handover=reqs[1].result.data;c.handover_pending=false;save();
  if(kind==='admission'){assert.equal(c.handover.status,'AdmissionPending');assert.equal(c.handover.bed_id,null);await expect(p.locator('main')).toContainText(c.handover.admission_number);}
  else {assert.equal(c.handover.approval.status,'Pending');assert.equal(c.handover.ticket.approval_lock,'WaiverPending');await expect(p.getByRole('button',{name:'Convert to VIP waiver',exact:true})).toBeDisabled();}
  pass(kind+' real201/lost reply/rapid submit/same-key replay: one saved handover, actual result/next step visible; validation and F1 keep draft');
 }
 j.doctor_trace=await s.trace();j.passed=true;save();
 pass('Code-only diagnosis requests persist actual code+title terms on reload in both new consultations');
}catch(e){j.error=e.stack;save();console.error(e.stack);if(s){try{j.failure_ui=await s.p.locator('body').innerText();j.trace=await s.trace();save()}catch{}}process.exitCode=1}
finally{if(s)await s.close();j.finished=new Date().toISOString();save()}

```
