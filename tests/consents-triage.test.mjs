import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateConsentsTriageView,
  canAccessConsentsTriage,
  filterConsentWorklist,
  isConsentActionPermitted,
  validateConsentDraftPreparation,
  validateConsentDecision,
  explainConsentsTriageError,
} from "../src/consents-triage-policy.ts";

test("evaluateConsentsTriageView handles all service view modes (rule:e0a2eac3db)", () => {
  const mkEst = (view) => ({
    establishment_id: 1,
    name: "Mayo Hospital Lahore",
    phc_license: "PHC-12345",
    address: "Lahore",
    views: {
      screens: [{ screen_id: "consents_triage", view }],
      workspaces: [],
    },
    services: [],
  });

  const full = evaluateConsentsTriageView(mkEst("full"));
  assert.equal(full.canOpen, true);
  assert.equal(full.canCreateNew, true);
  assert.equal(full.canManageOpen, true);
  assert.equal(full.canViewRecords, true);

  const openWork = evaluateConsentsTriageView(mkEst("open_work"));
  assert.equal(openWork.canOpen, true);
  assert.equal(openWork.canCreateNew, false);
  assert.equal(openWork.canManageOpen, true);
  assert.match(openWork.bannerMessageEn, /No new emergency arrivals from now on/);
  assert.match(openWork.bannerMessageUr, /اب نئی ایمرجنسی آمد نہیں/);

  const records = evaluateConsentsTriageView(mkEst("records"));
  assert.equal(records.canOpen, true);
  assert.equal(records.canCreateNew, false);
  assert.equal(records.canManageOpen, false);
  assert.equal(records.canViewRecords, true);

  const hidden = evaluateConsentsTriageView(mkEst("hidden"));
  assert.equal(hidden.canOpen, false);
});

test("canAccessConsentsTriage checks required permissions", () => {
  const triageNurse = canAccessConsentsTriage(["consent.view", "consent.record", "patient.document.upload"]);
  assert.equal(triageNurse.canView, true);
  assert.equal(triageNurse.canRecord, true);
  assert.equal(triageNurse.canUploadDocument, true);

  const viewOnly = canAccessConsentsTriage(["consent.view"]);
  assert.equal(viewOnly.canView, true);
  assert.equal(viewOnly.canRecord, false);
  assert.equal(viewOnly.canUploadDocument, false);
});

test("filterConsentWorklist detects overdue items in red (rule:e9d9f576df)", () => {
  const items = [
    {
      kind: "GeneralConsent",
      patient_id: 1,
      mrn: "MRN-001",
      patient_name: "Ali Khan",
      admission_id: 10,
      admission_number: "ADM-001",
      booking_id: null,
      booking_number: null,
      procedure_name: null,
      due_at: "2026-11-01T10:00:00Z",
      overdue: true,
      consent_id: null,
      consent_number: null,
    },
    {
      kind: "Scan",
      patient_id: 2,
      mrn: "MRN-002",
      patient_name: "Sara Bibi",
      admission_id: 11,
      admission_number: "ADM-002",
      booking_id: null,
      booking_number: null,
      procedure_name: null,
      due_at: "2026-11-01T15:00:00Z",
      overdue: false,
      consent_id: 101,
      consent_number: "CN-00101",
    },
  ];

  const res = filterConsentWorklist(items);
  assert.equal(res.items.length, 2);
  assert.equal(res.overdueCount, 1);
});

test("isConsentActionPermitted enforces lifecycle transitions (rule:8b7301ca0f)", () => {
  const draftConsent = { status: "Draft" };
  assert.equal(isConsentActionPermitted(draftConsent, "edit"), true);
  assert.equal(isConsentActionPermitted(draftConsent, "sign"), true);
  assert.equal(isConsentActionPermitted(draftConsent, "refuse"), true);
  assert.equal(isConsentActionPermitted(draftConsent, "cancel"), true);
  assert.equal(isConsentActionPermitted(draftConsent, "withdraw"), false);

  const givenConsent = { status: "Given" };
  assert.equal(isConsentActionPermitted(givenConsent, "withdraw"), true);
  assert.equal(isConsentActionPermitted(givenConsent, "scan"), true);
  assert.equal(isConsentActionPermitted(givenConsent, "edit"), false);
  assert.equal(isConsentActionPermitted(givenConsent, "sign"), false);
});

