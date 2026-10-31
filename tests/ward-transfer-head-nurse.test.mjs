import test from "node:test";
import assert from "node:assert/strict";
import {
  getWardTransferHeadNurseScreenView,
  wardTransferHeadNurseAccess,
  filterAvailableBeds,
  groupWardsSummary,
  validateTransferInput,
  formatDailyRate,
  formatRateDifference,
  explainTransferError,
  HEAD_NURSE_TRANSFER_REASONS,
} from "../src/ward-transfer-head-nurse-policy.ts";

test("ward_transfer_head_nurse view evaluation and role access permissions (rule:7defdd4e70)", () => {
  // Screen views
  assert.equal(
    getWardTransferHeadNurseScreenView({
      views: { screens: [{ screen_id: "ward_transfer_head_nurse", view: "full" }] },
    }),
    "full",
  );
  assert.equal(
    getWardTransferHeadNurseScreenView({
      views: { screens: [{ screen_id: "ward_transfer_head_nurse", view: "open_work" }] },
    }),
    "open_work",
  );
  assert.equal(
    getWardTransferHeadNurseScreenView({
      views: { screens: [{ screen_id: "ward_transfer_head_nurse", view: "records" }] },
    }),
    "records",
  );
  assert.equal(getWardTransferHeadNurseScreenView({}), "full");
  assert.equal(getWardTransferHeadNurseScreenView(null), "full");

  // Permissions: head_nurse (canTransfer & canView)
  const fullNurse = wardTransferHeadNurseAccess(
    ["ipd.admission.transfer", "ipd.admission.view", "ipd.bed.view"],
    "full",
  );
  assert.equal(fullNurse.canView, true);
  assert.equal(fullNurse.canTransfer, true);
  assert.equal(fullNurse.isRetiring, false);
  assert.equal(fullNurse.isReadOnly, false);

  // Permissions: viewer only (canView, cannot transfer)
  const viewer = wardTransferHeadNurseAccess(
    ["ipd.admission.view", "ipd.bed.view"],
    "full",
  );
  assert.equal(viewer.canView, true);
  assert.equal(viewer.canTransfer, false);

  // Retiring service mode (open_work: continues existing work)
  const retiringNurse = wardTransferHeadNurseAccess(
    ["ipd.admission.transfer", "ipd.admission.view", "ipd.bed.view"],
    "open_work",
  );
  assert.equal(retiringNurse.canView, true);
  assert.equal(retiringNurse.canTransfer, true);
  assert.equal(retiringNurse.isRetiring, true);

  // Retired service mode (records only: no new transfers allowed)
  const retiredNurse = wardTransferHeadNurseAccess(
    ["ipd.admission.transfer", "ipd.admission.view", "ipd.bed.view"],
    "records",
  );
  assert.equal(retiredNurse.canView, true);
  assert.equal(retiredNurse.canTransfer, false);
  assert.equal(retiredNurse.isReadOnly, true);
});

test("filterAvailableBeds and bed matrix selection rules (rule:cbaa60994a)", () => {
  const mockMatrix = {
    wards: [
      {
        ward_id: 1,
        code: "ICU",
        name: "ICU",
        ward_type: "ICU",
        gender_restriction: "any",
        total_beds: 4,
        available: 2,
        reserved: 1,
        occupied: 1,
        turnover: 0,
        out_of_service: 0,
      },
      {
        ward_id: 2,
        code: "GW",
        name: "General Ward",
        ward_type: "General",
        gender_restriction: "male",
        total_beds: 10,
        available: 3,
        reserved: 2,
        occupied: 4,
        turnover: 1,
        out_of_service: 0,
      },
    ],
    summary: { ICU: 2, GW: 3 },
    beds: [
      {
        bed_id: 1,
        ward_id: 1,
        label: "ICU-1",
        current_state: "Available",
        state_changed_at: "2026-10-31T10:00:00Z",
        is_overflow_allowed: false,
        admission_id: null,
        patient_name: null,
        mrn: null,
        admission_status: null,
        is_overflow: null,
        discharge_blocked_on: null,
      },
      {
        bed_id: 2,
        ward_id: 1,
        label: "ICU-2",
        current_state: "Occupied",
        state_changed_at: "2026-10-31T08:00:00Z",
        is_overflow_allowed: false,
        admission_id: 10,
        patient_name: "Patient A",
        mrn: "MRN-1",
        admission_status: "Admitted",
        is_overflow: null,
        discharge_blocked_on: null,
      },
      {
        bed_id: 3,
        ward_id: 1,
        label: "ICU-3",
        current_state: "Available",
        state_changed_at: "2026-10-31T10:00:00Z",
        is_overflow_allowed: false,
        admission_id: null,
        patient_name: null,
        mrn: null,
        admission_status: null,
        is_overflow: null,
        discharge_blocked_on: null,
      },
      {
        bed_id: 4,
        ward_id: 2,
        label: "GW-1",
        current_state: "Available",
        state_changed_at: "2026-10-31T09:00:00Z",
        is_overflow_allowed: false,
        admission_id: null,
        patient_name: null,
        mrn: null,
        admission_status: null,
        is_overflow: null,
        discharge_blocked_on: null,
      },
      {
        bed_id: 5,
        ward_id: 2,
        label: "GW-2",
        current_state: "Dirty",
        state_changed_at: "2026-10-31T09:30:00Z",
        is_overflow_allowed: false,
        admission_id: null,
        patient_name: null,
        mrn: null,
        admission_status: null,
        is_overflow: null,
        discharge_blocked_on: null,
      },
    ],
  };

  // Only Available beds returned (1, 3, 4)
  const allAvailable = filterAvailableBeds(mockMatrix, null, "all");
  assert.equal(allAvailable.length, 3);
  assert.deepEqual(
    allAvailable.map((b) => b.bed_id),
    [1, 3, 4],
  );

  // Patient's current bed (e.g. bed 1) is excluded from destination candidates
  const currentBedExcluded = filterAvailableBeds(mockMatrix, 1, "all");
  assert.equal(currentBedExcluded.length, 2);
  assert.deepEqual(
    currentBedExcluded.map((b) => b.bed_id),
    [3, 4],
  );

  // Filter by destination ward (e.g. ward 1 = ICU)
  const icuAvailable = filterAvailableBeds(mockMatrix, null, 1);
  assert.equal(icuAvailable.length, 2);
  assert.deepEqual(
    icuAvailable.map((b) => b.bed_id),
    [1, 3],
  );

  // Groups wards summary
  const summary = groupWardsSummary(mockMatrix);
  assert.equal(summary.length, 2);
  assert.equal(summary[0].code, "ICU");
  assert.equal(summary[1].code, "GW");
});

