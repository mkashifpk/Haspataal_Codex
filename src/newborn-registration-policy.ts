/**
 * Domain policy and business rules for Newborn Registration & Identification
 * (`newborn_registration`, Screen 84).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS Cat I 30, II C 69 (decisions 44).
 * - Registration from mother's bed: time of birth (not future), sex, idempotency protection (rule:c4dcf395e2).
 * - Immediate newborn wristband issuance on mother's admission (rule:c4dcf395e2).
 * - Replacement wristband with mother's admission_id, newborn_patient_id, and replacement_reason (rule:695cc4d1de).
 * - Handoff to labour register and Union Council birth notification (rule:55a7f06927).
 * - Baby requiring independent care admitted or seen in ER like any patient (rule:1fff1897f1).
 * - Service capability gating and views (rule:0b0674e405, rule:e261e1b4d0).
 * - Unidentified mother mobile null and merged patient name updating (decision 61).
 */

import type {
  NewbornIn,
  NewbornRegisteredOut,
  NewbornOut,
  WristbandIn,
} from "./generated/newborn_registration";
import type { EstablishmentOut } from "./generated/facility_profile";

export type ScreenView = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ScreenViewItem {
  screen_id: string;
  view: ScreenView;
}

export interface EstablishmentContext {
  active?: string[];
  views?: {
    screens?: ScreenViewItem[] | Record<string, ScreenView>;
  };
}

/**
 * Determines screen view mode for `newborn_registration` (rule:0b0674e405).
 */
export function getNewbornRegistrationScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "newborn_registration");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "newborn_registration" in screens) {
    return (screens as Record<string, ScreenView>)["newborn_registration"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the hospital's maternity capability is currently Active (rule:e261e1b4d0).
 */
export function isMaternityActive(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  if (!establishment?.active) return false;
  return establishment.active.includes("maternity");
}

export interface NewbornValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

/**
 * Validates newborn registration input (rule:c4dcf395e2).
 */
export function validateNewbornInput(
  data: Partial<NewbornIn>,
  nowIso = new Date().toISOString()
): NewbornValidationResult {
  if (!data.admission_id || data.admission_id <= 0) {
    return {
      valid: false,
      error: "The mother's current active admission ID is required",
      field: "admission_id",
    };
  }

  if (!data.born_at) {
    return {
      valid: false,
      error: "Date and time of birth are required",
      field: "born_at",
    };
  }

  // Time of birth cannot be in the future (rule:c4dcf395e2)
  if (data.born_at > nowIso) {
    return {
      valid: false,
      error: "Time of birth cannot be in the future",
      field: "born_at",
    };
  }

  if (!data.gender) {
    return {
      valid: false,
      error: "Baby's biological sex must be specified (male, female, other, unknown)",
      field: "gender",
    };
  }

  return { valid: true };
}

/**
 * Validates newborn replacement wristband input (rule:695cc4d1de).
 */
export function validateReplacementWristbandInput(
  data: Partial<WristbandIn>
): NewbornValidationResult {
  if (!data.admission_id || data.admission_id <= 0) {
    return {
      valid: false,
      error: "Mother's admission ID is required to issue a replacement band",
      field: "admission_id",
    };
  }

  if (!data.newborn_patient_id || data.newborn_patient_id <= 0) {
    return {
      valid: false,
      error: "Newborn patient ID is required for a baby's rooming-in wristband",
      field: "newborn_patient_id",
    };
  }

  if (!data.replacement_reason || !data.replacement_reason.trim()) {
    return {
      valid: false,
      error: "Replacement reason is required when issuing a new wristband for an existing newborn",
      field: "replacement_reason",
    };
  }

  return { valid: true };
}

/**
 * Formats baby display name and identifies unidentified mother cases (decision 61).
 */
export function formatNewbornLabel(baby: {
  full_name: string;
  mother_name?: string | null;
  mrn: string;
}): string {
  return `${baby.full_name} (${baby.mrn})`;
}

/**
 * Domain error explanations for newborn registration and wristband actions.
 */
export function explainNewbornError(
  code: string,
  details?: Record<string, unknown>
): { title: string; message: string; action: string } {
  switch (code) {
    case "CAPABILITY_INACTIVE":
      return {
        title: "Maternity Capability Inactive",
        message: "The maternity service is not active in this hospital (Facility Settings).",
        action: "The service must be activated in Settings before new newborns can be registered.",
      };
    case "NOT_FOUND":
      return {
        title: "Mother Admission Not Found",
        message: "The specified admission does not exist or has already been discharged.",
        action: "Verify that the mother is currently admitted in the labour ward or inpatient bed.",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        title: "Referenced Patient Not Found",
        message: "A referenced admission or newborn patient ID does not exist on the server.",
        action: "Refresh the patient worklist and verify the admission ID.",
      };
    case "VALIDATION_ERROR":
      return {
        title: "Invalid Registration Input",
        message: "The submitted birth information failed validation rules (e.g. birth time in future).",
        action: "Ensure birth timestamp is not in the future and gender is selected.",
      };
    case "WRISTBAND_PRINTER_NOT_CONFIGURED":
      return {
        title: "Wristband Printer Not Found",
        message: "No label printer has been mapped for wristbands on this terminal.",
        action: "Configure a label printer in Terminal Settings or print the band preview.",
      };
    case "FORBIDDEN":
      return {
        title: "Permission Denied",
        message: "Registering a newborn requires both 'maternity.record' and 'patient.wristband.print' permissions.",
        action: "Log in with an authorized ward nurse or head nurse account.",
      };
    default:
      return {
        title: "Newborn Registration Refused",
        message: "The server refused the newborn registration command.",
        action: "Check the details and retry.",
      };
  }
}
