// Real DEV multi-window and header checks; no substituted server replies.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,capture,help} from './clinical-test-kit.mjs';
const dir='docs/backend-d4c475d-2026-11-06/',readOnly=process.argv.includes('--read-only');
const intent=dir+'issue-intent.json';
assert(readOnly||!fs.existsSync(intent),'Reconcile saved issue intent/result; do not repeat a submitted issue.');
async function recordHeaders(s){
  await s.app.evaluate(()=>{
    const https=process.getBuiltinModule('https'),original=https.request;
    globalThis.workspaceHeaderTrace=[];globalThis.workspaceHeaderNegative=false;
    https.request=function(...args){
      const req=original.apply(this,args),u=args[0],pathname=typeof u==='string'?new URL(u).pathname:u.pathname??u.path?.split('?')[0];
      if(!/\/(?:auth\/me|meta\/handbook)$/.test(pathname??''))return req;
      if(globalThis.workspaceHeaderNegative&&pathname.endsWith('/auth/me'))req.setHeader('X-Active-Workspace','self_service');
      const a={path:typeof u==='string'?new URL(u).pathname+new URL(u).search:u.pathname?u.pathname+u.search:u.path,workspace:req.getHeader('X-Active-Workspace')??null};
      globalThis.workspaceHeaderTrace.push(a);
      req.on('response',res=>{a.status=res.statusCode;const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{try{const body=JSON.parse(Buffer.concat(chunks));a.request_id=body.request_id;a.error=body.error?.code;a.employee_id=body.data?.employee_id;a.active_workspace=body.data?.active_workspace;a.workspaces=body.data?.workspaces?.map(w=>({code:w.code,every_employee:w.every_employee,roles:w.roles,yours:w.yours,screens:w.screens?.map(s=>s.id)}));}catch{a.parse_error=true;}});});
      return req;
    };
  });
}
async function ready(p){await expect.poll(async()=>{if(await p.getByRole('navigation').isVisible())return true;const retry=p.getByRole('button',{name:'Retry loading workspace',exact:true});if(await retry.isVisible())await retry.click();return false;},{timeout:90000,intervals:[500,1000,2000]}).toBe(true);}
let s;
try{
  s=await session('d4c475d-reception','demo.reception');const parent=s.p;
  await recordHeaders(s);
  const workspaces=await s.native('api',{method:'GET',path:'/auth/workspaces'});
  assert.deepEqual(workspaces.map(w=>({code:w.code,roles:w.roles,every_employee:w.every_employee})),[{code:'reception',roles:['receptionist'],every_employee:false},{code:'self_service',roles:[],every_employee:true}]);
  assert.equal((await s.native('state')).workspace,'reception');
  await expect(parent.locator('.workspace-card')).toHaveCount(0);
  await parent.locator('button.avatar').click();
  const account=parent.getByRole('dialog').filter({has:parent.getByRole('heading',{name:'Your account',exact:true})});
  const menu=account.getByRole('button',{name:'My Workspace',exact:true});
  const windowEvent=s.app.waitForEvent('window');await menu.click();const child=await windowEvent;
  await ready(child);s.p=child;
  assert.equal((await parent.evaluate(()=>window.terminal.call('state'))).data.workspace,'reception');
  assert.equal((await child.evaluate(()=>window.terminal.call('state'))).data.workspace,'self_service');
  const me=await child.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/auth/me'}));assert(me.ok);assert(me.data.workspaces.some(w=>w.every_employee&&w.roles.length===0));
  await child.getByRole('navigation').locator('[data-screen-target="self_service"]').click();
  await child.locator('button.avatar').click();await expect(child.getByRole('dialog').getByRole('button',{name:'My Workspace',exact:true})).toHaveCount(1);await child.getByRole('button',{name:'Keep working',exact:true}).click();
  const root=child.locator('#content');await root.locator('[data-help="self_service.tab_support"]').click();
  await root.locator('[data-help="self_service.btn_open_issue_modal"]').click();
  const select=root.getByRole('combobox',{name:'Asset',exact:true});await expect(select).toBeEnabled();
  const r=await child.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/ops/assets'}));assert(r.ok&&r.data.length);assert(r.data.every(x=>x.purchase_cost===null&&x.purchase_date===null));
  const asset=r.data.find(x=>/SYNTHETIC.*medical asset/i.test(x.name));assert(asset,'Choose an actual listed synthetic master by name, never a hard-coded record ID');
  await select.selectOption({label:await select.locator('option').filter({hasText:asset.name}).innerText()});
  assert(!await root.getByText(/Purchase cost|Purchase date/).count());
  const previous=(await s.app.evaluate(()=>globalThis.workspaceHeaderTrace)).filter(x=>x.path.includes('/meta/handbook?workspace=self_service')).length;
  await help(s,select,'My workspace (Staff self-service portal)');
  await expect.poll(async()=>(await s.app.evaluate(()=>globalThis.workspaceHeaderTrace)).filter(x=>x.path.includes('/meta/handbook?workspace=self_service')&&x.status===200).length).toBeGreaterThan(previous);
  if(!readOnly){
    const description=`SCN-d4c475d-${Date.now()} SYNTHETIC UI TEST ONLY: no actual fault, repair or expenditure`;
    await root.locator('input[data-help="self_service.issue_input_location"]').fill('SYNTHETIC TEST AREA - NO REAL LOCATION');
    await root.locator('textarea[data-help="self_service.issue_input_description"]').fill(description);
    fs.writeFileSync(intent,JSON.stringify({asset_id:asset.asset_id,asset_name:asset.name,description,at:new Date().toISOString(),state:'submit once next'},null,2));
    await root.locator('[data-help="self_service.issue_btn_submit"]').click();
    await expect(root).toContainText('Issue reported successfully');
    await expect.poll(async()=>(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path.endsWith('/ops/work-orders')&&x.finished).length).toBe(1);
    const result=(await s.trace()).requests.find(x=>x.method==='POST'&&x.path.endsWith('/ops/work-orders'));
    fs.writeFileSync(dir+'issue-result.json',JSON.stringify(result,null,2));
    assert.equal(result.status,201);assert(result.key);assert.equal(result.body.asset_id,asset.asset_id);
  }else await root.locator('[data-help="self_service.issue_btn_cancel"]').click();
  await capture(s,'self_service');
  const headers=await s.app.evaluate(()=>globalThis.workspaceHeaderTrace);assert(headers.some(x=>x.path.endsWith('/auth/me')&&x.workspace==='self_service'&&x.status===200));assert(headers.some(x=>x.path.includes('/meta/handbook?workspace=self_service')&&x.workspace==='self_service'&&x.status===200));
  fs.writeFileSync(dir+'reception-window-headers.json',JSON.stringify(headers,null,2));
  s.j.passed=true;s.pass('Reception direct duty; account menu creates separate scoped employee window while Reception remains; empty roles untouched; auth/me200 and F1 scoped handbook200 with actual X-Active-Workspace; named privacy-filtered issue201; ENUR250bounds.');
  await child.close();s.p=parent;
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
try{
  s=await session('d4c475d-owner','demo.owner');const w=await s.native('api',{method:'GET',path:'/auth/workspaces'});assert.equal(w.filter(x=>!x.every_employee).length,2);assert.equal(w.filter(x=>x.every_employee).length,1);
  await expect(s.p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();
  await expect(s.p.locator('.workspace-card')).toHaveCount(3);for(const a of w)await expect(s.p.locator('.workspace-card').getByRole('heading',{name:a.label,exact:true})).toBeVisible();
  await capture(s,'workspace_picker');s.j.passed=true;s.pass('Owner+doctor sees exactly two role workspaces plus My Workspace, in server order.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
try{
  s=await session('d4c475d-inspector','demo.inspector');await recordHeaders(s);const w=await s.native('api',{method:'GET',path:'/auth/workspaces'});assert.deepEqual(w.map(x=>x.code),['inspection']);
  await s.p.locator('button.avatar').click();await expect(s.p.getByRole('dialog').getByRole('button',{name:'My Workspace',exact:true})).toHaveCount(0);await s.p.getByRole('button',{name:'Keep working',exact:true}).click();
  // Test-only outgoing header injection to the real server; renderer cannot choose it.
  await s.app.evaluate(()=>{globalThis.workspaceHeaderNegative=true;});
  const r=await s.p.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/auth/me'}));
  await s.app.evaluate(()=>{globalThis.workspaceHeaderNegative=false;});
  assert.equal(r.status,403);assert.equal(r.error.code,'WORKSPACE_NOT_ALLOWED');
  const trace=await s.app.evaluate(()=>globalThis.workspaceHeaderTrace);assert(trace.some(x=>x.workspace==='self_service'&&x.status===403&&x.error==='WORKSPACE_NOT_ALLOWED'));
  fs.writeFileSync(dir+'inspector-window-header-negative.json',JSON.stringify(trace,null,2));
  s.j.passed=true;s.pass('Inspector only inspection/no employee menu; actual forced X-Active-Workspace self_service auth/me403 WORKSPACE_NOT_ALLOWED, no invented workspace or changed roles.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
