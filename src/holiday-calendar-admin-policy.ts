// Holiday Calendar Admin domain policies, statutory rules, validations, and formatting
// Phase 8 Screen 152: holiday_calendar_admin (Executive & Operations Holiday Governance)

import type { HolidayIn, HolidayOut, HolidayPatch } from "./generated/holiday_calendar_admin";

export type HolidayAdminMode = "full" | "records" | "hidden";

export interface HolidayCalendarAdminCapabilityView {
  mode: HolidayAdminMode;
  reason?: string;
  canView: boolean;
  canManage: boolean;
}

export function getHolidayCalendarAdminCapabilityView(
  establishment?: any,
  userPermissions?: string[],
  userRole?: string
): HolidayCalendarAdminCapabilityView {
  const perms = new Set(userPermissions || []);
  const isAdminRole = ["hospital_admin", "clinic_director", "hospital_director", "owner"].includes(userRole || "");
  const canManage = perms.has("hr.holiday.manage") || perms.has("*") || isAdminRole;
  // Public holidays directory is accessible to all logged-in personnel
  const canView = true;

  if (establishment?.views?.screens && !establishment.views.screens.includes("holiday_calendar_admin")) {
    return {
      mode: "hidden",
      reason: "Executive holiday calendar administration is not enabled for this facility profile.",
      canView: false,
      canManage: false,
    };
  }

  const mode: HolidayAdminMode = canManage ? "full" : "records";

  return {
    mode,
    canView,
    canManage,
  };
}

export interface BatchHolidayValidationResult {
  valid: boolean;
  rowErrors: Record<number, Record<string, string>>;
  generalError?: string;
}

/**
 * Validates batch creation of gazetted holidays per rule:748c506511.
 * POST /holidays is all-or-nothing; duplicate dates within the batch or missing names fail validation.
 */
export function validateBatchHolidays(holidays: HolidayIn[]): BatchHolidayValidationResult {
  const rowErrors: Record<number, Record<string, string>> = {};

  if (!Array.isArray(holidays) || holidays.length === 0) {
    return {
      valid: false,
      rowErrors: {},
      generalError: "At least one holiday must be entered in the batch.",
    };
  }

  const seenDates = new Map<string, number>();

  holidays.forEach((item, index) => {
    const errors: Record<string, string> = {};

    if (!item.holiday_date || !/^\d{4}-\d{2}-\d{2}$/.test(item.holiday_date.trim())) {
      errors.holiday_date = "A valid holiday date in YYYY-MM-DD format is required.";
    } else {
      const dateStr = item.holiday_date.trim();
      if (seenDates.has(dateStr)) {
        errors.holiday_date = `Duplicate date within this batch (also listed in entry #${seenDates.get(dateStr)! + 1}).`;
      } else {
        seenDates.set(dateStr, index);
      }
    }

    if (!item.name || item.name.trim().length < 2) {
      errors.name = "Holiday name/occasion is required (minimum 2 characters).";
    }

    if (Object.keys(errors).length > 0) {
      rowErrors[index] = errors;
    }
  });

  return {
    valid: Object.keys(rowErrors).length === 0,
    rowErrors,
  };
}

export interface HolidayPatchValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates editing or withdrawing a public holiday per rule:6b35ae8101.
 * Entries are never deleted; withdraws use is_active: false and require expected_version.
 */
