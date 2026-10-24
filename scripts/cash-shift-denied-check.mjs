// Read-only real DEV role check. No preferences or business writes.
import {_electron as electron} from 'playwright';
import {expect as baseExpect} from 'playwright/test';
import {terminalPage} from './terminal-page.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const expect=baseExpect.configure({timeout:45000});
const env={...process.env,HASPATAAL_TEST:'1',HASPATAAL_DEV_CONFIG:path.resolve('.dev-terminal.json'),HASPATAAL_TEST_DATA:path.resolve('artifacts/cash-denied-'+Date.now())};
delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
const p=await terminalPage(app);
const result={passed:false,started:new Date().toISOString()};
try {
  await expect(p.getByText('Hospital server ready.',{exact:true})).toBeVisible();
  await p.getByLabel('Username',{exact:true}).fill('demo.admissions');
  await p.getByLabel('Password',{exact:true}).fill('Demo-pass-2026');
  await p.getByRole('button',{name:'Sign in →',exact:true}).click();
  await expect(p.getByRole('navigation')).toBeVisible();
  await expect(p.locator('.header-context')).not.toContainText('Shared foundation');
  const state=await p.evaluate(()=>window.terminal.call('state'));
  assert(state.ok && state.data.user);
  assert(!state.data.user.permissions.includes('finance.shift.operate'));
  await expect(p.getByRole('navigation').getByRole('button',{name:/My cash shift|میری کیش شفٹ/})).toHaveCount(0);
  const denied=await p.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/finance/cash-shifts/mine'}));
  assert(!denied.ok);assert.equal(denied.error.code,'PERMISSION_REQUIRED');
  result.renderer=await p.locator('script[type="module"]').getAttribute('src');
  result.checks=['Admissions has no cash operating permission or navigation','Native permission gate refuses the cash-shift read before sending'];
  result.passed=true;
} catch(e) {result.error=e.stack;process.exitCode=1;} finally {
  try {const r=await p.evaluate(()=>window.terminal.call('logout'));assert(r.ok);result.signed_out=true;} catch(e){result.cleanup_error=e.message;process.exitCode=1;}
  await app.close();result.finished=new Date().toISOString();fs.writeFileSync('artifacts/cash-shift-denied.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
