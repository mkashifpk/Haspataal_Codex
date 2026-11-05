import fs from 'node:fs';import assert from 'node:assert/strict';
import{session,expect}from'./clinical-test-kit.mjs';
const base=JSON.parse(fs.readFileSync('docs/backend-refresh-2026-11-05/screen-workspace-smoke-plan.json'));
const wanted=new Set(process.argv.slice(2));const plan=wanted.size?base.filter(p=>wanted.has(p.screen)):base;
const groups=Object.groupBy(plan,p=>p.account),accounts=Object.keys(groups),result={started:new Date().toISOString(),screens:{},accounts:{},limits:['Read/F1/layout regression only. Fresh upstream synthetic fixtures for the changed writes are tested separately. This does not certify full historical CRUD, human journey or Urdu translation.']};
const save=()=>fs.writeFileSync('artifacts/refresh-7429acf-breadth.json',JSON.stringify(result,null,2));save();
let next=0;
async function worker(){while(next<accounts.length){const account=accounts[next++];let s;try{
 s=await session('refresh7429-breadth-'+account.replace('.','-'),account);result.accounts[account]={renderer:s.j.renderer};save();
 const handbook=await s.native('api',{method:'GET',path:'/meta/handbook'}),serverScreens=[...handbook.shared_screens,...handbook.workspaces.flatMap(w=>w.screens)];
 for(const p of groups[account]){
  const item=result.screens[p.screen]={account,checks:[],status:'running'};save();
  try{
   const button=s.p.getByRole('navigation').locator(`[data-screen-target="${p.screen}"]`);
   if(!await button.count()){item.status=serverScreens.some(s=>s.id===p.screen&&s.view!=='setup')?'missing-navigation':'not-offered-by-server';item.server_view=serverScreens.find(s=>s.id===p.screen)?.view;save();continue;}
   const before=(await s.trace()).requests.length,pageErrors=[];const onError=e=>pageErrors.push(e.message);s.p.on('pageerror',onError);
   await button.click();const main=s.p.locator('#content');await expect(main).toBeVisible();
   await expect.poll(async()=>{const t=await s.trace();return t.requests.slice(before).every(r=>r.finished);},{timeout:30000,intervals:[250,500,1000]}).toBe(true);
   item.text=(await main.innerText()).slice(0,1800);assert(item.text.trim(),'Empty screen');assert.equal(pageErrors.length,0,pageErrors.join('\n'));
   item.requests=(await s.trace()).requests.slice(before).map(r=>({method:r.method,path:r.path,status:r.status,request_id:r.result?.request_id}));
   assert(!item.requests.some(r=>r.method!=='GET'),'Unexpected business write during read-only navigation');
   const denied=item.requests.filter(r=>r.status>=400);assert.equal(denied.length,0,JSON.stringify(denied));
   assert(!/PERMISSION_REQUIRED|INVALID_RESPONSE|outside the foundation contract/.test(item.text),'Unexpected native permission/contract refusal');item.checks.push('Read and server/native access');
   const focus=main.locator(p.screen==='settings'?'[data-help="settings.zoom"]':'input:not([disabled]),button:not([disabled]),select:not([disabled])').first();if(await focus.count()){await focus.focus();await s.p.keyboard.press('F1');await expect(s.p.locator('.help-article h1')).toBeVisible();item.help_title=await s.p.locator('.help-article h1').innerText();await s.p.locator('.dialog-head [data-help="common.close"]').click();await expect(focus).toBeFocused();item.checks.push('Contextual F1 and focus restore');}
   for(const lang of ['en','ur']){
    await s.prefs({language:lang,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',lang);await s.p.evaluate(()=>window.scrollTo(0,0));await s.p.screenshot({path:`public/handbook/${p.screen}-${lang}.png`});
    await s.prefs({language:lang,theme:'DarkHighContrast',ui_scale_pct:250});const fits=await s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2);if(!fits){item.overflow=await s.p.evaluate(()=>Array.from(document.querySelectorAll('#content *')).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left})).filter(r=>r.right>innerWidth+2||r.left< -2).slice(0,25));await s.p.screenshot({path:`artifacts/refresh-overflow-${p.screen}.png`});}assert(fits,`${lang} page overflow at250%`);
   }
   await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});item.checks.push('Current DEV EN/UR screenshots and250% page bounds');item.status='passed';s.p.off('pageerror',onError);save();console.log('PASS '+p.screen+' '+account);
  }catch(e){item.status='failed';item.error=String(e);try{await s.prefs({language:'en',theme:'Light',ui_scale_pct:100});await s.p.keyboard.press('Escape');}catch{}save();console.log('FAIL '+p.screen+' '+String(e).slice(0,160));}
 }
 s.j.passed=!groups[account].some(p=>['failed','missing-navigation'].includes(result.screens[p.screen]?.status));save();
}catch(e){result.accounts[account]={error:String(e)};save();console.log('ACCOUNT FAIL '+account+' '+String(e).slice(0,120));}
finally{if(s)await s.close();}}
}
await Promise.all([worker(),worker(),worker()]);result.finished=new Date().toISOString();result.counts=Object.fromEntries(['passed','failed','missing-navigation','not-offered-by-server'].map(status=>[status,Object.values(result.screens).filter(s=>s.status===status).length]));save();console.log(JSON.stringify(result.counts));if(result.counts.failed||result.counts['missing-navigation'])process.exitCode=1;
