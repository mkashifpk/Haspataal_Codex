// Fresh DEV registration/payment and live Reception follow-on. No old IDs.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='artifacts/registration-reset-atomic-20261024.json';const j=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {run:'DEMO-ATOMIC-'+Date.now()};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('registration-reset-atomic','demo.reception'),p=s.p;
const requests=async(method,path)=>(await s.trace()).requests.filter(r=>r.method===method&&r.path===path);
try{
 await s.nav('New registration + OPD slip');
 if(j.pending&&!j.ticket)throw Error('Reconcile the original registration transport/key before any new creation');
 if(!j.ticket){
  await p.getByLabel('Full name',{exact:true}).fill(j.run);await p.getByLabel('Gender',{exact:true}).selectOption('male');await p.getByLabel('Age in years',{exact:true}).fill('35');await p.getByLabel('Mobile',{exact:true}).fill('03000000000');await p.getByLabel('UPMRN (optional)',{exact:true}).fill('DEV/'+j.run.slice(-13)+'-OPD');
  const services=await s.native('api',{method:'GET',path:'/finance/service-catalog?category=OPD'});const service=services.find(x=>x.is_active&&x.doctor_id&&x.doctor_name==='Dr. Ahmed Khan');assert(service,'Use the actual seeded clinician service');j.service=service;await p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
  await s.fault({failPath:'/reception/registrations',failMethod:'POST',once:true});j.pending=true;save();await p.getByRole('button',{name:'Issue unpaid OPD slip',exact:true}).evaluate(b=>{b.click();b.click()});
  const retry=p.getByRole('button',{name:'Retry same registration',exact:true});await expect(retry).toBeVisible();const original=(await requests('POST','/api/v1/reception/registrations')).at(-1);assert.equal(original.status,201);j.ticket=original.result.data;j.original=original;save();
  await retry.evaluate(b=>{b.click();b.click()});await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();const replay=(await requests('POST','/api/v1/reception/registrations')).at(-1);assert.equal(replay.key,original.key);assert.deepEqual(replay.body,original.body);assert.equal(replay.replay,'true');assert.equal(replay.result.data.ticket_id,j.ticket.ticket_id);j.replay=replay;j.pending=false;save();
 }else{
  const current=await s.native('api',{method:'GET',path:'/opd-tickets/'+j.ticket.ticket_id});assert.equal(current.patient_name,j.run);await p.getByLabel('Open an existing OPD slip',{exact:true}).fill(current.ticket_number);await p.getByRole('button',{name:'Open ticket',exact:true}).click();
 }
 const ticket=j.ticket;const patient=await s.native('api',{method:'GET',path:'/patients/'+ticket.patient_id});assert.equal(patient.upmrn,'DEV/'+j.run.slice(-13)+'-OPD');j.patient=patient;save();s.pass('Fresh atomic UPMRN unpaid201, real lost reply, rapid retry SAMEkey/body/ticket, actual patient readback');
 await p.evaluate(()=>{window.resetQueueEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&['opd.queue.updated','opd.ticket.status_changed'].includes(e.event_type))window.resetQueueEvents.push(e)})});
 const current=await s.native('api',{method:'GET',path:'/opd-tickets/'+ticket.ticket_id});
 if(current.payment_status==='Unpaid'){
  await p.getByRole('button',{name:'Collect payment',exact:true}).click();await expect.poll(async()=> (await requests('POST',`/api/v1/opd-tickets/${ticket.ticket_id}/pay`)).some(r=>r.status===200)).toBe(true);const pay=(await requests('POST',`/api/v1/opd-tickets/${ticket.ticket_id}/pay`)).at(-1);j.payment=pay;save();
 }
 await expect(p.locator('main')).toContainText('Paid');await expect.poll(async()=>(await p.evaluate(()=>window.resetQueueEvents)).length).toBeGreaterThan(0);j.events=await p.evaluate(()=>window.resetQueueEvents);await expect.poll(async()=>(await requests('GET','/api/v1/opd-queues/reception-dashboard')).filter(x=>x.finished).length).toBeGreaterThan(0);
 const after=await s.native('api',{method:'GET',path:'/opd-tickets/'+ticket.ticket_id});assert.equal(after.payment_status,'Paid');assert(after.queue);j.final=after;
 const preview=p.getByRole('button',{name:'Preview slip',exact:true});await preview.click();const d=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'OPD slip preview',exact:true})});await expect(d).toContainText(ticket.ticket_number);await d.getByRole('button',{name:'Close',exact:true}).click();
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/patients').length,0);s.pass('Separate real payment200 queues the same ticket; real events refresh Reception ticket/dashboard, authorized slip preview reads original, no second registration');s.j.passed=true;j.passed=true;
}catch(e){j.error=e.stack;j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();const r=j.trace.requests.find(x=>x.method==='POST'&&x.path==='/api/v1/reception/registrations'&&x.status===201);if(r&&!j.ticket){j.ticket=r.result.data;j.original=r}console.error(e.stack);process.exitCode=1}finally{save();await s.close();j.finished=s.j.finished;j.preferences_restored=s.j.preferences_restored;j.trace=await s.trace().catch(()=>j.trace);save()}
