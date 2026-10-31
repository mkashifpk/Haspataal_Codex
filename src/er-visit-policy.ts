/**
 * Domain rules and clinical policies for Screen 93: er_visit
 * ("ER visit: triage, stages, departure", Position 93, 84 points)
 * Under MSDS AAC 15-20, MSDS 18, MSDS 20, MSDS 147
 * Rules: rule:b985ad38dc, rule:bd91e95b22, rule:50175606cd, rule:436225bf5c,
 * rule:1c52f88e02, rule:231e22e6bd, rule:7571033b1d, rule:794ff452da,
 * rule:abab0015cb, rule:cbd04d6c73
 */

import type { ClinicalUser } from "./clinical-context";
import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ErTriageScaleOut,
  ErTriageLevelOut,
  ErTriageDiscriminatorOut,
  ErTriageIn,
  ErStageIn,
  ErDepartIn,
  ErVisitDetailOut,
} from "./generated/er_visit";

export interface ErVisitViewEval {
  canShow: boolean;
  canStartNewWork: boolean;
  isReadOnly: boolean;
  isSetupOnly: boolean;
  bannerNotice: string | null;
}

export function evaluateErVisitView(establishment: EstablishmentOut): ErVisitViewEval {
  const serviceActive = establishment.active?.includes("emergency_department") ?? false;
  let screenMode = "full";
  const screens = (establishment as any)?.views?.screens || (establishment as any)?.screens;

  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "er_visit");
    if (item?.view) screenMode = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["er_visit"]?.view) screenMode = screens["er_visit"].view;
    else if (typeof screens["er_visit"] === "string") screenMode = screens["er_visit"];
  }

  if (screenMode === "hidden") {
    return {
      canShow: false,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: false,
      bannerNotice: null,
    };
  }

  if (screenMode === "setup") {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: true,
      bannerNotice: "Emergency department is in setup mode. Visit modifications are restricted.",
    };
  }

  if (screenMode === "records" || !serviceActive) {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: false,
      bannerNotice: "Emergency department service is inactive. Historical records only.",
    };
  }

  if (screenMode === "open_work") {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: false,
      isSetupOnly: false,
      bannerNotice: "No new emergency visits from now on. Completing existing visits only.",
    };
  }

  return {
    canShow: true,
    canStartNewWork: true,
    isReadOnly: false,
    isSetupOnly: false,
    bannerNotice: null,
  };
}

export function canViewErVisit(user: ClinicalUser): boolean {
  return user.permissions?.includes("er.visit.view") ?? false;
}

export function canRecordTriage(user: ClinicalUser): boolean {
  return user.permissions?.includes("er.triage.record") ?? false;
}

export function canManageErVisit(user: ClinicalUser): boolean {
  return user.permissions?.includes("er.visit.manage") ?? false;
}

export function canManageMlc(user: ClinicalUser): boolean {
  return user.permissions?.includes("mlc.case.manage") ?? false;
}

export function canUploadDocument(user: ClinicalUser): boolean {
  return user.permissions?.includes("patient.document.upload") ?? false;
}

export function canViewDocument(user: ClinicalUser): boolean {
  return user.permissions?.includes("patient.document.view") ?? false;
}

export interface VitalInputs {
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  spo2?: number | null;
  temp_c?: number | null;
  gcs?: number | null;
  pain_score?: number | null;
  blood_glucose?: number | null;
}

export interface CalculatedTriageLevel {
  suggestedLevel: number;
  matchedDiscriminators: ErTriageDiscriminatorOut[];
}

/**
 * Calculates suggested triage level based on scale rules (rule:b985ad38dc).
 * Lower number = higher priority (Level 1 Resuscitation to Level 5 Non-urgent).
 */
