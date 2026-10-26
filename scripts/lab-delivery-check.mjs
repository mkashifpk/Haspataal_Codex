// Fresh synthetic DEV Lab-only -> technician -> independent verifier -> report.
// No actual specimens, patient care, cash, card processing or physical print.
// Never rerun an unfinished journal; reconcile its original recorded writes first.
import { session, expect, help, capture } from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const {request,checkedRoot}=createRequire(import.meta.url)('../electron/transport.cjs');
const cfg=JSON.parse(fs.readFileSync('.dev-terminal.json'));
const ca=checkedRoot(cfg.ca_pem,cfg.ca_fingerprint_sha256);
let verifierToken;
const rawVerifier=(method,path,body)=>request(cfg.server_urls[0]+'/api/v1'+path,{ca,method,body,headers:{...(verifierToken?{Authorization:'Bearer '+verifierToken}:{}),'X-Haspataal-Developer':'mkashif','X-Haspataal-Implementation':'1'}});
const file='artifacts/lab-delivery-check.json';
const resumePublished=process.argv.includes('--resume-published');
const resumeVerify=process.argv.includes('--resume-verify')||resumePublished;
const resume=process.argv.includes('--resume-receive')||resumeVerify;
if(fs.existsSync(file)&&!resume) throw Error('Reconcile lab-delivery-check.json before another run; never repeat a patient/payment/result');
const j=resume?JSON.parse(fs.readFileSync(file)):{run:'DEMO-LAB-DELIVERY-'+Date.now(),writes:{},checks:[],passed:false};
if(resume&&!resumeVerify){
 assert(j.finished&&j.writes.collect?.state==='confirmed'&&j.writes.receive?.state==='awaiting-ui');
 const trace=JSON.parse(fs.readFileSync('artifacts/lab-delivery-tech-transport.json'));
 assert(!trace.requests.some(r=>r.method==='POST'&&r.path.endsWith('/samples/2/receive')));
 j.previous_error=j.error;delete j.error;delete j.finished;
 j.reconciled_receive='No receive transport; MCP scan confirms sample2 Collected version4. Resume SAME req1, no repeated registration/payment/collect.';
 delete j.writes.receive;
}
if(resumeVerify){assert(j.finished&&j.result?.status==='PendingVerification');if(!resumePublished){assert.equal(j.writes.verify?.result?.error?.message,'Endpoint is outside the foundation contract');j.writes.verify.state='local-refused-before-http';}else assert.equal(j.verified.status,'Published');j.previous_error=j.error;delete j.error;delete j.finished;}
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const actors=[];
const launch=async(n,u)=>{const s=await session(n,u);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
const posts=async(s,path)=>(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path==='/api/v1'+path);
const dialog=s=>s.p.getByRole('dialog');
async function uiWrite(s,label,path,confirm,{lost=false,replay=true}={}){
  assert(!j.writes[label]);const before=(await posts(s,path)).length;
  j.writes[label]={path,state:'awaiting-ui'};save();
  if(lost)await s.fault({failPath:'/api/v1'+path,failMethod:'POST',once:true});
  await dialog(s).getByRole('button',{name:confirm,exact:true}).evaluate(b=>{b.click();b.click();});
  if(lost){
    await expect(dialog(s)).toContainText(/(?:The result is unknown|Outcome unknown)/);
    const rs=(await posts(s,path)).slice(before);assert.equal(rs.length,1);assert(rs[0].status>=200&&rs[0].status<300);
    j.writes[label]={...rs[0],state:'confirmed-server-reply-lost'};save();
    if(replay)await dialog(s).getByRole('button',{name:/^Retry original (?:lab )?request$/}).click();
    else{
      await expect(dialog(s).getByRole('button',{name:'Retry original request',exact:true})).toHaveCount(0);
      await dialog(s).getByRole('button',{name:'Read current lab state',exact:true}).click();
      await dialog(s).getByRole('button',{name:'State reviewed; return without resubmitting',exact:true}).click();
    }
  }
  await expect(dialog(s)).toHaveCount(0);
  const rs=(await posts(s,path)).slice(before);assert.equal(rs.length,lost&&replay?2:1);
  const r=rs.at(-1);assert(r.status>=200&&r.status<300,JSON.stringify(r.result?.error));
  if(lost&&replay){assert.equal(rs[0].key,r.key);assert.deepEqual(rs[0].body,r.body);assert.equal(String(r.replay),'true');}
  j.writes[label]={...rs[0],state:'confirmed',replay:rs.length>1?r:undefined};save();return r.result.data;
}
async function nativeWrite(s,label,path,body){
  assert(!j.writes[label]||j.writes[label].state==='local-refused-before-http');const w=j.writes[label]={path,body,key:j.writes[label]?.key||crypto.randomUUID(),state:'prepared'};save();
  let r;
  if(path.endsWith('/verify')){
    if(!verifierToken){const login=await rawVerifier('POST','/auth/login',{username:'demo.labverifier',password:'Demo-pass-2026'});assert.equal(login.status,200);verifierToken=login.body.data.access_token;}
    const actual=await rawVerifier('POST',path,body);r={ok:actual.status<400,status:actual.status,data:actual.body.data,error:actual.body.error,request_id:actual.body.request_id};
  }else r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});
  w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();
  assert(r.ok,JSON.stringify(r.error));return r.data;
}
try{
  const r=await launch('lab-delivery-reception','demo.reception');
  await r.nav('Lab-only walk-in');
  const p=r.p;
  if(!resume){
  await p.getByRole('button',{name:'Review NEW lab registration',exact:true}).click();
  await expect(p.locator('main .error')).toBeVisible();
  await p.getByLabel('Full name',{exact:true}).fill(j.run+' no tests; no actual care');
  await p.getByLabel('Mobile',{exact:true}).fill('03000000000');
  await help(r,p.getByLabel('Full name',{exact:true}),'Lab-only walk-in');
  await p.getByRole('button',{name:'Review NEW lab registration',exact:true}).click();
  j.minimal=await uiWrite(r,'minimal','/patients/lab-only-walk-in','Confirm reviewed lab action',{lost:true});save();
  assert.equal(j.minimal.patient.registration_type,'LabOnly');assert.equal(j.minimal.requisition,null);
  pass('New name/mobile-only UI patient; lost reply/original-key replay one patient; no requisition, bill or OPD slip');
  const tests=await r.native('api',{method:'GET',path:'/lab/tests'});
  const selected=tests.filter(x=>['CBC','RBS'].includes(x.code));assert.equal(selected.length,2);assert(selected.every(x=>x.availability==='InHouse'));
  await p.getByLabel('Full name',{exact:true}).fill(j.run+' synthetic measured values; NO actual care');
  await p.getByLabel('Mobile',{exact:true}).fill('03000000001');
  await p.getByLabel('Clinical notes (optional)',{exact:true}).fill(j.run+' SOFTWARE ONLY; no real specimens, care or money');
  await p.getByLabel('Outside referring doctor (optional)',{exact:true}).fill('DEMO external referrer');
  for(const t of selected)await p.locator('label.card').filter({hasText:t.name}).getByRole('checkbox').check();
  await p.getByRole('button',{name:'Review NEW lab registration',exact:true}).click();
  j.ordered=await uiWrite(r,'ordered','/patients/lab-only-walk-in','Confirm reviewed lab action');save();
  const rid=j.ordered.requisition.requisition_id;
  j.detail=await r.native('api',{method:'GET',path:`/lab/requisitions/${rid}`});save();
  assert.equal(j.detail.patient_id,j.ordered.patient.patient_id);
  await expect(p.locator('main')).toContainText('LAB_REPORT_NOT_READY');
  }else{
    await p.getByLabel('Known lab requisition ID',{exact:true}).fill(String(j.detail.requisition_id));
    await p.getByRole('button',{name:'Open lab requisition',exact:true}).click();
    const actual=await r.native('api',{method:'GET',path:`/lab/requisitions/${j.detail.requisition_id}`});
    assert.equal(actual.patient_id,j.ordered.patient.patient_id);assert.equal(actual.invoice.balance_due,0);
  }
  const rid=j.detail.requisition_id;
  const t=await launch('lab-delivery-tech','demo.labtech');
  await t.nav('Scanner-first lab bench');
  const q=t.p;
  await q.evaluate(()=>{window.labEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.labEvents.push(e);});});
  const first=j.detail.items.find(x=>x.code==='RBS'),second=j.detail.items.find(x=>x.code==='CBC');assert(first?.barcode&&second?.barcode);
  async function scan(item){
    await q.getByRole('button',{name:'Arm sample scanner',exact:true}).click();
    await expect(q.getByLabel('Scanner capture',{exact:true})).toBeFocused();
    await q.keyboard.type(item.barcode);await q.keyboard.press('Enter');
    await expect(q.getByRole('heading',{name:'Identify and handle the sample',exact:true})).toBeVisible();
    await expect(q.locator('main')).toContainText(j.ordered.patient.mrn);
    return t.native('api',{method:'GET',path:'/lab/scan/'+encodeURIComponent(item.barcode)});
  }
  async function twoIdentifiers(){await q.getByLabel('Patient identity method',{exact:true}).selectOption('TwoIdentifiers');await q.getByLabel('I asked and matched name and MRN or date of birth.',{exact:true}).check();await q.getByLabel('Identity / emergency note',{exact:true}).fill(j.run+' software identity simulation, no actual specimen');}
  if(!resume){
  await scan(first);await twoIdentifiers();
  await q.getByRole('button',{name:'Review sample collection',exact:true}).click();
  await dialog(t).getByRole('button',{name:'Confirm lab bench action',exact:true}).click();
  await expect(dialog(t)).toContainText('LAB_PAYMENT_REQUIRED');
  await dialog(t).getByRole('button',{name:'Close',exact:true}).click();
  pass('Actual sample barcode keyboard capture; unpaid collection refused with LAB_PAYMENT_REQUIRED; technician offers no payment');
  await p.getByLabel('Collection method',{exact:true}).selectOption('Card');
  await p.getByLabel('Payment reference (optional)',{exact:true}).fill(j.run+' virtual software collection only');
  await p.getByRole('button',{name:'Review lab payment',exact:true}).click();
  j.payment=await uiWrite(r,'payment',`/finance/invoices/${j.detail.invoice.invoice_id}/payments`,'Confirm reviewed lab action',{lost:true});save();
  assert.equal(j.payment.payment.method,'Card');
  pass('Separate reception invoice collection, lost answer same UUID/body replay exactly once; no physical money');
  await scan(first);
  await q.getByLabel('Patient identity method',{exact:true}).selectOption('WristbandScan');
  await q.getByLabel('Patient wristband barcode',{exact:true}).fill(j.minimal.patient.mrn);
  await q.getByRole('button',{name:'Verify this patient wristband',exact:true}).click();
  await expect(q.locator('main')).toContainText('STOP: another patient');
  await q.getByRole('button',{name:'Review sample collection',exact:true}).click();await expect(dialog(t)).toHaveCount(0);
  await q.getByLabel('Patient wristband barcode',{exact:true}).fill(j.ordered.patient.mrn);
  await q.getByRole('button',{name:'Verify this patient wristband',exact:true}).click();await expect(q.locator('main')).toContainText('Band matches this patient.');
  await help(t,q.getByLabel('Patient wristband barcode',{exact:true}),'Scanner-first lab bench');
  await q.getByRole('button',{name:'Review sample collection',exact:true}).click();
  j.label=await uiWrite(t,'collect',`/lab/samples/${first.sample_id}/collect`,'Confirm lab bench action');save();
  assert.equal(j.label.fields.sample_id,first.sample_id);
  }
  let current;
  if(!resumeVerify){
  const collected=await scan(first);assert.equal(collected.sample.status,'Collected');
  await q.getByRole('button',{name:'Review sample receipt',exact:true}).click();
  await uiWrite(t,'receive',`/lab/samples/${first.sample_id}/receive`,'Confirm lab bench action');
  current=await scan(first);assert.equal(current.sample.status,'Received');
  for(const m of current.metric_grid)await q.getByLabel(`${m.label}${m.unit?' · '+m.unit:''}${m.required?' *':''}`,{exact:true}).fill('100');
  await q.getByLabel('Interpretation',{exact:true}).fill(j.run+' SYNTHETIC SOFTWARE VALUES; not a clinical result');
  await q.getByRole('button',{name:'Review Submit and Broadcast',exact:true}).click();
  j.result=await uiWrite(t,'result',`/lab/items/${first.lab_requisition_item_id}/results`,'Confirm lab bench action');save();assert.equal(j.result.status,'PendingVerification');
  pass('Wrong band stops collection; matching actual band collect/label, receive and numeric result through bench; PendingVerification only');
  }else{const existing=await scan(first);assert(existing.previous_results.some(x=>x.result_id===j.result.result_id&&x.status===(resumePublished?'Published':'PendingVerification')));}
  // Independent verifier is an API prerequisite until its own screen is delivered.
  const v=await launch('lab-delivery-verifier','demo.labverifier');
  if(!resumePublished){j.verified=await nativeWrite(v,'verify',`/lab/results/${j.result.result_id}/verify`,{decision:'Verified',note:j.run+' software-only independent verification; no actual care'});save();}
  // Backend issue28: publication audience excludes receptionist; explicit refresh is supported.
  await p.getByRole('button',{name:'Refresh lab walk-in',exact:true}).click();
  await expect.poll(()=>p.locator('main').innerText()).toContain('Partial');
  j.report=await r.native('api',{method:'GET',path:`/lab/requisitions/${rid}/report/print-payload`});save();
  assert.equal(j.report.fields.complete,false);
  pass('Independent verifier publication followed by explicit receptionist refresh yields signed partial report; actual stamps/identity retained; automatic event delivery blocked by backend28');
  await capture(r,'lab_only_walkin');
  await scan(second);await twoIdentifiers();
  await q.getByRole('button',{name:'Review sample receipt',exact:true}).click();
  await uiWrite(t,'receive-pending',`/lab/samples/${second.sample_id}/receive`,'Confirm lab bench action');
  await q.getByLabel('Sample rejection code',{exact:true}).selectOption('Other');
  await q.getByLabel('Reason / rejection note',{exact:true}).fill(j.run+' simulated unusable sample; no actual specimen');
  await q.getByRole('button',{name:'Review sample rejection',exact:true}).click();
  j.rejected=await uiWrite(t,'reject',`/lab/samples/${second.sample_id}/reject`,'Confirm lab bench action',{lost:true});save();
  const replacement=j.rejected.items.find(x=>x.lab_requisition_item_id===second.lab_requisition_item_id);assert(replacement.barcode!==second.barcode);assert(replacement.sample_id!==second.sample_id);
  await scan(replacement);await twoIdentifiers();
  await q.getByRole('button',{name:'Review sample receipt',exact:true}).click();
  await uiWrite(t,'receive-replacement',`/lab/samples/${replacement.sample_id}/receive`,'Confirm lab bench action');
  current=await scan(replacement);
  const values={hb:14,wbc:7,plt:250};
  for(const m of current.metric_grid)await q.getByLabel(`${m.label}${m.unit?' · '+m.unit:''}${m.required?' *':''}`,{exact:true}).fill(String(values[m.key]));
  await q.getByLabel('Interpretation',{exact:true}).fill(j.run+' SYNTHETIC SOFTWARE VALUES; no clinical care');
  await capture(t,'lab_bench');
  await q.getByRole('button',{name:'Review Submit and Broadcast',exact:true}).click();
  j.result2=await uiWrite(t,'result2',`/lab/items/${replacement.lab_requisition_item_id}/results`,'Confirm lab bench action');save();
  await nativeWrite(v,'verify2',`/lab/results/${j.result2.result_id}/verify`,{decision:'Verified',note:j.run+' software-only verification'});
  await expect.poll(async()=>{const r2=await r.native('api',{method:'GET',path:`/lab/requisitions/${rid}/report/print-payload`});return r2.fields.complete;}).toBe(true);
  j.final=await r.native('api',{method:'GET',path:`/lab/requisitions/${rid}`});save();
  assert(j.final.items.every(x=>x.status==='Published'));
  pass('Pending sample identity receipt, reject+original-key replay yields one replacement barcode; replacement CBC published; complete report actual backend');
  j.tech_events=await q.evaluate(()=>window.labEvents.map(e=>({type:e.event_type,id:e.event_id})));j.event_limit='Backend28: technician/reception audience omits publication; no live event acceptance claim';
  pass('Bilingual handbook captures and 250% themes no page overflow; event delivery explicitly pending backend28');
  j.passed=true;save();
}catch(e){j.error=e.stack;for(const s of actors){try{j['failure_ui_'+s.j.name]=await s.p.locator('body').innerText();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{if(verifierToken){const out=await rawVerifier('POST','/auth/logout',{});j.verifier_signed_out=out.status<400;verifierToken=undefined;}for(const s of actors.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}j.finished=new Date().toISOString();save();}
