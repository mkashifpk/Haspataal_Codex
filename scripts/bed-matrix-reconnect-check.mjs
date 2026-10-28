// Disconnect only this test window's real socket; no fabricated events or business writes.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const file='artifacts/bed-matrix-reconnect-check.json';assert(!fs.existsSync(file),'Reconcile previous reconnect check');
const f=JSON.parse(fs.readFileSync('docs/bed-matrix-live-2026-10-28.json')),ward=f.requests.find(x=>x.label==='create-demo-ward').result.body.data;
let s;const j={run:f.run,passed:false},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
try{
 s=await session('bed-matrix-reconnect-actor','demo.admissions');const p=s.p;await s.nav('Live bed matrix');await p.getByLabel('Ward to show',{exact:true}).selectOption(String(ward.ward_id));await expect(p.getByTestId('bed-ward-'+ward.ward_id)).toBeVisible();
 await s.app.evaluate(async()=>{const taskRequire=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json');const W=taskRequire('ws'),old=W.prototype.emit;globalThis.__bedSocket=null;W.prototype.emit=function(type,...args){if(type==='message'&&String(this.url).includes('/ws/v1/events'))globalThis.__bedSocket=this;return old.call(this,type,...args)};globalThis.__bedSocketRestore=()=>{W.prototype.emit=old};});
 // The documented server heartbeat supplies an actual message within25seconds.
 await expect.poll(()=>s.app.evaluate(()=>!!globalThis.__bedSocket),{timeout:45000}).toBe(true);
 await p.evaluate(()=>{globalThis.__bedStream=[];window.terminal.subscribe(e=>{if(e.type==='stream')globalThis.__bedStream.push({status:e.status,resync:e.resync})})});
 const before=(await s.trace()).requests.filter(x=>x.method==='GET'&&x.path.includes('/beds/matrix')).length;j.intent='Terminate this actor socket after real heartbeat; await actual reconnect/resync';save();
 await s.app.evaluate(()=>globalThis.__bedSocket.terminate());
 await expect.poll(()=>p.evaluate(()=>globalThis.__bedStream.some(x=>x.status==='Live'&&x.resync)),{timeout:45000}).toBe(true);
 await expect.poll(async()=>(await s.trace()).requests.filter(x=>x.method==='GET'&&x.path.includes('/beds/matrix')).length).toBeGreaterThan(before);await expect(p.getByTestId('bed-ward-'+ward.ward_id)).toBeVisible();
 j.stream=await p.evaluate(()=>globalThis.__bedStream);assert(j.stream.some(x=>x.status==='Reconnecting'));j.trace=await s.trace();assert.equal(j.trace.requests.filter(x=>x.method!=='GET').length,0);j.renderer=s.j.renderer;j.passed=true;j.checks=['Actual socket loss reportedReconnecting','Actual resumed Live/resync rereads full matrix','Same ward/selection/filter retained; no business writes'];save();console.log('PASS '+j.checks.join('\nPASS '));
}catch(e){j.error=e.stack;save();console.error(e.stack);process.exitCode=1;}
finally{if(s){await s.app.evaluate(()=>globalThis.__bedSocketRestore?.()).catch(()=>{});await s.close()}j.finished=new Date().toISOString();save();}
