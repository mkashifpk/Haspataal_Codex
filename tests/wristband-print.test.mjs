import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{assertWristband,wristbandHtml}=require('../electron/wristband-print.cjs');
const actual=JSON.parse(fs.readFileSync('docs/wristbands-ui-evidence-2026-10-28.json')).runs[0].requests.find(r=>r.method==='POST'&&r.status===201).result.data.print;
test('actual fresh DEV band print rejects another patient, ID, role or missing machine code',()=>{
 assert.equal(assertWristband(actual,actual.fields.wristband_id,actual.fields.mrn).mrn,actual.fields.mrn);
 for(const bad of [{...actual,document_type:'opd_slip'},{...actual,printer_role:'receipt'},{...actual,barcode_svg:null},{...actual,qr_svg:null}])assert.throws(()=>assertWristband(bad,actual.fields.wristband_id,actual.fields.mrn));
 assert.throws(()=>assertWristband(actual,actual.fields.wristband_id+1,actual.fields.mrn));assert.throws(()=>assertWristband(actual,actual.fields.wristband_id,'POLICY-WRONG'));
});
test('band paper emphasises real recorded allergy, escapes names, and uses server codes in isolated image data',()=>{
 const html=wristbandHtml(actual,'font');assert(html.includes('DEMO synthetic penicillin allergy'));assert(html.includes('class="allergy"'));assert(html.includes('border:2px solid #a00000'));assert(html.includes(Buffer.from(actual.barcode_svg).toString('base64')));assert(html.includes(Buffer.from(actual.qr_svg).toString('base64')));assert(html.includes("default-src 'none'"));
 const special={...actual,fields:{...actual.fields,patient_name:'<script>evil()</script>',allergies:'<img src=x>'}};const safe=wristbandHtml(special,'font');assert(!safe.includes('<script>evil'));assert(safe.includes('&lt;script&gt;'));assert(!safe.includes('<img src=x>'));
});
