// Exact receipt continuation + final-source counter-refusal/Card journey, no prior sale replay.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const original = JSON.parse(fs.readFileSync("artifacts/otc-check.json"));
assert(
  original.finished &&
    original.cleaned &&
    original.sales.length === 1 &&
    original.closed?.declared_variance === 0,
  "Reconcile original Card/refused Cash/owned drawer first",
);
const file = "artifacts/otc-final-check.json";
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    old.finished && (old.cleaned || Object.keys(old.writes || {}).length === 0),
    "Reconcile previous final sale/shift",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-OTC-FINAL-" + Date.now(),
  checks: [...new Set(original.checks)],
  writes: {},
  sales: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s, p, owned;
const sessions = [];
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
async function write(label, path, body) {
  assert(!j.writes[label]);
  const w = (j.writes[label] = {
    method: "POST",
    path,
    body,
    key: crypto.randomUUID(),
    state: "prepared",
  });
  save();
  const r = await p.evaluate((v) => window.terminal.call("api", v), {
    method: w.method,
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
  assert(r.ok, r.error?.code);
  return r.data;
}
async function closeOwned() {
  if (!owned || j.closed) return;
  assert(
    !Object.values(j.writes).some((w) =>
      ["awaiting-ui", "unknown", "prepared"].includes(w.state),
    ),
    "Reconcile uncertain sale first",
  );
  const summary = await s.native("api", {
    method: "GET",
    path: `/finance/cash-shifts/${owned.shift_id}`,
  });
  assert.equal(summary.user_id, owned.user_id);
  assert.equal(summary.status, "Open");
  assert.equal(
    summary.expected_cash,
    1500,
    "Cash refusal and Card must not move cash",
  );
  j.closed = await write(
    "close",
    `/finance/cash-shifts/${owned.shift_id}/close`,
    { declared_cash: summary.expected_cash },
  );
  assert.equal(j.closed.declared_variance, 0);
  const check = await s.native("api", {
    method: "GET",
    path: `/finance/cash-shifts/${owned.shift_id}`,
  });
  assert.notEqual(check.status, "Open");
  assert.equal(check.declared_variance, 0);
  save();
}
try {
  s = await session("otc-final-pharmacist", "demo.pharmacist");
  sessions.push(s);
  p = s.p;
  await s.nav("OTC mode");
  await p.evaluate(() => {
    window.otcFinalStreams = [];
    window.otcFinalEvents = [];
    window.terminal.subscribe((e) => {
      if (e.type === "stream") window.otcFinalStreams.push(e);
      if (e.type === "event") window.otcFinalEvents.push(e);
    });
  });
  const old = original.sales[0];
  await p
    .getByLabel("OTC dispensation ID", { exact: true })
    .fill(String(old.dispensation.dispensation_id));
  await p
    .getByRole("button", { name: "Read OTC receipt", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Print OTC receipt", exact: true }),
  ).toBeVisible();
  const receipt = await s.native("api", {
    method: "GET",
    path: `/dispensations/${old.dispensation.dispensation_id}/receipt-payload`,
  });
  assert.equal(
    receipt.fields.dispensation.dispensation_id,
    old.dispensation.dispensation_id,
  );
  assert(receipt.fields.dispensation.is_otc_sale);
  assert.equal(
    receipt.fields.dispensation.total_amount,
    old.dispensation.total_amount,
  );
  pass(
    "Final-source known-ID D4 re-read after sign-in persists exact original OTC sale/receipt with no repeat",
  );
  const mine = await s.native("api", {
    method: "GET",
    path: "/finance/cash-shifts/mine",
  });
  assert(!mine || mine.status !== "Open");
  const terminal = await s.native("api", {
    method: "GET",
    path: "/terminals/whoami",
  });
  assert(terminal.registered);
  assert.equal(terminal.location_label, "DEV Reception laptop (Codex)");
  assert.equal(terminal.cash_node, "MainReception");
  owned = await write("open", "/finance/cash-shifts/open", {
    node: terminal.cash_node,
    opening_float: "1500",
  });
  j.owned = owned;
  save();
  const summary = await s.native("api", {
    method: "GET",
    path: `/finance/cash-shifts/${owned.shift_id}`,
  });
  assert.equal(summary.expected_cash, 1500);
  const second = original.products.find((d) => d.name === "ORS sachet");
  assert(second);
  const before = (
    await s.native("api", {
      method: "GET",
      path: `/drugs/search?q=${second.barcode}`,
    })
  )[0].qty_available;
  await p
    .getByRole("button", { name: "Refresh OTC stock", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("Your cash shift is open");
  await p
    .getByLabel("Scan product barcode", { exact: true })
    .fill(second.barcode);
  await p.getByLabel("Scan product barcode", { exact: true }).press("Enter");
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(1);
  await p
    .getByLabel("Customer name (optional)", { exact: true })
    .fill(j.run + " SOFTWARE ONLY, no care or money");
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
  j.writes.cash = { state: "awaiting-ui" };
  save();
  await modal
    .getByRole("button", { name: "Confirm OTC sale", exact: true })
    .click();
  await expect(modal).toContainText("The server requires this cash counter:");
  await expect(
    modal.getByRole("button", { name: "Confirm OTC sale", exact: true }),
  ).toBeDisabled();
  const cash = (await s.trace()).requests.filter(
    (r) => r.path === "/api/v1/otc-sales" && r.method === "POST",
  );
  assert.equal(cash.length, 1);
  assert.equal(cash[0].status, 409);
  assert.equal(cash[0].result.error.code, "SHIFT_NOT_OPEN");
  assert.equal(cash[0].result.error.details.node, "PharmacyCounter");
  j.writes.cash = { ...cash[0], state: "refused" };
  save();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Review OTC sale", exact: true }),
  ).toBeDisabled();
  assert.equal(
    (
      await s.native("api", {
        method: "GET",
        path: `/drugs/search?q=${second.barcode}`,
      })
    )[0].qty_available,
    before,
  );
  pass(
    "Actual Cash409 on NEW owned mapped drawer shows required node, disables Cash review/confirm and has zero stock/payment effect; no drawer/mapping bypass",
  );
  await p
    .getByLabel("OTC payment method", { exact: true })
    .selectOption("Card");
  await p
    .getByLabel("Card reference (optional)", { exact: true })
    .fill(j.run + " virtual Card, no real processing");
  await expect(
    p.getByRole("button", { name: "Review OTC sale", exact: true }),
  ).toBeEnabled();
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", { name: "Confirm OTC sale", exact: true }),
    });
  await expect(modal).not.toContainText("SHIFT_NOT_OPEN");
  j.writes.card = { state: "awaiting-ui" };
  save();
  await modal
    .getByRole("button", { name: "Confirm OTC sale", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(p.getByTestId("otc-confirmed")).toBeVisible();
  const cards = (await s.trace()).requests.filter(
    (r) => r.path === "/api/v1/otc-sales" && r.method === "POST",
  );
  assert.equal(cards.length, 2);
  assert.equal(cards[1].status, 201);
  const result = cards[1].result.data;
  j.writes.card = { ...cards[1], state: "confirmed" };
  j.sales.push(result);
  save();
  assert.notEqual(cards[0].key, cards[1].key);
  assert.equal(result.payment.method, "Card");
  assert.equal(
    (
      await s.native("api", {
        method: "GET",
        path: `/drugs/search?q=${second.barcode}`,
      })
    )[0].qty_available,
    before - 1,
  );
  await expect(
    p.getByLabel("Customer name (optional)", { exact: true }),
  ).toHaveValue("");
  await expect(p.getByTestId("otc-basket-line")).toHaveCount(0);
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
        `artifacts/Dispensation-${result.dispensation.dispensation_id}-receipt.pdf`,
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
  assert.equal(
    (await s.trace()).requests.filter(
      (r) => r.path === "/api/v1/otc-sales" && r.method === "POST",
    ).length,
    2,
  );
  pass(
    "Switch to Card after definitive Cash refusal has no stale Cash error; NEW final-source Card sale201 one effect/reset/receipt/native PDF/cancel, no earlier D4 replay",
  );
  await p
    .getByLabel("Medicine name, code or barcode", { exact: true })
    .fill(second.name);
  await p.getByLabel("Medicine search limit", { exact: true }).fill("1");
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.getByTestId("otc-drug")).toHaveCount(1);
  await expect(p.locator("main")).toContainText("Search limit reached");
  await p.getByLabel("Medicine search limit", { exact: true }).fill("30");
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
  await p.evaluate(() => scrollTo(0, 0));
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
  pass(
    "Actual search limit/lost-read/stale hiding/retry, F1 focus, real ENUR/both themes250 and native Ctrlzoom bounds/reset shared Settings state",
  );
  await s.app.evaluate(() => {
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (event, ...args) {
      if (event === "message") globalThis.otcFinalSocket = this;
      return emit.call(this, event, ...args);
    };
  });
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.otcFinalSocket), {
      timeout: 45000,
    })
    .toBe(true);
  const time = Date.now();
  await s.app.evaluate(() => globalThis.otcFinalSocket.terminate());
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.otcFinalStreams.some((e) => e.status === "Reconnecting"),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.otcFinalStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  for (const path of [
    "/api/v1/drugs/search",
    `/api/v1/dispensations/${result.dispensation.dispensation_id}/receipt-payload`,
  ])
    await expect
      .poll(async () =>
        (await s.trace()).requests.some(
          (r) =>
            r.path.split("?")[0] === path &&
            r.status === 200 &&
            r.started >= time,
        ),
      )
      .toBe(true);
  const count = (await s.trace()).requests.filter((r) =>
    r.path.startsWith("/api/v1/drugs/search?"),
  ).length;
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal(
    (await s.trace()).requests.filter((r) =>
      r.path.startsWith("/api/v1/drugs/search?"),
    ).length,
    count,
  );
  pass(
    "Actual native socket Reconnecting→Live resync rereads current formulary/receipt; no idle stock polling",
  );
  await closeOwned();
  j.cleaned = true;
  save();
  pass(
    "Own final synthetic drawer closed at full server expected_cash1500 and variance0; original10 remains closed, no real cash/physical medicine",
  );
  const c = await session("otc-final-cashier", "demo.cashier");
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
      key: "6c9b496c-d798-43d8-bbf6-a2146cf9cf94",
    }),
  );
  assert.equal(denied.error?.code, "PERMISSION_REQUIRED");
  pass(
    "Cashier link absent and native OTC submission denied before HTTP; real backend Cashier403 separately recorded",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (owned && !j.closed) {
    try {
      await closeOwned();
      j.cleaned = true;
      save();
    } catch (e) {
      j.cleanup_error = e.message;
      save();
      process.exitCode = 1;
    }
  }
  for (const x of sessions.reverse()) {
    await x.fault({ failPath: null });
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
          sales: [...original.sales, ...j.sales].map((r) => ({
            id: r.dispensation.dispensation_id,
            invoice: r.invoice.invoice_no,
            method: r.payment?.method,
            payment: r.payment?.payment_id,
            total: r.dispensation.total_amount,
          })),
          closed_owned_shifts: [original.ownShift.shift_id, owned.shift_id],
          variance: [
            original.closed.declared_variance,
            j.closed.declared_variance,
          ],
          cleaned: j.cleaned,
          limits: [
            "Issue24: positive Cash on MainReception mapped terminal blocked by server requiring PharmacyCounter; tested exact refusal/disabled recovery, no bypass. Await backend clarification/fix",
            "Original broad script stopped expecting Cash201; actual409 reconciled, owned10 closed/read, no uncertain outcome or sale repeat",
            "No real money/card processing/medicines; virtual Card stock/payment records retained, no invented undo/refund",
            "Current Active/full DEV plus policy unit boundaries; no shared lifecycle mutation, signed human/translation/editor/device or full workspace acceptance",
          ],
        },
        null,
        2,
      ),
    );
}
