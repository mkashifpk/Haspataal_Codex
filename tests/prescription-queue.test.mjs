import test from 'node:test';
import assert from 'node:assert/strict';
import {prescriptionQueueAccess as access} from '../src/prescription-queue-policy.ts';
test('pharmacy queue and prescription details require independent permissions',()=>{
 assert.deepEqual(access(['pharmacy.queue.view'],'full'),{visible:true,list:true,detail:false});
 assert.deepEqual(access(['prescription.view'],'full'),{visible:true,list:false,detail:true});
 assert.deepEqual(access([],'full'),{visible:true,list:false,detail:false});
});
test('retiring retains reads; records suppress pending work; hidden/setup/unknown deny both reads',()=>{
 const p=['pharmacy.queue.view','prescription.view'];
 assert.deepEqual(access(p,'open_work'),{visible:true,list:true,detail:true});
 assert.deepEqual(access(p,'records'),{visible:true,list:false,detail:true});
 for(const v of ['hidden','setup','', 'future'])assert.deepEqual(access(p,v),{visible:false,list:false,detail:false});
});
