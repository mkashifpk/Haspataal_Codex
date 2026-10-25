// Real read-only and forbidden actors; no business writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
for (const account of process.argv.includes("--cashier")
  ? ["demo.cashier"]
  : ["demo.doctor", "demo.quality", "demo.cashier"]) {
  const s = await session("phase2-education-" + account.split(".")[1], account),
    p = s.p;
  try {
    const me = await s.native("api", { method: "GET", path: "/auth/me" });
    if (account === "demo.doctor") {
      assert(me.permissions.includes("education.give"));

      await s.nav("Health education given");
      await p
        .getByLabel("Find clinical patient", { exact: true })
        .fill("MRN-2026-000005");
      await p
        .getByRole("button", {
          name: /DEMO-FINANCIAL-1792904985263 .*MRN-2026-000005/,
        })
        .click();
      await expect(
        p.getByRole("heading", {
          name: "DEMO-EDUCATION-1792909010056 clarified",
          exact: true,
        }),
      ).toBeVisible();
      await p
        .getByText("Education material catalogue", { exact: true })
        .click();
      await expect(
        p.getByText(
          "No education materials are available. Ask authorized quality/setup staff; do not invent a leaflet or video.",
          { exact: true },
        ),
      ).toBeVisible();
      s.pass(
        "Real direct patient-chart context reads new signed history; actual empty active catalogue after owned fixture retirement",
      );
    } else if (account === "demo.quality") {
      assert(me.permissions.includes("education.manage"));
      assert(!me.permissions.includes("education.give"));
      const rows = await s.native("api", {
        method: "GET",
        path: "/patients/5/education?limit=100",
      });
      assert(
        rows.some((r) => r.topic === "DEMO-EDUCATION-1792909010056 clarified"),
      );
      assert.equal(
        (
          await s.native("api", {
            method: "GET",
            path: "/education/materials?include_inactive=false",
          })
        ).length,
        0,
      );
      s.pass(
        "Actual manage-only permission can read education history/materials; Quality has no Doctor workspace, so readonly form UI not exercised",
      );
    } else {
      await expect(
        p.getByRole("navigation").getByRole("button", {
          name: "Health education given",
          exact: false,
        }),
      ).toHaveCount(0);
      for (const path of ["/patients/5/education", "/education/materials"]) {
        const r = await p.evaluate((v) => window.terminal.call("api", v), {
          method: "GET",
          path,
        });
        assert.equal(r.error?.code, "PERMISSION_REQUIRED");
      }
      s.pass(
        "Cashier has no education navigation; native permission guard refuses history/catalogue before HTTP (sandbox server403 checked separately)",
      );
    }
    assert.equal(
      (await s.trace()).requests.filter((r) => r.method !== "GET").length,
      0,
    );
    s.j.passed = true;
    s.save();
  } catch (e) {
    s.j.error = e.stack;
    s.save();
    console.error(e.stack);
    try {
      fs.writeFileSync(
        "artifacts/phase2-education-permissions-ui.txt",
        await p.locator("body").innerText(),
      );
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
  if (process.exitCode) break;
}
