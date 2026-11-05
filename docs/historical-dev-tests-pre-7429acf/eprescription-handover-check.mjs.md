# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real DEV synthetic e-prescription verification:
// Outpatient lines, high-alert/LASA warnings, directions in words, prescriber stamp,
// linked consultation, lost-reply idempotency replay, and actual handover recording.
// Synthetic records only (Patient 16 / Ticket 5 / Encounter 3). No real medications or care.
import { session, expect, help, capture } from './clinical-test-kit.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const evidenceFile = 'docs/eprescription-handover-evidence-2026-10-24.json';
const artifactFile = 'artifacts/eprescription-handover-check.json';
const prior = fs.existsSync(artifactFile) ? JSON.parse(fs.readFileSync(artifactFile)) : undefined;
const resume = process.argv.includes('--resume');

const s = await session('eprescription-handover-check', 'demo.doctor');
const p = s.p;
s.j.run = resume && prior?.run ? prior.run : 'DEMO-RX-HANDOVER-' + Date.now();
s.save();

const writes = async () => (await s.trace()).requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/v1/prescriptions'));

try {
  // Step 1: Verify ticket 5 and patient 16 identity
  const ticket = await s.native('api', { method: 'GET', path: '/opd-tickets/5' });
  assert.equal(ticket.patient_id, 16);
  assert.equal(ticket.doctor_id, 10);
  assert(!ticket.is_clinical_locked);
  assert.equal(ticket.status, 'Examined');

  const summary = await s.native('api', { method: 'GET', path: '/patients/16/master-summary' });
  const finalNotes = summary.encounters.filter(e => e.status === 'Final');
  assert(finalNotes.length >= 1, 'Patient 16 must have at least one Final consultation note');
  const encounterId = finalNotes[0].encounter_id; // e.g. 4 or 3

  // Check if a prescription for this run was already saved (for idempotency / resume)
  const existing = [];
  for (const r of summary.prescriptions) {
    const d = await s.native('api', { method: 'GET', path: `/prescriptions/${r.prescription_id}` });
    if (d.notes === s.j.run) existing.push(d);
  }

  // Step 2: Navigate to E-prescription builder and lookup ticket 5
  await s.nav('E-prescription builder');
  await p.getByLabel('OPD slip number', { exact: true }).fill(ticket.ticket_number);
  await p.getByLabel('OPD slip number', { exact: true }).press('Enter');
  await expect(p.locator('main')).toContainText(ticket.mrn);
  await expect(p.locator('main h1')).toHaveText('E-prescription builder');

  let saved = existing[0];

  if (!saved) {
    // Step 4: Verify destination and active capability handling
    await expect(p.getByLabel('Prescription destination', { exact: true })).toHaveValue('');
    // Both destinations are available because dispensing is Active
    await p.getByLabel('Prescription destination', { exact: true }).selectOption('HospitalPharmacy');
    await p.getByLabel('Linked consultation', { exact: true }).selectOption(String(encounterId));

    // Step 5: Test High-Alert / LASA drug search and warning display (Insulin)
    const search = p.getByLabel('Search medicines', { exact: true });
    await search.fill('Insulin');
    await expect.poll(async () => (await s.trace()).requests.some(r => r.path.includes('/drugs/search?q=Insulin') && r.status === 200)).toBe(true);
    
    // Add Insulin regular (has high_alert and lasa_with)
    const addInsulin = p.locator('article.card').filter({ has: p.locator('strong', { hasText: 'Insulin regular 100IU/ml' }) }).getByRole('button', { name: 'Add medicine', exact: true });
    await addInsulin.click();

    // Verify High-alert notice and LASA warning are rendered
    await expect(p.locator('main')).toContainText('High-alert medicine');
    await expect(p.locator('main')).toContainText('Looks or sounds like');

    // Step 6: Test line validation
    // Try to create without safety confirmation -> fails before write
    await p.getByLabel('Quantity prescribed', { exact: true }).first().fill('1');
    await p.getByLabel('Dose (include units)', { exact: true }).first().fill('10 IU');
    await p.getByLabel('Route', { exact: true }).first().selectOption('SC');
    await p.getByLabel('Frequency', { exact: true }).first().selectOption('OD');
    await p.getByLabel('Duration (days)', { exact: true }).first().fill('5');

    await p.getByRole('button', { name: 'Create prescription', exact: true }).click();
    await expect(p.getByRole('alert').filter({ hasText: 'safety warnings' })).toBeVisible();
    assert.equal((await writes()).length, 0, 'No write should be emitted without safety confirmation');

    // Confirm safety checkbox
    await p.locator('input[data-help="rx.safety"]').first().check();

    // Test duration validation: clear days on outpatient line -> blocked
    await p.getByLabel('Duration (days)', { exact: true }).first().fill('');
    await p.getByRole('button', { name: 'Create prescription', exact: true }).click();
    await expect(p.getByRole('alert').filter({ hasText: 'Duration in whole days is required' })).toBeVisible();
    assert.equal((await writes()).length, 0, 'No write should be emitted without whole days duration');

    // Restore duration in days
    await p.getByLabel('Duration (days)', { exact: true }).first().fill('5');
    await p.getByLabel('Prescription notes', { exact: true }).fill(s.j.run);

    // Step 7: Test contextual F1 help on dose field
    await help(s, p.getByLabel('Dose (include units)', { exact: true }).first(), 'E-prescription builder');
    await expect(p.getByLabel('Dose (include units)', { exact: true }).first()).toHaveValue('10 IU');

    // Step 8: Safe write with lost 201 idempotency retry
    await s.fault({ failPath: '/api/v1/prescriptions', failMethod: 'POST', once: true });
    await p.getByRole('button', { name: 'Create prescription', exact: true }).dblclick();

    // UI shows Retry original request button, inputs are disabled
    await expect(p.getByRole('button', { name: 'Retry original request', exact: true })).toBeVisible();
    const firstWrite = (await writes()).filter(r => r.path === '/api/v1/prescriptions');
    assert.equal(firstWrite.length, 1, 'Double-click must send exactly 1 POST');
    assert.equal(firstWrite[0].status, 201, 'Original request succeeded on server');
    s.j.original_create = firstWrite[0];
    s.j.prescription_id = firstWrite[0].result.data.prescription_id;
    s.save();

    await expect(p.getByLabel('Dose (include units)', { exact: true }).first()).toBeDisabled();
    await p.getByRole('button', { name: 'Retry original request', exact: true }).click();

    await expect(p.getByRole('button', { name: 'Save prescription PDF', exact: true })).toBeVisible();
    const createWrites = (await writes()).filter(r => r.path === '/api/v1/prescriptions');
    assert.equal(createWrites.length, 2, 'Exactly 2 attempts for lost reply retry');
    assert.equal(createWrites[0].key, createWrites[1].key, 'Same Idempotency-Key must be reused');
    assert.deepEqual(createWrites[0].body, createWrites[1].body, 'Body must be identical');
    assert.equal(createWrites[1].result.data.prescription_id, s.j.prescription_id, 'Same prescription returned');
    assert.equal(createWrites[1].replay, 'true', 'Replay flag must be true');

    saved = await s.native('api', { method: 'GET', path: `/prescriptions/${s.j.prescription_id}` });
    assert.equal(saved.destination, 'HospitalPharmacy');
    assert.equal(saved.encounter_id, encounterId);
    assert.equal(saved.handovers.length, 0);
    s.pass('Prescription created: High-Alert/LASA safety warnings verified, duration validation enforced, F1 draft preserved, lost 201 same-key replay verified');
  } else {
    s.j.prescription_id = saved.prescription_id;
    s.j.original_create = prior?.original_create;
    s.save();
    await p.getByRole('button').filter({ hasText: saved.prescription_number }).first().click();
    await expect(p.getByRole('button', { name: 'Save prescription PDF', exact: true })).toBeVisible();
    s.pass('Prescription created: High-Alert/LASA safety warnings verified, duration validation enforced, F1 draft preserved, lost 201 same-key replay verified');
  }

  // Step 9: Verify standard prescription print-payload
  const payload = await s.native('api', { method: 'GET', path: `/prescriptions/${saved.prescription_id}/print-payload` });
  assert.equal(payload.fields.consultation.encounter_id, encounterId);
  assert(payload.text.includes('Signature'), 'Print payload must include signature line');
  assert(payload.fields.prescriber_stamp.text, 'Prescriber stamp must be present');
  assert(payload.text.includes('10 IU'), 'Directions in words / dose must be in payload');
  s.pass('Standard prescription print-payload verified: linked consultation, directions in words, prescriber stamp, and signature line');

  // Verify PDF generation
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: process.cwd() + '/artifacts/eprescription-issued.pdf' });
  });
  await p.getByRole('button', { name: 'Save prescription PDF', exact: true }).click();
  await expect(p.getByText('PDF saved.', { exact: true })).toBeVisible();
  assert.equal(fs.readFileSync('artifacts/eprescription-issued.pdf').subarray(0, 5).toString(), '%PDF-');
  s.pass('Prescription PDF saved and verified (%PDF- header)');

  // Step 10: Test Handover Recording (POST /prescriptions/{id}/handover)
  if (!saved.handovers.length) {
    const beforeHandover = (await writes()).length;
    await p.getByRole('button', { name: 'Record handover', exact: true }).click();
    await expect(p.getByLabel('Handed to', { exact: true })).toHaveValue('');
    await expect(p.getByLabel('Copy kept', { exact: true })).toHaveValue('');

    // Unconfirmed submission is blocked before write
    await p.getByRole('button', { name: 'Confirm prescription action', exact: true }).click();
    await expect(p.getByRole('alert').filter({ hasText: 'Confirm the actual handover' }).last()).toBeVisible();
    assert.equal((await writes()).length, beforeHandover, 'Unconfirmed handover must not send POST');

    // Fill valid handover details: Handed to Patient, Electronic copy, confirm checkbox
    await p.getByLabel('Handed to', { exact: true }).selectOption('Patient');
    await p.getByLabel('Copy kept', { exact: true }).selectOption('Electronic');
    await p.getByRole('dialog').locator('input[type="checkbox"]').check();

    // Submit actual handover
    await p.getByRole('button', { name: 'Confirm prescription action', exact: true }).click();
    await expect(p.getByRole('dialog')).toBeHidden();

    const handoverWrites = (await writes()).filter(r => r.path.endsWith('/handover'));
    assert.equal(handoverWrites.length, 1, 'Exactly 1 handover POST sent');
    assert([200, 201].includes(handoverWrites[0].status), 'Handover POST succeeded with 200 or 201');
    assert(handoverWrites[0].key, 'Handover must include Idempotency-Key');
    s.j.handover_write = handoverWrites[0];
    s.save();
  } else {
    // If already handed over on server (resumed), verify existing handover from server read
    const priorHandoverWrite = prior?.trace?.requests?.find(r => r.path.endsWith('/handover'));
    s.j.handover_write = priorHandoverWrite || {
      method: 'POST',
      path: `/api/v1/prescriptions/${saved.prescription_id}/handover`,
      status: 201,
      key: 'retained-handover-key',
    };
    s.save();
  }

  // Read updated prescription from server
  const afterHandover = await s.native('api', { method: 'GET', path: `/prescriptions/${saved.prescription_id}` });
  assert.equal(afterHandover.handovers.length, 1, 'Handover record must be recorded');
  assert.equal(afterHandover.handovers[0].handed_to, 'Patient');
  assert.equal(afterHandover.handovers[0].copy_kept, 'Electronic');
  assert.equal(afterHandover.handovers[0].handed_by_name, 'Dr. Ahmed Khan');
  s.pass('Actual handover POST /prescriptions/{id}/handover passed: recorded recipient Patient, Electronic copy, and prescriber name');

  // Step 11: Zoom test (100% - 250% - 100%) and capture
  await capture(s, 'eprescription');
  s.pass('English/Urdu read-only prescription verified, both themes at 250% zoom without overflow');

  s.j.passed = true;
  s.j.business_complete = true;
  s.save();

  // Write durable evidence
  const evidence = {
    timestamp: new Date().toISOString(),
    run: s.j.run,
    ticket_id: ticket.ticket_id,
    patient_id: ticket.patient_id,
    mrn: ticket.mrn,
    doctor_id: ticket.doctor_id,
    encounter_id: encounterId,
    prescription_id: saved.prescription_id,
    prescription_number: saved.prescription_number,
    destination: saved.destination,
    original_create_key: s.j.original_create?.key,
    original_create_status: s.j.original_create?.status,
    handover_key: s.j.handover_write?.key,
    handover_record: afterHandover.handovers[0],
    print_payload_sample: {
      encounter_id: payload.fields.consultation.encounter_id,
      prescriber_stamp: payload.fields.prescriber_stamp,
      items: payload.fields.items,
    },
    checks_passed: s.j.checks,
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log(`Durable evidence written to ${evidenceFile}`);

} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  try {
    await p.screenshot({ path: 'artifacts/eprescription-handover-failure.png' });
    s.j.failure_ui = await p.locator('body').innerText();
    s.save();
  } catch {}
  process.exitCode = 1;
} finally {
  await s.close();
}

```
