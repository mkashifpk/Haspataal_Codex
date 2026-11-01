import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  PreOpNoteIn,
  OperativeNoteIn,
  OperativeNoteOut,
  SurgicalCorrectionIn,
  IncidentIn,
} from "./generated/surgical_record_surgeon";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

export const LATERALITY_OPTIONS = [
  "Left",
  "Right",
  "Bilateral",
  "NotApplicable",
] as const;

export const WOUND_CLASSES = [
  "Clean",
  "CleanContaminated",
  "Contaminated",
  "Dirty",
] as const;

export const CONDITIONS_AT_END = [
  "Stable",
  "Satisfactory",
  "Guarded",
  "Critical",
] as const;

export const ANAESTHESIA_TYPES = [
  "General",
  "Spinal",
  "Epidural",
  "Regional",
  "Sedation",
  "Local",
  "None",
] as const;

/**
 * Evaluates the runtime screen view mode for surgical_record_surgeon (Rule 7bb3ca4e1d).
 * Uses GET /establishment views.screens[screen_id]. Never decides from facility category.
 */
export function getSurgicalRecordSurgeonScreenView(
  establishment?: EstablishmentOut | null,
  screenId: string = "surgical_record_surgeon"
): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === screenId);
  if (screenEntry?.view) {
    return screenEntry.view;
  }

  // 2. Check surgery capability state
  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Retired") {
      return "hidden";
    }
    if (surgeryCap.state === "Retiring") {
      return "records";
    }
    if (surgeryCap.state === "Preparing") {
      return "setup";
    }
  }

  return "full";
}

/**
 * Checks whether user can view clinical surgical worklists and records.
 */
