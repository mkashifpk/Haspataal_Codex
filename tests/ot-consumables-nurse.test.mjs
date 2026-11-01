import test from "node:test";
import assert from "node:assert/strict";

import {
  getOtConsumablesScreenView,
  canViewBookings,
  canRecordConsumables,
  isSurgeryActive,
  validateConsumableScan,
  validateReversalReason,
  canReverseConsumable,
  explainConsumablesError,
} from "../src/ot-consumables-nurse-policy.ts";

test("ot_consumables_nurse: getOtConsumablesScreenView evaluates runtime service capability views (Rule 77e2100829)", () => {
  assert.equal(getOtConsumablesScreenView(null), "full");

  // 1. Explicit server view
  const estExplicit = {
    views: {
      screens: [{ screen_id: "ot_consumables_nurse", view: "open_work" }],
    },
  };
  assert.equal(getOtConsumablesScreenView(estExplicit), "open_work");

  // 2. Capability state evaluation
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getOtConsumablesScreenView(estRetiring), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getOtConsumablesScreenView(estRetired), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getOtConsumablesScreenView(estPreparing), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getOtConsumablesScreenView(estAvailable), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getOtConsumablesScreenView(estNoSurgery), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getOtConsumablesScreenView(estWithSurgery), "full");
});

test("ot_consumables_nurse: canViewBookings and canRecordConsumables permission gates", () => {
  assert.equal(canViewBookings(null), false);
  assert.equal(canRecordConsumables(null), false);

  // OT Nurse has both view and record
  const otNurse = { roles: ["ot_nurse"], permissions: [] };
  assert.equal(canViewBookings(otNurse), true);
  assert.equal(canRecordConsumables(otNurse), true);

  // OT Admin has both view and record
  const otAdmin = { roles: ["ot_admin"], permissions: [] };
  assert.equal(canViewBookings(otAdmin), true);
  assert.equal(canRecordConsumables(otAdmin), true);

  // Surgeon can view bookings but cannot record consumables without permission
  const surgeon = { roles: ["surgeon"], permissions: ["ot.booking.view"] };
  assert.equal(canViewBookings(surgeon), true);
  assert.equal(canRecordConsumables(surgeon), false);

  // Explicit permission ot.consumable.record
  const userWithPerm = { roles: ["staff"], permissions: ["ot.consumable.record"] };
  assert.equal(canRecordConsumables(userWithPerm), true);

  // Cashier or Accountant denied
  const cashier = { roles: ["cashier"], permissions: [] };
  assert.equal(canViewBookings(cashier), false);
  assert.equal(canRecordConsumables(cashier), false);
});

test("ot_consumables_nurse: isSurgeryActive checks operative state", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive("InProgress"), true);
  assert.equal(isSurgeryActive("Scheduled"), true);
  assert.equal(isSurgeryActive("Cleaning"), true);
  assert.equal(isSurgeryActive("EmergencyHold"), true);
  assert.equal(isSurgeryActive("Completed"), false);
  assert.equal(isSurgeryActive("Cancelled"), false);
});

test("ot_consumables_nurse: validateConsumableScan enforces positive quantity and item reference", () => {
  // Empty
  assert.equal(validateConsumableScan(null).valid, false);

  // Missing quantity or non-positive
  assert.equal(validateConsumableScan({ barcode: "12345", qty: 0 }).valid, false);
  assert.equal(validateConsumableScan({ barcode: "12345", qty: -2 }).valid, false);
  assert.equal(validateConsumableScan({ barcode: "12345", qty: "abc" }).valid, false);

  // Missing all item references
  assert.equal(validateConsumableScan({ qty: 1 }).valid, false);
  assert.equal(validateConsumableScan({ barcode: "", qty: 1 }).valid, false);

  // Valid barcode
  assert.equal(validateConsumableScan({ barcode: "BC-9876", qty: 2 }).valid, true);

  // Valid drug_id
  assert.equal(validateConsumableScan({ drug_id: 42, qty: 1 }).valid, true);

  // Valid description (vendor implant)
  assert.equal(
    validateConsumableScan({ description: "Titanium mesh 5x5cm", qty: 1, unit_cost: 15000, unit_retail: 22000 }).valid,
    true
  );

  // Valid asset_id
  assert.equal(validateConsumableScan({ asset_id: 101, qty: 1 }).valid, true);
});

test("ot_consumables_nurse: validateReversalReason enforces Rule 0a80234be9", () => {
  // Null / empty
  assert.equal(validateReversalReason(null).valid, false);
  assert.equal(validateReversalReason({ reason: "" }).valid, false);
  assert.equal(validateReversalReason({ reason: "  " }).valid, false);

  // Less than 3 chars
  assert.equal(validateReversalReason({ reason: "ab" }).valid, false);

  // Valid reason
  assert.equal(validateReversalReason({ reason: "Scanned wrong tray barcode" }).valid, true);
  assert.equal(validateReversalReason({ reason: "Package was dropped prior to opening" }).valid, true);

  // Exceeds 1000 chars
  const longReason = "a".repeat(1001);
  assert.equal(validateReversalReason({ reason: longReason }).valid, false);
});

test("ot_consumables_nurse: canReverseConsumable enforces reversal constraints", () => {
  assert.equal(canReverseConsumable(null), false);

  const regularItem = {
    ot_consumable_id: 1,
    booking_id: 10,
    drug_id: 5,
    description: "Suture 3-0",
    qty: 1,
    is_reversal: false,
    is_reversed: false,
  };
  assert.equal(canReverseConsumable(regularItem), true);

  // Already reversed item cannot be reversed again
  const alreadyReversed = { ...regularItem, is_reversed: true };
  assert.equal(canReverseConsumable(alreadyReversed), false);

  // Reversal row itself cannot be reversed
  const reversalRow = { ...regularItem, is_reversal: true };
  assert.equal(canReverseConsumable(reversalRow), false);
});

test("ot_consumables_nurse: explainConsumablesError returns bilingual explanations", () => {
  const enActive = explainConsumablesError("OT_BOOKING_NOT_ACTIVE", "en");
  assert.equal(enActive.title, "Surgery Not Active");
  const urActive = explainConsumablesError("OT_BOOKING_NOT_ACTIVE", "ur");
  assert.match(urActive.title, /سرجری فعال نہیں ہے/);

  const enRev = explainConsumablesError("OT_CONSUMABLE_REVERSAL_INVALID", "en");
  assert.equal(enRev.title, "Invalid Consumable Reversal");
  const urRev = explainConsumablesError("OT_CONSUMABLE_REVERSAL_INVALID", "ur");
  assert.match(urRev.title, /منسوخی باطل ہے/);

  const enRef = explainConsumablesError("REFERENCE_NOT_FOUND", "en");
  assert.equal(enRef.title, "Reference Not Found");

  const enVal = explainConsumablesError("VALIDATION_ERROR", "en");
  assert.equal(enVal.title, "Validation Error");

  const enFallback = explainConsumablesError("UNKNOWN_CODE", "en");
  assert.equal(enFallback.title, "System Error");
});
