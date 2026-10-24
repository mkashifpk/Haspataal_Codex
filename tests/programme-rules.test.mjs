import {test} from 'node:test';import assert from 'node:assert/strict';
import {programmeWork,programmeEntryIssues} from '../src/programme-rules.ts';
test('Retiring forbids new enrolment but preserves a service for an enrolment started before retirement',()=>{
 const before=programmeWork('Retiring',true,false,true,'2026-10-01T10:00:00Z','2026-10-20T10:00:00Z');assert.equal(before.enrol,false);assert.equal(before.entry,true);assert.equal(before.close,true);
 assert.equal(programmeWork('Retiring',true,false,true,'2026-10-21T10:00:00Z','2026-10-20T10:00:00Z').entry,false);
 assert.equal(programmeWork('Available',true,false,true).enrol,false);assert.equal(programmeWork('Active',true,true,true).entry,false);assert.equal(programmeWork('Active',true,false,false).entry,false);
});
test('Programme entries refuse future timestamps, an unlisted service and a card date before the given local date',()=>{
 const input={service:'Synthetic card service',given_at:'2026-10-23T10:00:00Z',next_due_on:'2026-10-22'};
 assert.deepEqual(programmeEntryIssues(input,['Synthetic card service'],'2026-10-23T09:00:00Z','2026-10-23'),['given_at','next_due_on']);
 assert.deepEqual(programmeEntryIssues({...input,service:'Guessed service',next_due_on:'2026-10-24'},['Synthetic card service'],'2026-10-23T11:00:00Z','2026-10-23'),['service']);
});
test('Card dates are validated without computing a replacement schedule or filling a missing date',()=>{
 const input={service:'Synthetic card service',given_at:'2026-10-23T10:00:00Z',next_due_on:null};
 assert.deepEqual(programmeEntryIssues(input,['Synthetic card service'],'2026-10-23T11:00:00Z','2026-10-23'),[]);assert.equal(input.next_due_on,null);
 assert.deepEqual(programmeEntryIssues({...input,next_due_on:'2026-02-31'},['Synthetic card service'],'2026-10-23T11:00:00Z','2026-01-01'),['next_due_on']);
});
