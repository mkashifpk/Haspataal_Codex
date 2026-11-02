/**
 * Domain policy and statutory business rules for Screen 140: diagnostic_partners
 * ("Partner laboratories and imaging centres", Position 140, 44 points, Workspace `lab_admin`).
 *
 * Statutory & Quality Rules:
 * - rule:317f71af91: Record the PHC registration, the accreditation (PNAC) or PNRA licence, the MOU
 *                    reference and period, the turnaround agreed (hours) and a quality note; renew the
 *                    MOU before mou_valid_until (the worklist warns 30 days ahead; an expired MOU stops dispatches).
 * - rule:91092686de: Retire a partner with is_active false; its history stays.
 * - rule:5be909080d: Exists for the service outsourced_diagnostics (setup): show it as
 *                    GET /establishment views.screens says for screen_id diagnostic_partners (full; open_work:
 *                    without its new work, with the banner "No new ... from now on"; records: history and
 *                    corrections only; setup: only from Facility settings; hidden: in no menu), after login
 *                    and again on establishment.changed. Never decide it from the profile's category.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type { PartnerIn, PartnerUpdateIn, PartnerOut } from "./generated/diagnostic_partners";

export type DiagnosticPartnersCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const PARTNER_SERVICES = ["Lab", "Imaging", "Both"] as const;
export type PartnerService = typeof PARTNER_SERVICES[number];

export const DIAGNOSTIC_PARTNERS_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  FORBIDDEN: {
    en: "You do not have permission to manage diagnostic partner laboratories and imaging centres.",
    ur: "آپ کے پاس پارٹنر لیبارٹریز اور امیجنگ سینٹرز کا انتظام سنبھالنے کا مجاز اختیار نہیں ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid. Please check the entered fields.",
    ur: "درخواست نامکمل یا غلط ہے۔ برائے مہربانی درج کردہ خانے چیک کریں۔",
  },
  VERSION_CONFLICT: {
    en: "The partner record was modified by another user; reload and try again.",
    ur: "یہ ریکارڈ کسی دوسرے صارف نے تبدیل کر دیا ہے؛ براہ کرم صفحہ دوبارہ لوڈ کر کے کوشش کریں۔",
  },
  NOT_FOUND: {
    en: "The requested diagnostic partner was not found.",
    ur: "مطلوبہ تشخیصی شراکت دار نہیں ملا۔",
  },
};

/**
 * Resolves capability view for diagnostic_partners from establishment configuration.
 * Enforces Rule rule:5be909080d.
 */
export function getDiagnosticPartnersCapabilityView(
  establishment?: EstablishmentOut | null
): DiagnosticPartnersCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const entry = screens.find((s: any) => s.screen_id === "diagnostic_partners");
    if (entry && entry.view) {
      return entry.view as DiagnosticPartnersCapabilityView;
    }
  } else if (screens && typeof screens === "object") {
    const entry = (screens as Record<string, any>)["diagnostic_partners"];
    if (entry) {
      if (typeof entry === "string") return entry as DiagnosticPartnersCapabilityView;
      if (typeof entry === "object" && entry.view) return entry.view as DiagnosticPartnersCapabilityView;
    }
  }

  return "full";
}

export interface MouExpiryInfo {
  status: "valid" | "expiring_soon" | "expired" | "no_mou";
  daysLeft: number | null;
  warningMessage?: { en: string; ur: string };
}

/**
 * Evaluates MOU expiry timeline and warns 30 days ahead per Rule rule:317f71af91.
 */
