import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateDeathRecordView,
  canRecordDeath,
  canViewDeathRegister,
  canManageAutopsy,
  validateRecordDeath,
  determineUnderlyingCause,
  checkCertificationReadiness,
  validateDeathDraft,
  validateDeathCorrection,
  validateAutopsyRequest,
  validateAutopsyReport,
  sortDeathRegister,
  explainDeathError,
} from '../src/death-record-policy.ts';

const mockDoctorUser = {
  user_id: 101,
  username: 'dr.amna',
  roles: ['doctor'],
  role: 'doctor',
  permissions: ['death.record', 'death.register.view', 'death.autopsy.authorize'],
};

const mockNurseUser = {
  user_id: 102,
  username: 'nurse.fatima',
  roles: ['nurse'],
  role: 'nurse',
  permissions: ['vitals.record'],
};

const mockEstablishment = {
  establishment_id: 'est_1',
  name: 'Teaching Hospital',
  services: [
    { service: 'emergency_department', status: 'Active' },
    { service: 'inpatient_wards', status: 'Active' },
  ],
  views: {
    screens: [
      { screen_id: 'death_record', view: 'full' },
    ],
    workspaces: [],
  },
};

test('evaluateDeathRecordView respects service capability and screen view config', () => {
  const full = evaluateDeathRecordView(mockEstablishment, 'death_record');
  assert.equal(full.view, 'full');
  assert.equal(full.canRecordNew, true);
  assert.equal(full.canCertify, true);

  const retiringEst = {
    ...mockEstablishment,
    views: {
      screens: [{ screen_id: 'death_record', view: 'open_work' }],
      workspaces: [],
    },
  };
  const retiring = evaluateDeathRecordView(retiringEst, 'death_record');
  assert.equal(retiring.view, 'open_work');
  assert.equal(retiring.canRecordNew, false);
  assert.match(retiring.banner ?? '', /No new death records/);

  const recordsEst = {
    ...mockEstablishment,
    views: {
      screens: [{ screen_id: 'death_record', view: 'records' }],
      workspaces: [],
    },
  };
  const recordsOnly = evaluateDeathRecordView(recordsEst, 'death_record');
  assert.equal(recordsOnly.view, 'records');
  assert.equal(recordsOnly.canEditDraft, false);
});

test('role and permission gating strictly enforces clinical certifiers per PMDC rules', () => {
  assert.equal(canRecordDeath(mockDoctorUser), true);
  assert.equal(canViewDeathRegister(mockDoctorUser), true);
  assert.equal(canManageAutopsy(mockDoctorUser), true);

  assert.equal(canRecordDeath(mockNurseUser), false);
  assert.equal(canViewDeathRegister(mockNurseUser), false);
  assert.equal(canManageAutopsy(mockNurseUser), false);

  const surgeonUser = {
    user_id: 103,
    username: 'dr.tariq',
    roles: ['surgeon'],
    role: 'surgeon',
    permissions: ['death.record'],
  };
  assert.equal(canRecordDeath(surgeonUser), true);
});

test('validateRecordDeath verifies patient ID, death timestamp and brought dead requirements', () => {
  const pastTime = new Date(Date.now() - 3600000).toISOString();
  const earlierTime = new Date(Date.now() - 7200000).toISOString();

  const validErrors = validateRecordDeath(501, {
    death_at: pastTime,
    setting: 'Inpatient',
    expected_death: false,
    terminal_event: 'Cardiopulmonary arrest',
  });
  assert.equal(Object.keys(validErrors).length, 0);

  const missingPatientErrors = validateRecordDeath(0, {
    death_at: pastTime,
    setting: 'Inpatient',
  });
  assert(missingPatientErrors.patient_id);
  assert.match(missingPatientErrors.patient_id, /Valid patient ID is required/);

  const broughtDeadWithoutArrival = validateRecordDeath(502, {
    death_at: pastTime,
    setting: 'BroughtDead',
    expected_death: false,
  });
  assert(broughtDeadWithoutArrival.arrived_at);
  assert.match(broughtDeadWithoutArrival.arrived_at, /Time body arrived at hospital is required/);

  const validBroughtDead = validateRecordDeath(502, {
    death_at: earlierTime,
    arrived_at: pastTime,
    setting: 'BroughtDead',
    expected_death: false,
  });
  assert.equal(Object.keys(validBroughtDead).length, 0);
});

