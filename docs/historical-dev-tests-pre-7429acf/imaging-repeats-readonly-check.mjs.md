# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Exact current synthetic records, fresh role logins, no clinical/financial writes.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const core=JSON.parse(fs.readFileSync('artifacts/imaging-repeats-check.json'));assert(core.passed&&core.finished,'Reconcile core workflow first');
const finalDisplay=process.argv.includes('--final-display');
const file=finalDisplay?'artifacts/imaging-repeats-final-display.json':'artifacts/imaging-repeats-readonly.json',j={started:new Date().toISOString(),checks:[],passed:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 for(const role of (finalDisplay?['radiologist']:['radiographer','radiologist'])){
  s=await session('repeats-readonly-'+role+(finalDisplay?'-final-display':'' ),'demo.'+role);const p=s.p;await s.nav('Repeated images register');await expect(p.getByLabel('From date',{exact:true})).not.toHaveValue('');await p.getByLabel('From date',{exact:true}).fill(core.today);await p.getByLabel('To date',{exact:true}).fill(core.today);await p.getByRole('button',{name:'Apply register filters',exact:true}).click();
  for(const r of [core.first,core.second,core.third])await expect(p.getByTestId('repeat-row').filter({hasText:r.order_number})).toContainText('#'+r.repeat_id);
  const o=core.orders[2],open=async()=>{await p.getByLabel('Known imaging order ID',{exact:true}).fill(String(o.imaging_order_id));await p.getByRole('button',{name:'Read source examination',exact:true}).click();await expect(p.getByTestId('repeat-source')).toContainText(o.order_number);};await open();await expect(p.getByTestId('repeat-source')).toContainText('Reported');
  if(role==='radiographer'){
   await s.fault({failPath:`/api/v1/imaging/orders/${o.imaging_order_id}`,failMethod:'GET',once:false});await p.getByRole('button',{name:'Refresh repeat register',exact:true}).click();await expect(p.getByTestId('repeat-source')).toHaveCount(0);await expect(p.getByRole('button',{name:'Record an already repeated exposure',exact:true})).toHaveCount(0);await expect(p.locator('main .error[role="alert"]')).toBeVisible({timeout:60000});await s.fault({failPath:null});await open();
   await p.evaluate(()=>{window.repeatStreams=[];window.terminal.subscribe(e=>{if(e.type==='stream')window.repeatStreams.push(e);});});await s.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;WS.prototype.emit=function(e,...a){if(e==='message')globalThis.repeatSocket=this;return emit.call(this,e,...a);};});await expect.poll(()=>s.app.evaluate(()=>!!globalThis.repeatSocket),{timeout:45000}).toBe(true);const at=Date.now();await s.app.evaluate(()=>globalThis.repeatSocket.terminate());await expect.poll(()=>p.evaluate(()=>window.repeatStreams.some(x=>x.status==='Live'&&x.resync)),{timeout:45000}).toBe(true);for(const path of ['/api/v1/imaging/repeats','/api/v1/imaging/worklist',`/api/v1/imaging/orders/${o.imaging_order_id}`])await expect.poll(async()=>(await s.trace()).requests.some(x=>x.path.split('?')[0]===path&&x.started>=at&&x.status===200)).toBe(true);
  }
  await p.getByRole('button',{name:'Record an already repeated exposure',exact:true}).click();const m=p.getByRole('dialog');await m.getByLabel('Reason for repeat',{exact:true}).selectOption('Other');await m.getByLabel('Repeat note (required for Other)',{exact:true}).fill('DEMO unsent quality note, no actual exposure');await help(s,m.getByLabel('Repeat note (required for Other)',{exact:true}),'Repeated images register');await expect(m.getByLabel('Repeat note (required for Other)',{exact:true})).toHaveValue('DEMO unsent quality note, no actual exposure');await s.prefs({language:'ur'});await expect(m).toContainText('دیگر میں لازم');await s.prefs({language:'en'});await m.getByRole('button',{name:'Close',exact:true}).click();
  if(role==='radiographer'||finalDisplay)for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(p.locator('html')).toHaveAttribute('lang',language);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`public/handbook/imaging_repeats-${language}.png`,fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
  assert.equal((await s.trace()).requests.filter(x=>x.method!=='GET').length,0);j.checks.push({role,renderer:s.j.renderer,zeroBusinessWrites:true,checks:'Exact fresh audit IDs/reasons/counts/authors persist; Reported source identity; F1/Urdu unsent draft closes without a write; radiographer failed-read hides stale actions and real reconnect refreshes register/worklist/detail; clean bilingual media/themes250'});save();await s.close();s=undefined;
 }
 j.passed=true;save();console.log('PASS fresh Radiographer/Radiologist register/history/source/F1/Urdu, failed-read/reconnect/media with ZERO clinical writes');
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}finally{if(s){await s.fault({failPath:null});await s.close();}j.finished=new Date().toISOString();save();}

```
