import test from "node:test";
import assert from "node:assert/strict";

import {
  getAnaesthesiaRecordScreenView,
  canViewAnaesthesiaRecord,
  canRecordAnaesthesia,
  canCorrectAnaesthesia,
  canReportIncident,
  validatePreInduction,
  validateVitalsEntry,
  validateEventEntry,
  validateRecordSigning,
  validateCorrectionInput,
  validateIncidentInput,
  explainAnaesthesiaRecordError,
  ANAESTHESIA_TECHNIQUES,
  AIRWAY_DEVICES,
  CARDIAC_RHYTHMS,
  EVENT_KINDS,
} from "../src/anaesthesia-record-policy.ts";

test("anaesthesia_record: getAnaesthesiaRecordScreenView evaluates runtime service capability views (Rule 2285735141)", () => {
  // 1. Defaults to full when establishment is null
  assert.equal(getAnaesthesiaRecordScreenView(null), "full");

  // 2. Uses server-declared screens view
  const estWithScreen = {
    views: {
      screens: [
        { screen_id: "anaesthesia_record", view: "open_work" },
      ],
    },
    capabilities: [{ capability: "surgery", state: "active" }],
  };
  assert.equal(getAnaesthesiaRecordScreenView(estWithScreen), "open_work");

  // 3. Capability state fallbacks
  const estRetiring = {
    views: { screens: [] },
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getAnaesthesiaRecordScreenView(estRetiring), "records");

  const estInactive = {
    views: { screens: [] },
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getAnaesthesiaRecordScreenView(estInactive), "hidden");
});

test("anaesthesia_record: role and permission gates for anaesthetist and OT clinical staff", () => {
  const anaesthetistUser = {
    roles: ["anaesthetist"],
    permissions: ["ot.clinical.view", "ot.anaesthesia.record"],
  };
  assert.equal(canViewAnaesthesiaRecord(anaesthetistUser), true);
  assert.equal(canRecordAnaesthesia(anaesthetistUser), true);
  assert.equal(canCorrectAnaesthesia(anaesthetistUser), true);
  assert.equal(canReportIncident(anaesthetistUser), true);

  const otNurseUser = {
    roles: ["ot_nurse"],
    permissions: ["ot.clinical.view", "ot.anaesthesia.record"],
  };
  assert.equal(canViewAnaesthesiaRecord(otNurseUser), true);
  assert.equal(canRecordAnaesthesia(otNurseUser), true);

  const surgeonUser = {
    roles: ["surgeon"],
    permissions: ["ot.clinical.view", "ot.operative_note.write"],
  };
  assert.equal(canViewAnaesthesiaRecord(surgeonUser), true);
  assert.equal(canRecordAnaesthesia(surgeonUser), false); // Cannot chart anaesthesia
  assert.equal(canCorrectAnaesthesia(surgeonUser), true); // Can add corrections

  const billingUser = {
    roles: ["billing_admin"],
    permissions: ["billing.manage"],
  };
  assert.equal(canViewAnaesthesiaRecord(billingUser), false);
  assert.equal(canRecordAnaesthesia(billingUser), false);
});

test("anaesthesia_record: validatePreInduction checks baseline vitals and mandatory plan change rationale (Rule eda7089766)", () => {
  // Valid baseline
  const validBaseline = {
    pre_induction_heart_rate: 76,
    pre_induction_bp_systolic: 120,
    pre_induction_bp_diastolic: 80,
    pre_induction_spo2: 98,
    plan_changed: false,
  };
  const resValid = validatePreInduction(validBaseline);
  assert.equal(resValid.valid, true);

  // Invalid vitals bounds
  const invalidVitals = {
    pre_induction_heart_rate: 15, // < 30
    pre_induction_bp_systolic: 80,
    pre_induction_bp_diastolic: 95, // diastolic > systolic
    pre_induction_spo2: 45, // < 50
    plan_changed: true,
    plan_change: "", // Missing mandatory rationale
  };
  const resInvalid = validatePreInduction(invalidVitals);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.pre_induction_heart_rate);
  assert.ok(resInvalid.errors.pre_induction_bp_systolic);
  assert.ok(resInvalid.errors.pre_induction_spo2);
  assert.ok(resInvalid.errors.plan_change);
});