export function calculateSuggestedTriageLevel(
  scale: ErTriageScaleOut,
  patientAgeYears: number | null,
  tickedSignIds: number[],
  vitals: VitalInputs
): CalculatedTriageLevel {
  const isChild = patientAgeYears !== null && patientAgeYears < scale.child_age_years;
  const matchedDiscriminators: ErTriageDiscriminatorOut[] = [];

  // Sort levels ascending (Level 1 on top)
  const sortedLevels = [...scale.levels].sort((a, b) => a.level - b.level);

  let suggestedLevel = scale.default_level ?? 5;
  let levelFound = false;

  for (const level of sortedLevels) {
    const levelMatches: ErTriageDiscriminatorOut[] = [];

    // Check danger signs (qualitative)
    for (const sign of level.signs || []) {
      if (tickedSignIds.includes(sign.discriminator_id)) {
        levelMatches.push(sign);
      }
    }

    // Check vital signs (quantitative)
    for (const vitalDisc of level.vital_signs || []) {
      if (!vitalDisc.is_active) continue;

      // Age group applicability
      if (vitalDisc.age_group === "Adult" && isChild) continue;
      if (vitalDisc.age_group === "Child" && !isChild) continue;

      if (!vitalDisc.vital || vitalDisc.threshold === null || !vitalDisc.comparison) continue;

      const userVal = vitals[vitalDisc.vital];
      if (userVal === undefined || userVal === null || isNaN(userVal)) continue;

      let matched = false;
      const t = vitalDisc.threshold;
      switch (vitalDisc.comparison) {
        case "<":
          matched = userVal < t;
          break;
        case "<=":
          matched = userVal <= t;
          break;
        case ">":
          matched = userVal > t;
          break;
        case ">=":
          matched = userVal >= t;
          break;
      }

      if (matched) {
        levelMatches.push(vitalDisc);
      }
    }

    if (levelMatches.length > 0) {
      matchedDiscriminators.push(...levelMatches);
      if (!levelFound) {
        suggestedLevel = level.level;
        levelFound = true;
      }
    }
  }

  return {
    suggestedLevel,
    matchedDiscriminators,
  };
}

/**
 * Validates triage submission input (rule:b985ad38dc, rule:bd91e95b22, rule:50175606cd).
 */
export function validateTriageInput(
  input: ErTriageIn,
  suggestedLevel: number
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.presenting_complaint || input.presenting_complaint.trim().length < 3) {
    errors.presenting_complaint = "Presenting complaint must be at least 3 characters long.";
  }

  if (input.assigned_level !== undefined && input.assigned_level !== null) {
    if (input.assigned_level !== suggestedLevel) {
      if (!input.override_reason || input.override_reason.trim().length < 5) {
        errors.override_reason =
          `Level ${input.assigned_level} differs from suggested Level ${suggestedLevel}. Clinical override reason required (at least 5 characters).`;
      }
    }
  }

  if (input.is_medico_legal === undefined || input.is_medico_legal === null) {
    errors.is_medico_legal = "Medico-legal checklist answer (Yes/No) is mandatory on every triage.";
  } else if (input.is_medico_legal) {
    if (!input.mlc_case_type_id) {
      errors.mlc_case_type_id = "Please select the medico-legal case type.";
    }
  }

  // Validate vitals numeric bounds if provided
  if (input.heart_rate !== null && input.heart_rate !== undefined) {
    if (input.heart_rate < 0 || input.heart_rate > 350) {
      errors.heart_rate = "Heart rate must be between 0 and 350 bpm.";
    }
  }
  if (input.respiratory_rate !== null && input.respiratory_rate !== undefined) {
    if (input.respiratory_rate < 0 || input.respiratory_rate > 100) {
      errors.respiratory_rate = "Respiratory rate must be between 0 and 100 breaths/min.";
    }
  }
  if (input.spo2 !== null && input.spo2 !== undefined) {
    if (input.spo2 < 0 || input.spo2 > 100) {
      errors.spo2 = "SpO2 percentage must be between 0 and 100%.";
    }
  }
  if (input.gcs !== null && input.gcs !== undefined) {
    if (input.gcs < 3 || input.gcs > 15) {
      errors.gcs = "Glasgow Coma Scale (GCS) must be between 3 and 15.";
    }
  }
  if (input.pain_score !== null && input.pain_score !== undefined) {
    if (input.pain_score < 0 || input.pain_score > 10) {
      errors.pain_score = "Pain score must be between 0 and 10.";
    }
  }

  return errors;
}

/**
 * Validates stage progression (rule:436225bf5c).
 */
export function validateStageInput(input: ErStageIn): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.stage) {
    errors.stage = "Please select target stage.";
  }

  if (input.stage === "AwaitingReferral") {
    if (!input.note || input.note.trim().length < 5) {
      errors.note = "Referral destination and clinical justification note required.";
    }
  }

  return errors;
}

/**
 * Validates departure recording under MSDS 20 (rule:1c52f88e02, rule:231e22e6bd).
 */
