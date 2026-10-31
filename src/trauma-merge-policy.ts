/**
 * Domain rules and clinical policies for Screen 95: trauma_merge
 * ("Trauma profile merge", Position 95, 45 points)
 * Workspace: reception / triage / admissions
 * Rules: rule:1734acddbd, rule:ba9b5a51e2, rule:a0a7f261f7, rule:de91bfcdbd
 */

import type { ClinicalUser } from "./clinical-context";
import type { EstablishmentOut } from "./generated/facility_profile";
import type { PatientSearchHitOut, MergeIn } from "./generated/trauma_merge";

export interface TraumaMergeViewEval {
  canShow: boolean;
  canStartNewWork: boolean;
  isReadOnly: boolean;
  isSetupOnly: boolean;
  bannerNotice: string | null;
}

export function evaluateTraumaMergeView(establishment: EstablishmentOut): TraumaMergeViewEval {
  let screenMode = "full";
  const screens = (establishment as any)?.views?.screens || (establishment as any)?.screens;

  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "trauma_merge");
    if (item?.view) screenMode = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["trauma_merge"]?.view) screenMode = screens["trauma_merge"].view;
    else if (typeof screens["trauma_merge"] === "string") screenMode = screens["trauma_merge"];
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
      bannerNotice: "Patient merge is restricted while reception is in setup mode.",
    };
  }

  if (screenMode === "records") {
    return {
      canShow: true,
      canStartNewWork: false,
      isReadOnly: true,
      isSetupOnly: false,
      bannerNotice: "Patient merge is restricted in historical records view.",
    };
  }

  if (screenMode === "open_work") {
    return {
      canShow: true,
      canStartNewWork: true,
      isReadOnly: false,
      isSetupOnly: false,
      bannerNotice: "Open work mode: completing existing profile consolidations.",
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

export function canSearchPatients(user: ClinicalUser): boolean {
  return user.permissions?.includes("patient.search") ?? false;
}

export function canMergePatient(user: ClinicalUser): boolean {
  return user.permissions?.includes("patient.merge") ?? false;
}

export function canApproveMerge(user: ClinicalUser): boolean {
  return user.permissions?.includes("patient.merge.approve") ?? false;
}

export interface ProfileDiscrepancy {
  field: string;
  sourceValue: string | null;
  targetValue: string | null;
  isConflict: boolean;
}

/**
 * Compares two profiles side-by-side to highlight discrepancies before merging (rule:ba9b5a51e2).
 */
export function compareProfilesSideBySide(
  source: PatientSearchHitOut,
  target: PatientSearchHitOut
): ProfileDiscrepancy[] {
  const discrepancies: ProfileDiscrepancy[] = [];

  // Full Name
  discrepancies.push({
    field: "Full Name",
    sourceValue: source.full_name || source.temp_identifier || "—",
    targetValue: target.full_name || target.temp_identifier || "—",
    isConflict: source.full_name !== target.full_name,
  });

  // Father / Husband Name
  discrepancies.push({
    field: "Father / Husband Name",
    sourceValue: source.father_or_husband_name,
    targetValue: target.father_or_husband_name,
    isConflict:
      !!source.father_or_husband_name &&
      !!target.father_or_husband_name &&
      source.father_or_husband_name.toLowerCase() !== target.father_or_husband_name.toLowerCase(),
  });

  // Gender
  discrepancies.push({
    field: "Gender",
    sourceValue: source.gender,
    targetValue: target.gender,
    isConflict:
      source.gender !== "unknown" &&
      target.gender !== "unknown" &&
      source.gender !== target.gender,
  });

  // Date of Birth / Age
  const sourceAge = source.dob || (source.age_years ? `${source.age_years} yrs` : null);
  const targetAge = target.dob || (target.age_years ? `${target.age_years} yrs` : null);
  discrepancies.push({
    field: "Date of Birth / Age",
    sourceValue: sourceAge,
    targetValue: targetAge,
    isConflict: false,
  });

  // CNIC
  discrepancies.push({
    field: "CNIC",
    sourceValue: source.cnic,
    targetValue: target.cnic,
    isConflict: !!source.cnic && !!target.cnic && source.cnic !== target.cnic,
  });

  // Mobile
  discrepancies.push({
    field: "Mobile",
    sourceValue: source.mobile,
    targetValue: target.mobile,
    isConflict: !!source.mobile && !!target.mobile && source.mobile !== target.mobile,
  });

  // MRN
  discrepancies.push({
    field: "MRN",
    sourceValue: source.mrn,
    targetValue: target.mrn,
    isConflict: false,
  });

  // Registration Type
  discrepancies.push({
    field: "Registration Type",
    sourceValue: source.registration_type,
    targetValue: target.registration_type,
    isConflict: false,
  });

  return discrepancies;
}

/**
 * Validates patient profile merge request (rule:ba9b5a51e2, rule:a0a7f261f7).
 */
export function validateMergeRequest(
  source: PatientSearchHitOut | null,
  target: PatientSearchHitOut | null,
  input: MergeIn
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!source) {
    errors.source = "Please select the source profile to be merged.";
    return errors;
  }

  if (!target) {
    errors.target = "Please select the permanent target master profile that will survive.";
    return errors;
  }

  if (source.patient_id === target.patient_id) {
    errors.target = "Cannot merge a patient profile into itself.";
  }

  if (source.registration_type === "Merged") {
    errors.source = `Profile ${source.mrn} is already merged into MRN ${source.merged_into_id}.`;
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = "Clinical or administrative merge justification reason is required (at least 5 characters).";
  }

  // Co-signer requirement for merging a Regular permanent profile (rule:a0a7f261f7)
  if (source.registration_type === "Regular") {
    if (!input.cosigner_username || input.cosigner_username.trim().length < 2) {
      errors.cosigner_username =
        "Merging a permanent Regular profile requires a second authorized person (holding patient.merge.approve).";
    }
    if (!input.cosigner_password) {
      errors.cosigner_password = "Co-signer password is required.";
    }
  }

  return errors;
}

/**
 * Explains backend error responses for trauma_merge (rule:de91bfcdbd).
 */
export function explainTraumaMergeError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  if (typeof err === "string") return err;

  const anyErr = err as {
    message?: string;
    code?: string;
    status?: number;
    details?: {
      conflicts?: string[];
      field?: string;
    };
  };

  switch (anyErr.code) {
    case "MERGE_IDENTITY_CONFLICT":
      const conflictList = anyErr.details?.conflicts?.join(", ") || "identity parameters";
      return `MERGE CONFLICT: The profiles belong to two different individuals (conflicts in: ${conflictList}). Overriding is prohibited by policy. Correct the erroneous profile first via demographics update.`;

    case "MERGE_COSIGNER_REQUIRED":
      return "Co-signature required: Merging a permanent profile requires verification by an authorized supervisor holding patient.merge.approve.";

    case "PATIENT_ALREADY_MERGED":
      return "The source profile has already been consolidated into another master record.";

    case "PATIENT_DECEASED":
      return "Cannot merge a profile with recorded clinical activity post-dating death certificate.";

    case "VALIDATION_ERROR":
      return anyErr.message || "Merge submission validation failed.";

    default:
      return anyErr.message || "An error occurred while merging the patient profiles.";
  }
}
