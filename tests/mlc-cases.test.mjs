import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMlcCasesView,
  canManageMlc,
  canViewMlcRegister,
  sortMlcCases,
  validateOpenMlc,
  validateUpdateMlc,
  validatePoliceIntimation,
  validateEvidence,
  validateCloseMlc,
  explainMlcError,
} from "../src/mlc-cases-policy.ts";

test("evaluateMlcCasesView handles full, open_work, records, and hidden view states", () => {
  const full = evaluateMlcCasesView({
    views: { screens: [{ screen_id: "mlc_cases", view: "full" }] },
  });
  assert.equal(full.view, "full");
  assert.equal(full.canCreateNew, true);
  assert.equal(full.canManageOpen, true);
  assert.equal(full.canViewRecords, true);
  assert.equal(full.banner, null);

  const retiring = evaluateMlcCasesView({
    views: { screens: [{ screen_id: "mlc_cases", view: "open_work" }] },
  });
  assert.equal(retiring.view, "open_work");
  assert.equal(retiring.canCreateNew, false);
  assert.equal(retiring.canManageOpen, true);
  assert.match(retiring.banner || "", /No new medico-legal cases from now on/);

  const retired = evaluateMlcCasesView({
    views: { screens: [{ screen_id: "mlc_cases", view: "records" }] },
  });
  assert.equal(retired.view, "records");
  assert.equal(retired.canCreateNew, false);
  assert.equal(retired.canManageOpen, false);
  assert.equal(retired.canViewRecords, true);

  const hidden = evaluateMlcCasesView({
    views: { screens: [{ screen_id: "mlc_cases", view: "hidden" }] },
  });
  assert.equal(hidden.view, "hidden");
  assert.equal(hidden.canOpen, false);
});

test("canManageMlc and canViewMlcRegister correctly gate clinical roles", () => {
  assert.equal(canManageMlc({ role: "triage_nurse" }), true);
  assert.equal(canManageMlc({ role: "doctor" }), true);
  assert.equal(canManageMlc({ role: "clinical_specialist" }), true);
  assert.equal(canManageMlc({ role: "surgeon" }), true);
  assert.equal(canManageMlc({ role: "anaesthetist" }), true);
  assert.equal(canManageMlc({ role: "hospital_admin" }), false);
  assert.equal(canManageMlc({ role: "cashier" }), false);

  assert.equal(canViewMlcRegister({ role: "triage_nurse" }), true);
  assert.equal(canViewMlcRegister({ role: "hospital_admin" }), true);
  assert.equal(canViewMlcRegister({ role: "clinic_director" }), true);
  assert.equal(canViewMlcRegister({ role: "quality_officer" }), true);
  assert.equal(canViewMlcRegister({ role: "cashier" }), false);
});

test("sortMlcCases places police_intimation_overdue open cases at the top", () => {
  const cases = [
    {
      mlc_id: 1,
      mlc_number: "MLC-001",
      status: "Open",
      police_intimation_overdue: false,
      arrived_at: "2026-11-01T04:00:00Z",
    },
    {
      mlc_id: 2,
      mlc_number: "MLC-002",
      status: "Closed",
      police_intimation_overdue: true, // Closed case overdue flag doesn't precede open overdue
      arrived_at: "2026-11-01T06:00:00Z",
    },
    {
      mlc_id: 3,
      mlc_number: "MLC-003",
      status: "Open",
      police_intimation_overdue: true, // Open overdue -> MUST BE FIRST!
      arrived_at: "2026-11-01T02:00:00Z",
    },
    {
      mlc_id: 4,
      mlc_number: "MLC-004",
      status: "Open",
      police_intimation_overdue: false,
      arrived_at: "2026-11-01T05:00:00Z",
    },
  ];

  const sorted = sortMlcCases(cases);
  assert.equal(sorted[0].mlc_id, 3, "Open case with police_intimation_overdue must be first");
  assert.equal(sorted[1].mlc_id, 4, "Open non-overdue newer arrival (05:00) comes second");
  assert.equal(sorted[2].mlc_id, 1, "Open non-overdue older arrival (04:00) comes third");
  assert.equal(sorted[3].mlc_id, 2, "Closed case comes last");
});

