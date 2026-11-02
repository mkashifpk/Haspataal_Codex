/**
 * Domain policy and statutory business rules for Security & Staff Badges (Screen 146, workspace: hr).
 *
 * Statutory Rules:
 * - rule:1cc0496368: No RFID hardware? Issue technology 'Barcode' (the server makes the code) and print the ID card again: its payload carries the badge QR in `badge`.
 * - rule:e361c806a1: RFID: read the card's UID with the reader and enter it as badge_code; Biometric: the device's enrolment id.
 * - rule:2906081f38: A lost card: revoke it, then issue a new one.
 */

import type { BadgeIn, HrReasonIn } from "./generated/badges";

export type BadgesCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface BadgesCapabilityView {
  mode: BadgesCapabilityMode;
  canViewBadges: boolean;
  canIssueBadge: boolean;
  canRevokeBadge: boolean;
  canPrintIdCard: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getBadgesCapabilityView(establishment?: any): BadgesCapabilityView {
  const screens: string[] = establishment?.views?.screens || [];
  const hasBadges = screens.length === 0 || screens.includes("badges");

  if (!hasBadges) {
    return {
      mode: "hidden",
      canViewBadges: false,
      canIssueBadge: false,
      canRevokeBadge: false,
      canPrintIdCard: false,
      noticeEn: "Badges workspace is hidden in current facility configuration.",
      noticeUr: "موجودہ سہولت کی تشکیل میں بیجز کا ورک اسپیس پوشیدہ ہے۔",
    };
  }

  const isRecordsOnly = Boolean(establishment?.views?.records_only);
  const isOpenWorkOnly = Boolean(establishment?.views?.open_work_only);
  const isSetupOnly = Boolean(establishment?.views?.setup_only);

  if (isRecordsOnly) {
    return {
      mode: "records",
      canViewBadges: true,
      canIssueBadge: false,
      canRevokeBadge: false,
      canPrintIdCard: false,
      noticeEn: "Records Mode: Reviewing active and revoked security badges in read-only mode.",
      noticeUr: "صرف ریکارڈ موڈ: سیکیورٹی بیجز کا جائزہ صرف مطالعہ کے لیے کھلا ہے۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canViewBadges: true,
      canIssueBadge: true,
      canRevokeBadge: true,
      canPrintIdCard: true,
      noticeEn: "Restricted Mode: Operational badge issuance and emergency revocation active.",
      noticeUr: "محدود موڈ: آپریشنل بیج کا اجرا اور ہنگامی منسوخی فعال ہے۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canViewBadges: true,
      canIssueBadge: false,
      canRevokeBadge: false,
      canPrintIdCard: false,
      noticeEn: "Setup Mode: Hardware scanner station mapping active.",
      noticeUr: "سیٹ اپ موڈ: ہارڈ ویئر اسکینر اسٹیشن کی میپنگ فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canViewBadges: true,
    canIssueBadge: true,
    canRevokeBadge: true,
    canPrintIdCard: true,
  };
}

export type BadgeTechnology = "RFID" | "Barcode" | "Biometric";
export type BadgeHolderType =
  | "Employee"
  | "SupportStaff"
  | "Sweeper"
  | "Janitor"
  | "Security"
  | "Contractor";

/**
 * Validates badge issuance input per Rule rule:1cc0496368 & rule:e361c806a1
 */
export function validateBadgeIssueInput(body: Partial<BadgeIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const tech = body.technology || "Barcode";
  if (!["RFID", "Barcode", "Biometric"].includes(tech)) {
    errors.technology = "Valid technology (RFID, Barcode, or Biometric) is required.";
  }

  if (tech === "RFID") {
    // Rule rule:e361c806a1: RFID read card UID with reader and enter it as badge_code
    if (!body.badge_code || body.badge_code.trim().length < 3) {
      errors.badge_code = "RFID card UID is mandatory (minimum 3 characters, e.g. from USB card reader).";
    }
  } else if (tech === "Biometric") {
    // Rule rule:e361c806a1: Biometric device enrolment id
    if (!body.badge_code || body.badge_code.trim().length < 1) {
      errors.badge_code = "Biometric device enrolment ID is mandatory.";
    }
  } else if (tech === "Barcode") {
    // Rule rule:1cc0496368: No RFID hardware? Server generates code for Barcode QR badge
    // badge_code can be left blank or optional
  }

  if (body.holder_type && !["Employee", "SupportStaff", "Sweeper", "Janitor", "Security", "Contractor"].includes(body.holder_type)) {
    errors.holder_type = "Invalid holder type specified.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates badge revocation input per Rule rule:2906081f38
 */
export function validateBadgeRevocationInput(body: Partial<HrReasonIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!body.reason || body.reason.trim().length < 3) {
    errors.reason = "Operational revocation reason is mandatory (minimum 3 characters, e.g. 'Lost card', 'Damaged', 'Duty ceased').";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Standard bilingual error dictionary for Badges & Access Cards
 */
export const BADGES_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string }
> = {
  BADGE_CODE_TAKEN: {
    en: "This badge UID or barcode code is already active on another badge record (BADGE_CODE_TAKEN).",
    ur: "یہ بیج یو آئی ڈی یا بارکوڈ کوڈ پہلے ہی کسی دوسرے بیج کے لیے فعال ہے (BADGE_CODE_TAKEN)۔",
  },
  BADGE_NOT_FOUND: {
    en: "The requested badge code was not found in the hospital registry (BADGE_NOT_FOUND).",
    ur: "مطلوبہ بیج کوڈ ہسپتال کی رجسٹری میں نہیں ملا (BADGE_NOT_FOUND)۔",
  },
  BADGE_ALREADY_REVOKED: {
    en: "This badge has already been revoked and is inactive (BADGE_ALREADY_REVOKED).",
    ur: "یہ بیج پہلے ہی منسوخ شدہ اور غیر فعال ہے (BADGE_ALREADY_REVOKED)۔",
  },
  EMPLOYEE_STATUS_INVALID: {
    en: "Cannot issue a badge to an employee in Draft, Suspended, or Terminated status (EMPLOYEE_STATUS_INVALID).",
    ur: "ڈرافٹ، معطل یا برخاست ملازم کو نیا بیج جاری نہیں کیا جا سکتا (EMPLOYEE_STATUS_INVALID)۔",
  },
  VALIDATION_ERROR: {
    en: "Validation error: please verify highlighted badge fields.",
    ur: "تصدیقی خرابی: براہ کرم نمایاں کردہ خانوں کی جانچ کریں۔",
  },
  FORBIDDEN: {
    en: "Insufficient HR permissions to issue or revoke staff security badges.",
    ur: "اسٹاف سیکیورٹی بیجز جاری یا منسوخ کرنے کے لیے مطلوبہ اختیارات ناکافی ہیں۔",
  },
  NOT_FOUND: {
    en: "Employee profile not found.",
    ur: "ملازم کی پروفائل نہیں ملی۔",
  },
};