test('WHO cause of death: determineUnderlyingCause picks lowest filled line in Part I', () => {
  // Only line a
  const causeAOnly = determineUnderlyingCause({
    cause_a: 'Acute myocardial infarction',
  });
  assert.equal(causeAOnly.line, 'a');
  assert.equal(causeAOnly.cause, 'Acute myocardial infarction');

  // Lines a and b
  const causeAandB = determineUnderlyingCause({
    cause_a: 'Acute pulmonary edema',
    cause_b: 'Acute myocardial infarction',
  });
  assert.equal(causeAandB.line, 'b');
  assert.equal(causeAandB.cause, 'Acute myocardial infarction');

  // Lines a, b, and c
  const causeAtoC = determineUnderlyingCause({
    cause_a: 'Hepatic encephalopathy',
    cause_b: 'Cirrhosis of liver',
    cause_c: 'Chronic hepatitis B infection',
  });
  assert.equal(causeAtoC.line, 'c');
  assert.equal(causeAtoC.cause, 'Chronic hepatitis B infection');

  // Lines a, b, c, and d
  const causeAtoD = determineUnderlyingCause({
    cause_a: 'Septic shock',
    cause_b: 'Peritonitis',
    cause_c: 'Perforated duodenal ulcer',
    cause_d: 'Helicobacter pylori gastroduodenitis',
  });
  assert.equal(causeAtoD.line, 'd');
  assert.equal(causeAtoD.cause, 'Helicobacter pylori gastroduodenitis');
});

test('checkCertificationReadiness enforces WHO completeness, manner, external causes and pregnancy rules', () => {
  const patientFemale30 = {
    patient_id: 505,
    gender: 'female',
    age_years: 30,
    pregnancy_applies: true,
    infant_applies: false,
  };

  // Incomplete: missing line a
  const incomplete = checkCertificationReadiness({}, patientFemale30);
  assert.equal(incomplete.ready, false);
  assert(incomplete.missing.includes('cause_a'));

  // Missing pregnancy status
  const partial = checkCertificationReadiness({
    cause_a: 'Septic shock',
    manner: 'Disease',
    expected_death: false,
    surgery_within_4_weeks: false,
  }, patientFemale30);
  assert.equal(partial.ready, false);
  assert(partial.missing.includes('pregnancy_status'));

  // Complete female certificate
  const completeFemale = checkCertificationReadiness({
    cause_a: 'Septic shock',
    manner: 'Disease',
    expected_death: true,
    surgery_within_4_weeks: false,
    pregnancy_status: 'NotPregnant',
  }, patientFemale30);
  assert.equal(completeFemale.ready, true);
  assert.equal(completeFemale.missing.length, 0);

  // Violent manner requires external cause details
  const violentIncomplete = checkCertificationReadiness({
    cause_a: 'Traumatic brain injury',
    manner: 'Accident',
    expected_death: false,
    surgery_within_4_weeks: false,
    pregnancy_status: 'NotPregnant',
  }, patientFemale30);
  assert.equal(violentIncomplete.ready, false);
  assert(violentIncomplete.missing.includes('external_cause'));
});

test('autopsy validation: medico-legal deaths forbid clinical autopsy per rule 0cf8a9f905', () => {
  const nonMlcDeath = {
    death_id: 901,
    mlc_number: null,
    mlc_id: null,
    status: 'Certified',
  };

  const mlcDeath = {
    death_id: 902,
    mlc_number: 'MLC-2026-089',
    mlc_id: 44,
    status: 'Certified',
  };

  const validReq = validateAutopsyRequest({
    request_reasons: 'Discrepancy between ante-mortem imaging and sudden cardiac collapse',
  }, nonMlcDeath);
  assert.equal(validReq.valid, true);

  const blockedReq = validateAutopsyRequest({
    request_reasons: 'Evaluate trauma etiology',
  }, mlcDeath);
  assert.equal(blockedReq.valid, false);
  assert.match(blockedReq.error ?? '', /clinical autopsy/i);
});

test('validateDeathCorrection enforces mandatory factual justification and field targets', () => {
  const valid = validateDeathCorrection({
    correction_text: 'Chronic kidney disease Stage 5 (N18.5)',
    correction_reason: 'Histopathology report completed post-certification confirmed end-stage diabetic nephropathy',
  });
  assert.equal(Object.keys(valid).length, 0);

  const shortReason = validateDeathCorrection({
    correction_text: 'CKD',
    correction_reason: 'a',
  });
  assert(shortReason.correction_reason);
  assert.match(shortReason.correction_reason, /at least 3 characters/);
});

test('explainDeathError returns actionable guidance for domain error codes', () => {
  const certifierErr = explainDeathError({ code: 'DEATH_CERTIFIER_NOT_DOCTOR' });
  assert.match(certifierErr, /Only a doctor registered with the PMDC/);

  const finalErr = explainDeathError({ code: 'DEATH_RECORD_FINAL' });
  assert.match(finalErr, /certified/i);

  const mlcAutopsyErr = explainDeathError({ code: 'AUTOPSY_MEDICO_LEGAL' });
  assert.match(mlcAutopsyErr, /police/i);
});

test('sortDeathRegister orders Draft certificates first, then newest deaths', () => {
  const rows = [
    { death_id: 1, status: 'Certified', death_at: '2026-11-01T08:00:00Z' },
    { death_id: 2, status: 'Draft', death_at: '2026-11-01T07:00:00Z' },
    { death_id: 3, status: 'Certified', death_at: '2026-11-01T09:00:00Z' },
  ];
  const sorted = sortDeathRegister(rows);
  assert.equal(sorted[0].death_id, 2); // Draft first
  assert.equal(sorted[1].death_id, 3); // Newer Certified
  assert.equal(sorted[2].death_id, 1); // Older Certified
});
