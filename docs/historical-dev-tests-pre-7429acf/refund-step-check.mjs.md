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
const file = "artifacts/refund-step-check.json";
const readonly = process.argv.includes("--read-only");
const reconcileOnly=process.argv.includes("--reconcile-only");
let previous;
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  previous=prior;
  assert(
    reconcileOnly || prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.cleanup_confirmed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/refund-step-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/refund-step-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/refund-step-native-writes.json",
      `artifacts/refund-step-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = reconcileOnly ? previous : {
  run: "DEMO-REFUND-" + Date.now(),
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
      "artifacts/refund-step-profile-" + Date.now(),
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
    globalThis.frontTest={writes:[],reads:[],events:[],dropRefund:true,dropCredit:true};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/refund-step-native-writes.json",JSON.stringify(globalThis.frontTest.writes,null,2));persist();
    const load=process.getBuiltinModule("module").createRequire(process.cwd()+"/package.json"),WS=load("ws"),send=WS.prototype.send;
    WS.prototype.send=function(data,...rest){const m=JSON.parse(String(data));if(m.type==="auth")this.on("message",raw=>{const e=JSON.parse(String(raw));if(e.type==="event")globalThis.frontTest.events.push({event_type:e.event_type,event_id:e.event_id,ticket_id:e.payload?.ticket_id})});return send.call(this,data,...rest)};
    https.request=function(url,options,callback){
      const object=typeof url==="object" && !(url instanceof URL),u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url),method=(object?url.method:options?.method)||"GET";
      if(method==="GET" && /\/opd-(tickets|queues)\//.test(u.pathname))globalThis.frontTest.reads.push(u.pathname);
      if(method!=="POST" || !/\/opd-tickets\/\d+\/(refund-request|credit-request)$/.test(u.pathname))return original.call(this,url,options,callback);
      const a={path:u.pathname,key:options?.headers?.["Idempotency-Key"],body:"",finished:false};globalThis.frontTest.writes.push(a);persist();
      const req=original.call(this,url,options,response=>{a.status=response.statusCode;a.replay=response.headers["idempotent-replay"];let chunks=[];response.on("data",c=>chunks.push(Buffer.from(c)));const emit=response.emit.bind(response);response.emit=function(event,...args){if(event==="end"){try{a.result=JSON.parse(Buffer.concat(chunks).toString()).data}catch{}a.finished=true;persist();const flag=a.path.endsWith("/refund-request")?"dropRefund":"dropCredit";if(globalThis.frontTest[flag] && a.status===201){globalThis.frontTest[flag]=false;response.destroy(new Error("TEST lost real committed queue reply"));return true}}return emit(event,...args)};callback(response)});
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


  if(!reconcileOnly){
  await nav("Refund / waiver / credit");
  const paid=await backend("GET","/opd-tickets/11",ownToken);
  assert.equal(paid.patient_name,"DEMO-QUEUE-1792728679614");assert.equal(paid.patient_id,15);assert.equal(paid.invoice.amount_paid,1500);assert.equal(paid.approval_lock,"None");assert.equal(paid.status,"Deferred");
  j.tickets.push({id:11,number:paid.ticket_number,patient_id:15,origin:"owned prior queue fixture",amount_paid:1500,cleanup_confirmed:false});save();
  await backend("POST","/opd-tickets/11/reactivate",ownToken,undefined,crypto.randomUUID());
  await scan(paid.ticket_number);
  const type=page.getByLabel("Request type",{exact:true}),reason=page.getByLabel("Reason",{exact:true});
  await type.selectOption("refund-request");await reason.fill(j.run+" partial refund");
  await page.getByLabel("Refund amount",{exact:true}).fill("1501");await expect(page.getByRole("button",{name:"Review request",exact:true})).toBeDisabled();
  await page.getByLabel("Refund amount",{exact:true}).fill("100");await help("Refund / waiver / credit requests",reason);
  await page.getByRole("button",{name:"Review request",exact:true}).click();
  await backend("POST","/opd-tickets/11/defer",ownToken,{reason:j.run+" second session review change"});
  await expect(page.getByText("The slip changed during request review. Go back and review the current balance and status before submitting.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirm request",exact:true})).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText(j.run+" partial refund");
  await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  await expect(reason).toHaveValue(j.run+" partial refund");
  await backend("POST","/opd-tickets/11/reactivate",ownToken,undefined,crypto.randomUUID());
  await expect(page.getByText(/Ticket status: Waiting/)).toBeVisible();
  await page.getByRole("button",{name:"Review request",exact:true}).click();
  await page.getByRole("button",{name:"Confirm request",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByRole("button",{name:"Retry original action",exact:true})).toBeVisible();
  let current=await backend("GET","/opd-tickets/11",ownToken);assert.equal(current.approval_lock,"RefundPending");assert.equal(current.invoice.amount_paid,1500);assert.equal(current.invoice.amount_refunded,0);
  let rows=await backend("GET","/approvals?mine=true&limit=100",ownToken),pending=rows.filter(a=>a.status==="Pending" && a.payload_jsonb?.ticket_id===11);assert.equal(pending.length,1);j.requests.push({id:pending[0].request_id,ticket_id:11,cleanup_pending:true});save();
  const doctorRows=await backend("GET",`/opd-queues/by-doctor/${paid.doctor_id}`,ownToken);assert(!doctorRows.some(q=>q.ticket_id===11));
  await page.getByRole("button",{name:"Retry original action",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByText(/The ticket is locked and is off the doctor's queue/)).toBeVisible();
  await expect(page.getByText("Saved on the server. Refresh errors do not undo this action.",{exact:true})).toBeVisible();
  let writes=await app.evaluate(()=>globalThis.frontTest.writes);assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.equal(writes[0].body,writes[1].body);assert.equal(writes[1].replay,"true");
  pass("real paid ticket partial refund201 lost reply: one own pending approval, no money returned, same-key/body replay once; approval lock visibly off real doctor queue; second-session change blocks original review and preserves draft/F1");
  await cancelRequests(current);
  await expect(page.getByLabel("Request type",{exact:true})).toBeVisible();
  current=await backend("GET","/opd-tickets/11",ownToken);assert.equal(current.approval_lock,"None");assert.equal(current.invoice.amount_refunded,0);assert.equal(current.invoice.amount_paid,1500);
  const catalog=await backend("GET","/finance/service-catalog?category=OPD",ownToken);const service=catalog.find(s=>s.is_active && s.doctor_id);assert(service);
  const credit=await backend("POST","/reception/registrations",ownToken,{new_patient:{full_name:j.run+" credit",gender:"unknown",age_years:30,mobile:"00000000000"},service_id:service.service_id,doctor_id:service.doctor_id,department_id:service.department_id},crypto.randomUUID());
  j.tickets.push({id:credit.ticket_id,number:credit.ticket_number,patient_id:credit.patient_id,origin:"new credit",amount_paid:50,cleanup_confirmed:false});save();
  await scan(credit.ticket_number);await type.selectOption("credit-request");await reason.fill(j.run+" nonzero paid-now credit");await page.getByLabel("Amount paid now",{exact:true}).fill("50");await page.getByLabel("Payment method",{exact:true}).selectOption("Card");await page.getByLabel("Due date (optional)",{exact:true}).fill("2026-10-30");
  await page.getByRole("button",{name:"Review request",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("50");await expect(page.getByRole("dialog")).toContainText("Card");
  await page.getByRole("button",{name:"Confirm request",exact:true}).evaluate(b=>{b.click();b.click()});await expect(page.getByRole("button",{name:"Retry original action",exact:true})).toBeVisible();
  current=await backend("GET",`/opd-tickets/${credit.ticket_id}`,ownToken);assert.equal(current.invoice.amount_paid,50);assert.equal(current.approval_lock,"CreditPending");
  rows=await backend("GET","/approvals?mine=true&limit=100",ownToken);pending=rows.filter(a=>a.status==="Pending" && a.payload_jsonb?.ticket_id===credit.ticket_id);assert.equal(pending.length,1);j.requests.push({id:pending[0].request_id,ticket_id:credit.ticket_id,cleanup_pending:true});save();
  await page.getByRole("button",{name:"Retry original action",exact:true}).evaluate(b=>{b.click();b.click()});await expect(page.getByText(/The ticket is locked and is off the doctor's queue/)).toBeVisible();
  current=await backend("GET",`/opd-tickets/${credit.ticket_id}`,ownToken);assert.equal(current.invoice.amount_paid,50);assert.equal(current.approval_lock,"CreditPending");
  await expect(page.getByText("Saved on the server. Refresh errors do not undo this action.",{exact:true})).toBeVisible();
  writes=await app.evaluate(()=>globalThis.frontTest.writes);assert.equal(writes.length,4);assert.equal(writes[2].key,writes[3].key);assert.equal(writes[2].body,writes[3].body);assert.equal(writes[3].replay,"true");
  await capture("refund_waiver_credit");
  pass("real nonzero credit201 records Card50 immediately; committed lost reply same-key/body replay remains50, no duplicate collection; pending lock, due-date/method snapshot and EN/UR both themes250");
  await cancelRequests(current);await expect(page.getByLabel("Request type",{exact:true})).toBeVisible();current=await backend("GET",`/opd-tickets/${credit.ticket_id}`,ownToken);assert.equal(current.approval_lock,"None");assert.equal(current.invoice.amount_paid,50);
  j.transport=await app.evaluate(()=>globalThis.frontTest);assert(j.transport.events.some(e=>e.event_type==="approval.resolved"));save();
  pass("own refund/credit approval requests cancelled with real event refresh/unlock; existing1500 and newly collected50 retained, no approval decision/refund/cash handover");
  j.passed=true;save();
  }

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
    let t=await backend("GET",`/opd-tickets/${entry.id}`,ownToken);assert(entry.id===11?t.patient_name==="DEMO-QUEUE-1792728679614":t.patient_name.startsWith(j.run));
    await cancelRequests(t);
    const approvalRows=await backend("GET","/approvals?mine=true&limit=100",ownToken);
    assert(!approvalRows.some(a=>a.status==="Pending" && a.payload_jsonb?.ticket_id===entry.id));
    for(const r of j.requests.filter(r=>r.ticket_id===entry.id)){const actual=await backend("GET",`/approvals/${r.id}`,ownToken);assert(actual && actual.status==="Cancelled");r.cleanup_pending=false;r.final_status=actual.status}
    t=await backend("GET",`/opd-tickets/${entry.id}`,ownToken);
    if(t.status==="Waiting")await backend("POST",`/opd-tickets/${entry.id}/defer`,ownToken,{reason:j.run+" synthetic test cleanup"});
    t=await backend("GET",`/opd-tickets/${entry.id}`,ownToken);assert.equal(t.approval_lock,"None");assert.equal(t.invoice.amount_refunded,0);assert(["Deferred","Issued"].includes(t.status));
    entry.final_amount_paid=t.invoice.amount_paid;entry.final_status=t.status;entry.cleanup_confirmed=true;delete entry.cleanup_error;entry.retained_paid_ledger=t.invoice.amount_paid>0;save();
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
