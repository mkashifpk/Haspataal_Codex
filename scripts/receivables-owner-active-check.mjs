// Single-run real DEV verification. Never replay this fixture after interruption.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
const file = "docs/receivables-owner-active-evidence-2026-10-25.json";
const resume = process.argv.includes("--resume");
assert(
  resume ? fs.existsSync(file) : !fs.existsSync(file),
  "Reconcile original journal and keys; do not create a replacement fixture",
);
const j = resume
  ? JSON.parse(fs.readFileSync(file))
  : {
      run: "DEMO-AR-WRITEOFF-" + Date.now(),
      started: new Date().toISOString(),
      writes: [],
      checks: [],
      passed: false,
    };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
if (resume) {
  assert(
    !j.pending && !j.passed && j.approval?.status === "Approved",
    "Resolve original writes before resuming",
  );
  j.previous_failures = [
    ...(j.previous_failures || []),
    { error: j.error, at: new Date().toISOString() },
  ];
  delete j.error;
}
save();
const cfg = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const ca = checkedRoot(cfg.ca_pem, cfg.ca_fingerprint_sha256);
async function raw(method, path, token, body, key) {
  return request(cfg.server_urls[0] + "/api/v1" + path, {
    ca,
    method,
    body,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
    },
  });
}
async function login(username) {
  const r = await raw("POST", "/auth/login", null, {
    username,
    password: "Demo-pass-2026",
  });
  assert.equal(r.status, 200);
  return r.body.data.access_token;
}
async function call(method, path, token, body, status = 200, code) {
  const a = {
    method,
    path,
    body,
    key: method === "GET" ? undefined : crypto.randomUUID(),
    started: new Date().toISOString(),
  };
  if (method !== "GET") {
    j.pending = a;
    j.writes.push(a);
    save();
  }
  const r = await raw(method, path, token, body, a.key);
  if (method !== "GET") {
    Object.assign(a, { status: r.status, result: r.body, finished: true });
    delete j.pending;
    save();
  }
  assert.equal(r.status, status, JSON.stringify(r.body));
  if (code) assert.equal(r.body.error.code, code);
  return r.body.data;
}
let s, p;
try {
  const owner = await login("demo.owner");
  if (!resume) {
    s = await session("receivables-owner-upstream", "demo.reception");
    p = s.p;
    await s.nav("New registration + OPD slip");
    const services = await s.native("api", {
      method: "GET",
      path: "/finance/service-catalog?category=OPD",
    });
    const service = services.find(
      (x) => x.is_active && x.doctor_name === "Dr. Ahmed Khan",
    );
    assert(service);
    j.service = service;
    save();
    await p.getByLabel("Full name", { exact: true }).fill(j.run);
    await p.getByLabel("Age in years", { exact: true }).fill("35");
    await p.getByLabel("Mobile", { exact: true }).fill("03000000000");
    await p
      .getByLabel("OPD service", { exact: true })
      .selectOption(String(service.service_id));
    j.pending = {
      stage:
        "unpaid UI registration; original key/body persisted before transport in artifacts/receivables-owner-upstream-transport.json",
    };
    save();
    await p
      .getByRole("button", { name: "Issue unpaid OPD slip", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "OPD slip issued", exact: true }),
    ).toBeVisible();
    const reg = (await s.trace()).requests.filter(
      (r) =>
        r.method === "POST" && r.path === "/api/v1/reception/registrations",
    );
    assert.equal(reg.length, 1);
    assert.equal(reg[0].status, 201);
    j.registration = reg[0];
    j.ticket = reg[0].result.data;
    delete j.pending;
    save();
    j.patient = await s.native("api", {
      method: "GET",
      path: "/patients/" + j.ticket.patient_id,
    });
    assert.equal(j.patient.full_name, j.run);
    save();
    const reception = await login("demo.reception");
    j.credit = await call(
      "POST",
      "/opd-tickets/" + j.ticket.ticket_id + "/credit-request",
      reception,
      {
        amount_paid_now: 0,
        method: "Card",
        reason:
          j.run +
          " synthetic debt for write-off verification; no actual care or money",
      },
      201,
    );
    save();
    const approvalId = j.credit.approval.request_id;
    const approval = await call("GET", "/approvals/" + approvalId, owner);
    assert(approval.can_decide);
    assert.equal(approval.patient_id, j.patient.patient_id);
    j.approval = await call(
      "POST",
      "/approvals/" + approvalId + "/approve",
      owner,
      { note: j.run + " isolated synthetic software test only" },
    );
    save();
    s.j.passed = true;
    await s.close();
    j.upstream = {
      renderer: s.j.renderer,
      preferences_restored: s.j.preferences_restored,
      signed_out: s.j.signed_out,
      trace: s.j.trace,
    };
    save();
    s = null;
  }
  const current = await call(
    "GET",
    "/patients/" + j.patient.patient_id,
    await login("demo.reception"),
  );
  assert.equal(current.full_name, j.run);
  const rows = await call("GET", "/finance/ar/outstanding", owner);
  j.ar = rows.find(
    (x) =>
      x.patient_id === j.patient.patient_id &&
      x.invoice_id === j.ticket.invoice.invoice_id,
  );
  assert(j.ar);
  assert.equal(j.ar.status, "Active");
  assert.equal(j.ar.amount_written_off, j.partial_writeoff ? 10 : 0);
  assert(j.ar.balance > 10);
  save();
  s = await session("receivables-owner-active", "demo.owner");
  p = s.p;
  const user = (await s.native("state")).user;
  assert(user.permissions.includes("finance.ar.write_off"));
  assert(!user.permissions.includes("finance.ar.collect"));
  const work = user.workspaces.find((w) => w.code === "owner_dashboard");
  assert(work);
  await s.nav("Workspaces");
  await p
    .locator("article.workspace-card")
    .filter({ has: p.getByRole("heading", { name: work.label, exact: true }) })
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  await s.nav("Outstanding dues");
  const table = p.getByRole("table", {
    name: "Outstanding receivables",
    exact: true,
  });
  const row = () =>
    table
      .getByRole("row")
      .filter({ has: p.getByText("#" + j.ar.ar_id, { exact: true }) });
  const search = p.getByLabel("Search patient, MRN, invoice, mobile", {
    exact: true,
  });
  const refresh = p.getByRole("button", { name: "Refresh", exact: true });
  const modal = () =>
    p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", {
          name: "Write Off Receivable — AR #" + j.ar.ar_id,
          exact: true,
        }),
      });
  const amount = () =>
      modal().getByLabel("Amount to write off", { exact: true }),
    reason = () =>
      modal().getByLabel("Reason for write-off (mandatory)", { exact: true });
  const before = async () =>
    (await s.trace()).requests.filter(
      (r) =>
        r.method === "POST" &&
        r.path === "/api/v1/finance/ar/" + j.ar.ar_id + "/write-off",
    );
  if (!j.partial_writeoff) {
    await expect(row()).toContainText(j.run);
    await expect(row()).toContainText(j.patient.mrn);
    assert.equal(
      await row().getByRole("button", { name: "Settle", exact: true }).count(),
      0,
    );
    await search.fill("DEMO-NO-SUCH-AR-" + Date.now());
    await expect(
      p.getByText("No receivables match the active search or filters.", {
        exact: true,
      }),
    ).toBeVisible();
    await p.getByRole("button", { name: "Show all", exact: true }).click();
    await expect(row()).toBeVisible();
    await s.fault({ delayPath: "/finance/ar/outstanding", delayMs: 1600 });
    await refresh.click();
    await expect(table).toHaveCount(0);
    await expect(row()).toBeVisible();
    await s.fault({ delayPath: null });
    await s.fault({
      failPath: "/finance/ar/outstanding",
      failMethod: "GET",
      once: false,
    });
    await refresh.click();
    await expect(
      p.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await expect(table).toHaveCount(0);
    await s.fault({ failPath: null });
    await p.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(row()).toBeVisible();
    const aging = p
      .locator("section.card")
      .filter({
        has: p.getByRole("heading", {
          name: "Receivables aging summary",
          exact: true,
        }),
      });
    await s.fault({
      failPath: "/finance/ar/aging",
      failMethod: "GET",
      once: false,
    });
    await refresh.click();
    await expect(
      aging.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      aging.getByText("Total outstanding", { exact: true }),
    ).toHaveCount(0);
    await s.fault({ failPath: null });
    await aging.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      aging.getByText("Total outstanding", { exact: true }),
    ).toBeVisible();
    s.pass(
      "Fresh UI upstream debt displayed with exact identity; no-match/reset, delayed queue hides stale rows, exhausted real queue/aging read failures and Retry recover without stale data",
    );
    const cashier = await login("demo.cashier");
    await call(
      "POST",
      "/finance/ar/" + j.ar.ar_id + "/write-off",
      cashier,
      { amount: 10, reason: j.run + " denied Cashier test" },
      403,
      "FORBIDDEN",
    );
    await call(
      "POST",
      "/finance/ar/" + j.ar.ar_id + "/write-off",
      owner,
      { amount: 10, reason: "bad" },
      422,
      "VALIDATION_ERROR",
    );
    await row().getByRole("button", { name: "Write off", exact: true }).click();
    await amount().fill("10");
    await reason().fill("bad");
    await expect(
      modal().getByRole("button", { name: "Confirm write-off", exact: true }),
    ).toBeDisabled();
    await reason().fill(
      j.run + " partial synthetic write-off; no actual debt or money",
    );
    await help(s, reason(), "Outstanding dues (Udhaar)");
    await expect(amount()).toHaveValue("10");
    await amount().fill("0");
    await modal()
      .getByRole("button", { name: "Confirm write-off", exact: true })
      .click();
    await expect(modal().getByRole("alert")).toBeVisible();
    assert.equal((await before()).length, 0);
    await amount().fill("10");
    await s.fault({
      failPath: "/finance/ar/" + j.ar.ar_id + "/write-off",
      failMethod: "POST",
      once: true,
    });
    j.pending = {
      stage:
        "partial10 Owner UI write-off; original key/body in artifacts/receivables-owner-active-transport.json",
    };
    save();
    await modal()
      .getByRole("button", { name: "Confirm write-off", exact: true })
      .evaluate((b) => {
        b.click();
        b.click();
      });
    const retry = modal().getByRole("button", {
      name: "Retry original financial action",
      exact: true,
    });
    await expect(retry).toBeEnabled();
    await expect(amount()).toBeDisabled();
    await expect(reason()).toBeDisabled();
    await p.keyboard.press("Escape");
    await expect(modal()).toBeVisible();
    let writes = await before();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].status, 200);
    j.original_writeoff = writes[0];
    save();
    await retry.evaluate((b) => {
      b.click();
      b.click();
    });
    await expect(
      modal().getByText("Write-off recorded", { exact: true }),
    ).toBeVisible();
    writes = await before();
    assert.equal(writes.length, 2);
    assert.equal(writes[0].key, writes[1].key);
    assert.deepEqual(writes[0].body, writes[1].body);
    assert.equal(writes[1].replay, "true");
    j.partial_writeoff = writes[1].result.data;
    delete j.pending;
    save();
    assert.equal(j.partial_writeoff.amount_written_off, 10);
    await expect(modal()).toContainText("Remaining Balance");
    await expect(modal()).toContainText("PKR " + (j.ar.balance - 10));
    await modal()
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    await expect(row()).toBeVisible();
    j.partial_read = (await call("GET", "/finance/ar/outstanding", owner)).find(
      (x) => x.ar_id === j.ar.ar_id,
    );
    assert.equal(j.partial_read.balance, j.ar.balance - 10);
    assert.equal(j.partial_read.amount_paid, 0);
    save();
    s.pass(
      "Cashier real403/Owner short-reason422; UI invalid zero sends no write; F1 preserves partial draft; lost actual200 double-click and same-key/body replay write off10 once, frozen inputs/dismissal; result shows remaining balance",
    );
  }
  await row().getByRole("button", { name: "Write off", exact: true }).click();
  await expect(amount()).toHaveValue(String(j.partial_read.balance));
  await reason().fill(
    j.run + " final synthetic write-off; no real patient or cash",
  );
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
  await s.prefs({ ui_scale_pct: 245 });
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("=");
  await expect
    .poll(() => win.evaluate((w) => w.webContents.getZoomFactor()))
    .toBe(2.5);
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
  await expect
    .poll(() => win.evaluate((w) => w.webContents.getZoomFactor()))
    .toBe(1);
  for (const language of ["en", "ur"])
    for (const theme of ["Light", "DarkHighContrast"]) {
      await s.prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
      await expect(
        p.locator('dialog[open] textarea[data-help="receivables.write_off"]'),
      ).toHaveValue(
        j.run + " final synthetic write-off; no real patient or cash",
      );
    }
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  j.pending = {
    stage:
      "remaining-balance Owner UI write-off; original key/body in transport journal",
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm write-off", exact: true })
    .click();
  await expect(
    modal().getByText("Write-off recorded", { exact: true }),
  ).toBeVisible();
  const finalWrites = await before();
  assert.equal(finalWrites.length, j.partial_writeoff && resume ? 1 : 3);
  j.final_writeoff = finalWrites.at(-1);
  assert.equal(j.final_writeoff.status, 200);
  assert.equal(j.final_writeoff.result.data.status, "WrittenOff");
  assert.equal(
    j.final_writeoff.result.data.amount_written_off,
    j.ar.amount_due,
  );
  delete j.pending;
  save();
  await expect(modal()).toContainText("PKR 0");
  await modal()
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await expect(row()).toHaveCount(0);
  const after = await call("GET", "/finance/ar/outstanding", owner);
  assert(!after.some((x) => x.ar_id === j.ar.ar_id));
  j.final_patient = await call(
    "GET",
    "/patients/" + j.patient.patient_id,
    await login("demo.reception"),
  );
  assert(!j.final_patient.outstanding.has_outstanding_ar);
  j.final_invoice = await call(
    "GET",
    "/finance/invoices/" + j.ar.invoice_id,
    owner,
  );
  assert.equal(j.final_invoice.amount_paid, 0);
  save();
  await capture(s, "receivables");
  s.pass(
    "Native zoom bounds/reset/persisted preferences and EN/UR both themes250% preserve financial draft; full write-off closes original synthetic debt, removes queue row and clears patient AR banner; no payment or drawer writes",
  );
  assert(
    !(await s.trace()).requests.some(
      (r) =>
        r.method === "POST" &&
        /\/(?:payments|settle|cash-shifts)(?:\/|$)/.test(r.path),
    ),
  );
  j.checks = [...new Set([...(j.checks || []), ...s.j.checks])];
  j.passed = true;
  s.j.passed = true;
  save();
} catch (e) {
  j.checks = [...new Set([...(j.checks || []), ...(s?.j.checks || [])])];
  j.error = e.stack;
  try {
    j.failure_ui = await p.locator("body").innerText();
    j.trace = await s.trace();
  } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) {
    await s.close();
    j.session = {
      renderer: s.j.renderer,
      preferences_restored: s.j.preferences_restored,
      signed_out: s.j.signed_out,
      trace: s.j.trace,
    };
    save();
  }
}
