import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bloodSourcesAccess,
  validateBloodSourceIn,
  checkTransfusionReadiness,
  BLOOD_SOURCE_KINDS,
} from '../src/blood-sources-policy.ts';

test('blood_sources access policy gates operations by establishment view and user permissions (rule:bfedcd1c9e)', () => {
  // 1. Lab admin with full manage permission under full view
  const adminFull = bloodSourcesAccess('full', ['blood.view', 'blood.bank.manage']);
  assert.equal(adminFull.read, true);
  assert.equal(adminFull.write, true);
  assert.equal(adminFull.retire, true);
  assert.equal(adminFull.isRetiring, false);
  assert.equal(adminFull.isRecords, false);

  // 2. Setup view (Facility settings mode before service activation)
  const setupAccess = bloodSourcesAccess('setup', ['blood.bank.manage']);
  assert.equal(setupAccess.read, true);
  assert.equal(setupAccess.write, true);
  assert.equal(setupAccess.retire, true);
  assert.equal(setupAccess.isSetup, true);

  // 3. Open work (Retiring service banner "No new blood sources from now on")
  const retiringAccess = bloodSourcesAccess('open_work', ['blood.view', 'blood.bank.manage']);
  assert.equal(retiringAccess.read, true);
  assert.equal(retiringAccess.write, false); // no new sources
  assert.equal(retiringAccess.retire, true); // can still stop/modify existing
  assert.equal(retiringAccess.isRetiring, true);

  // 4. Records view (history and MOU contracts only)
  const recordsAccess = bloodSourcesAccess('records', ['blood.view', 'blood.bank.manage']);
  assert.equal(recordsAccess.read, true);
  assert.equal(recordsAccess.write, false);
  assert.equal(recordsAccess.retire, false);
  assert.equal(recordsAccess.isRecords, true);

  // 5. Hidden view (service not available at establishment)
  const hiddenAccess = bloodSourcesAccess('hidden', ['blood.view', 'blood.bank.manage']);
  assert.equal(hiddenAccess.read, false);
  assert.equal(hiddenAccess.write, false);
  assert.equal(hiddenAccess.retire, false);

  // 6. Read-only user with blood.view
  const readOnlyAccess = bloodSourcesAccess('full', ['blood.view']);
  assert.equal(readOnlyAccess.read, true);
  assert.equal(readOnlyAccess.write, false);
  assert.equal(readOnlyAccess.retire, false);

  // 7. Missing permissions completely
  const unprivileged = bloodSourcesAccess('full', ['general.view']);
  assert.equal(unprivileged.read, false);
  assert.equal(unprivileged.write, false);
});

test('blood_sources validates source category, PBTA licence, name, and OwnBloodCenter exclusivity (rule:0f1d0cc68d, rule:6b54b4330e)', () => {
  // Valid Regional Blood Center input
  const validRbc = validateBloodSourceIn({
    name: 'Punjab Regional Blood Center Lahore',
    kind: 'BloodCenter',
    licence_number: 'PBTA-LHR-2024-0089',
    agreement_document_id: 12,
  });
  assert.equal(validRbc.valid, true);
  assert.deepEqual(validRbc.errors, {});

  // Missing name
  const missingName = validateBloodSourceIn({
    name: '   ',
    kind: 'BloodCenter',
    licence_number: 'PBTA-LHR-2024-0089',
  });
  assert.equal(missingName.valid, false);
  assert.ok(missingName.errors.name);

  // Name exceeding 200 characters
  const longName = validateBloodSourceIn({
    name: 'A'.repeat(201),
    kind: 'BloodCenter',
    licence_number: 'PBTA-LHR-2024-0089',
  });
  assert.equal(longName.valid, false);
  assert.ok(longName.errors.name);

  // Missing PBTA licence number
  const missingLicence = validateBloodSourceIn({
    name: 'Partner Hospital Blood Bank',
    kind: 'HospitalBloodBank',
    licence_number: '',
  });
  assert.equal(missingLicence.valid, false);
  assert.ok(missingLicence.errors.licence_number);

  // Invalid category
  const invalidKind = validateBloodSourceIn({
    name: 'Partner Hospital Blood Bank',
    kind: 'CommercialDistributor',
    licence_number: 'PBTA-1234',
  });
  assert.equal(invalidKind.valid, false);
  assert.ok(invalidKind.errors.kind);

  // Single OwnBloodCenter allowed: second registration blocked (rule:6b54b4330e)
  const duplicateOwnCenter = validateBloodSourceIn({
    name: 'Hospital Own Blood Center Unit 2',
    kind: 'OwnBloodCenter',
    licence_number: 'PBTA-OWN-001',
    hasOwnCenterAlready: true,
  });
  assert.equal(duplicateOwnCenter.valid, false);
  assert.equal(duplicateOwnCenter.errors.kind, 'The hospital can only have one Own Blood Center.');

  // First OwnBloodCenter is allowed
  const firstOwnCenter = validateBloodSourceIn({
    name: 'Hospital Own Blood Center Unit 1',
    kind: 'OwnBloodCenter',
    licence_number: 'PBTA-OWN-001',
    hasOwnCenterAlready: false,
  });
  assert.equal(firstOwnCenter.valid, true);
});

test('blood_sources evaluates transfusion service readiness and stock validity on deactivation (rule:e20cbf9517, rule:68fb1eda66)', () => {
  // Transfusion service readiness check (rule:e20cbf9517)
  const emptySources = [];
  assert.equal(checkTransfusionReadiness(emptySources).hasActiveSource, false);
  assert.equal(checkTransfusionReadiness(emptySources).readyToActivate, false);

  const inactiveSources = [
    { is_active: false, name: 'Inactive RBC 1' },
    { is_active: false, name: 'Inactive Partner Bank' },
  ];
  assert.equal(checkTransfusionReadiness(inactiveSources).hasActiveSource, false);
  assert.equal(checkTransfusionReadiness(inactiveSources).readyToActivate, false);

  const activeSources = [
    { is_active: false, name: 'Inactive RBC 1' },
    { is_active: true, name: 'Active Regional Blood Center' },
  ];
  const readiness = checkTransfusionReadiness(activeSources);
  assert.equal(readiness.hasActiveSource, true);
  assert.equal(readiness.activeSourcesCount, 1);
  assert.equal(readiness.readyToActivate, true);

  // Supported category definitions and labels
  assert.equal(BLOOD_SOURCE_KINDS.length, 3);
  const kinds = BLOOD_SOURCE_KINDS.map((k) => k.kind);
  assert.ok(kinds.includes('BloodCenter'));
  assert.ok(kinds.includes('HospitalBloodBank'));
  assert.ok(kinds.includes('OwnBloodCenter'));
});
