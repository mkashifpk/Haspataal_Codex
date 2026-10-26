// Final renderer/guide/layout checks on exact terminal records. No business writes.
import {session,expect,capture,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('artifacts/critical-bench-check.json'));
assert(original.passed&&original.finished,'Reconcile the original workflow first');
const s=await session('critical-bench-readonly','demo.labtech');
try{
 await s.nav('Critical results to tell');const p=s.p;
 const current=original.criticals[0];
 const record=await s.native('api',{method:'GET',path:`/critical-results/${current.critical_result_id}`});
 assert.equal(record.status,'Acknowledged');assert.equal(record.patient_id,original.requisition.patient_id);
 await p.getByLabel('Not yet acknowledged only',{exact:true}).uncheck();await p.getByRole('button',{name:'Apply log filters',exact:true}).click();
 await p.getByLabel('Find in returned critical results',{exact:true}).fill(current.critical_number);
 await p.getByLabel('Known critical result ID',{exact:true}).fill(String(current.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();
 await expect(p.getByTestId('critical-detail')).toContainText(current.critical_number);
 await expect(p.getByTestId('critical-detail')).toContainText('Acknowledged by doctor');
 await expect(p.getByTestId('critical-history')).toContainText('DEMO requesting doctor');
 await expect(p.getByRole('button',{name:'Play alarm for this open result',exact:true})).toHaveCount(0);
 await help(s,p.getByLabel('Recipient name and designation',{exact:true}),'Critical results to tell');
 await p.getByLabel('Recipient name and designation',{exact:true}).fill('DEMO unsent recipient A');
 await p.getByLabel(/The recipient read the result back/).check();
 await p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true}).check();
 await p.getByLabel('Recipient name and designation',{exact:true}).fill('DEMO unsent recipient B');
 await expect(p.getByLabel(/The recipient read the result back/)).not.toBeChecked();
 await expect(p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true})).not.toBeChecked();
 await p.getByLabel(/The recipient read the result back/).check();await p.getByLabel('Recipient role',{exact:true}).selectOption('OnCallDoctor');
 await expect(p.getByLabel(/The recipient read the result back/)).not.toBeChecked();
 await p.getByLabel('Recipient name and designation',{exact:true}).fill('');
 await p.evaluate(()=>scrollTo(0,0));await capture(s,'critical_results_bench');
 const win=await s.app.browserWindow(p);
 async function key(c){await win.evaluate((w,c)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:c,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:c,modifiers:['control']});},c);}
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.pass('Final responsive list/detail and ENUR/both themes250 layout, native zoom bounds/reset, exact acknowledged history/F1; changing recipient clears stale read-back/completed-call assertions; zero business writes');s.j.passed=true;
 fs.writeFileSync('docs/critical-bench-readonly-evidence-2026-10-26.json',JSON.stringify({date:new Date().toISOString(),passed:true,build:s.j.renderer,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}
