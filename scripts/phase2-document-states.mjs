// Actual protected downloads and list failures, read-only. Never replaces uploaded records.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const source = JSON.parse(
  fs.readFileSync("docs/phase2-document-recovery-evidence-2026-10-25.json"),
);
assert(source.passed);
const doc = source.saved;
const s = await session("phase2-document-states", "demo.reception"),
  p = s.p;
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  assert.equal(doc.patient_id, patient.patient_id);
  await s.nav("Patient document vault");
  await p
    .getByLabel("Patient name, mobile, CNIC or MRN", { exact: true })
    .fill(patient.mrn);
  await p.getByRole("button", { name: "Search", exact: true }).click();
  await p
    .getByRole("button", {
      name: new RegExp(patient.mrn + " · " + patient.full_name),
    })
    .click();
  const row = p.getByRole("button", {
    name: doc.title + " · #" + doc.document_id,
    exact: true,
  });
  await expect(row).toBeVisible();
  assert.equal(
    (await s.trace()).requests.filter((x) => x.path.includes("/download"))
      .length,
    0,
  );
  await s.fault({
    failPath: "/api/v1/patients/5/documents",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Refresh documents", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(
    p.getByText("No patient documents have been uploaded.", { exact: true }),
  ).toHaveCount(0);
  await s.fault({ failPath: null });
  await p.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(row).toBeVisible();
  await s.fault({
    failPath: "/api/v1/patient-documents/" + doc.document_id + "/download",
    failMethod: "GET",
    once: false,
  });
  await row.click();
  await expect(p.locator("main .error[role=alert]").first()).toBeVisible();
  await expect(
    p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", { name: "Patient document", exact: true }),
      }),
  ).toHaveCount(0);
  await s.fault({ failPath: null });
  await row.click();
  const modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", { name: "Patient document", exact: true }),
    });
  await expect(
    modal.getByAltText("Patient document", { exact: true }),
  ).toBeVisible();
  await help(
    s,
    modal.getByRole("button", { name: "Close", exact: true }),
    "Patient document vault",
  );
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await s.prefs({ ui_scale_pct: 245 });
  const win = await s.app.browserWindow(p);
  const key = async (k) =>
    win.evaluate((w, k) => {
      for (const type of ["keyDown", "keyUp"])
        w.webContents.sendInputEvent({
          type,
          keyCode: k,
          modifiers: ["control"],
        });
    }, k);
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("=");
  assert.equal((await s.native("state")).prefs.ui_scale_pct, 250);
  await expect
    .poll(
      async () =>
        (await s.native("api", { method: "GET", path: "/auth/me" })).preferences
          .ui_scale_pct,
    )
    .toBe(250);
  await key("0");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await key("-");
  assert.equal((await s.native("state")).prefs.ui_scale_pct, 100);
  assert.equal(
    (await s.trace()).requests.filter((x) => x.method !== "GET").length,
    0,
  );
  s.pass(
    "Actual populated vault list failure hides cached rows/no falseempty; Retry restores. No automatic downloads; explicit protected read failure no stale viewer, deliberate row retry succeeds; modalF1/focus; native100-250/reset/persistedserverprefs; zero business writes",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.fault({ failPath: null, delayPath: null });
  await expect
    .poll(
      async () =>
        (
          await p.evaluate(() =>
            window.terminal.call("api", { method: "GET", path: "/auth/me" }),
          )
        ).ok,
      { timeout: 60000 },
    )
    .toBe(true);
  await s.close();
}
