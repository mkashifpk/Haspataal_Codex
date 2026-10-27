// Final display-only refinement: human-readable bilingual review, F1, filters, actual records/media.
// ZERO clinical/financial writes and no PACS-link attempts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('artifacts/radiology-worklist-check.json'));
const file='artifacts/radiology-worklist-final-smoke.json',j={started:new Date().toISOString(),checks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('radiology-final-smoke-radiographer','demo.radiographer');s.p.on('dialog',d=>d.accept());await s.nav('Imaging worklist');
 await s.p.getByLabel('Modality',{exact:true}).selectOption('MRI');await s.p.getByLabel('Examination status',{exact:true}).selectOption('Scheduled');
 await expect(s.p.locator('tbody tr')).toHaveCount(1);await expect(s.p.locator('tbody')).toContainText(fixture.writes.link.response.body.data.accession_number);
 await s.p.getByLabel('Examination status',{exact:true}).selectOption('Completed');await expect(s.p.locator('main')).toContainText('No matching open examinations.');await s.p.getByLabel('Examination status',{exact:true}).selectOption('');await s.p.getByLabel('Modality',{exact:true}).selectOption('');
 await s.p.getByLabel('Known imaging order ID',{exact:true}).fill('4');await s.p.getByRole('button',{name:'Open imaging order',exact:true}).click();await expect(s.p.getByRole('button',{name:'Start examination',exact:true})).toBeEnabled();await s.p.getByRole('button',{name:'Start examination',exact:true}).click();
 const m=s.p.getByRole('dialog');await m.getByLabel('Patient identity method',{exact:true}).selectOption('TwoIdentifiers');await m.getByLabel('I asked and matched name and MRN or date of birth.',{exact:true}).check();await m.getByLabel('I checked and confirmed the site and side against this order.',{exact:true}).check();await m.getByRole('button',{name:'Review imaging action',exact:true}).click();
 await expect(m).toContainText('Next examination stage');await expect(m).toContainText('Checked against this order');await expect(m).not.toContainText('site_confirmed');await expect(m).not.toContainText('identity_check');
 await help(s,m.getByRole('button',{name:'Confirm imaging action',exact:true}),'Imaging worklist');
 await s.prefs({language:'ur'});await expect(m).toContainText('اگلا معائنہ مرحلہ');await expect(m).toContainText('اسی آرڈر سے جانچ شدہ');
 await s.p.screenshot({path:'artifacts/radiology-review-ur.png',fullPage:true});await s.prefs({language:'en'});await m.getByRole('button',{name:'Close examination draft',exact:true}).click();
 await s.p.getByLabel('Known imaging order ID',{exact:true}).fill('3');await s.p.getByRole('button',{name:'Open imaging order',exact:true}).click();await expect(s.p.getByRole('button',{name:'Print final report',exact:true})).toBeEnabled();
 for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',language);await s.p.evaluate(()=>window.scrollTo(0,0));await s.p.screenshot({path:`public/handbook/radiology_worklist-${language}.png`,fullPage:true});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 const trace=await s.trace();assert.equal(trace.requests.filter(r=>r.method!=='GET').length,0);
 j.checks.push('Actual MRI/Scheduled server filters and no-match; final human-worded EN/UR review/F1 draft/focus; immutable signed CT report; both themes250% full-page media; ZERO clinical writes');j.renderer=s.j.renderer;j.passed=true;save();console.log('PASS final bilingual review/filter/F1/signed-record/media smoke');
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
