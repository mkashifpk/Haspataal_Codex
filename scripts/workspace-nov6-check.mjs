// Fresh synthetic issue on our own synthetic asset; never rerun an uncertain write.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,capture,help} from './clinical-test-kit.mjs';
const file='artifacts/workspace-nov6-write-intent.json';
assert(!fs.existsSync(file),'Reconcile the saved original issue intent/result before any rerun.');
let s;
try {
  s=await session('workspace-nov6-reception','demo.reception');
  assert.equal((await s.native('state')).workspace,'reception','Single role workspace must open directly');
  const rows=await s.native('api',{method:'GET',path:'/ops/assets'});
  assert(rows.length&&rows.every(r=>r.purchase_cost===null&&r.purchase_date===null));
  const asset=rows.find(r=>r.asset_id===3&&/SCN|SYNTHETIC/i.test(r.name));
  assert(asset,'Use only the confirmed synthetic medical asset from this reset epoch');
  await s.p.locator('button.avatar').click();
  const account=s.p.getByRole('dialog').filter({has:s.p.getByRole('heading',{name:'Your account',exact:true})});
  const my=account.getByRole('button',{name:'My Workspace',exact:true});
  await help(s,my,'Your daily workspace');
  await my.click();
  await expect.poll(async()=>(await s.native('state')).workspace).toBe('self_service');
  await s.p.getByRole('navigation').locator('[data-screen-target="self_service"]').click();
  const root=s.p.locator('#content');
  await root.locator('[data-help="self_service.tab_support"]').click();
  await root.locator('[data-help="self_service.btn_open_issue_modal"]').click();
  const picker=root.locator('.directory-picker');
  await expect(picker.locator('select')).toBeEnabled();
  const option=picker.locator('option').filter({hasText:asset.name});
  await expect(option).toHaveCount(1);
  await picker.locator('select').selectOption(String(asset.asset_id));
  assert(!await root.getByText(/Purchase cost|Purchase date/).count());
  const description=`SCN-NOV6-${Date.now()} SYNTHETIC UI TEST ONLY: no real fault or repair required`;
  await root.locator('input[data-help="self_service.issue_input_location"]').fill('SYNTHETIC TEST AREA - NO ACTUAL LOCATION');
  await root.locator('textarea[data-help="self_service.issue_input_description"]').fill(description);
  fs.writeFileSync(file,JSON.stringify({asset,description,at:new Date().toISOString(),state:'about to submit once'},null,2));
  await root.locator('[data-help="self_service.issue_btn_submit"]').click();
  await expect(root).toContainText('Issue reported successfully');
  const requests=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path.endsWith('/ops/work-orders'));
  assert.equal(requests.length,1);assert.equal(requests[0].status,201);assert.equal(requests[0].body.asset_id,asset.asset_id);assert(requests[0].key);
  fs.writeFileSync('artifacts/workspace-nov6-write-result.json',JSON.stringify(requests[0],null,2));
  await capture(s,'self_service');
  s.j.passed=true;s.pass('Reception opens its sole role workspace directly, then My Workspace through account menu/F1; named privacy-filtered synthetic asset issue posts once201 with key, no costs; EN/Urdu and250% bounds.');
} finally {if(s)await s.close();}
try {
  s=await session('workspace-nov6-multiple','demo.owner');
  await s.p.getByRole('navigation').locator('[data-screen-target="workspace_picker"]').click();
  await expect(s.p.locator('.workspace-card').filter({has:s.p.getByRole('heading',{name:'My Workspace',exact:true})})).toHaveCount(1);
  await capture(s,'workspace_picker');s.j.passed=true;s.pass('Multiple-duty launcher retains My Workspace alongside role workspace cards.');
} finally {if(s)await s.close();}
try {
  s=await session('workspace-nov6-guest','demo.inspector');
  const me=await s.native('api',{method:'GET',path:'/auth/me'});assert(!me.employee_id);assert(!me.workspaces.some(w=>w.every_employee));
  await s.p.locator('button.avatar').click();
  await expect(s.p.getByRole('dialog').getByRole('button',{name:'My Workspace',exact:true})).toHaveCount(0);
  s.j.passed=true;s.pass('Inspector guest has no employee workspace or account-menu link; backend scoped handbook separately refuses403.');
} finally {if(s)await s.close();}
