export interface ClinicalUser {
  id?: number;
  username?: string;
  user_id?: number;
  role?: string;
  roles?: string[];
  permissions?: string[];
  token?: string;
}

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  DeathIn,
  DeathDraftIn,
  DeathRecordOut,
  PatientAtDeathOut,
  DeathCorrectionIn,
  AutopsyRequestIn,
  AutopsyReportIn,
  DeathRegisterRowOut,
} from "./generated/death_record";

export interface DeathRecordViewPolicy {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canOpen: boolean;
  canRecordNew: boolean;
  canEditDraft: boolean;
  canCertify: boolean;
  canCorrect: boolean;
  canRequestAutopsy: boolean;
  canViewRecords: boolean;
  banner: string | null;
}

/**
 * Service view capability evaluation for death_record
 */
export function evaluateDeathRecordView(
  establishment?: EstablishmentOut | null,
  screenId = "death_record"
): DeathRecordViewPolicy {
  const screenView = establishment?.views?.screens?.find((s) => s.screen_id === screenId)?.view || "full";

  switch (screenView) {
    case "full":
      return {
        view: "full",
        canOpen: true,
        canRecordNew: true,
        canEditDraft: true,
        canCertify: true,
        canCorrect: true,
        canRequestAutopsy: true,
        canViewRecords: true,
        banner: null,
      };
    case "open_work":
      return {
        view: "open_work",
        canOpen: true,
        canRecordNew: false,
        canEditDraft: true,
        canCertify: true,
        canCorrect: true,
        canRequestAutopsy: true,
        canViewRecords: true,
        banner: "No new death records from now on. Completing existing death certificates and autopsies continue.",
      };
    case "records":
      return {
        view: "records",
        canOpen: true,
        canRecordNew: false,
        canEditDraft: false,
        canCertify: false,
        canCorrect: false,
        canRequestAutopsy: false,
        canViewRecords: true,
        banner: "Records only: viewing death register and printed certificates.",
      };
    case "setup":
    case "hidden":
    default:
      return {
        view: "hidden",
        canOpen: false,
        canRecordNew: false,
        canEditDraft: false,
        canCertify: false,
        canCorrect: false,
        canRequestAutopsy: false,
        canViewRecords: false,
        banner: null,
      };
  }
}

/**
 * Role permissions check for recording / certifying death
 */
export function canRecordDeath(user?: ClinicalUser | null): boolean {
  return !!user?.permissions?.includes('death.record');
}
export function canViewDeathRegister(user?: ClinicalUser | null): boolean {
  return !!user?.permissions?.some(p=>['death.record','death.register.view','death.body.release','death.autopsy.authorize'].includes(p));
}
export function canManageAutopsy(user?: ClinicalUser | null): boolean {
  return !!user?.permissions?.some(p=>['death.record','death.autopsy.authorize'].includes(p));
}

/**
 * Validation for initial death declaration (POST /patients/{id}/death)
 * rule:8c2341a2ff
 */
export function validateRecordDeath(
  patientId: number,
  input: Partial<DeathIn>
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!patientId || patientId <= 0) {
    errors.patient_id = "Valid patient ID is required.";
  }

  if (!input.death_at || !input.death_at.trim()) {
    errors.death_at = "Time of death is required.";
  } else {
    const d = new Date(input.death_at);
    if (isNaN(d.getTime())) {
      errors.death_at = "Invalid death date and time format.";
    } else if (d.getTime() > Date.now() + 60000) {
      errors.death_at = "The time of death cannot be in the future (DEATH_TIME_INVALID).";
    }
  }

  if (!input.setting) {
    errors.setting = "Setting where death occurred is required.";
  } else if (input.setting === "BroughtDead") {
    if (!input.arrived_at || !input.arrived_at.trim()) {
      errors.arrived_at = "Time body arrived at hospital is required for Brought Dead casualties.";
    }
  }

  return errors;
}

/**
 * Determine underlying cause of death from Part I lines
 * WHO rule: lowest filled line in Part I (a -> b -> c -> d)
 */
export function determineUnderlyingCause(
  draft: Partial<DeathDraftIn | DeathRecordOut>
): { line: "a" | "b" | "c" | "d" | null; cause: string | null; icd: string | null } {
  if (draft.cause_d?.trim()) {
    return { line: "d", cause: draft.cause_d.trim(), icd: draft.cause_d_icd?.trim() || null };
  }
  if (draft.cause_c?.trim()) {
    return { line: "c", cause: draft.cause_c.trim(), icd: draft.cause_c_icd?.trim() || null };
  }
  if (draft.cause_b?.trim()) {
    return { line: "b", cause: draft.cause_b.trim(), icd: draft.cause_b_icd?.trim() || null };
  }
  if (draft.cause_a?.trim()) {
    return { line: "a", cause: draft.cause_a.trim(), icd: draft.cause_a_icd?.trim() || null };
  }
  return { line: null, cause: null, icd: null };
}

