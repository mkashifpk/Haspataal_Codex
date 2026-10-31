import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTriageScaleView,
  canConfigureTriageScale,
  canViewTriageScale,
  validateDiscriminatorInput,
  validateLevelInput,
  formatVitalSignLimit,
  explainTriageScaleError,
} from "../src/triage-scale-policy.ts";

test("triage_scale view evaluation and service capability rules (rule:813c874c56)", () => {
  // Default / no establishment
  const def = evaluateTriageScaleView(null);
  assert.equal(def.mode, "full");
  assert.equal(def.canShow, true);

  // Hidden mode
  const hidden = evaluateTriageScaleView({
    views: { screens: { triage_scale: { view: "hidden" } } },
  });
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canShow, false);

  // Open work (Retiring) mode
  const openWork = evaluateTriageScaleView({
    views: { screens: { triage_scale: { view: "open_work" } } },
  });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canShow, true);
  assert(openWork.bannerText.includes("Retiring"));

  // Records mode
  const records = evaluateTriageScaleView({
    views: { screens: { triage_scale: { view: "records" } } },
  });
  assert.equal(records.mode, "records");
  assert.equal(records.canShow, true);
  assert(records.bannerText.includes("Records view"));

  // Setup mode
  const setup = evaluateTriageScaleView({
    views: { screens: { triage_scale: { view: "setup" } } },
  });
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canShow, true);
  assert(setup.bannerText.includes("Setup view"));
});

test("role permissions gating for triage_scale operations", () => {
  const qualityOfficer = {
    permissions: ["er.triage.configure"],
    roles: ["quality_officer"],
  };
  const triageNurse = {
    permissions: ["er.visit.view"],
    roles: ["triage_nurse"],
  };
  const unauthorized = {
    permissions: [],
    roles: ["cashier"],
  };

  assert.equal(canConfigureTriageScale(qualityOfficer), true);
  assert.equal(canConfigureTriageScale(triageNurse), false);
  assert.equal(canConfigureTriageScale(unauthorized), false);

  assert.equal(canViewTriageScale(qualityOfficer), true);
  assert.equal(canViewTriageScale(triageNurse), true);
  assert.equal(canViewTriageScale(unauthorized), false);
});

test("validateDiscriminatorInput enforces rule:023ae1126f for Sign and VitalSign", () => {
  // Valid Sign discriminator (does not require vital, comparison, threshold)
  const validSign = validateDiscriminatorInput({
    kind: "Sign",
    level: 1,
    label: "Sudden collapse or unresponsiveness",
  });
  assert.equal(validSign.valid, true);
  assert.deepEqual(validSign.errors, {});

  // Invalid Sign: label too short
  const shortSign = validateDiscriminatorInput({
    kind: "Sign",
    level: 2,
    label: "No",
  });
  assert.equal(shortSign.valid, false);
  assert(shortSign.errors.label);

  // Invalid VitalSign: missing vital, comparison, threshold
  const missingVital = validateDiscriminatorInput({
    kind: "VitalSign",
    level: 1,
    label: "Critical hypoxemia",
  });
  assert.equal(missingVital.valid, false);
  assert(missingVital.errors.vital);
  assert(missingVital.errors.comparison);
  assert(missingVital.errors.threshold);

  // Valid VitalSign discriminator
  const validVital = validateDiscriminatorInput({
    kind: "VitalSign",
    level: 1,
    label: "Severe hypoxia",
    vital: "spo2",
    comparison: "<",
    threshold: 90,
  });
  assert.equal(validVital.valid, true);
  assert.deepEqual(validVital.errors, {});

  // Invalid VitalSign threshold: negative or out of bounds
  const badThreshold = validateDiscriminatorInput({
    kind: "VitalSign",
    level: 2,
    label: "Tachycardia",
    vital: "heart_rate",
    comparison: ">",
    threshold: 1500,
  });
  assert.equal(badThreshold.valid, false);
  assert(badThreshold.errors.threshold);
});

test("validateLevelInput validates level updates", () => {
  const validLevel = validateLevelInput({
    name: "Resuscitation (Code Red)",
    colour: "Red",
    target_minutes: 0,
    description: "Immediate life-threatening conditions.",
  });
  assert.equal(validLevel.valid, true);

  const invalidMinutes = validateLevelInput({
    target_minutes: 2000,
  });
  assert.equal(invalidMinutes.valid, false);
  assert(invalidMinutes.errors.target_minutes);
});

test("formatVitalSignLimit formats human-readable thresholds", () => {
  const vitalDisc = {
    discriminator_id: 10,
    level: 1,
    kind: "VitalSign",
    label: "SpO2 < 90%",
    age_group: "All",
    vital: "spo2",
    comparison: "<",
    threshold: 90,
    sort_order: 10,
    is_active: true,
  };
  const formatted = formatVitalSignLimit(vitalDisc);
  assert.equal(formatted, "Oxygen Saturation SpO2 (%) < 90");

  const signDisc = {
    discriminator_id: 11,
    level: 1,
    kind: "Sign",
    label: "Severe respiratory distress",
    age_group: "All",
    vital: null,
    comparison: null,
    threshold: null,
    sort_order: 20,
    is_active: true,
  };
  assert.equal(formatVitalSignLimit(signDisc), "Severe respiratory distress");
});

test("explainTriageScaleError provides actionable messages", () => {
  const forbidden = explainTriageScaleError({ code: "FORBIDDEN" });
  assert(forbidden.includes("er.triage.configure"));

  const valError = explainTriageScaleError({
    code: "VALIDATION_ERROR",
    message: "Vital parameter required",
  });
  assert(valError.includes("Validation error"));
});
