# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV: Card10 settlement + write-off10 only on actual newly created AR1/patient16/invoice12.
// Created through credit3/approval12; journals original writes; no physical cash/external processor.
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
const file = "artifacts/receivables-ar-completion-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/receivables-ar-completion-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/receivables-ar-completion-native-writes.json"),
    );
    assert(
      (writes.writes || []).every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/receivables-ar-completion-native-writes.json",
      `artifacts/receivables-ar-completion-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-AR-COMPLETE-" + Date.now(),
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
      "artifacts/receivables-ar-completion-profile-" + Date.now(),
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
  await app.evaluate(()=>{
    const https=process.getBuiltinModule("https"),original=https.request,fs=process.getBuiltinModule("fs");
    globalThis.arSafety={writes:[],dropNext:true};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/receivables-ar-completion-native-writes.json",JSON.stringify(globalThis.arSafety,null,2));persist();
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


  const resume=process.argv.includes("--resume");
  const getAr=async()=>{const a=(await backend("GET","/finance/ar/outstanding",ownToken)).find(x=>x.ar_id===1);assert(a && a.patient_id===16 && a.invoice_id===12 && a.created_at==="2026-10-23T08:32:04.577610+00:00" && a.patient_name==="DEMO-REFUND-1792729523042 credit");return a};
  let ar=await getAr();assert.equal(ar.amount_due,1440);j.ar_before=ar;save();
  assert(ar.amount_paid===0 || (resume && ar.amount_paid===10));assert(ar.amount_written_off===0 || (resume && ar.amount_written_off===10));
  await nav("Outstanding dues");
  const row=()=>page.getByRole("table",{name:"Outstanding receivables",exact:true}).getByRole("row").filter({has:page.getByText("#1",{exact:true})});
  await expect(row()).toContainText(ar.mrn);await expect(row().getByRole("button",{name:"Write off",exact:true})).toBeDisabled();
  if(ar.amount_paid===0){
    await row().getByRole("button",{name:"Settle",exact:true}).click();
    const modal=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Settle Debt — AR #1",exact:true})});
    const amount=modal.getByLabel("Settlement amount",{exact:true}),method=modal.getByLabel("Payment method",{exact:true});
    await amount.fill("10");await method.selectOption("Card");await modal.getByLabel("Transaction reference #",{exact:true}).fill(j.run+" synthetic AR Card10");
    await help("Outstanding dues (Udhaar)",amount);
    const confirm=modal.getByRole("button",{name:"Confirm settlement",exact:true});await confirm.evaluate(b=>{b.click();b.click()});
    const retry=modal.getByRole("button",{name:"Retry original financial action",exact:true});await expect(retry).toBeVisible();await expect(retry).toBeEnabled();await expect(amount).toBeDisabled();await expect(method).toBeDisabled();await expect(confirm).toBeDisabled();await page.keyboard.press("Escape");await expect(modal).toBeVisible();
    let w=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(w.length,1);assert(w[0].finished);assert([200,201].includes(w[0].status));j.settle_original=w[0];save();
    await retry.evaluate(b=>{b.click();b.click()});await expect(modal.getByText("Settlement Completed",{exact:true})).toBeVisible();
    w=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(w.length,2);assert.equal(w[0].key,w[1].key);assert.equal(w[0].body,w[1].body);assert.equal(w[1].replay,"true");assert.equal(w[0].result.payment.payment_id,w[1].result.payment.payment_id);
    ar=await getAr();assert.equal(ar.amount_paid,10);assert.equal(ar.balance,1430);j.after_settle=ar;save();
    await modal.getByRole("button",{name:"Close",exact:true}).last().click();
    pass("new verified AR1: Cashier cannot write off; real Card10 settlement committed reply lost, same-key/body replay SAME receipt, one10 only, frozen inputs/Escape/new submit blocked");
  }else pass("resume: original AR settlement already confirmed10, no replacement settlement");
  // Existing separately eligible demo.owner; no privileged role grant and no shared preferences change. This is business write-off, not progress approval.
  await prefs(original); j.preferences_restored=true; original=undefined; save();
  await page.evaluate(()=>window.terminal.call("logout",{all:false}));
  await page.getByLabel("Username",{exact:true}).fill("demo.owner");await page.getByLabel("Password",{exact:true}).fill("Demo-pass-2026");await page.getByRole("button",{name:"Sign in →",exact:true}).click();
  await page.getByRole("navigation").waitFor();await nav("Workspaces");await page.getByRole("button",{name:/Open workspace|کام کی جگہ کھولیں/}).first().click();await nav("Outstanding dues");
  ownToken=(await backend("POST","/auth/login",null,{username:"demo.owner",password:"Demo-pass-2026"})).access_token;
  ar=await getAr();
  if(ar.amount_written_off===0){
    await row().getByRole("button",{name:"Write off",exact:true}).click();
    const modal=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Write Off Receivable — AR #1",exact:true})});
    const amount=modal.getByLabel("Amount to write off",{exact:true}),reason=modal.getByLabel("Reason for write-off (mandatory)",{exact:true});
    await amount.fill("10");await reason.fill("bad");await expect(modal.getByRole("button",{name:"Confirm write-off",exact:true})).toBeDisabled();
    await reason.fill(j.run+" synthetic write-off10 for recovery verification; no real patient");await help("Outstanding dues (Udhaar)",reason);
    const prior=(await app.evaluate(()=>globalThis.arSafety.writes)).length;await app.evaluate(()=>{globalThis.arSafety.dropNext=true});
    const confirm=modal.getByRole("button",{name:"Confirm write-off",exact:true});await confirm.evaluate(b=>{b.click();b.click()});
    const retry=modal.getByRole("button",{name:"Retry original financial action",exact:true});await expect(retry).toBeVisible();await expect(retry).toBeEnabled();await expect(amount).toBeDisabled();await expect(reason).toBeDisabled();await expect(confirm).toBeDisabled();await page.keyboard.press("Escape");await expect(modal).toBeVisible();
    let w=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(w.length,prior+1);assert(w.at(-1).finished);assert([200,201].includes(w.at(-1).status));j.writeoff_original=w.at(-1);save();
    await retry.evaluate(b=>{b.click();b.click()});await expect(modal.getByText("Write-off recorded",{exact:true})).toBeVisible();
    w=await app.evaluate(()=>globalThis.arSafety.writes);assert.equal(w.length,prior+2);const first=w.at(-2),last=w.at(-1);assert.equal(first.key,last.key);assert.equal(first.body,last.body);assert.equal(last.replay,"true");assert.equal(first.result.ar_id,last.result.ar_id);assert.equal(last.result.amount_written_off,10);
    ar=await getAr();assert.equal(ar.amount_paid,10);assert.equal(ar.amount_written_off,10);assert.equal(ar.balance,1420);j.ar_after=ar;save();
    await modal.getByRole("button",{name:"Close",exact:true}).last().click();
    pass("owned Owner role: valid-reason write-off10 committed reply lost; same-key/body explicit replay10 not20, AR1 balance1420/paid10/writeoff10; unknown draft and dismissal frozen");
  }else{j.ar_after=ar;save();pass("resume: original write-off10 already confirmed, no replacement write-off")}
  j.transport=await app.evaluate(()=>globalThis.arSafety);save();j.passed=true;save();
  await page.evaluate(()=>window.terminal.call("logout",{all:false}));

} catch(e) {
  j.error=e.stack;save();console.error(e.stack);process.exitCode=1;
  if(page)try{j.failure_ui=await page.locator("body").innerText();await page.screenshot({path:"artifacts/receivables-ar-completion-failure.png"});save()}catch{}
} finally {
  if(app)try{j.transport=await app.evaluate(()=>globalThis.arSafety);save()}catch{}
  if(app && original)try{await prefs(original);j.preferences_restored=true;save()}catch(e){j.preferences_error=e.message;j.passed=false;save();process.exitCode=1}
  if(it && ownsFixture)try{await owned();await backend("POST","/admin/users/34/active",it,{active:false,reason:j.run+" test cleanup"});j.account_deactivated=!(await owned()).is_active;save();await backend("PUT","/admin/users/34/roles",it,{role_codes:j.original_roles});j.roles_restored=true;save()}catch(e){j.cleanup_error=e.message;j.passed=false;save();process.exitCode=1}
  if(app)await app.close();j.finished=new Date().toISOString();save();
}

```
