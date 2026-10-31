import type { ClinicalUser } from "./clinical-context";
import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ErVisitOut,
  ErBoardOut,
  ErArrivalIn,
  TraumaCreate,
} from "./generated/er_board";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export const ARRIVAL_MODES = [
  { value: "WalkIn", labelEn: "Walk-in", labelUr: "خود چل کر آئے" },
  { value: "Ambulance", labelEn: "Ambulance", labelUr: "ایمبولینس" },
  { value: "Rescue1122", labelEn: "Rescue 1122", labelUr: "ریسکیو 1122" },
  { value: "Police", labelEn: "Police", labelUr: "پولیس" },
  { value: "Referred", labelEn: "Referred from Hospital", labelUr: "دیگر ہسپتال سے ریفرل" },
] as const;

export const ER_FLAG_CONFIG: Record<
  string,
  { labelEn: string; labelUr: string; badgeClass: string; isHazard?: boolean }
> = {
  TriageOverdue: {
    labelEn: "Triage Overdue",
    labelUr: "ٹرائیج تاخیر کا شکار",
    badgeClass: "bg-warning text-dark",
  },
  DoctorOverdue: {
    labelEn: "Doctor Assessment Overdue",
    labelUr: "ڈاکٹر معائنہ تاخیر",
    badgeClass: "bg-danger text-white",
    isHazard: true,
  },
  ObservationTooLong: {
    labelEn: "Observation > 6h",
    labelUr: "مشاہدہ زیادہ وقت",
    badgeClass: "bg-warning-subtle text-warning border border-warning",
  },
  AdmissionWaitTooLong: {
    labelEn: "Bed Wait Overdue",
    labelUr: "بستر کا انتظار طویل",
    badgeClass: "bg-danger-subtle text-danger border border-danger",
  },
  ReferralWaitTooLong: {
    labelEn: "Transfer Wait Overdue",
    labelUr: "منتقلی کا انتظار طویل",
    badgeClass: "bg-danger-subtle text-danger border border-danger",
  },
  MlcNotOpened: {
    labelEn: "MLC Not Opened",
    labelUr: "ایم ایل سی کیس غیر درج",
    badgeClass: "bg-danger text-white fw-bold",
    isHazard: true,
  },
  MedicoLegalUndecided: {
    labelEn: "MLC Checklist Undecided",
    labelUr: "ایم ایل سی فیصلہ درکار",
    badgeClass: "bg-info-subtle text-info border border-info",
  },
};

export const TRIAGE_COLOUR_MAP: Record<
  string,
  { bg: string; text: string; border: string; labelEn: string; labelUr: string }
> = {
  Red: { bg: "#dc3545", text: "#ffffff", border: "#b02a37", labelEn: "Level 1: Resuscitation", labelUr: "درجہ 1: فوری بحالی" },
  Orange: { bg: "#fd7e14", text: "#ffffff", border: "#c76107", labelEn: "Level 2: Emergency", labelUr: "درجہ 2: ہنگامی" },
  Yellow: { bg: "#ffc107", text: "#212529", border: "#d39e00", labelEn: "Level 3: Urgent", labelUr: "درجہ 3: فوری توجہ" },
  Green: { bg: "#198754", text: "#ffffff", border: "#146c43", labelEn: "Level 4: Semi-urgent", labelUr: "درجہ 4: نیم ہنگامی" },
  Blue: { bg: "#0d6efd", text: "#ffffff", border: "#0a58ca", labelEn: "Level 5: Non-urgent", labelUr: "درجہ 5: عام" },
  White: { bg: "#f8f9fa", text: "#212529", border: "#ced4da", labelEn: "Untriaged", labelUr: "غیر درجہ بند" },
  Black: { bg: "#212529", text: "#ffffff", border: "#000000", labelEn: "Deceased / Expectant", labelUr: "وفات / لا علاج" },
};

/**
 * Screen view policy for er_board and er_board_doctor under rule:9501947a0e / rule:44901aa670.
 * Screen belongs to emergency_department service (work role).
 */
