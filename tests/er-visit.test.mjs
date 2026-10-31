import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateErVisitView,
  canViewErVisit,
  canRecordTriage,
  canManageErVisit,
  canManageMlc,
  canUploadDocument,
  canViewDocument,
  calculateSuggestedTriageLevel,
  validateTriageInput,
  validateStageInput,
  validateDepartureInput,
  validateOutsideDocument,
  explainErVisitError,
} from "../src/er-visit-policy.ts";

test("evaluateErVisitView respects service active status and screen view modes (rule:cbd04d6c73)", () => {
  const fullEst = {
    active: ["emergency_department"],
    views: { screens: { er_visit: "full" } },
  };
  const fullEval = evaluateErVisitView(fullEst);
  assert.equal(fullEval.canShow, true);
  assert.equal(fullEval.canStartNewWork, true);
  assert.equal(fullEval.isReadOnly, false);
  assert.equal(fullEval.bannerNotice, null);

  const openWorkEst = {
    active: ["emergency_department"],
    views: { screens: { er_visit: "open_work" } },
  };
  const openWorkEval = evaluateErVisitView(openWorkEst);
  assert.equal(openWorkEval.canShow, true);
  assert.equal(openWorkEval.canStartNewWork, false);
  assert.equal(openWorkEval.isReadOnly, false);
  assert.match(openWorkEval.bannerNotice, /No new emergency visits/);

  const inactiveEst = {
    active: [],
    views: { screens: { er_visit: "full" } },
  };
  const inactiveEval = evaluateErVisitView(inactiveEst);
  assert.equal(inactiveEval.canShow, true);
  assert.equal(inactiveEval.canStartNewWork, false);
  assert.equal(inactiveEval.isReadOnly, true);

  const hiddenEst = {
    active: ["emergency_department"],
    views: { screens: { er_visit: "hidden" } },
  };
  const hiddenEval = evaluateErVisitView(hiddenEst);
  assert.equal(hiddenEval.canShow, false);
});

test("role permissions gating for ER visit operations", () => {
  const triageNurse = {
    user_id: 1,
    permissions: ["er.visit.view", "er.triage.record", "patient.document.upload", "patient.document.view"],
  };
  assert.equal(canViewErVisit(triageNurse), true);
  assert.equal(canRecordTriage(triageNurse), true);
  assert.equal(canManageErVisit(triageNurse), false);
  assert.equal(canUploadDocument(triageNurse), true);
  assert.equal(canViewDocument(triageNurse), true);

  const erDoctor = {
    user_id: 2,
    permissions: ["er.visit.view", "er.visit.manage", "mlc.case.manage"],
  };
  assert.equal(canViewErVisit(erDoctor), true);
  assert.equal(canManageErVisit(erDoctor), true);
  assert.equal(canManageMlc(erDoctor), true);
});

test("calculateSuggestedTriageLevel determines priority by danger signs and vitals (rule:b985ad38dc)", () => {
  const mockScale = {
    child_age_years: 12,
    default_level: 5,
    levels: [
      {
        level: 1,
        name: "Resuscitation",
        colour: "Red",
        target_minutes: 0,
        description: "Immediate life-threatening",
        signs: [
          { discriminator_id: 101, level: 1, kind: "Sign", label: "Cardiac arrest / apneic", age_group: "All", sort_order: 1, is_active: true },
        ],
        vital_signs: [
          { discriminator_id: 102, level: 1, kind: "VitalSign", label: "SpO2 < 85%", age_group: "All", vital: "spo2", comparison: "<", threshold: 85, sort_order: 2, is_active: true },
        ],
      },
      {
        level: 2,
        name: "Emergency",
        colour: "Orange",
        target_minutes: 10,
        description: "High risk",
        signs: [
          { discriminator_id: 201, level: 2, kind: "Sign", label: "Severe chest pain radiating to left arm", age_group: "Adult", sort_order: 1, is_active: true },
        ],
        vital_signs: [
          { discriminator_id: 202, level: 2, kind: "VitalSign", label: "Heart Rate > 140 bpm (Adult)", age_group: "Adult", vital: "heart_rate", comparison: ">", threshold: 140, sort_order: 2, is_active: true },
        ],
      },
      {
        level: 3,
        name: "Urgent",
        colour: "Yellow",
        target_minutes: 30,
        description: "Moderate distress",
        signs: [],
        vital_signs: [],
      },
    ],
  };

  // Adult with normal vitals and no signs -> default 5
  const resultDefault = calculateSuggestedTriageLevel(mockScale, 30, [], { spo2: 98, heart_rate: 75 });
  assert.equal(resultDefault.suggestedLevel, 5);

  // Patient with danger sign 101 -> Level 1
  const resultSign1 = calculateSuggestedTriageLevel(mockScale, 30, [101], { spo2: 98 });
  assert.equal(resultSign1.suggestedLevel, 1);
  assert.equal(resultSign1.matchedDiscriminators.length, 1);
  assert.equal(resultSign1.matchedDiscriminators[0].discriminator_id, 101);

  // Patient with SpO2 = 82% (< 85%) -> Level 1
  const resultVital1 = calculateSuggestedTriageLevel(mockScale, 30, [], { spo2: 82 });
  assert.equal(resultVital1.suggestedLevel, 1);

  // Adult with heart_rate = 150 (> 140) -> Level 2
  const resultAdultVital2 = calculateSuggestedTriageLevel(mockScale, 45, [], { heart_rate: 150 });
  assert.equal(resultAdultVital2.suggestedLevel, 2);

  // Child (age 5) with heart_rate = 150 should NOT match adult-only discriminator 202
  const resultChildVital2 = calculateSuggestedTriageLevel(mockScale, 5, [], { heart_rate: 150 });
  assert.equal(resultChildVital2.suggestedLevel, 5);
});

