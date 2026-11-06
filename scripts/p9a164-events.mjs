// Reads current fresh fixture; external synthetic update/action are triggered only after READY.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('docs/phase-p9a-2026-11-06/164-ack-a-result.json')).body.data;
let s;try{
 s=await session('p9a164-events','demo.nurse');await s.p.getByRole('navigation').locator('[data-screen-target="my_complaint_investigations"]').click();const root=s.p.locator('[data-screen="my_complaint_investigations"]');
 await root.getByRole('row').filter({hasText:fixture.complaint_number}).getByRole('button',{name:'Open investigation',exact:true}).click();await root.locator('button[data-help="mci.update"]').click();
 const note=root.locator('textarea[data-help="mci.contact-note"]');await note.fill('SYNTHETIC UNSENT CONTACT DRAFT - preserve it during live updates');await root.locator('input[data-help="mci.confirm"]').check();
 await s.p.evaluate(()=>{globalThis.complaintEvents=[];window.terminal.subscribe(e=>{if(e.type==='event'&&['complaint.updated','notification.created'].includes(e.event_type))globalThis.complaintEvents.push({event:e.event_type,id:e.event_id});});});
 s.j.ready_for_events=true;s.save();console.log('READY_FOR_COMPLAINT_EVENTS');
 await expect.poll(()=>s.p.evaluate(()=>globalThis.complaintEvents.some(e=>e.event==='complaint.updated')),{timeout:120000}).toBe(true);
 await expect.poll(()=>s.p.evaluate(()=>globalThis.complaintEvents.some(e=>e.event==='notification.created')),{timeout:120000}).toBe(true);
 await expect(root).toContainText('SYNTHETIC EXTERNAL EVENT CONTACT');await expect(root).toContainText('SYNTHETIC EXTERNAL EVENT ACTION');await expect(note).toHaveValue('SYNTHETIC UNSENT CONTACT DRAFT - preserve it during live updates');await expect(root.locator('input[data-help="mci.confirm"]')).not.toBeChecked();
 await root.locator('button[data-help="mci.cancel"]').click();s.j.actual_events=await s.p.evaluate(()=>globalThis.complaintEvents);assert(!(await s.trace()).requests.some(x=>x.method!=='GET'));s.j.passed=true;s.pass('Actual complaint.updated/notification.created refresh contact/actions; unsent contact text preserved and review checkbox reset; no polling or UI writes.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
try{
 s=await session('p9a164-reporter-only','demo.reception');const list=await s.native('api',{method:'GET',path:'/complaints?mine=true&status=Acknowledged&limit=1000'});assert(list.some(x=>x.complaint_id===fixture.complaint_id),'The real mine list also includes received complaints');await expect(s.p.getByRole('navigation').locator('[data-screen-target="my_complaint_investigations"]')).toHaveCount(0);s.j.passed=true;s.pass('Unassigned receiver has actual received complaints but no investigator menu; reporter ownership does not become investigation assignment.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