export function evaluateErBoardView(
  establishmentOrScreens?: any,
  screenId: string = "er_board"
): { mode: ScreenViewMode; canShow: boolean; canStartNewWork: boolean; bannerText?: string } {
  let mode: ScreenViewMode = "full";
  const screens = establishmentOrScreens?.views?.screens || establishmentOrScreens?.screens || establishmentOrScreens;
  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === screenId);
    if (item?.view) mode = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens[screenId]?.view) mode = screens[screenId].view;
    else if (typeof screens[screenId] === "string") mode = screens[screenId] as ScreenViewMode;
  }

  // Capability active check (rule:141986b356)
  const isEmergencyActive =
    establishmentOrScreens?.active?.includes("emergency_department") ?? true;

  switch (mode) {
    case "hidden":
      return { mode, canShow: false, canStartNewWork: false };
    case "open_work":
      return {
        mode,
        canShow: true,
        canStartNewWork: false,
        bannerText: "Service Retiring: No new emergency arrivals from now on. Active ER tracking, clinical assessment, and handovers continue.",
      };
    case "records":
      return {
        mode,
        canShow: true,
        canStartNewWork: false,
        bannerText: "Records view: Emergency room tracking board is read-only.",
      };
    case "setup":
      return {
        mode,
        canShow: true,
        canStartNewWork: false,
        bannerText: "Setup view: Emergency department service is in setup mode.",
      };
    case "full":
    default:
      return {
        mode: "full",
        canShow: true,
        canStartNewWork: isEmergencyActive,
      };
  }
}

/** Check if user can view ER tracking board (er.visit.view) */
export function canViewErBoard(user: { permissions: string[]; roles?: string[] }): boolean {
  return (
    user.permissions.includes("er.visit.view") ||
    user.permissions.includes("er.visit.register") ||
    Boolean(
      user.roles?.some((r) =>
        [
          "receptionist",
          "triage_nurse",
          "doctor",
          "clinical_specialist",
          "surgeon",
          "anaesthetist",
          "hospital_admin",
          "hospital_director",
          "owner",
          "quality_officer",
        ].includes(r)
      )
    )
  );
}

/** Check if user can register new ER arrival (er.visit.register) */
export function canRegisterErArrival(user: { permissions: string[]; roles?: string[] }): boolean {
  return (
    user.permissions.includes("er.visit.register") ||
    Boolean(user.roles?.some((r) => ["receptionist", "triage_nurse", "doctor", "clinical_specialist", "surgeon"].includes(r)))
  );
}

/** Check if user can create trauma emergency profile (ipd.admission.code_red or patient.create) */
export function canCreateTrauma(user: { permissions: string[]; roles?: string[] }): boolean {
  return (
    user.permissions.includes("ipd.admission.code_red") ||
    user.permissions.includes("patient.create") ||
    Boolean(user.roles?.some((r) => ["doctor", "clinical_specialist", "surgeon", "triage_nurse", "receptionist"].includes(r)))
  );
}

/**
 * Validates ER arrival registration input under rule:74958f2576.
 */
export function validateErArrivalInput(input: {
  patient_id: number;
  arrival_mode?: string | null;
  referred_from?: string | null;
  presenting_complaint?: string | null;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.patient_id || input.patient_id <= 0) {
    errors.patient_id = "Valid patient ID is required for emergency arrival registration.";
  }

  if (input.presenting_complaint && input.presenting_complaint.length > 500) {
    errors.presenting_complaint = "Presenting complaint cannot exceed 500 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates temporary trauma profile creation under rule:74958f2576.
 */
export function validateTraumaInput(input: TraumaCreate): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (input.approx_age_years !== undefined && input.approx_age_years !== null) {
    if (input.approx_age_years < 0 || input.approx_age_years > 130) {
      errors.approx_age_years = "Approximate age must be between 0 and 130 years.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Explains domain or HTTP errors from ER board operations with actionable recovery guidance.
 */
export function explainErBoardError(err: any): { message: string; existingVisitId?: number } {
  if (!err) return { message: "An unexpected error occurred." };
  const code = err?.response?.error?.code || err?.code || "";
  const details = err?.response?.error?.details || {};
  const rawMsg = err?.response?.error?.message || err?.message || "";

  switch (code) {
    case "ER_VISIT_OPEN":
      return {
        message: `Patient already has an active open ER visit (#${details.er_visit_id || details.er_number || ""}). Open existing visit.`,
        existingVisitId: details.er_visit_id,
      };
    case "PATIENT_NOT_FOUND":
      return { message: "Specified patient record was not found on server." };
    case "SERVICE_INACTIVE":
      return { message: "Emergency Department service is not currently active on this facility profile." };
    case "FORBIDDEN":
      return { message: "Permission required: Your role is not authorized to register ER visits or trauma profiles." };
    case "VALIDATION_ERROR":
      return { message: `Validation error: ${rawMsg || "Please verify patient ID and arrival details."}` };
    default:
      return { message: rawMsg || "Operation failed. Please review and retry." };
  }
}
