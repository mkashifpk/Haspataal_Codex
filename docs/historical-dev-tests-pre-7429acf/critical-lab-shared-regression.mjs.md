# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Regression of the unchanged technician default after sharing the verifier UI.
// Reads only owned terminal synthetic records; no business writes or media changes.
import {session,expect} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const prior=JSON.parse(fs.readFileSync('artifacts/critical-bench-check.json'));
assert(prior.passed&&prior.finished,'Reconcile previous bench workflow first');
const s=await session('critical-shared-bench-regression','demo.labtech');
try{
 await s.nav('Critical results to tell');const p=s.p;
 await expect(p.locator('[data-help-screen="critical_results_bench"]')).toBeVisible();
 const id=prior.criticals[0].critical_result_id;
 const r=await s.native('api',{method:'GET',path:`/critical-results/${id}`});
 assert.equal(r.patient_id,prior.requisition.patient_id);assert.equal(r.status,'Acknowledged');
 await p.getByLabel('Known critical result ID',{exact:true}).fill(String(id));
 await p.getByRole('button',{name:'Read known critical result',exact:true}).click();
 await expect(p.getByTestId('critical-detail')).toContainText(r.critical_number);
 await expect(p.getByTestId('critical-history')).toContainText('DEMO requesting doctor');
 await p.getByLabel('Recipient name and designation',{exact:true}).focus();await p.keyboard.press('F1');
 await expect(p.locator('.help-article')).toContainText('The lab technician opens this screen');
 await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
 assert.equal((await s.native('critical-result-alarm',{criticalResultId:id})).played,false);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.pass('Technician retains exact bench service/help scope, acknowledged history and handled-result alarm refusal; zero business writes');s.j.passed=true;
 fs.writeFileSync('docs/critical-shared-bench-regression-2026-10-26.json',JSON.stringify({date:new Date().toISOString(),build:s.j.renderer,passed:true,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}

```
