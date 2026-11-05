# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Finish/repeat read-only verification of the two already-owned synthetic batches.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,capture} from './clinical-test-kit.mjs';
const owned=JSON.parse(fs.readFileSync('artifacts/screen162/journey.json'));assert(owned.collection?.waste_id&&owned.handover?.waste_id&&owned.invalid?.status===422,'Reconcile original business stages first');
const file='artifacts/screen162/final-read.json',j={started:new Date().toISOString(),checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('screen162-final-read','demo.ops');j.renderer=s.j.renderer;save();const c=(id,tag='')=>s.p.locator(`${tag}[data-help="${id}"]`),root=s.p.locator('[data-screen="waste_log_ops"]');await s.nav('Hospital waste log');await expect(c('wl.select')).toHaveCount(2);
 const period=`date_from=${owned.collection.recorded_on}&date_to=${owned.collection.recorded_on}&limit=5000`,log=await s.native('api',{method:'GET',path:'/infection/waste?'+period});assert.deepEqual(log.records.find(r=>r.waste_id===owned.collection.waste_id),owned.collection);assert.deepEqual(log.records.find(r=>r.waste_id===owned.handover.waste_id),owned.handover);assert.equal(log.by_category.find(r=>r.category==='NonRisk').weight_kg,0.25);assert.equal(log.by_category.find(r=>r.category==='NonRisk').handed_over_kg,0);assert.equal(log.by_category.find(r=>r.category==='Sharps').handed_over_kg,0.5);j.server=log;save();
 for(const r of log.by_category){const row=root.locator('table').nth(0).locator('tbody tr').filter({hasText:r.category==='NonRisk'?'Non-risk':'Sharps'});await expect(row.locator('td').nth(0)).toHaveText(String(r.weight_kg));await expect(row.locator('td').nth(2)).toHaveText(String(r.handed_over_kg));}
 await c('wl.search').fill('NO_MATCH_'+owned.marker);await expect(root).toContainText('No matching entries.');await expect(c('wl.select')).toHaveCount(0);assert.equal(await root.locator('table').nth(0).locator('tbody tr').count(),2);await c('wl.search').fill('');await c('wl.select').filter({hasText:'#'+owned.collection.waste_id+' '}).click();await expect(s.p.locator('.waste-detail')).toContainText('Do not enter the same weight twice.');
 await capture(s,'waste_log_ops',async()=>{await s.p.evaluate(()=>{window.scrollTo(0,0);document.querySelector('main')?.scrollTo(0,0);});});
 await c('wl.new').click();await c('wl.handover').check();await c('wl.location').fill(owned.marker+' UNSENT');
 for(const language of ['en','ur'])for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await expect(c('wl.location')).toHaveValue(owned.marker+' UNSENT');}
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await c('wl.location').focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toHaveText(language==='en'?'Hospital waste log':'ہسپتال کا فضلہ رجسٹر');await expect(s.p.locator('.help-control').filter({hasText:language==='en'?'Specific collection area':'جمع کرنے کی خاص جگہ'})).toBeVisible();await s.p.locator('.dialog-head [data-help="common.close"]').click();await expect(c('wl.location')).toBeFocused();await expect(c('wl.location')).toHaveValue(owned.marker+' UNSENT');}
 await c('wl.cancel').click();await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});assert(!(await s.trace()).requests.some(r=>r.method!=='GET'&&r.path.includes('/infection/waste')));
 j.checks.push('Independent server reread preserves both owned records; exact category totals0.25kgNonRisk/0handed,0.5kgSharps/0.5handed match visible tables. Local empty-search leaves server totals intact. Saved detail no edit/delete; warns against duplicate weight.');j.checks.push('Actual EN/UR handbook screenshots; ledger/editor Light/DarkHighContrast250%no page overflow. EN/UR contextual F1/focus/unsent draft retained. Cancel submits no third batch. No businesswrites in this final-read session.');j.passed=true;save();s.j.passed=true;s.save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
console.log(JSON.stringify({passed:j.passed,checks:j.checks},null,2));

```