/**
 * Check which compulsory certificate fields are missing prior to certification
 * rule:4a9cf9f9a8 & rule:8c96251e09
 */
export function checkCertificationReadiness(
  draft: Partial<DeathDraftIn | DeathRecordOut>,
  patient?: PatientAtDeathOut | null
): {
  ready: boolean;
  missing: (
    | "cause_a"
    | "manner"
    | "expected_death"
    | "surgery_within_4_weeks"
    | "surgery_date"
    | "external_cause"
    | "pregnancy_status"
  )[];
  reasons: string[];
} {
  const missing: (
    | "cause_a"
    | "manner"
    | "expected_death"
    | "surgery_within_4_weeks"
    | "surgery_date"
    | "external_cause"
    | "pregnancy_status"
  )[] = [];
  const reasons: string[] = [];

  if (!draft.cause_a || !draft.cause_a.trim()) {
    missing.push("cause_a");
    reasons.push("Direct cause of death (Part I line a) is required.");
  }

  if (!draft.manner) {
    missing.push("manner");
    reasons.push("Manner of death is required.");
  }

  if (draft.expected_death === undefined || draft.expected_death === null) {
    missing.push("expected_death");
    reasons.push("Must indicate whether death was expected or unexpected.");
  }

  const violentManners = ["Accident", "IntentionalSelfHarm", "Assault", "LegalIntervention", "War"];
  if (draft.manner && violentManners.includes(draft.manner)) {
    if (!draft.external_cause || !draft.external_cause.trim()) {
      missing.push("external_cause");
      reasons.push(`External cause of injury or poisoning is required for manner '${draft.manner}'.`);
    }
  }

  if (draft.surgery_within_4_weeks === undefined || draft.surgery_within_4_weeks === null) {
    missing.push("surgery_within_4_weeks");
    reasons.push("Must state whether patient underwent surgery within 4 weeks of death.");
  } else if (draft.surgery_within_4_weeks === true) {
    if (!draft.surgery_date || !draft.surgery_date.trim()) {
      missing.push("surgery_date");
      reasons.push("Date of recent surgery is required.");
    }
  }

  if (patient?.pregnancy_applies) {
    if (!draft.pregnancy_status) {
      missing.push("pregnancy_status");
      reasons.push("Pregnancy status is required for female casualties aged 10-54.");
    }
  }

  return {
    ready: missing.length === 0,
    missing,
    reasons,
  };
}

/**
 * Validation for draft updates (PUT /deaths/{id})
 */
export function validateDeathDraft(
  draft: Partial<DeathDraftIn>,
  patient?: PatientAtDeathOut | null
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (draft.death_at) {
    const d = new Date(draft.death_at);
    if (isNaN(d.getTime())) {
      errors.death_at = "Invalid death date and time format.";
    } else if (d.getTime() > Date.now() + 60000) {
      errors.death_at = "The time of death cannot be in the future (DEATH_TIME_INVALID).";
    }
  }

  if (draft.cause_a && draft.cause_a.trim().length > 500) {
    errors.cause_a = "Cause line (a) cannot exceed 500 characters.";
  }
  if (draft.cause_b && draft.cause_b.trim().length > 500) {
    errors.cause_b = "Cause line (b) cannot exceed 500 characters.";
  }
  if (draft.cause_c && draft.cause_c.trim().length > 500) {
    errors.cause_c = "Cause line (c) cannot exceed 500 characters.";
  }
  if (draft.cause_d && draft.cause_d.trim().length > 500) {
    errors.cause_d = "Cause line (d) cannot exceed 500 characters.";
  }

  if (draft.other_conditions && draft.other_conditions.trim().length > 2000) {
    errors.other_conditions = "Part II contributing conditions cannot exceed 2000 characters.";
  }

  if (draft.external_cause && draft.external_cause.trim().length > 1000) {
    errors.external_cause = "External cause cannot exceed 1000 characters.";
  }

  if (patient?.infant_applies) {
    if (draft.hours_survived !== undefined && draft.hours_survived !== null) {
      if (draft.hours_survived < 0 || draft.hours_survived > 8760) {
        errors.hours_survived = "Hours survived must be between 0 and 8760.";
      }
    }
    if (draft.birth_weight_grams !== undefined && draft.birth_weight_grams !== null) {
      if (draft.birth_weight_grams < 100 || draft.birth_weight_grams > 10000) {
        errors.birth_weight_grams = "Birth weight must be between 100 and 10000 grams.";
      }
    }
    if (draft.gestation_weeks !== undefined && draft.gestation_weeks !== null) {
      if (draft.gestation_weeks < 15 || draft.gestation_weeks > 45) {
        errors.gestation_weeks = "Gestation weeks must be between 15 and 45.";
      }
    }
  }

  return errors;
}

