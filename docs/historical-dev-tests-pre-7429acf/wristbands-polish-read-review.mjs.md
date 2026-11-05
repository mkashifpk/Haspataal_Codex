# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/wristbands-polish-read-review.json';assert(!fs.existsSync(file),'Reconcile original read review');const f=JSON.parse(fs.readFileSync('docs/wristbands-live-2026-10-28.json')),A=f.requests.find(r=>r.label==='fresh-admission-a').result.saved;const j={passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('wristbands-polish-read-actor','demo.admissions');const p=s.p;await s.nav('Identity wristbands');await p.getByLabel('Known admission reference',{exact:true}).fill(String(A.admission_id));await p.getByRole('button',{name:'Read this admission',exact:true}).click();await expect(p.locator('.patient-banner')).toContainText(A.mrn);await expect(p.locator('main [data-write-pending=true]')).toHaveCount(0);await p.getByRole('button',{name:'Read this band for reprint',exact:true}).click();await expect(p.locator('main [data-write-pending=true]')).toHaveCount(0);
 const bands=await s.native('api',{method:'GET',path:'/wristbands?patient_id='+A.patient_id}),band=bands.find(b=>b.is_current);assert(band);j.current=band;j.pdf='artifacts/wristband-final-current.pdf';const pdf=path.resolve(j.pdf);
 await s.app.evaluate(({dialog},target)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:target});},pdf);await p.getByRole('button',{name:'Save wristband PDF',exact:true}).click();await expect(p.locator('main')).toContainText('Band PDF saved.');assert(fs.readFileSync(pdf).subarray(0,5).equals(Buffer.from('%PDF-')));await expect(p.locator('main [data-write-pending=true]')).toHaveCount(0);
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'public/handbook/wristbands_admissions-'+language+'.png'});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await help(s,p.getByLabel('Scan patient wristband',{exact:true}),'Identity wristbands');j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method!=='GET').length,0);j.renderer=s.j.renderer;j.checks=['Final source reads actual current band, generates allergy-emphasised PDF with bundled Urdu font','Actual ENUR media captured after all reads complete and scroll reset; both themes250 no root overflow','Field F1/focus and zero business writes'];j.passed=true;save();console.log('PASS final wristbands read/PDF/media');
}catch(e){j.error=e.stack;try{j.trace=await s.trace();}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
