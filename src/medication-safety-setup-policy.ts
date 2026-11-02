/**
 * Domain policy and statutory business rules for Screen 136: medication_safety_setup
 * ("High-alert drugs & look-alike/sound-alike rules", Position 136, 54 points, Workspace `pharmacy_admin`).
 * 
 * Statutory & Quality Rules:
 * - rule:a8dc0017ab: Flag from the formulary search: high_alert_category (null clears it; never on an OTC medicine)
 *                    and is_restricted. Pair look-alikes with a note on how to tell them apart; retire a pair with is_active false.
 * - rule:6da5fd1c68: Print the list again after every change and replace it at the nursing stations and the pharmacy.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  DrugSafetyIn,
  LasaPairIn,
  LasaPairUpdateIn,
} from "./generated/medication_safety_setup";

export type MedicationSafetyCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const HIGH_ALERT_CATEGORIES = [
  "ConcentratedElectrolyte",
  "Chemotherapy",
  "Anticoagulant",
  "Insulin",
  "Opioid",
  "Sedative",
  "NeuromuscularBlocker",
  "Inotrope",
  "Thrombolytic",
  "Psychotropic",
  "HighCost",
  "Other",
] as const;

export type HighAlertCategory = typeof HIGH_ALERT_CATEGORIES[number];

export const HIGH_ALERT_CATEGORY_LABELS: Record<HighAlertCategory, { en: string; ur: string }> = {
  ConcentratedElectrolyte: { en: "Concentrated Electrolyte", ur: "مرکوز الیکٹرولائٹ" },
  Chemotherapy: { en: "Chemotherapy / Cytotoxic", ur: "کیموتھراپی ادویات" },
  Anticoagulant: { en: "Anticoagulant / Blood Thinner", ur: "خون پتلا کرنے والی دوا" },
  Insulin: { en: "Insulin / Hypoglycemic", ur: "انسولین" },
  Opioid: { en: "Opioid / Narcotic Analgesic", ur: "اوپیئڈ نشہ آور دوا" },
  Sedative: { en: "Sedative / Hypnotic", ur: "مسکن دوا" },
  NeuromuscularBlocker: { en: "Neuromuscular Blocker", ur: "اعصابی و پٹھوں کو سن کرنے والی دوا" },
  Inotrope: { en: "Inotrope / Cardiac Vasopressor", ur: "قلبی ادویات" },
  Thrombolytic: { en: "Thrombolytic / Clot Buster", ur: "تھرومبولیٹک دوا" },
  Psychotropic: { en: "Psychotropic Drug", ur: "نفسیاتی ادویات" },
  HighCost: { en: "High Cost Medicine", ur: "انتہائی قیمتی دوا" },
  Other: { en: "Other High-Alert Medicine", ur: "دیگر ہائی الرٹ ادویات" },
};

/**
 * Resolves capability view for medication_safety_setup from establishment configuration.
 */
export function getMedicationSafetySetupCapabilityView(
  establishment?: EstablishmentOut | null
): MedicationSafetyCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "medication_safety_setup");
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
    const configured = (screens as Record<string, { view?: string }>)?.["medication_safety_setup"]?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured as MedicationSafetyCapabilityView;
    }
  }

  return "full";
}

/**
 * Validates updating a drug's high-alert category or restriction flags under rule:a8dc0017ab.
 * Statutory rule: null clears high_alert_category; high_alert_category can NEVER be assigned to an OTC medicine.
 */
export function validateDrugSafetyPatch(
  patch: DrugSafetyIn,
  drugSchedule?: string | null,
  isOtcAllowed?: boolean | null
): { valid: boolean; error?: string } {
  // If setting a high-alert category, check that the medicine is not OTC
  if (patch.high_alert_category !== undefined && patch.high_alert_category !== null) {
    if (!HIGH_ALERT_CATEGORIES.includes(patch.high_alert_category)) {
      return { valid: false, error: "Valid high-alert category is required." };
    }

    if (drugSchedule === "OTC" || isOtcAllowed === true) {
      return {
        valid: false,
        error: "Statutory violation: A high-alert category can never be assigned to an OTC medicine (rule:a8dc0017ab).",
      };
    }
  }

  return { valid: true };
}

/**
 * Validates creating a Look-Alike / Sound-Alike (LASA) safety pair under rule:a8dc0017ab.
 * Statutory rule: Pair look-alikes with a note on how to tell them apart.
 */
export function validateLasaPairInput(
  input: LasaPairIn,
  existingPairs?: { drug_id: number; other_drug_id: number; is_active: boolean }[]
): { valid: boolean; error?: string } {
  const d1 = Number(input.drug_id);
  const d2 = Number(input.other_drug_id);

  if (isNaN(d1) || d1 <= 0) {
    return { valid: false, error: "Primary medicine selection is required." };
  }
  if (isNaN(d2) || d2 <= 0) {
    return { valid: false, error: "Paired medicine selection is required." };
  }
  if (d1 === d2) {
    return { valid: false, error: "A medicine cannot be paired with itself as a look-alike." };
  }

  if (!input.note || !input.note.trim()) {
    return {
      valid: false,
      error: "A distinction note explaining how to tell the medicines apart is required (rule:a8dc0017ab).",
    };
  }

  // Duplicate pair check
  if (Array.isArray(existingPairs)) {
    const isDuplicate = existingPairs.some(
      (p) =>
        p.is_active &&
        ((p.drug_id === d1 && p.other_drug_id === d2) ||
          (p.drug_id === d2 && p.other_drug_id === d1))
    );
    if (isDuplicate) {
      return {
        valid: false,
        error: "These two medicines are already paired as look-alike / sound-alike (LASA_PAIR_EXISTS).",
      };
    }
  }

  return { valid: true };
}

/**
 * Validates updating or retiring a Look-Alike / Sound-Alike (LASA) pair.
 * Statutory rule: retire a pair with is_active false.
 */
export function validateLasaPairUpdate(update: LasaPairUpdateIn): { valid: boolean; error?: string } {
  if (update.note !== undefined && update.note !== null) {
    if (!update.note.trim()) {
      return { valid: false, error: "Distinction note cannot be empty." };
    }
  }
  return { valid: true };
}

/**
 * Statutory error messages dictionary matching backend contract.
 */
export const MEDICATION_SAFETY_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  FORBIDDEN: {
    en: "You do not have permission to configure medication safety settings.",
    ur: "آپ کو ادویات کے حفاظتی ضوابط تبدیل کرنے کی اجازت نہیں ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request data is invalid. Please review input fields.",
    ur: "درخواست کے کوائف درست نہیں ہیں۔ براہ کرم فیلڈز چیک کریں۔",
  },
  LASA_PAIR_EXISTS: {
    en: "These two medicines are already paired as look-alikes.",
    ur: "یہ دونوں ادویات پہلے ہی مشابہ ادویات کے جوڑے کے طور پر رجسٹرڈ ہیں۔",
  },
  NOT_FOUND: {
    en: "The requested drug or LASA pair was not found.",
    ur: "درخواست کردہ دوا یا مشابہ جوڑا نہیں مل سکا۔",
  },
  VERSION_CONFLICT: {
    en: "This record was updated by another user; please refresh and try again.",
    ur: "یہ ریکارڈ کسی اور صارف نے تبدیل کر دیا ہے؛ براہ کرم صفحہ ریفریش کر کے دوبارہ کوشش کریں۔",
  },
};
