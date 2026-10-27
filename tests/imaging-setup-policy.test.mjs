import test from 'node:test';import assert from 'node:assert/strict';
import {targetInput,findingInput,imagingSetupAccess,targetSnapshot,findingSnapshot} from '../src/imaging-setup-policy.ts';
const draft={routine_perform_minutes:'120',routine_report_minutes:'720',emergency_perform_minutes:'30',emergency_report_minutes:'45'};
test('imaging targets reject malformed/nonpositive/out-of-range minutes and emergency inversions',()=>{
 assert.deepEqual(targetInput(draft),{routine_perform_minutes:120,routine_report_minutes:720,emergency_perform_minutes:30,emergency_report_minutes:45});
 for(const value of ['','0','-1','1.5','1e2','Infinity','43201'])assert.throws(()=>targetInput({...draft,routine_perform_minutes:value}));
 assert.throws(()=>targetInput({...draft,emergency_perform_minutes:'121'}));assert.throws(()=>targetInput({...draft,emergency_report_minutes:'721'}));
});
test('finding editor sends real null clears and preserves bounded order/name contracts',()=>{
 assert.deepEqual(findingInput(' DEMO finding ','',' ','0'),{name:'DEMO finding',modality:null,description:null,sort_order:0});
 for(const order of ['','-1','1.1','1e3','10001'])assert.throws(()=>findingInput('DEMO finding','CT','',order));
 assert.throws(()=>findingInput('ab','','','100'));assert.throws(()=>findingInput('abc','unsupported','','100'));assert.throws(()=>findingInput('abc','','x'.repeat(501),'100'));
});
test('service setup is Facility-only; Records prevents new entries and permission never follows role names',()=>{
 const p=['diagnostics.setup.manage'];assert.deepEqual(imagingSetupAccess('setup',p),{visible:false,manage:false,create:false});assert(imagingSetupAccess('setup',p,true).create);
 assert(imagingSetupAccess('full',p).create);assert(imagingSetupAccess('open_work',p).create);assert.equal(imagingSetupAccess('records',p).create,false);assert(imagingSetupAccess('records',p).manage);
 for(const mode of ['hidden','unknown',''])assert(!imagingSetupAccess(mode,p,true).visible);assert(!imagingSetupAccess('full',[]).manage);
});
test('review snapshots detect concurrent version, active, clear and target changes without guessing identity',()=>{
 const target={modality:'Other',row_version:3,routine_perform_minutes:120,routine_report_minutes:720,emergency_perform_minutes:30,emergency_report_minutes:45};assert.notEqual(targetSnapshot(target),targetSnapshot({...target,row_version:4}));assert.notEqual(targetSnapshot(target),targetSnapshot({...target,routine_perform_minutes:121}));
 const finding={finding_id:7,row_version:2,name:'DEMO finding',modality:'CT',description:'setup only',sort_order:100,is_active:true};for(const patch of [{row_version:3},{modality:null},{description:null},{is_active:false},{finding_id:8}])assert.notEqual(findingSnapshot(finding),findingSnapshot({...finding,...patch}));
});
