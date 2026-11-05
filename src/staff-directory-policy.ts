/**
 * Domain policy and statutory business rules for Staff Directory (Screen 145, workspace: hr).
 * Statutory Rules:
 * - rule:f57cfa01c4: Suspend / resign / terminate revokes the login and every badge at once: confirm with the reason.
 * - rule:83e8fefdaf: Set opening, accrued and carried-forward leave per type and year; leave requests are checked against them.
 * - rule:2cc308be05: Offer the status actions by employment_status:
 *     - Draft: none (finish the wizard);
 *     - Awaiting_IT_Provisioning: suspend, resign or terminate, never 'Activate' (IT's login does that);
 *     - Active: suspend, resign or terminate;
 *     - Suspended: reinstate, resign or terminate;
 *     - Resigned or Terminated: 're-join'.
 *     Show the employment_status the answer gives: someone IT never gave a login returns to Awaiting_IT_Provisioning.
 *     After a reinstatement say that IT re-enables the login and that revoked badges are issued anew.
 *     EMPLOYEE_STATUS_INVALID: show details.status and read the employee again;
 *     EMPLOYEE_DOCUMENT_REQUIRED or CLINICAL_LICENSE_REQUIRED: upload the document, then repeat.
 */

import type {
  EmploymentStatusIn,
  BalanceIn,
} from "./generated/staff_directory.ts";

