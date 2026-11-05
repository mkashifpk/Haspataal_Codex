# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final-renderer read-only verification; changes/restores demo display preferences only.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/bed-matrix-final-review.json';assert(!fs.existsSync(file),'Reconcile previous final review first');
const f=JSON.parse(fs.readFileSync('docs/bed-matrix-live-2026-10-28.json')),get=n=>f.requests.find(x=>x.label===n).result;
const ward=get('create-demo-ward').body.data,rows=get('create-demo-beds').body.data,ad=get('fresh-admission-scenario').saved;let s;const j={run:f.run,checks:[],passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{
 s=await session('bed-matrix-final-actor','demo.admissions');const p=s.p;await s.nav('Live bed matrix');await p.getByLabel('Ward to show',{exact:true}).selectOption(String(ward.ward_id));await p.getByTestId('bed-tile-'+rows[2].bed_id).click();await p.getByRole('button',{name:'Open this admission',exact:true}).click();await expect(p.getByTestId('admission-detail')).toContainText(ad.mrn);await expect(p.getByLabel('Known admission ID',{exact:true})).toHaveValue(String(ad.admission_id));j.checks.push('Final renderer exact admission handover initializes matching detail and known-ID field');
 await s.nav('Live bed matrix');await p.getByLabel('Ward to show',{exact:true}).selectOption(String(ward.ward_id));await p.getByTestId('bed-tile-'+rows[0].bed_id).click();await expect(p.getByRole('button',{name:'Take bed out of service',exact:true})).toBeEnabled();await help(s,p.getByLabel('Ward to show',{exact:true}),'Live bed matrix');
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'public/handbook/bed_matrix-'+language+'.png'});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await p.setViewportSize({width:1366,height:768});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'artifacts/bed-matrix-final-1366.png'});const rect=await p.getByRole('button',{name:'Take bed out of service',exact:true}).boundingBox();assert(rect&&rect.y+rect.height<=768,'Primary selected-bed action must fit at1366x768');
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(x=>x.method!=='GET').length,0);j.renderer=s.j.renderer;j.checks.push('F1/focus and final actual EN/UR media','Both themes250 root layout; readable ward/count/action','1366x768 primary action fits beside the board','Zero business writes');j.passed=true;save();console.log('PASS '+j.checks.join('\nPASS '));
}catch(e){j.error=e.stack;try{j.ui=await s.p.locator('body').innerText()}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
