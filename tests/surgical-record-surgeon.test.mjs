import test from "node:test";
import assert from "node:assert/strict";

import {
  getSurgicalRecordSurgeonScreenView,
  canViewSurgicalRecord,
  canRecordPreOpNote,
  canRecordOperativeNote,
  canManageConsents,
  canCorrectSurgicalRecord,
  canReportIncident,
  validatePreOpNote,
  validateOperativeNoteDraft,
  validateOperativeNoteSigning,
  validateCorrectionInput,
  validateIncidentInput,
  explainSurgicalRecordSurgeonError,
  LATERALITY_OPTIONS,
  WOUND_CLASSES,
  CONDITIONS_AT_END,
  ANAESTHESIA_TYPES,
} from "../src/surgical-record-surgeon-policy.ts";

test("surgical_record_surgeon: getSurgicalRecordSurgeonScreenView evaluates runtime service capability views (Rule 7bb3ca4e1d)", () => {
  // 1. Defaults to full when establishment is null
  assert.equal(getSurgicalRecordSurgeonScreenView(null), "full");

  // 2. Uses server-declared screens view
  const estWithScreen = {
    views: {
      screens: [{ screen_id: "surgical_record_surgeon", view: "open_work" }],
    },
    capabilities: [{ capability: "surgery", state: "Active" }],
  };
  assert.equal(getSurgicalRecordSurgeonScreenView(estWithScreen), "open_work");

  // 3. Capability state fallbacks
  const estRetiring = {
    views: { screens: [] },
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getSurgicalRecordSurgeonScreenView(estRetiring), "records");

  const estInactive = {
    views: { screens: [] },
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getSurgicalRecordSurgeonScreenView(estInactive), "hidden");
});

test("surgical_record_surgeon: role and permission gates for surgeon and clinical doctors", () => {
  const surgeonUser = {
    roles: ["surgeon"],
    permissions: ["ot.clinical.view", "ot.pre_op.record", "ot.operative_note.write", "consent.record"],
  };
  assert.equal(canViewSurgicalRecord(surgeonUser), true);
  assert.equal(canRecordPreOpNote(surgeonUser), true);
  assert.equal(canRecordOperativeNote(surgeonUser), true);
  assert.equal(canManageConsents(surgeonUser), true);
  assert.equal(canCorrectSurgicalRecord(surgeonUser), true);
  assert.equal(canReportIncident(surgeonUser), true);

  const otNurseUser = {
    roles: ["ot_nurse"],
    permissions: ["ot.clinical.view", "ot.anaesthesia.record"],
  };
  assert.equal(canViewSurgicalRecord(otNurseUser), true);
  assert.equal(canRecordPreOpNote(otNurseUser), false); // Cannot author pre-op note
  assert.equal(canRecordOperativeNote(otNurseUser), false); // Cannot author operative note

  const billingUser = {
    roles: ["billing_admin"],
    permissions: ["billing.manage"],
  };
  assert.equal(canViewSurgicalRecord(billingUser), false);
  assert.equal(canRecordOperativeNote(billingUser), false);
});

test("surgical_record_surgeon: validatePreOpNote validates history, diagnosis, plan, and laterality (Rule 8bbdbdc51d)", () => {
  const validNote = {
    history_examination: "Patient presents with acute appendicitis, rebound tenderness in RIF.",
    provisional_diagnosis: "Acute suppurative appendicitis",
    operation_plan: "Laparoscopic appendectomy under GA",
    laterality: "Right",
  };
  const resValid = validatePreOpNote(validNote);
  assert.equal(resValid.valid, true);

  const invalidNote = {
    history_examination: "",
    provisional_diagnosis: "a",
    operation_plan: "",
    laterality: "Unknown",
  };
  const resInvalid = validatePreOpNote(invalidNote);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.history_examination);
  assert.ok(resInvalid.errors.provisional_diagnosis);
  assert.ok(resInvalid.errors.operation_plan);
  assert.ok(resInvalid.errors.laterality);
});

