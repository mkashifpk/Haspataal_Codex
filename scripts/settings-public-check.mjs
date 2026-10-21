// Focused public Settings boundary check: real DEV reads, local preferences only.
import { _electron as electron } from 'playwright';
import { expect } from 'playwright/test';
import { terminalPage } from './terminal-page.mjs';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const env={...process.env,HASPATAAL_TEST:'1',HASPATAAL_DEV_CONFIG:path.resolve('.dev-terminal.json'),HASPATAAL_TEST_DATA:path.resolve('artifacts/public-settings-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try {
 const page=await terminalPage(app);page.setDefaultTimeout(40000);
 await page.getByLabel('Username',{exact:true}).waitFor();
 const build=await page.locator('script[src]').getAttribute('src');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const sections=await page.evaluate(()=>window.terminal.call('api',{method:'GET',path:'/settings/sections'}));assert(sections.ok&&!sections.data.signed_in);assert.deepEqual(sections.data.tiers.map(t=>t.tier),['terminal']);
 await expect(page.getByText('Loading from the hospital server…',{exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
 await page.locator('.settings-nav button').filter({hasText:'This terminal: its location and printers'}).click();await expect(page.getByText('Loading from the hospital server…',{exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
 await page.keyboard.press('F1');await expect(page.locator('.help-article')).toContainText("Before sign-in: check this terminal's connection");await expect(page.locator('.help-article')).not.toContainText('Why does a policy say Waiting for an Owner?');await expect(page.locator('.help-article img[src*=settings-it]')).toHaveCount(0);
 await page.getByLabel('Search handbook',{exact:true}).fill('Why does a policy say Waiting for an Owner?');await expect(page.getByText('No permitted help matches this search.',{exact:true})).toBeVisible();
 fs.writeFileSync('artifacts/settings-public-check.json',JSON.stringify({passed:true,build,checks:['public sections only terminal tier','actual public diagnostics and terminal identity','public purpose/FAQs/search exclude privileged policy and IT guidance/images']},null,2));console.log('PASS public Settings boundary on '+build);
} finally {await app.close();}
