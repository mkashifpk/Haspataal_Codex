import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const root='docs/backend-refresh-2026-10-30/dev/',read=n=>JSON.parse(fs.readFileSync(root+n+'-result.json')).body.data;
const closure=process.argv.includes('--closure');const visit=read(closure?'paid-opd-d':'paid-opd-ui'),file=closure?'artifacts/backend-refresh-opd-closure-ui.json':'artifacts/backend-refresh-opd-ui.json';assert(!fs.existsSync(file),'Reconcile prior OPD UI actions before rerunning');
const j={started:new Date().toISOString(),checks:[],intents:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));let doctor,receiving,reception;save();
const intent=action=>{j.intents.push({action,at:new Date().toISOString()});save();};
try{
 [doctor,receiving]=await Promise.all([session('refresh1030-opd-doctor','demo.doctor'),session('refresh1030-opd-doctor2','demo.doctor2')]);
 for(const s of [doctor,receiving]){s.p.on('dialog',d=>d.accept());await s.nav('My live queue');}
 const before=await doctor.native('api',{method:'GET',path:`/opd-tickets/${visit.ticket_id}`});j.before=before;save();
 const row=doctor.p.locator('.doctor-token').filter({hasText:visit.ticket_number});await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Call patient',exact:true}).click();intent('Call owned synthetic ticket '+visit.ticket_id+' once through queue UI');await doctor.p.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
 await row.getByRole('button',{name:'Open consultation',exact:true}).click();
 await expect(doctor.p.getByRole('button',{name:'Re-route / Refer',exact:true})).toBeEnabled();
 await doctor.p.getByRole('button',{name:'Re-route / Refer',exact:true}).click();
 const modal=doctor.p.getByRole('dialog');const target=(await receiving.native('state')).user.employee_id;
 await expect(modal.getByLabel('Doctor or department',{exact:true})).toContainText('Sara');
 await modal.getByLabel('Doctor or department',{exact:true}).selectOption('doctor:'+target);
 await modal.getByLabel('Reason',{exact:true}).fill('DEMO actual UI referral with original paid slip; no new money or real care');
 await help(doctor,modal.getByLabel('Reason',{exact:true}),'Consultation (EMR)');
 await modal.getByRole('button',{name:'Review re-route',exact:true}).click();
 intent('Re-route original called queue entry from Consultation Quick-Action Bar to returned OPD doctor');
 await capture(doctor,'consultation');await modal.getByRole('button',{name:'Confirm re-route',exact:true}).click();await expect(modal).toHaveCount(0);await expect(doctor.p.getByRole('heading',{name:'My live queue',exact:true})).toBeVisible();j.checks.push('Successful reroute closes consultation and returns to My live queue');save();
 await expect(receiving.p.locator('.doctor-token').filter({hasText:visit.ticket_number})).toBeVisible();
 const after=await doctor.native('api',{method:'GET',path:`/opd-tickets/${visit.ticket_id}`});j.after=after;
 assert.equal(after.ticket_number,before.ticket_number);assert.equal(after.invoice.invoice_id,before.invoice.invoice_id);assert.equal(after.invoice.amount_paid,before.invoice.amount_paid);assert.equal(after.doctor_id,target);
 const trace=await doctor.trace();const reroute=trace.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/reroute'));assert.equal(reroute.length,1);assert(reroute[0].path.includes('/'+before.queue.queue_id+'/'));assert(!trace.requests.some(r=>r.method!=='GET'&&/payment|refund|registrations/.test(r.path)));
 j.checks.push('Consultation re-routes actual called queue entry once, new picker source used, same slip/invoice/payment, receiving queue updates live');save();
 await capture(receiving,'doctor_queue');
 await doctor.close();doctor=undefined;await receiving.close();receiving=undefined;
 if(closure){j.passed=true;save();process.exitCode=0;}else{reception=await session('refresh1030-opd-reception','demo.reception');reception.p.on('dialog',d=>d.accept());await reception.nav('New registration');
 await reception.p.getByLabel('Full name',{exact:true}).fill('SCN-Codex-1030 SYNTHETIC UI REG G '+Date.now());
 await reception.p.getByLabel('Gender',{exact:true}).selectOption('female');await reception.p.getByLabel('Age in years',{exact:true}).fill('27');await reception.p.getByLabel('Mobile',{exact:true}).fill('0300-0000000');
 const services=read('opd-services');const service=services.find(s=>s.doctor_id===target);assert(service);
 await reception.p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
 await expect(reception.p.getByLabel('OPD doctor (or department queue)',{exact:true})).toContainText('Sara');
 await reception.p.getByLabel('OPD doctor (or department queue)',{exact:true}).selectOption(String(target));
 await help(reception,reception.p.getByLabel('OPD doctor (or department queue)',{exact:true}),'New registration + OPD slip');
 intent('Issue new synthetic unpaid slip with selected doctor returned by GET /opd-queues/doctors; no payment');
 await reception.p.getByRole('button',{name:'Issue unpaid OPD slip',exact:true}).click();
 await expect.poll(async()=>{const t=await reception.trace();return t.requests.some(r=>r.method==='POST'&&r.path.endsWith('/reception/registrations')&&r.status===201);}).toBe(true);
 const rt=await reception.trace(),created=rt.requests.find(r=>r.method==='POST'&&r.path.endsWith('/reception/registrations'));assert.equal(created.body.doctor_id,target);assert(rt.requests.some(r=>r.path.includes('/opd-queues/doctors')&&r.status===200));j.registration=created.result.data;
 j.checks.push('Registration creates fresh unpaid synthetic visit from current OPD doctor picker; doctor_id bound to returned employee');save();
 await capture(reception,'registration');await reception.close();reception=undefined;j.passed=true;save();}
}catch(e){j.error=e.stack;for(const [name,s]of Object.entries({doctor,receiving,reception}))if(s){try{j[name+'_ui']=await s.p.locator('body').innerText();j[name+'_trace']=await s.trace();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of [doctor,receiving,reception])if(s)await s.close();j.finished=new Date().toISOString();save();}
