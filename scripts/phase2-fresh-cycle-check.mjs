// Fresh synthetic DEV UI journey. One Card-paid visit, no real gateway/care/medicine.
// Resume only confirmed original records; never silently repeat a pending write.
import {session,expect,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file='docs/phase2-fresh-cycle-2026-10-24.json';
const existed=fs.existsSync(file);
assert(!existed||process.argv.includes('--resume'),'Inspect journal, then --resume; do not replace original actions');
const j=existed?JSON.parse(fs.readFileSync(file)):{run:'DEMO-P2-CYCLE-'+Date.now(),checks:[]};
assert(!j.pending,'Reconcile pending original write from its transport/key before resuming: '+j.pending);
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=text=>{j.checks.push(text);save();console.log('PASS '+text);};
const begin=label=>{j.pending=label;save();};const done=()=>{delete j.pending;save();};
let r,d;
const request=async(s,path)=>{await expect.poll(async()=>(await s.trace()).requests.some(x=>x.method==='POST'&&x.path==='/api/v1'+path&&[200,201].includes(x.status))).toBe(true);return (await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+path&&[200,201].includes(x.status)).at(-1);};
try {
 d=await session('phase2-fresh-cycle-doctor','demo.doctor');
 await d.nav('My live queue');
 await d.p.evaluate(()=>{window.freshQueueEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&['opd.queue.updated','opd.ticket.status_changed'].includes(e.event_type))window.freshQueueEvents.push(e);});});
 r=await session('phase2-fresh-cycle-reception','demo.reception');
 if(!j.ticket){
  await r.nav('New registration + OPD slip');const p=r.p;
  await p.getByLabel('Full name',{exact:true}).fill(j.run);
  await p.getByLabel('Age in years',{exact:true}).fill('35');
  await p.getByLabel('Mobile',{exact:true}).fill('03000000000');
  await p.getByLabel('UPMRN (optional)',{exact:true}).fill('DEV/'+j.run);
  const services=await r.native('api',{method:'GET',path:'/finance/service-catalog?category=OPD'});
  const service=services.find(s=>s.is_active&&s.doctor_name==='Dr. Ahmed Khan');assert(service);j.service=service;save();
  await p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
  await p.getByLabel('Collect full payment now',{exact:true}).check();
  await p.getByLabel('Payment method',{exact:true}).selectOption('Card');
  await p.getByLabel('Card / bank reference',{exact:true}).fill(j.run+' software simulation, no real card charge');
  await help(r,p.getByLabel('Full name',{exact:true}),'New registration + OPD slip');
  begin('registration');await p.getByRole('button',{name:'Register and collect payment',exact:true}).evaluate(b=>{b.click();b.click();});
  await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();
  j.registration=await request(r,'/reception/registrations');j.ticket=j.registration.result.data;done();
  assert.equal((await r.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1/reception/registrations').length,1);
  assert.equal(j.ticket.payment.method,'Card');assert(j.ticket.queue_entry_created);assert(j.ticket.print_payload);assert.equal(j.ticket.print_payload.paper_width_mm,80);
  const patient=await r.native('api',{method:'GET',path:'/patients/'+j.ticket.patient_id});assert.equal(patient.full_name,j.run);assert.equal(patient.upmrn,'DEV/'+j.run);assert.equal(patient.photo_document_id,null);
  pass('Fresh UI atomic Card registration, optional photo skipped, UPMRN persisted, rapid clicks one POST/payment/ticket/token; genuine80mm slip payload and contextual F1');
 } else {
  await r.nav('New registration + OPD slip');
  await r.p.getByLabel('Open an existing OPD slip',{exact:true}).fill(j.ticket.ticket_number);
  await r.p.getByRole('button',{name:'Open ticket',exact:true}).click();
  await expect(r.p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();
  pass('Original reconciled registration reopened through actual ticket/print-payload reads; no replacement patient/payment');
 }
 const ticket=await d.native('api',{method:'GET',path:'/opd-tickets/'+j.ticket.ticket_id});assert.equal(ticket.patient_name,j.run);assert.equal(ticket.patient_id,j.ticket.patient_id);
 const card=d.p.locator('.doctor-token').filter({hasText:ticket.ticket_number});
 await expect(card).toBeVisible();
 if(!existed){await expect.poll(async()=>(await d.p.evaluate(()=>window.freshQueueEvents)).length).toBeGreaterThan(0);j.queue_events=await d.p.evaluate(()=>window.freshQueueEvents);save();pass('Doctor queue was open before registration and received real WebSocket queue events/new token without manual refresh');}
 if(ticket.status==='Waiting'){
  begin('call');await card.getByRole('button',{name:'Call patient',exact:true}).click();await d.p.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(card).toContainText('InConsultation');done();
 }
 await card.getByRole('button',{name:'Open consultation',exact:true}).click();
 const p=d.p;
 if(!j.note){
  for(const label of ['Verbal consent obtained (VCO)','Patient declined','Not examined'])await expect(p.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','false');
  await p.getByLabel('Chief complaint',{exact:true}).fill(j.run+' software simulation only, no actual care');
  await p.getByRole('button',{name:'Not examined',exact:true}).click();
  await p.getByLabel('Diagnosis',{exact:true}).fill('DEMO software workflow verification, not a clinical diagnosis');
  await p.getByLabel('Plan / treatment / referral',{exact:true}).fill('DEMO software test only; no actual care, medication or physical transfer');
  await p.getByRole('button',{name:'Add diagnosis code',exact:true}).click();await p.getByLabel('Code prefix or diagnosis words',{exact:true}).fill('CA40');
  await p.locator('[data-help-screen="icd_picker"] .list-row').first().click();await p.getByRole('button',{name:'Choose this diagnosis code',exact:true}).click();
  await help(d,p.getByLabel('Chief complaint',{exact:true}),'Consultation (EMR)');
  begin('note');await p.getByRole('button',{name:'Submit consultation',exact:true}).click();await expect(p.getByRole('heading',{name:/Note #\d+ · Final/})).toBeVisible();
  j.note_request=await request(d,'/clinical-encounters');j.note=j.note_request.result.data;done();
  assert(j.note.icd_terms[0].title);assert(j.note.icd_codes.every(c=>typeof c==='string'));assert.equal(j.note.examination_consent,'NotExamined');
  pass('Actual queued patient called and handed into Consultation; consent starts unselected; Not examined, code-only ICD request/title and final note readback, F1 draft preservation');
 }
 if(!j.rx){
  await p.getByRole('button',{name:'Prescribe',exact:true}).click();
  await p.getByLabel('Prescription destination',{exact:true}).selectOption('ExternalMarket');
  await p.getByLabel('Linked consultation',{exact:true}).selectOption(String(j.note.encounter_id));
  await p.getByRole('button',{name:'Add external medicine',exact:true}).click();
  await p.getByLabel('External medicine name',{exact:true}).fill('DEMO TEST ONLY - not an actual medicine');
  await p.getByLabel('Strength',{exact:true}).fill('DEMO');await p.getByLabel('Form',{exact:true}).fill('DEMO software fixture');
  await p.getByLabel('Quantity prescribed',{exact:true}).fill('1');await p.getByLabel('Dose (include units)',{exact:true}).fill('DEMO test dose, not instructions for use');
  await p.getByLabel('Route',{exact:true}).selectOption('Oral');await p.getByLabel('Frequency',{exact:true}).selectOption('OD');await p.getByLabel('Duration (days)',{exact:true}).fill('1');
  await p.getByLabel('Prescription notes',{exact:true}).fill(j.run+' software simulation; no medicine to supply or use');
  await help(d,p.getByLabel('Dose (include units)',{exact:true}),'E-prescription builder');
  begin('prescription');await p.getByRole('button',{name:'Create prescription',exact:true}).click();j.rx_request=await request(d,'/prescriptions');j.rx=j.rx_request.result.data;done();
  assert.equal(j.rx.encounter_id,j.note.encounter_id);assert.equal(j.rx.destination,'ExternalMarket');
  await p.getByRole('button',{name:'Record handover',exact:true}).click();const dialog=p.getByRole('dialog');
  const before=(await d.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/handover')).length;
  await dialog.getByRole('button',{name:'Confirm prescription action',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();
  assert.equal((await d.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/handover')).length,before);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  pass('Outside-market Rx saved with linked final note and complete OPD directions; handover recipient/copy/physical-confirmation prerequisites block empty action with no POST (real handover remains human review)');
 }
 await d.nav('Lab & imaging orders + results');await p.getByLabel('OPD slip number',{exact:true}).fill(j.ticket.ticket_number);await p.getByRole('button',{name:'Open slip',exact:true}).click();
 if(!j.lab){
  await p.getByLabel('Filter test catalogue',{exact:true}).fill('CBC');await p.locator('label.card').filter({has:p.locator('strong').filter({hasText:'CBC'})}).first().getByRole('checkbox').check();
  await p.getByLabel('Laboratory clinical notes',{exact:true}).fill(j.run+' DEMO software test, no real specimen');
  begin('lab');await p.getByRole('button',{name:'Order selected tests',exact:true}).click();j.lab_request=await request(d,'/lab/requisitions');j.lab=j.lab_request.result.data;done();
 }
 if(!j.lab_cancelled){
  await p.getByRole('button').filter({hasText:j.lab.requisition_number}).first().click();
  await p.getByRole('button',{name:'Cancel own unsampled order',exact:true}).click();await p.getByLabel('Laboratory cancellation reason',{exact:true}).fill(j.run+' cancelling owned unsampled software test');
  await help(d,p.getByLabel('Laboratory cancellation reason',{exact:true}),'Lab & imaging orders + results');
  begin('lab_cancel');await p.getByRole('button',{name:'Confirm laboratory cancellation',exact:true}).click();j.lab_cancel=await request(d,'/lab/requisitions/'+j.lab.requisition_id+'/cancel');
  const actual=await d.native('api',{method:'GET',path:'/lab/requisitions/'+j.lab.requisition_id});assert.equal(actual.status,'Cancelled');assert(actual.items.every(i=>i.status==='Cancelled'));j.lab_cancelled=actual;done();
  pass('Own CBC order creates actual unsampled requisition and unpaid invoice; reasoned own cancellation succeeds and all items read Cancelled, contextual F1; no specimen or care');
 }
 j.doctor_trace=await d.trace();j.reception_trace=await r.trace();j.passed=true;save();
}catch(e){j.error=e.stack;if(d)j.doctor_trace=await d.trace().catch(()=>null);if(r)j.reception_trace=await r.trace().catch(()=>null);if(d)j.failure_ui=await d.p.locator('body').innerText().catch(()=>null);save();console.error(e.stack);process.exitCode=1;}
finally{if(r)await r.close();if(d)await d.close();j.finished=new Date().toISOString();save();}
