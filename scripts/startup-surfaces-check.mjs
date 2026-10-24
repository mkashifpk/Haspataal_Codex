// Isolated unconfigured/configured terminal profiles. No sign-in, business
// records or machine configuration changes; login zoom prefs are local only.
import {_electron as electron} from 'playwright';import {expect} from 'playwright/test';import {terminalPage} from './terminal-page.mjs';import {capture} from './clinical-test-kit.mjs';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const j={started:new Date().toISOString(),screens:[],errors:[]},save=()=>fs.writeFileSync('artifacts/startup-surfaces-resume-20261024.json',JSON.stringify(j,null,2));save();
for(const [screen,title,helpTitle] of [['connect_server','Your hospital, connected.','Connect to your hospital'],['login','Sign in to your workspace','Sign in']]){
 const env={...process.env,HASPATAAL_TEST:'1',HASPATAAL_TEST_DATA:path.resolve('artifacts/startup-'+screen+'-'+Date.now()),ProgramData:path.resolve('artifacts/unprovisioned-machine')};delete env.ELECTRON_RUN_AS_NODE;
 if(screen==='login')env.HASPATAAL_DEV_CONFIG=path.resolve('.dev-terminal.json');else delete env.HASPATAAL_DEV_CONFIG;
 const app=await electron.launch({args:['.'],env}),p=await terminalPage(app);p.setDefaultTimeout(30000);await p.setViewportSize({width:1400,height:1000});
 const native=async(action,args)=>{const r=await p.evaluate(v=>window.terminal.call(v.action,v.args),{action,args});assert(r.ok,r.error?.message);return r.data};
 try{
  await expect(p.getByRole('heading',{name:title,exact:true})).toBeVisible();assert(!(await native('state')).user);if(screen==='login')await expect(p.getByText('Hospital server ready.',{exact:true})).toBeVisible();
  await p.keyboard.press('F1');await expect(p.locator('.help-article h1')).toHaveText(helpTitle);await p.getByRole('dialog').filter({has:p.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
  await capture({p,prefs:value=>native('prefs',value)},screen);
  const win=await app.browserWindow(p);await native('prefs',{ui_scale_pct:250});await win.evaluate(w=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:'=',modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:'=',modifiers:['control']})});await expect.poll(async()=>(await native('state')).prefs.ui_scale_pct).toBe(250);
  await win.evaluate(w=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:'0',modifiers:['control']});w.webContents.sendInputEvent({type:'keyUp',keyCode:'0',modifiers:['control']})});await expect.poll(async()=>(await native('state')).prefs.ui_scale_pct).toBe(100);assert(!(await native('state')).user);
  j.screens.push({screen,passed:true,checks:['Actual screen/F1 public help','Fresh EN/UR screenshots, Light/Dark250 no overflow','Native upper bound250/reset100','No authentication or business write; isolated local-only display preferences']});save();console.log('PASS '+screen);
 }catch(e){j.errors.push({screen,error:e.stack});console.error(e.stack);process.exitCode=1}finally{await app.close()}
}
j.passed=j.errors.length===0;j.finished=new Date().toISOString();save();assert(j.passed);
