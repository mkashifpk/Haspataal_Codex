import type { EstablishmentOut } from "./generated/facility_profile";
import type { PackOut, PackIssueIn, WardOccupancyOut, TheaterOut } from "./generated/cssd_stock";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for cssd_stock according to Rule 56077b4ba3.
 * Uses GET /establishment views.screens.cssd_stock. Never decides from facility category.
 */
export function getCssdStockScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "cssd_stock");
  if (screenEntry?.view) {
    return screenEntry.view;
  }

  // 2. Check cssd capability state
  const capabilities = establishment.capabilities || [];
  const cssdCap = capabilities.find((c) => c.capability === "cssd");
  if (cssdCap) {
    if (cssdCap.state === "Active") return "full";
    if (cssdCap.state === "Retiring") return "open_work";
    if (cssdCap.state === "Retired") return "records";
    if (cssdCap.state === "Preparing") return "setup";
    if (cssdCap.state === "Available") return "hidden";
  }

  // 3. Check active capabilities
  if (establishment.active && !establishment.active.includes("cssd")) {
    return "setup";
  }

  return "full";
}

/**
 * Returns true if cssd is active in establishment.
 */
export function isCssdActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("cssd");
}

/**
 * Role permissions for CSSD stock and pack issue operations.
 */
export function canOperateCssd(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("cssd.operate");
}

export function canIssuePacks(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("cssd.operate");
}

export function canViewCssd(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("cssd.view") ||
    user.permissions.includes("cssd.operate") ||
    user.permissions.includes("cssd.manage") ||
    user.permissions.includes("cssd.pack.use")
  );
}

/**
 * Sorts stock packs by soonest expiry first (FIFO) per Rule 613c123950.
 * Expiring soon packs are prioritized for issue.
 */
export function sortPacksByExpiry(packs: PackOut[]): PackOut[] {
  return [...packs].sort((a, b) => {
    // 1. Prioritize expiring_soon first
    if (a.expiring_soon && !b.expiring_soon) return -1;
    if (!a.expiring_soon && b.expiring_soon) return 1;

    // 2. Soonest expiry first
    const dateA = new Date(a.expires_on).getTime();
    const dateB = new Date(b.expires_on).getTime();
    if (dateA !== dateB) return dateA - dateB;

    // 3. Alphabetical pack code
    return a.pack_code.localeCompare(b.pack_code);
  });
}

/**
 * Input validation for pack issue basket (Rule 3834d11044 & Rule 5298373f7d).
 * Issue to one ward or one theatre from server lists; never typed IDs; basket non-empty.
 */
export interface PackIssueValidationInput {
  packCodes: string[];
  destinationType: "ward" | "ot";
  wardId: number | null;
  otId: number | null;
  wards: WardOccupancyOut[];
  theaters: TheaterOut[];
}

export function validatePackIssue(input: PackIssueValidationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.packCodes || input.packCodes.length === 0) {
    errors.push("Scan or add at least one sterile pack to the issue basket.");
  }

  // Check duplicate pack codes in basket
  const uniqueCodes = new Set(input.packCodes);
  if (uniqueCodes.size !== input.packCodes.length) {
    errors.push("Duplicate pack codes detected in the basket. Each pack may only be issued once.");
  }

  if (input.destinationType === "ward") {
    if (!input.wardId) {
      errors.push("Select a destination ward from the list.");
    } else {
      const wardExists = input.wards.some((w) => w.ward_id === input.wardId);
      if (!wardExists && input.wards.length > 0) {
        errors.push("Selected ward is not found in the hospital bed matrix.");
      }
    }
    if (input.otId) {
      errors.push("Cannot issue to both a ward and an operating theatre simultaneously.");
    }
  } else if (input.destinationType === "ot") {
    if (!input.otId) {
      errors.push("Select a destination operating theatre from the list.");
    } else {
      const otExists = input.theaters.some((t) => t.ot_id === input.otId);
      if (!otExists && input.theaters.length > 0) {
        errors.push("Selected operating theatre is not found in the theatre registry.");
      }
    }
    if (input.wardId) {
      errors.push("Cannot issue to both an operating theatre and a ward simultaneously.");
    }
  } else {
    errors.push("Choose destination type: either Ward or Operating Theatre.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Bilingual explanations for CSSD stock and issue error codes.
 */
export function explainCssdStockError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    CSSD_PACK_UNUSABLE: {
      en: details?.pack_code
        ? `Pack "${details.pack_code}" cannot be issued: it is not available, expired, failed, or recalled.`
        : "This sterile pack cannot be issued or used: it is not available, it has expired, failed or been recalled. Do not use it.",
      ur: details?.pack_code
        ? `پیک "${details.pack_code}" جاری نہیں کیا جا سکتا: یہ دستیاب نہیں ہے، اس کی میعاد ختم ہے، یا مسترد شدہ ہے۔`
        : "یہ سٹرائل پیک جاری یا استعمال نہیں کیا جا سکتا: یہ دستیاب نہیں ہے، اس کی میعاد ختم ہو چکی ہے، ناکام یا واپس طلب شدہ ہے۔ اسے استعمال نہ کریں۔",
    },
    REFERENCE_NOT_FOUND: {
      en: "A referenced record (pack, ward, or theatre) does not exist.",
      ur: "حوالہ شدہ ریکارڈ (پیک، وارڈ یا تھیٹر) موجود نہیں ہے۔",
    },
    VALIDATION_ERROR: {
      en: "The request is invalid. Check the scanned packs and destination.",
      ur: "درخواست غلط ہے۔ اسکین شدہ پیکس اور منتخب منزل کی تصدیق کریں۔",
    },
    BED_NO_LONGER_AVAILABLE: {
      en: "Bed was reserved by another terminal.",
      ur: "بیڈ کسی اور ٹرمینل نے بک کر لیا ہے۔",
    },
    FORBIDDEN: {
      en: "You do not have permission to issue sterile packs (cssd.operate required).",
      ur: "آپ کو سٹرائل پیکس جاری کرنے کی اجازت نہیں ہے (cssd.operate درکار ہے)۔",
    },
    CAPABILITY_INACTIVE: {
      en: "CSSD service is inactive. No packs can be issued.",
      ur: "سی ایس ایس ڈی سروس غیر فعال ہے۔ پیکس جاری نہیں کیے جا سکتے۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ براہ کرم دوبارہ کوشش کریں۔`,
    }
  );
}
