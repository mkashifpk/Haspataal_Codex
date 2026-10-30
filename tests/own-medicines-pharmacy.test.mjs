import test from "node:test";
import assert from "node:assert/strict";
import {
  pharmacyOwnMedicinesAccess,
  validateIdentifyInput,
  canIdentifyMedicine,
  formatStockBadge,
} from "../src/own-medicines-pharmacy-policy.ts";

test("pharmacy own medicines access gating respects permissions and establishment views", () => {
  // Hidden view denies all
  const hiddenAccess = pharmacyOwnMedicinesAccess(["patient.own_medicine.identify"], "hidden");
  assert.equal(hiddenAccess.isDenied, true);
  assert.equal(hiddenAccess.canIdentify, false);

  // Setup view denies all
  const setupAccess = pharmacyOwnMedicinesAccess(["patient.own_medicine.identify"], "setup");
  assert.equal(setupAccess.isDenied, true);

  // Pharmacist with full view has all capabilities
  const pharmaAccess = pharmacyOwnMedicinesAccess(
    ["patient.own_medicine.identify", "medication.safety.view", "pharmacy.formulary.view"],
    "full",
    ["pharmacist"]
  );
  assert.equal(pharmaAccess.isDenied, false);
  assert.equal(pharmaAccess.canViewWorklist, true);
  assert.equal(pharmaAccess.canListOwn, true);
  assert.equal(pharmaAccess.canIdentify, true);
  assert.equal(pharmaAccess.canSearchFormulary, true);

  // Records only mode denies identification writes and worklist queue
  const recordsAccess = pharmacyOwnMedicinesAccess(
    ["patient.own_medicine.identify", "medication.safety.view"],
    "records"
  );
  assert.equal(recordsAccess.isRecordsOnly, true);
  assert.equal(recordsAccess.canIdentify, false);
  assert.equal(recordsAccess.canViewWorklist, false);
  assert.equal(recordsAccess.canListOwn, true);

  // Retiring (open_work) mode flags retiring banner
  const retiringAccess = pharmacyOwnMedicinesAccess(
    ["patient.own_medicine.identify", "medication.safety.view"],
    "open_work"
  );
  assert.equal(retiringAccess.isRetiring, true);
  assert.equal(retiringAccess.canIdentify, true);
});

test("validation enforces status, formulary drug requirement, notes length, and storage location", () => {
  // Invalid status
  const invalidStatus = validateIdentifyInput("UnknownStatus", 10, null, "Pharmacy");
  assert.equal(invalidStatus.valid, false);
  assert.ok(invalidStatus.errors.identification);

  // Identified requires drug_id
  const missingDrug = validateIdentifyInput("Identified", null, "Valid note", "Pharmacy");
  assert.equal(missingDrug.valid, false);
  assert.ok(missingDrug.errors.drug_id);

  // Identified with valid drug_id passes
  const validIdentified = validateIdentifyInput("Identified", 42, "Pack intact", "Pharmacy");
  assert.equal(validIdentified.valid, true);

  // NotIdentifiable does not require drug_id
  const validUnidentified = validateIdentifyInput("NotIdentifiable", null, "Unlabelled brown bottle", "Ward");
  assert.equal(validUnidentified.valid, true);

  // Expired does not require drug_id
  const validExpired = validateIdentifyInput("Expired", null, "Batch exp 2024", "Pharmacy");
  assert.equal(validExpired.valid, true);

  // Damaged does not require drug_id
  const validDamaged = validateIdentifyInput("Damaged", null, "Crushed blister pack", "Ward");
  assert.equal(validDamaged.valid, true);

  // Note exceeding 500 chars fails
  const longNote = "A".repeat(501);
  const noteFail = validateIdentifyInput("Damaged", null, longNote, "Ward");
  assert.equal(noteFail.valid, false);
  assert.ok(noteFail.errors.note);

  // Invalid stored_at fails
  const invalidStorage = validateIdentifyInput("Expired", null, null, "HomeCupboard");
  assert.equal(invalidStorage.valid, false);
  assert.ok(invalidStorage.errors.stored_at);
});

test("canIdentifyMedicine enforces one-time identification and Received state transition (rule:dfd5ef5981)", () => {
  // Received pack awaiting identification can be identified
  const pendingPack = {
    own_medicine_id: 1,
    admission_id: 1,
    patient_id: 2,
    medicine_name: "Metformin",
    strength: "500 mg",
    form: null,
    quantity: "10 tabs",
    batch_no: null,
    expiry_date: "2027-12-31",
    is_expired: false,
    brought_by: "Son",
    stored_at: "Ward",
    status: "Received",
    received_by: 7,
    received_by_name: "Nurse",
    received_at: "2026-10-30T10:00:00Z",
    drug_id: null,
    drug_name: null,
    identification: null,
    identification_note: null,
    identified_by: null,
    identified_by_name: null,
    identified_at: null,
    handed_to: null,
    handed_by: null,
    handed_by_name: null,
    handed_at: null,
    destroy_reason: null,
    destroy_witness: null,
    destroyed_by: null,
    destroyed_by_name: null,
    destroyed_at: null,
    row_version: 1,
  };
  assert.equal(canIdentifyMedicine(pendingPack).allowed, true);

  // Pack already Retained cannot be re-identified
  const retainedPack = {
    ...pendingPack,
    status: "Retained",
    identification: "Identified",
    drug_id: 12,
  };
  const retainedCheck = canIdentifyMedicine(retainedPack);
  assert.equal(retainedCheck.allowed, false);
  assert.match(retainedCheck.reason, /OWN_MEDICINE_STATE_INVALID/);

  // Pack already Returned cannot be identified
  const returnedPack = {
    ...pendingPack,
    status: "Returned",
  };
  assert.equal(canIdentifyMedicine(returnedPack).allowed, false);

  // Pack already Destroyed cannot be identified
  const destroyedPack = {
    ...pendingPack,
    status: "Destroyed",
  };
  assert.equal(canIdentifyMedicine(destroyedPack).allowed, false);
});

test("stock and warning badges correctly evaluate inventory state", () => {
  const inStock = formatStockBadge({
    drug_id: 1,
    code: "PAR500",
    name: "Paracetamol",
    generic_name: null,
    strength: "500 mg",
    form: "Tablet",
    unit: "tab",
    schedule: "OTC",
    is_otc_allowed: true,
    barcode: null,
    low_stock_threshold: 10,
    is_active: true,
    high_alert_category: null,
    is_restricted: false,
    lasa_with: [],
    qty_available: 50,
    next_expiry: null,
    stock_status: "InStock",
  });
  assert.equal(inStock.tone, "positive");
  assert.match(inStock.label, /In Stock/);

  const outOfStock = formatStockBadge({
    drug_id: 2,
    code: "AMX500",
    name: "Amoxicillin",
    generic_name: null,
    strength: "500 mg",
    form: "Capsule",
    unit: "cap",
    schedule: "ScheduleH",
    is_otc_allowed: false,
    barcode: null,
    low_stock_threshold: 10,
    is_active: true,
    high_alert_category: null,
    is_restricted: false,
    lasa_with: [],
    qty_available: 0,
    stock_status: "OutOfStock",
    next_expiry: null,
  });
  assert.equal(outOfStock.tone, "danger");
  assert.match(outOfStock.label, /Out of Stock/);
});
