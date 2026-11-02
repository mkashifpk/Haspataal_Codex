import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrugRecallsCapabilityView,
  validateOpenRecallInput,
  validateRemoveStockInput,
  validateRecordContactInput,
  validateCloseRecallInput,
  validateCancelRecallInput,
  DRUG_RECALL_ERROR_MESSAGES,
  RECALL_SOURCES,
  RECALL_CLASSES,
  RECALL_STATUSES,
  PATIENT_CONTACT_OUTCOMES,
} from "../src/drug-recalls-policy.ts";

test("drug_recalls: capability view resolves based on establishment views.screens (Rule rule:0bdb1f574d)", () => {
  assert.equal(getDrugRecallsCapabilityView(null), "full");
  assert.equal(getDrugRecallsCapabilityView({}), "full");

  const estFull = { views: { screens: { drug_recalls: "full" } } };
  assert.equal(getDrugRecallsCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { drug_recalls: "open_work" } } };
  assert.equal(getDrugRecallsCapabilityView(estOpenWork), "open_work");

  const estOpenWorkArray = { views: { screens: [{ screen_id: "drug_recalls", view: "open_work" }] } };
  assert.equal(getDrugRecallsCapabilityView(estOpenWorkArray), "open_work");

  const estRecords = { views: { screens: { drug_recalls: "records" } } };
  assert.equal(getDrugRecallsCapabilityView(estRecords), "records");

  const estHidden = { views: { screens: { drug_recalls: "hidden" } } };
  assert.equal(getDrugRecallsCapabilityView(estHidden), "hidden");
});

test("drug_recalls: validateOpenRecallInput enforces Rule rule:fe2af7a43c", () => {
  // Missing drug ID
  const r1 = validateOpenRecallInput({
    drug_id: 0,
    all_batches: true,
    source: "DRAP",
    recall_class: "ClassI",
    reason: "Subpotent active ingredient reported",
  });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.drug_id, /valid formulary medicine/i);

  // Missing batches (neither all_batches nor batch_ids)
  const r2 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: false,
    batch_ids: [],
    source: "DRAP",
    recall_class: "ClassI",
    reason: "Subpotent active ingredient reported",
  });
  assert.equal(r2.valid, false);
  assert.match(r2.errors.batch_ids, /select specific batches/i);

  // Invalid source
  const r3 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: true,
    source: "UnknownSource",
    recall_class: "ClassI",
    reason: "Defective seal",
  });
  assert.equal(r3.valid, false);
  assert.match(r3.errors.source, /valid recall alert source/i);

  // Invalid recall class
  const r4 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: true,
    source: "DRAP",
    recall_class: "ClassX",
    reason: "Defective seal",
  });
  assert.equal(r4.valid, false);
  assert.match(r4.errors.recall_class, /statutory recall class/i);

  // Short reason
  const r5 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: true,
    source: "DRAP",
    recall_class: "ClassI",
    reason: "bad",
  });
  assert.equal(r5.valid, false);
  assert.match(r5.errors.reason, /at least 5 characters/i);

  // Valid with all_batches
  const r6 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: true,
    source: "DRAP",
    reference: "DRAP-AL-2026-900",
    recall_class: "ClassI",
    reason: "Particulate matter observed in ampoules",
    contact_patients: true,
  });
  assert.equal(r6.valid, true);
  assert.equal(Object.keys(r6.errors).length, 0);

  // Valid with specific batch_ids
  const r7 = validateOpenRecallInput({
    drug_id: 12,
    all_batches: false,
    batch_ids: [101, 102],
    source: "Manufacturer",
    recall_class: "ClassII",
    reason: "Packaging misprint on batch 101 and 102",
    contact_patients: false,
  });
  assert.equal(r7.valid, true);
});

test("drug_recalls: validateRemoveStockInput enforces disposal/return note under Rule rule:6e16f97bd1", () => {
  // Empty or short note
  const r1 = validateRemoveStockInput({ note: "" });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.note, /explanatory note/i);

  const r2 = validateRemoveStockInput({ note: "done" });
  assert.equal(r2.valid, false);

  // Valid note
  const r3 = validateRemoveStockInput({
    note: "Returned 45 units to supplier under return voucher RV-887 for full credit",
  });
  assert.equal(r3.valid, true);
});

