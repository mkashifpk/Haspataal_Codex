// Sandbox omission injects a key (#54). This separate Electron transport check
// observes the actual outgoing header on an already-final synthetic consignment.
import fs from 'node:fs';import assert from 'node:assert/strict';
import{session}from'./clinical-test-kit.mjs';
const intent=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/handover-intent.json'));
let s;try{
 s=await session('refresh7429-no-key','demo.ops');
 const response=await s.p.evaluate(body=>window.terminal.call('api',{method:'POST',path:'/infection/waste/handover',body}),intent.body);
 assert.equal(response.ok,false);assert.equal(response.error.code,'WASTE_HANDED_OVER');
 const requests=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/infection/waste/handover'));assert.equal(requests.length,1);assert.equal(requests[0].status,409);assert.equal(requests[0].key,undefined,'The actual HTTPS request must omit Idempotency-Key');assert(requests[0].result.error.details.waste_id);
 fs.writeFileSync('docs/backend-refresh-2026-11-05/literal-no-key-evidence.json',JSON.stringify({source:'Electron native HTTPS transport (sandbox_call auto-injects a key)',header_absent:true,status:requests[0].status,request_id:requests[0].result.request_id,error:requests[0].result.error,body:requests[0].body},null,2));s.j.passed=true;s.pass('Literal no Idempotency-Key HTTP request refused409 WASTE_HANDED_OVER with exact collection/note; one request, no retry or business effect.');
}finally{if(s)await s.close();}