test("validateConsentDraftPreparation validates language and bounds (rule:d84307d9b2)", () => {
  const form = {
    form_id: 1,
    title: "General Consent at Admission",
    category: "General",
    texts: [
      { language: "Urdu", heading: "عمومی رضامندی", body: "...", direction: "rtl", updated_at: "", row_version: 1 },
      { language: "English", heading: "General Consent", body: "...", direction: "ltr", updated_at: "", row_version: 1 },
    ],
  };

  const valid = validateConsentDraftPreparation(form, "Urdu", "Pneumonia", 5, 25000);
  assert.equal(valid.valid, true);

  const unsupportedLang = validateConsentDraftPreparation(form, "Pashto");
  assert.equal(unsupportedLang.valid, false);
  assert.match(unsupportedLang.error, /does not have text for language Pashto/);

  const invalidDays = validateConsentDraftPreparation(form, "English", "Need", 400);
  assert.equal(invalidDays.valid, false);
  assert.match(invalidDays.error, /0 and 365 days/);
});

test("validateConsentDecision enforces who_decides hierarchy and emergency note (rule:b7bacc1ffb, rule:cb2f327ee7)", () => {
  const minorConsent = {
    status: "Draft",
    requires_witness: false,
    who_decides: {
      adult_age: 18,
      patient_is_minor: true,
      patient_may_sign: false,
      decision_makers: [
        { relationship: "Parent", description: "Mother or Father", priority: 1 },
        { relationship: "Guardian", description: "Legal Guardian", priority: 2 },
      ],
      emergency_second_doctor: true,
    },
  };

  // Minor patient signing themselves should be rejected
  const selfSign = validateConsentDecision(minorConsent, "Signed", {
    signer: "Patient",
    questionsAnswers: "None",
    understandingConfirmed: true,
  });
  assert.equal(selfSign.valid, false);
  assert.match(selfSign.error, /Patient cannot sign under hospital policy/);

  // Decision maker Parent should be accepted
  const parentSign = validateConsentDecision(minorConsent, "Signed", {
    signer: "DecisionMaker",
    signerName: "Fatima Khan",
    signerRelationship: "Parent",
    incapacityReason: "Minor",
    questionsAnswers: "Explained risks",
    understandingConfirmed: true,
  });
  assert.equal(parentSign.valid, true);

  // Emergency note without second doctor when required should be rejected
  const noteNoDoctor = validateConsentDecision(minorConsent, "EmergencyNote", {
    emergencyNote: "Patient in shock, unconscious",
    incapacityReason: "Unconscious",
  });
  assert.equal(noteNoDoctor.valid, false);
  assert.match(noteNoDoctor.error, /second registered PMDC doctor is required/);

  // Emergency note with second doctor
  const noteWithDoctor = validateConsentDecision(minorConsent, "EmergencyNote", {
    emergencyNote: "Patient in hypovolaemic shock, unconscious",
    incapacityReason: "Unconscious",
    secondDoctorId: 104,
  });
  assert.equal(noteWithDoctor.valid, true);
});

test("explainConsentsTriageError provides clear bilingual explanations", () => {
  const incomplete = explainConsentsTriageError("CONSENT_INCOMPLETE");
  assert.match(incomplete.en, /required explanation fields are still incomplete/);
  assert.match(incomplete.ur, /مطلوبہ وضاحتی خانے ابھی نامکمل ہیں/);

  const signer = explainConsentsTriageError("CONSENT_SIGNER_INVALID");
  assert.match(signer.en, /not permitted under hospital consent policy/);
  assert.match(signer.ur, /مجاز نہیں ہے/);
});
