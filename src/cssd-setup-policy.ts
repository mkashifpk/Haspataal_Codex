import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  SetTypeIn,
  SetTypeOut,
  SterilizerIn,
  SterilizerOut,
  SterilizationCycleOut,
  SterilizationCycleDetailOut,
  AssetMonitorOut,
} from "./generated/cssd_setup";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for cssd_setup according to Rule 37dd1f7236.
 * Uses GET /establishment views.screens.cssd_setup. Never decides from facility category.
 */
export function getCssdSetupScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "cssd_setup");
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
 * Permission checks for CSSD setup operations.
 */
export function canManageCssd(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("cssd.manage");
}

export function canViewCssd(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("cssd.view") ||
    user.permissions.includes("cssd.operate") ||
    user.permissions.includes("cssd.manage")
  );
}

export function canViewOpsAssets(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("ops.asset.view") || user.permissions.includes("cssd.manage");
}

/**
 * Packaging standard presets under MSDS IPC 91(iii)
 */
export const PACKAGING_PRESETS: Record<
  "InstrumentSet" | "Pack" | "Linen" | "Single",
  { defaultDays: number; description: string; descriptionUr: string }
> = {
  InstrumentSet: {
    defaultDays: 180,
    description: "Rigid container with biological filter or double peel-pouch wrap (180 days)",
    descriptionUr: "فلٹر کے ساتھ سخت کنٹینر یا ڈبل پاؤچ ریپ (180 دن)",
  },
  Pack: {
    defaultDays: 90,
    description: "Dual-layer medical crepe paper or SMS non-woven wrap (90 days)",
    descriptionUr: "طبی کریپ کاغذ یا نان ووون ایس ایم ایس ریپ (90 دن)",
  },
  Linen: {
    defaultDays: 30,
    description: "Standard woven cotton linen drape wrap (30 days max)",
    descriptionUr: "سوتی کپڑے یا لینن کا روایتی ریپ (زیادہ سے زیادہ 30 دن)",
  },
  Single: {
    defaultDays: 60,
    description: "Heat-sealed transparent plastic/paper peel pouch (60 days)",
    descriptionUr: "ہیٹ سیل شدہ شفاف پلاسٹک اور کاغذ کا پاؤچ (60 دن)",
  },
};

/**
 * Validates adding or updating a set/pack type under Rule 494306e208.
 */
