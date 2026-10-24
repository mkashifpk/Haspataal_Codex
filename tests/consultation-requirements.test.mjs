import {test} from 'node:test';import assert from 'node:assert/strict';
import {consultationRequirements,consultationFieldMissing} from '../src/consultation-requirements.ts';
test('signing guidance follows explicit server applies flags and only OPD/follow-up',()=>{
 const rules=[{code:'consultation_requires_vco',applies:true},{code:'consultation_complete_record',applies:true}];
 for(const kind of ['OPD','FollowUp'])assert.deepEqual(consultationRequirements(kind,rules),{consent:true,completeRecord:true});
 for(const kind of ['ER','IPD','Procedure','CodeRed'])assert.deepEqual(consultationRequirements(kind,rules),{consent:false,completeRecord:false});
 assert.deepEqual(consultationRequirements('OPD',rules.map(r=>({...r,applies:false}))),{consent:false,completeRecord:false});
 assert.deepEqual(consultationRequirements('OPD',[{code:'unrelated_rule',applies:true}]),{consent:false,completeRecord:false});
 assert.deepEqual(consultationRequirements('OPD'),{consent:false,completeRecord:false});
});
test('missing complaint/history group marks its alternatives without marking unrelated controls',()=>{
 for(const group of ['complaint_or_history','chief_complaint_or_history','chief_complaint or history']){
  assert(consultationFieldMissing('chief_complaint',[group]));assert(consultationFieldMissing('history',[group]));assert(!consultationFieldMissing('diagnosis',[group]));
 }
 assert(consultationFieldMissing('examination',['/examination']));assert(!consultationFieldMissing('plan',['explanation']));
});