test("validateTriageInput requires complaint, override reason when diverging, and MLC checklist (rule:bd91e95b22, rule:50175606cd)", () => {
  // Missing complaint
  const errNoComplaint = validateTriageInput(
    { presenting_complaint: "", is_medico_legal: false },
    3
  );
  assert(errNoComplaint.presenting_complaint);

  // Divergent level without override reason
  const errNoOverride = validateTriageInput(
    {
      presenting_complaint: "Acute abdominal pain",
      assigned_level: 2,
      override_reason: "",
      is_medico_legal: false,
    },
    3 // suggested is 3, assigned is 2
  );
  assert(errNoOverride.override_reason);

  // Divergent level with valid override reason passes
  const validOverride = validateTriageInput(
    {
      presenting_complaint: "Acute abdominal pain",
      assigned_level: 2,
      override_reason: "Patient appears visibly pale with marked distress despite stable initial vitals",
      is_medico_legal: false,
    },
    3
  );
  assert.equal(validOverride.override_reason, undefined);

  // Medico-legal True requires mlc_case_type_id
  const errMlc = validateTriageInput(
    {
      presenting_complaint: "Gunshot wound to thigh",
      assigned_level: 1,
      is_medico_legal: true,
      mlc_case_type_id: null,
    },
    1
  );
  assert(errMlc.mlc_case_type_id);
});

test("validateStageInput requires destination and rationale for referrals (rule:436225bf5c)", () => {
  const errNoNote = validateStageInput({
    stage: "AwaitingReferral",
    note: "",
  });
  assert(errNoNote.note);

  const validStage = validateStageInput({
    stage: "InTreatment",
  });
  assert.deepEqual(validStage, {});
});

test("validateDepartureInput enforces MSDS 20 departure requirements (rule:1c52f88e02, rule:231e22e6bd)", () => {
  const mockVisit = {
    er_visit_id: 1,
    seen_at: "2026-10-31T20:00:00Z",
    seen_by: 42,
    admission_id: null,
  };

  // Discharge requires condition and advice
  const errDischarge = validateDepartureInput(
    { disposition: "Discharged", condition_at_departure: null, follow_up_advice: "" },
    mockVisit
  );
  assert(errDischarge.condition_at_departure);
  assert(errDischarge.follow_up_advice);

  // Referral requires referred_to, reason, and condition
  const errReferral = validateDepartureInput(
    { disposition: "Referred", condition_at_departure: "Stable", referred_to: "", referral_reason: "" },
    mockVisit
  );
  assert(errReferral.referred_to);
  assert(errReferral.referral_reason);

  // LeftWithoutBeingSeen cannot be used if already attended by doctor
  const errLwbs = validateDepartureInput(
    { disposition: "LeftWithoutBeingSeen", absence_noticed_at: "2026-10-31T21:00:00Z" },
    mockVisit
  );
  assert(errLwbs.disposition);
});

test("validateOutsideDocument checks MIME type, size, facility, and future date (rule:7571033b1d, rule:794ff452da)", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);

  const futureDoc = validateOutsideDocument({
    title: "Old Discharge Summary",
    doc_type: "DischargeSummary",
    source_facility: "District Hospital",
    document_date: tomorrow.toISOString().slice(0, 10),
    file: new File(["mock"], "summary.pdf", { type: "application/pdf" }),
  });
  assert(futureDoc.document_date);

  const badMime = validateOutsideDocument({
    title: "Blood Report",
    doc_type: "LabReport",
    source_facility: "Chughtai Lab",
    document_date: "2026-10-25",
    file: new File(["mock"], "report.txt", { type: "text/plain" }),
  });
  assert(badMime.file);
});

test("explainErVisitError translates server error codes to clear instructions", () => {
  assert.match(explainErVisitError({ code: "ER_VISIT_DEPARTED" }), /permanently read-only/);
  assert.match(explainErVisitError({ code: "VALIDATION_ERROR", details: { suggested_level: 2 } }), /suggested Level 2/);
  assert.match(explainErVisitError({ code: "UNSUPPORTED_MEDIA_TYPE" }), /PDF, JPEG, or PNG/);
});
