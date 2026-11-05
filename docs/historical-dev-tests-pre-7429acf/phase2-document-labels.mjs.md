# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const source = JSON.parse(
  fs.readFileSync("docs/phase2-document-recovery-evidence-2026-10-25.json"),
);
assert(source.passed);
const s = await session("phase2-document-labels", "demo.reception"),
  p = s.p;
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
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
  await expect(
    p.getByRole("heading", { name: "Stored patient documents", exact: true }),
  ).toBeVisible();
  await p
    .getByLabel("Choose outside reports", { exact: true })
    .setInputFiles({
      name: "DEMO label-only unsent.png",
      mimeType: "image/png",
      buffer: Buffer.from(source.original_file.synthetic_base64, "base64"),
    });
  const draft = p
    .locator("div.card")
    .filter({ has: p.getByText("DEMO label-only unsent.png", { exact: true }) })
    .last();
  const select = draft.locator("select[data-help=\"registration.documents\"]");
  await expect(select.locator("option[value=LabReport]")).toHaveText(
    "Lab report",
  );
  await expect(select.locator("option")).toHaveCount(6);
  await draft
    .getByRole("checkbox", { name: "Outside document", exact: true })
    .uncheck();
  await expect(select.locator("option")).toHaveCount(13);
  await s.prefs({ language: "ur" });
  await expect(select.locator("option[value=LabReport]")).toHaveText(
    "لیب رپورٹ",
  );
  await expect(select.locator("option[value=DeathCertificate]")).toHaveText(
    "وفات کا سرٹیفکیٹ",
  );
  await expect(select.locator("option[value=CNIC]")).toHaveText("شناختی کارڈ");
  await expect(select.locator("option[value=Prescription]")).toHaveText("نسخہ");
  await s.prefs({ language: "en" });
  await draft.getByRole("button", { name: "Remove", exact: true }).click();
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({
      path: "public/handbook/patient_documents-" + language + ".png",
      fullPage: true,
    });
    for (const theme of ["Light", "DarkHighContrast"]) {
      await s.prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
    }
  }
  assert.equal(
    (await s.trace()).requests.filter((x) => x.method !== "GET").length,
    0,
  );
  s.pass(
    "Actual document type controls show readable EN/UR names with unchanged wire values; outside6/hospital13 choices, unsent file removable; noPOST; final ENURthemes250/fullpage images",
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

```
