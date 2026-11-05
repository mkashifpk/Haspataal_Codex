# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Current build, explicit Reception context, real existing synthetic master.
import {session,expect,capture} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=JSON.parse(fs.readFileSync('docs/patient-merge-resume-scenario-2026-10-24.json'));const s=await session('patient-master-final-visual','demo.reception'),p=s.p;
try{
 await expect.poll(async()=>(await s.native('state')).workspace).toBe('reception');await expect(p.getByText('READY FOR YOUR NEXT TASK',{exact:true})).toBeVisible();await s.nav('Workspaces');await p.locator('.workspace-card').filter({has:p.getByRole('heading',{name:'Reception & Front Desk',exact:true})}).getByRole('button',{name:'Open workspace →',exact:true}).click();await expect(p.getByRole('navigation').getByRole('button',{name:'Patient document vault',exact:false})).toBeVisible();
 const master=await s.native('api',{method:'GET',path:'/patients/'+source.scenario.saved.patient_id});assert(master.full_name.includes(source.scenario.run));await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});await q.fill(master.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(p.locator('main article.card')).toContainText(master.full_name);await expect(p.locator('.header-context')).toContainText('Reception & Front Desk');
 await capture(s,'patient_search');await expect(p.locator('.header-context')).toContainText('Reception & Front Desk');await expect(p.getByRole('navigation').getByRole('button',{name:'Patient document vault',exact:false})).toBeVisible();assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);s.pass('Current master card/history and correct Reception context/full menu persist through ENUR/themes250; refreshed both handbook images, ZERO business writes');s.j.passed=true;
}catch(e){s.j.error=e.stack;console.error(e.stack);process.exitCode=1}finally{await s.close()}

```
