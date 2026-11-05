# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final-build calibration/certificate/replay cases on the two already-owned
// assets. Never registers replacements; every uncertain write stays journalled.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const file='artifacts/continuation-20261104/equipment-calibration.json';assert(!fs.existsSync(file),'Reconcile calibration journal before any retry');
const j={started:new Date().toISOString(),checks:[],intents:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
for(const [account,fixtureFile]of [['demo.maintenance','equipment-write.json'],['demo.ops','equipment-write-ops.json']]){
 const owned=JSON.parse(fs.readFileSync('artifacts/continuation-20261104/'+fixtureFile));let s;
 try{
  s=await session('resume1104-calibration-'+account.split('.')[1],account);const c=k=>s.p.locator(`[data-help="${k}"]`);const read=()=>s.native('api',{method:'GET',path:`/facility/equipment/${owned.asset_id}`});
  const before=await read();assert.equal(before.asset_tag,owned.tag);assert(!before.plans.some(p=>p.kind==='Calibration'&&p.is_active));
  await s.nav('Medical equipment and maintenance');await c('em-tab-inventory').click();await c('em-inv-search').fill(owned.tag);await c('em-inv-item').filter({hasText:owned.tag}).click();await c('em-add-plan-btn').click();
  await c('em-plan-kind').selectOption('Calibration');await c('em-plan-interval').fill('180');await c('em-plan-due-date').fill(new Date(Date.now()+30*86400000).toISOString().slice(0,10));await c('em-plan-oem').fill('SCN SYNTHETIC CALIBRATION TEST MANUAL - NOT REAL OEM GUIDANCE');j.intents.push({account,asset_id:owned.asset_id,action:'create distinct Calibration plan'});save();await c('em-plan-submit-btn').click();await expect(c('em-plan-submit-btn')).not.toBeVisible();
  await c('em-detail-record-visit-btn').click();await c('em-visit-kind').selectOption('Calibration');await c('em-visit-result').selectOption('Pass');await c('em-visit-staff-select').selectOption(String(owned.employee_id));await c('em-visit-findings').fill('SCN SYNTHETIC CALIBRATION ONLY - NO ACTUAL TEST DEVICE');
  const postsBefore=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith(`/equipment/${owned.asset_id}/maintenance`)).length;
  await c('em-visit-submit-btn').click();await expect(c('em-visit-submit-btn')).toBeVisible();assert.equal((await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith(`/equipment/${owned.asset_id}/maintenance`)).length,postsBefore);
  const certificate='SCN-CAL-'+owned.asset_id+'-NOT-A-REAL-CERT';await c('em-visit-cert').fill(certificate);j.intents.push({account,asset_id:owned.asset_id,action:'actual DEV synthetic Calibration with certificate, lose reply and replay original'});save();await s.fault({failPath:`/equipment/${owned.asset_id}/maintenance`,failMethod:'POST',once:true});await c('em-visit-submit-btn').click();await expect(c('em-retry-original')).toBeEnabled();await s.p.keyboard.press('Tab');await expect(c('em-retry-original')).toBeFocused();await c('em-retry-original').click();await expect(c('em-retry-original')).not.toBeVisible();
  const after=await read();const record=after.records.filter(r=>r.kind==='Calibration');assert.equal(record.length,1);assert.equal(record[0].certificate_no,certificate);assert.equal(after.status,'Active');const requests=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith(`/equipment/${owned.asset_id}/maintenance`)&&r.body?.kind==='Calibration');assert.equal(requests.length,2);assert.equal(requests[0].key,requests[1].key);assert.deepEqual(requests[0].body,requests[1].body);assert.equal(requests[1].replay,'true');
  await s.p.locator('tr').filter({hasText:'Calibration'}).locator('[data-help="em-edit-plan-btn"]').click();await c('em-plan-active').uncheck();await c('em-plan-edit-reason').fill('SCN SYNTHETIC calibration plan test complete');await c('em-plan-submit-btn').click();await expect(c('em-plan-submit-btn')).not.toBeVisible();assert.equal((await read()).plans.find(p=>p.kind==='Calibration').is_active,false);
  j.checks.push({account,asset_id:owned.asset_id,record_id:record[0].record_id,request_id:requests[1].result.request_id,key:requests[1].key,result:'missing certificate blocks before HTTP; real certificate persists; focus stays on original retry; same key/body replay leaves exactly one Calibration; plan ended'});save();s.j.passed=true;s.save();
 }catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();console.error(error.stack);process.exitCode=1;throw error;}finally{if(s)await s.close();}
}
j.passed=true;j.finished=new Date().toISOString();save();console.log(JSON.stringify(j.checks,null,2));

```