/**
 * Validation for appending a post-certification correction (POST /deaths/{id}/corrections)
 * rule:8c96251e09
 */
export function validateDeathCorrection(input: Partial<DeathCorrectionIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  const text = input.correction_text?.trim() ?? "";
  if (text.length < 3) {
    errors.correction_text = "Correction text must be at least 3 characters.";
  } else if (text.length > 5000) {
    errors.correction_text = "Correction text cannot exceed 5000 characters.";
  }

  const reason = input.correction_reason?.trim() ?? "";
  if (reason.length < 3) {
    errors.correction_reason = "Correction reason must be at least 3 characters.";
  } else if (reason.length > 2000) {
    errors.correction_reason = "Correction reason cannot exceed 2000 characters.";
  }

  return errors;
}

/**
 * Validation for clinical autopsy requisition
 * rule:0cf8a9f905
 */
export function validateAutopsyRequest(
  input: Partial<AutopsyRequestIn>,
  death: Partial<DeathRecordOut>
): { valid: boolean; error: string | null } {
  if (death.mlc_id || death.mlc_number) {
    return {
      valid: false,
      error: "A medico-legal death has a post-mortem ordered by the police, not a clinical autopsy (AUTOPSY_MEDICO_LEGAL).",
    };
  }

  const reasons = input.request_reasons?.trim() ?? "";
  if (reasons.length < 5) {
    return {
      valid: false,
      error: "Autopsy requisition reasons must be at least 5 characters.",
    };
  }

  return { valid: true, error: null };
}

/**
 * Validation for clinical autopsy report
 */
export function validateAutopsyReport(input: Partial<AutopsyReportIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.performed_at || !input.performed_at.trim()) {
    errors.performed_at = "Date and time autopsy was performed is required.";
  }

  const findings = input.findings?.trim() ?? "";
  if (findings.length < 5) {
    errors.findings = "Autopsy findings must be at least 5 characters.";
  }

  if (!input.correlation) {
    errors.correlation = "Clinico-pathological correlation outcome is required.";
  }

  const note = input.correlation_note?.trim() ?? "";
  if (note.length < 5) {
    errors.correlation_note = "Correlation note must be at least 5 characters.";
  }

  return errors;
}

/**
 * Sorting for death register: Drafts first, then newest deaths
 */
export function sortDeathRegister(rows: DeathRegisterRowOut[]): DeathRegisterRowOut[] {
  return [...rows].sort((a, b) => {
    // 1. Draft records first so doctors complete pending certificates
    if (a.status === "Draft" && b.status !== "Draft") return -1;
    if (a.status !== "Draft" && b.status === "Draft") return 1;

    // 2. Newest death timestamp first
    const aTime = new Date(a.death_at).getTime() || 0;
    const bTime = new Date(b.death_at).getTime() || 0;
    return bTime - aTime;
  });
}

/**
 * Domain error translation under rule:8c96251e09 & definition of done
 */
export function explainDeathError(error: any): string {
  const code = error?.code || error?.error?.code || "";

  switch (code) {
    case "DEATH_CERTIFIER_NOT_DOCTOR":
      return "Only a doctor registered with the PMDC can record or certify a death.";
    case "DEATH_ADMISSION_NOT_ACTIVE":
      return "An inpatient death is recorded on the patient's current active admission.";
    case "DEATH_SETTING_INVALID":
      return "The patient is admitted: the death is an inpatient death.";
    case "DEATH_TIME_INVALID":
      return "The time of death cannot be in the future.";
    case "PATIENT_ALREADY_DECEASED":
      return "The patient's death is already recorded.";
    case "PATIENT_MERGED_CANNOT_TRANSACT":
      return "This patient record was merged; use the master record.";
    case "DEATH_RECORD_FINAL":
      return "A certified death record cannot change; append a correction.";
    case "DEATH_CERTIFICATE_INCOMPLETE":
      return "The death certificate is missing required parts. Please complete all mandatory sections before certifying.";
    case "DEATH_RECORD_NOT_CERTIFIED":
      return "The cause of death is not certified yet.";
    case "AUTOPSY_TRANSITION_INVALID":
      return "The clinical autopsy cannot make that change.";
    case "AUTOPSY_MEDICO_LEGAL":
      return "A medico-legal death has a post-mortem ordered by the police, not a clinical autopsy.";
    case "AUTOPSY_EXISTS":
      return "This death already has a clinical autopsy request.";
    case "VERSION_CONFLICT":
      return "This death record was updated by another terminal. Reloading latest records.";
    case "ICD_CODE_UNKNOWN":
      return "The selected ICD code was not found in the loaded classification release.";
    case "FORBIDDEN":
      return "You do not have authorization to perform this death certification action.";
    case "VALIDATION_ERROR":
      return "The submitted certificate information is incomplete or invalid.";
    default:
      return error?.message || "An unexpected error occurred while processing the death certificate.";
  }
}
