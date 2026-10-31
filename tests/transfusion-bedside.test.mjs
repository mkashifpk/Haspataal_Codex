import test from "node:test";
import assert from "node:assert/strict";
import {
  getTransfusionBedsideScreenView,
  isBloodTransfusionActiveOrRetiring,
  getStartByRemainingSeconds,
  formatCountdown,
  isUnitOutTooLong,
  isTransfusionLate,
  validateBedsideChecks,
  validateSecondChecker,
  validateObservationInput,
  validateReactionInput,
  explainTransfusionError,
} from "../src/transfusion-bedside-policy.ts";

test("transfusion_bedside view modes and service capability gates (rule:d97564a224, rule:877e58cf09)", () => {
  // Case 1: Active blood_transfusion, full view
  const fullEst = {
    active: ["blood_transfusion"],
    views: { screens: [{ screen_id: "transfusion_bedside", view: "full" }] },
  };
  assert.equal(getTransfusionBedsideScreenView(fullEst), "full");
  assert.equal(isBloodTransfusionActiveOrRetiring(fullEst), true);

  // Case 2: Inactive blood_transfusion capability
  const inactiveEst = {
    active: ["laboratory"],
    views: { screens: [{ screen_id: "transfusion_bedside", view: "full" }] },
  };
  assert.equal(isBloodTransfusionActiveOrRetiring(inactiveEst), false);

  // Case 3: Retiring open_work view
  const retiringEst = {
    active: ["blood_transfusion"],
    views: { screens: [{ screen_id: "transfusion_bedside", view: "open_work" }] },
  };
  assert.equal(getTransfusionBedsideScreenView(retiringEst), "open_work");
  assert.equal(isBloodTransfusionActiveOrRetiring(retiringEst), true, "Continues during retiring mode (rule:877e58cf09)");

  // Case 4: Records view
  const recordsEst = {
    active: ["blood_transfusion"],
    views: { screens: [{ screen_id: "transfusion_bedside", view: "records" }] },
  };
  assert.equal(getTransfusionBedsideScreenView(recordsEst), "records");

  // Case 5: Dictionary views structure
  const dictEst = {
    active: ["blood_transfusion"],
    views: { screens: { transfusion_bedside: "full" } },
  };
  assert.equal(getTransfusionBedsideScreenView(dictEst), "full");
});

test("30-minute start_by window calculation and countdown formatting (rule:8e16f20b4a)", () => {
  const baseMs = 1730368800000; // Reference timestamp

  // 15 minutes remaining
  const fifteenMinsLater = new Date(baseMs + 15 * 60 * 1000).toISOString();
  const remSec = getStartByRemainingSeconds(fifteenMinsLater, baseMs);
  assert.equal(remSec, 900);
  assert.equal(formatCountdown(remSec), "15:00");
  assert.equal(isUnitOutTooLong(fifteenMinsLater, baseMs), false);

  // 30 seconds remaining
  const thirtySecLater = new Date(baseMs + 30 * 1000).toISOString();
  assert.equal(getStartByRemainingSeconds(thirtySecLater, baseMs), 30);
  assert.equal(formatCountdown(30), "00:30");
  assert.equal(isUnitOutTooLong(thirtySecLater, baseMs), false);

  // Expired (exceeded 30 minutes from issue)
  const expiredTime = new Date(baseMs - 1000).toISOString();
  assert.equal(isUnitOutTooLong(expiredTime, baseMs), true);
  assert.equal(formatCountdown(getStartByRemainingSeconds(expiredTime, baseMs)), "00:00 (EXPIRED)");
});

test("transfusion duration exceeding 4 hours is flagged late (rule:efcdf1e299)", () => {
  const issuedAt = "2026-10-31T10:00:00Z";

  // Transfusion ended at 2 hours -> NOT late
  const endedNormal = "2026-10-31T12:00:00Z";
  assert.equal(isTransfusionLate(issuedAt, endedNormal), false);

  // Transfusion ended at 3h 59m -> NOT late
  const ended3h59m = "2026-10-31T13:59:00Z";
  assert.equal(isTransfusionLate(issuedAt, ended3h59m), false);

  // Transfusion ended at 4h 05m -> LATE (rule:efcdf1e299)
  const ended4h05m = "2026-10-31T14:05:00Z";
  assert.equal(isTransfusionLate(issuedAt, ended4h05m), true);
});

test("5 mandatory bedside safety checkboxes validation (rule:0a07d57ff8)", () => {
  // All 5 checked -> valid
  const allChecked = {
    identity: true,
    unit_number: true,
    expiry: true,
    product: true,
    bag: true,
  };
  const valSuccess = validateBedsideChecks(allChecked);
  assert.equal(valSuccess.valid, true);
  assert.equal(valSuccess.failedItems.length, 0);

  // Missing unit_number check -> invalid
  const missingUnit = {
    identity: true,
    unit_number: false,
    expiry: true,
    product: true,
    bag: true,
  };
  const valMissing = validateBedsideChecks(missingUnit);
  assert.equal(valMissing.valid, false);
  assert.equal(valMissing.failedItems.length, 1);
  assert(valMissing.failedItems[0].includes("Unit number"));

  // None checked -> all 5 failed
  const noneChecked = {
    identity: false,
    unit_number: false,
    expiry: false,
    product: false,
    bag: false,
  };
  const valNone = validateBedsideChecks(noneChecked);
  assert.equal(valNone.valid, false);
  assert.equal(valNone.failedItems.length, 5);
});

