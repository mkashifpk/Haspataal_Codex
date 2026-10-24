// Real DEV UI + actual upstream laboratory roles. No fabricated reports, events or study IDs.
import {session,expect,help} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-diagnostic-results-check-2026-10-24.json',control='docs/phase2-diagnostic-upstream-2026-10-24.json';
const resume=process.argv.includes('--resume');
assert(resume || !fs.existsSync(file),'Reconcile original diagnostic journal; never create replacement orders');
const fixture=JSON.parse(fs.readFileSync('docs/phase2-handover-check-2026-10-24.json')).cases.admission.registration.data;
const j=resume?JSON.parse(fs.readFileSync(file)):{run:'DEMO-P2-DIAGNOSTIC-'+Date.now(),patient_id:fixture.patient_id,ticket_id:fixture.ticket_id,checks:[]};
if(resume)assert(j.requisition && !j.order_pending,'Reconcile original pending order before resuming');
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('phase2-diagnostic-results','demo.doctor'),p=s.p;
const pass=t=>{j.checks.push(t);save();console.log('PASS '+t)};
const waitStage=async stage=>{j.waiting_for=stage;save();console.log('WAIT '+stage);for(let n=0;n<630;n++){if(fs.existsSync(control)){const c=JSON.parse(fs.readFileSync(control));if(c[stage])return c;}await new Promise(r=>setTimeout(r,2000));}throw new Error('Timed out waiting for real upstream stage '+stage)};
try{
 await p.evaluate(()=>{window.phase2Events=[];window.phase2Unsubscribe=window.terminal.subscribe(e=>{if(e.type==='event')window.phase2Events.push(e)})});
 await s.nav('Consultation (EMR)');await p.getByLabel('OPD slip number',{exact:true}).fill(fixture.ticket_number);await p.getByLabel('OPD slip number',{exact:true}).press('Enter');
 await expect(p.locator('main')).toContainText(fixture.mrn);await p.getByRole('button',{name:'Order lab / imaging',exact:true}).click();
 if(!resume){
 for(const code of ['CBC','RBS']){await p.getByLabel('Filter test catalogue',{exact:true}).fill(code);await p.locator('label.card').filter({has:p.locator('strong').filter({hasText:code})}).first().getByRole('checkbox').check()}
 await p.getByLabel('Laboratory clinical notes',{exact:true}).fill(j.run+' software simulation only; no real specimen or care');
 j.order_pending=true;save();await p.getByRole('button',{name:'Order selected tests',exact:true}).click();
 await expect(p.getByRole('button',{name:'Cancel own unsampled order',exact:true})).toBeVisible();
 const order=(await s.trace()).requests.find(r=>r.method==='POST'&&r.path==='/api/v1/lab/requisitions');assert.equal(order.status,201);j.original_order=order;j.requisition=order.result.data;j.order_pending=false;save();
 pass('New actual CBC/RBS order from Doctor UI using original synthetic patient21/ticket15; original request/key/requisition/invoice saved');
 }else{
  const actual=await s.native('api',{method:'GET',path:`/lab/requisitions/${j.requisition.requisition_id}`});assert.equal(actual.patient_id,j.patient_id);assert.equal(actual.clinical_notes,j.run+' software simulation only; no real specimen or care');
  await p.getByRole('button').filter({hasText:j.requisition.requisition_number}).first().click();
  pass('Re-read original requisition2 after harmless test-label stop; no new order/payment/sample/result');
 }
 if(!j.entered_checked){
 await waitStage('entered');
 await expect(p.getByRole('button',{name:'Cancel own unsampled order',exact:true})).toHaveCount(0);
 await expect(p.getByText('No published or provisionally released results.',{exact:false})).toBeVisible();
 assert.equal(await p.getByRole('button',{name:'Print lab report',exact:true}).count(),0);
 j.events=await p.evaluate(()=>window.phase2Events);save();
 assert(j.events.some(e=>e.event_type==='lab.result.critical_pending'&&e.payload.patient_id===fixture.patient_id));
 pass('Actual critical_pending WebSocket event refreshes requisition; collected tests cannot be cancelled and routine unverified results/printing stay hidden');
 j.entered_checked=true;save();
 }
 const published=await waitStage('published');
 const resultSection=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Published results and trends',exact:true})});
 await expect(resultSection).toContainText('RBS');await expect(resultSection).toContainText(published.published_result.verified_stamp.text);
 await expect(p.getByRole('button',{name:'Print lab report',exact:true})).toBeVisible();
 await help(s,p.getByRole('button',{name:'Print lab report',exact:true}),'Lab & imaging orders + results');
 await s.app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out})},process.cwd()+'/artifacts/phase2-lab-partial-report.pdf');
 await p.getByRole('button',{name:'Save lab report PDF',exact:true}).click();await expect(p.getByText('PDF saved.',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Download official lab PDF',exact:true}).click();
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path===`/api/v1/lab/requisitions/${j.requisition.requisition_id}/report/pdf`&&r.status===200)).toBe(true);
 j.published_events=await p.evaluate(()=>window.phase2Events);j.partial_report=(await s.trace()).requests.find(r=>r.path===`/api/v1/lab/requisitions/${j.requisition.requisition_id}/report/print-payload`&&r.status===200)?.result;save();
 if(!resume)assert(j.published_events.some(e=>e.event_type==='lab.result.published'&&e.payload.patient_id===fixture.patient_id));
 assert.equal(j.partial_report.data.fields.complete,false);
 pass('Actual publication event updates Doctor result/verified stamp; partial published-only report payload and both native-rendered/server PDF paths succeed');
 j.published_checked=true;save();
 await waitStage('provisional');
 await expect(p.locator('main')).toContainText('Pending verification — unverified critical value; do not print');
 await expect(resultSection).toContainText('Pending verification — do not print');
 j.provisional_events=await p.evaluate(()=>window.phase2Events);save();
 assert(j.provisional_events.some(e=>e.event_type==='lab.result.provisional'&&e.payload.patient_id===fixture.patient_id));
 pass('Real worker provisional event makes critical value visible in red with Pending verification, separate from published report');j.provisional_checked=true;save();
 await waitStage('withdrawn');
 await expect(p.locator('main')).toContainText('A provisional result was withdrawn by the verifier. Do not act on it.');
 await expect(resultSection).not.toContainText('Pending verification — do not print');
 j.final_events=await p.evaluate(()=>window.phase2Events);j.final_trace=await s.trace();save();
 assert(j.final_events.some(e=>e.event_type==='lab.result.provisional_withdrawn'&&e.payload.patient_id===fixture.patient_id));
 pass('Actual verifier rejection withdraws provisional display immediately with explicit warning; original published RBS remains');
 j.passed=true;save();
}catch(e){j.error=e.stack;j.trace=await s.trace();j.observed_events=await p.evaluate(()=>window.phase2Events);j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}
finally{await s.close();j.finished=new Date().toISOString();save()}
