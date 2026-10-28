// Real DEV / fresh owned synthetic orders only. No real exposure, contrast, care or paper printing.
// NEVER replay a journal after interruption. Reconcile its original transport/body/key and order first.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('artifacts/radiology-worklist-check.json'));
const reg=fixture.writes.registration.response.body.data;
const order=n=>fixture.writes[n].response.body.data;
const file='artifacts/radiology-worklist-ui.json';
const resumeContrast=process.argv.includes('--resume-contrast-complete');
const resumeLink=process.argv.includes('--resume-after-link')||resumeContrast;
let previous;
if(fs.existsSync(file)){
 previous=JSON.parse(fs.readFileSync(file));
 if(resumeContrast){assert(previous.finished&&previous.writes.cancel?.state==='confirmed'&&previous.writes.contrastStart?.state==='confirmed'&&!previous.writes.contrastComplete);}
 else if(resumeLink){assert(previous.finished&&previous.writes.complete?.state==='confirmed'&&previous.writes.autoLink?.status===409 && previous.writes.autoLink?.error?.code==='PACS_NOT_CONFIGURED'&&!previous.writes.cancel);}
 else if(!process.argv.includes('--resume-before-ui-writes')||!previous.finished||Object.keys(previous.writes).length)throw Error('Existing UI journal: reconcile every prepared write before continuing. Never rerun clinical actions.');
 fs.copyFileSync(file,file.replace('.json','-diagnostic-'+Date.now()+'.json'));
}
const j=resumeLink?previous:{run:fixture.run,started:new Date().toISOString(),writes:{},checks:[]};
if(resumeLink){j.previous_error=j.error;delete j.error;delete j.finished;j.resumed=new Date().toISOString();}
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
const actors=[];
const start=async(n,u)=>{const s=await session(n,u);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const modal=s=>s.p.getByRole('dialog');
const posts=async(s,path)=>(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+path);
async function open(s,o){await s.p.getByLabel('Known imaging order ID',{exact:true}).fill(String(o.imaging_order_id));await s.p.getByRole('button',{name:'Open imaging order',exact:true}).click();await expect(s.p.locator('main')).toContainText(o.accession_number);await expect(s.p.getByRole('button',{name:'Refresh imaging',exact:true})).toBeEnabled();}
async function write(s,name,path,{lost=false}={}){
 assert(!j.writes[name]);const count=(await posts(s,path)).length;
 await modal(s).getByRole('button',{name:'Review imaging action',exact:true}).click();
 await expect(modal(s).getByRole('button',{name:'Confirm imaging action',exact:true})).toBeVisible();
 j.writes[name]={path,state:'prepared-ui-confirmation'};save();
 if(lost)await s.fault({failPath:'/api/v1'+path,failMethod:'POST',once:true});
 await modal(s).getByRole('button',{name:'Confirm imaging action',exact:true}).evaluate(b=>{b.click();b.click();});
 if(lost){
  await expect(modal(s)).toContainText('The result is unknown.');
  await expect(modal(s).getByRole('button',{name:'Close examination draft',exact:true})).toBeDisabled();
  const calls=(await posts(s,path)).slice(count);assert.equal(calls.length,1);assert.equal(calls[0].status,200);
  j.writes[name]={...calls[0],state:'confirmed-server-reply-lost'};save();
  await modal(s).getByRole('button',{name:'Retry original request',exact:true}).click();
 }
 await expect(modal(s)).toHaveCount(0);
 const calls=(await posts(s,path)).slice(count);assert.equal(calls.length,lost?2:1);
 const last=calls.at(-1);assert.equal(last.status,200,JSON.stringify(last.result?.error));
 if(lost){assert.equal(calls[0].key,last.key);assert.deepEqual(calls[0].body,last.body);assert.equal(String(last.replay),'true');}
 j.writes[name]={...last,state:'confirmed',calls:calls.length};save();return last.result.data;
}
async function twoIds(s,pregnancy='NotPregnant'){
 await modal(s).getByLabel('Patient identity method',{exact:true}).selectOption('TwoIdentifiers');
 await modal(s).getByLabel('I asked and matched name and MRN or date of birth.',{exact:true}).check();
 await modal(s).getByLabel('I checked and confirmed the site and side against this order.',{exact:true}).check();
 if(await modal(s).getByLabel('Pregnancy status',{exact:true}).count())await modal(s).getByLabel('Pregnancy status',{exact:true}).selectOption(pregnancy);
}
try{
 const rg=await start('radiology-worklist-radiographer','demo.radiographer'),p=rg.p;
 await rg.nav('Imaging worklist');
 if(resumeLink){const original=await rg.native('api',{method:'GET',path:'/imaging/orders/'+order('link').imaging_order_id});assert.equal(original.status,'Ordered');assert.equal(original.row_version,1);assert.equal(original.orthanc_study_id,null);assert.equal(original.study_instance_uid,null);j.writes.autoLink.state='reconciled-not-linked';j.writes.autoLink.observed=original;save();pass('Resumed only after exact original link order read: still Ordered v1/no study; NO repeat of link or confirmed primary stages');}
 if(!resumeLink){
 await expect(p.locator('main h1')).toHaveText('Imaging worklist');
 await expect(p.locator('main')).toContainText(fixture.run);
 await help(rg,p.getByLabel('Find in this worklist',{exact:true}),'Imaging worklist');
 await p.getByLabel('Find in this worklist',{exact:true}).fill('NO-SUCH-SYNTHETIC-ORDER');await expect(p.locator('main')).toContainText('No matching open examinations.');await p.getByLabel('Find in this worklist',{exact:true}).fill('');
 await open(rg,order('primary'));
 await expect(p.locator('main')).toContainText('Synthetic test flag only');
 await p.getByRole('button',{name:'Schedule examination',exact:true}).click();
 await write(rg,'schedule',`/imaging/orders/${order('primary').imaging_order_id}/status`,{lost:true});
 pass('Actual order, accession/patient flags, no-match/filter/F1; lost schedule doubleclick retries SAME key/body and one stage effect');
 await expect(p.getByRole('button',{name:'Start examination',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Start examination',exact:true}).click();
 const statusPath=`/imaging/orders/${order('primary').imaging_order_id}/status`,before=(await posts(rg,statusPath)).length;
 await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(modal(rg)).toContainText('Check and confirm the site and side');
 await twoIds(rg);await modal(rg).getByLabel('Pregnancy status',{exact:true}).selectOption('Pregnant');
 await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(modal(rg)).toContainText('Record the pregnancy decision');
 await modal(rg).getByLabel('Pregnancy decision and responsible clinician',{exact:true}).fill(fixture.run+' synthetic documented decision only; no exposure');
 const other=await rg.native('api',{method:'GET',path:'/patients/1'});assert(other.full_name.startsWith('DEMO-LAB-FIXES-')&&other.patient_id!==reg.patient_id);
 await modal(rg).getByLabel('Patient identity method',{exact:true}).selectOption('WristbandScan');
 await modal(rg).getByLabel('Patient wristband barcode',{exact:true}).fill('HMS:PT:'+other.mrn);await modal(rg).getByRole('button',{name:'Verify this patient wristband',exact:true}).click();await expect(modal(rg)).toContainText('STOP: wrong patient wristband.');
 await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(modal(rg).getByRole('button',{name:'Confirm imaging action',exact:true})).toHaveCount(0);
 assert.equal((await posts(rg,statusPath)).length,before);
 await modal(rg).getByLabel('Patient wristband barcode',{exact:true}).fill('HMS:PT:'+reg.mrn);await modal(rg).getByLabel('Patient wristband barcode',{exact:true}).press('Enter');await expect(modal(rg)).toContainText('Band matches this patient.');
 await help(rg,modal(rg).getByLabel('Pregnancy decision and responsible clinician',{exact:true}),'Imaging worklist');
 await expect(modal(rg).getByLabel('Pregnancy decision and responsible clinician',{exact:true})).toHaveValue(fixture.run+' synthetic documented decision only; no exposure');
 await write(rg,'start',statusPath);
 pass('Start blocks missing site/pregnancy decision and wrong real band with ZERO POST; correct band/side/Pregnant note and F1 draft preserved');
 await expect(p.getByRole('button',{name:'Complete examination',exact:true})).toBeEnabled();
 await p.getByRole('button',{name:'Complete examination',exact:true}).click();await modal(rg).getByLabel('Was contrast given?',{exact:true}).selectOption('None');await write(rg,'complete',statusPath);
 await expect(p.getByRole('button',{name:'Enter final report',exact:true})).toHaveCount(0);
 pass('Radiographer completes actual examination, report entry stays hidden by permission');
 // Actual auto-find only, never fabricate a PACS study ID. A refusal is recorded, not hidden.
 await open(rg,order('link'));await expect(p.getByRole('button',{name:'Link PACS study',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Link PACS study',exact:true}).click();
 await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();
 const linkPath=`/imaging/orders/${order('link').imaging_order_id}/link-study`;
 j.writes.autoLink={path:linkPath,state:'prepared-ui-confirmation'};save();
 await modal(rg).getByRole('button',{name:'Confirm imaging action',exact:true}).click();
 await expect.poll(async()=> (await posts(rg,linkPath)).filter(x=>x.finished).length).toBe(1);
 const link=(await posts(rg,linkPath))[0];j.writes.autoLink={...link,state:link.status===200?'confirmed':'refused'};save();
 if(link.status!==200){await expect(modal(rg)).toContainText(link.result.error.code);if(link.status>=500){j.writes.autoLink.state='unknown';save();await modal(rg).getByRole('button',{name:'Read current result',exact:true}).click();await modal(rg).getByRole('button',{name:'Result reviewed; return to draft',exact:true}).click();j.writes.autoLink.state='reconciled-not-linked';save();}else{await expect(modal(rg).getByRole('button',{name:'Close examination draft',exact:true})).toBeEnabled();await modal(rg).getByRole('button',{name:'Close examination draft',exact:true}).click();}}
 await expect(modal(rg)).toHaveCount(0);pass('Auto-link uses actual accession/empty body once; actual server outcome recorded, no guessed study identifiers');
 }
 if(!resumeContrast){
 await open(rg,order('cancel'));await expect(p.getByRole('button',{name:'Cancel order',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Cancel order',exact:true}).click();await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(modal(rg)).toContainText('Explain why this examination is cancelled.');
 await modal(rg).getByLabel('Cancellation reason',{exact:true}).fill(fixture.run+' synthetic cancellation; examination never happened');await write(rg,'cancel',`/imaging/orders/${order('cancel').imaging_order_id}/status`);pass('Cancellation requires reason; actual Cancelled order retained in known-ID history');
 await open(rg,order('contrast'));await expect(p.getByRole('button',{name:'Start examination',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Start examination',exact:true}).click();await twoIds(rg);await write(rg,'contrastStart',`/imaging/orders/${order('contrast').imaging_order_id}/status`);
 }else{await open(rg,order('contrast'));const actual=await rg.native('api',{method:'GET',path:'/imaging/orders/'+order('contrast').imaging_order_id});assert.equal(actual.status,'InProgress');assert.equal(actual.patient_id,reg.patient_id);pass('Confirmed prior cancellation/start from journal and actual CT InProgress before completing; no repeat');}
 await expect(p.getByRole('button',{name:'Complete examination',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Complete examination',exact:true}).click();await modal(rg).getByLabel('Was contrast given?',{exact:true}).selectOption('Given');
 await modal(rg).getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(modal(rg)).toContainText('Record the actual contrast agent');
 await modal(rg).getByLabel('Contrast agent, dose and route',{exact:true}).fill(fixture.run+' SYNTHETIC agent/dose/route only; no contrast administered');
 await modal(rg).getByLabel('Find the doctor present',{exact:true}).fill('Ahmed');await modal(rg).getByRole('button',{name:'Find doctor',exact:true}).click();await modal(rg).getByRole('button',{name:/Dr\. Ahmed Khan/}).click();
 const completed=await write(rg,'contrastComplete',`/imaging/orders/${order('contrast').imaging_order_id}/status`);assert.equal(completed.contrast_doctor_id,reg.doctor_id);
 pass('Contrast completion requires actual agent/dose/route and actual staff-picker doctor; live server accepts documented employee-ID mapping');
 const rd=await start('radiology-worklist-radiologist','demo.radiologist');await rd.nav('Imaging worklist');await open(rd,order('primary'));
 await expect(rd.p.getByRole('button',{name:'Enter final report',exact:true})).toBeEnabled();await rd.p.getByRole('button',{name:'Enter final report',exact:true}).click();
 await modal(rd).getByLabel('Final report text',{exact:true}).fill(fixture.run+' SYNTHETIC SOFTWARE REPORT. No actual exposure, disease or patient care.');
 await modal(rd).getByLabel('Critical finding note (optional)',{exact:true}).fill(fixture.run+' synthetic critical-handover test only, not a clinical finding');
 await help(rd,modal(rd).getByLabel('Final report text',{exact:true}),'Imaging worklist');
 await write(rd,'report',`/imaging/orders/${order('primary').imaging_order_id}/report`,{lost:true});
 await expect(rd.p.getByRole('button',{name:'Print final report',exact:true})).toBeEnabled();await expect(rd.p.locator('main')).toContainText('phone the responsible doctor NOW');
 const actual=await rd.native('api',{method:'GET',path:`/imaging/orders/${order('primary').imaging_order_id}`});assert.equal(actual.status,'Reported');assert(actual.reported_stamp?.user_id&&actual.critical_result_id);j.reported=actual;save();
 pass('Radiologist final report/stamp/critical log and phone-now warning; lost200 explicit SAME key replay creates one report/critical entry');
 await rd.app.evaluate(({app,BrowserWindow,dialog})=>{
  for(const w of BrowserWindow.getAllWindows())w.webContents.getPrintersAsync=async()=>[];
  app.on('web-contents-created',(_,c)=>{c.print=(_,cb)=>cb(false,'TEST: document printer cancelled');});
  dialog.showSaveDialog=async(_owner,options)=>({canceled:false,filePath:process.cwd()+'/artifacts/radiology-'+options.defaultPath});
 });
 await rd.p.getByRole('button',{name:'Save report PDF',exact:true}).click();await expect(rd.p.locator('main')).toContainText('Report PDF saved.');
 await rd.p.getByRole('button',{name:'Save server PDF',exact:true}).click();
 await expect.poll(()=>fs.existsSync(`artifacts/radiology-Clinical-document-${order('primary').imaging_order_id}.pdf`)).toBe(true);
 await rd.p.getByRole('button',{name:'Print final report',exact:true}).click();await expect(rd.p.locator('main')).toContainText('TEST: document printer cancelled');
 assert.equal((await posts(rd,`/imaging/orders/${order('primary').imaging_order_id}/report`)).length,2);
 pass('Actual signed payload/native rendered PDF/original server PDF and printer cancellation never repeat clinical report');
 await capture(rd,'radiology_worklist');await rd.p.evaluate(()=>window.scrollTo(0,0));
 j.passed=true;save();
}catch(e){j.error=e.stack;save();console.error(e);process.exitCode=1;}
finally{for(const s of actors.reverse())await s.close();j.finished=new Date().toISOString();save();}