export function validateDepartureInput(
  input: ErDepartIn,
  visit: ErVisitDetailOut
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.disposition) {
    errors.disposition = "Departure disposition is required.";
    return errors;
  }

  switch (input.disposition) {
    case "Discharged":
      if (!input.condition_at_departure) {
        errors.condition_at_departure = "Condition at departure is required for discharge.";
      }
      if (!input.follow_up_advice || input.follow_up_advice.trim().length < 5) {
        errors.follow_up_advice = "Follow-up care advice is required upon discharge.";
      }
      break;

    case "Referred":
      if (!input.condition_at_departure) {
        errors.condition_at_departure = "Condition at departure is required for referral.";
      }
      if (!input.referred_to || input.referred_to.trim().length < 3) {
        errors.referred_to = "Receiving facility/hospital name is required.";
      }
      if (!input.referral_reason || input.referral_reason.trim().length < 5) {
        errors.referral_reason = "Clinical reason for transfer/referral is required.";
      }
      break;

    case "LAMA":
    case "DischargedOnRequest":
      if (!input.statement_signed_by && !input.absence_noticed_at) {
        errors.statement_signed_by =
          "Document who signed the refusal statement (name & relationship) or record when absence was noticed.";
      }
      break;

    case "LeftWithoutBeingSeen":
      if (visit.seen_at || visit.seen_by) {
        errors.disposition =
          "Cannot record 'Left Without Being Seen' because patient was already attended by an emergency physician.";
      }
      if (!input.absence_noticed_at) {
        errors.absence_noticed_at = "Time absence was noticed is required.";
      }
      break;

    case "Admitted":
      if (!input.admission_id && !visit.admission_id) {
        errors.admission_id = "Admission must be initiated before completing admission departure.";
      }
      break;

    case "Died":
    case "BroughtDead":
      // Recorded with death flow
      break;
  }

  return errors;
}

export interface OutsideDocumentValidation {
  title: string;
  doc_type: string;
  source_facility: string;
  document_date: string;
  file: File | null;
}

/**
 * Validates outside patient reports upload (rule:7571033b1d, rule:794ff452da, rule:abab0015cb).
 */
export function validateOutsideDocument(
  doc: OutsideDocumentValidation,
  maxUploadBytes: number = 10 * 1024 * 1024
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!doc.file) {
    errors.file = "Please select a document file to upload.";
  } else {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(doc.file.type)) {
      errors.file = "Unsupported file type. Only PDF, JPEG, and PNG files are allowed.";
    }
    if (doc.file.size > maxUploadBytes) {
      errors.file = `File size exceeds the maximum allowed limit (${Math.round(maxUploadBytes / (1024 * 1024))} MB).`;
    }
  }

  if (!doc.title || doc.title.trim().length < 2) {
    errors.title = "Document report title is required (e.g. CBC, Ultrasound, Discharge Note).";
  }

  if (!doc.source_facility || doc.source_facility.trim().length < 2) {
    errors.source_facility = "Issuing hospital, laboratory, or clinic name is required.";
  }

  if (!doc.document_date) {
    errors.document_date = "Date on the document is required.";
  } else {
    const selectedDate = new Date(doc.document_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(selectedDate.getTime()) || selectedDate > today) {
      errors.document_date = "Document date cannot be in the future.";
    }
  }

  return errors;
}

/**
 * Explains backend error responses for er_visit.
 */
export function explainErVisitError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  if (typeof err === "string") return err;

  const anyErr = err as {
    message?: string;
    code?: string;
    status?: number;
    details?: Record<string, unknown>;
  };

  switch (anyErr.code) {
    case "ER_VISIT_DEPARTED":
      return "This emergency visit is already departed and is now permanently read-only.";

    case "ER_VISIT_OPEN":
      return "The patient has an existing active emergency visit in progress.";

    case "INVALID_STAGE_TRANSITION":
      return "Invalid stage progression. Please follow standard emergency department triage sequence.";

    case "VALIDATION_ERROR":
      if (anyErr.details?.suggested_level) {
        return `Algorithm suggested Level ${anyErr.details.suggested_level}. Override reason is required to assign a different level.`;
      }
      return anyErr.message || "Input validation failed. Please check required fields.";

    case "UNSUPPORTED_MEDIA_TYPE":
      return "Unsupported file format. Please upload a standard PDF, JPEG, or PNG document.";

    case "PAYLOAD_TOO_LARGE":
      return "File size exceeds the server upload limit. Please compress the file and retry.";

    case "MLC_CASE_EXISTS":
      return "A medico-legal case has already been opened for this emergency visit.";

    default:
      return anyErr.message || "An error occurred while processing the emergency visit.";
  }
}
