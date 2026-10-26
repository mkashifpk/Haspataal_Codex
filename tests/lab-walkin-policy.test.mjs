import test from "node:test";
import assert from "node:assert/strict";
import {
  makeLabWalkin,
  walkinTestAllowed,
  labWalkinWritable,
  labInvoiceCollectible,
  makeLabCollection,
  labInvoiceSnapshot,
} from "../src/lab-walkin-policy.ts";
const tests = [
  { test_id: 1, is_active: true, availability: "InHouse" },
  { test_id: 2, is_active: true, availability: "SendOut" },
];
test("Lab-only identity needs just name/mobile; no test, doctor, OPD ticket or payment is required", () => {
  const b = makeLabWalkin(
    " Synthetic ",
    "03000000000",
    [],
    tests,
    [],
    "Routine",
    "",
    "",
  );
  assert.deepEqual(b, {
    full_name: "Synthetic",
    mobile: "03000000000",
    test_ids: [],
    priority: "Routine",
  });
  for (const pair of [
    ["", "03000000000"],
    ["name", "abc"],
    ["x".repeat(201), "03000000000"],
  ])
    assert.throws(() =>
      makeLabWalkin(...pair, [], tests, [], "Routine", "", ""),
    );
});
test("In-house and send-out choices follow their independent Active services and actual catalogue", () => {
  assert(walkinTestAllowed(tests[0], ["laboratory"]));
  assert(!walkinTestAllowed(tests[1], ["laboratory"]));
  assert(walkinTestAllowed(tests[1], ["outsourced_diagnostics"]));
  for (const ids of [[1, 1], [8], [2]])
    assert.throws(() =>
      makeLabWalkin(
        "Synthetic",
        "03000000000",
        ids,
        tests,
        ["laboratory"],
        "Routine",
        "",
        "",
      ),
    );
  assert(!walkinTestAllowed({ ...tests[0], is_active: false }, ["laboratory"]));
});
test("new walk-in needs both permissions/full; existing records do not grant new registration", () => {
  const ps = ["patient.create", "lab.requisition.create"];
  assert(labWalkinWritable(ps, "full"));
  for (const v of ["open_work", "records", "hidden", "setup"])
    assert(!labWalkinWritable(ps, v));
  assert(!labWalkinWritable(["patient.create"], "full"));
});
test("payment binds exact Lab invoice and patient, refuses locked/closed/unrelated records and stale reviews", () => {
  const i = {
    invoice_id: 7,
    patient_id: 8,
    invoice_type: "Lab",
    status: "Open",
    balance_due: 300,
    is_locked: false,
    row_version: 1,
  };
  assert(labInvoiceCollectible(i, 7, 8));
  for (const change of [
    { patient_id: 9 },
    { invoice_type: "OPD" },
    { is_locked: true },
    { status: "Paid" },
    { balance_due: 0 },
  ])
    assert(!labInvoiceCollectible({ ...i, ...change }, 7, 8));
  assert.notEqual(
    labInvoiceSnapshot(i),
    labInvoiceSnapshot({ ...i, row_version: 2 }),
  );
  assert.deepEqual(makeLabCollection(i, "", "Cash", ""), {
    amount: 300,
    method: "Cash",
  });
  assert.deepEqual(makeLabCollection(i, "125.50", "Card", "actual-ref"), {
    amount: "125.50",
    method: "Card",
    reference_no: "actual-ref",
  });
  for (const value of ["-1", "0", "301", "NaN", "1e2", "2x"])
    assert.throws(() => makeLabCollection(i, value, "Cash", ""));
});
