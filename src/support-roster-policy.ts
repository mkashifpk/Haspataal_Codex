/**
 * Support-Staff Duty Roster & Roll Call Policy
 * Workspace: ops_admin | Screen: support_roster (Position 149, 94 pts)
 * 
 * Implements business rules, validation, capability gating, and bilingual error mapping for:
 * - rule:50af6ba770: Week planner grid with support staff onto zones, wards, and gates
 * - rule:7ee9e5cda4: Leave blackout ranges and ROSTER_CONFLICT detection
 * - rule:2e75984ff7: Gazetted public holidays marking with operational rostering permitted
 * - rule:e255d6b71a: Reschedule with PATCH (row_version), cancellation with documented reason
 * - rule:cbd240746c: Past dates read-only unless user has HR/admin authority
 * - rule:4ea9d4f624: 7-day operation with Sunday column and default weekly off handling
 * - rule:f72ed8bfcb: Period duplication with forward rotation (rotate_days: 1)
 * - rule:fb45bf026f: Week check KPI summary (NoRestDay in amber, staffing tallies)
 * - rule:83718fc56e: Verbal swap recording, dual control approval, SWAP_SELF_APPROVAL prevention
 * - rule:6e21482f49: Realtime event triggers (roster.changed, roster.swap.updated)
 * - rule:28262cb3f6: Support staff offline job aid (print weekly roster) & roll call presence marking
 */

import type {
  RosterableStaffOut,
  HolidayBriefOut,
  DutySwapOut,
  CopyIn,
  SwapIn,
  RollCallIn,
  RosterEntryOut,
  RollCallEntryOut
} from "./generated/support_roster";

export type CapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface WeekDayInfo {
  date: string;
  dayNameEn: string;
  dayNameUr: string;
  dayNumber: number; // 1 = Monday, 7 = Sunday
  isSunday: boolean;
}

/**
 * Resolves capability mode for the support_roster screen from establishment views.
 */
export function getSupportRosterCapabilityView(establishment?: {
  views?: { screens?: Record<string, string> };
  active?: string[];
}): CapabilityMode {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const raw = establishment.views.screens["support_roster"] || establishment.views.screens["rosters"];
  if (raw === "hidden") return "hidden";
  if (raw === "setup") return "setup";
  if (raw === "records") return "records";
  if (raw === "open_work") return "open_work";
  return "full";
}

/**
 * Returns 7 days for the given ISO week starting on Monday (ISO 8601).
 */
export function getWeekDates(mondayDateStr: string): WeekDayInfo[] {
  const parts = mondayDateStr.split("-").map(Number);
  const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayNamesEn = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayNamesUr = ["پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"];

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    days.push({
      date: `${yyyy}-${mm}-${dd}`,
      dayNameEn: dayNamesEn[i],
      dayNameUr: dayNamesUr[i],
      dayNumber: i + 1,
      isSunday: i === 6
    });
  }
  return days;
}

/**
 * Returns the current Monday as YYYY-MM-DD.
 */
export function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * rule:7ee9e5cda4: Check if staff member is on approved leave on the given date.
 */
export function isStaffOnLeave(staff: RosterableStaffOut, dateStr: string): boolean {
  if (!staff.leave || staff.leave.length === 0) return false;
  return staff.leave.some(l => dateStr >= l.from_date && dateStr <= l.to_date);
}

/**
 * rule:4ea9d4f624: Checks if the day of week matches the staff's default weekly day off.
 * default_weekly_off_days: array of ISO weekdays (1=Mon ... 7=Sun).
 */
export function isStaffDefaultWeeklyOff(staff: RosterableStaffOut, dateStr: string): boolean {
  if (!staff.default_weekly_off_days || staff.default_weekly_off_days.length === 0) return false;
  const parts = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return staff.default_weekly_off_days.includes(isoDay);
}

/**
 * rule:2e75984ff7: Checks if date is a declared public holiday.
 */
export function isPublicHoliday(holidays: HolidayBriefOut[], dateStr: string): HolidayBriefOut | undefined {
  return holidays.find(h => h.holiday_date === dateStr);
}

/**
 * rule:e255d6b71a: Validates reason for duty cancellation. Never hard delete.
 */
export function validateCancelDuty(reason: string): { valid: boolean; errorEn?: string; errorUr?: string } {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return {
      valid: false,
      errorEn: "Operational cancellation reason must be at least 3 characters.",
      errorUr: "ڈیوٹی منسوخ کرنے کی آپریشنل وجہ کم از کم 3 حروف پر مشتمل ہونی چاہیے۔"
    };
  }
  return { valid: true };
}

/**
 * rule:f72ed8bfcb: Validates copy period inputs.
 */
