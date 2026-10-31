import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateWardIndentView,
  canCreateIndent,
  canRemoveStock,
  canViewInventory,
  canViewIndent,
  canSearchDrugs,
  validateStockRemovalInput,
  validateIndentDraft,
  inspectInventoryBatch,
  explainIndentError,
} from "../src/ward-indent-policy.ts";

test("ward_indent view evaluation and service capability rules (rule:af4d84840c)", () => {
  // full view
  const full = evaluateWardIndentView({ ward_indent: { view: "full" } });
  assert.equal(full.view, "full");
  assert.equal(full.canCreateNewIndent, true);
  assert.equal(full.canRemoveStock, true);
  assert.equal(full.canViewRecords, true);
  assert.equal(full.bannerMessage, null);

  // open_work (retiring service)
  const openWork = evaluateWardIndentView({ ward_indent: { view: "open_work" } });
  assert.equal(openWork.view, "open_work");
  assert.equal(openWork.canCreateNewIndent, false);
  assert.equal(openWork.canRemoveStock, true);
  assert.equal(openWork.canViewRecords, true);
  assert.ok(openWork.bannerMessage && openWork.bannerMessage.includes("No new patient supply indents from now on"));

  // records view (retired service)
  const records = evaluateWardIndentView({ ward_indent: { view: "records" } });
  assert.equal(records.view, "records");
  assert.equal(records.canCreateNewIndent, false);
  assert.equal(records.canRemoveStock, false);
  assert.equal(records.canViewRecords, true);
  assert.ok(records.bannerMessage && records.bannerMessage.includes("read-only"));
});

test("role permissions gating for ward_indent operations", () => {
  const headNurse = { permissions: ["ward.indent.create", "ward.inventory.view", "pharmacy.formulary.view"] };
  const wardNurse = { permissions: ["ward.inventory.view", "pharmacy.formulary.view"] };
  const pharmacyAdmin = { permissions: ["approval.ward_indent.approve", "pharmacy.stock.adjust", "pharmacy.formulary.view"] };
  const admissions = { permissions: ["ipd.admission.view"] };

  assert.equal(canCreateIndent(headNurse), true);
  assert.equal(canCreateIndent(wardNurse), false);
  assert.equal(canCreateIndent(pharmacyAdmin), false);

  assert.equal(canRemoveStock(headNurse), true);
  assert.equal(canRemoveStock(pharmacyAdmin), true);
  assert.equal(canRemoveStock(wardNurse), false);

  assert.equal(canViewInventory(headNurse), true);
  assert.equal(canViewInventory(wardNurse), true);
  assert.equal(canViewInventory(admissions), false);

  assert.equal(canViewIndent(headNurse), true);
  assert.equal(canViewIndent(pharmacyAdmin), true);
  assert.equal(canViewIndent(admissions), false);

  assert.equal(canSearchDrugs(headNurse), true);
  assert.equal(canSearchDrugs(admissions), false);
});

test("inventory batch safety inspection for expired and recalled stock (rule:6c0ce3ff85, MSDS 59, 60)", () => {
  const expiredStock = {
    drug_id: 1,
    drug_name: "Amoxicillin 500mg",
    batch_id: 101,
    batch_no: "AMX-2024",
    expiry_date: "2024-01-01",
    qty: 15,
    updated_at: "2026-10-01T00:00:00Z",
    is_expired: true,
    is_recalled: false,
  };
  const inspExpired = inspectInventoryBatch(expiredStock);
  assert.equal(inspExpired.isCritical, true);
  assert.equal(inspExpired.badgeClass, "badge-danger");
  assert.equal(inspExpired.suggestedAction, "Expiry");
  assert.ok(inspExpired.clinicalInstruction.includes("EXPIRED"));

  const recalledStock = {
    drug_id: 2,
    drug_name: "Gentamicin IV 80mg",
    batch_id: 102,
    batch_no: "GEN-RECALL",
    expiry_date: "2028-01-01",
    qty: 5,
    updated_at: "2026-10-01T00:00:00Z",
    is_expired: false,
    is_recalled: true,
  };
  const inspRecalled = inspectInventoryBatch(recalledStock);
  assert.equal(inspRecalled.isCritical, true);
  assert.equal(inspRecalled.badgeClass, "badge-danger");
  assert.equal(inspRecalled.suggestedAction, "ReturnToPharmacy");
  assert.ok(inspRecalled.clinicalInstruction.includes("CRITICAL"));

  const normalStock = {
    drug_id: 3,
    drug_name: "Paracetamol 1g IV",
    batch_id: 103,
    batch_no: "PCM-OK",
    expiry_date: "2029-01-01",
    qty: 40,
    updated_at: "2026-10-01T00:00:00Z",
    is_expired: false,
    is_recalled: false,
  };
  const inspNormal = inspectInventoryBatch(normalStock);
  assert.equal(inspNormal.isCritical, false);
  assert.equal(inspNormal.badgeClass, "badge-success");
  assert.equal(inspNormal.suggestedAction, null);
});

test("validateStockRemovalInput validates removal reason, quantities, and notes", () => {
  // Invalid empty input
  const invalid = validateStockRemovalInput({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.batch_id);
  assert.ok(invalid.errors.qty);
  assert.ok(invalid.errors.reason);
  assert.ok(invalid.errors.note);

  // Exceeding batch quantity
  const overQty = validateStockRemovalInput({
    batch_id: 12,
    qty: 25,
    max_qty: 10,
    reason: "Expiry",
    note: "Batch expired and destroyed according to policy",
  });
  assert.equal(overQty.valid, false);
  assert.ok(overQty.errors.qty && overQty.errors.qty.includes("exceed"));

  // Valid write-off
  const valid = validateStockRemovalInput({
    batch_id: 12,
    qty: 5,
    max_qty: 10,
    reason: "Expiry",
    note: "Batch expired and destroyed according to policy",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test("validateIndentDraft validates medicines list, positive quantities, and ward", () => {
  // Empty items
  const empty = validateIndentDraft({
    ward_id: 1,
    items: [],
  });
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.items);

  // Invalid item qty
  const badQty = validateIndentDraft({
    ward_id: 1,
    items: [
      { drug_id: 5, drug_name: "Ceftriaxone 1g", qty: 0 },
    ],
  });
  assert.equal(badQty.valid, false);
  assert.ok(badQty.errors["items[0].qty"]);

  // Valid indent draft
  const valid = validateIndentDraft({
    ward_id: 2,
    items: [
      { drug_id: 5, drug_name: "Ceftriaxone 1g", qty: 10 },
      { drug_id: 8, drug_name: "Ringer Lactate 500ml", qty: 20 },
    ],
    note: "Routine weekly ward supply top-up",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test("explainIndentError provides clear clinical and operational instructions", () => {
  const expired = explainIndentError("BATCH_EXPIRED");
  assert.ok(expired.actionGuidance.includes("write-off action"));

  const recalled = explainIndentError("BATCH_RECALLED");
  assert.ok(recalled.actionGuidance.includes("central pharmacy"));

  const stock = explainIndentError("INSUFFICIENT_STOCK");
  assert.ok(stock.actionGuidance.includes("Reloading live ward stock"));
});
