# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final read-only verification of the previously created AND cancelled own fixtures.
import {session,expect,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('artifacts/rx-queue-check.json'));
assert(original.cleaned&&original.prescriptions.length===2,'Reconcile original fixture cleanup before final checks');
const checks=[...new Set(original.checks)],sessions=[];
let p;
try{
 const s=await session('rx-queue-final-pharmacist','demo.pharmacist');sessions.push(s);p=s.p;
 await s.nav('Prescription queue');
 await expect(p.getByTestId('rxqueue-list')).toContainText('No pending hospital-pharmacy prescriptions');
 for(const row of original.prescriptions){
  const actual=await s.native('api',{method:'GET',path:`/prescriptions/${row.prescription_id}`});assert.equal(actual.notes,row.notes);assert.equal(actual.status,'Cancelled');assert.equal(actual.dispensations.length,0);
  await p.getByLabel('Existing prescription ID',{exact:true}).fill(String(row.prescription_id));await p.getByRole('button',{name:'Open prescription ID',exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toContainText(row.prescription_number);await expect(p.getByTestId('rxqueue-detail')).toContainText('Cancelled');
 }
 checks.push('Both exact original synthetic prescriptions persist Cancelled with zero dispensations; known-ID detail rereads them without a write');
 await help(s,p.getByLabel('Existing prescription ID',{exact:true}),'Prescription queue');
 await p.evaluate(()=>{window.rxFinalStreams=[];window.terminal.subscribe(e=>{if(e.type==='stream')window.rxFinalStreams.push(e)})});
 await s.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;WS.prototype.emit=function(event,...args){if(event==='message')globalThis.rxFinalSocket=this;return emit.call(this,event,...args)}});
 await expect.poll(()=>s.app.evaluate(()=>!!globalThis.rxFinalSocket),{timeout:45000}).toBe(true);
 const before=Date.now();await s.app.evaluate(()=>globalThis.rxFinalSocket.terminate());
 await expect.poll(()=>p.evaluate(()=>window.rxFinalStreams.some(e=>e.status==='Reconnecting'))).toBe(true);
 await expect.poll(()=>p.evaluate(()=>window.rxFinalStreams.some(e=>e.status==='Live'&&e.resync)),{timeout:45000}).toBe(true);
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path==='/api/v1/prescriptions/pending'&&r.status===200&&r.started>=before)).toBe(true);
 await expect(p.getByTestId('rxqueue-detail')).toContainText(original.prescriptions[1].prescription_number);
 checks.push('Actual native socket terminated/reconnected Live resync; queue and selected detail reload without polling or fabricated events');
 const win=await s.app.browserWindow(p);
 async function key(code){await win.evaluate((w,code)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:code,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:code,modifiers:['control']});},code)}
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 checks.push('Actual Electron Ctrl+= reaches/stays250, Ctrl+0 resets100 and Ctrl+- stays100; shared preference state');
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 const d=await session('rx-queue-final-doctor','demo.doctor');sessions.push(d);
 const beforeDenied=(await d.trace()).requests.length;
 const denied=await d.p.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/prescriptions/pending'}));assert(!denied.ok&&denied.error.code==='PERMISSION_REQUIRED');assert.equal((await d.trace()).requests.length,beforeDenied);
 await expect(d.p.getByRole('navigation').getByRole('button',{name:'Prescription queue',exact:false})).toHaveCount(0);
 checks.push('Doctor queue route absent by scoped handbook; native PERMISSION_REQUIRED rejects forbidden queue before HTTP; separate real Cashier403 and PharmacyAdmin200 API checks recorded');
 fs.writeFileSync('docs/rx-queue-evidence-2026-10-25.json',JSON.stringify({date:new Date().toISOString(),run:original.run,checks,records:original.prescriptions.map(r=>({id:r.prescription_id,number:r.prescription_number,status:'Cancelled',dispensations:0})),query_id:original.query.query_id,query_status:'Withdrawn',passed:true,limits:['CodeRed/Telephone contexts require inpatient/emergency and were safely refused on OPD fixtures; those branches not live-tested','Service lifecycle variants unit tested; current DEV Active/full tested without changing shared dispensing state','No human/translation/editor/device approval or full-workspace completion claimed','Original broader script stopped at final native-denial code expectation; this read-only continuation verifies that corrected expectation without recreating records'],businessWritesInFinalCheck:0},null,2));
 console.log(checks.slice(-4).map(x=>'PASS '+x).join('\n'));
}finally{for(const s of sessions.reverse())await s.close();}

```
