import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {myBedsReadable,canCleanMyBed,myBedSnapshot,urgentBeds} from '../src/my-beds-policy.ts';
const require=createRequire(import.meta.url),{assertSummary,summaryHtml}=require('../electron/discharge-summary-print.cjs');
const bed={roster_id:24,bed_id:42,ward_id:11,admission_id:11,current_state:'Dirty',ward_name:'DEMO Ward',bed_label:'A',doses_due_next_hour:0};
test('cleaning requires eligible bed, own service view and separate permission; history remains readable',()=>{
 const ps=['ipd.flowsheet.record','ipd.bed.mark_cleaned'];
 for(const v of ['full','open_work'])assert(canCleanMyBed(bed,v,ps));
 for(const v of ['records','setup','hidden',undefined])assert(!canCleanMyBed(bed,v,ps));
 assert(myBedsReadable('records',ps));assert(!myBedsReadable('full',['ipd.bed.mark_cleaned']));
 for(const state of ['Occupied','Reserved','Available','OutOfService'])assert(!canCleanMyBed({...bed,current_state:state},'full',ps));
 assert(!canCleanMyBed(bed,'full',['ipd.flowsheet.record']));
 for(const change of [{admission_id:12},{roster_id:25},{bed_id:43},{ward_id:12},{current_state:'Available'}])assert.notEqual(myBedSnapshot(bed),myBedSnapshot({...bed,...change}));
});
test('urgency uses server overdue and dose counts without inventing a vitals threshold or dropping overnight duties',()=>{
 const rows=[{...bed,bed_id:1,admission_id:1,doses_due_next_hour:2},{...bed,bed_id:2,admission_id:2},{...bed,bed_id:3,admission_id:null}];
 assert.deepEqual(urgentBeds(rows,{2:true}).map(b=>b.bed_id),[2,1,3]);
 assert.equal(rows[0].bed_id,1);assert.equal(urgentBeds(rows,{}).length,3);
});
test('signed summary printing refuses cross-patient, changed version, draft and incorrect output channel',()=>{
 const p={document_type:'discharge_summary',printer_role:'document',paper_width_mm:210,fields:{hospital:{name:'DEMO'},admission:{admission_id:11,patient_id:10,mrn:'DEMO-MRN',patient_name:'DEMO <script>'},summary:{admission_id:11,patient_id:10,row_version:2,status:'Final',signed_at:'2026-10-29T15:00:00Z',discharge_medications:'Original',icd_terms:[]},corrections:[{field:'discharge_medications',correction_text:'Corrected & held',correction_reason:'DEMO',corrected_by_name:'DEMO Nurse',created_at:'DEMO'}]}};
 assertSummary(p,11,10,'DEMO-MRN',2);
 for(const args of [[12,10,'DEMO-MRN',2],[11,12,'DEMO-MRN',2],[11,10,'Other',2],[11,10,'DEMO-MRN',3]])assert.throws(()=>assertSummary(p,...args));
 for(const change of [{document_type:'prescription'},{printer_role:'receipt'},{paper_width_mm:80},{fields:{...p.fields,summary:{...p.fields.summary,status:'Draft'}}}])assert.throws(()=>assertSummary({...p,...change},11,10,'DEMO-MRN',2));
 const html=summaryHtml(p,'','ur');assert(html.includes('dir="rtl"'));assert(html.includes('DEMO &lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('Original'));assert(html.includes('Corrected &amp; held'));
});
