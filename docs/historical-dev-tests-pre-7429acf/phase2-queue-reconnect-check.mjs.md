# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only business data; terminate the ACTUAL native WebSocket and observe real replay/resync.
import {session,expect} from './clinical-test-kit.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=await session('phase2-queue-reconnect-check','demo.doctor2'),p=s.p;
try{
 await s.nav('My live queue');
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path==='/api/v1/opd-queues/me'&&r.status===200)).toBe(true);
 await p.evaluate(()=>{window.queueStreamEvents=[];window.terminal.subscribe(e=>{if(e.type==='stream')window.queueStreamEvents.push({...e,received_at:Date.now()})})});
 const count=async()=>(await s.trace()).requests.filter(r=>r.path==='/api/v1/opd-queues/me').length;
 const before=await count();await p.waitForTimeout(5200);assert.equal(await count(),before);
 s.pass('Actual own queue read200; idle5.2 seconds causes no periodic queue polling');
 await s.app.evaluate(()=>{const WS=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('ws'),emit=WS.prototype.emit;globalThis.queueSocket=null;WS.prototype.emit=function(event,...args){if(event==='message')globalThis.queueSocket=this;return emit.call(this,event,...args)}});
 await expect.poll(()=>s.app.evaluate(()=>!!globalThis.queueSocket),{timeout:45000}).toBe(true);
 const disconnectedAt=Date.now();await s.app.evaluate(()=>globalThis.queueSocket.terminate());
 await expect.poll(()=>p.evaluate(()=>window.queueStreamEvents.some(e=>e.status==='Reconnecting'))).toBe(true);
 await expect.poll(()=>p.evaluate(()=>window.queueStreamEvents.some(e=>e.status==='Live'&&e.resync)),{timeout:45000}).toBe(true);
 await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path==='/api/v1/opd-queues/me'&&r.status===200&&r.started>=disconnectedAt)).toBe(true);
 s.j.stream=await p.evaluate(()=>window.queueStreamEvents);s.j.trace=await s.trace();assert.equal(s.j.trace.requests.filter(r=>r.method!=='GET').length,0);s.save();
 s.pass('Actual native socket termination reconnects/replays Live resync and rereads GET /opd-queues/me200 without Refresh, mock event or business POST');s.j.passed=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1}finally{await s.close();fs.copyFileSync('artifacts/phase2-queue-reconnect-check.json','docs/phase2-queue-reconnect-check-2026-10-24.json')}

```
