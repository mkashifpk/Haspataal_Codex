import { terminalPage } from "./terminal-page.mjs";
// Real DEV Electron checks. The only interception redirects selected network
// attempts to a closed TCP port; it never returns a fabricated API/WS response.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const config = JSON.parse(fs.readFileSync(".dev-terminal.json", "utf8"));
const capture = process.argv.includes("--capture-handbook");
const run = Date.now();
const profile = path.resolve(`artifacts/connection-profile-${run}`);
fs.mkdirSync(profile, { recursive: true });
const checks = [],
  errors = [];
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_TEST_DATA: profile,
  ProgramData: path.resolve(`artifacts/no-machine-config-${run}`),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.HASPATAAL_DEV_CONFIG;
let app, page, originalPrefs;
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
async function launch(environment) {
  app = await electron.launch({ args: ["."], env: environment });
  page = await terminalPage(app);
  page.setDefaultTimeout(25000);
  await page.setViewportSize({ width: 1366, height: 900 });
  page.on("pageerror", (e) => errors.push(e.message));
}
async function prefs(value) {
  const result = await page.evaluate(
    (v) => window.terminal.call("prefs", v),
    value,
  );
  assert(result.ok, JSON.stringify(result));
  await expect
    .poll(() => state().then((s) => s.prefs.language))
    .toBe(value.language || (await state()).prefs.language);
}
async function key(keyCode) {
  const win = await app.browserWindow(page);
  await win.evaluate((win, keyCode) => {
    for (const type of ["keyDown", "keyUp"])
      win.webContents.sendInputEvent({ type, keyCode, modifiers: ["control"] });
  }, keyCode);
}
async function fault(value) {
  await app.evaluate((_, value) => {
    globalThis.connectionFault = value;
  }, value);
}
try {
  await launch(env);
  await page
    .getByRole("heading", { name: "Your hospital, connected.", exact: true })
    .waitFor();
  // Capture the authored page in both languages using a real unconfigured state.
  for (const language of ["en", "ur"]) {
    await prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    if (capture)
      await page.screenshot({
        path: `public/handbook/connect_server-${language}.png`,
      });
  }
  await prefs({ language: "en" });
  await page
    .getByRole("button", { name: "Find servers on this network", exact: true })
    .click();
  await expect(
    page.getByLabel("Hospital server address", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Hospital server address", { exact: true }),
  ).toBeEnabled();
  if (!(await page.locator(".server-choice").count()))
    await expect(
      page.getByText(
        "No server found. Ask IT for the server address or provisioning file.",
        { exact: true },
      ),
    ).toBeVisible();
  await page
    .getByLabel("Hospital server address", { exact: true })
    .fill("https://127.0.0.1:1");
  await page
    .getByRole("button", { name: "Check server identity", exact: true })
    .click();
  await expect(page.locator(".error")).toBeVisible();
  assert.equal((await state()).server, null);
  for (const language of ["en", "ur"]) {
    for (const theme of ["Light", "DarkHighContrast"]) {
      await prefs({ language, theme, ui_scale_pct: 250 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "connection must not overflow at 250%",
      );
      await page.screenshot({
        path: `artifacts/connection-${language}-${theme}-250.png`,
        fullPage: true,
      });
    }
  }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  checks.push(
    "real discovery busy/result-or-empty state, failed identity download stays untrusted, EN/UR both themes at 250% without horizontal overflow",
  );
  await page
    .getByLabel("Hospital server address", { exact: true })
    .fill(config.server_urls[0]);
  await page
    .getByRole("button", { name: "Check server identity", exact: true })
    .click();
  await page
    .getByLabel("Fingerprint supplied by IT", { exact: true })
    .waitFor();
  assert.equal(
    (await state()).server,
    null,
    "inspection cannot trust a hospital",
  );
  const fp = page.getByLabel("Fingerprint supplied by IT", { exact: true });
  await fp.fill("00:00");
  await expect(
    page.getByRole("button", { name: "They match — connect", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Hospital server address", { exact: true })
    .fill(config.server_urls[0] + "/");
  await expect(fp).toHaveCount(0);
  await page
    .getByRole("button", { name: "Check server identity", exact: true })
    .click();
  await fp.waitFor();
  await expect(fp).toHaveValue("");
  await fp.focus();
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article")).toContainText(
    "Connect to your hospital",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(fp).toBeFocused();
  await fp.fill(config.ca_fingerprint_sha256);
  await page
    .getByRole("button", { name: "They match — connect", exact: true })
    .click();
  await page.getByLabel("Username", { exact: true }).waitFor();
  const first = await state();
  assert(first.connected);
  assert.equal(first.server.source, "user");
  const info = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/meta/server-info" }),
  );
  assert(info.ok);
  for (const url of info.data.urls)
    assert(first.server.urls.includes(new URL(url).origin));
  checks.push(
    "first-run real CA inspection, mismatch blocked, address edit clears confirmation, F1 restores field, explicit trust saves all real advertised URLs",
  );

  // Exercise native zoom on the pre-login terminal and across an app restart.
  for (let n = 0; n < 17; n++) await key("=");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(250);
  await key("0");
  for (let n = 0; n < 2; n++) await key("-");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(100);
  await prefs({ language: "ur", ui_scale_pct: 250, theme: "DarkHighContrast" });
  await app.close();
  app = undefined;
  await launch(env);
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(250);
  assert.equal((await state()).server.source, "user");
  await page.screenshot({ path: "artifacts/connection-reopened-urdu250.png" });
  await prefs({ language: "en", ui_scale_pct: 100, theme: "Light" });
  checks.push(
    "pre-login native zoom bounds/reset and terminal preferences/pinned saved server survive app restart",
  );

  // Observe real requests without recording credentials, tokens or request bodies.
  await app.evaluate(() => {
    const https = process.getBuiltinModule("https");
    const original = https.request;
    globalThis.connectionRequests = [];
    globalThis.connectionFault = null;
    globalThis.connectionReplay = { auth: [], welcome: [], complete: 0 };
    const load = process
      .getBuiltinModule("module")
      .createRequire(process.cwd() + "/package.json");
    const WebSocket = load("ws");
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data, ...rest) {
      const message = JSON.parse(String(data));
      if (message.type === "auth" && "resume_from" in message) {
        globalThis.connectionReplay.auth.push(message.resume_from);
        globalThis.connectionSocket = this;
        if (!this.connectionObserved) {
          this.connectionObserved = true;
          this.on("message", (data) => {
            const event = JSON.parse(String(data));
            if (event.type === "welcome")
              globalThis.connectionReplay.welcome.push(event.last_event_id);
            if (event.type === "replay_complete")
              globalThis.connectionReplay.complete++;
          });
        }
      }
      return send.call(this, data, ...rest);
    };
    https.request = function (url, options, callback) {
      const objectOptions = typeof url === "object" && !(url instanceof URL);
      const target = objectOptions
        ? new URL(
            `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
          )
        : new URL(url);
      const method = (objectOptions ? url.method : options?.method) || "GET";
      const f = globalThis.connectionFault;
      const blocked =
        f &&
        (f.all || f.origin === target.origin || (f.write && method !== "GET"));
      globalThis.connectionRequests.push({
        origin: target.origin,
        path: target.pathname,
        method,
        blocked: !!blocked,
        at: Date.now(),
      });
      if (blocked) {
        if (objectOptions)
          return original.call(
            this,
            { ...url, hostname: "127.0.0.1", host: "127.0.0.1", port: 1 },
            options,
          );
        target.hostname = "127.0.0.1";
        target.port = "1";
      }
      return original.call(
        this,
        objectOptions ? url : target,
        options,
        callback,
      );
    };
  });
  const current = (await state()).server.current;
  const alternatives = (await state()).server.urls.filter((u) => u !== current);
  assert(
    alternatives.length,
    "real server must advertise at least one alternate to verify failover",
  );
  await page.evaluate(() => {
    window.connectionEvents = [];
    window.terminal.subscribe((e) => {
      if (e.type === "connection") window.connectionEvents.push(e.connected);
    });
  });
  await fault({ origin: current });
  const failover = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/terminals/whoami" }),
  );
  assert(failover.ok, JSON.stringify(failover));
  assert.notEqual((await state()).server.current, current);
  assert(!(await page.evaluate(() => window.connectionEvents)).includes(false));
  await fault(null);
  checks.push(
    "failed address switches to a real pinned alternate before offline banner; original GET completes",
  );

  await fault({ write: true });
  const refused = await page.evaluate(() =>
    window.terminal.call("login", {
      username: "connection-network-probe",
      password: "never-sent",
    }),
  );
  assert(!refused.ok);
  const attempts = await app.evaluate(() =>
    globalThis.connectionRequests.filter((r) => r.method === "POST"),
  );
  assert.equal(
    attempts.length,
    1,
    "uncertain writes must not be replayed on an alternate",
  );
  await fault(null);
  checks.push(
    "network-failed POST attempted once only; alternate liveness cannot replay a login/write",
  );

  await page.getByLabel("Username", { exact: true }).fill("demo.owner");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page.getByRole("navigation").waitFor();
  originalPrefs = (await state()).prefs;
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Report an incident/ })
    .click();
  const draft = page.locator("textarea").first();
  await draft.fill("UNSENT connection recovery check " + run);
  await expect
    .poll(() => page.locator(".connection-state").innerText(), {
      timeout: 40000,
    })
    .toContain("Live");
  await fault({ all: true });
  const offline = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/terminals/whoami" }),
  );
  assert(!offline.ok);
  await expect(page.locator(".offline-banner")).toBeVisible();
  await expect(draft).toHaveValue("UNSENT connection recovery check " + run);
  const write = await page.evaluate(() =>
    window.terminal.call("api", {
      method: "POST",
      path: "/incidents",
      body: {},
      key: "unsent-connection-test",
    }),
  );
  assert.equal(write.error.code, "OFFLINE");
  // Force the existing real WebSocket closed; its subsequent connections fail
  // through the same network fault. No fake welcome/event is injected.
  await app.evaluate(() => globalThis.connectionSocket.terminate());
  await fault(null);
  await expect
    .poll(() => state().then((s) => s.connected), { timeout: 40000 })
    .toBe(true);
  await expect
    .poll(() => page.locator(".connection-state").innerText(), {
      timeout: 40000,
    })
    .toContain("Live");
  await expect(draft).toHaveValue("UNSENT connection recovery check " + run);
  const replay = await app.evaluate(() => globalThis.connectionReplay);
  assert(replay.auth.length >= 2);
  assert.equal(replay.auth[0], null);
  assert(
    Number.isInteger(replay.auth.at(-1)) &&
      replay.auth.at(-1) >= replay.welcome[0],
  );
  assert(replay.complete >= 1, "real backend must confirm replay completion");
  await page.screenshot({ path: "artifacts/connection-recovered-draft.png" });
  checks.push(
    "real DEV outage blocks writes, keeps the current draft and reconnects real WebSocket to Live",
  );
  await draft.fill("");
  await prefs(originalPrefs);
  originalPrefs = undefined;
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/connection-check.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        scope:
          "Real DEV read/login/restore-preferences only; closed-port network fault injection; no submitted business records, human review or fabricated response.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (error) {
  if (page)
    await page
      .screenshot({ path: "artifacts/connection-failure.png" })
      .catch(() => {});
  throw error;
} finally {
  if (app) {
    await fault(null).catch(() => {});
    if (originalPrefs) await prefs(originalPrefs).catch(() => {});
    await app.close();
  }
}
