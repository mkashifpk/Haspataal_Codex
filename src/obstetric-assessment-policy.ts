/**
 * Domain policy and business rules for Obstetric Assessment & Risk Categorization
 * (`obstetric_assessment`, Screen 83).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS Cat I 26-28, II C 66 and p.166 (decisions 44).
 * - High-risk deliberate choice: two buttons, none pre-selected (rule:064bedf875).
 * - When high-risk: conditions multi-select from hospital list with Managed/Referred policy,
 *   counselling note mandatory, and external referral offered (rule:064bedf875).
 * - Category I and II A nutrition assessment requirement (rule:272b13a3e0).
 * - Append-only assessment history showing past visits (rule:962fcab00e).
 * - Maternity service capability gating (rule:b8c60b1609, rule:e6bd3426e5, rule:b46e6c48cc).
 */

import type {
  AssessmentIn,
  ObstetricAssessmentOut,
  ObstetricConditionOut,
  ReferralIn,
} from "./generated/obstetric_assessment";
import type { EstablishmentOut } from "./generated/facility_profile";

export type ScreenView = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ScreenViewItem {
  screen_id: string;
  view: ScreenView;
}

export interface EstablishmentContext {
  active?: string[];
  rules_in_force?: Array<{ code: string; applies: boolean }>;
  profile?: { code?: string } | null;
  views?: {
    screens?: ScreenViewItem[] | Record<string, ScreenView>;
  };
}

/**
 * Determines screen view mode for `obstetric_assessment` (rule:e6bd3426e5).
 */
