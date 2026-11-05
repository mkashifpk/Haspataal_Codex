# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV synthetic postconsult waiver and isolated virtual cash drawer. No actual funds/care/human acceptance.
import { _electron as electron } from "playwright";
import { expect as baseExpect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {session,help,capture} from './clinical-test-kit.mjs';
let d;
import { createRequire } from "node:module";
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const expect = baseExpect.configure({ timeout: 45000 });
const config = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
const file = "artifacts/phase2-clinical-refund.json";

const resume=process.argv.includes("--resume");
if (fs.existsSync(file) && !resume) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      (!prior.terminal_id || prior.terminal_deactivated) &&
      prior.attempts.every((a) => a.finished) &&
      (!prior.shift_id || prior.shift_closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/phase2-clinical-refund-native-cash-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/phase2-clinical-refund-native-cash-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/phase2-clinical-refund-native-cash-writes.json",
      `artifacts/phase2-clinical-refund-native-cash-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = resume ? JSON.parse(fs.readFileSync(file)) : {
  run: "DEMO-FINANCIAL-" + Date.now(),
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
let temporary;
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
  if(resume){
    const u=await owned();assert.equal(u.is_active,false);assert(!j.pending,"Reconcile pending action first");
    const ts=await backend("GET","/admin/terminals",it),t=ts.find(t=>t.terminal_id===j.terminal_id);assert.equal(t?.location_label,j.terminal_body.location_label);assert.equal(t.is_active,false);assert.equal(t.mac.toLowerCase().replaceAll("-",":"),j.terminal_body.mac.toLowerCase());
    await backend("POST","/admin/users/"+j.user_id+"/active",it,{active:true,reason:j.run+" resume owned financial test"});ownsFixture=true;j.account_deactivated=false;save();temporary=(await backend("POST","/admin/users/"+j.user_id+"/reset-password",it)).temporary_password;
  }else{
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
      role_codes: ["receptionist", "cashier"],
    },
    j.run + "-provision",
  );
  j.user_id = provisioned.user_id;
  save();
  temporary = provisioned.temporary_password;
  ownsFixture = true;
  }
  let terminalMac;
  if(resume){terminalMac=j.terminal_body.mac;await backend("PUT","/admin/terminals/"+j.terminal_id,it,j.terminal_body);j.terminal_deactivated=false;save();}else{
  terminalMac =
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
  }
  await app.evaluate(
    (_electron, { terminalMac }) => {
      const https = process.getBuiltinModule("https"),
        original = https.request,
        fs = process.getBuiltinModule("fs");
      globalThis.cashTest = { writes: [], dropOpen: false, dropClose: false };
      const persist = () =>
        fs.writeFileSync(
          process.cwd() + "/artifacts/phase2-clinical-refund-native-cash-writes.json",
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

  const workspace=async code=>{await nav('Workspaces');const w=(await state()).user.workspaces.find(x=>x.code===code);assert(w);await page.locator('.workspace-card').filter({has:page.getByRole('heading',{name:w.label,exact:true})}).getByRole('button',{name:'Open workspace →',exact:true}).click();await expect(page.locator('.header-context')).toContainText(w.label);};
  await workspace('reception');
  await app.evaluate(()=>{
    const https=process.getBuiltinModule('https'),original=https.request,fs=process.getBuiltinModule('fs');globalThis.financeTrace=[];
    const persist=()=>fs.writeFileSync('artifacts/phase2-clinical-refund-native-native.json',JSON.stringify(globalThis.financeTrace,null,2));
    https.request=function(url,opts,callback){const obj=typeof url==='object'&&!(url instanceof URL),u=obj?new URL('https://'+(url.hostname||url.host)+':'+(url.port||443)+(url.path||'/')):new URL(url);const method=(obj?url.method:opts?.method)||'GET';if(!u.pathname.includes('/api/v1/')||/\/(auth|settings|admin|hr)\//.test(u.pathname))return original.call(this,url,opts,callback);const a={method,path:u.pathname+u.search,started:Date.now(),finished:false};globalThis.financeTrace.push(a);persist();const req=original.call(this,url,opts,res=>{const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{a.status=res.statusCode;a.finished=true;try{a.result=JSON.parse(Buffer.concat(chunks).toString())}catch{}persist();});callback(res);});req.on('error',e=>{a.network_error=e.message;persist();});if(method!=='GET'){const data=[],write=req.write.bind(req),end=req.end.bind(req);req.write=function(c,...rest){if(c)data.push(Buffer.from(c));return write(c,...rest)};req.end=function(c,...rest){if(c&&typeof c!=='function')data.push(Buffer.from(c));try{a.body=JSON.parse(Buffer.concat(data).toString())}catch{}a.key=req.getHeader('Idempotency-Key');persist();return end(c,...rest)}}return req;};
  });
  const reqs=()=>app.evaluate(()=>globalThis.financeTrace);
  const receipt=async route=>{await expect.poll(async()=>(await reqs()).some(x=>x.method==='POST'&&x.path==='/api/v1'+route&&[200,201].includes(x.status))).toBe(true);return (await reqs()).filter(x=>x.method==='POST'&&x.path==='/api/v1'+route&&[200,201].includes(x.status)).at(-1)};
  const stage=value=>{j.pending=value;save();};const done=()=>{delete j.pending;save();};
  const openTicket=async(ticket,screen)=>{await nav(screen);await page.getByLabel('OPD slip number',{exact:true}).fill(ticket.ticket_number);await page.getByRole('button',{name:'Open slip',exact:true}).click();await expect(page.locator('main')).toContainText(ticket.mrn);};
  const register=async(suffix,pay)=>{
    await nav('New registration + OPD slip');await page.getByLabel('Full name',{exact:true}).fill(j.run+' '+suffix);await page.getByLabel('Age in years',{exact:true}).fill('35');await page.getByLabel('Mobile',{exact:true}).fill('03000000000');const services=await native('GET','/finance/service-catalog?category=OPD');const service=services.find(s=>s.is_active&&s.doctor_name==='Dr. Ahmed Khan');assert(service);await page.getByLabel('OPD service',{exact:true}).selectOption(String(service.service_id));if(pay)await page.getByLabel('Collect full payment now',{exact:true}).check();stage('register '+suffix);await page.getByRole('button',{name:pay?'Register and collect payment':'Issue unpaid OPD slip',exact:true}).click();await expect(page.getByRole('heading',{name:'OPD slip issued',exact:true})).toBeVisible();const r=await receipt('/reception/registrations');j.registrations=j.registrations||[];j.registrations.push(r);done();assert.equal(r.result.data.patient_name,j.run+' '+suffix);return r.result.data;
  };
  const ownerPair=await backend('POST','/auth/login',null,{username:'demo.owner',password:'Demo-pass-2026'}),owner=ownerPair.access_token;
  const approve=async id=>{const a=await backend('GET','/approvals/'+id,owner);if(a.status==='Approved'){return;}assert.equal(a.status,'Pending');assert.equal(a.can_decide,true);stage('approve '+id);await backend('POST','/approvals/'+id+'/approve',owner,{note:j.run+' owned synthetic software transaction only; no actual funds'});const read=await backend('GET','/approvals/'+id,owner);assert.equal(read.status,'Approved');j.approvals=j.approvals||[];j.approvals.push(read);done();};
  if(!j.shift_id){  await nav('My cash shift');assert.equal(await native('GET','/finance/cash-shifts/mine'),null);await page.getByLabel('Opening float',{exact:true}).fill('1500');stage('open drawer');await page.getByRole('button',{name:'Open cash shift',exact:true}).click();await expect(page.getByText(/Cash shift opened successfully/)).toBeVisible();j.shift_id=(await native('GET','/finance/cash-shifts/mine')).shift_id;done();}else{const shift=await native("GET","/finance/cash-shifts/mine");if(!j.shift_closed){assert.equal(shift?.shift_id,j.shift_id);assert.equal(shift.user_id,j.user_id);}else assert.equal(shift,null);}
  if(!j.refund_ticket){j.refund_ticket=await native('GET','/opd-tickets/2');assert.equal(j.refund_ticket.patient_name,'DEMO-P2-CYCLE-1792854112893');assert.equal(j.refund_ticket.patient_id,13);assert(j.refund_ticket.examined_at);assert.equal(j.refund_ticket.invoice.amount_paid,1500);save();}
  const ticket=j.refund_ticket;
  d=await session('clinical-refund-doctor','demo.doctor');const p=d.p;
  await d.nav('Consultation (EMR)');await p.getByLabel('OPD slip number',{exact:true}).fill(ticket.ticket_number);await p.getByLabel('OPD slip number',{exact:true}).press('Enter');await expect(p.locator('main')).toContainText(ticket.mrn);await p.evaluate(()=>{window.refundLockEvents=[];window.terminal.subscribe(e=>{if(e.type==='event')window.refundLockEvents.push(e);});});
  if(!j.refund_request){
    await openTicket(ticket,'Refund / waiver / credit');await expect(page.getByText('Clinical activity is recorded. A refund needs elevated approval and is risk-flagged. Ask the authorized doctor about a post-consult waiver after a finalized note.',{exact:true})).toBeVisible();
    await page.getByLabel('Request type',{exact:true}).selectOption('refund-request');await page.getByLabel('Reason',{exact:true}).fill(j.run+' software-only elevated refund; NO actual funds/care');await page.getByLabel('Refund reason',{exact:true}).selectOption('Other');await page.getByRole('button',{name:'Review request',exact:true}).click();stage('post-clinical refund request');await page.getByRole('dialog').getByRole('button',{name:'Confirm request',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);j.refund_request=await receipt('/opd-tickets/'+ticket.ticket_id+'/refund-request');done();
  }
  const requestId=j.refund_request.result.data.approval.request_id;
  if(!j.cash_refund){
    const approval=await backend('GET','/approvals/'+requestId,owner);assert(approval.is_elevated);assert(approval.required_permission.includes('elevated'));assert(approval.can_decide);j.elevated=approval;save();
    const accountant=(await backend('POST','/auth/login',null,{username:'demo.accountant',password:'Demo-pass-2026'})).access_token;try{const ordinary=await backend('GET','/approvals/'+requestId,accountant);assert.equal(ordinary.can_decide,false);j.ordinary_approver={user:'demo.accountant',can_decide:ordinary.can_decide,blocked:ordinary.decide_blocked};}catch(e){assert(String(e.message).includes('403 FORBIDDEN'));j.ordinary_approver={user:'demo.accountant',detail_read_denied:403,reason:'Unrelated ordinary approver cannot even read this elevated request'};}save();
    await openTicket(ticket,'Cash-back');await approve(requestId);
    const modal=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Mandatory cash-back',exact:true})});await expect(modal).toBeVisible();await expect(modal).toContainText('1500');
    const locked=await native('GET','/opd-tickets/'+ticket.ticket_id);assert(locked.is_clinical_locked);assert.equal(locked.status,'Refunded');j.locked=locked;save();
    await expect(p.getByLabel('Chief complaint',{exact:true})).toBeDisabled();await expect(p.locator('main')).toContainText(locked.clinical_lock_reason);j.events=await p.evaluate(()=>window.refundLockEvents);assert(j.events.some(e=>e.event_type==='ticket.clinical_lockout'&&e.payload.ticket_id===ticket.ticket_id));save();
    const refusal=await p.evaluate(v=>window.terminal.call('api',v),{method:'POST',path:'/clinical-encounters',body:{ticket_id:ticket.ticket_id,encounter_type:'OPD',chief_complaint:j.run+' refused test draft, NO care',finalize:false},key:crypto.randomUUID()});assert.equal(refusal.ok,false);assert.equal(refusal.error.code,'CLINICAL_LOCKOUT');j.refused_note=refusal.error;save();
    await modal.getByLabel('I have verified the patient and handed over this exact cash amount.',{exact:true}).check();stage('virtual elevated refund cashout');await modal.getByRole('button',{name:'Confirm cash handed back',exact:true}).click();await expect(modal).toHaveCount(0);j.cash_refund=await receipt('/opd-tickets/'+ticket.ticket_id+'/refund/confirm-dispensation');done();j.final_ticket=await native('GET','/opd-tickets/'+ticket.ticket_id);assert.equal(j.final_ticket.cash_back_prompts.length,0);save();
  }
  await p.evaluate(()=>scrollTo(0,0));await capture(d,'consultation');j.doctor_trace=await d.trace();d.j.passed=true;await d.close();d=undefined;
  pass('Post-clinical refund warns/suggests waiver; actual elevated permission and ordinary approver denied; Owner approval -> live clinical_lockout/verbatim reason/disabled editing, real new note409CLINICAL_LOCKOUT; own virtual opening1500/cashout1500 net0, notes retained, no actual care/funds/human handover');
  if(!j.shift_closed){await nav('My cash shift');await page.getByRole('button',{name:'Refresh',exact:true}).click();const balance=await native('GET','/finance/cash-shifts/mine');assert.equal(balance.shift_id,j.shift_id);assert.equal(balance.expected_cash,0);assert.equal(balance.opening_float,1500);await page.getByLabel('Counted cash in drawer',{exact:true}).fill('0');await page.getByRole('button',{name:'Close shift',exact:true}).click();stage('close zero drawer');await page.getByRole('dialog').getByRole('button',{name:'Confirm & Close Shift',exact:true}).click();await expect(page.getByText('Shift closed successfully. Pending collection by accountant.',{exact:true})).toBeVisible();j.closed_shift=await native('GET','/finance/cash-shifts/'+j.shift_id);assert.equal(j.closed_shift.status,'PendingCollection');j.shift_closed=true;done();}j.finance_trace=await reqs();j.passed=true;delete j.error;delete j.shift_cleanup_error;save();
} catch (e) {
  j.error = e.stack;
  if(app)try{j.finance_trace=await app.evaluate(()=>globalThis.financeTrace)}catch{}
  save();
  console.error(e.stack);
  process.exitCode = 1;
  if (page)
    try {
      j.failure_ui = await page.locator("body").innerText();
      await page.screenshot({ path: "artifacts/cash-shift-failure.png" });
    } catch {}
} finally {
  if(d)await d.close();
  // Only a verified zero-value open shift owned by this fixture can be closed in cleanup.
  if (ownToken)
    try {
      const shift = await backend("GET", "/finance/cash-shifts/mine", ownToken);
      if (shift?.status === "Open") {
        assert.equal(shift.user_id, j.user_id);
        assert.equal(shift.opening_float, 1500);
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

```
