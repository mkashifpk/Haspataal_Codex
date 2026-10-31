import test from "node:test";
import assert from "node:assert/strict";
import {
  getObstetricAssessmentScreenView,
  isMaternityActive,
  isMaternalNutritionRequired,
  validateAssessmentInput,
  validateReferralInput,
  formatAuthorStamp,
  explainObstetricError,
} from "../src/obstetric-assessment-policy.ts";

test("obstetric_assessment view modes and service capability gates (rule:e6bd3426e5, rule:b8c60b1609, rule:b46e6c48cc)", () => {
  // Case 1: Active maternity service, full view
  const activeEst = {
    active: ["maternity", "emergency"],
    views: { screens: [{ screen_id: "obstetric_assessment", view: "full" }] },
  };
  assert.equal(getObstetricAssessmentScreenView(activeEst), "full");
  assert.equal(isMaternityActive(activeEst), true);

  // Case 2: Inactive maternity service
  const inactiveEst = {
    active: ["emergency"],
    views: { screens: [{ screen_id: "obstetric_assessment", view: "full" }] },
  };
  assert.equal(isMaternityActive(inactiveEst), false);

  // Case 3: Retiring open_work view
  const retiringEst = {
    active: ["maternity"],
    views: { screens: [{ screen_id: "obstetric_assessment", view: "open_work" }] },
  };
  assert.equal(getObstetricAssessmentScreenView(retiringEst), "open_work");

  // Case 4: Records mode
  const recordsEst = {
    active: ["maternity"],
    views: { screens: [{ screen_id: "obstetric_assessment", view: "records" }] },
  };
  assert.equal(getObstetricAssessmentScreenView(recordsEst), "records");

  // Case 5: Dictionary view mode structure
  const dictEst = {
    active: ["maternity"],
    views: { screens: { obstetric_assessment: "records" } },
  };
  assert.equal(getObstetricAssessmentScreenView(dictEst), "records");
});

test("high-risk deliberate choice and conditions validation (rule:064bedf875)", () => {
  const est = {
    active: ["maternity"],
    profile: { code: "IIC" },
  };

  // Undecided high_risk (neither button pressed) -> invalid
  const noChoice = validateAssessmentInput(
    { patient_id: 101, plan: "CareHere" },
    est
  );
  assert.equal(noChoice.valid, false);
  assert.equal(noChoice.field, "high_risk");
  assert.match(noChoice.error, /Deliberate high-risk determination is required/);

  // Standard risk (not high risk) -> valid without conditions
  const standardRisk = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: false,
      counselled: true,
      plan: "CareHere",
    },
    est
  );
  assert.equal(standardRisk.valid, true);

  // High risk with no conditions -> invalid
  const highRiskNoCond = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: [],
      counselled: true,
      counselling_note: "Patient counselled on safe delivery",
      plan: "CareHere",
    },
    est
  );
  assert.equal(highRiskNoCond.valid, false);
  assert.equal(highRiskNoCond.field, "conditions");

  // High risk without counselling note -> invalid
  const highRiskNoNote = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Haemorrhage"],
      counselled: true,
      counselling_note: "",
      plan: "CareHere",
    },
    est
  );
  assert.equal(highRiskNoNote.valid, false);
  assert.equal(highRiskNoNote.field, "counselling_note");

  // High risk with counselling unchecked -> invalid
  const highRiskUncounselled = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Haemorrhage"],
      counselled: false,
      counselling_note: "Note written",
      plan: "CareHere",
    },
    est
  );
  assert.equal(highRiskUncounselled.valid, false);
  assert.equal(highRiskUncounselled.field, "counselled");

  // Valid high risk in Category IIC
  const validHighRisk = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Haemorrhage"],
      counselled: true,
      counselling_note: "Patient and husband informed of risk and danger signs.",
      plan: "CareHere",
    },
    est
  );
  assert.equal(validHighRisk.valid, true);
});

