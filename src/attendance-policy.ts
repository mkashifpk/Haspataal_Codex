// Attendance domain policy, statutory rules, validations, and formatting
// Phase 8 Screen 150: attendance (Staff attendance, punches & timecards)

export type AttendanceMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface AttendanceCapabilityView {
  mode: AttendanceMode;
  reason?: string;
  canView: boolean;
  canCorrect: boolean;
  canCompute: boolean;
  canManageShift: boolean;
  canRollCall: boolean;
}

export function getAttendanceCapabilityView(establishment?: any, userPermissions?: string[]): AttendanceCapabilityView {
  const perms = new Set(userPermissions || []);
  const canView = perms.has("hr.attendance.view") || perms.has("*");
  const canCorrect = perms.has("hr.attendance.manual") || perms.has("*");
  const canCompute = perms.has("hr.attendance.view") || perms.has("*");
  const canManageShift = perms.has("hr.shift.manage") || perms.has("*");
  const canRollCall = perms.has("attendance.roll_call") || perms.has("*");

  // Check establishment screen visibility if provided
  if (establishment?.views?.screens && !establishment.views.screens.includes("attendance")) {
    return {
      mode: "hidden",
      reason: "Attendance module is not enabled for this facility profile.",
      canView: false,
      canCorrect: false,
      canCompute: false,
      canManageShift: false,
      canRollCall: false,
    };
  }

  if (!canView && !canRollCall) {
    return {
      mode: "hidden",
      reason: "Missing hr.attendance.view or attendance.roll_call permission.",
      canView: false,
      canCorrect: false,
      canCompute: false,
      canManageShift: false,
      canRollCall: false,
    };
  }

  let mode: AttendanceMode = "full";
  if (!canCorrect && !canManageShift) {
    mode = "records";
  }

  return {
    mode,
    canView,
    canCorrect,
    canCompute,
    canManageShift,
    canRollCall,
  };
}

export interface ManualPunchValidationInput {
  employee_id: number;
  punch_time: string;
  reason: string;
  attendance_date?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates manual punch correction input per rule:7e57360f0f and rule:57ff2b4a55.
 * Manual corrections must always carry a documented reason (min 3 characters).
 */
export function validateManualPunch(input: ManualPunchValidationInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.employee_id || input.employee_id <= 0) {
    errors.employee_id = "Please select an employee.";
  }

  if (!input.punch_time || !input.punch_time.trim()) {
    errors.punch_time = "Punch timestamp is required.";
  } else {
    const d = new Date(input.punch_time);
    if (isNaN(d.getTime())) {
      errors.punch_time = "Invalid punch timestamp format.";
    }
  }

  if (!input.reason || input.reason.trim().length < 3) {
    errors.reason = "A documented reason is mandatory for manual punch corrections (minimum 3 characters).";
  }

  if (input.attendance_date && input.attendance_date.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.attendance_date.trim())) {
      errors.attendance_date = "Duty date must be in YYYY-MM-DD format.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface ShiftAssignmentValidationInput {
  employee_id: number;
  shift_pattern_id: number | null;
  effective_from: string;
  weekly_off_days?: number[] | null;
}

/**
 * Validates default shift assignment per rule:e3a5ef53f8 and rule:edc1438113.
 * - Staff planned on the roster should have no default shift (shift_pattern_id: null).
 * - If a default shift is assigned, weekly_off_days is required (array of ISO weekdays 1..7).
 */