export function validateHolidayPatch(patch: HolidayPatch): HolidayPatchValidationResult {
  const errors: Record<string, string> = {};

  if (patch.expected_version === undefined || patch.expected_version === null || patch.expected_version < 0) {
    errors.expected_version = "Row version (expected_version) is required for optimistic concurrency control.";
  }

  if (patch.holiday_date !== undefined && patch.holiday_date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.holiday_date.trim())) {
      errors.holiday_date = "Holiday date must be in YYYY-MM-DD format.";
    }
  }

  if (patch.name !== undefined && patch.name !== null) {
    if (patch.name.trim().length < 2) {
      errors.name = "Holiday name must be at least 2 characters.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Checks if a holiday date is today or in the past (rule:6b35ae8101).
 * Changing today or a past holiday triggers attendance recomputation.
 */
export function isPastOrTodayHoliday(holidayDate: string, todayStr?: string): boolean {
  const today = todayStr || new Date().toISOString().split("T")[0];
  return holidayDate <= today;
}

export interface MonthGroup {
  monthKey: string;
  monthNameEn: string;
  monthNameUr: string;
  holidays: HolidayOut[];
}

export const MONTH_NAMES_BILINGUAL: { num: number; en: string; ur: string }[] = [
  { num: 1, en: "January", ur: "جنوری" },
  { num: 2, en: "February", ur: "فروری" },
  { num: 3, en: "March", ur: "مارچ" },
  { num: 4, en: "April", ur: "اپریل" },
  { num: 5, en: "May", ur: "مئی" },
  { num: 6, en: "June", ur: "جون" },
  { num: 7, en: "July", ur: "جولائی" },
  { num: 8, en: "August", ur: "اگست" },
  { num: 9, en: "September", ur: "ستمبر" },
  { num: 10, en: "October", ur: "اکتوبر" },
  { num: 11, en: "November", ur: "نومبر" },
  { num: 12, en: "December", ur: "دسمبر" },
];

/**
 * Groups holidays by month for executive calendar navigation.
 */
export function groupHolidaysByMonth(holidays: HolidayOut[]): MonthGroup[] {
  const groups = new Map<number, HolidayOut[]>();

  for (let m = 1; m <= 12; m++) {
    groups.set(m, []);
  }

  for (const h of holidays) {
    const parts = h.holiday_date.split("-");
    if (parts.length >= 2) {
      const monthNum = parseInt(parts[1], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        groups.get(monthNum)!.push(h);
      }
    }
  }

  const result: MonthGroup[] = [];
  for (const mInfo of MONTH_NAMES_BILINGUAL) {
    const list = groups.get(mInfo.num) || [];
    list.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    result.push({
      monthKey: `${mInfo.num}`,
      monthNameEn: mInfo.en,
      monthNameUr: mInfo.ur,
      holidays: list,
    });
  }

  return result;
}

export const HOLIDAY_ADMIN_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  HOLIDAY_DATE_TAKEN: {
    en: "A public holiday is already registered on this date. Dates must be unique.",
    ur: "اس تاریخ پر سرکاری تعطیل پہلے سے درج ہے۔ تاریخیں منفرد ہونی چاہیئں۔",
  },
  VERSION_CONFLICT: {
    en: "This holiday record was modified by another administrator. Please refresh and retry.",
    ur: "یہ تعطیل کسی دوسرے منتظم کی طرف سے تبدیل ہو چکی ہے۔ براہ کرم صفحہ تازہ کر کے دوبارہ کوشش کریں۔",
  },
  VALIDATION_ERROR: {
    en: "Validation failed: please check date format and holiday names.",
    ur: "توثیق ناکام: برائے مہربانی تاریخ کا فارمیٹ اور تعطیل کا نام چیک کریں۔",
  },
  FORBIDDEN: {
    en: "You lack administrative authorization to manage public holidays (hr.holiday.manage required).",
    ur: "آپ کے پاس سرکاری تعطیلات کے انتظام کی اجازت نہیں ہے (hr.holiday.manage درکار ہے)۔",
  },
  NOT_FOUND: {
    en: "Holiday record not found.",
    ur: "تعطیل کا ریکارڈ نہیں ملا۔",
  },
  NETWORK_ERROR: {
    en: "Network error: unable to connect to holiday calendar server.",
    ur: "نیٹ ورک کی خرابی: چھٹیوں کے سرور سے رابطہ نہیں ہو سکا۔",
  },
};
