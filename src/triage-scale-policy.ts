import type { ClinicalUser } from "./clinical-context";
import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ErTriageScaleOut,
  ErTriageLevelOut,
  ErTriageDiscriminatorOut,
  TriageSignIn,
  TriageSignUpdateIn,
  TriageLevelIn,
} from "./generated/triage_scale";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export const VITAL_OPTIONS = [
  { value: "heart_rate", labelEn: "Heart Rate (bpm)", labelUr: "نبض کی رفتار" },
  { value: "respiratory_rate", labelEn: "Respiratory Rate (/min)", labelUr: "سانس کی رفتار" },
  { value: "bp_systolic", labelEn: "Systolic Blood Pressure (mmHg)", labelUr: "سسٹولک بلڈ پریشر" },
  { value: "spo2", labelEn: "Oxygen Saturation SpO2 (%)", labelUr: "آکسیجن سیچوریشن" },
  { value: "temp_c", labelEn: "Temperature (°C)", labelUr: "درجہ حرارت" },
  { value: "gcs", labelEn: "Glasgow Coma Scale (GCS 3-15)", labelUr: "جی سی ایس اسکیل" },
  { value: "pain_score", labelEn: "Pain Score (0-10)", labelUr: "درد کا اسکور" },
  { value: "blood_glucose", labelEn: "Random Blood Glucose (mg/dL)", labelUr: "خون میں شوگر" },
] as const;

export const COMPARISON_OPTIONS = [
  { value: "<", label: "< Less than" },
  { value: "<=", label: "<= Less than or equal to" },
  { value: ">", label: "> Greater than" },
  { value: ">=", label: ">= Greater than or equal to" },
] as const;

export const COLOUR_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  Red: { bg: "#dc3545", text: "#ffffff", border: "#b02a37" },
  Orange: { bg: "#fd7e14", text: "#ffffff", border: "#c76107" },
  Yellow: { bg: "#ffc107", text: "#212529", border: "#d39e00" },
  Green: { bg: "#198754", text: "#ffffff", border: "#146c43" },
  Blue: { bg: "#0d6efd", text: "#ffffff", border: "#0a58ca" },
  White: { bg: "#f8f9fa", text: "#212529", border: "#ced4da" },
  Black: { bg: "#212529", text: "#ffffff", border: "#000000" },
};

/**
 * Evaluates screen view mode for triage_scale under rule:813c874c56.
 * Screen belongs to emergency_department service (setup role).
 */
export function evaluateTriageScaleView(
  establishmentOrScreens?: any,
): { mode: ScreenViewMode; canShow: boolean; bannerText?: string } {
  let mode: ScreenViewMode = "full";
  const screens = establishmentOrScreens?.views?.screens || establishmentOrScreens?.screens || establishmentOrScreens;
  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "triage_scale");
    if (item?.view) mode = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["triage_scale"]?.view) mode = screens["triage_scale"].view;
    else if (typeof screens["triage_scale"] === "string") mode = screens["triage_scale"] as ScreenViewMode;
  }

  switch (mode) {
    case "hidden":
      return { mode, canShow: false };
    case "open_work":
      return {
        mode,
        canShow: true,
        bannerText: "Service Retiring: No new emergency triage scale adjustments from now on. Active scale and SOP algorithms remain accessible for viewing and printing.",
      };
    case "records":
      return {
        mode,
        canShow: true,
        bannerText: "Records view: Triage scale and algorithms are read-only.",
      };
    case "setup":
      return {
        mode,
        canShow: true,
        bannerText: "Setup view: Emergency department service is in setup mode. Review and adapt the triage algorithm before activating the service.",
      };
    case "full":
    default:
      return { mode: "full", canShow: true };
  }
}

/** Check if user can configure/adapt triage scale (er.triage.configure) */
export function canConfigureTriageScale(user: { permissions: string[]; roles?: string[] }): boolean {
  return (
    user.permissions.includes("er.triage.configure") ||
    Boolean(user.roles?.some((r) => ["hospital_admin", "hospital_director", "clinic_director", "owner", "quality_officer"].includes(r)))
  );
}

