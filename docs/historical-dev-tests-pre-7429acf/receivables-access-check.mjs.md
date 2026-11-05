# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { request, checkedRoot } = createRequire(import.meta.url)("../electron/transport.cjs");

const config = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
const baseUrl = config.server_urls[0] + "/api/v1";

const audit = {
  tested_at: new Date().toISOString(),
  endpoints_checked: [],
  rules_checked: [],
  results: {},
};

async function api(method, path, token, body, key) {
  return await request(baseUrl + path, {
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
}

async function login(username, password = "Demo-pass-2026") {
  const res = await api("POST", "/auth/login", null, { username, password });
  assert.equal(res.status, 200, `Login failed for ${username}: ${res.status}`);
  return res.body.data.access_token;
}

async function run() {
  console.log("Checking receivables permissions against real DEV server...");

  // 1. Unauthenticated requests must be 401
  const unauth1 = await api("GET", "/finance/ar/outstanding");
  assert.equal(unauth1.status, 401, "unauthenticated ar/outstanding must be 401");
  const unauth2 = await api("GET", "/finance/ar/aging");
  assert.equal(unauth2.status, 401, "unauthenticated ar/aging must be 401");
  const unauth3 = await api("POST", "/finance/ar/1/settle", null, { amount: 100, method: "Cash" }, "00000000-0000-0000-0000-000000000001");
  assert.equal(unauth3.status, 401, "unauthenticated settle must be 401");
  const unauth4 = await api("POST", "/finance/ar/1/write-off", null, { amount: 100, reason: "patient indigent" }, "00000000-0000-0000-0000-000000000002");
  assert.equal(unauth4.status, 401, "unauthenticated write-off must be 401");
  const unauth5 = await api("GET", "/finance/invoices");
  assert.equal(unauth5.status, 401, "unauthenticated invoices must be 401");
  const unauth6 = await api("GET", "/finance/invoices/12");
  assert.equal(unauth6.status, 401, "unauthenticated invoice detail must be 401");
  const unauth7 = await api("POST", "/finance/invoices/12/payments", null, { amount: 100, method: "Cash" }, "00000000-0000-0000-0000-000000000003");
  assert.equal(unauth7.status, 401, "unauthenticated invoice payment must be 401");
  audit.results["unauthenticated_401"] = true;
  console.log("PASS: Unauthenticated access rejected with 401 on all endpoints");

  // 2. Doctor (clinical role without finance permissions) must be 403
  const docToken = await login("demo.doctor");
  const doc1 = await api("GET", "/finance/ar/outstanding", docToken);
  assert.equal(doc1.status, 403, "doctor ar/outstanding must be 403");
  const doc2 = await api("GET", "/finance/ar/aging", docToken);
  assert.equal(doc2.status, 403, "doctor ar/aging must be 403");
  const doc3 = await api("POST", "/finance/ar/1/settle", docToken, { amount: 100, method: "Cash" }, "00000000-0000-0000-0000-000000000004");
  assert.equal(doc3.status, 403, "doctor settle must be 403");
  const doc4 = await api("POST", "/finance/ar/1/write-off", docToken, { amount: 100, reason: "indigent patient" }, "00000000-0000-0000-0000-000000000005");
  assert.equal(doc4.status, 403, "doctor write-off must be 403");
  const doc5 = await api("GET", "/finance/invoices", docToken);
  assert.equal(doc5.status, 403, "doctor invoices must be 403");
  const doc6 = await api("GET", "/finance/invoices/12", docToken);
  assert.equal(doc6.status, 403, "doctor invoice detail must be 403");
  const doc7 = await api("POST", "/finance/invoices/12/payments", docToken, { amount: 100, method: "Cash" }, "00000000-0000-0000-0000-000000000006");
  assert.equal(doc7.status, 403, "doctor invoice payment must be 403");
  audit.results["doctor_403_denied"] = true;
  console.log("PASS: Clinical role (doctor) rejected with 403 FORBIDDEN on all finance endpoints");

  // 3. Cashier role: can read AR, aging, invoices, and invoice detail
  const cashierToken = await login("demo.cashier");
  const cash1 = await api("GET", "/finance/ar/outstanding", cashierToken);
  assert.equal(cash1.status, 200, "cashier ar/outstanding must be 200");
  const cash2 = await api("GET", "/finance/ar/aging", cashierToken);
  assert.equal(cash2.status, 200, "cashier ar/aging must be 200");
  const cash3 = await api("GET", "/finance/invoices", cashierToken);
  assert.equal(cash3.status, 200, "cashier invoices must be 200");
  const cash4 = await api("GET", "/finance/invoices/12", cashierToken);
  assert.equal(cash4.status, 200, "cashier invoice 12 detail must be 200");
  assert.equal(cash4.body.data.invoice_id, 12);
  audit.results["cashier_reads_200"] = true;
  console.log("PASS: Cashier permitted to read AR outstanding, aging buckets, and invoices");

  // 4. Rule 61ddcf1727: Cashier CANNOT write off -> 403 FORBIDDEN
  const cashWriteOff = await api("POST", "/finance/ar/1/write-off", cashierToken, { amount: 100, reason: "cashier test write off" }, "00000000-0000-0000-0000-000000000007");
  assert.equal(cashWriteOff.status, 403, "cashier write-off must be 403 FORBIDDEN (rule:61ddcf1727)");
  audit.rules_checked.push("rule:61ddcf1727");
  audit.results["rule_61ddcf1727_cashier_refused_write_off"] = true;
  console.log("PASS: rule:61ddcf1727 verified: Cashier is refused write-off with 403 FORBIDDEN");

  // 5. Shift prerequisite: Invoice payment without open shift -> 409 SHIFT_NOT_OPEN
  const noShiftPay = await api("POST", "/finance/invoices/12/payments", cashierToken, { amount: 10, method: "Cash" }, "00000000-0000-0000-0000-000000000008");
  assert.equal(noShiftPay.status, 409, "cashier payment without open shift must be 409 SHIFT_NOT_OPEN");
  assert.equal(noShiftPay.body.error.code, "SHIFT_NOT_OPEN");
  audit.results["shift_not_open_409"] = true;
  console.log("PASS: Invoice payment without open shift refused with 409 SHIFT_NOT_OPEN");

  // 6. Owner role: has finance.ar.write_off permission
  const ownerToken = await login("demo.owner");
  const ownerMe = await api("GET", "/auth/me", ownerToken);
  assert(ownerMe.body.data.permissions.includes("finance.ar.write_off"), "demo.owner must have finance.ar.write_off");
  audit.results["owner_has_write_off_permission"] = true;
  console.log("PASS: demo.owner possesses finance.ar.write_off permission");

  // 7. Validation check: Write-off reason < 5 chars -> 422 VALIDATION_ERROR
  const shortReason = await api("POST", "/finance/ar/1/write-off", ownerToken, { amount: 100, reason: "bad" }, "00000000-0000-0000-0000-000000000009");
  assert.equal(shortReason.status, 422, "short write-off reason must be 422 VALIDATION_ERROR");
  audit.results["write_off_validation_422"] = true;
  console.log("PASS: Short write-off reason rejected with 422 VALIDATION_ERROR");

  audit.endpoints_checked = [
    "GET /finance/ar/outstanding",
    "GET /finance/ar/aging",
    "POST /finance/ar/{ar_id}/settle",
    "POST /finance/ar/{ar_id}/write-off",
    "POST /finance/invoices/{invoice_id}/payments",
    "GET /finance/invoices",
    "GET /finance/invoices/{invoice_id}",
  ];

  fs.writeFileSync("docs/receivables-access-checks-2026-10-23.json", JSON.stringify(audit, null, 2), "utf8");
  console.log("ALL ACCESS CHECKS PASSED! Audit saved to docs/receivables-access-checks-2026-10-23.json");
}

run().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});

```
