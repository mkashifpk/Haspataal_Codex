import test from "node:test";
import assert from "node:assert/strict";

import {
  getPreAnaesthesiaClinicScreenView,
  isSurgeryActive,
  canAssessPreAnaesthesia,
  hasAnaesthesiaPrivilege,
  validatePreAnaesthesiaDraft,
  validatePreAnaesthesiaSign,
  ASA_CLASSES,
  MALLAMPATI_CLASSES,
  explainPreAnaesthesiaError,
} from "../src/pre-anaesthesia-clinic-policy.ts";

test("pre_anaesthesia_clinic: getPreAnaesthesiaClinicScreenView evaluates establishment views and capability fallback", () => {
  assert.equal(getPreAnaesthesiaClinicScreenView(null), "full");

  // 1. Explicit server-declared screen view
  const estExplicit = {
    views: {
      screens: [{ screen_id: "pre_anaesthesia_clinic", view: "records" }],
    },
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estExplicit), "records");

  // 2. Capability state evaluation
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estRetiring), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estRetired), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estPreparing), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estAvailable), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estNoSurgery), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getPreAnaesthesiaClinicScreenView(estWithSurgery), "full");
});

test("pre_anaesthesia_clinic: isSurgeryActive correctly checks surgery capability", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive(undefined), false);
  assert.equal(isSurgeryActive({ active: ["opd"] }), false);
  assert.equal(isSurgeryActive({ active: ["surgery", "opd"] }), true);
});

test("pre_anaesthesia_clinic: canAssessPreAnaesthesia verifies user permissions", () => {
  assert.equal(canAssessPreAnaesthesia(null), false);
  assert.equal(canAssessPreAnaesthesia({ permissions: [] }), false);
  assert.equal(canAssessPreAnaesthesia({ permissions: ["ot.clinical.assess"] }), true);
  assert.equal(canAssessPreAnaesthesia({ permissions: ["ot.clinical.anaesthesia"] }), true);
  assert.equal(canAssessPreAnaesthesia({ permissions: ["ot.booking.manage"] }), true);
  assert.equal(canAssessPreAnaesthesia({ permissions: ["doctor.view"] }), true);
  assert.equal(canAssessPreAnaesthesia({ permissions: ["billing.read"] }), false);
});

test("pre_anaesthesia_clinic: hasAnaesthesiaPrivilege validates active PreAnaesthesiaAssessment / Anaesthesia privileges (Rule d4ca3b3bcc)", () => {
  const privileges = [
    {
      id: 1,
      employee_id: 101,
      privilege: "PreAnaesthesiaAssessment",
      revoked_at: null,
    },
    {
      id: 2,
      employee_id: 102,
      privilege: "Anaesthesia",
      revoked_at: null,
    },
    {
      id: 3,
      employee_id: 103,
      privilege: "PreAnaesthesiaAssessment",
      revoked_at: "2026-10-30T10:00:00Z", // revoked
    },
    {
      id: 4,
      employee_id: 104,
      privilege: "GeneralSurgery",
      revoked_at: null,
    },
  ];

  assert.equal(hasAnaesthesiaPrivilege(privileges, 101), true);
  assert.equal(hasAnaesthesiaPrivilege(privileges, 102), true);
  assert.equal(hasAnaesthesiaPrivilege(privileges, 103), false); // revoked
  assert.equal(hasAnaesthesiaPrivilege(privileges, 104), false); // wrong privilege
  assert.equal(hasAnaesthesiaPrivilege(privileges, 999), false); // not in list
  assert.equal(hasAnaesthesiaPrivilege(privileges, null), false);
});

test("pre_anaesthesia_clinic: validatePreAnaesthesiaDraft validates numeric bounds on vitals and airway", () => {
  const validDraft = {
    heart_rate: 72,
    bp_systolic: 120,
    bp_diastolic: 80,
    spo2: 98,
    airway_mallampati: 2,
    asa_class: 2,
  };
  const resultValid = validatePreAnaesthesiaDraft(validDraft);
  assert.equal(resultValid.valid, true);
  assert.equal(resultValid.errors.length, 0);

  // Out of bounds values
  const invalidDraft = {
    heart_rate: 300, // max 260
    bp_systolic: 350, // max 300
    bp_diastolic: 10, // min 20
    spo2: 40, // min 50
    airway_mallampati: 5, // max 4
    asa_class: 7, // max 6
  };
  const resultInvalid = validatePreAnaesthesiaDraft(invalidDraft);
  assert.equal(resultInvalid.valid, false);
  assert.equal(resultInvalid.errors.length, 6);
});

