# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV synthetic attachments only. Never registers or pays; never rerun confirmed uploads.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
const previewOnly = process.argv.includes("--preview-only");
const evidence = "docs/phase2-document-fresh-evidence-2026-10-25.json";
if (!previewOnly && fs.existsSync(evidence))
  assert(
    !JSON.parse(fs.readFileSync(evidence)).uploads_started,
    "Read original receipts; never repeat attachments to obtain evidence",
  );
const s = await session("phase2-document-fresh", "demo.reception"),
  p = s.p;
const j = {
  at: new Date().toISOString(),
  patient_id: 5,
  run: "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  checks: [],
  uploads_started: false,
};
const save = () => {
  s.save();
  fs.writeFileSync(evidence, JSON.stringify(j, null, 2));
};
const uploaded = async () =>
  (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/patients/5/documents",
  );
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(patient.full_name, j.run);
  await s.nav("Patient document vault");
  await p
    .getByLabel("Patient name, mobile, CNIC or MRN", { exact: true })
    .fill(patient.mrn);
  await p.getByRole("button", { name: "Search", exact: true }).click();
  await p
    .getByRole("button", { name: new RegExp(patient.mrn + " · " + j.run) })
    .click();
  const consent = p.getByLabel("The patient agrees to a photo", {
      exact: true,
    }),
    file = p.getByLabel("Choose photo", { exact: true });
  await expect(file).toBeDisabled();
  await expect(consent).not.toBeChecked();
  await consent.check();
  await file.setInputFiles({
    name: "DEMO-not-photo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 DEMO ONLY"),
  });
  await expect(
    p.getByText("Choose a JPEG or PNG patient photo.", { exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Skip photo", exact: true }).click();
  await expect(
    p.getByText("Choose a JPEG or PNG patient photo.", { exact: true }),
  ).toHaveCount(0);
  await expect(consent).not.toBeChecked();
  await expect(file).toBeDisabled();
  const png = Buffer.from(
    await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 260;
      c.height = 100;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, 260, 100);
      x.fillStyle = "black";
      x.font = "18px sans-serif";
      x.fillText("DEMO ONLY - NO PATIENT", 8, 55);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  const photo = {
    name: "DEMO-only-synthetic.png",
    mimeType: "image/png",
    buffer: png,
  };
  await consent.check();
  await file.setInputFiles(photo);
  await expect(
    p.getByAltText("Patient photo preview", { exact: true }),
  ).toBeVisible();
  assert.equal(await file.inputValue(), "");
  await p.getByRole("button", { name: "Skip photo", exact: true }).click();
  await consent.check();
  await file.setInputFiles(photo);
  await expect(
    p.getByAltText("Patient photo preview", { exact: true }),
  ).toBeVisible();
  await help(s, file, "Patient document vault");
  j.checks.push(
    "Optional photo starts disabled without consent; invalid PDF rejected locally; Skip clears stale error and consent; identical file can be chosen again; F1 preserves preview/focus",
  );
  save();
  if (!previewOnly) {
    const before = await s.native("api", {
      method: "GET",
      path: "/patients/5/documents",
    });
    j.before = before;
    j.uploads_started = true;
    save();
    await p
      .getByRole("button", { name: "Upload patient photo", exact: true })
      .dblclick();
    await expect(
      p.getByRole("button", { name: "Photo uploaded", exact: true }),
    ).toBeVisible();
    j.photo_upload = (await uploaded()).filter((r) => r.status === 201);
    assert.equal(j.photo_upload.length, 1);
    save();
    const afterPhoto = await s.native("api", {
      method: "GET",
      path: "/patients/5",
    });
    assert.equal(
      afterPhoto.photo_document_id,
      j.photo_upload[0].result.data.document_id,
    );
    await p
      .getByLabel("Choose outside reports", { exact: true })
      .setInputFiles({ ...photo, name: "DEMO-only-outside-report.png" });
    await p
      .getByLabel("Report title", { exact: true })
      .fill("DEMO ONLY outside report - no clinical result");
    await p.getByLabel("Document date", { exact: true }).fill("2026-10-25");
    const n = (await uploaded()).length;
    await p.getByRole("button", { name: "Upload report", exact: true }).click();
    await expect(
      p.getByText(
        "Enter report title, issuing facility and the date on the document.",
        { exact: true },
      ),
    ).toBeVisible();
    assert.equal((await uploaded()).length, n);
    await p
      .getByLabel("Issued by facility", { exact: true })
      .fill("DEMO ONLY external facility");
    await help(
      s,
      p.getByLabel("Report title", { exact: true }),
      "Patient document vault",
    );
    await p
      .getByRole("button", { name: "Upload report", exact: true })
      .dblclick();
    await expect(
      p.getByRole("button", { name: "Report uploaded", exact: true }),
    ).toBeVisible();
    j.uploads = await uploaded();
    assert.equal(j.uploads.length, 2);
    assert(j.uploads.every((x) => x.status === 201));
    assert.notEqual(j.uploads[0].key, j.uploads[1].key);
    save();
    const docs = await s.native("api", {
      method: "GET",
      path: "/patients/5/documents",
    });
    j.after = docs;
    const report = docs.find(
      (d) => d.document_id === j.uploads[1].result.data.document_id,
    );
    assert(report.is_outside);
    assert.equal(report.source_facility, "DEMO ONLY external facility");
    await expect(
      p.getByText(/Outside: DEMO ONLY external facility, 2026-10-25/),
    ).toBeVisible();
    assert.equal(
      (await s.trace()).requests.filter((r) => r.path.includes("/download"))
        .length,
      0,
    );
    await p
      .getByRole("button", { name: "View current patient photo", exact: true })
      .click();
    const dialog = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", { name: "Patient document", exact: true }),
      });
    await expect(
      dialog.getByAltText("Patient document", { exact: true }),
    ).toBeVisible();
    await help(
      s,
      dialog.getByRole("button", { name: "Close", exact: true }),
      "Patient document vault",
    );
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    j.checks.push(
      "Two separate real uploads on verified patient5, one POST per double-click/distinct keys; metadata validation sends no POST; photo pointer and outside provenance read back; no automatic download; explicit current photo viewer/F1",
    );
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
    await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  }
  assert.equal(
    (await s.trace()).requests.filter(
      (r) => r.method !== "GET" && !r.path.endsWith("/documents"),
    ).length,
    0,
  );
  j.passed = true;
  s.j.passed = true;
  save();
  console.log(JSON.stringify({ passed: true, previewOnly, checks: j.checks }));
} catch (e) {
  j.error = e.stack;
  s.j.error = e.stack;
  save();
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
  j.session = {
    passed: s.j.passed,
    preferences_restored: s.j.preferences_restored,
    signed_out: s.j.signed_out,
    renderer: s.j.renderer,
    trace: s.j.trace,
  };
  save();
}

```
