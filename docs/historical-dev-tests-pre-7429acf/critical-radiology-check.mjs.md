# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV, owned synthetic imaging findings and simulated communication records.
// No real call, health-authority contact, care, exposure, contrast or money.
// Refuse existing journals: reconcile each original key/outcome before continuing.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/critical-radiology-check.json';
if(fs.existsSync(file)){
 const previous=JSON.parse(fs.readFileSync(file));
 assert(process.argv.includes('--restart-before-writes') && previous.finished && Object.keys(previous.writes).length===0,'Reconcile original critical-radiology journal; never repeat completed writes');
 const profile=JSON.parse(fs.readFileSync('artifacts/critical-imaging-radiographer.json'));assert(profile.preferences_restored&&profile.signed_out&&profile.finished);
 fs.copyFileSync(file,file.replace('.json','-zero-write-diagnostic-'+Date.now()+'.json'));
}
const prior=JSON.parse(fs.readFileSync('artifacts/radiology-worklist-check.json'));
const j={run:'DEMO-CRITICAL-IMAGING-'+Date.now(),writes:{},checks:[],passed:false};
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const actors=[];
const launch=async(name,user)=>{const s=await session(name,user);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
async function write(s,name,path,body,expected){
 assert(!j.writes[name]);const w=j.writes[name]={method:'POST',path,body,key:crypto.randomUUID(),state:'prepared'};save();
 const r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});
 w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();
 if(expected)assert.equal(r.error?.code,expected);else assert(r.ok,name+':'+JSON.stringify(r.error));return r.data;
}
const posts=async(s,path)=>(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+path);
try{
 const rg=await launch('critical-imaging-radiographer','demo.radiographer'),p=rg.p;
 await rg.nav('Critical results to tell');await expect(p.locator('[data-help-screen="critical_results_radiology"]')).toBeVisible();
 await expect(p.getByLabel('Not yet acknowledged only',{exact:true})).toBeChecked();await expect(p.getByRole('heading',{name:'Critical imaging log',exact:true})).toBeVisible();
 await p.evaluate(()=>{window.criticalImagingEvents=[];window.criticalImagingStreams=[];window.terminal.subscribe(e=>{if(e.type==='event')window.criticalImagingEvents.push(e);if(e.type==='stream')window.criticalImagingStreams.push(e);});});
 await rg.app.evaluate(({shell})=>{globalThis.criticalImagingBeeps=0;shell.beep=()=>{globalThis.criticalImagingBeeps++;};});
 await help(rg,p.getByLabel('Known critical result ID',{exact:true}),'Critical results to tell');
 const doctor=await launch('critical-imaging-doctor','demo.doctor');
 const patient=await doctor.native('api',{method:'GET',path:'/patients/3'}),ticket=await doctor.native('api',{method:'GET',path:'/opd-tickets/1'});
 assert.equal(patient.full_name,prior.run);assert.equal(ticket.patient_id,patient.patient_id);assert.equal(ticket.payment_status,'Paid');assert(!ticket.is_clinical_locked);
 j.patient={patient_id:patient.patient_id,mrn:patient.mrn};j.ticket=ticket.ticket_id;save();
 const rd=await launch('critical-imaging-radiologist','demo.radiologist');
 j.orders=[];
 for(const n of ['primary','secondary']){
  const order=await write(doctor,'order-'+n,'/imaging/orders',{ticket_id:ticket.ticket_id,modality:'Ultrasound',body_part:'Synthetic software-only '+n,clinical_indication:j.run+' no actual examination, disease or care',priority:'Routine',laterality:'NotApplicable',transport:'Walking',escort:'None'});
  j.orders.push(order);save();
  await write(rg,'start-'+n,`/imaging/orders/${order.imaging_order_id}/status`,{status:'InProgress',identity_check:'TwoIdentifiers',identity_note:j.run+' synthetic identity, no actual patient',site_confirmed:true});
  await write(rg,'complete-'+n,`/imaging/orders/${order.imaging_order_id}/status`,{status:'Completed'});
 }
 const report=async(index)=>write(rd,'report-'+index,`/imaging/orders/${j.orders[index].imaging_order_id}/report`,{report_text:j.run+' SOFTWARE ONLY simulated report; no real examination or clinical finding',critical_finding_note:j.run+' SYNTHETIC alert only, no real disease or emergency'});
 await report(0);
 const logs=await rg.native('api',{method:'GET',path:'/critical-results?source=Imaging&open_only=true&limit=1000'});
 const first=logs.find(x=>x.imaging_order_id===j.orders[0].imaging_order_id);assert(first);j.first=first;save();
 await expect(p.locator('main')).toContainText(first.critical_number);
 await expect.poll(()=>rg.app.evaluate(()=>globalThis.criticalImagingBeeps)).toBe(1);
 const open=async r=>{await p.getByLabel('Known critical result ID',{exact:true}).fill(String(r.critical_result_id));await p.getByRole('button',{name:'Read known critical result',exact:true}).click();await expect(p.getByTestId('critical-detail')).toContainText(r.critical_number);};
 await open(first);await p.getByLabel('Recipient name and designation',{exact:true}).fill('DEMO unsent retained draft');
 await report(1);
 const all=await rg.native('api',{method:'GET',path:'/critical-results?source=Imaging&open_only=true&limit=1000'}),second=all.find(x=>x.imaging_order_id===j.orders[1].imaging_order_id);assert(second);j.second=second;save();
 await expect(p.locator('main')).toContainText(second.critical_number);await expect(p.getByLabel('Recipient name and designation',{exact:true})).toHaveValue('DEMO unsent retained draft');await expect(p.getByTestId('critical-detail')).toContainText(first.critical_number);await expect.poll(()=>rg.app.evaluate(()=>globalThis.criticalImagingBeeps)).toBe(2);
 const trace=await rg.trace();assert(trace.requests.some(x=>x.path.includes('source=Imaging')&&x.path.includes('open_only=true')));assert(trace.requests.some(x=>x.path==='/api/v1/diagnostics/worklist?area=Imaging&mine=false'&&x.status===200));
 pass('Two fresh synthetic critical reports arrive LIVE in Imaging log/worklist with two source-bound native alarm requests; second alert preserves selected patient and unsent draft (sound instrumented, human audibility pending)');
 async function draft(means,role,recipient,readBack){
  await p.getByLabel('Communication means',{exact:true}).selectOption(means);await p.getByLabel('Recipient role',{exact:true}).selectOption(role);await p.getByLabel('Recipient name and designation',{exact:true}).fill(recipient);await p.getByLabel('Communication note (optional)',{exact:true}).fill(j.run+' SOFTWARE SIMULATION ONLY; no actual call, external notification or clinical action');await p.getByLabel(/The recipient read the result back/).setChecked(readBack);await p.getByLabel('I already told this recipient; this records the completed communication.',{exact:true}).check();
 }
 async function submit(name,r,lost=false){
  const path=`/critical-results/${r.critical_result_id}/communications`,before=(await posts(rg,path)).length;
  await p.getByRole('button',{name:'Review communication record',exact:true}).click();const m=p.getByRole('dialog');await expect(m).toBeVisible();await help(rg,m.getByRole('button',{name:'Confirm completed communication',exact:true}),'Critical results to tell');
  j.writes[name]={path,state:'awaiting-ui'};save();if(lost)await rg.fault({failPath:'/api/v1'+path,failMethod:'POST',once:true});
  await m.getByRole('button',{name:'Confirm completed communication',exact:true}).evaluate(b=>{b.click();b.click();});
  if(lost){await expect(m).toContainText('The result is unknown');const sent=(await posts(rg,path)).slice(before);assert.equal(sent.length,1);assert.equal(sent[0].status,201);j.writes[name]={...sent[0],state:'confirmed-server-reply-lost'};save();await expect(m.getByRole('button',{name:'Confirm completed communication',exact:true})).toBeDisabled();await p.keyboard.press('Escape');await expect(m).toBeVisible();await m.getByRole('button',{name:'Retry original request',exact:true}).click();}
  await expect(m).toHaveCount(0);const sent=(await posts(rg,path)).slice(before);assert.equal(sent.length,lost?2:1);assert.equal(sent.at(-1).status,201);if(lost){assert.equal(sent[0].key,sent[1].key);assert.deepEqual(sent[0].body,sent[1].body);assert.equal(String(sent[1].replay),'true');}j.writes[name]={...sent[0],state:'confirmed',replay:lost?sent[1]:undefined};save();return sent.at(-1).result.data;
 }
 await draft('Telephone','RequestingDoctor','DEMO simulated requesting doctor',false);
 const path=`/critical-results/${first.critical_result_id}/communications`,before=(await posts(rg,path)).length;
 await p.getByRole('button',{name:'Review communication record',exact:true}).click();await expect(p.getByRole('dialog')).toHaveCount(0);await expect(p.locator('main')).toContainText('Telephone and in-person communication require');assert.equal((await posts(rg,path)).length,before);
 await write(rg,'negative-readback',path,{means:'Telephone',recipient_role:'RequestingDoctor',recipient_name:'DEMO software refusal only',read_back:false,note:j.run+' no real call'},'CRITICAL_RESULT_READ_BACK_REQUIRED');
 await p.getByLabel(/The recipient read the result back/).check();j.communication=await submit('primary-communication',first,true);save();assert.equal(j.communication.status,'Communicated');assert.equal(j.communication.communications.length,1);assert.equal(j.communication.acknowledged_at,null);await expect(p.getByTestId('critical-history')).toContainText('DEMO simulated requesting doctor');
 pass('Missing read-back refuses before POST and with actual422 code; lost201/doubleclick retry uses identical key/body, one audit entry, separate doctor acknowledgement');
 await open(second);await draft('InPerson','RequestingDoctor','DEMO simulated on-call doctor',true);await p.getByRole('button',{name:'Review communication record',exact:true}).click();let m=p.getByRole('dialog');const count=(await posts(rg,`/critical-results/${second.critical_result_id}/communications`)).length;
 await write(rd,'concurrent-patient',`/critical-results/${second.critical_result_id}/communications`,{means:'Written',recipient_role:'Patient',recipient_name:'DEMO synthetic patient communication',read_back:false,note:j.run+' no real communication; concurrency fixture'});
 await m.getByRole('button',{name:'Confirm completed communication',exact:true}).click();await expect(m).toContainText('The result, communication history, permission or service changed.');assert.equal((await posts(rg,`/critical-results/${second.critical_result_id}/communications`)).length,count);await m.getByRole('button',{name:'Close',exact:true}).click();
 await p.getByRole('button',{name:'Refresh critical results',exact:true}).click();await expect(p.getByTestId('critical-history')).toContainText('DEMO synthetic patient communication');await draft('InPerson','RequestingDoctor','DEMO simulated on-call doctor',true);j.secondaryCommunication=await submit('secondary-communication',second);save();assert.equal(j.secondaryCommunication.status,'Communicated');assert.equal(j.secondaryCommunication.communications.length,2);
 pass('Concurrent real audit entry invalidates frozen review before POST; refreshed InPerson read-back records exact actual history without unsupported edit/delete/acknowledge');
 // Fresh auth/record read and versioned doctor acknowledgement: upstream fixture only.
 for(const cr of [first,second]){const current=await doctor.native('api',{method:'GET',path:`/critical-results/${cr.critical_result_id}`});const ack=await write(doctor,'ack-'+cr.critical_result_id,`/critical-results/${cr.critical_result_id}/acknowledge`,{expected_version:current.row_version,action_taken:j.run+' SOFTWARE ONLY simulated acknowledgement, no actual clinical action'});assert.equal(ack.status,'Acknowledged');}
 await expect(p.getByTestId('critical-detail')).toContainText('Acknowledged by doctor');assert.equal((await rg.native('critical-result-alarm',{criticalResultId:first.critical_result_id})).played,false);
 await p.getByLabel('Not yet acknowledged only',{exact:true}).uncheck();await p.getByRole('button',{name:'Apply log filters',exact:true}).click();await p.getByLabel('Find in returned critical results',{exact:true}).fill('NO-MATCH-'+j.run);await expect(p.getByTestId('critical-log-row')).toHaveCount(0);await p.getByLabel('Find in returned critical results',{exact:true}).fill(second.critical_number);await expect(p.getByTestId('critical-log-row')).toHaveCount(1);
 await rg.fault({failPath:`/api/v1/critical-results/${second.critical_result_id}`,failMethod:'GET',once:false});await p.getByRole('button',{name:'Refresh critical results',exact:true}).click();await expect(p.getByTestId('critical-detail')).toHaveCount(0);await expect(p.locator('main .error[role="alert"]')).toBeVisible({timeout:60000});await rg.fault({failPath:null});await open(second);
 await p.getByLabel('Find in returned critical results',{exact:true}).fill('');
 const old=all.find(x=>x.critical_result_id===1&&x.patient_name===prior.run);assert(old?.is_overdue);await open(old);await expect(p.getByTestId('critical-detail')).toContainText('OVERDUE');assert.equal((await rg.native('critical-result-alarm',{criticalResultId:old.critical_result_id})).played,true);
 pass('Separate doctor acknowledgement arrives live; acknowledged alarm silent; local no-match/history filters and failed read hide stale context; actual owned old overdue record shows server deadline/escalation');
 await open(second);
 for(const language of ['en','ur']){await rg.prefs({language,theme:'Light',ui_scale_pct:100});await expect(p.locator('html')).toHaveAttribute('lang',language);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`public/handbook/critical_results_radiology-${language}.png`,fullPage:true});for(const theme of ['Light','DarkHighContrast']){await rg.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}}
 await rg.prefs({language:'en',theme:'Light',ui_scale_pct:100});const win=await rg.app.browserWindow(p);const key=async c=>win.evaluate((w,c)=>{for(const type of ['keyDown','keyUp'])w.webContents.sendInputEvent({type,keyCode:c,modifiers:['control']});},c);
 await rg.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await rg.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await rg.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await rg.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await rg.native('state')).prefs.ui_scale_pct).toBe(100);
 await rg.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;WS.prototype.emit=function(e,...a){if(e==='message')globalThis.criticalImagingSocket=this;return emit.call(this,e,...a);};});await expect.poll(()=>rg.app.evaluate(()=>!!globalThis.criticalImagingSocket),{timeout:45000}).toBe(true);const reconnectAt=Date.now();await rg.app.evaluate(()=>globalThis.criticalImagingSocket.terminate());await expect.poll(()=>p.evaluate(()=>window.criticalImagingStreams.some(x=>x.status==='Live'&&x.resync)),{timeout:45000}).toBe(true);
 for(const route of ['/api/v1/critical-results','/api/v1/diagnostics/worklist',`/api/v1/critical-results/${second.critical_result_id}`])await expect.poll(async()=>(await rg.trace()).requests.some(x=>x.path.split('?')[0]===route&&x.status===200&&x.started>=reconnectAt)).toBe(true);
 pass('Actual reconnect refreshes log/worklist/selected detail; F1 preserves dialog focus/draft; ENUR/full-page media, both themes250 and native100/250/reset bounds pass');
 const denied=await launch('critical-imaging-cashier','demo.cashier');await expect(denied.p.getByRole('navigation').getByRole('button',{name:'Critical results to tell',exact:false})).toHaveCount(0);const bad=await denied.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body:{means:'Written',recipient_role:'Patient',recipient_name:'DEMO denied'},key:crypto.randomUUID()});assert.equal(bad.error?.code,'PERMISSION_REQUIRED');assert.equal((await denied.p.evaluate(id=>window.terminal.call('critical-result-alarm',{criticalResultId:id}),first.critical_result_id)).ok,false);
 pass('Cashier scoped menu and native communication/alarm boundary denied; all new own criticals acknowledged, no actual calls/care');
 j.renderer=rg.j.renderer;j.events=await p.evaluate(()=>window.criticalImagingEvents);j.passed=true;save();
}catch(e){j.error=e.stack;for(const s of actors){try{j['failure_'+s.j.name]=await s.p.locator('body').innerText();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of actors.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}j.finished=new Date().toISOString();save();}

```
