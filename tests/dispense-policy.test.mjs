import test from 'node:test';import assert from 'node:assert/strict';
import {dispenseQuantity, selectedDispenseLines, dispensingAllowed, dispenseSnapshot} from '../src/dispense-policy.ts';
test('dispense quantities reject malformed, missing, excess, stopped and queried lines',()=>{
 for(const x of ['', '-1','0','1e2','1x','Infinity'])assert.equal(dispenseQuantity(x),undefined);
 const p={prescription_id:1,items:[{prescription_item_id:9,item_status:'Active',qty_remaining:3,is_external:false}],queries:[]};
 assert.deepEqual(selectedDispenseLines(p,{9:'1.5'}),[{prescription_item_id:9,qty:'1.5'}]);
 for(const q of [{},{9:'4'},{9:'0'},{10:'1'}])assert.throws(()=>selectedDispenseLines(p,q));
 assert.throws(()=>selectedDispenseLines({...p,queries:[{status:'Open',prescription_item_id:null}]},{9:'1'}));
 assert.throws(()=>selectedDispenseLines({...p,items:[{...p.items[0],item_status:'Stopped'}]},{9:'1'}));
});
test('existing dispensing continues only with permission/full or open work/Active or Retiring',()=>{
 assert(dispensingAllowed(['pharmacy.dispense'],'open_work',[],['dispensing']));
 for(const view of ['records','hidden','setup',''])assert(!dispensingAllowed(['pharmacy.dispense'],view,['dispensing'],[]));
 assert(!dispensingAllowed([],'full',['dispensing'],[]));assert(!dispensingAllowed(['pharmacy.dispense'],'full',[],[]));
});
test('review identity changes with patient version, query status or medicine directions',()=>{
 const p={prescription_id:1,patient_id:2,row_version:1,items:[{dose_text:'original'}],queries:[]};
 const base=dispenseSnapshot(p,3);assert.notEqual(base,dispenseSnapshot(p,4));assert.notEqual(base,dispenseSnapshot({...p,queries:[{status:'Open'}]},3));assert.notEqual(base,dispenseSnapshot({...p,items:[{dose_text:'changed'}]},3));
});
