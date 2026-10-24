// Real DEV: at most one synthetic Card10 collection on VERIFIED patient16 invoice. No physical cash/external processor.
// Journals all original keys/results; restores exact owned34 roles/preferences/inactive state.
// Reuses retained synthetic financial fixture; never creates patients, AR approvals or cash handover.
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
const file = "artifacts/receivables-safety-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/receivables-safety-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/receivables-safety-native-writes.json"),
    );
    assert(
      (writes.writes || []).every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/receivables-safety-native-writes.json",
      `artifacts/receivables-safety-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-AR-SAFETY-" + Date.now(),
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
  password,
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
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/receivables-safety-profile-" + Date.now(),
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
  j.original_roles=(await owned()).roles.map(r=>typeof r === "string"?r:r.code); save();
  assert(j.original_roles.length && j.original_roles.every(Boolean));
  ownsFixture = true;
  await backend("PUT", "/admin/users/34/roles", it, { role_codes: ["cashier"] });
  await backend("POST", "/admin/users/34/active", it, {
    active: true,
    reason: j.run + " isolated screen tests",
  });
  const temporary = (
    await backend("POST", "/admin/users/34/reset-password", it)
  ).temporary_password;
  assert(temporary);
  await page
    .getByLabel("Username", { exact: true })
    .fill("codex.foundation.1792584106665");
  await page.getByLabel("Password", { exact: true }).fill(temporary);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page
    .getByRole("heading", { name: "Change your password", exact: true })
    .waitFor();
  password = "Demo!" + crypto.randomBytes(16).toString("hex") + "A9";
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
  original = (await state()).prefs; j.original_preferences=original;save();
  await prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  ownToken = (
    await backend("POST", "/auth/login", null, {
      username: "codex.foundation.1792584106665",
      password,
    })
  ).access_token;
  j.renderer = await page.locator('script[type="module"]').getAttribute("src");
  save();






  await expect.poll(()=>state().then(s=>s.workspace)).toBe("finance_cashier");
  const invs=await backend("GET","/finance/invoices?patient_id=16&limit=10",ownToken);
  const target=invs.find(x=>x.patient_id===16 && x.ticket_id===12);assert(target,"Only the verified synthetic patient16/ticket12 fixture is allowed");
  const before=await backend("GET",`/finance/invoices/${target.invoice_id}`,ownToken);
  assert.equal(before.patient_id,16);assert.equal(before.ticket_id,12);assert(!before.is_locked);assert(before.balance_due>=10);assert.equal(before.status,"PartiallyPaid");
  j.invoice_before=before;save();
  await app.evaluate(()=>{
    const https=process.getBuiltinModule("https"),original=https.request,fs=process.getBuiltinModule("fs");
    globalThis.arSafety={writes:[],dropNext:true};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/receivables-safety-native-writes.json",JSON.stringify(globalThis.arSafety,null,2));persist();
    https.request=function(url,options,callback){
      const object=typeof url==="object" && !(url instanceof URL),u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url),method=(object?url.method:options?.method)||"GET";
      if(method!=="POST" || !/\/finance\/(ar\/\d+\/(settle|write-off)|invoices\/\d+\/payments)$/.test(u.pathname))return original.call(this,url,options,callback);
      const a={path:u.pathname,key:options?.headers?.["Idempotency-Key"],body:"",finished:false};globalThis.arSafety.writes.push(a);persist();
      const req=original.call(this,url,options,response=>{
        a.status=response.statusCode;a.replay=response.headers["idempotent-replay"];const chunks=[];response.on("data",c=>chunks.push(Buffer.from(c)));
        const emit=response.emit.bind(response);response.emit=function(event,...args){
          if(event==="end"){
            try{const o=JSON.parse(Buffer.concat(chunks).toString());a.result=o.data;a.error=o.error;a.request_id=o.request_id}catch{}a.finished=true;persist();
            if(globalThis.arSafety.dropNext){globalThis.arSafety.dropNext=false;response.destroy(new Error("TEST lost actual financial response"));return true;}
          }
          return emit(event,...args);
        };callback(response);
      });
      const write=req.write.bind(req);req.write=function(chunk,...rest){a.body+=Buffer.isBuffer(chunk)?chunk.toString():String(chunk);persist();return write(chunk,...rest)};return req;
    };
  });
  await nav("Outstanding dues");
  await page.getByRole("button",{name:"Invoices & direct payments",exact:true}).click();
  const row=page.getByRole("table",{name:"Invoices",exact:true}).getByRole("row").filter({has:page.getByRole("button",{name:target.invoice_no,exact:true})});
  if (!readonly) {
  await row.getByRole("button",{name:"Collect payment",exact:true}).click();
  const modal=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:`Collect Payment — ${target.invoice_no}`,exact:true})});
  await expect(modal).toBeVisible();
  const amount=modal.getByLabel("Amount to collect",{exact:true}),method=modal.getByLabel("Payment method",{exact:true}),confirm=modal.getByRole("button",{name:"Confirm payment",exact:true});
  await amount.fill("1e1");await confirm.click();await expect(modal.getByRole("alert")).toContainText("complete positive amount");assert.equal((await app.evaluate(()=>globalThis.arSafety.writes)).length,0);
  await amount.fill("10");await confirm.click();
  await expect(modal.getByRole("alert")).toContainText("Before collecting cash");assert.equal((await app.evaluate(()=>globalThis.arSafety.writes)).length,0);
  page.once("dialog",d=>d.dismiss());await modal.getByRole("button",{name:"Cancel",exact:true}).click();await expect(modal).toBeVisible();
  await method.selectOption("Card");await confirm.click();await expect(modal.getByRole("alert")).toContainText("complete positive amount");assert.equal((await app.evaluate(()=>globalThis.arSafety.writes)).length,0);
  const reference=modal.getByLabel("Reference number",{exact:true});await reference.fill(j.run+" synthetic Card10");
  await help("Outstanding dues (Udhaar)",reference);await expect(reference).toHaveValue(j.run+" synthetic Card10");
  pass("strict exponent/missing-reference validation and actual missing-drawer preflight submit ZERO payments; cancelled draft discard and F1 preserve original invoice inputs");
  await confirm.evaluate(b=>{b.click();b.click()});
  const retry=modal.getByRole("button",{name:"Retry original financial action",exact:true});await expect(retry).toBeVisible();await expect(retry).toBeEnabled();
  await expect(amount).toBeDisabled();await expect(method).toBeDisabled();await expect(reference).toBeDisabled();await expect(confirm).toBeDisabled();await expect(modal.getByRole("button",{name:"Cancel",exact:true})).toBeDisabled();
  await expect(page.locator('section[data-write-pending="true"]')).toBeVisible();await page.keyboard.press("Escape");await expect(modal).toBeVisible();await expect(modal.getByRole("button",{name:"Close",exact:true})).toHaveCount(0);
  let writes=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(writes.length,1);assert(writes[0].finished);assert(writes[0].key);j.first_write=writes[0];save();
  assert([200,201,409].includes(writes[0].status));if(writes[0].status===409)assert.equal(writes[0].error.code,"SHIFT_NOT_OPEN");
  await retry.evaluate(b=>{b.click();b.click()});await expect.poll(()=>app.evaluate(()=>globalThis.arSafety.writes.filter(w=>w.finished).length)).toBe(2);
  writes=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.equal(writes[0].body,writes[1].body);
  const after=await backend("GET",`/finance/invoices/${target.invoice_id}`,ownToken);j.invoice_after=after;j.transport={writes};save();
  if(writes[0].status<300){
    assert.equal(writes[1].replay,"true");assert.equal(writes[0].result.payment.payment_id,writes[1].result.payment.payment_id);assert.equal(after.amount_paid,before.amount_paid+10);
    await expect(modal.getByText("Payment Collected Successfully",{exact:true})).toBeVisible();
    pass("real synthetic Card10 collection committed with lost reply; original-key/body explicit replay returns SAME payment ID and Idempotent-Replay true; one10 collection only, unknown edit/close/Escape/new-submit blocked");
    await modal.getByRole("button",{name:"Close",exact:true}).last().click();
  }else{
    assert.equal(writes[1].status,409);assert.equal(after.amount_paid,before.amount_paid);await expect(modal.getByRole("alert")).toContainText("SHIFT_NOT_OPEN");
    pass("real SHIFT_NOT_OPEN reply lost then identical original-key/body explicit retry confirms refusal and unlocks; ZERO payment records/no money-out; unknown draft locked until definite refusal");
    page.once("dialog",d=>d.accept());await modal.getByRole("button",{name:"Cancel",exact:true}).click();
  }
  } else {
    await expect(row).toContainText(String(before.amount_paid));
    pass("read-only continuation re-read original synthetic invoice; no new payment attempted");
  }
  await page.getByRole("button",{name:"Outstanding dues queue",exact:true}).click();
  await capture("receivables");
  await prefs({language:"en",theme:"Light",ui_scale_pct:100});
  await page.evaluate(()=>window.terminal.call("logout",{all:false}));
  await backend("PUT","/admin/users/34/roles",it,{role_codes:j.original_roles});
  await page.getByLabel("Username",{exact:true}).fill("codex.foundation.1792584106665");
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in →",exact:true}).click();
  await expect.poll(()=>state().then(s=>s.workspace)).toBe("reception");
  await nav("Tariff");
  await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true})});
  await page.getByRole("button",{name:"Print / save tariff PDF",exact:true}).click();await expect(page.getByText("PDF save cancelled. No file was saved.",{exact:true})).toBeVisible();
  await prefs({language:"ur"});await expect(page.getByText("پی ڈی ایف محفوظ کرنا منسوخ ہوگیا۔ فائل محفوظ نہیں ہوئی۔",{exact:true})).toBeVisible();
  await prefs({language:"en"});
  const helpControl=page.getByLabel("Find a service, ward or test",{exact:true});
  await helpControl.fill(j.run);await help("Tariff",helpControl);await expect(helpControl).toHaveValue(j.run);
  await page.context().setOffline(true);await helpControl.focus();await page.keyboard.press("F1");
  const helpDialog=page.getByRole("dialog").filter({has:page.locator(".help-layout")});
  const helpSearch=helpDialog.locator('input[data-help="help.search"]');await expect(helpSearch).toBeVisible();await helpSearch.fill("tariff");await expect(helpDialog.locator(".help-layout aside button")).not.toHaveCount(0);
  await helpSearch.fill("");await expect(helpDialog.locator(".handbook-example img")).toBeVisible();await helpDialog.locator(".handbook-example img").evaluate(i=>i.decode());
  await helpDialog.getByRole("button",{name:"Close",exact:true}).click();await expect(helpControl).toBeFocused();await page.context().setOffline(false);
  await nav("Settings");const slider=page.getByLabel("Display size",{exact:true});await expect(slider).toBeVisible();
  await slider.focus();await page.keyboard.press("ArrowRight");await expect.poll(()=>state().then(s=>s.prefs.ui_scale_pct)).toBe(110);await zoomKey("=");await expect(slider).toHaveValue("120");
  await zoomKey("0");await expect(slider).toHaveValue("100");
  pass("Tariff offline renderer handbook/search/image/F1 focus and shared Settings slider/native keyboard zoom agreement verified; human/native Urdu still pending");
  pass("receivables EN/UR both themes250 captured with no page overflow; Tariff PDF result notice follows language changes instead of retaining stale English");
  j.passed=true;save();

} catch(e) {
  j.error=e.stack;save();console.error(e.stack);process.exitCode=1;
  if(page)try{j.failure_ui=await page.locator("body").innerText();await page.screenshot({path:"artifacts/receivables-safety-failure.png"});save()}catch{}
} finally {
  if(app)try{j.transport=await app.evaluate(()=>globalThis.arSafety);save()}catch{}
  if(app && original)try{await prefs(original);j.preferences_restored=true;save()}catch(e){j.preferences_error=e.message;j.passed=false;save();process.exitCode=1}
  if(it && ownsFixture)try{await owned();await backend("POST","/admin/users/34/active",it,{active:false,reason:j.run+" test cleanup"});j.account_deactivated=!(await owned()).is_active;save();await backend("PUT","/admin/users/34/roles",it,{role_codes:j.original_roles});j.roles_restored=true;save()}catch(e){j.cleanup_error=e.message;j.passed=false;save();process.exitCode=1}
  if(app)await app.close();j.finished=new Date().toISOString();save();
}
