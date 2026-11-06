// Self Service domain policies, statutory rules, validations, and bilingual formatting
// Phase 8 Screen 154: self_service (Staff self-service portal: timecards, leave requests, duty rosters & profile)

import type {
  LeaveIn,
  SwapIn,
  IssueIn,
  RosterEntryOut,
  MyDutySwapOut,
  LeaveBalanceOut,
  SelfProfileOut
} from "./generated/self_service";

export interface LeaveRequestValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  calculatedDays?: number;
}

/**
 * Validates staff leave application.
 */
export function validateLeaveRequest(leave: LeaveIn): LeaveRequestValidationResult {
  const errors: Record<string, string> = {};

  if (!leave.leave_type) {
    errors.leave_type = "Please select a leave category.";
  }

  if (!leave.from_date) {
    errors.from_date = "Start date is required.";
  }

  if (!leave.to_date) {
    errors.to_date = "End date is required.";
  }

  if (leave.from_date && leave.to_date) {
    if (leave.from_date > leave.to_date) {
      errors.to_date = "End date cannot be prior to start date.";
    }
  }

  let calculatedDays = 0;
  if (leave.from_date && leave.to_date && !errors.to_date) {
    const fromTime = new Date(leave.from_date).getTime();
    const toTime = new Date(leave.to_date).getTime();
    const diffDays = Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24)) + 1;
    calculatedDays = leave.half_day ? 0.5 : Math.max(1, diffDays);
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    calculatedDays,
  };
}

export interface SwapRequestValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates colleague swap or cover request per rule:9274755ac9.
 * Reason is required (e.g. family emergency, medical appointment).
 */
export function validateSwapRequest(swap: SwapIn): SwapRequestValidationResult {
  const errors: Record<string, string> = {};

  if (!swap.roster_id) {
    errors.roster_id = "Please select a scheduled duty to swap or cover.";
  }

  if (!swap.covering_employee_id) {
    errors.covering_employee_id = "Please select a colleague to ask.";
  }

  if (!swap.reason || swap.reason.trim().length < 3) {
    errors.reason = "An operational reason (minimum 3 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface IssueReportValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates work order issue report.
 */
export function validateIssueReport(issue: IssueIn): IssueReportValidationResult {
  const errors: Record<string, string> = {};

  if (!issue.category) {
    errors.category = "Please select an issue category.";
  }

  if (!issue.description || issue.description.trim().length < 5) {
    errors.description = "A detailed description (minimum 5 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface DayRosterView {
  date: string;
  duty?: RosterEntryOut;
  isRestDay: boolean; // rule:907c770e92
}

/**
 * Implements rule:907c770e92:
 * "My duties (GET /self/roster): the days without a duty are my rest days."
 * Builds daily breakdown over a given date range marking unassigned days as rest days.
 */
export function buildDutyHorizon(
  duties: RosterEntryOut[],
  startDateStr: string,
  endDateStr: string
): DayRosterView[] {
  const dutyMap = new Map<string, RosterEntryOut>();
  for (const d of duties) {
    if (d.status !== "Cancelled") {
      dutyMap.set(d.roster_date, d);
    }
  }

  const result: DayRosterView[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const curr = new Date(start);
  while (curr <= end) {
    const dateStr = curr.toISOString().split("T")[0];
    const duty = dutyMap.get(dateStr);
    result.push({
      date: dateStr,
      duty,
      isRestDay: !duty,
    });
    curr.setDate(curr.getDate() + 1);
  }

  return result;
}

/**
 * Implements rule:adfadf7120:
 * Requests to me (my_role Colleague, status Requested): Accept or Decline.
 * Then the roster manager approves; the roster changes only then.
 * I may withdraw my own request until it is approved; one still open when the duty starts expires.
 */
export function canColleagueRespond(swap: MyDutySwapOut): boolean {
  return swap.my_role === "Colleague" && swap.status === "Requested";
}

export function canRequesterCancel(swap: MyDutySwapOut, todayStr?: string): boolean {
  if (swap.my_role !== "Requester") return false;
  if (swap.status !== "Requested" && swap.status !== "Accepted") return false;
  const today = todayStr || new Date().toISOString().split("T")[0];
  if (swap.duty && swap.duty.roster_date < today) return false;
  return true;
}

export function isDutyUpcoming(duty: RosterEntryOut, todayStr?: string): boolean {
  const today = todayStr || new Date().toISOString().split("T")[0];
  return duty.roster_date >= today && duty.status === "Active";
}

export const ISSUE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Carpentry",
  "Biomedical",
  "IT",
  "Civil",
  "Cleaning",
  "Other"
] as const;

export const ISSUE_PRIORITIES = [
  "Low",
  "Normal",
  "High",
  "Emergency"
] as const;

export const SELF_SERVICE_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  LEAVE_INSUFFICIENT_BALANCE: {
    en: "You do not have enough leave balance for the requested duration.",
    ur: "آپ کے پاس مطلوبہ مدت کے لیے رخصت کا بیلنس ناکافی ہے۔",
  },
  LEAVE_OVERLAPPING: {
    en: "You already have a pending or approved leave request covering these dates.",
    ur: "ان تاریخوں کے لیے آپ کی رخصت کی درخواست پہلے سے موجود ہے۔",
  },
  DUTY_ALREADY_STARTED: {
    en: "Cannot swap or cover a duty that has already started or elapsed.",
    ur: "ماضی یا شروع ہو چکی ڈیوٹی کو تبدیل نہیں کیا جا سکتا۔",
  },
  SWAP_ALREADY_DECIDED: {
    en: "This duty swap request was already accepted, declined, or decided.",
    ur: "ڈیوٹی کے تبادلے کی یہ درخواست پہلے ہی نمٹائی جا چکی ہے۔",
  },
  SWAP_SELF_FORBIDDEN: {
    en: "You cannot request a shift swap with yourself.",
    ur: "آپ اپنی ہی ڈیوٹی اپنے ساتھ تبدیل نہیں کر سکتے۔",
  },
  WORK_ORDER_LOCATION_REQUIRED: {
    en: "Please specify the room, ward, or location for the maintenance issue.",
    ur: "برائے مہربانی خرابی کی جگہ، کمرہ یا وارڈ درج کریں۔",
  },
  VALIDATION_ERROR: {
    en: "Invalid submission data. Please verify required fields and try again.",
    ur: "فارم میں غلطی۔ برائے مہربانی تمام خانے درست پر کریں۔",
  },
  FORBIDDEN: {
    en: "You do not have permission for this self-service operation.",
    ur: "آپ کے پاس اس کارروائی کی اجازت نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "Record not found.",
    ur: "ریکارڈ نہیں ملا۔",
  },
  NETWORK_ERROR: {
    en: "Unable to connect to self-service server.",
    ur: "سیلف سروس سرور سے رابطہ منقطع ہے۔",
  },
};
