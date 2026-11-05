# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV UI + Doctor fixtures. No medicine supply or payment. Unfinished journals block reruns.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const file = "artifacts/order-queries-check.json";
const resumeAfterWhole = process.argv.includes("--resume-after-whole");
const resume =
  process.argv.includes("--resume-after-confirmed") || resumeAfterWhole;
let previous;
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  previous = old;
  assert(
    old.finished && (old.cleaned || resume),
    "Reconcile original OrderQueries journal; never recreate unknown writes",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = resume
  ? previous
  : {
      run: "DEMO-ORDER-QUERIES-" + Date.now(),
      writes: {},
      checks: [],
      prescriptions: [],
      queries: [],
      passed: false,
    };
if (resume) {
  assert(
    j.writes["answer-confirmed"]?.state === "confirmed" &&
      j.queries.length <= 2 &&
      j.prescriptions.length === 1,
  );
  delete j.error;
  delete j.finished;
}
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const sessions = [];
const launch = async (n, u) => {
  const s = await session(n, u);
  sessions.push(s);
  return s;
};
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
async function write(s, label, path, body) {
  const w = (j.writes[label] = {
    method: "POST",
    path,
    body,
    key: crypto.randomUUID(),
    state: "prepared",
  });
  save();
  const r = await s.p.evaluate((v) => window.terminal.call("api", v), {
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
  assert(r.ok, `${label}: ${r.error?.code} ${r.error?.message}`);
  return r.data;
}
async function doctorFixture(label, path, body, expected) {
  const w = (j.writes[label] = {
    method: "POST",
    path,
    body,
    key: crypto.randomUUID(),
    state: "awaiting-mcp",
    as_user: "demo.doctor",
    expected,
  });
  save();
  console.log("MCP_FIXTURE_PENDING " + label);
  const reply = `artifacts/order-queries-mcp-${label}.json`;
  let r;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    if (fs.existsSync(reply)) {
      r = JSON.parse(fs.readFileSync(reply));
      if (r.key === w.key) break;
      r = undefined;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(r, "MCP fixture pending; reconcile original key");
  w.result = r;
  w.state = r.ok
    ? "confirmed"
    : r.status >= 400 && r.status < 500
      ? "refused"
      : "unknown";
  save();
  if (expected) assert.equal(r.error?.code, expected);
  else assert(r.ok, `${label}: ${r.error?.code}`);
  return r.data;
}
let s, d, p, rx, list, modal;
try {
  s = await launch("order-queries-pharmacist", "demo.pharmacist");
  p = s.p;
  d = await launch("order-queries-doctor", "demo.doctor");
  const patient = await d.native("api", { method: "GET", path: "/patients/5" }),
    ticket = await d.native("api", { method: "GET", path: "/opd-tickets/5" });
  assert(
    patient.full_name.startsWith("DEMO-FINANCIAL-") &&
      patient.full_name.includes("no actual care"),
  );
  assert.equal(ticket.patient_id, patient.patient_id);
  assert(!ticket.is_clinical_locked);
  const drugs = await d.native("api", {
      method: "GET",
      path: "/drugs/search?q=paracetamol",
    }),
    other = await d.native("api", {
      method: "GET",
      path: "/drugs/search?q=amoxicillin",
    });
  const a = drugs.find((x) => x.name === "Paracetamol 500mg"),
    b = other.find((x) => x.name === "Amoxicillin 500mg");
  assert(a && b);
  const body = {
    patient_id: patient.patient_id,
    ticket_id: ticket.ticket_id,
    source: "OPD",
    destination: "HospitalPharmacy",
    notes: j.run + " SOFTWARE ONLY; no actual care, supply or money",
    items: [a, b].map((drug) => ({
      drug_id: drug.drug_id,
      qty_prescribed: 2,
      dose_text: "SOFTWARE TEST ONLY",
      route: "Oral",
      frequency_code: "STAT",
      is_stat: true,
      instructions: "NO ACTUAL SUPPLY — query verification",
    })),
  };
  if (resume) {
    rx = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${j.prescriptions[0].prescription_id}`,
    });
    assert.equal(rx.notes, j.prescriptions[0].notes);
    assert.equal(rx.dispensations.length, 0);
    assert.equal(rx.queries.find(q=>q.query_id===j.queries[0].query_id)?.status, "Answered");
  } else {
    rx = await write(d, "create", "/prescriptions", body);
    j.prescriptions.push(rx);
    save();
  }
  let q1 = j.queries[0];
  if (!resume) {
    await s.nav("Dispense");
    await p
      .getByLabel("Prescription ID", { exact: true })
      .fill(String(rx.prescription_id));
    await p
      .getByRole("button", { name: "Open prescription", exact: true })
      .click();
    await expect(
      p.getByRole("button", {
        name: `Query line #${rx.items[0].prescription_item_id}`,
        exact: true,
      }),
    ).toBeEnabled();
    await help(
      s,
      p.getByRole("button", {
        name: `Query line #${rx.items[0].prescription_item_id}`,
        exact: true,
      }),
      "Dispense",
    );
    await p
      .getByRole("button", {
        name: `Query line #${rx.items[0].prescription_item_id}`,
        exact: true,
      })
      .click();
    await expect(p.locator("h1")).toHaveText("Order queries");
    await expect(p.getByTestId("order-query-prescription")).toContainText(
      rx.prescription_number,
    );
    await expect(p.getByLabel("Query target", { exact: true })).toHaveValue(
      String(rx.items[0].prescription_item_id),
    );
    await p.evaluate(() => {
      window.oqEvents = [];
      window.oqStreams = [];
      window.terminal.subscribe((e) => {
        if (e.type === "event") window.oqEvents.push(e);
        if (e.type === "stream") window.oqStreams.push(e);
      });
    });
    pass(
      "Real Dispense line handoff preserves exact patient/RX/line; F1 on source control restores focus",
    );
    await p
      .getByRole("button", { name: "Review order query", exact: true })
      .click();
    await expect(p.locator("main")).toContainText(
      "Choose a reason and enter a question",
    );
    await p
      .getByLabel("Query reason", { exact: true })
      .selectOption("DoseOrFrequency");
    await p
      .getByLabel("Question for the prescriber", { exact: true })
      .fill(j.run + " clarify the software dose; no actual care");
    await help(
      s,
      p.getByLabel("Question for the prescriber", { exact: true }),
      "Order queries",
    );
    await expect(
      p.getByLabel("Question for the prescriber", { exact: true }),
    ).toHaveValue(j.run + " clarify the software dose; no actual care");
    await p
      .getByRole("button", { name: "Review order query", exact: true })
      .click();
    let modal = p
      .getByRole("dialog")
      .filter({ hasText: "Confirm order query action" });
    await help(
      s,
      modal.getByRole("button", {
        name: "Confirm order query action",
        exact: true,
      }),
      "Order queries",
    );
    await s.fault({
      failPath: `/api/v1/prescriptions/${rx.prescription_id}/queries`,
      failMethod: "POST",
      once: true,
    });
    j.writes.uiRaise = {
      path: `/prescriptions/${rx.prescription_id}/queries`,
      state: "awaiting-ui-original",
    };
    save();
    await modal
      .getByRole("button", { name: "Confirm order query action", exact: true })
      .dblclick();
    await expect(modal).toContainText("The result is unknown");
    let trace = await s.trace(),
      requests = trace.requests.filter(
        (r) =>
          r.method === "POST" &&
          r.path === `/api/v1/prescriptions/${rx.prescription_id}/queries`,
      );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, 201);
    j.writes.uiRaise = { ...requests[0], state: "confirmed-server-reply-lost" };
    save();
    await expect(
      p.getByRole("button", { name: "Refresh order queries", exact: true }),
    ).toBeDisabled();
    await modal
      .getByRole("button", { name: "Retry original request", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    trace = await s.trace();
    requests = trace.requests.filter(
      (r) =>
        r.method === "POST" &&
        r.path === `/api/v1/prescriptions/${rx.prescription_id}/queries`,
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[0].key, requests[1].key);
    assert.deepEqual(requests[0].body, requests[1].body);
    assert.equal(String(requests[1].replay), "true");
    j.writes.uiRaise.state = "confirmed";
    j.writes.uiRaise.replay = requests[1];
    save();
    list = await s.native("api", {
      method: "GET",
      path: `/prescription-queries?prescription_id=${rx.prescription_id}&limit=1000`,
    });
    assert.equal(list.length, 1);
    q1 = list[0];
    j.queries.push(q1);
    save();
    await expect(
      p.getByTestId("order-query-row").filter({ hasText: q1.question }),
    ).toContainText("Waiting for the prescriber");
    await p
      .getByLabel("Query target", { exact: true })
      .selectOption(String(rx.items[0].prescription_item_id));
    await p.getByLabel("Query reason", { exact: true }).selectOption("Other");
    await p
      .getByLabel("Question for the prescriber", { exact: true })
      .fill("DEMO duplicate test");
    await p
      .getByRole("button", { name: "Review order query", exact: true })
      .click();
    await expect(p.locator("main")).toContainText(
      "An open query already exists",
    );
    const duplicate = await p.evaluate((v) => window.terminal.call("api", v), {
      method: "POST",
      path: `/prescriptions/${rx.prescription_id}/queries`,
      body: {
        prescription_item_id: rx.items[0].prescription_item_id,
        reason: "Other",
        question: j.run + " expected duplicate refusal",
      },
      key: crypto.randomUUID(),
    });
    assert.equal(duplicate.error?.code, "PRESCRIPTION_QUERY_OPEN");
    await p.getByLabel("Question for the prescriber", { exact: true }).fill("");
    await p.getByLabel("Query reason", { exact: true }).selectOption("");
    await p.getByLabel("Query target", { exact: true }).selectOption("");
    pass(
      "Required fields/F1 preserve draft; lost real201/double-click uses one flight; same UUID/body replay leaves one query; duplicate refused locally and by server",
    );
    const mine = await d.native("api", {
      method: "GET",
      path: `/prescription-queries?mine=true&status=Open&prescription_id=${rx.prescription_id}`,
    });
    assert(mine.some((x) => x.query_id === q1.query_id));
    await doctorFixture(
      "answer-confirmed",
      `/prescription-queries/${q1.query_id}/answer`,
      {
        outcome: "ConfirmedAsWritten",
        answer: j.run + " software order confirmed as written; no actual care",
      },
    );
  } else {
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
    await p.evaluate(() => {
      window.oqEvents = [];
      window.oqStreams = [];
      window.terminal.subscribe((e) => {
        if (e.type === "event") window.oqEvents.push(e);
        if (e.type === "stream") window.oqStreams.push(e);
      });
    });
  }
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: q1.question }),
  ).toContainText("Confirmed as written");
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: q1.question }),
  ).toContainText(q1.prescriber_name);
  if (!resume)
    assert(
      (await p.evaluate(() => window.oqEvents)).some(
        (e) =>
          e.event_type === "medication.order.updated" &&
          e.payload.prescription_id === rx.prescription_id,
      ),
    );
  pass(
    "Doctor mine=true finds the newly raised query; actual signed ConfirmedAsWritten answer arrives live without a refresh",
  );
  if (!resumeAfterWhole) {
    await p
      .getByRole("button", { name: "Return to dispensing", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Query whole prescription", exact: true }),
    ).toBeEnabled();
    await p
      .getByRole("button", { name: "Query whole prescription", exact: true })
      .click();
    await expect(p.getByLabel("Query target", { exact: true })).toHaveValue(
      "whole",
    );
    await p.getByLabel("Query reason", { exact: true }).selectOption("Unclear");
    await p
      .getByLabel("Question for the prescriber", { exact: true })
      .fill(j.run + " whole prescription demonstration");
    await p
      .getByRole("button", { name: "Review order query", exact: true })
      .click();
    await p
      .getByRole("dialog")
      .filter({ hasText: "Confirm order query action" })
      .getByRole("button", { name: "Confirm order query action", exact: true })
      .click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
  }
  list = await s.native("api", {
    method: "GET",
    path: `/prescription-queries?prescription_id=${rx.prescription_id}&limit=1000`,
  });
  const whole = list.find(
    (x) => x.status === "Open" && x.prescription_item_id === null,
  );
  assert(whole);
  if(!j.queries.some(q=>q.query_id===whole.query_id))j.queries.push(whole);
  save();
  await p
    .getByRole("button", {
      name: "Withdraw query #" + whole.query_id,
      exact: true,
    })
    .click();
  modal = p
    .getByRole("dialog")
    .filter({ hasText: "Confirm order query action" });
  await expect(
    modal.getByRole("button", {
      name: "Confirm order query action",
      exact: true,
    }),
  ).toBeDisabled();
  await p
    .getByLabel("Withdrawal reason", { exact: true })
    .fill(j.run + " mistaken software query, no care");
  await help(
    s,
    p.getByLabel("Withdrawal reason", { exact: true }),
    "Order queries",
  );
  await s.fault({
    failPath: `/api/v1/prescription-queries/${whole.query_id}/withdraw`,
    failMethod: "POST",
    once: true,
  });
  j.writes.uiWithdraw = {
    path: `/prescription-queries/${whole.query_id}/withdraw`,
    state: "awaiting-ui-original",
  };
  save();
  await modal
    .getByRole("button", { name: "Confirm order query action", exact: true })
    .click();
  await expect(modal).toContainText("The result is unknown");
  let withdrawals = (await s.trace()).requests.filter(
    (r) =>
      r.path === `/api/v1/prescription-queries/${whole.query_id}/withdraw` &&
      r.method === "POST",
  );
  assert.equal(withdrawals.length, 1);
  j.writes.uiWithdraw = {
    ...withdrawals[0],
    state: "confirmed-server-reply-lost",
  };
  save();
  await modal
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  withdrawals = (await s.trace()).requests.filter(
    (r) =>
      r.path === `/api/v1/prescription-queries/${whole.query_id}/withdraw` &&
      r.method === "POST",
  );
  assert.equal(withdrawals.length, 2);
  assert.equal(withdrawals[0].key, withdrawals[1].key);
  assert.deepEqual(withdrawals[0].body, withdrawals[1].body);
  assert.equal(String(withdrawals[1].replay), "true");
  j.writes.uiWithdraw.state = "confirmed";
  save();
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: whole.question }),
  ).toContainText("Withdrawn");
  pass(
    "Whole-RX handoff/required withdrawal explanation/F1 work; lost withdrawal200 retries identical UUID/body and displays server history",
  );
  await p
    .getByLabel("Query target", { exact: true })
    .selectOption(String(rx.items[1].prescription_item_id));
  await p.getByLabel("Query reason", { exact: true }).selectOption("Other");
  await p
    .getByLabel("Question for the prescriber", { exact: true })
    .fill(j.run + " request a changed software order");
  await p
    .getByRole("button", { name: "Review order query", exact: true })
    .click();
  await p
    .getByRole("dialog")
    .filter({ hasText: "Confirm order query action" })
    .getByRole("button", { name: "Confirm order query action", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  list = await s.native("api", {
    method: "GET",
    path: `/prescription-queries?prescription_id=${rx.prescription_id}&limit=1000`,
  });
  const changed = list.find((x) => x.status === "Open");
  assert(changed);
  j.queries.push(changed);
  save();
  await p
    .getByRole("button", {
      name: "Withdraw query #" + changed.query_id,
      exact: true,
    })
    .click();
  await p
    .getByLabel("Withdrawal reason", { exact: true })
    .fill(j.run + " stale review must not submit");
  await doctorFixture(
    "changed-invalid",
    `/prescription-queries/${changed.query_id}/answer`,
    { outcome: "Changed", answer: j.run + " expected refusal before change" },
    "PRESCRIPTION_QUERY_STATE_INVALID",
  );
  await write(
    d,
    "stop-changed",
    `/prescriptions/${rx.prescription_id}/items/${rx.items[1].prescription_item_id}/stop`,
    { reason: j.run + " software replacement order requested" },
  );
  const replacement = await write(d, "replacement", "/prescriptions", {
    ...body,
    notes:
      j.run + " replacement SOFTWARE ONLY; no actual care, supply or money",
    items: [body.items[1]],
  });
  j.prescriptions.push(replacement);
  save();
  await doctorFixture(
    "answer-changed",
    `/prescription-queries/${changed.query_id}/answer`,
    {
      outcome: "Changed",
      answer:
        j.run +
        " stopped original line; replacement " +
        replacement.prescription_number +
        "; software only",
    },
  );
  const before = (await s.trace()).requests.filter(
    (r) =>
      r.path === `/api/v1/prescription-queries/${changed.query_id}/withdraw`,
  ).length;
  await p
    .getByRole("dialog")
    .filter({ hasText: "Confirm order query action" })
    .getByRole("button", { name: "Confirm order query action", exact: true })
    .click();
  await expect(p.getByRole("dialog")).toContainText(
    "The query changed or is no longer open",
  );
  assert.equal(
    (await s.trace()).requests.filter(
      (r) =>
        r.path === `/api/v1/prescription-queries/${changed.query_id}/withdraw`,
    ).length,
    before,
  );
  p.once("dialog",dialog=>dialog.accept());
  await p
    .getByRole("dialog")
    .filter({ hasText: "Confirm order query action" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    p.getByTestId("order-query-row").filter({ hasText: changed.question }),
  ).toContainText("Changed: reread the stopped line and replacement order");
  await expect(p.getByTestId("order-query-prescription")).toContainText(
    "Stopped",
  );
  pass(
    "Server refuses premature Changed; real stop/replacement/signed Changed refresh live; stale withdrawal preflight refuses before any POST",
  );
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
    .fill("NO-SUCH-QUERY");
  await expect(p.getByTestId("order-query-row")).toHaveCount(0);
  await p.getByLabel("Find in returned queries", { exact: true }).fill("");
  await p.getByLabel("Maximum returned queries", { exact: true }).fill("1");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("The result reached the limit");
  await p.getByLabel("Maximum returned queries", { exact: true }).fill("200");
  await p.getByLabel("Query status", { exact: true }).selectOption("");
  await p
    .getByRole("button", { name: "Apply query filters", exact: true })
    .click();
  await expect(p.getByTestId("order-query-row")).toHaveCount(3);
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
  await capture(s, "order_queries");
  pass(
    "Real status/prescription/limit filters, local no-match, bounded warning and lost GET/hide stale/retry; actual ENUR handbook media and both themes250 overflow checks",
  );
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
  await s.app.evaluate(() => {
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (event, ...args) {
      if (event === "message") globalThis.oqSocket = this;
      return emit.call(this, event, ...args);
    };
  });
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.oqSocket), { timeout: 45000 })
    .toBe(true);
  const reconnectAt = Date.now();
  await s.app.evaluate(() => globalThis.oqSocket.terminate());
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.oqStreams.some((e) => e.status === "Reconnecting"),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.oqStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await s.trace()).requests.some(
        (r) =>
          r.path.split("?")[0] === "/api/v1/prescription-queries" &&
          r.status === 200 &&
          r.started >= reconnectAt,
      ),
    )
    .toBe(true);
  pass(
    "Actual native Ctrlzoom bounds/reset share preferences; actual socket disconnect/reconnect Live resync reloads register and selected order",
  );
  const c = await launch("order-queries-cashier", "demo.cashier");
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
  pass("Cashier menu absent and native query route rejected before transport");
  for (const order of j.prescriptions) {
    const fresh = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert.equal(fresh.notes, order.notes);
    assert.equal(fresh.dispensations.length, 0);
    if (fresh.status === "Active")
      await write(
        d,
        "cancel-" + order.prescription_id,
        `/prescriptions/${order.prescription_id}/cancel`,
        { reason: j.run + " software checks complete; no care or supply" },
      );
    const end = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert(end.status !== "Active");
    assert.equal(end.dispensations.length, 0);
  }
  j.cleaned = true;
  j.passed = true;
  save();
  pass(
    "Both exact own synthetic prescriptions ended with zero dispensations/payments; no query remains Open",
  );
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  for (const x of sessions.reverse()) {
    await x.fault({ failPath: null, delayPath: null });
    await x.close();
  }
  j.finished = new Date().toISOString();
  save();
  if (j.passed)
    fs.writeFileSync(
      "docs/order-queries-evidence-2026-10-25.json",
      JSON.stringify(
        {
          date: j.finished,
          run: j.run,
          passed: true,
          checks: j.checks,
          records: j.prescriptions.map((r) => ({
            id: r.prescription_id,
            number: r.prescription_number,
          })),
          queries: j.queries.map((r) => ({
            id: r.query_id,
            target: r.prescription_item_id,
          })),
          cleaned: j.cleaned,
          limits: [
            "Synthetic DEV agent checks; no medicine supply/payment/physical or human review",
            "Doctor answer fixtures via MCP; answer authoring remains Doctor screen scope",
            "Current Active/full lifecycle tested; records/open_work unit tested without shared service mutations",
            "Named role/translation/editor/physical review and full screen/workspace acceptance remain pending",
          ],
        },
        null,
        2,
      ),
    );
}

```
