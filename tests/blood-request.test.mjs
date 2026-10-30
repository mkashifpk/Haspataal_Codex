import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bloodRequestAccess,
  validateBloodRequestIn,
  canCancelBloodRequest,
  canCloseBloodRequest,
  BLOOD_COMPONENTS,
  BLOOD_URGENCIES,
} from '../src/blood-request-policy.ts';

test('blood_request access policy gates clinical actions by view, service capability, and permissions (rule:a79028f126, rule:90effa2802)', () => {
  // 1. Doctor with full request permission and active blood_transfusion capability
  const doctorActive = bloodRequestAccess('full', ['blood.view', 'blood.request'], true);
  assert.equal(doctorActive.read, true);
  assert.equal(doctorActive.write, true);
  assert.equal(doctorActive.close, true);
  assert.equal(doctorActive.cancel, true);
  assert.equal(doctorActive.isRetiring, false);

  // 2. Service capability inactive (rule:90effa2802): cannot create new requests
  const serviceInactive = bloodRequestAccess('full', ['blood.view', 'blood.request'], false);
  assert.equal(serviceInactive.read, true);
  assert.equal(serviceInactive.write, false); // blocked because service is not active
  assert.equal(serviceInactive.close, true);
  assert.equal(serviceInactive.cancel, true);

  // 3. Retiring view (open_work): "No new ... from now on" banner, new work blocked
  const retiring = bloodRequestAccess('open_work', ['blood.view', 'blood.request'], true);
  assert.equal(retiring.read, true);
  assert.equal(retiring.write, false); // no new requests
  assert.equal(retiring.close, true); // continuing work
  assert.equal(retiring.cancel, true);
  assert.equal(retiring.isRetiring, true);

  // 4. Records view: read-only mode
  const records = bloodRequestAccess('records', ['blood.view', 'blood.request'], true);
  assert.equal(records.read, true);
  assert.equal(records.write, false);
  assert.equal(records.close, false);
  assert.equal(records.cancel, false);
  assert.equal(records.isRecords, true);

  // 5. Blood bank operator close permissions
  const bankOperator = bloodRequestAccess('full', ['blood.view', 'blood.bank.operate'], true);
  assert.equal(bankOperator.read, true);
  assert.equal(bankOperator.write, false);
  assert.equal(bankOperator.close, true);
  assert.equal(bankOperator.cancel, false);
});

test('blood_request validates component, units (1-20), urgency, transfusion consent, and emergency uncrossmatched note (rule:c5f6768a50, rule:8da78caf6b)', () => {
  // Valid Routine request
  const validRoutine = validateBloodRequestIn({
    patient_id: 101,
    admission_id: 50,
    component: 'RedCells',
    units_requested: 2,
    urgency: 'Routine',
    indication: 'Symptomatic chronic anemia with Hb 6.5 g/dL',
    consent_id: 301,
  });
  assert.equal(validRoutine.valid, true);
  assert.deepEqual(validRoutine.errors, {});

  // Missing transfusion consent (rule:c5f6768a50)
  const missingConsent = validateBloodRequestIn({
    patient_id: 101,
    admission_id: 50,
    component: 'RedCells',
    units_requested: 2,
    urgency: 'Routine',
    indication: 'Symptomatic anemia',
    consent_id: null,
  });
  assert.equal(missingConsent.valid, false);
  assert.equal(missingConsent.errors.consent_id, 'A Given transfusion consent of this stay is required.');

  // Missing stay context (neither admission nor ER visit)
  const missingStay = validateBloodRequestIn({
    patient_id: 101,
    component: 'RedCells',
    units_requested: 2,
    urgency: 'Routine',
    indication: 'Symptomatic anemia',
    consent_id: 301,
  });
  assert.equal(missingStay.valid, false);
  assert.ok(missingStay.errors.stay);

  // Units requested bounds check (must be whole number 1-20)
  for (const invalidUnits of [0, 21, -1, 2.5, NaN]) {
    const res = validateBloodRequestIn({
      admission_id: 50,
      component: 'RedCells',
      units_requested: invalidUnits,
      urgency: 'Routine',
      indication: 'Blood loss',
      consent_id: 301,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.units_requested);
  }

  // Emergency request with valid uncrossmatched authorization note (rule:8da78caf6b)
  const validEmergency = validateBloodRequestIn({
    er_visit_id: 12,
    component: 'WholeBlood',
    units_requested: 4,
    urgency: 'Emergency',
    indication: 'Massive hemorrhagic shock following severe blunt trauma',
    consent_id: 302,
    uncrossmatched_note: 'Patient in profound shock BP 60/40. Immediate uncrossmatched O-negative blood authorized under emergency protocol.',
  });
  assert.equal(validEmergency.valid, true);
});

test('blood_request enforces close and cancel state lifecycle rules (rule:d7b145b677)', () => {
  const openRequestNoUnits = {
    request_id: 10,
    request_number: 'REQ-10',
    patient_id: 101,
    mrn: 'MRN-001',
    patient_name: 'Fatima Bibi',
    blood_group: 'B+',
    admission_id: 50,
    admission_number: 'ADM-50',
    er_visit_id: null,
    er_number: null,
    booking_id: null,
    component: 'RedCells',
    units_requested: 2,
    units_issued: 0,
    urgency: 'Routine',
    indication: 'Preoperative optimization',
    consent_id: 301,
    consent_number: 'CON-301',
    uncrossmatched_note: null,
    requested_by: 5,
    requested_stamp: { employee_id: 5, user_id: 5, name: 'Dr. Tariq', designation: 'Surgeon', registration: 'PMDC 1111', at: '2026-10-30T10:00:00Z', text: 'Dr. Tariq' },
    requested_at: '2026-10-30T10:00:00Z',
    status: 'Open',
    closed_at: null,
    closed_by: null,
    close_note: null,
    row_version: 1,
    crossmatches: [],
    transfusions: [],
  };

  // Open request with 0 units issued can be cancelled or closed
  assert.equal(canCancelBloodRequest(openRequestNoUnits).allowed, true);
  assert.equal(canCloseBloodRequest(openRequestNoUnits).allowed, true);

  // Request where units were issued cannot be cancelled (rule:d7b145b677)
  const requestWithIssuedUnits = { ...openRequestNoUnits, units_issued: 1 };
  const cancelIssued = canCancelBloodRequest(requestWithIssuedUnits);
  assert.equal(cancelIssued.allowed, false);
  assert.ok(cancelIssued.reason?.includes('Units have already been issued'));

  // Request where transfusion was administered cannot be cancelled
  const requestWithTransfusion = {
    ...openRequestNoUnits,
    transfusions: [{ transfusion_id: 1, request_id: 10, unit_id: 5, unit_number: 'U-001', component: 'RedCells' }],
  };
  const cancelTransfused = canCancelBloodRequest(requestWithTransfusion);
  assert.equal(cancelTransfused.allowed, false);
  assert.ok(cancelTransfused.reason?.includes('Blood was already given'));

  // Already closed request cannot be closed or cancelled again
  const closedRequest = { ...openRequestNoUnits, status: 'Closed' };
  assert.equal(canCancelBloodRequest(closedRequest).allowed, false);
  assert.equal(canCloseBloodRequest(closedRequest).allowed, false);

  // Value list definitions
  assert.equal(BLOOD_COMPONENTS.length, 5);
  assert.equal(BLOOD_URGENCIES.length, 3);
});