export type StaffDirectoryCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface StaffDirectoryCapabilityView {
  mode: StaffDirectoryCapabilityMode;
  canViewDirectory: boolean;
  canUpdateStatus: boolean;
  canManageLeaveBalances: boolean;
  canViewOrgChart: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getStaffDirectoryCapabilityView(establishment?: any,permissions:readonly string[]=[]): StaffDirectoryCapabilityView {
  const screens=establishment?.views?.screens;
  // This is a core HR screen; the service view list normally omits it. Honour
  // explicit overrides, and wait for establishment data before offering work.
  const view=Array.isArray(screens)?screens.find((screen:any)=>screen.screen_id==='staff_directory')?.view??'full':'hidden';
  const hasDirectory = view!=='hidden'&&permissions.includes('hr.employee.view');
  const canUpdateStatus=permissions.includes('hr.employee.update');
  const canManageLeaveBalances=permissions.includes('hr.leave.manage');

  if (!hasDirectory) {
    return {
      mode: "hidden",
      canViewDirectory: false,
      canUpdateStatus: false,
      canManageLeaveBalances: false,
      canViewOrgChart: false,
      noticeEn: "Staff directory workspace is hidden in current facility configuration.",
      noticeUr: "موجودہ سہولت کی تشکیل میں عملے کی ڈائریکٹری پوشیدہ ہے۔",
    };
  }

  const isRecordsOnly = view==='records';
  const isOpenWorkOnly = view==='open_work';
  const isSetupOnly = view==='setup';

  if (isRecordsOnly) {
    return {
      mode: "records",
      canViewDirectory: true,
      canUpdateStatus: false,
      canManageLeaveBalances: false,
      canViewOrgChart: true,
      noticeEn: "Records Mode: Reviewing hospital staff directory and credentials in read-only mode.",
      noticeUr: "صرف ریکارڈ موڈ: عملے کی ڈائریکٹری اور اسناد صرف مطالعہ کے لیے کھلی ہیں۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canViewDirectory: true,
      canUpdateStatus,
      canManageLeaveBalances: false,
      canViewOrgChart: true,
      noticeEn: "Restricted Mode: Managing operational staff statuses; policy and leave allocation adjustments restricted.",
      noticeUr: "محدود موڈ: ملازمین کی آپریشنل حالت کا انتظام؛ رخصتوں کا تعین محدود ہے۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canViewDirectory: true,
      canUpdateStatus: false,
      canManageLeaveBalances,
      canViewOrgChart: true,
      noticeEn: "Setup Mode: Initial annual leave balance configuration active.",
      noticeUr: "سیٹ اپ موڈ: سالانہ رخصتوں کے ابتدائی بیلنس کی ترتیب فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canViewDirectory: true,
    canUpdateStatus,
    canManageLeaveBalances,
    canViewOrgChart: true,
  };
}

export type EmploymentStatus =
  | "Draft"
  | "Awaiting_IT_Provisioning"
  | "Active"
  | "Suspended"
  | "Resigned"
  | "Terminated";

export interface StatusActionOption {
  targetStatus: "Active" | "Suspended" | "Resigned" | "Terminated";
  labelEn: string;
  labelUr: string;
  isRevocation: boolean;
  requiresReason: boolean;
  hintEn?: string;
  hintUr?: string;
}

/**
 * Derives allowable employment status actions per Rule rule:2cc308be05 & rule:f57cfa01c4
 */
export function getAllowedStatusActions(currentStatus: EmploymentStatus): StatusActionOption[] {
  switch (currentStatus) {
    case "Draft":
      // None: must finish the wizard
      return [];

    case "Awaiting_IT_Provisioning":
      // IT Console login creates Active; HR can only suspend, resign, or terminate
      return [
        {
          targetStatus: "Suspended",
          labelEn: "Suspend Staff",
          labelUr: "ملازمت معطل کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Temporarily suspends profile before IT provisioning.",
          hintUr: "آئی ٹی فراہمی سے قبل عارضی معطلی۔",
        },
        {
          targetStatus: "Resigned",
          labelEn: "Record Resignation",
          labelUr: "استعفیٰ درج کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Employee withdrew before joining.",
          hintUr: "ملازم شمولیت سے قبل الگ ہو گیا۔",
        },
        {
          targetStatus: "Terminated",
          labelEn: "Terminate Offer",
          labelUr: "پیشکش ختم کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Administrative termination before login issuance.",
          hintUr: "لاگ ان سے قبل انتظامی برخاستگی۔",
        },
      ];

    case "Active":
      return [
        {
          targetStatus: "Suspended",
          labelEn: "Suspend Staff",
          labelUr: "ملازمت معطل کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Revokes system login and all active security badges at once.",
          hintUr: "سسٹم لاگ ان اور تمام سیکیورٹی بیجز فوری منسوخ کر دیے جائیں گے۔",
        },
        {
          targetStatus: "Resigned",
          labelEn: "Record Resignation",
          labelUr: "استعفیٰ درج کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Revokes login and badges. Record last working day.",
          hintUr: "لاگ ان اور بیجز منسوخ ہوں گے۔ آخری کام کا دن درج کریں۔",
        },
        {
          targetStatus: "Terminated",
          labelEn: "Terminate Employment",
          labelUr: "ملازمت ختم کریں",
          isRevocation: true,
          requiresReason: true,
          hintEn: "Immediate termination; revokes login and all badges at once.",
          hintUr: "فوری برخاستگی؛ تمام لاگ ان اور بیجز فوری بند۔",
        },
      ];

    case "Suspended":
      return [
        {
          targetStatus: "Active",
          labelEn: "Reinstate Staff",
          labelUr: "ملازمت بحال کریں",
          isRevocation: false,
          requiresReason: true,
          hintEn: "Reinstates profile. Note: IT re-enables the login, and badges are issued anew.",
          hintUr: "ملازمت بحال۔ یاد دہانی: آئی ٹی لاگ ان فعال کرے گا اور نئے بیجز جاری ہوں گے۔",
        },
        {
          targetStatus: "Resigned",
          labelEn: "Record Resignation",
          labelUr: "استعفیٰ درج کریں",
          isRevocation: true,
          requiresReason: true,
        },
        {
          targetStatus: "Terminated",
          labelEn: "Terminate Employment",
          labelUr: "ملازمت ختم کریں",
          isRevocation: true,
          requiresReason: true,
        },
      ];

    case "Resigned":
    case "Terminated":
      return [
        {
          targetStatus: "Active",
          labelEn: "Re-join Staff",
          labelUr: "دوبارہ شامل کریں (ری جوائن)",
          isRevocation: false,
          requiresReason: true,
          hintEn: "Leaver returns. If never given a login previously, status returns to Awaiting_IT_Provisioning.",
          hintUr: "ملازم کی واپسی۔ اگر پہلے لاگ ان نہ تھا تو یہ Awaiting_IT_Provisioning پر لوٹے گا۔",
        },
      ];

    default:
      return [];
  }
}

/**
 * Validates status transition input per Rule rule:f57cfa01c4 & rule:2cc308be05
 */
export function validateStatusChangeInput(
  body: Partial<EmploymentStatusIn>,
  currentStatus: EmploymentStatus
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.status) {
    errors.status = "Target employment status is required.";
  }

  if (!body.reason || body.reason.trim().length < 3) {
    errors.reason = "Operational reason is mandatory (minimum 3 characters).";
  }

  if (body.left_on && !/^\d{4}-\d{2}-\d{2}$/.test(body.left_on)) {
    errors.left_on = "Valid date format is required (YYYY-MM-DD).";
  }

  // Verify transition is permissible
  if (body.status) {
    const allowed = getAllowedStatusActions(currentStatus);
    const isAllowed = allowed.some((a) => a.targetStatus === body.status);
    if (!isAllowed) {
      errors.status = `Cannot transition employee from '${currentStatus}' to '${body.status}' (Rule rule:2cc308be05).`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates annual leave balance configuration input per Rule rule:83e8fefdaf
 */
export function validateLeaveBalanceInput(body: Partial<BalanceIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!body.employee_id || Number(body.employee_id) <= 0) {
    errors.employee_id = "Valid employee ID is required.";
  }

  if (!body.leave_type) {
    errors.leave_type = "Leave type is required.";
  }

  const currentYear = new Date().getFullYear();
  const year = Number(body.year);
  if (!body.year || isNaN(year) || year < 2000 || year > 2100) {
    errors.year = "Valid calendar year is required (between 2000 and 2100).";
  }

  const opening = Number(body.opening ?? 0);
  if (isNaN(opening) || opening < 0) {
    errors.opening = "Opening days must be a non-negative number.";
  }

  const accrued = Number(body.accrued ?? 0);
  if (isNaN(accrued) || accrued < 0) {
    errors.accrued = "Accrued days must be a non-negative number.";
  }

  const carried = Number(body.carried_forward ?? 0);
  if (isNaN(carried) || carried < 0) {
    errors.carried_forward = "Carried forward days must be a non-negative number.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Standard bilingual error dictionary for Staff Directory
 */
export const STAFF_DIRECTORY_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string }
> = {
  EMPLOYEE_STATUS_INVALID: {
    en: "This employee cannot take that status in their current onboarding or login state (EMPLOYEE_STATUS_INVALID).",
    ur: "یہ ملازم موجودہ حالت میں یہ اسٹیٹس اختیار نہیں کر سکتا (EMPLOYEE_STATUS_INVALID)۔",
  },
  EMPLOYEE_DOCUMENT_REQUIRED: {
    en: "Mandatory CNIC or personnel verification documents are missing from the vault (EMPLOYEE_DOCUMENT_REQUIRED).",
    ur: "والٹ میں لازمی شناختی کارڈ یا تصدیقی دستاویزات غائب ہیں (EMPLOYEE_DOCUMENT_REQUIRED)۔",
  },
  CLINICAL_LICENSE_REQUIRED: {
    en: "Clinical medical/nursing personnel require a valid PMDC/PNC license number and document (CLINICAL_LICENSE_REQUIRED).",
    ur: "طبی عملے کے لیے درست پی ایم ڈی سی / پی این سی لائسنس اور دستاویز لازمی ہے (CLINICAL_LICENSE_REQUIRED)۔",
  },
  VALIDATION_ERROR: {
    en: "Validation error: please verify highlighted form fields.",
    ur: "تصدیقی خرابی: براہ کرم نمایاں کردہ خانوں کی جانچ کریں۔",
  },
  FORBIDDEN: {
    en: "Insufficient HR permissions for this staff directory operation.",
    ur: "اس کارروائی کے لیے مطلوبہ ایچ آر اختیارات ناکافی ہیں۔",
  },
  NOT_FOUND: {
    en: "The requested employee profile, document, or balance was not found.",
    ur: "مطلوبہ ملازم پروفائل، دستاویز یا بیلنس نہیں ملا۔",
  },
};
