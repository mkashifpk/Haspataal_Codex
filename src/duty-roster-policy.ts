/**
 * Domain policy and statutory business rules for Duty Rosters & Shift Patterns (Screen 148, workspace: hr).
 *
 * Statutory Rules:
 * - rule:50af6ba770: Week grid: one row per shift pattern (GET /rosters/staff → shift_patterns), one column per day; drag staff from left column onto a cell. Save with POST /rosters (all or nothing: on an error, highlight details.entry_index).
 * - rule:7ee9e5cda4: Grey out the days in each person's `leave`; ROSTER_CONFLICT means the person already works an overlapping shift (a night shift runs into the next morning).
 * - rule:2e75984ff7: Mark public holidays (GET /rosters/staff → holidays): rostering on them is allowed, and rostered staff work as rostered.
 * - rule:e255d6b71a: Edit with PATCH (send row_version as expected_version), never delete: cancel with a reason.
 * - rule:cbd240746c: Past days are read-only unless you are HR (ROSTER_DATE_CLOSED).
 * - rule:4ea9d4f624: Hospital works every day: Sunday is a column like any other; staff with fixed schedule show weekly day off (default_weekly_off_days) greyed; rostering them that day makes it a working day.
 * - rule:f72ed8bfcb: 'Repeat last week' = POST /rosters/copy; show `skipped` list with reasons. Offer 'Repeat, moving everyone's days on' (rotate_days: 1).
 * - rule:fb45bf026f: Week check panel (GET /rosters/week): NoRestDay in amber (each day beyond allowance is paid as extra duty), NotRostered in grey; row of counts per day and shift from `days`.
 * - rule:83718fc56e: Swaps tab: GET /rosters/swaps (Accepted = both colleagues agreed, waiting for you) → Approve, or Reject with a reason. Record swap (POST /rosters/swaps) for staff without login. You never decide a swap you are part of (SWAP_SELF_APPROVAL).
 * - rule:6e21482f49: Keep grid live with roster.changed event, swaps tab with roster.swap.updated.
 * - rule:f0c97c644e: Shift patterns are the rows of the grid; create them here first (POST /hr/shift-patterns).
 */

import type {
  RosterableStaffOut,
  HolidayBriefOut,
  EntryIn,
  CopyIn,
  SwapIn,
  DutySwapOut,
  ShiftPatternIn,
} from "./generated/duty_roster_hr";

