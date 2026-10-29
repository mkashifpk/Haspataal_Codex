// Real DEV Electron test support. Never records credentials; no mocked backend successes.
import { _electron as electron } from "playwright";
import { expect as baseExpect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
export const expect = baseExpect.configure({ timeout: 30000 });
export async function session(name, account = "demo.doctor") {
  fs.mkdirSync("artifacts", { recursive: true });
  const file = `artifacts/${name}.json`;
  if (fs.existsSync(file)) {
    const previous = JSON.parse(fs.readFileSync(file));
    assert(
      previous.finished && previous.preferences_restored,
      "Reconcile previous profile before rerunning",
    );
    fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
  }
  const j = {
    name,
    account,
    started: new Date().toISOString(),
    checks: [],
    passed: false,
  };
  const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
  save();
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      `artifacts/${name}-profile-${Date.now()}`,
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  j.profile = env.HASPATAAL_TEST_DATA;
  save();
  const app = await electron.launch({ args: ["."], env });
  const p = await terminalPage(app);
  p.setDefaultTimeout(30000);
  await p.setViewportSize({ width: 1400, height: 1000 });
  const native = async (action, args) => {
    const r = await p.evaluate((v) => window.terminal.call(v.action, v.args), {
      action,
      args,
    });
    assert(r.ok, `${action}: ${r.error?.code} ${r.error?.message}`);
    return r.data;
  };
  const s = { app, p, j, save, native };
  s.pass = (text) => {
    j.checks.push(text);
    save();
    console.log("PASS " + text);
  };
  s.nav = (label) =>
    p
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: false })
      .click();
  s.prefs = (value) => native("prefs", value);
  s.trace = () => app.evaluate(() => globalThis.clinicalTrace);
  s.fault = (value) =>
    app.evaluate((_, value) => {
      Object.assign(globalThis.clinicalTrace, value);
    }, value);
  s.close = async () => {
    try {
      j.trace = await s.trace();
      save();
    } catch {}
    try {
      if (s.original) {
        await s.prefs(s.original);
        const { updated_at, ...actual } = (await native("state")).prefs;
        const { updated_at: oldTime, ...original } = s.original;
        assert.deepEqual(actual, original);
      }
      j.preferences_restored = true;
    } catch (e) {
      j.cleanup_error = e.message;
      j.passed = false;
      process.exitCode = 1;
    }
    try {
      await native("logout");
      j.signed_out = !(await native("state")).user;
    } catch (e) {
      j.logout_diagnostic = e.message;
      try {
        j.signed_out = !(await native("state")).user;
        if (!j.signed_out) throw e;
      } catch {
        j.passed = false;
        process.exitCode = 1;
      }
    }
    await app.close();
    j.finished = new Date().toISOString();
    save();
  };
  try {
    await p.getByText("Hospital server ready.", { exact: true }).waitFor();
    await p.getByLabel("Username", { exact: true }).fill(account);
    await p.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
    await p.getByRole("button", { name: "Sign in →", exact: true }).click();
    // Retry only the app's explicit read-only bootstrap recovery. Never replay a business action.
    let bootstrapRetries=0;
    await expect.poll(async()=>{if(await p.getByRole('navigation').isVisible())return true;const retry=p.getByRole('button',{name:'Retry loading workspace',exact:true});if(bootstrapRetries<3&&await retry.isVisible()){bootstrapRetries++;await retry.click();}return false;},{timeout:90000,intervals:[500,1000,2000]}).toBe(true);
    s.original = (await native("state")).prefs;
    j.original_preferences = s.original;
    save();
    await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
    await app.evaluate(({ BrowserWindow }, name) => {
      const fs = process.getBuiltinModule("fs"),
        https = process.getBuiltinModule("https"),
        original = https.request;
      const t = (globalThis.clinicalTrace = {
        requests: [],
        failPath: null,
        delayPath: null,
        delayMs: 0,
        prints: 0,
      });
      const persist = () =>
        fs.writeFileSync(
          process.cwd() + `/artifacts/${name}-transport.json`,
          JSON.stringify(t),
        );
      persist();
      https.request = function (url, options, callback) {
        const object = typeof url === "object" && !(url instanceof URL),
          u = object
            ? new URL(
                `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
              )
            : new URL(url),
          method = (object ? url.method : options?.method) || "GET";
        if(t.denyBusinessWrites && method!=="GET" && /\/(?:programme-enrolments|home-visits|patients\/\d+\/programmes)(?:\/|$)/.test(u.pathname)){
          t.blockedWrites=(t.blockedWrites||0)+1;persist();throw new Error("READ_ONLY_PREVIEW: business writes are refused before transport");
        }
        if (/\/(auth\/|settings\/|admin\/.*password)/.test(u.pathname))
          return original.call(this, url, options, callback);
        const a = {
          method,
          path: u.pathname + u.search,
          finished: false,
          started: Date.now(),
        };
        t.requests.push(a);
        persist();
        const req = original.call(this, url, options, (response) => {
          const chunks = [];
          response.on("data", (c) => chunks.push(Buffer.from(c)));
          const emit = response.emit.bind(response);
          response.emit = function (event, ...args) {
            if (event === "end") {
              a.status = response.statusCode;
              a.replay = response.headers["idempotent-replay"];
              a.finished = true;
              try {
                a.result = JSON.parse(Buffer.concat(chunks).toString());
              } catch {}
              persist();
              if (
                t.failPath &&
                a.path.includes(t.failPath) &&
                (!t.failMethod || t.failMethod === method)
              ) {
                if (t.once) t.failPath = null;
                a.reply_lost = true;
                persist();
                response.destroy(new Error("TEST: lost real DEV reply"));
                // A fully buffered response may already be complete, so destroy alone
                // need not emit an error. Reject the client read explicitly while
                // retaining the actual committed status/body in this trace.
                emit("error", new Error("TEST: lost real DEV reply"));
                return true;
              }
              if (t.delayPath && a.path.includes(t.delayPath)) {
                a.delayed = true;
                const delay = t.delayMs;
                persist();
                setTimeout(() => emit(event, ...args), delay);
                return true;
              }
            }
            return emit(event, ...args);
          };
          callback(response);
        });
        if (method !== "GET") {
          const body = [],
            write = req.write.bind(req),
            end = req.end.bind(req);
          req.write = function (c, ...args) {
            if (c) body.push(Buffer.from(c));
            return write(c, ...args);
          };
          req.end = function (c, ...args) {
            if (c && typeof c !== "function") body.push(Buffer.from(c));
            try {
              a.body = JSON.parse(Buffer.concat(body).toString());
              // A second person's co-signing credentials never enter test journals.
              for (const field of ["checker_password", "checker_username", "approver_password", "approver_username"]) if(field in a.body)a.body[field]="[REDACTED]";
            } catch {}
            a.key = req.getHeader("Idempotency-Key");
            persist();
            return end(c, ...args);
          };
        }
        return req;
      };
      for (const win of BrowserWindow.getAllWindows())
        win.webContents.print = (_, cb) => {
          t.prints++;
          persist();
          cb(false, "TEST: user cancelled handbook printing");
        };
    }, name);
    j.renderer = await p.locator('script[type="module"]').getAttribute("src");
    save();
    return s;
  } catch (e) {
    j.error = e.stack;
    try { j.startup_ui = await p.locator("body").innerText(); } catch {}
    save();
    await s.close();
    throw e;
  }
}
export async function capture(s, id) {
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(s.p.locator("html")).toHaveAttribute("lang", language);
    await s.p.screenshot({ path: `public/handbook/${id}-${language}.png` });
    for (const theme of ["Light", "DarkHighContrast"]) {
      await s.prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          s.p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
    }
  }
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
}
export async function help(s, control, title) {
  await control.focus();
  await s.p.keyboard.press("F1");
  await expect(s.p.locator(".help-article h1")).toHaveText(title);
  await s.p
    .getByRole("dialog")
    .filter({ has: s.p.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(control).toBeFocused();
}
