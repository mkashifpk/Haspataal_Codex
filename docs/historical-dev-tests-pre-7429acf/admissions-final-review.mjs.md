# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only UI/handbook pass on current-run synthetic records. Only preferences change.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/admissions-final-review.json';if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));assert(old.finished&&old.passed,'Reconcile previous read-only review');const actor=JSON.parse(fs.readFileSync('artifacts/admissions-final-review-actor.json'));assert(actor.preferences_restored&&actor.signed_out);fs.renameSync(file,file.replace('.json','-'+Date.now()+'.json'));}
const f=JSON.parse(fs.readFileSync('docs/pending-admissions-live-2026-10-28.json'));
const a=f.requests.find(x=>x.label==='arrival-scenario').result.saved;
let s;const j={passed:false,checks:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{
 s=await session('admissions-final-review-actor','demo.admissions');const p=s.p;await s.nav('Pending admissions & allocation');await p.getByLabel('Known admission ID',{exact:true}).fill(String(a.admission_id));await p.getByRole('button',{name:'Read admission',exact:true}).click();await expect(p.getByTestId('admission-detail')).toContainText('Already cleared');await expect(p.getByTestId('admission-detail')).toContainText('Imran (Admissions)');
 await p.getByLabel('Admission work to show',{exact:true}).selectOption('discharge');await p.getByLabel('Find in returned admissions',{exact:true}).fill(a.mrn);
 await help(s,p.getByRole('button',{name:'Refresh admissions and beds',exact:true}),'Pending admissions & allocation');
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'public/handbook/pending_admissions-'+language+'.png'});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.setViewportSize({width:1366,height:768});await p.screenshot({path:'artifacts/admissions-final-1366.png'});
 const trace=await s.trace();assert.equal(trace.requests.filter(x=>x.method!=='GET').length,0);j.trace=trace;j.renderer=s.j.renderer;j.checks=['Final renderer exact admission/stage officer/time read','F1 current guide and focus restored','Top-of-page EN/UR actual media; both themes250 root layout','1366x768 density screenshot','No business write on final review'];j.passed=true;save();
}catch(e){j.error=e.stack;console.error(e.stack);save();process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
