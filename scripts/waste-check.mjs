// Real shared DEV. Creates two visibly synthetic waste entries, no real waste.
// Never rerun creation after failure: reconcile journal IDs and original keys first.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {session,expect,capture} from './clinical-test-kit.mjs';
fs.mkdirSync('artifacts/screen162',{recursive:true});
const file='artifacts/screen162/journey.json';assert(!fs.existsSync(file),'Reconcile journal before rerunning business writes');
const j={started:new Date().toISOString(),marker:'SCN162-'+Date.now().toString(36)+' SYNTHETIC TEST ONLY - NO ACTUAL WASTE',intents:[],checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('screen162-ops','demo.ops');j.renderer=s.j.renderer;save();
 const c=(id,tag='')=>s.p.locator(`${tag}[data-help="${id}"]`),root=s.p.locator('[data-screen="waste_log_ops"]');
 const intent=(action,more={})=>{j.intents.push({action,...more});save();};
 const raw=args=>s.p.evaluate(v=>window.terminal.call('api',v),args);
 await s.nav('Hospital waste log');await expect(root).toBeVisible();await expect(c('wl.new')).toBeEnabled();
 const before=await s.native('api',{method:'GET',path:'/infection/waste?limit=5000'});j.before=before;save();
 await c('wl.new').click();await c('wl.category').selectOption('NonRisk');await c('wl.location').fill(j.marker);await c('wl.weight').fill('0.25');
 await c('wl.location').focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toHaveText('Hospital waste log');await expect(s.p.locator('.help-control').filter({hasText:'Specific collection area'}).first()).toBeVisible();await s.p.locator('.dialog-head [data-help="common.close"]').click();await expect(c('wl.location')).toBeFocused();assert.equal(await c('wl.location').inputValue(),j.marker);
 await c('wl.handover').check();await expect(c('wl.vendor').locator('option')).not.toHaveCount(1);const vendor=await c('wl.vendor').locator('option:not([value=""]):not([disabled])').first().getAttribute('value');assert(vendor);j.vendor_id=Number(vendor);await c('wl.vendor').selectOption(vendor);await c('wl.manifest').fill('SCN162 HIDDEN MUST NOT BE SENT');await c('wl.disposal').selectOption('Recycling');await c('wl.handover').uncheck();await c('wl.note').fill(j.marker+' COLLECTION ONLY');
 intent('Create one collection-only synthetic NonRisk0.25kg; drop real committed reply');await s.fault({failPath:'/infection/waste',failMethod:'POST',once:true});await c('wl.save').click();
 const retry=s.p.getByRole('button',{name:'Retry original request',exact:true});await expect(retry).toBeEnabled();await expect(c('wl.weight')).toBeDisabled();await expect(c('wl.cancel')).toBeDisabled();await s.p.keyboard.press('Control+,');await expect(root).toBeVisible();await retry.click();await expect(c('wl.save')).not.toBeVisible();
 const creates=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/infection/waste'));assert.equal(creates.length,2);assert.equal(creates[0].key,creates[1].key);assert.deepEqual(creates[0].body,creates[1].body);assert.equal(creates[1].replay,'true');assert.equal(creates[0].body.vendor_id,null);assert.equal(creates[0].body.manifest_number,null);assert.equal(creates[0].body.disposal,null);assert.equal(creates[0].body.bags,null);
 j.collection=creates[0].result.data;save();assert(j.collection.waste_id);await expect(s.p.locator('.waste-detail')).toContainText('#'+j.collection.waste_id);
 const period=`date_from=${j.collection.recorded_on}&date_to=${j.collection.recorded_on}&limit=5000`;
 const collectionLog=await s.native('api',{method:'GET',path:'/infection/waste?'+period});assert.equal(collectionLog.records.filter(r=>r.waste_id===j.collection.waste_id).length,1);assert.equal(collectionLog.records.find(r=>r.waste_id===j.collection.waste_id).vendor_id,null);j.after_collection=collectionLog;save();
 j.checks.push('Actual collection-only create/reply loss/same-key-body replay with one saved effect; blank bags remain null; hidden handover excluded; input/cancel/navigation held. Contextual F1 restores focus and draft.');save();
 // Reproduce missing later-handover operation against this exact owned collection.
 const updateBody={vendor_id:j.vendor_id,manifest_number:'SCN162 GAP PROBE - NO ACTUAL HANDOVER',disposal:'Recycling'};
 for(const [method,path] of [['PUT','/infection/waste/'+j.collection.waste_id],['POST','/infection/waste/'+j.collection.waste_id+'/handover']]){
  const key=crypto.randomUUID();intent('Missing-workflow probe on own collection; expected404/405',{method,path,key,body:updateBody});const r=await raw({method,path,key,body:updateBody});assert.equal(r.ok,false);assert.equal(r.error.code,'TERMINAL_ERROR');assert.match(r.error.message,/outside the foundation contract/);j.handover_probes??=[];j.handover_probes.push({method,path,status:r.status,code:r.error?.code,request_id:r.request_id});save();
 }
 const afterProbe=await s.native('api',{method:'GET',path:'/infection/waste?'+period});assert.deepEqual(afterProbe.records.find(r=>r.waste_id===j.collection.waste_id),j.collection);
 // A separate newly collected synthetic batch whose handover is known at creation.
 await c('wl.new').click();await c('wl.category').selectOption('Sharps');await c('wl.location').fill(j.marker+' DISTINCT SECOND BATCH');await c('wl.weight').fill('0.5');await c('wl.bags').fill('1');await c('wl.handover').check();await c('wl.vendor').selectOption(vendor);await c('wl.manifest').fill('SCN162-'+Date.now().toString(36));await c('wl.disposal').selectOption('Encapsulation');await c('wl.note').fill(j.marker+' DISTINCT TEST BATCH WITH SYNTHETIC CONSIGNMENT - NO ACTUAL HANDOVER');
 intent('Create separate0.5kgSharps synthetic batch with actual registered vendor ID and synthetic consignment');await c('wl.save').click();await expect(c('wl.save')).not.toBeVisible();const second=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/infection/waste')).at(-1);assert.equal(second.status,201);j.handover=second.result.data;save();assert.equal(j.handover.vendor_id,j.vendor_id);assert.equal(j.handover.bags,1);assert.equal(j.handover.weight_kg,0.5);
 const final=await s.native('api',{method:'GET',path:'/infection/waste?'+period});j.final=final;save();assert(final.records.some(r=>r.waste_id===j.handover.waste_id));
 const body={category:'NonRisk',location:j.marker,weight_kg:0};const key=crypto.randomUUID();intent('Backend validation-negative zero-weight request',{key,body});const invalid=await raw({method:'POST',path:'/infection/waste',key,body});assert.equal(invalid.ok,false);assert.equal(invalid.status,422);j.invalid={status:invalid.status,code:invalid.error?.code,request_id:invalid.request_id};save();
 await c('wl.filters','input').nth(0).fill(j.collection.recorded_on);await c('wl.filters','input').nth(1).fill(j.collection.recorded_on);await expect(root).not.toContainText('Loading waste log…');await c('wl.search').fill(j.marker);await expect(c('wl.select')).toHaveCount(2);await c('wl.search').fill('NO_MATCH_'+j.marker);await expect(root).toContainText('No matching entries.');await c('wl.search').fill('');
 await c('wl.select').filter({hasText:'#'+j.collection.waste_id+' '}).click();await expect(s.p.locator('.waste-detail')).toContainText('Do not enter the same weight twice.');
 await capture(s,'waste_log_ops');
 // Also inspect an unsent handover form in Urdu/high zoom and cancel, no third batch.
 await c('wl.new').click();await c('wl.handover').check();await c('wl.location').fill(j.marker+' UNSENT');
 for(const language of ['en','ur']){await s.prefs({language,theme:'DarkHighContrast',ui_scale_pct:250});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await c('wl.location').focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toHaveText(language==='en'?'Hospital waste log':'ہسپتال کا فضلہ رجسٹر');await s.p.locator('.dialog-head [data-help="common.close"]').click();await expect(c('wl.location')).toBeFocused();assert.equal(await c('wl.location').inputValue(),j.marker+' UNSENT');}
 await c('wl.cancel').click();await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});
 j.checks.push('Separate synthetic batch with consignment saved, zero-weight422, server rereads, date/local-search/empty states, real EN/UR screenshots and Light/DarkHighContrast250%ledger/editor without horizontal page overflow. Urdu F1 retains focus/draft. Missing later-handover404 probes leave own collection unchanged.');j.passed=true;save();s.j.passed=true;s.save();
}catch(error){j.error=error.stack;if(s){j.failure_trace=await s.trace();try{j.failure_ui=await s.p.locator('[data-screen]').innerText();}catch{}}save();throw error;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
console.log(JSON.stringify({passed:j.passed,collection:j.collection?.waste_id,handover:j.handover?.waste_id,checks:j.checks},null,2));
