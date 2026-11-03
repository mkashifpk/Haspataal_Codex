/**
 * Domain policy and business rules for Screen 155: payroll
 * (Staff payroll processing, salary slips, deductions & tax statements)
 *
 * Rules:
 * - rule:0cf7ae94dd: Show the formula per employee: Base − Unpaid absences − Internal credit + Commissions + Extra duty = Net.
 * - rule:e846dec8a2: Extra duty: scheduled duties worked beyond the weekly allowance (a seven-day week),
 *                    paid at extra_duty_day_pay_rate × a day's pay; the payslip line lists the dates.
 */

export interface SessionInfo {
  user_id?: number;
  employee_id?: number | null;
  username?: string;
  roles?: string[];
  permissions?: string[];
}

export interface Establishment {
  services?: Array<{ code: string; status: string }>;
  views?: {
    screens?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

import type { PayrollRunItemOut, PayslipOut } from "./generated/payroll";

export interface PayrollCapabilityView {
  mode: "full" | "records" | "hidden";
  canRun: boolean;
  canView: boolean;
  canFinalize: boolean;
  canMarkPaid: boolean;
  canCancel: boolean;
  reason?: string;
}

/**
 * Resolves capability view based on permissions and service capability gates.
 * - Full: holders of `hr.payroll.run` (can generate, finalize, mark paid, cancel)
 * - Records: holders of `hr.payroll.view` (can view list, run details, payslips)
 * - Hidden: unauthorized users
 */
export function getPayrollCapabilityView(
  session: SessionInfo | null,
  establishment?: Establishment | null
): PayrollCapabilityView {
  if (!session || !session.roles) {
    return {
      mode: "hidden",
      canRun: false,
      canView: false,
      canFinalize: false,
      canMarkPaid: false,
      canCancel: false,
      reason: "Authentication required",
    };
  }

  // Check establishment service capability gate if present
  const hrService = establishment?.services?.find((s: any) => s.code === "hr" || s.code === "payroll");
  if (hrService && hrService.status === "Inactive") {
    return {
      mode: "hidden",
      canRun: false,
      canView: false,
      canFinalize: false,
      canMarkPaid: false,
      canCancel: false,
      reason: "Payroll service is currently inactive in this facility",
    };
  }

  const permissions = session.permissions || [];
  const canRun = permissions.includes("hr.payroll.run") || session.roles.includes("hr_admin");
  const canView =
    canRun ||
    permissions.includes("hr.payroll.view") ||
    session.roles.includes("hr_admin") ||
    session.roles.includes("accountant");

  if (!canView) {
    return {
      mode: "hidden",
      canRun: false,
      canView: false,
      canFinalize: false,
      canMarkPaid: false,
      canCancel: false,
      reason: "User lacks hr.payroll.view or hr.payroll.run permission",
    };
  }

  if (canRun) {
    return {
      mode: "full",
      canRun: true,
      canView: true,
      canFinalize: true,
      canMarkPaid: true,
      canCancel: true,
    };
  }

  return {
    mode: "records",
    canRun: false,
    canView: true,
    canFinalize: false,
    canMarkPaid: false,
    canCancel: false,
  };
}

/**
 * Evaluates rule:0cf7ae94dd:
 * Base − Unpaid absences − Internal credit + Commissions + Extra duty = Net
 */
export interface PayrollFormulaBreakdown {
  baseSalary: number;
  unpaidAbsenceDeduction: number;
  internalCreditDeduction: number;
  commissions: number;
  extraDutyPay: number;
  otherAdditions: number;
  otherDeductions: number;
  calculatedNet: number;
  reportedNet: number;
  isBalanced: boolean;
  formulaString: string;
  formulaStringUr: string;
}

export function calculateEmployeePayrollFormula(
  item: PayrollRunItemOut | PayslipOut
): PayrollFormulaBreakdown {
  const baseSalary = Number(item.base_salary || 0);
  const unpaidAbsenceDeduction = Number(item.unpaid_absence_deduction || 0);
  const internalCreditDeduction = Number(item.internal_credit_deduction || 0);
  const commissions = Number(item.accrued_commissions || 0);
  const extraDutyPay = Number(item.extra_duty_pay || 0);
  const otherAdditions = Number(item.other_additions || 0);
  const otherDeductions = Number(item.other_deductions || 0);
  const reportedNet = Number(item.net_payable || 0);

  // Formula: Base - Unpaid Absences - Internal Credit + Commissions + Extra Duty (+ Other Additions - Other Deductions)
  const calculatedNet = Math.round(
    (baseSalary -
      unpaidAbsenceDeduction -
      internalCreditDeduction +
      commissions +
      extraDutyPay +
      otherAdditions -
      otherDeductions) *
      100
  ) / 100;

  // Verify against reportedNet within 1 cent tolerance
  const isBalanced = Math.abs(calculatedNet - reportedNet) < 0.05;

  const formulaString = `Rs. ${baseSalary.toLocaleString()} (Base) − Rs. ${unpaidAbsenceDeduction.toLocaleString()} (Unpaid Absences) − Rs. ${internalCreditDeduction.toLocaleString()} (Internal Credit) + Rs. ${commissions.toLocaleString()} (Commissions) + Rs. ${extraDutyPay.toLocaleString()} (Extra Duty) = Rs. ${reportedNet.toLocaleString()} (Net)`;
  const formulaStringUr = `روپے ${baseSalary.toLocaleString()} (بنیادی) − روپے ${unpaidAbsenceDeduction.toLocaleString()} (غیر حاضریاں) − روپے ${internalCreditDeduction.toLocaleString()} (اندرونی ادھار) + روپے ${commissions.toLocaleString()} (کمیشن) + روپے ${extraDutyPay.toLocaleString()} (اضافی ڈیوٹی) = روپے ${reportedNet.toLocaleString()} (خالص)`;

  return {
    baseSalary,
    unpaidAbsenceDeduction,
    internalCreditDeduction,
    commissions,
    extraDutyPay,
    otherAdditions,
    otherDeductions,
    calculatedNet,
    reportedNet,
    isBalanced,
    formulaString,
    formulaStringUr,
  };
}

/**
 * Evaluates rule:e846dec8a2:
 * Extra duty: scheduled duties worked beyond the weekly allowance (a seven-day week),
 * paid at extra_duty_day_pay_rate × a day's pay; the payslip line lists the dates.
 */
export function explainExtraDutyCalculation(
  extraDutyDays: number,
  baseSalary: number,
  periodDays: number = 30,
  extraDutyRate: number = 1.0
): {
  daysPay: number;
  calculatedPay: number;
  explanationEn: string;
  explanationUr: string;
} {
  const days = Math.max(0, extraDutyDays);
  const effectivePeriodDays = periodDays > 0 ? periodDays : 30;
  const daysPay = Math.round((baseSalary / effectivePeriodDays) * 100) / 100;
  const calculatedPay = Math.round(days * daysPay * extraDutyRate * 100) / 100;

  const explanationEn = `${days} extra duty day(s) worked beyond weekly rest allowance at ${extraDutyRate}× rate (Rs. ${daysPay}/day) = Rs. ${calculatedPay.toLocaleString()}`;
  const explanationUr = `${days} اضافی ڈیوٹی دن ہفتہ وار چھٹی سے زائد شرح ${extraDutyRate}× پر (روپے ${daysPay}/روز) = روپے ${calculatedPay.toLocaleString()}`;

  return {
    daysPay,
    calculatedPay,
    explanationEn,
    explanationUr,
  };
}

/**
 * Validates payroll generation input.
 */
export function validateGeneratePayrollForm(periodStart: string, periodEnd: string): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!periodStart || !periodStart.trim()) {
    errors.period_start = "Period start date is required.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart.trim())) {
    errors.period_start = "Start date must be in YYYY-MM-DD format.";
  }

