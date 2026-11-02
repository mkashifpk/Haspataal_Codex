/**
 * Domain policy and statutory business rules for Screen 142: risk_dashboard
 * ("Risk & compliance", Position 142, 48 points, Workspace `owner_dashboard`).
 *
 * Statutory & Quality Rules:
 * - rule:a50f18c5d4: Word it as 'flagged for review'. Critical (e.g. VOIDED_BUT_EXAMINED) pops a notification.
 * - Delivery Gate: Heuristic findings for human review (not accusations), safe writes, audit logs,
 *   bilingual F1 help, bounded 100-250% zoom.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  RiskSeverity,
  RiskReviewStatus,
  RiskSummaryOut,
  RiskFindingListItemOut,
  ReviewIn,
} from "./generated/risk_dashboard";

export type RiskDashboardCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const RISK_DASHBOARD_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  FORBIDDEN: {
    en: "You do not have permission to access the risk dashboard or audit trail (requires risk.view or admin.audit.view).",
    ur: "آپ کے پاس رسک ڈیش بورڈ یا آڈٹ ٹریل تک رسائی کا اختیار نہیں ہے (risk.view یا admin.audit.view درکار ہے)۔",
  },
  SELF_APPROVAL_FORBIDDEN: {
    en: "You cannot review or resolve a risk finding where you are the subject user.",
    ur: "آپ اپنے خلاف نشان زد کردہ آڈٹ فائنڈنگ کا خود جائزہ یا فیصلہ نہیں کر سکتے۔",
  },
  NOT_FOUND: {
    en: "The requested risk finding was not found. Please refresh the list.",
    ur: "مطلوبہ آڈٹ فائنڈنگ نہیں ملی۔ براہ کرم فہرست تازہ کریں۔",
  },
  VALIDATION_ERROR: {
    en: "The review submission is invalid. Please check the review status and note.",
    ur: "جائزہ کا اندراج نامکمل یا غلط ہے۔ برائے مہربانی اسٹیٹس اور وضاحتی نوٹ چیک کریں۔",
  },
  NOTE_REQUIRED: {
    en: "An audit explanation note is mandatory when marking a finding as Resolved, False Positive, or Escalated.",
    ur: "فائنڈنگ کو حل شدہ، غلط الارم، یا آگے بھیجنے کے لیے وضاحتی نوٹ درج کرنا لازمی ہے۔",
  },
  NOTE_TOO_LONG: {
    en: "Review note cannot exceed 2000 characters.",
    ur: "آڈٹ وضاحتی نوٹ 2000 حروف سے زیادہ نہیں ہو سکتا۔",
  },
};

/**
 * Resolves capability view for risk_dashboard from establishment configuration.
 */
export function getRiskDashboardCapabilityView(
  establishment?: EstablishmentOut | null
): RiskDashboardCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const entry = screens.find((s: any) => s.screen_id === "risk_dashboard");
    if (entry && entry.view) {
      return entry.view as RiskDashboardCapabilityView;
    }
  } else if (screens && typeof screens === "object") {
    const entry = (screens as Record<string, any>)["risk_dashboard"];
    if (entry) {
      if (typeof entry === "string") return entry as RiskDashboardCapabilityView;
      if (typeof entry === "object" && entry.view) return entry.view as RiskDashboardCapabilityView;
    }
  }

  return "full";
}

export interface ReviewValidationResult {
  valid: boolean;
  errorCode?: string;
  messageEn?: string;
  messageUr?: string;
}

/**
 * Validates a human review submission for a risk finding.
 * Enforces dual-control / no self-approval and mandatory explanation notes.
 */
