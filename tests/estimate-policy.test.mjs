import test from "node:test";
import assert from "node:assert/strict";
import { checkedEstimate, estimateSnapshot } from "../src/estimate-policy.ts";
const tariff = {
    wards: [{ ward_id: 1, bed_day_price: 100 }],
    categories: [{ items: [{ service_id: 2, price: 500 }] }],
  },
  body = {
    admission_id: 3,
    reason: "Admission",
    ward_id: 1,
    expected_days: 2,
    services: [{ service_id: 2, quantity: 1 }],
    allowances: [],
  };
test("estimate preparation uses selected tariff records and transfer linkage, never a typed service price", () => {
  assert.equal(checkedEstimate(body, tariff), body);
  assert.throws(() =>
    checkedEstimate(
      { ...body, services: [{ service_id: 999, quantity: 1 }] },
      tariff,
    ),
  );
  assert.throws(() => checkedEstimate({ ...body, ward_id: 999 }, tariff));
  assert.throws(() =>
    checkedEstimate({ ...body, reason: "ChangeOfWard" }, tariff),
  );
  assert.throws(() => checkedEstimate({ ...body, transfer_id: 5 }, tariff));
  assert.throws(() => checkedEstimate({ ...body, expected_days: 1.2 }, tariff));
  assert.throws(() =>
    checkedEstimate(
      {
        ...body,
        allowances: [{ kind: "Other", description: "xx", amount: 0 }],
      },
      tariff,
    ),
  );
  assert(!("price" in body.services[0]));
});
test("estimate review detects finality and versions but a changing running bill does not rewrite a quoted estimate", () => {
  const e = {
    estimate_id: 1,
    patient_id: 3,
    row_version: 1,
    status: "Draft",
    total: 123,
    deposit: 12,
    transfer_id: null,
  };
  assert.notEqual(
    estimateSnapshot(e),
    estimateSnapshot({ ...e, row_version: 2 }),
  );
  assert.notEqual(
    estimateSnapshot(e),
    estimateSnapshot({ ...e, status: "Explained" }),
  );
  assert.equal(
    estimateSnapshot(e),
    estimateSnapshot({ ...e, billed_so_far: 999 }),
  );
});
