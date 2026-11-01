import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  PreAnaesthesiaIn,
  PreAnaesthesiaOut,
  ClinicalPrivilegeOut,
  SurgicalWorklistItemOut,
} from "./generated/pre_anaesthesia_clinic";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for pre_anaesthesia_clinic according to Rule be026bcee1.
 * Uses GET /establishment views.screens.pre_anaesthesia_clinic. Never decides from facility category.
 */
export function getPreAnaesthesiaClinicScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "pre_anaesthesia_clinic");
  if (screenEntry?.view) {
    return screenEntry.view;
  }

  // 2. Check surgery capability state
  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Active") return "full";
    if (surgeryCap.state === "Retiring") return "open_work";
    if (surgeryCap.state === "Retired") return "records";
    if (surgeryCap.state === "Preparing") return "setup";
    if (surgeryCap.state === "Available") return "hidden";
  }

  // 3. Check active capabilities
  if (establishment.active && !establishment.active.includes("surgery")) {
    return "setup";
  }

  return "full";
}

/**
 * Returns true if surgery service is active in establishment.
 */
export function isSurgeryActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("surgery");
}

/**
 * Role permissions for PAC assessment.
 */
export function canAssessPreAnaesthesia(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("ot.clinical.assess") ||
    user.permissions.includes("ot.clinical.anaesthesia") ||
    user.permissions.includes("ot.booking.manage") ||
    user.permissions.includes("doctor.view")
  );
}

/**
 * Checks if the user holds an active PreAnaesthesiaAssessment or Anaesthesia clinical privilege (Rule d4ca3b3bcc).
 */
export function hasAnaesthesiaPrivilege(
  privileges: ClinicalPrivilegeOut[],
  employeeId?: number | null
): boolean {
  if (!employeeId) return false;
  return privileges.some(
    (p) =>
      p.employee_id === employeeId &&
      !p.revoked_at &&
      (p.privilege === "PreAnaesthesiaAssessment" || p.privilege === "Anaesthesia")
  );
}

/**
 * Validates PAC draft values (bounds on vital signs, airway, ASA).
 */
