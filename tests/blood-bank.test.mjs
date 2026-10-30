import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bloodBankAccess,
  isStorageTempOutOfRange,
  validateStorageCheckIn,
  validateReceiveUnitIn,
  validateCrossmatchIn,
  validateBloodIssueIn,
  STORAGE_LIMITS,
} from '../src/blood-bank-policy.ts';

test('blood_bank access policy enforces capability gating, retiring view work continuation, and operator permissions (rule:3421aa3346, rule:d10b19f697, rule:6b0e7c1748, rule:9f01252b75)', () => {
  // 1. Lab technician with blood.bank.operate under active blood_transfusion service
  const operatorActive = bloodBankAccess('full', ['blood.view', 'blood.bank.operate'], true, false);
  assert.equal(operatorActive.read, true);
  assert.equal(operatorActive.receive, true);
  assert.equal(operatorActive.crossmatch, true);
  assert.equal(operatorActive.issue, true);
  assert.equal(operatorActive.discard, true);
  assert.equal(operatorActive.returnToSource, true);
  assert.equal(operatorActive.storageCheck, true);
  assert.equal(operatorActive.isRetiring, false);

  // 2. Retiring service (open_work): no new units, but continuing crossmatch and issue allowed (rule:6b0e7c1748, rule:9f01252b75)
  const operatorRetiring = bloodBankAccess('open_work', ['blood.view', 'blood.bank.operate'], false, true);
  assert.equal(operatorRetiring.read, true);
  assert.equal(operatorRetiring.receive, false); // no new received units
  assert.equal(operatorRetiring.crossmatch, true); // continuing work
  assert.equal(operatorRetiring.issue, true); // continuing work
  assert.equal(operatorRetiring.isRetiring, true);

  // 3. Service inactive: cannot start new units
  const serviceInactive = bloodBankAccess('full', ['blood.view', 'blood.bank.operate'], false, false);
  assert.equal(serviceInactive.read, true);
  assert.equal(serviceInactive.receive, false);
  assert.equal(serviceInactive.crossmatch, false);
  assert.equal(serviceInactive.issue, false);

  // 4. Records view: read-only
  const records = bloodBankAccess('records', ['blood.view', 'blood.bank.operate'], true, false);
  assert.equal(records.read, true);
  assert.equal(records.receive, false);
  assert.equal(records.crossmatch, false);
  assert.equal(records.issue, false);
  assert.equal(records.discard, false);
  assert.equal(records.isRecords, true);

  // 5. Read-only viewer with blood.view
  const readOnly = bloodBankAccess('full', ['blood.view'], true, false);
  assert.equal(readOnly.read, true);
  assert.equal(readOnly.receive, false);
  assert.equal(readOnly.crossmatch, false);
  assert.equal(readOnly.issue, false);
});

test('blood_bank validates storage temperature limits and requires corrective action when out of range (rule:970c05860c)', () => {
  // Blood refrigerator: +2°C to +6°C
  assert.equal(isStorageTempOutOfRange('BloodRefrigerator', 4.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('BloodRefrigerator', 2.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('BloodRefrigerator', 6.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('BloodRefrigerator', 1.8).outOfRange, true);
  assert.equal(isStorageTempOutOfRange('BloodRefrigerator', 7.5).outOfRange, true);

  // Plasma freezer: -25°C or colder
  assert.equal(isStorageTempOutOfRange('PlasmaFreezer', -30.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('PlasmaFreezer', -25.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('PlasmaFreezer', -20.0).outOfRange, true);
  assert.equal(isStorageTempOutOfRange('PlasmaFreezer', 0.0).outOfRange, true);

  // Platelet incubator: +20°C to +24°C
  assert.equal(isStorageTempOutOfRange('PlateletIncubator', 22.0).outOfRange, false);
  assert.equal(isStorageTempOutOfRange('PlateletIncubator', 19.5).outOfRange, true);
  assert.equal(isStorageTempOutOfRange('PlateletIncubator', 25.0).outOfRange, true);

  // Valid storage check within range
  const validCheck = validateStorageCheckIn({
    equipment: 'Fridge 1',
    storage_kind: 'BloodRefrigerator',
    temperature_c: 4.5,
  });
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.isOutOfRange, false);

  // Out of range check requires action_taken (rule:970c05860c)
  const outWithoutAction = validateStorageCheckIn({
    equipment: 'Fridge 1',
    storage_kind: 'BloodRefrigerator',
    temperature_c: 8.2,
    action_taken: '',
  });
  assert.equal(outWithoutAction.valid, false);
  assert.equal(outWithoutAction.isOutOfRange, true);
  assert.ok(outWithoutAction.errors.action_taken);

  // Out of range check with documented action is valid
  const outWithAction = validateStorageCheckIn({
    equipment: 'Fridge 1',
    storage_kind: 'BloodRefrigerator',
    temperature_c: 8.2,
    action_taken: 'Compressor reset, blood moved to reserve refrigerator.',
  });
  assert.equal(outWithAction.valid, true);
  assert.equal(outWithAction.isOutOfRange, true);
});

test('blood_bank validates receiving units, mandatory TTI screening, and collector sign-off (rule:82db038331, rule:7378206488)', () => {
  const futureExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // Valid received unit
  const validUnit = validateReceiveUnitIn({
    source_id: 1,
    unit_number: 'RBC-2026-001',
    component: 'RedCells',
    abo: 'O',
    rh: 'Positive',
    expires_at: futureExpiry,
    screened: true,
  });
  assert.equal(validUnit.valid, true);

  // Unscreened unit is refused (rule:82db038331)
  const unscreenedUnit = validateReceiveUnitIn({
    source_id: 1,
    unit_number: 'RBC-2026-001',
    component: 'RedCells',
    abo: 'O',
    rh: 'Positive',
    expires_at: futureExpiry,
    screened: false,
  });
  assert.equal(unscreenedUnit.valid, false);
  assert.ok(unscreenedUnit.errors.screened);

  // Expired unit is refused
  const expiredUnit = validateReceiveUnitIn({
    source_id: 1,
    unit_number: 'RBC-2026-001',
    component: 'RedCells',
    abo: 'O',
    rh: 'Positive',
    expires_at: '2020-01-01',
    screened: true,
  });
  assert.equal(expiredUnit.valid, false);
  assert.ok(expiredUnit.errors.expires_at);

  // Crossmatch validation
  const validCrossmatch = validateCrossmatchIn({
    unit_id: 10,
    patient_abo: 'A',
    patient_rh: 'Positive',
    sample_taken_at: new Date().toISOString(),
    method: 'Gel Card',
    result: 'Compatible',
  });
  assert.equal(validCrossmatch.valid, true);

  // Issue validation requires collector credentials (rule:7378206488)
  const issueMissingCreds = validateBloodIssueIn({
    unit_id: 10,
    crossmatch_id: 5,
    collector_username: '',
    collector_password: '',
  });
  assert.equal(issueMissingCreds.valid, false);
  assert.ok(issueMissingCreds.errors.collector_username);
  assert.ok(issueMissingCreds.errors.collector_password);

  const validIssue = validateBloodIssueIn({
    unit_id: 10,
    crossmatch_id: 5,
    collector_username: 'demo.nurse',
    collector_password: 'Password123',
  });
  assert.equal(validIssue.valid, true);
});
