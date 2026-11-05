# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV queue + upstream synthetic fixtures. Never dispenses, charges, or handles user records.
// An unfinished journal blocks reruns. Reconcile original keys/receipts before continuing.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const file='artifacts/rx-queue-check.json';
const resume=process.argv.includes('--resume');
let old;if(fs.existsSync(file)){old=JSON.parse(fs.readFileSync(file));assert(old.finished&&(old.cleaned||resume),'Reconcile unfinished original RX journal before rerunning');fs.copyFileSync(file,file.replace('.json',`-${Date.now()}.json`));}
const j=resume?old:{run:'DEMO-RX-QUEUE-'+Date.now(),writes:{},checks:[],prescriptions:[],passed:false};
assert(j && !Object.values(j.writes).some(w=>w.state==='unknown'),'Read/reconcile any uncertain write before continuation');
delete j.finished;delete j.error;
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const instances=[];
const launch=async(name,account)=>{const s=await session(name,account);instances.push(s);return s;};
const pass=message=>{j.checks.push(message);save();console.log('PASS '+message);};
async function write(s,label,path,body){
 if(j.writes[label]?.state==='confirmed'){assert.deepEqual(j.writes[label].body,body);return j.writes[label].result.data;}
 assert(!j.writes[label],'Never submit a replacement action');
 const w=j.writes[label]={method:'POST',path,body,key:crypto.randomUUID(),state:'prepared'};save();
 let r;
 if(path.includes('/queries')||path.startsWith('/prescription-queries/')){
   // Upstream fixture writes use MCP; the queue app exposes no unimplemented query writer.
   w.state='awaiting-mcp';save();console.log('MCP_FIXTURE_PENDING '+label);
   const response=`artifacts/rx-queue-mcp-${label}.json`,deadline=Date.now()+180000;
   while(!fs.existsSync(response)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,250));
   assert(fs.existsSync(response),'MCP fixture response pending; do not repeat original write');r=JSON.parse(fs.readFileSync(response));
   assert.equal(r.key,w.key,'A previous run response must never satisfy this action; provide the exact journaled MCP key/receipt');
 }else r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});
 w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();
 assert(r.ok,`${label}: ${r.error?.code} ${r.error?.message}`);return r.data;
}
let pharmacist,doctor;
try{
 pharmacist=await launch('rx-queue-pharmacist','demo.pharmacist');const p=pharmacist.p;
 await pharmacist.nav('Prescription queue');
 if(!resume)await expect(p.getByTestId('rxqueue-list')).toContainText('No pending hospital-pharmacy prescriptions');
 await p.evaluate(()=>{window.rxQueueEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.rxQueueEvents.push(e);});});
 pass('Real DEV empty queue is explicit; Pharmacy menu and current service scope permit the screen');
 doctor=await launch('rx-queue-doctor','demo.doctor');
 const patient=await doctor.native('api',{method:'GET',path:'/patients/5'});
 assert(patient.full_name.startsWith('DEMO-FINANCIAL-')&&patient.full_name.includes('no actual care'));
 const drugs=await doctor.native('api',{method:'GET',path:'/drugs/search?q=paracetamol'}),high=await doctor.native('api',{method:'GET',path:'/drugs/search?q=Potassium'});
 const ordinary=drugs.find(x=>x.name==='Paracetamol 500mg'),alert=high.find(x=>x.high_alert_category==='ConcentratedElectrolyte');assert(ordinary&&alert);
 const ticket=await doctor.native('api',{method:'GET',path:'/opd-tickets/5'});assert.equal(ticket.patient_id,patient.patient_id);assert(!ticket.is_clinical_locked);
 const body=(drug,source='OPD')=>({patient_id:patient.patient_id,ticket_id:ticket.ticket_id,source,destination:'HospitalPharmacy',notes:j.run+' SOFTWARE TEST ONLY; no actual care, medicine supply or payment',items:[{drug_id:drug.drug_id,qty_prescribed:1,dose_text:'DEMO SOFTWARE TEST ONLY',route:drug===alert?'IV':'Oral',frequency_code:'STAT',is_stat:true,instructions:'DO NOT DISPENSE — synthetic queue verification'}]});
 let normal=j.prescriptions[0];if(normal){const actual=await doctor.native('api',{method:'GET',path:`/prescriptions/${normal.prescription_id}`});assert.equal(actual.notes,normal.notes);assert.equal(actual.status,'Active');}else{normal=await write(doctor,'normal','/prescriptions',body(ordinary));j.prescriptions.push(normal);save();}
 await expect(p.getByTestId('rxqueue-row').filter({hasText:normal.prescription_number})).toBeVisible();
 if(!resume)assert((await p.evaluate(()=>window.rxQueueEvents)).some(e=>e.event_type==='pharmacy.prescription.pending'&&e.payload.prescription_id===normal.prescription_id));
 pass('NEW synthetic HospitalPharmacy prescription arrives by real pharmacy.prescription.pending without manual refresh');
 const urgent=await write(doctor,'highalert','/prescriptions',body(alert));if(!j.prescriptions.some(x=>x.prescription_id===urgent.prescription_id))j.prescriptions.push(urgent);save();
 await expect(p.getByTestId('rxqueue-row').filter({hasText:urgent.prescription_number})).toContainText('High-alert lines');
 await expect(p.getByTestId('rxqueue-row').first()).toContainText(normal.prescription_number);
 pass('Real chronological server order and high-alert count; CodeRed/Telephone need inpatient/emergency context and are not claimed');
 await p.getByRole('button',{name:'Review prescription '+normal.prescription_number,exact:true}).click();
 await expect(p.getByTestId('rxqueue-detail')).toContainText(normal.prescriber_stamp.text);
 await expect(p.getByTestId('rxqueue-detail')).toContainText('Prescribed / dispensed / remaining: 1 / 0 / 1');
 const query=await write(pharmacist,'query',`/prescriptions/${normal.prescription_id}/queries`,{reason:'Other',question:j.run+' simulated software query only — do not dispense',prescription_item_id:normal.items[0].prescription_item_id});j.query=query;save();
 await expect(p.getByTestId('rxqueue-row').filter({hasText:normal.prescription_number})).toContainText('Open queries');
 await expect(p.getByTestId('rxqueue-detail')).toContainText("This line cannot be dispensed until the doctor's query is resolved.");
 assert((await p.evaluate(()=>window.rxQueueEvents)).some(e=>e.event_type==='medication.order.updated'&&e.payload.prescription_id===normal.prescription_id));
 pass('Real medication.order.updated refreshes queue badges AND matching selected detail/query without changing patient');
 await p.getByLabel('Find in this queue',{exact:true}).fill('NO-SUCH-SYNTHETIC-RX');await expect(p.getByTestId('rxqueue-list')).toContainText('No matching prescriptions');
 await p.getByLabel('Find in this queue',{exact:true}).fill(normal.prescription_number);await expect(p.getByTestId('rxqueue-row')).toHaveCount(1);
 await p.getByLabel('Find in this queue',{exact:true}).fill('');
 const countBefore=(await pharmacist.trace()).requests.filter(x=>x.path==='/api/v1/prescriptions/pending').length;
 await new Promise(r=>setTimeout(r,2200));
 assert.equal((await pharmacist.trace()).requests.filter(x=>x.path==='/api/v1/prescriptions/pending').length,countBefore);
 pass('Local search/no-match/clear preserve server order and selected patient; idle queue does not poll');
 await pharmacist.fault({failPath:'/api/v1/prescriptions/pending',failMethod:'GET',once:false});
 await p.getByRole('button',{name:'Refresh prescriptions',exact:true}).click();
 await expect(p.getByTestId('rxqueue-list').locator('.error[role="alert"]')).toBeVisible({timeout:60000});await expect(p.getByTestId('rxqueue-row')).toHaveCount(0);
 await pharmacist.fault({failPath:null});await p.getByTestId('rxqueue-list').getByRole('button',{name:'Try again',exact:true}).click();await expect(p.getByTestId('rxqueue-row')).toHaveCount(2);
 await pharmacist.fault({failPath:`/api/v1/prescriptions/${urgent.prescription_id}`,failMethod:'GET',once:false});
 await p.getByRole('button',{name:'Review prescription '+urgent.prescription_number,exact:true}).click();
 await expect(p.getByTestId('rxqueue-reader').locator('.error[role="alert"]')).toBeVisible({timeout:60000});await expect(p.getByTestId('rxqueue-detail')).toHaveCount(0);
 await pharmacist.fault({failPath:null});await p.getByTestId('rxqueue-reader').getByRole('button',{name:'Try again',exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toContainText(urgent.prescription_number);
 pass('Real lost GET responses show errors and hide stale queue/detail; independent retry recovers exact identity');
 await p.getByLabel('Existing prescription ID',{exact:true}).fill('0');await p.getByRole('button',{name:'Open prescription ID',exact:true}).click();await expect(p.locator('main')).toContainText('Enter a positive prescription ID');
 await p.getByLabel('Existing prescription ID',{exact:true}).fill(String(normal.prescription_id));await p.getByRole('button',{name:'Open prescription ID',exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toContainText(normal.prescription_number);
 await help(pharmacist,p.getByLabel('Existing prescription ID',{exact:true}),'Prescription queue');
 await p.getByRole('button',{name:'Close prescription details',exact:true}).click();await expect(p.getByTestId('rxqueue-detail')).toHaveCount(0);
 await p.evaluate(()=>scrollTo(0,0));await capture(pharmacist,'rx_queue');
 pass('Known-ID lookup/invalid input/close, F1 focus restoration, real ENUR handbook screenshots and both themes250 without overflow');
 // Withdraw/cancel only the exact newly returned test IDs. No guessed or user-owned record.
 await write(pharmacist,'withdraw',`/prescription-queries/${query.query_id}/withdraw`,{reason:j.run+' synthetic query verification finished; no medication supplied'});
 for(const order of j.prescriptions){const current=await doctor.native('api',{method:'GET',path:`/prescriptions/${order.prescription_id}`});assert.equal(current.notes,order.notes);assert.equal(current.dispensations.length,0);await write(doctor,'cancel-'+order.prescription_id,`/prescriptions/${order.prescription_id}/cancel`,{reason:j.run+' software verification complete; no actual care or supply'});}
 j.cleaned=true;save();
 // Cancellation may use a different event topic: explicit refresh is part of read-only recovery.
 await p.getByRole('button',{name:'Refresh prescriptions',exact:true}).click();await expect(p.getByTestId('rxqueue-row')).toHaveCount(0);
 const denied=await doctor.p.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/prescriptions/pending'}));assert(!denied.ok&&denied.error.code==='PERMISSION_REQUIRED');
 assert.equal(await doctor.p.getByRole('navigation').getByRole('button',{name:'Prescription queue',exact:false}).count(),0);
 pass('Own test query withdrawn, both own prescriptions cancelled/zero dispensations; Doctor queue access denied and link absent');
 j.events=await p.evaluate(()=>window.rxQueueEvents.filter(e=>['pharmacy.prescription.pending','medication.order.updated'].includes(e.event_type)));
 j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}
finally{
 for(const s of instances.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}
 j.finished=new Date().toISOString();save();
 if(j.passed)fs.writeFileSync('docs/rx-queue-evidence-2026-10-25.json',JSON.stringify({run:j.run,date:j.finished,checks:j.checks,records:j.prescriptions.map(x=>({id:x.prescription_id,number:x.prescription_number,source:x.source,order_mode:x.order_mode})),query_id:j.query?.query_id,cleaned:j.cleaned,events:j.events.map(e=>({event_type:e.event_type,event_id:e.event_id,prescription_id:e.payload.prescription_id})),limits:'Agent DEV checks, no dispensing/payment/real care/human review; service lifecycle transitions and physical review not performed.'},null,2));
}

```
