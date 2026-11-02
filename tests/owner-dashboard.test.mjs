import test from "node:test";
import assert from "node:assert/strict";
import {
  getOwnerDashboardCapabilityView,
  calculateOpdConversionMetrics,
  calculateDoctorMetrics,
  summarizePnlFlash,
  summarizeTrialBalance,
  validateDateRange,
  validateTrendDays,
  AUTO_REFRESH_INTERVAL_SECONDS,
  OWNER_DASHBOARD_ERROR_MESSAGES,
} from "../src/owner-dashboard-policy.ts";

test("owner_dashboard: capability view resolves based on establishment views.screens", () => {
  assert.equal(getOwnerDashboardCapabilityView(null), "full");
  assert.equal(getOwnerDashboardCapabilityView({}), "full");

  // Dictionary format
  const estFull = { views: { screens: { owner_dashboard: "full" } } };
  assert.equal(getOwnerDashboardCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { owner_dashboard: "open_work" } } };
  assert.equal(getOwnerDashboardCapabilityView(estOpenWork), "open_work");

  const estRecords = { views: { screens: { owner_dashboard: "records" } } };
  assert.equal(getOwnerDashboardCapabilityView(estRecords), "records");

  const estSetup = { views: { screens: { owner_dashboard: "setup" } } };
  assert.equal(getOwnerDashboardCapabilityView(estSetup), "setup");

  const estHidden = { views: { screens: { owner_dashboard: "hidden" } } };
  assert.equal(getOwnerDashboardCapabilityView(estHidden), "hidden");

  // Array format
  const estArray = { views: { screens: [{ screen_id: "owner_dashboard", view: "open_work" }] } };
  assert.equal(getOwnerDashboardCapabilityView(estArray), "open_work");
});

test("owner_dashboard: Rule rule:8e0811036c defines 60-second periodic ledger refresh", () => {
  assert.equal(AUTO_REFRESH_INTERVAL_SECONDS, 60);
});

test("owner_dashboard: calculateOpdConversionMetrics accurately computes conversion and attrition rates", () => {
  const totals1 = {
    visited: 100,
    examined: 85,
    attrition: 15,
    issued_unpaid: 20,
    expired: 10,
    refunded: 5,
  };

  const metrics1 = calculateOpdConversionMetrics(totals1);
  assert.equal(metrics1.examinationRatePct, 85.0);
  assert.equal(metrics1.attritionRatePct, 15.0);
  assert.equal(metrics1.unpaidRatePct, 16.7); // 20 / 120 = 16.666...%
  assert.equal(metrics1.refundRatePct, 5.0);

  // Zero visited handling
  const totalsZero = {
    visited: 0,
    examined: 0,
    attrition: 0,
    issued_unpaid: 0,
    expired: 0,
    refunded: 0,
  };
  const metricsZero = calculateOpdConversionMetrics(totalsZero);
  assert.equal(metricsZero.examinationRatePct, 0);
  assert.equal(metricsZero.attritionRatePct, 0);
  assert.equal(metricsZero.unpaidRatePct, 0);
  assert.equal(metricsZero.refundRatePct, 0);
});

test("owner_dashboard: calculateDoctorMetrics accurately computes per-physician consultation metrics", () => {
  const doc = {
    doctor_id: 10,
    doctor_name: "Dr. Fatima",
    department_name: "Paediatrics",
    visited: 50,
    examined: 45,
    attrition: 5,
    issued_unpaid: 2,
    expired: 1,
    refunded: 0,
  };

  const metrics = calculateDoctorMetrics(doc);
  assert.equal(metrics.examinationRatePct, 90.0);
  assert.equal(metrics.attritionRatePct, 10.0);

  const docZero = {
    doctor_id: null,
    doctor_name: null,
    department_name: "General OPD",
    visited: 0,
    examined: 0,
    attrition: 0,
    issued_unpaid: 0,
    expired: 0,
    refunded: 0,
  };
  const metricsZero = calculateDoctorMetrics(docZero);
  assert.equal(metricsZero.examinationRatePct, 0);
  assert.equal(metricsZero.attritionRatePct, 0);
});

