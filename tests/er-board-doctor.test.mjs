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

test("er_board_doctor view evaluation and service capability rules (rule:44901aa670, rule:141986b356)", () => {
  // Full view with active emergency_department capability
  const full = evaluateErBoardView(
    {
      active: ["emergency_department"],
      views: { screens: [{ screen_id: "er_board_doctor", view: "full" }] },
    },
    "er_board_doctor"
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canShow, true);
  assert.equal(full.canStartNewWork, true);

  // Full view with inactive emergency_department capability
  const inactiveCap = evaluateErBoardView(
    {
      active: ["outpatient"],
      views: { screens: [{ screen_id: "er_board_doctor", view: "full" }] },
    },
    "er_board_doctor"
  );
  assert.equal(inactiveCap.mode, "full");
  assert.equal(inactiveCap.canShow, true);
  assert.equal(inactiveCap.canStartNewWork, false);

  // Retiring / open_work mode
  const openWork = evaluateErBoardView(
    {
      active: ["emergency_department"],
      views: { screens: [{ screen_id: "er_board_doctor", view: "open_work" }] },
    },
    "er_board_doctor"
  );
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canShow, true);
  assert.equal(openWork.canStartNewWork, false);
  assert(openWork.bannerText.includes("Retiring"));
  assert(openWork.bannerText.includes("No new emergency arrivals from now on"));

  // Records view mode
  const records = evaluateErBoardView(
    {
      active: ["emergency_department"],
      views: { screens: [{ screen_id: "er_board_doctor", view: "records" }] },
    },
    "er_board_doctor"
  );
  assert.equal(records.mode, "records");
  assert.equal(records.canShow, true);
  assert.equal(records.canStartNewWork, false);
  assert(records.bannerText.includes("Records view"));

  // Hidden mode
  const hidden = evaluateErBoardView(
    {
      views: { screens: [{ screen_id: "er_board_doctor", view: "hidden" }] },
    },
    "er_board_doctor"
  );
  assert.equal(hidden.canShow, false);
  assert.equal(hidden.canStartNewWork, false);
});

test("doctor workspace roles access and permission gating for er_board_doctor", () => {
  const doctor = {
    permissions: ["er.visit.view", "er.visit.register"],
    roles: ["doctor"],
  };
  const specialist = {
    permissions: ["er.visit.view"],
    roles: ["clinical_specialist"],
  };
  const surgeon = {
    permissions: ["er.visit.view"],
    roles: ["surgeon"],
  };
  const clerk = {
    permissions: ["billing.receipt.create"],
    roles: ["cashier"],
  };

  // Doctors, specialists, and surgeons can view the board
  assert.equal(canViewErBoard(doctor), true);
  assert.equal(canViewErBoard(specialist), true);
  assert.equal(canViewErBoard(surgeon), true);

  // Registrations and trauma
  assert.equal(canRegisterErArrival(doctor), true);
  assert.equal(canRegisterErArrival(specialist), true);
  assert.equal(canRegisterErArrival(surgeon), true);
  assert.equal(canCreateTrauma(doctor), true);
  assert.equal(canCreateTrauma(specialist), true);
  assert.equal(canCreateTrauma(surgeon), true);

  // Unauthorized roles
  assert.equal(canViewErBoard(clerk), false);
  assert.equal(canRegisterErArrival(clerk), false);
  assert.equal(canCreateTrauma(clerk), false);
});

test("triage acuity ordering under rule:2422ef9b12 and MSDS 18", () => {
  const visits = [
    { er_visit_id: 1, triage_level: 3, arrived_at: "2026-11-01T00:30:00Z" },
    { er_visit_id: 2, triage_level: null, arrived_at: "2026-11-01T00:45:00Z" },
    { er_visit_id: 3, triage_level: 1, arrived_at: "2026-11-01T00:50:00Z" },
    { er_visit_id: 4, triage_level: 2, arrived_at: "2026-11-01T00:20:00Z" },
    { er_visit_id: 5, triage_level: null, arrived_at: "2026-11-01T00:10:00Z" },
  ];

  // Acuity sort: untriaged first (by arrival), then triage level (1 to 5), then arrival
  const sorted = [...visits].sort((a, b) => {
    if (a.triage_level === null && b.triage_level !== null) return -1;
    if (a.triage_level !== null && b.triage_level === null) return 1;
    if (a.triage_level === null && b.triage_level === null) {
      return new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime();
    }
    if (a.triage_level !== b.triage_level) {
      return a.triage_level - b.triage_level;
    }
    return new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime();
  });

  // Untriaged visits first ordered by arrival: visit 5 (00:10), then visit 2 (00:45)
  assert.equal(sorted[0].er_visit_id, 5);
  assert.equal(sorted[1].er_visit_id, 2);
  // Then Level 1: visit 3
  assert.equal(sorted[2].er_visit_id, 3);
  // Then Level 2: visit 4
  assert.equal(sorted[3].er_visit_id, 4);
  // Then Level 3: visit 1
  assert.equal(sorted[4].er_visit_id, 1);
});

