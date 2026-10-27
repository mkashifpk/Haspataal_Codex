// Read-only role-boundary test; disallowed native requests must stop before HTTP.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const evidence={started:new Date().toISOString(),checks:[]};
for(const account of ['demo.cashier','demo.doctor']){
 let s;
 try{
  s=await session('radiology-access-'+account.replace('.','-'),account);
  await expect(s.p.getByRole('navigation').getByRole('button',{name:'Imaging worklist',exact:true})).toHaveCount(0);
  const r=await s.p.evaluate(()=>window.terminal.call('api',{method:'POST',path:'/imaging/orders/4/status',body:{status:'InProgress'}}));
  assert.equal(r.ok,false);assert.equal(r.error.code,'PERMISSION_REQUIRED');
  assert.equal((await s.trace()).requests.filter(x=>x.method==='POST').length,0);
  evidence.checks.push({account,no_radiology_menu:true,native_write_refused_before_http:true,renderer:s.j.renderer});
 }finally{if(s)await s.close();}
}
evidence.passed=true;evidence.finished=new Date().toISOString();fs.writeFileSync('artifacts/radiology-worklist-access.json',JSON.stringify(evidence,null,2));console.log('PASS cashier/doctor metadata-scope menus and native write denial; zero business writes');
