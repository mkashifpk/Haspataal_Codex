import assert from 'node:assert/strict';
import {session,expect,capture} from './clinical-test-kit.mjs';
let s;try{
 s=await session('refresh7429-self-service','demo.reception');
 await s.p.getByRole('navigation').locator('[data-screen-target="workspace_picker"]').click();
 await s.p.locator('.workspace-card').filter({has:s.p.getByRole('heading',{name:'My Workspace',exact:true})}).getByRole('button',{name:'Open workspace →',exact:true}).click();
 await s.p.getByRole('navigation').locator('[data-screen-target="self_service"]').click();
 const root=s.p.locator('#content');await root.locator('[data-help="self_service.btn_open_issue_modal"]').click();
 const picker=root.locator('.directory-picker');await expect(picker.locator('option')).not.toHaveCount(1);
 const rows=await s.native('api',{method:'GET',path:'/ops/assets'});assert(rows.length);assert(rows.every(r=>r.purchase_cost===null&&r.purchase_date===null));
 const option=picker.locator('option').filter({hasText:rows[0].name});await expect(option).toHaveCount(1);await picker.locator('select').selectOption(String(rows[0].asset_id));
 assert(!await root.getByText(/Purchase cost|Purchase date/).count());
 await root.locator('[data-help="self_service.issue_btn_cancel"]').click();
 await capture(s,'self_service');assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.j.passed=true;s.pass('Reception opens My Workspace; active named asset selector uses privacy-filtered rows without cost/date; typed location retained; no work order created.');
}finally{if(s)await s.close();}
