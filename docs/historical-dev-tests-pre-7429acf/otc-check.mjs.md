# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV OTC UI checks. Creates virtual stock/payment records, no physical supply or card processing.
// Never rerun an unfinished journal; reconcile the original UUID/body and owned shift first.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const file = "artifacts/otc-check.json";
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    old.finished && old.cleaned,
    "Reconcile original OTC sale/shift before any rerun",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-OTC-" + Date.now(),
  writes: {},
  sales: [],
  checks: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const sessions = [];
let s, p, ownShift;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
async function write(label, path, body, expected) {
  assert(!j.writes[label], "Never replace an original action");
  const w = (j.writes[label] = {
    method: "POST",
    path,
    body,
    key: crypto.randomUUID(),
    state: "prepared",
  });
  save();
  const r = await p.evaluate((v) => window.terminal.call("api", v), {
    method: "POST",
    path,
    body,
    key: w.key,
  });
  w.result = r;
  w.state = r.ok
    ? "confirmed"
    : r.status >= 400 && r.status < 500
      ? "refused"
      : "unknown";
  save();
  if (expected) assert.equal(r.error?.code, expected);
  else assert(r.ok, `${label}: ${r.error?.code} ${r.error?.message}`);
  return r;
}
async function closeOwnedShift() {
  if (!ownShift) return;
  assert(
    !Object.values(j.writes).some((w) =>
      ["unknown", "awaiting-ui"].includes(w.state),
    ),
    "Reconcile uncertain sale before closing owned drawer",
  );
  const mine = await s.native("api", {
    method: "GET",
    path: "/finance/cash-shifts/mine",
  });
  if (!mine) {
    const closed = await s.native("api", {
      method: "GET",
      path: `/finance/cash-shifts/${ownShift.shift_id}`,
    });
    assert.notEqual(closed.status, "Open");
    return;
  }
  assert.equal(mine.shift_id, ownShift.shift_id);
  assert.equal(mine.user_id, ownShift.user_id);
  const summary = await s.native("api", {
    method: "GET",
    path: `/finance/cash-shifts/${ownShift.shift_id}`,
  });
  assert(Number.isFinite(summary.expected_cash));
  const r = await write(
    "close-own-shift",
    `/finance/cash-shifts/${ownShift.shift_id}/close`,
    { declared_cash: summary.expected_cash },
  );
  j.closed = r.data;
  assert.equal(r.data.declared_variance, 0);
  const final = await s.native("api", {
    method: "GET",
    path: `/finance/cash-shifts/${ownShift.shift_id}`,
  });
  assert.notEqual(final.status, "Open");
  assert.equal(final.declared_variance, 0);
  save();
}
try {
  s = await session("otc-pharmacist", "demo.pharmacist");
  sessions.push(s);
  p = s.p;
  await s.nav("OTC mode");
  await expect(p.locator("h1")).toHaveText("OTC mode");
  await p.evaluate(() => {
    window.otcEvents = [];
    window.otcStreams = [];
    window.terminal.subscribe((e) => {
      if (e.type === "event") window.otcEvents.push(e);
      if (e.type === "stream") window.otcStreams.push(e);
    });
  });
  const catalogue = await s.native("api", {
    method: "GET",
    path: "/drugs/search?limit=100",
  });
  const allowed = catalogue.find(
      (d) => d.name === "Paracetamol 500mg" && d.is_otc_allowed,
    ),
    second = catalogue.find((d) => d.name === "ORS sachet" && d.is_otc_allowed),
    rx = catalogue.find((d) => d.schedule === "ScheduleH"),
    high = catalogue.find((d) => d.high_alert_category === "Insulin");
  assert(allowed && second && rx && high && allowed.barcode);
  j.products = [allowed, second, rx, high];
  save();
  const originalShift = await s.native("api", {
    method: "GET",
    path: "/finance/cash-shifts/mine",
  });
  assert.equal(
    originalShift,
    null,
    "Never use another/previous shift for OTC verification",
  );
  await p
    .getByLabel("OTC payment method", { exact: true })
    .selectOption("Card");
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  await expect(p.locator("main")).toContainText(
    "Add between 1 and 50 different medicines",
  );
  await p
    .getByLabel("Scan product barcode", { exact: true })
    .fill("NO-SUCH-" + j.run);
  await p.getByLabel("Scan product barcode", { exact: true }).press("Enter");
  await expect(p.locator("main")).toContainText(
    "No unique exact barcode match",
  );
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(0);
  for (const bad of [rx, high]) {
    await p
      .getByLabel("Scan product barcode", { exact: true })
      .fill(bad.barcode);
    await p.getByLabel("Scan product barcode", { exact: true }).press("Enter");
    await expect(p.locator('main .error[role="alert"]')).toHaveText(
      "Prescription required. Cannot sell via OTC.",
    );
    await expect(p.getByTestId("otc-basket-line")).toHaveCount(0);
    await write(
      "refuse-" + bad.drug_id,
      "/otc-sales",
      {
        items: [{ drug_id: bad.drug_id, qty: "1" }],
        method: "Card",
        customer_name: j.run + " expected refusal only",
      },
      "OTC_PRESCRIPTION_REQUIRED",
    );
  }
  pass(
    "Empty basket and unknown barcode add nothing; ScheduleH and high-alert scans refuse exact mandatory text; real backend refuses both without supply",
  );
  await p
    .getByLabel("Scan product barcode", { exact: true })
    .fill(allowed.barcode);
  await p.getByLabel("Scan product barcode", { exact: true }).press("Enter");
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(1);
  await expect(
    p.getByLabel("Scan product barcode", { exact: true }),
  ).toBeFocused();
  await p
    .getByLabel("Scan product barcode", { exact: true })
    .fill(allowed.barcode);
  await p.getByLabel("Scan product barcode", { exact: true }).press("Enter");
  await expect(p.locator("main")).toContainText("already in the basket");
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(1);
  await p.getByLabel("Scan product barcode", { exact: true }).fill("");
  const qty = p.getByLabel("Sale quantity #" + allowed.drug_id, {
    exact: true,
  });
  await qty.fill("0");
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  await expect(p.locator("main")).toContainText("Enter a positive quantity");
  await qty.fill(String(allowed.qty_available + 1));
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  await expect(p.locator("main")).toContainText(
    "quantity exceeds current available stock",
  );
  await qty.fill("1");
  await help(s, qty, "OTC mode");
  await expect(qty).toHaveValue("1");
  await p
    .getByLabel("Customer name (optional)", { exact: true })
    .fill(j.run + " صرف سافٹ ویئر ٹیسٹ");
  await p
    .getByLabel("Card reference (optional)", { exact: true })
    .fill(j.run + " virtual card, no actual money");
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  let modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", { name: "Confirm OTC sale", exact: true }),
    });
  await help(
    s,
    modal.getByRole("button", { name: "Confirm OTC sale", exact: true }),
    "OTC mode",
  );
  const beforeWrites = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/otc-sales",
  ).length;
  const stockBefore = (
    await s.native("api", {
      method: "GET",
      path: `/drugs/search?q=${allowed.barcode}`,
    })
  )[0].qty_available;
  await s.fault({
    failPath: "/api/v1/otc-sales",
    failMethod: "POST",
    once: true,
  });
  j.writes.uiCard = { path: "/otc-sales", state: "awaiting-ui" };
  save();
  await modal
    .getByRole("button", { name: "Confirm OTC sale", exact: true })
    .dblclick();
  await expect(modal).toContainText("The result is unknown");
  let posts = (await s.trace()).requests
    .filter((r) => r.method === "POST" && r.path === "/api/v1/otc-sales")
    .slice(beforeWrites);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].status, 201);
  j.writes.uiCard = { ...posts[0], state: "confirmed-server-reply-lost" };
  save();
  await expect(
    p.getByRole("button", { name: "Refresh OTC stock", exact: true }),
  ).toBeDisabled();
  await modal
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(p.getByTestId("otc-confirmed")).toBeVisible();
  posts = (await s.trace()).requests
    .filter((r) => r.method === "POST" && r.path === "/api/v1/otc-sales")
    .slice(beforeWrites);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].key, posts[1].key);
  assert.deepEqual(posts[0].body, posts[1].body);
  assert.equal(String(posts[1].replay), "true");
  const sale = posts[1].result.data;
  j.writes.uiCard.state = "confirmed";
  j.writes.uiCard.replay = posts[1];
  j.sales.push(sale);
  save();
  assert.equal(sale.dispensation.is_otc_sale, true);
  assert.equal(sale.invoice.invoice_type, "OTC");
  assert.equal(sale.payment.method, "Card");
  assert.equal(
    (
      await s.native("api", {
        method: "GET",
        path: `/drugs/search?q=${allowed.barcode}`,
      })
    )[0].qty_available,
    stockBefore - 1,
  );
  await expect(
    p.getByLabel("Customer name (optional)", { exact: true }),
  ).toHaveValue("");
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(0);
  assert(
    (await p.evaluate(() => window.otcEvents)).some(
      (e) => e.event_type === "pharmacy.stock.updated",
    ),
  );
  pass(
    "Actual scanned Card sale201/lost reply/double-click one flight/exact UUID+body replay creates one invoice/payment and one stock effect; signed server result/customer reset/live stock event",
  );
  await expect(
    p.getByRole("button", { name: "Save OTC receipt PDF", exact: true }),
  ).toBeVisible();
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async (_w, o) => ({
      canceled: false,
      filePath: process.cwd() + "/artifacts/" + o.defaultPath,
    });
  });
  await p
    .getByRole("button", { name: "Save OTC receipt PDF", exact: true })
    .click();
  await expect(p.getByText("PDF saved.", { exact: true })).toBeVisible();
  assert.equal(
    fs
      .readFileSync(
        `artifacts/Dispensation-${sale.dispensation.dispensation_id}-receipt.pdf`,
      )
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await p
    .getByRole("button", { name: "Save OTC receipt PDF", exact: true })
    .click();
  await expect(p.getByText("Save cancelled.", { exact: true })).toBeVisible();
  const printWrites = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/otc-sales",
  ).length;
  await p
    .getByRole("button", { name: "Print OTC receipt", exact: true })
    .click();
  await expect(p.locator('main .error[role="alert"]')).toBeVisible();
  assert.equal(
    (await s.trace()).requests.filter(
      (r) => r.method === "POST" && r.path === "/api/v1/otc-sales",
    ).length,
    printWrites,
  );
  pass(
    "Actual server receipt renders to native PDF; native save cancellation/missing receipt printer remain visible with no repeated sale/payment",
  );
  await p.getByLabel("OTC dispensation ID", { exact: true }).fill("2147483647");
  await p
    .getByRole("button", { name: "Read OTC receipt", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Print OTC receipt", exact: true }),
  ).toHaveCount(0);
  await expect(p.locator('main .error[role="alert"]')).toBeVisible();
  await p
    .getByLabel("OTC dispensation ID", { exact: true })
    .fill(String(sale.dispensation.dispensation_id));
  await p
    .getByRole("button", { name: "Read OTC receipt", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Print OTC receipt", exact: true }),
  ).toBeVisible();
  await p
    .getByLabel("Medicine name, code or barcode", { exact: true })
    .fill("NO-SUCH-" + j.run);
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("No medicines match");
  await p
    .getByLabel("Medicine name, code or barcode", { exact: true })
    .fill(second.name);
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.getByTestId("otc-drug")).toHaveCount(1);
  await p
    .getByRole("button", {
      name: "Add medicine #" + second.drug_id,
      exact: true,
    })
    .click();
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(1);
  await p
    .getByRole("button", {
      name: "Remove medicine #" + second.drug_id,
      exact: true,
    })
    .click();
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(0);
  await p
    .getByRole("button", {
      name: "Add medicine #" + second.drug_id,
      exact: true,
    })
    .click();
  await p
    .getByLabel("OTC payment method", { exact: true })
    .selectOption("Cash");
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  await expect(p.locator("main")).toContainText(
    "Open your own cash shift at this terminal",
  );
  await write(
    "cash-no-shift",
    "/otc-sales",
    {
      items: [{ drug_id: second.drug_id, qty: "1" }],
      method: "Cash",
      customer_name: j.run + " expected shift refusal",
    },
    "SHIFT_NOT_OPEN",
  );
  pass(
    "Known receipt reread/error hides stale output; actual formulary search/no-match/add/remove and own-Cash prerequisite refusal (UI and backend)",
  );
  const terminal = await s.native("api", {
    method: "GET",
    path: "/terminals/whoami",
  });
  assert(terminal.cash_node, "Do not invent a terminal mapping");
  // Try ONLY a new shift owned by this demo pharmacist at the actual mapped node. Another open drawer is left untouched.
  const w = (j.writes["open-own-shift"] = {
    method: "POST",
    path: "/finance/cash-shifts/open",
    body: { node: terminal.cash_node, opening_float: "1500" },
    key: crypto.randomUUID(),
    state: "prepared",
  });
  save();
  const opened = await p.evaluate((v) => window.terminal.call("api", v), {
    method: w.method,
    path: w.path,
    body: w.body,
    key: w.key,
  });
  w.result = opened;
  w.state = opened.ok
    ? "confirmed"
    : opened.status >= 400 && opened.status < 500
      ? "refused"
      : "unknown";
  save();
  if (opened.ok) {
    ownShift = opened.data;
    j.ownShift = ownShift;
    save();
    const expected = await s.native("api", {
      method: "GET",
      path: `/finance/cash-shifts/${ownShift.shift_id}`,
    });
    assert.equal(expected.expected_cash, 1500);
    await p
      .getByRole("button", { name: "Refresh OTC stock", exact: true })
      .click();
    await expect(p.locator("main")).toContainText("Your cash shift is open");
    await p
      .getByLabel("Customer name (optional)", { exact: true })
      .fill(j.run + " synthetic cash sale, no actual money");
    await p
      .getByRole("button", { name: "Review OTC sale", exact: true })
      .click();
    modal = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", { name: "Confirm OTC sale", exact: true }),
      });
    j.writes.uiCash = { path: "/otc-sales", state: "awaiting-ui" };
    save();
    const start = (await s.trace()).requests.filter(
      (r) => r.method === "POST" && r.path === "/api/v1/otc-sales",
    ).length;
    await modal
      .getByRole("button", { name: "Confirm OTC sale", exact: true })
      .click();
    await expect.poll(async()=> (await s.trace()).requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/otc-sales').slice(start)[0]?.finished).toBe(true);
    const cashPost=(await s.trace()).requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/otc-sales').slice(start);assert.equal(cashPost.length,1);
    if(cashPost[0].status===409){assert.equal(cashPost[0].result.error.code,'SHIFT_NOT_OPEN');assert(cashPost[0].result.error.details.node);j.writes.uiCash={...cashPost[0],state:'refused'};j.cashPositiveLimit='Issue24 server-required counter differs from actual mapped terminal; refused sale, no effect';save();await expect(modal.getByRole('button',{name:'Confirm OTC sale',exact:true})).toBeDisabled();await expect(modal).toContainText('The server requires this cash counter');await modal.getByRole('button',{name:'Close',exact:true}).click();await expect(p.getByRole('button',{name:'Review OTC sale',exact:true})).toBeDisabled();await p.getByLabel('OTC payment method',{exact:true}).selectOption('Card');await p.getByRole('button',{name:'Remove medicine #'+second.drug_id,exact:true}).click();await p.getByLabel('Customer name (optional)',{exact:true}).fill('');const summary=await s.native('api',{method:'GET',path:'/finance/cash-shifts/'+ownShift.shift_id});assert.equal(summary.expected_cash,1500);pass('Actual wrong-counter409 shows required counter and disables Cash review/confirmation; no payment/stock effect, no mapping/drawer bypass');
    }else{assert.equal(cashPost[0].status,201);await expect(modal).toHaveCount(0);const cash=cashPost[0].result.data;j.writes.uiCash={...cashPost[0],state:'confirmed'};j.sales.push(cash);save();assert.equal(cash.payment.shift_id,ownShift.shift_id);assert.equal(cash.payment.method,'Cash');const summary=await s.native('api',{method:'GET',path:'/finance/cash-shifts/'+ownShift.shift_id});assert(summary.expected_cash>1500);pass('NEW own mapped shift float1500; real Cash sale binds own shift and increases server expected_cash');}

  } else {
    assert.equal(opened.error?.code, "SHIFT_ALREADY_OPEN");
    j.cashPositiveLimit =
      "Another shift already occupies this mapped counter; not used/closed/changed";
    save();
    pass(
      "Shared counter already occupied: server refused new owned shift; another person’s drawer was not used (Cash positive remains pending)",
    );
    await p
      .getByRole("button", {
        name: "Remove medicine #" + second.drug_id,
        exact: true,
      })
      .click();
  }
  await s.fault({
    failPath: "/api/v1/drugs/search",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.getByTestId("otc-drug")).toHaveCount(0);
  await expect(p.locator('main .error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await s.fault({ failPath: null });
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.getByTestId("otc-drug")).toHaveCount(1);
  await help(
    s,
    p.getByLabel("Medicine name, code or barcode", { exact: true }),
    "OTC mode",
  );
  await p.evaluate(() => window.scrollTo(0, 0));
  await capture(s, "otc");
  const win = await s.app.browserWindow(p);
  async function key(c) {
    await win.evaluate((w, c) => {
      w.webContents.sendInputEvent({
        type: "keyDown",
        keyCode: c,
        modifiers: ["control"],
      });
      w.webContents.sendInputEvent({
        type: "keyUp",
        keyCode: c,
        modifiers: ["control"],
      });
    }, c);
  }
  await s.prefs({ ui_scale_pct: 245 });
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("0");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await key("-");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await s.app.evaluate(() => {
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (event, ...args) {
      if (event === "message") globalThis.otcSocket = this;
      return emit.call(this, event, ...args);
    };
  });
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.otcSocket), {
      timeout: 45000,
    })
    .toBe(true);
  const reconnect = Date.now();
  await s.app.evaluate(() => globalThis.otcSocket.terminate());
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.otcStreams.some((e) => e.status === "Reconnecting"),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.otcStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await s.trace()).requests.some(
        (r) =>
          r.path.startsWith("/api/v1/drugs/search?") &&
          r.status === 200 &&
          r.started >= reconnect,
      ),
    )
    .toBe(true);
  pass(
    "Actual search loss hides stale results/retries; F1 field/dialog draft/focus, real ENUR/both themes250 and native keyboard bounds/reset; actual socket reconnect resync refreshes products",
  );
  await closeOwnedShift();
  j.cleaned = true;
  save();
  const c = await session("otc-cashier", "demo.cashier");
  sessions.push(c);
  await expect(
    c.p
      .getByRole("navigation")
      .getByRole("button", { name: "OTC mode", exact: false }),
  ).toHaveCount(0);
  const denied = await c.p.evaluate(() =>
    window.terminal.call("api", {
      method: "POST",
      path: "/otc-sales",
      body: { items: [{ drug_id: 1, qty: "1" }], method: "Card" },
      key: "8885d40b-2abb-4d70-b66d-625b7a18d5b2",
    }),
  );
  assert.equal(denied.error?.code, "PERMISSION_REQUIRED");
  pass(
    "Cashier link absent/native OTC sale refused before HTTP; only owned synthetic shift closed declaring whole SERVER expected_cash, variance0",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (ownShift && !j.closed) {
    try {
      await closeOwnedShift();
      j.cleaned = true;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      save();
      process.exitCode = 1;
    }
  }
  for (const x of sessions.reverse()) {
    await x.fault({ failPath: null, delayPath: null });
    await x.close();
  }
  j.finished = new Date().toISOString();
  save();
  if (j.passed)
    fs.writeFileSync(
      "docs/otc-evidence-2026-10-25.json",
      JSON.stringify(
        {
          date: j.finished,
          run: j.run,
          passed: true,
          checks: j.checks,
          sales: j.sales.map((r) => ({
            id: r.dispensation.dispensation_id,
            invoice: r.invoice.invoice_no,
            payment: r.payment?.payment_id,
            method: r.payment?.method,
            shift_id: r.payment?.shift_id,
            total: r.dispensation.total_amount,
          })),
          own_shift: j.ownShift?.shift_id,
          closed: !!j.closed,
          cleaned: j.cleaned,
          limits: [
            j.cashPositiveLimit ||
              "Cash positive tested with owned synthetic drawer; no actual money or medicine supply",
            "DEV agent checks; no shared service lifecycle mutation or human role/translation/editor/physical-printer acceptance",
            "Virtual stock/financial records retained; no fake undo or refund",
            "Service states/limits/concurrency policy unit tested; not a signed full-screen/workspace acceptance",
          ],
        },
        null,
        2,
      ),
    );
}

```
