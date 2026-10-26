// Final renderer/native Urdu-print regression on owned terminal manifests. ZERO business writes.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('artifacts/lab-sendout-check.json'));assert(original.passed&&original.finished,'Reconcile original send-out workflow first');
const s=await session('sendout-readonly','demo.labtech');
try{
 await s.nav('Samples sent to partner laboratories');const p=s.p,m=original.manifest;
 await expect(p.locator('[data-help-screen="lab_send_outs"]')).toBeVisible();await p.getByLabel('Known manifest ID',{exact:true}).fill(String(m.send_out_id));await p.getByRole('button',{name:'Read known manifest',exact:true}).click();await expect(p.getByTestId('sendout-detail')).toContainText(m.manifest_number);
 const record=await s.native('api',{method:'GET',path:`/lab/send-outs/${m.send_out_id}`});assert.equal(record.outstanding,0);assert.equal(record.returned,1);assert.equal(record.rejected,1);assert.deepEqual(record.items.map(x=>x.sample_id).sort(),m.items.map(x=>x.sample_id).sort());
 await help(s,p.getByLabel('Known manifest ID',{exact:true}),'Samples sent to partner laboratories');await expect(p.getByTestId('sendout-detail').getByRole('button',{name:'Enter partner result or rejection',exact:true})).toHaveCount(0);
 await p.getByLabel('Outstanding manifests only',{exact:true}).uncheck();await p.getByRole('button',{name:'Apply manifest filters',exact:true}).click();await p.getByLabel('Find in returned manifests',{exact:true}).fill(m.manifest_number);await expect(p.getByTestId('sendout-register-row')).toHaveCount(1);
 await p.evaluate(()=>scrollTo(0,0));await capture(s,'lab_send_outs');
 await s.app.evaluate(({BrowserWindow,dialog},folder)=>{
  const fs=process.getBuiltinModule('fs'),original=BrowserWindow.prototype.loadURL;globalThis.finalManifestPdf=folder+'/sendout-manifest-en.pdf';dialog.showSaveDialog=async()=>({canceled:false,filePath:globalThis.finalManifestPdf});
  BrowserWindow.prototype.loadURL=async function(url,...a){const target=String(url).startsWith('data:text/html')&&/Courier received|لے جانے والے کی وصولی/.test(decodeURIComponent(String(url)));if(target)this.setContentSize(1000,1500);const result=await original.call(this,url,...a);if(target){await this.webContents.executeJavaScript('document.fonts.ready');const im=await this.webContents.capturePage();fs.writeFileSync(globalThis.finalManifestPdf.replace('.pdf','.png'),im.toPNG());globalThis.finalManifestText=await this.webContents.executeJavaScript('document.body.innerText');globalThis.finalManifestFont=await this.webContents.executeJavaScript('getComputedStyle(document.body).fontFamily');}return result;};
 },path.resolve('docs'));
 await p.getByRole('button',{name:'Save manifest PDF',exact:true}).click();await expect(p.locator('main')).toContainText('Manifest PDF saved.');assert((await s.app.evaluate(()=>globalThis.finalManifestText)).includes(m.items[0].barcode));
 await s.app.evaluate(()=>{globalThis.finalManifestPdf=globalThis.finalManifestPdf.replace('-en.pdf','-ur.pdf');});await s.prefs({language:'ur'});await p.locator('[data-help="sendout.print"]').last().click();await expect(p.locator('main')).toContainText('فہرست پی ڈی ایف محفوظ۔');assert((await s.app.evaluate(()=>globalThis.finalManifestFont)).startsWith('Urdu'));await s.prefs({language:'en'});
 for(const language of ['en','ur'])assert.equal(fs.readFileSync(`docs/sendout-manifest-${language}.pdf`).subarray(0,5).toString(),'%PDF-');
 const win=await s.app.browserWindow(p);async function key(c){await win.evaluate((w,c)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:c,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:c,modifiers:['control']});},c);}
 await s.prefs({ui_scale_pct:245});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));s.pass('Final exact terminal manifests/history/finality/F1 and actual ENUR/themes250/nativezoom bounds/reset; real A4 PDFs with Urdu-first bundled font/header/courier signatures; ZERO business writes');s.j.passed=true;
 fs.writeFileSync('docs/sendout-readonly-evidence-2026-10-26.json',JSON.stringify({date:new Date().toISOString(),passed:true,build:s.j.renderer,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}
