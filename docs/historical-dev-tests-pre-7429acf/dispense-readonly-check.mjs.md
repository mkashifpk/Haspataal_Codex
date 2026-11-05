# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final renderer/printing recovery checks using exact already-confirmed synthetic IDs. No business writes.
import {session,expect,help,capture} from './clinical-test-kit.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=await session('dispense-readonly-final','demo.pharmacist');const p=s.p;
try{
 await s.nav('Dispense');await p.getByLabel('Prescription ID',{exact:true}).fill('4');await p.getByRole('button',{name:'Open prescription',exact:true}).click();await expect(p.locator('main')).toContainText('RX-2026-000003');
 const rx=await s.native('api',{method:'GET',path:'/prescriptions/4'});assert(rx.notes.startsWith('DEMO-DISPENSE-'));assert.equal(rx.status,'FullyDispensed');assert.equal(rx.dispensations.length,1);
 await expect(p.getByRole('button',{name:'Review dispensing',exact:true})).toBeDisabled();
 await s.fault({failPath:'/api/v1/prescriptions/5',failMethod:'GET',once:false});await p.getByLabel('Prescription ID',{exact:true}).fill('5');await p.getByRole('button',{name:'Open prescription',exact:true}).click();await expect(p.locator('main .error[role="alert"]')).toBeVisible({timeout:60000});await expect(p.getByRole('heading').filter({hasText:'RX-2026-000003'})).toHaveCount(0);
 await s.fault({failPath:null});await p.getByRole('button',{name:'Try again',exact:true}).click();await expect(p.getByRole('heading').filter({hasText:'RX-2026-000004'})).toBeVisible();
 await expect(p.getByText('Confirmed on the server. A later read or print failure does not undo this action.',{exact:true})).toHaveCount(0);
 await help(s,p.getByLabel('Prescription ID',{exact:true}),'Dispense');
 s.pass('Known terminal records do not offer another supply; failed new-ID read hides prior details, retry restores exact identity and no stale action notice');
 await p.getByRole('button').filter({hasText:'D-2 ·'}).click();await expect(p.locator('main')).toContainText('HIGH ALERT');
 const selected=await s.native('api',{method:'GET',path:'/dispensations/2/labels'});assert(selected.length>0);assert.equal(selected[0].printer_role,'label');assert.equal(selected[0].fields.dispensation_id,2);
 await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});await p.getByRole('button',{name:'Save label PDFs',exact:true}).click();await expect(p.getByText('Save cancelled.',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Print receipt',exact:true}).click();await expect(p.locator('main .error[role="alert"]').filter({hasText:'No receipt printer'})).toBeVisible();
 s.pass('Actual D2 label identity and warning match; native PDF save cancellation/missing receipt mapping do not repeat supply/payment');
 await s.nav('Prescription queue');await p.getByLabel('Existing prescription ID',{exact:true}).fill('5');await p.getByRole('button',{name:'Open prescription ID',exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toContainText('RX-2026-000004');await help(s,p.getByRole('button',{name:'Open dispensing',exact:true}),'Prescription queue');await p.getByRole('button',{name:'Open dispensing',exact:true}).click();await expect(p.getByRole('heading').filter({hasText:'RX-2026-000004'})).toBeVisible();
 s.pass('New queue handoff control has correct contextual F1/focus and transfers exact selected prescription');
 await p.evaluate(()=>scrollTo(0,0));await capture(s,'dispense');
 const win=await s.app.browserWindow(p);async function key(code){await win.evaluate((w,code)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:code,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:code,modifiers:['control']});},code)}
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.pass('Final source ENUR/both themes250 screenshots, actual Electron zoom upper/reset/lower and zero business writes');s.j.passed=true;
 fs.writeFileSync('docs/dispense-readonly-evidence-2026-10-25.json',JSON.stringify({date:new Date().toISOString(),checks:s.j.checks,passed:true,businessWrites:0},null,2));
}finally{await s.fault({failPath:null,delayPath:null});await s.close();}

```
