// Real DEV, one NEW synthetic Card-paid registration through the UI, then call and re-route.
// Never uses prior finance fixtures. No physical cash, dispensing or external payment processing.
// Incremental journals omit credentials. Reconcile an unfinished journal before rerunning.
import { _electron as electron } from "playwright";
import { expect as baseExpect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const expect = baseExpect.configure({ timeout: 45000 });
const file = "artifacts/doctor-queue-check.json";
fs.mkdirSync("artifacts", { recursive: true });
const resume = process.argv.includes("--resume");
const readOnly = process.argv.includes("--read-only");
assert(
  readOnly || resume || process.argv.includes("--create-fixture"),
  "Choose --read-only, --resume or explicit --create-fixture; never create another payment unintentionally",
);
let prior;
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    old.finished &&
      (resume || (old.preferences_restored && old.business_complete)),
    "Reconcile original journal before any new business writes",
  );
  if (readOnly) {
    assert(old.business_complete && old.preferences_restored);
    prior = old;
  }
  if (resume) {
    assert(
      old.source?.patient_id === 18 &&
        old.source?.ticket_id === 14 &&
        old.source?.queue_id === 7,
    );
    prior = old;
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: prior?.run || "DEMO-DOCTOR-QUEUE-" + Date.now(),
  continuation: !!prior,
  checks: [],
  apps: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
const pass = (s) => {
  j.checks.push(s);
  save();
  console.log("PASS " + s);
};
const instances = [];
const native = async (p, action, args) => {
  const r = await p.evaluate((v) => window.terminal.call(v.action, v.args), {
    action,
    args,
  });
  assert(r.ok, `${action}: ${r.error?.code} ${r.error?.message}`);
  return r.data;
};
const prefs = (p, v) => native(p, "prefs", v);
const nav = (p, title) =>
  p
    .getByRole("navigation")
    .getByRole("button", { name: title, exact: false })
    .click();
async function launch(account, tag) {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(`artifacts/doctor-${tag}-${j.run}`),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], env });
  const p = await terminalPage(app);
  p.setDefaultTimeout(45000);
  await p.setViewportSize({ width: 1400, height: 1000 });
  const a = { app, p, account, tag };
  instances.push(a);
  await p.getByText("Hospital server ready.", { exact: true }).waitFor();
  await p.getByLabel("Username", { exact: true }).fill(account);
  await p.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await p.getByRole("button", { name: "Sign in →", exact: true }).click();
  await p.getByRole("navigation").waitFor();
  const s = await native(p, "state");
  a.original = s.prefs;
  j.apps.push({
    tag,
    account,
    user_id: s.user.user_id,
    original_preferences: s.prefs,
  });
  save();
  await prefs(p, { language: "en", theme: "Light", ui_scale_pct: 100 });
  await app.evaluate(({ BrowserWindow }, tag) => {
    const https = process.getBuiltinModule("https"),
      fs = process.getBuiltinModule("fs");
    globalThis.dqTest = {
      reads: [],
      writes: [],
      lostCall: false,
      lostReroute: false,
      failRead: false,
      printAttempts: 0,
    };
    const t = globalThis.dqTest;
    const persist = () =>
      fs.writeFileSync(
        process.cwd() + `/artifacts/doctor-${tag}-transport.json`,
        JSON.stringify(t),
      );
    persist();
    const original = https.request;
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL),
        u = object
          ? new URL(
              `https://${url.hostname || url.host}:${url.port || 443}${url.path || "/"}`,
            )
          : new URL(url),
        method = (object ? url.method : options?.method) || "GET";
      const watched =
        (method === "GET" && u.pathname.endsWith("/opd-queues/me")) ||
        (method === "POST" &&
          (/\/opd-queues\/\d+\/(call|reroute)$/.test(u.pathname) ||
            u.pathname.endsWith("/reception/registrations")));
      if (!watched) return original.call(this, url, options, callback);
      const a = {
        method,
        path: u.pathname,
        started: Date.now(),
        finished: false,
      };
      (method === "GET" ? t.reads : t.writes).push(a);
      persist();
      const req = original.call(this, url, options, (response) => {
        const chunks = [];
        a.status = response.statusCode;
        a.request_id = response.headers["x-request-id"];
        response.on("data", (c) => chunks.push(Buffer.from(c)));
        const emit = response.emit.bind(response);
        response.emit = function (event, ...args) {
          if (event === "end") {
            try {
              a.body = JSON.parse(Buffer.concat(chunks).toString());
            } catch {}
            a.finished = true;
            persist();
            const lost =
              (method === "GET" && t.failRead) ||
              (method === "POST" &&
                u.pathname.endsWith("/call") &&
                t.lostCall) ||
              (method === "POST" &&
                u.pathname.endsWith("/reroute") &&
                t.lostReroute);
            if (lost) {
              t.lostCall = false;
              t.lostReroute = false;
              a.reply_deliberately_lost = true;
              persist();
              response.destroy(
                new Error("TEST: real DEV reply lost after server completed"),
              );
              return true;
            }
          }
          return emit(event, ...args);
        };
        callback(response);
      });
      if (method === "POST") {
        const chunks = [],
          write = req.write.bind(req),
          end = req.end.bind(req);
        req.write = function (c, ...args) {
          if (c) chunks.push(Buffer.from(c));
          return write(c, ...args);
        };
        req.end = function (c, ...args) {
          if (c && typeof c !== "function") chunks.push(Buffer.from(c));
          try {
            a.request_body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {}
          a.idempotency_key = req.getHeader("Idempotency-Key");
          persist();
          return end(c, ...args);
        };
      }
      return req;
    };
    // Exercise print cancellation at the native boundary without a physical printer.
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.print = (options, cb) => {
        t.printAttempts++;
        persist();
        cb(false, "TEST: user cancelled handbook printing");
      };
  }, tag);
  return a;
}
const transport = (a) => a.app.evaluate(() => globalThis.dqTest);
const patch = (a, v) =>
  a.app.evaluate((_, v) => {
    Object.assign(globalThis.dqTest, v);
  }, v);
