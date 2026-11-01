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

test("evaluateErVisitView evaluates er_visit_doctor under rule:c8b716e97e and service capability", () => {
  // Full view with active emergency_department capability
  const fullEst = {
    active: ["emergency_department"],
    views: { screens: [{ screen_id: "er_visit_doctor", view: "full" }] },
  };
  const fullEval = evaluateErVisitView(fullEst, "er_visit_doctor");
  assert.equal(fullEval.canShow, true);
  assert.equal(fullEval.canStartNewWork, true);
  assert.equal(fullEval.isReadOnly, false);
  assert.equal(fullEval.bannerNotice, null);

  // Retiring / open_work mode
  const openWorkEst = {
    active: ["emergency_department"],
    views: { screens: [{ screen_id: "er_visit_doctor", view: "open_work" }] },
  };
  const openWorkEval = evaluateErVisitView(openWorkEst, "er_visit_doctor");
  assert.equal(openWorkEval.canShow, true);
  assert.equal(openWorkEval.canStartNewWork, false);
  assert.equal(openWorkEval.isReadOnly, false);
  assert.match(openWorkEval.bannerNotice, /No new emergency visits/);

  // Inactive capability -> read-only records mode
  const inactiveEst = {
    active: [],
    views: { screens: [{ screen_id: "er_visit_doctor", view: "full" }] },
  };
  const inactiveEval = evaluateErVisitView(inactiveEst, "er_visit_doctor");
  assert.equal(inactiveEval.canShow, true);
  assert.equal(inactiveEval.canStartNewWork, false);
  assert.equal(inactiveEval.isReadOnly, true);

  // Hidden mode
  const hiddenEst = {
    active: ["emergency_department"],
    views: { screens: [{ screen_id: "er_visit_doctor", view: "hidden" }] },
  };
  const hiddenEval = evaluateErVisitView(hiddenEst, "er_visit_doctor");
  assert.equal(hiddenEval.canShow, false);
});

test("doctor workspace roles access and permission gating for er_visit_doctor", () => {
  const doctor = {
    user_id: 10,
    roles: ["doctor"],
    permissions: ["er.visit.view", "er.triage.record", "er.visit.manage", "mlc.case.manage", "patient.document.upload", "patient.document.view"],
  };
  assert.equal(canViewErVisit(doctor), true);
  assert.equal(canRecordTriage(doctor), true);
  assert.equal(canManageErVisit(doctor), true);
  assert.equal(canManageMlc(doctor), true);
  assert.equal(canUploadDocument(doctor), true);
  assert.equal(canViewDocument(doctor), true);

  const surgeon = {
    user_id: 11,
    roles: ["surgeon"],
    permissions: ["er.visit.view", "er.visit.manage"],
  };
  assert.equal(canViewErVisit(surgeon), true);
  assert.equal(canRecordTriage(surgeon), true);
  assert.equal(canManageErVisit(surgeon), true);
  assert.equal(canManageMlc(surgeon), true);

  const clerk = {
    user_id: 12,
    roles: ["cashier"],
    permissions: ["billing.receipt.create"],
  };
  assert.equal(canViewErVisit(clerk), false);
  assert.equal(canRecordTriage(clerk), false);
  assert.equal(canManageErVisit(clerk), false);
  assert.equal(canManageMlc(clerk), false);
});

