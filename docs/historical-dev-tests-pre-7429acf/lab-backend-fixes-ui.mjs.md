# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Fresh owned fixture from the MCP sandbox journal; NEVER creates/repeats a patient or payment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('artifacts/lab-backend-fixes-2026-10-27.json'));
const req=fixture.writes.create.response.body.data.requisition;
const file='artifacts/lab-backend-fixes-ui.json';
const resume=process.argv.includes('--resume-after-published');
if(fs.existsSync(file)&&!resume)throw Error('Reconcile existing UI journal before another run. Never repeat decisions.');
const j=resume?JSON.parse(fs.readFileSync(file)):{run:fixture.run,started:new Date().toISOString(),checks:[],writes:{}};
if(resume){assert(j.finished&&j.writes.CBC?.state==='confirmed-reply-lost'&&!j.writes.RBS);j.previous_error=j.error;delete j.error;delete j.finished;j.resumed=new Date().toISOString();}
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
const actors=[];let r,t,v;
const launch=async(name,user)=>{const s=await session(name,user);actors.push(s);return s;};
try{
 r=await launch('labfix-reception','demo.reception');await r.nav('Lab-only walk-in');
 await r.p.getByLabel('Known lab requisition ID',{exact:true}).fill(String(req.requisition_id));
 await r.p.getByRole('button',{name:'Open lab requisition',exact:true}).click();
 await expect(r.p.locator('main')).toContainText(req.patient_name);
 if(!resume)await expect(r.p.locator('main')).toContainText('LAB_REPORT_NOT_READY');
 await help(r,r.p.getByRole('button',{name:'Refresh lab walk-in',exact:true}),'Lab-only walk-in');
 t=await launch('labfix-tech','demo.labtech');await t.nav('Scanner-first lab bench');
 await t.p.getByRole('button',{name:'Arm sample scanner',exact:true}).click();
 await t.p.keyboard.type(req.items[1].barcode);await t.p.keyboard.press('Enter');
 await expect(t.p.getByLabel('Interpretation',{exact:true})).toBeVisible();
 await t.p.getByLabel('Interpretation',{exact:true}).fill('PRESERVE THIS UNSENT SYNTHETIC DRAFT');
 await help(t,t.p.getByRole('button',{name:'Print sample label',exact:true}),'Scanner-first lab bench');
 if(!resume){
 // Counted label GET: a real reply is lost, and transport must NOT replay it.
 const labelPath=`/api/v1/lab/samples/${req.items[1].sample_id}/label`;
 assert.equal((await t.trace()).requests.filter(x=>x.path===labelPath).length,0);
 j.writes.label={path:labelPath,state:'prepared-counted-read'};save();
 await t.fault({failPath:labelPath,failMethod:'GET',once:true});
 await t.p.getByRole('button',{name:'Print sample label',exact:true}).evaluate(b=>{b.click();b.click();});
 await expect(t.p.getByRole('button',{name:'Print sample label',exact:true})).toBeEnabled();
 const labels=(await t.trace()).requests.filter(x=>x.path===labelPath);
 assert.equal(labels.length,1);assert.equal(labels[0].status,200);assert(labels[0].reply_lost);
 j.writes.label={state:'confirmed-reply-lost-no-replay',request:labels[0]};save();
 pass('Mount/F1/scan made zero label reads; double-click/lost200 made one counted GET, no transport replay');
 const baseline=(await t.trace()).requests.length;
 j.ready=true;j.baseline=baseline;save();console.log('READY_FOR_SANDBOX_RESULTS');
 // Wait only for the external MCP sandbox writes; no fabricated successes.
 for(let i=0;i<120&&!fs.existsSync('artifacts/labfix-results-ready.json');i++)await new Promise(resolve=>setTimeout(resolve,1000));
 assert(fs.existsSync('artifacts/labfix-results-ready.json'),'Sandbox results not ready; no clinical UI decisions attempted');
 await expect.poll(async()=> (await t.trace()).requests.slice(baseline).filter(x=>x.path.startsWith('/api/v1/lab/worklist')&&x.finished).length).toBeGreaterThan(0);
 assert.equal((await t.trace()).requests.slice(baseline).filter(x=>x.path.startsWith('/api/v1/lab/scan/')).length,0);
 await expect(t.p.getByLabel('Interpretation',{exact:true})).toHaveValue('PRESERVE THIS UNSENT SYNTHETIC DRAFT');
 pass('Actual pending-verification events refreshed worklist, preserved selected sample/unsent draft, no scan refetch');
 }
 v=await launch('labfix-verifier','demo.labverifier');await v.nav('Verification queue');
 await v.p.getByLabel('Find in queue',{exact:true}).fill(req.patient_name);
 await expect(v.p.locator('tbody tr')).toHaveCount(resume?1:2);
 if(resume){const actual=await v.native('api',{method:'GET',path:'/lab/requisitions/'+req.requisition_id});assert(actual.results.some(x=>x.result_id===j.writes.CBC.result_id&&x.status==='Published'&&x.verified_stamp));pass('Resumed only after exact CBC result was confirmed Published with stamp; no repeated decision');}
 const first=v.p.locator('tbody tr').filter({hasText:resume?'RBS':'CBC'});
 await first.getByRole('button',{name:'Inspect',exact:true}).click();
 await v.p.getByRole('button',{name:'Requisition detail',exact:true}).last().click();
 await expect(v.p.getByRole('dialog')).toContainText(req.requisition_number);
 await v.p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).last().click();
 await help(v,first.getByRole('button',{name:'Verify',exact:true}),'Verification queue');
 for(const [code,decision,confirm] of [['CBC','Verified','Confirm & publish'],['RBS','Rejected','Confirm rejection']]){
   if(resume&&code==='CBC')continue;
   const row=v.p.locator('tbody tr').filter({hasText:code});
   await row.getByRole('button',{name:decision==='Verified'?'Verify':'Reject',exact:true}).click();
   const modal=v.p.getByRole('dialog');
   if(decision==='Rejected')await modal.locator('textarea').fill(fixture.run+' synthetic review rejection; no real specimen');
   else {await expect(modal).toContainText('Server deadline');await expect(modal.locator('[data-help="verification.delay_reason"]')).toHaveCount(0);}
   const resultId=Number((await modal.innerText()).match(/result #(\d+)/)[1]);
   const path=`/api/v1/lab/results/${resultId}/verify`;
   j.writes[code]={path,decision,requisition_id:req.requisition_id,result_id:resultId,state:'prepared'};save();
   await v.fault({failPath:path,failMethod:'POST',once:true});
   await modal.getByRole('button',{name:confirm,exact:true}).evaluate(b=>{b.click();b.click();});
   await expect(modal).toContainText('Answer lost.');
   const calls=(await v.trace()).requests.filter(x=>x.path===path&&x.method==='POST');
   assert.equal(calls.length,1);assert.equal(calls[0].status,200);
   j.writes[code]={...j.writes[code],state:'confirmed-reply-lost',request:calls[0]};save();
   await expect(modal.getByRole('button',{name:confirm,exact:true})).toBeDisabled();
   assert.equal(await modal.getByRole('button',{name:'Retry original request',exact:true}).count(),0);
   await modal.getByRole('button',{name:'Read current result',exact:true}).click();
   await expect(modal).toContainText(decision==='Verified'?'Published':'Rejected');
   if(decision==='Verified')await expect(modal).toContainText('verified stamp');
   await modal.getByRole('button',{name:'Decision reviewed; return to queue',exact:true}).click();
   await expect(modal).toHaveCount(0);
   pass(code+' lost decision reconciled exact original requisition/result; one POST, no replay');
 }
 await expect(r.p.locator('main')).toContainText('Partial report: some tests are still running.');
 const reports=(await r.trace()).requests.filter(x=>x.path===`/api/v1/lab/requisitions/${req.requisition_id}/report/print-payload`&&x.status===200);
 assert(reports.length);assert.equal(reports.at(-1).result.data.fields.complete,false);
 assert.equal(reports.at(-1).result.data.fields.results.length,1);
 pass('Reception auto-refreshed on actual publication; only actual print-payload unlocked partial report');
 for(const [s,screen] of [[r,'lab_only_walkin'],[t,'lab_bench'],[v,'lab_verification']])await capture(s,screen);
 j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1;}
finally{for(const a of actors.reverse())await a.close();j.finished=new Date().toISOString();save();}

```
