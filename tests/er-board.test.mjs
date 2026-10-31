import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateErBoardView,
  canViewErBoard,
  canRegisterErArrival,
  canCreateTrauma,
  validateErArrivalInput,
  validateTraumaInput,
  explainErBoardError,
  ER_FLAG_CONFIG,
  TRIAGE_COLOUR_MAP,
} from "../src/er-board-policy.ts";

test("er_board view evaluation and service capability rules (rule:9501947a0e, rule:141986b356)", () => {
  // Full view with active service
  const full = evaluateErBoardView({
    active: ["emergency_department"],
    views: { screens: { er_board: { view: "full" } } },
  });
  assert.equal(full.mode, "full");
  assert.equal(full.canShow, true);
  assert.equal(full.canStartNewWork, true);

  // Full view with inactive emergency_department capability
  const inactiveCap = evaluateErBoardView({
    active: ["outpatient"],
    views: { screens: { er_board: { view: "full" } } },
  });
  assert.equal(inactiveCap.canStartNewWork, false);

  // Retiring / open_work mode
  const openWork = evaluateErBoardView({
    active: ["emergency_department"],
    views: { screens: { er_board: { view: "open_work" } } },
  });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canShow, true);
  assert.equal(openWork.canStartNewWork, false);
  assert(openWork.bannerText.includes("Retiring"));

  // Records mode
  const records = evaluateErBoardView({
    active: ["emergency_department"],
    views: { screens: { er_board: { view: "records" } } },
  });
  assert.equal(records.mode, "records");
  assert.equal(records.canShow, true);
  assert.equal(records.canStartNewWork, false);
  assert(records.bannerText.includes("Records view"));

  // Hidden mode
  const hidden = evaluateErBoardView({
    views: { screens: { er_board: { view: "hidden" } } },
  });
  assert.equal(hidden.canShow, false);
});

test("role permissions gating for er_board operations", () => {
  const triageNurse = {
    permissions: ["er.visit.view", "er.visit.register", "ipd.admission.code_red"],
    roles: ["triage_nurse"],
  };
  const doctor = {
    permissions: ["er.visit.view", "er.visit.register"],
    roles: ["doctor"],
  };
  const cashier = {
    permissions: ["billing.receipt.create"],
    roles: ["cashier"],
  };

  assert.equal(canViewErBoard(triageNurse), true);
  assert.equal(canRegisterErArrival(triageNurse), true);
  assert.equal(canCreateTrauma(triageNurse), true);

  assert.equal(canViewErBoard(doctor), true);
  assert.equal(canRegisterErArrival(doctor), true);

  assert.equal(canViewErBoard(cashier), false);
  assert.equal(canRegisterErArrival(cashier), false);
  assert.equal(canCreateTrauma(cashier), false);
});

test("validateErArrivalInput validates required patient ID and complaint limits", () => {
  const valid = validateErArrivalInput({
    patient_id: 42,
    arrival_mode: "Ambulance",
    presenting_complaint: "Acute severe chest pain radiating to left arm",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  const missingPatient = validateErArrivalInput({
    patient_id: 0,
  });
  assert.equal(missingPatient.valid, false);
  assert(missingPatient.errors.patient_id);
});

test("validateTraumaInput validates approximate age limits", () => {
  const validTrauma = validateTraumaInput({
    temp_identifier: "Unknown Male 1",
    gender: "male",
    approx_age_years: 35,
  });
  assert.equal(validTrauma.valid, true);

  const invalidAge = validateTraumaInput({
    approx_age_years: 150,
  });
  assert.equal(invalidAge.valid, false);
  assert(invalidAge.errors.approx_age_years);
});

test("ER_FLAG_CONFIG covers all 7 server flags under rule:618704df95", () => {
  const requiredFlags = [
    "TriageOverdue",
    "DoctorOverdue",
    "ObservationTooLong",
    "AdmissionWaitTooLong",
    "ReferralWaitTooLong",
    "MlcNotOpened",
    "MedicoLegalUndecided",
  ];

  for (const flag of requiredFlags) {
    assert(ER_FLAG_CONFIG[flag], `Flag ${flag} must be configured`);
    assert(ER_FLAG_CONFIG[flag].labelEn);
    assert(ER_FLAG_CONFIG[flag].labelUr);
    assert(ER_FLAG_CONFIG[flag].badgeClass);
  }

  // MlcNotOpened and DoctorOverdue are high-hazard flags
  assert.equal(ER_FLAG_CONFIG.MlcNotOpened.isHazard, true);
  assert.equal(ER_FLAG_CONFIG.DoctorOverdue.isHazard, true);
});

test("explainErBoardError provides actionable guidance including ER_VISIT_OPEN (rule:74958f2576)", () => {
  const openVisit = explainErBoardError({
    response: {
      error: {
        code: "ER_VISIT_OPEN",
        message: "Patient already has an open ER visit",
        details: { er_visit_id: 105, er_number: "ER-2026-000105" },
      },
    },
  });
  assert(openVisit.message.includes("105"));
  assert.equal(openVisit.existingVisitId, 105);

  const forbidden = explainErBoardError({ code: "FORBIDDEN" });
  assert(forbidden.message.includes("Permission required"));
});
