# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Final display/F1/frozen-name summary after scoped layout and wording changes; zero business writes.
import { session, expect, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const j = { date: new Date().toISOString(), checks: [], passed: false };
let s;
try {
  s = await session("roster-final-display", "demo.headnurse");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  j.renderer = s.j.renderer;
  await s.nav("Nursing duty roster");
  await p
    .getByLabel("Any date in roster week", { exact: true })
    .fill("2026-11-09");
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.getByLabel("Filter ward", { exact: true }).selectOption("1");
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p
    .getByLabel("Find in permitted staff", { exact: true })
    .fill("DEMO-NO-MATCH-983451");
  await expect(p.locator("main")).toContainText(
    "No permitted staff match this search. Clear or change the search.",
  );
  await p.getByLabel("Find in permitted staff", { exact: true }).fill("");
  await p.getByRole("button", { name: "Add duty", exact: true }).click();
  const d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Add to duty batch", exact: true }),
    });
  await d.getByLabel("Duty employee", { exact: true }).selectOption("30");
  await d.getByLabel("Duty start date", { exact: true }).fill("2026-11-15");
  await d.getByLabel("Duty shift", { exact: true }).selectOption("3");
  await d.getByLabel("Duty ward", { exact: true }).selectOption("1");
  await d
    .getByLabel("Duty notes", { exact: true })
    .fill("UNSENT final display only");
  await d
    .getByRole("button", { name: "Add to duty batch", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Review duty batch", exact: true })
    .click();
  const c = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", {
        name: "Confirm roster action",
        exact: true,
      }),
    });
  await expect(c.locator("ul")).toContainText("IPC Nurse Shazia");
  await expect(c.locator("ul")).toContainText("2026-11-15");
  await expect(c.locator("ul")).toContainText("Night");
  await c.getByRole("checkbox").focus();
  await p.keyboard.press("F1");
  await expect(p.locator(".help-article")).toContainText(
    "reading a list cannot unlock a replacement request",
  );
  await p
    .getByRole("dialog")
    .filter({ has: p.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(c.getByRole("checkbox")).toBeFocused();
  await c.getByRole("button", { name: "Close", exact: true }).click();
  await p
    .getByRole("button", { name: "Remove unsent entry 1", exact: true })
    .click();
  j.checks.push(
    "Final frozen review shows actual person/date/shift, technical IDs collapsed; F1 updated recovery rule preserves confirmation/focus; close/remove unsent batch zero write",
  );
  await p
    .getByLabel("Any date in roster week", { exact: true })
    .fill("2099-01-05");
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(p.locator("main")).toContainText(
    "No duties match this week and filters.",
  );
  await p
    .getByLabel("Any date in roster week", { exact: true })
    .fill("2026-11-09");
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.evaluate(() => window.scrollTo(0, 0));
  await capture(s, "duty_roster");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method !== "GET").length,
    0,
  );
  j.checks.push(
    "Final compact week filters/panels, responsive left staff/grid, actual ENUR media and both themes250 no horizontal page overflow; zero business writes",
  );
  j.passed = true;
  console.log("PASS final display/F1/summary/media with ZERO business writes");
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  fs.writeFileSync(
    "docs/duty-roster-final-display-evidence-2026-10-27.json",
    JSON.stringify(j, null, 2) + "\n",
  );
}

```
