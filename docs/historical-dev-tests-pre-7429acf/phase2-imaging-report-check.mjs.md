# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Actual DEV Doctor order/read/print and separate radiology roles; no invented study or viewer.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-imaging-report-check-2026-10-24.json',control='docs/phase2-imaging-upstream-2026-10-24.json';
const resume=process.argv.includes('--resume');assert(resume || !fs.existsSync(file),'Reconcile original imaging journal before another order');
const j=resume?JSON.parse(fs.readFileSync(file)):{run:'DEMO-P2-IMAGING-'+Date.now(),patient_id:21,ticket_id:15},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
assert(!j.order_pending,'Reconcile original uncertain order before resuming');
const s=await session('phase2-imaging-report-check','demo.doctor'),p=s.p;
try{
 await p.evaluate(()=>{window.imagingEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.imagingEvents.push(e)})});
 await s.nav('Lab & imaging orders + results');await p.getByLabel('OPD slip number',{exact:true}).fill('OPD-2026-000015');await p.getByRole('button',{name:'Open slip',exact:true}).click();
 if(!j.order){
 await p.getByLabel('Imaging modality',{exact:true}).selectOption('XRay');await p.getByLabel('Body part / examination',{exact:true}).fill('DEMO Chest software report test; no actual examination');await p.getByLabel('Clinical indication',{exact:true}).fill(j.run+' software simulation only, no actual radiation or care');await p.getByLabel('Laterality',{exact:true}).selectOption('NotApplicable');
 const select=p.getByLabel('Catalogued imaging service',{exact:true});await expect(select.locator('option').filter({hasText:'XR-CHEST'})).toHaveCount(1);const label=(await select.locator('option').allTextContents()).find(x=>x.trim().startsWith('XR-CHEST'));assert(label);await select.selectOption({label});
 j.order_pending=true;save();await p.getByRole('button',{name:'Create imaging order',exact:true}).click();
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.method==='POST'&&r.path==='/api/v1/imaging/orders'&&r.status===201)).toBe(true);
 j.original_order=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path==='/api/v1/imaging/orders');j.order=j.original_order.result.data;j.order_pending=false;save();
 }else{const actual=await s.native('api',{method:'GET',path:`/imaging/orders/${j.order.imaging_order_id}`});assert.equal(actual.patient_id,21);await p.getByRole('button').filter({hasText:j.order.order_number}).first().click();}
 await expect(p.locator('main')).toContainText(j.order.accession_number);assert.equal(await p.getByRole('button',{name:'Print imaging report',exact:true}).count(),0);j.ready=true;save();console.log('WAIT actual imaging report '+j.order.imaging_order_id);
 for(let n=0;n<360;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).reported)break;if(n===359)throw Error('Report upstream not confirmed');await new Promise(r=>setTimeout(r,2000));}
 const u=JSON.parse(fs.readFileSync(control));await expect(p.locator('main')).toContainText(u.report_text);await expect(p.locator('main')).toContainText(u.final_order.reported_stamp.text);
 j.events=await p.evaluate(()=>window.imagingEvents);assert(j.events.some(e=>e.event_type==='imaging.report.ready'&&e.payload.imaging_order_id===j.order.imaging_order_id));
 await help(s,p.getByRole('button',{name:'Save imaging report PDF',exact:true}),'Lab & imaging orders + results');
 await s.app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out})},process.cwd()+'/artifacts/phase2-imaging-report.pdf');
 await p.getByRole('button',{name:'Save imaging report PDF',exact:true}).click();await expect(p.getByText('PDF saved.',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Download official imaging PDF',exact:true}).click();await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path===`/api/v1/imaging/orders/${j.order.imaging_order_id}/report/pdf`&&r.status===200)).toBe(true);
 j.report_payload=(await s.trace()).requests.find(r=>r.path===`/api/v1/imaging/orders/${j.order.imaging_order_id}/report/print-payload`&&r.status===200)?.result;assert(j.report_payload);assert.equal(j.report_payload.data.fields.order.patient_id,21);
 j.final_order=await s.native('api',{method:'GET',path:`/imaging/orders/${j.order.imaging_order_id}`});assert.equal(j.final_order.viewer_url,null);assert.equal(await p.getByRole('button',{name:'Open PACS viewer',exact:true}).count(),0);
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method==='POST').length,1);j.passed=true;save();s.pass('New actual imaging report.ready updates Doctor report/stamp; real report payload/native PDF/server PDF200; no print before Reported or invented PACS URL; one Doctor order only');
}catch(e){j.error=e.stack;j.events=await p.evaluate(()=>window.imagingEvents);j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}finally{await s.close();j.finished=new Date().toISOString();save()}

```