test("validateTransferInput form validation rules for head nurse", () => {
  // Missing destination bed
  const noBed = validateTransferInput({
    bed_id: undefined,
    reason: "Needs ventilation",
  });
  assert.equal(noBed.valid, false);
  assert.ok(noBed.errors.bed_id?.includes("Select an available destination bed"));

  // Destination bed is current bed
  const sameBed = validateTransferInput({
    bed_id: 5,
    current_bed_id: 5,
    reason: "Needs ventilation",
  });
  assert.equal(sameBed.valid, false);
  assert.ok(sameBed.errors.bed_id?.includes("cannot be the patient's current bed"));

  // Reason missing or too short
  const shortReason = validateTransferInput({
    bed_id: 10,
    current_bed_id: 5,
    reason: "ICU",
  });
  assert.equal(shortReason.valid, false);
  assert.ok(shortReason.errors.reason?.includes("too short"));

  // Reason valid (>= 5 chars)
  const valid = validateTransferInput({
    bed_id: 10,
    current_bed_id: 5,
    reason: "Clinical deterioration: requires mechanical ventilation in ICU",
  });
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);

  // Pre-defined quick reasons check
  assert.ok(HEAD_NURSE_TRANSFER_REASONS.length >= 5);
  for (const qr of HEAD_NURSE_TRANSFER_REASONS) {
    assert.ok(qr.reason.length >= 5);
    assert.ok(qr.labelEn.length > 0);
    assert.ok(qr.labelUr.length > 0);
  }
});

test("tariff rate change calculation and ChangeOfWard estimate notification (rule:cbaa60994a, MSDS PRE 79)", () => {
  // Format daily rate
  assert.equal(formatDailyRate(3000), "Rs. 3,000");
  assert.equal(formatDailyRate(12000), "Rs. 12,000");
  assert.equal(formatDailyRate(null), "Rs. 0");

  // Rate increase: from GW (3000) to ICU (12000)
  const increase = formatRateDifference(3000, 12000);
  assert.equal(increase.changed, true);
  assert.equal(increase.direction, "increase");
  assert.ok(increase.text.includes("+Rs. 9,000 / day increase"));

  // Rate decrease: from ICU (12000) to GW (3000)
  const decrease = formatRateDifference(12000, 3000);
  assert.equal(decrease.changed, true);
  assert.equal(decrease.direction, "decrease");
  assert.ok(decrease.text.includes("-Rs. 9,000 / day reduction"));

  // Same rate
  const same = formatRateDifference(3000, 3000);
  assert.equal(same.changed, false);
  assert.equal(same.direction, "same");
  assert.equal(same.text, "Same daily bed rate");
});

test("explainTransferError user guidance and error recovery", () => {
  const bedTaken = explainTransferError("BED_NO_LONGER_AVAILABLE");
  assert.ok(bedTaken.title.includes("Bed No Longer Available"));
  assert.ok(bedTaken.action.includes("Refresh the bed matrix"));

  const invalidState = explainTransferError("ADMISSION_STATE_INVALID");
  assert.ok(invalidState.title.includes("Admission State Invalid"));
  assert.ok(invalidState.message.includes("Only an admitted inpatient"));

  const forbidden = explainTransferError("FORBIDDEN");
  assert.ok(forbidden.title.includes("Permission Denied"));
  assert.ok(forbidden.message.includes("ipd.admission.transfer"));

  const notFound = explainTransferError("REFERENCE_NOT_FOUND");
  assert.ok(notFound.title.includes("Reference Not Found"));

  const valError = explainTransferError("VALIDATION_ERROR");
  assert.ok(valError.title.includes("Validation Refusal"));
});
