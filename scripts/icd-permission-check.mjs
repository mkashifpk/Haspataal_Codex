// ICD catalogue is available to any signed-in role, never to an anonymous terminal.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {session,expect} from './clinical-test-kit.mjs';
const s=await session('icd-permission','demo.reception'),p=s.p;
try{
 await s.nav('ICD code picker');await expect(p.getByLabel('Code prefix or diagnosis words',{exact:true})).toBeVisible();const releases=await s.native('api',{method:'GET',path:'/icd/releases'});assert(releases.coding_system);
 // Restore the actual signed-in preferences before ending authentication.
 await s.prefs(s.original);const strip=({updated_at,...v})=>v;assert.deepEqual(strip((await s.native('state')).prefs),strip(s.original));s.original=undefined;
 await s.native('logout');await expect(p.getByRole('button',{name:'Sign in →',exact:true})).toBeVisible();await expect(p.getByRole('navigation')).toHaveCount(0);assert(!(await s.native('state')).user);
 const before=(await s.trace()).requests.length;const denied=await p.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/icd/releases'}));assert.equal(denied.ok,false);assert.equal((await s.trace()).requests.length,before);s.j.local_denial={code:denied.error?.code,message:denied.error?.message};
 const {request,checkedRoot}=createRequire(import.meta.url)('../electron/transport.cjs'),cfg=JSON.parse(fs.readFileSync('.dev-terminal.json'));const response=await request(cfg.server_urls[0]+'/api/v1/icd/releases',{ca:checkedRoot(cfg.ca_pem,cfg.ca_fingerprint_sha256),method:'GET',headers:{'X-Haspataal-Developer':'mkashif','X-Haspataal-Implementation':'1'}});assert.equal(response.status,401);s.j.anonymous_http={status:response.status,code:response.body?.error?.code,request_id:response.body?.request_id};
 assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);s.pass('Reception (nonclinical role) may read ICD; logout removes catalogue navigation, native API denies before transport, anonymous real server GET401; no business writes, preferences restored before logout');s.j.passed=true;s.save();
}catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1;}
finally{await s.close();fs.writeFileSync('docs/icd-permission-evidence-2026-10-25.json',JSON.stringify(s.j,null,2));}
