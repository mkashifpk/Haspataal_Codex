// Real retained synthetic patient18/ticket14. New note/correction only; no registration/payment/physical print.
import { session, expect, capture, help } from "./clinical-test-kit.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const oldFile = "artifacts/consultation-check.json";
const prior = fs.existsSync(oldFile)
  ? JSON.parse(fs.readFileSync(oldFile))
  : undefined;
const resume = process.argv.includes("--resume");
const s = await session("consultation-check", "demo.doctor2");
const p = s.p;
s.j.run = resume && prior?.run ? prior.run : "DEMO-CONSULTATION-" + Date.now();
s.save();
const noteRequests = async (method) =>
  (await s.trace()).requests.filter(
    (r) =>
      r.method === method && /^\/api\/v1\/clinical-encounters/.test(r.path),
  );
try {
  const ticket = await s.native("api", {
    method: "GET",
    path: "/opd-tickets/14",
  });
  assert.equal(ticket.patient_id, 18);
  assert.equal(ticket.doctor_id, 11);
  assert(!ticket.is_clinical_locked);
  s.j.fixture = {
    patient_id: 18,
    ticket_id: 14,
    queue_id: ticket.queue.queue_id,
    invoice_id: 14,
  };
  s.save();
  const baseline = await s.native("api", {
    method: "GET",
    path: "/opd-tickets/14/clinical-encounters",
  });
  if (!resume)
    assert.equal(
      baseline.length,
      0,
      "Reconcile existing notes instead of creating replacements",
    );
  else
    assert(
      prior?.run && baseline.some((n) => n.chief_complaint === s.j.run),
      "Original note must be re-read before continuation",
    );
  await s.nav("My live queue");
  const card = p
    .locator(".doctor-token")
    .filter({ hasText: ticket.ticket_number });
  if (ticket.status === "Waiting") {
    await card
      .getByRole("button", { name: "Call patient", exact: true })
      .click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(card).toContainText("InConsultation");
  }
  await card
    .getByRole("button", { name: "Open consultation", exact: true })
    .click();
  await expect(p.locator("main h1")).toHaveText("Consultation (EMR)");
  const complaint = p.getByLabel("Chief complaint", { exact: true }),
    history = p.getByLabel("History", { exact: true });
  if (!resume) {
    await expect(
      p.getByRole("button", {
        name: "Verbal consent obtained (VCO)",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      p.getByRole("button", { name: "Patient declined", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await complaint.fill(s.j.run);
    await history.fill(
      "Synthetic software verification only; no clinical care.",
    );
    await p
      .getByRole("button", { name: "Patient declined", exact: true })
      .click();
    await expect(
      p.getByLabel("Examination findings", { exact: true }),
    ).toBeDisabled();
    await p
      .getByRole("button", {
        name: "Verbal consent obtained (VCO)",
        exact: true,
      })
      .click();
    await p
      .getByLabel("Examination findings", { exact: true })
      .fill("Synthetic examination text for software verification only.");
    await p
      .getByLabel("Diagnosis", { exact: true })
      .fill("Synthetic coded workflow test");
    await p
      .getByLabel("Plan / treatment / referral", { exact: true })
      .fill("Synthetic test; no treatment or medicines.");
    await help(s, complaint, "Consultation (EMR)");
    await expect(complaint).toHaveValue(s.j.run);
    await p
      .getByRole("button", { name: "Add diagnosis code", exact: true })
      .click();
    const q = p.getByLabel("Code prefix or diagnosis words", { exact: true });
    await q.fill("CA40");
    await expect(p.locator("dialog .list-row").first()).toBeVisible();
    await help(s, q, "ICD code picker");
    await p.locator("dialog .list-row").first().click();
    await p
      .getByRole("button", { name: "Choose this diagnosis code", exact: true })
      .click();
    await s.fault({
      failPath: "/clinical-encounters",
      failMethod: "POST",
      once: true,
    });
    s.j.create_pending = true;
    s.save();
    await p
      .getByRole("button", { name: "Save draft note", exact: true })
      .dblclick();
    await expect(
      p.getByText(
        "The result is unknown. This draft and navigation stay locked; do not create a replacement.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(complaint).toBeDisabled();
    await p.keyboard.press("Escape");
    const first = (await noteRequests("POST")).filter(
      (r) => r.path === "/api/v1/clinical-encounters",
    );
    assert.equal(first.length, 1);
    assert(first[0].finished && first[0].status < 300);
    s.j.original_create = first[0];
    s.save();
    assert(first[0].body.icd_codes.every((c) => typeof c === "string"));
    assert.equal(first[0].body.examination_consent, "VerbalObtained");
    await p
      .getByRole("button", { name: "Retry original request", exact: true })
      .click();
    await expect(complaint).toBeEnabled();
    const writes = (await noteRequests("POST")).filter(
      (r) => r.path === "/api/v1/clinical-encounters",
    );
    assert.equal(writes.length, 2);
    assert.equal(writes[0].key, writes[1].key);
    assert.deepEqual(writes[0].body, writes[1].body);
    assert.equal(
      writes[0].result.data.encounter_id,
      writes[1].result.data.encounter_id,
    );
    assert.equal(writes[1].replay, "true");
    s.j.note_id = writes[0].result.data.encounter_id;
    s.j.create_pending = false;
    s.save();
    s.pass(
      "Queue→consultation preserves real identity; deliberate consent and code-only selection; lost committed draft201/200 original-key replay returns SAME note, double-click single-flight, F1/ICD focus preserved",
    );
  } else {
    s.j.note_id = baseline.find(
      (n) => n.chief_complaint === s.j.run,
    ).encounter_id;
    await p
      .getByRole("button")
      .filter({ hasText: `#${s.j.note_id} ·` })
      .first()
      .click();
    s.save();
  }
  let saved = await s.native("api", {
    method: "GET",
    path: `/clinical-encounters/${s.j.note_id}`,
  });
  if (saved.status === "Draft") {
    await history.fill("Synthetic updated draft observation.");
    await p
      .getByRole("button", { name: "Save draft changes", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Finalize saved note", exact: true }),
    ).toBeEnabled();
    const patch = (await noteRequests("PATCH")).at(-1);
    assert.equal(patch.status, 200);
    assert.equal(patch.body.expected_version, saved.row_version);
    saved = patch.result.data;
    await history.fill(
      "Retained stale draft; must not overwrite external update.",
    );
    const external = await s.native("api", {
      method: "PATCH",
      path: `/clinical-encounters/${s.j.note_id}`,
      body: {
        expected_version: saved.row_version,
        history: "Concurrent synthetic change",
      },
      key: `consultation-concurrent-${s.j.note_id}-${Date.now()}`,
    });
    s.j.concurrent_version = external.row_version;
    s.save();
    const count = (await noteRequests("PATCH")).length;
    await p
      .getByRole("button", { name: "Save draft changes", exact: true })
      .click();
    await expect(
      p
        .getByRole("alert")
        .filter({ hasText: "This note changed on another terminal." }),
    ).toBeVisible();
    await expect(history).toHaveValue(
      "Retained stale draft; must not overwrite external update.",
    );
    assert.equal((await noteRequests("PATCH")).length, count);
    p.once("dialog", (d) => d.accept());
    await p
      .getByRole("button", {
        name: "Reload note and discard unsaved edits",
        exact: true,
      })
      .click();
    await expect(history).toHaveValue("Concurrent synthetic change");
    s.pass(
      "Draft PATCH uses original expected_version; external real concurrent change blocks stale write before PATCH, keeps text until explicit discard/reload",
    );
    await s.fault({
      failPath: `/clinical-encounters/${s.j.note_id}/finalize`,
      failMethod: "POST",
      once: true,
    });
    s.j.finalize_pending = true;
    s.save();
    await p
      .getByRole("button", { name: "Finalize saved note", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Read current result", exact: true }),
    ).toBeVisible();
    assert.equal(
      await p
        .getByRole("button", { name: "Retry original request", exact: true })
        .count(),
      0,
    );
    await p
      .getByRole("button", { name: "Read current result", exact: true })
      .click();
    await p
      .getByRole("button", {
        name: "Result reviewed; return to draft",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", {
        name: "Reload note and discard unsaved edits",
        exact: true,
      })
      .click();
    await expect(
      p.getByRole("button", { name: "Append correction", exact: true }),
    ).toBeVisible();
    s.j.finalize_pending = false;
    s.save();
    assert.equal(
      (await noteRequests("POST")).filter((r) => r.path.endsWith("/finalize"))
        .length,
      1,
    );
    s.pass(
      "Lost finalized200 reply reconciles by GET; no finalize replay; Final note is read-only",
    );
  }
  saved = await s.native("api", {
    method: "GET",
    path: `/clinical-encounters/${s.j.note_id}`,
  });
  assert.equal(saved.status, "Final");
  assert(saved.author_stamp?.text);
  await expect(p.locator("main")).toContainText(saved.author_stamp.text);
  if (!saved.corrections.some((c) => c.correction_reason === s.j.run)) {
    await p
      .getByRole("button", { name: "Append correction", exact: true })
      .click();
    await p
      .getByLabel("Correction text", { exact: true })
      .fill("Synthetic append-only correction; original retained.");
    await p.getByLabel("Reason", { exact: true }).fill(s.j.run);
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm clinical action", exact: true })
      .click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await expect(
      p.getByText("Synthetic append-only correction; original retained.", {
        exact: true,
      }),
    ).toBeVisible();
  }
  const final = await s.native("api", {
    method: "GET",
    path: `/clinical-encounters/${s.j.note_id}`,
  });
  assert.equal(final.chief_complaint, s.j.run);
  assert(
    final.corrections.some(
      (c) => c.correction_reason === s.j.run && c.author_stamp.text,
    ),
  );
  s.j.final = final;
  s.save();
  s.pass(
    "Final author stamp displayed; reasoned append-only correction retains original note and separate author stamp",
  );
  await s.app.evaluate(({ dialog, app }, name) => {
    globalThis.clinicalTrace.saveFile = name;
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath:
        process.cwd() + "/artifacts/" + globalThis.clinicalTrace.saveFile,
    });
    const patch = (w) => {
      w.webContents.print = (_, cb) => {
        globalThis.clinicalTrace.prints++;
        cb(false, "TEST: user cancelled clinical printing");
      };
    };
    app.on("browser-window-created", (_, w) => patch(w));
  }, "consultation-note-en.pdf");
  const before = (await noteRequests("POST")).length;
  await p.getByRole("button", { name: "Save note PDF", exact: true }).click();
  await expect(p.getByText("PDF saved.", { exact: true })).toBeVisible();
  assert(
    fs
      .readFileSync("artifacts/consultation-note-en.pdf")
      .subarray(0, 5)
      .toString() === "%PDF-",
  );
  await s.app.evaluate(() => {
    globalThis.clinicalTrace.saveFile = "consultation-note-server.pdf";
  });
  await p
    .getByRole("button", { name: "Download server PDF", exact: true })
    .click();
  await expect
    .poll(() => fs.existsSync("artifacts/consultation-note-server.pdf"))
    .toBe(true);
  assert.equal(
    fs
      .readFileSync("artifacts/consultation-note-server.pdf")
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  await p.getByRole("button", { name: "Print note", exact: true }).click();
  await expect(
    p
      .getByRole("alert")
      .filter({
        hasText: /cancelled clinical|No document printer|not installed/,
      }),
  ).toBeVisible();
  assert.equal((await noteRequests("POST")).length, before);
  await capture(s, "consultation");
  await s.prefs({ language: "ur", theme: "Light", ui_scale_pct: 100 });
  await s.app.evaluate(() => {
    globalThis.clinicalTrace.saveFile = "consultation-note-ur.pdf";
  });
  await p
    .getByRole("button", { name: "نوٹ پی ڈی ایف محفوظ کریں", exact: true })
    .click();
  await expect
    .poll(() => fs.existsSync("artifacts/consultation-note-ur.pdf"))
    .toBe(true);
  assert.equal(
    fs
      .readFileSync("artifacts/consultation-note-ur.pdf")
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  s.pass(
    "Final note A4 EN/UR PDFs and real server PDF; printer refusal/cancel visible without extra note writes; bilingual both-theme250 screenshots",
  );
  s.j.business_complete = true;
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  try {
    await p.screenshot({ path: "artifacts/consultation-failure.png" });
    s.j.failure_ui = await p.locator("body").innerText();
    s.save();
  } catch {}
  process.exitCode = 1;
} finally {
  await s.close();
}
