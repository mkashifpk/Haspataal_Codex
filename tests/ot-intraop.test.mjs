import test from "node:test";
import assert from "node:assert/strict";

import {
  getOtIntraopScreenView,
  canManageBookings,
  canRecordConsumables,
  canViewBookings,
  canStartSurgery,
  canCompleteSurgery,
  canCompleteCleaning,
  canAddConsumables,
  validateConsumableScan,
  validateReversalReason,
  canReverseConsumable,
  explainOtIntraopError,
} from "../src/ot-intraop-policy.ts";

test("ot_intraop: getOtIntraopScreenView evaluates runtime service capability views (Rule 23588c8fc8)", () => {
  assert.equal(getOtIntraopScreenView(null), "full");

  // 1. Explicit server view
  const estExplicit = {
    views: {
      screens: [{ screen_id: "ot_intraop", view: "records" }],
    },
  };
  assert.equal(getOtIntraopScreenView(estExplicit), "records");

  // 2. Capability state evaluation
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getOtIntraopScreenView(estRetiring), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getOtIntraopScreenView(estRetired), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getOtIntraopScreenView(estPreparing), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getOtIntraopScreenView(estAvailable), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getOtIntraopScreenView(estNoSurgery), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getOtIntraopScreenView(estWithSurgery), "full");
});

test("ot_intraop: role and permission gates for lifecycle and consumables", () => {
  assert.equal(canManageBookings(null), false);
  assert.equal(canRecordConsumables(null), false);
  assert.equal(canViewBookings(null), false);

  // OT Admin can manage bookings and record consumables
  const otAdmin = { roles: ["ot_admin"], permissions: [] };
  assert.equal(canManageBookings(otAdmin), true);
  assert.equal(canRecordConsumables(otAdmin), true);
  assert.equal(canViewBookings(otAdmin), true);

  // OT Nurse can record consumables and view bookings, but cannot manage bookings without ot.booking.manage
  const otNurse = { roles: ["ot_nurse"], permissions: [] };
  assert.equal(canManageBookings(otNurse), false);
  assert.equal(canRecordConsumables(otNurse), true);
  assert.equal(canViewBookings(otNurse), true);

  // User with explicit ot.booking.manage permission
  const userWithManage = { roles: ["staff"], permissions: ["ot.booking.manage"] };
  assert.equal(canManageBookings(userWithManage), true);

  // Cashier denied
  const cashier = { roles: ["cashier"], permissions: [] };
  assert.equal(canManageBookings(cashier), false);
  assert.equal(canRecordConsumables(cashier), false);
  assert.equal(canViewBookings(cashier), false);
});

test("ot_intraop: surgical lifecycle state transitions", () => {
  // canStartSurgery: Patient in theater -> InProgress
  assert.equal(canStartSurgery(null), false);
  assert.equal(canStartSurgery("Scheduled"), true);
  assert.equal(canStartSurgery("EmergencyHold"), true);
  assert.equal(canStartSurgery("InProgress"), false);
  assert.equal(canStartSurgery("Cleaning"), false);
  assert.equal(canStartSurgery("Completed"), false);

  // canCompleteSurgery: Surgery finished -> Cleaning
  assert.equal(canCompleteSurgery(null), false);
  assert.equal(canCompleteSurgery("InProgress"), true);
  assert.equal(canCompleteSurgery("Scheduled"), false);
  assert.equal(canCompleteSurgery("Cleaning"), false);
  assert.equal(canCompleteSurgery("Completed"), false);

  // canCompleteCleaning: Theater cleaned -> Available
  assert.equal(canCompleteCleaning(null), false);
  assert.equal(canCompleteCleaning("Cleaning"), true);
  assert.equal(canCompleteCleaning("InProgress"), false);
  assert.equal(canCompleteCleaning("Scheduled"), false);

  // canAddConsumables: strictly when InProgress
  assert.equal(canAddConsumables(null), false);
  assert.equal(canAddConsumables("InProgress"), true);
  assert.equal(canAddConsumables("Scheduled"), false);
  assert.equal(canAddConsumables("Cleaning"), false);
  assert.equal(canAddConsumables("Completed"), false);
});

test("ot_intraop: validateConsumableScan enforces positive quantity and item reference", () => {
  assert.equal(validateConsumableScan(null).valid, false);
  assert.equal(validateConsumableScan({ barcode: "12345", qty: 0 }).valid, false);
  assert.equal(validateConsumableScan({ barcode: "12345", qty: -1 }).valid, false);
  assert.equal(validateConsumableScan({ qty: 1 }).valid, false);

  // Valid inputs
  assert.equal(validateConsumableScan({ barcode: "LOT-9988", qty: 1 }).valid, true);
  assert.equal(validateConsumableScan({ drug_id: 10, qty: 2 }).valid, true);
  assert.equal(validateConsumableScan({ description: "Vascular Graft 6mm", qty: 1, unit_cost: 20000 }).valid, true);
  assert.equal(validateConsumableScan({ asset_id: 55, qty: 1 }).valid, true);
});

test("ot_intraop: validateReversalReason enforces Rule f228c617bd", () => {
  assert.equal(validateReversalReason(null).valid, false);
  assert.equal(validateReversalReason({ reason: "" }).valid, false);
  assert.equal(validateReversalReason({ reason: "ab" }).valid, false);
  assert.equal(validateReversalReason({ reason: "Opened incorrect size implant" }).valid, true);

  const tooLong = "x".repeat(1001);
  assert.equal(validateReversalReason({ reason: tooLong }).valid, false);
});

test("ot_intraop: canReverseConsumable enforces reversal rules", () => {
  assert.equal(canReverseConsumable(null), false);

  const activeItem = {
    ot_consumable_id: 101,
    booking_id: 1,
    description: "Bone Cement 40g",
    qty: 1,
    is_reversal: false,
    is_reversed: false,
  };
  assert.equal(canReverseConsumable(activeItem), true);

  const reversedItem = { ...activeItem, is_reversed: true };
  assert.equal(canReverseConsumable(reversedItem), false);

  const reversalRow = { ...activeItem, is_reversal: true };
  assert.equal(canReverseConsumable(reversalRow), false);
});

test("ot_intraop: explainOtIntraopError returns bilingual explanations", () => {
  const enState = explainOtIntraopError("OT_BOOKING_STATE_INVALID", "en");
  assert.equal(enState.title, "Invalid State Change");
  const urState = explainOtIntraopError("OT_BOOKING_STATE_INVALID", "ur");
  assert.match(urState.title, /سرجری کی حالت غلط ہے/);

  const enChecklist = explainOtIntraopError("OT_CHECKLIST_INCOMPLETE", "en");
  assert.equal(enChecklist.title, "Safety Checklist Incomplete");
  const urChecklist = explainOtIntraopError("OT_CHECKLIST_INCOMPLETE", "ur");
  assert.match(urChecklist.title, /چیک لسٹ نامکمل ہے/);

  const enActive = explainOtIntraopError("OT_BOOKING_NOT_ACTIVE", "en");
  assert.equal(enActive.title, "Surgery Not Active");

  const enReversal = explainOtIntraopError("OT_CONSUMABLE_REVERSAL_INVALID", "en");
  assert.equal(enReversal.title, "Invalid Consumable Reversal");

  const enNotFound = explainOtIntraopError("REFERENCE_NOT_FOUND", "en");
  assert.equal(enNotFound.title, "Reference Not Found");

  const enVal = explainOtIntraopError("VALIDATION_ERROR", "en");
  assert.equal(enVal.title, "Validation Error");
});
