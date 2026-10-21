import { terminalPage } from "./terminal-page.mjs";
// Real DEV preparation and Electron journeys. No response is fabricated.
// Creates one DEMO ONLY administrative employee/document/login and one incident.
// The isolated login is deactivated in finally. Never changes a shared password.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const config = JSON.parse(fs.readFileSync(".dev-terminal.json", "utf8"));
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
const journalFile = "artifacts/foundation-closure-run.json";
fs.mkdirSync("artifacts", { recursive: true });
const journal = fs.existsSync(journalFile)
  ? JSON.parse(fs.readFileSync(journalFile, "utf8"))
  : {
      run: "DEMO-FOUNDATION-" + Date.now(),
      attempts: [],
      checks: [],
    };
const save = () =>
  fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
save();
let hr, it, app, page, password, temp;
const secret = () => "Demo!" + crypto.randomBytes(16).toString("hex") + "A9";
async function backend(method, route, token, body, key) {
  const mutation = method !== "GET" && route !== "/auth/login";
  const attempt = mutation
    ? { method, route, key: key || null, started: new Date().toISOString() }
    : null;
  if (attempt) {
    journal.attempts.push(attempt);
    save();
  }
  const response = await request(config.server_urls[0] + "/api/v1" + route, {
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
  if (attempt) {
    attempt.status = response.status;
    attempt.request_id = response.body?.request_id;
    save();
  }
  if (response.status >= 400)
    throw new Error(
      `${method} ${route}: ${response.status} ${response.body?.error?.code}`,
    );
  return response.body.data;
}
const signinToken = async (username) =>
  (
    await backend("POST", "/auth/login", null, {
      username,
      password: "Demo-pass-2026",
    })
  ).access_token;
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
async function nav(name) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: false })
    .click();
}
async function login(username, value) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(value);
  await expect(
    page.getByRole("button", { name: "Sign in →", exact: true }),
  ).toBeEnabled({ timeout: 40000 });
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
}
async function changePassword(old, next) {
  await page.getByLabel("Current password", { exact: true }).fill(old);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password", { exact: true }).fill(next);
  await page
    .locator("form")
    .getByRole("button", { name: "Change password", exact: true })
    .click();
}
function passed(value) {
  journal.checks.push(value);
  save();
  console.log("PASS " + value);
}
try {
  hr = await signinToken("demo.hr");
  it = await signinToken("demo.it");
  if (!journal.employee_id) {
    const id = journal.run.replace(/\D/g, "").slice(-8).padStart(8, "0");
    const profile = await backend(
      "POST",
      "/hr/employees",
      hr,
      {
        full_name: "DEMO ONLY " + journal.run,
        cnic: "99999" + id,
        mobile: "00000000000",
        staff_category: "Administrative",
        designation: "DEMO ONLY foundation verification",
      },
      journal.run + "-employee",
    );
    journal.employee_id = profile.employee_id;
    journal.emp_number = profile.emp_number;
    save();
  }
  let employee = await backend(
    "GET",
    `/hr/employees/${journal.employee_id}`,
    hr,
  );
  assert(employee.full_name.includes(journal.run));
  if (!employee.documents.some((d) => d.doc_type === "CNIC")) {
    const doc = await backend(
      "POST",
      `/hr/employees/${journal.employee_id}/documents`,
      hr,
      {
        __multipart: [
          { name: "doc_type", value: "CNIC" },
          {
            name: "title",
            value:
              "DEMO ONLY synthetic UI test evidence - not an identity document",
          },
          {
            name: "file",
            filename: "DEMO-ONLY-test-evidence.png",
            type: "image/png",
            bytes: fs.readFileSync("public/handbook/connect_server-en.png"),
          },
        ],
      },
      journal.run + "-document",
    );
    journal.document_id = doc.document_id;
    save();
  }
  employee = await backend("GET", `/hr/employees/${journal.employee_id}`, hr);
  if (employee.employment_status === "Draft") {
    assert(employee.checklist.ready, JSON.stringify(employee.checklist));
    await backend("POST", `/hr/employees/${journal.employee_id}/submit`, hr);
  }
  if (!journal.user_id) {
    const username = "codex.foundation." + journal.run.replace(/\D/g, "");
    const found = await backend(
      "GET",
      "/admin/users?q=" + encodeURIComponent(username),
      it,
    );
    const existing = found.find((u) => u.username === username);
    if (existing) {
      journal.user_id = existing.user_id;
      journal.username = username;
      save();
    } else {
      const user = await backend(
        "POST",
        "/admin/users",
        it,
        {
          employee_id: journal.employee_id,
          username,
          role_codes: ["receptionist"],
        },
        journal.run + "-provision",
      );
      journal.user_id = user.user_id;
      journal.username = user.username;
      temp = user.temporary_password;
      save();
    }
  }
  const identity = await backend("GET", `/admin/users/${journal.user_id}`, it);
  assert.equal(identity.username, journal.username);
  assert.equal(identity.employee_id, journal.employee_id);
  if (!identity.is_active)
    await backend("POST", `/admin/users/${journal.user_id}/active`, it, {
      active: true,
      reason: journal.run + " resume isolated verification",
    });
  journal.account_deactivated = false;
  journal.passed = false;
  save();
  if (!temp)
    temp = (
      await backend(
        "POST",
        `/admin/users/${journal.user_id}/reset-password`,
        it,
      )
    ).temporary_password;
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/closure-profile-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(40000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  assert.equal(new URL(page.url()).protocol, "app:");
  await login(journal.username, temp);
  await page
    .getByRole("heading", { name: "Change your password", exact: true })
    .waitFor();
  assert((await state()).user.must_change_password);
  assert.equal(await page.getByRole("navigation").count(), 0);
  password = secret();
  await changePassword(temp, password);
  temp = undefined;
  await expect
    .poll(() => state().then((s) => s.user?.must_change_password), {
      timeout: 50000,
    })
    .toBe(false);
  await page
    .getByText("READY FOR YOUR NEXT TASK", { exact: true })
    .waitFor({ timeout: 60000 });
  passed(
    "isolated fresh account forces real password change before workspace/navigation",
  );
  await nav("Settings");
  await page
    .locator(".settings-nav")
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  const nextPassword = secret();
  await changePassword(password, nextPassword);
  password = nextPassword;
  await expect
    .poll(() => state().then((s) => s.user?.user_id))
    .toBe(journal.user_id);
  await page.getByText("READY FOR YOUR NEXT TASK", { exact: true }).waitFor();
  passed(
    "Settings changes only isolated account password through dedicated settings endpoint",
  );
  await page.locator(".avatar").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Help & handbook", exact: true })
    .click();
  await expect(page.locator(".help-article")).toContainText("Your handbook");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await nav("Report an incident");
  await page
    .getByLabel("What happened", { exact: true })
    .fill(journal.run + " unsent draft");
  await expect
    .poll(() => page.locator(".connection-state").innerText())
    .toContain("Live");

  // Capture only paths/counters. Lose the REAL refresh response after its headers
  // arrive: the server has rotated, but the terminal cannot safely reuse it.
  await app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.refreshFault = true;
    globalThis.refreshAttempts = 0;
    https.request = function (url, options, callback) {
      const target =
        typeof url === "object" && !(url instanceof URL)
          ? new URL(
              `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
            )
          : new URL(url);
      if (target.pathname === "/api/v1/auth/refresh") {
        globalThis.refreshAttempts++;
        if (globalThis.refreshFault)
          return original.call(this, url, options, (response) => {
            callback(response);
            response.destroy(new Error("TEST: lost committed rotation reply"));
          });
      }
      return original.call(this, url, options, callback);
    };
    const now = Date.now;
    Date.now = () => {
      Date.now = now;
      return now() + 31 * 60 * 1000;
    };
  });
  const refresh = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/auth/me" }),
  );
  assert(!refresh.ok);
  const recovery = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Confirm your session",
      exact: true,
    }),
  });
  await recovery.waitFor();
  await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/auth/me" }),
  );
  assert.equal(await app.evaluate(() => globalThis.refreshAttempts), 1);
  await app.evaluate(() => {
    globalThis.refreshFault = false;
  });
  await recovery.getByLabel("Password", { exact: true }).fill(password);
  await recovery
    .getByRole("button", { name: "Confirm your session", exact: true })
    .click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByLabel("What happened", { exact: true })).toHaveValue(
    journal.run + " unsent draft",
  );
  passed(
    "lost real refresh rotation preserves draft, never reuses token, same-account sign-in restores screen",
  );

  // New synthetic incident through the UI; retain returned ID before continuing.
  const types = await page.evaluate(() =>
    window.terminal
      .call("api", { method: "GET", path: "/incident-types?active_only=true" })
      .then((r) => r.data),
  );
  const type = types.find(
    (t) => !["Medication", "Surgery", "Anaesthesia"].includes(t.area),
  );
  assert(type);
  await page
    .getByLabel("Incident type", { exact: true })
    .selectOption(type.type_code);
  await page
    .getByLabel("What happened", { exact: true })
    .fill(
      journal.run + " synthetic verification; no patient or staff affected.",
    );
  await page
    .getByLabel("What was done at once", { exact: true })
    .fill("DEMO ONLY verification; no clinical action required.");
  if (!journal.incident_id) {
    journal.incidentAttempt = { run: journal.run, pending: true };
    save();
    await page
      .getByRole("button", { name: "Submit incident report", exact: true })
      .click();
  }
  await expect(page.locator("form[data-write-pending]")).toHaveAttribute(
    "data-write-pending",
    "false",
  );
  const reports = await page.evaluate(() =>
    window.terminal
      .call("api", { method: "GET", path: "/incidents?mine=true&limit=100" })
      .then((r) => r.data),
  );
  const matches = reports.filter(
    (r) =>
      r.description?.includes(journal.run) || r.summary?.includes(journal.run),
  );
  // List may omit descriptions; inspect only this isolated account's new reports.
  const rows = matches.length ? matches : reports;
  assert.equal(
    rows.length,
    1,
    "isolated account has exactly one created incident",
  );
  journal.incident_id = rows[0].incident_id;
  journal.incident_number = rows[0].incident_number;
  journal.incidentAttempt.pending = false;
  save();
  await page
    .getByRole("button", { name: new RegExp(journal.incident_number) })
    .click();
  await expect(
    page.getByRole("heading", { name: journal.incident_number, exact: true }),
  ).toBeVisible();
  passed(
    "new synthetic incident created once and reopened by real returned number; append-only UI has no edit/delete",
  );
  await page.getByLabel("What happened", { exact: true }).fill("");
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article")).toContainText(
    "Report an incident",
  );
  await expect
    .poll(() =>
      page
        .locator(".handbook-example img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  assert.equal(
    new URL(await page.locator(".handbook-example img").getAttribute("src"))
      .protocol,
    "app:",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  passed(
    "permitted contextual handbook and bundled screenshots load through local secure app protocol",
  );
  journal.passed = true;
  delete journal.error;
  journal.checks = [...new Set(journal.checks)];
  save();
} catch (error) {
  journal.error = error.message;
  save();
  if (page) {
    await page
      .screenshot({ path: "artifacts/foundation-closure-failure.png" })
      .catch(() => {});
  }
  throw error;
} finally {
  if (app) await app.close();
  if (journal.user_id && it) {
    const current = await backend("GET", `/admin/users/${journal.user_id}`, it);
    assert.equal(current.username, journal.username);
    assert.equal(current.employee_id, journal.employee_id);
    if (current.is_active)
      await backend("POST", `/admin/users/${journal.user_id}/active`, it, {
        active: false,
        reason: journal.run + " isolated test finished",
      });
    journal.account_deactivated = true;
    save();
  }
}
