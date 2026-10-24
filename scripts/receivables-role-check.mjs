// Real DEV reads only: permission-bound actions, no write-off or settlement.
import {session,expect,help} from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
for(const [account,workspace] of [['demo.owner','owner_dashboard'],['demo.cashier','finance_cashier']]){
 const s=await session('ar-role-'+account.replace('.','-'),account),p=s.p;
 try{
  const state=await s.native('state');
  if(state.workspace!==workspace){await s.nav('Workspaces');const w=state.user.workspaces.find(w=>w.code===workspace);assert(w);await p.locator('.workspace-card').filter({has:p.getByRole('heading',{name:w.label,exact:true})}).getByRole('button',{name:'Open workspace →',exact:true}).click();}
  await s.nav('Outstanding dues (Udhaar)');
  await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path.startsWith('/api/v1/finance/ar/outstanding')&&r.status===200)).toBe(true);
  const rows=await s.native('api',{method:'GET',path:'/finance/ar/outstanding'});
  const allowed=(await s.native('state')).user.permissions.includes('finance.ar.write_off');
  const buttons=p.getByRole('button',{name:'Write off',exact:true});
  if(allowed && rows.length){await expect(buttons.first()).toBeVisible();await buttons.first().click();const field=p.getByLabel('Reason for write-off (mandatory)',{exact:true});await help(s,field,'Outstanding dues (Udhaar)');p.once('dialog',d=>d.accept());await p.getByRole('dialog').filter({has:field}).getByRole('button',{name:'Cancel',exact:true}).click();}
  else{await expect(buttons).toHaveCount(0);if(rows.length)await expect(p.getByText('Ask an authorised administrator about debt write-offs.',{exact:true}).first()).toBeVisible();else s.j.limitation='Outstanding queue is empty after owned settlement; positive writeoff row not exercised in this readonly run';}
  const fs=await import('node:fs');const fin=JSON.parse(fs.readFileSync('artifacts/phase2-financial-cycle.json'));await p.getByRole('button',{name:'Invoices & direct payments',exact:true}).click();await p.getByRole('button',{name:fin.credit_ticket.invoice.invoice_no,exact:true}).click();const invoiceDialog=p.getByRole('dialog').filter({has:p.getByRole('heading',{name:'Invoice Details — '+fin.credit_ticket.invoice.invoice_no,exact:true})});const close=invoiceDialog.getByRole('button',{name:'Close',exact:true}).last();await help(s,close,'Outstanding dues (Udhaar)');await close.click();
  if(account==='demo.cashier'){for(const language of ['en','ur']){await s.prefs({language,theme:'Light',ui_scale_pct:100});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'artifacts/receivables-final-'+language+'.png'});await s.prefs({ui_scale_pct:250});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}await s.prefs({language:'en',ui_scale_pct:100});}
  assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0);
  s.pass('Owner/cashier permissions honoured; actual settled-credit invoice read, modal F1 and close, no financial POST; outstanding-data limitation recorded where empty');s.j.passed=true;s.save();
 }catch(e){s.j.error=e.stack;s.save();console.error(e.stack);process.exitCode=1;}finally{await s.close();}
}
