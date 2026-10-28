import { terminalPage } from "./terminal-page.mjs";
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createFacilityAttempt } from "../src/facility-recovery.ts";

const capture = process.argv.includes("--capture-handbook");
fs.mkdirSync("artifacts", { recursive: true });
if (capture) fs.mkdirSync("public/handbook", { recursive: true });
const environment = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve(
    `artifacts/foundation-profile-${Date.now()}`,
  ),
};
delete environment.ELECTRON_RUN_AS_NODE;
const errors = [],
  checks = [];
let app, page, originalPrefs;
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
async function prefs(value) {
  const r = await page.evaluate((v) => window.terminal.call("prefs", v), value);
  assert(r.ok, JSON.stringify(r));
  await expect
    .poll(() => state().then((s) => s.prefs.language))
    .toBe(value.language || (await state()).prefs.language);
}
async function shot(id) {
  if (!capture) return;
  for (const language of ["en", "ur"]) {
    await prefs({ language, ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    // Replace a complete PNG rather than truncating a file a Windows viewer or
    // scanner may briefly hold open. Never leave a partially written example.
    const target=`public/handbook/${id}-${language}.png`;
    const temporary=`public/handbook/.capture-${id}-${language}-${process.pid}.png`;
    fs.writeFileSync(temporary,await page.screenshot());
    try {
      for(let attempt=0;;attempt++) {
        try {fs.renameSync(temporary,target);break;}
        catch(error) {if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,200));}
      }
    } finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  }
  await prefs({ language: "en" });
}
async function login(username) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
}
async function nav(name) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: false })
    .click();
}
async function zoomKey(key) {
  // Electron owns these shortcuts in before-input-event. CDP keyboard events
  // bypass that native hook, so exercise the actual Electron input path.
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
async function launch(env) {
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(25000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  page.on("pageerror", (e) => errors.push(e.message));
}
try {
  if (capture) {
    // Isolate this subprocess's provisioning search location to represent an
    // unconfigured terminal. No server responses or records are substituted.
    const unconfigured = {
      ...environment,
      HASPATAAL_TEST_DATA: path.resolve(
        `artifacts/foundation-connect-${Date.now()}`,
      ),
      ProgramData: path.resolve("artifacts/unprovisioned-machine"),
    };
    delete unconfigured.HASPATAAL_DEV_CONFIG;
    await launch(unconfigured);
    await page
      .getByRole("heading", { name: "Your hospital, connected.", exact: true })
      .waitFor();
    await shot("connect_server");
    await app.close();
    app = undefined;
  }
  await launch(environment);
  await page.getByLabel("Username", { exact: true }).waitFor();
  await expect(
    page.getByText("Hospital server ready.", { exact: true }),
  ).toBeVisible();
  await shot("login");
  await login("demo.owner");
  await page.getByRole('navigation').waitFor({timeout:60000});
  originalPrefs = (await state()).prefs;
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await page
    .getByRole("heading", { name: "Where are you working today?" })
    .waitFor();
  await shot("workspace_picker");
  const owner = page.locator(".workspace-card").filter({
    has: page.getByRole("heading", {
      name: "Owner / Hospital Admin",
      exact: true,
    }),
  });
  await owner
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  await page.getByText("READY FOR YOUR NEXT TASK", { exact: true }).waitFor();
  await shot("app_shell");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTimezoneOverride", {
    timezoneId: "America/Los_Angeles",
  });
  const metadata = await page.evaluate(() =>
    window.terminal
      .call("api", { method: "GET", path: "/meta/settings" })
      .then((r) => r.data),
  );
  assert(metadata.hospital_timezone);
  checks.push("login reads real full health after liveness");

  // Real saves through the shared queue: no intercepted/fabricated API results.
  for (let i = 0; i < 5; i++) await zoomKey("=");
  await expect
    .poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 30000 })
    .toBe(150);
  for (let i = 0; i < 20; i++) await zoomKey("=");
  await expect
    .poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 30000 })
    .toBe(250);
  await zoomKey("0");
  await expect
    .poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 30000 })
    .toBe(100);
  for (let i = 0; i < 3; i++) await zoomKey("-");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(100);
  await page.locator(".avatar").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  checks.push("avatar account menu opens Settings");
  const slider = page.getByLabel("Display size", { exact: true });
  await slider.waitFor();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(110);
  await zoomKey("=");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(120);
  await expect(slider).toHaveValue("120");
  checks.push(
    "rapid zoom increments, upper/lower bounds, reset and slider/keyboard agreement",
  );
  const newWindow = app.waitForEvent("window");
  const opened = await page.evaluate(() =>
    window.terminal.call("workspace", {
      code: "owner_dashboard",
      newWindow: true,
    }),
  );
  assert(opened.ok);
  const second = await newWindow;
  await second
    .getByText("READY FOR YOUR NEXT TASK", { exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(
    await second.evaluate(() =>
      window.terminal.call("state").then((r) => r.data.prefs.ui_scale_pct),
    ),
    120,
  );
  await prefs({ ui_scale_pct: 130 });
  await expect
    .poll(() =>
      second.evaluate(() =>
        window.terminal.call("state").then((r) => r.data.prefs.ui_scale_pct),
      ),
    )
    .toBe(130);
  const factors = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => w.webContents.getZoomFactor()),
  );
  assert(factors.every((f) => Math.abs(f - 1.3) < 0.001));
  await second.close();
  checks.push("new window initializes and shares confirmed zoom");
  await prefs({ ui_scale_pct: 100 });
  await shot("settings");

  await nav("Facility & services");
  await page.getByRole("heading", { name: "Services", exact: true }).waitFor();
  const serviceState = page
    .locator('select[data-help="facility.services"]')
    .first();
  const originalState = await serviceState.inputValue();
  const alternative = await serviceState
    .locator("option")
    .evaluateAll(
      (options, current) => options.find((o) => o.value !== current)?.value,
      originalState,
    );
  await serviceState.selectOption(alternative);
  page.once("dialog", (d) => d.dismiss());
  await nav("Notifications");
  await expect(serviceState).toHaveValue(alternative);
  await serviceState.selectOption(originalState);
  checks.push(
    "Facility selector-only draft is guarded without opening profile editing",
  );
  await page
    .getByRole("button", { name: "Record or change profile", exact: true })
    .click();
  const category = page.getByLabel("PHC category", { exact: true });
  await category.focus();
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText(
    "Facility profile & services",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(category).toBeFocused();
  await page
    .getByLabel("PHC registration / licence number", { exact: true })
    .fill("DEV-DRAFT-NOT-SUBMITTED");
  let refused = false;
  page.once("dialog", async (d) => {
    refused = true;
    await d.dismiss();
  });
  await nav("Notifications");
  assert(refused);
  await expect(
    page.getByLabel("PHC registration / licence number", { exact: true }),
  ).toHaveValue("DEV-DRAFT-NOT-SUBMITTED");
  await shot("facility_profile");
  page.once("dialog", (d) => d.accept());
  await nav("Notifications");
  await page
    .getByRole("heading", { name: "Notifications", exact: true })
    .waitFor();
  await shot("notifications");
  const notificationDates = page.locator(".notification small");
  if (await notificationDates.count())
    assert(
      (await notificationDates.first().innerText()).includes(
        metadata.hospital_timezone,
      ),
    );
  checks.push(
    "Facility draft survives rejected navigation and F1 restores field focus",
  );
  // An unsent client draft, using a REAL server preview. No apply request is
  // sent: this checks retained-state UI and read-only reconciliation only.
  const draft = {
    reason: "DEV recovery control check; not submitted",
    capabilities: [],
  };
  const previewReply = await page.evaluate(
    (body) =>
      window.terminal.call("api", {
        method: "POST",
        path: "/establishment/changes/preview",
        body,
        key: crypto.randomUUID(),
      }),
    draft,
  );
  assert(previewReply.ok, JSON.stringify(previewReply));
  const preview = previewReply.data;
  const current = await state();
  const storagePrefix = `haspataal.facility-apply:${current.server.fingerprint}:${current.user.user_id}`;
  const attempt = createFacilityAttempt(
    {
      ...draft,
      expected_revision: preview.revision,
      acknowledged: preview.acknowledgements.map((a) => a.code),
    },
    preview,
  );
  const storageKey = storagePrefix + ":" + attempt.key;
  await page.evaluate(
    ({ storageKey, attempt }) =>
      localStorage.setItem(storageKey, JSON.stringify(attempt)),
    { storageKey, attempt },
  );
  await page.evaluate(() => window.terminal.call("logout", { all: false }));
  await app.close();
  await launch(environment);
  await page.getByLabel("Username", { exact: true }).waitFor();
  await login("demo.owner");
  await page
    .getByRole("heading", { name: "Where are you working today?" })
    .waitFor();
  await page
    .locator(".workspace-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Owner / Hospital Admin",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  const restartedCdp = await page.context().newCDPSession(page);
  await restartedCdp.send("Emulation.setTimezoneOverride", {
    timezoneId: "America/Los_Angeles",
  });
  await page.getByText("READY FOR YOUR NEXT TASK", { exact: true }).waitFor();
  await nav("Facility & services");
  await expect(
    page.getByRole("heading", {
      name: "Facility change outcome needs checking",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview change", exact: true }),
  ).toBeDisabled();
  await nav("Notifications");
  await expect(
    page.getByRole("heading", {
      name: "Facility change outcome needs checking",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Check server status and history",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry original request", exact: true }),
  ).toBeEnabled();
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    ),
    attempt,
  );
  await page.screenshot({ path: "artifacts/facility-recovery.png" });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Close reviewed attempt", exact: true })
    .click();
  await expect(
    page.getByText(
      "Attempt closed after manual review. Preview again before any new change.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    null,
  );
  const unchanged = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/establishment" }),
  );
  assert.equal(unchanged.data.revision, preview.revision);
  checks.push(
    "retained unsent Facility draft survives app restart/login, blocks new actions, reads real history, and closes without applying",
  );

  await nav("Report an incident");
  const when = page.getByLabel("When it happened", { exact: true });
  await expect(when).toBeEnabled();
  const expectedWall = await page.evaluate(
    (zone) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date())
        .replace(" ", "T"),
    metadata.hospital_timezone,
  );
  const wall = await when.inputValue();
  assert(
    Math.abs(Date.parse(wall + "Z") - Date.parse(expectedWall + "Z")) < 120000,
  );
  assert.equal(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    "America/Los_Angeles",
  );
  checks.push(
    "notifications and incident time use real hospital timezone while workstation is Los Angeles",
  );
  await page
    .getByLabel("Incident type", { exact: true })
    .locator("option")
    .nth(1)
    .waitFor({ state: "attached" });
  const type = page.getByLabel("Incident type", { exact: true });
  const value = await type.locator("option").nth(1).getAttribute("value");
  await type.selectOption(value);
  page.once("dialog", (d) => d.dismiss());
  await nav("Notifications");
  await expect(type).toHaveValue(value);
  await shot("report_incident");
  page.once("dialog", (d) => d.accept());
  await nav("Approvals");
  await page.getByRole("heading", { name: "Approvals", exact: true }).waitFor();
  await expect.poll(async () => (await page.locator(".list-row").count()) > 0 || /No\s*pending\s*requests/.test(await page.locator('main').innerText())).toBe(true);
  if (await page.locator(".list-row").count()) {
  await page.locator(".list-row").first().click();
  await page.getByLabel("Decision note", { exact: true }).waitFor();
  await shot("approval_queue");
  await page
    .getByLabel("Decision note", { exact: true })
    .fill("DEV draft only; no decision");
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  if ((await approve.count()) && (await approve.isEnabled())) {
    await approve.click();
    await page.keyboard.press("F1");
    await expect(page.locator(".help-article h1")).toHaveText("Approvals");
    await page
      .locator("dialog")
      .filter({ has: page.locator(".help-layout") })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    checks.push(
      "F1 opens contextual help above an approval confirmation; no decision submitted",
    );
  }
  page.once("dialog", (d) => d.dismiss());
  await nav("Settings");
  await expect(page.getByLabel("Decision note", { exact: true })).toHaveValue(
    "DEV draft only; no decision",
  );
  page.once("dialog", (d) => d.accept());
  await nav("Settings");
  checks.push(
    "incident selector-only and approval note drafts trigger navigation protection",
  );
  } else {
    checks.push("Fresh DEV approval queue is empty; empty state verified. Approval confirmation/draft case NOT executed (requires a new authorised pending request).");
    await shot("approval_queue");
    await nav("Settings");
  }

  await page
    .locator(".settings-nav button")
    .filter({ hasText: /Hospital policy|Policy settings|Policy/i })
    .first()
    .click();
  await expect
    .poll(() => page.locator(".policy-list .list-row").count())
    .toBeGreaterThan(0);
  await page.locator(".policy-list .list-row").first().click();
  const newValue = page.getByLabel("New value", { exact: true });
  await newValue.fill('"DEV-DRAFT-NOT-SUBMITTED"');
  page.once("dialog", (d) => d.dismiss());
  await page
    .locator(".settings-nav button")
    .filter({ hasText: "Display, language and zoom" })
    .first()
    .click();
  await expect(newValue).toHaveValue('"DEV-DRAFT-NOT-SUBMITTED"');
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  checks.push(
    "policy editor warns on internal section navigation; cancelled without saving",
  );

  await page.keyboard.press("F1");
  await page
    .locator(".help-layout aside button")
    .filter({ hasText: "Help and handbook" })
    .click();
  await shot("help_center");
  await page
    .getByRole("button", { name: /Owner \/ Hospital Admin · foundation guide/ })
    .first()
    .click();
  await expect(page.locator(".help-article h1")).toContainText(
    "foundation tasks",
  );
  await expect(page.locator(".help-article")).toContainText(
    "Hospital Admin control-setting requests can wait for an Owner",
  );
  await page
    .getByRole("button", { name: "Open screen help and example", exact: true })
    .first()
    .click();
  const search = page.getByLabel("Search handbook", { exact: true });
  await search.fill("DELIBERATELY NO SUCH TASK");
  await expect(page.locator(".help-layout aside")).toContainText(
    "No permitted help matches",
  );
  await page.keyboard.press("F1");
  await expect(search).toHaveValue("");
  await expect(page.locator(".help-article h1")).toHaveText("Settings");
  await expect
    .poll(() =>
      page
        .locator(".handbook-example img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.location.hash =
      "#help/" + encodeURIComponent("screens/notifications");
  });
  await expect(page.locator(".help-article h1")).toHaveText("Notifications");
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText("Settings");
  await page.context().setOffline(true);
  await search.fill("zoom");
  assert((await page.locator(".help-layout aside button").count()) > 0);
  await page.context().setOffline(false);
  await search.fill("");
  await prefs({ language: "ur", ui_scale_pct: 250 });
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    help: document.querySelector(".help-article").clientWidth,
    helpScroll: document.querySelector(".help-article").scrollWidth,
  }));
  assert(
    layout.scroll <= layout.width + 1 && layout.helpScroll <= layout.help + 1,
    JSON.stringify(layout),
  );
  await page.screenshot({ path: "artifacts/foundation-help-urdu-250.png" });
  await prefs({ language: "en", ui_scale_pct: 100 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  checks.push(
    "workspace guide, deep/screen links, search, no-match, F1, bundled offline images/help and Urdu at 250%",
  );

  await prefs({ language: "en", ui_scale_pct: 170 });
  await page.evaluate(() => window.terminal.call("logout", { all: false }));
  await login("demo.owner");
  await page
    .getByRole("heading", { name: "Where are you working today?" })
    .waitFor();
  assert.equal((await state()).prefs.ui_scale_pct, 170);
  checks.push("zoom persists across sign-out/sign-in");
  await prefs(originalPrefs);
  await page.evaluate(() => window.terminal.call("logout", { all: false }));
  originalPrefs = undefined;
  await login("demo.zakat");
  await page.getByText("READY FOR YOUR NEXT TASK", { exact: true }).waitFor();
  await nav("Charity approvals");
  await page
    .getByRole("heading", { name: "Charity approvals", exact: true })
    .waitFor();
  const zakatPrefs = (await state()).prefs;
  originalPrefs = zakatPrefs;
  await shot("charity_approvals");
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article h1")).toHaveText(
    "Charity approvals",
  );
  await page
    .getByLabel("Search handbook", { exact: true })
    .fill("Facility profile & services");
  assert.equal(
    await page
      .locator(".help-layout aside button")
      .filter({ hasText: "Facility profile & services" })
      .count(),
    0,
  );
  await page.evaluate(() => {
    window.location.hash =
      "#help/" + encodeURIComponent("screens/facility_profile");
  });
  await expect(page.locator(".help-article")).toContainText(
    "This help page is not available or permitted",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await prefs(zakatPrefs);
  originalPrefs = undefined;
  checks.push("account switch clears search and hides forbidden facility help");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/foundation-check.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        pageErrors: errors,
        captured: capture,
        scope:
          "Real DEV reads and preference saves only; no incident, facility policy or financial business writes.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: true, checks, captured: capture }, null, 2),
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: "artifacts/foundation-failure.png" })
      .catch(() => {});
    const context = await page
      .evaluate(() => ({
        language: document.documentElement.lang,
        text: document.body.innerText.slice(0, 7000),
      }))
      .catch(() => ({}));
    fs.writeFileSync(
      "artifacts/foundation-failure.json",
      JSON.stringify({ message: error.message, ...context }, null, 2),
    );
  }
  throw error;
} finally {
  if (app) {
    if (originalPrefs) {
      try {
        if ((await state()).user) await prefs(originalPrefs);
      } catch (e) {
        console.error("Preference restoration needs review:", e.message);
      }
    }
    await app.close();
  }
}
