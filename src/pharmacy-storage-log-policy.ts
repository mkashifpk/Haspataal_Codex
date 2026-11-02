/**
 * Domain policy and statutory business rules for Screen 138: pharmacy_storage_log
 * ("Medicine storage log & temperature monitoring", Position 138, 51 points, Workspace `pharmacy_admin`).
 *
 * Statutory & Quality Rules:
 * - rule:09925ecb70: Record: storage_area (pick from areas already used, or type a new one: keep one spelling per place),
 *                    kind (Room / Refrigerator / Freezer / ColdChainBox), the ward for a ward cupboard, temperature,
 *                    humidity (optional), own limits only for a place with its own range (a vaccine box). The limits of
 *                    the kind come from settings (pharmacy_room_*_c, pharmacy_fridge_*_c, pharmacy_freezer_*_c).
 * - rule:e66d8b92db: Out of range: the form demands action_taken (STORAGE_CHECK_ACTION_REQUIRED); show the row red;
 *                    the event pharmacy.storage.out_of_range reaches the pharmacists at once.
 * - rule:ac70d74fb1: Summary tiles per area: readings, out of range, lowest, highest, days with both readings of the day
 *                    (expected checks_per_day = 2); a day with one reading or none is a gap to explain to the surveyor.
 * - rule:1b0e847e97: Print the register for the period the surveyor asks (PDF). Ward nurses record their own ward's
 *                    cupboard and refrigerator from the ward screens with the same POST.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type { StorageCheckIn, StorageRangesOut } from "./generated/pharmacy_storage_log";

export type PharmacyStorageLogCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const STORAGE_KINDS = ["Room", "Refrigerator", "Freezer", "ColdChainBox"] as const;
export type StorageKind = typeof STORAGE_KINDS[number];

export const STORAGE_KIND_LABELS: Record<StorageKind, { en: string; ur: string }> = {
  Room: { en: "Room / Ambient Store (15°C to 25°C)", ur: "کمرے کا درجہ حرارت / اسٹور (15 تا 25 ڈگری)" },
  Refrigerator: { en: "Medicine Refrigerator (2°C to 8°C)", ur: "ادویات کا ریفریجریٹر (2 تا 8 ڈگری)" },
  Freezer: { en: "Medicine Freezer (-20°C to -10°C)", ur: "فریزر (-20 تا -10 ڈگری)" },
  ColdChainBox: { en: "Vaccine Cold Chain Box / Carrier", ur: "ویکسین کولڈ چین باکس / کیریئر" },
};

export const DEFAULT_STORAGE_RANGES: StorageRangesOut = {
  room_min: 15.0,
  room_max: 25.0,
  fridge_min: 2.0,
  fridge_max: 8.0,
  freezer_min: -20.0,
  freezer_max: -10.0,
};

export const STORAGE_LOG_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  STORAGE_CHECK_ACTION_REQUIRED: {
    en: "The reading is out of range: record the action taken.",
    ur: "درجہ حرارت یا نمی مقررہ حد سے باہر ہے: برائے مہربانی فوری حفاظتی اقدام درج کریں۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this.",
    ur: "آپ کے پاس یہ اقدام کرنے کا مجاز اختیار نہیں ہے۔",
  },
  REFERENCE_NOT_FOUND: {
    en: "A referenced record does not exist.",
    ur: "حوالہ دیا گیا ریکارڈ سسٹم میں موجود نہیں ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid. Please check the entered fields.",
    ur: "درخواست غلط ہے۔ برائے مہربانی درج کردہ خانے چیک کریں۔",
  },
};

/**
 * Resolves capability view for pharmacy_storage_log from establishment configuration.
 */
export function getPharmacyStorageLogCapabilityView(
  establishment?: EstablishmentOut | null
): PharmacyStorageLogCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "pharmacy_storage_log");
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
    const entry = (screens as Record<string, any>)?.["pharmacy_storage_log"];
    const configured = typeof entry === "string" ? entry : entry?.view;
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
  return "full";
}

/**
 * Resolves applicable min and max temperature limits for a storage check.
 */
