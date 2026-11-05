# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final label-only build verification, actual DEV reads, no business writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, capture } from "./clinical-test-kit.mjs";
const s = await session("receivables-final-language", "demo.owner"),
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
  await p
    .getByRole("button", { name: "Invoices & direct payments", exact: true })
    .click();
  await expect(
    p.getByRole("table", { name: "Invoices", exact: true }),
  ).toBeVisible();
  await s.prefs({ language: "ur", theme: "Light", ui_scale_pct: 100 });
  await expect(
    p.getByRole("columnheader", { name: "عمل", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "دیکھیں", exact: true }).first(),
  ).toBeVisible();
  await p.getByRole("button", { name: "دیکھیں", exact: true }).first().click();
  await expect(
    p.getByRole("table", { name: "بل کی تفصیل", exact: true }),
  ).toBeVisible();
  await p.keyboard.press("Escape");
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await p.getByLabel("Invoice status", { exact: true }).selectOption("Draft");
  await expect(
    p.getByText(
      "No invoices match these filters. Choose All statuses and All types, or refresh to check again.",
      { exact: true },
    ),
  ).toBeVisible();
  await p.getByLabel("Invoice status", { exact: true }).selectOption("all");
  await expect(
    p.getByRole("table", { name: "Invoices", exact: true }),
  ).toBeVisible();
  await capture(s, "receivables");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method !== "GET").length,
    0,
  );
  s.pass(
    "Final build Urdu Actions/View translated; actual View opens invoice lines; final English no-match message; EN/UR both themes250% and screenshots; no business writes",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.close();
  fs.writeFileSync(
    "docs/receivables-final-language-evidence-2026-10-25.json",
    JSON.stringify(s.j, null, 2),
  );
}

```
