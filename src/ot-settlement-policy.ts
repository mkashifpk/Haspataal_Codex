/**
 * Domain policy and statutory business rules for Screen 132: ot_settlement
 * ("Post-op settlement", Position 132, 49 points, Workspace `ot_admin`).
 * 
 * Statutory & Quality Rules:
 * - rule:5228072102: Always show the preview (gross, consumables, net, each commission) before the irreversible Finalize.
 * - rule:015f73a404: OT_COMMISSION_CAP_EXCEEDED: only proceed with a documented policy override reason.
 * - rule:7c9fedfb50: Exists for the service surgery (work): show it as GET /establishment views.screens says for screen_id ot_settlement.
 */

import type { ParticipantIn, SettlementPreviewOut } from "./generated/ot_settlement";
import type { EstablishmentOut } from "./generated/facility_profile";

export type OtSettlementCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const OT_ROLES = [
  "PrimarySurgeon",
  "AssistantSurgeon",
  "Anesthetist",
  "ScrubNurse",
  "CirculatingNurse",
  "Other",
] as const;

export type OtRoleInRoom = typeof OT_ROLES[number];

export interface RoleLabels {
  en: string;
  ur: string;
}

export const OT_ROLE_LABELS: Record<OtRoleInRoom, RoleLabels> = {
  PrimarySurgeon: { en: "Primary Surgeon", ur: "پرائمری سرجن" },
  AssistantSurgeon: { en: "Assistant Surgeon", ur: "اسسٹنٹ سرجن" },
  Anesthetist: { en: "Anesthetist", ur: "ماہر بیہوشی" },
  ScrubNurse: { en: "Scrub Nurse", ur: "اسکرب نرس" },
  CirculatingNurse: { en: "Circulating Nurse", ur: "سرکولیٹنگ نرس" },
  Other: { en: "Other Staff", ur: "دیگر عملہ" },
};

/**
 * Resolves capability view for ot_settlement under rule:7c9fedfb50.
 */
export function getOtSettlementCapabilityView(
  establishment?: EstablishmentOut | null
): OtSettlementCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "ot_settlement");
    if (
      screenEntry?.view === "full" ||
      screenEntry?.view === "open_work" ||
      screenEntry?.view === "records" ||
      screenEntry?.view === "setup" ||
      screenEntry?.view === "hidden"
    ) {
      return screenEntry.view;
    }
  } else if (screens && typeof screens === "object") {
    const configured = (screens as Record<string, { view?: string }>)?.["ot_settlement"]?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured;
    }
  }

  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Retired") return "records";
    if (surgeryCap.state === "Retiring") return "open_work";
    if (surgeryCap.state === "Preparing") return "setup";
  }

  return "full";
}

/**
 * Checks if current user role has permission to access the settlement screen.
 * Roles: ot_admin (full), billing_admin, hospital_admin, owner (partial).
 */
export function canViewOtSettlement(roles: string[] = []): boolean {
  return roles.some((r) =>
    ["ot_admin", "billing_admin", "hospital_admin", "owner"].includes(r)
  );
}

/**
 * Checks if current user has permission to preview settlement calculations.
 */
export function canPreviewSettlement(roles: string[] = []): boolean {
  return roles.some((r) =>
    ["ot_admin", "billing_admin", "hospital_admin", "owner"].includes(r)
  );
}

/**
 * Checks if current user has permission to finalize surgery settlement.
 * Only ot_admin holds `ot.finalize`.
 */
export function canFinalizeSettlement(roles: string[] = []): boolean {
  return roles.includes("ot_admin");
}

/**
 * Validates participant list before preview or finalize.
 */
export function validateParticipants(participants: ParticipantIn[]): {
  valid: boolean;
  error?: string;
  errorUr?: string;
} {
  if (!participants || participants.length === 0) {
    return {
      valid: false,
      error: "At least one theatre participant must be recorded.",
      errorUr: "کم از کم ایک تھیٹر شریک کا اندراج ضروری ہے۔",
    };
  }

  const seenIds = new Set<number>();
  for (const p of participants) {
    if (!p.employee_id || p.employee_id <= 0) {
      return {
        valid: false,
        error: "All participants must have a valid staff member selected.",
        errorUr: "تمام شرکاء کے لیے درست عملہ منتخب ہونا ضروری ہے۔",
      };
    }
    if (seenIds.has(p.employee_id)) {
      return {
        valid: false,
        error: `Staff member #${p.employee_id} is added multiple times. Each person should be listed once.`,
        errorUr: `عملہ ممبر #${p.employee_id} ایک سے زیادہ بار شامل ہے۔ ہر فرد ایک بار درج ہونا چاہیے۔`,
      };
    }
    seenIds.add(p.employee_id);
  }

  return { valid: true };
}

