// Real DEV, one owned zero-cash shift only. No payment, patient or physical cash claim.
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
const file = "artifacts/phase2-financial-cycle.json";

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
  if (fs.existsSync("artifacts/phase2-finance-cash-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/phase2-finance-cash-writes.json"),
    );
    assert(
      writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/phase2-finance-cash-writes.json",
      `artifacts/phase2-finance-cash-writes-${Date.now()}.json`,
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
          process.cwd() + "/artifacts/phase2-finance-cash-writes.json",
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
    const persist=()=>fs.writeFileSync('artifacts/phase2-finance-native.json',JSON.stringify(globalThis.financeTrace,null,2));
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
  if(!j.shift_id){  await nav('My cash shift');assert.equal(await native('GET','/finance/cash-shifts/mine'),null);await page.getByLabel('Opening float',{exact:true}).fill('0');stage('open drawer');await page.getByRole('button',{name:'Open cash shift',exact:true}).click();await expect(page.getByText(/Cash shift opened successfully/)).toBeVisible();j.shift_id=(await native('GET','/finance/cash-shifts/mine')).shift_id;done();}else{const shift=await native("GET","/finance/cash-shifts/mine");if(!j.shift_closed){assert.equal(shift?.shift_id,j.shift_id);assert.equal(shift.user_id,j.user_id);}else assert.equal(shift,null);}
  if(!j.refund_ticket){j.refund_ticket=await register('virtual full refund',true);save();}assert.equal(j.refund_ticket.payment.method,'Cash');const originalTicket=await native('GET','/opd-tickets/'+j.refund_ticket.ticket_id);assert.equal(originalTicket.patient_name,j.run+' virtual full refund');
  if(!j.queue_done){await openTicket(j.refund_ticket,'Queue management');
  await page.getByRole('button',{name:'Defer slip',exact:true}).click();await page.getByRole('dialog').getByLabel('Reason',{exact:true}).fill(j.run+' virtual patient briefly stepped out');stage('defer');await page.getByRole('dialog').getByRole('button',{name:'Confirm ticket action',exact:true}).click();await receipt('/opd-tickets/'+j.refund_ticket.ticket_id+'/defer');await expect.poll(async()=>(await native('GET','/opd-tickets/'+j.refund_ticket.ticket_id)).status).toBe('Deferred');done();
  await page.getByRole('button',{name:'Reactivate slip',exact:true}).click();stage('reactivate');await page.getByRole('dialog').getByRole('button',{name:'Confirm ticket action',exact:true}).click();await receipt('/opd-tickets/'+j.refund_ticket.ticket_id+'/reactivate');await expect.poll(async()=>(await native('GET','/opd-tickets/'+j.refund_ticket.ticket_id)).status).toBe('Waiting');done();
  j.queue_done=true;save();}pass('Own virtual cash-paid visit deferred/reactivated through UI without collecting again');
  if(!j.cash_refund){await openTicket(j.refund_ticket,'Refund / waiver / credit');await page.getByLabel('Request type',{exact:true}).selectOption('refund-request');await page.getByLabel('Reason',{exact:true}).fill(j.run+' FULL virtual refund, software simulation only; NO actual cash moved');await page.getByLabel('Refund reason',{exact:true}).selectOption('Other');await page.getByRole('button',{name:'Review request',exact:true}).click();stage('refund request');await page.getByRole('dialog').getByRole('button',{name:'Confirm request',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);j.refund_request=await receipt('/opd-tickets/'+j.refund_ticket.ticket_id+'/refund-request');done();
  const refundId=j.refund_request.result.data.approval.request_id;assert(refundId);await approve(refundId);
  const cashDialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Mandatory cash-back',exact:true})});await expect(cashDialog).toBeVisible();const due=await native('GET','/opd-tickets/'+j.refund_ticket.ticket_id);assert.equal(due.cash_back_prompts[0].amount,j.refund_ticket.net_payable);j.cash_before=due;save();
  await expect(cashDialog.getByRole('button',{name:'Confirm cash handed back',exact:true})).toBeDisabled();await cashDialog.getByRole('checkbox',{name:'I have verified the patient and handed over this exact cash amount.',exact:true}).check();stage('SIMULATED cash refund confirmation');await cashDialog.getByRole('button',{name:'Confirm cash handed back',exact:true}).click();await expect(cashDialog).toHaveCount(0);j.cash_refund=await receipt('/opd-tickets/'+j.refund_ticket.ticket_id+'/refund/confirm-dispensation');done();j.refunded=await native('GET','/opd-tickets/'+j.refund_ticket.ticket_id);assert.equal(j.refunded.cash_back_prompts.length,0);assert.equal((await native('GET','/finance/cash-shifts/mine')).expected_cash,0);
  }pass('Real refund request/eligible Owner API approval/blocking exact-amount modal/confirmation on OWN simulated drawer; full virtual sale+refund nets0, no actual physical money or human acceptance');
  if(!j.credit_ticket){j.credit_ticket=await register('virtual credit and settlement',false);save();}if(!j.credit_request){await openTicket(j.credit_ticket,'Refund / waiver / credit');await page.getByLabel('Request type',{exact:true}).selectOption('credit-request');await page.getByLabel('Reason',{exact:true}).fill(j.run+' synthetic credit followed by Card settlement; no real funds');await page.getByLabel('Amount paid now',{exact:true}).fill('0');await page.getByLabel('Payment method',{exact:true}).selectOption('Card');await page.getByRole('button',{name:'Review request',exact:true}).click();stage('credit request');await page.getByRole('dialog').getByRole('button',{name:'Confirm request',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);j.credit_request=await receipt('/opd-tickets/'+j.credit_ticket.ticket_id+'/credit-request');done();}await approve(j.credit_request.result.data.approval.request_id);
  if(!j.ar_settlement){const outstanding=await native('GET','/finance/ar/outstanding');j.ar=outstanding.find(a=>a.patient_id===j.credit_ticket.patient_id);assert(j.ar);save();
  await workspace('finance_cashier');await nav('Outstanding dues (Udhaar)');const row=page.getByRole('row').filter({hasText:j.credit_ticket.patient_name});await expect(row).toHaveCount(1);assert.equal(await row.getByRole('button',{name:'Write off',exact:true}).count(),0);await row.getByRole('button',{name:'Settle',exact:true}).click();const settle=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:/Settle Debt/})});await settle.getByLabel('Payment method',{exact:true}).selectOption('Card');await settle.getByLabel('Transaction reference #',{exact:true}).fill(j.run+' virtual Card settlement');stage('AR settlement');await settle.getByRole('button',{name:'Confirm settlement',exact:true}).click();await expect(settle.getByText('Settlement Completed',{exact:true})).toBeVisible();j.ar_settlement=await receipt('/finance/ar/'+j.ar.ar_id+'/settle');done();assert.equal(j.ar_settlement.result.data.receivable.status,'Settled');await settle.getByRole('button',{name:'Close',exact:true}).last().click();pass('Owned credit approved into actual AR; cashier UI settles by virtual Card, receipt and0balance confirmed; no write-off permission');}else{const invoice=await native('GET','/finance/invoices/'+j.credit_ticket.invoice.invoice_id);assert.equal(invoice.balance_due,0);assert.equal(invoice.credit_amount,invoice.net_payable);assert.equal(j.ar_settlement.result.data.receivable.status,'Settled');pass('Original Card AR settlement receipt and zero invoice balance confirmed; credit-authorised invoice history retained; no replacement settlement or payment');}
  if(!j.shift_closed){await nav('My cash shift');await page.getByRole('button',{name:'Refresh',exact:true}).click();const balance=await native('GET','/finance/cash-shifts/mine');assert.equal(balance.shift_id,j.shift_id);assert.equal(balance.expected_cash,0);assert.equal(balance.opening_float,0);await page.getByLabel('Counted cash in drawer',{exact:true}).fill('0');await page.getByRole('button',{name:'Close shift',exact:true}).click();stage('close zero drawer');await page.getByRole('dialog').getByRole('button',{name:'Confirm & Close Shift',exact:true}).click();await expect(page.getByText('Shift closed successfully. Pending collection by accountant.',{exact:true})).toBeVisible();j.closed_shift=await native('GET','/finance/cash-shifts/'+j.shift_id);assert.equal(j.closed_shift.status,'PendingCollection');j.shift_closed=true;done();}j.finance_trace=await reqs();j.passed=true;delete j.error;delete j.shift_cleanup_error;save();
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
  // Only a verified zero-value open shift owned by this fixture can be closed in cleanup.
  if (ownToken)
    try {
      const shift = await backend("GET", "/finance/cash-shifts/mine", ownToken);
      if (shift?.status === "Open") {
        assert.equal(shift.user_id, j.user_id);
        assert.equal(shift.opening_float, 0);
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
