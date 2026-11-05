import test from "node:test";
import assert from "node:assert/strict";
import {
  wasteAccess,
  wasteDraft,
  wastePayload,
  wasteProblems,
} from "../src/waste-log-policy.ts";
test("waste: recording permission and loaded runtime facility view govern new work", () => {
  const p = ["infection.waste.record"],
    full = { views: { screens: [] } };
  assert.equal(wasteAccess(p).canView, false);
  assert.equal(wasteAccess(p, full).canRecord, true);
  for (const view of ["hidden", "records"])
    assert.equal(
      wasteAccess(p, {
        views: { screens: [{ screen_id: "waste_log_ops", view }] },
      }).canRecord,
      false,
    );
  for (const permission of [
    "infection.control.manage",
    "infection.statistics.view",
  ]) {
    assert.equal(wasteAccess([permission], full).canView, true);
    assert.equal(wasteAccess([permission], full).canRecord, false);
  }
  assert.equal(wasteAccess([], full).canView, false);
});
test("waste: require measured positive weight, actual category and area; distinguish blank bags from zero", () => {
  const d = {
    ...wasteDraft(),
    category: "Sharps",
    location: "Synthetic test area",
    weight_kg: "0.25",
  };
  assert.deepEqual(wasteProblems(d), []);
  assert.equal(wastePayload(d).bags, null);
  assert.equal(wastePayload({ ...d, bags: "0" }).bags, 0);
  for (const weight of ["", "0", "-1", "NaN", "Infinity", "100001"])
    assert(wasteProblems({ ...d, weight_kg: weight }).includes("weight"));
  assert(wasteProblems({ ...d, bags: "1.5" }).includes("bags"));
  assert(wasteProblems({ ...d, category: "" }).includes("category"));
  assert(wasteProblems({ ...d, location: "" }).includes("area"));
  assert.deepEqual(
    wasteProblems({ ...d, location: "", department_id: "1" }),
    [],
  );
  assert.equal(wastePayload(d).recorded_on, null);
});
test("waste: collection-only payload excludes all hidden handover values; real handover requires contractor and receipt", () => {
  const d = {
    ...wasteDraft(),
    category: "NonRisk",
    location: "SYNTHETIC",
    weight_kg: "0.25",
    vendor_id: "7",
    manifest_number: " SCN162 ",
    disposal: "Recycling",
  };
  const body = wastePayload(d);
  assert.equal(body.vendor_id, null);
  assert.equal(body.manifest_number, null);
  assert.equal(body.disposal, null);
  assert.deepEqual(wasteProblems({ ...d, handover: true }), []);
  assert.equal(
    wastePayload({ ...d, handover: true }).manifest_number,
    "SCN162",
  );
  assert(
    wasteProblems({ ...d, handover: true, manifest_number: " " }).includes(
      "handover",
    ),
  );
  assert(
    wasteProblems({ ...d, handover: true, vendor_id: "" }).includes("handover"),
  );
  assert(wasteProblems({ ...d, note: "x".repeat(1001) }).includes("length"));
});