/**
 * Validates whether finalize is allowed based on rule:5228072102 & rule:015f73a404.
 */
export function validateFinalizeReadiness(params: {
  preview: SettlementPreviewOut | null;
  participants: ParticipantIn[];
  overrideReason?: string | null;
  surgeryStatus?: string;
  procedurePrice?: number | null;
}): {
  allowed: boolean;
  reason?: string;
  reasonUr?: string;
} {
  const { preview, participants, overrideReason, surgeryStatus, procedurePrice } = params;

  if (surgeryStatus && surgeryStatus !== "Completed" && surgeryStatus !== "Cleaning") {
    return {
      allowed: false,
      reason: "Surgery must be completed before settlement can be finalized.",
      reasonUr: "سیٹلمنٹ مکمل کرنے سے پہلے سرجری کا مکمل ہونا ضروری ہے۔",
    };
  }

  if (procedurePrice === null || procedurePrice === undefined || procedurePrice <= 0) {
    return {
      allowed: false,
      reason: "The booking has no procedure price set.",
      reasonUr: "بکنگ میں طریقہ کار کی قیمت مقرر نہیں ہے۔",
    };
  }

  // rule:5228072102: Must show preview before irreversible finalize
  if (!preview) {
    return {
      allowed: false,
      reason: "Settlement preview must be calculated before finalizing.",
      reasonUr: "حتمی شکل دینے سے پہلے سیٹلمنٹ پیش نظارہ دیکھنا لازمی ہے۔",
    };
  }

  // Ensure current participants match preview participants count
  if (participants.length !== preview.participants.length) {
    return {
      allowed: false,
      reason: "Participants have changed. Please re-run the settlement preview.",
      reasonUr: "شرکاء تبدیل ہو چکے ہیں۔ براہ کرم پیش نظارہ دوبارہ چلائیں۔",
    };
  }

  // rule:015f73a404: OT_COMMISSION_CAP_EXCEEDED requires documented policy override reason
  if (preview.exceeds_cap) {
    const trimmed = (overrideReason || "").trim();
    if (!trimmed || trimmed.length < 5) {
      return {
        allowed: false,
        reason: "Commissions exceed net profit. A documented policy override reason is mandatory.",
        reasonUr: "کمیشن خالص منافع سے زیادہ ہے۔ باقاعدہ پالیسی اوور رائیڈ وجہ کا اندراج لازمی ہے۔",
      };
    }
  }

  return { allowed: true };
}

/**
 * Bilingual error explanation for OT settlement error codes.
 */
export function explainOtSettlementError(
  code: string,
  lang: "en" | "ur" = "en"
): string {
  switch (code) {
    case "OT_ALREADY_SETTLED":
      return lang === "ur"
        ? "یہ سرجری پہلے ہی حتمی طور پر سیٹل ہو چکی ہے۔"
        : "This surgery was already settled.";
    case "OT_COMMISSION_CAP_EXCEEDED":
      return lang === "ur"
        ? "کمیشن خالص منافع سے تجاوز کر گیا ہے؛ باقاعدہ پالیسی اوور رائیڈ وجہ لازمی ہے۔"
        : "Commissions exceed net profit; a reasoned policy override is required.";
    case "OT_PROCEDURE_PRICE_MISSING":
      return lang === "ur"
        ? "بکنگ میں پروسیجر کی قیمت موجود نہیں ہے۔"
        : "The booking has no procedure price.";
    case "OT_SURGERY_NOT_COMPLETE":
      return lang === "ur"
        ? "سیٹلمنٹ سے پہلے سرجری مکمل ہونی چاہیے۔"
        : "Surgery must be completed before settlement.";
    case "REFERENCE_NOT_FOUND":
      return lang === "ur"
        ? "حوالہ شدہ ریکارڈ یا بکنگ موجود نہیں ہے۔"
        : "A referenced record does not exist.";
    case "VALIDATION_ERROR":
      return lang === "ur"
        ? "درخواست میں معلومات نامکمل یا غلط ہیں۔"
        : "The request is invalid.";
    case "FORBIDDEN":
      return lang === "ur"
        ? "آپ کو یہ کارروائی انجام دینے کا اختیار نہیں ہے۔"
        : "You do not have permission to perform this action.";
    default:
      return lang === "ur"
        ? `غیر متوقع خرابی (${code})`
        : `An unexpected error occurred (${code}).`;
  }
}