test("pre_anaesthesia_clinic: validatePreAnaesthesiaSign enforces mandatory decision, technique, ASA, and decision note on non-Fit (Rule a91aa7215a)", () => {
  // Missing required sign fields
  const emptySign = {};
  const resEmpty = validatePreAnaesthesiaSign(emptySign);
  assert.equal(resEmpty.valid, false);
  assert.ok(resEmpty.errors.some((e) => e.includes("decision")));
  assert.ok(resEmpty.errors.some((e) => e.includes("ASA")));
  assert.ok(resEmpty.errors.some((e) => e.includes("Planned anaesthetic technique")));

  // Valid standard Fit clearance
  const fitSign = {
    asa_class: 1,
    planned_technique: "General",
    decision: "Fit",
  };
  const resFit = validatePreAnaesthesiaSign(fitSign);
  assert.equal(resFit.valid, true);
  assert.equal(resFit.errors.length, 0);

  // FitWithConditions without decision note -> invalid
  const condNoNote = {
    asa_class: 3,
    planned_technique: "Spinal",
    decision: "FitWithConditions",
    decision_note: "   ",
  };
  const resCondNoNote = validatePreAnaesthesiaSign(condNoNote);
  assert.equal(resCondNoNote.valid, false);
  assert.ok(resCondNoNote.errors.some((e) => e.includes("requires a detailed clinical explanation")));

  // FitWithConditions with decision note -> valid
  const condWithNote = {
    asa_class: 3,
    planned_technique: "Spinal",
    decision: "FitWithConditions",
    decision_note: "Needs pre-op blood cross-match and cardiologist clearance for stable angina.",
  };
  const resCondWithNote = validatePreAnaesthesiaSign(condWithNote);
  assert.equal(resCondWithNote.valid, true);

  // NotFit without note -> invalid
  const notFitNoNote = {
    asa_class: 4,
    planned_technique: "General",
    decision: "NotFit",
  };
  assert.equal(validatePreAnaesthesiaSign(notFitNoNote).valid, false);

  // Deferred with note -> valid
  const deferredWithNote = {
    asa_class: 2,
    planned_technique: "Epidural",
    decision: "Deferred",
    decision_note: "Postponed 7 days due to acute upper respiratory tract infection.",
  };
  assert.equal(validatePreAnaesthesiaSign(deferredWithNote).valid, true);
});

test("pre_anaesthesia_clinic: ASA and Mallampati classification catalogs provide bilingual guidance", () => {
  // ASA classes I through VI
  for (let i = 1; i <= 6; i++) {
    const asa = ASA_CLASSES[i];
    assert.ok(asa, `ASA ${i} must exist`);
    assert.ok(asa.title.includes(`ASA`));
    assert.ok(asa.desc.length > 5);
    assert.ok(asa.ur.length > 5);
  }

  // Mallampati classes I through IV
  for (let m = 1; m <= 4; m++) {
    const mal = MALLAMPATI_CLASSES[m];
    assert.ok(mal, `Mallampati ${m} must exist`);
    assert.ok(mal.title.includes(`Class`));
    assert.ok(mal.desc.length > 5);
    assert.ok(mal.ur.length > 5);
  }
});

test("pre_anaesthesia_clinic: explainPreAnaesthesiaError returns accurate bilingual messages", () => {
  const finalErr = explainPreAnaesthesiaError("OT_RECORD_FINAL");
  assert.ok(finalErr.en.includes("signed and final"));
  assert.ok(finalErr.ur.includes("حتمی"));

  const privErr = explainPreAnaesthesiaError("OT_PRIVILEGE_REQUIRED", { privilege: "PreAnaesthesiaAssessment" });
  assert.ok(privErr.en.includes("PreAnaesthesiaAssessment"));
  assert.ok(privErr.ur.includes("PreAnaesthesiaAssessment"));

  const capErr = explainPreAnaesthesiaError("CAPABILITY_INACTIVE");
  assert.ok(capErr.en.includes("inactive"));
  assert.ok(capErr.ur.includes("غیر فعال"));

  const fallback = explainPreAnaesthesiaError("UNKNOWN_CODE");
  assert.ok(fallback.en.includes("UNKNOWN_CODE"));
  assert.ok(fallback.ur.includes("UNKNOWN_CODE"));
});
