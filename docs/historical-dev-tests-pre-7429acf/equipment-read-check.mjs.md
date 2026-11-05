# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { session, expect, capture, help } from "./clinical-test-kit.mjs";
const journal = { started: new Date().toISOString(), checks: [] };
const save = () =>
  fs.writeFileSync(
    "artifacts/continuation-20261104/equipment-read.json",
    JSON.stringify(journal, null, 2),
  );
for (const [account, id] of [
  ["demo.maintenance", "equipment_maintenance"],
  ["demo.ops", "equipment_maintenance_ops"],
]) {
  let s;
  try {
    s = await session("resume1104-" + id + "-read", account);
    await s.nav("Medical equipment and maintenance");
    const root = s.p.locator(`[data-screen="${id}"]`);
    await expect(root).toBeVisible();
    await expect(s.p.locator('[data-help="em-tab-schedule"]')).toBeVisible();
    await help(
      s,
      s.p.locator('[data-help="em-schedule-search"]'),
      "Medical equipment and maintenance",
    );
    await s.p.locator('[data-help="em-tab-inventory"]').click();
    const owned = JSON.parse(fs.readFileSync('artifacts/continuation-20261104/equipment-write.json','utf8')).tag;
    await s.p.locator('[data-help="em-inv-search"]').fill(owned);
    await s.p.locator('[data-help="em-inv-item"]').filter({hasText:owned}).click();
    await s.p.locator('[data-help="em-detail-record-visit-btn"]').click();
    const findings = s.p.locator('[data-help="em-visit-findings"]');
    await findings.fill('UNSENT KEYBOARD/HELP TEST - NO VISIT SUBMISSION');
    assert(await findings.evaluate(field=>field.labels.length>0));
    for (let index=0; index<25; index++) {
      await s.p.keyboard.press('Tab');
      assert(await s.p.evaluate(()=>!!document.activeElement.closest('[data-equipment-dialog]')));
    }
    await help(s,findings,'Medical equipment and maintenance');
    await expect(findings).toHaveValue('UNSENT KEYBOARD/HELP TEST - NO VISIT SUBMISSION');
    await s.p.keyboard.press('Escape');
    await expect(s.p.locator('[data-equipment-dialog]')).not.toBeVisible();
    for (const key of [
      "em-tab-inventory",
      "em-tab-records",
      "em-tab-statistics",
      "em-tab-schedule",
    ])
      await s.p.locator(`[data-help="${key}"]`).click();
    await expect
      .poll(async () => {
        const t = await s.trace();
        return t.requests.filter(
          (r) =>
            r.method === "GET" &&
            r.status === 200 &&
            r.path.includes("/facility/"),
        ).length;
      })
      .toBeGreaterThan(3);
    await capture(s, id, async () => {
      const caption = s.p.locator('[data-help="em-tab-schedule"] > span').first();
      await expect(caption).toBeVisible();
      const box = await caption.boundingBox();
      assert(box && box.width > 40, 'Schedule caption must not inherit the sidebar 22px icon column or disappear at narrow zoom');
    });
    await s.p.locator('[data-help="em-preview-plan"]').click();
    await expect.poll(()=>s.app.windows().some(window=>window.url().startsWith('data:application/pdf'))).toBe(true);
    await s.app.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())if(window.webContents.getURL().startsWith('data:application/pdf'))window.close();});
    const target = path.resolve(
      `artifacts/continuation-20261104/${id}-plan.pdf`,
    );
    assert.equal(path.dirname(target), path.resolve("artifacts/continuation-20261104"));
    if (fs.existsSync(target)) fs.unlinkSync(target);
    await s.app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: target,
      });
    }, target);
    await s.p.locator('[data-help="em-pdf-plan"]').click();
    await expect.poll(() => fs.existsSync(target)).toBe(true);
    assert(fs.readFileSync(target).subarray(0, 5).equals(Buffer.from("%PDF-")));
    await s.app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true });
    });
    await s.p.locator('[data-help="em-pdf-plan"]').click();
    await expect(s.p.locator("[data-screen]")).toContainText(
      "PDF save cancelled",
    );
    const t = await s.trace();
    assert(
      !t.requests.some(
        (r) => r.method !== "GET" && r.path.includes("/facility/"),
      ),
    );
    journal.checks.push({
      screen: id,
      reads: "real DEV success",
      f1: "context and focus preserved",
      layouts: "EN/UR Light/DarkHighContrast at100/250 without page overflow",
      pdf: "real authenticated PDF signature and cancellation; no business writes",
    });
    save();
    s.j.passed = true;
    s.save();
  } catch (e) {
    journal.error = e.stack;
    save();
    throw e;
  } finally {
    if (s) await s.close();
  }
}
let hr;
try {
  hr = await session("resume1104-navigation-fixed", "demo.hr");
  await expect(hr.p.getByRole("navigation")).toContainText("Payroll");
  await hr.nav("Payroll");
  await expect(
    hr.p.getByRole("heading", { name: /Payroll/ }).first(),
  ).toBeVisible();
  journal.checks.push(
    "Previously omitted Payroll entry is now visible and opens through real HR navigation.",
  );
  save();
  hr.j.passed = true;
  hr.save();
} finally {
  if (hr) await hr.close();
}
let denied;
try {
  denied = await session("resume1104-equipment-denied", "demo.reception");
  const reply = await denied.p.evaluate(() =>
    window.terminal.call("download", { path: "/facility/equipment/plan/pdf" }),
  );
  assert.equal(reply.ok, false);
  assert.match(reply.error.message, /permission/i);
  journal.checks.push(
    "Reception cannot use native equipment PDF download; denied before transfer.",
  );
  save();
} finally {
  if (denied) await denied.close();
}
journal.passed = true;
save();
console.log(JSON.stringify(journal, null, 2));

```
