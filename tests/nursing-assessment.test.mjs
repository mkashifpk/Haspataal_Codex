import test from 'node:test';import assert from 'node:assert/strict';
import {bmiSuggestion,nutritionRisk,nursingWriteAllowed} from '../src/nursing-assessment-policy.ts';
test('contract BMI boundaries suggest a score without inventing missing or invalid measurements',()=>{
 assert.equal(bmiSuggestion('80','200').score,1);assert.equal(bmiSuggestion('74','200').score,1);assert.equal(bmiSuggestion('73','200').score,2);assert.equal(bmiSuggestion('81','200').score,0);
 for(const [w,h]of [['','170'],['60',''],['0','170'],['500','170'],['60','20'],['Infinity','170']])assert.equal(bmiSuggestion(w,h),undefined);
});
test('contract score totals require actual plan for medium/high and writes respect separate view/state/permission',()=>{
 assert.deepEqual(nutritionRisk([0,0,0]),{total:0,risk:'Low',needsPlan:false});assert.deepEqual(nutritionRisk([0,1,0]),{total:1,risk:'Medium',needsPlan:true});assert.deepEqual(nutritionRisk([2,2,2]),{total:6,risk:'High',needsPlan:true});
 for(const v of ['full','open_work'])assert(nursingWriteAllowed(v,'Admitted',['ipd.nursing_assessment.record']));
 for(const v of ['records','hidden','setup'])assert(!nursingWriteAllowed(v,'Admitted',['ipd.nursing_assessment.record']));
 for(const state of ['Cancelled','Discharged','BedReserved','AdmissionPending'])assert(!nursingWriteAllowed('full',state,['ipd.nursing_assessment.record']));assert(!nursingWriteAllowed('full','Admitted',['ipd.flowsheet.view']));
});