test("surgical_record_surgeon: validateOperativeNoteDraft validates core operative fields (Rule 2b25651d1e)", () => {
  const validDraft = {
    procedure_performed: "Laparoscopic appendectomy",
    post_op_diagnosis: "Gangrenous acute appendicitis",
    findings: "Inflamed gangrenous appendix with mild pelvic exudate, no perforation.",
    procedure_details: "3-port laparoscopic technique, mesoappendix cauterized, appendix excised.",
    wound_class: "CleanContaminated",
    condition_at_end: "Stable",
  };
  const resValid = validateOperativeNoteDraft(validDraft);
  assert.equal(resValid.valid, true);

  const invalidDraft = {
    procedure_performed: "",
    post_op_diagnosis: "",
    findings: "",
    procedure_details: "",
    wound_class: "InvalidClass",
    condition_at_end: "InvalidCondition",
  };
  const resInvalid = validateOperativeNoteDraft(invalidDraft);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.procedure_performed);
  assert.ok(resInvalid.errors.post_op_diagnosis);
  assert.ok(resInvalid.errors.findings);
  assert.ok(resInvalid.errors.procedure_details);
  assert.ok(resInvalid.errors.wound_class);
  assert.ok(resInvalid.errors.condition_at_end);
});

test("surgical_record_surgeon: validateOperativeNoteSigning verifies complete post-op orders (Rule 2b25651d1e)", () => {
  const completeNote = {
    note_id: 1,
    booking_id: 1,
    procedure_performed: "Open cholecystectomy",
    post_op_diagnosis: "Chronic cholecystitis with cholelithiasis",
    findings: "Fibrosed gallbladder with multiple calculi.",
    procedure_details: "Right subcostal incision, cystic duct & artery clipped, retrograde dissection.",
    wound_class: "CleanContaminated",
    condition_at_end: "Stable",
    monitoring: "Vital signs q15min for 2 hours, then q1h.",
    monitoring_interval_minutes: 60,
    medications: "IV Paracetamol 1g q8h, IV Tramadol 50mg SOS.",
    wound_care: "Keep dressing clean and dry, inspect for soakage.",
    nutrition: "NPO until bowel sounds return, then sips of water.",
    fluid_balance: "IV Normal Saline 1000ml / 24 hours.",
  };
  const resComplete = validateOperativeNoteSigning(completeNote);
  assert.equal(resComplete.canSign, true);
  assert.equal(resComplete.missing.length, 0);

  const incompleteNote = {
    note_id: 2,
    booking_id: 2,
    procedure_performed: "Hernioplasty",
    post_op_diagnosis: "Inguinal hernia",
    findings: "Direct hernia sac.",
    procedure_details: "Lichtenstein mesh repair.",
    wound_class: "Clean",
    condition_at_end: "Stable",
    monitoring: "", // Missing post-op orders
    monitoring_interval_minutes: null,
    medications: "",
    wound_care: "",
    nutrition: "",
    fluid_balance: "",
  };
  const resIncomplete = validateOperativeNoteSigning(incompleteNote);
  assert.equal(resIncomplete.canSign, false);
  assert.ok(resIncomplete.missing.length >= 5);
});

test("surgical_record_surgeon: validateCorrectionInput and validateIncidentInput enforce statutory audits (Rule 9e9cb593cb, Rule fe0c435dc9)", () => {
  // Correction
  const validCorrection = {
    record: "OperativeNote",
    correction_text: "Clarified that subhepatic drain was placed via separate stab incision.",
    correction_reason: "Omission during initial post-op dictation.",
  };
  assert.equal(validateCorrectionInput(validCorrection).valid, true);

  const invalidCorrection = {
    record: "",
    correction_text: "a",
    correction_reason: "",
  };
  const resCorr = validateCorrectionInput(invalidCorrection);
  assert.equal(resCorr.valid, false);
  assert.ok(resCorr.errors.record);
  assert.ok(resCorr.errors.correction_text);
  assert.ok(resCorr.errors.correction_reason);

  // Incident
  const validIncident = {
    booking_id: 12,
    type_code: "SURGICAL_UNEXPECTED_FINDING",
    description: "Unexpected intra-abdominal adhesion requiring extended adhesiolysis.",
  };
  assert.equal(validateIncidentInput(validIncident).valid, true);
});

test("surgical_record_surgeon: explainSurgicalRecordSurgeonError provides clear English and Urdu guidance", () => {
  const err1 = explainSurgicalRecordSurgeonError("OT_OPERATIVE_NOTE_REQUIRED");
  assert.ok(err1.en.includes("recovery"));
  assert.ok(err1.ur.includes("بحالی وارڈ"));

  const err2 = explainSurgicalRecordSurgeonError("OT_PRE_OP_NOTE_REQUIRED");
  assert.ok(err2.en.includes("Sign In"));
  assert.ok(err2.ur.includes("سائن ان"));

  const err3 = explainSurgicalRecordSurgeonError("OT_PRIVILEGE_REQUIRED");
  assert.ok(err3.en.includes("privilege"));
  assert.ok(err3.ur.includes("اجازت نامہ"));
});
