/**
 * Domain policy and statutory business rules for Screen 141: owner_dashboard
 * ("Owner dashboard", Position 141, 41 points, Workspace `owner_dashboard`).
 *
 * Statutory & Quality Rules:
 * - rule:8e0811036c: Refresh every 60 s while visible; figures are live from the ledger.
 * - Delivery Gate: Loading, empty and error states (q:states), permission-based actions (q:permissions),
 *   F1 contextual help (q:f1_help), bilingual English/Urdu role FAQs (q:role_faq), bounded 100-250% zoom (q:zoom).
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  PnlFlashOut,
  PnlTrendDayOut,
  PatientVolumeOut,
  VolumeTotalsOut,
  DoctorVolumeOut,
  TrialBalanceRowOut,
} from "./generated/owner_dashboard";

export type OwnerDashboardCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const AUTO_REFRESH_INTERVAL_SECONDS = 60;

export const OWNER_DASHBOARD_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  FORBIDDEN: {
    en: "You do not have permission to view owner dashboard metrics (requires finance.dashboard.owner or finance.gl.view).",
    ur: "آپ کے پاس مالک کے ڈیش بورڈ کے مالیاتی اور انتظامی اعداد و شمار دیکھنے کی اجازت نہیں ہے (finance.dashboard.owner یا finance.gl.view درکار ہے)۔",
  },
  VALIDATION_ERROR: {
    en: "The report parameters are invalid. Please check the date range or day count.",
    ur: "رپورٹ کے پیرامیٹرز نامکمل یا غلط ہیں۔ برائے مہربانی تاریخ کی حد یا دنوں کی تعداد چیک کریں۔",
  },
  NETWORK_ERROR: {
    en: "Unable to reach server. Please check network connection.",
    ur: "سرور سے رابطہ ممکن نہیں ہو سکا۔ برائے مہربانی انٹرنیٹ کنکشن چیک کریں۔",
  },
};

/**
 * Resolves capability view for owner_dashboard from establishment configuration.
 */
export function getOwnerDashboardCapabilityView(
  establishment?: EstablishmentOut | null
): OwnerDashboardCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const entry = screens.find((s: any) => s.screen_id === "owner_dashboard");
    if (entry && entry.view) {
      return entry.view as OwnerDashboardCapabilityView;
    }
  } else if (screens && typeof screens === "object") {
    const entry = (screens as Record<string, any>)["owner_dashboard"];
    if (entry) {
      if (typeof entry === "string") return entry as OwnerDashboardCapabilityView;
      if (typeof entry === "object" && entry.view) return entry.view as OwnerDashboardCapabilityView;
    }
  }

  return "full";
}

export interface OpdConversionMetrics {
  examinationRatePct: number;
  attritionRatePct: number;
  unpaidRatePct: number;
  refundRatePct: number;
}

/**
 * Calculates conversion and attrition rates from hospital-wide OPD volume totals.
 */
export function calculateOpdConversionMetrics(totals: VolumeTotalsOut): OpdConversionMetrics {
  const visited = totals.visited || 0;
  const examined = totals.examined || 0;
  const attrition = totals.attrition || 0;
  const issuedUnpaid = totals.issued_unpaid || 0;
  const refunded = totals.refunded || 0;

  const totalDemand = visited + issuedUnpaid;

  return {
    examinationRatePct: visited > 0 ? Number(((examined / visited) * 100).toFixed(1)) : 0,
    attritionRatePct: visited > 0 ? Number(((attrition / visited) * 100).toFixed(1)) : 0,
    unpaidRatePct: totalDemand > 0 ? Number(((issuedUnpaid / totalDemand) * 100).toFixed(1)) : 0,
    refundRatePct: visited > 0 ? Number(((refunded / visited) * 100).toFixed(1)) : 0,
  };
}

export interface DoctorMetrics {
  examinationRatePct: number;
  attritionRatePct: number;
}