test("owner_dashboard: summarizePnlFlash calculates margins, expense ratios, and net cash flow", () => {
  const flashData = {
    date_from: "2026-11-01",
    date_to: "2026-11-02",
    income: [
      { account_code: "4010", stream: "OPD Tickets", amount: 120000 },
      { account_code: "4020", stream: "Pharmacy Counter", amount: 80000 },
    ],
    contra_income: [
      { account_code: "4090", stream: "Waivers & Discounts", amount: -10000 },
    ],
    gross_income: 200000,
    net_income: 190000,
    expenses: [
      { account_code: "5010", category: "Medical Consumables", amount: 40000 },
      { account_code: "5020", category: "Utilities & Fuel", amount: 20000 },
    ],
    payroll_run_rate: 30000,
    total_expenses: 90000,
    net_profit: 100000,
    cash: {
      collected: 185000,
      paid_back: 5000,
      cash_collected: 180000,
    },
    receivables_outstanding: 15000,
    payables_open: 25000,
  };

  const summary = summarizePnlFlash(flashData);
  assert.equal(summary.isProfitable, true);
  assert.equal(summary.profitMarginPct, 52.6); // 100,000 / 190,000 = 52.63%
  assert.equal(summary.operatingExpenseRatio, 47.4); // 90,000 / 190,000 = 47.36%
  assert.equal(summary.netCashCollected, 175000); // 180,000 - 5,000
});

test("owner_dashboard: summarizeTrialBalance validates ledger debit-credit equality", () => {
  const balancedRows = [
    { account_code: "1010", name: "Main Cash Drawer", type: "Asset", debit: 50000, credit: 0, balance: 50000 },
    { account_code: "1020", name: "Hospital Bank Account", type: "Asset", debit: 150000, credit: 0, balance: 150000 },
    { account_code: "2010", name: "Accounts Payable", type: "Liability", debit: 0, credit: 60000, balance: -60000 },
    { account_code: "3010", name: "Owner Equity", type: "Equity", debit: 0, credit: 100000, balance: -100000 },
    { account_code: "4010", name: "Patient Fee Revenue", type: "Income", debit: 0, credit: 80000, balance: -80000 },
    { account_code: "5010", name: "Medical Supplies Expense", type: "Expense", debit: 40000, credit: 0, balance: 40000 },
  ];

  const summary = summarizeTrialBalance(balancedRows);
  assert.equal(summary.totalDebits, 240000);
  assert.equal(summary.totalCredits, 240000);
  assert.equal(summary.isBalanced, true);
  assert.equal(summary.variance, 0);
  assert.equal(summary.totalsByType.Asset.debit, 200000);
  assert.equal(summary.totalsByType.Liability.credit, 60000);

  // Unbalanced ledger detection
  const unbalancedRows = [
    { account_code: "1010", name: "Cash", type: "Asset", debit: 50000, credit: 0, balance: 50000 },
    { account_code: "2010", name: "Payables", type: "Liability", debit: 0, credit: 40000, balance: -40000 },
  ];
  const unbalancedSummary = summarizeTrialBalance(unbalancedRows);
  assert.equal(unbalancedSummary.isBalanced, false);
  assert.equal(unbalancedSummary.variance, 10000);
});

test("owner_dashboard: validateDateRange and validateTrendDays enforce bounds", () => {
  // Valid ranges
  assert.equal(validateDateRange(null, null).valid, true);
  assert.equal(validateDateRange("2026-11-01", "2026-11-02").valid, true);
  assert.equal(validateDateRange("2026-11-02", "2026-11-02").valid, true);

  // Invalid ranges
  assert.equal(validateDateRange("invalid", "2026-11-02").valid, false);
  assert.equal(validateDateRange("2026-11-02", "2026-10-01").valid, false);

  // Trend days bounds (1 to 92)
  assert.equal(validateTrendDays(1).valid, true);
  assert.equal(validateTrendDays(30).valid, true);
  assert.equal(validateTrendDays(92).valid, true);
  assert.equal(validateTrendDays(0).valid, false);
  assert.equal(validateTrendDays(93).valid, false);
  assert.equal(validateTrendDays(NaN).valid, false);
});

test("owner_dashboard: bilingual error dictionary covers standard codes", () => {
  for (const [code, msg] of Object.entries(OWNER_DASHBOARD_ERROR_MESSAGES)) {
    assert(typeof msg.en === "string" && msg.en.length > 0, `${code}: missing English`);
    assert(typeof msg.ur === "string" && msg.ur.length > 0, `${code}: missing Urdu`);
    assert(/[\u0600-\u06ff]/.test(msg.ur), `${code}: invalid Urdu script`);
  }
});
