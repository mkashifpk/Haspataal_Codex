// Real multi-role bootstrap/switch/reopen/new-window regression. No business writes.
import {session,expect} from './clinical-test-kit.mjs';import assert from 'node:assert/strict';
const s=await session('workspace-bootstrap-check','demo.owner'),p=s.p;let child;
try{
 await expect(p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();const state=await s.native('state');const allowed=state.user.workspaces;assert(!allowed.some(w=>w.code==='reception'));
 for(const code of ['owner_dashboard','doctor','doctor']){
  if(!(await p.getByRole('heading',{name:'Where are you working today?',exact:true}).count()))await s.nav('Workspaces');const w=allowed.find(w=>w.code===code);assert(w);await p.locator('.workspace-card').filter({has:p.getByRole('heading',{name:w.label,exact:true})}).getByRole('button',{name:'Open workspace →',exact:true}).click();
  await expect(p.getByText('READY FOR YOUR NEXT TASK',{exact:true})).toBeVisible();await expect(p.locator('.header-context')).toContainText(w.label);await expect(p.getByRole('navigation').getByRole('button',{name:code==='doctor'?'My live queue':'Outstanding dues (Udhaar)',exact:false})).toBeVisible();assert.equal((await s.native('state')).workspace,code);assert.equal(await p.getByRole('navigation').getByRole('button',{name:'New registration + OPD slip',exact:false}).count(),0);
 }
 s.pass('Multi-role picker, Owner->Doctor switch and same-Doctor reopen publish complete authorized context; no Reception route leaked');
 await s.nav('Workspaces');const waiting=s.app.waitForEvent('window');await p.locator('.workspace-card').filter({has:p.getByRole('heading',{name:allowed.find(w=>w.code==='owner_dashboard').label,exact:true})}).getByRole('button',{name:'Open in new window',exact:true}).click();child=await waiting;await expect(child.getByText('READY FOR YOUR NEXT TASK',{exact:true})).toBeVisible();await expect(child.getByRole('navigation').getByRole('button',{name:'Outstanding dues (Udhaar)',exact:false})).toBeVisible();assert.equal((await s.native('state')).workspace,'doctor');await child.close();child=null;
 assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);s.pass('Separate Owner window initializes its own ready metadata; parent remains Doctor; ZERO business writes');s.j.passed=true;
}catch(e){s.j.error=e.stack;s.j.ui=await p.locator('body').innerText();console.error(e.stack);process.exitCode=1}finally{if(child&&!child.isClosed())await child.close();await s.close()}
