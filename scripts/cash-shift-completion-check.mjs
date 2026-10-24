// Real DEV, one owned zero-cash shift only. No payment, patient or physical cash claim.
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
const file = "artifacts/cash-shift-completion.json";

if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      (!prior.terminal_id || prior.terminal_deactivated) &&
      prior.attempts.every((a) => a.finished) &&
      (!prior.shift_id || prior.shift_closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/cash-completion-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/cash-completion-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/cash-completion-native-writes.json",
      `artifacts/cash-completion-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-CASH-COMPLETION-" + Date.now(),
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
          body:
            route.includes("password") || body?.__multipart ? undefined : body,
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
  const u = await backend("GET", `/admin/users/${j.user_id}`, it);
  assert.equal(u.username, j.username);
  assert.equal(u.employee_id, j.employee_id);
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
      "artifacts/cash-shift-profile-" + Date.now(),
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
  const hr = (
    await backend("POST", "/auth/login", null, {
      username: "demo.hr",
      password: "Demo-pass-2026",
    })
  ).access_token;
  j.username = "codex.cash." + Date.now();
  save();
  const employee = await backend(
    "POST",
    "/hr/employees",
    hr,
    {
      full_name: "DEMO ONLY " + j.run,
      cnic: "99999" + String(Date.now()).slice(-8),
      mobile: "00000000000",
      staff_category: "Administrative",
      designation: "DEMO ONLY cash workflow",
    },
    j.run + "-employee",
  );
  j.employee_id = employee.employee_id;
  save();
  await backend(
    "POST",
    "/hr/employees/" + j.employee_id + "/documents",
    hr,
    {
      __multipart: [
        { name: "doc_type", value: "CNIC" },
        {
          name: "title",
          value: "DEMO ONLY software test image, not identity evidence",
        },
        {
          name: "file",
          filename: "DEMO-ONLY.png",
          type: "image/png",
          bytes: fs.readFileSync("public/handbook/connect_server-en.png"),
        },
      ],
    },
    j.run + "-document",
  );
  await backend("POST", "/hr/employees/" + j.employee_id + "/submit", hr);
  const provisioned = await backend(
    "POST",
    "/admin/users",
    it,
    {
      employee_id: j.employee_id,
      username: j.username,
      role_codes: ["receptionist"],
    },
    j.run + "-provision",
  );
  j.user_id = provisioned.user_id;
  save();
  const temporary = provisioned.temporary_password;
  ownsFixture = true;
  const terminalMac =
    "02:" + crypto.randomBytes(5).toString("hex").match(/../g).join(":");
  j.terminal_body = {
    mac: terminalMac,
    location_label: "DEMO ONLY " + j.run,
    cash_node: "MainReception",
    is_active: true,
  };
  j.terminal_key = crypto.randomUUID();
  save();
  const fixtureTerminal = await backend(
    "POST",
    "/admin/terminals",
    it,
    j.terminal_body,
    j.terminal_key,
  );
  j.terminal_id = fixtureTerminal.terminal_id;
  save();
  await app.evaluate(
    (_electron, { terminalMac }) => {
      const https = process.getBuiltinModule("https"),
        original = https.request,
        fs = process.getBuiltinModule("fs");
      globalThis.cashTest = { writes: [], dropOpen: false, dropClose: false };
      const persist = () =>
        fs.writeFileSync(
          process.cwd() + "/artifacts/cash-completion-native-writes.json",
          JSON.stringify(globalThis.cashTest.writes, null, 2),
        );
      persist();
      https.request = function (url, options, callback) {
        const object = typeof url === "object" && !(url instanceof URL);
        // Test-only emulated terminal hardware identity, backed by an actual owned DEV mapping.
        // No fabricated server data and no change to this laptop's real terminal registration.
        const reqOptions = object ? url : options;
        reqOptions.headers = {
          ...reqOptions.headers,
          "X-Terminal-Mac": terminalMac,
        };
        const u = object
          ? new URL(
              "https://" +
                (url.hostname || url.host) +
                ":" +
                (url.port || 443) +
                (url.path || "/"),
            )
          : new URL(url);
        const method = (object ? url.method : options?.method) || "GET";
        if (method === "GET" && globalThis.cashTest.dropRead === u.pathname) {
          return original.call(this,url,options,response=>{
            callback(response);
            response.destroy(new Error("TEST lost actual shift response before delivery"));
          });
        }
        if (
          method === "POST" &&
          /^\/api\/v1\/finance\/cash-shifts\//.test(u.pathname)
        ) {
          const a = {
            path: u.pathname,
            key: options?.headers?.["Idempotency-Key"],
            body: "",
            finished: false,
          };
          globalThis.cashTest.writes.push(a);
          persist();
          const req = original.call(this, url, options, (response) => {
            a.status = response.statusCode;
            a.replay = response.headers["idempotent-replay"];
            a.finished = true;
            persist();
            callback(response);
            const isOpen = u.pathname.endsWith("/open"),
              isClose = u.pathname.endsWith("/close");
            if (
              (isOpen && globalThis.cashTest.dropOpen) ||
              (isClose && globalThis.cashTest.dropClose)
            ) {
              if (isOpen) globalThis.cashTest.dropOpen = false;
              else globalThis.cashTest.dropClose = false;
              response.destroy(
                new Error("TEST lost REAL committed cash shift reply"),
              );
            }
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
    },
    { terminalMac },
  );
  await page.getByLabel("Username", { exact: true }).fill(j.username);
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
      username: j.username,
      password,
    })
  ).access_token;
  j.renderer = await page.locator('script[type="module"]').getAttribute("src");
  save();
  await nav("My cash shift");
  await expect(
    page.getByRole("heading", { name: "My cash shift", exact: true }),
  ).toBeVisible();
  const before = await native("GET", "/finance/cash-shifts/mine");
  assert(
    !before || before.status !== "Open",
    "Owned account already has an open shift; reconcile first",
  );
  await backend("PUT", "/admin/terminals/" + j.terminal_id, it, {
    ...j.terminal_body,
    cash_node: null,
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText("Not mapped — ask IT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open cash shift", exact: true }),
  ).toBeDisabled();
  await backend(
    "PUT",
    "/admin/terminals/" + j.terminal_id,
    it,
    j.terminal_body,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open cash shift", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Opening float", { exact: true }).fill("-1");
  await expect(
    page.getByRole("button", { name: "Open cash shift", exact: true }),
  ).toBeDisabled();
  pass(
    "actual unmapped terminal blocks opening; real mapping restored; negative float disabled",
  );
  const terminal = await native("GET", "/terminals/whoami");
  assert(
    terminal.cash_node,
    "Actual terminal must have a cash counter mapping",
  );
  await page.getByLabel("Opening float", { exact: true }).fill("0");
  await app.evaluate(() => {
    globalThis.cashTest.dropOpen = true;
  });
  await page
    .getByRole("button", { name: "Open cash shift", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await expect(
    page.getByRole("heading", {
      name: "Check the original shift before continuing",
      exact: true,
    }),
  ).toBeVisible();
  const opened = await native("GET", "/finance/cash-shifts/mine");
  assert.equal(opened.user_id, j.user_id);
  assert.equal(opened.node, terminal.cash_node);
  assert.equal(opened.opening_float, 0);
  assert.equal(opened.expected_cash, 0);
  j.shift_id = opened.shift_id;
  save();
  const deniedToken = (
    await backend("POST", "/auth/login", null, {
      username: "demo.admissions",
      password: "Demo-pass-2026",
    })
  ).access_token;
  for (const [method, route, body] of [
    [
      "POST",
      "/finance/cash-shifts/open",
      { node: "MainReception", opening_float: 0 },
    ],
    ["GET", "/finance/cash-shifts/mine"],
    ["GET", "/finance/cash-shifts/" + j.shift_id + "/transactions"],
    [
      "POST",
      "/finance/cash-shifts/" + j.shift_id + "/close",
      { declared_cash: 0 },
    ],
  ]) {
    const r = await request(config.server_urls[0] + "/api/v1" + route, {
      ca,
      method,
      body,
      headers: {
        Authorization: "Bearer " + deniedToken,
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    });
    j.requests.push({
      method,
      route,
      status: r.status,
      code: r.body?.error?.code,
      request_id: r.body?.request_id,
    });
    save();
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, "FORBIDDEN");
  }
  pass(
    "screen_test_plan four operations denied403/FORBIDDEN to actual admissions role; own drawer remains open",
  );

  assert.equal(
    (await app.evaluate(() => globalThis.cashTest.writes)).length,
    1,
  );
  await page
    .getByRole("button", { name: "Retry original opening", exact: true })
    .click();
  await expect(page.getByText(/Cash shift opened successfully/)).toBeVisible();
  const openings = await app.evaluate(() => globalThis.cashTest.writes);
  assert.equal(openings.length, 2);
  assert.equal(openings[0].key, openings[1].key);
  assert.equal(openings[0].body, openings[1].body);
  assert.equal(openings[1].replay, "true");
  pass(
    "actual zero-float open; duplicate click one POST, real committed lost reply, deliberate identical original-key/body replay returns same shift",
  );
  const cash = page.getByLabel("Counted cash in drawer", { exact: true });
  await cash.fill("0");
  await cash.focus();
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText("My cash shift");
  await page
    .getByRole("dialog")
    .filter({ has: page.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(cash).toBeFocused();
  await expect(cash).toHaveValue("0");
  await page.getByRole("button", { name: "Close shift", exact: true }).click();
  const confirm = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Confirm Shift Closure",
      exact: true,
    }),
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(cash).toHaveValue("0");
  assert.equal(
    (await native("GET", "/finance/cash-shifts/mine")).status,
    "Open",
  );
  pass(
    "counted zero accepted; F1 preserves amount/focus; cancelling close confirmation never closes the drawer",
  );
  for (const language of ["en", "ur"]) {
    await prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator(".notice[role=status]")).toContainText(language === "ur" ? "کیش شفٹ کامیابی سے کھل گئی۔" : "Cash shift opened successfully.");
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({
      path: `artifacts/cash-completion-${language}.png`,
    });
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
        path: `artifacts/cash-shift-${language}-${theme}-250.png`,
      });
    }
  }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  pass(
    "real open-shift ledger/empty collections, current bilingual screenshots and both themes at250 without horizontal overflow",
  );
  // Change only our synthetic terminal after confirmation: current server mapping wins.
  await page.getByRole("button", { name: "Close shift", exact: true }).click();
  const writeCount = (await app.evaluate(() => globalThis.cashTest.writes))
    .length;
  await backend("PUT", "/admin/terminals/" + j.terminal_id, it, {
    ...j.terminal_body,
    cash_node: "PharmacyCounter",
  });
  await confirm
    .getByRole("button", { name: "Confirm & Close Shift", exact: true })
    .click();
  await expect(
    page.getByText(
      "The terminal counter changed or is unavailable. Refresh and ask IT before handling cash.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(
    (await app.evaluate(() => globalThis.cashTest.writes)).length,
    writeCount,
  );
  await confirm.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(cash).toHaveValue("0");
  await backend(
    "PUT",
    "/admin/terminals/" + j.terminal_id,
    it,
    j.terminal_body,
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Close shift", exact: true }),
  ).toBeEnabled();
  pass(
    "fresh mapping changes block closure before any POST; counted draft retained; restored real mapping + Refresh recovers",
  );
  await app.evaluate((_electron, id) => {
    globalThis.cashTest.dropRead = "/api/v1/finance/cash-shifts/" + id;
  }, j.shift_id);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText(
      "The reviewed shift is not current. Refresh successfully before closing; your counted cash is kept.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close shift", exact: true }),
  ).toBeDisabled();
  await expect(cash).toHaveValue("0");
  // Keep fault active through native GET retries, then restore only after the visible error.
  await expect(page.locator(".error").first()).toBeVisible();
  await app.evaluate(() => {
    globalThis.cashTest.dropRead = undefined;
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Close shift", exact: true }),
  ).toBeEnabled();
  pass(
    "lost reviewed-shift read blocks closure and preserves counted draft; successful retry restores eligibility",
  );

  await page.getByRole("button", { name: "Close shift", exact: true }).click();
  await app.evaluate(() => {
    globalThis.cashTest.dropClose = true;
  });
  await confirm
    .getByRole("button", { name: "Confirm & Close Shift", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await expect(
    page.getByRole("heading", {
      name: "Check the original shift before continuing",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    await page
      .getByRole("button", { name: "Retry original opening", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Check original shift", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Server status checked", exact: true }),
  ).toBeVisible();
  const closed = await native("GET", `/finance/cash-shifts/${j.shift_id}`);
  assert.equal(closed.status, "PendingCollection");
  assert.equal(closed.declared_cash, 0);
  assert.equal(closed.expected_cash, 0);
  assert.equal(closed.cash_drop, null);
  const repeat = await request(
    config.server_urls[0] +
      "/api/v1/finance/cash-shifts/" +
      j.shift_id +
      "/close",
    {
      ca,
      method: "POST",
      body: { declared_cash: 0 },
      headers: {
        Authorization: "Bearer " + ownToken,
        "X-Terminal-Mac": j.terminal_body.mac,
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    },
  );
  j.requests.push({
    method: "POST",
    route: "/finance/cash-shifts/" + j.shift_id + "/close",
    status: repeat.status,
    code: repeat.body?.error?.code,
    request_id: repeat.body?.request_id,
  });
  save();
  assert.equal(repeat.body?.error?.code, "SHIFT_NOT_OPEN");
  pass(
    "already-closed owned drawer refuses second closure with SHIFT_NOT_OPEN; no duplicate cash effect",
  );
  j.closed_shift = closed;
  j.shift_closed = true;
  save();
  assert.equal(
    (await app.evaluate(() => globalThis.cashTest.writes)).filter((w) =>
      w.path.endsWith("/close"),
    ).length,
    1,
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Close reviewed attempt", exact: true })
    .click();
  await expect(
    page.getByText(/Recovery hold cleared after review/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Pending collection/ }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/cash-shift-closed.png" });
  pass(
    "actual zero-count closure -> PendingCollection; committed lost close reply reconciles exact original shift, no replay or accountant verification",
  );
  await page
    .getByRole("button", { name: "Show my current shift", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Open cash shift", exact: true }),
  ).toBeVisible();
  j.transport = await app.evaluate(() => globalThis.cashTest);
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      await page.screenshot({ path: "artifacts/cash-shift-failure.png" });
    } catch {}
} finally {
  // Only a verified zero-value open shift owned by this fixture can be closed in cleanup.
  if (ownToken)
    try {
      const shift = await backend("GET", "/finance/cash-shifts/mine", ownToken);
      if (shift?.status === "Open") {
        assert.equal(shift.user_id, j.user_id);
        assert.equal(shift.opening_float, 0);
        assert.equal(shift.expected_cash, 0);
        if (j.shift_id) assert.equal(shift.shift_id, j.shift_id);
        j.shift_id = shift.shift_id;
        save();
        await backend(
          "POST",
          `/finance/cash-shifts/${shift.shift_id}/close`,
          ownToken,
          { declared_cash: 0 },
        );
      }
      if (j.shift_id) {
        const row = await backend(
          "GET",
          `/finance/cash-shifts/${j.shift_id}`,
          ownToken,
        );
        assert.equal(row.status, "PendingCollection");
        j.shift_closed = true;
      }
    } catch (e) {
      j.shift_cleanup_error = e.message;
      j.passed = false;
      process.exitCode = 1;
      save();
    }
  if (app && original)
    try {
      await prefs(original);
      j.preferences_restored = true;
      save();
    } catch (e) {
      j.preferences_error = e.message;
      process.exitCode = 1;
      j.passed = false;
      save();
    }
  if (it && ownsFixture)
    try {
      await owned();
      await backend("POST", `/admin/users/${j.user_id}/active`, it, {
        active: false,
        reason: j.run + " test cleanup",
      });
      j.account_deactivated = !(await owned()).is_active;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      j.passed = false;
      process.exitCode = 1;
      save();
    }
  if (it && j.terminal_id)
    try {
      const rows = await backend("GET", "/admin/terminals", it);
      const t = rows.find((t) => t.terminal_id === j.terminal_id);
      assert.equal(t?.location_label, j.terminal_body.location_label);
      assert.equal(
        t?.mac.toLowerCase().replaceAll("-", ":"),
        j.terminal_body.mac.toLowerCase(),
      );
      await backend("PUT", `/admin/terminals/${j.terminal_id}`, it, {
        ...j.terminal_body,
        is_active: false,
      });
      const after = await backend("GET", "/admin/terminals", it);
      assert.equal(
        after.find((t) => t.terminal_id === j.terminal_id).is_active,
        false,
      );
      j.terminal_deactivated = true;
      save();
    } catch (e) {
      j.terminal_cleanup_error = e.message;
      j.passed = false;
      process.exitCode = 1;
      save();
    }
  if (app) await app.close();
  j.finished = new Date().toISOString();
  save();
}