test("dual independent co-signature and self-approval refusal (rule:0a07d57ff8)", () => {
  // Missing username or password
  assert.equal(validateSecondChecker("", "pass123", "nurse_ali").valid, false);
  assert.equal(validateSecondChecker("nurse_fatima", "", "nurse_ali").valid, false);

  // Valid independent second checker
  const validCheck = validateSecondChecker("dr_hassan", "SecurePass123!", "nurse_ali");
  assert.equal(validCheck.valid, true);

  // Refuse self-approval (current user cannot co-sign own bedside verification)
  const selfCheck = validateSecondChecker("nurse_ali", "AnyPass", "nurse_ali");
  assert.equal(selfCheck.valid, false);
  assert(selfCheck.error?.includes("DUAL_CONTROL_SAME_PERSON"));

  // Case-insensitive self-approval check
  const caseCheck = validateSecondChecker("NURSE_ALI", "AnyPass", "nurse_ali");
  assert.equal(caseCheck.valid, false);
  assert(caseCheck.error?.includes("DUAL_CONTROL_SAME_PERSON"));
});

test("bedside vital signs observation validation", () => {
  // Valid observation
  const validObs = {
    observed_at: "2026-10-31T11:15:00Z",
    temperature_c: "37.2",
    pulse: 78,
    blood_pressure_systolic: 120,
    blood_pressure_diastolic: 80,
    respiratory_rate: 18,
    note: "Patient resting comfortably",
  };
  assert.equal(validateObservationInput(validObs).valid, true);

  // Missing observation timestamp
  assert.equal(validateObservationInput({ ...validObs, observed_at: "" }).valid, false);

  // Out of range temperature
  assert.equal(validateObservationInput({ ...validObs, temperature_c: "52.0" }).valid, false);

  // Out of range pulse
  assert.equal(validateObservationInput({ ...validObs, pulse: 290 }).valid, false);
});

test("adverse transfusion reaction validation and PBTA Section 13 rules (rule:a2f80c80d7)", () => {
  // Valid standard acute reaction
  const validRx = {
    noticed_at: "2026-10-31T11:30:00Z",
    reaction_class: "Haemolytic",
    harm: "Moderate",
    reaction_type: "Acute haemolytic reaction",
    signs: "Chills, loin pain, dark urine",
    action_taken: "Infusion stopped, IV fluids running, blood bank notified",
    fatal: false,
    wrong_blood: false,
  };
  assert.equal(validateReactionInput(validRx).valid, true);

  // Missing mandatory signs or action taken
  assert.equal(validateReactionInput({ ...validRx, signs: "" }).valid, false);
  assert.equal(validateReactionInput({ ...validRx, action_taken: "" }).valid, false);

  // Delayed haemolytic reaction requires delayed_after
  const delayedRx = {
    ...validRx,
    reaction_class: "DelayedHaemolytic",
    delayed_after: undefined,
  };
  const delayedVal = validateReactionInput(delayedRx);
  assert.equal(delayedVal.valid, false);
  assert(delayedVal.error?.includes("delayed_after"));

  // Bacterial contamination requires suspected organism
  const bacterialRx = {
    ...validRx,
    reaction_class: "Bacterial",
    organism: undefined,
  };
  const bactVal = validateReactionInput(bacterialRx);
  assert.equal(bactVal.valid, false);
  assert(bactVal.error?.includes("organism"));

  // Fatal reaction must specify harm as 'Death'
  const fatalMismatch = {
    ...validRx,
    fatal: true,
    harm: "Severe",
  };
  const fatalVal = validateReactionInput(fatalMismatch);
  assert.equal(fatalVal.valid, false);
  assert(fatalVal.error?.includes("Death"));
});

test("transfusion domain error explanations handle standard codes", () => {
  const coldChainErr = explainTransfusionError("BLOOD_UNIT_OUT_TOO_LONG");
  assert(coldChainErr.title.includes("Cold Chain"));
  assert(coldChainErr.action.includes("OutOfStorageTooLong"));

  const consentErr = explainTransfusionError("BLOOD_CONSENT_REQUIRED");
  assert(consentErr.title.includes("Consent"));

  const dualCtrlErr = explainTransfusionError("DUAL_CONTROL_SAME_PERSON");
  assert(dualCtrlErr.title.includes("Dual Independent"));

  const expErr = explainTransfusionError("BLOOD_UNIT_EXPIRED");
  assert(expErr.title.includes("Expired"));
});
