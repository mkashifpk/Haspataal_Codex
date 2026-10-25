import test from "node:test";
import assert from "node:assert/strict";
import {
  makeOrderQuery,
  queryRowSnapshot,
  queryPrescriptionSnapshot,
  mayChangeQueries,
} from "../src/order-query-policy.ts";
const p = () => ({
  prescription_id: 1,
  patient_id: 2,
  row_version: 1,
  status: "Active",
  items: [{ prescription_item_id: 4, dose_text: "original" }],
  queries: [],
});
test("a query requires a real current target, enum reason and bounded nonblank question", () => {
  assert.deepEqual(makeOrderQuery(p(), "whole", "Allergy", "  check this  "), {
    prescription_item_id: null,
    reason: "Allergy",
    question: "check this",
  });
  assert.equal(
    makeOrderQuery(p(), "4", "DoseOrFrequency", "Please check")
      .prescription_item_id,
    4,
  );
  for (const target of ["", "5", "-1", "4x"])
    assert.throws(() => makeOrderQuery(p(), target, "Other", "test"));
  for (const [r, q] of [
    ["", "test"],
    ["Other", "  "],
    ["Other", "x".repeat(1001)],
  ])
    assert.throws(() => makeOrderQuery(p(), "4", r, q));
});
test("one open query per exact target; answered/withdrawn history does not fabricate an open hold", () => {
  for (const target of ["whole", "4"])
    assert.throws(() =>
      makeOrderQuery(
        {
          ...p(),
          queries: [
            {
              status: "Open",
              prescription_item_id: target === "whole" ? null : 4,
            },
          ],
        },
        target,
        "Other",
        "Check order",
      ),
    );
  for (const status of ["Answered", "Withdrawn"])
    assert.equal(
      makeOrderQuery(
        { ...p(), queries: [{ status, prescription_item_id: 4 }] },
        "4",
        "Other",
        "Check order",
      ).prescription_item_id,
      4,
    );
});
test("reviews detect concurrent medication/query/patient changes; records/hidden/setup deny new writes", () => {
  assert.notEqual(
    queryPrescriptionSnapshot(p()),
    queryPrescriptionSnapshot({
      ...p(),
      items: [{ prescription_item_id: 4, dose_text: "changed" }],
    }),
  );
  assert.equal(
    queryPrescriptionSnapshot(p()),
    queryPrescriptionSnapshot({
      ...p(),
      items: [{ ...p().items[0], qty_available: 123, stock_status: "InStock" }],
    }),
  );
  assert.notEqual(
    queryRowSnapshot({ query_id: 1, status: "Open", row_version: 1 }),
    queryRowSnapshot({ query_id: 1, status: "Answered", row_version: 2 }),
  );
  for (const view of ["full", "open_work"])
    assert(mayChangeQueries(["prescription.query.raise"], view));
  for (const view of ["records", "setup", "hidden", ""])
    assert(!mayChangeQueries(["prescription.query.raise"], view));
  assert(!mayChangeQueries([], "full"));
});
