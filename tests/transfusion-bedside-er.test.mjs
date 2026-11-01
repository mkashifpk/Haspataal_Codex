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

test("transfusion_bedside_er: evaluate screen view mode and service capability (rule:78e01b2ba4, rule:877e58cf09)", () => {
  // 1. Array-based establishment screen view
  const estFull = {
    views: {
      screens: [
        { screen_id: "transfusion_bedside_er", view: "full" },
      ],
    },
    active: ["blood_transfusion"],
  };
  assert.equal(getTransfusionBedsideScreenView(estFull, "transfusion_bedside_er"), "full");
  assert.equal(isBloodTransfusionActiveOrRetiring(estFull), true);

  // 2. Open work mode when retiring
  const estOpenWork = {
    views: {
      screens: [
        { screen_id: "transfusion_bedside_er", view: "open_work" },
      ],
    },
    active: ["blood_transfusion"],
  };
  assert.equal(getTransfusionBedsideScreenView(estOpenWork, "transfusion_bedside_er"), "open_work");
  assert.equal(isBloodTransfusionActiveOrRetiring(estOpenWork), true);

  // 3. Records mode when retired
  const estRecords = {
    views: {
      screens: [
        { screen_id: "transfusion_bedside_er", view: "records" },
      ],
    },
    active: [],
  };
  assert.equal(getTransfusionBedsideScreenView(estRecords, "transfusion_bedside_er"), "records");
  assert.equal(isBloodTransfusionActiveOrRetiring(estRecords), false);

  // 4. Default fallback when unconfigured
  assert.equal(getTransfusionBedsideScreenView(null, "transfusion_bedside_er"), "full");
});

test("transfusion_bedside_er: 30-minute cold chain countdown and expiry detection (rule:8e16f20b4a)", () => {
  const nowMs = 1730440000000; // fixed test timestamp

  // 1. Valid cold chain: start_by is 15 minutes in the future
  const startByValid = new Date(nowMs + 15 * 60 * 1000).toISOString();
  const remainingSec = getStartByRemainingSeconds(startByValid, nowMs);
  assert.equal(remainingSec, 15 * 60);
  assert.equal(formatCountdown(remainingSec), "15:00");
  assert.equal(isUnitOutTooLong(startByValid, nowMs), false, "Unit within 30 min is valid for start");

  // 2. Expired cold chain: start_by was 2 minutes ago
  const startByExpired = new Date(nowMs - 2 * 60 * 1000).toISOString();
  const expiredSec = getStartByRemainingSeconds(startByExpired, nowMs);
  assert.ok(expiredSec <= 0);
  assert.equal(formatCountdown(expiredSec), "00:00 (EXPIRED)");
  assert.equal(isUnitOutTooLong(startByExpired, nowMs), true, "Unit past 30 min threshold is marked OutTooLong");
});

test("transfusion_bedside_er: 5 mandatory bedside safety checkboxes and dual co-signature (rule:0a07d57ff8)", () => {
  // 1. Incomplete checks: missing bag check
  const incompleteChecks = {
    identity: true,
    unit_number: true,
    expiry: true,
    product: true,
    bag: false,
  };
  const incompleteResult = validateBedsideChecks(incompleteChecks);
  assert.equal(incompleteResult.valid, false);
  assert.equal(incompleteResult.failedItems.length, 1);
  assert.match(incompleteResult.failedItems[0], /bag inspection/i);

  // 2. Complete 5 checks: all true
  const completeChecks = {
    identity: true,
    unit_number: true,
    expiry: true,
    product: true,
    bag: true,
  };
  const completeResult = validateBedsideChecks(completeChecks);
  assert.equal(completeResult.valid, true);
  assert.equal(completeResult.failedItems.length, 0);

  // 3. Dual-control second checker validation
  const emptyUserResult = validateSecondChecker("", "password123", "nurse.maria");
  assert.equal(emptyUserResult.valid, false);

  const emptyPassResult = validateSecondChecker("doctor.ahmad", "", "nurse.maria");
  assert.equal(emptyPassResult.valid, false);

  // 4. Same person self-approval violation (DUAL_CONTROL_SAME_PERSON)
  const selfApprovalResult = validateSecondChecker("nurse.maria", "password123", "nurse.maria");
  assert.equal(selfApprovalResult.valid, false);
  assert.match(selfApprovalResult.error || "", /DUAL_CONTROL_SAME_PERSON/);

  // 5. Valid independent second checker
  const validSecondResult = validateSecondChecker("doctor.ahmad", "password123", "nurse.maria");
  assert.equal(validSecondResult.valid, true);
});

