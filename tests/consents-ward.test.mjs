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

test('consents_ward access policy enforces service inpatient view states and consent permissions (rule:42140c3a3c)', () => {
  // Full view with required permissions
  const fullAccess = consentAccess('full', ['consent.view', 'consent.record']);
  assert.equal(fullAccess.read, true);
  assert.equal(fullAccess.write, true);
  assert.equal(fullAccess.correct, true);

  // Open work retiring view (allows continuing open work and scans)
  const openWorkAccess = consentAccess('open_work', ['consent.view', 'consent.record']);
  assert.equal(openWorkAccess.read, true);
  assert.equal(openWorkAccess.write, true);
  assert.equal(openWorkAccess.correct, true);

  // Records view: history, scanning and permitted corrections only; no new preparation
  const recordsAccess = consentAccess('records', ['consent.view', 'consent.record']);
  assert.equal(recordsAccess.read, true);
  assert.equal(recordsAccess.write, false);
  assert.equal(recordsAccess.correct, true);

  // Missing write permission
  const readOnly = consentAccess('full', ['consent.view']);
  assert.equal(readOnly.read, true);
  assert.equal(readOnly.write, false);
  assert.equal(readOnly.correct, false);

  // Hidden view or no permissions
  const hiddenAccess = consentAccess('hidden', ['consent.view', 'consent.record']);
  assert.equal(hiddenAccess.read, false);
  assert.equal(hiddenAccess.write, false);
  assert.equal(hiddenAccess.correct, false);
});

test('consents_ward multi-category action allowances support ward procedure, anaesthesia, and general consents', () => {
  const categories = ['General', 'Procedure', 'Anaesthesia', 'Transfusion'];

  for (const cat of categories) {
    const draftConsent = {
      consent_id: 101,
      category: cat,
      status: 'Draft',
      who_decides: { patient_may_sign: true, decision_makers: [] },
      missing: [],
      row_version: 1,
    };

    // In Draft: edit, sign, refuse, cancel are permitted; withdraw and scan are blocked
    assert.equal(consentActionAllowed(draftConsent, 'edit'), true);
    assert.equal(consentActionAllowed(draftConsent, 'sign'), true);
    assert.equal(consentActionAllowed(draftConsent, 'refuse'), true);
    assert.equal(consentActionAllowed(draftConsent, 'cancel'), true);
    assert.equal(consentActionAllowed(draftConsent, 'withdraw'), false);
    assert.equal(consentActionAllowed(draftConsent, 'scan'), false);

    // In Given: withdraw and scan are permitted; edit and re-sign are blocked
    const givenConsent = { ...draftConsent, status: 'Given' };
    assert.equal(consentActionAllowed(givenConsent, 'withdraw'), true);
    assert.equal(consentActionAllowed(givenConsent, 'scan'), true);
    assert.equal(consentActionAllowed(givenConsent, 'edit'), false);
    assert.equal(consentActionAllowed(givenConsent, 'sign'), false);

    // In Refused or Withdrawn: scan is permitted
    const refusedConsent = { ...draftConsent, status: 'Refused' };
    assert.equal(consentActionAllowed(refusedConsent, 'scan'), true);

    const withdrawnConsent = { ...draftConsent, status: 'Withdrawn' };
    assert.equal(consentActionAllowed(withdrawnConsent, 'scan'), true);
  }

  // Category filtering when screenCategory is explicitly passed
  const procConsent = {
    consent_id: 102,
    category: 'Procedure',
    status: 'Draft',
    who_decides: { patient_may_sign: true, decision_makers: [] },
    missing: [],
    row_version: 1,
  };
  assert.equal(consentActionAllowed(procConsent, 'edit', 'General'), false);
  assert.equal(consentActionAllowed(procConsent, 'edit', 'Procedure'), true);
});

test('consents_ward enforces server who_decides, minor guardianship, and emergency second doctor rules (rule:cb2f327ee7, rule:b7bacc1ffb)', () => {
  const adultConsent = {
    consent_id: 201,
    category: 'General',
    status: 'Draft',
    row_version: 1,
    missing: [],
    who_decides: {
      patient_may_sign: true,
      emergency_second_doctor: false,
      decision_makers: [{ relationship: 'Spouse', description: 'Spouse' }],
    },
  };

  const baseDecision = () => ({
    ...emptyDecision(),
    signer: 'Patient',
    questions_answers: 'Ward consent questions answered',
    understanding_confirmed: true,
    ack: true,
  });

  // Adult can sign as Patient
  const adultBody = decisionBody(adultConsent, baseDecision(), 'sign');
  assert.equal(adultBody.signer, 'Patient');

  // Minor consent: patient_may_sign is false
  const minorConsent = {
    consent_id: 202,
    category: 'Procedure',
    status: 'Draft',
    row_version: 1,
    missing: [],
    who_decides: {
      patient_may_sign: false,
      emergency_second_doctor: false,
      decision_makers: [
        { relationship: 'Parent', description: 'Parent / Legal Guardian' },
        { relationship: 'Grandparent', description: 'Grandparent' },
      ],
    },
  };

  // Signing as Patient on a minor consent is rejected
  assert.throws(
    () => decisionBody(minorConsent, baseDecision(), 'sign'),
    /allowed decision maker/
  );

  // Signing with valid decision maker from who_decides in order
  const validParentDecision = {
    ...baseDecision(),
    signer: 'DecisionMaker',
    signer_relationship: 'Parent',
    signer_name: 'Muhammad Tariq',
    incapacity_reason: 'Patient is a minor under adult age',
  };
  const minorBody = decisionBody(minorConsent, validParentDecision, 'sign');
  assert.equal(minorBody.signer, 'DecisionMaker');
  assert.equal(minorBody.signer_relationship, 'Parent');

  // Arbitrary or unlisted relationship is rejected
  assert.throws(
    () => decisionBody(minorConsent, { ...validParentDecision, signer_relationship: 'Friend' }, 'sign')
  );

  // Emergency note mode requires emergency reason and second doctor when requested
  const emergencyConsent = {
    consent_id: 203,
    category: 'Procedure',
    status: 'Draft',
    row_version: 1,
    missing: [],
    who_decides: {
      patient_may_sign: false,
      emergency_second_doctor: true,
      decision_makers: [],
    },
  };

  const emergencyDecision = {
    ...baseDecision(),
    mode: 'EmergencyNote',
    incapacity_reason: 'Unconscious severe trauma patient',
    emergency_note: 'Emergency laparotomy cannot wait for family arrival',
  };

  // Without second doctor when required: fails
  assert.throws(
    () => decisionBody(emergencyConsent, emergencyDecision, 'sign', 10),
    /second registered/
  );

  // With qualified second registered doctor (different employee, PMDC license)
  const secondDoctor = {
    employee_id: 25,
    full_name: 'Dr. Ayesha Malik',
    license_type: 'PMDC',
    registration: 'PMDC-77441-S',
  };
  const emergencyBody = decisionBody(
    emergencyConsent,
    { ...emergencyDecision, doctor: secondDoctor },
    'sign',
    10
  );
  assert.equal(emergencyBody.second_doctor_id, 25);
});
