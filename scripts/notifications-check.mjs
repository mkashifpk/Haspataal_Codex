// Real DEV Notifications journey. No fabricated responses, records or events.
// Owned user34/employee36 only; existing DEMO incident1, future-due actions.
// Credentials remain in memory. Journal BEFORE writes; never repeat uncertain writes.
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
const file = "artifacts/notifications-check.json";
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    !old.attempts.some((a) => !a.finished),
    "Reconcile original uncertain mutations first",
  );
  assert(
    old.account_deactivated && old.actions.every((a) => a.cancelled),
    "Reconcile original cleanup first",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-NOTIFICATIONS-" + Date.now(),
  user_id: 34,
  employee_id: 36,
  incident_id: 1,
  attempts: [],
  actions: [],
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
  quality,
  app,
  page,
  originalPrefs,
  ownsFixture = false;
async function api(method, route, token, body, key) {
  const a =
    method !== "GET" && route !== "/auth/login"
      ? {
          method,
          route,
          key,
          body: route.includes("password") ? undefined : body,
          started: new Date().toISOString(),
          finished: false,
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
const seed = async (username) =>
  (
    await api("POST", "/auth/login", null, {
      username,
      password: "Demo-pass-2026",
    })
  ).access_token;
async function owned() {
  const u = await api("GET", "/admin/users/34", it);
  assert.equal(u.username, "codex.foundation.1792584106665");
  assert.equal(u.employee_id, 36);
  return u;
}
async function active(value) {
  await owned();
  await api("POST", "/admin/users/34/active", it, {
    active: value,
    reason: j.run + " isolated verification",
  });
  j.account_deactivated = !value;
  save();
}
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
const prefs = async (v) => {
  const r = await page.evaluate((v) => window.terminal.call("prefs", v), v);
  assert(r.ok, "Preferences refused");
};
const nav = () =>
  page.getByRole("navigation").getByRole("button", { name: /Notifications/ });
const unread = () =>
  page
    .getByRole("status")
    .filter({ hasText: /^Unread notifications:/ })
    .first();
const badge = () => nav().locator("b");
async function createAction(label) {
  const key = crypto.randomUUID(),
    body = {
      action_type: "Preventive",
      description: `${j.run} ${label}. DEMO ONLY notification verification, no real clinical task. Cancel after test.`,
      owner_user_id: 34,
      due_date: "2026-11-01",
    };
  const a = await api("POST", "/incidents/1/actions", quality, body, key);
  assert.equal(a.owner_user_id, 34);
  assert.equal(a.incident_id, 1);
  j.actions.push({
    action_id: a.action_id,
    key,
    description: body.description,
    cancelled: false,
  });
  save();
  return a;
}
async function confirmAll() {
  await page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mark all as read", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
}
save();
try {
  it = await seed("demo.it");
  quality = await seed("demo.quality");
  assert.equal((await api("GET", "/auth/me", quality)).user_id, 30);
  assert.equal(
    (await owned()).is_active,
    false,
    "Do not take over active fixture",
  );
  ownsFixture = true;
  let incident = await api("GET", "/incidents/1", quality);
  assert.equal(incident.reported_by, 34);
  assert(incident.description.includes("DEMO-FOUNDATION-1792584106665"));
  assert.equal(incident.affected, "None");
  if (incident.status === "Reported") {
    incident = await api("POST", "/incidents/1/review", quality, {
      investigator_user_id: 30,
      note: `${j.run} DEMO ONLY notification verification, not a clinical investigation.`,
      expected_version: incident.row_version,
    });
    j.incident_review = {
      status: incident.status,
      row_version: incident.row_version,
    };
    save();
  }
  assert.equal(incident.status, "UnderReview");
  await active(true);
  const temporary = (await api("POST", "/admin/users/34/reset-password", it))
    .temporary_password;
  assert(temporary);
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/notifications-profile-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(45000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.notTest = {
      writes: [],
      events: [],
      resumes: [],
      complete: 0,
      dropAll: false,
      failReads: false,
      failAfterOne: false,
      blockSocket: false,
    };
    const load = process
      .getBuiltinModule("module")
      .createRequire(process.cwd() + "/package.json");
    const WS = load("ws"),
      send = WS.prototype.send;
    WS.prototype.send = function (data, ...rest) {
      const m = JSON.parse(String(data));
      if (m.type === "auth") {
        globalThis.notSocket = this;
        globalThis.notTest.resumes.push(m.resume_from);
        this.on("message", (raw) => {
          const e = JSON.parse(String(raw));
          if (e.type === "replay_complete") globalThis.notTest.complete++;
          if (e.event_type === "session.revoked")
            globalThis.notTest.revoked = {
              id: e.event_id,
              created_at: e.created_at,
              payload: e.payload,
              replay: e.replay,
            };
          if (e.event_type === "notification.created")
            globalThis.notTest.events.push({
              id: e.event_id,
              payload: e.payload,
            });
        });
      }
      return send.call(this, data, ...rest);
    };
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL),
        u = object
          ? new URL(
              `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
            )
          : new URL(url);
      const method = (object ? url.method : options?.method) || "GET",
        n = globalThis.notTest;
      if (u.pathname === "/api/v1/auth/change-password" && method === "POST")
        return original.call(this, url, options, (response) => {
          let text = "";
          response.on("data", (chunk) => {
            text += chunk;
          });
          response.on("end", () => {
            try {
              globalThis.notCurrentAccess = JSON.parse(text).data?.access_token;
            } catch {}
          });
          callback(response);
        });
      if (n.blockSocket && u.pathname === "/ws/v1/events")
        return original.call(
          this,
          { ...url, hostname: "127.0.0.1", host: "127.0.0.1", port: 1 },
          options,
        );
      if (u.pathname.startsWith("/api/v1/notifications") && method === "POST") {
        n.writes.push({ path: u.pathname, at: Date.now() });
        return original.call(this, url, options, (response) => {
          if (n.dropAll && u.pathname.endsWith("/read-all")) {
            n.dropAll = false;
            n.writes.at(-1).actual_status = response.statusCode;
            callback(response);
            response.destroy(new Error("TEST lost real read-all reply"));
            return;
          }
          if (n.failAfterOne && /\/\d+\/read$/.test(u.pathname)) {
            n.failAfterOne = false;
            n.failReads = true;
          }
          callback(response);
        });
      }
      if (
        n.failReads &&
        u.pathname.startsWith("/api/v1/notifications") &&
        method === "GET"
      )
        return original.call(this, url, options, (response) => {
          callback(response);
          response.destroy(new Error("TEST dropped real inbox read"));
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
  originalPrefs = (await state()).prefs;
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await nav().click();
  await expect(unread()).toContainText(/\d/);
  j.renderer = await page.locator('script[type="module"]').getAttribute("src");
  save();
  const initial = Number((await unread().innerText()).split(":")[1]);
  if (!process.argv.includes("--reconnect-only")) {
    await createAction("live delivery");
    await expect(unread()).toHaveText(`Unread notifications: ${initial + 1}`);
    await expect(badge()).toHaveText(String(initial + 1));
    await expect
      .poll(() => app.evaluate(() => globalThis.notTest.events.length))
      .toBeGreaterThan(0);
    await expect(page.locator(".notification-list")).toContainText(j.run);
    pass(
      "real targeted notification.created refreshes inbox and badge without manual reload",
    );
    await page
      .getByRole("button", { name: "Mark all as read", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "including older and filtered-out items",
    );
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    assert.equal(await app.evaluate(() => globalThis.notTest.writes.length), 0);
    await confirmAll();
    await expect(unread()).toHaveText("Unread notifications: 0");
    await expect(badge()).toHaveText("0");
    assert.equal(await app.evaluate(() => globalThis.notTest.writes.length), 1);
    await page.getByLabel("Unread only", { exact: true }).check();
    await expect(
      page.getByText("No unread notifications.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Unread only", { exact: true }).uncheck();
    pass(
      "real read-all confirms all-account scope; cancel submits nothing; unread filter becomes empty and badge zero",
    );
    await createAction("read-one follow-up fault");
    await expect(unread()).toHaveText("Unread notifications: 1");
    await app.evaluate(() => {
      globalThis.notTest.failAfterOne = true;
    });
    await page
      .getByRole("button", { name: "Mark as read", exact: true })
      .first()
      .click();
    await expect(
      page.getByText(
        "Read status saved. A refresh error does not undo the saved change.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("alert")
        .filter({
          hasText: /TEST dropped real inbox read|interrupted|request failed/i,
        })
        .first(),
    ).toBeVisible();
    assert.equal(
      await page
        .getByText(/The read-status result could not be confirmed/)
        .count(),
      0,
    );
    assert.equal(await app.evaluate(() => globalThis.notTest.writes.length), 2);
    await app.evaluate(() => {
      globalThis.notTest.failReads = false;
    });
    await page
      .getByRole("button", { name: "Refresh inbox", exact: true })
      .click();
    await expect(unread()).toHaveText("Unread notifications: 0");
    pass(
      "confirmed real mark-one survives failed follow-up GET without another POST or uncertain-write message",
    );
    await createAction("lost read-all reply");
    await expect(unread()).toHaveText("Unread notifications: 1");
    await app.evaluate(() => {
      globalThis.notTest.dropAll = true;
    });
    await confirmAll();
    await expect(
      page.getByText(/The read-status result could not be confirmed/),
    ).toBeVisible();
    await createAction("arrived after uncertain read-all");
    await expect(unread()).toHaveText("Unread notifications: 1");
    await expect(
      page.getByRole("button", { name: "Mark all as read", exact: true }),
    ).toBeDisabled();
    assert.equal(await app.evaluate(() => globalThis.notTest.writes.length), 3);
    await page
      .getByRole("button", { name: "Refresh inbox", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Mark all as read", exact: true }),
    ).toBeEnabled();
    await expect(unread()).toHaveText("Unread notifications: 1");
    assert.equal(await app.evaluate(() => globalThis.notTest.writes.length), 3);
    pass(
      "lost REAL committed read-all reply is never replayed; newer notice stays unread until deliberate action after refresh",
    );
  }
  const unreadBeforeReconnect = Number(
    (await unread().innerText()).split(":")[1],
  );
  const before = await app.evaluate(() => globalThis.notTest.complete);
  await app.evaluate(() => {
    globalThis.notTest.blockSocket = true;
    globalThis.notSocket.terminate();
  });
  await createAction("offline reconnect delivery");
  await app.evaluate(() => {
    globalThis.notTest.blockSocket = false;
  });
  await expect
    .poll(() => app.evaluate(() => globalThis.notTest.complete), {
      timeout: 60000,
    })
    .toBeGreaterThan(before);
  await expect(unread()).toHaveText(
    `Unread notifications: ${unreadBeforeReconnect + 1}`,
  );
  await expect(badge()).toHaveText(String(unreadBeforeReconnect + 1));
  assert(
    (await app.evaluate(() => globalThis.notTest.resumes)).some(
      Number.isFinite,
    ),
  );
  pass(
    "real websocket disconnect/replay reconnect resynchronises unread count and badge with genuine offline arrival",
  );
  // Read the actual row by its event id; this verifies the critical toast's
  // lookup contract, without pretending an info event is critical severity.
  j.transport = await app.evaluate(() => globalThis.notTest);
  save();
  const id = j.transport.events.at(-1).payload.notification_id;
  const lookup = await page.evaluate(
    (id) =>
      window.terminal.call("api", {
        method: "GET",
        path: `/notifications?limit=200&before_id=${id + 1}`,
      }),
    id,
  );
  assert(
    lookup.ok && lookup.data.some((n) => n.notification_id === id && n.body),
  );
  pass(
    "real before_id lookup returns matching notification body; critical severity fixture remains untested",
  );
  await page.locator('[data-help="notifications.refresh"]').focus();
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText("Notifications");
  await page
    .getByRole("dialog")
    .filter({ has: page.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    page.locator('[data-help="notifications.refresh"]'),
  ).toBeFocused();
  for (const language of ["en", "ur"])
    for (const theme of ["Light", "DarkHighContrast"]) {
      await prefs({ language, theme, ui_scale_pct: 250 });
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `artifacts/notifications-${language}-${theme}-250.png`,
      });
    }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  for (const language of ["en", "ur"]) {
    await prefs({ language });
    await page.screenshot({
      path: `artifacts/notifications-${language}-100.png`,
    });
  }
  pass(
    "contextual F1 returns focus; English/Urdu Light/Dark at250 have no horizontal overflow; screenshots captured",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  if (app)
    try {
      j.transport = await app.evaluate(() => globalThis.notTest);
      j.independent_session_check = await app.evaluate(async () => {
        const load = process
          .getBuiltinModule("module")
          .createRequire(process.cwd() + "/package.json");
        const fs = load("node:fs"),
          config = JSON.parse(
            fs.readFileSync(process.env.HASPATAAL_DEV_CONFIG),
          );
        const { request, checkedRoot } = load("./electron/transport.cjs");
        if (!globalThis.notCurrentAccess) return { unavailable: true };
        const r = await request(config.server_urls[0] + "/api/v1/auth/me", {
          ca: checkedRoot(config.ca_pem, config.ca_fingerprint_sha256),
          headers: {
            Authorization: "Bearer " + globalThis.notCurrentAccess,
            "X-Haspataal-Developer": "mkashif",
            "X-Haspataal-Implementation": "1",
          },
        });
        return {
          status: r.status,
          code: r.body?.error?.code,
          request_id: r.body?.request_id,
        };
      });
    } catch {}
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      const s = await state();
      j.failure_state = {
        user_id: s.user?.user_id,
        connected: s.connected,
        workspace: s.workspace,
      };
      await page.screenshot({ path: "artifacts/notifications-failure.png" });
    } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (app)
    try {
      await app.evaluate(() => {
        if (globalThis.notTest) {
          globalThis.notTest.failReads = false;
          globalThis.notTest.blockSocket = false;
        }
      });
      if (originalPrefs) await prefs(originalPrefs);
      j.preferences_restored = !!originalPrefs;
      save();
    } catch (e) {
      j.preferences_error = e.message;
      save();
      process.exitCode = 1;
    }
  if (quality)
    for (const entry of j.actions)
      try {
        const a = await api(
          "GET",
          `/quality/actions/${entry.action_id}`,
          quality,
        );
        assert.equal(a.owner_user_id, 34);
        assert(a.description.startsWith(j.run));
        if (a.status === "Open")
          await api(
            "POST",
            `/quality/actions/${entry.action_id}/complete`,
            quality,
            {
              status: "Cancelled",
              note:
                j.run + " synthetic notification test finished; no real task.",
              expected_version: a.row_version,
            },
          );
        const after = await api(
          "GET",
          `/quality/actions/${entry.action_id}`,
          quality,
        );
        assert.equal(after.status, "Cancelled");
        entry.cancelled = true;
        save();
      } catch (e) {
        entry.cleanup_error = e.message;
        save();
        process.exitCode = 1;
      }
  if (it && ownsFixture)
    try {
      if ((await owned()).is_active) await active(false);
      j.account_deactivated = !(await owned()).is_active;
      save();
      if (j.passed && app) {
        await expect.poll(() => state().then((s) => s.user ?? null)).toBe(null);
        await expect(
          page.getByRole("heading", {
            name: "Sign in to your workspace",
            exact: true,
          }),
        ).toBeVisible();
        pass(
          "a genuine new deactivation still revokes the real session and returns Login",
        );
      }
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
