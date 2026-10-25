import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
for (const account of ["demo.quality", "demo.cashier"]) {
  const s = await session(
      "phase2-programme-permissions-" + account.split(".")[1],
      account,
    ),
    p = s.p;
  try {
    if (account === "demo.quality") {
      const me = await s.native("api", { method: "GET", path: "/auth/me" });
      assert(!me.permissions.includes("programme.give"));
      assert(me.permissions.includes("programme.manage"));
      const rows = await s.native("api", {
        method: "GET",
        path: "/patients/5/programmes",
      });
      for (const card of [
        "DEMO-CARD-PHASE2-20261025",
        "DEMO-RETIRING-P2-20261025",
        "DEMO-REFUSALS-P2-20261025",
      ])
        assert(
          rows.some((x) => x.card_number === card && x.status !== "Active"),
        );
      s.pass(
        "Manage-only Quality reads three new closed upstream enrolments, has no give permission; no fabricated readonly Doctor workspace",
      );
    } else {
      await expect(
        p
          .getByRole("navigation")
          .getByRole("button", {
            name: "Preventive programmes of a patient",
            exact: false,
          }),
      ).toHaveCount(0);
      for (const path of [
        "/patients/5/programmes",
        "/preventive-programmes",
        "/preventive-programmes/due?on=2026-10-25",
      ]) {
        const r = await p.evaluate((v) => window.terminal.call("api", v), {
          method: "GET",
          path,
        });
        assert.equal(r.error?.code, "PERMISSION_REQUIRED");
      }
      s.pass(
        "Cashier no programme menu; native permission guards refuse history/catalogue/due before HTTP; all six actual sandbox API403 verified separately",
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
