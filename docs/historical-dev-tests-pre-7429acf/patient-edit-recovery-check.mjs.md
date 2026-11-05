# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV: only the previously created, labelled synthetic patient's address
// is changed and restored. No registration/payment/merge is repeated.
import {session,expect,help,capture} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const identities=JSON.parse(fs.readFileSync('docs/patient-identifiers-reset-evidence-2026-10-24.json')).patients;
const file='artifacts/patient-edit-recovery-resume-20261024.json';
if(fs.existsSync(file)){const prev=JSON.parse(fs.readFileSync(file));assert(prev.finished&&prev.restored,'Reconcile original address/key before rerunning');fs.copyFileSync(file,file+'.previous-'+Date.now());}
const j={marker:'DEMO lost-PATCH recovery '+Date.now(),patient_id:identities.b.patient_id,checks:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('patient-edit-recovery-resume','demo.reception'),p=s.p,modal=()=>p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Edit patient demographics',exact:true})});
try{
 const original=await s.native('api',{method:'GET',path:'/patients/'+j.patient_id});assert.equal(original.full_name,identities.b.full_name);assert.equal(original.merged_into_id,null);j.original=original;save();
 await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});await q.fill(original.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(p.locator('main article.card')).toContainText(original.full_name);await p.getByRole('button',{name:'Edit demographics',exact:true}).click();
 await modal().getByLabel('CNIC',{exact:true}).fill(identities.a.cnic);await modal().getByRole('button',{name:'Save changes',exact:true}).click();await expect(modal().getByRole('alert').filter({hasText:'PATIENT_CNIC_EXISTS'})).toBeVisible();await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();await modal().getByLabel('CNIC',{exact:true}).fill(original.cnic||'');
 await modal().getByLabel('Address',{exact:true}).fill(j.marker);await help(s,modal().getByLabel('Address',{exact:true}),'Patient search');j.write_pending=true;save();await s.fault({failPath:'/patients/'+j.patient_id,failMethod:'PATCH',once:true});await modal().getByRole('button',{name:'Save changes',exact:true}).evaluate(b=>{b.click();b.click()});
 await expect(modal().getByText('Review current record',{exact:true})).toBeVisible();await expect(modal().getByLabel('Address',{exact:true})).toHaveValue(j.marker);await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
 const patches=(await s.trace()).requests.filter(r=>r.method==='PATCH');assert.equal(patches.length,2);assert.equal(patches[0].result.error.code,'PATIENT_CNIC_EXISTS');assert.equal(patches[1].status,200);assert(patches[1].reply_lost);j.original_write=patches[1];j.write_pending=false;save();
 await modal().getByRole('button',{name:'Read current record',exact:true}).click();await expect(modal()).toContainText(j.marker);await modal().getByRole('button',{name:'Discard draft and reload latest record',exact:true}).click();await expect(modal().getByLabel('Address',{exact:true})).toHaveValue(j.marker);await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();await modal().getByRole('button',{name:'Cancel',exact:true}).click();
 s.pass('Actual duplicate CNIC keeps editable draft; actual PATCH200 lost reply retains draft/locks Save, rapid double-click sends once, explicit read/reload confirms committed value with no automatic replay');
 // Finish display/help checks using the actual current master identifier.
 const scenario=JSON.parse(fs.readFileSync('docs/patient-merge-resume-scenario-2026-10-24.json'));const master=await s.native('api',{method:'GET',path:'/patients/'+scenario.scenario.saved.patient_id});assert(master.full_name.includes(scenario.scenario.run));await q.fill(master.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(p.locator('main article.card')).toContainText(master.full_name);await expect(p.locator('main article.card')).toContainText('Merged Profiles:');await capture(s,'patient_search');j.master=master;s.pass('Actual master MRN opens consolidated profile/history; current bilingual screenshots and both themes250% no overflow; backend old-MRN issue18 remains separate and unpassed');
 j.passed=true;s.j.passed=true;
}catch(e){j.error=e.stack;j.ui=await p.locator('body').innerText();console.error(e.stack);process.exitCode=1}finally{
 try{if(j.original){const current=await s.native('api',{method:'GET',path:'/patients/'+j.patient_id});if(current.address===j.marker){j.restore=await s.native('api',{method:'PATCH',path:'/patients/'+j.patient_id,body:{expected_version:current.row_version,address:j.original.address}})}const actual=await s.native('api',{method:'GET',path:'/patients/'+j.patient_id});assert.equal(actual.address,j.original.address);j.restored=true;}}
 catch(e){j.cleanup_error=e.stack;process.exitCode=1}
 j.trace=await s.trace();j.checks=s.j.checks;save();await s.close();j.preferences_restored=s.j.preferences_restored;j.finished=s.j.finished;save();
}

```