export function resolveStorageLimits(
  kind: StorageKind,
  customMin?: number | string | null,
  customMax?: number | string | null,
  ranges?: StorageRangesOut | null
): { min_c: number; max_c: number } {
  const cMin = customMin !== undefined && customMin !== null && customMin !== "" ? Number(customMin) : null;
  const cMax = customMax !== undefined && customMax !== null && customMax !== "" ? Number(customMax) : null;

  if (cMin !== null && cMax !== null && !isNaN(cMin) && !isNaN(cMax)) {
    return { min_c: cMin, max_c: cMax };
  }

  const r = ranges || DEFAULT_STORAGE_RANGES;
  switch (kind) {
    case "Room":
      return { min_c: r.room_min, max_c: r.room_max };
    case "Refrigerator":
    case "ColdChainBox":
      return { min_c: r.fridge_min, max_c: r.fridge_max };
    case "Freezer":
      return { min_c: r.freezer_min, max_c: r.freezer_max };
    default:
      return { min_c: 2.0, max_c: 8.0 };
  }
}

/**
 * Checks if a given temperature reading is outside permitted boundaries.
 */
export function isTemperatureOutOfRange(
  temp: number,
  min: number,
  max: number
): boolean {
  return temp < min || temp > max;
}

/**
 * Validates storage check recording under Rule rule:09925ecb70 and Rule rule:e66d8b92db.
 */
export function validateStorageCheckInput(
  input: Partial<StorageCheckIn>,
  ranges?: StorageRangesOut | null
): {
  valid: boolean;
  errors: Record<string, string>;
  isOutOfRange: boolean;
  effectiveLimits: { min_c: number; max_c: number };
} {
  const errors: Record<string, string> = {};

  if (!input.storage_area || input.storage_area.trim().length < 2) {
    errors.storage_area = "A valid storage area name is required (e.g. Pharmacy Main Fridge).";
  }

  if (!input.storage_kind || !STORAGE_KINDS.includes(input.storage_kind as StorageKind)) {
    errors.storage_kind = "A valid storage kind (Room, Refrigerator, Freezer, or ColdChainBox) is required.";
  }

  const tempNum = Number(input.temperature_c);
  if (input.temperature_c === undefined || input.temperature_c === null || input.temperature_c === "" || isNaN(tempNum)) {
    errors.temperature_c = "A numeric temperature reading in degrees Celsius is required.";
  }

  if (input.humidity_pct !== undefined && input.humidity_pct !== null && input.humidity_pct !== "") {
    const humNum = Number(input.humidity_pct);
    if (isNaN(humNum) || humNum < 0 || humNum > 100) {
      errors.humidity_pct = "Relative humidity must be a percentage between 0 and 100%.";
    }
  }

  // Custom limits: both or neither
  const hasMin = input.min_c !== undefined && input.min_c !== null && input.min_c !== "";
  const hasMax = input.max_c !== undefined && input.max_c !== null && input.max_c !== "";
  if ((hasMin && !hasMax) || (!hasMin && hasMax)) {
    errors.custom_limits = "Custom storage limits require both minimum and maximum temperatures, or neither.";
  } else if (hasMin && hasMax) {
    const minNum = Number(input.min_c);
    const maxNum = Number(input.max_c);
    if (isNaN(minNum) || isNaN(maxNum) || minNum >= maxNum) {
      errors.custom_limits = "Minimum limit must be strictly less than maximum limit.";
    }
  }

  const effectiveLimits = resolveStorageLimits(
    (input.storage_kind as StorageKind) || "Refrigerator",
    input.min_c,
    input.max_c,
    ranges
  );

  let isOutOfRange = false;
  if (!isNaN(tempNum)) {
    isOutOfRange = isTemperatureOutOfRange(tempNum, effectiveLimits.min_c, effectiveLimits.max_c);
    if (isOutOfRange) {
      if (!input.action_taken || input.action_taken.trim().length < 4) {
        errors.action_taken = "The reading is out of range: record the action taken (STORAGE_CHECK_ACTION_REQUIRED).";
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    isOutOfRange,
    effectiveLimits,
  };
}
