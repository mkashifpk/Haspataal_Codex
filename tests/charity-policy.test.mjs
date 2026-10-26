import test from "node:test";
import assert from "node:assert/strict";
import {
  makeCharityBody,
  nonSecretCharityBody,
  approvedCharityHandoff,
  charityWritable,
  charitySnapshot,
  charityPasswordProof,
  charityLockSeconds,
} from "../src/charity-policy.ts";
const p = () => ({
  prescription_id: 1,
  patient_id: 2,
  row_version: 1,
  status: "Active",
  destination: "HospitalPharmacy",
  admission_id: null,
  items: [
    {
      prescription_item_id: 3,
      item_status: "Active",
      qty_remaining: 2,
      dose_text: "original",
    },
  ],
});
const a = () => ({
  request_id: 4,
  approval_type: "PharmacyCharityOverride",
  subject_type: "prescription",
  subject_id: 1,
  patient_id: 2,
  status: "Approved",
  payload_jsonb: { fund_type: "Zakat" },
});
test("assistance request has exact RX/fund/bounded reason and retained body never stores co-sign password", () => {
  assert.deepEqual(makeCharityBody(1, "Zakat", "  eligible  "), {
    prescription_id: 1,
    fund_type: "Zakat",
    reason: "eligible",
  });
  const safe = nonSecretCharityBody({
    ...makeCharityBody(1, "SocialWelfare", "Check need", "officer"),
    approver_password: "sensitive-example",
  });
  assert(!JSON.stringify(safe).includes("sensitive-example"));
  assert(!("approver_password" in safe));
  for (const [id, fund, reason] of [
    [0, "Zakat", "why"],
    [1, "Other", "why"],
    [1, "Zakat", "  "],
    [1, "Zakat", "x".repeat(501)],
  ])
    assert.throws(() => makeCharityBody(id, fund, reason));
});
test("approved handoff requires actual type/subject/patient/fund/status; no Pending or guessed IPD funding", () => {
  assert.deepEqual(approvedCharityHandoff(a(), p()), {
    prescriptionId: 1,
    approvalId: 4,
    fundType: "Zakat",
  });
  for (const change of [
    { status: "Pending" },
    { status: "Rejected" },
    { subject_id: 9 },
    { patient_id: 9 },
    { approval_type: "Refund" },
    { payload_jsonb: { fund_type: "Other" } },
  ])
    assert.throws(() => approvedCharityHandoff({ ...a(), ...change }, p()));
  assert.throws(() => approvedCharityHandoff(a(), { ...p(), admission_id: 9 }));
  assert.throws(() =>
    approvedCharityHandoff(a(), { ...p(), status: "Cancelled" }),
  );
});
test("requests continue existing work while Retiring, records/setup/hidden cannot write, reviews detect changed orders", () => {
  for (const v of ["full", "open_work"])
    assert(charityWritable(["pharmacy.dispense"], v));
  for (const v of ["records", "setup", "hidden", ""])
    assert(!charityWritable(["pharmacy.dispense"], v));
  assert(!charityWritable([], "full"));
  assert.notEqual(
    charitySnapshot(p()),
    charitySnapshot({ ...p(), row_version: 2 }),
  );
  assert.equal(
    charityLockSeconds({
      response: {
        error: { code: "ACCOUNT_LOCKED", details: { retry_after_seconds: 9 } },
      },
    }),
    9,
  );
  assert.equal(
    charityLockSeconds({ response: { error: { code: "STEP_UP_REQUIRED" } } }),
    0,
  );
});
test("ephemeral salted proof checks identical re-entered secret without retaining plaintext", async () => {
  const h = await charityPasswordProof("salt-one", "test-value");
  assert.equal(h, await charityPasswordProof("salt-one", "test-value"));
  assert.notEqual(h, await charityPasswordProof("salt-one", "changed"));
  assert.notEqual(h, await charityPasswordProof("salt-two", "test-value"));
  assert(!h.includes("test-value"));
});
