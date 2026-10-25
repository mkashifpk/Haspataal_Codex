// Fresh synthetic upstream letter, then real Quality read-only review. No actual transfer/acknowledgement.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { session, expect, help } from "./clinical-test-kit.mjs";
const file = "docs/reset-referral-register-evidence-2026-10-25.json";
assert(
  !fs.existsSync(file),
  "Reconcile original referral; never recreate or repeat cancellation",
);
const fixture = JSON.parse(
  fs.readFileSync("artifacts/reset-postconsult-waiver.json"),
);
assert(
  fixture.passed && fixture.account_deactivated && fixture.terminal_deactivated,
);
const j = {
  run: "DEMO-REGISTER-" + Date.now(),
  started: new Date().toISOString(),
  checks: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let q, d, c;
try {
  q = await session("reset-referral-register-quality", "demo.quality");
  const p = q.p;
  await q.nav("Referral register");
  await expect(p.locator("main h1")).toHaveText("Referral register");
  await expect(p.locator("main")).toContainText(
    "Access to the register and individual records is logged.",
  );
  d = await session("reset-referral-upstream", "demo.doctor");
  const dp = d.p;
  const ticket = await d.native("api", {
    method: "GET",
    path: "/opd-tickets/" + fixture.waiver_ticket.ticket_id,
  });
  assert.equal(ticket.patient_name, fixture.waiver_ticket.patient_name);
  assert.equal(ticket.patient_id, fixture.waiver_ticket.patient_id);
  assert(!ticket.is_clinical_locked);
  await d.nav("Consultation (EMR)");
  await dp
    .getByLabel("OPD slip number", { exact: true })
    .fill(ticket.ticket_number);
  await dp.getByLabel("OPD slip number", { exact: true }).press("Enter");
  await expect(dp.locator("main")).toContainText(ticket.mrn);
  await dp
    .getByRole("button", { name: "External referral", exact: true })
    .click();
  await expect(
    dp.getByLabel("Referral consultation note", { exact: true }),
  ).toHaveValue(String(fixture.note.encounter_id));
  await dp.getByLabel("At the patient’s request", { exact: true }).check();
  await dp
    .getByLabel("Patient-chosen facility name", { exact: true })
    .fill("DEMO receiving facility — no actual transfer");
  await dp.getByLabel("Referral reason", { exact: true }).fill(j.run);
  await dp
    .getByLabel("Referral urgency", { exact: true })
    .selectOption("Routine");
  await dp
    .getByLabel("Referral transport", { exact: true })
    .selectOption("WithStaff");
  await dp
    .getByLabel("Escort name", { exact: true })
    .fill("DEMO escort plan only — no transfer");
  await dp
    .getByLabel("Referral clinical summary", { exact: true })
    .fill(
      "DEMO SOFTWARE TEST ONLY; no actual care, diagnosis or transfer. " +
        j.run,
    );
  await dp
    .getByLabel(
      "I reviewed and confirm the complaint, findings and provisional diagnosis for this referral.",
      { exact: true },
    )
    .check();
  j.pending = {
    stage: "issue one new synthetic referral",
    transport_journal: "artifacts/reset-referral-upstream-transport.json",
    reason: j.run,
  };
  save();
  await dp
    .getByRole("button", { name: "Issue external referral", exact: true })
    .click();
  await expect(
    dp.getByRole("button", { name: "Save referral letter PDF", exact: true }),
  ).toBeVisible();
  const posts = (await d.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/referrals",
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].status, 201);
  j.created = posts[0];
  const ref = posts[0].result.data;
  assert.equal(ref.reason, j.run);
  assert.equal(ref.patient_id, ticket.patient_id);
  assert.equal(ref.encounter_id, fixture.note.encounter_id);
  assert.equal(ref.status, "Issued");
  assert.equal(ref.acknowledgement_pending, true);
  delete j.pending;
  save();
  // Contract emits no referral event: explicit reset/re-read is the supported cross-role refresh.
  const reset = p.getByRole("button", {
    name: "Reset to last 12 months",
    exact: true,
  });
  await reset.click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  const reads = async () =>
    (await q.trace()).requests.filter(
      (r) => r.method === "GET" && r.path.startsWith("/api/v1/referrals"),
    );
  const date = ref.created_at.slice(0, 10),
    tomorrow = new Date(new Date(date + "T12:00:00Z").getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
  await p.getByLabel("Referral start date", { exact: true }).fill(tomorrow);
  await p.getByLabel("Referral end date", { exact: true }).fill(date);
  await p
    .getByRole("button", { name: "Apply referral filters", exact: true })
    .click();
  await expect(
    p
      .getByRole("alert")
      .filter({ hasText: "Start date must not be after end date" }),
  ).toBeVisible();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  assert(
    !(await reads()).some(
      (r) =>
        r.path.includes("date_from=" + tomorrow) &&
        r.path.includes("date_to=" + date),
    ),
  );
  const refused = await p.evaluate(
    (v) => window.terminal.call("api", { method: "GET", path: v }),
    "/referrals?date_from=" + tomorrow + "&date_to=" + date,
  );
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, "VALIDATION_ERROR");
  j.reversed_api = refused;
  save();
  await p.getByLabel("Referral start date", { exact: true }).fill(date);
  await p.getByLabel("Referral end date", { exact: true }).fill(date);
  await p.getByLabel("Referral status", { exact: true }).selectOption("Issued");
  await p.getByLabel("Acknowledgement pending", { exact: true }).check();
  await p
    .getByRole("button", { name: "Apply referral filters", exact: true })
    .click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  const find = p.getByLabel("Find in this loaded page", { exact: true });
  await find.fill(ref.mrn);
  await help(q, find, "Referral register");
  await expect(find).toHaveValue(ref.mrn);
  await find.fill(j.run + " NO MATCH");
  await expect(
    p.getByText(
      "No row matches this page search. Clear it or load another page.",
      { exact: true },
    ),
  ).toBeVisible();
  await find.fill("");
  await reset.click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  await q.fault({ delayPath: "/api/v1/referrals?", delayMs: 1400 });
  await reset.click();
  await expect(p.locator("table")).toHaveCount(0);
  await expect(p.locator("table")).toContainText(ref.referral_number);
  await q.fault({ delayPath: null });
  await q.fault({
    failPath: "/api/v1/referrals?",
    failMethod: "GET",
    once: false,
  });
  await reset.click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(p.locator("table")).toHaveCount(0);
  await q.fault({ failPath: null });
  await p.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  const open = p.getByRole("button", {
    name: "Open referral " + ref.referral_number,
    exact: true,
  });
  await q.fault({
    failPath: "/api/v1/referrals/" + ref.referral_id,
    failMethod: "GET",
    once: false,
  });
  await open.click();
  const record = p.locator(
    'section.card[data-help-screen="referral_register"]',
  );
  await expect(
    record.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    p.getByRole("button", { name: "Save referral letter PDF", exact: true }),
  ).toHaveCount(0);
  await q.fault({ failPath: null });
  await record.getByRole("button", { name: "Try again", exact: true }).click();
  const pdf = p.getByRole("button", {
    name: "Save referral letter PDF",
    exact: true,
  });
  await expect(pdf).toBeVisible();
  await help(q, pdf, "Referral register");
  assert.equal(
    await p
      .getByRole("button", { name: "Cancel referral", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await p
      .getByRole("button", {
        name: "Record receiving acknowledgement",
        exact: true,
      })
      .count(),
    0,
  );
  await q.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await pdf.click();
  await expect(
    p.getByText("Save cancelled; referral remains in the record.", {
      exact: true,
    }),
  ).toBeVisible();
  const dest = path.resolve("artifacts/reset-referral-register.pdf");
  await q.app.evaluate(({ dialog }, dest) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
  }, dest);
  await pdf.click();
  await expect(
    p.getByText("Referral PDF saved.", { exact: true }),
  ).toBeVisible();
  assert.equal(fs.readFileSync(dest).subarray(0, 5).toString(), "%PDF-");
  // Cancel only our exact synthetic letter, once, through the referring Doctor UI.
  await dp
    .getByRole("button", { name: "Cancel referral", exact: true })
    .click();
  await dp
    .getByLabel("Referral cancellation reason", { exact: true })
    .fill(
      j.run + " software test complete; no actual transfer or acknowledgement",
    );
  j.pending = {
    stage: "cancel original synthetic referral once",
    referral_id: ref.referral_id,
    transport_journal: "artifacts/reset-referral-upstream-transport.json",
  };
  save();
  await dp
    .getByRole("button", { name: "Confirm referral action", exact: true })
    .click();
  await expect(dp.getByRole("dialog")).toHaveCount(0);
  j.cancel = (await d.trace()).requests
    .filter(
      (r) =>
        r.method === "POST" &&
        r.path === "/api/v1/referrals/" + ref.referral_id + "/cancel",
    )
    .at(-1);
  assert.equal(j.cancel.status, 200);
  delete j.pending;
  save();
  await reset.click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  await p
    .getByLabel("Referral status", { exact: true })
    .selectOption("Cancelled");
  await p
    .getByRole("button", { name: "Apply referral filters", exact: true })
    .click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  await p.getByLabel("Acknowledgement pending", { exact: true }).check();
  await p
    .getByRole("button", { name: "Apply referral filters", exact: true })
    .click();
  await expect(
    p.getByText(
      "No referrals returned for this period/filter/page. Change filters or return to a newer page.",
      { exact: true },
    ),
  ).toBeVisible();
  await reset.click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  const pageRows = await q.native("api", {
      method: "GET",
      path: "/referrals?limit=50&acknowledgement_pending=false",
    }),
    last = pageRows.at(-1).referral_id;
  await p
    .getByRole("button", { name: "Older referral page", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await reads()).some(
        (r) => r.path.includes("before_id=" + last) && r.status === 200,
      ),
    )
    .toBe(true);
  await p
    .getByRole("button", { name: "Newer referral page", exact: true })
    .click();
  await expect(p.locator("table")).toContainText(ref.referral_number);
  await open.click();
  await expect(record.getByRole("heading", { level: 2 })).toContainText(
    "Cancelled",
  );
  const win = await q.app.browserWindow(p),
    key = async (k) =>
      win.evaluate((w, k) => {
        for (const type of ["keyDown", "keyUp"])
          w.webContents.sendInputEvent({
            type,
            keyCode: k,
            modifiers: ["control"],
          });
      }, k);
  await q.prefs({ ui_scale_pct: 245 });
  await key("=");
  await expect
    .poll(async () => (await q.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("=");
  await expect
    .poll(() => win.evaluate((w) => w.webContents.getZoomFactor()))
    .toBe(2.5);
  await expect
    .poll(
      async () =>
        (await q.native("api", { method: "GET", path: "/auth/me" })).preferences
          .ui_scale_pct,
    )
    .toBe(250);
  await key("0");
  await expect
    .poll(async () => (await q.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await key("-");
  await expect
    .poll(() => win.evaluate((w) => w.webContents.getZoomFactor()))
    .toBe(1);
  for (const language of ["en", "ur"]) {
    await q.prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({
      path: "public/handbook/referral_register-" + language + ".png",
      fullPage: true,
    });
    for (const theme of ["Light", "DarkHighContrast"]) {
      await q.prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
    }
  }
  await q.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  j.quality_writes = (await q.trace()).requests.filter(
    (r) => r.method !== "GET",
  );
  assert.equal(j.quality_writes.length, 0);
  j.final = await q.native("api", {
    method: "GET",
    path: "/referrals/" + ref.referral_id,
  });
  assert.equal(j.final.status, "Cancelled");
  assert.equal(j.final.acknowledged_at, null);
  save();
  c = await session("reset-referral-register-cashier", "demo.cashier");
  assert.equal(
    await c.p
      .getByRole("navigation")
      .getByRole("button", { name: "Referral register", exact: false })
      .count(),
    0,
  );
  const cfg = JSON.parse(fs.readFileSync(".dev-terminal.json"));
  const { request, checkedRoot } = createRequire(import.meta.url)(
      "../electron/transport.cjs",
    ),
    ca = checkedRoot(cfg.ca_pem, cfg.ca_fingerprint_sha256),
    login = await request(cfg.server_urls[0] + "/api/v1/auth/login", {
      ca,
      method: "POST",
      body: { username: "demo.cashier", password: "Demo-pass-2026" },
      headers: {
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    });
  assert.equal(login.status, 200);
  j.denied = [];
  for (const route of [
    "/referrals",
    "/referrals/" + ref.referral_id,
    "/referrals/" + ref.referral_id + "/pdf",
  ]) {
    const r = await request(cfg.server_urls[0] + "/api/v1" + route, {
      ca,
      method: "GET",
      headers: {
        Authorization: "Bearer " + login.body.data.access_token,
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, "FORBIDDEN");
    j.denied.push({
      path: route,
      status: r.status,
      code: r.body.error.code,
      request_id: r.body.request_id,
    });
  }
  j.checks = [
    "Fresh Doctor-issued WithStaff DEMO referral and Quality explicit re-read (no prescribed referral event)",
    "Client reversed dates preserve applied view/no reversed GET; actual server422",
    "Applied status/date/pending, current-page search/no-match, real cursor Older/Newer",
    "Real delayed/exhausted list/detail read errors hide stale data; successful read-only Retry",
    "Quality read-only actions/F1/focus, save cancelled and real server PDF",
    "Original Doctor cancellation once, Quality filter/pending exclusion and immutable Cancelled detail; no actual acknowledgement",
    "Native zoom bounds/reset/auth-me persistence; EN/UR both themes250% and full-page screenshots",
    "Cashier no register menu and actual403 list/detail/PDF; Quality0businesswrites",
  ];
  j.passed = true;
  q.j.passed = true;
  d.j.passed = true;
  c.j.passed = true;
  save();
  console.log(
    "PASS fresh Referral Register Quality journey, read-only states/filters/PDF/F1/zoom/denials and Doctor cancellation; no real transfer or acknowledgement",
  );
} catch (e) {
  j.error = e.stack;
  try {
    j.failure_ui = await q?.p.locator("body").innerText();
  } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  for (const s of [c, d, q])
    if (s) {
      try {
        await s.fault({ failPath: null, delayPath: null });
        await expect
          .poll(
            async () => {
              const r = await s.p.evaluate(() =>
                window.terminal.call("api", {
                  method: "GET",
                  path: "/auth/me",
                }),
              );
              return r.ok;
            },
            { timeout: 60000 },
          )
          .toBe(true);
      } catch {}
      await s.close();
      j[s.j.name] = {
        renderer: s.j.renderer,
        preferences_restored: s.j.preferences_restored,
        signed_out: s.j.signed_out,
        trace: s.j.trace?.requests.map((r) =>
          r.method === "GET"
            ? {
                method: r.method,
                path: r.path,
                status: r.status,
                request_id: r.result?.request_id,
                reply_lost: r.reply_lost,
              }
            : r,
        ),
      };
    }
  j.finished = new Date().toISOString();
  save();
}
