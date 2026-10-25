import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const f = JSON.parse(fs.readFileSync("artifacts/phase2-home-reset.json"));
assert(f.passed);
for (const account of ["demo.quality", "demo.cashier"]) {
  const s = await session(
      "phase2-home-permissions-" + account.split(".")[1],
      account,
    ),
    p = s.p;
  try {
    const me = await s.native("api", { method: "GET", path: "/auth/me" });
    assert(!me.permissions.includes("homevisit.record"));
    if (account === "demo.quality") {
      const list = await s.native("api", {
        method: "GET",
        path: "/home-visits?date_from=2026-10-25&date_to=2026-10-25&patient_id=5&limit=100",
      });
      assert(
        list.some((x) => x.home_visit_id === f.original_visit.home_visit_id),
      );
      assert(
        list.some((x) => x.home_visit_id === f.corrected_visit.home_visit_id),
      );
      s.pass(
        "Quality without homevisit.record reads both new signed upstream home records through actual permitted register; no clinical write",
      );
    } else {
      await expect(
        p
          .getByRole("navigation")
          .getByRole("button", { name: "Record a home visit", exact: false }),
      ).toHaveCount(0);
      const policy = await s.native("api", {
        method: "GET",
        path: "/home-visits/policy",
      });
      assert.equal(policy.state, "Active");
      assert(policy.arrangements.includes("DEV SOFTWARE TESTING ONLY"));
      for (const path of [
        "/home-visits?date_from=2026-10-25&date_to=2026-10-25",
        "/home-visits/" + f.original_visit.home_visit_id,
      ]) {
        const r = await p.evaluate((v) => window.terminal.call("api", v), {
          method: "GET",
          path,
        });
        assert.equal(r.error?.code, "PERMISSION_REQUIRED");
      }
      s.pass(
        "Cashier no home-record menu; public current policy readable; native guards refuse patient register/detail before HTTP, server403 checked separately",
      );
    }
    assert.equal(
      (await s.trace()).requests.filter((x) => x.method !== "GET").length,
      0,
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
  }
  if (process.exitCode) break;
}
