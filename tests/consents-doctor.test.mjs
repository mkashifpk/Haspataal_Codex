import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consentAccess,
  consentActionAllowed,
  decisionBody,
  emptyDecision,
  consentDecisionMakers,
  explanationBody,
} from '../src/consent-policy.ts';

test('consents_doctor access policy grants clinical consent capabilities based on user permissions', () => {
  // Doctor with full clinical consent permissions
  const doctorAccess = consentAccess('full', ['consent.view', 'consent.record']);
  assert.equal(doctorAccess.read, true);
  assert.equal(doctorAccess.write, true);
  assert.equal(doctorAccess.correct, true);

  // Unrestricted view default (when consents_doctor is not explicitly restricted in establishment.views.screens)
  const defaultViewAccess = consentAccess('full', ['consent.view', 'consent.record']);
  assert.equal(defaultViewAccess.read, true);
  assert.equal(defaultViewAccess.write, true);

  // Read-only consultation mode
  const readOnlyAccess = consentAccess('full', ['consent.view']);
  assert.equal(readOnlyAccess.read, true);
  assert.equal(readOnlyAccess.write, false);
  assert.equal(readOnlyAccess.correct, false);

  // Missing all permissions
  const noAccess = consentAccess('full', []);
  assert.equal(noAccess.read, false);
  assert.equal(noAccess.write, false);
  assert.equal(noAccess.correct, false);
});

test('consents_doctor supports high-risk clinical procedures and full lifecycle action rules (rule:d84307d9b2, rule:8b7301ca0f)', () => {
  const clinicalCategories = [
    'Operation',
    'Procedure',
    'Anaesthesia',
    'Transfusion',
    'HighRiskTreatment',
    'AgainstMedicalAdvice',
  ];

  for (const category of clinicalCategories) {
    const draft = {
      consent_id: 301,
      category,
      status: 'Draft',
      who_decides: { patient_may_sign: true, decision_makers: [] },
      missing: [],
      row_version: 1,
    };

    // Draft permits clinical editing, signing, refusal and cancellation
    assert.equal(consentActionAllowed(draft, 'edit'), true);
    assert.equal(consentActionAllowed(draft, 'sign'), true);
    assert.equal(consentActionAllowed(draft, 'refuse'), true);
    assert.equal(consentActionAllowed(draft, 'cancel'), true);
    assert.equal(consentActionAllowed(draft, 'withdraw'), false);
    assert.equal(consentActionAllowed(draft, 'scan'), false);

    // Given status allows withdrawal with clinical reason and scan attachment
    const given = { ...draft, status: 'Given' };
    assert.equal(consentActionAllowed(given, 'withdraw'), true);
    assert.equal(consentActionAllowed(given, 'scan'), true);
    assert.equal(consentActionAllowed(given, 'edit'), false);
    assert.equal(consentActionAllowed(given, 'sign'), false);

    // Refused or Withdrawn allows scanning the physical documentation
    const refused = { ...draft, status: 'Refused' };
    assert.equal(consentActionAllowed(refused, 'scan'), true);
    const withdrawn = { ...draft, status: 'Withdrawn' };
    assert.equal(consentActionAllowed(withdrawn, 'scan'), true);
  }
});

test('consents_doctor validates clinical decision details, informed refusal, and second doctor concurrence (rule:b7bacc1ffb, rule:f811c03843)', () => {
  const opConsent = {
    consent_id: 401,
    category: 'Operation',
    status: 'Draft',
    row_version: 2,
    missing: [],
    who_decides: {
      patient_may_sign: true,
      emergency_second_doctor: true,
      decision_makers: [{ relationship: 'Spouse', description: 'Spouse' }],
    },
  };

  const validDoctorInput = () => ({
    ...emptyDecision(),
    signer: 'Patient',
    questions_answers: 'Risks of bleeding, infection, and alternative treatments explained in detail',
    understanding_confirmed: true,
    ack: true,
  });

  // Valid informed consent signed by competent adult
  const signedBody = decisionBody(opConsent, validDoctorInput(), 'sign', 15);
  assert.equal(signedBody.signer, 'Patient');
  assert.equal(signedBody.understanding_confirmed, true);

  // Informed refusal requires verbatim reason in patient words
  const refusalInput = {
    ...validDoctorInput(),
    mode: 'VerbalRefusal',
    refusal_reason: 'Patient prefers conservative medical management after discussing surgical risks',
    witness_name: 'Staff Nurse Hina',
  };
  const refusedBody = decisionBody(opConsent, refusalInput, 'refuse', 15);
  assert.equal(refusedBody.mode, 'VerbalRefusal');
  assert.equal(refusedBody.refusal_reason.includes('conservative'), true);

  // Missing refusal reason is rejected
  assert.throws(
    () => decisionBody(opConsent, { ...refusalInput, refusal_reason: '' }, 'refuse', 15),
    /Enter the refusal/
  );

  // Emergency clinical note requires second PMDC registered doctor when mandated
  const emergencyNoteInput = {
    ...validDoctorInput(),
    mode: 'EmergencyNote',
    incapacity_reason: 'Patient in shock, unconscious from polytrauma',
    emergency_note: 'Emergency laparotomy cannot be delayed; no family reachable',
  };

  // Rejects when second doctor is missing
  assert.throws(
    () => decisionBody(opConsent, emergencyNoteInput, 'sign', 15),
    /second registered/
  );

  // Rejects when second doctor is the same as the operating doctor
  const sameDoctor = { employee_id: 15, license_type: 'PMDC', registration: 'PMDC-12345' };
  assert.throws(
    () => decisionBody(opConsent, { ...emergencyNoteInput, doctor: sameDoctor }, 'sign', 15)
  );

  // Accepts with a valid different PMDC registered doctor
  const consultingDoctor = {
    employee_id: 22,
    full_name: 'Dr. Tariq Aziz',
    license_type: 'PMDC',
    registration: 'PMDC-98765-S',
  };
  const emergencySigned = decisionBody(
    opConsent,
    { ...emergencyNoteInput, doctor: consultingDoctor },
    'sign',
    15
  );
  assert.equal(emergencySigned.second_doctor_id, 22);
});