test("clinical warning flags and color schemes under rule:618704df95", () => {
  // DoctorOverdue and MlcNotOpened hazard flags
  assert.equal(ER_FLAG_CONFIG.DoctorOverdue.isHazard, true);
  assert.equal(ER_FLAG_CONFIG.DoctorOverdue.badgeClass.includes("bg-danger"), true);

  assert.equal(ER_FLAG_CONFIG.MlcNotOpened.isHazard, true);
  assert.equal(ER_FLAG_CONFIG.MlcNotOpened.badgeClass.includes("bg-danger"), true);

  assert.equal(Boolean(ER_FLAG_CONFIG.TriageOverdue), true);
  assert.equal(Boolean(ER_FLAG_CONFIG.ObservationTooLong), true);
  assert.equal(Boolean(ER_FLAG_CONFIG.AdmissionWaitTooLong), true);
  assert.equal(Boolean(ER_FLAG_CONFIG.ReferralWaitTooLong), true);
  assert.equal(Boolean(ER_FLAG_CONFIG.MedicoLegalUndecided), true);

  // Triage colors map
  assert.equal(TRIAGE_COLOUR_MAP.Red.labelEn.includes("Resuscitation"), true);
  assert.equal(TRIAGE_COLOUR_MAP.Orange.labelEn.includes("Emergency"), true);
  assert.equal(TRIAGE_COLOUR_MAP.Yellow.labelEn.includes("Urgent"), true);
  assert.equal(TRIAGE_COLOUR_MAP.Green.labelEn.includes("Semi-urgent"), true);
  assert.equal(TRIAGE_COLOUR_MAP.Blue.labelEn.includes("Non-urgent"), true);
  assert.equal(TRIAGE_COLOUR_MAP.White.labelEn.includes("Untriaged"), true);
});

test("validateErArrivalInput and validateTraumaInput under rule:74958f2576", () => {
  const validArrival = validateErArrivalInput({
    patient_id: 101,
    arrival_mode: "Rescue1122",
    presenting_complaint: "Fall from height, suspected spinal trauma",
  });
  assert.equal(validArrival.valid, true);

  const invalidArrival = validateErArrivalInput({
    patient_id: -1,
    presenting_complaint: "A".repeat(501),
  });
  assert.equal(invalidArrival.valid, false);
  assert(invalidArrival.errors.patient_id);
  assert(invalidArrival.errors.presenting_complaint);

  const validTrauma = validateTraumaInput({
    temp_identifier: "Unknown Male 1",
    gender: "male",
    approx_age_years: 35,
  });
  assert.equal(validTrauma.valid, true);

  const invalidTrauma = validateTraumaInput({
    temp_identifier: "Unknown",
    gender: "unknown",
    approx_age_years: 200,
  });
  assert.equal(invalidTrauma.valid, false);
  assert(invalidTrauma.errors.approx_age_years);
});

test("explainErBoardError provides clinical guidance and handles ER_VISIT_OPEN (rule:74958f2576)", () => {
  const openErr = explainErBoardError({
    response: {
      error: {
        code: "ER_VISIT_OPEN",
        message: "The patient's ER visit is still open.",
        details: { er_visit_id: 77, er_number: "ER-2026-0077" },
      },
    },
  });
  assert.equal(openErr.existingVisitId, 77);
  assert(openErr.message.includes("#77"));

  const inactiveErr = explainErBoardError({
    response: {
      error: {
        code: "SERVICE_INACTIVE",
        message: "Emergency service is not active.",
      },
    },
  });
  assert(inactiveErr.message.includes("not currently active"));

  const forbiddenErr = explainErBoardError({
    response: {
      error: {
        code: "FORBIDDEN",
        message: "Permission denied",
      },
    },
  });
  assert(forbiddenErr.message.includes("Permission required"));
});