  if (!periodEnd || !periodEnd.trim()) {
    errors.period_end = "Period end date is required.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd.trim())) {
    errors.period_end = "End date must be in YYYY-MM-DD format.";
  }

  if (!errors.period_start && !errors.period_end) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (start > end) {
      errors.period_end = "Period end date cannot be earlier than start date.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates cancellation input.
 */
export function validateCancelRunForm(reason: string): {
  valid: boolean;
  error?: string;
} {
  if (!reason || reason.trim().length < 3) {
    return {
      valid: false,
      error: "Cancellation reason must be at least 3 characters.",
    };
  }
  if (reason.trim().length > 500) {
    return {
      valid: false,
      error: "Cancellation reason cannot exceed 500 characters.",
    };
  }
  return { valid: true };
}

/**
 * Validates marking paid input.
 */
export function validateMarkPaidForm(method?: string): {
  valid: boolean;
  error?: string;
} {
  if (method && method !== "BankTransfer" && method !== "Cash") {
    return {
      valid: false,
      error: "Payment method must be either BankTransfer or Cash.",
    };
  }
  return { valid: true };
}

/**
 * Status badge formatting for payroll run statuses.
 */
export function formatPayrollRunStatusBadge(status: string): {
  label: string;
  labelUr: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "Generated":
      return {
        label: "Generated",
        labelUr: "تیار شدہ",
        color: "#b45309",
        bg: "#fef3c7",
      };
    case "Finalized":
      return {
        label: "Finalized",
        labelUr: "حتمی منظور شدہ",
        color: "#1d4ed8",
        bg: "#dbeafe",
      };
    case "Paid":
      return {
        label: "Paid",
        labelUr: "ادا شدہ",
        color: "#15803d",
        bg: "#dcfce7",
      };
    case "Cancelled":
      return {
        label: "Cancelled",
        labelUr: "منسوخ شدہ",
        color: "#b91c1c",
        bg: "#fee2e2",
      };
    default:
      return {
        label: status || "Unknown",
        labelUr: status || "نامعلوم",
        color: "#475569",
        bg: "#f1f5f9",
      };
  }
}

/**
 * Bilingual statutory error messages.
 */
export const PAYROLL_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string; actionEn: string; actionUr: string }
> = {
  PAYROLL_ALREADY_GENERATED: {
    en: "A payroll run already covers some of these dates: cancel it first.",
    ur: "ان تاریخوں کے لیے پے رول پہلے سے موجود ہے: پہلے اسے منسوخ کریں۔",
    actionEn: "Check existing runs or adjust the date range.",
    actionUr: "موجودہ پے رول چیک کریں یا تاریخوں کا انتخاب تبدیل کریں۔",
  },
  PAYROLL_RUN_PENDING: {
    en: "Another payroll run is waiting to be finalized: finalize or cancel it first.",
    ur: "ایک اور پے رول رن حتمی منظوری کے انتظار میں ہے: پہلے اسے فائنل یا منسوخ کریں۔",
    actionEn: "Review the open run before generating a new period.",
    actionUr: "نیا رن تیار کرنے سے پہلے کھلے رن کا جائزہ لیں۔",
  },
  PAYROLL_SOURCE_CONSUMED: {
    en: "Some attendance, credits or commissions in this run were consumed by another finalized run.",
    ur: "اس رن کی کچھ حاضری، کریڈٹ یا کمیشن کسی اور حتمی رن میں استعمال ہو چکے ہیں۔",
    actionEn: "Refresh the payroll run to synchronize updated balances.",
    actionUr: "بیلنسز کو تازہ کرنے کے لیے پے رول رن کو ریفریش کریں۔",
  },
  PAYROLL_STATE_INVALID: {
    en: "Action is invalid for the current run status.",
    ur: "موجودہ پے رول رن کی حالت کے لیے یہ کارروائی نااہل ہے۔",
    actionEn: "Only Generated runs can be finalized/cancelled, and only Finalized runs can be marked paid.",
    actionUr: "صرف تیار شدہ رن کو فائنل/منسوخ کیا جا سکتا ہے اور فائنل رن کو ادا شدہ کیا جا سکتا ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request data is invalid.",
    ur: "درخواست کا ڈیٹا درست نہیں ہے۔",
    actionEn: "Check the entered fields and formats.",
    actionUr: "درج کردہ خانے اور فارمیٹس کی تصدیق کریں۔",
  },
};
