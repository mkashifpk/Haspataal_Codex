import {test} from 'node:test';import assert from 'node:assert/strict';import {createBootstrapSeed} from '../src/bootstrap-seed.ts';
test('verified launcher snapshot can be consumed only once by its exact selected context',()=>{
 const seed=createBootstrapSeed(),snapshot={actual:'server response'};seed.offer('epoch1:user1:reception',snapshot);assert.equal(seed.take('epoch1:user1:reception'),snapshot);assert.equal(seed.take('epoch1:user1:reception'),undefined);
});
test('different users/sessions/workspaces and explicit clearing cannot reuse a bootstrap snapshot',()=>{
 for(const key of ['epoch2:user1:reception','epoch1:user2:reception','epoch1:user1:doctor']){const seed=createBootstrapSeed();seed.offer('epoch1:user1:reception',{});assert.equal(seed.take(key),undefined);assert.equal(seed.take('epoch1:user1:reception'),undefined)}
 const seed=createBootstrapSeed();seed.offer('a',{});seed.clear();assert.equal(seed.take('a'),undefined);
});
