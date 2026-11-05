# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Permission boundary only: no business writes.
import { session, expect } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const j = { date: new Date().toISOString(), checks: [], passed: false };
let s;
try {
  for (const account of ["demo.pharmacist", "demo.nurse"]) {
    s = await session("roster-access-" + account.split(".")[1], account);
    await expect(
      s.p
        .getByRole("navigation")
        .getByRole("button", { name: "Nursing duty roster", exact: false }),
    ).toHaveCount(0);
    const me = await s.native("api", { method: "GET", path: "/auth/me" });
    assert(
      !me.permissions.some((p) =>
        [
          "roster.manage.all",
          "roster.manage.nursing",
          "roster.manage.support",
          "roster.view.all",
        ].includes(p),
      ),
    );
    assert.equal(
      (await s.trace()).requests.filter((r) => r.method !== "GET").length,
      0,
    );
    j.checks.push({
      account,
      renderer: s.j.renderer,
      rosterNavigationAbsent: true,
      zeroBusinessWrites: true,
    });
    await s.close();
    s = undefined;
  }
  j.passed = true;
  console.log(
    "PASS non-manager Pharmacy/Nurse handbook scopes expose no Duty Roster route or write",
  );
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  fs.writeFileSync(
    "docs/duty-roster-access-evidence-2026-10-27.json",
    JSON.stringify(j, null, 2) + "\n",
  );
}

```
