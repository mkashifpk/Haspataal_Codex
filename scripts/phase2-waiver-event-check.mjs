// Original synthetic ticket16/approval13 only. Cash remains undispensed; no new financial request.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/phase2-waiver-event-check-2026-10-24.json',control='docs/phase2-waiver-event-controller-2026-10-24.json';
const resume=process.argv.includes('--resume');assert(resume || !fs.existsSync(file),'Reconcile original waiver event check before rerunning');const j=resume?JSON.parse(fs.readFileSync(file)):{ticket_id:16,approval_id:13},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const s=await session('phase2-waiver-event-check','demo.reception'),p=s.p;
try{
 await p.evaluate(()=>{window.waiverEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.waiverEvents.push(e)})});
 await s.nav('Cash-back');await p.getByLabel('OPD slip number',{exact:true}).fill('OPD-2026-000016');await p.getByRole('button',{name:'Open slip',exact:true}).click();
 if(!resume)await expect(p.locator('main')).toContainText('WaiverPending');j.ready=true;save();console.log('WAIT actual approval13');
 for(let n=0;n<300;n++){if(fs.existsSync(control)&&JSON.parse(fs.readFileSync(control)).approved)break;if(n===299)throw Error('Approval13 not confirmed');await new Promise(r=>setTimeout(r,2000));}
 const modal=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Mandatory cash-back',exact:true})});await expect(modal).toBeVisible();
 await expect(modal).toContainText('1500');await expect(modal.getByRole('button',{name:'Confirm cash handed back',exact:true})).toBeDisabled();await p.keyboard.press('Escape');await expect(modal).toBeVisible();
 j.events=[...(j.events||[]),...await p.evaluate(()=>window.waiverEvents)];const ev=j.events.find(e=>e.event_type==='waiver.refund_order.ready'&&e.payload.ticket_id===16);assert(ev);assert.equal(typeof ev.payload.refund_amount,'number');assert.equal(ev.payload.refund_amount,1500);
 j.ticket=await s.native('api',{method:'GET',path:'/opd-tickets/16'});assert.equal(j.ticket.payment_status,'Waivered');assert.notEqual(j.ticket.status,'Refunded');assert.equal(j.ticket.cash_back_prompts[0].amount,1500);assert.equal(j.ticket.cash_back_prompts[0].kind,'WaiverRefund');
 j.trace=await s.trace();assert.equal(j.trace.requests.filter(r=>r.method!=='GET').length,0);j.passed=true;save();s.pass('Actual waiver.refund_order.ready1500number refreshes Cash-back; original16 ends Waivered, not Refunded; blocking prompt/no physical cash acknowledgement/ZEROPOST');
}catch(e){j.error=e.stack;j.trace=await s.trace();j.failure_ui=await p.locator('body').innerText();save();console.error(e.stack);process.exitCode=1}finally{await s.close();j.finished=new Date().toISOString();save()}
