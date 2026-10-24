// Two NEW synthetic patient-only records, no visits/payments; merge ONLY this test's duplicate.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-patient-merge-check-2026-10-24.json',control='docs/phase2-patient-merge-controller-2026-10-24.json';assert(!fs.existsSync(file),'Reconcile original patient-only creations/merge; never recreate');
const j={run:'DEMO-P2-MERGE-'+Date.now(),patients:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();const s=await session('phase2-patient-merge-check','demo.reception'),p=s.p;
try{
 for(const suffix of ['master','duplicate']){
  await s.nav('New registration + OPD slip');const again=p.getByRole('button',{name:'Start another registration',exact:true});if(await again.count())await again.click();
  await p.getByLabel('Full name',{exact:true}).fill(j.run+' '+suffix);await p.getByLabel('Age in years',{exact:true}).fill('35');await p.getByLabel('Mobile',{exact:true}).fill('03000000000');await p.getByLabel('Patient record only — no OPD visit',{exact:true}).check();j.create_pending=suffix;save();
  await p.getByRole('button',{name:'Register patient only',exact:true}).click();await expect(p.getByRole('heading',{name:'Patient registered',exact:true})).toBeVisible();
  const req=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/patients').at(-1);assert.equal(req.status,201);j.patients.push({kind:suffix,record:req.result.data,request:req});j.create_pending=null;save();
 }
 await p.evaluate(()=>{window.mergeEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&e.event_type==='patient.merged')window.mergeEvents.push(e)})});
 await s.nav('Patient search');const q=p.getByRole('searchbox',{name:'Patient search query',exact:true});await q.fill(j.run);await expect(p.locator('.patient-result')).toHaveCount(2);
 const master=j.patients[0].record,duplicate=j.patients[1].record;await p.locator('.patient-result').filter({hasText:duplicate.mrn}).click();await expect(p.locator('main article.card')).toContainText(duplicate.full_name);
 j.ready=true;save();console.log('WAIT merge source '+duplicate.patient_id+' target '+master.patient_id);
 for(let n=0;n<300;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).merged)break;if(n===299)throw Error('Own merge upstream not confirmed');await new Promise(r=>setTimeout(r,2000));}
 await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(master.mrn);await expect(p.locator('main article.card')).toContainText(master.full_name);
 j.events=await p.evaluate(()=>window.mergeEvents);assert(j.events.length);j.after_merge_trace=await s.trace();
 await q.fill(duplicate.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await expect(p.locator('.patient-result')).toContainText(master.mrn);j.alias_search=await s.native('api',{method:'GET',path:'/patients/search?q='+encodeURIComponent(duplicate.mrn)+'&limit=20'});assert.equal(j.alias_search[0].patient_id,master.patient_id);
 s.pass('Actual patient.merged event refreshes active search/detail to actual master without manual Refresh; one result/no duplicate, old-MRN plus Enter resolves master');
 const ar=await s.native('api',{method:'GET',path:'/patients/16'});j.ar_profile=ar;
 if(ar.outstanding.has_outstanding_ar){await q.fill(ar.mrn);await q.press('Enter');await expect(p.locator('.patient-result')).toHaveCount(1);await p.locator('.patient-result').click();const banner=p.locator('main article.card [role="alert"]').filter({hasText:ar.outstanding.banner_text});await expect(banner).toBeVisible();assert.equal(await banner.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(186, 37, 37)');s.pass('Read-only existing AR patient16 displays exact server outstanding banner in red above profile; no financial changes')}
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method!=='GET').length,2);assert(j.trace.requests.filter(r=>r.method==='POST').every(r=>r.path==='/api/v1/patients'));j.passed=true;save();
}catch(e){j.error=e.stack;j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}finally{await s.close();j.finished=new Date().toISOString();save()}
