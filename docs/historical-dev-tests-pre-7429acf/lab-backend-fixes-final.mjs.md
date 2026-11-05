# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final renderer: actual DEV reads/printing and real incoming publication. No clinical POSTs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('artifacts/lab-backend-fixes-2026-10-27.json'));
const req=fixture.writes.scopeCreate.response.body.data.requisition;
const file='artifacts/lab-backend-fixes-final.json';
if(fs.existsSync(file)){
 if(!process.argv.includes('--resume-after-printer-cancel'))throw Error('Reconcile final test journal; do not repeat counted label reads.');
 const old=JSON.parse(fs.readFileSync(file));assert(old.finished&&old.error&&old.writes.print.state==='prepared-counted-read');
 fs.copyFileSync(file,file.replace('.json','-diagnostic-'+Date.now()+'.json'));
}
const j={run:fixture.run,started:new Date().toISOString(),checks:[],writes:{}};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
const actors=[];const start=async(n,u)=>{const s=await session(n,u);actors.push(s);return s;};
try{
 const r=await start('labfix-final-reception','demo.reception');await r.nav('Lab-only walk-in');
 const p=r.p;
 await p.getByLabel('Known lab requisition ID',{exact:true}).fill(String(req.requisition_id));await p.getByRole('button',{name:'Open lab requisition',exact:true}).click();
 await expect(p.locator('main')).toContainText(req.patient_name);await expect(p.locator('main')).toContainText('LAB_REPORT_NOT_READY');
 // Adversarial wire-envelope test: event values are deliberately NOT real clinical values.
 // The actual old patient's publication must cause zero reads for the new patient.
 const before=(await r.trace()).requests.length;
 const event=fixture.published_reception.events[0];assert(event.payload.patient_id!==req.patient_id);
 await r.app.evaluate(({BrowserWindow},e)=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('terminal-event',e);},event);
 await p.waitForTimeout(400);
 assert.equal((await r.trace()).requests.slice(before).filter(x=>x.path.startsWith('/api/v1/lab/')).length,0);
 pass('Another real patient’s published event makes zero Lab reads and leaves current Reception context unchanged');
 const t=await start('labfix-final-tech','demo.labtech');await t.nav('Scanner-first lab bench');
 await t.app.evaluate(({app,BrowserWindow})=>{
   for(const w of BrowserWindow.getAllWindows())w.webContents.getPrintersAsync=async()=>[];
   app.on('web-contents-created',(_,contents)=>{contents.print=(_,callback)=>callback(false,'TEST: native label printer cancelled');});
 });
 const q=t.p;await q.getByRole('button',{name:'Arm sample scanner',exact:true}).click();await q.keyboard.type(req.items[0].barcode);await q.keyboard.press('Enter');
 await expect(q.getByLabel('Interpretation',{exact:true})).toBeVisible();
 const sample=await t.native('api',{method:'GET',path:'/lab/scan/'+req.items[0].barcode});
 const labelPath=`/api/v1/lab/samples/${req.items[0].sample_id}/label`;
 assert.equal((await t.trace()).requests.filter(x=>x.path===labelPath).length,0);
 j.writes.print={path:labelPath,state:'prepared-counted-read'};save();
 await q.getByRole('button',{name:'Print sample label',exact:true}).evaluate(b=>{b.click();b.click();});
 await expect(q.getByRole('button',{name:'Print sample label',exact:true})).toBeEnabled();
 const calls=(await t.trace()).requests.filter(x=>x.path===labelPath);assert.equal(calls.length,1);assert.equal(calls[0].status,200);
 await expect(q.locator('pre')).toHaveText(calls[0].result.data.text); // Preserve the server’s intentionally shortened tube-label text exactly.
 j.writes.print={state:'confirmed',request:calls[0]};save();
 const after=await t.native('api',{method:'GET',path:'/lab/scan/'+req.items[0].barcode});
 assert.equal(after.sample.label_print_count,sample.sample.label_print_count+1);assert.equal(after.sample.row_version,sample.sample.row_version);
 pass('Final native print returns exact server label on printer failure; double-click one GET, actual count +1, stable version');
 j.ready=true;save();console.log('READY_FOR_FINAL_PUBLICATION');
 await expect(p.locator('main')).toContainText('All reported tests complete.',{timeout:180000});
 const reports=(await r.trace()).requests.filter(x=>x.path===`/api/v1/lab/requisitions/${req.requisition_id}/report/print-payload`&&x.status===200);
 assert(reports.length&&reports.at(-1).result.data.fields.complete===true);
 pass('Final scoped handler receives real publication, validates actual LabOnly order and automatically offers real signed report');
 // A matching critical envelope is only a hint: ordinary DEV reads still supply all values.
 await r.app.evaluate(({BrowserWindow},value)=>{for(const w of BrowserWindow.getAllWindows())w.webContents.send('terminal-event',value);},
   {type:'event',event_type:'lab.result.published',event_id:-27029,priority:'critical',payload:{patient_id:req.patient_id,requisition_id:req.requisition_id,patient_name:'DO_NOT_DISPLAY_EVENT_PHI',test_name:'DO_NOT_DISPLAY_EVENT_PHI',has_critical_value:true}});
 await expect.poll(async()=> (await r.trace()).requests.filter(x=>x.path===`/api/v1/lab/requisitions/${req.requisition_id}/report/print-payload`&&x.status===200).length).toBeGreaterThan(reports.length);
 await expect(p.locator('body')).not.toContainText('DO_NOT_DISPLAY_EVENT_PHI');
 pass('Adversarial matching critical envelope refreshes real records without displaying any event PHI/flags/priority');
 const v=await start('labfix-final-verifier','demo.labverifier');await v.nav('Verification queue');
 await help(v,v.p.getByLabel('Find in queue',{exact:true}),'Verification queue');
 for(const [s,id] of [[r,'lab_only_walkin'],[t,'lab_bench'],[v,'lab_verification']]){
   await s.p.evaluate(()=>window.scrollTo(0,0));await capture(s,id);
 }
 j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1;}
finally{for(const a of actors.reverse())await a.close();j.finished=new Date().toISOString();save();}

```
