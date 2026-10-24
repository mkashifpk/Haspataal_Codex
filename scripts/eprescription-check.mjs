// Real synthetic external-market order only: no pharmacy dispense/payment or physical handover.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file='artifacts/eprescription-check.json',prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):undefined,resume=process.argv.includes('--resume');
const s=await session('eprescription-check','demo.doctor2'),p=s.p;
s.j.run=resume&&prior?.run?prior.run:'DEMO-RX-'+Date.now();s.save();
const writes=async()=>(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.startsWith('/api/v1/prescriptions'));
try{
 const ticket=await s.native('api',{method:'GET',path:'/opd-tickets/14'});assert.equal(ticket.patient_id,18);assert.equal(ticket.doctor_id,11);assert(!ticket.is_clinical_locked);
 const summary=await s.native('api',{method:'GET',path:'/patients/18/master-summary'});
 const originals=[];for(const r of summary.prescriptions){const d=await s.native('api',{method:'GET',path:`/prescriptions/${r.prescription_id}`});if(d.notes===s.j.run)originals.push(d)}
 if(!resume)assert.equal(originals.length,0);else assert(prior?.run&&originals.length===1,'Read original prescription before continuation');
 await s.nav('Consultation (EMR)');await p.getByLabel('OPD slip number',{exact:true}).fill(ticket.ticket_number);await p.getByLabel('OPD slip number',{exact:true}).press('Enter');
 await expect(p.locator('main')).toContainText(ticket.mrn);await p.getByRole('button',{name:'Prescribe',exact:true}).click();await expect(p.locator('main h1')).toHaveText('E-prescription builder');await expect(p.locator('main')).toContainText(ticket.mrn);
 let saved=originals[0];
 if(saved&&resume){
   const journals=[prior,...fs.readdirSync('artifacts').filter(n=>/^eprescription-check-\d+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync('artifacts/'+n)))];
   const original=journals.flatMap(j=>j.original_create?[j.original_create]:(j.trace?.requests||[])).find(r=>r.method==='POST'&&r.path==='/api/v1/prescriptions'&&r.result?.data?.prescription_id===saved.prescription_id&&r.body?.notes===s.j.run&&r.reply_lost);
   if(original?.reply_lost){assert(original.key&&original.body.notes===s.j.run);s.j.original_create=original;s.save();const replay=await s.native('api',{method:'POST',path:'/prescriptions',body:original.body,key:original.key});assert.equal(replay.prescription_id,saved.prescription_id);const sent=(await writes()).find(r=>r.key===original.key);assert.equal(sent.replay,'true');s.pass('Resume reads original saved RX1, then exact retained key/body replay returns SAME prescription; no replacement created')}
 }
 if(!saved){
  await expect(p.getByLabel('Prescription destination',{exact:true})).toHaveValue('');
  const search=p.getByLabel('Search medicines',{exact:true});await search.fill('pa');await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes('/drugs/search?q=pa')&&r.status===200)).toBe(true);
  const detail=p.getByRole('button',{name:'Stock details',exact:true}).first();if(await detail.count()){await detail.click();await expect(p.getByRole('dialog')).toContainText('Medicine stock details');await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.includes('/stock-status')&&r.status===200)).toBe(true);await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()}
  await p.getByLabel('Prescription destination',{exact:true}).selectOption('ExternalMarket');await p.getByLabel('Linked consultation',{exact:true}).selectOption('1');
  await p.getByRole('button',{name:'Add external medicine',exact:true}).click();await p.getByLabel('External medicine name',{exact:true}).fill('DEMO software check — not for patient use');await p.getByLabel('Strength',{exact:true}).fill('TEST ONLY');await p.getByLabel('Form',{exact:true}).fill('Synthetic');
  await p.getByLabel('Quantity prescribed',{exact:true}).fill('1e2');await p.getByRole('button',{name:'Create prescription',exact:true}).click();await expect(p.getByRole('alert').filter({hasText:'positive quantity'})).toBeVisible();assert.equal((await writes()).length,0);
  await p.getByLabel('Quantity prescribed',{exact:true}).fill('1');await p.getByLabel('Dose (include units)',{exact:true}).fill('Synthetic software test only');await p.getByLabel('Route',{exact:true}).selectOption('Oral');await p.getByLabel('Frequency',{exact:true}).selectOption('STAT');await p.getByLabel('Prescription notes',{exact:true}).fill(s.j.run);
  await help(s,p.getByLabel('Dose (include units)',{exact:true}),'E-prescription builder');await expect(p.getByLabel('Dose (include units)',{exact:true})).toHaveValue('Synthetic software test only');
  await s.fault({failPath:'/api/v1/prescriptions',failMethod:'POST',once:true});await p.getByRole('button',{name:'Create prescription',exact:true}).dblclick();
  await expect(p.getByRole('button',{name:'Retry original request',exact:true})).toBeVisible();const first=(await writes()).filter(r=>r.path==='/api/v1/prescriptions');assert.equal(first.length,1);assert.equal(first[0].status,201);s.j.original_create=first[0];s.j.prescription_id=first[0].result.data.prescription_id;s.save();
  await expect(p.getByLabel('Dose (include units)',{exact:true})).toBeDisabled();await p.getByRole('button',{name:'Retry original request',exact:true}).click();
  await expect(p.getByRole('button',{name:'Save prescription PDF',exact:true})).toBeVisible();const create=(await writes()).filter(r=>r.path==='/api/v1/prescriptions');assert.equal(create.length,2);assert.equal(create[0].key,create[1].key);assert.deepEqual(create[0].body,create[1].body);assert.equal(create[1].result.data.prescription_id,s.j.prescription_id);assert.equal(create[1].replay,'true');
  saved=await s.native('api',{method:'GET',path:`/prescriptions/${s.j.prescription_id}`});
  assert.equal(saved.destination,'ExternalMarket');assert.equal(saved.status,'ExternalPrinted');assert.equal(saved.encounter_id,1);assert.equal(saved.dispensations.length,0);
  s.pass('Consultation→Rx identity retained; real formulary/stock reads; invalid quantity blocks POST; F1 draft/focus; deliberate destination and linked Final consultation; lost201 same-key replay SAME Rx, double-click single-flight');
 }else{ s.j.prescription_id=saved.prescription_id;s.save();await p.getByRole('button').filter({hasText:saved.prescription_number}).first().click();await expect(p.getByRole('button',{name:'Save prescription PDF',exact:true})).toBeVisible() }
 const payload=await s.native('api',{method:'GET',path:`/prescriptions/${saved.prescription_id}/print-payload`});assert.equal(payload.fields.consultation.encounter_id,1);assert.equal(payload.fields.consultation.examination_consent,'VerbalObtained');assert(payload.text.includes('VCO'));assert(payload.text.includes('Signature'));assert(payload.fields.prescriber_stamp.text);
 await s.app.evaluate(({dialog,app})=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:process.cwd()+'/artifacts/eprescription-issued.pdf'});app.on('browser-window-created',(_,w)=>{w.webContents.print=(_,cb)=>{globalThis.clinicalTrace.prints++;cb(false,'TEST: user cancelled prescription printing')}})});
 const before=(await writes()).length;await p.getByRole('button',{name:'Save prescription PDF',exact:true}).click();await expect(p.getByText('PDF saved.',{exact:true})).toBeVisible();assert.equal(fs.readFileSync('artifacts/eprescription-issued.pdf').subarray(0,5).toString(),'%PDF-');
 await p.getByRole('button',{name:'Print prescription',exact:true}).click();await expect(p.getByRole('alert').filter({hasText:/cancelled prescription|No receipt printer|not installed/})).toBeVisible();assert.equal((await writes()).length,before);
 if(saved.status!=='Cancelled'){
  await p.getByRole('button',{name:'Record handover',exact:true}).click();await expect(p.getByLabel('Handed to',{exact:true})).toHaveValue('');await expect(p.getByLabel('Copy kept',{exact:true})).toHaveValue('');await p.getByRole('button',{name:'Confirm prescription action',exact:true}).click();await expect(p.getByRole('alert').filter({hasText:'Confirm the actual handover'}).last()).toBeVisible();assert.equal((await writes()).length,before);await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await p.getByRole('button',{name:'Cancel prescription',exact:true}).click();await p.getByLabel('Cancellation reason',{exact:true}).fill(s.j.run+' synthetic order cancelled after software verification; no medicines supplied');
  await s.fault({failPath:`/api/v1/prescriptions/${saved.prescription_id}/cancel`,failMethod:'POST',once:true});await p.getByRole('button',{name:'Confirm prescription action',exact:true}).click();await expect(p.getByRole('button',{name:'Read current result',exact:true})).toBeVisible();assert.equal(await p.getByRole('button',{name:'Retry original request',exact:true}).count(),0);
  await p.getByRole('button',{name:'Read current result',exact:true}).click();await expect(p.getByRole('dialog')).toContainText('Cancelled');await p.getByRole('button',{name:'Result reviewed; return to draft',exact:true}).click();
  p.once('dialog',d=>d.accept());await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await p.getByRole('button').filter({hasText:saved.prescription_number}).first().click();await expect(p.locator('main')).toContainText('Cancelled');
  assert.equal((await writes()).filter(r=>r.path.endsWith('/cancel')).length,1);
 }
 const final=await s.native('api',{method:'GET',path:`/prescriptions/${saved.prescription_id}`});assert.equal(final.status,'Cancelled');assert.equal(final.handovers.length,0);assert.equal(final.dispensations.length,0);s.j.final=final;s.save();
 s.pass('Issued text links VCO/consultation/stamp/directions/signature; actual receipt PDF; printer cancellation no repeat; unconfirmed handover blocks write; lost cancellation reconciles by GET with ZERO cancel replay; no physical handover/dispense/payment');
 // Refresh read-only screen before screenshots: do not capture transient printer diagnostic as handbook content.
 await s.nav('Consultation (EMR)');await p.getByRole('button',{name:'Prescribe',exact:true}).click();await p.getByRole('button').filter({hasText:final.prescription_number}).first().click();await expect(p.locator('main h2').filter({hasText:final.prescription_number})).toBeVisible();await p.evaluate(()=>scrollTo(0,0));
 await capture(s,'eprescription');s.pass('English/Urdu read-only prescription, both themes250 without document overflow; no fabricated handover');s.j.passed=true;s.j.business_complete=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);try{await p.screenshot({path:'artifacts/eprescription-failure.png'});s.j.failure_ui=await p.locator('body').innerText();s.save()}catch{}process.exitCode=1}finally{await s.close()}
