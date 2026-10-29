import test from 'node:test';
import assert from 'node:assert/strict';
import {vitalBody,vitalFields,flowsheetWritable,scheduleSnapshot} from '../src/vitals-policy.ts';
test('actual measurement boundaries, blank null and zero pain remain distinct',()=>{
 assert.equal(vitalBody({pain_score:'0'}).pain_score,0);
 assert.equal(vitalBody({}).heart_rate,null);
 for(const [key,,,min,max,whole] of vitalFields){
  assert.equal(vitalBody({[key]:String(min)})[key],min);assert.equal(vitalBody({[key]:String(max)})[key],max);
  for(const value of [String(min-1),String(max+1),'NaN','Infinity'])assert.throws(()=>vitalBody({[key]:value}));
  if(whole)assert.throws(()=>vitalBody({[key]:String(min+.5)}));
 }
});
test('records allow corrections but no new readings; doctor schedule permission is independent',()=>{
 const nurse=['ipd.flowsheet.record'];
 for(const state of ['Admitted','DischargeInProgress','CodeRedActive'])assert(flowsheetWritable('open_work',state,nurse));
 for(const state of ['AdmissionPending','BedReserved','Cancelled','Discharged'])assert(!flowsheetWritable('full',state,nurse));
 assert(flowsheetWritable('records','Discharged',nurse,false,true));assert(!flowsheetWritable('records','Admitted',nurse));
 for(const view of ['hidden','setup'])assert(!flowsheetWritable(view,'Admitted',nurse,false,true));
 assert(flowsheetWritable('full','Admitted',['ipd.admission.request'],true));assert(!flowsheetWritable('full','Admitted',['ipd.admission.request']));
 assert(!flowsheetWritable('full','Admitted',[],true));
});
test('schedule preflight notices replacement, activation, interval or version changes',()=>{
 const s={schedule_id:1,row_version:1,interval_minutes:240,is_active:true};
 for(const c of [{schedule_id:2},{row_version:2},{interval_minutes:15},{is_active:false}])assert.notEqual(scheduleSnapshot(s),scheduleSnapshot({...s,...c}));
 assert.notEqual(scheduleSnapshot(null),scheduleSnapshot(s));
});
