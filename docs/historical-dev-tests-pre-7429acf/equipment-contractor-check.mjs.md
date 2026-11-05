# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV contractor attribution on already-owned synthetic assets; no registrations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session, expect} from './clinical-test-kit.mjs';
const file='artifacts/continuation-20261104/equipment-contractor.json';
assert(!fs.existsSync(file),'Reconcile existing contractor journal before rerunning');
const j={started:new Date().toISOString(),checks:[],intents:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
for(const [account,fixture] of [['demo.maintenance','equipment-write.json'],['demo.ops','equipment-write-ops.json']]) {
 const owned=JSON.parse(fs.readFileSync('artifacts/continuation-20261104/'+fixture));let s;
 try {
  s=await session('resume1104-contractor-'+account.split('.')[1],account);
  const c=k=>s.p.locator(`[data-help="${k}"]`);
  const read=()=>s.native('api',{method:'GET',path:`/facility/equipment/${owned.asset_id}`});
  const before=await read();assert.equal(before.asset_tag,owned.tag);
  assert(!before.plans.some(p=>p.kind==='Inspection'&&p.is_active));
  await s.nav('Medical equipment and maintenance');await c('em-tab-inventory').click();
  await c('em-inv-search').fill(owned.tag);await c('em-inv-item').filter({hasText:owned.tag}).click();
  await c('em-add-plan-btn').click();await c('em-plan-kind').selectOption('Inspection');
  await c('em-plan-performed-by').selectOption('Contractor');
  await expect(c('em-plan-vendor').locator('option').filter({hasText:'Biomedical'})).toHaveCount(1);
  const vendor=await c('em-plan-vendor').locator('option').filter({hasText:'Biomedical'}).getAttribute('value');assert(vendor);
  await c('em-plan-vendor').selectOption(vendor);await c('em-plan-interval').fill('30');
  await c('em-plan-due-date').fill(new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  await c('em-plan-oem').fill('SCN SYNTHETIC CONTRACTOR TEST ONLY');
  j.intents.push({account,asset_id:owned.asset_id,action:'distinct Inspection contractor plan',vendor_id:Number(vendor)});save();
  await c('em-plan-submit-btn').click();await expect(c('em-plan-submit-btn')).not.toBeVisible();
  const plan=(await read()).plans.find(p=>p.kind==='Inspection'&&p.is_active);assert(plan);assert.equal(plan.vendor_id,Number(vendor));
  await c('em-detail-record-visit-btn').click();await c('em-visit-kind').selectOption('Inspection');
  await c('em-visit-performed-by').selectOption('Contractor');await c('em-visit-result').selectOption('Pass');
  await c('em-visit-technician').fill('SCN SYNTHETIC ENGINEER');
  const findings='SCN SYNTHETIC CONTRACTOR CHECK ONLY - NO ACTUAL CARE';await c('em-visit-findings').fill(findings);
  await c('em-visit-vendor-id').selectOption(vendor);
  j.intents.push({account,asset_id:owned.asset_id,plan_id:plan.plan_id,action:'contractor Inspection visit',vendor_id:Number(vendor)});save();
  await c('em-visit-submit-btn').click();await expect(c('em-visit-submit-btn')).not.toBeVisible();
  const after=await read();const records=after.records.filter(r=>!before.records.some(b=>b.record_id===r.record_id));
  assert.equal(records.length,1);const record=records[0];assert.equal(record.vendor_id,Number(vendor));
  assert.equal(record.technician,'SCN SYNTHETIC ENGINEER');assert.equal(record.employee_id,null);assert.equal(record.findings,findings);
  await s.p.locator('tr').filter({hasText:'Inspection'}).locator('[data-help="em-edit-plan-btn"]').click();
  await c('em-plan-active').uncheck();await c('em-plan-edit-reason').fill('SCN SYNTHETIC contractor test complete');
  await c('em-plan-submit-btn').click();await expect(c('em-plan-submit-btn')).not.toBeVisible();
  assert.equal((await read()).plans.find(p=>p.plan_id===plan.plan_id).is_active,false);
  j.checks.push({account,asset_id:owned.asset_id,plan_id:plan.plan_id,record_id:record.record_id,vendor_id:record.vendor_id,result:'live named vendor choices; contractor plan and engineer attribution persisted; exactly one new visit; plan ended'});
  save();s.j.passed=true;s.save();
 } catch(error) {j.error=error.stack;if(s)j.failure_trace=await s.trace();save();console.error(error.stack);throw error;}
 finally {if(s)await s.close();}
}
j.passed=true;j.finished=new Date().toISOString();save();console.log(JSON.stringify(j.checks,null,2));

```
