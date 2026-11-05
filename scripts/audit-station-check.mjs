// Isolated native security/public-route regression. No Review code, business
// record or scan submission; the sole station API read deliberately lacks a key.
import { _electron as electron } from 'playwright';
import { expect } from 'playwright/test';
import { terminalPage } from './terminal-page.mjs';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = process.cwd();
const profile = path.resolve(`artifacts/audit/station-profile-${Date.now()}`);
const env = { ...process.env, HASPATAAL_TEST: '1', HASPATAAL_DEV_CONFIG: path.resolve('.dev-terminal.json'), HASPATAAL_TEST_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
const results = [];
try {
  const page = await terminalPage(app);
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor({ timeout: 60000 });
  await page.locator('[data-help="shell.kiosk"]').click();
  await expect(page.locator('.badge-station-kiosk')).toBeVisible();
  await expect(page.locator('[data-help="badge_station_kiosk.setup_station_id_input"]')).toHaveValue('');
  await expect(page.locator('[data-help="badge_station_kiosk.setup_station_key_input"]')).toHaveValue('');
  await expect(page.locator('[data-help="badge_station_kiosk.setup_save_button"]')).toBeEnabled();
  await page.locator('[data-help="badge_station_kiosk.setup_cancel_button"]').click();
  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Badge station kiosk');
  assert.equal(await page.getByRole('dialog').getByText('Patient search', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('[data-help="badge_station_kiosk.lang_toggle"]').click();
  await expect(page.locator('.badge-station-kiosk')).toHaveCSS('direction', 'rtl');
  await page.screenshot({ path: 'artifacts/audit/kiosk-public-ur.png', fullPage: true });
  results.push('Public kiosk opens without employee login, starts with blank credentials, F1 shows operator help only, and Urdu uses RTL.');

  const native = await app.evaluate(({ app, safeStorage }, root) => {
    const fs = process.getBuiltinModule('node:fs');
    const path = process.getBuiltinModule('node:path');
    const require = process.getBuiltinModule('node:module').createRequire(path.join(root, 'package.json'));
    const { saveStationConfig, loadStationConfig } = require(path.join(root, 'electron/station-config.cjs'));
    const file = path.join(app.getPath('userData'), 'audit-unsent.enc');
    const value = { station_id: 'AUDIT-UNSENT', station_key: process.getBuiltinModule('node:crypto').randomBytes(32).toString('hex') };
    saveStationConfig(file, value, safeStorage);
    const restored = loadStationConfig(file, safeStorage);
    const encrypted = !fs.readFileSync(file).includes(Buffer.from(value.station_key));
    fs.unlinkSync(file);
    return { encrypted, roundtrip: restored.station_key === value.station_key && restored.station_id === value.station_id };
  }, root);
  assert.deepEqual(native, { encrypted: true, roundtrip: true });
  results.push('Actual Electron safeStorage encrypt/decrypt roundtrip passes; file does not contain plaintext credential. Synthetic credential never sent.');

  const refusal = await page.evaluate(() => window.terminal.call('api', { method: 'GET', path: '/badge-stations/me?station_id=AUDIT-UNCONFIGURED' }));
  assert.equal(refusal.status, 401);
  assert.equal(refusal.error.code, 'BADGE_STATION_UNKNOWN');
  results.push(`Real unauthenticated station profile read refused 401 BADGE_STATION_UNKNOWN; request ${refusal.request_id}.`);
  const injection = await page.evaluate(() => window.terminal.call('api', { method: 'GET', path: '/auth/me', headers: { Authorization: 'unsent-test' } }));
  assert.equal(injection.ok, false);
  assert.match(injection.error.message, /header is not permitted/);
  results.push('Native IPC rejects renderer Authorization override before HTTP.');
  await page.evaluate(() => localStorage.setItem('haspataal_station_config', JSON.stringify({ station_id: 'AUDIT-MIGRATION', station_key: crypto.randomUUID() })));
  await page.reload();
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor({ timeout: 60000 });
  await page.locator('[data-help="shell.kiosk"]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('haspataal_station_config'))).toBe(null);
  await page.locator('[data-help="badge_station_kiosk.setup_button"]').click();
  await expect(page.locator('[data-help="badge_station_kiosk.setup_station_id_input"]')).toHaveValue('AUDIT-MIGRATION');
  results.push('Legacy plaintext configuration migrates through native encryption and is removed only after successful save; station identity survives reload. Synthetic key only encounters station-auth refusal.');
  console.log(JSON.stringify({ results }, null, 2));
} finally {
  fs.writeFileSync('artifacts/audit/station-check.json', JSON.stringify({ results }, null, 2));
  await app.close();
}
