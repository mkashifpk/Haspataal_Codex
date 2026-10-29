// Read-only final regression against the new, reconciled screen58 fixture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const name=process.argv[2]||'inpatients58-checks-final-read';
const file=`artifacts/${name}.json`;
assert(!fs.existsSync(file),'Preserve and reconcile the previous result');
const f=JSON.parse(fs.readFileSync('docs/inpatients58-checks/scenario-result.json')).saved;
const j={passed:false};let s;
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try {
 s=await session(name+'-doctor','demo.doctor');const p=s.p;
 await s.nav('Inpatient rounds & discharge');
 const known=p.getByLabel('Known admission reference',{exact:true});
 await known.fill(String(f.admission_id));
 await p.getByRole('button',{name:'Read this admission',exact:true}).click();
 const card=p.locator('article.card');
 await expect(card).toContainText(f.mrn);
 await expect(card).toContainText('DischargeInProgress');
 await expect(card).toContainText('PharmacyClearance');
 await expect(card).toContainText('ClinicalDischarge: Cleared');
 await expect(card).toContainText('DEMO corrected nursing note');
 await expect(card).toContainText('DEMO visible MAR correction check');
 await expect(card.locator('table tbody tr')).toHaveCount(4);
 await expect(card.locator('table').first().locator('tbody tr').first().locator('td').nth(6)).toHaveText('0');
 await expect(p.getByRole('button',{name:'Initiate clinical discharge',exact:true})).toHaveCount(0);
 await help(s,known,'Inpatient rounds & discharge');
 await p.getByLabel('Find inpatient by name, MRN or doctor',{exact:true}).fill('DEMO no matching row 58');
 await expect(p.locator('aside.card')).toContainText('No admissions match this filter');
 await expect(card).toContainText(f.mrn);
 await p.getByLabel('Find inpatient by name, MRN or doctor',{exact:true}).fill('');
 for(const language of ['en','ur']) {
  await s.prefs({language,theme:'Light',ui_scale_pct:100});
  await expect(p.locator('html')).toHaveAttribute('lang',language);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({path:`public/handbook/doctor_inpatients-${language}.png`,fullPage:true});
  for(const theme of ['Light','DarkHighContrast']) {
   await s.prefs({theme,ui_scale_pct:250});
   await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
   await expect(card).toContainText(f.mrn);
  }
 }
 j.trace=await s.trace();assert(j.trace.requests.every(r=>r.method==='GET'));
 j.renderer=s.j.renderer;j.passed=true;save();
 console.log('PASS final build: real populated context, cleared stage/locked bed, no discharge repeat, zero pain, history, no-match selection, F1 focus return, EN/UR themes250; GET only');
}catch(e){j.error=e.stack;try{j.trace=await s?.trace();j.ui=await s?.p.locator('body').innerText();}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