export type DutyRosterCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface DutyRosterCapabilityView {
  mode: DutyRosterCapabilityMode;
  canViewRoster: boolean;
  canManageRoster: boolean;
  canCopyRoster: boolean;
  canManageSwaps: boolean;
  canManageShiftPatterns: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getDutyRosterCapabilityView(establishment?: any): DutyRosterCapabilityView {
  const screens: string[] = establishment?.views?.screens || [];
  const hasRoster = screens.length === 0 || screens.includes("duty_roster_hr") || screens.includes("duty_roster");

  if (!hasRoster) {
    return {
      mode: "hidden",
      canViewRoster: false,
      canManageRoster: false,
      canCopyRoster: false,
      canManageSwaps: false,
      canManageShiftPatterns: false,
      noticeEn: "Duty rosters workspace is hidden in current facility configuration.",
      noticeUr: "موجودہ سہولت کی تشکیل میں ڈیوٹی روسٹر کا ورک اسپیس پوشیدہ ہے۔",
    };
  }

  const isRecordsOnly = Boolean(establishment?.views?.records_only);
  const isOpenWorkOnly = Boolean(establishment?.views?.open_work_only);
  const isSetupOnly = Boolean(establishment?.views?.setup_only);

  if (isRecordsOnly) {
    return {
      mode: "records",
      canViewRoster: true,
      canManageRoster: false,
      canCopyRoster: false,
      canManageSwaps: false,
      canManageShiftPatterns: false,
      noticeEn: "Records Mode: Reviewing published rosters and historical duties in read-only mode.",
      noticeUr: "صرف ریکارڈ موڈ: شائع شدہ روسٹرز اور تاریخی ڈیوٹیوں کا جائزہ صرف مطالعہ کے لیے کھلا ہے۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canViewRoster: true,
      canManageRoster: true,
      canCopyRoster: true,
      canManageSwaps: true,
      canManageShiftPatterns: false,
      noticeEn: "Restricted Mode: Operational shift planning and swaps active; pattern configuration locked.",
      noticeUr: "محدود موڈ: آپریشنل شفٹ پلاننگ اور تبادلہ فعال ہے؛ شفٹ پیٹرن سیٹ اپ مقفل ہے۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canViewRoster: true,
      canManageRoster: false,
      canCopyRoster: false,
      canManageSwaps: false,
      canManageShiftPatterns: true,
      noticeEn: "Setup Mode: Shift pattern creation and template definition active.",
      noticeUr: "سیٹ اپ موڈ: شفٹ پیٹرن کی تخلیق اور ٹیمپلیٹس کا سیٹ اپ فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canViewRoster: true,
    canManageRoster: true,
    canCopyRoster: true,
    canManageSwaps: true,
    canManageShiftPatterns: true,
  };
}

export interface DayColInfo {
  date: string; // YYYY-MM-DD
  dayName: string; // Mon, Tue ...
  dayNameUr: string;
  dayNumber: number; // Day of month (e.g. 27)
  weekday: number; // ISO weekday: 1 = Mon ... 7 = Sun
  isSunday: boolean;
  isToday: boolean;
}

/**
 * Calculates 7 consecutive days starting from Monday for a given week date.
 */
export function getWeekDates(weekOf?: string | Date): {
  weekStart: string;
  weekEnd: string;
  days: DayColInfo[];
} {
  const base = weekOf ? new Date(weekOf) : new Date();
  if (isNaN(base.getTime())) {
    throw new Error("Invalid date provided for week calculation.");
  }

  // Get current day of week (0 is Sunday, 1 is Monday ... 6 is Saturday)
  const day = base.getDay();
  // Calculate distance to previous Monday (ISO weekday 1)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const days: DayColInfo[] = [];
  const todayStr = new Date().toISOString().split("T")[0];

  const dayNamesEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayNamesUr = ["پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const weekday = i + 1; // 1 to 7

    days.push({
      date: dateStr,
      dayName: dayNamesEn[i],
      dayNameUr: dayNamesUr[i],
      dayNumber: d.getDate(),
      weekday,
      isSunday: weekday === 7,
      isToday: dateStr === todayStr,
    });
  }

  return {
    weekStart: days[0].date,
    weekEnd: days[6].date,
    days,
  };
}

/**
 * Rule rule:7ee9e5cda4: Check if staff member is on approved leave on given date.
 */
export function isStaffOnLeave(
  staff: RosterableStaffOut,
  date: string
): { onLeave: boolean; leaveType?: string } {
  if (!staff.leave || staff.leave.length === 0) {
    return { onLeave: false };
  }

  for (const l of staff.leave) {
    if (date >= l.from_date && date <= l.to_date) {
      return { onLeave: true, leaveType: l.leave_type };
    }
  }

  return { onLeave: false };
}

/**
 * Rule rule:4ea9d4f624: Check if weekday is staff member's default scheduled weekly off day.
 */
export function isStaffDefaultWeeklyOff(
  staff: RosterableStaffOut,
  weekday: number
): boolean {
  if (!staff.default_weekly_off_days || staff.default_weekly_off_days.length === 0) {
    return false;
  }
  return staff.default_weekly_off_days.includes(weekday);
}

/**
 * Rule rule:2e75984ff7: Check if a date is an official hospital public holiday.
 */
export function isPublicHoliday(
  holidays: HolidayBriefOut[] | undefined,
  date: string
): { isHoliday: boolean; name?: string } {
  if (!holidays || holidays.length === 0) {
    return { isHoliday: false };
  }
  const h = holidays.find((item) => item.holiday_date === date);
  return h ? { isHoliday: true, name: h.name } : { isHoliday: false };
}

/**
 * Rule rule:e255d6b71a: Validates reason for duty cancellation (mandatory minimum 3 characters).
 */
export function validateCancelDuty(reason: string): { valid: boolean; error?: string } {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { valid: false, error: "Cancellation reason is mandatory." };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: "Cancellation reason must be at least 3 characters." };
  }
  return { valid: true };
}

/**
 * Rule rule:f72ed8bfcb: Validates copy period inputs.
 */
