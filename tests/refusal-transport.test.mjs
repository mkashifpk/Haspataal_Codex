import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {stripTypeScriptTypes} from "node:module";
const source=fs.readFileSync(new URL("../src/bridge.ts",import.meta.url),"utf8").replace('"./refusal-recovery"',JSON.stringify(new URL("../src/refusal-recovery.ts",import.meta.url).href));
const {api,ApiError,resetRequests}=await import("data:text/javascript;base64,"+Buffer.from(stripTypeScriptTypes(source,{mode:"transform"})).toString("base64"));
const journal=JSON.parse(fs.readFileSync(new URL("../docs/backend-refresh-live-evidence-2026-10-28.json",import.meta.url)));
const record=name=>journal.requests.find(x=>x.label===name).result;
test("real saved PACS refusal triggers one read, preserves original error/key/body and never replays",async()=>{
 const r=record("no-pacs"),read=record("after-no-pacs"),calls=[];
 globalThis.window={terminal:{call:async(action,args)=>{calls.push(args);return args.method==="GET"?{ok:true,data:read.body.data}:{ok:false,error:r.body.error,status:r.status,request_id:r.request_id};}}};
 const draft={};const original=structuredClone(draft);
 await assert.rejects(api("POST",r.request.path.replace("/api/v1",""),draft,{key:"UNIT-ONLY-NOT-SENT"}),e=>e instanceof ApiError&&e.response.error.code==="PACS_NOT_CONFIGURED"&&e.response.recovery.data.status==="Ordered"&&e.response.request_id===r.request_id);
 assert.deepEqual(draft,original);assert.equal(calls.length,2);assert.equal(calls[0].method,"POST");assert.equal(calls[1].method,"GET");assert.equal(calls[0].key,"UNIT-ONLY-NOT-SENT");resetRequests();delete globalThis.window;
});
test("repeat clearance shows actual cleared officer/time; failed reread preserves refusal without another write",async()=>{
 const r=record("pharmacy-clear-repeat"),read=record("discharge-current");let n=0;
 globalThis.window={terminal:{call:async(a,args)=>{n++;return args.method==="GET"?{ok:true,data:read.body.data}:{ok:false,error:r.body.error,status:r.status};}}};
 await assert.rejects(api("POST",r.request.path.replace("/api/v1",""),{note:"unsent note"}),e=>e.response.recovery.data.stages.some(s=>s.stage==="PharmacyClearance"&&s.status==="Cleared"&&s.cleared_by_name&&s.cleared_at));
 assert.equal(n,2);
 globalThis.window.terminal.call=async(a,args)=>args.method==="GET"?{ok:false,status:503,error:{code:"UNAVAILABLE",message:"read unavailable"}}:{ok:false,error:r.body.error,status:r.status};
 await assert.rejects(api("POST",r.request.path.replace("/api/v1",""),{note:"keep me"}),e=>e.response.error.code==="DISCHARGE_STAGE_IMMUTABLE"&&e.response.recovery.error==="read unavailable");resetRequests();delete globalThis.window;
});

test("actual imaging state refusals use one original-order GET and retain the caller's draft",async()=>{
 for(const name of ["repeat-before-start","outsource-completed-refusal","partner-report-not-outsourced-refusal"]){
  const r=record(name),read=record("outsource-refusal-current-order"),calls=[];const draft=structuredClone(r.request.body);
  globalThis.window={terminal:{call:async(a,args)=>{calls.push(args);return args.method==="GET"?{ok:true,data:read.body.data}:{ok:false,error:r.body.error,status:r.status};}}};
  await assert.rejects(api("POST",r.request.path.replace("/api/v1",""),draft),e=>e.response.error.code==="IMAGING_ORDER_STATE_INVALID"&&e.response.recovery.data.status==="Completed");
  assert.deepEqual(draft,r.request.body);assert.equal(calls.length,2);assert.equal(calls[1].path,"/imaging/orders/1");resetRequests();
 }delete globalThis.window;
});
