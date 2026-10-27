// Read-only final help/layout/media pass. No counted label reads or clinical/financial writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session,expect,help} from './clinical-test-kit.mjs';
const j={started:new Date().toISOString(),checks:[]},file='artifacts/lab-backend-fixes-media.json';
const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));save();
for(const [account,id,title] of [['demo.reception','lab_only_walkin','Lab-only walk-in'],['demo.labtech','lab_bench','Scanner-first lab bench'],['demo.labverifier','lab_verification','Verification queue']]){
 let s;
 try{
  s=await session('labfix-media-'+id,account);await s.nav(title);
  if(id==='lab_only_walkin'){await s.p.getByLabel('Known lab requisition ID',{exact:true}).fill('1');await s.p.getByRole('button',{name:'Open lab requisition',exact:true}).click();await expect(s.p.locator('main')).toContainText('Partial report:');}
  if(id==='lab_bench'){await s.p.getByRole('button',{name:'Arm sample scanner',exact:true}).click();await s.p.keyboard.type('LB-2026-0000003');await s.p.keyboard.press('Enter');await expect(s.p.getByLabel('Interpretation',{exact:true})).toBeVisible();}
  const control=id==='lab_only_walkin'?s.p.getByRole('button',{name:'Refresh lab walk-in',exact:true}):id==='lab_bench'?s.p.getByRole('button',{name:'Print sample label',exact:true}):s.p.getByLabel('Find in queue',{exact:true});
  await help(s,control,title);
  for(const language of ['en','ur']){
   await s.prefs({language,theme:'Light',ui_scale_pct:100});await expect(s.p.locator('html')).toHaveAttribute('lang',language);
   await s.p.evaluate(()=>window.scrollTo(0,0));await s.p.screenshot({path:`public/handbook/${id}-${language}.png`,fullPage:true});
   for(const theme of ['Light','DarkHighContrast']){await s.prefs({language,theme,ui_scale_pct:250});await expect.poll(()=>s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);}
  }
  const trace=await s.trace();assert.equal(trace.requests.filter(x=>x.method!=='GET').length,0);assert.equal(trace.requests.filter(x=>/\/samples\/\d+\/label/.test(x.path)).length,0);
  j.checks.push({screen:id,renderer:s.j.renderer,read_only:true,f1:true,en_ur_full_page:true,themes_250:true});save();
 }finally{if(s)await s.close();}
}
j.passed=true;j.finished=new Date().toISOString();save();console.log('PASS final bilingual F1/full-page media/layout with zero business writes and zero counted label reads');
