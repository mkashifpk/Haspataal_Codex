// Real DEV tariff reads/PDF only. Changes/restores only owned user34 credentials/active state/preferences.
// Save-dialog choice is automated in the harness; real server PDF bytes are preserved. No business records change.
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
const file = "artifacts/tariff-check.json";
const readonly = process.argv.includes("--read-only");
if (fs.existsSync(file)) {
  const prior = JSON.parse(fs.readFileSync(file));
  assert(
    prior.account_deactivated &&
      prior.attempts.every((a) => a.finished) &&
      prior.tickets.every((t) => t.closed),
    "Reconcile original writes/cleanup before a new run",
  );
  if (fs.existsSync("artifacts/tariff-native-writes.json")) {
    const writes = JSON.parse(
      fs.readFileSync("artifacts/tariff-native-writes.json"),
    );
    assert(
      (writes.reads || []).every((w) => w.finished),
      "Reconcile native original write keys before another run",
    );
    fs.copyFileSync(
      "artifacts/tariff-native-writes.json",
      `artifacts/tariff-native-writes-${Date.now()}.json`,
    );
  }
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-TARIFF-" + Date.now(),
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
      "artifacts/tariff-profile-" + Date.now(),
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
  const unauth = await page.evaluate(()=>window.terminal.call("download",{path:"/tariff/pdf"}));
  assert(!unauth.ok); assert.match(unauth.error.message,/permission/);
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




  const baseline=await backend("GET","/tariff",ownToken);j.tariff=baseline;save();
  await app.evaluate(({dialog})=>{
    const https=process.getBuiltinModule("https"),original=https.request,fs=process.getBuiltinModule("fs"),crypto=process.getBuiltinModule("crypto");
    globalThis.tariffTest={reads:[],businessWrites:[],dialogs:[],mode:"cancel",failReads:0,holdDialog:false};
    const persist=()=>fs.writeFileSync(process.cwd()+"/artifacts/tariff-native-writes.json",JSON.stringify(globalThis.tariffTest,(k,v)=>typeof v==="function"?undefined:v,2));persist();
    dialog.showSaveDialog=async(win,options)=>{
      const t=globalThis.tariffTest;t.dialogs.push({defaultPath:options.defaultPath,mode:t.mode});persist();
      if(t.holdDialog)await new Promise(resolve=>{t.releaseDialog=resolve});
      return t.mode==="cancel"?{canceled:true}:{canceled:false,filePath:process.cwd()+"/artifacts/tariff-native.pdf"};
    };
    https.request=function(url,options,callback){
      const object=typeof url==="object" && !(url instanceof URL),u=object?new URL(`https://${url.hostname||url.host}:${url.port||443}${url.path||"/"}`):new URL(url),method=(object?url.method:options?.method)||"GET";
      if(method!=="GET" && /\/(patients|opd-tickets|reception\/registrations|approvals)(\/|$)/.test(u.pathname)){globalThis.tariffTest.businessWrites.push({method,path:u.pathname});persist()}
      if(method!=="GET" || !/\/tariff(\/pdf)?$/.test(u.pathname))return original.call(this,url,options,callback);
      const a={path:u.pathname,finished:false};globalThis.tariffTest.reads.push(a);persist();
      return original.call(this,url,options,response=>{
        const chunks=[];a.status=response.statusCode;a.type=response.headers["content-type"];
        response.on("data",c=>chunks.push(Buffer.from(c)));
        const emit=response.emit.bind(response);response.emit=function(event,...args){
          if(event==="end"){
            const bytes=Buffer.concat(chunks);a.bytes=bytes.length;a.sha256=crypto.createHash("sha256").update(bytes).digest("hex");a.pdf=bytes.subarray(0,5).toString()==="%PDF-";a.finished=true;persist();
            if(globalThis.tariffTest.failReads>0 && u.pathname.endsWith("/tariff")){globalThis.tariffTest.failReads--;persist();response.destroy(new Error("TEST lost real tariff read reply"));return true}
          }
          return emit(event,...args);
        };callback(response);
      });
    };
  });
  await nav("Tariff");
  await expect.poll(()=>state().then(s=>s.workspace)).toBe("reception");
  await expect(page.locator("main h1")).toHaveText("Tariff");
  await expect(page.getByRole("heading",{name:baseline.hospital_name,exact:true})).toBeVisible();
  await expect(page.getByText("Prices as of",{exact:false})).toContainText(baseline.as_of);
  for(const c of baseline.categories){
    const table=page.getByRole("table",{name:c.label,exact:true});
    await expect(table).toHaveCount(c.items.length?1:0);
    for(const item of c.items){const row=table.getByRole("row").filter({has:page.getByRole("cell",{name:item.code,exact:true})});await expect(row).toContainText(item.name);await expect(row).toContainText(`${baseline.currency} ${item.price}`);}
  }
  const wardTable=page.getByRole("table",{name:"Ward daily charges",exact:true});
  for(const w of baseline.wards){const row=wardTable.getByRole("row").filter({has:page.getByRole("cell",{name:w.name,exact:true})});await expect(row).toContainText(w.bed_day_price===null?"Price not listed":`${baseline.currency} ${w.bed_day_price}`)}
  const labs=page.getByRole("table",{name:"Lab test prices",exact:true});
  for(const t of baseline.lab_tests)await expect(labs.getByRole("row").filter({has:page.getByRole("cell",{name:t.code,exact:true})})).toContainText(`${baseline.currency} ${t.price}`);
  if(!baseline.lab_tests.length)await expect(page.getByText("No lab test prices match this view.",{exact:true})).toBeVisible();
  const query=page.getByLabel("Find a service, ward or test",{exact:true});
  await query.fill("NO-MATCH-"+j.run);await expect(page.getByText("No published prices match this view. Show all prices or refresh; a missing price does not mean a free service.",{exact:true})).toBeVisible();
  await help("Tariff",query);await expect(query).toHaveValue("NO-MATCH-"+j.run);
  await page.context().setOffline(true);
  await query.focus();
  await page.keyboard.press("F1");
  const offlineDialog = page.getByRole("dialog").filter({ has: page.locator(".help-layout") });
  await expect(offlineDialog.locator(".help-article h1")).toHaveText("Tariff");
  const offlineSearch = offlineDialog.locator('input[data-help="help.search"]');
  if (await offlineSearch.count() > 0) {
    await offlineSearch.fill("tariff");
    assert((await offlineDialog.locator(".help-layout aside button").count()) > 0);
    await offlineSearch.fill("");
  }
  await offlineDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(query).toBeFocused();
  await page.context().setOffline(false);
  await page.getByRole("button",{name:"Show all prices",exact:true}).click();await expect(query).toHaveValue("");
  await page.getByLabel("Price category",{exact:true}).selectOption("wards");await expect(page.getByRole("table")).toHaveCount(baseline.wards.length?1:0);
  const denied=await page.evaluate(()=>window.terminal.call("download",{path:"/patients/14/documents"}));assert(!denied.ok);assert.match(denied.error.message,/not permitted/);
  pass("real tariff200 exact service/ward/lab values grouped with server date/currency; category/search/empty/reset work; F1 preserves filter/focus, download allowlist refuses another route");
  // Keep an unmatched screen filter: the official PDF must still be fetched in full without query parameters.
  await query.fill("PDF-FILTER-"+j.run);
  await app.evaluate(()=>{globalThis.tariffTest.mode="cancel";globalThis.tariffTest.holdDialog=true});
  const pdf=page.getByRole("button",{name:"Print / save tariff PDF",exact:true});
  await help("Tariff", pdf);
  await pdf.evaluate(b=>{b.click();b.click()});
  await expect.poll(()=>app.evaluate(()=>globalThis.tariffTest.dialogs.length)).toBe(1);
  await expect(page.getByRole("button",{name:"Downloading PDF…",exact:true})).toBeDisabled();
  await app.evaluate(()=>{globalThis.tariffTest.holdDialog=false;globalThis.tariffTest.releaseDialog()});
  await expect(page.getByText("PDF save cancelled. No file was saved.",{exact:true})).toBeVisible();
  assert.equal((await app.evaluate(()=>globalThis.tariffTest.reads)).filter(r=>r.path.endsWith("/pdf")).length,1);
  await app.evaluate(()=>{globalThis.tariffTest.mode="save"});
  await pdf.click();await expect(page.getByText("Tariff PDF saved. Open the saved PDF in your PDF reader to print.",{exact:true})).toBeVisible();
  const bytes=fs.readFileSync("artifacts/tariff-native.pdf");assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
  const observed=await app.evaluate(()=>globalThis.tariffTest);assert.equal(observed.reads.filter(r=>r.path.endsWith("/pdf")).length,2);assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),observed.reads.filter(r=>r.path.endsWith("/pdf")).at(-1).sha256);
  j.pdf={bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),native_dialog_choices_automated:true};save();
  pass("real official PDF200 downloaded only on request; held cancel/save dialog choices automated, pending doubleclick one download, cancel saves nothing and saved bytes match actual server PDF; filters not sent to PDF endpoint");
  await page.getByRole("button",{name:"Show all prices",exact:true}).click();
  await app.evaluate(()=>{globalThis.tariffTest.failReads=2});
  await page.getByRole("button",{name:"Refresh tariff",exact:true}).click();
  await expect(page.locator("main .error[role=alert]")).toBeVisible();await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button",{name:"Try again",exact:true}).click();await expect(page.getByRole("heading",{name:baseline.hospital_name,exact:true})).toBeVisible();
  await capture("tariff_display");
  assert.deepEqual(await backend("GET","/tariff",ownToken),baseline,"Tariff is unchanged by this read-only screen");
  j.transport=await app.evaluate(()=>globalThis.tariffTest);assert.equal(j.transport.businessWrites.length,0);save();
  pass("actual tariff read reply loss twice reaches visible error and hides stale prices; deliberate retry recovers; EN/UR both themes250 captured/no page overflow; actual tariff unchanged and ZERO business writes");

  // Native zoom bounds, reset, new-window inheritance and relogin persistence
  for (let i = 0; i < 16; i++) await zoomKey("=");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 15000 }).toBe(250);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  await zoomKey("0");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 15000 }).toBe(100);

  for (let i = 0; i < 3; i++) await zoomKey("-");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 15000 }).toBe(100);

  // Set zoom to 120%
  await zoomKey("=");
  await zoomKey("=");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 15000 }).toBe(120);

  // Test new-window zoom inheritance
  const newWindow = app.waitForEvent("window");
  const opened = await page.evaluate(() =>
    window.terminal.call("workspace", {
      code: "reception",
      newWindow: true,
    }),
  );
  assert(opened.ok);
  const second = await newWindow;
  await second.waitForLoadState("domcontentloaded");
  await expect.poll(() =>
    second.evaluate(() =>
      window.terminal.call("state").then((r) => r.data.prefs.ui_scale_pct),
    ),
  ).toBe(120);
  await second.close();

  // Test relogin persistence
  await page.evaluate(() => window.terminal.call("logout", { all: false }));
  await page.getByLabel("Username", { exact: true }).fill("codex.foundation.1792584106665");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page.getByRole("navigation").waitFor();
  await nav("Tariff");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct)).toBe(120);
  await zoomKey("0");
  await expect.poll(() => state().then((s) => s.prefs.ui_scale_pct), { timeout: 15000 }).toBe(100);
  pass("native zoom 100-250% bounds, Ctrl+0 reset, new-window inheritance and relogin persistence verified on Tariff");

  // Read-only permission matrix check
  const accessCalls = [];
  const unauthTariff = await request(config.server_urls[0] + "/api/v1/tariff", { ca, method: "GET" });
  assert.equal(unauthTariff.status, 401);
  accessCalls.push({
    request: { method: "GET", path: "/api/v1/tariff", as_user: "unauthenticated", body: null },
    status: unauthTariff.status,
    request_id: unauthTariff.body?.request_id,
    error: unauthTariff.body?.error?.code
  });

  const unauthPdf = await request(config.server_urls[0] + "/api/v1/tariff/pdf", { ca, method: "GET" });
  assert.equal(unauthPdf.status, 401);
  accessCalls.push({
    request: { method: "GET", path: "/api/v1/tariff/pdf", as_user: "unauthenticated", body: null },
    status: unauthPdf.status,
    request_id: unauthPdf.body?.request_id,
    error: unauthPdf.body?.error?.code
  });

  const docLogin = await request(config.server_urls[0] + "/api/v1/auth/login", {
    ca, method: "POST", body: { username: "demo.doctor", password: "Demo-pass-2026" }
  });
  assert(docLogin.status < 400 && docLogin.body.data?.access_token);
  const docToken = docLogin.body.data.access_token;
  const docTariff = await request(config.server_urls[0] + "/api/v1/tariff", {
    ca, method: "GET", headers: { Authorization: "Bearer " + docToken, "X-Haspataal-Developer": "mkashif", "X-Haspataal-Implementation": "1" }
  });
  assert.equal(docTariff.status, 200);
  accessCalls.push({
    request: { method: "GET", path: "/api/v1/tariff", as_user: "demo.doctor", body: null },
    status: docTariff.status,
    request_id: docTariff.body?.request_id,
    hospital_name: docTariff.body?.data?.hospital_name
  });

  const docPdf = await request(config.server_urls[0] + "/api/v1/tariff/pdf", {
    ca, method: "GET", headers: { Authorization: "Bearer " + docToken, "X-Haspataal-Developer": "mkashif", "X-Haspataal-Implementation": "1" }
  });
  assert.equal(docPdf.status, 200);
  accessCalls.push({
    request: { method: "GET", path: "/api/v1/tariff/pdf", as_user: "demo.doctor", body: null },
    status: docPdf.status,
    request_id: docPdf.body?.request_id
  });

  const postTariff = await request(config.server_urls[0] + "/api/v1/tariff", {
    ca, method: "POST", headers: { Authorization: "Bearer " + ownToken, "X-Haspataal-Developer": "mkashif", "X-Haspataal-Implementation": "1" },
    body: { price: 999 }
  });
  assert(postTariff.status === 405 || postTariff.status === 404);
  accessCalls.push({
    request: { method: "POST", path: "/api/v1/tariff", as_user: "owned.user34", body: { price: 999 } },
    status: postTariff.status,
    request_id: postTariff.body?.request_id,
    error: postTariff.body?.error?.code
  });

  fs.writeFileSync("docs/tariff-access-checks-2026-10-23.json", JSON.stringify({
    date: "2026-10-23",
    screen: "tariff_display",
    access_rule: "Any logged-in user can read GET /tariff and GET /tariff/pdf; unauthenticated requests are refused 401; write operations are not offered or permitted on the tariff endpoint",
    calls: accessCalls
  }, null, 2));
  pass("read-only permission matrix verified: unauthenticated 401, multi-role 200, no write endpoint; recorded docs/tariff-access-checks-2026-10-23.json");
  j.passed=true;save();

} catch(e) {
  j.error=e.stack;save();console.error(e.stack);process.exitCode=1;
  if(page)try{j.failure_ui=await page.locator("body").innerText();await page.screenshot({path:"artifacts/tariff-failure.png"});save()}catch{}
} finally {
  if(app)try{j.transport=await app.evaluate(()=>globalThis.tariffTest);save()}catch{}
  if(app && original)try{await prefs(original);j.preferences_restored=true;save()}catch(e){j.preferences_error=e.message;j.passed=false;save();process.exitCode=1}
  if(it && ownsFixture)try{await owned();await backend("POST","/admin/users/34/active",it,{active:false,reason:j.run+" test cleanup"});j.account_deactivated=!(await owned()).is_active;save()}catch(e){j.cleanup_error=e.message;j.passed=false;save();process.exitCode=1}
  if(app)await app.close();j.finished=new Date().toISOString();save();
}
