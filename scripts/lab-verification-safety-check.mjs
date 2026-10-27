// Real DEV verifier failure/concurrency tests. Own synthetic records only.
// Fixture writes journal original keys before sending; no physical care or money.
import {session,expect,help,capture} from './clinical-test-kit.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const file='artifacts/lab-verification-safety-check.json';
const readOnlyResume=process.argv.includes('--resume-readonly');
assert(!fs.existsSync(file)||readOnlyResume,'Reconcile original safety journal before continuing; never overwrite/repeat its writes');
const j=readOnlyResume?JSON.parse(fs.readFileSync(file)):{run:'DEMO-VERIFY-SAFETY-'+Date.now(),writes:{},checks:[],passed:false};
if(readOnlyResume){assert(j.finished&&j.writes.publish?.state==='confirmed-and-reconciled-no-replay');j.previous_error=j.error;delete j.error;delete j.finished;}
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const actors=[];
const start=async(n,u)=>{const s=await session(n,u);actors.push(s);s.p.on('dialog',d=>d.accept());return s;};
const pass=m=>{j.checks.push(m);save();console.log('PASS '+m);};
async function fixture(s,name,path,body){
 assert(!j.writes[name]);const w=j.writes[name]={method:'POST',path,body,key:crypto.randomUUID(),state:'prepared'};save();
 const r=await s.p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path,body,key:w.key});
 w.result=r;w.state=r.ok?'confirmed':r.status>=400&&r.status<500?'refused':'unknown';save();assert(r.ok,name+':'+JSON.stringify(r.error));return r.data;
}
const posts=async(s,path)=>(await s.trace()).requests.filter(x=>x.method==='POST'&&x.path==='/api/v1'+path);
let v,p;
try{
 if(!readOnlyResume){
 const r=await start('verifier-safety-reception','demo.reception');
 const tests=await r.native('api',{method:'GET',path:'/lab/tests'});
 const selected=tests.filter(x=>['CBC','RBS'].includes(x.code));assert.equal(selected.length,2);
 j.order=await fixture(r,'order','/patients/lab-only-walk-in',{full_name:j.run+' NO ACTUAL CARE',mobile:'03000000002',test_ids:selected.map(x=>x.test_id),clinical_notes:j.run+' software verification only; NO specimens, clinical care or money'});save();
 assert(j.order.requisition?.invoice?.invoice_id);
 j.payment=await fixture(r,'payment',`/finance/invoices/${j.order.requisition.invoice.invoice_id}/payments`,{method:'Card',reference_no:j.run+' software-only collection, no real money'});save();
 const t=await start('verifier-safety-tech','demo.labtech');
 const results=[];
 for(const item of j.order.requisition.items){
   await fixture(t,'receive-'+item.code,`/lab/samples/${item.sample_id}/receive`,{identity_check:'TwoIdentifiers',identity_note:j.run+' software identity simulation only'});
   const values=item.code==='RBS'?{glucose:100}:{hb:14,wbc:7,plt:250};
   const result=await fixture(t,'result-'+item.code,`/lab/items/${item.lab_requisition_item_id}/results`,{metrics:values,interpretation:j.run+' SYNTHETIC VALUES ONLY, no clinical use'});results.push({...result,code:item.code});
 }
 j.results=results;save();await t.close();actors.pop();await r.close();actors.pop();
 v=await start('verifier-safety-verifier','demo.labverifier');p=v.p;
 await v.nav('Verification queue');
 const queue=await v.native('api',{method:'GET',path:'/lab/verification-queue'});
 j.queue_contract=queue.filter(x=>results.some(r=>r.result_id===x.result_id));save();assert.equal(j.queue_contract.length,2);
 assert(j.queue_contract.every(x=>!('due_at'in x)&&!('entered_by'in x)&&!('requisition_id'in x)));
 await p.getByLabel('Find in queue',{exact:true}).fill(j.run);
 const rows=p.locator('.queue-section tbody tr');await expect(rows).toHaveCount(2);
 await help(v,p.getByLabel('Find in queue',{exact:true}),'Verification queue');
 const cbc=results.find(x=>x.code==='CBC'),rbs=results.find(x=>x.code==='RBS');
 const row=code=>p.locator('.queue-section tbody tr').filter({hasText:code});
 await row('CBC').getByRole('button',{name:'Verify',exact:true}).click();
 let modal=p.getByRole('dialog');await expect(modal).toContainText('Server deadline');
 // A concurrent actual decision removes only our owned CBC result.
 await fixture(v,'concurrent-reject',`/lab/results/${cbc.result_id}/verify`,{decision:'Rejected',note:j.run+' independent concurrent test decision, no actual specimen'});
 const before=(await posts(v,`/lab/results/${cbc.result_id}/verify`)).length;
 await modal.getByRole('button',{name:'Confirm & publish',exact:true}).click();
 await expect(modal).toContainText('The result, permission or service changed.');
 assert.equal((await posts(v,`/lab/results/${cbc.result_id}/verify`)).length,before);
 await modal.getByRole('button',{name:'Cancel',exact:true}).click();
 pass('Fresh preflight refuses concurrent decided own result before POST; entry time never marked as deadline');
 await p.getByRole('button',{name:'Refresh queue',exact:true}).click();
 await expect(row('RBS')).toBeVisible();
 // Link actual known requisition; context must match result/MRN before used.
 await p.getByRole('button',{name:'Requisition detail',exact:true}).first().click();
 modal=p.getByRole('dialog');await modal.locator('input[data-help="verification.requisition"]').fill(String(j.order.requisition.requisition_id));
 await modal.getByRole('button',{name:'Load',exact:true}).click();await expect(modal).toContainText(j.order.requisition.requisition_number);
 await modal.getByRole('button',{name:'Close',exact:true}).last().click();
 await row('RBS').getByRole('button',{name:'Verify',exact:true}).click();modal=p.getByRole('dialog');
 await expect(modal).toContainText('Server deadline');
 const pending=await v.native('api',{method:'GET',path:'/lab/verification-queue'});
 const ownRow=pending.find(x=>x.result_id===rbs.result_id);assert(ownRow?.requisition_id===j.order.requisition.requisition_id);
 const delay=modal.getByLabel('Turnaround Delay Reason (optional, MSDS AAC 4)',{exact:true});
 if(ownRow.is_overdue){await delay.fill(j.run+' optional software reason');await help(v,delay,'Verification queue');}else await expect(delay).toHaveCount(0);
 const path=`/lab/results/${rbs.result_id}/verify`;
 j.writes.publish={path,result_id:rbs.result_id,state:'awaiting-ui'};save();
 const count=(await posts(v,path)).length;
 await v.fault({failPath:'/api/v1'+path,failMethod:'POST',once:true});
 await modal.getByRole('button',{name:'Confirm & publish',exact:true}).evaluate(b=>{b.click();b.click();});
 await expect(modal).toContainText('Answer lost.');
 const sent=(await posts(v,path)).slice(count);assert.equal(sent.length,1);assert.equal(sent[0].status,200);assert.equal(sent[0].result.data.status,'Published');
 j.writes.publish={...sent[0],state:'confirmed-server-reply-lost'};save();
 await expect(modal.getByRole('button',{name:'Confirm & publish',exact:true})).toBeDisabled();
 await expect(modal.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();
 await expect(p.locator('[data-help-screen="lab_verification"]')).toHaveAttribute('data-write-pending','true');
 await p.keyboard.press('Escape');await expect(modal).toBeVisible();
 await expect(modal.getByRole('button',{name:'Retry original request',exact:true})).toHaveCount(0);
 await modal.getByRole('button',{name:'Read current result',exact:true}).click();
 await expect(modal).toContainText('Published');
 await modal.getByRole('button',{name:'Decision reviewed; return to queue',exact:true}).click();await expect(modal).toHaveCount(0);
 assert.equal((await posts(v,path)).length,count+1);
 j.writes.publish.state='confirmed-and-reconciled-no-replay';save();
 pass('Lost publication reply/double-click produces one decision; original dialog/Escape/navigation locked; exact requisition state read and deliberate release without replay');
 }else{
   v=await start('verifier-safety-verifier','demo.labverifier');p=v.p;await v.nav('Verification queue');
 }
 const rbs=j.results.find(x=>x.code==='RBS'),cbc=j.results.find(x=>x.code==='CBC');
 const req=await v.native('api',{method:'GET',path:`/lab/requisitions/${j.order.requisition.requisition_id}`});
 assert.equal(req.results.find(x=>x.result_id===rbs.result_id).status,'Published');assert.equal(req.results.find(x=>x.result_id===cbc.result_id).status,'Rejected');
 assert(req.results.find(x=>x.result_id===rbs.result_id).verified_stamp?.user_id);
 // Stale report and queue failures must not retain another readable success.
 await p.getByRole('button',{name:'Signed report preview',exact:true}).first().click();let modal=p.getByRole('dialog');
 await modal.locator('input[data-help="verification.report"]').fill(String(req.requisition_id));await modal.getByRole('button',{name:'Load',exact:true}).click();await expect(modal).toContainText(req.requisition_number);
 await v.fault({failPath:`/api/v1/lab/requisitions/${req.requisition_id}/report/print-payload`,failMethod:'GET',once:false});
 await modal.getByRole('button',{name:'Load',exact:true}).click();
 await expect(modal.locator('.report-payload-view')).toHaveCount(0);await expect(modal.getByRole('button',{name:'Save report PDF',exact:true})).toBeDisabled();
 await v.fault({failPath:null});await modal.getByRole('button',{name:'Load',exact:true}).click();await expect(modal).toContainText(req.requisition_number);
 await modal.getByRole('button',{name:'Close',exact:true}).last().click();
 pass('Actual matching final statuses/stamp retained; failed report refresh hides old success and disables PDF until current read succeeds');
 await p.evaluate(()=>scrollTo(0,0));await capture(v,'lab_verification');
 j.passed=true;save();
}catch(e){j.error=e.stack;for(const s of actors){try{j.failure_ui=await s.p.locator('body').innerText();}catch{}}save();console.error(e.stack);process.exitCode=1;}
finally{for(const s of actors.reverse()){await s.fault({failPath:null,delayPath:null});await s.close();}j.finished=new Date().toISOString();save();}
