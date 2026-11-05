# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV: owned user34 only, new synthetic attachments on retained synthetic patient14.
// Retains uploaded audit records. No registration, visit, payment, approval or physical cash writes.
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
const file = "artifacts/patient-documents-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/patient-documents-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/patient-documents-native-writes.json"),
    );
    assert(
      writes.writes.every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/patient-documents-native-writes.json",
      `artifacts/patient-documents-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-DOCUMENTS-" + Date.now(),
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
save();
try {
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/patient-documents-profile-" + Date.now(),
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


  const patient = await backend("GET", "/patients/14", ownToken);
  assert(patient.full_name.startsWith("DEMO-REGISTRATION-"));
  assert.equal(patient.mrn,"MRN-2026-000012");
  j.patient={id:14,mrn:patient.mrn};save();
  await app.evaluate(() => {
    const https=process.getBuiltinModule("https"),original=https.request;
    const fs=process.getBuiltinModule("fs"),crypto=process.getBuiltinModule("crypto");
    globalThis.vaultTest={writes:[],downloads:[],dropNext:true};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/patient-documents-native-writes.json",JSON.stringify(globalThis.vaultTest,null,2));persist();
    https.request=function(url,options,callback){
      const object=typeof url==="object" && !(url instanceof URL);
      const u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url);
      const method=(object?url.method:options?.method)||"GET";
      if(method==="GET" && /\/patient-documents\/\d+\/download$/.test(u.pathname)) {globalThis.vaultTest.downloads.push(u.pathname);persist()}
      if(method!=="POST" || !/\/patients\/\d+\/documents$/.test(u.pathname)) return original.call(this,url,options,callback);
      const a={path:u.pathname,key:options?.headers?.["Idempotency-Key"],finished:false};globalThis.vaultTest.writes.push(a);persist();
      const chunks=[];
      const req=original.call(this,url,options,response=>{
        a.status=response.statusCode;a.replay=response.headers["idempotent-replay"];const received=[];
        response.on("data",c=>received.push(Buffer.from(c)));
        const emit=response.emit.bind(response);
        response.emit=function(event,...args){
          if(event==="end"){
            try{const out=JSON.parse(Buffer.concat(received).toString());a.result=out.data;a.error=out.error;a.request_id=out.request_id}catch{}
            a.finished=true;persist();
            if(globalThis.vaultTest.dropNext && a.status===201){globalThis.vaultTest.dropNext=false;response.destroy(new Error("TEST lost real committed document reply"));return true;}
          }
          return emit(event,...args);
        }; callback(response);
      });
      const write=req.write.bind(req);req.write=function(chunk,...rest){chunks.push(Buffer.from(chunk));return write(chunk,...rest)};
      const end=req.end.bind(req);req.end=function(...args){if(typeof args[0]==="string" || Buffer.isBuffer(args[0]))chunks.push(Buffer.from(args[0]));a.multipart_sha256=crypto.createHash("sha256").update(Buffer.concat(chunks)).digest("hex");persist();return end(...args)};
      return req;
    };
  });
  await nav("Patient document vault");
  const search=page.getByLabel("Patient name, mobile, CNIC or MRN",{exact:true});
  await search.fill("NO-MATCH-"+j.run);await search.press("Enter");
  await expect(page.getByText("No matching patients. Check the identifier; this screen does not register a patient.",{exact:true})).toBeVisible();
  await search.fill(patient.mrn);await search.press("Enter");
  await page.getByRole("button",{name:new RegExp(patient.mrn+".*"+patient.full_name)}).click();
  await expect(page.getByRole("heading",{name:patient.full_name+" · "+patient.mrn,exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Refresh documents",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Skip photo",exact:true}).click();
  const before=await backend("GET","/patients/14/documents",ownToken);j.before_ids=before.map(d=>d.document_id);save();
  assert.equal((await app.evaluate(()=>globalThis.vaultTest.downloads)).length,0,"No automatic patient-file read");
  const png=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=160;c.height=160;const x=c.getContext("2d");x.fillStyle="#eee";x.fillRect(0,0,160,160);x.fillStyle="#333";x.fillText("SYNTHETIC VAULT",10,80);return c.toDataURL("image/png").split(",")[1]});
  const input=page.getByLabel("Choose outside reports",{exact:true});
  await input.setInputFiles({name:"synthetic-outside.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await page.getByLabel("Report title",{exact:true}).fill(j.run+" outside");
  await page.getByLabel("Document date",{exact:true}).fill("2026-10-23");
  await page.getByRole("button",{name:"Upload report",exact:true}).click();
  await expect(page.getByText("Enter report title, issuing facility and the date on the document.",{exact:true})).toBeVisible();
  await page.getByLabel("Issued by facility",{exact:true}).fill("DEMO External vault clinic");
  await help("Patient document vault",page.getByLabel("Report title",{exact:true}));
  await expect(page.getByLabel("Report title",{exact:true})).toHaveValue(j.run+" outside");
  page.once("dialog",d=>d.dismiss());await page.getByRole("button",{name:"Clear patient selection",exact:true}).click();
  await expect(page.getByRole("heading",{name:patient.full_name+" · "+patient.mrn,exact:true})).toBeVisible();
  const upload=page.getByRole("button",{name:"Upload report",exact:true});await upload.evaluate(b=>{b.click();b.click()});
  await expect(page.getByLabel("Report title",{exact:true})).toBeDisabled();
  await expect.poll(async()=> (await app.evaluate(()=>globalThis.vaultTest.writes)).filter(w=>w.finished && w.status===201).length).toBe(1);
  await expect(upload).toBeEnabled();
  let w=await app.evaluate(()=>globalThis.vaultTest.writes);assert.equal(w.length,1);assert(w[0].result.document_id);j.documents=[w[0].result];save();
  await page.getByRole("button",{name:"Clear patient selection",exact:true}).click();
  await expect(page.getByRole("heading",{name:patient.full_name+" · "+patient.mrn,exact:true})).toBeVisible();
  await upload.evaluate(b=>{b.click();b.click()});
  await expect(page.getByRole("button",{name:"Report uploaded",exact:true})).toBeVisible();
  await expect.poll(async()=> (await app.evaluate(()=>globalThis.vaultTest.writes)).filter(w=>w.finished).length).toBe(2);
  w=await app.evaluate(()=>globalThis.vaultTest.writes);assert.equal(w.length,2);assert.equal(w[0].key,w[1].key);assert.equal(w[1].replay,"true");assert.equal(w[1].result.document_id,w[0].result.document_id);
  // Multipart boundary varies per transmission; compare the preserved document/file fields through the original server result.
  assert.deepEqual(w[1].result,w[0].result);
  const after=await backend("GET","/patients/14/documents",ownToken);assert.equal(after.length,before.length+1);assert.equal(after.find(d=>d.document_id===w[0].result.document_id).source_facility,"DEMO External vault clinic");
  await expect(page.getByRole("button",{name:new RegExp(j.run+" outside · #")}).locator("..")).toContainText("Outside: DEMO External vault clinic, 2026-10-23");
  pass("real outside upload201 committed reply lost; initial/retry doubleclick each single-flight, exact original key/result replaytrue, one attachment only; unknown upload blocks patient switch; F1 and discard-cancel preserve draft, no automatic downloads");
  await page.getByRole("button",{name:new RegExp(j.run+" outside · #")}).click();
  await page.getByRole("dialog").locator("img").evaluate(i=>i.decode());
  await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  assert.equal((await app.evaluate(()=>globalThis.vaultTest.downloads)).length,1);
  await input.setInputFiles({name:"synthetic-cnic.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  const row=page.locator(".card").filter({has:page.getByText("synthetic-cnic.png",{exact:true})}).last();
  await row.getByLabel("Outside document",{exact:true}).uncheck();await row.getByLabel("Report type",{exact:true}).selectOption("CNIC");
  await row.getByLabel("Report title",{exact:true}).fill(j.run+" ID copy");
  await row.getByRole("button",{name:"Upload report",exact:true}).click();await expect(row.getByRole("button",{name:"Report uploaded",exact:true})).toBeVisible();
  const docs=await backend("GET","/patients/14/documents",ownToken);j.documents=docs.filter(d=>!j.before_ids.includes(d.document_id));save();assert.equal(j.documents.length,2);assert(j.documents.some(d=>d.doc_type==="CNIC" && !d.is_outside));
  await page.getByLabel("The patient agrees to a photo").check();
  await page.getByLabel("Choose photo",{exact:true}).setInputFiles({name:"refused.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF synthetic refusal")});
  await expect(page.getByText("Choose a JPEG or PNG patient photo.",{exact:true})).toBeVisible();
  await page.getByLabel("Choose photo",{exact:true}).setInputFiles({name:"synthetic-vault-photo.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await page.getByRole("button",{name:"Upload patient photo",exact:true}).evaluate(b=>{b.click();b.click()});
  await expect(page.getByRole("button",{name:"Photo uploaded",exact:true})).toBeVisible();
  const current=await backend("GET","/patients/14",ownToken);j.photo_id=current.photo_document_id;assert(current.photo_document_id!==patient.photo_document_id);save();
  await page.getByRole("button",{name:"View current patient photo",exact:true}).click();
  await page.getByRole("dialog").locator("img").evaluate(i=>i.decode());
  await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
  assert.equal((await app.evaluate(()=>globalThis.vaultTest.downloads)).at(-1),`/api/v1/patient-documents/${current.photo_document_id}/download`);
  j.documents=(await backend("GET","/patients/14/documents",ownToken)).filter(d=>!j.before_ids.includes(d.document_id));assert.equal(j.documents.length,3);save();
  pass("optional photo skipped without a write, PDF photo refused; consented PNG upload once with preview and refreshed real current-photo identity/download");
  await capture("patient_documents");
  await page.getByRole("button",{name:"Clear patient selection",exact:true}).click();
  await search.fill(patient.mrn);await search.press("Enter");await page.getByRole("button",{name:new RegExp(patient.mrn+".*"+patient.full_name)}).click();
  await expect(page.getByRole("button",{name:new RegExp(j.run+" ID copy · #")})).toBeVisible();
  assert.equal((await app.evaluate(()=>globalThis.vaultTest.downloads)).length,2);
  j.transport=await app.evaluate(()=>globalThis.vaultTest);save();
  pass("explicit authenticated image open decoded once; separate real hospital CNIC upload, persisted list on reopen, no prefetch; EN/UR Light/DarkHighContrast250 screenshots and no horizontal overflow");
  j.passed=true;save();
} catch(e) {
  j.error=e.stack;save();console.error(e.stack);process.exitCode=1;
  if(page)try{j.failure_ui=await page.locator("body").innerText();await page.screenshot({path:"artifacts/patient-documents-failure.png"});save()}catch{}
} finally {
  if(app)try{j.transport=await app.evaluate(()=>globalThis.vaultTest);save()}catch{}
  if(app && original)try{await prefs(original);j.preferences_restored=true;save()}catch(e){j.preferences_error=e.message;j.passed=false;save();process.exitCode=1}
  if(it && ownsFixture)try{await owned();await backend("POST","/admin/users/34/active",it,{active:false,reason:j.run+" test cleanup"});j.account_deactivated=!(await owned()).is_active;save()}catch(e){j.cleanup_error=e.message;j.passed=false;save();process.exitCode=1}
  if(app)await app.close();j.finished=new Date().toISOString();save();
}

```
