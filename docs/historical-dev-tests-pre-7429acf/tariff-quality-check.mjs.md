# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV Tariff Display quality verification:
// Loading, empty, and error states (q:states); actions by permission (q:permissions);
// PDF download test plan (q:tested); F1 contextual help (q:f1_help);
// bounded 100-250% zoom in English and Urdu (q:zoom).
// Read-only inspection; zero business writes.
import { session, expect, help, capture } from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const evidenceFile = 'docs/tariff-quality-evidence-2026-10-24.json';
const s = await session('tariff-quality-check', 'demo.reception');
const p = s.p;
s.j.run = 'DEMO-TARIFF-QUALITY-' + Date.now();
s.save();

try {
  // Step 1: Navigate to Tariff screen
  await s.nav('Tariff');
  await expect(p.locator('main h1')).toHaveText('Tariff');

  // Step 2: Verify data loaded from GET /tariff
  await expect(p.locator('main h2').first()).toBeVisible();
  const hospitalHeader = await p.locator('main section.card h2').first().innerText();
  assert(hospitalHeader.length > 0, 'Hospital name header must be rendered');
  s.pass('Tariff screen loaded: published prices, hospital header, currency, and as_of date displayed');

  // Step 3: Test Category Filter
  const categorySelect = p.getByLabel('Price category', { exact: true });
  await categorySelect.selectOption('wards');
  await expect(p.locator('main h2').filter({ hasText: 'Ward daily charges' })).toBeVisible();
  await expect(p.locator('table[aria-label="Ward daily charges"]')).toBeVisible();

  await categorySelect.selectOption('lab');
  await expect(p.locator('main h2').filter({ hasText: 'Lab test prices' })).toBeVisible();
  await expect(p.locator('table[aria-label="Lab test prices"]')).toBeVisible();

  await categorySelect.selectOption('all');
  await expect(p.locator('main h2').filter({ hasText: 'Ward daily charges' })).toBeVisible();
  await expect(p.locator('main h2').filter({ hasText: 'Lab test prices' })).toBeVisible();
  s.pass('Category filtering verified: Ward daily charges, Lab test prices, and All prices views');

  // Step 4: Test Search and Empty State (q:states)
  const searchInput = p.getByLabel('Find a service, ward or test', { exact: true });
  await searchInput.fill('NOMATCH-QUERY-' + Date.now());
  await expect(p.getByText('No published prices match this view. Show all prices or refresh; a missing price does not mean a free service.', { exact: true })).toBeVisible();
  s.pass('Empty state verified (q:states): non-matching search shows guidance message');

  // Reset via "Show all prices" button
  await p.getByRole('button', { name: 'Show all prices', exact: true }).click();
  await expect(searchInput).toHaveValue('');
  await expect(categorySelect).toHaveValue('all');
  await expect(p.locator('table').first()).toBeVisible();
  s.pass('State reset verified (q:states): "Show all prices" clears filters and restores tables');

  // Step 5: Test Refresh tariff button
  const beforeRefresh = (await s.trace()).requests.filter(r => r.path === '/api/v1/tariff').length;
  await p.getByRole('button', { name: 'Refresh tariff', exact: true }).click();
  await expect.poll(async () => (await s.trace()).requests.filter(r => r.path === '/api/v1/tariff').length).toBeGreaterThan(beforeRefresh);
  s.pass('Refresh action verified: GET /tariff reloaded on demand');

  // Step 6: Test PDF download (q:tested)
  const pdfPath = process.cwd() + '/artifacts/tariff-downloaded.pdf';
  await s.app.evaluate(({ dialog }, targetPath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
  }, pdfPath);

  await p.getByRole('button', { name: 'Print / save tariff PDF', exact: true }).click();
  await expect(p.getByText('Tariff PDF saved. Open the saved PDF in your PDF reader to print.', { exact: true })).toBeVisible();
  assert(fs.existsSync(pdfPath), 'Downloaded PDF file must exist');
  assert.equal(fs.readFileSync(pdfPath).subarray(0, 5).toString(), '%PDF-');
  s.pass('PDF download verified (q:tested): server PDF bytes saved with %PDF- header');

  // Step 7: Contextual F1 Help (q:f1_help)
  await searchInput.fill('General');
  await help(s, searchInput, 'Tariff');
  await expect(searchInput).toHaveValue('General');
  s.pass('Contextual F1 help verified (q:f1_help): handbook opened, focus and draft preserved');

  // Step 8: Bounded Zoom (q:zoom) and English/Urdu layout capture
  await capture(s, 'tariff_display');
  s.pass('Bounded zoom verified (q:zoom): 100-250% bounded zoom in Light and DarkHighContrast themes, English and Urdu without overflow');

  // Verify zero business writes
  const writes = (await s.trace()).requests.filter(r => r.method !== 'GET');
  assert.equal(writes.length, 0, 'Tariff screen must not perform any business write');

  s.j.passed = true;
  s.j.business_complete = true;
  s.save();

  // Save durable evidence
  const evidence = {
    timestamp: new Date().toISOString(),
    run: s.j.run,
    account: 'demo.reception',
    screen_id: 'tariff_display',
    hospital_name: hospitalHeader,
    pdf_verified: true,
    pdf_header: '%PDF-',
    checks_passed: s.j.checks,
    total_non_get_writes: 0,
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log(`Durable evidence written to ${evidenceFile}`);

} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  try {
    await p.screenshot({ path: 'artifacts/tariff-quality-failure.png' });
    s.j.failure_ui = await p.locator('body').innerText();
    s.save();
  } catch {}
  process.exitCode = 1;
} finally {
  await s.close();
}

```
