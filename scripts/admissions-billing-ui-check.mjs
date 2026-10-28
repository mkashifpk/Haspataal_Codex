// Continuation of this run's fresh records; do not replay after a partial result.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
const file = "artifacts/admissions-billing-ui-check.json";
assert(
  !fs.existsSync(file),
  "Reconcile this original journal before continuing",
);
const f = JSON.parse(
    fs.readFileSync("docs/pending-admissions-live-2026-10-28.json"),
  ),
  get = (n) => f.requests.find((x) => x.label === n).result;
const bill = get("arrival-scenario").saved,
  cr = get("known-patient-code-red").body.data,
  er = get("event-race-scenario").saved;
const j = { run: f.run, checks: [], intents: [], passed: false },
  save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
let s;
try {
  s = await session("admissions-billing-ui-actor", "demo.admissions");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  await s.nav("Pending admissions & allocation");
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
  };
  await open(cr.admission_id);
  await expect(p.getByTestId("admission-detail")).toContainText(
    "Deferred — confirmation required",
  );
  await expect(
    p.getByRole("button", { name: "Finalize this bill", exact: true }),
  ).toHaveCount(0);
  await p
    .getByLabel("Admission work to show", { exact: true })
    .selectOption("billing");
  await expect(
    p.getByTestId("admission-row").filter({ hasText: cr.mrn }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Confirm billing arrangements", exact: true })
    .click();
  let m = p.getByRole("dialog");
  await review(m);
  j.intents.push({
    kind: "confirm-known-patient-CodeRed-Cash",
    id: cr.admission_id,
  });
  save();
  await m
    .getByRole("button", { name: "Confirm admission action", exact: true })
    .click();
  await expect(m).toHaveCount(0);
  await expect(p.getByTestId("admission-detail")).not.toContainText(
    "Deferred — confirmation required",
  );
  pass(
    "Fresh known-identity CodeRed Billing-to-confirm list, deferred final bill hidden, explicit Cash confirmation200, current confirmed read",
  );
  await p
    .getByLabel("Admission work to show", { exact: true })
    .selectOption("live");
  await open(bill.admission_id);
  await expect(
    p.getByRole("button", { name: "Clear Billing Settlement", exact: true }),
  ).toBeEnabled();
  await p
    .getByRole("button", { name: "Clear Billing Settlement", exact: true })
    .click();
  m = p.getByRole("dialog");
  await m
    .getByLabel("Billing clearance note", { exact: true })
    .fill("DEMO zero-balance synthetic final bill; no money or real care");
  await review(m);
  await s.fault({
    failPath:
      "/admissions/" + bill.admission_id + "/discharge/BillingSettlement/clear",
    failMethod: "POST",
    once: true,
  });
  j.intents.push({
    kind: "clear-settled-zero-balance-lost-response",
    id: bill.admission_id,
  });
  save();
  await m
    .getByRole("button", { name: "Confirm admission action", exact: true })
    .click();
  await expect(m).toContainText("The result is unknown.");
  await expect(
    m.getByRole("button", { name: "Retry original request", exact: true }),
  ).toHaveCount(0);
  await m
    .getByRole("button", { name: "Read current result", exact: true })
    .click();
  await expect(m).toContainText("Imran (Admissions)");
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
    m.getByLabel("Billing clearance note", { exact: true }),
  ).toHaveValue(
    "DEMO zero-balance synthetic final bill; no money or real care",
  );
  await m
    .getByRole("button", { name: "Close admission draft", exact: true })
    .click();
  await expect(m).toHaveCount(0);
  await expect(p.getByTestId("admission-detail")).toContainText(
    "Already cleared",
  );
  await expect(p.getByTestId("admission-detail")).toContainText(
    "Imran (Admissions)",
  );
  await expect(
    p.getByRole("button", { name: "Clear Billing Settlement", exact: true }),
  ).toHaveCount(0);
  assert.equal(
    (await s.trace()).requests.filter(
      (x) =>
        x.method === "POST" &&
        x.path.endsWith(
          "/admissions/" +
            bill.admission_id +
            "/discharge/BillingSettlement/clear",
        ),
    ).length,
    1,
  );
  await help(
    s,
    p.getByRole("button", { name: "Refresh admissions and beds", exact: true }),
    "Pending admissions & allocation",
  );
  pass(
    "Settled actual zero-balance bill clearance200 with lost real reply: onePOST, exact discharge-status read, officer/time already-done, note preserved, no repeat",
  );
  // A second real terminal cancels a fresh pending record. The first must update from the event.
  const row = p.getByTestId("admission-row").filter({ hasText: er.mrn });
  await expect(row).toBeVisible();
  const eventKey = "admissions-event-" + Date.now();
  j.intents.push({
    kind: "cancel-on-other-terminal",
    id: er.admission_id,
    key: eventKey,
  });
  save();
  const {
    app: p2app,
    p: p2,
    native: n2,
    close: close2,
  } = await session("admissions-event-other", "demo.admissions");
  try {
    await n2("api", {
      method: "POST",
      path: "/admissions/" + er.admission_id + "/cancel",
      body: {
        reason: "DEMO second-terminal event verification; no actual admission",
      },
      key: eventKey,
    });
    await expect(row).toHaveCount(0);
  } finally {
    await close2();
  }
  pass(
    "Actual admission.cancelled from another authenticated terminal refreshes live worklist without manual refresh or polling",
  );
  // Actual stored synthetic outside report stays distinct from hospital tests.
  const patient = get("fresh-scenario").saved;
  await open(patient.admission_id);
  const png = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 60;
    const x = c.getContext("2d");
    x.fillText("DEMO outside report", 2, 30);
    return c.toDataURL("image/png").split(",")[1];
  });
  await p
    .getByLabel("Choose outside reports", { exact: true })
    .setInputFiles({
      name: "DEMO-outside-report.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await p
    .getByLabel("Report title", { exact: true })
    .fill("DEMO outside report");
  await p
    .getByLabel("Issued by facility", { exact: true })
    .fill("DEMO synthetic laboratory");
  await p
    .getByLabel("Document date", { exact: true })
    .fill(f.created.slice(0, 10));
  j.intents.push({ kind: "outside-report", patient_id: patient.patient_id });
  save();
  await p.getByRole("button", { name: "Upload report", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Report uploaded", exact: true }),
  ).toBeVisible();
  await expect(p.locator("main")).toContainText(
    "Outside: DEMO synthetic laboratory",
  );
  await p.getByRole("button", { name: /DEMO outside report · #/ }).click();
  m = p.getByRole("dialog");
  await expect(
    m.getByAltText("Patient document", { exact: true }),
  ).toBeVisible();
  await m.getByRole("button", { name: "Close", exact: true }).click();
  pass(
    "Outside report201 with real metadata/list/provenance and authenticated document download; no clinical result fabricated",
  );
  // Native Electron shortcuts must agree with the shared preference state.
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
  await s.prefs({ ui_scale_pct: 100 });
  await key("-");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBeGreaterThan(100);
  await s.prefs({ ui_scale_pct: 250 });
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("0");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await capture(s, "pending_admissions");
  pass(
    "Native Ctrl minus/plus/reset and Settings share100–250 bounds; refreshed compact EN/UR media and both-theme250 layouts",
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
