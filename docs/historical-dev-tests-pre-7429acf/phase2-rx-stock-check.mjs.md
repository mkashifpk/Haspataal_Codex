# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Draft-only real DEV Rx UI; actual pharmacy events from a NEW one-unit synthetic batch.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-rx-stock-check-2026-10-24.json',control='docs/phase2-rx-stock-controller-2026-10-24.json';
assert(!fs.existsSync(file),'Reconcile original stock test before another fixture');
const j={drug_id:4,checks:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('phase2-rx-stock-check','demo.doctor'),p=s.p;
async function wait(flag){j.waiting_for=flag;save();console.log('WAIT '+flag);for(let n=0;n<360;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control))[flag])return JSON.parse(fs.readFileSync(control));await new Promise(r=>setTimeout(r,2000));}throw Error('Wait expired '+flag)}
const pass=t=>{j.checks.push(t);save();console.log('PASS '+t)};
try{
 await p.evaluate(()=>{window.rxStockEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&e.event_type==='pharmacy.stock.updated')window.rxStockEvents.push(e)})});
 const ticket=await s.native('api',{method:'GET',path:'/opd-tickets/15'});assert.equal(ticket.patient_id,21);
 await s.nav('E-prescription builder');await p.getByLabel('OPD slip number',{exact:true}).fill(ticket.ticket_number);await p.getByRole('button',{name:'Open slip',exact:true}).click();
 await p.getByLabel('Prescription destination',{exact:true}).selectOption('ExternalMarket');
 await p.getByLabel('Search medicines',{exact:true}).fill('ORS');
 await p.getByRole('button',{name:'Add medicine',exact:true}).first().click();
 const line=p.getByRole('heading',{name:'Medicine 1 · ORS sachet',exact:true}).locator('..');
 await expect(line.locator('[class^="stock-"]')).toContainText('300');
 await line.getByLabel('Dose (include units)',{exact:true}).fill('DEMO draft only, not a medication instruction');
 await help(s,line.getByLabel('Dose (include units)',{exact:true}),'E-prescription builder');
 j.baseline=await s.native('api',{method:'GET',path:'/drugs/4/stock-status'});assert.equal(j.baseline.qty_available,300);save();
 await s.fault({failPath:'/drugs/4/stock-status',failMethod:'GET',once:false});j.ready=true;save();
 await wait('increased');
 await expect(p.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
 await expect(line.locator('[class^="stock-"]')).toHaveCount(0);
 await expect(p.getByRole('button',{name:'Create prescription',exact:true})).toBeDisabled();
 await expect(line.getByLabel('Dose (include units)',{exact:true})).toHaveValue('DEMO draft only, not a medication instruction');
 await s.fault({failPath:null});await p.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(line.locator('[class^="stock-"]')).toContainText('301');
 await expect(p.getByRole('button',{name:'Create prescription',exact:true})).toBeEnabled();
 pass('Actual stock event refreshes an already-added line; failed real stock read hides stale300 and blocks saving, Retry shows301 with authored dose intact');j.increased_checked=true;save();
 await wait('restored');await expect(line.locator('[class^="stock-"]')).toContainText('300');
 j.events=await p.evaluate(()=>window.rxStockEvents);assert(j.events.filter(e=>e.payload.drug_id===4).length>=2);
 j.final=await s.native('api',{method:'GET',path:'/drugs/4/stock-status'});assert.equal(j.final.qty_available,j.baseline.qty_available);
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method!=='GET').length,0);
 pass('Second actual pharmacy event refreshes selected line back to300; only the new synthetic batch removed, original stock untouched; ZERO prescription/handover/business POSTs from Doctor');
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Remove unsent line',exact:true}).click();
 j.passed=true;save();
}catch(e){j.error=e.stack;j.failure_ui=await p.locator('body').innerText();j.trace=await s.trace();save();console.error(e.stack);process.exitCode=1}
finally{await s.close();j.finished=new Date().toISOString();save()}

```
