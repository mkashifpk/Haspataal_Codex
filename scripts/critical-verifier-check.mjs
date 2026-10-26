// Real DEV: owned software-only critical results, simulated communications,
// independent publication and physician acknowledgement. No real calls or care.
// Never overwrite/restart an unfinished journal; reconcile original keys first.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const file='artifacts/critical-verifier-check.json';
assert(!fs.existsSync(file),'Reconcile the original critical-verifier journal before any new run');
const j={run:'DEMO-CRITICAL-VERIFIER-'+Date.now(),writes:{},checks:[],criticals:[],passed:false};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const actors=[];
const launch=async(n,u)=>{const s=await session(n,u);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const close=async s=>{await s.close();actors.splice(actors.indexOf(s),1);};
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
async function write(s,name,path,body,expected){
 assert(!j.writes[name]);const w=j.writes[name]={method:'POST',path,body,key:crypto.randomUUID(),state:'prepared'};save();
 const r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});
 w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();
 if(expected)assert.equal(r.error?.code,expected);else assert(r.ok,name+':'+JSON.stringify(r.error));return r.data;
}
const posts=async(s,path)=>(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+path);
const {request,checkedRoot}=createRequire(import.meta.url)('../electron/transport.cjs');
const config=JSON.parse(fs.readFileSync('.dev-terminal.json')),ca=checkedRoot(config.ca_pem,config.ca_fingerprint_sha256);
let doctorToken;
const doctorRaw=(method,path,body)=>request(config.server_urls[0]+'/api/v1'+path,{ca,method,body,headers:{...(doctorToken?{Authorization:'Bearer '+doctorToken}:{}),'X-Haspataal-Developer':'mkashif','X-Haspataal-Implementation':'1'}});
try{
 const tech=await launch('critical-verifier-operator','demo.labverifier'),p=tech.p;
 await tech.nav('Critical results to tell');
 await expect(p.locator('h1')).toHaveText('Critical results to tell');
 await expect(p.getByLabel('Not yet acknowledged only',{exact:true})).toBeChecked();
 await p.evaluate(()=>{window.criticalEvents=[];window.criticalStreams=[];window.terminal.subscribe(e=>{if(e.type==='event')window.criticalEvents.push(e);if(e.type==='stream')window.criticalStreams.push(e);});});
 await tech.app.evaluate(({shell})=>{globalThis.criticalBeeps=0;shell.beep=()=>{globalThis.criticalBeeps++;};});
 await help(tech,p.getByLabel('Known critical result ID',{exact:true}),'Critical results to tell');
 const doctor=await launch('critical-verifier-doctor','demo.doctor');
 const patient=await doctor.native('api',{method:'GET',path:'/patients/5'}),ticket=await doctor.native('api',{method:'GET',path:'/opd-tickets/5'});
 assert(patient.full_name.startsWith('DEMO-FINANCIAL-')&&patient.full_name.includes('no actual care'));assert.equal(ticket.patient_id,patient.patient_id);assert(!ticket.is_clinical_locked);
 const catalogue=await doctor.native('api',{method:'GET',path:'/lab/tests'}),tests=catalogue.filter(x=>['RBS','NS1'].includes(x.code));assert.equal(tests.length,2);
 j.requisition=await write(doctor,'requisition','/lab/requisitions',{ticket_id:ticket.ticket_id,test_ids:tests.map(x=>x.test_id),priority:'Routine',clinical_notes:j.run+' SYNTHETIC software critical/priority disease test ONLY; no actual specimen, disease, clinical care, calls or external notification'});save();
 const rec=await launch('critical-verifier-reception','demo.reception');
 j.payment=await write(rec,'payment',`/finance/invoices/${j.requisition.invoice.invoice_id}/payments`,{method:'Card',reference_no:j.run+' virtual software payment only, no money'});save();await close(rec);
 const bench=await launch('critical-verifier-bench','demo.labtech');
 j.results=[];
 for(const item of j.requisition.items){
   await write(bench,'receive-'+item.code,`/lab/samples/${item.sample_id}/receive`,{identity_check:'TwoIdentifiers',identity_note:j.run+' synthetic identity state, no actual specimen'});
   const result=await write(bench,'result-'+item.code,`/lab/items/${item.lab_requisition_item_id}/results`,{metrics:item.code==='RBS'?{glucose:500}:{ns1:'Positive'},interpretation:j.run+' SYNTHETIC critical value/positive only; NOT a real finding'});j.results.push(result);save();assert(result.has_critical_value);
 }
 const verifier=bench;
 for(const result of j.results)await write(tech,'verify-'+result.result_id,`/lab/results/${result.result_id}/verify`,{decision:'Verified',note:j.run+' independent SOFTWARE ONLY verification; no real care'});
 const records=await tech.native('api',{method:'GET',path:'/critical-results?source=Lab&open_only=true&limit=1000'});
 j.criticals=records.filter(r=>j.results.some(x=>x.result_id===r.result_id));save();assert.equal(j.criticals.length,2);
 const glucose=j.criticals.find(x=>!x.notifiable_disease),disease=j.criticals.find(x=>!!x.notifiable_disease);assert(glucose&&disease);
 await expect(p.locator('main')).toContainText(glucose.critical_number);
 await expect(p.locator('main')).toContainText(disease.critical_number);
 await expect.poll(()=>tech.app.evaluate(()=>globalThis.criticalBeeps)).toBe(2);
 assert((await p.evaluate(()=>window.criticalEvents)).some(x=>x.event_type==='critical_result.updated'&&x.payload.change==='Opened'&&x.payload.critical_result_id===disease.critical_result_id));
 const trace=(await tech.trace()).requests;
 assert(trace.some(x=>x.method==='GET'&&x.path.startsWith('/api/v1/critical-results?')&&x.path.includes('source=Lab')&&x.path.includes('open_only=true')));
 assert(trace.some(x=>x.path==='/api/v1/diagnostics/worklist?area=Lab&mine=false'&&x.status===200));
 pass('Fresh independently authored numeric/text publications arrive LIVE in verifier Lab log/worklist; actual Opened events request native system alarm twice (device sound instrumented, not human audibility)');
 const open=async r=>{
   await p.getByLabel('Known critical result ID',{exact:true}).fill(String(r.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();await expect(p.getByTestId('critical-detail')).toContainText(r.critical_number);
 };
 async function draft(method,role,recipient,readBack){
   await p.getByLabel('Communication means',{exact:true}).selectOption(method);
   await p.getByLabel('Recipient role',{exact:true}).selectOption(role);
   await p.getByLabel('Recipient name and designation',{exact:true}).fill(recipient);
   await p.getByLabel('Communication note (optional)',{exact:true}).fill(j.run+' SOFTWARE SIMULATION ONLY; no actual call, authority notification or clinical care');
   await p.getByLabel(/The recipient read the result back/).setChecked(readBack);
   await p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true}).check();
 }
 async function submit(label,r,lost=false){
   const path=`/critical-results/${r.critical_result_id}/communications`,before=(await posts(tech,path)).length;
   await p.getByRole('button',{name:'Review communication record',exact:true}).click();const m=p.getByRole('dialog');await expect(m).toBeVisible();
   await help(tech,m.getByRole('button',{name:'Confirm completed communication',exact:true}),'Critical results to tell');
   j.writes[label]={path,state:'awaiting-ui'};save();
   if(lost)await tech.fault({failPath:'/api/v1'+path,failMethod:'POST',once:true});
   await m.getByRole('button',{name:'Confirm completed communication',exact:true}).evaluate(b=>{b.click();b.click();});
   if(lost){await expect(m).toContainText('The result is unknown');const first=(await posts(tech,path)).slice(before);assert.equal(first.length,1);assert.equal(first[0].status,201);j.writes[label]={...first[0],state:'confirmed-server-reply-lost'};save();await expect(m.getByRole('button',{name:'Confirm completed communication',exact:true})).toBeDisabled();await p.keyboard.press('Escape');await expect(m).toBeVisible();await m.getByRole('button',{name:'Retry original request',exact:true}).click();}
   await expect(m).toHaveCount(0);const sent=(await posts(tech,path)).slice(before);assert.equal(sent.length,lost?2:1);assert.equal(sent.at(-1).status,201);
   if(lost){assert.equal(sent[0].key,sent[1].key);assert.deepEqual(sent[0].body,sent[1].body);assert.equal(String(sent[1].replay),'true');}
   j.writes[label]={...sent[0],state:'confirmed',replay:lost?sent[1]:undefined};save();return sent.at(-1).result.data;
 }
 await open(glucose);
 await draft('Telephone','RequestingDoctor','DEMO requesting doctor, software call simulation',false);
 const noPost=(await posts(tech,`/critical-results/${glucose.critical_result_id}/communications`)).length;
 await p.getByRole('button',{name:'Review communication record',exact:true}).click();await expect(p.getByRole('dialog')).toHaveCount(0);await expect(p.locator('main')).toContainText('Telephone and in-person communication require');assert.equal((await posts(tech,`/critical-results/${glucose.critical_result_id}/communications`)).length,noPost);
 await write(tech,'missing-readback',`/critical-results/${glucose.critical_result_id}/communications`,{means:'Telephone',recipient_role:'RequestingDoctor',recipient_name:'DEMO software negative test',read_back:false,note:j.run+' simulated refusal; no actual call'},'CRITICAL_RESULT_READ_BACK_REQUIRED');
 await p.getByLabel(/The recipient read the result back/).check();
 j.communication=await submit('doctor-communication',glucose,true);save();
 assert.equal(j.communication.status,'Communicated');assert.equal(j.communication.communications.length,1);assert.equal(j.communication.communications[0].read_back,true);
 await expect(p.getByTestId('critical-history')).toContainText('DEMO requesting doctor');
 pass('Telephone without read-back refuses locally before POST and actual server code; reviewed communication lost201/doubleclick retains exact key/body replay one history entry, no doctor acknowledgement');
 await open(disease);assert(disease.authority_pending);
 await draft('InPerson','RequestingDoctor','DEMO on-call clinician, synthetic only',true);
 await p.getByRole('button',{name:'Review communication record',exact:true}).click();let modal=p.getByRole('dialog');
 const count=(await posts(tech,`/critical-results/${disease.critical_result_id}/communications`)).length;
 await write(verifier,'concurrent-patient-note',`/critical-results/${disease.critical_result_id}/communications`,{means:'Written',recipient_role:'Patient',recipient_name:'DEMO patient, simulated communication',read_back:false,note:j.run+' independent concurrent SOFTWARE ONLY note; no actual communication'});
 await modal.getByRole('button',{name:'Confirm completed communication',exact:true}).click();await expect(modal).toContainText('The result, communication history, permission or service changed.');assert.equal((await posts(tech,`/critical-results/${disease.critical_result_id}/communications`)).length,count);
 await modal.getByRole('button',{name:'Close',exact:true}).click();
 await draft('Electronic','HealthAuthority','DEMO health authority, software notification only',false);
 j.authority=await submit('authority-communication',disease);save();assert.equal(j.authority.authority_pending,false);assert(j.authority.authority_informed_at);
 await draft('InPerson','RequestingDoctor','DEMO responsible doctor, software conversation only',true);
 j.diseaseCommunication=await submit('disease-doctor-communication',disease);save();
 await expect(p.getByTestId('critical-history')).toContainText('DEMO health authority');
 await expect(p.getByTestId('critical-detail')).toContainText('Health authority informed');
 pass('Concurrent actual communication invalidates frozen review before POST; separate HealthAuthority/Electronic and doctor/InPerson read-back records preserve disease obligation and history');
 // Independent physician terminal action is a fixture, not an implemented bench action.
 const login=await doctorRaw('POST','/auth/login',{username:'demo.doctor',password:'Demo-pass-2026'});assert.equal(login.status,200);doctorToken=login.body.data.access_token;
 for(const cr of j.criticals){
   const current=await tech.native('api',{method:'GET',path:`/critical-results/${cr.critical_result_id}`});assert.equal(current.patient_id,patient.patient_id);
   const w=j.writes['ack-'+cr.critical_result_id]={method:'POST',path:`/critical-results/${cr.critical_result_id}/acknowledge`,body:{expected_version:current.row_version,action_taken:j.run+' synthetic software-only acknowledgement; no real finding or clinical action'},state:'prepared'};save();
   const ack=await doctorRaw('POST',w.path,w.body);w.status=ack.status;w.result=ack.body;w.state=ack.status===200?'confirmed':ack.status>=400&&ack.status<500?'refused':'unknown';save();assert.equal(ack.status,200);assert.equal(ack.body.data.status,'Acknowledged');
 }
 await expect(p.getByTestId('critical-detail')).toContainText('Acknowledged by doctor');
 const beforeBeep=await tech.app.evaluate(()=>globalThis.criticalBeeps);
 const silent=await tech.native('critical-result-alarm',{criticalResultId:glucose.critical_result_id});assert.equal(silent.played,false);assert.equal(await tech.app.evaluate(()=>globalThis.criticalBeeps),beforeBeep);
 await p.getByLabel('Not yet acknowledged only',{exact:true}).uncheck();await p.getByRole('button',{name:'Apply log filters',exact:true}).click();
 await p.getByLabel('Find in returned critical results',{exact:true}).fill('NO-MATCH-'+j.run);await expect(p.getByTestId('critical-log-row')).toHaveCount(0);
 await p.getByLabel('Find in returned critical results',{exact:true}).fill(glucose.critical_number);await expect(p.getByTestId('critical-log-row')).toHaveCount(1);
 await p.getByLabel('Maximum results (1–1000)',{exact:true}).fill('0');await p.getByRole('button',{name:'Apply log filters',exact:true}).click();await expect(p.locator('main')).toContainText('Choose a result limit from 1 to 1000.');await p.getByLabel('Maximum results (1–1000)',{exact:true}).fill('200');await p.getByRole('button',{name:'Apply log filters',exact:true}).click();
 await tech.fault({failPath:`/api/v1/critical-results/${glucose.critical_result_id}`,failMethod:'GET',once:false});
 await p.getByLabel('Known critical result ID',{exact:true}).fill(String(glucose.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();
 await expect(p.getByTestId('critical-detail')).toHaveCount(0);await expect(p.locator('main .error[role="alert"]')).toBeVisible({timeout:60000});
 await tech.fault({failPath:null});await open(glucose);
 pass('Separate physician acknowledgement arrives live; acknowledged record cannot sound alarm; bounded/no-match/history filters and failed selected read hide stale patient context with actual retry');
 await p.evaluate(()=>scrollTo(0,0));await capture(tech,'critical_results_verifier');
 await tech.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;WS.prototype.emit=function(e,...a){if(e==='message')globalThis.criticalSocket=this;return emit.call(this,e,...a);};});
 await expect.poll(()=>tech.app.evaluate(()=>!!globalThis.criticalSocket),{timeout:45000}).toBe(true);const time=Date.now();await tech.app.evaluate(()=>globalThis.criticalSocket.terminate());
 await expect.poll(()=>p.evaluate(()=>window.criticalStreams.some(x=>x.status==='Live'&&x.resync)),{timeout:45000}).toBe(true);
 for(const route of ['/api/v1/critical-results','/api/v1/diagnostics/worklist',`/api/v1/critical-results/${glucose.critical_result_id}`])await expect.poll(async()=>(await tech.trace()).requests.some(x=>x.path.split('?')[0]===route&&x.status===200&&x.started>=time),{timeout:45000}).toBe(true);
 pass('Actual socket reconnect refreshes log/worklist/selected history; F1 dialog/field focus and actual ENUR/both themes250% captures passed');
 await close(verifier);await close(doctor);
 const denied=await launch('critical-verifier-cashier','demo.cashier');await expect(denied.p.getByRole('navigation').getByRole('button',{name:'Critical results to tell',exact:false})).toHaveCount(0);
 const bad=await denied.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path:`/critical-results/${glucose.critical_result_id}/communications`,body:{means:'Written',recipient_role:'Patient',recipient_name:'DEMO denied role'},key:crypto.randomUUID()});assert.equal(bad.error?.code,'PERMISSION_REQUIRED');
 const alarmDenied=await denied.p.evaluate(id=>window.terminal.call('critical-result-alarm',{criticalResultId:id}),glucose.critical_result_id);assert.equal(alarmDenied.ok,false);
 pass('Denied cashier has no scoped page and native communication/alarm refused; all owned criticals Acknowledged and authority duty completed, no care/real calls/external notifications');
 j.passed=true;save();
}catch(e){j.error=e.stack;for(const s of actors){try{j['failure_'+s.j.name]=await s.p.locator('body').innerText();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{if(doctorToken){const out=await doctorRaw('POST','/auth/logout',{});j.raw_doctor_signed_out=out.status<400;doctorToken=undefined;}for(const s of actors.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}j.finished=new Date().toISOString();save();}