export function validateCopyPeriod(input: CopyIn): { valid: boolean; errorEn?: string; errorUr?: string } {
  if (!input.source_from || !input.source_to || !input.target_from) {
    return {
      valid: false,
      errorEn: "Both source range and target week start date are required.",
      errorUr: "ماخذ دورانیہ اور ہدف کے ہفتے کی شروعاتی تاریخ درکار ہے۔"
    };
  }
  if (input.source_from === input.target_from) {
    return {
      valid: false,
      errorEn: "Target week must be different from source week.",
      errorUr: "ہدف کا ہفتہ ماخذ کے ہفتے سے مختلف ہونا چاہیے۔"
    };
  }
  return { valid: true };
}

/**
 * rule:83718fc56e: Validates verbal swap registration inputs.
 */
export function validateRecordSwap(
  requesterId: number,
  coveringId: number,
  dutyRosterId: number,
  returnDutyId?: number | null
): { valid: boolean; errorEn?: string; errorUr?: string } {
  if (!requesterId || !coveringId) {
    return {
      valid: false,
      errorEn: "Both proposing and receiving staff members must be selected.",
      errorUr: "تبادلہ کرنے والے دونوں ملازمین کا انتخاب لازمی ہے۔"
    };
  }
  if (requesterId === coveringId) {
    return {
      valid: false,
      errorEn: "A staff member cannot swap a duty with themselves.",
      errorUr: "ملازم اپنی ہی ڈیوٹی اپنے ساتھ تبدیل نہیں کر سکتا۔"
    };
  }
  if (!dutyRosterId) {
    return {
      valid: false,
      errorEn: "The duty shift to be covered must be selected.",
      errorUr: "تبادلہ کے لیے شفٹ کا انتخاب لازمی ہے۔"
    };
  }
  return { valid: true };
}

/**
 * rule:83718fc56e: Prevents managerial self-approval (SWAP_SELF_APPROVAL).
 */
export function canUserApproveSwap(swap: DutySwapOut, currentEmployeeId: number | null): boolean {
  if (currentEmployeeId === null) return true;
  return swap.requester_employee_id !== currentEmployeeId && swap.covering_employee_id !== currentEmployeeId;
}

/**
 * rule:28262cb3f6: Validates roll call submission.
 */
export function validateRollCallSubmission(dateStr: string, employeeIds: number[]): {
  valid: boolean;
  payload?: RollCallIn;
  errorEn?: string;
  errorUr?: string;
} {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      valid: false,
      errorEn: "A valid roster date (YYYY-MM-DD) is required.",
      errorUr: "درست روسٹر کی تاریخ درکار ہے۔"
    };
  }
  if (!employeeIds || employeeIds.length === 0) {
    return {
      valid: false,
      errorEn: "At least one staff member must be marked present for roll call.",
      errorUr: "حاضری درج کرنے کے لیے کم از کم ایک ملازم کا انتخاب کریں۔"
    };
  }
  if (employeeIds.length > 300) {
    return {
      valid: false,
      errorEn: "A maximum of 300 employees can be marked present in a single roll call batch.",
      errorUr: "ایک ساتھ زیادہ سے زیادہ 300 ملازمین کی حاضری درج کی جا سکتی ہے۔"
    };
  }

  return {
    valid: true,
    payload: {
      roster_date: dateStr,
      present: employeeIds.map(id => ({ employee_id: id, at: null }))
    }
  };
}

/**
 * rule:28262cb3f6: Formats duty assignments into a printable job aid matrix for offline support staff.
 */
