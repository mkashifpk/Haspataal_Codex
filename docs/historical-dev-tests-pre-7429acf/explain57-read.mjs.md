# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect,help} from './clinical-test-kit.mjs';
const name=process.argv[2]||'explain57-final-read',file='artifacts/'+name+'.json';assert(!fs.existsSync(file),'Keep original read journal');const fixture=JSON.parse(fs.readFileSync('docs/explain57/prepare-1-result.json')).body.data;
let s;const j={passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{s=await session(name+'-doctor','demo.doctor');const p=s.p;p.on('dialog',d=>d.accept());await s.nav('Explain a cost estimate');await expect(p.locator('[data-estimate-screen=explain_estimate]')).toBeVisible();
 const known=p.getByLabel('Known estimate reference',{exact:true});await known.fill(String(fixture.estimate_id));await p.getByRole('button',{name:'Read this estimate',exact:true}).click();await expect(p.locator('article.card')).toContainText(fixture.estimate_number);await expect(p.locator('section.notice').filter({has:p.getByRole('button',{name:'Show all estimate records',exact:true})})).toContainText(fixture.mrn);
 await p.getByRole('button',{name:'Read this admission history',exact:true}).click();await expect.poll(async()=> (await s.trace()).requests.some(r=>r.path.includes('admission_id='+fixture.admission_id)&&r.status===200)).toBe(true);
 for(const label of ['Mark explained','Cancel estimate','Prepare a revision','Prepare for this admission'])await expect(p.getByRole('button',{name:label,exact:true})).toHaveCount(0);
 await expect(p.locator('article.card')).toContainText('This explanation is final.');await help(s,known,'Explain a cost estimate');
 await p.getByRole('button',{name:'Show all estimate records',exact:true}).click();await p.getByLabel('Find estimate or patient',{exact:true}).fill('NO-MATCH-EXPLAIN57-'+Date.now());await expect(p.getByText('No estimates match. Clear the filter, or ask Admissions or Billing to prepare one.',{exact:true})).toBeVisible();await p.getByLabel('Find estimate or patient',{exact:true}).fill(fixture.mrn);await p.getByLabel('Estimate status',{exact:true}).selectOption('Explained');await expect(p.getByRole('button',{name:new RegExp(fixture.estimate_number+' ·')})).toHaveCount(1);await p.getByRole('button',{name:new RegExp(fixture.estimate_number+' ·')}).click();
 await p.getByRole('button',{name:'Preview estimate form',exact:true}).click();await expect(p.getByRole('dialog')).toContainText(fixture.mrn);await p.keyboard.press('Escape');
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'public/handbook/explain_estimate-'+language+'.png',fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});j.trace=await s.trace();assert(j.trace.requests.every(r=>r.method==='GET'));assert(!j.trace.requests.some(r=>r.path.startsWith('/api/v1/admissions')));j.passed=true;save();console.log('PASS final Doctor explanation route, admission scope, exact fresh record, final read-only controls, no-match/filter, F1/focus, original print preview, ENUR screenshots and themes250; zero business writes');
}catch(e){j.error=e.stack;try{j.trace=await s?.trace();j.ui=await s?.p.locator('body').innerText();}catch{}save();console.error(e.stack);process.exitCode=1;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}

```