/**
 * Calculates per-doctor examination and attrition rate percentages.
 */
export function calculateDoctorMetrics(doctor: DoctorVolumeOut): DoctorMetrics {
  const visited = doctor.visited || 0;
  const examined = doctor.examined || 0;
  const attrition = doctor.attrition || 0;

  return {
    examinationRatePct: visited > 0 ? Number(((examined / visited) * 100).toFixed(1)) : 0,
    attritionRatePct: visited > 0 ? Number(((attrition / visited) * 100).toFixed(1)) : 0,
  };
}

export interface PnlSummaryMetrics {
  profitMarginPct: number;
  operatingExpenseRatio: number;
  netCashCollected: number;
  isProfitable: boolean;
}

/**
 * Summarizes executive P&L performance indicators from ledger flash.
 */
export function summarizePnlFlash(flash: PnlFlashOut): PnlSummaryMetrics {
  const netIncome = flash.net_income || 0;
  const totalExpenses = flash.total_expenses || 0;
  const netProfit = flash.net_profit || 0;
  const cashCollected = flash.cash?.cash_collected || 0;
  const paidBack = flash.cash?.paid_back || 0;

  return {
    profitMarginPct: netIncome > 0 ? Number(((netProfit / netIncome) * 100).toFixed(1)) : 0,
    operatingExpenseRatio: netIncome > 0 ? Number(((totalExpenses / netIncome) * 100).toFixed(1)) : 0,
    netCashCollected: cashCollected - paidBack,
    isProfitable: netProfit >= 0,
  };
}

export interface TrialBalanceSummary {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  variance: number;
  totalsByType: Record<string, { debit: number; credit: number; balance: number }>;
}

/**
 * Summarizes Trial Balance rows, checking debit-credit equality across ledger accounts.
 */
export function summarizeTrialBalance(rows: TrialBalanceRowOut[]): TrialBalanceSummary {
  let totalDebits = 0;
  let totalCredits = 0;
  const totalsByType: Record<string, { debit: number; credit: number; balance: number }> = {};

  for (const row of rows) {
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    const balance = Number(row.balance) || 0;

    totalDebits += debit;
    totalCredits += credit;

    const type = row.type || "Other";
    if (!totalsByType[type]) {
      totalsByType[type] = { debit: 0, credit: 0, balance: 0 };
    }
    totalsByType[type].debit += debit;
    totalsByType[type].credit += credit;
    totalsByType[type].balance += balance;
  }

  const variance = Math.abs(totalDebits - totalCredits);

  return {
    totalDebits: Number(totalDebits.toFixed(2)),
    totalCredits: Number(totalCredits.toFixed(2)),
    isBalanced: variance < 0.01,
    variance: Number(variance.toFixed(2)),
    totalsByType,
  };
}

/**
 * Validates date range input (YYYY-MM-DD). Ensures from <= to.
 */
export function validateDateRange(
  dateFrom?: string | null,
  dateTo?: string | null
): { valid: boolean; error?: string } {
  if (!dateFrom && !dateTo) return { valid: true };

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateFrom && !isoRegex.test(dateFrom)) {
    return { valid: false, error: "Invalid date_from format. Expected YYYY-MM-DD." };
  }
  if (dateTo && !isoRegex.test(dateTo)) {
    return { valid: false, error: "Invalid date_to format. Expected YYYY-MM-DD." };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { valid: false, error: "date_from cannot be later than date_to." };
  }

  return { valid: true };
}

/**
 * Validates days parameter for trend endpoint (1 to 92 days).
 */
export function validateTrendDays(days: number): { valid: boolean; error?: string } {
  if (typeof days !== "number" || isNaN(days)) {
    return { valid: false, error: "Days must be a valid integer." };
  }
  if (days < 1 || days > 92) {
    return { valid: false, error: "Days must be between 1 and 92." };
  }
  return { valid: true };
}