export function validateSetTypeIn(input: SetTypeIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const code = (input.code ?? "").trim();
  if (!code) {
    errors.code = "Set code is required (e.g. MAJ-LAP-01).";
  } else if (!/^[A-Za-z0-9_-]{2,20}$/.test(code)) {
    errors.code = "Set code must be 2-20 alphanumeric characters, hyphens or underscores.";
  }

  const name = (input.name ?? "").trim();
  if (!name) {
    errors.name = "Set name is required (e.g. Major Laparotomy Instrument Set).";
  } else if (name.length < 3) {
    errors.name = "Set name must be at least 3 characters.";
  }

  const validKinds = ["InstrumentSet", "Pack", "Linen", "Single"];
  if (!input.kind || !validKinds.includes(input.kind)) {
    errors.kind = "Valid packaging kind is required.";
  }

  const validMethods = ["Steam", "EthyleneOxide", "Plasma", "DryHeat"];
  if (input.method && !validMethods.includes(input.method)) {
    errors.method = "Invalid sterilization method specified.";
  }

  if (typeof input.shelf_life_days !== "number" || isNaN(input.shelf_life_days) || input.shelf_life_days <= 0) {
    errors.shelf_life_days = "Shelf life must be a positive number of days (MSDS IPC 91 iii).";
  } else if (input.shelf_life_days > 730) {
    errors.shelf_life_days = "Shelf life cannot exceed 2 years (730 days).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates adding a sterilizer machine.
 */
export function validateSterilizerIn(input: SterilizerIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = (input.name ?? "").trim();
  if (!name) {
    errors.name = "Sterilizer name or identifier is required (e.g. Autoclave 1 - Clean Room).";
  } else if (name.length < 2) {
    errors.name = "Sterilizer name must be at least 2 characters.";
  }

  const validMethods = ["Steam", "EthyleneOxide", "Plasma", "DryHeat"];
  if (!input.method || !validMethods.includes(input.method)) {
    errors.method = "Valid sterilization method is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates recalling a sterilization cycle under Rule dc520ffa20 and MSDS IPC 92.
 */
export function validateLoadRecall(
  reason: string,
  cycle: SterilizationCycleOut | SterilizationCycleDetailOut | null
): { valid: boolean; error?: string } {
  if (!cycle) {
    return { valid: false, error: "No sterilization cycle selected for recall." };
  }

  if (cycle.status !== "Released") {
    return {
      valid: false,
      error: `Only released loads can be recalled. Current cycle status is '${cycle.status}' (Rule dc520ffa20).`,
    };
  }

  const trimmedReason = (reason ?? "").trim();
  if (!trimmedReason) {
    return { valid: false, error: "A detailed clinical recall reason is mandatory (MSDS IPC 92)." };
  }

  if (trimmedReason.length < 5) {
    return { valid: false, error: "Recall reason must explain the breakdown or test failure (at least 5 characters)." };
  }

  return { valid: true };
}

/**
 * Explains CSSD domain errors with actionable operational and statutory guidance.
 */
export function explainCssdError(
  code: string,
  details?: unknown
): { en: string; ur: string } {
  switch (code) {
    case "CSSD_SET_EXISTS":
      return {
        en: "A sterile set or pack with this code already exists. Please choose a unique set code or edit the existing set.",
        ur: "اس کوڈ کے ساتھ جراثیم سے پاک سیٹ یا پیک پہلے سے موجود ہے۔ برائے مہربانی منفرد کوڈ درج کریں یا موجودہ سیٹ میں ترمیم کریں۔",
      };
    case "STERILIZER_EXISTS":
      return {
        en: "A sterilizer autoclave with this name already exists in this facility. Please use a distinct name or chamber number.",
        ur: "اس نام کے ساتھ سٹرلائزر آٹوکلیو پہلے سے موجود ہے۔ برائے مہربانی مختلف نام یا چیمبر نمبر استعمال کریں۔",
      };
    case "CSSD_CYCLE_STATE_INVALID":
      return {
        en: "Cannot recall this sterilization cycle: only loads currently in 'Released' state can be recalled under MSDS IPC 92.",
        ur: "اس سٹرلائزیشن سائیکل کو واپس (Recall) نہیں کیا جا سکتا: قواعد کے مطابق صرف 'Released' شدہ لارڈ کو ہی واپس طلب کیا جا سکتا ہے۔",
      };
    case "FORBIDDEN":
      return {
        en: "Access denied: your user account does not have permission for this CSSD operation (requires cssd.manage).",
        ur: "رسائی مسترد: آپ کے اکاؤنٹ کو سی ایس ایس ڈی کی اس کارروائی کی اجازت نہیں ہے (cssd.manage درکار ہے)۔",
      };
    case "VERSION_CONFLICT":
      return {
        en: "This record was updated by another staff member while you were editing. Please refresh and review the latest details.",
        ur: "یہ ریکارڈ کسی دوسرے عملے نے تبدیل کر دیا ہے۔ برائے مہربانی صفحہ تازہ کر کے تازہ ترین تفصیلات دیکھیں۔",
      };
    case "VALIDATION_ERROR":
      return {
        en: "The submission contains invalid or missing required fields. Please check the highlighted inputs.",
        ur: "درخواست میں معلومات نامکمل یا غلط ہیں۔ برائے مہربانی نمایاں کردہ خانے درست کریں۔",
      };
    default:
      return {
        en: `Server request rejected: ${code}. ${typeof details === "string" ? details : ""}`,
        ur: `سرور کی جانب سے درخواست مسترد کر دی گئی: ${code}۔`,
      };
  }
}
