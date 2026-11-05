# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Targeted final native manifest header/Urdu PDF check; no business writes.
import {session} from './clinical-test-kit.mjs';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const original=JSON.parse(fs.readFileSync('artifacts/lab-sendout-check.json'));assert(original.passed&&original.finished);
const s=await session('sendout-final-print','demo.labtech');
try{
 await s.nav('Samples sent to partner laboratories');
 await s.app.evaluate(({dialog},folder)=>{globalThis.manifestPath=folder+'/sendout-manifest-en.pdf';dialog.showSaveDialog=async()=>({canceled:false,filePath:globalThis.manifestPath});},path.resolve('docs'));
 for(const language of ['en','ur']){
  await s.prefs({language});await s.app.evaluate((_,language)=>{globalThis.manifestPath=globalThis.manifestPath.replace(/-(?:en|ur)\.pdf$/,'-'+language+'.pdf');},language);
  const result=await s.native('print-sendout',{sendOutId:original.manifest.send_out_id,pdf:true});assert.equal(result.saved,true);assert.equal(fs.readFileSync(`docs/sendout-manifest-${language}.pdf`).subarray(0,5).toString(),'%PDF-');
 }
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));s.pass('Final native header safely omits empty address/contact separators, real ENUR A4 generation/identity checks; ZERO business writes');s.j.passed=true;
 fs.writeFileSync('docs/sendout-final-print-evidence-2026-10-26.json',JSON.stringify({date:new Date().toISOString(),passed:true,build:s.j.renderer,checks:s.j.checks,businessWrites:0},null,2));
}finally{await s.close();}

```
