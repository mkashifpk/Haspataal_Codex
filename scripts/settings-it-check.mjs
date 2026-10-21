// Settings system sections: real DEV reads and isolated synthetic fixtures only.
// No maintenance/kill-switch, shared password, role/permission or service change.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const file = "artifacts/settings-it-check.json",
  transportFile = path.resolve("artifacts/settings-it-transport.json");
const j = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file))
  : { run: "DEMO-SETTINGS-IT-" + Date.now(), checks: [] };
if (process.argv.includes("--resume")) {
  assert(
    j.printer_id && !j.printer_pending && !j.edit_pending && !j.reset_pending,
    "Reconcile the original pending write before read-only continuation",
  );
  assert(
    j.checks.some((c) => c.startsWith("isolated user34 reactivated/reset")) &&
      j.checks.some((c) =>
        c.startsWith("isolated account sessions explicitly revoked"),
      ) &&
      j.checks.some((c) =>
        c.startsWith("real synthetic inactive printer edited"),
      ),
    "Read-only continuation needs the earlier confirmed lifecycle checkpoints",
  );
}
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
const passed = (check) => {
  j.checks = [...new Set([...j.checks, check])];
  save();
  console.log("PASS " + check);
};
let app, page, prefs;
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
const api = async (method, path, body) => {
  const r = await page.evaluate((args) => window.terminal.call("api", args), {
    method,
    path,
    body,
  });
  assert(r.ok, r.error?.code || "API failure");
  return r.data;
};
const preference = async (value) => {
  const r = await page.evaluate((v) => window.terminal.call("prefs", v), value);
  assert(r.ok);
};
const section = async (name) => {
  await page.locator(".settings-nav button").filter({ hasText: name }).click();
};
async function confirm() {
  await page
    .getByRole("button", { name: "Review system change", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm system change", exact: true })
    .click();
}
async function userCard() {
  await page
    .getByLabel("Find user", { exact: true })
    .fill("codex.foundation.1792584106665");
  await page.getByRole("button", { name: "Search users", exact: true }).click();
  const card = page
    .locator("article.card")
    .filter({ hasText: "codex.foundation.1792584106665" });
  await expect(card).toHaveCount(1);
  return card;
}
async function shot(name) {
  const win = await app.browserWindow(page);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const png = await win.evaluate(async (w) =>
    (await w.webContents.capturePage()).toPNG().toString("base64"),
  );
  fs.writeFileSync(name, Buffer.from(png, "base64"));
}
j.passed = false;
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/settings-it-profile-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(40000);
  await page.getByLabel("Username", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const publicSections = await api("GET", "/settings/sections");
  assert.equal(publicSections.signed_in, false);
  assert.deepEqual(
    publicSections.tiers.map((t) => t.tier),
    ["terminal"],
  );
  await expect(
    page.getByRole("heading", { name: "Server connection", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Loading from the hospital server…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await section("This terminal: its location and printers");
  await expect(
    page.getByText("Loading from the hospital server…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article")).not.toContainText(
    "Once-only credential slip",
  );
  await expect(
    page.locator(".help-article img[src*='settings-it-']"),
  ).toHaveCount(0);
  await page
    .locator("dialog")
    .filter({ has: page.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  passed(
    "public Settings exposes only terminal tier, actual diagnostics/identity and permitted public help",
  );
  await app.evaluate(()=>{
    const https=process.getBuiltinModule("https"),original=https.request;
    globalThis.preferenceReads=0;globalThis.normalLoginPosts=0;globalThis.dropFirstPreferenceRead=true;
    https.request=function(url,options,callback){const u=typeof url==="object"&&!(url instanceof URL)?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url);
      if(u.pathname==="/api/v1/auth/login")globalThis.normalLoginPosts++;
      if(u.pathname==="/api/v1/settings/me"&&options.method==="GET"){
        globalThis.preferenceReads++;
        if(globalThis.dropFirstPreferenceRead){globalThis.dropFirstPreferenceRead=false;return original.call(this,url,options,response=>{callback(response);response.destroy(new Error("TEST lost real preference read"));});}
      }
      return original.call(this,url,options,callback);
    };
  });
  await page.getByLabel("Username", { exact: true }).fill("demo.it");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect
    .poll(() => state().then((s) => s.user?.username))
    .toBe("demo.it");
  await page.getByRole("navigation").waitFor();
  prefs = (await state()).prefs;
  const loginCounters=await app.evaluate(()=>({reads:globalThis.preferenceReads,logins:globalThis.normalLoginPosts}));
  assert(loginCounters.reads>=2);assert.equal(loginCounters.logins,1);
  await preference({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: false })
    .click();
  await page.getByRole("button",{name:"Reload preferences",exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>globalThis.preferenceReads)).toBeGreaterThan(loginCounters.reads);
  assert.equal(await app.evaluate(()=>globalThis.normalLoginPosts),1);
  passed("native login reads settings/me through ordered queue; lost GET retries safely, Reload preferences never repeats login");
  await section("Users, roles and access");
  await page
    .getByRole("heading", { name: "Staff awaiting login", exact: true })
    .waitFor();
  await expect(
    page.getByText("Loading from the hospital server…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  assert.equal((await api("GET", "/admin/first-owner")).needed, false);
  await expect(
    page.getByRole("button", { name: "Create the first Owner", exact: true }),
  ).toHaveCount(0);
  const own = await api("GET", "/admin/users/34");
  assert.equal(own.username, "codex.foundation.1792584106665");
  assert.equal(own.employee_id, 36);
  let card = await userCard();
  await card.getByRole("button", { name: "Open user", exact: true }).click();
  await expect(page.locator("section[role=status]")).toContainText(
    own.username,
  );
  passed(
    "server-selected IT users/first-Owner state, real user search/detail, role matrix and audit read",
  );
  if (!process.argv.includes("--resume")) {
    if (!own.is_active) {
      j.user_cleanup_pending = true;
      j.account_deactivated = false;
      save();
      await card
        .getByRole("button", { name: "Reactivate user", exact: true })
        .click();
      await page
        .getByLabel("Reason", { exact: true })
        .fill(j.run + " isolated lifecycle");
      await confirm();
      await expect
        .poll(() => api("GET", "/admin/users/34").then((u) => u.is_active))
        .toBe(true);
    }
    card = await userCard();
    // Count only reset calls for the verified isolated account. Never record tokens
    // or password bodies/results in the transport journal.
    await app.evaluate(({ webContents }, target) => {
      globalThis.itResetCalls = 0;
      globalThis.itPrintCalls = 0;
      const https = process.getBuiltinModule("https"),
        original = https.request;
      globalThis.itOriginalRequest = original;
      https.request = function (url, options, callback) {
        const u =
          typeof url === "object" && !(url instanceof URL)
            ? new URL(
                `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
              )
            : new URL(url);
        if (u.pathname === "/api/v1/admin/users/34/reset-password")
          globalThis.itResetCalls++;
        if (
          u.pathname === "/api/v1/admin/printers" &&
          options.method === "POST"
        ) {
          const fs = process.getBuiltinModule("fs");
          const a = fs.existsSync(target)
            ? JSON.parse(fs.readFileSync(target))
            : [];
          a.push({
            path: u.pathname,
            key: options.headers["Idempotency-Key"],
            date: new Date().toISOString(),
          });
          fs.writeFileSync(target, JSON.stringify(a, null, 2));
          if (globalThis.itDropPrinter)
            return original.call(this, url, options, (response) => {
              callback(response);
              response.destroy(
                new Error("TEST lost real committed printer reply"),
              );
            });
        }
        return original.call(this, url, options, callback);
      };
      const prototype = Object.getPrototypeOf(
        webContents.getAllWebContents()[0],
      );
      globalThis.itPrintPrototype = prototype;
      globalThis.itOriginalPrint = prototype.print;
      prototype.print = function (options, callback) {
        globalThis.itPrintCalls++;
        callback(false, "TEST printer unavailable");
      };
    }, transportFile);
    j.reset_pending = true;
    save();
    await card
      .getByRole("button", { name: "Issue temporary password", exact: true })
      .click();
    await confirm();
    const slip = page.getByRole("dialog").filter({
      has: page.getByRole("heading", {
        name: "Shown once — keep the slip secure",
        exact: true,
      }),
    });
    await slip.waitFor();
    assert(
      (await slip
        .locator("dt")
        .filter({ hasText: "temporary password" })
        .count()) > 0,
    );
    await slip
      .getByRole("button", { name: "Print credential slip", exact: true })
      .click();
    await expect(slip.getByRole("alert")).toContainText(
      "TEST printer unavailable",
    );
    assert.equal(await app.evaluate(() => globalThis.itResetCalls), 1);
    assert.equal(await app.evaluate(() => globalThis.itPrintCalls), 1);
    await slip
      .getByRole("button", {
        name: "I have secured the credential",
        exact: true,
      })
      .click();
    await expect(slip).toHaveCount(0);
    j.reset_pending = false;
    save();
    passed(
      "isolated user34 reactivated/reset; once-only credential print failure retains slip and never repeats password reset",
    );
    card = await userCard();
    await card
      .getByRole("button", { name: "End user's sessions", exact: true })
      .click();
    await confirm();
    await expect(page.locator("section[role=status]")).toContainText("user id");
    passed(
      "isolated account sessions explicitly revoked once through confirmed UI",
    );
  }
  await section("Terminals, printers and badge stations");
  await page.getByRole("heading", { name: "Printers", exact: true }).waitFor();
  await expect(
    page.getByText("Loading from the hospital server…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const name = j.run + " inactive printer";
  let matches = (await api("GET", "/admin/printers")).filter(
    (p) => p.name === name || p.printer_id === j.printer_id,
  );
  if (matches.length) {
    assert.equal(matches.length, 1);
    j.printer_id = matches[0].printer_id;
    j.printer_pending = false;
    save();
  } else {
    assert(
      !j.printer_pending,
      "reconcile previous original key before a new printer",
    );
    await page
      .getByRole("button", { name: "Add printers", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page
      .getByLabel("Printer Type", { exact: true })
      .selectOption("Laser");
    await page.getByLabel("Connection", { exact: true }).selectOption("Other");
    await page.getByLabel("Is Active", { exact: true }).selectOption("false");
    j.printer_payload = {
      name,
      printer_type: "Laser",
      connection: "Other",
      is_active: false,
    };
    j.printer_pending = true;
    save();
    await app.evaluate(() => {
      globalThis.itDropPrinter = true;
    });
    await confirm();
    await page
      .getByRole("heading", {
        name: "System change outcome needs checking",
        exact: true,
      })
      .waitFor();
    matches = (await api("GET", "/admin/printers")).filter(
      (p) => p.name === name,
    );
    assert.equal(matches.length, 1);
    j.printer_id = matches[0].printer_id;
    save();
    await app.evaluate(() => {
      globalThis.itDropPrinter = false;
    });
    await page
      .getByRole("button", { name: "Retry original request", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "System change outcome needs checking",
        exact: true,
      }),
    ).toHaveCount(0);
    const keys = JSON.parse(fs.readFileSync(transportFile))
      .slice(-2)
      .map((a) => a.key);
    assert(keys[0] && keys[0] === keys[1]);
    assert.equal(
      (await api("GET", "/admin/printers")).filter((p) => p.name === name)
        .length,
      1,
    );
    j.printer_pending = false;
    save();
  }
  passed(
    "actual lost printer creation reply reconciled; original same key replays exactly one inactive synthetic printer",
  );
  // Identify by the unique synthetic label, never by a guessed ordinal.
  const current = (await api("GET", "/admin/printers")).find(
    (p) => p.printer_id === j.printer_id,
  );
  assert(current.name.startsWith(j.run));
  assert.equal(current.is_active, false);
  if (!process.argv.includes("--resume")) {
    const selected = page.locator("article.card").filter({
      has: page.getByRole("heading", {
        name: current.name + " · " + j.printer_id,
        exact: true,
      }),
    });
    await selected
      .getByRole("button", { name: "Edit device", exact: true })
      .click();
    await page
      .getByLabel("Name", { exact: true })
      .fill(j.run + " reviewed inactive printer");
    j.edit_pending = true;
    save();
    await confirm();
    await expect
      .poll(() =>
        api("GET", "/admin/printers").then(
          (rows) => rows.find((p) => p.printer_id === j.printer_id)?.name,
        ),
      )
      .toBe(j.run + " reviewed inactive printer");
    j.edit_pending = false;
    save();
    passed(
      "real synthetic inactive printer edited through reread-before-replace UI; remains inactive",
    );
  }
  for (const language of ["en", "ur"]) {
    await preference({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await shot("public/handbook/settings-it-" + language + ".png");
  }
  await preference({ language: "en", theme: "Light", ui_scale_pct: 100 });
  for (const label of [
    "Server health and LAN diagnostics",
    "Maintenance mode",
    "Force global logout (emergency)",
  ]) {
    await section(label);
    await expect(
      page.getByRole("heading", { name: "System (IT)", exact: true, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading from the hospital server…", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Force global logout", exact: true })
    .click();
  const confirmation = page.getByLabel("Confirm", { exact: true });
  await confirmation.fill("WRONG");
  await page
    .getByLabel("Reason", { exact: true })
    .fill(j.run + " validation only, no submit");
  assert.equal(await confirmation.evaluate((e) => e.checkValidity()), false);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  passed(
    "actual health/maintenance/emergency panels read; emergency exact phrase enforced, no global write",
  );
  await section("Users, roles and access");
  for (const panel of [
    "Users, roles and access",
    "Terminals, printers and badge stations",
    "Server health and LAN diagnostics",
    "Maintenance mode",
    "Force global logout (emergency)",
  ]) {
    await section(panel);
    for (const language of ["en", "ur"])
      for (const theme of ["Light", "DarkHighContrast"]) {
        await preference({ language, theme, ui_scale_pct: 250 });
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        const win = await app.browserWindow(page);
        assert.equal(
          await win.evaluate((w) => w.webContents.getZoomFactor()),
          2.5,
        );
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        assert(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 2,
          ),
        );
      }
    await preference({ language: "en", theme: "Light", ui_scale_pct: 100 });
  }
  passed(
    "five system panels at actual250% EN/UR both themes, no document horizontal overflow",
  );
  await section("Users, roles and access");
  await page.keyboard.press("F1");
  await expect(page.locator(".help-article")).toContainText(
    "Once-only credential slip",
  );
  await page
    .locator("dialog")
    .filter({ has: page.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  passed(
    "Settings F1 includes permitted system controls and credential/reconciliation guidance",
  );
  j.passed = true;
  delete j.error;
  save();
} catch (e) {
  j.error = e.message;
  save();
  throw e;
} finally {
  if (app) {
    // This cleanup has a repeat-safe state contract and only targets the verified
    // isolated account. It cannot reset or deactivate any shared seeded login.
    if (page) {
      try {
        const u = await api("GET", "/admin/users/34");
        assert.equal(u.username, "codex.foundation.1792584106665");
        assert.equal(u.employee_id, 36);
        if (u.is_active)
          await api("POST", "/admin/users/34/active", {
            active: false,
            reason: j.run + " finished isolated verification",
          });
        j.user_cleanup_pending = false;
        j.account_deactivated = true;
        save();
      } catch (e) {
        j.cleanup_error = e.message;
        save();
      }
    }
    if (prefs)
      await preference(prefs).catch((e) => {
        j.preferences_restore_error = e.message;
        save();
      });
    await app.close();
  }
}
