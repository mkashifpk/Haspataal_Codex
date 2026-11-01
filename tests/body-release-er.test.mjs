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

const mockTriageNurse = {
  user_id: 301,
  username: 'nurse.zainab',
  roles: ['triage_nurse'],
  role: 'triage_nurse',
  permissions: ['death.body.release', 'death.register.view'],
};

const mockErDoctor = {
  user_id: 302,
  username: 'dr.bilal',
  roles: ['doctor'],
  role: 'doctor',
  permissions: ['death.record', 'death.register.view', 'death.body.release'],
};

const mockPharmacyClerk = {
  user_id: 303,
  username: 'pharmacy.clerk',
  roles: ['pharmacist'],
  role: 'pharmacist',
  permissions: ['dispensing.record'],
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
      { screen_id: 'body_release_er', view: 'full' },
    ],
    workspaces: [],
  },
};

test('evaluateBodyReleaseView evaluates emergency_department capability and screen view for body_release_er', () => {
  // ER full
  const erFull = evaluateBodyReleaseView(mockEstablishment, 'body_release_er');
  assert.equal(erFull.view, 'full');
  assert.equal(erFull.canRelease, true);
  assert.equal(erFull.canViewRegister, true);

  // ER retiring
  const retiringEst = {
    ...mockEstablishment,
    capabilities: [
      mockEstablishment.capabilities[0],
      { ...mockEstablishment.capabilities[1], state: 'Retiring' },
    ],
    views: {
      screens: [{ screen_id: 'body_release_er', view: 'open_work' }],
      workspaces: [],
    },
  };
  const erRetiring = evaluateBodyReleaseView(retiringEst, 'body_release_er');
  assert.equal(erRetiring.view, 'open_work');
  assert.equal(erRetiring.canRelease, true);
  assert.match(erRetiring.banner ?? '', /No new emergency arrivals/);

  // ER retired
  const retiredEst = {
    ...mockEstablishment,
    capabilities: [
      mockEstablishment.capabilities[0],
      { ...mockEstablishment.capabilities[1], state: 'Retired' },
    ],
    views: {
      screens: [{ screen_id: 'body_release_er', view: 'records' }],
      workspaces: [],
    },
  };
  const erRetired = evaluateBodyReleaseView(retiredEst, 'body_release_er');
  assert.equal(erRetired.view, 'records');
  assert.equal(erRetired.canRelease, false);
});

test('role and permission gating allows triage nurses and emergency doctors but rejects non-clinical roles', () => {
  assert.equal(canReleaseBody(mockTriageNurse), true);
  assert.equal(canViewBodyRegister(mockTriageNurse), true);

  assert.equal(canReleaseBody(mockErDoctor), true);
  assert.equal(canViewBodyRegister(mockErDoctor), true);

  assert.equal(canReleaseBody(mockPharmacyClerk), false);
  assert.equal(canViewBodyRegister(mockPharmacyClerk), false);
});

test('checkHandoverReadiness enforces certification on Brought Dead and ER deaths', () => {
  const broughtDeadDraft = {
    death_id: 10,
    death_number: 'DTH-2026-BD01',
    patient_id: 401,
    mrn: 'MRN-401',
    patient_name: 'Unknown Male',
    gender: 'male',
    setting: 'BroughtDead',
    death_at: '2026-11-01T04:30:00Z',
    status: 'Draft',
    admission_number: null,
    ward_name: null,
    department_name: 'Emergency',
    underlying_cause: null,
    underlying_icd: null,
    underlying_term: null,
    manner: 'Accident',
    expected_death: false,
    mlc_number: 'MLC-2026-BD01',
    certifier_name: null,
    certified_at: null,
    body_released_at: null,
    body_released_to: null,
    autopsy_status: null,
  };

  const draftCheck = checkHandoverReadiness(broughtDeadDraft);
  assert.equal(draftCheck.ready, false);
  assert.match(draftCheck.reason ?? '', /doctor has not certified/i);

  const certifiedDeath = {
    ...broughtDeadDraft,
    status: 'Certified',
    underlying_cause: 'Polytrauma secondary to road traffic accident',
    certifier_name: 'Dr. Bilal',
    certified_at: '2026-11-01T05:00:00Z',
  };

  const certifiedCheck = checkHandoverReadiness(certifiedDeath);
  assert.equal(certifiedCheck.ready, true);
  assert.equal(certifiedCheck.reason, null);
});

test('validateBodyRelease enforces police roznamcha reference for ER medico-legal fatalities', () => {
  const erMlcDeath = {
    death_id: 11,
    mlc_number: 'MLC-2026-ER11',
    status: 'Certified',
  };

  const missingPoliceRef = validateBodyRelease(
    {
      released_to: 'Police',
      receiver_name: 'Sub-Inspector Rashid (Belt #312)',
      police_reference: '',
    },
    erMlcDeath
  );
  assert(missingPoliceRef.police_reference);
  assert.match(missingPoliceRef.police_reference, /Police diary or letter reference is mandatory/i);

  const validPoliceRelease = validateBodyRelease(
    {
      released_to: 'Police',
      receiver_name: 'Sub-Inspector Rashid (Belt #312)',
      police_reference: 'FIR #102/2026, Roznamcha Daily Diary Entry #18',
    },
    erMlcDeath
  );
  assert.equal(Object.keys(validPoliceRelease).length, 0);
});

test('sortBodyReleaseQueue prioritizes emergency handover queue appropriately', () => {
  const rows = [
    { death_id: 101, status: 'Draft', body_released_at: null, death_at: '2026-11-01T05:00:00Z' },
    { death_id: 102, status: 'Certified', body_released_at: null, death_at: '2026-11-01T04:45:00Z' },
    { death_id: 103, status: 'Certified', body_released_at: '2026-11-01T05:15:00Z', death_at: '2026-11-01T04:00:00Z' },
  ];

  const sorted = sortBodyReleaseQueue(rows);
  assert.equal(sorted[0].death_id, 102); // Certified unreleased first
  assert.equal(sorted[1].death_id, 101); // Draft awaiting certification second
  assert.equal(sorted[2].death_id, 103); // Released third
});

test('explainBodyReleaseError handles emergency body release refusals', () => {
  const [enForbid, urForbid] = explainBodyReleaseError({ code: 'FORBIDDEN' });
  assert.match(enForbid, /do not have permission/i);
  assert.match(urForbid, /اختیار حاصل نہیں ہے/);
});
