// Read-only business navigation. Select a real workspace, locate by accessible
// label (never a cached button index) and accept each screen's actual headings.
import {session,expect} from './clinical-test-kit.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const file='artifacts/started-screens-reset-smoke-20261024.json';
if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous-'+Date.now());
const j={started:new Date().toISOString(),screens:[],errors:[],sessions:[]},save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
const titles=Object.fromEntries(Array.from(fs.readFileSync('src/App.tsx','utf8').matchAll(/(\w+):\s*\[\s*"([^"]+)"/g),m=>[m[2],m[1]]));
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const names=page=>page.getByRole('navigation').getByRole('button').evaluateAll(buttons=>buttons.map(b=>Array.from(b.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()));
for(const [account,workspace] of [['demo.reception','reception'],['demo.doctor','doctor'],['demo.owner','owner_dashboard'],['demo.zakat','zakat'],['demo.cashier','finance_cashier'],['demo.quality','quality']]){
 const s=await session('reset-smoke-'+account.replace('.','-'),account),p=s.p;
 try{
  p.on('pageerror',e=>{j.errors.push({account,error:e.message});save()});p.on('dialog',d=>d.accept());
  // Login's initial metadata load may auto-open a single workspace. Let it
  // finish before deliberately opening the picker, or it can detach the card.
  const startup=await s.native('state');
  if(startup.user.workspaces.length===1){
   await expect.poll(async()=>(await s.native('state')).workspace).toBe(startup.user.workspaces[0].code);
   await expect(p.getByText('READY FOR YOUR NEXT TASK',{exact:true})).toBeVisible();
  }else await expect(p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();
  await s.nav('Workspaces');await expect(p.getByRole('heading',{name:'Where are you working today?',exact:true})).toBeVisible();j.screens.push({account,screen:'workspace_picker'});
  const state=await s.native('state');const w=state.user.workspaces.find(w=>w.code===workspace);assert(w,'Account must own requested workspace '+workspace);
  const card=p.locator('.workspace-card').filter({has:p.getByRole('heading',{name:w.label,exact:true})});await card.getByRole('button',{name:'Open workspace →',exact:true}).click();
  await expect(p.getByText('READY FOR YOUR NEXT TASK',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await s.trace()).requests.some(r=>r.path==='/api/v1/meta/handbook?workspace='+workspace&&r.status===200)).toBe(true);
  const visited=new Set();
  for(let n=0;n<60;n++){
   const label=(await names(p)).find(label=>label!=='Workspaces'&&!visited.has(label));if(!label)break;
   const button=p.getByRole('navigation').getByRole('button',{name:new RegExp('^'+escape(label)+'(?:\\s*\\d+)?$')});const before=(await s.trace()).requests.length;
   await button.click();await expect(button).toHaveClass(/active/);
   await expect(p.locator('main h1, main h2').first()).toBeVisible();
   await expect.poll(async()=>(await s.trace()).requests.slice(before).every(r=>r.finished),{timeout:45000}).toBe(true);
   const failures=(await s.trace()).requests.slice(before).filter(r=>r.status>=500);assert.equal(failures.length,0,'Unexpected backend5xx on '+label);
   j.screens.push({account,workspace,label,screen:titles[label],headings:await p.locator('main h1, main h2').allTextContents(),alerts:await p.locator('main [role="alert"]').allTextContents()});visited.add(label);save();console.log('OPEN '+account+' '+label);
  }
  const required={reception:['Patient document vault','Queue management','Refund / waiver / credit','Cash-back','Tariff','New registration + OPD slip'],doctor:['My live queue','Consultation (EMR)','E-prescription builder','Lab & imaging orders + results','Refer out (external referral)','Health education given','Record a home visit','Preventive programmes of a patient','ICD code picker'],owner_dashboard:['Facility & services','Outstanding dues (Udhaar)'],zakat:['Charity approvals'],finance_cashier:['My cash shift','Cash-back','Outstanding dues (Udhaar)'],quality:['Referral register']};
  for(const name of required[workspace])assert(visited.has(name),'Started screen absent after reopening '+workspace+': '+name);
  await p.keyboard.press('F1');await expect(p.locator('.help-layout')).toBeVisible();j.screens.push({account,screen:'help_center'});await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
  assert.equal((await s.trace()).requests.filter(r=>r.method!=='GET').length,0,'Smoke must make no business writes');s.j.passed=true;
 }catch(e){j.errors.push({account,error:e.stack,ui:await p.locator('body').innerText()});console.error(e.stack);process.exitCode=1}finally{await s.close();j.sessions.push({account,preferences_restored:s.j.preferences_restored,finished:s.j.finished,passed:s.j.passed});save()}
}
j.passed=j.errors.length===0;j.finished=new Date().toISOString();save();assert(j.passed,'Inspect failed navigation in journal');
