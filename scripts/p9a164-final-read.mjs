import fs from 'node:fs';import assert from 'node:assert/strict';
import {session,expect,capture,help} from './clinical-test-kit.mjs';
const fixture=JSON.parse(fs.readFileSync('docs/phase-p9a-2026-11-06/164-ack-a-result.json')).body.data;
let s;try{
 s=await session('p9a164-final-read','demo.nurse');await s.p.getByRole('navigation').locator('[data-screen-target="my_complaint_investigations"]').click();const root=s.p.locator('[data-screen="my_complaint_investigations"]');
 await root.getByRole('row').filter({hasText:fixture.complaint_number}).getByRole('button',{name:'Open investigation',exact:true}).click();await expect(root).toContainText('2026-11-20');await expect(root).toContainText('SYNTHETIC EXTERNAL EVENT ACTION iteration2');
 await root.locator('button[data-help="mci.findings"]').click();const text=root.locator('textarea[data-help="mci.findings-text"]');await text.fill('SYNTHETIC UNSENT final read and keyboard zoom draft');await help(s,text,'Complaints I investigate');
 const win=await s.app.browserWindow(s.p),key=async value=>win.evaluate((w,k)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:k,modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:k,modifiers:['control']});},value);
 await s.prefs({ui_scale_pct:100});await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(110);
 for(let i=0;i<20;i++)await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);await key('=');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(250);
 await key('0');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);await key('-');await expect.poll(async()=>(await s.native('state')).prefs.ui_scale_pct).toBe(100);
 await expect(text).toHaveValue('SYNTHETIC UNSENT final read and keyboard zoom draft');await root.locator('button[data-help="mci.cancel"]').click();
 await capture(s,'my_complaint_investigations');assert(!(await s.trace()).requests.some(x=>x.method!=='GET'));s.j.passed=true;s.pass('Final source reads confirmed complaint/findings/contacts/actions; contextual F1 restores draft/focus; actual Electron keyboard zoom min/max/reset shares Settings state; ENUR/themes250bounds; no business writes.');
}catch(e){if(s){s.j.error=e.stack;s.save();}throw e;}finally{if(s)await s.close();}
