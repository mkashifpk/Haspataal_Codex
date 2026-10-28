import test from "node:test";
import assert from "node:assert/strict";
import {refusalReadPath,isStateRefusal} from "../src/refusal-recovery.ts";
test("state refusals and absent PACS reread only the affected server record",()=>{
 for(const action of ["repeats","outsource","external-report","status","report"]) assert.equal(refusalReadPath("POST","/imaging/orders/714/"+action,"IMAGING_ORDER_STATE_INVALID"),"/imaging/orders/714");
 assert.equal(refusalReadPath("POST","/admissions/82/discharge/PharmacyClearance/clear","DISCHARGE_STAGE_IMMUTABLE"),"/admissions/82/discharge-status");
 assert.equal(refusalReadPath("POST","/admissions/82/discharge/PharmacyClearance/clear","DISCHARGE_STAGE_OUT_OF_ORDER"),"/admissions/82/discharge-status");
 assert.equal(refusalReadPath("POST","/imaging/orders/714/link-study","PACS_NOT_CONFIGURED"),"/imaging/orders/714");
 assert.equal(refusalReadPath("POST","/opd-queues/6/call","QUEUE_ENTRY_CLOSED"),"/opd-queues/me");
 assert.equal(refusalReadPath("POST","/lab/samples/6/receive","LAB_SAMPLE_STATE_INVALID","/lab/scan/OWN-BARCODE"),"/lab/scan/OWN-BARCODE");
 assert.equal(refusalReadPath("POST","/imaging/orders/714/status","VALIDATION_ERROR"),undefined);
 assert.equal(refusalReadPath("POST","/imaging/orders/714/status","message says state invalid"),undefined);
 assert.equal(isStateRefusal("IMAGING_ORDER_STATE_INVALID"),true);
 assert.equal(refusalReadPath("POST","/rosters/swaps/2/approve","SWAP_DUTY_STARTED","/rosters/swaps?status=Accepted"),"/rosters/swaps");
 assert.equal(refusalReadPath("PATCH","/rosters/2","ROSTER_ENTRY_CANCELLED","/rosters?date_from=2026-11-10"),"/rosters?date_from=2026-11-10&include_cancelled=true");
});
test("a missing record identifier never becomes a guessed recovery URL",()=>{
 assert.equal(refusalReadPath("POST","/lab/results/9/verify","LAB_RESULT_STATE_INVALID"),undefined);
});
