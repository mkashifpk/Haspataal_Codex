# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Existing synthetic settled-credit ticket only. Two deliberate UI re-routes restore original doctor.
import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect,help,capture} from './clinical-test-kit.mjs';
const file='docs/doctor-reroute-reason-evidence-2026-10-24.json';assert(!fs.existsSync(file),'Reconcile original queue/receipts before any repeat');
const j={run:'DEMO-QUEUE-REASON-'+Date.now(),checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let a,b;
const posts=async s=>(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/reroute'));
try{
 a=await session('doctor-reroute-source','demo.doctor');b=await session('doctor-reroute-destination','demo.doctor2');
 const original=await a.native('api',{method:'GET',path:'/opd-tickets/5'});assert.equal(original.patient_name,'DEMO-AR-EMERGENCY-1792861877963');assert.equal(original.status,'Waiting');assert(original.queue);assert.equal(original.approval_lock,'None');j.original=original;
 const source=(await a.native('state')).user.employee_id,target=(await b.native('state')).user.employee_id;assert.equal(source,original.doctor_id);assert(target&&target!==source);save();
 for(const s of [a,b]){await s.nav('My live queue');await s.p.evaluate(()=>{window.reasonEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&e.event_type==='opd.queue.updated')window.reasonEvents.push(e);});});}
 async function route(s,destination,reason,checkEmpty){const p=s.p,row=p.locator('.doctor-token').filter({hasText:original.ticket_number});await expect(row).toBeVisible();await row.getByRole('button',{name:'Re-route patient',exact:true}).click();const modal=p.getByRole('dialog');await modal.getByLabel('Destination',{exact:true}).selectOption('doctor:'+destination);
  if(checkEmpty){const count=(await posts(s)).length;await modal.getByRole('button',{name:'Confirm',exact:true}).click();await expect(modal.getByRole('alert')).toContainText('reason');assert.equal((await posts(s)).length,count);}
  await modal.getByLabel('Re-route reason (3–500 characters)',{exact:true}).fill(reason);await help(s,modal.getByLabel('Re-route reason (3–500 characters)',{exact:true}),'My live queue');
  j.pending={stage:'reasoned reroute',from:(await s.native('state')).user.employee_id,to:destination};save();await modal.getByRole('button',{name:'Confirm',exact:true}).dblclick();await expect(modal).toHaveCount(0);const sent=await posts(s);assert.equal(sent.length,1);assert.equal(sent[0].status,200);assert.equal(sent[0].body.reason,reason);delete j.pending;save();return sent[0];}
 j.outward=await route(a,target,j.run+' deliberate software referral plan, no care',true);save();
 const destRow=b.p.locator('.doctor-token').filter({hasText:original.ticket_number});await expect(destRow).toBeVisible();await expect(destRow).toHaveClass(/rerouted/);await expect(destRow).toContainText(j.run);await expect(a.p.locator('.doctor-token').filter({hasText:original.ticket_number})).toHaveCount(0);j.destination_queue=await b.native('api',{method:'GET',path:'/opd-queues/me'});assert.equal(j.destination_queue[0].ticket_id,original.ticket_id);assert(j.destination_queue[0].is_rerouted);assert.equal(j.destination_queue[0].reroute_reason,j.outward.body.reason);save();
 j.returned=await route(b,source,j.run+' software test finished; restore original doctor, no care',false);await expect(a.p.locator('.doctor-token').filter({hasText:original.ticket_number})).toBeVisible();await expect(destRow).toHaveCount(0);j.final=await a.native('api',{method:'GET',path:'/opd-tickets/'+original.ticket_id});assert.equal(j.final.doctor_id,source);assert.equal(j.final.patient_id,original.patient_id);assert.notEqual(j.final.queue.queue_id,original.queue.queue_id);j.events={source:await a.p.evaluate(()=>window.reasonEvents),destination:await b.p.evaluate(()=>window.reasonEvents)};assert(j.events.source.length&&j.events.destination.length);
 await capture(a,'doctor_queue');j.checks.push('Reason required before POST/F1 preserves draft; one POST per UI double-click; receiving queue live arrival highlighted at top with original reason; original queue removes row; second deliberate reasoned route restores original doctor through real events; EN/UR both themes250%');j.passed=true;a.j.passed=true;b.j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}
finally{for(const [name,s]of[['source',a],['destination',b]])if(s){await s.close();j[name+'_session']={renderer:s.j.renderer,preferences_restored:s.j.preferences_restored,signed_out:s.j.signed_out,trace:s.j.trace};}save();console.log(JSON.stringify({passed:j.passed,doctor:j.final?.doctor_id,error:j.error?.slice(0,250)}));}

```
