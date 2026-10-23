// Real DEV: prepares one synthetic Card-paid registration/refund and a separate-actor
// approval, retaining an UNDISPENSED refund for human testing. --resume reuses it.
// Never ticks physical handover or sends confirm-dispensation; restores owned34.
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
const file = "artifacts/cashback-step-check.json";
const readonly = process.argv.includes("--read-only");
const resume=process.argv.includes("--resume");
let previous;
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  previous=prior;assert(resume,"Approved cash-back fixture may still be pending: use --resume after reconciling original IDs, never create another one");
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/cashback-step-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/cashback-step-native-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/cashback-step-native-writes.json",
      `artifacts/cashback-step-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = resume ? previous : {
  run: "DEMO-CASHBACK-" + Date.now(),
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
      "artifacts/cashback-step-profile-" + Date.now(),
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
  await app.evaluate(()=>{
    const https=process.getBuiltinModule("https"),original=https.request,load=process.getBuiltinModule("module").createRequire(process.cwd()+"/package.json"),WS=load("ws"),send=WS.prototype.send,fs=process.getBuiltinModule("fs");
    globalThis.frontTest={writes:[],reads:[],events:[]};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/cashback-step-native-writes.json",JSON.stringify(globalThis.frontTest.writes,null,2));persist();
    WS.prototype.send=function(data,...rest){const m=JSON.parse(String(data));if(m.type==="auth")this.on("message",raw=>{const e=JSON.parse(String(raw));if(e.type==="event")globalThis.frontTest.events.push({event_type:e.event_type,event_id:e.event_id,ticket_id:e.payload?.ticket_id,disbursement_id:e.payload?.disbursement_id,amount:e.payload?.amount})});return send.call(this,data,...rest)};
    https.request=function(url,options,callback){const object=typeof url==="object" && !(url instanceof URL),u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url),method=(object?url.method:options?.method)||"GET";if(method==="GET")globalThis.frontTest.reads.push(u.pathname);if(method==="POST" && u.pathname.endsWith("/confirm-dispensation")){globalThis.frontTest.writes.push({path:u.pathname,key:options?.headers?.["Idempotency-Key"]});persist()}return original.call(this,url,options,callback)};
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

  await nav("Cash-back");
  assert((await state()).user.permissions.includes("opd.cash_back.dispense"));
  if(!resume){
    const catalog=await backend("GET","/finance/service-catalog?category=OPD",ownToken),service=catalog.find(s=>s.is_active && s.doctor_id);assert(service);
    const t=await backend("POST","/reception/registrations",ownToken,{new_patient:{full_name:j.run,gender:"unknown",age_years:30,mobile:"00000000000"},service_id:service.service_id,doctor_id:service.doctor_id,department_id:service.department_id,payment:{method:"Card",reference_no:j.run}},crypto.randomUUID());
    j.fixture={ticket_id:t.ticket_id,ticket_number:t.ticket_number,patient_id:t.patient_id,mrn:t.mrn,amount_paid:t.invoice.amount_paid,payment_id:t.payment?.payment_id};save();
    await scan(t.ticket_number);
    await expect(page.getByText("No cash-back is pending for this slip.",{exact:true})).toBeVisible();
    const refund=await backend("POST",`/opd-tickets/${t.ticket_id}/refund-request`,ownToken,{reason_code:"Other",note:j.run+" synthetic cash-back UI fixture only; human handover pending",amount:"10"},crypto.randomUUID());
    j.fixture.refund_request_id=refund.refund_request_id;j.fixture.approval_id=refund.approval.request_id;save();
    const owner=(await backend("POST","/auth/login",null,{username:"demo.owner",password:"Demo-pass-2026"})).access_token;
    const ownerMe=await backend("GET","/auth/me",owner),approval=await backend("GET",`/approvals/${j.fixture.approval_id}`,owner);assert.equal(approval.requester_id,34);assert.notEqual(ownerMe.user_id,34);assert.equal(approval.can_decide,true);
    await backend("POST",`/approvals/${j.fixture.approval_id}/approve`,owner,{note:j.run+" DEV synthetic UI test fixture; no physical cash handover performed"});
    const confirmed=await backend("GET",`/approvals/${j.fixture.approval_id}`,owner);assert.equal(confirmed.status,"Approved");j.fixture.approval_status=confirmed.status;save();
  }else{assert(j.fixture?.ticket_id);await scan(j.fixture.ticket_number)}
  const t=await backend("GET",`/opd-tickets/${j.fixture.ticket_id}`,ownToken);assert(t.patient_name.startsWith("DEMO-CASHBACK-"));assert.equal(t.cash_back_prompts.length,1);const p=t.cash_back_prompts[0];assert.equal(p.kind,"Refund");assert.equal(p.amount,10);j.fixture.prompt={kind:p.kind,id:p.id,amount:p.amount};save();
  const modal=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Mandatory cash-back",exact:true})});await expect(modal).toBeVisible();await expect(modal).toContainText(j.fixture.ticket_number);await expect(modal).toContainText("10");
  if(!resume)await expect.poll(()=>app.evaluate((_electron,id)=>globalThis.frontTest.events.some(e=>e.event_type==="refund.ready" && e.ticket_id===id),j.fixture.ticket_id)).toBe(true);
  const handed=modal.getByRole("checkbox",{name:"I have verified the patient and handed over this exact cash amount.",exact:true});await expect(handed).not.toBeChecked();await expect(handed).toBeDisabled();await expect(modal.getByRole("button",{name:"Confirm cash handed back",exact:true})).toBeDisabled();
  await expect(modal.getByText("Before handing over cash, open your own shift at this terminal's assigned counter, then refresh the slip. Do not hand over cash while the drawer check is unavailable.",{exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await expect(modal).toBeVisible();await expect(modal.getByRole("button",{name:"Close",exact:true})).toHaveCount(0);
  await help("Mandatory cash-back",modal.getByRole("button",{name:"Refresh slip",exact:true}));
  pass("real separate-actor approved synthetic refund10 emits refund.ready and blocks selected slip in exact pending modal; no own open drawer means disabled unchecked handover/confirm; Escape cannot dismiss, contextual F1 preserves pending state");
  await modal.getByRole("button",{name:"Sign out; leave cash-back pending",exact:true}).click();await expect(page.getByLabel("Username",{exact:true})).toBeVisible();
  const before=await backend("GET",`/opd-tickets/${j.fixture.ticket_id}`,ownToken);assert.equal(before.cash_back_prompts[0].id,p.id);assert.equal(before.cash_back_prompts[0].amount,10);
  await page.getByLabel("Username",{exact:true}).fill("codex.foundation.1792584106665");await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in →",exact:true}).click();await page.getByRole("navigation").waitFor();await nav("Cash-back");await scan(j.fixture.ticket_number);await expect(modal).toBeVisible();await expect(handed).not.toBeChecked();
  await capture("cash_back_prompts");
  j.transport=await app.evaluate(()=>globalThis.frontTest);assert.equal(j.transport.writes.length,0);assert(j.transport.reads.includes("/api/v1/finance/cash-shifts/mine"));assert(j.transport.reads.includes("/api/v1/terminals/whoami"));j.confirm_posts=0;save();
  pass("real sign-out/re-login preserves original pending refund and unchecked handover; EN/UR both themes250 captures, live drawer reads, ZERO confirm-dispensation POSTs or physical-cash claims");
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
  if(ownToken && j.fixture?.ticket_id){try{
    const t=await backend("GET",`/opd-tickets/${j.fixture.ticket_id}`,ownToken);assert(t.patient_name.startsWith("DEMO-CASHBACK-"));
    j.fixture.final_ticket_status=t.status;j.fixture.final_amount_paid=t.invoice.amount_paid;j.fixture.final_amount_refunded=t.invoice.amount_refunded;j.fixture.pending_prompts=t.cash_back_prompts.map(p=>({kind:p.kind,id:p.id,amount:p.amount}));
    j.fixture.retained_for_human=true;save();
  }catch(e){j.fixture.readback_error=e.message;j.passed=false;save();process.exitCode=1}}
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