test("validateOpenMlc and validateUpdateMlc enforce clinical and police station requirements", () => {
  const emptyOpen = validateOpenMlc({});
  assert.ok(emptyOpen.patient_id);
  assert.ok(emptyOpen.case_type_id);
  assert.ok(emptyOpen.brought_by);
  assert.ok(emptyOpen.alleged_history);

  const policeBroughtWithoutStation = validateOpenMlc({
    patient_id: 12,
    case_type_id: 1,
    brought_by: "Police",
    alleged_history: "Found unconscious with blunt trauma",
  });
  assert.ok(policeBroughtWithoutStation.police_station_id, "Police station required when brought by police");

  const validOpen = validateOpenMlc({
    patient_id: 12,
    case_type_id: 1,
    brought_by: "Rescue1122",
    alleged_history: "Road traffic collision on main highway",
  });
  assert.equal(Object.keys(validOpen).length, 0);

  // Update validations for MLR settlement
  const updateIssuedWithoutNumber = validateUpdateMlc({
    mlr_status: "IssuedHere",
  });
  assert.ok(updateIssuedWithoutNumber.mlr_number);
  assert.ok(updateIssuedWithoutNumber.mlr_issued_at);

  const updateReferredWithoutHospital = validateUpdateMlc({
    mlr_status: "Referred",
  });
  assert.ok(updateReferredWithoutHospital.referred_to_id);

  const updateNotRequiredWithoutNote = validateUpdateMlc({
    mlr_status: "NotRequired",
  });
  assert.ok(updateNotRequiredWithoutNote.mlr_note);
});

test("validatePoliceIntimation and validateEvidence enforce statutory standards", () => {
  const badIntimation = validatePoliceIntimation({});
  assert.ok(badIntimation.police_station_id);
  assert.ok(badIntimation.informed_how);

  const goodIntimation = validatePoliceIntimation({
    police_station_id: 4,
    informed_how: "Phone",
    informed_to: "Sub-Inspector Tariq Mahmood",
    police_reference: "Roznamcha # 42/B",
  });
  assert.equal(Object.keys(goodIntimation).length, 0);

  const badEvidence = validateEvidence({
    description: "ab",
    handed_to: "xy",
  });
  assert.ok(badEvidence.description);
  assert.ok(badEvidence.handed_to);

  const goodEvidence = validateEvidence({
    description: "Blood stained shirt sealed in tamper-evident bag",
    handed_to: "Constable Muhammad Asif (Belt # 8941)",
    seal_number: "SEAL-PK-98214",
    receipt_reference: "REC-2026-0041",
  });
  assert.equal(Object.keys(goodEvidence).length, 0);
});

test("validateCloseMlc blocks closing until police intimation and MLR status are settled", () => {
  const unreadyCase = {
    mlc_id: 10,
    police_informed_at: null,
    police_station_id: null,
    mlr_status: "Pending",
  };

  const closeAttempt = validateCloseMlc(unreadyCase, { note: "Case ready for closure" });
  assert.equal(closeAttempt.valid, false);
  assert.ok(closeAttempt.missing.includes("police_intimation"));
  assert.ok(closeAttempt.missing.includes("mlr_status"));
  assert.ok(closeAttempt.errors.general);

  const readyCase = {
    mlc_id: 10,
    police_informed_at: "2026-11-01T03:00:00Z",
    police_station_id: 2,
    mlr_status: "IssuedHere",
  };

  const goodClose = validateCloseMlc(readyCase, {
    note: "All evidence handed over and MLR issued by Dr. Haroon",
  });
  assert.equal(goodClose.valid, true);
  assert.equal(goodClose.missing.length, 0);
  assert.equal(Object.keys(goodClose.errors).length, 0);
});

test("explainMlcError maps domain codes to actionable clinical messages", () => {
  assert.match(explainMlcError({ code: "MLC_CLOSED" }), /closed and cannot be modified/);
  assert.match(explainMlcError({ code: "MLC_CONTACT_TYPE_INVALID" }), /police station/);
  assert.match(explainMlcError({ code: "MLC_NOT_READY_TO_CLOSE" }), /Inform the police and settle/);
  assert.match(explainMlcError({ code: "MLC_POLICE_ALREADY_INFORMED" }), /already been recorded/);
  assert.match(explainMlcError({ code: "PATIENT_MERGED_CANNOT_TRANSACT" }), /master patient record/);
  assert.match(explainMlcError({ code: "FORBIDDEN" }), /do not have authorization/);
});
