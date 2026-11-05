import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPayrollCapabilityView,
  calculateEmployeePayrollFormula,
  explainExtraDutyCalculation,
  validateGeneratePayrollForm,
  validateCancelRunForm,
  validateMarkPaidForm,
  formatPayrollRunStatusBadge,
  PAYROLL_ERROR_MESSAGES,
} from "../src/payroll-policy.ts";

test("payroll: permissions work without role labels and role names grant nothing", () => {
  for (const role of ["hr_admin", "accountant"]) {
    const view = getPayrollCapabilityView({ roles: [role], permissions: [] });
    assert.equal(view.mode, "hidden");
    assert.equal(view.canRun, false);
    assert.equal(view.canView, false);
  }
  const readOnly = getPayrollCapabilityView({ permissions: ["hr.payroll.view"] });
  assert.equal(readOnly.mode, "records");
  assert.equal(readOnly.canFinalize, false);
  const runner = getPayrollCapabilityView({ permissions: ["hr.payroll.run"] });
  assert.equal(runner.canRun, true);
  const records = getPayrollCapabilityView({ permissions: ["hr.payroll.run", "hr.payroll.view"] }, { views: { screens: [{ screen_id: "payroll", view: "records" }] } });
  assert.equal(records.mode, "records");
  assert.equal(records.canRun, false);
});

test("payroll: getPayrollCapabilityView resolves capability views correctly", () => {
  // Anonymous / unauthenticated
  const anonView = getPayrollCapabilityView(null);
  assert.equal(anonView.mode, "hidden");
  assert.equal(anonView.canRun, false);

  // Inactive service
  const inactiveView = getPayrollCapabilityView(
    { roles: ["hr_admin"], permissions: ["hr.payroll.run"] },
    { views: { screens: [{ screen_id: "payroll", view: "hidden" }] } }
  );
  assert.equal(inactiveView.mode, "hidden");

  // HR Admin with hr.payroll.run (full)
  const adminView = getPayrollCapabilityView({
    roles: ["hr_admin"],
    permissions: ["hr.payroll.run", "hr.payroll.view"],
  });
  assert.equal(adminView.mode, "full");
  assert.equal(adminView.canRun, true);
  assert.equal(adminView.canFinalize, true);
  assert.equal(adminView.canMarkPaid, true);
  assert.equal(adminView.canCancel, true);

  // View only (e.g. auditor or records view)
  const viewOnly = getPayrollCapabilityView({
    roles: ["accountant"],
    permissions: ["hr.payroll.view"],
  });
  assert.equal(viewOnly.mode, "records");
  assert.equal(viewOnly.canRun, false);
  assert.equal(viewOnly.canView, true);
  assert.equal(viewOnly.canFinalize, false);

  // Unauthorized role
  const unauthView = getPayrollCapabilityView({
    roles: ["cashier"],
    permissions: ["billing.read"],
  });
  assert.equal(unauthView.mode, "hidden");
});

test("payroll: rule:0cf7ae94dd formula Base - Absences - Credit + Commissions + Extra Duty = Net", () => {
  // Example from screen_test_plan: Base 100,000, Extra Duty 12,500, Net 112,500
  const item = {
    base_salary: 100000,
    unpaid_absence_deduction: 5000,
    internal_credit_deduction: 2000,
    accrued_commissions: 8000,
    extra_duty_pay: 12500,
    other_additions: 0,
    other_deductions: 0,
    net_payable: 113500,
  };

  const formula = calculateEmployeePayrollFormula(item);
  assert.equal(formula.baseSalary, 100000);
  assert.equal(formula.unpaidAbsenceDeduction, 5000);
  assert.equal(formula.internalCreditDeduction, 2000);
  assert.equal(formula.commissions, 8000);
  assert.equal(formula.extraDutyPay, 12500);
  assert.equal(formula.calculatedNet, 113500);
  assert.equal(formula.reportedNet, 113500);
  assert.equal(formula.isBalanced, true);
  assert.match(formula.formulaString, /Rs\. 100,000 \(Base\) − Rs\. 5,000/);
  assert.match(formula.formulaStringUr, /روپے 100,000 \(بنیادی\) − روپے 5,000/);
});

