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

test("evaluateMlcCasesView evaluates doctor workspace screenId correctly", () => {
  const full = evaluateMlcCasesView(
    { views: { screens: [{ screen_id: "mlc_cases_doctor", view: "full" }] } },
    "mlc_cases_doctor"
  );
  assert.equal(full.view, "full");
  assert.equal(full.canCreateNew, true);
  assert.equal(full.canManageOpen, true);
  assert.equal(full.canViewRecords, true);
  assert.equal(full.banner, null);

  const retiring = evaluateMlcCasesView(
    { views: { screens: [{ screen_id: "mlc_cases_doctor", view: "open_work" }] } },
    "mlc_cases_doctor"
  );
  assert.equal(retiring.view, "open_work");
  assert.equal(retiring.canCreateNew, false);
  assert.equal(retiring.canManageOpen, true);
  assert.match(retiring.banner || "", /No new medico-legal cases from now on/);

  const records = evaluateMlcCasesView(
    { views: { screens: [{ screen_id: "mlc_cases_doctor", view: "records" }] } },
    "mlc_cases_doctor"
  );
  assert.equal(records.view, "records");
  assert.equal(records.canCreateNew, false);
  assert.equal(records.canManageOpen, false);
  assert.equal(records.canViewRecords, true);

  const hidden = evaluateMlcCasesView(
    { views: { screens: [{ screen_id: "mlc_cases_doctor", view: "hidden" }] } },
    "mlc_cases_doctor"
  );
  assert.equal(hidden.view, "hidden");
  assert.equal(hidden.canOpen, false);
});

test("doctor workspace clinical roles are fully authorized for mlc.case.manage", () => {
  // Doctor workspace clinical roles
  assert.equal(canManageMlc({ role: "doctor" }), true);
  assert.equal(canManageMlc({ role: "clinical_specialist" }), true);
  assert.equal(canManageMlc({ role: "surgeon" }), true);
  assert.equal(canManageMlc({ role: "anaesthetist" }), true);

  // Administrative / read-only viewing roles
  assert.equal(canViewMlcRegister({ role: "doctor" }), true);
  assert.equal(canViewMlcRegister({ role: "clinical_specialist" }), true);
  assert.equal(canViewMlcRegister({ role: "surgeon" }), true);
  assert.equal(canViewMlcRegister({ role: "anaesthetist" }), true);
  assert.equal(canViewMlcRegister({ role: "clinic_director" }), true);
  assert.equal(canViewMlcRegister({ role: "hospital_admin" }), true);
  assert.equal(canViewMlcRegister({ role: "quality_officer" }), true);

  // Unauthorized roles
  assert.equal(canManageMlc({ role: "receptionist" }), false);
  assert.equal(canManageMlc({ role: "pharmacist" }), false);
  assert.equal(canManageMlc({ role: "cashier" }), false);
});

test("doctor examination findings update validation (PATCH /mlc/cases/{id})", () => {
  // Valid update with alleged history and examination findings
  const validErrors = validateUpdateMlc({
    alleged_history: "Patient states sustained multiple lacerations after being struck by motorcycle.",
    history_given_by: "Patient self",
    examination_findings: "Multiple deep abrasions right forearm, 3cm scalp laceration right parietal region.",
  });
  assert.equal(Object.keys(validErrors).length, 0);

  // Short/empty alleged history is rejected
  const emptyHistory = validateUpdateMlc({
    alleged_history: "   ",
  });
  assert.match(emptyHistory.alleged_history || "", /Alleged history must be at least 3 characters/);
});

test("statutory chain of custody evidence validation for recovered items", () => {
  const validErrors = validateEvidence({
    description: "Fired bullet projectile recovered from superficial abdominal wall during debridement",
    seal_number: "SEAL-PK-98214",
    handed_to: "ASI Muhammad Bashir (Belt-781)",
    receipt_reference: "RZN-8812-PS-CIVIL-LINES",
  });
  assert.equal(Object.keys(validErrors).length, 0);

  const missingDesc = validateEvidence({
    description: "",
    handed_to: "Constable Ali",
  });
  assert.match(missingDesc.description || "", /Evidence description must be at least 3 characters/);
});

test("statutory closure validation enforces police intimation and settled MLR", () => {
  // Uninformed police cannot close
  const unNotified = validateCloseMlc(
    {
      police_informed_at: null,
      police_station_id: null,
      mlr_status: "IssuedHere",
    },
    { note: "Patient treated and discharged in stable condition." }
  );
  assert.equal(unNotified.valid, false);
  assert.ok(unNotified.missing.includes("police_intimation"));
  assert.match(unNotified.errors.general || "", /Police intimation and Medico-Legal Report/);

  // Pending MLR cannot close
  const pendingMlr = validateCloseMlc(
    {
      police_informed_at: "2026-11-01T05:30:00Z",
      mlr_status: "Pending",
    },
    { note: "Case complete." }
  );
  assert.equal(pendingMlr.valid, false);
  assert.ok(pendingMlr.missing.includes("mlr_status"));

  // Valid closure when police informed and MLR settled (IssuedHere, Referred, or NotRequired)
  const validClose = validateCloseMlc(
    {
      police_informed_at: "2026-11-01T05:30:00Z",
      mlr_status: "IssuedHere",
    },
    { note: "MLR # 442/2026 issued and delivered to ASI Bashir. Wounds sutured. Discharged." }
  );
  assert.equal(validClose.valid, true);
  assert.equal(Object.keys(validClose.errors).length, 0);
  assert.equal(validClose.missing.length, 0);
});

test("explainMlcError maps doctor workspace domain error codes correctly", () => {
  assert.match(
    explainMlcError({ code: "MLC_CLOSED" }),
    /medico-legal case is closed and cannot be modified/i
  );
  assert.match(
    explainMlcError({ code: "MLC_CONTACT_TYPE_INVALID" }),
    /select a registered police station/i
  );
  assert.match(
    explainMlcError({ code: "MLC_POLICE_ALREADY_INFORMED" }),
    /Police intimation has already been recorded/i
  );
  assert.match(
    explainMlcError({ code: "MLC_NOT_READY_TO_CLOSE" }),
    /Inform the police and settle the Medico-Legal Report/i
  );
  assert.match(
    explainMlcError({ code: "PATIENT_MERGED_CANNOT_TRANSACT" }),
    /patient record was merged/i
  );
});
