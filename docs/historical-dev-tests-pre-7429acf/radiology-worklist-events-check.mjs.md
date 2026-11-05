# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final renderer, actual server events from separately journalled MCP demo writes.
// This Electron role performs ZERO clinical/financial writes and no counted labels.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('artifacts/radiology-worklist-check.json'));
const order=n=>fixture.writes[n].response.body.data;
const file='artifacts/radiology-worklist-events.json';
if(fs.existsSync(file))throw Error('Reconcile existing event journal/staged MCP writes before rerunning.');
const j={run:fixture.run,started:new Date().toISOString(),checks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
let s;
async function open(o){await s.p.getByLabel('Known imaging order ID',{exact:true}).fill(String(o.imaging_order_id));await s.p.getByRole('button',{name:'Open imaging order',exact:true}).click();await expect(s.p.locator('main')).toContainText(o.accession_number);}
try{
 s=await session('radiology-worklist-events-radiographer','demo.radiographer');s.p.on('dialog',d=>d.accept());await s.nav('Imaging worklist');
 await s.p.evaluate(()=>{window.radiologyEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.radiologyEvents.push(e);});});
 await open(order('link'));await expect(s.p.getByRole('button',{name:'Start examination',exact:true})).toBeEnabled();await s.p.getByRole('button',{name:'Start examination',exact:true}).click();
 const note=s.p.getByRole('dialog').getByLabel('Identity / emergency note',{exact:true});await note.fill('KEEP THIS UNSENT SYNTHETIC EXAMINATION DRAFT');await help(s,note,'Imaging worklist');
 const before=(await s.trace()).requests.length;j.readyCreate=true;save();console.log('READY_FOR_NEW_IMAGING_ORDER');
 await expect.poll(()=>s.p.evaluate(()=>window.radiologyEvents.some(e=>e.event_type==='imaging.order.created')),{timeout:180000}).toBe(true);
 await expect.poll(async()=> (await s.trace()).requests.slice(before).filter(x=>x.path.startsWith('/api/v1/imaging/worklist')&&x.finished).length).toBeGreaterThan(0);
 await expect(note).toHaveValue('KEEP THIS UNSENT SYNTHETIC EXAMINATION DRAFT');
 assert.equal((await s.trace()).requests.slice(before).filter(x=>x.path==='/api/v1/imaging/orders/'+order('link').imaging_order_id).length,0);
 pass('Real imaging.order.created refreshed worklist, ZERO selected-order reads, frozen unsent identity draft and F1/focus preserved');
 // A separate actor changes only our owned MRI order; preflight must reject this frozen draft before POST.
 const m=s.p.getByRole('dialog');await m.getByLabel('Patient identity method',{exact:true}).selectOption('TwoIdentifiers');await m.getByLabel('I asked and matched name and MRN or date of birth.',{exact:true}).check();await m.getByLabel('I checked and confirmed the site and side against this order.',{exact:true}).check();await m.getByRole('button',{name:'Review imaging action',exact:true}).click();
 j.readyConcurrent=true;save();console.log('READY_FOR_CONCURRENT_SCHEDULE');
 for(let i=0;i<180&&!fs.existsSync('artifacts/radiology-concurrent-ready.json');i++)await new Promise(resolve=>setTimeout(resolve,1000));
 assert(fs.existsSync('artifacts/radiology-concurrent-ready.json'));
 const beforeConfirm=(await s.trace()).requests.length;await m.getByRole('button',{name:'Confirm imaging action',exact:true}).click();await expect(m).toContainText('The patient, order, permission or service changed.');
 assert.equal((await s.trace()).requests.slice(beforeConfirm).filter(x=>x.method==='POST').length,0);
 pass('Real second-actor version/stage change refused by frozen-draft fresh preflight before ANY POST');
 await s.p.getByRole('dialog').getByRole('button',{name:'Close examination draft',exact:true}).click();
 await open(order('contrast'));const ct=await s.native('api',{method:'GET',path:'/imaging/orders/'+order('contrast').imaging_order_id});assert.equal(ct.status,'Completed');
 j.readyReport=true;save();console.log('READY_FOR_CT_REPORT');
 await expect(s.p.getByRole('heading',{name:'Final radiology report',exact:true})).toBeVisible({timeout:180000});
 await expect(s.p.locator('main')).toContainText(fixture.run+' FINAL EVENT REPORT');
 await expect(s.p.getByRole('button',{name:'Print final report',exact:true})).toBeEnabled();
 await expect(s.p.getByRole('button',{name:'Enter final report',exact:true})).toHaveCount(0);
 const actual=await s.native('api',{method:'GET',path:'/imaging/orders/'+order('contrast').imaging_order_id});assert.equal(actual.status,'Reported');assert(actual.reported_stamp&&actual.critical_result_id);j.report=actual;save();
 pass('Actual Imaging critical_result.updated uses patient/source hint to reread selected order and signed report; radiographer remains unable to report');
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:245});
 const win=await s.app.browserWindow(s.p),key=async c=>win.evaluate((w,c)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:c,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:c,modifiers:['control']});},c);
 await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 for(const language of ['en','ur']){
  await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',language);await s.p.evaluate(()=>window.scrollTo(0,0));await s.p.screenshot({path:`public/handbook/radiology_worklist-${language}.png`,fullPage:true});
  for(const theme of ['Light','DarkHighContrast'])for(const ui_scale_pct of [100,150,200,250]){await s.prefs({language,theme,ui_scale_pct});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
 }
 pass('Actual native zoom lower/upper bounds/reset, final full-page EN/UR screenshots and both themes100/150/200/250 layouts');
 assert.equal((await s.trace()).requests.filter(x=>x.method!=='GET').length,0);
 j.events=await s.p.evaluate(()=>window.radiologyEvents);j.renderer=s.j.renderer;j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
