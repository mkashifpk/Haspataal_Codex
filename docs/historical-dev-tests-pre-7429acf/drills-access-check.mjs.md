# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only native/session boundary checks against the already-owned Final drill.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const owned=JSON.parse(fs.readFileSync('artifacts/screen161/journey.json'));assert(owned.passed,'Complete/reconcile original journey first');
const file='artifacts/screen161/access.json',j={started:new Date().toISOString(),drill_id:owned.drill_id,checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('screen161-pdf-session','demo.ops');const target=path.resolve('artifacts/screen161/session-changed-must-not-save.pdf');assert(!fs.existsSync(target),'Investigate an unexpected existing file, do not overwrite');
 await s.nav('Mock drills');await s.p.locator('[data-help="dr.new"]').click();const scenario=s.p.locator('[data-help="dr.scenario"]');await scenario.fill('UNSENT LAYOUT TEST ONLY - NO REPORT SUBMISSION');await s.p.locator('[data-help="dr.participant-add"]').click();
 for(const language of ['en','ur'])for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect(scenario).toHaveValue('UNSENT LAYOUT TEST ONLY - NO REPORT SUBMISSION');assert(await s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
 await scenario.focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toHaveText('فرضی مشقیں');await expect(s.p.locator('.help-control').filter({hasText:'مشق کا منظرنامہ لکھیں'})).toBeVisible();await s.p.getByRole('dialog').filter({has:s.p.locator('.help-layout')}).locator('.dialog-head [data-help="common.close"]').click();await expect(scenario).toBeFocused();await expect(scenario).toHaveValue('UNSENT LAYOUT TEST ONLY - NO REPORT SUBMISSION');await s.p.locator('[data-help="dr.cancel"]').click();
 j.checks.push('Unsent report/participant form retains draft through EN/UR Light/DarkHighContrast250% without page overflow; Urdu contextual F1/focus preserved; cancelled without a business write.');save();
 // Restore this account's exact original preferences before deliberately logging out.
 await s.prefs(s.original);const {updated_at,...actual}=(await s.native('state')).prefs;const {updated_at:oldTime,...original}=s.original;assert.deepEqual(actual,original);s.j.preferences_restored_before_logout=true;s.original=undefined;s.save();
 await s.app.evaluate(({dialog})=>{globalThis.drillPendingSave=undefined;dialog.showSaveDialog=()=>new Promise(resolve=>{globalThis.drillPendingSave=resolve;});});
 const saving=s.p.evaluate(args=>window.terminal.call('clinical-pdf',args),{path:'/facility/drills/'+owned.drill_id+'/pdf',preview:false});
 await expect.poll(()=>s.app.evaluate(()=>!!globalThis.drillPendingSave)).toBe(true);await s.native('logout');await s.app.evaluate((_,target)=>{globalThis.drillPendingSave({canceled:false,filePath:target});},target);
 const reply=await saving;assert.equal(reply.ok,false);assert.match(reply.error.message,/session or permission changed/i);assert.equal(fs.existsSync(target),false);
 j.checks.push('Actual authenticated PDF read, logout while native Save dialog pending, then Save refused and no file written; original account preferences restored before logout.');s.j.passed=true;s.save();save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();s=undefined;}
try{
 s=await session('screen161-denied','demo.reception');await expect(s.p.getByRole('navigation').getByRole('button',{name:'Mock drills',exact:true})).toHaveCount(0);
 const reply=await s.p.evaluate(args=>window.terminal.call('clinical-pdf',args),{path:'/facility/drills/'+owned.drill_id+'/pdf',preview:true});assert.equal(reply.ok,false);assert.match(reply.error.message,/permission/i);assert(!(await s.trace()).requests.some(r=>r.path.includes('/facility/drills')));
 j.checks.push('Reception route absent and native drill PDF denied before HTTP.');s.j.passed=true;s.save();save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();}
j.passed=true;j.finished=new Date().toISOString();save();console.log(JSON.stringify(j,null,2));

```
