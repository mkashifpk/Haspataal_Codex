import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function renderer(){
 const calls=[];class Window{constructor(options){assert.equal(options.webPreferences.sandbox,true);assert.equal(options.webPreferences.nodeIntegration,false);this.webContents={executeJavaScript:async()=>{},print:(o,cb)=>{calls.push(o);cb(true)},printToPDF:async()=>Buffer.from('%PDF-test')};}async loadURL(url){assert(url.includes('Content-Security-Policy'));}destroy(){}}
 const m={exports:{}};new Function('require','module','__dirname',fs.readFileSync('electron/opd-print.cjs','utf8'))(name=>name==='electron'?{BrowserWindow:Window}:require(name),m,path.resolve('electron'));return{...m.exports,calls};
}
test('pharmacy receipts and medicine labels use distinct mapped printer roles',async()=>{
 const r=renderer(),owner={webContents:{getPrintersAsync:async()=>[{name:'Receipt'},{name:'Labels'}]}},terminal={registered:true,receipt_printer_address:'Receipt',label_printer_address:'Labels'};
 await r.printSlip({paper_width_mm:80,text:'server receipt',printer_role:'receipt'},terminal,{owner});
 await r.printSlip({paper_width_mm:50,text:'server directions and warnings',printer_role:'label'},terminal,{owner});
 assert.equal(r.calls[0].deviceName,'Receipt');assert.equal(r.calls[1].deviceName,'Labels');assert.equal(r.calls[1].pageSize.width,50000);
});
test('a registered missing label printer never falls back to receipt or pretends printing succeeded',async()=>{
 const r=renderer();await assert.rejects(r.printSlip({paper_width_mm:50,text:'server label',printer_role:'label'},{registered:true,receipt_printer_address:'Receipt'},{owner:{webContents:{getPrintersAsync:async()=>[{name:'Receipt'}]}}}),/No label printer/);assert.equal(r.calls.length,0);
});
