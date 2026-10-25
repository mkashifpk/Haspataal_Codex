// Current DEV contract regression. Only known reset fixtures; denied writes journalled.
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const fixture = JSON.parse(fs.readFileSync("artifacts/reset-cash-cycle.json"));
assert(
  fixture.passed && fixture.account_deactivated && fixture.terminal_deactivated,
);
const file = "docs/reset-six-screen-api-evidence-2026-10-25.json";
assert(
  !fs.existsSync(file),
  "Reconcile original API evidence before repeating denied writes",
);
const j = { started: new Date().toISOString(), requests: [], passed: false };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const cfg = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const ca = checkedRoot(cfg.ca_pem, cfg.ca_fingerprint_sha256),
  tokens = new Map();
async function token(user) {
  if (!tokens.has(user)) {
    const r = await request(cfg.server_urls[0] + "/api/v1/auth/login", {
      ca,
      method: "POST",
      body: { username: user, password: "Demo-pass-2026" },
      headers: {
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    });
    assert.equal(r.status, 200);
    tokens.set(user, r.body.data.access_token);
  }
  return tokens.get(user);
}
async function call(user, method, path, body, expected = 200, code) {
  const a = {
    as_user: user,
    method,
    path,
    body: body?.__multipart
      ? "synthetic PNG multipart (no real patient)"
      : body,
    key: method === "GET" ? undefined : crypto.randomUUID(),
    finished: false,
  };
  j.requests.push(a);
  save();
  const r = await request(
    cfg.server_urls[0] + (path.startsWith("/health") ? path : "/api/v1" + path),
    {
      ca,
      method,
      body,
      headers: {
        Authorization: "Bearer " + (await token(user)),
        ...(a.key ? { "Idempotency-Key": a.key } : {}),
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    },
  );
  Object.assign(a, {
    status: r.status,
    code: r.body?.error?.code,
    request_id: r.body?.request_id,
    finished: true,
  });
  save();
  assert.equal(
    r.status,
    expected,
    method + " " + path + ": " + JSON.stringify(r.body),
  );
  if (code) assert.equal(r.body.error.code, code);
  return r.body.data;
}
try {
  const patient = await call(
    "demo.reception",
    "GET",
    "/patients/" + fixture.refund_ticket.patient_id,
  );
  assert.equal(patient.full_name, fixture.refund_ticket.patient_name);
  const ticket = fixture.refund_ticket.ticket_id,
    shift = fixture.shift_id,
    ar = fixture.ar.ar_id,
    invoice = fixture.credit_ticket.invoice.invoice_id;
  for (const path of [
    "/health/live",
    "/health",
    "/terminals/whoami",
    "/meta/license",
    "/meta/enums",
    "/meta/settings",
    "/meta/workspaces",
    "/meta/error-codes",
    "/meta/events",
    "/settings/sections",
    "/finance/service-catalog?category=OPD",
    "/opd-queues/reception-dashboard",
    "/staff/lookup?q=Ahmed",
    "/opd-tickets/" + ticket,
    "/opd-tickets/" + ticket + "/print-payload",
    "/patients/" + patient.patient_id + "/documents",
  ])
    await call("demo.reception", "GET", path);
  for (const path of [
    "/finance/cash-shifts/" + shift,
    "/finance/cash-shifts/" + shift + "/transactions",
    "/finance/ar/outstanding",
    "/finance/ar/aging",
    "/finance/invoices?patient_id=" + fixture.credit_ticket.patient_id,
    "/finance/invoices/" + invoice,
  ])
    await call("demo.owner", "GET", path);
  const minimal = {
    full_name: "DEMO-DENIED-" + Date.now(),
    gender: "unknown",
    age_years: 35,
    mobile: "03000000000",
  };
  const denied = [
    [
      "demo.accountant",
      "POST",
      "/finance/cash-shifts/open",
      { node: "MainReception", opening_float: 1500 },
    ],
    ["demo.accountant", "GET", "/finance/cash-shifts/mine"],
    [
      "demo.admissions",
      "GET",
      "/finance/cash-shifts/" + shift + "/transactions",
    ],
    [
      "demo.accountant",
      "POST",
      "/finance/cash-shifts/" + shift + "/close",
      { declared_cash: 1000 },
    ],
    ["demo.admissions", "GET", "/opd-tickets/" + ticket],
    [
      "demo.accountant",
      "POST",
      "/opd-tickets/" + ticket + "/refund/confirm-dispensation",
    ],
    [
      "demo.accountant",
      "POST",
      "/opd-tickets/" + ticket + "/waiver-refund/confirm-dispensation",
    ],
    ["demo.doctor", "GET", "/finance/ar/outstanding"],
    ["demo.doctor", "GET", "/finance/ar/aging"],
    [
      "demo.admissions",
      "POST",
      "/finance/ar/" + ar + "/settle",
      { amount: 1, method: "Cash" },
    ],
    [
      "demo.accountant",
      "POST",
      "/finance/ar/" + ar + "/write-off",
      { amount: 1, reason: "DEMO ONLY denied write-off" },
    ],
    [
      "demo.accountant",
      "POST",
      "/finance/invoices/" + invoice + "/payments",
      { method: "Cash" },
    ],
    ["demo.doctor", "GET", "/finance/invoices"],
    ["demo.doctor", "GET", "/finance/invoices/" + invoice],
    ["demo.accountant", "POST", "/patients", minimal],
    [
      "demo.accountant",
      "POST",
      "/opd-tickets/" + ticket + "/pay",
      { method: "Cash" },
    ],
    [
      "demo.accountant",
      "POST",
      "/reception/registrations",
      { new_patient: minimal, service_id: fixture.refund_ticket.service_id },
    ],
    [
      "demo.accountant",
      "GET",
      "/patients/" + patient.patient_id + "/documents",
    ],
    [
      "demo.accountant",
      "POST",
      "/patients/" + patient.patient_id + "/documents",
      {
        __multipart: [
          { name: "doc_type", value: "Photo" },
          { name: "title", value: "DEMO ONLY denied synthetic image" },
          {
            name: "file",
            filename: "DEMO-ONLY.png",
            type: "image/png",
            bytes: fs.readFileSync("public/handbook/connect_server-en.png"),
          },
        ],
      },
    ],
    ["demo.admissions", "GET", "/opd-tickets/" + ticket + "/print-payload"],
    ["demo.accountant", "GET", "/opd-queues/reception-dashboard"],
  ];
  for (const [user, method, path, body] of denied)
    await call(user, method, path, body, 403, "FORBIDDEN");
  const after = await call("demo.reception", "GET", "/opd-tickets/" + ticket);
  assert.equal(after.patient_id, patient.patient_id);
  assert.equal(after.cash_back_prompts.length, 0);
  j.passed = true;
  j.finished = new Date().toISOString();
  save();
  console.log(
    "PASS current six-screen reads and21 real permission refusals; known reset records unchanged, no successful business write",
  );
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
}
