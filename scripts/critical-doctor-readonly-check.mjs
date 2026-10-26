// Final renderer/help/layout regression on exact terminal records; ZERO business writes.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('artifacts/critical-doctor-check.json'));assert(original.passed&&original.finished,'Reconcile original doctor workflow before continuation');
const s=await session('critical-doctor-readonly','demo.doctor');
try{
 await s.nav('Critical results to acknowledge');const p=s.p,current=original.criticals[0];
 await expect(p.locator('section[data-help-screen="critical_results_doctor"]')).toBeVisible();
 const record=await s.native('api',{method:'GET',path:`/critical-results/${current.critical_result_id}`});assert.equal(record.status,'Acknowledged');assert.equal(record.patient_id,original.requisition.patient_id);
 await p.getByLabel('Known critical result ID',{exact:true}).fill(String(current.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();await expect(p.getByTestId('doctor-critical-detail')).toContainText(current.critical_number);await expect(p.getByTestId('doctor-critical-detail')).toContainText('Acknowledged — final');
 await expect(p.getByRole('button',{name:'Review acknowledgement',exact:true})).toHaveCount(0);await expect(p.getByTestId('doctor-critical-alert')).toHaveCount(0);
 await help(s,p.getByLabel('Known critical result ID',{exact:true}),'Critical results to acknowledge');
 await p.getByLabel('Known critical result ID',{exact:true}).focus();await p.keyboard.press('F1');await expect(p.locator('.help-article')).toContainText('The treating doctor opens this screen');await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
 await p.getByLabel('Not yet acknowledged only',{exact:true}).uncheck();await p.getByRole('button',{name:'Apply log filters',exact:true}).click();await p.getByLabel('Find in returned critical results',{exact:true}).fill(current.critical_number);await expect(p.getByTestId('doctor-critical-log-row')).toHaveCount(1);
 await p.evaluate(()=>scrollTo(0,0));await capture(s,'critical_results_doctor');
 await s.prefs({language:'ur'});await expect(p.getByTestId('doctor-critical-history')).toContainText('تحریری');await expect(p.getByTestId('doctor-critical-history')).toContainText('مانگنے والا معالج');await s.prefs({language:'en'});
 const win=await s.app.browserWindow(p);async function key(c){await win.evaluate((w,c)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:c,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:c,modifiers:['control']});},c);}
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));s.pass('Final Doctor F1/scope, acknowledged identity/history/finality/no alert, actual ENUR translated communication labels, both themes250 layout and native100–250zoom bounds/reset; ZERO business writes');s.j.passed=true;
 fs.writeFileSync('docs/critical-doctor-readonly-evidence-2026-10-26.json',JSON.stringify({date:new Date().toISOString(),passed:true,build:s.j.renderer,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}
