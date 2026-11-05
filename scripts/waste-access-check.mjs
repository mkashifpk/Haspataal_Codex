// Real DEV denied-account checks. Intents saved before requests; no accepted writes expected.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {session,expect} from './clinical-test-kit.mjs';
const file='artifacts/screen162/access.json',j={started:new Date().toISOString(),checks:[],intents:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();let s;
try{
 s=await session('screen162-denied','demo.reception');await expect(s.p.getByRole('navigation').getByRole('button',{name:'Hospital waste log',exact:true})).toHaveCount(0);
 for(const method of ['GET','POST']){const key=method==='POST'?crypto.randomUUID():undefined;const args={method,path:'/infection/waste',...(method==='POST'?{key,body:{category:'NonRisk',weight_kg:0.125,location:'SCN162 DENIED PROBE ONLY - MUST NOT SAVE'}}:{})};j.intents.push(args);save();const r=await s.p.evaluate(v=>window.terminal.call('api',v),args);assert.equal(r.ok,false);assert.equal(r.error.code,'PERMISSION_REQUIRED');j.checks.push({method,status:r.status,code:r.error.code,request_id:r.request_id});save();}
 const vendors=await s.native('api',{method:'GET',path:'/finance/vendors'});assert(Array.isArray(vendors));j.checks.push('Reception route absent; native GET/POST denied before HTTP; any-authenticated vendor directory read succeeds. No borrowed permissions.');j.passed=true;s.j.passed=true;s.save();save();
}catch(error){j.error=error.stack;if(s)j.trace=await s.trace();save();throw error;}finally{if(s)await s.close();j.finished=new Date().toISOString();save();}
console.log(JSON.stringify(j,null,2));