export function validatePreAnaesthesiaDraft(input: PreAnaesthesiaIn): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.heart_rate != null) {
    if (input.heart_rate < 20 || input.heart_rate > 260) {
      errors.push("Heart rate must be between 20 and 260 bpm.");
    }
  }

  if (input.bp_systolic != null) {
    if (input.bp_systolic < 40 || input.bp_systolic > 300) {
      errors.push("Systolic blood pressure must be between 40 and 300 mmHg.");
    }
  }

  if (input.bp_diastolic != null) {
    if (input.bp_diastolic < 20 || input.bp_diastolic > 200) {
      errors.push("Diastolic blood pressure must be between 20 and 200 mmHg.");
    }
  }

  if (input.spo2 != null) {
    if (input.spo2 < 50 || input.spo2 > 100) {
      errors.push("SpO2 oxygen saturation must be between 50% and 100%.");
    }
  }

  if (input.airway_mallampati != null) {
    if (input.airway_mallampati < 1 || input.airway_mallampati > 4) {
      errors.push("Mallampati airway classification must be between 1 and 4.");
    }
  }

  if (input.asa_class != null) {
    if (input.asa_class < 1 || input.asa_class > 6) {
      errors.push("ASA physical status classification must be between 1 and 6.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates pre-anaesthesia form completeness before signing (Rule a91aa7215a & Rule d4ca3b3bcc).
 * Fit with conditions, Not fit, or Deferred require a non-blank decision_note.
 */
export function validatePreAnaesthesiaSign(input: PreAnaesthesiaIn): { valid: boolean; errors: string[] } {
  const { valid: draftValid, errors } = validatePreAnaesthesiaDraft(input);

  if (!input.decision) {
    errors.push("Anaesthesia fitness decision (Fit, FitWithConditions, NotFit, or Deferred) is mandatory.");
  } else if (
    input.decision === "FitWithConditions" ||
    input.decision === "NotFit" ||
    input.decision === "Deferred"
  ) {
    if (!input.decision_note || input.decision_note.trim().length === 0) {
      errors.push(
        `Decision "${input.decision}" requires a detailed clinical explanation in the decision note.`
      );
    }
  }

  if (!input.asa_class) {
    errors.push("ASA physical status classification (ASA 1-6) is required before signing.");
  }

  if (!input.planned_technique) {
    errors.push("Planned anaesthetic technique (General, Spinal, Epidural, Regional, etc.) is required.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * ASA Physical Status Score descriptions.
 */
export const ASA_CLASSES: Record<number, { title: string; desc: string; ur: string }> = {
  1: {
    title: "ASA I",
    desc: "A normal healthy patient",
    ur: "بالکل صحت مند مریض",
  },
  2: {
    title: "ASA II",
    desc: "A patient with mild systemic disease (e.g. controlled HTN/DM, smoker)",
    ur: "ہلکی بیماری والا مریض (جیسے قابو میں بلڈ پریشر یا شوگر)",
  },
  3: {
    title: "ASA III",
    desc: "A patient with severe systemic disease (e.g. poorly controlled DM, stable angina)",
    ur: "شدید بیماری والا مریض (جیسے غیر متوازن شوگر یا پرانا امراض قلب)",
  },
  4: {
    title: "ASA IV",
    desc: "A patient with severe systemic disease that is a constant threat to life",
    ur: "انتہائی نازک اور جان لیوا بیماری والا مریض",
  },
  5: {
    title: "ASA V",
    desc: "A moribund patient who is not expected to survive without the operation",
    ur: "انتہائی نازک حالت جس کا آپریشن کے بغیر بچنا ناممکن ہو",
  },
  6: {
    title: "ASA VI",
    desc: "A declared brain-dead patient whose organs are being removed for donor purposes",
    ur: "برین ڈیڈ مریض جس کے اعضاء عطیہ کے لیے نکالے جا رہے ہوں",
  },
};

/**
 * Mallampati Airway Classification descriptions.
 */
export const MALLAMPATI_CLASSES: Record<number, { title: string; desc: string; ur: string }> = {
  1: {
    title: "Class I",
    desc: "Full visualization of soft palate, fauces, uvula, and pillars",
    ur: "تالو، کوے اور ٹانسلز کی مکمل واضح نظر",
  },
  2: {
    title: "Class II",
    desc: "Complete visualization of soft palate, fauces, and uvula",
    ur: "تالو اور کوے کی واضح نظر",
  },
  3: {
    title: "Class III",
    desc: "Visualization of soft palate and base of uvula only (Potential difficult intubation)",
    ur: "صرف نرم تالو نظر آئے (ممکنہ دشوار گزار ٹیوب)",
  },
  4: {
    title: "Class IV",
    desc: "Soft palate not visible at all; only hard palate visible (High difficult airway risk)",
    ur: "نرم تالو بالکل نظر نہ آئے (انتہائی مشکل ٹیوب کا خطرہ)",
  },
};

/**
 * Bilingual explanations for Pre-Anaesthesia Clinic errors.
 */
export function explainPreAnaesthesiaError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    OT_RECORD_FINAL: {
      en: "This pre-anaesthesia assessment is signed and final. It cannot be edited directly; use 'Reassess' to record a new assessment or add an addendum note.",
      ur: "یہ پری اینستھیزیا جائزہ دستخط شدہ اور حتمی ہے۔ براہ راست تبدیلی ممکن نہیں؛ نیا جائزہ لیں یا تصحیح درج کریں۔",
    },
    OT_PRIVILEGE_REQUIRED: {
      en: details?.privilege
        ? `Clinical privilege missing: signing requires "${details.privilege}" privilege authorized by the hospital.`
        : "The user does not possess the required PreAnaesthesiaAssessment or Anaesthesia clinical privilege to sign this assessment.",
      ur: details?.privilege
        ? `کلینیکل اختیارات درکار ہیں: دستخط کے لیے ہسپتال کا باضابطہ "${details.privilege}" اختیار ہونا لازمی ہے۔`
        : "آپ کے پاس پری اینستھیزیا جائزہ پر دستخط کرنے کے لازمی کلینیکل اختیارات موجود نہیں ہیں۔",
    },
    CAPABILITY_INACTIVE: {
      en: "Surgery service is inactive. Pre-anaesthesia assessments cannot be signed.",
      ur: "سرجری سروس غیر فعال ہے۔ پری اینستھیزیا جائزے پر دستخط نہیں کیے جا سکتے۔",
    },
    VALIDATION_ERROR: {
      en: "Assessment validation failed. Please check mandatory fields: ASA class, planned technique, vitals, and decision note.",
      ur: "جائزہ نامکمل ہے۔ اے ایس اے درجہ، منصوبہ بندی، اہم علامات اور فیصلے کا نوٹ مکمل کریں۔",
    },
    VERSION_CONFLICT: {
      en: "This record was updated by another user. Please refresh and review the latest clinical entries.",
      ur: "یہ ریکارڈ کسی دوسرے صارف نے تبدیل کر دیا ہے۔ تازہ ترین ڈیٹا دیکھنے کے لیے ریفریش کریں۔",
    },
    FORBIDDEN: {
      en: "You do not have permission to perform this pre-anaesthesia operation.",
      ur: "آپ کو اس پری اینستھیزیا کارروائی کی اجازت نہیں ہے۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ دوبارہ کوشش کریں۔`,
    }
  );
}
