# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV. Only owned user34/employee36 and two new labelled UNPAID slips.
// No charge, approval, physical cash claim or shared demo-password change.
import { _electron as electron } from "playwright";
import { expect as baseExpect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const expect = baseExpect.configure({ timeout: 45000 });
const config = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
const file = "artifacts/frontdesk-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/frontdesk-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/frontdesk-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/frontdesk-native-writes.json",
      `artifacts/frontdesk-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-FRONTDESK-" + Date.now(),
  attempts: [],
  tickets: [],
  requests: [],
  checks: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
const pass = (s) => {
  j.checks.push(s);
  save();
  console.log("PASS " + s);
};
let it,
  ownToken,
  app,
  page,
  original,
  ownsFixture = false;
async function backend(method, route, token, body, key) {
  const a =
    method !== "GET" && route !== "/auth/login"
      ? {
          method,
          route,
          key,
          body: route.includes("password") ? undefined : body,
          finished: false,
          started: new Date().toISOString(),
        }
      : null;
  if (a) {
    j.attempts.push(a);
    save();
  }
  const r = await request(config.server_urls[0] + "/api/v1" + route, {
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
  if (a) {
    Object.assign(a, {
      status: r.status,
      request_id: r.body?.request_id,
      finished: true,
    });
    save();
  }
  assert(
    r.status < 400,
    `${method} ${route}: ${r.status} ${r.body?.error?.code}`,
  );
  return r.body.data;
}
async function owned() {
  const u = await backend("GET", "/admin/users/34", it);
  assert.equal(u.username, "codex.foundation.1792584106665");
  assert.equal(u.employee_id, 36);
  return u;
}
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
const prefs = async (value) => {
  const r = await page.evaluate((v) => window.terminal.call("prefs", v), value);
  assert(
    r.ok,
    `Preferences save refused: ${r.error?.code} ${r.error?.message}`,
  );
};
const native = async (method, route, body) => {
  const r = await page.evaluate((v) => window.terminal.call("api", v), {
    method,
    path: route,
    body,
  });
  assert(r.ok, `${method} ${route}: ${r.error?.code}`);
  return r.data;
};
const nav = async (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: false })
    .click();
async function scan(number) {
  await page.getByLabel("OPD slip number", { exact: true }).fill(number);
  await page.getByLabel("OPD slip number", { exact: true }).press("Enter");
  await expect(
    page.locator("main h2").filter({ hasText: number }),
  ).toBeVisible();
}
async function createSlip(label) {
  const catalog = await backend(
    "GET",
    "/finance/service-catalog?category=OPD",
    ownToken,
  );
  const service = catalog.find((s) => s.is_active && s.doctor_id);
  assert(service, "No actual active OPD service");
  const key = crypto.randomUUID(),
    body = {
      new_patient: {
        full_name: j.run + " " + label,
        gender: "unknown",
        age_years: 30,
        mobile: "00000000000",
      },
      doctor_id: service.doctor_id,
      department_id: service.department_id,
      service_id: service.service_id,
    };
  const t = await backend(
    "POST",
    "/reception/registrations",
    ownToken,
    body,
    key,
  );
  assert.equal(t.payment_status, "Unpaid");
  j.tickets.push({
    id: t.ticket_id,
    number: t.ticket_number,
    patient_id: t.patient_id,
    key,
    closed: false,
  });
  save();
  return t;
}
async function capture(id) {
  for (const language of ["en", "ur"]) {
    await prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `public/handbook/${id}-${language}.png` });
  }
  for (const language of ["en", "ur"])
    for (const theme of ["Light", "DarkHighContrast"]) {
      await prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `artifacts/${id}-${language}-${theme}-250.png`,
      });
    }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
}
async function help(title, control) {
  await control.focus();
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText(title);
  await page
    .getByRole("dialog")
    .filter({ has: page.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(control).toBeFocused();
}
async function cancelRequests(ticket) {
  const rows = await backend("GET", "/approvals?mine=true&limit=100", ownToken);
  for (const a of rows.filter(
    (a) =>
      a.status === "Pending" &&
      a.requester_id === 34 &&
      a.payload_jsonb?.ticket_id === ticket.ticket_id,
  )) {
    j.requests.push({
      id: a.request_id,
      ticket_id: ticket.ticket_id,
      cleanup_pending: true,
    });
    save();
    await backend("POST", `/approvals/${a.request_id}/cancel`, ownToken, {
      note: j.run + " synthetic UI test cleanup, no real approval/payment",
    });
    j.requests.at(-1).cleanup_pending = false;
    save();
  }
}
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/frontdesk-profile-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(45000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  // Verify actual terminal health BEFORE any administrative fixture write.
  await expect(
    page.getByText("Hospital server ready.", { exact: true }),
  ).toBeVisible();
  it = (
    await backend("POST", "/auth/login", null, {
      username: "demo.it",
      password: "Demo-pass-2026",
    })
  ).access_token;
  assert.equal(
    (await owned()).is_active,
    false,
    "Never take over active fixture",
  );
  ownsFixture = true;
  await backend("POST", "/admin/users/34/active", it, {
    active: true,
    reason: j.run + " isolated screen tests",
  });
  const temporary = (
    await backend("POST", "/admin/users/34/reset-password", it)
  ).temporary_password;
  assert(temporary);
  await app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.frontTest = {
      writes: [],
      reads: [],
      events: [],
      dropPre: false,
    };
    const fs = process.getBuiltinModule("fs");
    const persist = () =>
      fs.writeFileSync(
        process.cwd() + "/artifacts/frontdesk-native-writes.json",
        JSON.stringify(globalThis.frontTest.writes, null, 2),
      );
    persist();
    const load = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json"),
      WS = load("ws"),
      send = WS.prototype.send;
    WS.prototype.send = function (data, ...rest) {
      const m = JSON.parse(String(data));
      if (m.type === "auth")
        this.on("message", (raw) => {
          const e = JSON.parse(String(raw));
          if (e.type === "event")
            globalThis.frontTest.events.push({
              event_type: e.event_type,
              event_id: e.event_id,
            });
        });
      return send.call(this, data, ...rest);
    };
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL),
        u = object
          ? new URL(
              `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
            )
          : new URL(url),
        method = (object ? url.method : options?.method) || "GET";
      if (method === "GET" && /^\/api\/v1\/opd-tickets\//.test(u.pathname))
        globalThis.frontTest.reads.push(u.pathname);
      if (method === "POST" && /^\/api\/v1\/opd-tickets\//.test(u.pathname)) {
        const a = {
          path: u.pathname,
          key: options?.headers?.["Idempotency-Key"],
          body: "",
          finished: false,
        };
        globalThis.frontTest.writes.push(a);
        persist();
        const req = original.call(this, url, options, (response) => {
          a.status = response.statusCode;
          a.replay = response.headers["idempotent-replay"];
          a.finished = true;
          persist();
          if (
            globalThis.frontTest.dropPre &&
            u.pathname.endsWith("/vip-waiver-request")
          ) {
            globalThis.frontTest.dropPre = false;
            callback(response);
            response.destroy(new Error("TEST lost REAL pre-waiver reply"));
            return;
          }
          callback(response);
        });
        const write = req.write.bind(req);
        req.write = function (chunk, ...rest) {
          a.body += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
          persist();
          return write(chunk, ...rest);
        };
        return req;
      }
      return original.call(this, url, options, callback);
    };
  });
  await page
    .getByLabel("Username", { exact: true })
    .fill("codex.foundation.1792584106665");
  await page.getByLabel("Password", { exact: true }).fill(temporary);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page
    .getByRole("heading", { name: "Change your password", exact: true })
    .waitFor();
  const password = "Demo!" + crypto.randomBytes(16).toString("hex") + "A9";
  j.password_change = "pending";
  save();
  await page.getByLabel("Current password", { exact: true }).fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect
    .poll(() => state().then((s) => s.user?.must_change_password))
    .toBe(false);
  j.password_change = "confirmed";
  save();
  await page.getByRole("navigation").waitFor();
  original = (await state()).prefs;
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  ownToken = (
    await backend("POST", "/auth/login", null, {
      username: "codex.foundation.1792584106665",
      password,
    })
  ).access_token;
  j.renderer = await page.locator('script[type="module"]').getAttribute("src");
  save();
  await nav("Queue management");
  await expect(
    page.getByRole("heading", { name: "Queue management", exact: true }),
  ).toBeVisible();
  const board = await native("GET", "/opd-queues/reception-dashboard");
  assert(Array.isArray(board.queues));
  await help(
    "Queue management",
    page.getByRole("button", { name: "Refresh queues", exact: true }),
  );
  if (!readonly) {
    const first = await createSlip("cancel"),
      second = await createSlip("requests");
    await scan(first.ticket_number);
    await expect(
      page.getByRole("heading", { name: "Status history", exact: true }),
    ).toBeVisible();
    const history = await native(
      "GET",
      `/opd-tickets/${first.ticket_id}/status-history`,
    );
    assert(history.length);
    await native("GET", `/opd-queues/by-doctor/${first.doctor_id}`);
    await page
      .getByRole("button", { name: "Cancel unpaid slip", exact: true })
      .click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill(j.run + " unpaid cancellation verification");
    await help("Queue management", page.getByLabel("Reason", { exact: true }));
    await page
      .getByRole("button", { name: "Confirm ticket action", exact: true })
      .evaluate((b) => {
        b.click();
        b.click();
      });
    await expect(page.getByText(/Ticket status: Cancelled/)).toBeVisible();
    const cancelled = await backend(
      "GET",
      `/opd-tickets/${first.ticket_id}`,
      ownToken,
    );
    assert.equal(cancelled.status, "Cancelled");
    assert.equal(cancelled.invoice.amount_paid, 0);
    j.tickets[0].closed = true;
    save();
    assert.equal(
      (await app.evaluate(() => globalThis.frontTest.writes)).filter((w) =>
        w.path.endsWith("/cancel"),
      ).length,
      1,
    );
    pass(
      "real scan/detail/history/dashboard/doctor queue reads; unpaid cancel duplicate-click sends ONE POST, no money collected; F1 preserves reason/focus",
    );
    await capture("queue_management");
    await nav("Refund / waiver / credit");
    await scan(second.ticket_number);
    await page
      .getByLabel("Request type", { exact: true })
      .selectOption("vip-waiver-request");
    await page
      .getByLabel("Reason", { exact: true })
      .fill(j.run + " synthetic pre-consult request");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await app.evaluate(() => {
      globalThis.frontTest.dropPre = true;
    });
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .evaluate((b) => {
        b.click();
        b.click();
      });
    await expect(page.getByText(/The result is uncertain/)).toBeVisible();
    let rows = await backend("GET", "/approvals?mine=true&limit=100", ownToken);
    const pending = rows.filter(
      (a) =>
        a.status === "Pending" &&
        a.payload_jsonb?.ticket_id === second.ticket_id,
    );
    assert.equal(pending.length, 1);
    j.requests.push({ id: pending[0].request_id, ticket_id: second.ticket_id });
    save();
    const before = await app.evaluate(() =>
      globalThis.frontTest.writes.filter((w) =>
        w.path.endsWith("/vip-waiver-request"),
      ),
    );
    assert.equal(before.length, 1);
    await page
      .getByRole("button", { name: "Retry original action", exact: true })
      .click();
    await expect(
      page.getByText(
        "Saved on the server. Refresh errors do not undo this action.",
        { exact: true },
      ),
    ).toBeVisible();
    const writes = await app.evaluate(() =>
      globalThis.frontTest.writes.filter((w) =>
        w.path.endsWith("/vip-waiver-request"),
      ),
    );
    assert.equal(writes.length, 2);
    assert(writes[0].key && writes[0].key === writes[1].key);
    assert.equal(String(writes[1].replay), "true");
    await expect(
      page.getByText(/The ticket is locked and is off the doctor's queue/),
    ).toBeVisible();
    await capture("refund_waiver_credit");
    await cancelRequests(second);
    await expect(
      page.getByLabel("Request type", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        app.evaluate(() =>
          globalThis.frontTest.events.some(
            (e) => e.event_type === "approval.resolved",
          ),
        ),
      )
      .toBe(true);
    pass(
      "real pre-consult request lost201 reply: one request, frozen-key deliberate replay, no duplicate POST from double click; actual approval lock and cancellation event refresh",
    );
    await page
      .getByLabel("Request type", { exact: true })
      .selectOption("credit-request");
    await page
      .getByLabel("Reason", { exact: true })
      .fill(j.run + " zero-now synthetic credit request");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(
      page.getByText(/The ticket is locked and is off the doctor's queue/),
    ).toBeVisible();
    const credit = await backend(
      "GET",
      `/opd-tickets/${second.ticket_id}`,
      ownToken,
    );
    assert.equal(credit.approval_lock, "CreditPending");
    assert.equal(credit.invoice.amount_paid, 0);
    await cancelRequests(second);
    await expect(
      page.getByLabel("Request type", { exact: true }),
    ).toBeVisible();
    pass(
      "real zero-now credit request locks ticket with NO payment; own pending request cancelled and unlocked via real event",
    );
    await page.getByLabel("Request type", { exact: true }).selectOption("void");
    await page
      .getByLabel("Reason", { exact: true })
      .fill(j.run + " unpaid test fixture cleanup");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(page.getByText(/Ticket status: Void/)).toBeVisible();
    const voided = await backend(
      "GET",
      `/opd-tickets/${second.ticket_id}`,
      ownToken,
    );
    assert.equal(voided.status, "Void");
    assert.equal(voided.invoice.amount_paid, 0);
    j.tickets[1].closed = true;
    save();
    pass(
      "real unpaid void confirmed without payment, all created approvals resolved",
    );
    await help(
      "Refund / waiver / credit requests",
      page.getByRole("button", { name: "Refresh requests", exact: true }),
    );
  } else {
    const missing = "DEMO-NO-SUCH-SLIP-" + Date.now();
    await page.getByLabel("OPD slip number", { exact: true }).fill(missing);
    await page.getByLabel("OPD slip number", { exact: true }).press("Enter");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /NOT_FOUND/ })
        .first(),
    ).toBeVisible();
    const count = await app.evaluate(() => globalThis.frontTest.reads.length);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect
      .poll(() => app.evaluate(() => globalThis.frontTest.reads.length))
      .toBeGreaterThan(count);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /NOT_FOUND/ })
        .first(),
    ).toBeVisible();
    await scan("OPD-2026-000007");
    await expect(
      page.getByText("Expired — new visit needs a new slip", { exact: true }),
    ).toBeVisible();
    pass(
      "final build actual initial lookup404 -> deliberate read-only retry -> recovered known slip; real expired visit warning, no business POST",
    );
    await capture("queue_management");
    await nav("Refund / waiver / credit");
    await scan("OPD-2026-000007");
    await capture("refund_waiver_credit");
    await help(
      "Refund / waiver / credit requests",
      page.getByRole("button", { name: "Refresh requests", exact: true }),
    );
  }
  await nav("Cash-back");
  await scan(j.tickets.at(-1)?.number || "OPD-2026-000007");
  await expect(
    page.getByText("No cash-back is pending for this slip.", { exact: true }),
  ).toBeVisible();
  await help(
    "Mandatory cash-back",
    page.getByRole("button", { name: "Refresh cash-back", exact: true }),
  );
  await capture("cash_back_prompts");
  pass(
    "cash-back reads actual ticket/no-prompt state; all3 genuine bilingual handbook screenshots and both themes250 reflow/F1 (no cash dispensation claimed)",
  );
  j.transport = await app.evaluate(() => globalThis.frontTest);
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      await page.screenshot({ path: "artifacts/frontdesk-failure.png" });
    } catch {}
  if (app)
    try {
      j.transport = await app.evaluate(() => globalThis.frontTest);
    } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (ownToken)
    for (const entry of j.tickets)
      try {
        let t = await backend("GET", `/opd-tickets/${entry.id}`, ownToken);
        assert(t.patient_name.startsWith(j.run));
        assert.equal(t.invoice.amount_paid, 0);
        await cancelRequests(t);
        t = await backend("GET", `/opd-tickets/${entry.id}`, ownToken);
        if (t.status === "Issued" && t.approval_lock === "None")
          await backend(
            "POST",
            `/opd-tickets/${entry.id}/cancel`,
            ownToken,
            { reason: j.run + " unpaid fixture cleanup" },
            crypto.randomUUID(),
          );
        t = await backend("GET", `/opd-tickets/${entry.id}`, ownToken);
        assert(["Cancelled", "Void"].includes(t.status));
        entry.closed = true;
        save();
      } catch (e) {
        entry.cleanup_error = e.message;
        j.passed = false;
        save();
        process.exitCode = 1;
      }
  if (app && original)
    try {
      await prefs(original);
      j.preferences_restored = true;
      save();
    } catch (e) {
      j.preferences_error = e.message;
      j.passed = false;
      save();
      process.exitCode = 1;
    }
  if (it && ownsFixture)
    try {
      await owned();
      await backend("POST", "/admin/users/34/active", it, {
        active: false,
        reason: j.run + " test cleanup",
      });
      j.account_deactivated = !(await owned()).is_active;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      j.passed = false;
      save();
      process.exitCode = 1;
    }
  if (app) await app.close();
  j.finished = new Date().toISOString();
  save();
}

```
