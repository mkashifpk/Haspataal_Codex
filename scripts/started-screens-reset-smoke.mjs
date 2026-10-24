// Read-only business navigation across every started screen, using fresh DEV.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='artifacts/started-screens-reset-smoke-20261024.json',j={started:new Date().toISOString(),screens:[],errors:[],sessions:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
for(const account of ['demo.reception','demo.doctor','demo.owner','demo.zakat']){
 const s=await session('reset-smoke-'+account.replace('.','-'),account),p=s.p;s.j.passed=false;
 try{
  p.on('pageerror',e=>{j.errors.push({account,error:e.message});save()});p.on('dialog',d=>d.accept());
  if(account==='demo.owner')await expect(p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();
  if(await p.getByRole('heading',{name:'Where are you working today?',exact:true}).count()){
   const cards=p.locator('.workspace-card');const card=account==='demo.owner'?cards.filter({has:p.getByRole('heading',{name:'Owner / Hospital Admin',exact:true})}):cards.first();await card.getByRole('button',{name:'Open workspace →',exact:true}).click();
  }
  const readyLabel=account==='demo.reception'?'New registration + OPD slip':account==='demo.doctor'?'My live queue':account==='demo.zakat'?'Charity approvals':'Facility & services';
  await expect(p.getByRole('navigation').getByRole('button',{name:readyLabel,exact:false})).toBeVisible();
  const labels=await p.getByRole('navigation').getByRole('button').evaluateAll(buttons=>buttons.map(b=>Array.from(b.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()));
  for(const [index,label] of labels.entries()){
   if(/Workspaces/.test(label))continue;
   const before=(await s.trace()).requests.length;
   await p.getByRole('navigation').getByRole('button').nth(index).click();
   await expect(p.locator('main')).toBeVisible();
   await expect.poll(async()=>(await s.trace()).requests.slice(before).every(r=>r.finished),{timeout:45000}).toBe(true);
   await expect(p.locator('main h1').first()).toBeVisible();const headings=await p.locator('main h1').allTextContents();
   const errors=(await s.trace()).requests.slice(before).filter(r=>r.status>=500);assert.equal(errors.length,0,'Unexpected backend5xx on '+label);
   const screen=await p.locator('main').getAttribute('data-help-screen');j.screens.push({account,label:label.trim(),screen,headings,alerts:await p.locator('main [role="alert"]').allTextContents()});save();console.log('OPEN '+account+' '+label.trim());
  }
  await s.nav('Workspaces');await expect(p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();j.screens.push({account,screen:'workspace_picker'});
  // Shared Help is a real panel, not a guessed route.
  await p.keyboard.press('F1');await expect(p.locator('.help-layout')).toBeVisible();j.screens.push({account,screen:'help_center'});await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
  const trace=await s.trace();assert.equal(trace.requests.filter(r=>r.method!=='GET').length,0,'Smoke must make no business write');s.j.passed=true;
 }catch(e){j.errors.push({account,error:e.stack,ui:await p.locator('body').innerText()});console.error(e.stack);process.exitCode=1}finally{await s.close();j.sessions.push({account,preferences_restored:s.j.preferences_restored,finished:s.j.finished,passed:s.j.passed});save()}
}
j.passed=j.errors.length===0;j.finished=new Date().toISOString();save();assert(j.passed,'Inspect failed navigation in journal');