export function getMouExpiryStatus(
  validUntil?: string | null,
  mouExpiredFlag?: boolean,
  todayStr?: string
): MouExpiryInfo {
  if (mouExpiredFlag) {
    return {
      status: "expired",
      daysLeft: 0,
      warningMessage: {
        en: "MOU Expired: All sample dispatches and exam send-outs are halted.",
        ur: "معاہدہ ختم ہو چکا ہے: تمام نمونے اور ٹیسٹ بھیجنا بند کر دیے گئے ہیں۔",
      },
    };
  }

  if (!validUntil) {
    return { status: "no_mou", daysLeft: null };
  }

  const today = todayStr ? new Date(todayStr + "T00:00:00Z") : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const expiry = new Date(validUntil + "T00:00:00Z");
  if (isNaN(expiry.getTime())) {
    return { status: "no_mou", daysLeft: null };
  }

  const diffMs = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      status: "expired",
      daysLeft,
      warningMessage: {
        en: "MOU Expired: All sample dispatches and exam send-outs are halted.",
        ur: "معاہدہ ختم ہو چکا ہے: تمام نمونے اور ٹیسٹ بھیجنا بند کر دیے گئے ہیں۔",
      },
    };
  }

  if (daysLeft <= 30) {
    return {
      status: "expiring_soon",
      daysLeft,
      warningMessage: {
        en: `MOU Expiring Soon: ${daysLeft} day(s) remaining. Renew agreement before expiration to avoid dispatch disruption.`,
        ur: `معاہدہ جلد ختم ہونے والا ہے: ${daysLeft} دن باقی ہیں۔ ترسیل رکنے سے بچنے کے لیے وقت پر تجدید کریں۔`,
      },
    };
  }

  return { status: "valid", daysLeft };
}

/**
 * Validates new diagnostic partner input under Rule rule:317f71af91.
 */
export function validatePartnerInput(input: PartnerIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Partner name must be at least 2 characters.";
  } else if (input.name.trim().length > 200) {
    errors.name = "Partner name cannot exceed 200 characters.";
  }

  if (!input.services || !PARTNER_SERVICES.includes(input.services)) {
    errors.services = "Services must be 'Lab', 'Imaging', or 'Both'.";
  }

  if (input.turnaround_hours !== undefined && input.turnaround_hours !== null) {
    const hours = Number(input.turnaround_hours);
    if (isNaN(hours) || hours <= 0 || hours > 2160) {
      errors.turnaround_hours = "Turnaround must be a positive integer up to 2160 hours (90 days).";
    }
  }

  if (input.mou_valid_from && !/^\d{4}-\d{2}-\d{2}$/.test(input.mou_valid_from)) {
    errors.mou_valid_from = "MOU Valid From must be a valid date (YYYY-MM-DD).";
  }

  if (input.mou_valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(input.mou_valid_until)) {
    errors.mou_valid_until = "MOU Valid Until must be a valid date (YYYY-MM-DD).";
  }

  if (input.mou_valid_from && input.mou_valid_until && input.mou_valid_from > input.mou_valid_until) {
    errors.mou_valid_until = "MOU Valid Until cannot be earlier than Valid From date.";
  }

  if (input.services === "Imaging" && !input.pnra_licence) {
    // PNRA licence is statutory requirement for diagnostic radiation/imaging centres
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates partner update input under Rule rule:317f71af91 and rule:91092686de.
 */
export function validatePartnerUpdateInput(input: PartnerUpdateIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (input.name !== undefined && input.name !== null) {
    if (input.name.trim().length < 2) {
      errors.name = "Partner name must be at least 2 characters.";
    } else if (input.name.trim().length > 200) {
      errors.name = "Partner name cannot exceed 200 characters.";
    }
  }

  if (input.services !== undefined && input.services !== null) {
    if (!PARTNER_SERVICES.includes(input.services)) {
      errors.services = "Services must be 'Lab', 'Imaging', or 'Both'.";
    }
  }

  if (input.turnaround_hours !== undefined && input.turnaround_hours !== null) {
    const hours = Number(input.turnaround_hours);
    if (isNaN(hours) || hours <= 0 || hours > 2160) {
      errors.turnaround_hours = "Turnaround must be a positive integer up to 2160 hours (90 days).";
    }
  }

  if (input.mou_valid_from && !/^\d{4}-\d{2}-\d{2}$/.test(input.mou_valid_from)) {
    errors.mou_valid_from = "MOU Valid From must be a valid date (YYYY-MM-DD).";
  }

  if (input.mou_valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(input.mou_valid_until)) {
    errors.mou_valid_until = "MOU Valid Until must be a valid date (YYYY-MM-DD).";
  }

  if (input.mou_valid_from && input.mou_valid_until && input.mou_valid_from > input.mou_valid_until) {
    errors.mou_valid_until = "MOU Valid Until cannot be earlier than Valid From date.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
