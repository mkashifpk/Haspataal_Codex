import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccountantCockpitCapabilityView,
  isDualApprovalRequiredForCashDrop,
  isDualApprovalRequiredForApSettlement,
  validateDualApprover,
  validateCashDrop,
  validateApSettlement,
  validateSupplierCreditConfirmation,
  validateSupplierRefusal,
  ACCOUNTANT_ERROR_MESSAGES,
  DEFAULT_LARGE_CASH_THRESHOLD,
} from "../src/accountant-cockpit-policy.ts";

test("accountant_cockpit: getAccountantCockpitCapabilityView resolves capability views", () => {
  assert.equal(getAccountantCockpitCapabilityView(null), "full");
  assert.equal(getAccountantCockpitCapabilityView(undefined), "full");

  // Array format
  const estArray = {
    views: {
      screens: [
        { screen_id: "accountant_cockpit", view: "open_work" },
      ],
    },
  };
  assert.equal(getAccountantCockpitCapabilityView(estArray), "open_work");

  // Object format
  const estObj = {
    views: {
      screens: {
        accountant_cockpit: { view: "hidden" },
      },
    },
  };
  assert.equal(getAccountantCockpitCapabilityView(estObj), "hidden");
});

test("accountant_cockpit: rule:8c0db74e85 dual approval threshold detection", () => {
  // Cash drop threshold: amount >= threshold
  assert.equal(isDualApprovalRequiredForCashDrop(99999, 100000), false);
  assert.equal(isDualApprovalRequiredForCashDrop(100000, 100000), true);
  assert.equal(isDualApprovalRequiredForCashDrop(150000, 100000), true);
  assert.equal(isDualApprovalRequiredForCashDrop("120000", 100000), true);
  assert.equal(isDualApprovalRequiredForCashDrop("invalid"), false);

  // AP settlement threshold: payable total >= threshold
  assert.equal(isDualApprovalRequiredForApSettlement(50000, 100000), false);
  assert.equal(isDualApprovalRequiredForApSettlement(100000, 100000), true);
  assert.equal(isDualApprovalRequiredForApSettlement(250000, 100000), true);
  assert.equal(isDualApprovalRequiredForApSettlement("105000", 100000), true);
  assert.equal(isDualApprovalRequiredForApSettlement("invalid"), false);
});

test("accountant_cockpit: rule:8c0db74e85 validateDualApprover requires credentials and enforces different person", () => {
  const current = "demo.accountant";

  // Missing second credentials
  const missing1 = validateDualApprover(current, "", "pass123");
  assert.equal(missing1.valid, false);
  assert.equal(missing1.errorCode, "DUAL_CONTROL_REQUIRED");

  const missing2 = validateDualApprover(current, "demo.owner", "");
  assert.equal(missing2.valid, false);
  assert.equal(missing2.errorCode, "DUAL_CONTROL_REQUIRED");

  // Same person check (case-insensitive)
  const samePerson = validateDualApprover(current, "DEMO.ACCOUNTANT", "pass123");
  assert.equal(samePerson.valid, false);
  assert.equal(samePerson.errorCode, "DUAL_CONTROL_SAME_PERSON");

  // Valid second approver
  const valid = validateDualApprover(current, "demo.owner", "securePass456");
  assert.equal(valid.valid, true);
  assert.equal(valid.errorCode, undefined);
});

