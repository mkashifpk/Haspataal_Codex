import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  metricFlag,
  benchMetrics,
  benchIdentity,
  benchRejection,
  benchSnapshot,
  sameBenchSample,
  benchWritable,
} from "../src/lab-bench-policy.ts";
const require = createRequire(import.meta.url),
  { assertLabLabel } = require("../electron/lab-label-safety.cjs");
const metric = {
  key: "value",
  label: "Actual metric",
  type: "number",
  required: true,
  reference_range: [10, 20],
  critical: { low: 5, high: 30 },
};
test("live numeric flags use the patient reference range and actual critical limits with finite input", () => {
  for (const [v, flag] of [
    ["4", "CL"],
    ["7", "L"],
    ["10", "N"],
    ["20", "N"],
    ["22", "H"],
    ["31", "CH"],
    ["NaN", "Invalid"],
  ])
    assert.equal(metricFlag(metric, v), flag);
  assert.throws(() => benchMetrics([metric], { value: "1x" }));
  assert.throws(() => benchMetrics([metric], {}));
  assert.deepEqual(benchMetrics([metric], { value: "1.5e1" }), { value: 15 });
});
test("text critical values get C and optional blank fields are omitted without invented metrics", () => {
  const m = { ...metric, type: "text", critical: { values: ["Positive"] } };
  assert.equal(metricFlag(m, "Positive"), "C");
  assert.equal(metricFlag(m, "Negative"), "N");
  assert.deepEqual(
    benchMetrics([metric, { ...m, key: "optional", required: false }], {
      value: "12",
      unknown: "ignored",
    }),
    { value: 12 },
  );
});
test("collect/pending receive identity needs real band or asked identifiers; emergency override needs note and actual emergency", () => {
  assert.deepEqual(
    benchIdentity("WristbandScan", " HMS:PT:00001 ", "", false, false),
    { wristband_code: "HMS:PT:00001" },
  );
  assert.deepEqual(benchIdentity("TwoIdentifiers", "", "", true, false), {
    identity_check: "TwoIdentifiers",
  });
  assert.throws(() => benchIdentity("TwoIdentifiers", "", "", false, false));
  assert.throws(() =>
    benchIdentity("EmergencyOverride", "", "why", false, false),
  );
  assert.throws(() => benchIdentity("EmergencyOverride", "", "", false, true));
  assert.equal(
    benchIdentity(
      "EmergencyOverride",
      "",
      "Unidentified emergency",
      false,
      true,
    ).identity_check,
    "EmergencyOverride",
  );
});
test("rejection enum and Other note match the contract", () => {
  assert.deepEqual(benchRejection("Haemolysed", ""), { code: "Haemolysed" });
  assert.throws(() => benchRejection("Other", ""));
  assert.throws(() => benchRejection("OrderCancelled", ""));
  assert.equal(benchRejection("Other", "Reason").note, "Reason");
});
test("state reconciliation binds actual sample/item/patient/version and existing work permission", () => {
  const s = {
    sample: {
      sample_id: 1,
      barcode: "00001",
      status: "Pending",
      row_version: 1,
    },
    item: { lab_requisition_item_id: 2, status: "Ordered", row_version: 1 },
    patient: { patient_id: 3, mrn: "MRN" },
    metric_grid: [],
    previous_results: [],
  };
  assert(sameBenchSample(s, s));
  assert(!sameBenchSample(s, { ...s, patient: { patient_id: 4 } }));
  assert.notEqual(
    benchSnapshot(s),
    benchSnapshot({ ...s, sample: { ...s.sample, row_version: 2 } }),
  );
  assert(benchWritable(["lab.result.enter"], "lab.result.enter", "open_work"));
  assert(!benchWritable(["lab.result.enter"], "lab.result.enter", "records"));
  assert(!benchWritable([], "lab.result.enter", "full"));
});
test("tube label refuses another sample, wrong document/printer role and missing server text", () => {
  const p = {
    document_type: "lab_label",
    printer_role: "label",
    fields: { sample_id: 1, barcode: "00001" },
    text: "Actual server label",
  };
  assertLabLabel(p, 1);
  for (const bad of [
    { ...p, printer_role: "receipt" },
    { ...p, document_type: "opd_slip" },
    { ...p, fields: { sample_id: 2, barcode: "00001" } },
    { ...p, text: null },
  ])
    assert.throws(() => assertLabLabel(bad, 1));
});
