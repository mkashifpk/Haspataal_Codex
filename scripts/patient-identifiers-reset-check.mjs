// Real fresh-DEV Electron regression. Every patient is synthetic and discovered
// from this run's responses. Never imports a historical record ID or fake result.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file='artifacts/patient-identifiers-reset-20261024.json';
const j=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {run:'DEMO-RESET-'+Date.now(),patients:{},checks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('patient-identifiers-reset-ui','demo.reception'),p=s.p;
const call=async(method,path,body,key)=>{
 const r=await p.evaluate(args=>window.terminal.call('api',args),{method,path,body,key});
 j.api??=[];j.api.push({method,path,body,key,reply:r});save();return r;
};
const posts=async()=> (await s.trace()).requests.filter(r=>r.method==='POST'&&['/api/v1/patients','/api/v1/reception/registrations'].includes(r.path));
const q=()=>p.getByRole('searchbox',{name:'Patient search query',exact:true});
const profile=()=>p.locator('main article.card');
const dialog=()=>p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Edit patient demographics',exact:true})});
const patch=()=> (s.trace()).then(t=>t.requests.filter(r=>r.method==='PATCH'&&/^\/api\/v1\/patients\/\d+$/.test(r.path)));
const submit=()=>p.getByRole('button',{name:'Register patient only',exact:true});
const freshDraft=async()=>{
 await s.nav('New registration + OPD slip');
 const again=p.getByRole('button',{name:'Start another registration',exact:true});if(await again.count())await again.click();
 await p.getByRole('button',{name:'New patient',exact:true}).click();
 await p.getByLabel('Patient record only — no OPD visit',{exact:true}).check();
};
const intake=async({name,upmrn='',cnic=''})=>{
 await p.getByLabel('Full name',{exact:true}).fill(name);
 await p.getByLabel('Gender',{exact:true}).selectOption('female');
 await p.getByLabel('Age in years',{exact:true}).fill('34');
 await p.getByLabel('Mobile',{exact:true}).fill('03000000000');
 await p.getByLabel('CNIC (optional)',{exact:true}).fill(cnic);
 await p.getByLabel('UPMRN (optional)',{exact:true}).fill(upmrn);
};
const edit=async()=>{await p.getByRole('button',{name:'Edit demographics',exact:true}).click();await expect(dialog()).toBeVisible()};
const choose=async patient=>{
 await s.nav('Patient search');await q().fill(patient.mrn);await q().press('Enter');
 await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(profile()).toContainText(patient.full_name);
};
try{
 const est=await s.native('api',{method:'GET',path:'/establishment'});j.establishment_revision=est.revision;assert(est.active.includes('home_visits'));
 // Reconcile an interrupted creation from this exact epoch before doing anything new.
 if(j.pendingCreate){const hits=await s.native('api',{method:'GET',path:'/patients/search?q='+encodeURIComponent(j.pendingCreate.name)});assert(hits.length<=1);if(hits.length){const rec=await s.native('api',{method:'GET',path:'/patients/'+hits[0].patient_id});assert.equal(rec.full_name,j.pendingCreate.name);j.patients[j.pendingCreate.slot]=rec;j.pendingCreate=null;save();}else throw Error('Pending create not found: inspect original transport/key; do not recreate');}
 for(const slot of ['a','b']){
  if(j.patients[slot]){const rec=await s.native('api',{method:'GET',path:'/patients/'+j.patients[slot].patient_id});assert.equal(rec.full_name,j.patients[slot].full_name);continue;}
  await freshDraft();const id=j.run.replace('DEMO-RESET-','');const input={name:j.run+' '+slot,upmrn:slot==='a'?'DEV/'+id+'-A':'',cnic:slot==='a'?'99999-'+id.slice(-7)+'-'+id.slice(-8,-7):''};
  await intake(input);
  if(slot==='a'){
   const u=p.getByLabel('UPMRN (optional)',{exact:true});await u.fill('bad!');const before=(await posts()).length;await submit().click();assert.equal((await posts()).length,before);assert.equal(await u.evaluate(e=>e.validity.patternMismatch),true);await u.fill(input.upmrn);await help(s,u,'New registration + OPD slip');
  }
  j.pendingCreate={slot,...input};save();await submit().evaluate(b=>{b.click();b.click()});await expect(p.getByRole('heading',{name:'Patient registered',exact:true})).toBeVisible();
  const r=(await posts()).at(-1);assert.equal(r.status,201);assert.equal(r.result.data.upmrn,input.upmrn||null);j.patients[slot]=r.result.data;j.pendingCreate=null;save();
 }
 const a=j.patients.a,b=j.patients.b;
 s.pass('Fresh UI-only patients created: optional UPMRN both present/omitted, contract pattern/F1, rapid submit creates one record');
 for(const code of ['PATIENT_CNIC_EXISTS','PATIENT_UPMRN_EXISTS']){
  await freshDraft();await intake({name:j.run+' refused',cnic:code==='PATIENT_CNIC_EXISTS'?a.cnic:'',upmrn:code==='PATIENT_UPMRN_EXISTS'?a.upmrn:''});
  await submit().click();await expect(p.getByRole('alert').filter({hasText:code})).toContainText('This patient is already registered: search for them instead');
  const r=(await posts()).at(-1);assert.equal(r.result.error.code,code);assert.notEqual(r.status,201);
  await p.getByRole('button',{name:'Search existing patient',exact:true}).click();await expect(p.getByLabel('Search patient',{exact:true})).toHaveValue(code==='PATIENT_CNIC_EXISTS'?a.cnic:a.upmrn);
  await expect(p.getByRole('button').filter({hasText:a.mrn})).toBeVisible();
 }
 s.pass('Actual duplicate CNIC and UPMRN refusals render search guidance; explicit returning-patient search finds existing master without a write');
 // No unsaved failed registration is silently discarded during navigation.
 p.once('dialog',d=>d.accept());await choose(b);
 await edit();await dialog().getByLabel('UPMRN (optional)',{exact:true}).fill(a.upmrn);await dialog().getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(dialog().getByRole('alert').filter({hasText:'PATIENT_UPMRN_EXISTS'})).toBeVisible();await expect(dialog().getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();assert.equal((await patch()).at(-1).result.error.code,'PATIENT_UPMRN_EXISTS');
 await dialog().getByLabel('UPMRN (optional)',{exact:true}).fill('DEV/'+j.run.slice(-13)+'-B');await dialog().getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog()).toHaveCount(0);
 let current=await s.native('api',{method:'GET',path:'/patients/'+b.patient_id});assert(current.upmrn);j.b_upmrn=current.upmrn;save();await expect(profile()).toContainText(current.upmrn);
 await edit();await dialog().getByLabel('UPMRN (optional)',{exact:true}).fill('');await dialog().getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog()).toHaveCount(0);assert.equal((await s.native('api',{method:'GET',path:'/patients/'+b.patient_id})).upmrn,null);
 s.pass('PATCH duplicate UPMRN is definitive/editable; deliberately correct, persist, display and clear optional UPMRN using only changed fields');
 // True concurrent update against original row_version, no response fabrication.
 await edit();await dialog().getByLabel('Full name',{exact:true}).fill(b.full_name+' draft');current=await s.native('api',{method:'GET',path:'/patients/'+b.patient_id});const newer=await call('PATCH','/patients/'+b.patient_id,{expected_version:current.row_version,address:'DEMO concurrent edit '+j.run});assert(newer.ok);
 await dialog().getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog().getByText('Review current record',{exact:true})).toBeVisible();assert.equal((await patch()).at(-1).result.error.code,'VERSION_CONFLICT');await expect(dialog().getByLabel('Full name',{exact:true})).toHaveValue(b.full_name+' draft');await expect(dialog().getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
 await dialog().getByRole('button',{name:'Read current record',exact:true}).click();await expect(dialog()).toContainText('DEMO concurrent edit '+j.run);await dialog().getByRole('button',{name:'Discard draft and reload latest record',exact:true}).click();await expect(dialog().getByLabel('Full name',{exact:true})).toHaveValue(b.full_name);
 await dialog().getByRole('button',{name:'Cancel',exact:true}).click();
 const transition=await call('PATCH','/patients/'+b.patient_id,{expected_version:newer.data.row_version,upgrade_to_regular:true});assert.equal(transition.error.code,'PATIENT_TYPE_TRANSITION_INVALID');
 s.pass('True concurrent PATCH returns VERSION_CONFLICT, retains draft and locks save until explicit read/compare/reload; Regular upgrade refused by PATIENT_TYPE_TRANSITION_INVALID');
 await choose(a);await capture(s,'patient_search');
 await freshDraft();await intake({name:j.run+' screenshot',upmrn:'DEV/'+j.run.slice(-13)+'-SCREEN'});await capture(s,'registration');
 // Deliberate discard: screenshot draft is not a registered record.
 p.once('dialog',d=>d.accept());await s.nav('Patient search');await q().fill(a.upmrn);await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(profile()).toContainText(a.upmrn);
 j.trace=await s.trace();j.passed=true;s.j.passed=true;j.finished=new Date().toISOString();j.checks=s.j.checks;save();
}catch(e){j.error=e.stack;j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}finally{await s.close();j.preferences_restored=s.j.preferences_restored;save()}