test("accountant_cockpit: rule:7cc7842e8a & rule:1109b23ad9 validateCashDrop counts whole drawer and records variance", () => {
  const currentUser = { username: "demo.accountant", user_id: 10 };

  const openShift = {
    shift_id: 101,
    status: "Open",
    opening_float: 5000,
    expected_cash: 25000,
  };

  // Rejects if shift is Open (must be PendingCollection)
  const dropOpen = validateCashDrop(openShift, { counted_cash: 25000 }, currentUser);
  assert.equal(dropOpen.valid, false);
  assert.equal(dropOpen.errorCode, "SHIFT_NOT_PENDING_COLLECTION");

  const pendingShift = {
    shift_id: 102,
    status: "PendingCollection",
    opening_float: 5000,
    expected_cash: 25000,
  };

  // Negative counted cash
  const dropNegative = validateCashDrop(pendingShift, { counted_cash: -100 }, currentUser);
  assert.equal(dropNegative.valid, false);
  assert.equal(dropNegative.errorCode, "VALIDATION_ERROR");

  // Exact count: no variance, no dual control required (< 100,000)
  const dropExact = validateCashDrop(pendingShift, { counted_cash: 25000 }, currentUser);
  assert.equal(dropExact.valid, true);
  assert.equal(dropExact.variance, 0);
  assert.equal(dropExact.hasVariance, false);
  assert.equal(dropExact.requiresDualApproval, false);

  // Variance: counted 24,500 vs expected 25,000 -> variance -500 (triggers audit review per rule:1109b23ad9)
  const dropShort = validateCashDrop(pendingShift, { counted_cash: 24500 }, currentUser);
  assert.equal(dropShort.valid, true);
  assert.equal(dropShort.variance, -500);
  assert.equal(dropShort.hasVariance, true);

  // Large cash drop: >= 100,000 requires second approver
  const largePendingShift = {
    shift_id: 103,
    status: "PendingCollection",
    opening_float: 10000,
    expected_cash: 120000,
  };

  // Large cash drop without second approver
  const dropLargeNoApprover = validateCashDrop(
    largePendingShift,
    { counted_cash: 120000 },
    currentUser,
    100000
  );
  assert.equal(dropLargeNoApprover.valid, false);
  assert.equal(dropLargeNoApprover.errorCode, "DUAL_CONTROL_REQUIRED");
  assert.equal(dropLargeNoApprover.requiresDualApproval, true);

  // Large cash drop with second approver who is same person
  const dropLargeSamePerson = validateCashDrop(
    largePendingShift,
    {
      counted_cash: 120000,
      second_approver_username: "demo.accountant",
      second_approver_password: "pwd",
    },
    currentUser,
    100000
  );
  assert.equal(dropLargeSamePerson.valid, false);
  assert.equal(dropLargeSamePerson.errorCode, "DUAL_CONTROL_SAME_PERSON");

  // Large cash drop with valid distinct co-signer
  const dropLargeValid = validateCashDrop(
    largePendingShift,
    {
      counted_cash: 120000,
      second_approver_username: "demo.director",
      second_approver_password: "dirpwd",
    },
    currentUser,
    100000
  );
  assert.equal(dropLargeValid.valid, true);
  assert.equal(dropLargeValid.requiresDualApproval, true);
});

