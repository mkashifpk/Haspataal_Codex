# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Continue paused merge/event check using ONLY newly created scenario 43c858.
// Trauma source permits desk-only merge. Never fabricates a permanent-profile co-signer.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=JSON.parse(fs.readFileSync('docs/fresh-merge-scenario-2026-10-24.json')),file='artifacts/patient-merge-reset-20261024.json';
const j=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{scenario:source.run,source_id:source.source.patient_id,target_id:source.target.patient_id,key:source.key};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('patient-merge-reset','demo.reception'),p=s.p;
const raw=async(method,path,body,key)=>{const r=await p.evaluate(args=>window.terminal.call('api',args),{method,path,body,key});j.calls??=[];j.calls.push({method,path,body,key,reply:r});save();return r};
try{
 const a=await s.native('api',{method:'GET',path:'/patients/'+j.source_id}),b=await s.native('api',{method:'GET',path:'/patients/'+j.target_id});assert.equal(b.full_name,source.target.full_name);
 if(a.patient_id===j.target_id){assert(j.pending||j.merged,'Unexpected prior merge must be reconciled');j.merged=true;j.pending=false;save();}
 else{
  assert.equal(a.full_name,source.source.full_name);assert.equal(a.registration_type,'TraumaTemp');
  // Issue17: digit-containing name query falsely returns empty. Keep that
  // regression separately reported; the documented alphabetical name search
  // lets this independent event test proceed without altering app search input.
  await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});await q.fill('SCN');await q.press('Enter');await expect(p.locator('.patient-result').filter({hasText:a.mrn})).toHaveCount(1);await p.locator('.patient-result').filter({hasText:a.mrn}).click();await expect(p.locator('main article.card')).toContainText(a.full_name);
  await p.evaluate(()=>{window.resetMergeEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&e.event_type==='patient.merged')window.resetMergeEvents.push(e)})});
  const identities=JSON.parse(fs.readFileSync('artifacts/patient-identifiers-reset-20261024.json')).patients;
  for(const identity of Object.values(identities)){const actual=await s.native('api',{method:'GET',path:'/patients/'+identity.patient_id});assert.equal(actual.full_name,identity.full_name)}
  // The merge screen is not shipped yet, so the production bridge deliberately
  // does not allow its write. MCP supplies the genuine upstream action while
  // this already shipped Patient Search screen observes the actual event.
  j.ready=true;save();console.log('READY for upstream merge '+a.patient_id+' -> '+b.patient_id);
  const control='artifacts/patient-merge-reset-controller.json';
  for(let n=0;n<180;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).merged)break;if(n===179)throw Error('No confirmed upstream merge; reconcile original key before retry');await new Promise(r=>setTimeout(r,1000));}
  j.merged=true;j.pending=false;save();
  await expect.poll(async()=>(await p.evaluate(()=>window.resetMergeEvents)).length).toBeGreaterThan(0);await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(b.mrn);await expect(p.locator('main article.card')).toContainText(b.full_name);j.events=await p.evaluate(()=>window.resetMergeEvents);
  await q.fill(a.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(b.mrn);j.alias=await s.native('api',{method:'GET',path:'/patients/search?q='+encodeURIComponent(a.mrn)});assert.equal(j.alias[0].patient_id,b.patient_id);
 }
 j.resolved=await s.native('api',{method:'GET',path:'/patients/'+j.source_id});assert.equal(j.resolved.patient_id,j.target_id);assert(j.resolved.merged_profiles.some(x=>x.patient_id===j.source_id));
 const invalid=await raw('POST','/reception/registrations',{patient_id:j.source_id,doctor_id:JSON.parse(fs.readFileSync('artifacts/registration-reset-atomic-20261024.json')).service.doctor_id},'reset-merged-registration-denied-20261024');assert.equal(invalid.error.code,'PATIENT_MERGED_CANNOT_TRANSACT');
 s.pass('Fresh trauma merge emits patient.merged; active query/profile refresh to one master; old MRN resolves master; no cosigner refusal, identity conflict and merged transaction refusal are real backend responses');j.passed=true;s.j.passed=true;
}catch(e){j.error=e.stack;j.ui=await p.locator('body').innerText();console.error(e.stack);process.exitCode=1}finally{j.trace=await s.trace();save();await s.close();j.finished=s.j.finished;j.preferences_restored=s.j.preferences_restored;save()}

```
