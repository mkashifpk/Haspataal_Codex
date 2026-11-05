# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Current synthetic scenario only. Never rerun after a partial business write without reconciliation.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const file='artifacts/backend-refresh-ui.json';assert(!fs.existsSync(file),'Reconcile original UI journal before continuation');
const fixture=JSON.parse(fs.readFileSync('docs/backend-refresh-live-evidence-2026-10-28.json'));
const result=n=>fixture.requests.find(x=>x.label===n).result.body.data;
const j={run:fixture.run,checks:[],intents:[],passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const actors=[];const pass=m=>{j.checks.push(m);save();console.log('PASS '+m)};
let rg;
try{
 rg=await session('backend-refresh-radiographer','demo.radiographer');actors.push(rg);const p=rg.p;p.on('dialog',d=>d.accept());
 await rg.nav('Imaging worklist');
 const o=result('order-nurse-refusal');const actual=await rg.native('api',{method:'GET',path:'/imaging/orders/'+o.imaging_order_id});
 assert.equal(actual.patient_id,fixture.scenario.patient_id);assert.equal(actual.status,'InProgress');assert(actual.patient_name.includes('SCN '+fixture.scenario.run));
 await p.getByLabel('Known imaging order ID',{exact:true}).fill(String(o.imaging_order_id));await p.getByRole('button',{name:'Open imaging order',exact:true}).click();
 await expect(p.locator('main')).toContainText(o.accession_number);
 await p.getByRole('button',{name:'Link PACS study',exact:true}).click();let m=p.getByRole('dialog');
 await m.getByLabel('No contrast was given; completing by study link is appropriate.',{exact:true}).check();
 await m.getByRole('button',{name:'Review imaging action',exact:true}).click();
 j.intents.push({kind:'link',order_id:o.imaging_order_id});save();
 await m.getByRole('button',{name:'Confirm imaging action',exact:true}).click();
 await expect(m).toContainText('PACS_NOT_CONFIGURED');await expect(m).toContainText('Images are not linked on this server.');
 await expect(m).toContainText('Current server record');await expect(m.getByRole('button',{name:'Retry original request',exact:true})).toHaveCount(0);
 let trace=await rg.trace();const links=trace.requests.filter(x=>x.method==='POST'&&x.path==='/api/v1/imaging/orders/'+o.imaging_order_id+'/link-study');assert.equal(links.length,1);assert.equal(links[0].status,409);
 await help(rg,m.getByRole('button',{name:'Complete examination without images',exact:true}),'Imaging worklist');
 await m.getByRole('button',{name:'Complete examination without images',exact:true}).click();
 await m.getByLabel('Was contrast given?',{exact:true}).selectOption('Given');
 await m.getByLabel('Find the doctor present',{exact:true}).fill('Dr');await m.getByRole('button',{name:'Find doctor',exact:true}).click();
 await expect(m).toContainText('PMDC LIC-00010');await expect(m).not.toContainText('PNC LIC-');
 const doc=result('pmdc-lookup')[0];await m.getByRole('button',{name:doc.full_name+' · '+doc.registration,exact:true}).click();
 await expect(m).toContainText(doc.registration);await expect(m.getByRole('spinbutton')).toHaveCount(0);
 await help(rg,m.getByLabel('Find the doctor present',{exact:true}),'Imaging worklist');
 for(const language of ['en','ur']){await rg.prefs({language});await p.screenshot({path:'artifacts/backend-refresh-contrast-'+language+'.png',fullPage:true});}
 await rg.prefs({language:'en'});await m.getByLabel('Was contrast given?',{exact:true}).selectOption('None');
 await m.getByRole('button',{name:'Review imaging action',exact:true}).click();j.intents.push({kind:'complete-without-images',order_id:o.imaging_order_id});save();
 await m.getByRole('button',{name:'Confirm imaging action',exact:true}).click();await expect(m).toHaveCount(0);
 const completed=await rg.native('api',{method:'GET',path:'/imaging/orders/'+o.imaging_order_id});assert.equal(completed.status,'Completed');assert.equal(completed.orthanc_study_id,null);
 pass('Real UI no-PACS409 triggers current-order reread, no retry, F1; PMDC picker names/registration only; no typed ID; separate completion200 without images');
 await p.getByRole('button',{name:'Link PACS study',exact:true}).click();m=p.getByRole('dialog');await m.getByLabel('Study lookup method',{exact:true}).selectOption('manual');
 await expect(m.getByLabel('DICOM Study Instance UID',{exact:true})).toHaveCount(0);
 await m.getByLabel('Orthanc study ID',{exact:true}).fill('invalid-not-a-study');await m.getByRole('button',{name:'Review imaging action',exact:true}).click();await expect(m).toContainText('five groups of eight lower-case hexadecimal digits');
 assert.equal((await rg.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/link-study')).length,1);await m.getByRole('button',{name:'Close examination draft',exact:true}).click();
 pass('Manual invalid ID refused before transport; UID input absent; no invented or example ID used');
 await rg.nav('Repeated images register');await p.getByLabel('Known imaging order ID',{exact:true}).fill(String(result('order-contrast').imaging_order_id));await p.getByRole('button',{name:'Read source examination',exact:true}).click();await expect(p.getByTestId('repeat-source')).toContainText('Completed');
 await help(rg,p.getByLabel('Known imaging order ID',{exact:true}),'Repeated images register');
 pass('Repeat register reads fresh completed examination and authored F1 guidance');
 await rg.nav('Outsourced examinations');await expect(p.locator('main h1')).toHaveText('Outsourced examinations');
 for(const language of ['en','ur'])for(const theme of ['Light','DarkHighContrast']){await rg.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
 await rg.prefs({language:'en',theme:'Light',ui_scale_pct:100});
 pass('Outsourced screen reads fresh DEV scope; English/Urdu both-theme250 root layout');
 j.trace=await rg.trace();j.renderer=rg.j.renderer;j.passed=true;save();
}catch(e){j.error=e.stack;for(const s of actors){try{j['failure_'+s.j.name]=await s.p.locator('body').innerText();j.trace=await s.trace();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of actors.reverse())await s.close();j.finished=new Date().toISOString();save();}

```
