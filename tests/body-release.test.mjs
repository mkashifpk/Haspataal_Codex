import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateBodyReleaseView,
  canReleaseBody,
  canViewBodyRegister,
  checkHandoverReadiness,
  validateBodyRelease,
  sortBodyReleaseQueue,
  explainBodyReleaseError,
} from '../src/body-release-policy.ts';

const mockWardNurse = {
  user_id: 201,
  username: 'nurse.sadia',
  roles: ['ward_nurse'],
  role: 'ward_nurse',
  permissions: ['death.body.release', 'death.register.view'],
};

const mockDoctor = {
  user_id: 202,
  username: 'dr.hassan',
  roles: ['doctor'],
  role: 'doctor',
  permissions: ['death.record', 'death.register.view', 'death.body.release'],
};

const mockReceptionist = {
  user_id: 203,
  username: 'reception.ali',
  roles: ['receptionist'],
  role: 'receptionist',
  permissions: ['patient.register'],
};

const mockEstablishment = {
  revision: 1,
  profile: null,
  active: ['inpatient', 'emergency_department'],
  rules_in_force: [],
  capabilities: [
    {
      capability: 'inpatient',
      label: 'Inpatient wards',
      purpose: 'Ward admissions and stays',
      state: 'Active',
      state_since: '2026-01-01',
      changed_by_name: 'Admin',
      requires: [],
      hospital_only: true,
      implemented: true,
      new_work: null,
    },
    {
      capability: 'emergency_department',
      label: 'Emergency Department',
      purpose: 'Emergency casualties and trauma',
      state: 'Active',
      state_since: '2026-01-01',
      changed_by_name: 'Admin',
      requires: [],
      hospital_only: false,
      implemented: true,
      new_work: null,
    },
  ],
  views: {
    screens: [
      { screen_id: 'body_release_ward', view: 'full' },
      { screen_id: 'body_release_er', view: 'full' },
    ],
    workspaces: [],
  },
};

test('evaluateBodyReleaseView evaluates capability gates and view states for ward and ER', () => {
  // Ward full
  const wardFull = evaluateBodyReleaseView(mockEstablishment, 'body_release_ward');
  assert.equal(wardFull.view, 'full');
  assert.equal(wardFull.canRelease, true);
  assert.equal(wardFull.canViewRegister, true);

  // ER full
  const erFull = evaluateBodyReleaseView(mockEstablishment, 'body_release_er');
  assert.equal(erFull.view, 'full');
  assert.equal(erFull.canRelease, true);

  // Inpatient retiring
  const retiringEst = {
    ...mockEstablishment,
    capabilities: [
      { ...mockEstablishment.capabilities[0], state: 'Retiring' },
      mockEstablishment.capabilities[1],
    ],
    views: {
      screens: [{ screen_id: 'body_release_ward', view: 'open_work' }],
      workspaces: [],
    },
  };
  const wardRetiring = evaluateBodyReleaseView(retiringEst, 'body_release_ward');
  assert.equal(wardRetiring.view, 'open_work');
  assert.equal(wardRetiring.canRelease, true);
  assert.match(wardRetiring.banner ?? '', /No new inpatient admissions/);

  // Inpatient retired
  const retiredEst = {
    ...mockEstablishment,
    capabilities: [
      { ...mockEstablishment.capabilities[0], state: 'Retired' },
      mockEstablishment.capabilities[1],
    ],
    views: {
      screens: [{ screen_id: 'body_release_ward', view: 'records' }],
      workspaces: [],
    },
  };
  const wardRetired = evaluateBodyReleaseView(retiredEst, 'body_release_ward');
  assert.equal(wardRetired.view, 'records');
  assert.equal(wardRetired.canRelease, false);
});

test('role and permission gating allows nurses and doctors but rejects non-clinical roles', () => {
  assert.equal(canReleaseBody(mockWardNurse), true);
  assert.equal(canViewBodyRegister(mockWardNurse), true);

  assert.equal(canReleaseBody(mockDoctor), true);
  assert.equal(canViewBodyRegister(mockDoctor), true);

  assert.equal(canReleaseBody(mockReceptionist), false);
  assert.equal(canViewBodyRegister(mockReceptionist), false);
});