export function validateCopyPeriod(input: CopyIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.source_from) {
    errors.source_from = "Source from date is required.";
  }
  if (!input.source_to) {
    errors.source_to = "Source to date is required.";
  }
  if (input.source_from && input.source_to && input.source_from > input.source_to) {
    errors.source_to = "Source to date must be after source from date.";
  }
  if (!input.target_from) {
    errors.target_from = "Target start date is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Rule rule:83718fc56e: Validates duty swap creation.
 */
export function validateRecordSwap(input: SwapIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.roster_id || input.roster_id <= 0) {
    errors.roster_id = "Valid duty roster entry is required.";
  }
  if (!input.covering_employee_id || input.covering_employee_id <= 0) {
    errors.covering_employee_id = "Covering staff member must be selected.";
  }
  if (!input.reason?.trim() || input.reason.trim().length < 3) {
    errors.reason = "Operational swap reason is required (minimum 3 characters).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Rule rule:83718fc56e: Check if current logged-in user may approve swap (prevent self-approval).
 */
export function canUserApproveSwap(swap: DutySwapOut, currentEmployeeId?: number | null): boolean {
  if (!currentEmployeeId) return true;
  // Rule SWAP_SELF_APPROVAL: You never decide a swap you are part of
  if (
    swap.requester_employee_id === currentEmployeeId ||
    swap.covering_employee_id === currentEmployeeId
  ) {
    return false;
  }
  return true;
}

/**
 * Rule rule:f0c97c644e: Validates shift pattern creation.
 */
export function validateShiftPattern(pattern: ShiftPatternIn): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!pattern.name?.trim()) {
    errors.name = "Shift pattern name is required (e.g. 'Morning', 'Evening', 'Night').";
  }
  if (!pattern.start_time?.trim()) {
    errors.start_time = "Start time is required (e.g. '08:00').";
  }
  if (!pattern.end_time?.trim()) {
    errors.end_time = "End time is required (e.g. '16:00').";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Bilingual error dictionary for Screen 148 duty_roster_hr.
 */
export const DUTY_ROSTER_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  ROSTER_CONFLICT: {
    en: "Shift conflict: this staff member is already assigned to an overlapping shift (a night shift extends into the next morning).",
    ur: "شفٹ کا تصادم: یہ ملازم پہلے سے اسی وقت یا رات کی متصل شفٹ میں ڈیوٹی پر مامور ہے۔",
  },
  LEAVE_CONFLICT: {
    en: "Leave conflict: the staff member has an approved leave request on this date.",
    ur: "رخصت کا تصادم: اس تاریخ پر عملے کے اس رکن کی منظور شدہ رخصت موجود ہے۔",
  },
  ROSTER_DATE_CLOSED: {
    en: "Past dates are locked: historical roster records cannot be modified without HR admin privileges.",
    ur: "ماضی کی تاریخیں مقفل ہیں: ایچ آر ایڈمن کے علاوہ پچھلی تاریخوں کا روسٹر تبدیل نہیں کیا جا سکتا۔",
  },
  SWAP_SELF_APPROVAL: {
    en: "Self-approval prohibited: you cannot decide or approve a duty swap that involves yourself (rule:83718fc56e).",
    ur: "خود منظوری ممنوع ہے: آپ اپنی ڈیوٹی کا تبادلہ خود منظور یا مسترد نہیں کر سکتے (قاعدہ: 83718fc56e)۔",
  },
  VERSION_CONFLICT: {
    en: "Concurrent modification detected: this duty was updated by another administrator. Please refresh.",
    ur: "بیک وقت ترمیم کی خرابی: اس ڈیوٹی کو کسی دوسرے ایڈمنسٹریٹر نے تبدیل کر دیا ہے۔ براہ کرم صفحہ تازہ کریں۔",
  },
  NOT_FOUND: {
    en: "Requested roster entry, shift pattern, or staff member not found.",
    ur: "ڈیوٹی روسٹر، شفٹ پیٹرن یا ملازم کا ریکارڈ نہیں ملا۔",
  },
  FORBIDDEN: {
    en: "Permission denied: 'roster.manage.all' permission required to manage duty rosters.",
    ur: "رسائی مسترد: ڈیوٹی روسٹر کا انتظام سنبھالنے کے لیے 'roster.manage.all' اجازت نامہ لازمی ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The roster request is invalid. Please check the highlighted inputs.",
    ur: "روسٹر کی درخواست غیر درست ہے۔ براہ کرم خامیوں کی تصحیح کریں۔",
  },
  NETWORK_ERROR: {
    en: "Network communication failure connecting to Haspataal server.",
    ur: "ہسپتال سرور سے رابطہ قائم نہیں ہو سکا۔ نیٹ ورک کی خرابی۔",
  },
};