test("triage calculation and override validation under rule:b985ad38dc and rule:bd91e95b22", () => {
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
        description: "Imminently life-threatening",
        signs: [
          { discriminator_id: 201, level: 2, kind: "Sign", label: "Severe stridor / airway compromise", age_group: "All", sort_order: 1, is_active: true },
        ],
        vital_signs: [
          { discriminator_id: 202, level: 2, kind: "VitalSign", label: "Heart Rate > 140", age_group: "Adult", vital: "heart_rate", comparison: ">", threshold: 140, sort_order: 2, is_active: true },
        ],
      },
      {
        level: 3,
        name: "Urgent",
        colour: "Yellow",
        target_minutes: 30,
        description: "Potentially life-threatening",
        signs: [],
        vital_signs: [],
      },
      {
        level: 4,
        name: "Semi-urgent",
        colour: "Green",
        target_minutes: 60,
        description: "Potentially serious",
        signs: [],
        vital_signs: [],
      },
      {
        level: 5,
        name: "Non-urgent",
        colour: "Blue",
        target_minutes: 120,
        description: "Less urgent",
        signs: [],
        vital_signs: [],
      },
    ],
  };

  // Danger sign trigger
  const resusCalc = calculateSuggestedTriageLevel(mockScale, 45, [101], {});
  assert.equal(resusCalc.suggestedLevel, 1);
  assert.equal(resusCalc.matchedDiscriminators.length, 1);

  // Vital sign trigger (adult HR > 140)
  const emergCalc = calculateSuggestedTriageLevel(mockScale, 30, [], { heart_rate: 155 });
  assert.equal(emergCalc.suggestedLevel, 2);

  // Triage input validation: matching suggested level requires no override reason
  const validNoOverride = validateTriageInput(
    {
      assigned_level: 2,
      is_medico_legal: false,
      presenting_complaint: "Acute asthma attack",
    },
    2
  );
  assert.deepEqual(validNoOverride, {});

  // Overriding suggested level 1 with level 3 requires minimum 5-char rationale
  const invalidOverride = validateTriageInput(
    {
      assigned_level: 3,
      is_medico_legal: false,
      presenting_complaint: "Minor pain",
      override_reason: "ok",
    },
    1
  );
  assert(invalidOverride.override_reason);

  const validOverride = validateTriageInput(
    {
      assigned_level: 3,
      is_medico_legal: false,
      presenting_complaint: "Anxiety attack resolved post reassurance",
      override_reason: "Vitals normalized and danger signs subsided post treatment",
    },
    1
  );
  assert.equal(validOverride.override_reason, undefined);
});

test("medico-legal checklist and stage progression validation (rule:50175606cd, rule:436225bf5c)", () => {
  // MLC requires mlc_case_type_id when is_medico_legal is true
  const invalidMlc = validateTriageInput(
    {
      assigned_level: 3,
      is_medico_legal: true,
      mlc_case_type_id: null,
      presenting_complaint: "Alleged physical assault",
    },
    3
  );
  assert(invalidMlc.mlc_case_type_id);

  // Valid stage input
  const validStage = validateStageInput({
    stage: "InTreatment",
    note: "Commencing clinical assessment and IV cannulation",
  });
  assert.deepEqual(validStage, {});

  // AwaitingReferral requires note
  const missingReferralNotes = validateStageInput({
    stage: "AwaitingReferral",
    note: "",
  });
  assert(missingReferralNotes.note);
});

test("departure disposition validation and LWBS rules (rule:1c52f88e02, rule:231e22e6bd)", () => {
  const mockVisit = {
    er_visit_id: 1,
    seen_at: "2026-11-01T07:00:00Z",
    seen_by: 10,
    admission_id: null,
  };

  // Normal discharge
  const validDischarge = validateDepartureInput(
    {
      disposition: "Discharged",
      condition_at_departure: "Improved",
      follow_up_advice: "Follow up in OPD after 3 days. Complete prescribed antibiotic course.",
    },
    mockVisit
  );
  assert.deepEqual(validDischarge, {});

  // Referred disposition requires referred_to and referral_reason
  const incompleteReferral = validateDepartureInput(
    {
      disposition: "Referred",
      condition_at_departure: "Stable",
      referred_to: "",
      referral_reason: "",
    },
    mockVisit
  );
  assert(incompleteReferral.referred_to);
  assert(incompleteReferral.referral_reason);

  // LWBS is prohibited once seen by doctor
  const lwbsAfterSeen = validateDepartureInput(
    {
      disposition: "LeftWithoutBeingSeen",
      condition_at_departure: "Stable",
      absence_noticed_at: "2026-11-01T07:30:00Z",
    },
    mockVisit
  );
  assert(lwbsAfterSeen.disposition);
});

test("outside reports validation and domain error recovery (rule:7571033b1d, rule:794ff452da)", () => {
  const validDoc = validateOutsideDocument({
    file: new File(["dummy content"], "chest_xray.png", { type: "image/png" }),
    doc_type: "Imaging",
    title: "Chest X-Ray PA View",
    source_facility: "City Diagnostic Centre",
    document_date: "2026-10-25",
  });
  assert.deepEqual(validDoc, {});

  const missingFacility = validateOutsideDocument({
    file: new File(["dummy content"], "cbc_report.pdf", { type: "application/pdf" }),
    doc_type: "LabReport",
    title: "Complete Blood Count",
    source_facility: "",
    document_date: "2026-10-25",
  });
  assert(missingFacility.source_facility);

  // Explain domain errors
  const departedErr = explainErVisitError({ code: "ER_VISIT_DEPARTED" });
  assert(departedErr.includes("read-only"));

  const payloadTooLarge = explainErVisitError({ code: "PAYLOAD_TOO_LARGE" });
  assert(payloadTooLarge.includes("exceeds"));
});
