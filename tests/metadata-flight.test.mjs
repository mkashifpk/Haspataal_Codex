import {test} from 'node:test';import assert from 'node:assert/strict';import {createMetadataFlight} from '../src/metadata-flight.ts';
test('overlapping login and socket refreshes share only their exact metadata context',async()=>{
 const refresh=createMetadataFlight();let release,calls=0;const read=async()=>{calls++;await new Promise(r=>release=r)};
 const first=refresh('session1:reception',read),second=refresh('session1:reception',read);assert.equal(first,second);await Promise.resolve();assert.equal(calls,1);release();await first;
 await refresh('session1:reception',async()=>{calls++});assert.equal(calls,2,'Successful completion is not a stale cache');
});
test('workspace/session changes do not share data and failed reads remain retryable',async()=>{
 const refresh=createMetadataFlight();let calls=0;
 await Promise.all(['epoch1:reception','epoch1:doctor','epoch2:reception'].map(k=>refresh(k,async()=>{calls++})));assert.equal(calls,3);
 await assert.rejects(refresh('retry',async()=>{throw Error('real read failure')}),/real read failure/);
 await refresh('retry',async()=>{calls++});assert.equal(calls,4);
});
