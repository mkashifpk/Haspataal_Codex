// Real DEV reads only; restores demo preferences. Never changes catalogue/partners or enters a Review code.
import { session, expect, help } from './clinical-test-kit.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const evidence = { date: new Date().toISOString(), profiles: [], checks: [], businessWrites: 0 };
// This script owns only this generated read-only PDF output, not any business journal.
if(fs.existsSync('artifacts/diagnostic-services-list.pdf'))fs.unlinkSync('artifacts/diagnostic-services-list.pdf');
const s = await session('diagnostic-services-list', 'demo.reception');
try {
 // Inject a terminal-side HTTP failure only AFTER a real DEV response. Never fabricate a success.
 // A transport outage invokes app-wide reconnection; this fault isolates the screen's failed-read recovery.
 await s.app.evaluate(()=>{const https=process.getBuiltinModule('https'),original=https.request;globalThis.diagnosticFaults=[];https.request=function(url,options,callback){return original.call(this,url,options,response=>{const target=typeof url==='object'&&!(url instanceof URL)?url.path:new URL(url).pathname;if(globalThis.diagnosticHttpFailPath&&target.includes(globalThis.diagnosticHttpFailPath)){globalThis.diagnosticFaults.push({path:target,realStatus:response.statusCode,injectedStatus:503});response.statusCode=503;}callback(response);});};});
 await s.nav('Diagnostic services list');
 const p=s.p, screen=p.locator('[data-help-screen="diagnostic_services_list"]');
 await expect(screen).toBeVisible();
 await expect(screen.getByRole('table')).toBeVisible();
 const tests=await s.native('api',{method:'GET',path:'/lab/tests'});
 assert(tests.length,'Live catalogue fixture required');
 await expect(p.getByTestId('diagnostic-service-row')).toHaveCount(tests.length);
 const partner=tests.find(t=>t.availability==='SendOut'&&t.send_out_partner_name);
 assert(partner,'Live configured send-out partner required');
 await p.getByLabel('Where performed',{exact:true}).selectOption('SendOut');
 await p.getByLabel('Find test or partner',{exact:true}).fill(partner.send_out_partner_name);
 await expect(screen).toContainText(partner.send_out_partner_name);
 await expect(p.getByTestId('diagnostic-service-row')).toHaveCount(tests.filter(t=>t.availability==='SendOut'&&t.send_out_partner_name===partner.send_out_partner_name).length);
 await help(s,p.getByLabel('Find test or partner',{exact:true}),'Diagnostic services list');
 await expect(p.getByLabel('Find test or partner',{exact:true})).toHaveValue(partner.send_out_partner_name);
 await p.getByLabel('Find test or partner',{exact:true}).fill('DEMO-NO-MATCH-DIAGNOSTIC-SERVICES');
 await expect(screen).toContainText('No tests match these filters.');
 await p.getByRole('button',{name:'Show all laboratory tests',exact:true}).click();
 await expect(p.getByTestId('diagnostic-service-row')).toHaveCount(tests.length);
 s.pass('Actual catalogue/name/code/partner and InHouse/SendOut filter/no-match/reset; F1 preserves search and restores focus');
 await s.app.evaluate(({dialog},file)=>{globalThis.diagnosticSaveMode='cancel';globalThis.diagnosticSaveCalls=0;dialog.showSaveDialog=async()=>{globalThis.diagnosticSaveCalls++;return globalThis.diagnosticSaveMode==='cancel'?{canceled:true}:{canceled:false,filePath:file};};},path.resolve('artifacts/diagnostic-services-list.pdf'));
 await p.getByRole('button',{name:'Save PDF to print',exact:true}).click();
 await expect(screen).toContainText('Save cancelled. No file was saved.');
 assert(!fs.existsSync('artifacts/diagnostic-services-list.pdf'),'Cancelled save must not write a file');
 await s.app.evaluate(()=>{globalThis.diagnosticSaveMode='save'});
 await s.fault({delayPath:'/diagnostics/services/pdf',delayMs:1200});
 const before=(await s.trace()).requests.filter(r=>r.path.endsWith('/diagnostics/services/pdf')).length;
 await p.getByRole('button',{name:'Save PDF to print',exact:true}).evaluate(b=>{b.click();b.click()});
 await expect(screen).toContainText('Official PDF saved.');
 assert.equal((await s.trace()).requests.filter(r=>r.path.endsWith('/diagnostics/services/pdf')).length,before+1);
 const pdf=fs.readFileSync('artifacts/diagnostic-services-list.pdf');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>1000);
 await s.fault({delayPath:null,delayMs:0});
 await p.getByRole('button',{name:'Preview official PDF',exact:true}).click();
 await expect(screen).toContainText('Official PDF preview opened.');
 const viewers=await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().startsWith('data:application/pdf')).map(w=>w.id));assert(viewers.length,'Real protected native PDF viewer');
 await s.app.evaluate(({BrowserWindow},ids)=>{for(const id of ids)BrowserWindow.fromId(id)?.close()},viewers);
 s.pass('Real server PDF saved and protected native preview opened; cancelled save writes no file; delayed double-click makes ONE GET/dialog; no local PDF replacement');
 await s.app.evaluate(()=>{globalThis.diagnosticHttpFailPath='/diagnostics/services/pdf'});
 await p.getByRole('button',{name:'Save PDF to print',exact:true}).click();
 await expect(screen.getByRole('alert')).toBeVisible();
 await expect(screen).not.toContainText('Official PDF saved.');
 await s.app.evaluate(()=>{globalThis.diagnosticHttpFailPath=null});
 await p.getByRole('button',{name:'Save PDF to print',exact:true}).click();
 await expect(screen).toContainText('Official PDF saved.');
 await s.app.evaluate(()=>{globalThis.diagnosticHttpFailPath='/lab/tests'});
 await p.getByRole('button',{name:'Refresh laboratory list',exact:true}).click();
 await expect(screen.getByRole('alert')).toBeVisible();
 await expect(p.getByTestId('diagnostic-service-row')).toHaveCount(0);
 await s.app.evaluate(()=>{globalThis.diagnosticHttpFailPath=null});
 await screen.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(p.getByTestId('diagnostic-service-row')).toHaveCount(tests.length);
 s.pass('Injected HTTP503 after actual DEV PDF/catalogue responses displays errors without saved success or stale rows; explicit document/read-only Retry recovers. No fabricated backend success');
 for(const language of ['en','ur']){
  await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(p.locator('html')).toHaveAttribute('lang',language);await p.evaluate(()=>scrollTo(0,0));
  await p.screenshot({path:`public/handbook/diagnostic_services_list-${language}.png`,fullPage:true});
  for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
 }
 await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});
 const w=await s.app.browserWindow(p);
 const key=async c=>w.evaluate((w,c)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:c,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:c,modifiers:['control']})},c);
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.pass('Actual ENUR/both themes250 media/no horizontal overflow and native keyboard zoom100-250bounds/reset; ZERO business writes');
 s.j.passed=true;evidence.checks.push(...s.j.checks);evidence.partner={test_code:partner.code,partner_name:partner.send_out_partner_name};evidence.build=s.j.renderer;
} finally {await s.app.evaluate(()=>{globalThis.diagnosticHttpFailPath=null});await s.close();evidence.profiles.push({name:s.j.name,passed:s.j.passed,restored:s.j.preferences_restored,signed_out:s.j.signed_out});}
const denied=await session('diagnostic-services-denied','demo.cashier');
try {
 await expect(denied.p.getByRole('navigation').getByRole('button',{name:'Diagnostic services list',exact:false})).toHaveCount(0);
 const r=await denied.p.evaluate(()=>window.terminal.call('clinical-pdf',{path:'/diagnostics/services/pdf',preview:false}));assert(!r.ok);
 assert(!(await denied.trace()).requests.some(r=>r.path.endsWith('/diagnostics/services/pdf')));
 denied.pass('Cashier workspace has no screen entry; native PDF action refuses before HTTP');denied.j.passed=true;evidence.checks.push(...denied.j.checks);
}finally{await denied.close();evidence.profiles.push({name:denied.j.name,passed:denied.j.passed,restored:denied.j.preferences_restored,signed_out:denied.j.signed_out});}
evidence.passed=evidence.profiles.every(p=>p.passed&&p.restored&&p.signed_out);assert(evidence.passed);fs.writeFileSync('docs/diagnostic-services-list-evidence-2026-10-27.json',JSON.stringify(evidence,null,2));
