import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const root='docs/backend-refresh-2026-10-30/dev/';
const admission=JSON.parse(fs.readFileSync(root+'admission-a-result.json')).body.data;
const suffix=process.argv[2]||'first';
const verbal=JSON.parse(fs.readFileSync(root+(suffix==='first'?'verbal-telephone':'verbal-live2')+'-result.json')).body.data;
const file=`artifacts/backend-refresh-live-ui-${suffix}.json`,j={started:new Date().toISOString(),checks:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));let nurse,doctor;save();
try{
 nurse=await session('refresh1030-live-nurse-'+suffix,'demo.nurse');doctor=await session('refresh1030-live-doctor-'+suffix,'demo.doctor');
 for(const s of [nurse,doctor]){s.p.on('dialog',d=>d.accept());await s.p.evaluate(()=>{window.__refreshEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.__refreshEvents.push(e);});});}
 await nurse.nav('Verbal and telephone orders');
 await nurse.p.getByText('Other permitted live admissions',{exact:true}).click();
 await nurse.p.getByLabel('Find permitted admission',{exact:true}).fill(admission.mrn);
 await nurse.p.getByRole('button').filter({hasText:admission.mrn}).click();
 await nurse.p.getByLabel('Pending countersignature only',{exact:true}).uncheck();
 await expect(nurse.p.getByRole('heading',{name:new RegExp(verbal.prescription_number)})).toBeVisible();
 await doctor.nav('Inpatient rounds');
 await doctor.p.locator('aside').getByRole('button').filter({hasText:admission.mrn}).click();
 await expect(doctor.p.getByText('Vitals and nursing observations',{exact:true})).toBeVisible();
 await help(doctor,doctor.p.getByRole('button',{name:'Refresh inpatient records',exact:true}),'Inpatient rounds & discharge');
 fs.writeFileSync('artifacts/backend-refresh-live-ready.json',JSON.stringify({admission_id:admission.admission_id,prescription_id:verbal.prescription_id,at:new Date().toISOString()}));
 await nurse.p.waitForFunction(id=>window.__refreshEvents.some(e=>e.event_type==='medication.order.updated'&&e.payload.prescription_id===id&&e.payload.change==='Countersigned'),verbal.prescription_id,{timeout:120000});
 const article=nurse.p.locator('article').filter({hasText:verbal.prescription_number});
 await expect(article).not.toContainText('Not countersigned');
 j.checks.push('Live nurse receives Countersigned event and the existing verbal-order screen refreshes signed state without manual refresh');save();
 for(const s of [doctor,nurse])await s.p.waitForFunction(id=>window.__refreshEvents.some(e=>e.event_type==='vitals.due'&&e.payload.admission_id===id),admission.admission_id,{timeout:120000});
 await expect(doctor.p.locator('.inpatient-rounds aside')).toContainText('Vitals overdue');
 j.checks.push('Both live authenticated nurse/doctor terminals receive worker vitals.due; doctor badge shows server overdue minutes');
 await expect.poll(async()=>{const trace=await doctor.trace(),event=await doctor.p.evaluate(id=>window.__refreshEvents.find(e=>e.event_type==='vitals.due'&&e.payload.admission_id===id),admission.admission_id);return trace.requests.some(r=>r.status===200&&r.method==='GET'&&r.path.endsWith(`/admissions/${admission.admission_id}/flowsheet`)&&r.started>=Date.parse(event.created_at));}).toBe(true);
 const trace=await doctor.trace();j.doctor_trace=trace;
 const events=await doctor.p.evaluate(()=>window.__refreshEvents);j.doctor_events=events;j.nurse_events=await nurse.p.evaluate(()=>window.__refreshEvents);
 const event=events.find(e=>e.event_type==='vitals.due'&&e.payload.admission_id===admission.admission_id);
 assert(trace.requests.some(r=>r.method==='GET'&&r.path.endsWith(`/admissions/${admission.admission_id}/flowsheet`)&&r.started>=Date.parse(event.created_at)));
 j.checks.push('Open doctor flowsheet reread after worker event; no doctor observation write');
 assert(!trace.requests.some(r=>r.method!=='GET'&&r.path.includes('/flowsheet/vitals')));
 await capture(doctor,'doctor_inpatients');await capture(nurse,'verbal_orders_ward');
 j.passed=true;save();
}catch(e){j.error=e.stack;try{j.nurse_ui=await nurse?.p.locator('body').innerText();j.doctor_ui=await doctor?.p.locator('body').innerText();j.nurse_events=await nurse?.p.evaluate(()=>window.__refreshEvents);j.doctor_events=await doctor?.p.evaluate(()=>window.__refreshEvents);}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{if(nurse)await nurse.close();if(doctor)await doctor.close();j.finished=new Date().toISOString();save();}
