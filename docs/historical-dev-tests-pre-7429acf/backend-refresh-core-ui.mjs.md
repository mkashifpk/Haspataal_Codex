# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,help,capture} from './clinical-test-kit.mjs';
const root='docs/backend-refresh-2026-10-30/dev/',read=name=>JSON.parse(fs.readFileSync(root+name+'-result.json')).body.data;
const resume=process.argv.includes('--resume-handover');
const marOnly=process.argv.includes('--resume-mar');
const readsOnly=process.argv.includes('--resume-reads')||marOnly;
const waiting=read('code-red-ui'),patient=read('patient-a'),estimate=read('estimate-ui-draft'),file=`artifacts/backend-refresh-core-ui${marOnly?'-mar':readsOnly?'-reads':resume?'-resume':''}.json`;
assert(!fs.existsSync(file),'Reconcile prior core UI journal before rerunning');
const j={started:new Date().toISOString(),checks:[],intents:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let d1,d2,n,b;
const intent=action=>{j.intents.push({action,at:new Date().toISOString()});save();};
try{
 if(!readsOnly){
 [d1,d2]=await Promise.all([session('refresh1030-core-doctor','demo.doctor'),session('refresh1030-core-doctor2','demo.doctor2')]);
 for(const s of [d1,d2]){s.p.on('dialog',d=>d.accept());await s.nav('Inpatient rounds');}
 if(!resume){
 await d1.p.getByLabel('Rounds',{exact:true}).selectOption('waiting');
 await expect(d1.p.locator('.inpatient-rounds aside')).toContainText(waiting.mrn);
 await d1.p.locator('.inpatient-rounds aside').getByRole('button').filter({hasText:waiting.mrn}).click();
 await expect(d1.p.getByRole('button',{name:'Take this patient',exact:true})).toBeEnabled();
 await d1.p.getByRole('button',{name:'Take this patient',exact:true}).click();
 await d1.p.getByLabel('Reason for taking over / handover',{exact:true}).fill('DEMO UI takeover; synthetic software record only');
 await help(d1,d1.p.getByRole('button',{name:'Review handover',exact:true}),'Inpatient rounds & discharge');
 await d1.p.getByRole('button',{name:'Review handover',exact:true}).click();
 intent('Take over own waiting synthetic admission '+waiting.admission_id+' through UI');
 await d1.p.getByRole('button',{name:'Confirm treating doctor',exact:true}).click();
 await expect(d1.p.getByRole('button',{name:'Hand over to another doctor',exact:true})).toBeVisible();
 await d1.p.getByLabel('Rounds',{exact:true}).selectOption('mine');
 await expect(d1.p.locator('.inpatient-rounds aside')).toContainText(waiting.mrn);
 j.checks.push('Waiting null-doctor patient taken over with a reason via idempotent UI; appears in My patients');save();
 }else{
  await d1.p.locator('.inpatient-rounds aside').getByRole('button').filter({hasText:waiting.mrn}).click();
  await expect(d1.p.getByRole('button',{name:'Hand over to another doctor',exact:true})).toBeEnabled();
  j.checks.push('Previously successful takeover reconciled from current server history; not repeated');save();
 }
 await d1.p.getByRole('button',{name:'Hand over to another doctor',exact:true}).click();
 await d1.p.getByLabel('Find PMDC doctor',{exact:true}).fill('Sara');
 await expect(d1.p.getByLabel('Receiving doctor',{exact:true})).toContainText('Sara');
 await d1.p.getByLabel('Receiving doctor',{exact:true}).selectOption({label:'Dr. Sara Malik · PMDC LIC-00011 · Paediatrics'});
 await d1.p.getByLabel('Reason for taking over / handover',{exact:true}).fill('DEMO UI handover test; no real clinical handover');
 await d1.p.getByRole('button',{name:'Review handover',exact:true}).click();
 intent('Hand over own synthetic admission '+waiting.admission_id+' to returned PMDC doctor through UI');
 await d1.p.getByRole('button',{name:'Confirm treating doctor',exact:true}).click();
 await expect(d1.p.locator('.inpatient-rounds aside')).not.toContainText(waiting.mrn);
 await expect(d2.p.locator('.inpatient-rounds aside')).toContainText(waiting.mrn);
 await d2.p.locator('.inpatient-rounds aside').getByRole('button').filter({hasText:waiting.mrn}).click();
 await expect(d2.p.locator('main')).toContainText('DEMO UI handover test');
 j.checks.push('Actual handover reaches both live doctors: leaves original rounds and appears in receiving rounds without reload; history retained');save();
 await d1.close();d1=undefined;await d2.close();d2=undefined;
 }
 if(!marOnly){
 b=await session('refresh1030-core-billing','demo.billing');b.p.on('dialog',d=>d.accept());await b.nav('Cost estimates');
 const work=b.p.locator('section').filter({has:b.p.getByRole('button',{name:'Prepare for this admission',exact:true})}).filter({hasText:patient.mrn}).filter({hasText:'ChangeOfWard'}).last();
 await expect(work.getByRole('button',{name:'Prepare for this admission',exact:true})).toBeEnabled();
 await work.getByRole('button',{name:'Prepare for this admission',exact:true}).click();
 await expect.poll(async()=>{const t=await b.trace();return t.requests.some(r=>r.path.endsWith(`/cost-estimates/${estimate.estimate_id}`)&&r.status===200);}).toBe(true);
 await expect(b.p.getByRole('button',{name:'Mark explained',exact:true})).toBeVisible();
 const bt=await b.trace();assert(!bt.requests.some(r=>r.path.includes('/transfers')));assert(bt.requests.some(r=>r.path.endsWith('/moves')&&r.status===200));assert(!bt.requests.some(r=>r.method==='POST'&&r.path.endsWith('/cost-estimates')));
 j.checks.push('Billing opens existing Draft through actual move source; no clinical transfers call, typed ID or duplicate preparation');
 await capture(b,'cost_estimates_billing');await b.close();b=undefined;save();
 }
 n=await session('refresh1030-core-nurse','demo.nurse');n.p.on('dialog',d=>d.accept());await n.nav('Medication administration record');
 await n.p.getByText('Other permitted live admissions',{exact:true}).click();await n.p.getByLabel('Find permitted admission',{exact:true}).fill(patient.mrn);await n.p.getByRole('button').filter({hasText:patient.mrn}).click();
 await expect(n.p.getByRole('button',{name:'Reprint recorded preparation #1',exact:true})).toBeVisible();
 await n.p.getByRole('button',{name:'Reprint recorded preparation #1',exact:true}).click();
 await expect.poll(async()=>{const t=await n.trace();return t.requests.some(r=>r.path.endsWith('/mar/1/dose-label')&&r.status===200);}).toBe(true);
 const nt=await n.trace();assert(!nt.requests.some(r=>r.method==='POST'&&/\/(prepare|chart)$/.test(r.path)));assert(nt.requests.find(r=>r.path.endsWith('/mar/1/dose-label')).result.data.fields.reprint);
 await expect(n.p.locator('main')).toContainText('Minimum interval (hours)');await expect(n.p.locator('main')).toContainText('Doses in last 24 hours');
 await expect(n.p.getByRole('button',{name:'Refresh PRN orders',exact:true})).toBeEnabled();
 await n.p.bringToFront();
 await help(n,n.p.getByRole('button',{name:'Refresh PRN orders',exact:true}),'Medication administration record');
 j.checks.push('New nurse process reprints server REPRINT for preparation from another session; no prepare/chart replay, PRN safety facts visible');
 await capture(n,'mar');await n.close();n=undefined;j.passed=true;save();
}catch(e){j.error=e.stack;for(const [name,s]of Object.entries({d1,d2,n,b}))if(s){try{j[name+'_ui']=await s.p.locator('body').innerText();j[name+'_trace']=await s.trace();await s.p.screenshot({path:`artifacts/backend-refresh-core-${name}-failure.png`});}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of [d1,d2,n,b])if(s)await s.close();j.finished=new Date().toISOString();save();}

```
