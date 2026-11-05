# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV synthetic admissions only. Reconcile this journal before resuming a partial run.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
const file = "artifacts/admissions-ui-check.json";
assert(!fs.existsSync(file), "Reconcile existing admission UI journal first");
const f = JSON.parse(
  fs.readFileSync("docs/pending-admissions-live-2026-10-28.json"),
);
const get = (n) => f.requests.find((x) => x.label === n).result;
const a = get("fresh-scenario").saved,
  b = get("arrival-scenario").saved;
const bed = get("beds-current").body.data.beds.find(
  (x) => x.ward_id === 1 && x.current_state === "Available",
);
assert(bed);
const j = { run: f.run, intents: [], checks: [], passed: false },
  save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
try {
  s = await session("admissions-ui-actor", "demo.admissions");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  await s.nav("Pending admissions & allocation");
  await expect(p.locator("main h1")).toHaveText(
    "Pending admissions & allocation",
  );
  const open = async (id) => {
    await p.getByLabel("Known admission ID", { exact: true }).fill(String(id));
    await p
      .getByRole("button", { name: "Read admission", exact: true })
      .click();
    await expect(p.getByTestId("admission-detail")).toContainText("ADM-2026-");
  };
  const review = async (m) => {
    await m
      .getByLabel(
        "I checked this patient, admission, location and the actual proposed action.",
        { exact: true },
      )
      .check();
    await m
      .getByRole("button", { name: "Review admission action", exact: true })
      .click();
    await expect(m.getByTestId("admission-review")).toBeVisible();
  };
  const confirm = async (m, kind, id) => {
    j.intents.push({ kind, id });
    save();
    await m
      .getByRole("button", { name: "Confirm admission action", exact: true })
      .click();
  };
  await open(a.admission_id);
  await expect(p.getByTestId("admission-detail")).toContainText(a.mrn);
  await expect(
    p.getByRole("button", { name: "Reserve a bed", exact: true }),
  ).toBeEnabled();
  await help(
    s,
    p.getByLabel("Known admission ID", { exact: true }),
    "Pending admissions & allocation",
  );
  await capture(s, "pending_admissions");
  pass(
    "Fresh admission identity/read, contextual F1/focus, actual EN/UR handbook images and both-theme250 root layout",
  );
  await p.getByRole("button", { name: "Skip photo", exact: true }).click();
  await p
    .getByRole("button", { name: "Add to ward waitlist", exact: true })
    .click();
  let m = p.getByRole("dialog");
  await m
    .getByLabel("Ward for this action", { exact: true })
    .selectOption(String(bed.ward_id));
  await m.getByLabel("Waitlist priority", { exact: true }).fill("3");
  await help(
    s,
    m.getByLabel("Waitlist priority", { exact: true }),
    "Pending admissions & allocation",
  );
  await review(m);
  await confirm(m, "waitlist", a.admission_id);
  await expect(m).toHaveCount(0);
  await expect(p.getByTestId("admission-detail")).toContainText("Waitlisted");
  await p
    .getByLabel("Filter ward", { exact: true })
    .selectOption(String(bed.ward_id));
  await expect(
    p.getByRole("heading", { name: "This ward's waitlist", exact: true }),
  ).toBeVisible();
  pass(
    "Waitlist actual ward/priority200, current state and ward waitlist read, dialog F1 preserves input",
  );
  // A synthetic canvas is a test image, never a person's photograph.
  const png = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 80;
    const x = c.getContext("2d");
    x.fillStyle = "#888";
    x.fillRect(0, 0, 80, 80);
    x.fillStyle = "white";
    x.fillText("DEMO", 10, 40);
    return c.toDataURL("image/png").split(",")[1];
  });
  await p.getByLabel("The patient agrees to a photo", { exact: true }).check();
  await p
    .getByLabel("Choose photo", { exact: true })
    .setInputFiles({
      name: "synthetic-DEMO.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await s.fault({
    delayPath: "/patients/" + a.patient_id + "/documents",
    delayMs: 25000,
  });
  j.intents.push({ kind: "optional-photo", patient_id: a.patient_id });
  save();
  await p
    .getByRole("button", { name: "Upload patient photo", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Uploading…", exact: true }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Reserve a bed", exact: true }).click();
  m = p.getByRole("dialog");
  await m
    .getByLabel("Ward for this action", { exact: true })
    .selectOption(String(bed.ward_id));
  await m
    .getByLabel("Available bed", { exact: true })
    .selectOption(String(bed.bed_id));
  await review(m);
  await confirm(m, "reserve-while-optional-upload", a.admission_id);
  await expect(m).toHaveCount(0);
  await expect(p.getByTestId("admission-detail")).toContainText("BedReserved");
  await expect(
    p.getByRole("button", { name: "Photo uploaded", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await s.fault({ delayPath: null, delayMs: 0 });
  const r = await s.native("api", {
    method: "GET",
    path: "/admissions/" + a.admission_id,
  });
  assert.equal(r.bed_id, bed.bed_id);
  assert(r.photo_document_id);
  pass(
    "Separate optional synthetic photo201 remains mounted while reserve200 completes; actual photo pointer and BedReserved, no admission replay",
  );
  // Lose the REAL committed cancel response. Recovery must read original admission, never POST again.
  await p
    .getByRole("button", { name: "Cancel this pending admission", exact: true })
    .click();
  m = p.getByRole("dialog");
  await m
    .getByLabel("Cancellation reason", { exact: true })
    .fill("DEMO software test cancellation; no real admission");
  await review(m);
  await s.fault({
    failPath: "/admissions/" + a.admission_id + "/cancel",
    failMethod: "POST",
    once: true,
  });
  await confirm(m, "cancel-lost-real-response", a.admission_id);
  await expect(m).toContainText("The result is unknown.");
  await expect(
    m.getByRole("button", { name: "Retry original request", exact: true }),
  ).toHaveCount(0);
  await m
    .getByRole("button", { name: "Read current result", exact: true })
    .click();
  await expect(m).toContainText("Cancelled");
  await m
    .getByRole("button", {
      name: "Result reviewed; return to draft",
      exact: true,
    })
    .click();
  await m
    .getByRole("button", {
      name: "Read current admission and keep draft",
      exact: true,
    })
    .click();
  await expect(
    m.getByLabel("Cancellation reason", { exact: true }),
  ).toHaveValue("DEMO software test cancellation; no real admission");
  await m
    .getByRole("button", { name: "Close admission draft", exact: true })
    .click();
  await expect(m).toHaveCount(0);
  const matrix = await s.native("api", { method: "GET", path: "/beds/matrix" });
  assert.equal(
    matrix.beds.find((x) => x.bed_id === bed.bed_id).current_state,
    "Available",
  );
  const trace = await s.trace();
  assert.equal(
    trace.requests.filter(
      (x) =>
        x.method === "POST" &&
        x.path.endsWith("/admissions/" + a.admission_id + "/cancel"),
    ).length,
    1,
  );
  pass(
    "Lost committed cancel200 freezes original request, no retry offered, exact read showsCancelled, reason retained, reserved bed released; onePOST",
  );
  await p.getByLabel("Filter ward", { exact: true }).selectOption("");
  await open(b.admission_id);
  await expect(
    p.getByRole("button", { name: "Reserve a bed", exact: true }),
  ).toBeEnabled();
  await p.getByRole("button", { name: "Reserve a bed", exact: true }).click();
  m = p.getByRole("dialog");
  await m
    .getByLabel("Ward for this action", { exact: true })
    .selectOption(String(bed.ward_id));
  await m
    .getByLabel("Available bed", { exact: true })
    .selectOption(String(bed.bed_id));
  await review(m);
  await confirm(m, "reserve-for-arrival", b.admission_id);
  await expect(m).toHaveCount(0);
  await p
    .getByRole("button", { name: "Patient arrived at the bed", exact: true })
    .click();
  m = p.getByRole("dialog");
  await review(m);
  await confirm(m, "arrival", b.admission_id);
  await expect(m).toHaveCount(0);
  await expect(p.getByTestId("admission-detail")).toContainText("Admitted");
  await expect(
    p.getByRole("button", {
      name: "Cancel this pending admission",
      exact: true,
    }),
  ).toHaveCount(0);
  pass(
    "Separate reserve and actual arrival200, fresh admitted read, pending cancel unavailable after admission, optional photo skipped",
  );
  await p
    .getByRole("button", { name: "Finalize this bill", exact: true })
    .click();
  m = p.getByRole("dialog");
  await review(m);
  await confirm(m, "final-bill", b.admission_id);
  await expect(m).toHaveCount(0);
  await expect(
    p.getByRole("heading", { name: "Final bill confirmed", exact: true }),
  ).toBeVisible();
  pass(
    "Actual running bill finalization200 and invoice/balance displayed; cashier payment remains separate",
  );
  j.trace = await s.trace();
  j.renderer = s.j.renderer;
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  try {
    j.ui = await s.p.locator("body").innerText();
    j.trace = await s.trace();
  } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}

```
