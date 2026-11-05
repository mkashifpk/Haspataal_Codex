// Real DEV: upload one synthetic report, retry its lost reply, then attach its
// returned document_id to the fresh MLC case. Never creates another patient/case.
import fs from 'node:fs';import assert from 'node:assert/strict';
import{session,expect,help}from'./clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/doc-mlc-result.json')).body.data;
const file='artifacts/refresh-7429acf-documents.json';assert(!fs.existsSync(file),'Reconcile the saved document journal; never repeat an uncertain upload/attachment.');
const j={patient_id:fixture.patient_id,mlc_id:fixture.mlc_id,checks:[],pending:null},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const stream='BT /F1 16 Tf 72 720 Td (SYNTHETIC SOFTWARE TEST ONLY - NO ACTUAL MLR) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
let s;try{
 s=await session('refresh7429-documents','demo.triage');j.renderer=s.j.renderer;save();await s.p.getByRole('navigation').locator('[data-screen-target="mlc_cases"]').click();const main=s.p.locator('#content');
 await main.getByRole('row').filter({hasText:fixture.mlc_number}).getByRole('button',{name:/View/}).click();
 const upload=main.locator('input[type="file"][data-help="mlc_cases.input_mlr_note"]');await expect(upload).toBeVisible();await upload.setInputFiles({name:'SYNTHETIC-MLR-7429acf.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});
 await help(s,upload,'Medico-legal cases');
 j.pending={action:'Upload synthetic MedicoLegalReport, intentionally lose committed reply'};save();await s.fault({failPath:`/patients/${fixture.patient_id}/documents`,failMethod:'POST',once:true});
 await main.getByRole('button',{name:'Upload this scan',exact:true}).click();const retry=main.getByRole('button',{name:'Retry original scan upload',exact:true});await expect(retry).toBeEnabled();await expect(main.locator('[data-help="mlc_cases.btn_update_mlr"]')).toBeDisabled();await retry.click();await expect(main.getByText('Upload saved.',{exact:false})).toBeVisible();
 const uploads=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith(`/patients/${fixture.patient_id}/documents`));assert.equal(uploads.length,2);assert.equal(uploads[0].key,uploads[1].key);assert.equal(uploads[1].replay,'true');assert.equal(uploads[0].result.data.doc_type,'MedicoLegalReport');j.document_id=uploads[0].result.data.document_id;j.upload_request_ids=uploads.map(r=>r.result.request_id);j.pending=null;save();
 const before=(await s.trace()).requests;assert(!before.some(r=>r.method==='POST'&&r.path.endsWith('/mlc/cases')),'Upload must not register a second case');assert(!before.some(r=>r.method==='PATCH'&&r.path.endsWith(`/mlc/cases/${fixture.mlc_id}`)),'Upload button must not submit the parent form');
 j.pending={action:'Attach confirmed document to existing case without issuing an MLR',document_id:j.document_id};save();await main.locator('[data-help="mlc_cases.btn_update_mlr"]').click();
 await expect.poll(async()=>{const data=await s.native('api',{method:'GET',path:`/mlc/cases/${fixture.mlc_id}`});j.current=data;save();return data.mlr_document_id;}).toBe(j.document_id);assert.equal(j.current.mlr_status,'Pending');j.pending=null;j.checks.push('Synthetic scan201; lost reply replay with identical key/one document; main record not submitted by upload button; original case PATCH attaches returned document_id and preserves Pending status; F1/file focus and upload hold verified.');j.passed=true;s.j.passed=true;save();
}catch(error){j.error=error.stack;save();throw error;}finally{if(s)await s.close();}
console.log('PASS fresh MLC document upload/replay/separate attachment');
