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
const file = "artifacts/backend-fix-check.json";

if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/backend-fix-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/backend-fix-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/backend-fix-native-writes.json",
      `artifacts/backend-fix-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-BACKEND-FIX-" + Date.now(),
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
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/backend-fix-profile-" + Date.now(),
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
      original = https.request,
      load = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json"),
      WS = load("ws"),
      send = WS.prototype.send;
    globalThis.fixTest = {
      sockets: [],
      events: [],
      auths: [],
      simulation: null,
      refreshCalls: [],
    };
    const timer = globalThis.setTimeout;
    globalThis.setTimeout = function (fn, ms, ...args) {
      if (ms > 600000 && String(fn).includes("refresh()"))
        globalThis.fixTest.refreshTimer = fn;
      return timer(fn, ms, ...args);
    };
    WS.prototype.send = function (data, ...rest) {
      const m = JSON.parse(String(data));
      if (m.type === "auth") {
        globalThis.fixTest.auths.push({ resume_from: m.resume_from ?? null });
        if (!globalThis.fixTest.sockets.includes(this)) {
          globalThis.fixTest.sockets.push(this);
          this.on("message", (raw) => {
            const e = JSON.parse(String(raw));
            if (
              e.type === "event" &&
              ["system.license", "notification.created"].includes(e.event_type)
            )
              globalThis.fixTest.events.push({
                event_type: e.event_type,
                event_id: e.event_id,
                simulated: e.simulated,
                payload: e.payload,
              });
          });
        }
      }
      return send.call(this, data, ...rest);
    };
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL),
        u = object
          ? new URL(
              "https://" +
                (url.hostname || url.host) +
                ":" +
                (url.port || 443) +
                (url.path || "/"),
            )
          : new URL(url),
        opts = object ? url : options;
      if (
        globalThis.fixTest.simulation &&
        [
          "/api/v1/meta/license",
          "/api/v1/auth/login",
          "/api/v1/auth/refresh",
        ].includes(u.pathname)
      )
        opts.headers = {
          ...opts.headers,
          "X-Haspataal-License-Simulation": globalThis.fixTest.simulation,
        };
      if (u.pathname === "/api/v1/auth/refresh")
        return original.call(this, url, options, (response) => {
          globalThis.fixTest.refreshCalls.push({ status: response.statusCode });
          callback(response);
        });
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
  const simulate = async (value) => {
    await expect
      .poll(() =>
        app.evaluate(() =>
          globalThis.fixTest.sockets.some((s) => s.readyState === 1),
        ),
      )
      .toBe(true);
    await app.evaluate((_electron, state) => {
      const s = globalThis.fixTest.sockets
        .filter((s) => s.readyState === 1)
        .at(-1);
      s.send(JSON.stringify({ type: "simulate_license", state }));
    }, value);
  };
  const banner = page.locator(".licence-banner");
  await expect(banner).toHaveCount(0);
  await simulate("grace");
  await expect(banner).toContainText("Simulated for DEV testing");
  await expect(banner).toContainText("5 days left");
  await nav("Notifications");
  await expect(banner).toBeVisible();
  await page.screenshot({
    path: "artifacts/backend-license-grace.png",
    fullPage: true,
  });
  await prefs({ language: "ur", theme: "DarkHighContrast", ui_scale_pct: 250 });
  await expect(banner).toContainText("دن باقی ہیں");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "artifacts/backend-license-grace-ur-250.png",
    fullPage: true,
  });
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await simulate("locked");
  await expect(banner).toContainText("Simulated for DEV testing");
  await expect
    .poll(() =>
      app.evaluate(
        () =>
          globalThis.fixTest.events
            .filter((e) => e.event_type === "system.license")
            .at(-1)?.payload.state,
      ),
    )
    .toBe("locked");
  // A valid access token remains usable; this test never changes global licensing.
  await native("GET", "/notifications/unread-count");
  await simulate("ok");
  await expect(banner).toHaveCount(0);
  const beforeAuth = await app.evaluate(() => globalThis.fixTest.auths.length);
  await app.evaluate(() =>
    globalThis.fixTest.sockets
      .filter((s) => s.readyState === 1)
      .at(-1)
      .terminate(),
  );
  await expect
    .poll(() => app.evaluate(() => globalThis.fixTest.auths.length))
    .toBeGreaterThan(beforeAuth);
  const resumed = await app.evaluate(
    () => globalThis.fixTest.auths.at(-1).resume_from,
  );
  assert(
    Number.isSafeInteger(resumed) && resumed >= 0,
    "DEV negative ID must never become resume_from",
  );
  pass(
    "real socket-scoped grace/locked/restore banners, navigation and Urdu250; reconnect retains positive durable cursor, no global licence change",
  );

  const noticeBody = j.run + " actual body absent from event";
  const notification = await backend(
    "POST",
    "/notifications/test",
    ownToken,
    {
      severity: "critical",
      title: j.run,
      body: noticeBody,
      expires_in_minutes: 1,
    },
    crypto.randomUUID(),
  );
  j.notifications = [
    { id: notification.notification_id, expires_at: notification.expires_at },
  ];
  save();
  const toast = page.locator(".critical-toast");
  await expect(toast).toContainText(noticeBody);
  const event = await app.evaluate(
    (_electron, id) =>
      globalThis.fixTest.events.find(
        (e) =>
          e.event_type === "notification.created" &&
          e.payload.notification_id === id,
      ),
    notification.notification_id,
  );
  assert(event);
  assert.equal(event.payload.severity, "critical");
  assert(!("body" in event.payload));
  // Wait beyond a conventional short auto-dismiss interval: no timer is injected.
  await new Promise((r) => setTimeout(r, 6200));
  await expect(toast).toBeVisible();
  await page.screenshot({
    path: "artifacts/backend-critical-toast.png",
    fullPage: true,
  });
  await toast
    .getByRole("button", { name: "Open notifications", exact: true })
    .click();
  await expect(toast).toBeVisible();
  const authCount = await app.evaluate(() => globalThis.fixTest.auths.length);
  await app.evaluate(() =>
    globalThis.fixTest.sockets
      .filter((s) => s.readyState === 1)
      .at(-1)
      .terminate(),
  );
  await expect
    .poll(() => app.evaluate(() => globalThis.fixTest.auths.length))
    .toBeGreaterThan(authCount);
  await expect(toast).toHaveCount(1);
  await toast.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(toast).toHaveCount(0);
  const inbox = await backend("GET", "/notifications?limit=200", ownToken);
  assert.equal(
    inbox.find((n) => n.notification_id === notification.notification_id)
      .is_read,
    false,
    "Dismiss is not mark-read",
  );
  await backend(
    "POST",
    `/notifications/${notification.notification_id}/read`,
    ownToken,
  );
  pass(
    "real self-targeted critical fixture displays inbox body, persists6.2sec/navigation/reconnect once, dismiss leaves unread; original record marked read for cleanup",
  );

  async function licenceRequest(route, body, simulation) {
    const r = await request(config.server_urls[0] + "/api/v1" + route, {
      ca,
      method: "POST",
      body,
      headers: {
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
        ...(simulation ? { "X-Haspataal-License-Simulation": simulation } : {}),
      },
    });
    (j.license_http ??= []).push({
      route,
      simulation: simulation || "normal",
      status: r.status,
      code: r.body?.error?.code,
      state: r.body?.data?.license?.state,
    });
    save();
    return r;
  }
  const grace = await licenceRequest(
    "/auth/login",
    { username: "codex.foundation.1792584106665", password },
    "grace",
  );
  assert.equal(grace.status, 200);
  assert.equal(grace.body.data.license.state, "grace");
  const renewed = await licenceRequest(
    "/auth/refresh",
    { refresh_token: grace.body.data.refresh_token },
    "grace",
  );
  assert.equal(renewed.status, 200);
  const locked = await licenceRequest(
    "/auth/refresh",
    { refresh_token: renewed.body.data.refresh_token },
    "locked",
  );
  assert.equal(locked.status, 403);
  assert.equal(locked.body.error.code, "LICENSE_INVALID");
  assert(locked.body.error.details.vendor);
  const restored = await licenceRequest("/auth/refresh", {
    refresh_token: renewed.body.data.refresh_token,
  });
  assert.equal(
    restored.status,
    200,
    "Refused refresh must not consume the token",
  );
  pass(
    "real grace login/refresh allowed; locked regular refresh403 with vendor; removing header reuses the refused unconsumed token successfully",
  );

  await prefs(original);
  j.preferences_restored = true;
  original = undefined;
  save();
  await simulate("locked");
  await expect(banner).toBeVisible();
  await app.evaluate(() => {
    globalThis.fixTest.simulation = "locked";
    assertTimer();
    function assertTimer() {
      if (!globalThis.fixTest.refreshTimer)
        throw Error("No actual scheduled refresh callback captured");
      globalThis.fixTest.refreshTimer();
    }
  });
  await expect(
    page.getByRole("heading", {
      name: "Sign in to your workspace",
      exact: true,
    }),
  ).toBeVisible();
  await expect(banner).toBeVisible();
  await expect
    .poll(() =>
      app.evaluate(() => globalThis.fixTest.refreshCalls.at(-1)?.status),
    )
    .toBe(403);
  await page
    .getByLabel("Username", { exact: true })
    .fill("codex.foundation.1792584106665");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "LICENSE_INVALID" }),
  ).toBeVisible();
  assert(!(await state()).user);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await app.evaluate(() => {
    globalThis.fixTest.simulation = null;
  });
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page.getByRole("navigation").waitFor();
  await expect(banner).toHaveCount(0);
  pass(
    "actual native scheduled refresh callback uses real locked403, clears session to login/banner; regular UI login refuses and clears password, normal login recovers",
  );
  const admin = await licenceRequest(
    "/auth/login",
    { username: "demo.it", password: "Demo-pass-2026" },
    "locked",
  );
  assert.equal(admin.status, 200);
  assert.equal(admin.body.data.license.state, "locked");
  const adminRefresh = await licenceRequest(
    "/auth/refresh",
    { refresh_token: admin.body.data.refresh_token },
    "locked",
  );
  assert.equal(adminRefresh.status, 200);
  pass(
    "real Super Admin locked login and refresh exception200; no shared-account mutation",
  );
  j.transport = await app.evaluate(() => ({
    events: globalThis.fixTest.events,
    auths: globalThis.fixTest.auths,
    refreshCalls: globalThis.fixTest.refreshCalls,
  }));
  assert(
    j.transport.auths.every(
      (a) => a.resume_from === null || a.resume_from >= 0,
    ),
  );
  j.passed = true;
  save();
} catch (e) {
  if (app)
    try {
      j.transport = await app.evaluate(() => ({
        events: globalThis.fixTest.events,
        auths: globalThis.fixTest.auths,
        refreshCalls: globalThis.fixTest.refreshCalls,
      }));
    } catch {}
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      await page.screenshot({
        path: "artifacts/backend-fix-failure.png",
        fullPage: true,
      });
      save();
    } catch {}
} finally {
  if (app && original)
    try {
      await prefs(original);
      j.preferences_restored = true;
      save();
    } catch (e) {
      j.preferences_error = e.message;
      j.passed = false;
      process.exitCode = 1;
      save();
    }
  if (it && ownsFixture)
    try {
      await owned();
      await backend("POST", "/admin/users/34/active", it, {
        active: false,
        reason: j.run + " cleanup",
      });
      j.account_deactivated = !(await owned()).is_active;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      j.passed = false;
      process.exitCode = 1;
      save();
    }
  if (app) await app.close();
  j.finished = new Date().toISOString();
  save();
}

```
