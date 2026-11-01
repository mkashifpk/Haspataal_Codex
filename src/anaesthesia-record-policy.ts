import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  AnaesthesiaRecordIn,
  AnaesthesiaRecordOut,
  AnaesthesiaVitalsIn,
  AnaesthesiaEventIn,
  SurgicalCorrectionIn,
  IncidentIn,
} from "./generated/anaesthesia_record";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

export const ANAESTHESIA_TECHNIQUES = [
  "General",
  "Spinal",
  "Epidural",
  "Regional",
  "Sedation",
  "Local",
] as const;

export const AIRWAY_DEVICES = [
  "None",
  "FaceMask",
  "NasalCannula",
  "LMA",
  "EndotrachealTube",
  "Tracheostomy",
] as const;

export const CARDIAC_RHYTHMS = [
  "Sinus",
  "SinusTachycardia",
  "SinusBradycardia",
  "AtrialFibrillation",
  "OtherArrhythmia",
  "Paced",
] as const;

export const EVENT_KINDS = ["Drug", "Fluid", "Blood", "Event"] as const;

/**
 * Evaluates the runtime screen view mode for anaesthesia_record (Rule 2285735141).
 * Uses GET /establishment views.screens[screen_id]. Never decides from facility category.
 */
export function getAnaesthesiaRecordScreenView(
  establishment?: EstablishmentOut | null,
  screenId: string = "anaesthesia_record"
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
 * Checks whether user has permission to view surgical & anaesthesia records.
 */
export function canViewAnaesthesiaRecord(user?: ClinicalUser | null): boolean {
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
    "anaesthetist",
    "clinical_specialist",
    "doctor",
    "head_nurse",
    "ot_admin",
    "ot_nurse",
    "surgeon",
    "ward_nurse",
  ];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Checks whether user has permission to record / update anaesthesia observations and events.
 */
export function canRecordAnaesthesia(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  const roles = user.roles || [];
  if (perms.includes("ot.anaesthesia.record")) {
    return true;
  }
  return roles.includes("anaesthetist") || roles.includes("ot_nurse");
}

/**
 * Checks whether user can append corrections to a signed record part (Rule 9e9cb593cb).
 */
export function canCorrectAnaesthesia(user?: ClinicalUser | null): boolean {
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
  const allowedRoles = [
    "anaesthetist",
    "clinical_specialist",
    "doctor",
    "ot_admin",
    "ot_nurse",
    "surgeon",
  ];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Checks whether user can report an in-theatre incident or adverse event (Rule fe0c435dc9).
 */
export function canReportIncident(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes("incident.report")) {
    return true;
  }
  // Any authenticated staff member in clinical OT roles
  const roles = user.roles || [];
  return roles.length > 0;
}

/**
 * Validates Pre-Induction panel baseline observations and plan changes (Rule eda7089766).
 */
export function validatePreInduction(data: Partial<AnaesthesiaRecordIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (data.pre_induction_heart_rate !== undefined && data.pre_induction_heart_rate !== null) {
    if (data.pre_induction_heart_rate < 30 || data.pre_induction_heart_rate > 250) {
      errors.pre_induction_heart_rate = "Heart rate must be between 30 and 250 bpm.";
    }
  }

  if (data.pre_induction_bp_systolic !== undefined && data.pre_induction_bp_systolic !== null) {
    if (data.pre_induction_bp_systolic < 40 || data.pre_induction_bp_systolic > 300) {
      errors.pre_induction_bp_systolic = "Systolic BP must be between 40 and 300 mmHg.";
    }
  }

  if (data.pre_induction_bp_diastolic !== undefined && data.pre_induction_bp_diastolic !== null) {
    if (data.pre_induction_bp_diastolic < 20 || data.pre_induction_bp_diastolic > 200) {
      errors.pre_induction_bp_diastolic = "Diastolic BP must be between 20 and 200 mmHg.";
    }
  }

  if (
    data.pre_induction_bp_systolic !== undefined &&
    data.pre_induction_bp_systolic !== null &&
    data.pre_induction_bp_diastolic !== undefined &&
    data.pre_induction_bp_diastolic !== null
  ) {
    if (data.pre_induction_bp_systolic <= data.pre_induction_bp_diastolic) {
      errors.pre_induction_bp_systolic = "Systolic BP must be higher than diastolic BP.";
    }
  }

  if (data.pre_induction_spo2 !== undefined && data.pre_induction_spo2 !== null) {
    if (data.pre_induction_spo2 < 50 || data.pre_induction_spo2 > 100) {
      errors.pre_induction_spo2 = "SpO2 must be between 50% and 100%.";
    }
  }

  if (data.plan_changed === true) {
    if (!data.plan_change || data.plan_change.trim().length < 3) {
      errors.plan_change = "Clinical rationale is mandatory when anaesthesia plan has changed.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates periodic vitals chart entry (Rule c7bd8c2650, MSDS 36).
 */
export function validateVitalsEntry(data: Partial<AnaesthesiaVitalsIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (data.heart_rate === undefined || data.heart_rate === null) {
    errors.heart_rate = "Heart rate is required.";
  } else if (data.heart_rate < 20 || data.heart_rate > 260) {
    errors.heart_rate = "Heart rate must be between 20 and 260 bpm.";
  }

  if (data.bp_systolic === undefined || data.bp_systolic === null) {
    errors.bp_systolic = "Systolic BP is required.";
  } else if (data.bp_systolic < 40 || data.bp_systolic > 300) {
    errors.bp_systolic = "Systolic BP must be between 40 and 300 mmHg.";
  }

  if (data.bp_diastolic === undefined || data.bp_diastolic === null) {
    errors.bp_diastolic = "Diastolic BP is required.";
  } else if (data.bp_diastolic < 20 || data.bp_diastolic > 200) {
    errors.bp_diastolic = "Diastolic BP must be between 20 and 200 mmHg.";
  }

  if (
    data.bp_systolic !== undefined &&
    data.bp_systolic !== null &&
    data.bp_diastolic !== undefined &&
    data.bp_diastolic !== null
  ) {
    if (data.bp_systolic <= data.bp_diastolic) {
      errors.bp_systolic = "Systolic BP must exceed diastolic BP.";
    }
  }

  if (data.respiratory_rate === undefined || data.respiratory_rate === null) {
    errors.respiratory_rate = "Respiratory rate is required.";
  } else if (data.respiratory_rate < 0 || data.respiratory_rate > 80) {
    errors.respiratory_rate = "Respiratory rate must be between 0 and 80 /min.";
  }

  if (data.spo2 === undefined || data.spo2 === null) {
    errors.spo2 = "SpO2 percentage is required.";
  } else if (data.spo2 < 50 || data.spo2 > 100) {
    errors.spo2 = "SpO2 must be between 50% and 100%.";
  }

  if (data.etco2 !== undefined && data.etco2 !== null) {
    if (data.etco2 < 0 || data.etco2 > 120) {
      errors.etco2 = "EtCO2 must be between 0 and 120 mmHg.";
    }
  }

  if (data.temp_c !== undefined && data.temp_c !== null && data.temp_c !== "") {
    const tempNum = Number(data.temp_c);
    if (isNaN(tempNum) || tempNum < 25 || tempNum > 45) {
      errors.temp_c = "Temperature must be between 25°C and 45°C.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates intra-operative medication, fluid, blood, or event entry (Rule c7bd8c2650).
 */
export function validateEventEntry(data: Partial<AnaesthesiaEventIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.kind || !EVENT_KINDS.includes(data.kind)) {
    errors.kind = "Event category must be Drug, Fluid, Blood, or Event.";
  }

  if (!data.description || data.description.trim().length < 2) {
    errors.description = "Description or medication name is required (min 2 characters).";
  }

  if (data.kind === "Drug" && (!data.dose || data.dose.trim().length === 0)) {
    errors.dose = "Dose and units are required for drug administration.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates whether the anaesthesia record has all mandatory fields before signing (Rule 2fc0c843dc).
 */
export function validateRecordSigning(
  record?: AnaesthesiaRecordOut | null,
  draft?: Partial<AnaesthesiaRecordIn> | null
): { canSign: boolean; missing: string[] } {
  const missing: string[] = [];

  const inductionAt = draft?.induction_at ?? record?.induction_at;
  if (!inductionAt) {
    missing.push("Induction timestamp (induction_at)");
  }

  const incisionAt = draft?.incision_at ?? record?.incision_at;
  if (!incisionAt) {
    missing.push("Incision timestamp (incision_at)");
  }

  const anaesthesiaEndAt = draft?.anaesthesia_end_at ?? record?.anaesthesia_end_at;
  if (!anaesthesiaEndAt) {
    missing.push("Anaesthesia end timestamp (anaesthesia_end_at)");
  }

  const technique = draft?.technique ?? record?.technique;
  if (!technique) {
    missing.push("Anaesthetic technique");
  }

  const airway = draft?.airway_device ?? record?.airway_device;
  if (!airway) {
    missing.push("Airway management device");
  }

  const handover = draft?.handover_note ?? record?.handover_note;
  if (!handover || handover.trim().length < 3) {
    missing.push("Recovery handover note (min 3 characters)");
  }

  const vitalsCount = record?.vitals?.length || 0;
  if (vitalsCount === 0) {
    missing.push("At least one charted vital signs reading");
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

  if (!data.record || data.record !== "AnaesthesiaRecord") {
    errors.record = "Correction record must be 'AnaesthesiaRecord'.";
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
 * Bilingual explanations for domain errors encountered in anaesthesia record workflows.
 */
export function explainAnaesthesiaRecordError(
  code?: string | null,
  details?: Record<string, any>
): { en: string; ur: string } {
  switch (code) {
    case "OT_BOOKING_STATE_INVALID":
      return {
        en: "The surgical booking is not in an active operative lifecycle state for charting.",
        ur: "سرجیکل بکنگ چارٹنگ کے لیے فعال آپریٹو حالت میں نہیں ہے۔",
      };
    case "OT_CHECKLIST_INCOMPLETE":
      return {
        en: "WHO Surgical Safety Checklist pause incomplete: Sign In is required before induction, and Time Out before incision.",
        ur: "سرجیکل سیفٹی چیک لسٹ نامکمل ہے: انڈکشن سے قبل سائن ان اور کٹ لگانے سے قبل ٹائم آؤٹ لازمی ہے۔",
      };
    case "OT_PRIVILEGE_REQUIRED":
      return {
        en: "Clinical privilege required: The practitioner does not hold active anaesthesia privileges authorized by the hospital.",
        ur: "کلینیکل اجازت نامہ لازمی ہے: معالج کے پاس ہسپتال سے منظور شدہ اینستھیزیا کی فعال اجازت نہیں ہے۔",
      };
    case "OT_RECORD_FINAL":
      return {
        en: "The anaesthesia record has already been signed and is final. Further changes must be added as a correction addendum.",
        ur: "اینستھیزیا ریکارڈ پہلے سے دستخط شدہ اور حتمی ہے۔ مزید تبدیلیاں تصحیحی ضمیمہ کے طور پر درج کریں۔",
      };
    case "OT_RECORD_INCOMPLETE":
      return {
        en: "Mandatory entries missing: Ensure induction, incision, end times, airway details, and vitals readings are charted before signing.",
        ur: "لازمی اندراجات غائب ہیں: دستخط سے قبل انڈکشن، کٹ، اختتامی اوقات، ایئروے اور وائٹلز کا اندراج یقینی بنائیں۔",
      };
    case "OT_RECORD_NOT_SIGNED":
      return {
        en: "The anaesthesia record is not signed yet: edit the draft directly rather than adding a correction.",
        ur: "اینستھیزیا ریکارڈ ابھی دستخط شدہ نہیں ہے: تصحیح کے بجائے ڈرافٹ میں براہ راست ترمیم کریں۔",
      };
    case "INCIDENT_DETAILS_REQUIRED":
      return {
        en: "Additional clinical details and severity categorization are required for this adverse incident.",
        ur: "اس ناخوشگوار واقعے کے لیے اضافی طبی تفصیلات اور شدت کا تعین لازمی ہے۔",
      };
    case "INCIDENT_SCREENING_DECIDED":
      return {
        en: "This incident report has already been reviewed and screened by hospital quality assurance.",
        ur: "اس واقعے کی رپورٹ کا کوالٹی ایشورنس کے ذریعے جائزہ مکمل ہو چکا ہے۔",
      };
    case "INCIDENT_TYPE_INACTIVE":
      return {
        en: "The selected incident category is currently inactive. Select an active incident classification.",
        ur: "منتخب کردہ واقعے کی قسم غیر فعال ہے۔ برائے مہربانی فعال درجہ بندی منتخب کریں۔",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        en: "Referenced record (booking, staff, or incident classification) was not found.",
        ur: "متعلقہ ریکارڈ (بکنگ، عملہ یا واقعے کی قسم) نہیں مل سکا۔",
      };
    case "FORBIDDEN":
      return {
        en: "You do not have permission to perform this anaesthesia clinical action.",
        ur: "آپ کو اس اینستھیزیا کلینیکل کارروائی کی اجازت نہیں ہے۔",
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
