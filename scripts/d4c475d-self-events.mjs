// Read-only UI observation of an actual synthetic swap response performed separately.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const dir='docs/backend-d4c475d-2026-11-06/',swap=JSON.parse(fs.readFileSync(dir+'event-swap-create-result.json')).body.data;
let s;try{
 s=await session('d4c475d-self-events','demo.reception');
 await s.p.locator('button.avatar').click();
 const opening=s.app.waitForEvent('window');
 await s.p.getByRole('dialog').getByRole('button',{name:'My Workspace',exact:true}).click();
 s.p=await opening;
 await expect(s.p.getByRole('navigation').locator('[data-screen-target="self_service"]')).toBeVisible();
 await s.p.getByRole('navigation').locator('[data-screen-target="self_service"]').click();
 const root=s.p.locator('#content');
 await expect(root.getByRole('row').filter({hasText:swap.reason})).toContainText('Requested');
 await s.p.evaluate(()=>{globalThis.actualSelfEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&['roster.swap.updated','notification.created'].includes(e.event_type))globalThis.actualSelfEvents.push({event_type:e.event_type,event_id:e.event_id});});});
 await root.locator('[data-help="self_service.tab_leave"]').click();
 await root.getByRole('button',{name:'Apply for Leave',exact:false}).click();
 const reason=root.locator('[data-help="self_service.leave_input_reason"]');
 await reason.fill('SYNTHETIC UNSENT DRAFT - retain during live updates');
 s.j.ready_for_actual_event=true;s.save();console.log('READY_FOR_ACTUAL_SWAP_ACCEPT');
 await expect.poll(()=>s.p.evaluate(()=>globalThis.actualSelfEvents.some(e=>e.event_type==='roster.swap.updated')),{timeout:120000}).toBe(true);
 await expect.poll(()=>s.p.evaluate(()=>globalThis.actualSelfEvents.some(e=>e.event_type==='notification.created')),{timeout:30000}).toBe(true);
 await expect(reason).toHaveValue('SYNTHETIC UNSENT DRAFT - retain during live updates');
 await root.locator('[data-help="self_service.leave_btn_modal_cancel"]').click();
 await root.locator('[data-help="self_service.tab_duties"]').click();
 await expect(root.getByRole('row').filter({hasText:swap.reason})).toContainText('Accepted');
 await s.fault({failPath:'/self/roster',failMethod:'GET',once:false});
 await root.locator('[data-help="self_service.btn_refresh"]').click();
 await expect(root.locator('[data-help="self_service.banner_dismiss_error"]')).toBeVisible({timeout:60000});
 await expect(root.getByRole('heading',{name:'Daily Schedule Horizon',exact:true})).toHaveCount(0);
 await expect(root.getByRole('row').filter({hasText:swap.reason})).toHaveCount(0);
 await s.fault({failPath:null});await root.locator('[data-help="self_service.btn_refresh"]').click();
 await expect(root.getByRole('row').filter({hasText:swap.reason})).toContainText('Accepted');
 s.j.actual_events=await s.p.evaluate(()=>globalThis.actualSelfEvents);
 assert(!(await s.trace()).requests.some(r=>r.method!=='GET'));
 s.j.passed=true;s.pass('Actual roster.swap.updated and notification.created refresh without polling; unsent leave reason preserved; actual Accepted row; persistent real read-reply failure visible and stale duties/rest-days/actions hidden; explicit Refresh recovers. No UI business writes.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
