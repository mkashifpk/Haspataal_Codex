# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final real DEV read-only checks. No referral/report/payment/partner writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const core=JSON.parse(fs.readFileSync('artifacts/imaging-outsourced-check.json')),fixture=JSON.parse(fs.readFileSync('artifacts/imaging-outsourced-fixture.json'));
assert(core.passed&&core.finished,'Reconcile main workflow first');
const finalHelp=process.argv.includes('--final-help-only');
const file=finalHelp?'artifacts/imaging-outsourced-final-help.json':'artifacts/imaging-outsourced-readonly.json',j={started:new Date().toISOString(),checks:[],passed:false};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 for(const role of (finalHelp?['radiographer']:['radiographer','radiologist'])){
  s=await session('outsourced-readonly-'+role+(finalHelp?'-final-help':''),'demo.'+role);const p=s.p;await s.nav('Outsourced examinations');
  const original=fixture.writes.order.response.body.data,open=async id=>{await p.getByLabel('Known imaging order ID',{exact:true}).fill(String(id));await p.getByRole('button',{name:'Read imaging order',exact:true}).click();await expect(p.getByTestId('outsourced-detail')).toBeVisible();};
  await p.getByLabel('Show work',{exact:true}).selectOption('partner');for(const o of core.orders)await expect(p.getByTestId('outsourced-row').filter({hasText:o.order_number})).toHaveCount(1);
  await open(original.imaging_order_id);await expect(p.getByTestId('outsourced-report')).toContainText(core.reported.external_reporter);await expect(p.getByRole('button',{name:'Save partner report PDF',exact:true})).toBeEnabled();await expect(p.getByRole('button',{name:'Enter partner report',exact:true})).toHaveCount(0);
  if(role==='radiographer'){
   await s.app.evaluate(({app,BrowserWindow,dialog})=>{dialog.showSaveDialog=async(_owner,o)=>({canceled:false,filePath:process.cwd()+'/artifacts/outsourced-notice-check-'+Date.now()+'-'+o.defaultPath});globalThis.outsourcedPrintCallbacks=0;for(const w of BrowserWindow.getAllWindows())w.webContents.getPrintersAsync=async()=>[];app.on('web-contents-created',(_,c)=>{c.print=(_,cb)=>{globalThis.outsourcedPrintCallbacks++;cb(false,'TEST: cancelled outsourced report print');};});});
   await p.getByRole('button',{name:'Save partner report PDF',exact:true}).click();await expect(p.locator('main')).toContainText('Report PDF saved.');
   await p.getByRole('button',{name:'Print partner report',exact:true}).click();await expect(p.getByRole('button',{name:'Print partner report',exact:true})).toBeEnabled();
   await expect(p.locator('main')).not.toContainText('Report PDF saved.');
   const callbackCount=await s.app.evaluate(()=>globalThis.outsourcedPrintCallbacks);
   if(callbackCount){assert.equal(callbackCount,1);await expect(p.locator('main')).toContainText('TEST: cancelled outsourced report print');j.printCheck='Actual native print callback cancelled; visible error, zero clinical writes';}
   else{await expect(p.locator('main')).toContainText(/No document printer|mapped document printer/);j.printCheck='Actual native document-printer mapping refusal; zero clinical writes; physical device cancellation pending';}save();

   await s.fault({failPath:`/api/v1/imaging/orders/${original.imaging_order_id}`,failMethod:'GET',once:false});await p.getByRole('button',{name:'Refresh examinations and partners',exact:true}).click();await expect(p.getByTestId('outsourced-detail')).toHaveCount(0);await expect(p.locator('main .error[role="alert"]')).toBeVisible({timeout:60000});await s.fault({failPath:null});await open(original.imaging_order_id);
   await p.evaluate(()=>{window.outsourcedStreams=[];window.terminal.subscribe(e=>{if(e.type==='stream')window.outsourcedStreams.push(e);});});await s.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;WS.prototype.emit=function(e,...a){if(e==='message')globalThis.outsourcedSocket=this;return emit.call(this,e,...a);};});await expect.poll(()=>s.app.evaluate(()=>!!globalThis.outsourcedSocket),{timeout:45000}).toBe(true);const at=Date.now();await s.app.evaluate(()=>globalThis.outsourcedSocket.terminate());await expect.poll(()=>p.evaluate(()=>window.outsourcedStreams.some(x=>x.status==='Live'&&x.resync)),{timeout:45000}).toBe(true);for(const route of ['/api/v1/imaging/worklist','/api/v1/diagnostic-partners',`/api/v1/imaging/orders/${original.imaging_order_id}`])await expect.poll(async()=>(await s.trace()).requests.some(x=>x.path.split('?')[0]===route&&x.started>=at&&x.status===200)).toBe(true);
  }
  await open(core.orders[0].imaging_order_id);await p.getByRole('button',{name:'Enter partner report',exact:true}).click();const m=p.getByRole('dialog');await m.getByLabel('Partner report text',{exact:true}).fill('DEMO unsent report draft, no care');await help(s,m.getByLabel('Partner report text',{exact:true}),'Outsourced examinations');await expect(m.getByLabel('Partner report text',{exact:true})).toHaveValue('DEMO unsent report draft, no care');await s.prefs({language:'ur'});await expect(m).toContainText('شریک رپورٹ کا متن');await s.prefs({language:'en'});await m.getByRole('button',{name:'Close',exact:true}).click();
  if(finalHelp){await open(original.imaging_order_id);for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(p.locator('html')).toHaveAttribute('lang',language);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`public/handbook/imaging_outsourced-${language}.png`,fullPage:true});}await s.prefs({language:'en'});}
  assert.equal((await s.trace()).requests.filter(x=>x.method!=='GET').length,0);j.checks.push({role,renderer:s.j.renderer,zeroBusinessWrites:true,checks:'Pending outsourced rows survive a fresh login; final external report signed/read-only; report draft F1 focus preserved ENUR, cancelled without write; radiographer failure hides stale context/reconnect all reads'});save();await s.close();s=undefined;
 }
 j.passed=true;save();console.log('PASS final Radiographer/Radiologist pending history, signed final report, failed-read/reconnect and F1/Urdu draft with ZERO business writes');
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}finally{if(s){await s.fault({failPath:null});await s.close();}j.finished=new Date().toISOString();save();}

```
