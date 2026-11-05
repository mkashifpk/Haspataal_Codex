# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final renderer verification; one DISTINCT synthetic NoExpiry Law for language
// switching after confirmation. Withdraw it. Never rerun if journal exists.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {session,expect,capture} from './clinical-test-kit.mjs';
const file='artifacts/screen160/final-check.json',finishAccess=process.argv.includes('--finish-access'),resume=process.argv.includes('--resume-law')||finishAccess;assert(resume?fs.existsSync(file):!fs.existsSync(file),'Reconcile the final Law test journal before any rerun');
const prior=JSON.parse(fs.readFileSync('artifacts/screen160/journey.json'));assert(prior.passed);
const previous=resume?JSON.parse(fs.readFileSync(file)):undefined;if(resume){assert(previous.document_id&&!previous.passed);assert(finishAccess||previous.error?.includes("name: 'Close'"));fs.copyFileSync(file,finishAccess?'artifacts/screen160/final-check-quality-scope-failure.json':'artifacts/screen160/final-check-close-failure.json');}const j=previous||{started:new Date().toISOString(),title:'SCN160-LAW-'+Date.now().toString(36)+' SYNTHETIC LANGUAGE TEST ONLY',intents:[],checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
let s;
if(!finishAccess){
try {
 s=await session('screen160-final-ops','demo.ops');j.renderer=s.j.renderer;save();const c=(key,tag='')=>s.p.locator(`${tag}[data-help="${key}"]`);
 await s.nav('Licences, certificates and plans');await c('cr.filters','input').check();if(!resume){await c('cr.add').click();await c('cr.kind').selectOption('Law');await c('cr.category').selectOption('Other');await c('cr.title').fill(j.title);
 j.intents.push({action:'one distinct Law NoExpiry/confirmed-notice language test; later withdraw',title:j.title});save();await c('cr.submit').click();await expect(c('cr.submit')).not.toBeVisible();
 const created=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path.endsWith('/facility/compliance-documents'));j.document_id=created.result.data.document_id;save();assert.equal(created.result.data.state,'NoExpiry');assert.equal(created.result.data.valid_until,null);await expect(s.p.locator('[data-screen]')).toContainText('Confirmed on the server.');
 await s.prefs({language:'ur',theme:'Light',ui_scale_pct:100});await expect(s.p.locator('[data-screen]')).toContainText('سرور نے تصدیق کی');await expect(s.p.locator('[data-screen]')).not.toContainText('Confirmed on the server.');
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});
 await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});await c('cr.pdf','button').filter({hasText:'Save register PDF'}).click();await expect(s.p.locator('[data-screen]')).toContainText('File save cancelled.');
 await s.prefs({language:'ur',theme:'Light',ui_scale_pct:100});await expect(s.p.locator('[data-screen]')).toContainText('فائل محفوظ کرنا منسوخ');await expect(s.p.locator('[data-screen]')).not.toContainText('File save cancelled.');
 }else{
  const law=await s.native('api',{method:'GET',path:'/facility/compliance-documents/'+j.document_id});assert.equal(law.title,j.title);assert.equal(law.state,'NoExpiry');assert.equal(law.status,'Current');
  await c('cr.search').fill(j.title);await s.p.locator('.cr-list .cr-row').filter({hasText:j.title}).click();await expect(c('cr.withdraw')).toBeVisible();
  await s.app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});await c('cr.pdf','button').filter({hasText:'Save register PDF'}).click();await expect(s.p.locator('[data-screen]')).toContainText('File save cancelled.');await s.prefs({language:'ur',theme:'Light',ui_scale_pct:100});await expect(s.p.locator('[data-screen]')).toContainText('فائل محفوظ کرنا منسوخ');await expect(s.p.locator('[data-screen]')).not.toContainText('File save cancelled.');
  j.checks.push('Original final-check confirmation/cancel EN→UR assertions passed before its English Close selector failed in Urdu. Resumed actual Law ID without creating another; cancellation retranslation verified again.');save();
 }
 await c('cr.search').focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toHaveText('لائسنس، سرٹیفکیٹ اور منصوبے');await expect(s.p.locator('.help-control').filter({hasText:'موجودہ اندراجات تلاش کریں'})).toBeVisible();await s.p.getByRole('dialog').filter({has:s.p.locator('.help-layout')}).locator('.dialog-head [data-help="common.close"]').click();await expect(c('cr.search')).toBeFocused();
 await capture(s,'compliance_register_ops');j.checks.push('Real distinct Law has NoExpiry/null dates; confirmed-write and cancellation notices retranslate EN→UR in-place; Urdu F1 field instructions/focus; final EN/UR Light/DarkHighContrast100/250 screenshot/overflow checks.');save();
 await c('cr.withdraw').click();await c('cr.withdraw-reason').fill('SCN160 SYNTHETIC LANGUAGE TEST COMPLETE');j.intents.push({action:'withdraw owned Law',document_id:j.document_id});save();await c('cr.submit').click();await expect(c('cr.submit')).not.toBeVisible();const law=await s.native('api',{method:'GET',path:'/facility/compliance-documents/'+j.document_id});assert.equal(law.status,'Withdrawn');
 const key=crypto.randomUUID();j.intents.push({action:'closed-record correction refusal expected409',document_id:j.document_id,key,version:law.row_version});save();const refusal=await s.p.evaluate(args=>window.terminal.call('api',args),{method:'PUT',path:'/facility/compliance-documents/'+j.document_id,key,body:{expected_version:law.row_version,note:'SCN160 CLOSED WRITE MUST REFUSE'}});assert.equal(refusal.ok,false);assert.equal(refusal.status,409);assert.equal(refusal.error.code,'COMPLIANCE_DOCUMENT_CLOSED');j.closed_refusal={status:refusal.status,code:refusal.error.code,request_id:refusal.request_id};
 for(const [id,type]of[[prior.original_id,'application/pdf'],[prior.replacement_id,'image/png']]){const entry=await s.native('api',{method:'GET',path:'/facility/compliance-documents/'+id});assert(entry.has_scan);await s.native('compliance-scan',{documentId:id});await expect.poll(()=>s.app.evaluate(({BrowserWindow},type)=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().startsWith('data:'+type)).length,type)).toBe(1);await s.app.evaluate(({BrowserWindow},type)=>{for(const w of BrowserWindow.getAllWindows())if(w.webContents.getURL().startsWith('data:'+type))w.close();},type);}
 j.checks.push('Owned Law withdrawn; real closed correction409 COMPLIANCE_DOCUMENT_CLOSED, no rewrite. Prior18 PDF/19 PNG still readable through final native viewer.');save();s.j.passed=true;s.save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();s=undefined;}
}
try {
 s=await session('screen160-final-quality','demo.quality');const outline=await s.native('api',{method:'GET',path:'/meta/handbook?workspace=quality'});assert.equal(JSON.stringify(outline).includes('compliance_register_ops'),false);await expect(s.p.getByRole('navigation').getByRole('button',{name:'Licences, certificates and plans',exact:true})).toHaveCount(0);const rows=await s.native('api',{method:'GET',path:'/facility/compliance-documents?include_closed=true'});assert.equal(rows.find(r=>r.document_id===j.document_id).status,'Withdrawn');assert.equal(rows.find(r=>r.document_id===prior.original_id).status,'Renewed');assert.equal(rows.find(r=>r.document_id===prior.replacement_id).status,'Withdrawn');j.checks.push('Quality native API reads actual new records; server-scoped quality handbook excludes Operations screen160, so no unsupported navigation is exposed. Quality counterpart remains separate roadmap work.');s.j.passed=true;s.save();save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();s=undefined;}
try {
 s=await session('screen160-final-denied','demo.reception');await expect(s.p.getByRole('navigation').getByRole('button',{name:'Licences, certificates and plans',exact:true})).toHaveCount(0);
 for(const [action,args]of[['compliance-scan',{documentId:prior.original_id}],['clinical-pdf',{path:'/facility/compliance-documents/register/pdf',preview:true}],['download',{path:'/facility/compliance-documents/register/pdf'}]]){const reply=await s.p.evaluate(v=>window.terminal.call(v.action,v.args),{action,args});assert.equal(reply.ok,false);assert.match(reply.error.message,/permission/i);}
 assert(!(await s.trace()).requests.some(r=>r.path.includes('/facility/compliance-documents')));j.checks.push('Reception has no register route; native scan/preview/PDF Save denied before HTTP.');s.j.passed=true;s.save();save();
}catch(error){j.error=error.stack;if(s)j.failure_trace=await s.trace();save();throw error;}finally{if(s)await s.close();}
j.passed=true;j.finished=new Date().toISOString();save();console.log(JSON.stringify({passed:j.passed,document_id:j.document_id,checks:j.checks},null,2));

```