export function validateShiftAssignment(input: ShiftAssignmentValidationInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.employee_id || input.employee_id <= 0) {
    errors.employee_id = "Please select an employee.";
  }

  if (!input.effective_from || !/^\d{4}-\d{2}-\d{2}$/.test(input.effective_from.trim())) {
    errors.effective_from = "Effective from date is required (YYYY-MM-DD).";
  }

  if (input.shift_pattern_id !== null && input.shift_pattern_id !== undefined) {
    if (input.shift_pattern_id <= 0) {
      errors.shift_pattern_id = "Invalid shift pattern identifier.";
    }
    if (!Array.isArray(input.weekly_off_days)) {
      errors.weekly_off_days = "Weekly off days are required when assigning a fixed default shift.";
    } else {
      const invalidDay = input.weekly_off_days.some((d) => typeof d !== "number" || d < 1 || d > 7);
      if (invalidDay) {
        errors.weekly_off_days = "Weekly off days must be ISO weekday numbers (1 = Monday through 7 = Sunday).";
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export type AttendanceStatus = "Present" | "Late" | "Absent" | "HalfDay" | "Leave" | "Holiday" | "Off";

export interface StatusBadgeInfo {
  labelEn: string;
  labelUr: string;
  bg: string;
  border: string;
  text: string;
  descriptionEn: string;
  descriptionUr: string;
}

/**
 * Formats daily attendance status flags per statutory definitions.
 * Holiday and Off are paid rest days (rule:e3a5ef53f8).
 */
export function formatAttendanceStatusBadge(status: AttendanceStatus): StatusBadgeInfo {
  switch (status) {
    case "Present":
      return {
        labelEn: "Present",
        labelUr: "حاضر",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-emerald-200 dark:border-emerald-800",
        text: "text-emerald-700 dark:text-emerald-300",
        descriptionEn: "Staff arrived on time and fulfilled scheduled duty hours.",
        descriptionUr: "ملازم وقت پر آیا اور مقررہ ڈیوٹی کے اوقات پورے کیے۔",
      };
    case "Late":
      return {
        labelEn: "Late",
        labelUr: "دیر سے",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-200 dark:border-amber-800",
        text: "text-amber-700 dark:text-amber-300",
        descriptionEn: "Arrival exceeded shift grace period minutes.",
        descriptionUr: "آمد شفٹ کے رعایتی منٹوں کے بعد ہوئی۔",
      };
    case "Absent":
      return {
        labelEn: "Absent",
        labelUr: "غیر حاضر",
        bg: "bg-rose-50 dark:bg-rose-950/40",
        border: "border-rose-200 dark:border-rose-800",
        text: "text-rose-700 dark:text-rose-300",
        descriptionEn: "No arrival punch recorded for a scheduled working shift.",
        descriptionUr: "شیڈول شفٹ پر آمد کی کوئی انٹری ریکارڈ نہیں ہوئی۔",
      };
    case "HalfDay":
      return {
        labelEn: "Half Day",
        labelUr: "نصف دن",
        bg: "bg-yellow-50 dark:bg-yellow-950/40",
        border: "border-yellow-200 dark:border-yellow-800",
        text: "text-yellow-700 dark:text-yellow-300",
        descriptionEn: "Worked duration was between half-day threshold and full shift duration.",
        descriptionUr: "ڈیوٹی کی مدت نصف دن کے معیار کے مطابق تھی۔",
      };
    case "Leave":
      return {
        labelEn: "On Leave",
        labelUr: "رخصت",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        border: "border-blue-200 dark:border-blue-800",
        text: "text-blue-700 dark:text-blue-300",
        descriptionEn: "Approved statutory or casual leave recorded in HR.",
        descriptionUr: "ایچ آر میں منظور شدہ قانونی یا اتفاقی رخصت۔",
      };
    case "Holiday":
      return {
        labelEn: "Public Holiday",
        labelUr: "سرکاری تعطیل",
        bg: "bg-purple-50 dark:bg-purple-950/40",
        border: "border-purple-200 dark:border-purple-800",
        text: "text-purple-700 dark:text-purple-300",
        descriptionEn: "Gazetted public holiday (paid rest day).",
        descriptionUr: "سرکاری چھٹی (بامعاوضہ آرام کا دن)۔",
      };
    case "Off":
      return {
        labelEn: "Weekly Off",
        labelUr: "ہفتہ وار آرام",
        bg: "bg-slate-100 dark:bg-slate-800",
        border: "border-slate-200 dark:border-slate-700",
        text: "text-slate-600 dark:text-slate-300",
        descriptionEn: "Scheduled weekly rest day or unrostered day for roster-only staff.",
        descriptionUr: "ہفتہ وار مقررہ چھٹی یا بغیر روسٹر کا آرام کا دن۔",
      };
    default:
      return {
        labelEn: status || "Unknown",
        labelUr: "نامعلوم",
        bg: "bg-gray-100 dark:bg-gray-800",
        border: "border-gray-200 dark:border-gray-700",
        text: "text-gray-700 dark:text-gray-300",
        descriptionEn: "Status unclassified.",
        descriptionUr: "حالت واضح نہیں۔",
      };
  }
}

export type PunchSource = "Badge" | "RollCall" | "Manual";

export interface PunchSourceBadgeInfo {
  labelEn: string;
  labelUr: string;
  badgeClass: string;
}

/**
 * Returns display labels and badges for punch sources (rule:7e57360f0f).
 */
export function formatPunchSourceBadge(source: PunchSource): PunchSourceBadgeInfo {
  switch (source) {
    case "Badge":
      return {
        labelEn: "RFID Badge",
        labelUr: "آر ایف آئی ڈی بیج",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
      };
    case "RollCall":
      return {
        labelEn: "Roll Call",
        labelUr: "رول کال",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "Manual":
      return {
        labelEn: "Manual Correction",
        labelUr: "دستی تصحیح",
        badgeClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800",
      };
    default:
      return {
        labelEn: source || "Other",
        labelUr: "دیگر",
        badgeClass: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      };
  }
}

/**
 * Formats duration in minutes into clean readable Xh Ym representation.
 */
export function formatWorkedMinutes(minutes: number): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes <= 0) {
    return "0m";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats late minutes with threshold indicator.
 */
export function formatLateMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  return `${minutes} min late`;
}

/**
 * Formats a punch timestamp into clean local time string.
 */
export function formatPunchTime(punchTimeStr: string | null): string {
  if (!punchTimeStr) return "—";
  try {
    const d = new Date(punchTimeStr);
    if (isNaN(d.getTime())) return punchTimeStr;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return punchTimeStr;
  }
}

export const ISO_WEEKDAY_NAMES = [
  { day: 1, nameEn: "Monday", nameUr: "پیر" },
  { day: 2, nameEn: "Tuesday", nameUr: "منگل" },
  { day: 3, nameEn: "Wednesday", nameUr: "بدھ" },
  { day: 4, nameEn: "Thursday", nameUr: "جمعرات" },
  { day: 5, nameEn: "Friday", nameUr: "جمعہ" },
  { day: 6, nameEn: "Saturday", nameUr: "ہفتہ" },
  { day: 7, nameEn: "Sunday", nameUr: "اتوار" },
];

export const ATTENDANCE_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  PUNCH_OUT_OF_RANGE: {
    en: "Punch timestamp is out of the permissible attendance window (must be within shift boundaries).",
    ur: "پنچ کا وقت حاضری کی اجازت یافتہ مدت سے باہر ہے (شفٹ کی حدود میں ہونا ضروری ہے)۔",
  },
  PUNCH_DUPLICATE: {
    en: "A punch for this employee at this exact timestamp already exists.",
    ur: "اس ملازم کا اس عین وقت پر پنچ پہلے سے موجود ہے۔",
  },
  PUNCH_DATE_CLOSED: {
    en: "Attendance records for this date have been finalized and closed by payroll.",
    ur: "اس تاریخ کے حاضری کے ریکارڈ تنخواہ کی پروسیسنگ کے لیے بند ہو چکے ہیں۔",
  },
  SHIFT_OVERLAP: {
    en: "The effective shift assignment overlaps with an existing roster schedule.",
    ur: "مقررہ شفٹ کی تاریخیں موجودہ روسٹر شیڈول سے متصادم ہیں۔",
  },
  EMPLOYEE_NOT_FOUND: {
    en: "The specified employee record was not found.",
    ur: "مطلوبہ ملازم کا ریکارڈ نہیں ملا۔",
  },
  VALIDATION_ERROR: {
    en: "Validation failed: please check required fields and retry.",
    ur: "توثیق ناکام: برائے مہربانی ضروری خانے چیک کر کے دوبارہ کوشش کریں۔",
  },
  FORBIDDEN: {
    en: "You lack administrative authorization for attendance corrections or shift assignment.",
    ur: "آپ کے پاس حاضری کی تصحیح یا شفٹ تفویض کی اجازت نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "Record not found.",
    ur: "ریکارڈ نہیں ملا۔",
  },
  NETWORK_ERROR: {
    en: "Network error: unable to connect to attendance server.",
    ur: "نیٹ ورک کی خرابی: حاضری سرور سے رابطہ نہیں ہو سکا۔",
  },
};