export function getObstetricAssessmentScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "obstetric_assessment");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "obstetric_assessment" in screens) {
    return (screens as Record<string, ScreenView>)["obstetric_assessment"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the hospital's maternity capability is currently Active (rule:b8c60b1609, rule:b46e6c48cc).
 */
export function isMaternityActive(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  if (!establishment?.active) return false;
  return establishment.active.includes("maternity");
}

/**
 * Checks whether maternal nutrition assessment is mandatory for a high-risk patient (rule:272b13a3e0).
 * Mandatory in Category I and Category II A hospitals (MATERNAL_NUTRITION_REQUIRED).
 */
export function isMaternalNutritionRequired(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined,
  highRisk: boolean
): boolean {
  if (!highRisk) return false;
  if (!establishment) return false;

  // Check rules_in_force
  const nutritionRule = establishment.rules_in_force?.find(
    (r) => r.code === "high_risk_pregnancy_nutrition"
  );
  if (nutritionRule) {
    return nutritionRule.applies;
  }

  // Fallback to establishment profile code
  const code = establishment.profile?.code;
  return code === "I" || code === "IIA";
}

export interface AssessmentValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

/**
 * Validates obstetric assessment input before submission (rule:064bedf875, rule:272b13a3e0).
 */
export function validateAssessmentInput(
  data: Partial<AssessmentIn>,
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): AssessmentValidationResult {
  if (!data.patient_id || data.patient_id <= 0) {
    return { valid: false, error: "A valid patient must be selected", field: "patient_id" };
  }

  if (data.high_risk === undefined || data.high_risk === null) {
    return {
      valid: false,
      error: "Deliberate high-risk determination is required: select either High Risk or Standard Risk",
      field: "high_risk",
    };
  }

  if (data.gestation_weeks !== undefined && data.gestation_weeks !== null) {
    if (data.gestation_weeks < 1 || data.gestation_weeks > 45) {
      return {
        valid: false,
        error: "Gestation weeks must be between 1 and 45 weeks",
        field: "gestation_weeks",
      };
    }
  }

  if (data.high_risk) {
    // When high risk: at least one condition must be selected
    if (!data.conditions || data.conditions.length === 0) {
      return {
        valid: false,
        error: "At least one high-risk condition must be identified from the hospital list",
        field: "conditions",
      };
    }

    // Counselling is required when high risk
    if (!data.counselled) {
      return {
        valid: false,
        error: "Patient (and her family) must be informed of the high-risk status and counselled",
        field: "counselled",
      };
    }

    if (!data.counselling_note || !data.counselling_note.trim()) {
      return {
        valid: false,
        error: "Counselling note is mandatory for high-risk obstetric patients (document what was discussed)",
        field: "counselling_note",
      };
    }

    // Nutritional assessment required for Category I / II A
    if (isMaternalNutritionRequired(establishment, true)) {
      if (!data.nutrition_assessment || !data.nutrition_assessment.trim()) {
        return {
          valid: false,
          error: "Nutritional assessment is mandatory for high-risk obstetric cases in Category I and II A facilities (MSDS Indicator 28)",
          field: "nutrition_assessment",
        };
      }
      if (!data.nutrition_advice || !data.nutrition_advice.trim()) {
        return {
          valid: false,
          error: "Nutritional advice and corrective follow-up are mandatory for high-risk obstetric cases in Category I and II A facilities",
          field: "nutrition_advice",
        };
      }
    }
  }

  if (!data.plan) {
    return { valid: false, error: "Clinical management plan must be selected (Care Here or Refer)", field: "plan" };
  }

  return { valid: true };
}

/**
 * Validates referral input before dispatch.
 */
export function validateReferralInput(
  data: Partial<ReferralIn>
): AssessmentValidationResult {
  if (!data.destination_name || !data.destination_name.trim()) {
    if (!data.destination_contact_id) {
      return {
        valid: false,
        error: "Receiving facility destination name or directory contact is required",
        field: "destination_name",
      };
    }
  }

  if (!data.reason || !data.reason.trim()) {
    return { valid: false, error: "Reason for referral is required", field: "reason" };
  }

  if (!data.urgency) {
    return { valid: false, error: "Referral urgency must be specified (Routine, Urgent, Emergency)", field: "urgency" };
  }

  if (!data.clinical_summary || data.clinical_summary.trim().length < 5) {
    return {
      valid: false,
      error: "Clinical summary for receiving doctor must be at least 5 characters",
      field: "clinical_summary",
    };
  }

  if (data.transport === "WithStaff" && (!data.escort_name || !data.escort_name.trim())) {
    return {
      valid: false,
      error: "Escort staff name is required when transfer transport is WithStaff",
      field: "escort_name",
    };
  }

  return { valid: true };
}

/**
 * Formats author stamp for clinical display.
 */
export function formatAuthorStamp(stamp?: ObstetricAssessmentOut["author_stamp"] | null): string {
  if (!stamp) return "Unknown Clinician";
  const parts = [stamp.name];
  if (stamp.designation) parts.push(stamp.designation);
  if (stamp.registration) parts.push(`(${stamp.registration})`);
  return parts.join(" — ");
}

/**
 * Domain error explanations for obstetric assessment actions.
 */
export function explainObstetricError(
  code: string,
  details?: Record<string, unknown>
): { title: string; message: string; action: string } {
  switch (code) {
    case "MATERNAL_NUTRITION_REQUIRED":
      return {
        title: "Nutritional Assessment Required",
        message: "In Category I and II A facilities, high-risk obstetric cases require a documented nutritional assessment and dietary advice.",
        action: "Complete the nutritional assessment and advice fields before saving.",
      };
    case "CAPABILITY_INACTIVE":
      return {
        title: "Maternity Capability Inactive",
        message: "The maternity service is not active in this hospital (Facility Settings).",
        action: "The service must be activated in Settings before new obstetric assessments can be recorded.",
      };
    case "CLINICAL_LOCKOUT":
      return {
        title: "Clinical Lockout on Visit",
        message: "The patient ticket has a pending refund or void and is locked against clinical entries.",
        action: "Verify the billing slip status with reception before recording clinical data.",
      };
    case "TICKET_NOT_ACTIVE":
      return {
        title: "Visit Ticket Not Active",
        message: "The visit ticket is expired, cancelled, voided, or forfeited.",
        action: "Issue an active OPD ticket for the patient at reception.",
      };
    case "TICKET_PATIENT_MISMATCH":
      return {
        title: "Ticket Patient Mismatch",
        message: "The selected visit ticket belongs to another patient.",
        action: "Select the correct ticket belonging to this patient.",
      };
    case "ADMINISTRATION_NOT_AUTHORIZED":
      return {
        title: "Unauthorized Clinical Role",
        message: "Obstetric risk assessments must be signed by a registered doctor, obstetrician, or authorized nurse.",
        action: "Ensure you are logged in with the appropriate clinical credentials.",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        title: "Referenced Record Not Found",
        message: "A referenced condition or contact ID does not exist on the server.",
        action: "Refresh the screen and select an active item from the catalog.",
      };
    case "VALIDATION_ERROR":
      return {
        title: "Validation Refusal",
        message: "The submitted assessment data failed server validation rules.",
        action: "Check required fields and ensure gestation weeks and conditions are valid.",
      };
    default:
      return {
        title: "Obstetric Assessment Action Refused",
        message: "The server refused the assessment command.",
        action: "Check input details and retry.",
      };
  }
}
