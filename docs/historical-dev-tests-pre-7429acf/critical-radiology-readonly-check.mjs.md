# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final read-only role/source regression. No clinical/financial writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const original=JSON.parse(fs.readFileSync('artifacts/critical-radiology-check.json'));
assert(original.passed&&original.finished,'Reconcile main workflow first');
const file='artifacts/critical-radiology-readonly.json',j={started:new Date().toISOString(),checks:[],passed:false};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
let s;
try{
 for(const [role,screen,source] of [['labtech','critical_results_bench','Lab'],['labverifier','critical_results_verifier','Lab'],['radiologist','critical_results_radiology','Imaging']]){
  s=await session('critical-imaging-regression-'+role,'demo.'+role);const p=s.p;await s.nav('Critical results to tell');await expect(p.locator(`[data-help-screen="${screen}"]`)).toBeVisible();await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes('source='+source)&&r.path.includes('open_only=true'))).toBe(true);
  await p.getByLabel('Known critical result ID',{exact:true}).fill(String(original.first.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();
  if(source==='Lab'){
   await expect(p.getByTestId('critical-detail')).toHaveCount(0);await expect(p.locator('main')).toContainText('This is not a laboratory result.');await expect(p.getByLabel('Recipient name and designation',{exact:true})).toHaveCount(0);
   const denied=await p.evaluate(id=>window.terminal.call('critical-result-alarm',{criticalResultId:id}),original.first.critical_result_id);assert.equal(denied.ok,false);
  }else{
   await expect(p.getByTestId('critical-detail')).toContainText('Acknowledged by doctor');await expect(p.getByTestId('critical-history')).toContainText('DEMO simulated requesting doctor');assert.equal((await s.native('critical-result-alarm',{criticalResultId:original.first.critical_result_id})).played,false);
   await help(s,p.getByLabel('Recipient name and designation',{exact:true}),'Critical results to tell');
   await p.getByLabel('Recipient name and designation',{exact:true}).fill('DEMO unsent first');await p.getByLabel(/The recipient read the result back/).check();await p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true}).check();await p.getByLabel('Recipient name and designation',{exact:true}).fill('DEMO unsent second');await expect(p.getByLabel(/The recipient read the result back/)).not.toBeChecked();await expect(p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true})).not.toBeChecked();await p.getByLabel('Recipient name and designation',{exact:true}).fill('');
  }
  assert.equal((await s.trace()).requests.filter(x=>x.method!=='GET').length,0);j.checks.push({role,screen,source,renderer:s.j.renderer,zeroBusinessWrites:true});save();await s.close();s=undefined;
 }
 j.passed=true;save();console.log('PASS Radiologist and both Lab roles preserve source-scoped menu/help/log/detail/native alarm with ZERO business writes');
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
