# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV synthetic outstanding debt -> refusal -> emergency exception -> Card settlement.
// This script is single-run: reconcile this journal before any replacement run.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const evidence='docs/registration-ar-emergency-evidence-2026-10-24.json';assert(!fs.existsSync(evidence),'Read/reconcile the original fixture; never repeat writes');
const j={run:'DEMO-AR-EMERGENCY-'+Date.now(),started:new Date().toISOString(),writes:[],checks:[]};const save=()=>fs.writeFileSync(evidence,JSON.stringify(j,null,2));save();
const cfg=JSON.parse(fs.readFileSync('.dev-terminal.json'));const {request,checkedRoot}=createRequire(import.meta.url)('../electron/transport.cjs');const ca=checkedRoot(cfg.ca_pem,cfg.ca_fingerprint_sha256);
async function raw(method,path,token,body,key){return request(cfg.server_urls[0]+'/api/v1'+path,{ca,method,body,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{}),'X-Haspataal-Developer':'mkashif','X-Haspataal-Implementation':'1'}});}
const login=async name=>{const r=await raw('POST','/auth/login',null,{username:name,password:'Demo-pass-2026'});assert.equal(r.status,200);return r.body.data.access_token;};
async function call(method,path,token,body){const a={method,path,body,key:crypto.randomUUID(),started:new Date().toISOString()};if(method!=='GET'){j.pending=a;j.writes.push(a);save();}const r=await raw(method,path,token,body,a.key);if(method!=='GET'){a.status=r.status;a.result=r.body;a.finished=true;if(r.status<500)delete j.pending;save();}assert(r.status<400,path+':'+JSON.stringify(r.body));return r.body.data;}
const s=await session('registration-ar-emergency','demo.reception'),p=s.p;
const posts=async()=> (await s.trace()).requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/reception/registrations');
const receipt=async()=>{await expect.poll(async()=>(await posts()).at(-1)?.finished).toBe(true);const r=(await posts()).at(-1);assert.equal(r.status,201);return r;};
try{
 const owner=await login('demo.owner'),cashier=await login('demo.cashier');
 await s.nav('New registration + OPD slip');
 const services=await s.native('api',{method:'GET',path:'/finance/service-catalog?category=OPD'}),service=services.find(x=>x.is_active&&x.doctor_name==='Dr. Ahmed Khan');assert(service);j.service=service;save();
 await p.getByLabel('Full name',{exact:true}).fill(j.run);await p.getByLabel('Age in years',{exact:true}).fill('35');await p.getByLabel('Mobile',{exact:true}).fill('03000000000');await p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
 j.pending={stage:'original unpaid registration'};save();await p.getByRole('button',{name:'Issue unpaid OPD slip',exact:true}).click();await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();j.original=await receipt();j.ticket=j.original.result.data;delete j.pending;save();
 const identity=await s.native('api',{method:'GET',path:'/patients/'+j.ticket.patient_id});assert.equal(identity.full_name,j.run);
 j.credit=await s.native('api',{method:'POST',path:'/opd-tickets/'+j.ticket.ticket_id+'/credit-request',body:{amount_paid_now:0,method:'Card',reason:j.run+' synthetic credit for AR refusal test; Card settlement follows'},key:crypto.randomUUID()});save();
 const approvalId=j.credit.approval.request_id;const approval=await call('GET','/approvals/'+approvalId,owner);assert(approval.can_decide);j.approval=await call('POST','/approvals/'+approvalId+'/approve',owner,{note:j.run+' approve isolated synthetic software test only'});save();
 const patient=await s.native('api',{method:'GET',path:'/patients/'+j.ticket.patient_id});j.patient_with_debt=patient;save();assert(patient.outstanding.has_outstanding_ar);assert(patient.outstanding.ar_block_applies,'Current server policy must block this fresh debt; do not modify shared policy');
 await p.getByRole('button',{name:'Start another registration',exact:true}).click();await p.getByRole('button',{name:'Returning patient',exact:true}).click();await p.getByLabel('Search patient',{exact:true}).fill(patient.mrn);await p.getByRole('button').filter({has:p.locator('strong',{hasText:j.run})}).click();await p.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));
 await expect(p.getByText(patient.outstanding.banner_text,{exact:true}).first()).toBeVisible();
 const before=(await posts()).length;await p.getByRole('button',{name:'Issue unpaid OPD slip',exact:true}).click();await expect.poll(async()=>(await posts()).length).toBe(before+1);await expect.poll(async()=>(await posts()).at(-1)?.finished).toBe(true);j.refusal=(await posts()).at(-1);save();assert.equal(j.refusal.result.error.code,'AR_OUTSTANDING_BLOCK');await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toHaveCount(0);
 await help(s,p.getByLabel('OPD service',{exact:true}),'New registration + OPD slip');
 j.checks.push('Fresh credit creates actual blocked AR; returning patient dues banner and real AR_OUTSTANDING_BLOCK retain selected patient/draft and F1 focus; no replacement ticket');save();
 await p.getByLabel('Visit source',{exact:true}).selectOption('Emergency');await p.getByLabel('Emergency bypass: do not delay the queue for payment or outstanding dues',{exact:true}).check();
 j.pending={stage:'emergency exception registration'};save();await p.getByRole('button',{name:'Issue unpaid OPD slip',exact:true}).click();await expect(p.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();j.emergency=await receipt();delete j.pending;save();const emergency=await s.native('api',{method:'GET',path:'/opd-tickets/'+j.emergency.result.data.ticket_id});assert.equal(emergency.patient_id,patient.patient_id);assert(emergency.is_emergency_bypass);assert(emergency.queue);assert.equal(emergency.payment_status,'Unpaid');j.emergency_read=emergency;save();
 await p.getByRole('button',{name:'Preview slip',exact:true}).click();const preview=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'OPD slip preview',exact:true})});await expect(preview).toContainText(emergency.ticket_number);await help(s,preview.getByRole('button',{name:'Close',exact:true}),'New registration + OPD slip');await preview.getByRole('button',{name:'Close',exact:true}).click();
 await capture(s,'registration');j.checks.push('Active emergency source with explicit bypass creates same-patient unpaid queued ticket despite original AR; actual slip preview/F1; EN/UR both themes250%');save();
 j.emergency_void=await call('POST','/opd-tickets/'+emergency.ticket_id+'/void',await login('demo.reception'),{reason:j.run+' synthetic bypass test finished; no actual emergency or care'});
 const rows=await call('GET','/finance/ar/outstanding',cashier);const debt=rows.find(x=>x.patient_id===patient.patient_id);assert(debt);j.ar=debt;save();j.settlement=await call('POST','/finance/ar/'+debt.ar_id+'/settle',cashier,{amount:debt.balance,method:'Card',reference_no:j.run+' software simulation'});assert.equal(j.settlement.receivable.status,'Settled');
 const after=await s.native('api',{method:'GET',path:'/patients/'+patient.patient_id});assert(!after.outstanding.has_outstanding_ar);j.final_patient=after;j.checks.push('Original isolated debt settled once by Card; original emergency unpaid test ticket voided with reason; no real cash or care');j.passed=true;s.j.passed=true;save();console.log(JSON.stringify({passed:true,patient:patient.patient_id,original_ticket:j.ticket.ticket_id,emergency_ticket:emergency.ticket_id,checks:j.checks}));
}catch(e){j.error=e.stack;try{j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();}catch{}save();console.error(e.stack);process.exitCode=1;}
finally{await s.close();j.session={renderer:s.j.renderer,preferences_restored:s.j.preferences_restored,signed_out:s.j.signed_out,trace:s.j.trace};save();}

```