export function validateReviewInput(
  status: RiskReviewStatus,
  note?: string | null,
  subjectUserId?: number | null,
  currentUserId?: number | null
): ReviewValidationResult {
  // Prevent self-review (Rule rule:a50f18c5d4 & audit integrity)
  if (
    subjectUserId !== null &&
    subjectUserId !== undefined &&
    currentUserId !== null &&
    currentUserId !== undefined &&
    subjectUserId === currentUserId
  ) {
    return {
      valid: false,
      errorCode: "SELF_APPROVAL_FORBIDDEN",
      messageEn: RISK_DASHBOARD_ERROR_MESSAGES.SELF_APPROVAL_FORBIDDEN.en,
      messageUr: RISK_DASHBOARD_ERROR_MESSAGES.SELF_APPROVAL_FORBIDDEN.ur,
    };
  }

  // UnderReview allows null/empty note; definitive outcomes require a note
  if (status !== "UnderReview") {
    if (!note || !note.trim()) {
      return {
        valid: false,
        errorCode: "NOTE_REQUIRED",
        messageEn: RISK_DASHBOARD_ERROR_MESSAGES.NOTE_REQUIRED.en,
        messageUr: RISK_DASHBOARD_ERROR_MESSAGES.NOTE_REQUIRED.ur,
      };
    }
  }

  if (note && note.length > 2000) {
    return {
      valid: false,
      errorCode: "NOTE_TOO_LONG",
      messageEn: RISK_DASHBOARD_ERROR_MESSAGES.NOTE_TOO_LONG.en,
      messageUr: RISK_DASHBOARD_ERROR_MESSAGES.NOTE_TOO_LONG.ur,
    };
  }

  return { valid: true };
}

export interface RiskSummaryStats {
  totalOpenCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  highestScore: number;
  hasCriticalAlerts: boolean;
}

/**
 * Calculates aggregate risk finding statistics across active rules.
 */
export function calculateRiskSummaryStats(summaries: RiskSummaryOut[]): RiskSummaryStats {
  let totalOpenCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let highestScore = 0;

  for (const s of summaries) {
    const open = s.open_count || 0;
    totalOpenCount += open;

    if (s.severity === "Critical") criticalCount += open;
    else if (s.severity === "High") highCount += open;
    else if (s.severity === "Medium") mediumCount += open;
    else if (s.severity === "Low") lowCount += open;

    if (s.max_score > highestScore) {
      highestScore = s.max_score;
    }
  }

  return {
    totalOpenCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    highestScore,
    hasCriticalAlerts: criticalCount > 0,
  };
}

/**
 * Returns user-facing badge colors and labels for risk severity.
 */
export function getSeverityBadge(severity: RiskSeverity): {
  className: string;
  labelEn: string;
  labelUr: string;
} {
  switch (severity) {
    case "Critical":
      return {
        className: "bg-rose-100 text-rose-800 border-rose-300 font-bold",
        labelEn: "Critical",
        labelUr: "انتہائی نازک",
      };
    case "High":
      return {
        className: "bg-orange-100 text-orange-800 border-orange-300 font-semibold",
        labelEn: "High",
        labelUr: "زیادہ",
      };
    case "Medium":
      return {
        className: "bg-amber-100 text-amber-800 border-amber-300 font-medium",
        labelEn: "Medium",
        labelUr: "درمیانہ",
      };
    case "Low":
    default:
      return {
        className: "bg-blue-100 text-blue-800 border-blue-300 font-medium",
        labelEn: "Low",
        labelUr: "معمولی",
      };
  }
}

/**
 * Returns badge styling for human review status.
 */
export function getReviewStatusBadge(status: RiskReviewStatus): {
  className: string;
  labelEn: string;
  labelUr: string;
} {
  switch (status) {
    case "Open":
      return {
        className: "bg-amber-100 text-amber-800 font-semibold",
        labelEn: "Flagged for review",
        labelUr: "برائے جائزہ نشان زد",
      };
    case "UnderReview":
      return {
        className: "bg-blue-100 text-blue-800 font-medium",
        labelEn: "Under review",
        labelUr: "زیرِ جائزہ",
      };
    case "Resolved":
      return {
        className: "bg-emerald-100 text-emerald-800 font-semibold",
        labelEn: "Resolved",
        labelUr: "حل شدہ",
      };
    case "FalsePositive":
      return {
        className: "bg-gray-100 text-gray-700 font-medium",
        labelEn: "False positive",
        labelUr: "غلط الارم",
      };
    case "Escalated":
      return {
        className: "bg-purple-100 text-purple-800 font-bold",
        labelEn: "Escalated",
        labelUr: "آگے بھیج دیا گیا",
      };
  }
}
