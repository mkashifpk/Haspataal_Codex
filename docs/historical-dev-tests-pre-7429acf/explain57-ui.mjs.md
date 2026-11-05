# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const name=process.argv[2]||'explain57-ui',file='artifacts/'+name+'.json';
assert(!fs.existsSync(file),'Reconcile saved results; never rerun completed explanation writes');
const fixture=JSON.parse(fs.readFileSync('docs/explain57/scenario-result.json')).saved;
const first=JSON.parse(fs.readFileSync('docs/explain57/prepare-1-result.json')).body.data;
const second=JSON.parse(fs.readFileSync('docs/explain57/prepare-2-result.json')).body.data;
const j={passed:false,intents:[],estimates:[first.estimate_id,second.estimate_id]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));
let s,other;save();
try{
 s=await session(name+'-doctor','demo.doctor');const p=s.p;p.on('dialog',d=>d.accept());
 await s.nav('Explain a cost estimate');await expect(p.locator('[data-estimate-screen=explain_estimate]')).toBeVisible();
 await expect(p.getByRole('button',{name:'Prepare a revision',exact:true})).toHaveCount(0);
 await expect(p.getByRole('button',{name:'Cancel estimate',exact:true})).toHaveCount(0);
 // Pending admissions are not in the hospitalised worklist; open its real
 // prepared estimate first, then use the returned admission for chart history.
 await p.getByRole('button',{name:new RegExp(first.estimate_number+' ·')}).click();
 await p.getByRole('button',{name:'Read this admission history',exact:true}).click();
 await expect.poll(async()=> (await s.trace()).requests.some(r=>r.path.includes('/cost-estimates?')&&r.path.includes('admission_id='+fixture.admission_id)&&r.status===200)).toBe(true);
 await p.getByRole('button',{name:new RegExp(first.estimate_number+' ·')}).click();
 await expect(p.locator('article.card')).toContainText(first.estimate_number);
 await p.getByRole('button',{name:'Preview estimate form',exact:true}).click();await expect(p.getByRole('dialog')).toContainText(fixture.mrn);await p.keyboard.press('Escape');
 async function form(recipient){await p.getByRole('button',{name:'Mark explained',exact:true}).click();await p.getByRole('button',{name:'Review estimate action',exact:true}).click();await expect(p.getByRole('dialog')).toHaveCount(0);await p.getByLabel('Who heard the estimate',{exact:true}).fill(recipient);await p.getByLabel('Relationship to patient',{exact:true}).selectOption('Relative');await p.getByLabel('Language explained in',{exact:true}).selectOption('Urdu');await p.getByLabel('Questions and deposit agreement',{exact:true}).fill('DEMO software check only; no actual signature, payment or clinical care');await p.getByLabel('The family signed or thumb-printed the actual printed estimate',{exact:true}).check();await p.getByLabel('I checked this patient, admission and estimate action',{exact:true}).check();await help(s,p.getByLabel('Who heard the estimate',{exact:true}),'Explain a cost estimate');await p.getByRole('button',{name:'Review estimate action',exact:true}).click();await expect(p.getByRole('dialog')).toContainText(fixture.mrn);}
 await form('DEMO doctor family');await s.fault({failPath:'/cost-estimates/'+first.estimate_id+'/explain',failMethod:'POST',once:true});
 j.intents.push({action:'explain own synthetic estimate; deliberately lose actual server reply',id:first.estimate_id});save();
 await p.getByRole('dialog').getByRole('button',{name:'Confirm this estimate action',exact:true}).click();
 await expect(p.getByRole('button',{name:'Retry original request',exact:true})).toBeVisible();await expect(p.getByLabel('Who heard the estimate',{exact:true})).toHaveValue('DEMO doctor family');
 j.intents.push({action:'explicit SAME key/body replay',id:first.estimate_id});save();await p.getByRole('button',{name:'Retry original request',exact:true}).click();
 await expect(p.getByRole('button',{name:'Close estimate draft',exact:true})).toHaveCount(0);await expect(p.locator('article.card')).toContainText('Explained');await expect(p.getByRole('button',{name:'Mark explained',exact:true})).toHaveCount(0);
 j.explained=await s.native('api',{method:'GET',path:'/cost-estimates/'+first.estimate_id});assert.equal(j.explained.status,'Explained');assert(j.explained.explain_stamp.text);await expect(p.locator('article.card')).toContainText(j.explained.explain_stamp.text);save();
 // Actual native scoped PDF, separate from any explanation write.
 await s.app.evaluate(({dialog})=>{globalThis.explainSavePath='';dialog.showSaveDialog=async()=>globalThis.explainSavePath?{canceled:false,filePath:globalThis.explainSavePath}:{canceled:true};});j.pdfs=[];
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});const target=path.resolve('artifacts/'+name+'-'+language+'.pdf');await s.app.evaluate((_,f)=>{globalThis.explainSavePath=f},target);const result=await s.native('print-estimate',{screenId:'explain_estimate',estimateId:first.estimate_id,expectedVersion:j.explained.row_version,pdf:true});assert(result.saved);assert(fs.readFileSync(target).subarray(0,5).equals(Buffer.from('%PDF-')));j.pdfs.push({language,file:target});await p.screenshot({path:'public/handbook/explain_estimate-'+language+'.png',fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}save();}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await s.app.evaluate(()=>{globalThis.explainSavePath='';});assert.equal((await s.native('print-estimate',{screenId:'explain_estimate',estimateId:first.estimate_id,expectedVersion:j.explained.row_version,pdf:true})).saved,false);
 await p.getByRole('button',{name:new RegExp(second.estimate_number+' ·')}).click();await form('DEMO keep this doctor draft');
 other=await session(name+'-admissions','demo.admissions');const fresh=await other.native('api',{method:'GET',path:'/cost-estimates/'+second.estimate_id});assert.equal(fresh.patient_id,fixture.patient_id);assert.equal(fresh.status,'Draft');
 j.intents.push({action:'second terminal cancels own Draft estimate',id:second.estimate_id});save();
 j.cancelled=await other.native('api',{method:'POST',path:'/cost-estimates/'+second.estimate_id+'/cancel',body:{reason:'DEMO own synthetic concurrent state check; no actual care'},key:crypto.randomUUID()});assert.equal(j.cancelled.status,'Cancelled');save();
 const before=(await s.trace()).requests.filter(x=>x.method==='POST').length;
 await p.getByRole('dialog').getByRole('button',{name:'Confirm this estimate action',exact:true}).click();await expect(p.getByRole('dialog')).toHaveCount(0);await expect(p.getByLabel('Who heard the estimate',{exact:true})).toHaveValue('DEMO keep this doctor draft');await expect(p.locator('main')).toContainText('The estimate is now Cancelled');assert.equal((await s.trace()).requests.filter(x=>x.method==='POST').length,before);
 await p.getByRole('button',{name:'Close estimate draft',exact:true}).click();await expect(p.getByRole('button',{name:'Mark explained',exact:true})).toHaveCount(0);
 j.trace=await s.trace();j.otherTrace=await other.trace();const posts=j.trace.requests.filter(r=>r.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);assert.deepEqual(posts[0].body,posts[1].body);assert(posts[0].reply_lost);assert.equal(posts[1].replay,'true');assert(!j.trace.requests.some(r=>r.path.startsWith('/api/v1/admissions')));
 j.passed=true;save();console.log('PASS Doctor admission-filtered estimate explanation, same-key lost-reply recovery, final stamp/read-only record, concurrent cancellation retains draft/no POST, native ENUR PDFs, F1 and themes250');
}catch(e){j.error=e.stack;try{j.trace=await s?.trace();j.otherTrace=await other?.trace();j.ui=await s?.p.locator('body').innerText();}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(other)await other.close();if(s)await s.close();j.finished=new Date().toISOString();save();}

```
