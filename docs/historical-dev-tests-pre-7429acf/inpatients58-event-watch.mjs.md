# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import assert from 'node:assert/strict';import {session,expect} from './clinical-test-kit.mjs';
const name=process.argv[2]||'inpatients58-checks-watch',file='artifacts/'+name+'.json',stop='artifacts/'+name+'.stop';assert(!fs.existsSync(file),'Reconcile existing watcher sessions first');const fixture=JSON.parse(fs.readFileSync('docs/inpatients58-checks/scenario-result.json')).saved;let doctor,nurse;const j={ready:false,finished:null,admission_id:fixture.admission_id,doctor:[],nurse:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{doctor=await session(name+'-doctor','demo.doctor');nurse=await session(name+'-nurse','demo.nurse');const p=doctor.p;await doctor.nav('Inpatient rounds & discharge');await p.getByLabel('Known admission reference',{exact:true}).fill(String(fixture.admission_id));await p.getByRole('button',{name:'Read this admission',exact:true}).click();await expect(p.locator('article.card')).toContainText(fixture.mrn);
 for(const s of [doctor,nurse])await s.p.evaluate(id=>{window.__checkEvents=[];window.terminal.subscribe(v=>{if(v.type==='event'&&v.payload?.admission_id===id&&['admission.overflow_assigned','vitals.due'].includes(v.event_type))window.__checkEvents.push(v);});},fixture.admission_id);
 j.ready=true;save();console.log('READY real Doctor and Nurse event listeners; no business writes');const until=Date.now()+600000;while(!fs.existsSync(stop)&&Date.now()<until){j.doctor=await doctor.p.evaluate(()=>window.__checkEvents);j.nurse=await nurse.p.evaluate(()=>window.__checkEvents);save();await new Promise(r=>setTimeout(r,2000));}
 j.ui=await doctor.p.locator('article.card').innerText();j.doctorTrace=await doctor.trace();j.nurseTrace=await nurse.trace();j.passed=j.doctor.some(v=>v.event_type==='admission.overflow_assigned');j.vitals_doctor=j.doctor.some(v=>v.event_type==='vitals.due');j.vitals_nurse=j.nurse.some(v=>v.event_type==='vitals.due');save();console.log(JSON.stringify({passed:j.passed,vitals_doctor:j.vitals_doctor,vitals_nurse:j.vitals_nurse}));
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}finally{if(nurse)await nurse.close();if(doctor)await doctor.close();j.finished=new Date().toISOString();save();}

```
