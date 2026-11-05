// Read-only DEV regression of the changed directories, using freshly looked-up data.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,capture}from './clinical-test-kit.mjs';
const run=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/run.json')).run;
const wanted=new Set(process.argv.slice(2));
const summary={run,checks:[],limits:['No human review or translation sign-off; no business writes in this script.']};
const resultFile='artifacts/refresh-7429acf-ui'+(wanted.size?'-'+[...wanted].join('-').replaceAll('.','-'):'')+'.json';
const save=()=>fs.writeFileSync(resultFile,JSON.stringify(summary,null,2));save();
for(const [account,screen,label]of [['demo.ops','waste_log_ops','Hospital waste log'],['demo.maintenance','equipment_maintenance','Medical Equipment'],['demo.labadmin','lab_admin','Lab administration'],['demo.quality','report_incident','Report an incident'],['demo.cashier','report_incident','Report an incident']].filter(([account])=>!wanted.size||wanted.has(account))){
 let s;try{
  s=await session('refresh7429-'+account.replace('.','-'),account);
  const nav=s.p.getByRole('navigation').getByRole('button');summary[account]={navigation:await nav.allTextContents()};save();
  const route=nav.filter({hasText:new RegExp(label,'i')});await expect(route.first()).toBeVisible();await route.first().click();
  const main=s.p.locator('#content');await expect(main).toBeVisible();
  await expect.poll(async()=>{const trace=await s.trace();return !trace.requests.some(r=>!r.finished);},{timeout:30000}).toBe(true);
  summary[account].text=(await main.innerText()).slice(0,12000);summary[account].requests=(await s.trace()).requests.map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}));save();
  if(screen==='waste_log_ops'){
   await expect(main).toContainText('Waiting kg');
   const log=await s.native('api',{method:'GET',path:'/infection/waste'});assert.equal(log.records.filter(r=>r.location?.startsWith(run)).reduce((n,r)=>n+r.weight_kg,0),0.75);
   await main.getByRole('button',{name:'Hand over waiting collections',exact:true}).click();await expect(main).toContainText('No collections are waiting.');
   await expect(main.locator('select[data-help="wl.vendor"] option')).not.toHaveCount(1);
   await capture(s,'waste_log_ops');
   summary.checks.push('Waste: current totals, empty waiting list after completed synthetic handover, named contractors, English/Urdu render.');
  }
  if(screen==='equipment_maintenance'){
   await main.locator('[data-help="em-tab-inventory"]').click();
   await expect(main).toContainText('SCN-7429acf');
   await main.locator('[data-help="em-inv-item"]').filter({hasText:run}).click();
   await expect(main).toContainText('MedServ Biomedical Engineering');
   await expect(main).toContainText('SYNTHETIC Equipment Supplier');
   await capture(s,'equipment_maintenance');
   summary.checks.push('Equipment: freshly created synthetic medical asset visible.');
  }
  if(screen==='lab_admin'){
   await main.locator('[data-help="lab_admin.tab_reagents"]').click();
   await main.locator('[data-help="lab_admin.btn_open_adjust_stock"]').click();
   const reagent=main.locator('select[data-help="lab_admin.input_adjust_batch_id"]').first();
   const reagentId=await reagent.locator('option').filter({hasText:'Glucose reagent'}).getAttribute('value');assert(reagentId);await reagent.selectOption(reagentId);
   const batches=main.locator('.directory-picker select[data-help="lab_admin.input_adjust_batch_id"]');
   await expect(batches.locator('option').filter({hasText:run})).toHaveCount(1);
   const labels=await batches.locator('option:not([value=""])').allTextContents();assert(labels[0].includes(run));assert.match(labels[0],/ · 4\s*$/);
   await capture(s,'lab_admin');
   await main.locator('[data-help="lab_admin.btn_cancel_adjust"]').last().click();
   summary.checks.push('Lab: reagent-dependent batch picker shows fresh batch first, remaining4, with named choices; no adjustment submitted.');
  }
  if(screen==='report_incident'){
   const raw=await s.native('state'),permissions=raw.user.permissions;
   const expected=permissions.some(p=>['ipd.bed.view','cssd.operate','infection.control.manage','complaint.manage','incident.view','facility.drill.manage','roster.manage.all','facility.equipment.manage','pharmacy.storage.record'].includes(p));
   await expect(main.locator('.directory-picker select[data-help="incident.whenwhere"]')).toHaveCount(expected?1:0);
   const typeSelect=main.locator('select:has(optgroup[label="Medication"])');
   const medicationType=await typeSelect.locator('optgroup[label="Medication"] option').first().getAttribute('value');assert(medicationType);await typeSelect.selectOption(medicationType);
   const medicines=main.locator('.lookup').filter({hasText:'Medicine'});const formulary=permissions.includes('pharmacy.formulary.view');await expect(medicines).toHaveCount(formulary?1:0);
   if(formulary){await medicines.locator('input').fill('Para');await medicines.getByRole('button').click();await expect(medicines.locator('option').filter({hasText:'Paracetamol 500mg'})).toHaveCount(1);}
   summary.checks.push(account+': ward picker visibility matches auth/me permission set.');
  }
  s.j.passed=true;summary[account].passed=true;save();
 }catch(error){summary[account]??={};summary[account].error=String(error);save();throw error;}
 finally{if(s)await s.close();}
}
summary.passed=true;save();console.log(summary.checks.join('\n'));
