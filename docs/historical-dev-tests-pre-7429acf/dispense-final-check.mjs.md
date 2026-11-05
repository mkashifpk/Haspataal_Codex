# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Guarded continuation: no replacement prescriptions; original secrets stay in memory only.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const base=JSON.parse(fs.readFileSync('artifacts/dispense-check.json')),ipd=JSON.parse(fs.readFileSync('artifacts/dispense-ipd-rx-receipt.json')).body.data;
assert(base.dispensation?.dispensation.dispensation_id===1 && base.orders.length===2);
const file='artifacts/dispense-final-check.json';assert(!fs.existsSync(file),'Read/reconcile previous final continuation before restarting');
const j={date:new Date().toISOString(),checks:[],writes:{},passed:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();const sessions=[];
const pass=s=>{j.checks.push(s);save();console.log('PASS '+s)};
async function original(s,label,path,body){assert(!j.writes[label]);const w=j.writes[label]={path,body,key:crypto.randomUUID(),state:'prepared'};save();const r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();assert(r.ok,`${label}: ${r.error?.code} ${r.error?.message}`);return r.data;}
try{
 const s=await session('dispense-final-pharmacist','demo.pharmacist');sessions.push(s);const p=s.p;
 const high=base.orders[1],actual=await s.native('api',{method:'GET',path:`/prescriptions/${high.prescription_id}`});assert.equal(actual.notes,high.notes);assert.equal(actual.status,'Active');assert.equal(actual.dispensations.length,0);
 await s.nav('Dispense');const open=async id=>{await p.getByLabel('Prescription ID',{exact:true}).fill(String(id));await p.getByRole('button',{name:'Open prescription',exact:true}).click();};await open(high.prescription_id);await expect(p.locator('main')).toContainText(high.prescription_number);
 await p.evaluate(()=>{window.dispenseEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.dispenseEvents.push(e)})});
 await p.getByLabel('Dispense Now #'+high.items[0].prescription_item_id,{exact:true}).fill('1');await p.getByLabel('Payment mode',{exact:true}).selectOption('Card');await p.getByLabel('Card reference',{exact:true}).fill(base.run+' VIRTUAL HIGH ALERT');await p.getByRole('button',{name:'Review dispensing',exact:true}).click();
 const modal=()=>p.getByRole('dialog').filter({has:p.getByRole('button',{name:'Confirm pharmacy action',exact:true})});await modal().getByLabel('I verified this patient, order, quantities and payment mode.',{exact:true}).check();
 // Use the already-authorized demo test credential source; never copy it to output or journals.
 let secret=fs.readFileSync('scripts/clinical-test-kit.mjs','utf8').match(/getByLabel\("Password"[^\n]+fill\("([^\"]+)"\)/)?.[1];assert(secret);
 await modal().getByLabel('Checker username',{exact:true}).fill('demo.pharmacist');await modal().getByLabel('Checker password',{exact:true}).fill(secret);j.high_attempt_pending=true;save();await modal().getByRole('button',{name:'Confirm pharmacy action',exact:true}).click();await expect(modal()).toContainText('DUAL_CONTROL_SAME_PERSON');await expect(modal().getByLabel('Checker password',{exact:true})).toHaveValue('');
 assert.equal((await s.native('api',{method:'GET',path:`/prescriptions/${high.prescription_id}`})).dispensations.length,0);
 pass('Actual same-person high-alert refusal causes zero supply; checker fields wiped, safe corrected new action');
 await modal().getByLabel('Checker username',{exact:true}).fill('demo.doctor');await modal().getByLabel('Checker password',{exact:true}).fill(secret);secret='';await modal().getByRole('button',{name:'Confirm pharmacy action',exact:true}).click();await expect(modal()).toHaveCount(0);
 const supplied=await s.native('api',{method:'GET',path:`/prescriptions/${high.prescription_id}`});assert.equal(supplied.status,'FullyDispensed');assert.equal(supplied.dispensations.length,1);assert(supplied.dispensations[0].checked_by);j.high_dispensation_id=supplied.dispensations[0].dispensation_id;j.high_attempt_pending=false;save();
 const highTrace=(await s.trace()).requests.filter(r=>r.path===`/api/v1/prescriptions/${high.prescription_id}/dispense`&&r.method==='POST');assert.equal(highTrace.length,2);assert.equal(highTrace[0].body.checker_password,'[REDACTED]');assert.equal(highTrace[1].body.checker_username,'[REDACTED]');assert(highTrace[1].result.data.lines[0].batch_id);
 await p.getByRole('button').filter({hasText:'D-'+j.high_dispensation_id+' ·'}).click();await expect(p.locator('main')).toContainText('HIGH ALERT');
 await expect.poll(()=>p.evaluate(()=>window.dispenseEvents.some(e=>e.event_type==='pharmacy.stock.updated'))).toBe(true);
 pass('Different authorized Doctor co-sign201, one virtual high-alert dispensation/server FEFO batch/label warning; actual stock event and no persisted co-signer secrets');
 await open(ipd.prescription_id);await expect(p.locator('main')).toContainText(ipd.prescription_number);await expect(p.locator('main')).toContainText('Your role cannot read the discharge stage.');await expect(p.getByRole('button',{name:'Review Pharmacy clearance',exact:true})).toHaveCount(0);
 await p.getByLabel('Dispense Now #'+ipd.items[0].prescription_item_id,{exact:true}).fill('1');await p.getByRole('button',{name:'Review dispensing',exact:true}).click();await modal().getByLabel('I verified this patient, order, quantities and payment mode.',{exact:true}).check();j.ipd_attempt_pending=true;save();await modal().getByRole('button',{name:'Confirm pharmacy action',exact:true}).click();await expect(modal()).toHaveCount(0);
 const admissionRx=await s.native('api',{method:'GET',path:`/prescriptions/${ipd.prescription_id}`});assert.equal(admissionRx.status,'PartiallyDispensed');assert.equal(admissionRx.items[0].qty_remaining,1);assert.equal(admissionRx.dispensations[0].payment_mode,'IPDBill');j.ipd_dispensation_id=admissionRx.dispensations[0].dispensation_id;j.ipd_attempt_pending=false;save();
 pass('Own IPD prescription billed by server to admission, no counter payment mode; PharmacyClearance safely unavailable for reproduced issue23');
 await help(s,p.getByLabel('Prescription ID',{exact:true}),'Dispense');
 const doctor=await session('dispense-final-doctor','demo.doctor');sessions.push(doctor);
 await original(doctor,'stop-ipd-remainder',`/prescriptions/${ipd.prescription_id}/items/${ipd.items[0].prescription_item_id}/stop`,{reason:'DEMO software verification done; no physical medicine supplied'});
 const ordinary=await doctor.native('api',{method:'GET',path:`/prescriptions/${base.orders[0].prescription_id}`});assert.equal(ordinary.status,'FullyDispensed');assert.equal(ordinary.dispensations.length,1);assert.equal(ordinary.items[0].item_status,'Stopped');
 // Cancelling the pending admission is an upstream MCP cleanup; do not expand app write routes.
 j.cleanup_pending_admission=1;save();
 const trace=await s.trace();assert(!JSON.stringify(trace).includes('"checker_password":"Demo-'));
 j.passed=true;pass('Original ordinary remainder remains Stopped/terminal, IPD remainder stopped once; no replacement or cancellation of a terminal prescription');
 fs.writeFileSync('docs/dispense-evidence-2026-10-25.json',JSON.stringify({date:new Date().toISOString(),checks:[...base.checks,...j.checks],ordinary_rx:base.orders[0].prescription_id,high_rx:high.prescription_id,ipd_rx:ipd.prescription_id,dispensation_ids:[1,j.high_dispensation_id,j.ipd_dispensation_id],limits:['Synthetic DEV stock/payment/IPD entries only, no physical medicine/cash/card processing','Pharmacy discharge positive path blocked by backend issue23','Charity positive, service retirement/recall matrices and named human/device/translation/editor review remain pending'],passed:true},null,2));
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of sessions.reverse())await s.close();j.finished=new Date().toISOString();save();}

```
