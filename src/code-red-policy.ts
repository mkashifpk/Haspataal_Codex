/**
 * Domain rules and clinical policies for Screen 94: code_red
 * ("Code Red / Emergency admit", Position 94, 60 points)
 * Under MSDS AAC 15-20, MSDS 18, MSDS 20
 * Rules: rule:79df75a537, rule:ddc33f8c02, rule:2d008ab65a, rule:77b021933d,
 * rule:3eafe672a6, rule:0bf43fe61a, rule:97aab11043, rule:e67eb016d9,
 * rule:8cd8387cf2, rule:45f4e0ca60
 */

import type { ClinicalUser } from "./clinical-context";
import type { EstablishmentOut } from "./generated/facility_profile";
import type { CodeRedIn, TraumaCreate } from "./generated/code_red";

export interface CodeRedViewEval {
  canShow: boolean;
  canStartNewWork: boolean;
  isReadOnly: boolean;
  isSetupOnly: boolean;
  canOfferEmergency: boolean;
  canOfferSurgery: boolean;
  bannerNotice: string | null;
}

export function evaluateCodeRedView(establishment: EstablishmentOut): CodeRedViewEval {
  const inpatientActive = establishment.active?.includes("inpatient") ?? false;
  const emergencyActive = establishment.active?.includes("emergency_department") ?? false;
  const surgeryActive = establishment.active?.includes("surgery") ?? false;

  let screenMode = "full";
  const screens = (establishment as any)?.views?.screens || (establishment as any)?.screens;

  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "code_red");
    if (item?.view) screenMode = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["code_red"]?.view) screenMode = screens["code_red"].view;
    else if (typeof screens["code_red"] === "string") screenMode = screens["code_red"];
  }

  if (screenMode === "hidden") {
    return {
      canShow: false,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: false,
      canOfferEmergency: false,
      canOfferSurgery: false,
      bannerNotice: null,
    };
  }

  if (screenMode === "setup") {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: true,
      canOfferEmergency: false,
      canOfferSurgery: false,
      bannerNotice: "Inpatient service is in setup mode. Code Red activation is restricted.",
    };
  }

  if (screenMode === "records" || !inpatientActive) {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: false,
      canOfferEmergency: false,
      canOfferSurgery: false,
      bannerNotice: "Inpatient service is inactive. Historical admissions only.",
    };
  }

  if (screenMode === "open_work") {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: false,
      isSetupOnly: false,
      canOfferEmergency: emergencyActive,
      canOfferSurgery: surgeryActive,
      bannerNotice: "No new emergency admissions from now on. Completing existing transfers only.",
    };
  }

  return {
    canShow: true,
    canStartNewWork: true,
    isReadOnly: false,
    isSetupOnly: false,
    canOfferEmergency: emergencyActive,
    canOfferSurgery: surgeryActive,
    bannerNotice: null,
  };
}

export function canTriggerCodeRed(user: ClinicalUser): boolean {
  return user.permissions?.includes("ipd.admission.code_red") ?? false;
}

export function canConfirmArrival(user: ClinicalUser): boolean {
  const allowed = [
    "ipd.admission.arrive",
    "ipd.bed.manage",
    "ipd.nurse.care",
    "ipd.doctor.care",
  ];
  return user.permissions?.some((p) => allowed.includes(p)) ?? false;
}

export function canCreateTrauma(user: ClinicalUser): boolean {
  return (
    user.permissions?.includes("ipd.admission.code_red") ||
    user.permissions?.includes("patient.create") ||
    false
  );
}

/**
 * Validates Code Red activation payload (rule:79df75a537, rule:45f4e0ca60).
 * Never blocks on billing, demographics, diagnosis, or photos.
 */
export function validateCodeRedInput(
  input: CodeRedIn,
  viewEval: CodeRedViewEval
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Patient identity: either existing patient_id or trauma profile info
  if (!input.patient_id && !input.temp_identifier && !input.gender) {
    errors.patient = "Specify either a known patient ID or emergency trauma identifier/gender.";
  }

  // Destination ward or type
  if (!input.ward_id && !input.ward_type) {
    errors.ward = "Select a destination resuscitation ward or ward type (e.g. ICU / Emergency).";
  }

  // Emergency surgery theatre hold
  if (input.needs_ot && !viewEval.canOfferSurgery) {
    errors.needs_ot = "Surgery service is currently inactive. Cannot place emergency OT hold.";
  }

  // Medico-legal requirements if checked
  if (input.is_medico_legal && !input.mlc_case_type_id) {
    errors.mlc_case_type_id = "Select the medico-legal case type for suspected trauma/MLC.";
  }

  return errors;
}

/**
 * Validates temporary trauma profile input.
 */
export function validateTraumaInput(input: TraumaCreate): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.temp_identifier || input.temp_identifier.trim().length < 3) {
    errors.temp_identifier = "Temporary identifier is required (e.g. 'Unknown Male 1').";
  }

  if (!input.gender) {
    errors.gender = "Perceived gender selection is required.";
  }

  if (input.approx_age_years !== null && input.approx_age_years !== undefined) {
    if (input.approx_age_years < 0 || input.approx_age_years > 130) {
      errors.approx_age_years = "Estimated age must be between 0 and 130 years.";
    }
  }

  return errors;
}

export interface CodeRedAlertEvent {
  admission_id: number;
  admission_number: string;
  patient_name: string;
  mrn: string;
  ward_name: string;
  needs_ot: boolean;
  eta_minutes: number | null;
  message: string;
  triggered_at: string;
}

/**
 * Explains backend error responses for code_red.
 */
export function explainCodeRedError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  if (typeof err === "string") return err;

  const anyErr = err as {
    message?: string;
    code?: string;
    status?: number;
    details?: Record<string, unknown>;
  };

  switch (anyErr.code) {
    case "INPATIENT_INACTIVE":
      return "Inpatient service is currently inactive in facility profile.";

    case "SURGERY_INACTIVE":
      return "Surgery service is inactive. Emergency operating theatre hold cannot be requested.";

    case "CODE_RED_ACTIVE":
      return "An active Code Red admission already exists for this patient.";

    case "ALREADY_ARRIVED":
      return "Patient arrival has already been confirmed for this admission.";

    case "VALIDATION_ERROR":
      return anyErr.message || "Code Red submission validation failed.";

    default:
      return anyErr.message || "An error occurred while processing Code Red admission.";
  }
}
