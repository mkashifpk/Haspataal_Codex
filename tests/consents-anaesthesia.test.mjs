import test from "node:test";
import assert from "node:assert/strict";

import {
  getConsentsAnaesthesiaScreenView,
  isSurgeryActive,
  canManageConsents,
  isAuthorizedConsentTaker,
  validateConsentDraft,
  validateConsentSign,
  validateConsentRefuse,
  explainConsentError,
} from "../src/consents-anaesthesia-policy.ts";

test("consents_anaesthesia: getConsentsAnaesthesiaScreenView evaluates views and capability fallbacks (Rule a52becc623)", () => {
  assert.equal(getConsentsAnaesthesiaScreenView(null), "full");

  // 1. Explicit server view
  const estExplicit = {
    views: {
      screens: [{ screen_id: "consents_anaesthesia", view: "records" }],
    },
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estExplicit), "records");

  // 2. Capability state evaluation
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estRetiring), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estRetired), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estPreparing), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estAvailable), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estNoSurgery), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getConsentsAnaesthesiaScreenView(estWithSurgery), "full");
});

test("consents_anaesthesia: isSurgeryActive checks surgery active status", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive(undefined), false);
  assert.equal(isSurgeryActive({ active: ["opd"] }), false);
  assert.equal(isSurgeryActive({ active: ["surgery", "opd"] }), true);
});

test("consents_anaesthesia: canManageConsents verifies user permissions", () => {
  assert.equal(canManageConsents(null), false);
  assert.equal(canManageConsents({ permissions: [] }), false);
  assert.equal(canManageConsents({ permissions: ["consent.record"] }), true);
  assert.equal(canManageConsents({ permissions: ["consent.view"] }), true);
  assert.equal(canManageConsents({ permissions: ["ot.clinical.anaesthesia"] }), true);
  assert.equal(canManageConsents({ permissions: ["doctor.view"] }), true);
  assert.equal(canManageConsents({ permissions: ["inventory.manage"] }), false);
});

test("consents_anaesthesia: isAuthorizedConsentTaker verifies anaesthesia team credentials (Rule f811c03843)", () => {
  assert.equal(isAuthorizedConsentTaker(null), false);
  assert.equal(isAuthorizedConsentTaker({ roles: ["anaesthetist"] }), true);
  assert.equal(isAuthorizedConsentTaker({ roles: ["doctor"] }), true);
  assert.equal(isAuthorizedConsentTaker({ roles: ["clinical_specialist"] }), true);
  assert.equal(isAuthorizedConsentTaker({ permissions: ["ot.clinical.anaesthesia"] }), true);
  assert.equal(isAuthorizedConsentTaker({ roles: ["cashier"] }), false);
  assert.equal(isAuthorizedConsentTaker({ roles: ["ward_nurse"], permissions: ["ward.read"] }), false);
});

test("consents_anaesthesia: validateConsentDraft enforces required form and procedure (Rule d84307d9b2)", () => {
  const invalid = { form_code: "", language: "" };
  const resInvalid = validateConsentDraft(invalid);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.some((e) => e.includes("form code")));
  assert.ok(resInvalid.errors.some((e) => e.includes("language")));

  // Missing procedure name for anaesthesia consent
  const noProc = { form_code: "ANAESTHESIA", language: "Urdu", procedure_name: "" };
  const resNoProc = validateConsentDraft(noProc);
  assert.equal(resNoProc.valid, false);
  assert.ok(resNoProc.errors.some((e) => e.includes("procedure name")));

  // Valid draft
  const valid = {
    form_code: "ANAESTHESIA",
    language: "Urdu",
    procedure_name: "Appendectomy under Spinal Anaesthesia",
  };
  const resValid = validateConsentDraft(valid);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});