test("payroll: rule:e846dec8a2 explainExtraDutyCalculation computes duties beyond weekly allowance", () => {
  // Base 100,000 / 8 period days = 12,500 per day x 1 day = 12,500
  const duty = explainExtraDutyCalculation(1, 100000, 8, 1.0);
  assert.equal(duty.daysPay, 12500);
  assert.equal(duty.calculatedPay, 12500);
  assert.match(duty.explanationEn, /1 extra duty day\(s\) worked beyond weekly rest allowance/);
  assert.match(duty.explanationUr, /1 اضافی ڈیوٹی دن ہفتہ وار چھٹی سے زائد/);

  // Zero extra duty days
  const zeroDuty = explainExtraDutyCalculation(0, 100000, 30, 1.0);
  assert.equal(zeroDuty.calculatedPay, 0);
});

test("payroll: validateGeneratePayrollForm validates period date ranges", () => {
  // Missing dates
  const empty = validateGeneratePayrollForm("", "");
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.period_start);
  assert.ok(empty.errors.period_end);

  // Invalid formats
  const invalid = validateGeneratePayrollForm("2026/09/01", "invalid-date");
  assert.equal(invalid.valid, false);

  // Start after end
  const inverted = validateGeneratePayrollForm("2026-09-30", "2026-09-01");
  assert.equal(inverted.valid, false);
  assert.match(inverted.errors.period_end, /earlier than start date/);

  // Valid range
  const valid = validateGeneratePayrollForm("2026-09-01", "2026-09-30");
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

test("payroll: validateCancelRunForm validates cancellation reasons", () => {
  const shortReason = validateCancelRunForm("no");
  assert.equal(shortReason.valid, false);
  assert.match(shortReason.error, /at least 3 characters/);

  const empty = validateCancelRunForm("   ");
  assert.equal(empty.valid, false);

  const valid = validateCancelRunForm("Attendance revision required before finalizing.");
  assert.equal(valid.valid, true);
});

test("payroll: validateMarkPaidForm validates payment method options", () => {
  const validBank = validateMarkPaidForm("BankTransfer");
  assert.equal(validBank.valid, true);

  const validCash = validateMarkPaidForm("Cash");
  assert.equal(validCash.valid, true);

  const invalid = validateMarkPaidForm("Crypto");
  assert.equal(invalid.valid, false);
});

test("payroll: formatPayrollRunStatusBadge formats all standard statuses", () => {
  const generated = formatPayrollRunStatusBadge("Generated");
  assert.equal(generated.label, "Generated");
  assert.equal(generated.labelUr, "تیار شدہ");

  const finalized = formatPayrollRunStatusBadge("Finalized");
  assert.equal(finalized.label, "Finalized");
  assert.equal(finalized.labelUr, "حتمی منظور شدہ");

  const paid = formatPayrollRunStatusBadge("Paid");
  assert.equal(paid.label, "Paid");
  assert.equal(paid.labelUr, "ادا شدہ");

  const cancelled = formatPayrollRunStatusBadge("Cancelled");
  assert.equal(cancelled.label, "Cancelled");
  assert.equal(cancelled.labelUr, "منسوخ شدہ");
});

test("payroll: PAYROLL_ERROR_MESSAGES provides bilingual coverage for statutory errors", () => {
  const requiredCodes = [
    "PAYROLL_ALREADY_GENERATED",
    "PAYROLL_RUN_PENDING",
    "PAYROLL_SOURCE_CONSUMED",
    "PAYROLL_STATE_INVALID",
    "VALIDATION_ERROR",
  ];

  for (const code of requiredCodes) {
    const entry = PAYROLL_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error dictionary entry for ${code}`);
    assert.ok(entry.en.length > 0, `Missing English text for ${code}`);
    assert.ok(entry.ur.length > 0, `Missing Urdu text for ${code}`);
    assert.ok(entry.actionEn.length > 0, `Missing English action for ${code}`);
    assert.ok(entry.actionUr.length > 0, `Missing Urdu action for ${code}`);
  }
});
