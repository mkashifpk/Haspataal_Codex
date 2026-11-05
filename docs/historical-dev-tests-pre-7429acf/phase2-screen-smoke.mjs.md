# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Open every implemented P2 screen allowed by actual role/workspace metadata. Read-only business data.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const screens = {
  my_cash_shift: "My cash shift",
  patient_search: "Patient search",
  registration: "New registration + OPD slip",
  queue_management: "Queue management",
  refund_waiver_credit: "Refund / waiver / credit",
  cash_back_prompts: "Cash-back",
  receivables: "Outstanding dues (Udhaar)",
  patient_documents: "Patient document vault",
  tariff_display: "Tariff",
  doctor_queue: "My live queue",
  icd_picker: "ICD code picker",
  consultation: "Consultation (EMR)",
  eprescription: "E-prescription builder",
  lab_orders_results: "Lab & imaging orders + results",
  external_referral: "Refer out (external referral)",
  referral_register: "Referral register",
  patient_education: "Health education given",
  patient_programmes: "Preventive programmes of a patient",
  home_visit_record: "Record a home visit",
};
const previous =
  process.argv.includes("--resume-readonly") &&
  fs.existsSync("artifacts/phase2-screen-smoke-report.json")
    ? JSON.parse(fs.readFileSync("artifacts/phase2-screen-smoke-report.json"))
    : null;
const report = previous || {
  date: "2026-10-25",
  screens: [],
  roles: [],
  limits:
    "Read-only startup/navigation/help smoke, not a fresh business journey or complete acceptance of each screen.",
};
for (const account of process.argv.includes("--doctor-only")
  ? ["demo.doctor"]
  : process.argv.includes("--cashier-only")
    ? ["demo.cashier"]
    : ["demo.reception", "demo.doctor", "demo.quality", "demo.cashier"]) {
  const s = await session(
      "phase2-screen-smoke-" + account.split(".")[1],
      account,
    ),
    p = s.p;
  try {
    const failures = [];
    p.on("pageerror", (e) => failures.push(e.message));
    const workspace = (await s.native("state")).workspace;
    const handbook = await s.native("api", {
      method: "GET",
      path: "/meta/handbook?workspace=" + workspace,
    });
    const allowed = new Set(
      [
        ...handbook.shared_screens,
        ...handbook.workspaces.flatMap((w) => w.screens),
      ].map((x) => x.id),
    );
    for (const [id, label] of Object.entries(screens)) {
      const nav = p
        .getByRole("navigation")
        .getByRole("button", { name: label, exact: false });
      if (!(await nav.count())) continue;
      assert(
        allowed.has(id),
        id + " must be in the active workspace's permitted handbook",
      );
      await nav.click();
      await expect(p.locator("main h1").first()).toBeVisible();
      const title = await p.locator("main h1").first().innerText();
      await p.locator("main h1").first().click();
      await p.keyboard.press("F1");
      await expect(p.locator(".help-article h1")).toBeVisible();
      const guide = await p.locator(".help-article h1").innerText();
      await p
        .getByRole("dialog")
        .filter({ has: p.locator(".help-layout") })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await s.trace()).requests.filter(
              (x) => x.path.startsWith("/api/v1/") && !x.finished,
            ).length,
          { timeout: 45000 },
        )
        .toBe(0);
      report.screens.push({ id, account, title, guide });
      fs.writeFileSync(
        "artifacts/phase2-screen-smoke-report.json",
        JSON.stringify(report, null, 2),
      );
      console.log("OPEN " + id + " as " + account);
    }
    if (account === "demo.doctor") {
      await expect(
        p
          .getByRole("navigation")
          .getByRole("button", { name: "Patient search", exact: false }),
      ).toHaveCount(0);
      await s.nav("Health education given");
      const patient = await s.native("api", {
        method: "GET",
        path: "/patients/5",
      });
      assert.equal(
        patient.full_name,
        "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
      );
      await p
        .getByLabel("Find clinical patient", { exact: true })
        .fill(patient.mrn);
      await p
        .getByRole("button", {
          name: patient.full_name + " · " + patient.mrn,
          exact: true,
        })
        .click();
      await expect(p.locator("main")).toContainText(
        "DEMO-EDUCATION-1792909010056 clarified",
      );
      await p.getByLabel("Find clinical patient", { exact: true }).focus();
      await p.keyboard.press("F1");
      await expect(p.locator(".help-article h1")).toHaveText(
        "Health education given",
      );
      await p
        .getByRole("dialog")
        .filter({ has: p.locator(".help-layout") })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      s.pass(
        "Doctor unsupported standalone Patient Search hidden; permitted contextual patient lookup/history/F1 preserved without clinical write",
      );
    }
    const trace = await s.trace();
    assert.equal(trace.requests.filter((x) => x.method !== "GET").length, 0);
    assert.equal(trace.requests.filter((x) => x.status >= 500).length, 0);
    assert.deepEqual(failures, []);
    s.pass(
      "All currently allowed P2 screens open with contextual F1, no renderer errors/5xx/business writes",
    );
    s.j.passed = true;
    s.save();
  } catch (e) {
    s.j.error = e.stack;
    s.save();
    console.error(e.stack);
    report.error = e.stack;
    try {
      fs.writeFileSync(
        "artifacts/phase2-screen-smoke-failure-ui.txt",
        await p.locator("body").innerText(),
      );
      await p.screenshot({
        path: "artifacts/phase2-screen-smoke-failure.png",
        fullPage: true,
      });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
    report.roles.push({
      account,
      passed: s.j.passed,
      renderer: s.j.renderer,
      preferences_restored: s.j.preferences_restored,
      signed_out: s.j.signed_out,
      checks: s.j.checks,
    });
    fs.writeFileSync(
      "artifacts/phase2-screen-smoke-report.json",
      JSON.stringify(report, null, 2),
    );
  }
  if (process.exitCode) break;
}
if (!process.exitCode && !process.argv.includes("--doctor-only")) {
  assert.equal(
    new Set(report.screens.map((x) => x.id)).size,
    19,
    "All nineteen P2 screens must be observed across actual roles",
  );
  report.passed = true;
  delete report.error;
  fs.writeFileSync(
    "docs/phase2-screen-smoke-2026-10-25.json",
    JSON.stringify(report, null, 2),
  );
  console.log("PASS all19screens opened read-only across permitted roles");
}

```
