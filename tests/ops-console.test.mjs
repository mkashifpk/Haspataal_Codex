import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getOpsConsoleCapabilityView,
  evaluatePayableRouting,
  validateAssignForm,
  validateCompleteForm,
  validateCancelForm,
  validateAssetForm,
  validateUtilityForm,
  formatWorkOrderStatusBadge,
  formatWorkOrderPriorityBadge,
  formatPayableStatusBadge,
  OPS_CONSOLE_ERROR_MESSAGES,
} from "../src/ops-console-policy.ts";

test("ops_console: getOpsConsoleCapabilityView resolves capability modes correctly", () => {
  // Unauthenticated
  const anonView = getOpsConsoleCapabilityView(null);
  assert.equal(anonView.mode, "hidden");
  assert.equal(anonView.canManageWorkOrders, false);

  // Inactive service
  const inactiveView = getOpsConsoleCapabilityView(
    { roles: ["ops_admin"], permissions: ["ops.workorder.manage"] },
    { services: [{ code: "ops", status: "Inactive" }] }
  );
  assert.equal(inactiveView.mode, "hidden");

  // Full Ops Admin
  const adminView = getOpsConsoleCapabilityView({
    roles: ["ops_admin"],
    permissions: ["ops.workorder.manage", "ops.asset.manage"],
  });
  assert.equal(adminView.mode, "full");
  assert.equal(adminView.canManageWorkOrders, true);
  assert.equal(adminView.canManageAssets, true);
  assert.equal(adminView.canRecordUtilities, true);

  // Maintenance Admin
  const maintView = getOpsConsoleCapabilityView({
    roles: ["maintenance_admin"],
    permissions: ["ops.workorder.manage"],
  });
  assert.equal(maintView.mode, "full");

  // View only (e.g. staff reporter)
  const viewOnly = getOpsConsoleCapabilityView({
    roles: ["ward_nurse"],
    permissions: ["ops.workorder.report"],
  });
  assert.equal(viewOnly.mode, "records");
  assert.equal(viewOnly.canManageWorkOrders, false);

  // Unauthorized
  const unauth = getOpsConsoleCapabilityView({
    roles: ["cashier"],
    permissions: ["billing.read"],
  });
  assert.equal(unauth.mode, "hidden");
});

test("ops_console: rule:a7fc19b5fc contractor work routes to AP while ops cannot settle", () => {
  // External contractor with final cost > 0
  const contractorPayable = evaluatePayableRouting(12, 4500);
  assert.equal(contractorPayable.routesToAp, true);
  assert.match(contractorPayable.explanationEn, /routes to Accountant AP queue/);
  assert.match(contractorPayable.explanationUr, /اکاؤنٹنٹ کی اے پی قطار/);

  // Internal employee work
  const internalWork = evaluatePayableRouting(null, 0);
  assert.equal(internalWork.routesToAp, false);
});

test("ops_console: validateAssignForm enforces exclusive employee or vendor assignment", () => {
  // Neither assigned
  const neither = validateAssignForm(null, null);
  assert.equal(neither.valid, false);
  assert.match(neither.error, /either an internal employee or an external contractor/);

  // Both assigned
  const both = validateAssignForm(5, 12);
  assert.equal(both.valid, false);
  assert.match(both.error, /not both/);

  // Valid internal employee
  const validEmp = validateAssignForm(5, null, 2500);
  assert.equal(validEmp.valid, true);

  // Valid contractor
  const validVendor = validateAssignForm(null, 12, "3500");
  assert.equal(validVendor.valid, true);

  // Negative cost
  const negativeCost = validateAssignForm(5, null, -100);
  assert.equal(negativeCost.valid, false);
  assert.match(negativeCost.error, /non-negative number/);
});

test("ops_console: validateCompleteForm validates final cost", () => {
  const validEmpty = validateCompleteForm(null);
  assert.equal(validEmpty.valid, true);

  const validNum = validateCompleteForm(3500);
  assert.equal(validNum.valid, true);

  const invalidNegative = validateCompleteForm(-500);
  assert.equal(invalidNegative.valid, false);
});

test("ops_console: validateCancelForm validates cancellation reasons", () => {
  const shortReason = validateCancelForm("no");
  assert.equal(shortReason.valid, false);

  const valid = validateCancelForm("Duplicate work order reported by another ward.");
  assert.equal(valid.valid, true);
});

test("ops_console: validateAssetForm validates asset registration inputs", () => {
  const missing = validateAssetForm("", "", "");
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.asset_tag);
  assert.ok(missing.errors.name);
  assert.ok(missing.errors.category);

  const valid = validateAssetForm("BIO-01", "Ventilator Puritan Bennett", "Biomedical");
  assert.equal(valid.valid, true);
});

test("ops_console: validateUtilityForm validates utility overhead entries", () => {
  const missing = validateUtilityForm(null, null, "", 0);
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.category_id);
  assert.ok(missing.errors.vendor_id);
  assert.ok(missing.errors.billing_period);
  assert.ok(missing.errors.cost);

  const valid = validateUtilityForm(1, 4, "2026-09", 54000);
  assert.equal(valid.valid, true);
});

test("ops_console: format badges format all standard statuses and priorities", () => {
  // Statuses
  assert.equal(formatWorkOrderStatusBadge("Reported").label, "Reported");
  assert.equal(formatWorkOrderStatusBadge("Assigned").label, "Assigned");
  assert.equal(formatWorkOrderStatusBadge("InProgress").label, "In Progress");
  assert.equal(formatWorkOrderStatusBadge("Completed").label, "Completed");
  assert.equal(formatWorkOrderStatusBadge("PendingPayment").label, "Pending Payment");
  assert.equal(formatWorkOrderStatusBadge("Paid").label, "Paid");
  assert.equal(formatWorkOrderStatusBadge("Cancelled").label, "Cancelled");

  // Priorities
  assert.equal(formatWorkOrderPriorityBadge("Emergency").label, "Emergency");
  assert.equal(formatWorkOrderPriorityBadge("High").label, "High");
  assert.equal(formatWorkOrderPriorityBadge("Normal").label, "Normal");
  assert.equal(formatWorkOrderPriorityBadge("Low").label, "Low");

  // Payables
  assert.equal(formatPayableStatusBadge("PendingApproval").label, "AP Pending");
  assert.equal(formatPayableStatusBadge("Settled").label, "AP Settled");
});

test("ops_console: OPS_CONSOLE_ERROR_MESSAGES provides bilingual statutory coverage", () => {
  const requiredCodes = [
    "ASSET_DISPOSED",
    "BILLING_DEFERRED",
    "DISCHARGE_NOT_ALLOWED",
    "DISCHARGE_STAGE_IMMUTABLE",
    "DISCHARGE_STAGE_OUT_OF_ORDER",
    "FORBIDDEN",
    "NOT_FOUND",
    "OWN_MEDICINES_HELD",
    "REFERENCE_NOT_FOUND",
    "UNAUTHENTICATED",
    "VALIDATION_ERROR",
    "WORK_ORDER_STATE_INVALID",
  ];

  for (const code of requiredCodes) {
    const entry = OPS_CONSOLE_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error dictionary entry for ${code}`);
    assert.ok(entry.en.length > 0, `Missing English text for ${code}`);
    assert.ok(entry.ur.length > 0, `Missing Urdu text for ${code}`);
    assert.ok(entry.actionEn.length > 0, `Missing English action for ${code}`);
    assert.ok(entry.actionUr.length > 0, `Missing Urdu action for ${code}`);
  }
});
