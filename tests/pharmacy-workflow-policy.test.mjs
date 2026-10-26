import test from "node:test";
import assert from "node:assert/strict";
test("Other-counter refusal uses only the server own open_shift, not the required-node field or unrelated error", () => {
  assert.equal(
    otherPharmacyCashCounter({
      response: {
        error: {
          code: "SHIFT_NOT_OPEN",
          details: {
            node: "PharmacyCounter",
            open_shift: { shift_id: 1, node: "MainReception" },
          },
        },
      },
    }),
    "MainReception",
  );
  for (const e of [
    undefined,
    {
      response: {
        error: {
          code: "SHIFT_NOT_OPEN",
          details: { node: "MainReception", open_shift: null },
        },
      },
    },
    {
      response: {
        error: {
          code: "FORBIDDEN",
          details: { open_shift: { node: "MainReception" } },
        },
      },
    },
  ])
    assert.equal(otherPharmacyCashCounter(e), undefined);
});
import {
  pharmacyCashShift,
  otherPharmacyCashCounter,
  cashOpeningAllowed,
  pharmacyClearanceState,
  pharmacyClearanceAllowed,
} from "../src/pharmacy-workflow-policy.ts";
test("Pharmacy cash never uses another person, another counter or a closed drawer", () => {
  const s = { user_id: 19, node: "PharmacyCounter", status: "Open" };
  assert(pharmacyCashShift(s, 19));
  for (const bad of [
    null,
    undefined,
    { ...s, user_id: 20 },
    { ...s, node: "MainReception" },
    { ...s, status: "PendingCollection" },
  ])
    assert(!pharmacyCashShift(bad, 19));
});
test("Pharmacy opening requires IT-mapped PharmacyCounter; Reception retains actual mapping", () => {
  assert(cashOpeningAllowed("pharmacy", "PharmacyCounter"));
  assert(!cashOpeningAllowed("pharmacy", "MainReception"));
  assert(!cashOpeningAllowed("pharmacy", null));
  assert(cashOpeningAllowed("reception", "MainReception"));
  assert(cashOpeningAllowed("reception", "PharmacyCounter"));
});
test("Pharmacy clearance matches admission/patient and actual next pending stage", () => {
  const s = {
    admission_id: 4,
    patient_id: 5,
    started: true,
    blocked_on: "PharmacyClearance",
    stages: [{ stage: "PharmacyClearance", status: "Pending" }],
  };
  assert(pharmacyClearanceAllowed(s, 4, 5));
  for (const bad of [
    undefined,
    { ...s, patient_id: 6 },
    { ...s, admission_id: 6 },
    { ...s, started: false },
    { ...s, blocked_on: "BillingSettlement" },
    { ...s, stages: [] },
  ])
    assert(!pharmacyClearanceAllowed(bad, 4, 5));
});
test("Lost clearance result preserves actual cleared actor/time even after next stage advances; never offers a second clearance", () => {
  const stage = {
    stage: "PharmacyClearance",
    status: "Cleared",
    cleared_by_name: "Synthetic officer",
    cleared_at: "2026-10-26T04:00:00Z",
  };
  const s = {
    admission_id: 4,
    patient_id: 5,
    started: true,
    blocked_on: "NursingMARVerification",
    stages: [stage],
  };
  assert.deepEqual(pharmacyClearanceState(s, 4, 5), stage);
  assert(!pharmacyClearanceAllowed(s, 4, 5));
  assert.equal(pharmacyClearanceState(s, 4, 6), undefined);
});