test("accountant_cockpit: rule:465292d1b4 & rule:8c0db74e85 validateApSettlement handles methods, credit notes, and dual control", () => {
  const currentUser = { username: "demo.accountant", user_id: 10 };

  const payable = {
    ap_id: 201,
    source_type: "VendorInvoice",
    source_id: 55,
    description: "Antibiotics delivery",
    amount: 150000,
    amount_paid: 50000,
    balance: 100000,
    status: "PartiallySettled",
    payee_vendor_id: 7,
  };

  const supplierReturns = [
    {
      return_id: 301,
      return_number: "SRN-2026-0001",
      vendor_id: 7,
      status: "Credited",
      credit_left: 45000,
    },
    {
      return_id: 302,
      return_number: "SRN-2026-0002",
      vendor_id: 99, // different vendor
      status: "Credited",
      credit_left: 80000,
    },
    {
      return_id: 303,
      return_number: "SRN-2026-0003",
      vendor_id: 7,
      status: "Returned", // not yet credited
      credit_left: 50000,
    },
  ];

  // Overpayment check
  const overpay = validateApSettlement(
    payable,
    { amount: 120000 },
    currentUser,
    supplierReturns
  );
  assert.equal(overpay.valid, false);
  assert.equal(overpay.errorCode, "AP_OVERPAYMENT");

  // Unapproved payable check
  const pendingPayable = { ...payable, status: "PendingApproval" };
  const notSettleable = validateApSettlement(
    pendingPayable,
    { amount: 10000 },
    currentUser,
    supplierReturns
  );
  assert.equal(notSettleable.valid, false);
  assert.equal(notSettleable.errorCode, "AP_NOT_SETTLEABLE");

  // SupplierCredit method validation: missing return id
  const creditNoReturn = validateApSettlement(
    payable,
    { amount: 30000, method: "SupplierCredit" },
    currentUser,
    supplierReturns
  );
  assert.equal(creditNoReturn.valid, false);
  assert.equal(creditNoReturn.errorCode, "SUPPLIER_CREDIT_UNAVAILABLE");

  // SupplierCredit: return not in Credited status
  const creditUnconfirmed = validateApSettlement(
    payable,
    { amount: 30000, method: "SupplierCredit", supplier_return_id: 303 },
    currentUser,
    supplierReturns
  );
  assert.equal(creditUnconfirmed.valid, false);
  assert.equal(creditUnconfirmed.errorCode, "SUPPLIER_CREDIT_UNAVAILABLE");

  // SupplierCredit: return belongs to another vendor
  const creditWrongVendor = validateApSettlement(
    payable,
    { amount: 30000, method: "SupplierCredit", supplier_return_id: 302 },
    currentUser,
    supplierReturns
  );
  assert.equal(creditWrongVendor.valid, false);
  assert.equal(creditWrongVendor.errorCode, "SUPPLIER_CREDIT_UNAVAILABLE");

  // SupplierCredit: insufficient credit_left (requires 50,000, return only has 45,000)
  const creditInsufficient = validateApSettlement(
    payable,
    { amount: 50000, method: "SupplierCredit", supplier_return_id: 301 },
    currentUser,
    supplierReturns
  );
  assert.equal(creditInsufficient.valid, false);
  assert.equal(creditInsufficient.errorCode, "SUPPLIER_CREDIT_UNAVAILABLE");

  // Dual control required for large payable (amount=150,000 >= threshold 100,000)
  const largeApMissingApprover = validateApSettlement(
    payable,
    { amount: 20000, method: "SupplierCredit", supplier_return_id: 301 },
    currentUser,
    supplierReturns,
    100000
  );
  assert.equal(largeApMissingApprover.valid, false);
  assert.equal(largeApMissingApprover.errorCode, "DUAL_CONTROL_REQUIRED");
  assert.equal(largeApMissingApprover.requiresDualApproval, true);

  // Valid settlement with SupplierCredit and dual approver
  const validSettlement = validateApSettlement(
    payable,
    {
      amount: 20000,
      method: "SupplierCredit",
      supplier_return_id: 301,
      second_approver_username: "demo.owner",
      second_approver_password: "validpassword",
    },
    currentUser,
    supplierReturns,
    100000
  );
  assert.equal(validSettlement.valid, true);
  assert.equal(validSettlement.settleAmount, 20000);
  assert.equal(validSettlement.requiresDualApproval, true);
});

