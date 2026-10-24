// New synthetic paid visit/refund10; approved cash stays UND​​ISPENSED. No physical handover claim.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-refund-event-check-2026-10-24.json',control='docs/phase2-refund-event-controller-2026-10-24.json';
const resume=process.argv.includes('--resume');assert(resume || !fs.existsSync(file),'Reconcile original fixture; never repeat the registration/payment/refund');
const j=resume?JSON.parse(fs.readFileSync(file)):{run:'DEMO-P2-REFUND-EVENT-'+Date.now(),checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
if(resume)assert(j.registration && !j.registration_pending && !j.refund_pending,'Reconcile original uncertain writes before resuming');
const s=await session('phase2-refund-event-check','demo.reception'),p=s.p;
try{
 await p.evaluate(()=>{window.refundEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.refundEvents.push(e)})});
 if(!resume){
 await s.nav('New registration + OPD slip');await p.getByLabel('Full name',{exact:true}).fill(j.run);await p.getByLabel('Age in years',{exact:true}).fill('35');await p.getByLabel('Mobile',{exact:true}).fill('03000000000');
 const catalog=await s.native('api',{method:'GET',path:'/finance/service-catalog?category=OPD'}),service=catalog.find(x=>x.is_active&&x.doctor_name==='Dr. Ahmed Khan');assert(service);
 await p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));await p.getByLabel('Collect full payment now',{exact:true}).check();await p.getByLabel('Payment method',{exact:true}).selectOption('Card');await p.getByLabel('Card / bank reference',{exact:true}).fill(j.run+' simulation');
 j.registration_pending=true;save();await p.getByRole('button',{name:'Register and collect payment',exact:true}).click();await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();
 j.registration=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path==='/api/v1/reception/registrations');assert.equal(j.registration.status,201);j.registration_pending=false;j.ticket_id=j.registration.result.data.ticket_id;save();
 }
 await s.nav('Refund / waiver / credit');await p.getByLabel('OPD slip number',{exact:true}).fill(j.registration.result.data.ticket_number);await p.getByRole('button',{name:'Open slip',exact:true}).click();
 if(!j.refund){
 await p.getByLabel('Request type',{exact:true}).selectOption('refund-request');await p.getByLabel('Reason',{exact:true}).fill(j.run+' DEV software test only, no cash handover');await p.getByLabel('Refund amount',{exact:true}).fill('10');
 await p.getByRole('button',{name:'Review request',exact:true}).click();await help(s,p.getByRole('dialog').getByRole('button',{name:'Confirm request',exact:true}),'Refund / waiver / credit requests');
 j.refund_pending=true;save();await p.getByRole('dialog').getByRole('button',{name:'Confirm request',exact:true}).click();
 await expect(p.getByRole('dialog')).toHaveCount(0);
 await expect(p.locator('main')).toContainText('RefundPending');
 j.refund=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path.endsWith('/refund-request'));assert.equal(j.refund.status,201);j.approval_id=j.refund.result.data.approval.request_id;j.refund_pending=false;j.waiting_for='approved';save();console.log('WAIT approval '+j.approval_id+' ticket '+j.ticket_id);
 }
 for(let n=0;n<450;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).approved)break;if(n===449)throw Error('Waiting for actual Owner approval timed out');await new Promise(r=>setTimeout(r,2000));}
 await expect(p.getByRole('heading',{name:'Mandatory cash-back',exact:true})).toBeVisible();
 const modal=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Mandatory cash-back',exact:true})});
 await expect(modal).toContainText('10');await expect(modal.getByRole('button',{name:'Confirm cash handed back',exact:true})).toBeDisabled();
 await p.keyboard.press('Escape');await expect(modal).toBeVisible();
 j.events=await p.evaluate(()=>window.refundEvents);const event=j.events.find(e=>e.event_type==='refund.ready'&&e.payload.ticket_id===j.ticket_id);assert(event,'Actual new refund.ready must arrive');assert.equal(typeof event.payload.amount,'number');assert.equal(event.payload.amount,10);
 const ticket=await s.native('api',{method:'GET',path:`/opd-tickets/${j.ticket_id}`});assert.equal(ticket.status,'Refunded');assert.equal(ticket.cash_back_prompts[0].amount,10);j.final_ticket=ticket;
 assert.equal((await s.trace()).requests.filter(r=>r.path.includes('confirm-dispensation')).length,0);
 j.trace=await s.trace();j.passed=true;j.checks.push('New real refund.ready amount is number10 after deployed backend14 fix; current ticket reread, blocking exact10 prompt/Escape/no acknowledgement; cash remains undispensed');save();console.log('PASS '+j.checks.at(-1));
}catch(e){j.error=e.stack;j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}
finally{await s.close();j.finished=new Date().toISOString();save()}