test("transfusion_bedside_er: vital signs observation validation & 4-hour administration limit (rule:efcdf1e299)", () => {
  // 1. Valid observations
  const validObs = {
    observed_at: "2026-11-01T08:15:00Z",
    temperature_c: 37.1,
    pulse: 78,
    bp_systolic: 120,
    bp_diastolic: 80,
    respiratory_rate: 18,
  };
  assert.equal(validateObservationInput(validObs).valid, true);

  // 2. Out of range temperature (<25 or >45 C)
  const hypothermicObs = {
    observed_at: "2026-11-01T08:15:00Z",
    temperature_c: 22.0,
  };
  assert.equal(validateObservationInput(hypothermicObs).valid, false);

  // 3. Out of range pulse (<30 or >250)
  const extremePulseObs = {
    observed_at: "2026-11-01T08:15:00Z",
    pulse: 310,
  };
  assert.equal(validateObservationInput(extremePulseObs).valid, false);

  // 4. 4-hour transfusion completion tracking (isTransfusionLate)
  const issuedAt = "2026-11-01T08:00:00Z";
  const endedOnTime = "2026-11-01T11:30:00Z"; // 3.5 hours later
  const endedLate = "2026-11-01T12:15:00Z";   // 4.25 hours later
  assert.equal(isTransfusionLate(issuedAt, endedOnTime), false);
  assert.equal(isTransfusionLate(issuedAt, endedLate), true, "Transfusion exceeding 4 hours is flagged as ended_late");
});

test("transfusion_bedside_er: adverse reaction reporting and Section 13 incident rules (rule:a2f80c80d7)", () => {
  // 1. Valid standard reaction
  const validReaction = {
    noticed_at: "2026-11-01T08:25:00Z",
    reaction_type: "Febrile non-hemolytic transfusion reaction",
    signs: "Chills, rigors, temperature elevation from 37.0 to 38.6 C",
    action_taken: "Infusion immediately stopped, IV line maintained with normal saline, physician notified",
  };
  assert.equal(validateReactionInput(validReaction).valid, true);

  // 2. Delayed hemolytic reaction requires delayed_after
  const missingDelayedReaction = {
    noticed_at: "2026-11-01T08:25:00Z",
    reaction_class: "DelayedHaemolytic",
    reaction_type: "Delayed hemolytic jaundice",
    signs: "Jaundice, unexplained drop in hemoglobin",
    action_taken: "Crossmatch repeat requested, DAT performed",
  };
  assert.equal(validateReactionInput(missingDelayedReaction).valid, false);

  // 3. Bacterial contamination reaction requires suspected organism
  const missingOrganismReaction = {
    noticed_at: "2026-11-01T08:25:00Z",
    reaction_class: "Bacterial",
    reaction_type: "Bacterial sepsis",
    signs: "Profound hypotension, high fever, septic shock",
    action_taken: "Blood cultures sent, broad spectrum antibiotics initiated",
  };
  assert.equal(validateReactionInput(missingOrganismReaction).valid, false);

  // 4. Fatal reaction must specify harm as 'Death'
  const invalidHarmFatal = {
    noticed_at: "2026-11-01T08:25:00Z",
    reaction_type: "Fatal acute hemolytic reaction",
    signs: "Cardiac arrest during infusion",
    action_taken: "CPR performed",
    fatal: true,
    harm: "Severe", // invalid, must be "Death"
  };
  assert.equal(validateReactionInput(invalidHarmFatal).valid, false);
});

test("transfusion_bedside_er: explainTransfusionError maps domain refusal codes", () => {
  const coldChainError = explainTransfusionError("BLOOD_UNIT_OUT_TOO_LONG");
  assert.match(coldChainError.title, /Cold Chain/i);
  assert.match(coldChainError.action, /OutOfStorageTooLong/i);

  const consentError = explainTransfusionError("BLOOD_CONSENT_REQUIRED");
  assert.match(consentError.title, /Consent/i);

  const dualControlError = explainTransfusionError("DUAL_CONTROL_SAME_PERSON");
  assert.match(dualControlError.title, /Dual Independent Control/i);

  const expiredError = explainTransfusionError("BLOOD_UNIT_EXPIRED");
  assert.match(expiredError.title, /Expired/i);
});
