// Leave Approvals domain policies, capability views, validations, and bilingual helpers
// Phase 8 Screen 153: leave_approvals (Leave requests & manager approvals)

import type { LeaveDecisionIn, TeamLeaveRequestOut, LeaveBalanceOut } from "./generated/leave_approvals";

export type LeaveApprovalsMode = "full" | "records" | "hidden";

export interface LeaveApprovalsCapabilityView {
  mode: LeaveApprovalsMode;
  reason?: string;
  canView: boolean;
  canApprove: boolean;
  isHrAdmin: boolean;
}

export function getLeaveApprovalsCapabilityView(
  establishment?: any,
  userPermissions?: string[],
  userRole?: string
): LeaveApprovalsCapabilityView {
  const perms = new Set(userPermissions || []);
  const isHrAdmin = perms.has("hr.leave.manage") || perms.has("*") || ["hospital_admin", "clinic_director", "hospital_director", "owner"].includes(userRole || "");
  const canApprove = perms.has("hr.leave.approve") || isHrAdmin;
  const canView = canApprove || perms.has("hr.leave.view");

  if (establishment?.views?.screens && !establishment.views.screens.includes("leave_approvals")) {
    return {
      mode: "hidden",
      reason: "Leave approvals inbox is not enabled for this facility profile.",
      canView: false,
      canApprove: false,
      isHrAdmin: false,
    };
  }

  const mode: LeaveApprovalsMode = canApprove ? "full" : canView ? "records" : "hidden";

  return {
    mode,
    canView,
    canApprove,
    isHrAdmin,
  };
}

export interface DecisionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a manager's decision on a leave request.
 * Rejections require an explanation note so the direct report understands why.
 */
export function validateLeaveDecision(
  decision: "Approved" | "Rejected",
  note?: string | null
): DecisionValidationResult {
  const errors: Record<string, string> = {};

  if (!decision || (decision !== "Approved" && decision !== "Rejected")) {
    errors.decision = "Decision must be either Approved or Rejected.";
  }

  if (decision === "Rejected" && (!note || note.trim().length < 3)) {
    errors.note = "A rejection explanation note (minimum 3 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatLeaveTypeBadge(type: string): { labelEn: string; labelUr: string; colorClass: string } {
  switch (type) {
    case "Annual":
      return { labelEn: "Annual Leave", labelUr: "سالانہ چھٹی", colorClass: "badge-blue" };
    case "Casual":
      return { labelEn: "Casual Leave", labelUr: "اتفاقی چھٹی", colorClass: "badge-teal" };
    case "Sick":
      return { labelEn: "Sick Leave", labelUr: "طبی چھٹی", colorClass: "badge-amber" };
    case "Maternity":
      return { labelEn: "Maternity Leave", labelUr: "زچگی کی چھٹی", colorClass: "badge-purple" };
    case "Unpaid":
      return { labelEn: "Unpaid Leave", labelUr: "بلا تنخواہ چھٹی", colorClass: "badge-grey" };
    case "Other":
    default:
      return { labelEn: type || "Other", labelUr: "دیگر", colorClass: "badge-default" };
  }
}

export function formatLeaveStatusBadge(status: string): { labelEn: string; labelUr: string; colorClass: string } {
  switch (status) {
    case "Pending":
      return { labelEn: "Pending Approval", labelUr: "زیر التواء منظوری", colorClass: "badge-pending" };
    case "Approved":
      return { labelEn: "Approved", labelUr: "منظور شدہ", colorClass: "badge-success" };
    case "Rejected":
      return { labelEn: "Rejected", labelUr: "مسترد", colorClass: "badge-danger" };
    case "Cancelled":
      return { labelEn: "Cancelled", labelUr: "منسوخ شدہ", colorClass: "badge-muted" };
    default:
      return { labelEn: status, labelUr: status, colorClass: "badge-default" };
  }
}

export function formatLeaveDateRange(from: string, to: string, days: number): string {
  if (from === to) {
    return `${from} (${days} ${days === 1 ? "day" : "days"})`;
  }
  return `${from} → ${to} (${days} ${days === 1 ? "day" : "days"})`;
}

export const LEAVE_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  LEAVE_ALREADY_DECIDED: {
    en: "The leave request was already decided or withdrawn by another supervisor.",
    ur: "یہ رخصت پہلے ہی کسی دوسرے سپروائزر کی طرف سے منظور، مسترد یا واپس لی جا چکی ہے۔",
  },
  LEAVE_INSUFFICIENT_BALANCE: {
    en: "The employee does not have sufficient leave balance for this request.",
    ur: "ملازم کے پاس اس رخصت کے لیے مطلوبہ بیلنس دستیاب نہیں ہے۔",
  },
  LEAVE_NOT_YOUR_REPORT: {
    en: "Only the direct supervisor or HR administrator can decide this leave request.",
    ur: "صرف براہ راست سپروائزر یا ایچ آر ایڈمن ہی اس رخصت کا فیصلہ کر سکتا ہے۔",
  },
  SELF_APPROVAL_FORBIDDEN: {
    en: "You cannot approve your own leave request. A designated superior must decide it.",
    ur: "آپ اپنی ذاتی رخصت خود منظور نہیں کر سکتے۔ اعلیٰ افسر کی منظوری لازمی ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The decision payload is invalid. Please provide a valid decision and explanation note.",
    ur: "درخواست کی توثیق ناکام۔ برائے مہربانی درست فیصلہ اور وضاحتی نوٹ فراہم کریں۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to review or approve leave requests (hr.leave.approve required).",
    ur: "آپ کے پاس رخصت کی منظوری کی اجازت نہیں ہے (hr.leave.approve درکار ہے)۔",
  },
  NOT_FOUND: {
    en: "Leave request or employee balance record not found.",
    ur: "رخصت کی درخواست یا ملازم کے بیلنس کا ریکارڈ نہیں ملا۔",
  },
  NETWORK_ERROR: {
    en: "Unable to connect to leave management service. Please check connection.",
    ur: "رخصت سروس سے رابطہ نہیں ہو سکا۔ برائے مہربانی نیٹ ورک کنکشن چیک کریں۔",
  },
};