export function canViewSurgicalRecord(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  if (
    roles.includes("super_admin") ||
    roles.includes("hospital_admin") ||
    roles.includes("hospital_director") ||
    roles.includes("owner")
  ) {
    return true;
  }
  if (perms.includes("ot.clinical.view")) {
    return true;
  }
  const allowedRoles = [
    "surgeon",
    "doctor",
    "clinical_specialist",
    "anaesthetist",
    "ot_admin",
    "ot_nurse",
    "head_nurse",
    "ward_nurse",
  ];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Checks whether user can record / edit the surgeon's pre-operative clinical note.
 */
export function canRecordPreOpNote(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  if (perms.includes("ot.pre_op.record")) {
    return true;
  }
  return roles.includes("surgeon") || roles.includes("doctor") || roles.includes("clinical_specialist");
}

/**
 * Checks whether user can author and sign the surgeon's operative note.
 */
export function canRecordOperativeNote(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  if (perms.includes("ot.operative_note.write")) {
    return true;
  }
  return roles.includes("surgeon") || roles.includes("clinical_specialist") || roles.includes("doctor");
}

/**
 * Checks whether user can prepare / sign surgical consents.
 */
export function canManageConsents(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  if (perms.includes("consent.record") || perms.includes("consent.configure")) {
    return true;
  }
  return roles.includes("surgeon") || roles.includes("doctor") || roles.includes("anaesthetist");
}

/**
 * Checks whether user can append corrections to a signed record part (Rule 9e9cb593cb).
 */
export function canCorrectSurgicalRecord(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  const requiredPerms = [
    "ot.pre_op.record",
    "ot.anaesthesia.record",
    "ot.checklist.record",
    "ot.operative_note.write",
    "ot.recovery.record",
  ];
  if (perms.some((p) => requiredPerms.includes(p))) {
    return true;
  }
  const allowedRoles = ["surgeon", "doctor", "clinical_specialist", "anaesthetist", "ot_admin", "ot_nurse"];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Checks whether user can report in-theatre incidents.
 */
export function canReportIncident(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes("incident.report")) {
    return true;
  }
  const roles = user.roles || [];
  return roles.length > 0;
}

/**
 * Validates Surgeon's Pre-Operative Note (Rule 8bbdbdc51d).
 */
export function validatePreOpNote(data: Partial<PreOpNoteIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.history_examination || data.history_examination.trim().length < 5) {
    errors.history_examination = "History and physical examination note is required (min 5 characters).";
  }

  if (!data.provisional_diagnosis || data.provisional_diagnosis.trim().length < 3) {
    errors.provisional_diagnosis = "Provisional diagnosis is required (min 3 characters).";
  }

  if (!data.operation_plan || data.operation_plan.trim().length < 5) {
    errors.operation_plan = "Proposed operation plan and surgical procedure is required (min 5 characters).";
  }

  if (!data.laterality || !LATERALITY_OPTIONS.includes(data.laterality)) {
    errors.laterality = "Surgical laterality / site marking must be Left, Right, Bilateral, or NotApplicable.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Surgeon's Operative Note Draft (Rule 2b25651d1e).
 */
export function validateOperativeNoteDraft(data: Partial<OperativeNoteIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.procedure_performed || data.procedure_performed.trim().length < 3) {
    errors.procedure_performed = "Actual procedure performed is required (min 3 characters).";
  }

  if (!data.post_op_diagnosis || data.post_op_diagnosis.trim().length < 3) {
    errors.post_op_diagnosis = "Post-operative diagnosis is required (min 3 characters).";
  }

  if (!data.findings || data.findings.trim().length < 5) {
    errors.findings = "Intra-operative surgical findings are required (min 5 characters).";
  }

  if (!data.procedure_details || data.procedure_details.trim().length < 5) {
    errors.procedure_details = "Operative technique and procedure details are required (min 5 characters).";
  }

  if (!data.wound_class || !WOUND_CLASSES.includes(data.wound_class)) {
    errors.wound_class = "Surgical wound class must be Clean, CleanContaminated, Contaminated, or Dirty (MSDS COP 50).";
  }

  if (!data.condition_at_end || !CONDITIONS_AT_END.includes(data.condition_at_end)) {
    errors.condition_at_end = "Patient condition at end of surgery must be Stable, Satisfactory, Guarded, or Critical.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Operative Note for Final Signing (Rule 2b25651d1e).
 * Ensures post-op orders are complete (monitoring, analgesia, antibiotics, IV fluids, wound care, nutrition).
 */
export function validateOperativeNoteSigning(
  note?: OperativeNoteOut | null,
  draft?: Partial<OperativeNoteIn> | null
): { canSign: boolean; missing: string[] } {
  const missing: string[] = [];

  const proc = draft?.procedure_performed ?? note?.procedure_performed;
  if (!proc || proc.trim().length < 3) {
    missing.push("Procedure performed (procedure_performed)");
  }

  const postOpDiag = draft?.post_op_diagnosis ?? note?.post_op_diagnosis;
  if (!postOpDiag || postOpDiag.trim().length < 3) {
    missing.push("Post-operative diagnosis (post_op_diagnosis)");
  }

  const findings = draft?.findings ?? note?.findings;
  if (!findings || findings.trim().length < 5) {
    missing.push("Operative findings (findings)");
  }

  const details = draft?.procedure_details ?? note?.procedure_details;
  if (!details || details.trim().length < 5) {
    missing.push("Operative technique & details (procedure_details)");
  }

  const wound = draft?.wound_class ?? note?.wound_class;
  if (!wound) {
    missing.push("Surgical wound classification (wound_class)");
  }

  const cond = draft?.condition_at_end ?? note?.condition_at_end;
  if (!cond) {
    missing.push("Patient condition at end (condition_at_end)");
  }

  // Post-operative care plan elements (Rule 2b25651d1e)
  const monitoring = draft?.monitoring ?? note?.monitoring;
  if (!monitoring || monitoring.trim().length === 0) {
    missing.push("Monitoring instructions (monitoring)");
  }

  const monitoringInterval = draft?.monitoring_interval_minutes ?? note?.monitoring_interval_minutes;
  if (monitoringInterval === undefined || monitoringInterval === null || monitoringInterval <= 0) {
    missing.push("Vitals monitoring interval in minutes (monitoring_interval_minutes)");
  }

  const meds = draft?.medications ?? note?.medications;
  if (!meds || meds.trim().length === 0) {
    missing.push("Post-op analgesia & medications (medications)");
  }

  const woundCare = draft?.wound_care ?? note?.wound_care;
  if (!woundCare || woundCare.trim().length === 0) {
    missing.push("Wound care & dressings (wound_care)");
  }

  const nutrition = draft?.nutrition ?? note?.nutrition;
  if (!nutrition || nutrition.trim().length === 0) {
    missing.push("Nutrition & diet advancement (nutrition)");
  }

  const fluids = draft?.fluid_balance ?? note?.fluid_balance;
  if (!fluids || fluids.trim().length === 0) {
    missing.push("Fluid balance & IV fluids (fluid_balance)");
  }

  return {
    canSign: missing.length === 0,
    missing,
  };
}

/**
 * Validates post-finality correction addendum (Rule 9e9cb593cb).
 */
export function validateCorrectionInput(data: Partial<SurgicalCorrectionIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.record) {
    errors.record = "Correction record part is required.";
  }

  if (!data.correction_text || data.correction_text.trim().length < 3) {
    errors.correction_text = "Correction text is required (min 3 characters).";
  }

  if (!data.correction_reason || data.correction_reason.trim().length < 3) {
    errors.correction_reason = "Mandatory correction audit reason is required (min 3 characters).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates adverse incident / near-miss report (Rule fe0c435dc9).
 */
export function validateIncidentInput(data: Partial<IncidentIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.booking_id) {
    errors.booking_id = "Booking reference is required.";
  }

  if (!data.type_code) {
    errors.type_code = "Incident type code is required.";
  }

  if (!data.description || data.description.trim().length < 5) {
    errors.description = "Incident description is required (min 5 characters).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Bilingual explanations for domain errors encountered in surgical record workflows.
 */
export function explainSurgicalRecordSurgeonError(
  code?: string | null,
  details?: Record<string, any>
): { en: string; ur: string } {
  switch (code) {
    case "OT_BOOKING_STATE_INVALID":
      return {
        en: "The surgical booking is not in an active operative lifecycle state for updating this record.",
        ur: "سرجیکل بکنگ اس ریکارڈ میں ترمیم کے لیے فعال آپریٹو حالت میں نہیں ہے۔",
      };
    case "OT_PRE_OP_NOTE_REQUIRED":
      return {
        en: "Surgeon's pre-operative clinical note is required before the WHO Sign In pause can proceed.",
        ur: "ڈبلیو ایچ او سائن ان سے قبل سرجن کا پری آپریٹو کلینیکل نوٹ لازمی ہے۔",
      };
    case "OT_OPERATIVE_NOTE_REQUIRED":
      return {
        en: "The signed operative note is required before the patient can be discharged from PACU recovery.",
        ur: "بحالی وارڈ سے اخراج سے قبل دستخط شدہ آپریٹو نوٹ لازمی ہے۔",
      };
    case "OT_PRIVILEGE_REQUIRED":
      return {
        en: "Clinical privilege required: The surgeon does not hold active PMDC surgical privileges authorized by the hospital.",
        ur: "کلینیکل اجازت نامہ لازمی ہے: معالج کے پاس ہسپتال سے منظور شدہ سرجیکل اجازت نامہ فعال نہیں ہے۔",
      };
    case "OT_RECORD_FINAL":
      return {
        en: "This part of the surgical record is already signed and final. Retrospective changes must be submitted as a correction addendum.",
        ur: "سرجیکل ریکارڈ کا یہ حصہ دستخط شدہ اور حتمی ہے۔ مزید تبدیلیاں تصحیحی ضمیمہ کے ذریعے شامل کریں۔",
      };
    case "OT_RECORD_INCOMPLETE":
      return {
        en: details?.missing
          ? `Missing required entries for signing: ${details.missing.join(", ")}`
          : "Mandatory operative note and post-operative plan fields are missing. Please complete all sections before signing.",
        ur: "آپریٹو نوٹ اور پوسٹ آپریٹو پلان کے لازمی اندراجات غائب ہیں۔ دستخط سے قبل تمام خانے پر کریں۔",
      };
    case "CONSENT_REQUIRED":
      return {
        en: "Surgical consent is required before the WHO Sign In pause and surgery induction can proceed.",
        ur: "انڈکشن اور سرجری سے قبل آپریشن کی باقاعدہ رضامندی لازمی ہے۔",
      };
    case "ICD_CODE_UNKNOWN":
      return {
        en: "The selected ICD-10 diagnostic code was not found in the hospital diagnostic classification registry.",
        ur: "منتخب کردہ آئی سی ڈی-10 تشخیصی کوڈ ہسپتال کی درجہ بندی میں دستیاب نہیں ہے۔",
      };
    case "CONSENT_INCOMPLETE":
      return {
        en: "Consent form is incomplete. Ensure patient understanding, witness details, or emergency notes are provided.",
        ur: "رضامندی فارم نامکمل ہے۔ مریض کی تفہیم، گواہ کے کوائف یا ہنگامی نوٹ فراہم کریں۔",
      };
    case "CONSENT_SIGNER_INVALID":
      return {
        en: "Invalid decision maker. Self-signing by minors is prohibited; an authorized guardian or relation is required.",
        ur: "نابالغ خود دستخط نہیں کر سکتا؛ بااختیار سرپرست یا متعلقہ فیصلہ ساز کا انتخاب لازمی ہے۔",
      };
    case "FORBIDDEN":
      return {
        en: "You do not have permission to perform this surgical clinical action.",
        ur: "آپ کو اس سرجیکل کلینیکل کارروائی کی اجازت نہیں ہے۔",
      };
    case "VALIDATION_ERROR":
      return {
        en: details?.message || "Please correct the highlighted validation errors before submitting.",
        ur: details?.message || "برائے مہربانی بھیجنے سے پہلے نمایاں کی گئی غلطیوں کی تصحیح کریں۔",
      };
    default:
      return {
        en: details?.message || code || "An unexpected error occurred. Please try again.",
        ur: details?.message || code || "ایک غیر متوقع خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
      };
  }
}
