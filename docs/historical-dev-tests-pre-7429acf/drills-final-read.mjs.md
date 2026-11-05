# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only final-renderer regression for transient navigation feedback and RTL.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,capture} from './clinical-test-kit.mjs';
const owned=JSON.parse(fs.readFileSync('artifacts/screen161/journey.json'));assert(owned.passed);
const file='artifacts/screen161/final-read.json',j={started:new Date().toISOString(),checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('screen161-final-read','demo.ops');j.renderer=s.j.renderer;save();const c=id=>s.p.locator(`[data-help="${id}"]`),root=s.p.locator('[data-screen="mock_drills_ops"]');
 await s.nav('Mock drills');await c('dr.reports').click();await s.p.locator('.dr-row').filter({hasText:owned.drill_number}).click();await expect(s.p.locator('.dr-detail')).toContainText(owned.drill_number);
 for(const language of ['en','ur']){
  await s.prefs({language,theme:'Light',ui_scale_pct:100});await s.app.evaluate(({dialog})=>{globalThis.drillGuardSave=undefined;dialog.showSaveDialog=()=>new Promise(resolve=>{globalThis.drillGuardSave=resolve;});});
  await s.p.locator('button[data-help="dr.pdf"]').nth(1).click();await expect.poll(()=>s.app.evaluate(()=>!!globalThis.drillGuardSave)).toBe(true);await s.p.keyboard.press('Control+,');
  const warning=language==='en'?'Finish or retry the pending action before leaving this screen.':'اس اسکرین سے جانے سے پہلے زیر التوا عمل مکمل یا اصل دوبارہ کوشش کریں۔';await expect(s.p.getByText(warning,{exact:true})).toBeVisible();await expect(root).toBeVisible();
  await s.app.evaluate(()=>{const done=globalThis.drillGuardSave;globalThis.drillGuardSave=undefined;done({canceled:true});});await expect(root).not.toHaveAttribute('data-write-pending','true');await expect(s.p.getByText(warning,{exact:true})).not.toBeVisible();
 }
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await c('dr.coverage').click();const coverage=await s.native('api',{method:'GET',path:'/facility/drills/coverage'}),department=coverage.departments.find(d=>d.department_id===owned.department_id);const row=s.p.locator('.dr-table tbody tr').filter({hasText:department.department_name});await expect(row.locator('td').nth(3).locator('bdi')).toHaveAttribute('dir','ltr');await expect(row.locator('td').nth(4).locator('bdi')).toHaveAttribute('dir','ltr');
 await capture(s,'mock_drills_ops');assert(!(await s.trace()).requests.some(r=>r.method!=='GET'&&r.path.includes('/facility/drills')));j.checks.push('Final EN/UR actual pending PDF blocks navigation with translated warning; cancelling resolves hold and stale warning clears. RTL counts and last-time isolatedLTR; corrected actual EN/UR/theme100/250 screenshots, no business writes.');j.passed=true;save();s.j.passed=true;s.save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
console.log(JSON.stringify(j,null,2));

```
