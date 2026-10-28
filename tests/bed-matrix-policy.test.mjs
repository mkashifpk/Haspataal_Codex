import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyBedStateEvent,bedAccess,bedStateBody,bedTargets,bedSnapshot,verifiedMatrixBed} from '../src/bed-matrix-policy.ts';
const j=JSON.parse(fs.readFileSync('docs/bed-matrix-live-2026-10-28.json'));
const get=n=>structuredClone(j.requests.find(x=>x.label===n).result.body.data);
const ward=get('create-demo-ward'),id=get('create-demo-beds')[0].bed_id;
const fresh=()=>get('initial-matrix'),bed=()=>fresh().beds.find(b=>b.bed_id===id);
test('actual deactivated-ward response cannot enable an unverified bed action',()=>{
 const matrix=get('cleanup-ward-hidden');assert(matrix.beds.some(b=>b.bed_id===id));assert(!matrix.wards.some(w=>w.ward_id===ward.ward_id));assert.equal(verifiedMatrixBed(matrix,id),undefined);assert.equal(verifiedMatrixBed(fresh(),id)?.bed_id,id);
});
test('service changes cannot move a reserved/occupied bed or bypass review',()=>{
 const b=bed();assert.deepEqual(bedStateBody(b,'OutOfService','  DEMO rail inspection  ',true),{state:'OutOfService',reason:'DEMO rail inspection'});
 for(const state of ['Reserved','Occupied']){const busy={...b,current_state:state};assert.deepEqual(bedTargets(busy),[]);assert.throws(()=>bedStateBody(busy,'OutOfService','DEMO',true),/no longer permits/);}
 for(const state of ['Available','Dirty','Cleaning'])assert.deepEqual(bedTargets({...b,current_state:state}),['OutOfService']);
 assert.deepEqual(bedTargets({...b,current_state:'OutOfService'}),['Available']);
 assert.throws(()=>bedStateBody(b,'OutOfService','DEMO',false),/Check the actual/);
 for(const reason of ['','x','x'.repeat(301)])assert.throws(()=>bedStateBody(b,'OutOfService',reason,true),/3–300/);
 assert.notEqual(bedSnapshot(b),bedSnapshot({...b,admission_id:123}));
});
test('committed event changes one tile and count, suppresses old occupant, then tolerates duplicate replay',()=>{
 const m=fresh(),b=m.beds.find(x=>x.bed_id===id);b.patient_name='DEMO previous occupant';b.mrn='DEMO';
 const e={created_at:new Date(Date.parse(b.state_changed_at)+1000).toISOString(),payload:{bed_id:id,ward_id:ward.ward_id,from_state:'Available',to_state:'OutOfService'}};
 const out=applyBedStateEvent(m,e),tile=out.beds.find(x=>x.bed_id===id),before=m.wards.find(x=>x.ward_id===ward.ward_id),after=out.wards.find(x=>x.ward_id===ward.ward_id);
 assert.equal(tile.current_state,'OutOfService');assert.equal(tile.patient_name,null);assert.equal(tile.mrn,null);assert.equal(after.available,before.available-1);assert.equal(after.out_of_service,before.out_of_service+1);assert.equal(out.summary[ward.name],after.available);
 assert.equal(m.beds.find(x=>x.bed_id===id).current_state,'Available');assert.equal(applyBedStateEvent(out,e),out);
 assert.equal(out.beds.find(x=>x.bed_id!==id),m.beds.find(x=>x.bed_id!==id));
});
test('unknown, malformed and older event hints never invent a bed or roll back a newer read',()=>{
 const m=fresh(),b=bed(),e={created_at:new Date(Date.parse(b.state_changed_at)-1000).toISOString(),payload:{bed_id:id,ward_id:ward.ward_id,from_state:'Available',to_state:'OutOfService'}};
 assert.equal(applyBedStateEvent(m,e),m);assert.equal(applyBedStateEvent(m,{payload:{...e.payload,bed_id:999999}}),m);assert.equal(applyBedStateEvent(m,{payload:{...e.payload,to_state:'made-up'}}),m);assert.equal(applyBedStateEvent(m,{payload:{...e.payload,from_state:'Reserved'}}),m);
});
test('bed access follows runtime service view and both permissions',()=>{
 const p=['ipd.bed.view','ipd.bed.manage'];for(const view of ['full','open_work'])assert.equal(bedAccess(view,p).manage,true);
 assert.deepEqual(bedAccess('records',p),{visible:true,read:true,manage:false});for(const view of ['hidden','setup',undefined])assert.equal(bedAccess(view,p).visible,false);
 assert.equal(bedAccess('full',['ipd.bed.view']).manage,false);assert.equal(bedAccess('full',['ipd.bed.manage']).read,false);
});