test("Category I and II A maternal nutrition requirement (rule:272b13a3e0)", () => {
  const cat1Est = {
    active: ["maternity"],
    profile: { code: "I" },
    rules_in_force: [{ code: "high_risk_pregnancy_nutrition", applies: true }],
  };

  const cat2BEst = {
    active: ["maternity"],
    profile: { code: "IIB" },
    rules_in_force: [{ code: "high_risk_pregnancy_nutrition", applies: false }],
  };

  // Check rule detection
  assert.equal(isMaternalNutritionRequired(cat1Est, true), true, "Category I requires nutrition for high risk");
  assert.equal(isMaternalNutritionRequired(cat1Est, false), false, "Standard risk does not require nutrition");
  assert.equal(isMaternalNutritionRequired(cat2BEst, true), false, "Category II B does not mandate nutrition");

  // High risk in Category I without nutrition assessment -> invalid
  const cat1MissingNutr = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Severe Pre-eclampsia"],
      counselled: true,
      counselling_note: "Counselling given",
      plan: "CareHere",
      nutrition_assessment: "",
      nutrition_advice: "",
    },
    cat1Est
  );
  assert.equal(cat1MissingNutr.valid, false);
  assert.equal(cat1MissingNutr.field, "nutrition_assessment");

  // High risk in Category I with assessment but missing advice -> invalid
  const cat1MissingAdvice = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Severe Pre-eclampsia"],
      counselled: true,
      counselling_note: "Counselling given",
      plan: "CareHere",
      nutrition_assessment: "BMI 19.2, pale conjunctiva, mild oedema.",
      nutrition_advice: "",
    },
    cat1Est
  );
  assert.equal(cat1MissingAdvice.valid, false);
  assert.equal(cat1MissingAdvice.field, "nutrition_advice");

  // High risk in Category I with full nutrition assessment & advice -> valid
  const cat1Full = validateAssessmentInput(
    {
      patient_id: 101,
      high_risk: true,
      conditions: ["Severe Pre-eclampsia"],
      counselled: true,
      counselling_note: "Counselling given",
      plan: "CareHere",
      nutrition_assessment: "BMI 19.2, pale conjunctiva, mild oedema.",
      nutrition_advice: "Prescribed elemental iron, high-protein diet, salt restriction.",
    },
    cat1Est
  );
  assert.equal(cat1Full.valid, true);
});

test("referral input validation (rule:064bedf875)", () => {
  // Missing destination
  assert.equal(
    validateReferralInput({
      destination_name: "",
      reason: "Needs tertiary NICU",
      urgency: "Urgent",
      clinical_summary: "Preterm labour at 30 weeks",
    }).valid,
    false
  );

  // Missing reason
  assert.equal(
    validateReferralInput({
      destination_name: "DHQ Teaching Hospital",
      reason: "",
      urgency: "Urgent",
      clinical_summary: "Preterm labour at 30 weeks",
    }).valid,
    false
  );

  // Short clinical summary
  assert.equal(
    validateReferralInput({
      destination_name: "DHQ Teaching Hospital",
      reason: "Preterm",
      urgency: "Urgent",
      clinical_summary: "Sick",
    }).valid,
    false
  );

  // WithStaff transport requires escort name
  assert.equal(
    validateReferralInput({
      destination_name: "DHQ Teaching Hospital",
      reason: "Preterm labour",
      urgency: "Urgent",
      clinical_summary: "Preterm labour at 30 weeks, rupture of membranes",
      transport: "WithStaff",
      escort_name: "",
    }).valid,
    false
  );

  // Complete valid referral
  assert.equal(
    validateReferralInput({
      destination_name: "DHQ Teaching Hospital",
      reason: "Preterm labour with twins",
      urgency: "Urgent",
      clinical_summary: "32 weeks twin gestation with threatened preterm delivery and oligohydramnios.",
      transport: "WithStaff",
      escort_name: "Staff Nurse Razia",
    }).valid,
    true
  );
});

test("author stamp formatting and domain error explanations", () => {
  const stamp = {
    employee_id: 42,
    user_id: 5,
    name: "Dr. Ayesha Siddiqa",
    designation: "Consultant Obstetrician",
    registration: "PMDC 54321-P",
    at: "2026-10-31T10:00:00Z",
    text: "Dr. Ayesha Siddiqa, Consultant Obstetrician (PMDC 54321-P), 31-Oct-2026 10:00",
  };

  assert.equal(
    formatAuthorStamp(stamp),
    "Dr. Ayesha Siddiqa — Consultant Obstetrician — (PMDC 54321-P)"
  );
  assert.equal(formatAuthorStamp(null), "Unknown Clinician");

  const nutrErr = explainObstetricError("MATERNAL_NUTRITION_REQUIRED");
  assert.equal(nutrErr.title, "Nutritional Assessment Required");
  assert.match(nutrErr.action, /Complete the nutritional assessment/);

  const capErr = explainObstetricError("CAPABILITY_INACTIVE");
  assert.equal(capErr.title, "Maternity Capability Inactive");

  const lockErr = explainObstetricError("CLINICAL_LOCKOUT");
  assert.equal(lockErr.title, "Clinical Lockout on Visit");
});
