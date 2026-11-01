import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  SterilizationCycleOut,
  SetTypeOut,
  SterilizerOut,
} from "./generated/cssd_board";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for cssd_board according to Rule dfad4a25d2.
 * Uses GET /establishment views.screens.cssd_board. Never decides from facility category.
 */
export function getCssdBoardScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "cssd_board");
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
 * Returns true if cssd is in the active list (rule:0bdd7f9ba6 — POST /cssd/cycles only while Active).
 */
export function isCssdActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("cssd");
}

/**
 * Permission checks for CSSD board operations.
 */
export function canOperateCssd(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("cssd.operate");
}

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

export function canPrintLabels(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("cssd.operate") || user.permissions.includes("cssd.manage");
}

/**
 * Validates cycle start input (rule:9a5570e2a6).
 * For Load cycles: sterilizer required, packs required and non-empty, method must match.
 * For BowieDick/LeakTest/BiologicalTest: no packs allowed.
 */
export interface CycleStartInput {
  sterilizer_id: number | null;
  cycle_type: "Load" | "BowieDick" | "LeakTest" | "BiologicalTest";
  packs: Array<{ set_type_id: number; count: number }>;
  sterilizers: SterilizerOut[];
  setTypes: SetTypeOut[];
}

export function validateCycleStart(input: CycleStartInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.sterilizer_id) {
    errors.push("Select a sterilizer.");
  }

  const sterilizer = input.sterilizers.find((s) => s.sterilizer_id === input.sterilizer_id);

  if (input.cycle_type === "Load") {
    if (input.packs.length === 0) {
      errors.push("Add at least one set to the load.");
    } else {
      for (const pack of input.packs) {
        if (pack.count <= 0) {
          errors.push("Each set must have a count greater than zero.");
          break;
        }
        if (sterilizer) {
          const setType = input.setTypes.find((st) => st.set_type_id === pack.set_type_id);
          if (setType && setType.method !== sterilizer.method) {
            errors.push(
              `Set "${setType.name}" uses ${setType.method} method but this sterilizer uses ${sterilizer.method}. Only matching-method sets can be added.`
            );
          }
        }
      }
    }
  } else {
    // BowieDick, LeakTest, BiologicalTest — no packs (rule:9a5570e2a6)
    if (input.packs.length > 0) {
      errors.push("Test cycles must not include any packs.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates cycle results input (rule:4d7517d090).
 */
export interface CycleResultsInput {
  temperature_c: number | null;
  pressure_kpa: number | null;
  exposure_minutes: number | null;
  mechanical_pass: boolean | null;
  chemical_result: "Pass" | "Fail" | null;
  biological_result: "Pending" | "Pass" | "Fail" | "NotUsed" | null;
  failure_note: string;
  cycleStatus: "Running" | "Quarantined";
}

export function validateCycleResults(input: CycleResultsInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // For quarantined loads, only biological_result is sent
  if (input.cycleStatus === "Quarantined") {
    if (!input.biological_result || input.biological_result === "Pending") {
      errors.push("Select the biological indicator result (Pass or Fail) to release or fail this quarantined load.");
    }
    if (input.biological_result === "Fail" && !input.failure_note.trim()) {
      errors.push("A failure note is required when biological indicator fails.");
    }
    return { valid: errors.length === 0, errors };
  }

  // Running cycle: record full parameters
  if (input.temperature_c === null || isNaN(input.temperature_c)) {
    errors.push("Temperature (°C) is required.");
  } else if (input.temperature_c < 20 || input.temperature_c > 250) {
    errors.push("Temperature must be between 20 and 250 °C.");
  }

  if (input.pressure_kpa === null || isNaN(input.pressure_kpa)) {
    errors.push("Pressure (kPa) is required.");
  } else if (input.pressure_kpa < 0 || input.pressure_kpa > 500) {
    errors.push("Pressure must be between 0 and 500 kPa.");
  }

  if (input.exposure_minutes === null || isNaN(input.exposure_minutes)) {
    errors.push("Exposure time (min) is required.");
  } else if (input.exposure_minutes < 0 || input.exposure_minutes > 1440) {
    errors.push("Exposure time must be between 0 and 1440 minutes.");
  }

  if (input.mechanical_pass === null) {
    errors.push("Mechanical indicator result is required.");
  }

  if (!input.chemical_result) {
    errors.push("Chemical indicator result is required.");
  }

  // If any indicator fails, failure_note is required (rule:4d7517d090)
  const hasFail =
    input.mechanical_pass === false ||
    input.chemical_result === "Fail" ||
    input.biological_result === "Fail";

  if (hasFail && !input.failure_note.trim()) {
    errors.push("A failure note is required when any indicator fails.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks if a steam sterilizer has passed its Bowie-Dick test today (rule:2e3fcc57c7).
 * Returns true if test is required (not yet passed) — i.e., no BowieDick cycle with Released status exists today.
 */
export function isBowieDickRequired(sterilizerId: number, cycles: SterilizationCycleOut[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return !cycles.some(
    (c) =>
      c.sterilizer_id === sterilizerId &&
      c.cycle_type === "BowieDick" &&
      c.status === "Released" &&
      c.started_at.slice(0, 10) === today
  );
}

/**
 * Bilingual error explanation for CSSD board error codes.
 */
export function explainCssdBoardError(code: string): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    CSSD_DAILY_TEST_REQUIRED: {
      en: "Run and pass the day's Bowie-Dick test of this sterilizer before its steam loads are released.",
      ur: "اس آٹوکلیو کی بھاپ کی لوڈ جاری کرنے سے پہلے آج کا بووی-ڈک ٹیسٹ چلائیں اور پاس کریں۔",
    },
    CSSD_BIOLOGICAL_REQUIRED: {
      en: "A load with an implant is released on its biological indicator: quarantine it until the indicator is read.",
      ur: "امپلانٹ والی لوڈ کو حیاتیاتی اشاریہ پر جاری کیا جاتا ہے: اشاریہ پڑھے جانے تک قرنطینہ کریں۔",
    },
    CSSD_CYCLE_STATE_INVALID: {
      en: "The sterilization cycle cannot change that way: its results are final once it is released or failed.",
      ur: "یہ نس بندی سائیکل اس طرح تبدیل نہیں ہو سکتا: ایک بار جاری یا ناکام ہونے کے بعد نتائج حتمی ہیں۔",
    },
    CAPABILITY_INACTIVE: {
      en: "This service is not active here, so no new work of it can start (Settings, facility; GET /establishment).",
      ur: "یہ سروس یہاں فعال نہیں ہے، اس لیے اس کا کوئی نیا کام شروع نہیں ہو سکتا (سیٹنگز، سہولت)۔",
    },
    REFERENCE_NOT_FOUND: {
      en: "A referenced record does not exist.",
      ur: "حوالہ شدہ ریکارڈ موجود نہیں ہے۔",
    },
    VALIDATION_ERROR: {
      en: "The request is invalid. Check field values and try again.",
      ur: "درخواست غلط ہے۔ فیلڈ کی قدریں جانچیں اور دوبارہ کوشش کریں۔",
    },
    FORBIDDEN: {
      en: "You do not have permission to perform this action.",
      ur: "آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔",
    },
    VERSION_CONFLICT: {
      en: "This record was changed by someone else. Refresh and try again.",
      ur: "یہ ریکارڈ کسی اور نے تبدیل کر دیا۔ ریفریش کریں اور دوبارہ کوشش کریں۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ براہ کرم دوبارہ کوشش کریں۔`,
    }
  );
}

/**
 * Sorts cycles board-order: Running and Quarantined pinned at top (rule:b48c7fa7a8).
 */
export function sortCyclesBoardOrder(cycles: SterilizationCycleOut[]): SterilizationCycleOut[] {
  const priority = (s: SterilizationCycleOut): number => {
    if (s.status === "Running") return 0;
    if (s.status === "Quarantined") return 1;
    return 2;
  };
  return [...cycles].sort((a, b) => {
    const pd = priority(a) - priority(b);
    if (pd !== 0) return pd;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });
}

/**
 * Gets compatible set types for a sterilizer (rule:9a5570e2a6 — only sets matching the method).
 */
export function getCompatibleSetTypes(sterilizerId: number | null, sterilizers: SterilizerOut[], setTypes: SetTypeOut[]): SetTypeOut[] {
  if (!sterilizerId) return setTypes.filter((st) => st.is_active);
  const sterilizer = sterilizers.find((s) => s.sterilizer_id === sterilizerId);
  if (!sterilizer) return [];
  return setTypes.filter((st) => st.is_active && st.method === sterilizer.method);
}
