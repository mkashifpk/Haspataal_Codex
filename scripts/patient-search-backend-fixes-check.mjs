// Real DEV read-only regression after issues17/18. Never replays a merge or payment.
import {session,expect,help} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const oldMrn='MRN-2026-000006',masterMrn='MRN-2026-000007';
for(const account of ['demo.reception','demo.doctor']) {
 const s=await session('search-fixes-'+account.replace('.','-'),account),p=s.p;
 try {
  const source=await s.native('api',{method:'GET',path:'/patients/10'}),master=await s.native('api',{method:'GET',path:'/patients/11'});
  assert.equal(source.master_patient_id,11);assert.equal(source.mrn,oldMrn);assert.equal(master.mrn,masterMrn);assert(master.full_name.includes('8fe222'));
  if(account==='demo.reception') {
   await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});
   await q.fill(oldMrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);
   await expect(p.locator('.patient-result .patient-merge-match')).toHaveText('Found by '+oldMrn+', merged into this record');
   await p.locator('.patient-result').click();await expect(p.locator('main article.card')).toContainText(master.full_name);await expect(p.locator('main article.card')).toContainText(masterMrn);
   await s.prefs({language:'ur'});await expect(p.locator('.patient-merge-match')).toContainText('اس شناخت سے ملا:');await expect(p.locator('.patient-merge-match bdi')).toHaveText(oldMrn);
   await s.prefs({language:'en'});
   for(const term of [masterMrn,master.full_name,'8fe222']) {await q.fill(term);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(masterMrn);await expect(p.locator('.patient-merge-match')).toHaveCount(0);}
   await q.fill('DEMONOMATCH'+Date.now());await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(0);await expect(p.getByText('No patients match this query. Check the MRN, mobile or spelling, or register a new patient.',{exact:true})).toBeVisible();
   await q.fill(oldMrn);await q.press('Enter');await expect(p.locator('.patient-merge-match')).toBeVisible();
   await help(s,q,'Patient search');
   for(const language of ['en','ur']) {await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'artifacts/search-fix-'+language+'.png'});for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}}
   s.pass('Old MRN resolves master once with EN/UR explanation; current MRN and alphanumeric names resolve once without false alias note; empty state, contextual F1 and both themes/languages250% PASS');
  } else {
   for(const screen of ['Record a home visit','Refer out (external referral)','Health education given','Preventive programmes of a patient']) {
    await s.nav(screen);const q=p.getByLabel('Find clinical patient',{exact:true});await q.fill(oldMrn);
    const match=p.locator('.patient-merge-match');await expect(match).toHaveText('Found by '+oldMrn+', merged into this record');
    const choice=p.getByRole('button').filter({has:match});await expect(choice).toHaveCount(1);await choice.click();
    await expect(p.locator('main h2').filter({hasText:master.full_name})).toContainText(masterMrn);
    await help(s,q,screen);await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'artifacts/search-fix-'+screen.replace(/[^a-z]+/gi,'-')+'-en.png'});await s.prefs({language:'ur'});await expect(match).toContainText('اس شناخت سے ملا:');await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'artifacts/search-fix-'+screen.replace(/[^a-z]+/gi,'-')+'-ur.png'});await s.prefs({language:'en'});
    s.pass(screen+': actual old-MRN hit explains master selection; F1 and bilingual match note; zero business writes');
   }
  }
  assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);s.j.passed=true;s.save();
 }catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1;}finally{await s.close();}
}