test("consents_anaesthesia: validateConsentSign enforces who_decides and minor rules (Rule b7bacc1ffb, cb2f327ee7)", () => {
  const whoDecidesMinor = {
    adult_age: 18,
    patient_is_minor: true,
    patient_may_sign: false,
    decision_makers: [
      { relationship: "Parent", description: "Mother or Father", priority: 1 },
      { relationship: "Guardian", description: "Legal Guardian", priority: 2 },
    ],
    emergency_second_doctor: false,
  };

  // 1. Minor patient signing directly -> rejected
  const minorSignDirect = {
    mode: "Signed",
    signer: "Patient",
    questions_answers: "None asked",
    understanding_confirmed: true,
  };
  const resDirect = validateConsentSign(minorSignDirect, whoDecidesMinor);
  assert.equal(resDirect.valid, false);
  assert.ok(resDirect.errors.some((e) => e.includes("under legal consent age")));

  // 2. DecisionMaker with unauthorized relationship -> rejected
  const dmWrongRel = {
    mode: "Signed",
    signer: "DecisionMaker",
    signer_relationship: "CareProvider", // Not in decision_makers
    signer_name: "John Doe",
    incapacity_reason: "Minor",
    questions_answers: "None asked",
    understanding_confirmed: true,
  };
  const resWrongRel = validateConsentSign(dmWrongRel, whoDecidesMinor);
  assert.equal(resWrongRel.valid, false);
  assert.ok(resWrongRel.errors.some((e) => e.includes("not permitted to sign")));

  // 3. DecisionMaker with valid relationship -> valid
  const dmValid = {
    mode: "Signed",
    signer: "DecisionMaker",
    signer_relationship: "Parent",
    signer_name: "Fatima Bibi",
    incapacity_reason: "Minor",
    questions_answers: "Explained risks of spinal headache; patient understood.",
    understanding_confirmed: true,
  };
  const resValid = validateConsentSign(dmValid, whoDecidesMinor);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);

  // 4. Thumb impression requires witness
  const thumbNoWitness = {
    mode: "Signed",
    signer: "Patient",
    signer_mark: "ThumbImpression",
    witness_name: "",
    questions_answers: "None asked",
    understanding_confirmed: true,
  };
  const whoDecidesAdult = {
    adult_age: 18,
    patient_is_minor: false,
    patient_may_sign: true,
    decision_makers: [],
    emergency_second_doctor: false,
  };
  const resThumbNoWit = validateConsentSign(thumbNoWitness, whoDecidesAdult);
  assert.equal(resThumbNoWit.valid, false);
  assert.ok(resThumbNoWit.errors.some((e) => e.toLowerCase().includes("witness name")));

  // 5. Emergency Note requires note and second doctor when mandated
  const emergNoSecond = {
    mode: "EmergencyNote",
    emergency_note: "Patient unconscious from trauma, immediate laparotomy needed.",
    second_doctor_id: null,
  };
  const whoDecidesEmerg = {
    adult_age: 18,
    patient_is_minor: false,
    patient_may_sign: false,
    decision_makers: [],
    emergency_second_doctor: true,
  };
  const resEmergNoSecond = validateConsentSign(emergNoSecond, whoDecidesEmerg);
  assert.equal(resEmergNoSecond.valid, false);
  assert.ok(resEmergNoSecond.errors.some((e) => e.includes("second PMDC-registered doctor")));
});

test("consents_anaesthesia: validateConsentRefuse validates refusal reason and witness for verbal (Rule b7bacc1ffb)", () => {
  // Empty refusal reason -> rejected
  const emptyRef = { refusal_reason: "" };
  assert.equal(validateConsentRefuse(emptyRef).valid, false);

  // Verbal refusal without witness -> rejected
  const verbalNoWitness = {
    mode: "VerbalRefusal",
    refusal_reason: "Patient refuses regional block due to fear of back needle.",
    witness_name: "",
  };
  const resVerbalNoWit = validateConsentRefuse(verbalNoWitness);
  assert.equal(resVerbalNoWit.valid, false);
  assert.ok(resVerbalNoWit.errors.some((e) => e.includes("Witness name is required")));

  // Valid verbal refusal with witness
  const verbalWithWit = {
    mode: "VerbalRefusal",
    refusal_reason: "Patient refuses regional block due to fear of back needle.",
    witness_name: "Staff Nurse Aisha",
  };
  assert.equal(validateConsentRefuse(verbalWithWit).valid, true);
});

test("consents_anaesthesia: explainConsentError returns accurate bilingual messages", () => {
  const takerErr = explainConsentError("CONSENT_TAKER_NOT_AUTHORIZED");
  assert.ok(takerErr.en.includes("Anaesthesia consent must be explained"));
  assert.ok(takerErr.ur.includes("اینستھیزیا"));

  const missingLang = explainConsentError("CONSENT_TEXT_MISSING", { available: ["English", "Urdu"] });
  assert.ok(missingLang.en.includes("English, Urdu"));
  assert.ok(missingLang.ur.includes("دستیاب نہیں"));

  const finalErr = explainConsentError("CONSENT_DECIDED_FINAL");
  assert.ok(finalErr.en.includes("already been signed or refused"));
  assert.ok(finalErr.ur.includes("حتمی"));

  const fallback = explainConsentError("UNKNOWN_ERROR");
  assert.ok(fallback.en.includes("UNKNOWN_ERROR"));
  assert.ok(fallback.ur.includes("UNKNOWN_ERROR"));
});
