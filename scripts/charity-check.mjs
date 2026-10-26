// Actual DEV Pharmacy→independent Zakat officer→separate virtual dispense. No real care, cash or physical supply.
// Original UUID/body/state are journaled. Never rerun an unfinished journal or repeat a terminal supply.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const file = "artifacts/charity-check.json";
if (fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file));
  assert(
    old.finished && old.cleaned,
    "Reconcile original charity requests/supplies before rerun",
  );
  fs.copyFileSync(file, file.replace(".json", `-${Date.now()}.json`));
}
const j = {
  run: "DEMO-CHARITY-" + Date.now(),
  writes: {},
  prescriptions: [],
  approvals: [],
  dispensations: [],
  checks: [],
  passed: false,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const instances = [];
let s, d, z, p;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
const launch = async (n, u) => {
  const x = await session(n, u);
  instances.push(x);
  return x;
};
async function write(actor, label, path, body, expected) {
  assert(!j.writes[label]);
  const w = (j.writes[label] = {
    method: "POST",
    path,
    body,
    key: crypto.randomUUID(),
    state: "prepared",
  });
  save();
  const r = await actor.p.evaluate((v) => window.terminal.call("api", v), {
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
  return r.data;
}
const modal = () =>
  p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", {
        name: "Confirm assistance request",
        exact: true,
      }),
    });
const posts = async (actor, path) =>
  (await actor.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1" + path,
  );
