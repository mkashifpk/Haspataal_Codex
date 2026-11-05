# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV. Only owned user34/employee36 and two new labelled UNPAID slips.
// No charge, approval, physical cash claim or shared demo-password change.
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
const file = "artifacts/queue-step-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.cleanup_confirmed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/queue-step-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/queue-step-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/queue-step-native-writes.json",
      `artifacts/queue-step-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-QUEUE-" + Date.now(),
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
          body: route.includes("password") ? undefined : body,
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
  const u = await backend("GET", "/admin/users/34", it);
  assert.equal(u.username, "codex.foundation.1792584106665");
  assert.equal(u.employee_id, 36);
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
async function scan(number) {
  await page.getByLabel("OPD slip number", { exact: true }).fill(number);
  await page.getByLabel("OPD slip number", { exact: true }).press("Enter");
  await expect(
    page.locator("main h2").filter({ hasText: number }),
  ).toBeVisible();
}
async function createSlip(label) {
  const catalog = await backend(
    "GET",
    "/finance/service-catalog?category=OPD",
    ownToken,
  );
  const service = catalog.find((s) => s.is_active && s.doctor_id);
  assert(service, "No actual active OPD service");
  const key = crypto.randomUUID(),
    body = {
      new_patient: {
        full_name: j.run + " " + label,
        gender: "unknown",
        age_years: 30,
        mobile: "00000000000",
      },
      doctor_id: service.doctor_id,
      department_id: service.department_id,
      service_id: service.service_id,
    };
  const t = await backend(
    "POST",
    "/reception/registrations",
    ownToken,
    body,
    key,
  );
  assert.equal(t.payment_status, "Unpaid");
  j.tickets.push({
    id: t.ticket_id,
    number: t.ticket_number,
    patient_id: t.patient_id,
    key,
    closed: false,
  });
  save();
  return t;
}
async function capture(id) {
  for (const language of ["en", "ur"]) {
    await prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `public/handbook/${id}-${language}.png` });
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
        path: `artifacts/${id}-${language}-${theme}-250.png`,
      });
    }
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
}
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
async function cancelRequests(ticket) {
  const rows = await backend("GET", "/approvals?mine=true&limit=100", ownToken);
  for (const a of rows.filter(
    (a) =>
      a.status === "Pending" &&
      a.requester_id === 34 &&
      a.payload_jsonb?.ticket_id === ticket.ticket_id,
  )) {
    j.requests.push({
      id: a.request_id,
      ticket_id: ticket.ticket_id,
      cleanup_pending: true,
    });
    save();
    await backend("POST", `/approvals/${a.request_id}/cancel`, ownToken, {
      note: j.run + " synthetic UI test cleanup, no real approval/payment",
    });
    j.requests.at(-1).cleanup_pending = false;
    save();
  }
}
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/queue-step-profile-" + Date.now(),
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
  assert.equal(
    (await owned()).is_active,
    false,
    "Never take over active fixture",
  );
  ownsFixture = true;
  await backend("POST", "/admin/users/34/active", it, {
    active: true,
    reason: j.run + " isolated screen tests",
  });
  const temporary = (
    await backend("POST", "/admin/users/34/reset-password", it)
  ).temporary_password;
  assert(temporary);
  await app.evaluate(() => {
    const https=process.getBuiltinModule("https"),original=https.request,fs=process.getBuiltinModule("fs");
    globalThis.frontTest={writes:[],reads:[],events:[],dropDefer:true,dropReactivate:true};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/queue-step-native-writes.json",JSON.stringify(globalThis.frontTest.writes,null,2));persist();
    const load=process.getBuiltinModule("module").createRequire(process.cwd()+"/package.json"),WS=load("ws"),send=WS.prototype.send;
    WS.prototype.send=function(data,...rest){const m=JSON.parse(String(data));if(m.type==="auth")this.on("message",raw=>{const e=JSON.parse(String(raw));if(e.type==="event")globalThis.frontTest.events.push({event_type:e.event_type,event_id:e.event_id,ticket_id:e.payload?.ticket_id})});return send.call(this,data,...rest)};
    https.request=function(url,options,callback){
      const object=typeof url==="object" && !(url instanceof URL),u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url),method=(object?url.method:options?.method)||"GET";
      if(method==="GET" && /\/opd-(tickets|queues)\//.test(u.pathname))globalThis.frontTest.reads.push(u.pathname);
      if(method!=="POST" || !/\/opd-tickets\/\d+\/(defer|reactivate)$/.test(u.pathname))return original.call(this,url,options,callback);
      const a={path:u.pathname,key:options?.headers?.["Idempotency-Key"],body:"",finished:false};globalThis.frontTest.writes.push(a);persist();
      const req=original.call(this,url,options,response=>{a.status=response.statusCode;a.replay=response.headers["idempotent-replay"];let chunks=[];response.on("data",c=>chunks.push(Buffer.from(c)));const emit=response.emit.bind(response);response.emit=function(event,...args){if(event==="end"){try{a.result=JSON.parse(Buffer.concat(chunks).toString()).data}catch{}a.finished=true;persist();const flag=a.path.endsWith("/defer")?"dropDefer":"dropReactivate";if(globalThis.frontTest[flag] && a.status===200){globalThis.frontTest[flag]=false;response.destroy(new Error("TEST lost real committed queue reply"));return true}}return emit(event,...args)};callback(response)});
      const write=req.write.bind(req);req.write=function(chunk,...rest){a.body+=Buffer.isBuffer(chunk)?chunk.toString():String(chunk);persist();return write(chunk,...rest)};return req;
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
  await page.getByRole("navigation").waitFor();
  original = (await state()).prefs;
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  ownToken = (
    await backend("POST", "/auth/login", null, {
      username: "codex.foundation.1792584106665",
      password,
    })
  ).access_token;
  j.renderer = await page.locator('script[type="module"]').getAttribute("src");
  save();

  await nav("Queue management");
  const catalog=await backend("GET","/finance/service-catalog?category=OPD",ownToken);
  const service=catalog.find(s=>s.is_active && s.doctor_id);assert(service);
  const body={new_patient:{full_name:j.run,gender:"unknown",age_years:30,mobile:"00000000000"},service_id:service.service_id,doctor_id:service.doctor_id,department_id:service.department_id,payment:{method:"Card",reference_no:j.run}};
  const t=await backend("POST","/reception/registrations",ownToken,body,crypto.randomUUID());
  assert.equal(t.status,"Waiting");assert.equal(t.payment_status,"Paid");assert(t.queue?.token_no);j.tickets.push({id:t.ticket_id,number:t.ticket_number,patient_id:t.patient_id,token:t.queue.token_no,payment_id:t.payment?.payment_id,amount_paid:t.invoice.amount_paid,cleanup_confirmed:false});save();
  await scan(t.ticket_number);
  const doctorSelect=page.getByLabel("Doctor queue",{exact:true});await doctorSelect.selectOption(String(t.doctor_id));await expect(doctorSelect).toHaveValue(String(t.doctor_id));
  const rows=await native("GET",`/opd-queues/by-doctor/${t.doctor_id}`);j.doctor_rows=rows.filter(r=>r.ticket_id===t.ticket_id).map(r=>({ticket_id:r.ticket_id,token_no:r.token_no}));save();
  await page.getByRole("button",{name:"Defer slip",exact:true}).click();
  const reason=page.getByLabel("Reason",{exact:true});await reason.fill(j.run+" lost deferral");await help("Queue management",reason);
  page.once("dialog",d=>d.dismiss());await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();await expect(reason).toHaveValue(j.run+" lost deferral");
  await page.getByRole("button",{name:"Confirm ticket action",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByRole("button",{name:"Check latest slip",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Retry original action",exact:true})).toHaveCount(0);
  let w=await app.evaluate(()=>globalThis.frontTest.writes);assert.equal(w.length,1);assert.equal(w[0].status,200);
  await page.getByRole("button",{name:"Check latest slip",exact:true}).click();await expect(page.getByText(/Ticket status: Deferred/)).toBeVisible();
  await page.getByLabel("I have reviewed the latest server status and will close this uncertain action.",{exact:true}).check();await page.getByRole("button",{name:"Close reviewed action",exact:true}).click();
  assert.equal((await backend("GET",`/opd-tickets/${t.ticket_id}`,ownToken)).queue.token_no,t.queue.token_no);
  await expect(doctorSelect).toHaveValue(String(t.doctor_id));
  pass("real Card-paid synthetic queue; doctor read and selection retained through empty/deferred queue; lost defer200 submitted once, never replayed; explicit original status/history review, F1 and rejected draft discard");
  await page.getByRole("button",{name:"Reactivate slip",exact:true}).click();await page.getByRole("button",{name:"Confirm ticket action",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByRole("button",{name:"Retry original action",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Retry original action",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByText(/Ticket status: Waiting/)).toBeVisible();
  w=await app.evaluate(()=>globalThis.frontTest.writes);assert.equal(w.length,3);assert.equal(w[1].key,w[2].key);assert.equal(w[1].body,w[2].body);assert.equal(w[2].replay,"true");
  let current=await backend("GET",`/opd-tickets/${t.ticket_id}`,ownToken);assert.equal(current.queue.token_no,t.queue.token_no);assert.equal(current.invoice.amount_paid,t.invoice.amount_paid);assert.equal(current.payment_status,"Paid");
  pass("real reactivate200 committed reply lost, deliberate SAME key/body replay returns original token with unchanged paid amount and no new payment");
  await page.getByRole("button",{name:"Defer slip",exact:true}).click();await reason.fill(j.run+" retained draft");
  await backend("POST",`/opd-tickets/${t.ticket_id}/defer`,ownToken,{reason:j.run+" second session change"});
  await expect(page.getByText("The slip changed while this dialog was open. Close it and review the current status before another action.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirm ticket action",exact:true})).toBeDisabled();
  await expect(reason).toHaveValue(j.run+" retained draft");
  page.once("dialog",d=>d.accept());await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  await expect(page.getByText(/Ticket status: Deferred/)).toBeVisible();
  const transport=await app.evaluate(()=>globalThis.frontTest);assert(transport.events.some(e=>e.event_type==="opd.queue.updated"));assert(transport.events.some(e=>e.event_type==="opd.ticket.status_changed"));assert.equal(transport.writes.length,3);j.transport=transport;save();
  await capture("queue_management");
  pass("second-session real events refresh selected slip/history, stale confirmation blocked without another write; EN/UR both themes250 screenshots, no clinical encounter/cash handover/approval");
  j.passed=true;save();

} catch (e) {
  j.error = e.stack;
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      await page.screenshot({ path: "artifacts/frontdesk-failure.png" });
    } catch {}
  if (app)
    try {
      j.transport = await app.evaluate(() => globalThis.frontTest);
    } catch {}
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if(ownToken)for(const entry of j.tickets){try{
    let t=await backend("GET",`/opd-tickets/${entry.id}`,ownToken);assert(t.patient_name.startsWith(j.run));
    if(t.status==="Waiting")await backend("POST",`/opd-tickets/${entry.id}/defer`,ownToken,{reason:j.run+" remove synthetic paid ticket from active queue"});
    t=await backend("GET",`/opd-tickets/${entry.id}`,ownToken);assert.equal(t.status,"Deferred");assert.equal(t.payment_status,"Paid");assert.equal(t.invoice.amount_paid,entry.amount_paid);entry.cleanup_confirmed=true;entry.final_status=t.status;entry.retained_paid_ledger=true;save();
  }catch(e){entry.cleanup_error=e.message;j.passed=false;save();process.exitCode=1}}
  if (app && original)
    try {
      await prefs(original);
      j.preferences_restored = true;
      save();
    } catch (e) {
      j.preferences_error = e.message;
      j.passed = false;
      save();
      process.exitCode = 1;
    }
  if (it && ownsFixture)
    try {
      await owned();
      await backend("POST", "/admin/users/34/active", it, {
        active: false,
        reason: j.run + " test cleanup",
      });
      j.account_deactivated = !(await owned()).is_active;
      save();
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

```