test('checkHandoverReadiness enforces doctor certification per rule cd68894ad3', () => {
  const draftDeath = {
    death_id: 1,
    death_number: 'DTH-2026-001',
    patient_id: 101,
    mrn: 'MRN-101',
    patient_name: 'Patient One',
    gender: 'male',
    setting: 'Inpatient',
    death_at: '2026-11-01T04:00:00Z',
    status: 'Draft',
    admission_number: 'ADM-01',
    ward_name: 'Male Medical Ward',
    department_name: 'Medicine',
    underlying_cause: null,
    underlying_icd: null,
    underlying_term: null,
    manner: null,
    expected_death: null,
    mlc_number: null,
    certifier_name: null,
    certified_at: null,
    body_released_at: null,
    body_released_to: null,
    autopsy_status: null,
  };

  const draftCheck = checkHandoverReadiness(draftDeath);
  assert.equal(draftCheck.ready, false);
  assert.match(draftCheck.reason ?? '', /doctor has not certified/i);

  const certifiedDeath = {
    ...draftDeath,
    status: 'Certified',
    underlying_cause: 'Acute Myocardial Infarction',
    certifier_name: 'Dr. Hassan',
    certified_at: '2026-11-01T05:00:00Z',
  };

  const certifiedCheck = checkHandoverReadiness(certifiedDeath);
  assert.equal(certifiedCheck.ready, true);
  assert.equal(certifiedCheck.reason, null);

  const releasedDeath = {
    ...certifiedDeath,
    body_released_at: '2026-11-01T06:00:00Z',
    body_released_to: 'NextOfKin',
  };

  const releasedCheck = checkHandoverReadiness(releasedDeath);
  assert.equal(releasedCheck.ready, false);
  assert.match(releasedCheck.reason ?? '', /already been handed over/i);
});

test('validateBodyRelease validates next-of-kin CNIC/relationship and MLC police reference per rule 60aea191e4', () => {
  const nonMlcDeath = {
    death_id: 1,
    mlc_number: null,
    status: 'Certified',
  };

  const mlcDeath = {
    death_id: 2,
    mlc_number: 'MLC-2026-099',
    status: 'Certified',
  };

  // Next of kin valid
  const validKin = validateBodyRelease(
    {
      released_to: 'NextOfKin',
      receiver_name: 'Hamza Farooq',
      receiver_relationship: 'Son',
      receiver_id_number: '35201-1234567-1',
      receiver_phone: '0300-1234567',
    },
    nonMlcDeath
  );
  assert.equal(Object.keys(validKin).length, 0);

  // Next of kin missing CNIC
  const missingCnic = validateBodyRelease(
    {
      released_to: 'NextOfKin',
      receiver_name: 'Hamza Farooq',
      receiver_relationship: 'Son',
      receiver_id_number: '',
    },
    nonMlcDeath
  );
  assert(missingCnic.receiver_id_number);
  assert.match(missingCnic.receiver_id_number, /CNIC or national identity document/i);

  // MLC without police reference triggers error
  const mlcMissingRef = validateBodyRelease(
    {
      released_to: 'Police',
      receiver_name: 'ASI Muhammad Aslam (Belt #482)',
      police_reference: '',
    },
    mlcDeath
  );
  assert(mlcMissingRef.police_reference);
  assert.match(mlcMissingRef.police_reference, /Police diary or letter reference is mandatory/i);

  // MLC with police reference passes
  const mlcValid = validateBodyRelease(
    {
      released_to: 'Police',
      receiver_name: 'ASI Muhammad Aslam (Belt #482)',
      police_reference: 'Roznamcha Entry #44, PS Civil Lines',
    },
    mlcDeath
  );
  assert.equal(Object.keys(mlcValid).length, 0);
});

test('sortBodyReleaseQueue prioritizes certified unreleased bodies first, then drafts, then released', () => {
  const rows = [
    { death_id: 1, status: 'Certified', body_released_at: '2026-11-01T06:00:00Z', death_at: '2026-11-01T05:00:00Z' },
    { death_id: 2, status: 'Draft', body_released_at: null, death_at: '2026-11-01T07:00:00Z' },
    { death_id: 3, status: 'Certified', body_released_at: null, death_at: '2026-11-01T06:30:00Z' },
  ];

  const sorted = sortBodyReleaseQueue(rows);
  assert.equal(sorted[0].death_id, 3); // Certified unreleased first
  assert.equal(sorted[1].death_id, 2); // Draft second
  assert.equal(sorted[2].death_id, 1); // Released third
});

test('explainBodyReleaseError provides bilingual guidance for domain error codes', () => {
  const [enCert, urCert] = explainBodyReleaseError({ code: 'DEATH_RECORD_NOT_CERTIFIED' });
  assert.match(enCert, /doctor has not certified/i);
  assert.match(urCert, /ڈاکٹر نے ابھی تک وفات کے اسباب کی تصدیق نہیں کی/);

  const [enRel, urRel] = explainBodyReleaseError({ code: 'BODY_ALREADY_RELEASED' });
  assert.match(enRel, /already been released/i);
  assert.match(urRel, /پہلے ہی باضابطہ طور پر/);
});
