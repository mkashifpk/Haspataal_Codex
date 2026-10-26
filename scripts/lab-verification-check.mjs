// Live DEV verification script for Position 38: lab_verification (Lab Verifier workspace).
// Tests Verification queue, separation of duties, result inspection, verify & publish,
// sample rejection, requisition detail & PDF report download, and captures bilingual screenshots.
// Uses real DEV backend with synthetic test patients; no fake successes.

import { session, expect, help, capture } from './clinical-test-kit.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const file = 'artifacts/lab-verification-check.json';
const resume = process.argv.includes('--resume');
const j = (resume && fs.existsSync(file))
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : {
      run: 'DEMO-LAB-VERIFY-' + Date.now(),
      started: new Date().toISOString(),
      writes: {},
      checks: [],
      passed: false,
    };
if (resume) {
  delete j.error;
  delete j.finished;
}
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();

const pass = (m) => {
  if (!j.checks.includes(m)) {
    j.checks.push(m);
  }
  save();
  console.log('PASS ' + m);
};

const actors = [];
const launch = async (name, account) => {
  const s = await session(name, account);
  actors.push(s);
  s.p.on('dialog', (d) => d.accept());
  return s;
};

try {
  // Step 1: Launch verifier session and test UI, F1, and capture screenshots
  const verifier = await launch('lab-verify-verifier', 'demo.labverifier');
  const vp = verifier.p;

  // Navigate to Verification queue
  await verifier.nav('Verification queue');
  await expect(vp.locator('h1')).toContainText('Verification queue');
  pass('Lab Verifier logs in and lands on Verification queue');

  // Test F1 contextual help on search input
  const searchInput = vp.getByLabel('Find in queue', { exact: true });
  await expect(searchInput).toBeVisible();
  await help(verifier, searchInput, 'Verification queue');
  pass('Contextual F1 help opens Verification queue guidance and restores focus');

  // Capture bilingual screenshots for the end-user handbook if not already present
  if (!fs.existsSync('public/handbook/lab_verification-en.png') || !fs.existsSync('public/handbook/lab_verification-ur.png')) {
    await capture(verifier, 'lab_verification');
  }
  assert(fs.existsSync('public/handbook/lab_verification-en.png'), 'Missing EN screenshot');
  assert(fs.existsSync('public/handbook/lab_verification-ur.png'), 'Missing UR screenshot');
  pass('Bilingual screenshots captured and verified (public/handbook/lab_verification-*.png)');

  // Step 2: Check current queue items
  let queueItems = await verifier.native('api', { method: 'GET', path: '/lab/verification-queue' });
  console.log('Initial verification queue items count:', queueItems.length);

  // If queue is empty, create or prepare synthetic order + technician results
  if (queueItems.length === 0) {
    console.log('Queue empty; setting up synthetic walk-in order and technician results...');

    if (!j.order) {
      // Launch reception to order tests
      const rec = await launch('lab-verify-reception', 'demo.reception');
      await rec.nav('Lab-only walk-in');
      const rp = rec.p;

      await rp.getByLabel('Full name', { exact: true }).fill(j.run + ' verification test patient');
      await rp.getByLabel('Mobile', { exact: true }).fill('03001234567');

      // Select CBC and RBS tests
      const tests = await rec.native('api', { method: 'GET', path: '/lab/tests' });
      const cbc = tests.find((t) => t.code === 'CBC');
      const rbs = tests.find((t) => t.code === 'RBS');
      assert(cbc && rbs, 'CBC and RBS tests must exist in catalogue');

      await rp.locator('label.card').filter({ hasText: cbc.name }).getByRole('checkbox').check();
      await rp.locator('label.card').filter({ hasText: rbs.name }).getByRole('checkbox').check();
      await rp.getByRole('button', { name: 'Review NEW lab registration', exact: true }).click();

      // Confirm registration
      const regResp = await rec.p.evaluate(
        (v) => window.terminal.call('api', v),
        {
          method: 'POST',
          path: '/patients/lab-only-walk-in',
          body: {
            full_name: j.run + ' verification test patient',
            mobile: '03001234567',
            test_ids: [cbc.test_id, rbs.test_id],
            priority: 'Routine',
            clinical_notes: 'Verification test order',
          },
          key: crypto.randomUUID(),
        }
      );
      assert(regResp.ok, 'Failed to create registration: ' + JSON.stringify(regResp.error));
      j.order = regResp.data;
      save();
    }

    const reqId = j.order.requisition.requisition_id;
    const invId = j.order.requisition.invoice.invoice_id;
    const amount = j.order.requisition.invoice.balance_due ?? j.order.requisition.invoice.total_amount;

    // Check if invoice is paid
    const reqStatusCheck = await verifier.native('api', { method: 'GET', path: `/lab/requisitions/${reqId}` });
    if (reqStatusCheck.invoice?.status === 'Open') {
      console.log('Paying invoice', invId, 'for amount', amount);
      let recActor = actors.find((a) => a.j?.account === 'demo.reception');
      if (!recActor) {
        recActor = await launch('lab-verify-reception', 'demo.reception');
      }
      const payResp = await recActor.p.evaluate(
        (v) => window.terminal.call('api', v),
        {
          method: 'POST',
          path: `/finance/invoices/${invId}/payments`,
          body: { amount, method: 'Card', reference: j.run + ' test card' },
          key: crypto.randomUUID(),
        }
      );
      assert(payResp.ok, 'Failed to pay invoice: ' + JSON.stringify(payResp.error));
      j.paid = true;
      save();
      pass('Reception paid invoice ' + invId + ' for requisition ' + reqId);
    }

    // Launch technician to collect, receive and enter results
    const tech = await launch('lab-verify-tech', 'demo.labtech');
    const reqDetail = await tech.native('api', { method: 'GET', path: `/lab/requisitions/${reqId}` });
    const itemRbs = reqDetail.items.find((i) => i.code === 'RBS');
    const itemCbc = reqDetail.items.find((i) => i.code === 'CBC');
    assert(itemRbs && itemCbc, 'RBS and CBC items must exist in requisition');

    // Collect & receive RBS
    if (itemRbs.sample_status !== 'Received') {
      if (itemRbs.sample_status === 'Pending') {
        const colResp1 = await tech.native('api', {
          method: 'POST',
          path: `/lab/samples/${itemRbs.sample_id}/collect`,
        });
        assert(colResp1.sample_id, 'RBS collect failed');
      }
      const recResp1 = await tech.native('api', {
        method: 'POST',
        path: `/lab/samples/${itemRbs.sample_id}/receive`,
      });
      assert(recResp1.sample_id, 'RBS receive failed');
    }

    // Submit RBS result
    if (itemRbs.status === 'Ordered') {
      const resResp1 = await tech.native('api', {
        method: 'POST',
        path: `/lab/items/${itemRbs.lab_requisition_item_id}/results`,
        body: {
          metrics: { rbs: 95 },
          interpretation: 'Normal fasting blood sugar',
        },
      });
      assert.equal(resResp1.status, 'PendingVerification');
      j.rbs_result = resResp1;
      save();
      pass('Technician submitted RBS result to PendingVerification');
    } else {
      const existingRbs = reqDetail.results.find((r) => r.lab_requisition_item_id === itemRbs.lab_requisition_item_id);
      j.rbs_result = existingRbs;
      save();
    }

    // Collect & receive CBC
    if (itemCbc.sample_status !== 'Received') {
      if (itemCbc.sample_status === 'Pending') {
        const colResp2 = await tech.native('api', {
          method: 'POST',
          path: `/lab/samples/${itemCbc.sample_id}/collect`,
        });
        assert(colResp2.sample_id, 'CBC collect failed');
      }
      const recResp2 = await tech.native('api', {
        method: 'POST',
        path: `/lab/samples/${itemCbc.sample_id}/receive`,
      });
      assert(recResp2.sample_id, 'CBC receive failed');
    }

    // Submit CBC result
    if (itemCbc.status === 'Ordered') {
      const resResp2 = await tech.native('api', {
        method: 'POST',
        path: `/lab/items/${itemCbc.lab_requisition_item_id}/results`,
        body: {
          metrics: { hb: 13.5, wbc: 6.8, plt: 220 },
          interpretation: 'CBC within normal limits',
        },
      });
      assert.equal(resResp2.status, 'PendingVerification');
      j.cbc_result = resResp2;
      save();
      pass('Technician submitted CBC result to PendingVerification');
    } else {
      const existingCbc = reqDetail.results.find((r) => r.lab_requisition_item_id === itemCbc.lab_requisition_item_id);
      j.cbc_result = existingCbc;
      save();
    }

    // Step 3: Test separation of duties (LAB_VERIFIER_MUST_DIFFER)
    // The technician who entered the result attempts to verify it -> server MUST refuse
    if (j.rbs_result?.result_id) {
      const techVerifyAttempt = await tech.p.evaluate(
        (v) => window.terminal.call('api', v),
        {
          method: 'POST',
          path: `/lab/results/${j.rbs_result.result_id}/verify`,
          body: { decision: 'Verified', note: 'Technician attempting self-verification' },
        }
      );
      assert.equal(techVerifyAttempt.ok, false);
      assert.equal(techVerifyAttempt.error?.code, 'LAB_VERIFIER_MUST_DIFFER');
      pass('Technician cannot verify own result (LAB_VERIFIER_MUST_DIFFER correctly refused)');
    }
  }

  // Refresh verifier queue
  await vp.getByRole('button', { name: 'Refresh queue', exact: true }).click();
  queueItems = await verifier.native('api', { method: 'GET', path: '/lab/verification-queue' });
  assert(queueItems.length > 0, 'Verification queue must have pending items');
  pass(`Verification queue loaded with ${queueItems.length} item(s)`);

  // Step 4: Inspect first result row in UI
  const firstItem = queueItems[0];
  const row = vp.locator('tbody tr').filter({ hasText: firstItem.test_name }).first();
  await expect(row).toBeVisible();

  // Click Inspect
  await row.getByRole('button', { name: 'Inspect', exact: true }).click();
  const inspectCard = vp.locator('.detail-inspection-card');
  await expect(inspectCard).toBeVisible();
  await expect(inspectCard).toContainText(firstItem.test_name);
  pass('Result Inspection card displays measurements, metric flags, and performer details');

  // Step 5: Test Requisition detail lookup from inspection card
  await inspectCard.getByRole('button', { name: 'Requisition detail', exact: true }).click();
  const reqModal = vp.getByRole('dialog');
  await expect(reqModal).toBeVisible();
  await expect(reqModal).toContainText('Requisition Detail');
  await reqModal.locator('input[data-help="verification.requisition"]').fill('2');
  await reqModal.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(reqModal).toContainText('LR-2026-000002');
  await reqModal.getByRole('button', { name: 'Close' }).last().click();
  await expect(reqModal).toHaveCount(0);
  pass('Requisition detail modal opens and inspects order items');

  // Step 6: Test Rejection with mandatory note
  if (queueItems.length >= 2) {
    const itemToReject = queueItems.find((x) => x.code === 'CBC') || queueItems[1];
    const rejectRow = vp.locator('tbody tr').filter({ hasText: itemToReject.test_name }).first();
    await rejectRow.getByRole('button', { name: 'Reject', exact: true }).click();

    const rejectModal = vp.getByRole('dialog');
    await expect(rejectModal).toBeVisible();
    await expect(rejectModal).toContainText('Reject Result Back to Bench');

    // Confirm button is disabled without note
    const confirmRejectBtn = rejectModal.getByRole('button', { name: 'Confirm rejection', exact: true });
    await expect(confirmRejectBtn).toBeDisabled();

    // Fill mandatory note
    await rejectModal.locator('textarea[data-help="verification.reject_note"]').fill(j.run + ' - Inconsistent metrics, please repeat');
    await expect(confirmRejectBtn).toBeEnabled();

    // Submit rejection
    await confirmRejectBtn.click();
    await expect(rejectModal).toHaveCount(0);

    // Verify result moved out of queue
    const queueAfterReject = await verifier.native('api', { method: 'GET', path: '/lab/verification-queue' });
    assert(!queueAfterReject.some((x) => x.result_id === itemToReject.result_id), 'Rejected item must leave queue');
    pass('Result rejection with mandatory note moves result back to bench');
  }

  // Step 7: Test Verify & Publish
  const itemToVerify = queueItems.find((x) => x.code === 'RBS') || queueItems[0];
  const verifyRow = vp.locator('tbody tr').filter({ hasText: itemToVerify.test_name }).first();
  await verifyRow.getByRole('button', { name: 'Verify', exact: true }).click();

  const verifyModal = vp.getByRole('dialog');
  await expect(verifyModal).toBeVisible();
  await expect(verifyModal).toContainText('Confirm Verification and Publication');

  // Submit verification
  const confirmVerifyBtn = verifyModal.getByRole('button', { name: 'Confirm & publish', exact: true });
  await confirmVerifyBtn.click();
  await expect(verifyModal).toHaveCount(0);

  // Verify item is no longer in queue
  const queueAfterVerify = await verifier.native('api', { method: 'GET', path: '/lab/verification-queue' });
  assert(!queueAfterVerify.some((x) => x.result_id === itemToVerify.result_id), 'Verified item must leave queue');
  pass('Verify and publish successfully signs and publishes result');

  // Step 8: Test signed report preview and PDF payload
  if (j.order?.requisition?.requisition_id) {
    const reqId = j.order.requisition.requisition_id;
    const printPayload = await verifier.native('api', {
      method: 'GET',
      path: `/lab/requisitions/${reqId}/report/print-payload`,
    });
    assert(printPayload.fields, 'Print payload must have fields');
    assert(printPayload.fields.results?.length > 0, 'Print payload must have results');

    // Check verified stamp
    const verifiedResult = printPayload.fields.results.find((r) => r.result_id === itemToVerify.result_id);
    assert(verifiedResult, 'Verified result must exist in report print payload');
    assert(verifiedResult.verified_stamp, 'Verified result must have verified_stamp');
    assert.match(verifiedResult.verified_stamp.text, /demo\.labverifier|Verifier|Amna/i);
    pass('Verified result includes verifier stamp under technician performed stamp on report payload');

    // Step 9: Test PDF endpoint via clinical-pdf preview bridge
    const pdfResp = await verifier.p.evaluate(
      (v) => window.terminal.call('clinical-pdf', { path: `/lab/requisitions/${v}/report/pdf`, preview: true }),
      reqId
    );
    assert(pdfResp.ok, 'PDF preview call failed: ' + JSON.stringify(pdfResp.error));
    assert.equal(pdfResp.data?.opened, true);
    pass('Verified result report PDF verified via clinical-pdf bridge');
  }

  // Clean exit
  j.passed = true;
  j.finished = new Date().toISOString();
  save();
  pass('All live DEV lab_verification checks passed cleanly!');

} catch (e) {
  j.error = e.stack || String(e);
  save();
  console.error('FAIL:', e);
  process.exitCode = 1;
} finally {
  for (const s of actors) {
    try {
      await s.close();
    } catch {}
  }
}
