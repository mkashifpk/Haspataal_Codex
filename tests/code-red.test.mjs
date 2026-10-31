import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCodeRedView,
  canTriggerCodeRed,
  canConfirmArrival,
  canCreateTrauma,
  validateCodeRedInput,
  validateTraumaInput,
  explainCodeRedError,
} from "../src/code-red-policy.ts";

test("evaluateCodeRedView checks service active state and surgery capability (rule:97aab11043, rule:e67eb016d9, rule:45f4e0ca60)", () => {
  const fullEst = {
    active: ["inpatient", "emergency_department", "surgery"],
    views: { screens: { code_red: "full" } },
  };
  const fullEval = evaluateCodeRedView(fullEst);
  assert.equal(fullEval.canShow, true);
  assert.equal(fullEval.canStartNewWork, true);
  assert.equal(fullEval.canOfferEmergency, true);
  assert.equal(fullEval.canOfferSurgery, true);
  assert.equal(fullEval.bannerNotice, null);

  const noSurgeryEst = {
    active: ["inpatient", "emergency_department"],
    views: { screens: { code_red: "full" } },
  };
  const noSurgeryEval = evaluateCodeRedView(noSurgeryEst);
  assert.equal(noSurgeryEval.canOfferSurgery, false);

  const openWorkEst = {
    active: ["inpatient"],
    views: { screens: { code_red: "open_work" } },
  };
  const openWorkEval = evaluateCodeRedView(openWorkEst);
  assert.equal(openWorkEval.canShow, true);
  assert.equal(openWorkEval.canStartNewWork, false);
  assert.match(openWorkEval.bannerNotice, /No new emergency admissions/);

  const inactiveEst = {
    active: [],
    views: { screens: { code_red: "full" } },
  };
  const inactiveEval = evaluateCodeRedView(inactiveEst);
  assert.equal(inactiveEval.canShow, true);
  assert.equal(inactiveEval.canStartNewWork, false);
  assert.equal(inactiveEval.isReadOnly, true);
});

test("role permissions gating for Code Red operations", () => {
  const doctor = {
    user_id: 1,
    permissions: ["ipd.admission.code_red", "ipd.doctor.care"],
  };
  assert.equal(canTriggerCodeRed(doctor), true);
  assert.equal(canConfirmArrival(doctor), true);
  assert.equal(canCreateTrauma(doctor), true);

  const clerk = {
    user_id: 2,
    permissions: ["patient.view"],
  };
  assert.equal(canTriggerCodeRed(clerk), false);
  assert.equal(canConfirmArrival(clerk), false);
});

test("validateCodeRedInput ensures patient identity and destination ward without blocking on billing or photos (rule:79df75a537, rule:ddc33f8c02)", () => {
  const viewEvalWithSurgery = {
    canShow: true,
    canStartNewWork: true,
    isReadOnly: false,
    isSetupOnly: false,
    canOfferEmergency: true,
    canOfferSurgery: true,
    bannerNotice: null,
  };

  // Missing patient info
  const errNoPatient = validateCodeRedInput(
    { ward_type: "ICU" },
    viewEvalWithSurgery
  );
  assert(errNoPatient.patient);

  // Missing destination ward
  const errNoWard = validateCodeRedInput(
    { patient_id: 101 },
    viewEvalWithSurgery
  );
  assert(errNoWard.ward);

  // Valid trauma intake with surgery hold when surgery is active
  const validWithSurgery = validateCodeRedInput(
    {
      temp_identifier: "Unknown Male 1",
      gender: "male",
      ward_type: "ICU",
      needs_ot: true,
      eta_minutes: 5,
    },
    viewEvalWithSurgery
  );
  assert.deepEqual(validWithSurgery, {});

  // When surgery is inactive, requesting needs_ot fails (rule:45f4e0ca60)
  const viewEvalNoSurgery = {
    ...viewEvalWithSurgery,
    canOfferSurgery: false,
  };
  const errNeedsOt = validateCodeRedInput(
    {
      patient_id: 101,
      ward_type: "ICU",
      needs_ot: true,
    },
    viewEvalNoSurgery
  );
  assert(errNeedsOt.needs_ot);
});

test("validateTraumaInput checks temporary identifier and age bounds", () => {
  const errNoId = validateTraumaInput({ temp_identifier: "", gender: "male" });
  assert(errNoId.temp_identifier);

  const errAge = validateTraumaInput({
    temp_identifier: "Unknown Female RTA",
    gender: "female",
    approx_age_years: 150,
  });
  assert(errAge.approx_age_years);

  const valid = validateTraumaInput({
    temp_identifier: "Unknown Male 1",
    gender: "male",
    approx_age_years: 35,
  });
  assert.deepEqual(valid, {});
});

test("explainCodeRedError provides actionable error instructions", () => {
  assert.match(explainCodeRedError({ code: "INPATIENT_INACTIVE" }), /Inpatient service is currently inactive/);
  assert.match(explainCodeRedError({ code: "SURGERY_INACTIVE" }), /Surgery service is inactive/);
  assert.match(explainCodeRedError({ code: "CODE_RED_ACTIVE" }), /active Code Red admission already exists/);
  assert.match(explainCodeRedError({ code: "ALREADY_ARRIVED" }), /arrival has already been confirmed/);
});
