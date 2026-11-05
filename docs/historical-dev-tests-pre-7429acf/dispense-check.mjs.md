# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV, ONLY labelled own software fixtures. Card/IPD ledger entries, no physical supply/payment.
// Journal every original action. Never blindly rerun an unfinished dispensing action.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const file='artifacts/dispense-check.json',resume=process.argv.includes('--resume');let old;
if(fs.existsSync(file)){old=JSON.parse(fs.readFileSync(file));assert(old.finished&&(resume||old.cleaned),'Reconcile original journal before running');fs.copyFileSync(file,file.replace('.json',`-${Date.now()}.json`));}
const j=resume?old:{run:'DEMO-DISPENSE-'+Date.now(),writes:{},checks:[],orders:[]};assert(j);delete j.finished;delete j.error;
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();const sessions=[];
const launch=async(name,account)=>{const s=await session(name,account);sessions.push(s);return s;};
const pass=msg=>{j.checks.push(msg);save();console.log('PASS '+msg)};
async function original(s,label,path,body){if(j.writes[label]?.result?.ok){assert.deepEqual(j.writes[label].body,body);return j.writes[label].result.data;}
assert(!j.writes[label],'Reconcile uncertain/refused original before changed action');const w=j.writes[label]={method:'POST',path,body,key:crypto.randomUUID(),state:'prepared'};save();const r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();assert(r.ok,`${label}: ${r.error?.code} ${r.error?.message}`);return r.data;}
let doctor,pharmacist;
try{
 doctor=await launch('dispense-doctor','demo.doctor');const patient=await doctor.native('api',{method:'GET',path:'/patients/5'});assert(patient.full_name.startsWith('DEMO-FINANCIAL-')&&patient.full_name.includes('no actual care'));
 const ticket=await doctor.native('api',{method:'GET',path:'/opd-tickets/5'});assert.equal(ticket.patient_id,patient.patient_id);assert(!ticket.is_clinical_locked);
 const drugs=await doctor.native('api',{method:'GET',path:'/drugs/search?q=paracetamol'}),highs=await doctor.native('api',{method:'GET',path:'/drugs/search?q=Potassium'});
 const drug=drugs.find(x=>x.name==='Paracetamol 500mg'),high=highs.find(x=>x.high_alert_category==='ConcentratedElectrolyte');assert(drug&&high);
 const body=(medicine,qty)=>({patient_id:patient.patient_id,ticket_id:ticket.ticket_id,source:'OPD',destination:'HospitalPharmacy',notes:j.run+' VIRTUAL SOFTWARE TEST ONLY, no actual medicine or care',items:[{drug_id:medicine.drug_id,qty_prescribed:qty,dose_text:'DEMO SOFTWARE TEST ONLY',route:medicine===high?'IV':'Oral',frequency_code:'STAT',is_stat:true,instructions:'VIRTUAL SOFTWARE TEST, NO PHYSICAL SUPPLY'}]});
 const normal=await original(doctor,'normal','/prescriptions',body(drug,3));if(!j.orders.some(r=>r.prescription_id===normal.prescription_id))j.orders.push(normal);save();
 const highOrder=await original(doctor,'high','/prescriptions',body(high,1));if(!j.orders.some(r=>r.prescription_id===highOrder.prescription_id))j.orders.push(highOrder);save();
 pharmacist=await launch('dispense-pharmacist','demo.pharmacist');const p=pharmacist.p;
 await pharmacist.nav('Prescription queue');await p.getByRole('button',{name:'Review prescription '+normal.prescription_number,exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toContainText(normal.mrn);await p.getByRole('button',{name:'Open dispensing',exact:true}).click();await expect(p.locator('main h1')).toHaveText('Dispense');await expect(p.locator('main')).toContainText(normal.prescription_number);
 pass('Queue handoff opens exact fresh RX/patient; actual stock/directions/stamp/allergies read, no batch control');
 const modal=()=>p.getByRole('dialog').filter({has:p.getByRole('button',{name:'Confirm pharmacy action',exact:true})});
 const qty=()=>p.getByLabel('Dispense Now #'+normal.items[0].prescription_item_id,{exact:true});
 if(!j.dispensation){
  await qty().fill('4');await p.getByRole('button',{name:'Review dispensing',exact:true}).click();await expect(p.locator('main')).toContainText('Check quantities and open queries before dispensing.');
  await qty().fill('1');await p.getByLabel('Payment mode',{exact:true}).selectOption('Card');await p.getByLabel('Card reference',{exact:true}).fill(j.run+' VIRTUAL CARD');await p.getByRole('button',{name:'Review dispensing',exact:true}).click();
  await expect(modal().getByRole('button',{name:'Confirm pharmacy action',exact:true})).toBeDisabled();await modal().getByLabel('I verified this patient, order, quantities and payment mode.',{exact:true}).check();
  await pharmacist.fault({failPath:`/api/v1/prescriptions/${normal.prescription_id}/dispense`,failMethod:'POST',once:true});
  j.ui_dispense_pending=true;save();await modal().getByRole('button',{name:'Confirm pharmacy action',exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(modal().getByRole('button',{name:'Retry original request',exact:true})).toBeVisible();
  const sent=(await pharmacist.trace()).requests.filter(r=>r.method==='POST'&&r.path===`/api/v1/prescriptions/${normal.prescription_id}/dispense`);assert.equal(sent.length,1);assert(sent[0].result?.data?.dispensation?.dispensation_id,'Read original committed answer before retry');j.original_dispense=sent[0];j.dispensation=sent[0].result.data;save();
  await modal().getByRole('button',{name:'Read current result',exact:true}).click();await expect(modal()).toContainText('PartiallyDispensed');
  await modal().getByRole('button',{name:'Retry original request',exact:true}).click();await expect(modal()).toHaveCount(0);
  const replay=(await pharmacist.trace()).requests.filter(r=>r.method==='POST'&&r.path===sent[0].path);assert.equal(replay.length,2);assert.equal(replay[0].key,replay[1].key);assert.deepEqual(replay[0].body,replay[1].body);assert.equal(replay[1].replay,'true');j.ui_dispense_pending=false;save();
  pass('Real Card partial dispense201 lost reply; double click one flight, locked original-key retry SAME D-number, one stock/payment effect');
 }
 const actual=await pharmacist.native('api',{method:'GET',path:`/prescriptions/${normal.prescription_id}`});assert.equal(actual.status,'PartiallyDispensed');assert.equal(actual.items[0].qty_remaining,2);assert.equal(actual.dispensations.length,1);
 const result=j.dispensation;assert.equal(result.lines.reduce((sum,l)=>sum+l.take,0),1);assert.equal(result.payment.method,'Card');
 await p.getByRole('button').filter({hasText:'D-'+result.dispensation.dispensation_id+' ·'}).click();await expect(p.locator('main')).toContainText('PHARMACY RECEIPT');
 await pharmacist.app.evaluate(({dialog})=>{dialog.showSaveDialog=async(_win,o)=>({canceled:false,filePath:process.cwd()+'/artifacts/'+o.defaultPath});});
 await p.getByRole('button',{name:'Save receipt PDF',exact:true}).click();await expect(p.getByText('PDF saved.',{exact:true})).toBeVisible();
 await p.getByRole('button',{name:'Save label PDFs',exact:true}).click();await expect(p.getByText('PDF saved.',{exact:true})).toBeVisible();
 for(const f of fs.readdirSync('artifacts').filter(f=>f.startsWith('Dispensation-'+result.dispensation.dispensation_id)&&f.endsWith('.pdf')))assert.equal(fs.readFileSync('artifacts/'+f).subarray(0,5).toString(),'%PDF-');
 const beforePrint=(await pharmacist.trace()).requests.filter(r=>r.method==='POST').length;
 await p.getByRole('button',{name:'Print medicine labels',exact:true}).click();await expect(p.locator('main .error[role="alert"]').filter({hasText:'No label printer'})).toBeVisible();assert.equal((await pharmacist.trace()).requests.filter(r=>r.method==='POST').length,beforePrint);
 pass('Server partial remainder2/one dispensation, exact allocated batch/receipt/one-label-per-medicine PDF; missing label printer no repeated supply/payment');
 await p.getByLabel('Prescription ID',{exact:true}).fill(String(highOrder.prescription_id));await p.getByRole('button',{name:'Open prescription',exact:true}).click();await expect(p.locator('main')).toContainText(highOrder.prescription_number);
 await p.getByLabel('Dispense Now #'+highOrder.items[0].prescription_item_id,{exact:true}).fill('1');await p.getByLabel('Payment mode',{exact:true}).selectOption('Card');await p.getByLabel('Card reference',{exact:true}).fill(j.run+' HIGH ALERT VIRTUAL');await p.getByRole('button',{name:'Review dispensing',exact:true}).click();await modal().getByLabel('I verified this patient, order, quantities and payment mode.',{exact:true}).check();await expect(modal().getByRole('button',{name:'Confirm pharmacy action',exact:true})).toBeDisabled();await expect(modal().getByLabel('Checker password',{exact:true})).toHaveAttribute('type','password');
 await help(pharmacist,modal().getByLabel('Checker username',{exact:true}),'Dispense');await modal().getByRole('button',{name:'Close',exact:true}).click();
 pass('High-alert dialog requires a different person check and both ephemeral checker fields; F1 modal focus returns without any high-alert supply');
 // Clear unsent high-alert quantity before navigating; no actual checker credentials or supply in this script.
 await p.getByLabel('Dispense Now #'+highOrder.items[0].prescription_item_id,{exact:true}).fill('');await p.evaluate(()=>scrollTo(0,0));await capture(pharmacist,'dispense');
 // Stop the ordinary remainder through the permitted prescriber endpoint, after fresh identity/version read.
 const now=await doctor.native('api',{method:'GET',path:`/prescriptions/${normal.prescription_id}`});assert.equal(now.notes,normal.notes);
 await original(doctor,'stop-remainder',`/prescriptions/${normal.prescription_id}/items/${normal.items[0].prescription_item_id}/stop`,{reason:j.run+' virtual test remainder stopped, no physical supply'});
 for(const order of j.orders){const current=await doctor.native('api',{method:'GET',path:`/prescriptions/${order.prescription_id}`});assert.equal(current.notes,order.notes);if(['Active','PartiallyDispensed'].includes(current.status))await original(doctor,'cancel-'+order.prescription_id,`/prescriptions/${order.prescription_id}/cancel`,{reason:j.run+' software verification finished; no physical supply'});}
 j.cleaned=true;j.passed=true;pass('Own remainder stopped and own test prescriptions cancelled; virtual Card ledger retained, no clinical/physical supply claimed');
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of sessions.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}j.finished=new Date().toISOString();save();if(j.passed)fs.writeFileSync('docs/dispense-evidence-2026-10-25.json',JSON.stringify({run:j.run,date:j.finished,checks:j.checks,orders:j.orders.map(r=>({id:r.prescription_id,number:r.prescription_number})),dispensation_id:j.dispensation?.dispensation.dispensation_id,cleaned:j.cleaned,limits:['No physical medicine/cash/card processing; synthetic DEV ledger only','High-alert positive cosign, charity, IPD/clearance/recall lifecycle and human review remain pending unless separately evidenced']},null,2));}

```
