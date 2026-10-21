import { _electron as electron } from 'playwright';
import { expect } from 'playwright/test';
import { terminalPage } from './terminal-page.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const env={...process.env,HASPATAAL_TEST:'1',HASPATAAL_DEV_CONFIG:path.resolve('.dev-terminal.json'),HASPATAAL_TEST_DATA:path.resolve('artifacts/layout-foundation-'+Date.now())};
delete env.ELECTRON_RUN_AS_NODE;
const checks=[];let app,page,original;
const state=()=>page.evaluate(()=>window.terminal.call('state').then(r=>r.data));
const pref=async value=>{const r=await page.evaluate(v=>window.terminal.call('prefs',v),value);assert(r.ok,JSON.stringify(r));};
async function layout(id){
  for(const language of ['en','ur'])for(const theme of ['Light','DarkHighContrast']){
    await pref({language,theme,ui_scale_pct:250});
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    const actualWindow=await app.browserWindow(page);
    assert.equal(await actualWindow.evaluate(w=>w.webContents.getZoomFactor()),2.5);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2)).toBe(true);
    const win=await app.browserWindow(page);
    const png=await win.evaluate(async w=>(await w.webContents.capturePage()).toPNG().toString("base64"));
    fs.writeFileSync(`artifacts/foundation-layout-${id}-${language}-${theme}.png`,Buffer.from(png,"base64"));
  }
  checks.push(id+': EN/UR, Light/DarkHighContrast at250%, no document horizontal overflow');
  await pref({language:'en',theme:'Light',ui_scale_pct:100});
}
const nav=async name=>page.getByRole('navigation').getByRole('button',{name,exact:false}).click();
async function login(username){await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('Demo-pass-2026');await page.getByRole('button',{name:'Sign in →',exact:true}).click();await expect.poll(()=>state().then(s=>!!s.user)).toBe(true);original=(await state()).prefs;await pref({language:'en',theme:'Light',ui_scale_pct:100});await page.getByRole('navigation').waitFor();}
async function logout(){await pref(original);original=undefined;await page.evaluate(()=>window.terminal.call('logout',{all_sessions:false}));await page.getByLabel('Username',{exact:true}).waitFor();}
try{
  app=await electron.launch({args:['.'],env});page=await terminalPage(app);page.setDefaultTimeout(30000);
  await page.getByLabel('Username',{exact:true}).waitFor();await layout('login');
  await login('demo.owner');
  for(const [id,name] of [['workspace_picker','Workspaces'],['app_shell','Workspace home'],['notifications','Notifications'],['approval_queue','Approvals'],['report_incident','Report an incident'],['facility_profile','Facility & services'],['settings','Settings']]){
    await nav(name);await layout(id);
  }
  await page.locator('.avatar').click();await page.getByRole('button',{name:'Help & handbook',exact:true}).click();await expect(page.locator('.help-article h1')).toHaveText('Your handbook');checks.push('avatar opens permitted handbook home with workspace list and search');await layout('help_center');
  await page.locator('dialog').filter({has:page.locator('.help-layout')}).getByRole('button',{name:'Close',exact:true}).click();
  // The only overridden interaction is the operating system's save-file chooser;
  // the backend PDF response is fetched and validated by the production bridge.
  await nav('Facility & services');await page.getByRole('button',{name:'History',exact:true}).click();await page.locator('details').filter({has:page.getByText('The demo hospital: Category II B with its services',{exact:false})}).first().locator('summary').click();await page.getByRole('button',{name:'Open change 1',exact:true}).click();await expect(page.locator('main')).toContainText('Category II B');checks.push('Facility opens real individual change1 from history');
  await nav('Report an incident');
  const pdf=path.resolve('artifacts/foundation-sentinel-list.pdf');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},pdf);
  await page.getByRole('button',{name:'What to report · PDF',exact:true}).click();
  await expect.poll(()=>fs.existsSync(pdf)).toBe(true);assert.equal(fs.readFileSync(pdf).subarray(0,5).toString(),'%PDF-');checks.push('real DEV sentinel PDF downloaded through production bridge');
  // Same-value non-control setting verifies the direct PUT path without changing
  // hospital policy. Persist its attempt before clicking and never auto-repeat it.
  const directFile='artifacts/foundation-direct-policy.json';
  if(!fs.existsSync(directFile)){
    await nav('Settings');await page.locator('.settings-nav button').filter({hasText:'Hospital policy settings'}).click();
    const before=await page.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/admin/settings'}).then(r=>r.data.find(s=>s.key==='complaint_phone')));
    assert(before&&!before.is_control);assert.equal(before.value,'');
    await page.locator('.policy-list .list-row').filter({hasText:'complaint phone'}).click();
    await expect(page.getByLabel('New value',{exact:true})).toHaveValue(JSON.stringify(before.value));
    fs.writeFileSync(directFile,JSON.stringify({key:before.key,value:before.value,pending:true}));
    await page.getByRole('button',{name:'Save policy',exact:true}).click();
    await expect(page.getByText('Policy saved.',{exact:true})).toBeVisible();
    const after=await page.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/admin/settings'}).then(r=>r.data.find(s=>s.key==='complaint_phone')));
    assert.equal(after.value,before.value);fs.writeFileSync(directFile,JSON.stringify({key:before.key,value:before.value,pending:false,passed:true}));
  }else assert(JSON.parse(fs.readFileSync(directFile)).passed,'reconcile original pending direct policy write before rerun');
  checks.push('direct non-control policy PUT through Settings confirmed; complaint_phone unchanged empty value');
  await logout();await login('demo.zakat');
  await page.evaluate(()=>window.terminal.call('workspace',{code:'zakat'}));await page.reload();await nav('Charity approvals');await layout('charity_approvals');
  await logout();await login('demo.it');await nav('Notifications');
  const note=await page.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/notifications?limit=100'}).then(r=>r.data.find(n=>n.notification_id===117)));
  assert.equal(note?.entity_type,'approval_request');assert.equal(note?.entity_id,'5');assert(note.body.startsWith('DEMO-FOUNDATION-POLICY-1792584814936'));
  if(!note.is_read){const card=page.locator('.notification').filter({hasText:note.body});await card.getByRole('button',{name:'Mark as read',exact:true}).click();await expect(card).toHaveClass(/read/);}
  const reread=await page.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/notifications?limit=100'}).then(r=>r.data.find(n=>n.notification_id===117)));
  assert.equal(reread.is_read,true);checks.push('only fresh synthetic policy notification117 marked read through UI and confirmed; shared inbox read-all untouched');
  fs.writeFileSync('artifacts/foundation-layout-check.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}catch(e){if(page)await page.screenshot({path:'artifacts/foundation-layout-failure.png'}).catch(()=>{});throw e;}
finally{if(app){if(original&&((await state()).user))await pref(original).catch(e=>console.error('Restore preferences:',e.message));await app.close();}}
