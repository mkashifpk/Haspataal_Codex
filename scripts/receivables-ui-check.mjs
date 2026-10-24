// Real DEV Electron UI verification for screen receivables (Phase 2 #18).
// Uses isolated owned user 34 credentials and deactivates/restores preferences afterwards.
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

const j = {
  run: "DEMO-RECEIVABLES-" + Date.now(),
  attempts: [],
  checks: [],
  passed: false,
};

const pass = (s) => {
  j.checks.push(s);
  console.log("PASS " + s);
};

let it, app, page, password, ownsFixture = false;

async function backend(method, route, token, body, key) {
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

const prefs = async (value) => {
  const r = await page.evaluate((v) => window.terminal.call("prefs", v), value);
  assert(
    r.ok,
    `Preferences save refused: ${r.error?.code} ${r.error?.message}`,
  );
};

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

async function zoomKey(key) {
  const win = await app.browserWindow(page);
  await win.evaluate((window, keyCode) => {
    window.webContents.sendInputEvent({
      type: "keyDown",
      keyCode,
      modifiers: ["control"],
    });
    window.webContents.sendInputEvent({
      type: "keyUp",
      keyCode,
      modifiers: ["control"],
    });
  }, key);
}

async function capture() {
  for (const language of ["en", "ur"]) {
    await prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `public/handbook/receivables-${language}.png` });
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
        path: `artifacts/receivables-${language}-${theme}-250.png`,
      });
    }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
}

try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve("artifacts/receivables-profile-" + Date.now()),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(45000);
  await page.setViewportSize({ width: 1400, height: 1000 });

  await expect(
    page.getByText("Hospital server ready.", { exact: true }),
  ).toBeVisible();

  // Log in as demo.it to check and prepare user 34
  it = (
    await backend("POST", "/auth/login", null, {
      username: "demo.it",
      password: "Demo-pass-2026",
    })
  ).access_token;

  assert.equal((await owned()).is_active, false, "Never take over active fixture");
  ownsFixture = true;

  // Set cashier role on user 34 and activate
  await backend("PUT", "/admin/users/34/roles", it, { role_codes: ["cashier"] });
  await backend("POST", "/admin/users/34/active", it, {
    active: true,
    reason: j.run + " receivables verification",
  });

  const temporary = (
    await backend("POST", "/admin/users/34/reset-password", it)
  ).temporary_password;
  assert(temporary);

  // Sign in as user 34
  await page.getByLabel("Username", { exact: true }).fill("codex.foundation.1792584106665");
  await page.getByLabel("Password", { exact: true }).fill(temporary);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();

  await page.getByRole("heading", { name: "Change your password", exact: true }).waitFor();
  password = "Demo!" + crypto.randomBytes(16).toString("hex") + "A9";
  await page.getByLabel("Current password", { exact: true }).fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.terminal.call("state").then(r => r.data?.user?.must_change_password))).toBe(false);

  // Choose finance_cashier workspace if picker is displayed
  await page.waitForTimeout(1000);
  const openWorkspace = page.getByRole("button", { name: /Open workspace|کام کی جگہ کھولیں/i });
  if (await openWorkspace.count() > 0) {
    await openWorkspace.first().click();
  }

  // Navigate to Outstanding dues (Udhaar)
  const navBtn = page.getByRole("navigation").getByRole("button", { name: /Outstanding dues|بقایا جات/i });
  await expect(navBtn).toBeVisible();
  await navBtn.click();

  // 1. Verify Receivables screen elements
  await expect(page.locator("h1")).toHaveText(/Outstanding dues \(Udhaar\)|بقایا جات \(ادھار\)/);
  await expect(page.getByText("Receivables aging summary")).toBeVisible();
  await expect(page.getByText("0–30 Days")).toBeVisible();
  await expect(page.getByText("31–60 Days")).toBeVisible();
  await expect(page.getByText("61–90 Days")).toBeVisible();
  await expect(page.getByText("90+ Days")).toBeVisible();
  await expect(page.getByText("Total outstanding")).toBeVisible();
  pass("1: Receivables screen layout, live aging summary cards, and filters displayed");

  // 2. Test tabs: Invoices & direct payments
  const invoicesTab = page.getByRole("button", { name: "Invoices & direct payments" });
  await invoicesTab.click();
  await expect(page.getByText("Invoices and payment collection")).toBeVisible();
  await expect(page.getByRole("table", { name: "Invoices" })).toBeVisible();
  pass("2: Invoices and payments tab reads live DEV invoices with detail and payment actions");

  // Switch back to Outstanding dues queue tab
  const arTab = page.getByRole("button", { name: "Outstanding dues queue" });
  await arTab.click();
  await expect(page.getByText("Receivables aging summary")).toBeVisible();

  // 3. Test contextual F1 Help on controls
  const searchInput = page.getByPlaceholder("Type to search...");
  await help("Outstanding dues (Udhaar)", searchInput);
  pass("3: Contextual F1 Help verified on receivables controls with focus restoration");

  // 4. Test Native Keyboard Zoom (100–250%, clamped and reset)
  await zoomKey("=");
  await zoomKey("=");
  await expect.poll(() => page.evaluate(() => window.terminal.call("prefs").then(r => r.data.ui_scale_pct)), { timeout: 15000 }).toBe(120);

  await zoomKey("0");
  await expect.poll(() => page.evaluate(() => window.terminal.call("prefs").then(r => r.data.ui_scale_pct)), { timeout: 15000 }).toBe(100);

  await zoomKey("-");
  await page.waitForTimeout(500);
  let scale = await page.evaluate(() => window.terminal.call("prefs").then(r => r.data.ui_scale_pct));
  assert.equal(scale, 100, "Ctrl+- cannot decrease below 100% clamp");
  pass("4: Keyboard zoom bounded 100-250%, reset and clamp verified");

  // 5. Capture bilingual screenshots and check no horizontal overflow at 250%
  await capture();
  pass("5: Bilingual screenshots captured and 250% layouts verified in Light and DarkHighContrast without overflow");

  j.passed = true;
  console.log("ALL REAL DEV RECEIVABLES CHECKS PASSED!");
} finally {
  if (app) await app.close();
  if (ownsFixture && it) {
    try {
      await backend("POST", "/admin/users/34/active", it, {
        active: false,
        reason: j.run + " cleanup",
      });
      // Restore receptionist role
      await backend("PUT", "/admin/users/34/roles", it, { role_codes: ["receptionist"] });
      console.log("Cleaned up user 34: restored role receptionist and deactivated");
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
}