/** Check if user can view/print triage scale (er.visit.view) */
export function canViewTriageScale(user: { permissions: string[]; roles?: string[] }): boolean {
  return (
    user.permissions.includes("er.visit.view") ||
    user.permissions.includes("er.triage.configure") ||
    Boolean(user.roles?.some((r) => ["triage_nurse", "doctor", "receptionist", "admissions_officer"].includes(r))) ||
    canConfigureTriageScale(user)
  );
}

/**
 * Validates discriminator input for adding or updating danger signs or vital-sign limits (rule:023ae1126f).
 * A VitalSign row requires vital, comparison, and threshold; a Sign row requires none of them.
 */
export function validateDiscriminatorInput(input: {
  kind: "Sign" | "VitalSign";
  level: number;
  label: string;
  age_group?: "All" | "Adult" | "Child";
  vital?: string | null;
  comparison?: string | null;
  threshold?: number | string | null;
  sort_order?: number;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.level || input.level < 1 || input.level > 5) {
    errors.level = "Triage level must be between 1 and 5.";
  }

  const labelTrimmed = (input.label || "").trim();
  if (!labelTrimmed || labelTrimmed.length < 3) {
    errors.label = "Label must be at least 3 characters.";
  } else if (labelTrimmed.length > 300) {
    errors.label = "Label cannot exceed 300 characters.";
  }

  if (input.kind === "VitalSign") {
    if (!input.vital) {
      errors.vital = "Vital parameter is required for VitalSign discriminator (rule 023ae1126f).";
    }
    if (!input.comparison) {
      errors.comparison = "Comparison operator (<, <=, >, >=) is required for VitalSign discriminator (rule 023ae1126f).";
    }
    if (input.threshold === null || input.threshold === undefined || input.threshold === "") {
      errors.threshold = "Threshold numeric value is required for VitalSign discriminator (rule 023ae1126f).";
    } else {
      const num = Number(input.threshold);
      if (isNaN(num) || num < 0 || num > 1000) {
        errors.threshold = "Threshold must be a valid number between 0 and 1000.";
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates triage level properties when updating level metadata.
 */
export function validateLevelInput(input: TriageLevelIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (input.name !== undefined && input.name !== null) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2) {
      errors.name = "Level name must be at least 2 characters.";
    } else if (trimmed.length > 60) {
      errors.name = "Level name cannot exceed 60 characters.";
    }
  }

  if (input.target_minutes !== undefined && input.target_minutes !== null) {
    if (input.target_minutes < 0 || input.target_minutes > 1440) {
      errors.target_minutes = "Target minutes must be between 0 (immediate) and 1440 minutes.";
    }
  }

  if (input.description !== undefined && input.description !== null) {
    if (input.description.length > 500) {
      errors.description = "Description cannot exceed 500 characters.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Formats a VitalSign discriminator into readable mathematical string, e.g. "SpO2 < 90%" or "Systolic BP <= 80"
 */
export function formatVitalSignLimit(d: ErTriageDiscriminatorOut): string {
  if (d.kind !== "VitalSign" || !d.vital || !d.comparison || d.threshold === null) {
    return d.label;
  }
  const vitalLabel = VITAL_OPTIONS.find((v) => v.value === d.vital)?.labelEn || d.vital;
  return `${vitalLabel} ${d.comparison} ${d.threshold}`;
}

/**
 * Explains domain or HTTP errors from triage scale endpoints with user-actionable guidance.
 */
export function explainTriageScaleError(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const code = err?.response?.error?.code || err?.code || "";
  const message = err?.response?.error?.message || err?.message || "";

  switch (code) {
    case "FORBIDDEN":
      return "Permission required: Your role does not have authorization to configure the emergency triage scale (er.triage.configure).";
    case "VALIDATION_ERROR":
      return `Validation error: ${message || "Please check discriminator parameters (VitalSign rows require vital, comparison, and threshold)."}`;
    case "DISCRIMINATOR_NOT_FOUND":
      return "The requested triage danger sign or vital limit could not be found. Refreshing scale.";
    case "LEVEL_INVALID":
      return "Invalid triage level specified. Triage levels must be between 1 (Resuscitation/Code Red) and 5 (Non-urgent).";
    default:
      return message || "Operation failed. Please review input and retry.";
  }
}