async function openAssistance(order, fund, text, counter = false, signer = "") {
  if ((await p.locator("h1").innerText()) !== "Zakat / charity override")
    await s.nav("Zakat / charity override");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(order.prescription_id));
  await p
    .getByRole("button", {
      name: "Open prescription for assistance",
      exact: true,
    })
    .click();
  await expect(p.getByTestId("charity-prescription")).toContainText(
    order.prescription_number,
  );
  await p.getByLabel("Assistance fund", { exact: true }).selectOption(fund);
  await p.getByLabel("Assistance reason", { exact: true }).fill(text);
  await p
    .getByLabel("Officer co-signs at this counter", { exact: true })
    .setChecked(counter);
  if (counter)
    await p
      .getByLabel("Co-signing officer username", { exact: true })
      .fill(signer);
  await p
    .getByRole("button", { name: "Review assistance request", exact: true })
    .click();
  await expect(modal()).toBeVisible();
}
async function queue(label, order, fund, text, lost = false) {
  await openAssistance(order, fund, text);
  const before = (await posts(s, "/pharmacy/charity-override-request")).length;
  j.writes[label] = {
    prescription_id: order.prescription_id,
    fund,
    reason: text,
    state: "awaiting-ui",
  };
  save();
  if (lost)
    await s.fault({
      failPath: "/api/v1/pharmacy/charity-override-request",
      failMethod: "POST",
      once: true,
    });
  await modal()
    .getByRole("button", { name: "Confirm assistance request", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  if (lost) {
    await expect(modal()).toContainText("The result is unknown");
    let requests = (await posts(s, "/pharmacy/charity-override-request")).slice(
      before,
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, 201);
    j.writes[label] = { ...requests[0], state: "confirmed-server-reply-lost" };
    save();
    await expect(
      p.getByRole("button", {
        name: "Refresh assistance requests",
        exact: true,
      }),
    ).toBeDisabled();
    await modal()
      .getByRole("button", {
        name: "Retry original assistance request",
        exact: true,
      })
      .click();
  }
  await expect(modal()).toHaveCount(0);
  const requests = (await posts(s, "/pharmacy/charity-override-request")).slice(
    before,
  );
  assert.equal(requests.length, lost ? 2 : 1);
  if (lost) {
    assert.equal(requests[0].key, requests[1].key);
    assert.deepEqual(requests[0].body, requests[1].body);
    assert.equal(String(requests[1].replay), "true");
  }
  assert.equal(requests.at(-1).status, 201);
  const a = requests.at(-1).result.data;
  assert.equal(a.status, "Pending");
  j.writes[label] = {
    ...requests[0],
    state: "confirmed",
    replay: lost ? requests[1] : undefined,
  };
  j.approvals.push(a);
  save();
  await expect(p.getByTestId("charity-decision")).toContainText("Pending");
  return a;
}
async function decide(actor, a, action) {
  const label = action + "-" + a.request_id;
  j.writes[label] = { request_id: a.request_id, state: "awaiting-ui" };
  save();
  await actor.nav(action === "Cancel" ? "Approvals" : "Charity approvals");
  if (action === "Cancel")
    await actor.p.getByLabel("My requests", { exact: true }).check();
  await actor.p
    .getByLabel("Approval status", { exact: true })
    .selectOption("Pending");
  await actor.p
    .getByRole("button", {
      name: `Request ${a.request_id}: ${a.summary}`,
      exact: true,
    })
    .click();
  await actor.p
    .getByLabel("Decision note", { exact: true })
    .fill(j.run + " software-only " + action + "; no actual care or money");
  await actor.p
    .getByRole("button", {
      name: action === "Cancel" ? "Cancel request" : action,
      exact: true,
    })
    .click();
  await actor.p
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm " + action, exact: true })
    .click();
  await expect(actor.p.getByRole("dialog")).toHaveCount(0);
  const current = await actor.native("api", {
    method: "GET",
    path: `/approvals/${a.request_id}`,
  });
  assert.equal(
    current.status,
    { Approve: "Approved", Reject: "Rejected", Cancel: "Cancelled" }[action],
  );
  j.writes[label] = {
    request_id: a.request_id,
    state: "confirmed",
    result: current,
  };
  save();
  return current;
}
async function useApproval(order, a, fund, checkWrongFund = false) {
  if ((await p.locator("h1").innerText()) !== "Zakat / charity override")
    await s.nav("Zakat / charity override");
  await p
    .getByLabel("Assistance request ID", { exact: true })
    .fill(String(a.request_id));
  await p.getByRole("button", { name: "Read request ID", exact: true }).click();
  await expect(p.getByTestId("charity-decision")).toContainText("Approved");
  await p
    .getByRole("button", { name: "Review request prescription", exact: true })
    .click();
  await expect(p.getByTestId("charity-prescription")).toContainText(
    order.prescription_number,
  );
  await p
    .getByRole("button", {
      name: "Use approved assistance in Dispense",
      exact: true,
    })
    .click();
  await expect(p.locator("h1")).toHaveText("Dispense");
  await expect(p.getByLabel("Payment mode", { exact: true })).toHaveValue(fund);
  await expect(
    p.getByLabel("Approved charity request ID", { exact: true }),
  ).toHaveValue(String(a.request_id));
  const qty = p.getByLabel(
    "Dispense Now #" + order.items[0].prescription_item_id,
    { exact: true },
  );
  await expect(qty).toHaveValue("");
  await qty.fill("1");
  const dm = () =>
    p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", {
          name: "Confirm pharmacy action",
          exact: true,
        }),
      });
  const path = `/prescriptions/${order.prescription_id}/dispense`;
  const count = (await posts(s, path)).length;
  if (checkWrongFund) {
    await p
      .getByLabel("Payment mode", { exact: true })
      .selectOption("SocialWelfare");
    await p
      .getByRole("button", { name: "Review dispensing", exact: true })
      .click();
    await dm()
      .getByLabel(
        "I verified this patient, order, quantities and payment mode.",
        { exact: true },
      )
      .check();
    await dm()
      .getByRole("button", { name: "Confirm pharmacy action", exact: true })
      .click();
    await expect(dm()).toContainText("The approved fund does not match");
    assert.equal((await posts(s, path)).length, count);
    await dm().getByRole("button", { name: "Close", exact: true }).click();
    await p.getByLabel("Payment mode", { exact: true }).selectOption(fund);
  }
  await p
    .getByRole("button", { name: "Review dispensing", exact: true })
    .click();
  await expect(dm()).not.toContainText("The approved fund does not match");
  await dm()
    .getByLabel(
      "I verified this patient, order, quantities and payment mode.",
      { exact: true },
    )
    .check();
  j.writes["supply-" + order.prescription_id] = {
    path,
    approval_id: a.request_id,
    state: "awaiting-ui",
  };
  save();
  await dm()
    .getByRole("button", { name: "Confirm pharmacy action", exact: true })
    .click();
  await expect(dm()).toHaveCount(0);
  const r = (await posts(s, path)).slice(count);
  assert.equal(r.length, 1);
  assert.equal(r[0].status, 201);
  const result = r[0].result.data;
  assert.equal(result.dispensation.payment_mode, fund);
  assert.notEqual(result.payment?.method, "Cash");
  assert(!result.payment?.shift_id);
  j.writes["supply-" + order.prescription_id] = { ...r[0], state: "confirmed" };
  j.dispensations.push(result);
  save();
  return result;
}
try {
  s = await launch("charity-pharmacist", "demo.pharmacist");
  p = s.p;
  p.on("dialog", (dialog) => dialog.accept());
  d = await launch("charity-doctor", "demo.doctor");
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
    drug = drugs.find((x) => x.name === "Paracetamol 500mg");
  assert(drug);
  for (const tag of [
    "queued-Zakat",
    "counter-SocialWelfare",
    "reject-cancel-only",
  ]) {
    const order = await write(d, "create-" + tag, "/prescriptions", {
      patient_id: patient.patient_id,
      ticket_id: ticket.ticket_id,
      source: "OPD",
      destination: "HospitalPharmacy",
      notes:
        j.run +
        " " +
        tag +
        " SOFTWARE TEST ONLY; no actual care or physical medicine/money",
      items: [
        {
          drug_id: drug.drug_id,
          qty_prescribed: 1,
          dose_text: "SOFTWARE VERIFICATION ONLY",
          route: "Oral",
          frequency_code: "STAT",
          is_stat: true,
          instructions:
            "NO PHYSICAL SUPPLY — software authorisation verification",
        },
      ],
    });
    j.prescriptions.push(order);
    save();
  }
  const [normal, social, unused] = j.prescriptions;
  await s.nav("Dispense");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(normal.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription", exact: true })
    .click();
  await expect(
    p.getByRole("button", {
      name: "Request Zakat / charity assistance",
      exact: true,
    }),
  ).toBeEnabled();
  await help(
    s,
    p.getByRole("button", {
      name: "Request Zakat / charity assistance",
      exact: true,
    }),
    "Dispense",
  );
  await p
    .getByRole("button", {
      name: "Request Zakat / charity assistance",
      exact: true,
    })
    .click();
  await expect(p.getByTestId("charity-prescription")).toContainText(
    normal.prescription_number,
  );
  await p
    .getByRole("button", { name: "Review assistance request", exact: true })
    .click();
  await expect(p.locator("main")).toContainText(
    "Choose a fund and enter a reason",
  );
  await p
    .getByLabel("Assistance reason", { exact: true })
    .fill(j.run + " temporary help draft");
  await help(
    s,
    p.getByLabel("Assistance reason", { exact: true }),
    "Zakat / charity override",
  );
  await expect(p.getByLabel("Assistance reason", { exact: true })).toHaveValue(
    j.run + " temporary help draft",
  );
  await p.getByLabel("Assistance reason", { exact: true }).fill("");
  await p.evaluate(() => {
    window.charityEvents = [];
    window.charityStreams = [];
    window.terminal.subscribe((e) => {
      if (e.type === "event") window.charityEvents.push(e);
      if (e.type === "stream") window.charityStreams.push(e);
    });
  });
  const pending = await queue(
    "queued",
    normal,
    "Zakat",
    j.run + " Zakat queue SOFTWARE ONLY",
    true,
  );
  await expect(
    p.getByRole("button", {
      name: "Use approved assistance in Dispense",
      exact: true,
    }),
  ).toHaveCount(0);
  pass(
    "Fresh own RX exact Dispense handoff/F1/required reason; queued request lost201/double click one flight/original UUID+body replay one Pending, no early dispense authorisation",
  );
  z = await launch("charity-zakat", "demo.zakat");
  const allowed = await z.native("api", {
    method: "GET",
    path: `/approvals/${pending.request_id}`,
  });
  assert(allowed.can_decide);
  await decide(z, pending, "Approve");
  await expect(p.getByTestId("charity-decision")).toContainText("Approved");
  assert(
    (await p.evaluate(() => window.charityEvents)).some(
      (e) => e.event_type === "approval.resolved",
    ),
  );
  const dispense = await useApproval(normal, pending, "CharityZakat", true);
  pass(
    "Independent Zakat officer UI approval arrives live; approved RX/patient/fund handoff prefills ID only; wrong fund refused BEFORE POST; distinct actual CharityZakat dispense has no cash shift/payment",
  );
  await openAssistance(
    social,
    "SocialWelfare",
    j.run + " incorrect authorisation must refuse",
    true,
    "demo.doctor",
  );
  await modal()
    .getByLabel("Officer co-sign password", { exact: true })
    .fill("Demo-pass-2026");
  const n = (await posts(s, "/pharmacy/charity-override-request")).length;
  j.writes.badSigner = {
    state: "awaiting-ui",
    prescription_id: social.prescription_id,
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm assistance request", exact: true })
    .click();
  await expect(modal()).toContainText("STEP_UP_REQUIRED");
  const refused = (await posts(s, "/pharmacy/charity-override-request")).slice(
    n,
  );
  assert.equal(refused.length, 1);
  assert.equal(refused[0].result.error.code, "STEP_UP_REQUIRED");
  j.writes.badSigner = { ...refused[0], state: "refused" };
  save();
  await expect(
    modal().getByLabel("Officer co-sign password", { exact: true }),
  ).toHaveValue("");
  await modal().getByRole("button", { name: "Close", exact: true }).click();
  await openAssistance(
    social,
    "SocialWelfare",
    j.run + " SocialWelfare counter SOFTWARE ONLY",
    true,
    "demo.zakat",
  );
  await modal()
    .getByLabel("Officer co-sign password", { exact: true })
    .fill("Demo-pass-2026");
  await help(
    s,
    modal().getByLabel("Officer co-sign password", { exact: true }),
    "Zakat / charity override",
  );
  const beforeCounter = (await posts(s, "/pharmacy/charity-override-request"))
    .length;
  await s.fault({
    failPath: "/api/v1/pharmacy/charity-override-request",
    failMethod: "POST",
    once: true,
  });
  j.writes.counter = {
    state: "awaiting-ui",
    prescription_id: social.prescription_id,
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm assistance request", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await expect(modal()).toContainText("The result is unknown");
  let sends = (await posts(s, "/pharmacy/charity-override-request")).slice(
    beforeCounter,
  );
  assert.equal(sends.length, 1);
  assert.equal(sends[0].status, 201);
  assert.equal(sends[0].body.approver_password, "[REDACTED]");
  j.writes.counter = { ...sends[0], state: "confirmed-server-reply-lost" };
  save();
  await expect(
    modal().getByLabel("Original officer password again", { exact: true }),
  ).toHaveValue("");
  await modal()
    .getByLabel("Original officer password again", { exact: true })
    .fill("different-from-original");
  await modal()
    .getByRole("button", {
      name: "Retry original assistance request",
      exact: true,
    })
    .click();
  await expect(modal()).toContainText("Re-enter the identical original");
  assert.equal(
    (await posts(s, "/pharmacy/charity-override-request")).length,
    beforeCounter + 1,
  );
  await modal()
    .getByLabel("Original officer password again", { exact: true })
    .fill("Demo-pass-2026");
  await modal()
    .getByRole("button", {
      name: "Retry original assistance request",
      exact: true,
    })
    .click();
  await expect(modal()).toHaveCount(0);
  sends = (await posts(s, "/pharmacy/charity-override-request")).slice(
    beforeCounter,
  );
  assert.equal(sends.length, 2);
  assert.equal(sends[0].key, sends[1].key);
  assert.deepEqual(sends[0].body, sends[1].body);
  assert.equal(String(sends[1].replay), "true");
  const approved = sends[1].result.data;
  assert.equal(approved.status, "Approved");
  assert.equal(approved.payload_jsonb.fund_type, "SocialWelfare");
  j.writes.counter = { ...sends[0], state: "confirmed", replay: sends[1] };
  j.approvals.push(approved);
  save();
  await expect(
    p.getByLabel("Co-signing officer username", { exact: true }),
  ).toHaveValue("");
  await useApproval(social, approved, "SocialWelfare");
  pass(
    "Unauthorised co-signer actual STEP_UP_REQUIRED/field wipe; independent SocialWelfare co-sign lost201 replay requires identical password re-entry, changed secret refused locally, recorder redacted, matching separate SocialWelfare dispense no cash",
  );
  const rejected = await queue(
    "reject-request",
    unused,
    "SocialWelfare",
    j.run + " REJECT software-only",
  );
  await decide(z, rejected, "Reject");
  await expect(p.getByTestId("charity-decision")).toContainText("Rejected");
  await expect(
    p.getByRole("button", {
      name: "Use approved assistance in Dispense",
      exact: true,
    }),
  ).toHaveCount(0);
  const cancelled = await queue(
    "cancel-request",
    unused,
    "Zakat",
    j.run + " CANCEL software-only",
  );
  await decide(s, cancelled, "Cancel");
  await s.nav("Zakat / charity override");
  await p
    .getByLabel("Assistance request ID", { exact: true })
    .fill(String(cancelled.request_id));
  await p.getByRole("button", { name: "Read request ID", exact: true }).click();
  await expect(p.getByTestId("charity-decision")).toContainText("Cancelled");
  await p
    .getByRole("button", { name: "Review request prescription", exact: true })
    .click();
  pass(
    "Actual independent Reject and requester Cancel through existing authorised approval UI update live/read history and never expose approved-use action",
  );
  await p
    .getByLabel("Assistance request status", { exact: true })
    .selectOption("Cancelled");
  await p.getByLabel("Maximum returned requests", { exact: true }).fill("1");
  await p
    .getByRole("button", { name: "Apply assistance filters", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("Result limit reached");
  await p.getByLabel("Maximum returned requests", { exact: true }).fill("500");
  await p
    .getByRole("button", { name: "Apply assistance filters", exact: true })
    .click();
  await p
    .getByLabel("Find in returned assistance requests", { exact: true })
    .fill("NO-MATCH-" + j.run);
  await expect(p.getByTestId("charity-request-row")).toHaveCount(0);
  await p
    .getByLabel("Find in returned assistance requests", { exact: true })
    .fill(j.run);
  await expect(p.getByTestId("charity-request-row")).toHaveCount(1);
  await s.fault({
    failPath: "/api/v1/approvals?",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Refresh assistance requests", exact: true })
    .click();
  await expect(p.getByTestId("charity-request-row")).toHaveCount(0);
  await expect(p.locator('main .error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await s.fault({ failPath: null });
  await p
    .getByRole("button", { name: "Refresh assistance requests", exact: true })
    .click();
  await expect(p.getByTestId("charity-request-row")).toHaveCount(1);
  await p.evaluate(() => scrollTo(0, 0));
  await capture(s, "charity_override");
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
      if (event === "message") globalThis.charitySocket = this;
      return emit.call(this, event, ...args);
    };
  });
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.charitySocket), {
      timeout: 45000,
    })
    .toBe(true);
  const time = Date.now();
  await s.app.evaluate(() => globalThis.charitySocket.terminate());
  await expect
    .poll(() =>
      p.evaluate(() =>
        window.charityStreams.some((e) => e.status === "Reconnecting"),
      ),
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.charityStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  for (const path of [
    "/api/v1/approvals",
    `/api/v1/approvals/${cancelled.request_id}`,
    `/api/v1/prescriptions/${unused.prescription_id}`,
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
  pass(
    "Actual bounded/mine/status/local filters, lost-list stale hiding/retry, ENUR/both themes250/native zoom bounds/reset, actual socket reconnect rereads list/selected decision/prescription",
  );
  await write(
    s,
    "missing-rx",
    "/pharmacy/charity-override-request",
    {
      prescription_id: 2147483647,
      fund_type: "Zakat",
      reason: j.run + " expected missing reference",
    },
    "REFERENCE_NOT_FOUND",
  );
  for (const order of j.prescriptions) {
    const current = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert.equal(current.notes, order.notes);
    if (
      current.status === "Active" ||
      current.status === "PartiallyDispensed"
    ) {
      assert.equal(current.dispensations.length, 0);
      await write(
        d,
        "cancel-rx-" + order.prescription_id,
        `/prescriptions/${order.prescription_id}/cancel`,
        {
          reason:
            j.run +
            " software verification complete, no care or physical supply",
        },
      );
    }
    const end = await d.native("api", {
      method: "GET",
      path: `/prescriptions/${order.prescription_id}`,
    });
    assert(!["Active", "PartiallyDispensed"].includes(end.status));
  }
  for (const a of j.approvals) {
    const current = await s.native("api", {
      method: "GET",
      path: `/approvals/${a.request_id}`,
    });
    assert.notEqual(current.status, "Pending");
  }
  j.cleaned = true;
  save();
  const denied = await launch("charity-cashier", "demo.cashier");
  await expect(
    denied.p
      .getByRole("navigation")
      .getByRole("button", { name: "Zakat / charity override", exact: false }),
  ).toHaveCount(0);
  const r = await denied.p.evaluate(() =>
    window.terminal.call("api", {
      method: "POST",
      path: "/pharmacy/charity-override-request",
      body: {
        prescription_id: 1,
        fund_type: "Zakat",
        reason: "DEMO expected denial",
      },
      key: "e2decb2a-26c5-4885-aa6d-148b29120075",
    }),
  );
  assert.equal(r.error?.code, "PERMISSION_REQUIRED");
  pass(
    "Native forbidden role sends no charity write; own test approvals terminal, two virtual charity dispensations retained and unused RX cancelled, no cash or physical medicine",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  for (const actor of instances.reverse()) {
    await actor.fault({ failPath: null, delayPath: null });
    await actor.close();
  }
  j.finished = new Date().toISOString();
  save();
  if (j.passed)
    fs.writeFileSync(
      "docs/charity-evidence-2026-10-26.json",
      JSON.stringify(
        {
          date: j.finished,
          run: j.run,
          passed: true,
          checks: j.checks,
          prescriptions: j.prescriptions.map((r) => ({
            id: r.prescription_id,
            number: r.prescription_number,
          })),
          approvals: j.approvals.map((a) => ({
            id: a.request_id,
            rx: a.subject_id,
            fund: a.payload_jsonb.fund_type,
          })),
          dispensations: j.dispensations.map((d) => ({
            id: d.dispensation.dispensation_id,
            rx: d.dispensation.prescription_id,
            mode: d.dispensation.payment_mode,
            invoice: d.invoice.invoice_no,
            payment: d.payment?.method,
          })),
          cleaned: j.cleaned,
          limits: [
            "No real patient care, cash, fund payment or physical supply; DEV virtual stock/expense/invoice records retained",
            "ACCOUNT_LOCKED countdown unit-tested; shared demo officer not deliberately locked",
            "Service boundary unit tests, current Active/full DEV; no shared service mutation or signed human/translation/editor/physical acceptance",
            "Co-signer plaintext never retained/logged; re-entry checked by ephemeral salted verifier and original server idempotency replay",
          ],
        },
        null,
        2,
      ),
    );
}
