import {createRequire} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const {diagnosticHtml}=createRequire(import.meta.url)('../electron/diagnostic-print.cjs');
const lab=()=>({document_type:'lab_report',printer_role:'document',fields:{hospital:{name:'Synthetic hospital',phc_number:'Synthetic PHC'},patient_name:'<script>unsafe</script>',mrn:'DEMO-MRN',requisition_number:'DEMO-LAB',complete:false,results:[{code:'DEMO',test_name:'Synthetic test',rows:[{label:'Synthetic metric',value:'<img src=x>',unit:'unit',reference:'12 - 17',flag:'H'}],performed_stamp:{text:'Synthetic performer'},verified_stamp:{text:'Synthetic verifier'},is_correction:true,correction_reason:'Synthetic correction',performed_by_partner:'Synthetic partner'}]}});
test('diagnostic paper refuses a result without a verifier and an unreported imaging study',()=>{
 const p=lab();p.fields.results[0].verified_stamp=null;assert.throws(()=>diagnosticHtml(p,''),/unverified/);
 assert.throws(()=>diagnosticHtml({document_type:'imaging_report',printer_role:'document',fields:{hospital:{},order:{status:'Completed'}}},''),/reported/);
});
test('partial lab paper retains reference ranges, flags, both stamps, amendments and partner without executing markup',()=>{
 const html=diagnosticHtml(lab(),'');for(const marker of ['PARTIAL REPORT','12 - 17','>H<','Synthetic performer','Synthetic verifier','Synthetic correction','Synthetic partner','DEMO-MRN'])assert(html.includes(marker));assert(!html.includes('<script>unsafe'));assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('size:A4'));
});
test('Urdu diagnostic output bundles a font, keeps identifiers and preserves a reported author stamp',()=>{
 const p={document_type:'imaging_report',printer_role:'document',fields:{hospital:{},order:{status:'Reported',patient_name:'Synthetic',mrn:'DEMO-MRN',order_number:'DEMO-IMG',accession_number:'DEMO-ACC',report_text:'Synthetic report',reported_stamp:{text:'Synthetic radiologist'}}}};
 const html=diagnosticHtml(p,'SYNTHETICFONT','ur');assert(html.includes('dir="rtl"'));assert(html.includes('SYNTHETICFONT'));assert(html.includes('Synthetic radiologist'));assert(html.includes('DEMO-ACC'));
});
