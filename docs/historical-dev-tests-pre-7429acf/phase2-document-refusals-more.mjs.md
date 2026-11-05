# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Invalid synthetic files exercise genuine server refusals; no clinical documents fabricated.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const file = "docs/phase2-document-refusals-more-2026-10-25.json";
assert(
  !fs.existsSync(file),
  "Read original refusal results; never repeat uncertain file upload",
);
const j = { cases: [] };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const s = await session("phase2-document-refusals-more", "demo.reception"),
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
  const previous = await s.native("api", {
    method: "GET",
    path: "/patients/5/documents",
  });
  j.before = previous.map((x) => x.document_id);
  save();
  const valid = JSON.parse(
    fs.readFileSync("docs/phase2-document-recovery-evidence-2026-10-25.json"),
  ).original_file;
  const cases = [
    {
      name: "DEMO-not-a-report.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("DEMO software refusal only, no clinical report"),
      date: "2026-10-25",
      code: "LOCAL_UPLOAD_REJECTED",
    },
    {
      name: "DEMO-false-png.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "DEMO plaintext falsely labelled PNG, intentional refusal",
      ),
      date: "2026-10-25",
      code: "UNSUPPORTED_MEDIA_TYPE",
    },
    {
      name: "DEMO-damaged-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(valid.synthetic_base64, "base64").subarray(
        0,
        Math.floor(Buffer.from(valid.synthetic_base64, "base64").length / 2),
      ),
      date: "2026-10-25",
      code: "VALIDATION_ERROR",
    },
    {
      name: "DEMO-future-document.png",
      mimeType: "image/png",
      buffer: Buffer.from(valid.synthetic_base64, "base64"),
      date: "2099-01-01",
      code: "VALIDATION_ERROR",
    },
  ];
  for (const c of cases.filter(
    (x) =>
      x.name === "DEMO-damaged-image.png" ||
      x.name === "DEMO-future-document.png",
  )) {
    const item = {
      filename: c.name,
      type: c.mimeType,
      date: c.date,
      sha256: crypto.createHash("sha256").update(c.buffer).digest("hex"),
      size: c.buffer.length,
      pending: true,
    };
    j.cases.push(item);
    save();
    await p
      .getByLabel("Choose outside reports", { exact: true })
      .setInputFiles({ name: c.name, mimeType: c.mimeType, buffer: c.buffer });
    const draft = p
      .locator("div.card")
      .filter({ has: p.getByText(c.name, { exact: true }) })
      .last();
    await draft
      .getByLabel("Report title", { exact: true })
      .fill("DEMO refusal-only " + c.name);
    await draft
      .getByLabel("Issued by facility", { exact: true })
      .fill("DEMO test source; not a clinical facility");
    await draft.getByLabel("Document date", { exact: true }).fill(c.date);
    await draft
      .getByRole("button", { name: "Upload report", exact: true })
      .click();
    await expect(draft.getByRole("alert")).toBeVisible();
    await expect(
      draft.getByLabel("Report title", { exact: true }),
    ).toBeEnabled();
    const attempts = (await s.trace()).requests.filter(
      (x) => x.method === "POST" && x.path === "/api/v1/patients/5/documents",
    );
    const actual = attempts.at(-1);
    if (c.code === "LOCAL_UPLOAD_REJECTED") {
      assert.equal(attempts.length, 0);
      await expect(draft.getByRole("alert")).toContainText(c.code);
      assert.equal((await s.native("state")).connected, true);
      item.response = {
        local_rejection: true,
        request_sent: false,
        code: c.code,
        no_http_post: true,
      };
    } else {
      assert.equal(actual.result?.error?.code, c.code);
      item.response = actual;
    }
    delete item.pending;
    save();
    await draft.getByRole("button", { name: "Remove", exact: true }).click();
  }
  const after = await s.native("api", {
    method: "GET",
    path: "/patients/5/documents",
  });
  assert.deepEqual(
    after.map((x) => x.document_id),
    j.before,
  );
  s.pass(
    "Real 415 wrong MIME/content and422 damaged image/future date; UI shows refusal/unlocks draft for correction/removal, no stored document added, no registration/payment/clinical write",
  );
  s.j.passed = true;
  s.save();
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.close();
  j.session = {
    renderer: s.j.renderer,
    preferences_restored: s.j.preferences_restored,
    signed_out: s.j.signed_out,
    trace: s.j.trace,
  };
  save();
}

```