export function formatWeeklyPrintableSchedule(
  weekDays: WeekDayInfo[],
  entries: RosterEntryOut[]
): Array<{
  employee_id: number;
  emp_number: string;
  full_name: string;
  designation: string;
  assignments: Record<string, { shift: string; place: string; isOnCall: boolean } | null>;
}> {
  const staffMap = new Map<number, {
    employee_id: number;
    emp_number: string;
    full_name: string;
    designation: string;
    assignments: Record<string, { shift: string; place: string; isOnCall: boolean } | null>;
  }>();

  for (const entry of entries) {
    if (entry.status === "Cancelled") continue;
    if (!staffMap.has(entry.employee_id)) {
      const emptyAssignments: Record<string, { shift: string; place: string; isOnCall: boolean } | null> = {};
      for (const day of weekDays) {
        emptyAssignments[day.date] = null;
      }
      staffMap.set(entry.employee_id, {
        employee_id: entry.employee_id,
        emp_number: entry.emp_number,
        full_name: entry.full_name,
        designation: entry.designation,
        assignments: emptyAssignments
      });
    }

    const rec = staffMap.get(entry.employee_id)!;
    const place = entry.zone_label || entry.ward_name || entry.department_name || entry.duty_area || "-";
    rec.assignments[entry.roster_date] = {
      shift: entry.shift_name,
      place,
      isOnCall: entry.is_on_call
    };
  }

  return Array.from(staffMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Filter roll-call sheet by shift pattern or zone/ward.
 */
export function filterRollCallEntries(
  entries: RollCallEntryOut[],
  filterShiftId: number | null,
  filterArea: string,
  searchQuery: string
): RollCallEntryOut[] {
  return entries.filter(e => {
    if (filterShiftId !== null && e.shift_pattern_id !== filterShiftId) {
      return false;
    }
    if (filterArea) {
      const areaMatch = (e.zone_label && e.zone_label.toLowerCase().includes(filterArea.toLowerCase())) ||
        (e.ward_name && e.ward_name.toLowerCase().includes(filterArea.toLowerCase())) ||
        (e.duty_area && e.duty_area.toLowerCase().includes(filterArea.toLowerCase()));
      if (!areaMatch) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = e.full_name.toLowerCase().includes(q) ||
        e.emp_number.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

/**
 * Bilingual Error Dictionary for Support Roster and Roll Call
 */
export const SUPPORT_ROSTER_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  ROLL_CALL_NOT_ROSTERED: {
    en: "The selected employee is not rostered on this day and cannot be marked present in roll call.",
    ur: "منتخب ملازم اس دن روسٹر میں شامل نہیں ہے اور حاضری شیٹ میں حاضر نہیں لگایا جا سکتا۔"
  },
  ROSTER_CONFLICT: {
    en: "Shift conflict: the employee already works an overlapping shift in this timeframe.",
    ur: "شفٹ کا تنازع: ملازم اس دورانیے میں پہلے سے دوسری شفٹ میں ڈیوٹی پر مامور ہے۔"
  },
  LEAVE_CONFLICT: {
    en: "Leave conflict: the employee is on approved leave during this requested duty date.",
    ur: "چھٹی کا تنازع: ملازم اس تاریخ کو منظور شدہ رخصت پر ہے۔"
  },
  ROSTER_DATE_CLOSED: {
    en: "Historical rosters of past dates are locked and can only be modified by HR administrators.",
    ur: "ماضی کی تاریخوں کا روسٹر بند ہے اور صرف ایچ آر ایڈمنسٹریٹر ہی ترمیم کر سکتے ہیں۔"
  },
  SWAP_SELF_APPROVAL: {
    en: "Self-approval prohibited: you cannot decide or approve a duty swap that you are a part of.",
    ur: "خود منظوری ممنوع ہے: آپ ایسے تبادلے کی منظوری نہیں دے سکتے جس میں آپ خود فریق ہوں۔"
  },
  SWAP_TRANSITION_INVALID: {
    en: "This duty swap request has already been finalized or transitioned by another supervisor.",
    ur: "اس ڈیوٹی کے تبادلے کی درخواست کا فیصلہ پہلے ہی ہو چکا ہے۔"
  },
  VERSION_CONFLICT: {
    en: "Concurrency conflict: this duty record was modified by another user. Please refresh.",
    ur: "معلومات کا تنازع: اس ڈیوٹی میں کسی اور نے ترمیم کر دی ہے۔ برائے مہربانی صفحہ تازہ کریں۔"
  },
  ROSTER_EMPLOYEE_INACTIVE: {
    en: "Only active staff members can be assigned duties or marked present.",
    ur: "صرف فعال ملازمین کو ہی ڈیوٹی دی جا سکتی ہے یا حاضری لگائی جا سکتی ہے۔"
  },
  ROSTER_OUT_OF_SCOPE: {
    en: "You do not have administrative permission to roster this employee category.",
    ur: "آپ کے پاس اس ملازم کے شعبے کا روسٹر ترتیب دینے کا اختیار نہیں ہے۔"
  },
  NOT_FOUND: {
    en: "The requested duty roster record or shift swap could not be located.",
    ur: "مطلوبہ ڈیوٹی روسٹر ریکارڈ یا تبادلہ نہیں مل سکا۔"
  },
  FORBIDDEN: {
    en: "You lack the required security permissions to perform this roster or roll call action.",
    ur: "آپ کے پاس یہ ڈیوٹی یا رول کال انجام دینے کے سیکیورٹی اختیارات نہیں ہیں۔"
  },
  VALIDATION_ERROR: {
    en: "Invalid roster entry or roll-call data. Please check required fields.",
    ur: "غیر درست اندراج۔ برائے مہربانی مطلوبہ خانے چیک کریں۔"
  },
  NETWORK_ERROR: {
    en: "Unable to reach the Haspataal server. Please verify terminal connection.",
    ur: "ہسپتال سرور سے رابطہ نہیں ہو سکا۔ ٹرمینل کنکشن چیک کریں۔"
  }
};