test("drug_recalls: validateRecordContactInput enforces contact outcome and discussion note under Rule rule:6e16f97bd1", () => {
  // Invalid outcome
  const r1 = validateRecordContactInput({ outcome: "Pending", note: "Called twice" });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.outcome, /choose a contact outcome/i);

  // Empty note
  const r2 = validateRecordContactInput({ outcome: "Contacted", note: " " });
  assert.equal(r2.valid, false);
  assert.match(r2.errors.note, /record who was reached/i);

  // Valid contact
  const r3 = validateRecordContactInput({
    outcome: "Contacted",
    note: "Spoke with patient guardian. Advised to stop taking batch and return bottle to hospital pharmacy.",
  });
  assert.equal(r3.valid, true);

  // Valid unreachable
  const r4 = validateRecordContactInput({
    outcome: "Unreachable",
    note: "Cell phone switched off after 3 attempts on consecutive days.",
  });
  assert.equal(r4.valid, true);
});

test("drug_recalls: validateCloseRecallInput enforces Rule rule:2b020bd53b and RECALL_NOT_COMPLETE conditions", () => {
  const incompleteRecall = {
    recall_id: 1,
    status: "Open",
    can_close: false,
    stock_left: 14,
    patients_to_contact: 3,
  };

  // Attempting to close with remaining stock and uncontacted patients
  const r1 = validateCloseRecallInput(incompleteRecall, { note: "Attempting closure" });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.stock_left, /Cannot close: 14 units/i);
  assert.match(r1.errors.patients_to_contact, /Cannot close: 3 patients/i);

  // Attempting to close without closing note
  const readyRecall = {
    recall_id: 1,
    status: "Open",
    can_close: true,
    stock_left: 0,
    patients_to_contact: 0,
  };
  const r2 = validateCloseRecallInput(readyRecall, { note: "" });
  assert.equal(r2.valid, false);
  assert.match(r2.errors.note, /closing audit summary note/i);

  // Valid closure
  const r3 = validateCloseRecallInput(readyRecall, {
    note: "All quarantined stock destroyed per DRAP inspector order; all 12 recipients contacted and advised.",
  });
  assert.equal(r3.valid, true);
});

test("drug_recalls: validateCancelRecallInput enforces Rule rule:2b020bd53b", () => {
  const closedRecall = {
    recall_id: 1,
    status: "Closed",
  };

  // Cannot cancel a Closed recall
  const r1 = validateCancelRecallInput(closedRecall, { reason: "Opened mistakenly" });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.status, /Only an Open recall can be cancelled/i);

  // Cannot cancel without detailed reason
  const openRecall = {
    recall_id: 1,
    status: "Open",
  };
  const r2 = validateCancelRecallInput(openRecall, { reason: "oops" });
  assert.equal(r2.valid, false);
  assert.match(r2.errors.reason, /minimum 5 characters/i);

  // Valid cancellation
  const r3 = validateCancelRecallInput(openRecall, {
    reason: "Opened against wrong drug code due to clerical typo; batches verified normal and released.",
  });
  assert.equal(r3.valid, true);
});

test("drug_recalls: error messages dictionary covers all contract error codes", () => {
  const requiredCodes = [
    "BATCH_RECALLED",
    "FORBIDDEN",
    "NOT_FOUND",
    "RECALL_NOT_COMPLETE",
    "RECALL_STATE_INVALID",
    "REFERENCE_NOT_FOUND",
    "STOCK_BATCH_MISMATCH",
    "VALIDATION_ERROR",
  ];

  for (const code of requiredCodes) {
    assert.ok(DRUG_RECALL_ERROR_MESSAGES[code], `Missing error message for ${code}`);
    assert.ok(DRUG_RECALL_ERROR_MESSAGES[code].en, `Missing English text for ${code}`);
    assert.ok(DRUG_RECALL_ERROR_MESSAGES[code].ur, `Missing Urdu text for ${code}`);
  }
});
