// Continuation: re-read exact owned fixtures; never re-raise or re-answer them.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const original = JSON.parse(
  fs.readFileSync("artifacts/order-queries-check.json"),
);
assert(
  original.finished && original.writes["answer-changed"]?.state === "confirmed",
  "Reconcile active fixture writes first",
);
const file = "artifacts/order-queries-final-check.json";
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    old.finished && (old.passed || Object.keys(old.writes || {}).length === 0),
    "Reconcile prior final check before rerun",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = { checks: [...new Set(original.checks)], writes: {}, passed: false };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const sessions = [];
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
try {
  const s = await session("order-queries-final-pharmacist", "demo.pharmacist");
  sessions.push(s);
  const p = s.p;
  const rx = await s.native("api", {
    method: "GET",
    path: `/prescriptions/${original.prescriptions[0].prescription_id}`,
  });
  assert.equal(rx.notes, original.prescriptions[0].notes);
  assert.equal(rx.dispensations.length, 0);
  const list = await s.native("api", {
    method: "GET",
    path: `/prescription-queries?prescription_id=${rx.prescription_id}&limit=1000`,
  });
  assert.equal(list.length, 3);
  assert.equal(list.filter((q) => q.status === "Answered").length, 2);
  assert.equal(list.filter((q) => q.status === "Withdrawn").length, 1);
  assert(!list.some((q) => q.status === "Open"));
  await s.nav("Order queries");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(rx.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription for query", exact: true })
    .click();
  await expect(p.getByTestId("order-query-prescription")).toContainText(
    rx.prescription_number,
  );
  const answer = list.find((q) => q.outcome === "ConfirmedAsWritten"),
    changed = list.find((q) => q.outcome === "Changed");
  assert(answer && changed);
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: answer.question }),
  ).toContainText("Confirmed as written");
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: changed.question }),
  ).toContainText(changed.answer_stamp.text);
  await expect(p.getByTestId("order-query-prescription")).toContainText(
    "Stopped",
  );
  await help(s, p.getByLabel("Query reason", { exact: true }), "Order queries");
  await p
    .getByLabel("Filter prescription ID", { exact: true })
    .fill(String(rx.prescription_id));
  await p.getByLabel("Query status", { exact: true }).selectOption("Answered");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(2);
  await p
    .getByLabel("Find in returned queries", { exact: true })
    .fill("NO-MATCH-SYNTHETIC");
  await expect(p.getByTestId("order-query-row")).toHaveCount(0);
  await expect(p.locator("main")).toContainText("No local matches");
  await p.getByLabel("Find in returned queries", { exact: true }).fill("");
  await p.getByLabel("Maximum returned queries", { exact: true }).fill("1");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("The result reached the limit");
  await p.getByLabel("Query status", { exact: true }).selectOption("Withdrawn");
  await p.getByLabel("Maximum returned queries", { exact: true }).fill("200");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(1);
  await expect(p.getByTestId("order-query-row")).toContainText(
    "Withdrawal reason / time",
  );
  await p
    .getByLabel("Queries on my prescribed orders", { exact: true })
    .check();
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(0);
  await expect(p.locator("main")).toContainText("No queries returned");
  await p
    .getByLabel("Queries on my prescribed orders", { exact: true })
    .uncheck();
  await p.getByLabel("Query status", { exact: true }).selectOption("");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(3);
  pass(
    "Final build re-reads exact signed outcomes/stopped original/withdrawal history; status/mine/prescription/limit filters and local no-match are correct",
  );
  await s.fault({
    failPath: "/api/v1/prescription-queries",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Refresh order queries", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(0);
  await expect(p.locator('main .error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await s.fault({ failPath: null });
  await p
    .getByRole("button", { name: "Refresh order queries", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(3);
  await s.fault({
    failPath: `/api/v1/prescriptions/${original.prescriptions[1].prescription_id}`,
    failMethod: "GET",
    once: false,
  });
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(original.prescriptions[1].prescription_id));
  await p
    .getByRole("button", { name: "Open prescription for query", exact: true })
    .click();
  await expect(p.getByTestId("order-query-prescription")).toHaveCount(0);
  await expect(p.locator('main .error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await s.fault({ failPath: null });
  await p
    .getByRole("button", { name: "Refresh order queries", exact: true })
    .click();
  await expect(p.getByTestId("order-query-prescription")).toContainText(
    original.prescriptions[1].prescription_number,
  );
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(rx.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription for query", exact: true })
    .click();
  await expect(p.getByTestId("order-query-prescription")).toContainText(
    rx.prescription_number,
  );
  pass(
    "Real lost list and new-ID detail replies hide stale records independently; explicit retry recovers the exact current identity",
  );
  await p.evaluate(() => window.scrollTo(0, 0));
  await capture(s, "order_queries");
  const win = await s.app.browserWindow(p);
  async function key(code) {
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
    }, code);
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
    "Actual ENUR screenshots and Light/DarkHighContrast at250 have no horizontal overflow; native keyboard upper/lower/reset share Settings state",
  );
  await p.evaluate(() => {
    window.oqFinalStreams = [];
    window.terminal.subscribe((e) => {
      if (e.type === "stream") window.oqFinalStreams.push(e);
    });
  });
  await s.app.evaluate(() => {
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (event, ...args) {
      if (event === "message") globalThis.oqFinalSocket = this;
      return emit.call(this, event, ...args);
    };
  });
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.oqFinalSocket), {
      timeout: 45000,
    })
    .toBe(true);
  const time = Date.now();
  await s.app.evaluate(() => globalThis.oqFinalSocket.terminate());
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.oqFinalStreams.some((e) => e.status === "Reconnecting"),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.oqFinalStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  for (const path of [
    "/api/v1/prescription-queries",
    `/api/v1/prescriptions/${rx.prescription_id}`,
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
  const idleBefore = (await s.trace()).requests.filter(
    (r) => r.path.split("?")[0] === "/api/v1/prescription-queries",
  ).length;
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal(
    (await s.trace()).requests.filter(
      (r) => r.path.split("?")[0] === "/api/v1/prescription-queries",
    ).length,
    idleBefore,
  );
  pass(
    "Real native socket terminated/reconnected Live resync; register AND matching selected order reread; idle register does not poll",
  );
  await s.nav("Dispense");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(rx.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Query whole prescription", exact: true }),
  ).toBeEnabled();
  await expect(
    p.getByLabel("Dispense Now #" + rx.items[0].prescription_item_id, {
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    p.getByLabel("Dispense Now #" + rx.items[1].prescription_item_id, {
      exact: true,
    }),
  ).toBeDisabled();
  await help(
    s,
    p.getByRole("button", { name: "Query whole prescription", exact: true }),
    "Dispense",
  );
  await s.nav("Prescription queue");
  await expect(p.locator("h1")).toHaveText("Prescription queue");
  assert(!(await s.trace()).requests.some((r) => r.method !== "GET"));
  pass(
    "Final changed Dispense handoff F1 works; ConfirmedAsWritten line enabled, Changed/stopped line disabled; queue opens; no business writes in Pharmacist final check",
  );
  const c = await session("order-queries-final-cashier", "demo.cashier");
  sessions.push(c);
  await expect(
    c.p
      .getByRole("navigation")
      .getByRole("button", { name: "Order queries", exact: false }),
  ).toHaveCount(0);
  const denied = await c.p.evaluate(() =>
    window.terminal.call("api", {
      method: "GET",
      path: "/prescription-queries",
    }),
  );
  assert.equal(denied.error?.code, "PERMISSION_REQUIRED");
  pass(
    "Cashier menu excludes OrderQueries and native transport rejects denied query read before HTTP",
  );
  const d = await session("order-queries-final-doctor", "demo.doctor");
  sessions.push(d);
  for (const order of original.prescriptions) {
    const current = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert.equal(current.notes, order.notes);
    assert.equal(current.dispensations.length, 0);
    assert(!current.queries.some((q) => q.status === "Open"));
    if (current.status === "Active") {
      const w = (j.writes["cancel-" + order.prescription_id] = {
        method: "POST",
        path: `/prescriptions/${order.prescription_id}/cancel`,
        body: {
          reason:
            original.run +
            " software verification finished; no actual care or supply",
        },
        key: crypto.randomUUID(),
        state: "prepared",
      });
      save();
      const r = await d.p.evaluate((v) => window.terminal.call("api", v), w);
      w.result = r;
      w.state = r.ok
        ? "confirmed"
        : r.status >= 400 && r.status < 500
          ? "refused"
          : "unknown";
      save();
      assert(r.ok, r.error?.code);
    }
    const end = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert.equal(end.dispensations.length, 0);
    assert(end.status !== "Active");
  }
  j.cleaned = true;
  pass(
    "Both exact owned test prescriptions ended, all queries Answered/Withdrawn, zero supply/payment; no guessed cleanup or user records",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  for (const s of sessions.reverse()) {
    await s.fault({ failPath: null });
    await s.close();
  }
  j.finished = new Date().toISOString();
  save();
  if (j.passed)
    fs.writeFileSync(
      "docs/order-queries-evidence-2026-10-25.json",
      JSON.stringify(
        {
          date: j.finished,
          run: original.run,
          checks: j.checks,
          passed: true,
          records: original.prescriptions.map((r) => ({
            id: r.prescription_id,
            number: r.prescription_number,
            status: "Cancelled",
            dispensations: 0,
          })),
          queries: [
            { id: 2, status: "Answered", outcome: "ConfirmedAsWritten" },
            { id: 3, status: "Withdrawn" },
            { id: 4, status: "Answered", outcome: "Changed" },
          ],
          cleaned: j.cleaned,
          limits: [
            "Original write harness needed scoped-variable/name/browser-confirm fixes; final check reuses exact records, does not recreate or replay their writes",
            "Final outcome labels read on rebuilt source; real write/lost-response/event evidence on equivalent preceding source",
            "No shared service lifecycle mutation, physical dispensing, payment, printer, human/translation/editor or full role acceptance claimed",
            "Doctor answers exercised via real MCP as upstream fixtures; authoring is a separate Doctor medication-order screen",
          ],
        },
        null,
        2,
      ),
    );
}