test("anaesthesia_record: validateVitalsEntry validates physiological parameters and airway patency (Rule c7bd8c2650, MSDS 36)", () => {
  const validReading = {
    heart_rate: 80,
    rhythm: "Sinus",
    bp_systolic: 125,
    bp_diastolic: 82,
    respiratory_rate: 14,
    spo2: 99,
    etco2: 36,
    temp_c: 36.8,
    airway_patent: true,
  };
  const resValid = validateVitalsEntry(validReading);
  assert.equal(resValid.valid, true);

  const missingRequired = {
    heart_rate: null,
    bp_systolic: null,
    bp_diastolic: null,
    respiratory_rate: null,
    spo2: null,
  };
  const resMissing = validateVitalsEntry(missingRequired);
  assert.equal(resMissing.valid, false);
  assert.ok(resMissing.errors.heart_rate);
  assert.ok(resMissing.errors.bp_systolic);
  assert.ok(resMissing.errors.bp_diastolic);
  assert.ok(resMissing.errors.respiratory_rate);
  assert.ok(resMissing.errors.spo2);
});

test("anaesthesia_record: validateEventEntry validates drug, fluid, blood, and event charting (Rule c7bd8c2650)", () => {
  const validDrug = {
    kind: "Drug",
    description: "Propofol",
    dose: "150 mg IV",
  };
  const resDrug = validateEventEntry(validDrug);
  assert.equal(resDrug.valid, true);

  const invalidDrugMissingDose = {
    kind: "Drug",
    description: "Fentanyl",
    dose: "",
  };
  const resNoDose = validateEventEntry(invalidDrugMissingDose);
  assert.equal(resNoDose.valid, false);
  assert.ok(resNoDose.errors.dose);

  const validFluid = {
    kind: "Fluid",
    description: "Ringer Lactate 500ml",
  };
  assert.equal(validateEventEntry(validFluid).valid, true);
});

test("anaesthesia_record: validateRecordSigning verifies prerequisites for final signing (Rule 2fc0c843dc)", () => {
  const completeRecord = {
    record_id: 1,
    booking_id: 1,
    induction_at: "2026-11-01T10:00:00Z",
    incision_at: "2026-11-01T10:20:00Z",
    anaesthesia_end_at: "2026-11-01T12:00:00Z",
    technique: "General",
    airway_device: "EndotrachealTube",
    handover_note: "Patient extubated and stable, transferred to PACU.",
    vitals: [{ heart_rate: 75 }],
  };
  const resComplete = validateRecordSigning(completeRecord);
  assert.equal(resComplete.canSign, true);
  assert.equal(resComplete.missing.length, 0);

  const incompleteRecord = {
    record_id: 2,
    booking_id: 2,
    induction_at: null,
    incision_at: null,
    anaesthesia_end_at: null,
    technique: null,
    airway_device: null,
    handover_note: null,
    vitals: [],
  };
  const resIncomplete = validateRecordSigning(incompleteRecord);
  assert.equal(resIncomplete.canSign, false);
  assert.ok(resIncomplete.missing.length >= 5);
});

test("anaesthesia_record: validateCorrectionInput and validateIncidentInput enforce statutory audits (Rule 9e9cb593cb, Rule fe0c435dc9)", () => {
  // Correction
  const validCorrection = {
    record: "AnaesthesiaRecord",
    correction_text: "Corrected extubation time to 12:15 PM.",
    correction_reason: "Transcription delay during emergency emergence.",
  };
  assert.equal(validateCorrectionInput(validCorrection).valid, true);

  const invalidCorrection = {
    record: "PreOpNote", // Wrong record
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
    booking_id: 10,
    type_code: "AIRWAY_DIFFICULTY",
    description: "Brief transient laryngospasm during extubation, resolved with positive pressure.",
  };
  assert.equal(validateIncidentInput(validIncident).valid, true);
});

test("anaesthesia_record: explainAnaesthesiaRecordError provides clear English and Urdu guidance", () => {
  const err1 = explainAnaesthesiaRecordError("OT_CHECKLIST_INCOMPLETE");
  assert.ok(err1.en.includes("Sign In"));
  assert.ok(err1.ur.includes("سائن ان"));

  const err2 = explainAnaesthesiaRecordError("OT_PRIVILEGE_REQUIRED");
  assert.ok(err2.en.includes("privilege"));
  assert.ok(err2.ur.includes("اجازت نامہ"));

  const err3 = explainAnaesthesiaRecordError("OT_RECORD_FINAL");
  assert.ok(err3.en.includes("correction"));
  assert.ok(err3.ur.includes("تصحیحی ضمیمہ"));
});
