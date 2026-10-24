import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
// Execute the production helper and ApiError; no copied implementation.
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64');
const bridgeUrl=moduleUrl(fs.readFileSync(new URL('../src/bridge.ts',import.meta.url),'utf8'));
const bridge=await import(bridgeUrl);
const helper=await import(moduleUrl(fs.readFileSync(new URL('../src/patient-errors.ts',import.meta.url),'utf8').replace('"./bridge"',JSON.stringify(bridgeUrl))));
const refused=(code,status)=>new bridge.ApiError({ok:false,error:{code,message:'Localized or changed backend wording'},status});
test('patient PATCH distinguishes duplicate/type refusals from actual stale versions by error.code',()=>{
 for(const code of ['PATIENT_CNIC_EXISTS','PATIENT_UPMRN_EXISTS']){
  const error=refused(code,409);assert(helper.isDuplicatePatient(error));assert.equal(helper.patientEditNeedsReconcile(error),false);
 }
 assert.equal(helper.patientEditNeedsReconcile(refused('PATIENT_TYPE_TRANSITION_INVALID',422)),false);
 assert.equal(helper.patientEditNeedsReconcile(refused('VERSION_CONFLICT',409)),true);
 assert.equal(helper.patientEditNeedsReconcile(refused('VALIDATION_ERROR',422)),false);
});
test('unknown PATCH outcomes cannot be re-saved blindly even if the message resembles a definitive refusal',()=>{
 for(const status of [undefined,408,429,500,502])assert(helper.patientEditNeedsReconcile(refused('TERMINAL_ERROR',status)));
 assert(helper.patientEditNeedsReconcile(new Error('PATIENT_CNIC_EXISTS')));
 assert.equal(helper.isDuplicatePatient(new Error('PATIENT_UPMRN_EXISTS')),false);
});
