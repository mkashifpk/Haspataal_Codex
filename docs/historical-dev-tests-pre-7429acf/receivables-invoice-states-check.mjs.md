# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Read-only real DEV invoice states; persistent lost replies never fabricate data.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
const s = await session("receivables-invoice-states", "demo.owner"),
  p = s.p;
try {
  const user = (await s.native("state")).user,
    work = user.workspaces.find((w) => w.code === "owner_dashboard");
  await s.nav("Workspaces");
  await p
    .locator("article.workspace-card")
    .filter({ has: p.getByRole("heading", { name: work.label, exact: true }) })
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  await s.nav("Outstanding dues");
  const outstanding = await s.native("api", {
    method: "GET",
    path: "/finance/ar/outstanding",
  });
  if (!outstanding.length)
    await expect(
      p.getByText(
        "No outstanding patient receivables or panel dues are recorded.",
        { exact: true },
      ),
    ).toBeVisible();
  await p
    .getByRole("button", { name: "Invoices & direct payments", exact: true })
    .click();
  const table = p.getByRole("table", { name: "Invoices", exact: true }),
    refresh = p.getByRole("button", { name: "Refresh", exact: true });
  await expect(table).toBeVisible();
  const invoices = await s.native("api", {
    method: "GET",
    path: "/finance/invoices?limit=50",
  });
  assert(invoices.length);
  const fixture = JSON.parse(
    fs.readFileSync("docs/receivables-owner-active-evidence-2026-10-25.json"),
  );
  assert(fixture.passed);
  const target = invoices.find(
    (x) =>
      x.patient_id === fixture.patient.patient_id &&
      x.invoice_id === fixture.ar.invoice_id,
  );
  assert(target);
  s.j.target_invoice = {
    invoice_id: target.invoice_id,
    invoice_no: target.invoice_no,
  };
  s.save();
  await s.fault({ delayPath: "/finance/invoices?", delayMs: 1600 });
  await refresh.click();
  await expect(table).toHaveCount(0);
  await expect(table).toBeVisible();
  await s.fault({ delayPath: null });
  await s.fault({
    failPath: "/finance/invoices?",
    failMethod: "GET",
    once: false,
  });
  await refresh.click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(table).toHaveCount(0);
  await s.fault({ failPath: null });
  await p.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(table).toBeVisible();
  const drafts = await s.native("api", {
    method: "GET",
    path: "/finance/invoices?status=Draft&limit=50",
  });
  assert.equal(
    drafts.length,
    0,
    "Use a verified empty supported filter, not a fabricated response",
  );
  await p.getByLabel("Invoice status", { exact: true }).selectOption("Draft");
  const empty =
    "No invoices match these filters. Choose All statuses and All types, or refresh to check again.";
  await expect(p.getByText(empty, { exact: true })).toBeVisible();
  await expect(table).toHaveCount(0);
  await help(
    s,
    p.getByLabel("Invoice status", { exact: true }),
    "Outstanding dues (Udhaar)",
  );
  await s.prefs({ language: "ur", theme: "Light", ui_scale_pct: 250 });
  await expect(
    p.getByText(
      "ان فلٹرز میں کوئی بل نہیں ملا۔ تمام حالتیں اور تمام اقسام چنیں، یا دوبارہ جانچنے کے لیے تازہ کریں۔",
      { exact: true },
    ),
  ).toBeVisible();
  await expect
    .poll(() =>
      p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    )
    .toBe(true);
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await p.getByLabel("Invoice status", { exact: true }).selectOption("all");
  await expect(table).toBeVisible();
  const invoice = table.getByRole("button", {
    name: target.invoice_no,
    exact: true,
  });
  await s.fault({
    failPath: "/finance/invoices/" + target.invoice_id,
    failMethod: "GET",
    once: false,
  });
  await invoice.click();
  await expect(p.locator('main .error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await expect(
    p.getByRole("table", { name: "Invoice lines", exact: true }),
  ).toHaveCount(0);
  await s.fault({ failPath: null });
  await invoice.click();
  await expect(
    p.getByRole("table", { name: "Invoice lines", exact: true }),
  ).toBeVisible();
  const modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("table", { name: "Invoice lines", exact: true }),
    });
  await expect(modal).toContainText(target.invoice_no);
  await help(
    s,
    modal.getByRole("button", { name: "Close", exact: true }).last(),
    "Outstanding dues (Udhaar)",
  );
  await modal
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await capture(s, "receivables");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method !== "GET").length,
    0,
  );
  s.pass(
    "Actual empty AR queue where available, delayed/failed invoice list hides old rows, Retry recovers; real empty Draft filter explains recovery in EN/UR250%; actual invoice detail failure shows error/no stale dialog then re-open recovers; F1 focus/layouts and zero business writes",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.j.failure_ui = await p
    .locator("body")
    .innerText()
    .catch(() => null);
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.fault({ failPath: null, delayPath: null });
  await expect
    .poll(
      async () => {
        const r = await p.evaluate(() =>
          window.terminal.call("api", { method: "GET", path: "/auth/me" }),
        );
        return r.ok;
      },
      { timeout: 60000 },
    )
    .toBe(true);
  await s.close();
  fs.writeFileSync(
    "docs/receivables-invoice-states-evidence-2026-10-25.json",
    JSON.stringify(s.j, null, 2),
  );
}

```