test("accountant_cockpit: rule:465292d1b4 validateSupplierCreditConfirmation enforces dual control and validates credit note", () => {
  const currentUser = { username: "demo.accountant", name: "Accountant Kashif" };

  const supplierReturn = {
    return_id: 401,
    return_number: "SRN-2026-0045",
    vendor_id: 12,
    drug_name: "Amoxicillin 500mg",
    qty: 100,
    value_at_cost: 15000,
    returned_by_name: "Nurse Fatima",
    status: "Returned",
  };

  // Rejects if return is already Credited or Refused
  const notAwaiting = validateSupplierCreditConfirmation(
    { ...supplierReturn, status: "Credited" },
    { credit_note_no: "CN-01", credit_note_date: "2026-11-02", credit_amount: 15000 },
    currentUser
  );
  assert.equal(notAwaiting.valid, false);
  assert.equal(notAwaiting.errorCode, "SUPPLIER_RETURN_STATE_INVALID");

  // DUAL_CONTROL_SAME_PERSON: user who returned the goods cannot confirm credit
  const samePerson = validateSupplierCreditConfirmation(
    { ...supplierReturn, returned_by_name: "Accountant Kashif" },
    { credit_note_no: "CN-01", credit_note_date: "2026-11-02", credit_amount: 15000 },
    currentUser
  );
  assert.equal(samePerson.valid, false);
  assert.equal(samePerson.errorCode, "DUAL_CONTROL_SAME_PERSON");

  // Missing credit note number
  const missingNo = validateSupplierCreditConfirmation(
    supplierReturn,
    { credit_note_no: "", credit_note_date: "2026-11-02", credit_amount: 15000 },
    currentUser
  );
  assert.equal(missingNo.valid, false);
  assert.equal(missingNo.errorCode, "VALIDATION_ERROR");

  // Valid credit note confirmation
  const valid = validateSupplierCreditConfirmation(
    supplierReturn,
    {
      credit_note_no: "CN-SHAHEEN-9921",
      credit_note_date: "2026-11-02",
      credit_amount: 15000,
      note: "Confirmed against delivery discrepancy",
    },
    currentUser
  );
  assert.equal(valid.valid, true);
});

test("accountant_cockpit: rule:465292d1b4 validateSupplierRefusal enforces dual control and requires reason", () => {
  const currentUser = { username: "demo.accountant", name: "Accountant Kashif" };

  const supplierReturn = {
    return_id: 402,
    return_number: "SRN-2026-0046",
    vendor_id: 12,
    value_at_cost: 8000,
    returned_by_name: "Storekeeper Ali",
    status: "Returned",
  };

  // DUAL_CONTROL_SAME_PERSON: user who returned the goods cannot refuse credit
  const samePerson = validateSupplierRefusal(
    { ...supplierReturn, returned_by_name: "Accountant Kashif" },
    { note: "Supplier stated past 30 days" },
    currentUser
  );
  assert.equal(samePerson.valid, false);
  assert.equal(samePerson.errorCode, "DUAL_CONTROL_SAME_PERSON");

  // Missing refusal note
  const missingNote = validateSupplierRefusal(
    supplierReturn,
    { note: "" },
    currentUser
  );
  assert.equal(missingNote.valid, false);
  assert.equal(missingNote.errorCode, "VALIDATION_ERROR");

  // Valid refusal
  const valid = validateSupplierRefusal(
    supplierReturn,
    { note: "Supplier rejected claim due to package seal breach; written off." },
    currentUser
  );
  assert.equal(valid.valid, true);
});

test("accountant_cockpit: ACCOUNTANT_ERROR_MESSAGES contains all required statutory error codes", () => {
  const requiredCodes = [
    "ACCOUNT_LOCKED",
    "AP_NOT_SETTLEABLE",
    "AP_OVERPAYMENT",
    "DUAL_CONTROL_REQUIRED",
    "DUAL_CONTROL_SAME_PERSON",
    "FORBIDDEN",
    "NOT_FOUND",
    "SELF_APPROVAL_FORBIDDEN",
    "SHIFT_NOT_OPEN",
    "SHIFT_NOT_PENDING_COLLECTION",
    "STEP_UP_REQUIRED",
    "SUPPLIER_CREDIT_UNAVAILABLE",
    "SUPPLIER_RETURN_STATE_INVALID",
    "VALIDATION_ERROR",
  ];

  for (const code of requiredCodes) {
    assert(ACCOUNTANT_ERROR_MESSAGES[code], `Missing error message for ${code}`);
    assert(ACCOUNTANT_ERROR_MESSAGES[code].en.length > 0, `Empty English message for ${code}`);
    assert(ACCOUNTANT_ERROR_MESSAGES[code].ur.length > 0, `Empty Urdu message for ${code}`);
  }
});