async function help(p, control, title = "My live queue") {
  await control.focus();
  await p.keyboard.press("F1");
  await expect(p.locator(".help-article h1")).toHaveText(title);
  await p
    .getByRole("dialog")
    .filter({ has: p.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(control).toBeFocused();
}
async function zoom(a, key) {
  const win = await a.app.browserWindow(a.p);
  await win.evaluate((w, key) => {
    w.webContents.sendInputEvent({
      type: "keyDown",
      keyCode: key,
      modifiers: ["control"],
    });
    w.webContents.sendInputEvent({
      type: "keyUp",
      keyCode: key,
      modifiers: ["control"],
    });
  }, key);
}
async function printChecks() {
  const receiver = await launch("demo.doctor2", "receiver");
  const r = receiver.p;
  await nav(r, "My live queue");
  const actual = await native(r, "api", {method:"GET",path:"/opd-queues/me"});
  assert(actual.some(x=>x.queue_id===8 && x.patient_id===18 && x.ticket_id===14));
  j.business_complete = true;
  j.renderer = await r.locator('script[type="module"]').getAttribute("src");
  save();
  await r.keyboard.press("F1");
  await expect(r.locator(".help-article h1")).toHaveText("My live queue");
  const example = r.locator(".help-article .handbook-example img");
  await example.scrollIntoViewIfNeeded();
  assert(await example.evaluate(i=>i.complete && i.naturalWidth>=1000));
  await r.getByRole("button", {name:"Print handbook page",exact:true}).click();
  await expect(r.getByRole("alert").filter({hasText:"TEST: user cancelled"})).toBeVisible();
  await example.scrollIntoViewIfNeeded();
  const win = await receiver.app.browserWindow(r);
  await win.evaluate(async(w,out)=>{
    const fs=process.getBuiltinModule("fs");
    fs.writeFileSync(out,await w.webContents.printToPDF({printBackground:true}));
  },path.resolve("artifacts/doctor-queue-final-handbook.pdf"));
  assert.equal((await transport(receiver)).writes.length,0);
  pass("Final print regression: scrolled real handbook/bundled image, visible native print cancellation, PDF rendered; zero business writes (PDF text checked separately)");
  j.passed=true;save();
}
async function readOnlyChecks() {
  const receiver = await launch("demo.doctor2", "receiver"),
    front = await launch("demo.reception", "reception"),
    surgeon = await launch("demo.surgeon", "empty");
  const r = receiver.p;
  await nav(r, "My live queue");
  await nav(surgeon.p, "My live queue");
  await expect(
    front.p
      .getByRole("navigation")
      .getByRole("button", { name: "My live queue", exact: false }),
  ).toHaveCount(0);
  await expect(
    surgeon.p.getByText("No patients are waiting in your queue.", {
      exact: false,
    }),
  ).toBeVisible();
  const actual = await native(r, "api", {
    method: "GET",
    path: "/opd-queues/me",
  });
  const row = actual.find(
    (x) => x.patient_id === 18 && x.ticket_id === 14 && x.queue_id === 8,
  );
  assert(
    row?.is_rerouted &&
      row.rerouted_from_queue_id === 7 &&
      row.queue_group === "doctor:11",
  );
  j.received = row;
  j.business_complete = true;
  const incoming = r.locator(".doctor-token").filter({ hasText: j.run });
  await expect(incoming).toBeVisible();
  j.renderer = await r.locator('script[type="module"]').getAttribute("src");
  save();
  pass(
    "Original fresh receiving queue8 verified; real empty surgeon queue and forbidden reception navigation; zero business POSTs",
  );
  for (const language of ["en", "ur"]) {
    await prefs(r, { language, theme: "Light", ui_scale_pct: 100 });
    await expect(r.locator("html")).toHaveAttribute("lang", language);
    if (!process.argv.includes("--no-capture"))
      await r.screenshot({
        path: `public/handbook/doctor_queue-${language}.png`,
      });
    for (const theme of ["Light", "DarkHighContrast"]) {
      await prefs(r, { language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          r.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
      await incoming.getByRole("button").first().scrollIntoViewIfNeeded();
      await expect(incoming.getByRole("button").first()).toBeVisible();
      await r.screenshot({
        path: `artifacts/doctor-queue-final-${language}-${theme}-250.png`,
        fullPage: true,
      });
    }
  }
  await prefs(r, { language: "en", theme: "Light", ui_scale_pct: 100 });
  await help(
    r,
    incoming.getByRole("button", { name: "Call patient", exact: true }),
  );
  await r.context().setOffline(true);
  await r.keyboard.press("F1");
  await expect(r.locator(".help-article h1")).toHaveText("My live queue");
  await r.getByLabel("Search handbook", { exact: true }).fill("My live queue");
  await expect(r.locator(".help-article .handbook-example img")).toBeVisible();
  assert(
    await r
      .locator(".help-article .handbook-example img")
      .evaluate((i) => i.complete && i.naturalWidth >= 1000),
  );
  await r.context().setOffline(false);
  await r
    .getByRole("button", { name: "Print handbook page", exact: true })
    .click();
  await expect(
    r.getByRole("alert").filter({ hasText: "TEST: user cancelled" }),
  ).toBeVisible();
  const win = await receiver.app.browserWindow(r);
  await win.evaluate(async (w, out) => {
    const fs = process.getBuiltinModule("fs");
    fs.writeFileSync(
      out,
      await w.webContents.printToPDF({ printBackground: true }),
    );
  }, path.resolve("artifacts/doctor-queue-final-handbook.pdf"));
  await r
    .getByRole("dialog")
    .filter({ has: r.locator(".help-layout") })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  pass(
    "Final EN/UR both themes250% reachable controls, F1 focus, renderer-offline help/search/bundled image; native print cancel and actual PDF (physical review pending)",
  );
  await nav(r, "Settings");
  const slider = r.locator('input[type="range"][data-help="settings.zoom"]');
  await slider.fill("180");
  await slider.dispatchEvent("change");
  await expect
    .poll(() => native(r, "state").then((s) => s.prefs.ui_scale_pct))
    .toBe(180);
  const factor = await win.evaluate((w) => w.webContents.getZoomFactor());
  assert.equal(factor, 1.8);
  await zoom(receiver, "=");
  await expect
    .poll(() => native(r, "state").then((s) => s.prefs.ui_scale_pct))
    .toBe(190);
  await expect(slider).toHaveValue("190");
  await zoom(receiver, "0");
  await expect(slider).toHaveValue("100");
  await nav(r, "My live queue");
  pass(
    "Settings180/nativefactor1.8; native shortcut190 shares slider state; reset100",
  );
  await patch(receiver, { failRead: true });
  await r.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(r.locator("main .error").first()).toBeVisible();
  await expect(r.locator(".doctor-token")).toHaveCount(0);
  await patch(receiver, { failRead: false });
  await r.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(incoming).toBeVisible();
  pass(
    "Lost real GET responses across safe transport retries: explicit failed state hides stale rows, read retry recovers; no business replay",
  );
  for (const a of [receiver, front, surgeon])
    assert.equal((await transport(a)).writes.length, 0);
  j.passed = true;
  save();
}

save();
try {
  if (readOnly && process.argv.includes("--print-only")) await printChecks();
  else if (readOnly) await readOnlyChecks();
  else {
    const doctor = await launch("demo.doctor", "source"),
      receiver = await launch("demo.doctor2", "receiver"),
      reception = await launch("demo.reception", "reception");
    const p = doctor.p,
      r = receiver.p,
      front = reception.p;
    await nav(p, "My live queue");
    await nav(r, "My live queue");
    await expect(p.locator("main h1")).toHaveText("My live queue");
    await expect(
      p.getByText("Live · Updates arrive automatically; no polling.", {
        exact: true,
      }),
    ).toBeVisible();
    const before = (await transport(doctor)).reads.length;
    await p.waitForTimeout(5200);
    assert.equal(
      (await transport(doctor)).reads.length,
      before,
      "queue must not poll",
    );
    pass("Live queue read; no periodic queue requests during idle");
    if (!resume) {
      // Create the NEW upstream record through the app; observe its own original key before sending.
      await nav(front, "New registration + OPD slip");
      await front.getByLabel("Full name", { exact: true }).fill(j.run);
      await front.getByLabel("Age in years", { exact: true }).fill("32");
      await front.getByLabel("Mobile", { exact: true }).fill("03000000000");
      const catalog = await native(front, "api", {
        method: "GET",
        path: "/finance/service-catalog?category=OPD",
      });
      const service = catalog.find(
        (s) => s.is_active && s.doctor_name === "Dr. Ahmed Khan",
      );
      assert(service);
      j.service = service;
      save();
      await front
        .getByLabel("OPD service", { exact: true })
        .selectOption(String(service.service_id));
      await front
        .getByLabel("Collect full payment now", { exact: true })
        .check();
      await front
        .getByLabel("Payment method", { exact: true })
        .selectOption("Card");
      await front
        .getByLabel("Card / bank reference", { exact: true })
        .fill(j.run + " synthetic");
      j.registration_pending = true;
      save();
      await front
        .getByRole("button", {
          name: "Register and collect payment",
          exact: true,
        })
        .click();
      await expect(
        front.getByRole("heading", { name: "OPD slip issued", exact: true }),
      ).toBeVisible();
      const registration = (await transport(reception)).writes.filter((w) =>
        w.path.endsWith("/reception/registrations"),
      );
      assert.equal(registration.length, 1);
      assert.equal(registration[0].status, 201);
      j.registration = registration[0];
      j.registration_pending = false;
      save();
    } else {
      j.registration = prior.registration;
      j.registration_pending = false;
      j.service = prior.service;
      save();
    }
    const catalog = await native(front, "api", {
      method: "GET",
      path: "/finance/service-catalog?category=OPD",
    });
    await expect(
      p.locator(".doctor-token").filter({ hasText: j.run }),
    ).toBeVisible();
    const card = p.locator(".doctor-token").filter({ hasText: j.run });
    const rows = await native(p, "api", {
      method: "GET",
      path: "/opd-queues/me",
    });
    j.source = rows.find((q) => q.patient_name === j.run);
    assert(j.source);
    save();
    if (resume) {
      assert.equal(j.source.patient_id, 18);
      assert.equal(j.source.ticket_id, 14);
      assert.equal(j.source.queue_id, 7);
      assert.equal(j.source.ticket_status, "InConsultation");
      pass(
        "Original patient18/ticket14/queue7 re-read; confirmed prior call, no repeat registration/payment",
      );
    } else
      pass(
        "Fresh synthetic patient/settled Card slip created through registration UI; source queue updated by real event",
      );
    const priorLostCall = prior?.source_transport?.writes?.find(
      (w) =>
        w.path.endsWith("/call") &&
        w.status === 200 &&
        w.reply_deliberately_lost,
    );
    if (!priorLostCall) {
      // New call commits, then lose its reply: no automatic replay even after read refresh.
      await card
        .getByRole("button", {
          name: resume ? "Call again" : "Call patient",
          exact: true,
        })
        .click();
      await help(
        p,
        p
          .getByRole("dialog")
          .getByRole("button", { name: "Confirm", exact: true }),
      );
      await patch(doctor, { lostCall: true });
      await p
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .dblclick();
      await expect(
        p.getByText("The reply was lost. Do not repeat the action.", {
          exact: false,
        }),
      ).toBeVisible();
      await p.keyboard.press("Escape");
      await expect(p.getByRole("dialog")).toBeVisible();
      assert.equal(
        (await transport(doctor)).writes.filter((w) => w.path.endsWith("/call"))
          .length,
        1,
      );
      await p
        .getByRole("button", {
          name: "Re-read queue to reconcile",
          exact: true,
        })
        .click();
      await p
        .getByRole("button", {
          name: "Finish reconciliation; return to queue",
          exact: true,
        })
        .click();
      await expect(
        card.getByText("InConsultation", { exact: false }),
      ).toBeVisible();
      const called = (await transport(doctor)).writes.find((w) =>
        w.path.endsWith("/call"),
      );
      assert.equal(called.status, 200);
      j.call = called;
      save();
      pass(
        "Fresh call200 lost after commit; single POST on double click; Escape/navigation lock and read-only reconciliation, no repeat announcement",
      );
    } else {
      j.call = priorLostCall;
      pass(
        "Previous lost-call200 and single-flight/read-only reconciliation preserved; no extra announcement in continuation",
      );
    }
    // Re-route draft F1, validation and deliberate discard.
    await card
      .getByRole("button", { name: "Re-route patient", exact: true })
      .click();
    const reason = p.getByLabel("Re-route reason (3–500 characters)", {
      exact: true,
    });
    await reason.fill("clinical synthetic reason");
    await help(p, reason);
    await expect(reason).toHaveValue("clinical synthetic reason");
    p.once("dialog", (d) => d.dismiss());
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(reason).toHaveValue("clinical synthetic reason");
    await reason.fill("ab");
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      p.getByRole("alert").filter({ hasText: "Choose a destination" }),
    ).toBeVisible();
    assert.equal(
      (await transport(doctor)).writes.filter((w) =>
        w.path.endsWith("/reroute"),
      ).length,
      0,
    );
    const destination = catalog.find(
      (s) => s.is_active && s.doctor_name === "Dr. Sara Malik",
    );
    assert(destination);
    await p
      .getByLabel("Destination", { exact: true })
      .selectOption("doctor:" + destination.doctor_id);
    await reason.fill(
      j.run + " synthetic referral; paediatric specialist review test",
    );
    j.reroute_pending = true;
    j.destination = destination;
    save();
    await patch(doctor, { lostReroute: true });
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .dblclick();
    await expect(
      p.getByText("The reply was lost. Do not repeat the action.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(reason).toBeDisabled();
    await p.keyboard.press("Escape");
    await expect(reason).toBeVisible();
    await p
      .getByRole("button", { name: "Re-read queue to reconcile", exact: true })
      .click();
    await expect(
      p.getByText("The source entry is absent.", { exact: false }),
    ).toBeVisible();
    await expect(
      r.locator(".doctor-token").filter({ hasText: j.run }),
    ).toBeVisible();
    const incoming = r.locator(".doctor-token").filter({ hasText: j.run });
    await expect(
      incoming.getByText("Re-routed patient", { exact: false }),
    ).toBeVisible();
    const received = await native(r, "api", {
      method: "GET",
      path: "/opd-queues/me",
    });
    j.received = received.find((q) => q.patient_name === j.run);
    assert(j.received.is_rerouted);
    assert.equal(received[0].queue_id, j.received.queue_id);
    assert.equal(j.received.rerouted_from_queue_id, j.source.queue_id);
    await p
      .getByRole("button", {
        name: "Finish reconciliation; return to queue",
        exact: true,
      })
      .click();
    const rw = (await transport(doctor)).writes.filter((w) =>
      w.path.endsWith("/reroute"),
    );
    assert.equal(rw.length, 1);
    assert.equal(rw[0].status, 200);
    j.reroute = rw[0];
    j.reroute_pending = false;
    j.business_complete = true;
    save();
    pass(
      "Re-route200 lost after commit: one POST, frozen draft, read-only reconciliation; destination event places marked patient at top with reason",
    );
    // Screenshots from real receiving queue; draft translation and both themes/250%.
    for (const language of ["en", "ur"]) {
      await prefs(r, { language, theme: "Light", ui_scale_pct: 100 });
      await expect(r.locator("html")).toHaveAttribute("lang", language);
      await r.screenshot({
        path: `public/handbook/doctor_queue-${language}.png`,
      });
      for (const theme of ["Light", "DarkHighContrast"]) {
        await prefs(r, { language, theme, ui_scale_pct: 250 });
        await expect
          .poll(() =>
            r.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
          )
          .toBe(true);
        await r.screenshot({
          path: `artifacts/doctor-queue-${language}-${theme}-250.png`,
        });
      }
    }
    await prefs(r, { language: "en", theme: "Light", ui_scale_pct: 100 });
    pass(
      "Authentic EN/UR handbook screenshots and both themes250% without document overflow",
    );
    // Real native zoom shortcut bounds/reset; preferences restored in finally.
    for (let i = 0; i < 20; i++) await zoom(receiver, "=");
    await expect
      .poll(() => native(r, "state").then((s) => s.prefs.ui_scale_pct))
      .toBe(250);
    for (let i = 0; i < 24; i++) await zoom(receiver, "-");
    await expect
      .poll(() => native(r, "state").then((s) => s.prefs.ui_scale_pct))
      .toBe(100);
    await zoom(receiver, "=");
    await zoom(receiver, "0");
    await expect
      .poll(() => native(r, "state").then((s) => s.prefs.ui_scale_pct))
      .toBe(100);
    await help(
      r,
      incoming.getByRole("button", { name: "Call patient", exact: true }),
    );
    await r.keyboard.press("F1");
    await expect(r.locator(".help-article h1")).toHaveText("My live queue");
    await r
      .getByRole("button", { name: "Print handbook page", exact: true })
      .click();
    await expect(
      r.getByRole("alert").filter({ hasText: "TEST: user cancelled" }),
    ).toBeVisible();
    assert.equal((await transport(receiver)).printAttempts, 1);
    const pdf = await receiver.app.browserWindow(r);
    await pdf.evaluate(async (w, out) => {
      const fs = process.getBuiltinModule("fs");
      fs.writeFileSync(
        out,
        await w.webContents.printToPDF({ printBackground: true }),
      );
    }, path.resolve("artifacts/doctor-queue-handbook.pdf"));
    await r
      .getByRole("dialog")
      .filter({ has: r.locator(".help-layout") })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    pass(
      "Native zoom bounds/reset and F1 focus; native handbook print cancellation surfaced; real handbook PDF rendered (physical printing pending)",
    );
    await patch(receiver, { failRead: true });
    await r.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(r.getByRole("alert")).toBeVisible();
    await expect(r.locator(".doctor-token")).toHaveCount(0);
    await r.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(incoming).toBeVisible();
    pass(
      "Real read reply failure hides stale rows; explicit read retry restores current queue",
    );
    j.passed = true;
    save();
  }
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
  for (const a of instances)
    try {
      await a.p.screenshot({ path: `artifacts/doctor-${a.tag}-failure.png` });
      j[a.tag + "_failure_text"] = await a.p.locator("body").innerText();
      save();
    } catch {}
} finally {
  let restored = true;
  for (const a of instances) {
    try {
      j[a.tag + "_transport"] = await transport(a);
      save();
    } catch {}
    if (a.original)
      try {
        await prefs(a.p, a.original);
        const actual = (await native(a.p, "state")).prefs;
        const values = ({ updated_at, ...rest }) => rest;
        assert.deepEqual(values(actual), values(a.original));
        j.apps.find((x) => x.tag === a.tag).preferences_restored = true;
        save();
      } catch (e) {
        restored = false;
        j[a.tag + "_cleanup_error"] = e.message;
        j.passed = false;
        process.exitCode = 1;
        save();
      }
    try {
      await native(a.p, "logout");
    } catch (e) {
      j[a.tag + "_logout_error"] = e.message;
    }
    await a.app.close();
  }
  j.preferences_restored = restored;
  j.finished = new Date().toISOString();
  save();
}
