// Real DEV Login/refusal journey. Only verified synthetic user34/employee36.
// Passwords/tokens stay in process memory. No shared account password/global change.
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
const file = "artifacts/login-refusal-check.json";
const recoveryOnly = process.argv.includes("--recovery-only");
if (recoveryOnly) {
  const completed = JSON.parse(
    fs.readFileSync("artifacts/login-refusal-complete-first-run-20261022.json"),
  );
  assert(
    completed.passed && completed.account_deactivated,
    "Recovery-only needs the confirmed earlier full refusal run",
  );
}
fs.mkdirSync("artifacts", { recursive: true });
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    !prior.attempts?.some((a) => !a.finished),
    "Reconcile an uncertain original mutation before a new test; never repeat a lost reset",
  );
  assert(
    !["pending", "server-committed-recovery-required"].includes(
      prior.password_change?.outcome,
    ),
    "Reconcile the original password-change outcome before another run",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-LOGIN-" + Date.now(),
  user_id: 34,
  employee_id: 36,
  checks: [],
  attempts: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
const pass = (check) => {
  j.checks.push(check);
  save();
  console.log("PASS " + check);
};
let it, app, page, temporary, password;
const username = "codex.foundation.1792584106665";
async function backend(method, route, token, body) {
  const attempt =
    method !== "GET" && route !== "/auth/login"
      ? { method, route, started: new Date().toISOString(), finished: false }
      : null;
  if (attempt) {
    j.attempts.push(attempt);
    save();
  }
  const r = await request(config.server_urls[0] + "/api/v1" + route, {
    ca,
    method,
    body,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
    },
  });
  if (attempt) {
    attempt.status = r.status;
    attempt.request_id = r.body?.request_id;
    attempt.finished = true;
    save();
  }
  return r;
}
async function successful(method, route, token, body) {
  const r = await backend(method, route, token, body);
  assert(
    r.status < 400,
    `${method} ${route}: ${r.status} ${r.body?.error?.code}`,
  );
  return r.body.data;
}
async function owned() {
  const u = await successful("GET", "/admin/users/34", it);
  assert.equal(u.username, username);
  assert.equal(u.employee_id, 36);
  return u;
}
async function active(value) {
  await owned();
  await successful("POST", "/admin/users/34/active", it, {
    active: value,
    reason: j.run + " isolated login verification",
  });
}
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
const count = () => app.evaluate(() => globalThis.loginCalls);
async function ready() {
  await page.getByLabel("Username", { exact: true }).waitFor();
  await expect(
    page.getByRole("button", { name: "Sign in →", exact: true }),
  ).toBeEnabled();
}
async function credentials(value) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(value);
}
async function submit(value) {
  await credentials(value);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
}
async function refused(code) {
  await expect(page.getByRole("alert").filter({ hasText: code })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  assert.equal((await state()).user, null);
}
async function change(current, next) {
  await page.getByLabel("Current password", { exact: true }).fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password", { exact: true }).fill(next);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
}
save();
try {
  it = (
    await successful("POST", "/auth/login", null, {
      username: "demo.it",
      password: "Demo-pass-2026",
    })
  ).access_token;
  const initial = await owned();
  assert.equal(
    initial.is_active,
    false,
    "Do not take over a currently active fixture",
  );
  temporary = (await successful("POST", "/admin/users/34/reset-password", it))
    .temporary_password;
  assert(temporary);
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/login-refusal-profile-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(45000);
  await ready();
  await app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.loginCalls = 0;
    globalThis.loginResponses = [];
    globalThis.dropLogin = false;
    globalThis.delayLogin = false;
    globalThis.passwordCalls = 0;
    globalThis.dropPassword = false;
    globalThis.logoutAll = [];
    globalThis.logoutCalls = 0;
    globalThis.delayLogout = false;
    https.request = function (url, options, callback) {
      const u =
        typeof url === "object" && !(url instanceof URL)
          ? new URL(
              `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
            )
          : new URL(url);
      if (u.pathname === "/api/v1/auth/login" && options?.method === "POST") {
        globalThis.loginCalls++;
        return original.call(this, url, options, (response) => {
          globalThis.loginResponses.push(response.statusCode);
          if (globalThis.dropLogin) {
            globalThis.dropLogin = false;
            callback(response);
            response.destroy(new Error("TEST lost REAL login reply"));
            return;
          }
          if (globalThis.delayLogin) {
            globalThis.delayLogin = false;
            response.pause();
            setTimeout(() => {
              callback(response);
              response.resume();
            }, 2000);
            return;
          }
          callback(response);
        });
      }
      if (
        u.pathname === "/api/v1/auth/change-password" &&
        options?.method === "POST"
      ) {
        globalThis.passwordCalls++;
        if (globalThis.dropPassword) {
          globalThis.dropPassword = false;
          return original.call(this, url, options, (response) => {
            globalThis.passwordReplyStatus = response.statusCode;
            callback(response);
            response.destroy(new Error("TEST lost REAL password-change reply"));
          });
        }
      }
      if (u.pathname === "/api/v1/auth/logout" && options?.method === "POST") {
        globalThis.logoutCalls++;
        // Delay sending this real request, not a server result: both windows
        // remain authenticated while duplicate submission guards are exercised.
        const req = original.call(this, url, options, callback),
          end = req.end,
          write = req.write;
        const chunks = [];
        req.write = function (data) {
          chunks.push(Buffer.from(data));
          return true;
        };
        req.end = function (data, ...args) {
          if (data) chunks.push(Buffer.from(data));
          const body = Buffer.concat(chunks);
          globalThis.logoutAll.push(JSON.parse(String(body)).all_sessions);
          const send = () => {
            write.call(req, body);
            return end.call(req, undefined, ...args);
          };
          if (globalThis.delayLogout) {
            globalThis.delayLogout = false;
            setTimeout(send, 3000);
            return req;
          }
          return send();
        };
        return req;
      }
      return original.call(this, url, options, callback);
    };
  });
  let n;
  if (!recoveryOnly) {
    n = await count();
    await submit(temporary);
    await refused("ACCOUNT_DISABLED");
    assert.equal(await count(), n + 1);
    pass(
      "real ACCOUNT_DISABLED shown, password cleared and no automatic login retry",
    );
    await active(true);
    n = await count();
    await submit("DEMO deliberately wrong password");
    await refused("INVALID_CREDENTIALS");
    assert.equal(await count(), n + 1);
    pass(
      "real INVALID_CREDENTIALS shown with cleared password and retained username",
    );
    let lock;
    for (let i = 0; i < 8; i++) {
      await submit("DEMO deliberately wrong password");
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
        "",
      );
      lock = await owned();
      if (lock.locked_until) break;
      await ready();
    }
    assert(
      lock.locked_until,
      "Bounded isolated failures did not reach the documented lockout; stop, never flood shared login",
    );
    // The threshold attempt can still be INVALID_CREDENTIALS; one explicit next attempt retrieves ACCOUNT_LOCKED.
    if (
      !(await page
        .getByRole("alert")
        .filter({ hasText: "ACCOUNT_LOCKED" })
        .count())
    ) {
      await ready();
      await submit(temporary);
    }
    await refused("ACCOUNT_LOCKED");
    const lockedButton = page.getByRole("button", { name: /Try again in/ });
    await expect(lockedButton).toBeDisabled();
    const before = Number(
      (await lockedButton.innerText()).match(/(\d+)s/)?.[1],
    );
    assert(before > 0);
    n = await count();
    await new Promise((r) => setTimeout(r, 2100));
    const after = Number((await lockedButton.innerText()).match(/(\d+)s/)?.[1]);
    assert(after < before);
    assert.equal(await count(), n);
    pass(
      "real ACCOUNT_LOCKED server countdown decreases and waiting never resubmits login",
    );
    await active(true); // documented reactivation also unlocks this owned fixture
    assert.equal((await owned()).locked_until, null);
  }
  if (recoveryOnly) await active(true);
  await page.reload();
  await ready();
  await app.evaluate(() => {
    globalThis.dropLogin = true;
  });
  n = await count();
  await submit(temporary);
  await expect(
    page.getByText(/^Sign-in could not be confirmed\./),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  assert.equal((await state()).user, null);
  assert.equal(await count(), n + 1);
  assert.equal(await app.evaluate(() => globalThis.loginResponses.at(-1)), 200);
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(await count(), n + 1);
  pass(
    "lost REAL committed login200 stays explicitly uncertain, no token success or automatic POST retry",
  );
  await app.evaluate(() => {
    globalThis.delayLogin = true;
  });
  n = await count();
  await credentials(temporary);
  await page.locator("form").evaluate((f) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await expect(page.locator("form[data-write-pending=true]")).toHaveCount(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Change your password", exact: true }),
  ).toBeVisible();
  assert.equal(await count(), n + 1);
  assert((await state()).user.must_change_password);
  pass(
    "double submit sends ONE real login; pending navigation guarded; deliberate recovery forces password change",
  );
  const minimum = (await successful("GET", "/meta/settings", it))
    .password_min_length;
  if (minimum > 8) {
    await change(temporary, "A!a12345");
    await expect(
      page.getByRole("alert").filter({ hasText: "PASSWORD_POLICY" }),
    ).toBeVisible();
    assert((await state()).user.must_change_password);
    pass(
      "server password_min_length policy refusal displayed; forced-password gate retained",
    );
  }
  password = "Demo!" + crypto.randomBytes(16).toString("hex") + "A9";
  await change("DEMO incorrect current password", password);
  await expect(
    page.getByRole("alert").filter({ hasText: "INVALID_CREDENTIALS" }),
  ).toBeVisible();
  assert((await state()).user.must_change_password);
  const passwordCalls = await app.evaluate(() => globalThis.passwordCalls);
  await app.evaluate(() => {
    globalThis.dropPassword = true;
  });
  j.password_change = { started: new Date().toISOString(), outcome: "pending" };
  save();
  await page.getByLabel("Current password", { exact: true }).fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page.locator("form[data-unsaved]").evaluate((f) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  const recovery = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Confirm your session",
      exact: true,
    }),
  });
  await expect(recovery).toBeVisible();
  assert.equal(await app.evaluate(() => globalThis.passwordReplyStatus), 200);
  j.password_change.outcome = "server-committed-recovery-required";
  save();
  assert.equal(
    await app.evaluate(() => globalThis.passwordCalls),
    passwordCalls + 1,
  );
  const frozen = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/auth/me" }),
  );
  assert.equal(frozen.ok, false);
  await recovery.getByLabel("Password", { exact: true }).fill(password);
  await recovery
    .getByRole("button", { name: "Confirm your session", exact: true })
    .click();
  await expect(recovery).toHaveCount(0);
  j.password_change.outcome = "recovered";
  save();
  assert.equal(
    await app.evaluate(() => globalThis.passwordCalls),
    passwordCalls + 1,
  );
  await expect
    .poll(() => state().then((s) => s.user?.must_change_password))
    .toBe(false);
  await page.getByRole("navigation").waitFor();
  pass(
    "wrong-current-password refusal retains gate; lost REAL committed password reply freezes operations and same-account recovery uses new password without duplicate write",
  );
  const secondary = (
    await successful("POST", "/auth/login", null, { username, password })
  ).access_token;
  assert.equal((await backend("GET", "/auth/me", secondary)).status, 200);
  const code = (await state()).user.workspaces[0].code;
  const nextWindow = app.waitForEvent("window");
  const opened = await page.evaluate(
    (code) => window.terminal.call("workspace", { code, newWindow: true }),
    code,
  );
  assert(opened.ok);
  const other = await nextWindow;
  await other.getByRole("navigation").waitFor();
  await app.evaluate(() => {
    globalThis.delayLogout = true;
  });
  await page.locator(".avatar").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out everywhere", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Sign out everywhere", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Signing out…", { exact: true })).toBeVisible();
  const duplicate = await other.evaluate(() =>
    window.terminal.call("logout", { all: true }),
  );
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error.message, /already pending/);
  assert.equal(await app.evaluate(() => globalThis.logoutCalls), 1);
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(other.getByLabel("Username", { exact: true })).toBeVisible();
  const ended = await backend("GET", "/auth/me", secondary);
  assert.equal(await app.evaluate(() => globalThis.logoutCalls), 1);
  assert.deepEqual(await app.evaluate(() => globalThis.logoutAll), [true]);
  assert.equal(ended.status, 401);
  j.secondary_refusal = {
    status: ended.status,
    code: ended.body?.error?.code,
    request_id: ended.body?.request_id,
  };
  pass(
    "duplicate renderer/native logout sends ONE all_sessions=true POST; both windows clear and separate real session is revoked",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.message;
  save();
  throw e;
} finally {
  if (app) await app.close();
  if (it) {
    try {
      if ((await owned()).is_active) await active(false);
      j.account_deactivated = !(await owned()).is_active;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      j.passed = false;
      save();
    }
  }
}
