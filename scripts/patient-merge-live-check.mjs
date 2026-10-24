// Real Patient Search event/identity regression. MCP supplies the upstream merge;
// no unbuilt-screen write is added to the production bridge, no co-signer used.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const scenarioPath=process.argv[2];assert(scenarioPath,'Pass the saved fresh scenario JSON; never default to an old pair');
const source=JSON.parse(fs.readFileSync(scenarioPath)),run=source.scenario.run;assert(/^[a-z0-9]+$/i.test(run));
const file=`artifacts/patient-merge-live-${run}.json`,control=`artifacts/patient-merge-live-${run}-controller.json`;
if(fs.existsSync(file)){const previous=JSON.parse(fs.readFileSync(file));assert(previous.finished&&previous.preferences_restored&&!previous.merged,'Reconcile prior run; a confirmed merge cannot generate another event');fs.copyFileSync(file,file+'.previous');}
assert(!fs.existsSync(control),'A stale controller must never count as a new merge');
const j={run,source_id:source.scenario.saved.trauma_patient_id,target_id:source.scenario.saved.patient_id,key:source.merge_key,checks:[],merged:false};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('patient-merge-live-ui-'+run,'demo.reception'),p=s.p;
const profile=()=>p.locator('main article.card'),modal=()=>p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Edit patient demographics',exact:true})});
try{
 const a=await s.native('api',{method:'GET',path:'/patients/'+j.source_id}),b=await s.native('api',{method:'GET',path:'/patients/'+j.target_id});
 assert(a.full_name.includes(run));assert(b.full_name.includes(run));assert.equal(a.registration_type,'TraumaTemp');assert.equal(a.merged_into_id,null);j.source=a;j.target=b;save();
 await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});await q.fill(a.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();await expect(profile()).toContainText(a.full_name);
 await p.getByRole('button',{name:'Edit demographics',exact:true}).click();await modal().getByLabel('Full name',{exact:true}).fill(a.full_name+' unsent draft');await help(s,modal().getByLabel('Full name',{exact:true}),'Patient search');
 await p.evaluate(()=>{window.patientMergeEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&e.event_type==='patient.merged')window.patientMergeEvents.push(e)})});
 j.ready=true;save();console.log('READY '+run+' source '+a.patient_id+' target '+b.patient_id);
 for(let n=0;n<180;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).merged)break;if(n===179)throw Error('Upstream merge unconfirmed; inspect original key before retry');await new Promise(r=>setTimeout(r,1000));}
 j.merged=true;save();await expect.poll(async()=>(await p.evaluate(()=>window.patientMergeEvents)).length).toBeGreaterThan(0);j.events=await p.evaluate(()=>window.patientMergeEvents);save();
 await expect(profile()).toContainText(b.full_name);await expect(profile().getByRole('heading',{name:a.full_name,exact:true})).toHaveCount(0);
 await expect(modal().getByLabel('Full name',{exact:true})).toHaveValue(a.full_name+' unsent draft');await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();await expect(modal()).toContainText('This profile was merged.');
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path===`/api/v1/patients/${b.patient_id}/financial-summary`&&r.status===200)).toBe(true);
 s.pass('Real merge event loads master identity/financials; preserves old edit draft and blocks Save, no stale source edit');
 // Actual server read succeeds but its reply is lost: preserve the draft and
 // show the error; recovery must read the real master again, never replay PATCH.
 await s.fault({failPath:'/patients/'+b.patient_id,failMethod:'GET',once:true});await modal().getByRole('button',{name:'Read current record',exact:true}).click();await expect(modal().getByRole('alert').last()).toBeVisible();await expect(modal().getByLabel('Full name',{exact:true})).toHaveValue(a.full_name+' unsent draft');await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
 await s.fault({failPath:null});await modal().getByRole('button',{name:'Read current record',exact:true}).click();await expect(modal().getByRole('button',{name:'Discard draft and reload latest record',exact:true})).toBeVisible();await modal().getByRole('button',{name:'Discard draft and reload latest record',exact:true}).click();await expect(modal().getByLabel('Full name',{exact:true})).toHaveValue(b.full_name);await expect(modal().getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();await modal().getByRole('button',{name:'Cancel',exact:true}).click();
 await q.fill(a.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(b.mrn);await p.locator('.patient-result').click();await expect(profile()).toContainText(b.full_name);
 j.retained=await s.native('api',{method:'GET',path:'/patients/'+a.patient_id});assert.equal(j.retained.master_patient_id,b.patient_id);assert.equal(j.retained.merged_into_id,b.patient_id);j.master=await s.native('api',{method:'GET',path:'/patients/'+b.patient_id});assert(j.master.merged_profiles.some(x=>x.patient_id===a.patient_id));
 await capture(s,'patient_search');j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method!=='GET').length,0);s.pass('Lost current-master read is visible, deliberate discard/reload reconciles identity; old MRN+Enter finds exactly one master, F1/ENUR/250%, ZERO business writes in UI');s.j.passed=true;j.passed=true;
}catch(e){j.error=e.stack;j.events=await p.evaluate(()=>window.patientMergeEvents||[]);j.ui=await p.locator('body').innerText();console.error(e.stack);process.exitCode=1}finally{j.trace=await s.trace();j.checks=s.j.checks;save();await s.close();j.finished=s.j.finished;j.preferences_restored=s.j.preferences_restored;save()}
