/**
 * Domain policy and validation rules for consents_triage (Screen 99, Position 99, 92 points)
 * Emergency Department Informed Consents under MSDS PRE 72-75, COP 35, 43, AAC 23
 *
 * Rules:
 * - rule:e9d9f576df: Worklist first (GET /consent-worklist, `mine` for the caller's patients):
 *   the admissions without the general consent, the operations not signed in without their consents
 *   (OperationConsent, AnaesthesiaConsent), the signed forms still to scan; `overdue` in red;
 *   `consent_id` opens the draft already prepared.
 * - rule:d84307d9b2: Prepare: the form (GET /consent-forms) and the language the patient understands
 *   (only languages the form has; CONSENT_TEXT_MISSING lists details.available). POST /consents with
 *   the admission, the operation or the visit fills the patient and what it can; complete what missing lists.
 * - rule:fea5622fc5: Print it (print-payload) and lay out fields.consent.form_body in fields.consent.direction:
 *   rtl (Urdu and the other languages but English) in a Nastaliq or Naskh font.
 * - rule:b7bacc1ffb: Record the decision: Sign (signer Patient; or DecisionMaker, with relationship
 *   GET /consent-decision-makers allows for this patient: adult uses adult_priority, child minor_priority,
 *   else CONSENT_SIGNER_INVALID; questions and answers; 'the patient explained it back'), or Refuse
 *   (VerbalRefusal: witnessed). Emergency with nobody to consent: mode EmergencyNote, the note and second doctor.
 * - rule:f811c03843: Caller is stamped as professional who explained it: informed consent needs a registered doctor.
 *   CONSENT_INCOMPLETE lists details.missing.
 * - rule:8b7301ca0f: Scan signed paper: upload as patient document of type Consent, then POST /consents/{consent_id}/scan.
 *   A decided consent is final: Withdraw it (with reason) and take a new one. Refresh on consent.updated.
 * - rule:cb2f327ee7: Who signs comes from who_decides: patient_may_sign false offers only decision maker
 *   in priority order; ask for second PMDC doctor when emergency_second_doctor is true. Never hardcode age.
 * - rule:e0a2eac3db: Exists for emergency_department (work): full, open_work with banner, records, hidden.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ConsentOut,
  ConsentFormOut,
  ConsentBriefOut,
  ConsentWorklistItemOut,
  ConsentSignIn,
  ConsentRefuseIn,
} from "./generated/consents_triage";

export interface ConsentsTriageViewEvaluation {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canOpen: boolean;
  canCreateNew: boolean;
  canManageOpen: boolean;
  canViewRecords: boolean;
  bannerMessageEn?: string;
  bannerMessageUr?: string;
}

/**
 * Evaluate service view mode for consents_triage (rule:e0a2eac3db)
 */
export function evaluateConsentsTriageView(
  establishment: EstablishmentOut,
  screenId: string = "consents_triage",
): ConsentsTriageViewEvaluation {
  const match = establishment.views?.screens?.find((s) => s.screen_id === screenId);
  const viewMode = (match?.view ?? "full") as "full" | "open_work" | "records" | "setup" | "hidden";

  switch (viewMode) {
    case "full":
      return {
        view: "full",
        canOpen: true,
        canCreateNew: true,
        canManageOpen: true,
        canViewRecords: true,
      };
    case "open_work":
      return {
        view: "open_work",
        canOpen: true,
        canCreateNew: false,
        canManageOpen: true,
        canViewRecords: true,
        bannerMessageEn: "No new emergency arrivals from now on. Existing consents and scanning continue.",
        bannerMessageUr: "اب نئی ایمرجنسی آمد نہیں؛ موجودہ رضامندیاں اور اسکین جاری۔",
      };
    case "records":
      return {
        view: "records",
        canOpen: true,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: true,
        bannerMessageEn: "Records only: no preparation, edits or new decisions. Permitted corrections remain.",
        bannerMessageUr: "صرف ریکارڈ: تیاری، ترمیم یا نیا فیصلہ نہیں؛ مجاز تصحیح باقی۔",
      };
    case "setup":
      return {
        view: "setup",
        canOpen: false,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: false,
      };
    case "hidden":
    default:
      return {
        view: "hidden",
        canOpen: false,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: false,
      };
  }
}

/**
 * Check user role and permissions for consents_triage
 */
export function canAccessConsentsTriage(permissions: string[]): {
  canView: boolean;
  canRecord: boolean;
  canUploadDocument: boolean;
} {
  return {
    canView: permissions.includes("consent.view"),
    canRecord: permissions.includes("consent.record"),
    canUploadDocument: permissions.includes("patient.document.upload"),
  };
}

/**
 * Filter worklist according to rule:e9d9f576df
 */
export function filterConsentWorklist(
  items: ConsentWorklistItemOut[],
  filterMine: boolean = false,
): {
  items: ConsentWorklistItemOut[];
  overdueCount: number;
} {
  const overdueCount = items.filter((i) => i.overdue).length;
  return {
    items,
    overdueCount,
  };
}

/**
 * Check if a consent action is permitted on this record
 */
export function isConsentActionPermitted(
  consent: ConsentOut,
  action: "edit" | "sign" | "refuse" | "withdraw" | "cancel" | "scan",
): boolean {
  if (action === "edit" || action === "sign" || action === "refuse" || action === "cancel") {
    return consent.status === "Draft";
  }
  if (action === "withdraw") {
    return consent.status === "Given";
  }
  if (action === "scan") {
    return ["Given", "Refused", "Withdrawn"].includes(consent.status);
  }
  return false;
}

/**
 * Validate draft preparation inputs (rule:d84307d9b2)
 */
export function validateConsentDraftPreparation(
  form: ConsentFormOut,
  language: string,
  admissionNeed?: string | null,
  estimatedDays?: number | string | null,
  estimatedCost?: number | string | null,
): {
  valid: boolean;
  error?: string;
  missingFields: string[];
} {
  const missing: string[] = [];
  const hasLang = form.texts.some((t) => t.language === language);
  if (!hasLang) {
    return {
      valid: false,
      error: `Form ${form.title} does not have text for language ${language}.`,
      missingFields: ["language"],
    };
  }

  if (admissionNeed && admissionNeed.length > 2000) {
    return {
      valid: false,
      error: "Need for admission must be 2000 characters or fewer.",
      missingFields: ["admission_need"],
    };
  }

  if (estimatedDays !== undefined && estimatedDays !== null && estimatedDays !== "") {
    const days = Number(estimatedDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      return {
        valid: false,
        error: "Estimated stay must be an integer between 0 and 365 days.",
        missingFields: ["estimated_days"],
      };
    }
  }

  if (estimatedCost !== undefined && estimatedCost !== null && estimatedCost !== "") {
    const cost = Number(estimatedCost);
    if (isNaN(cost) || cost < 0) {
      return {
        valid: false,
        error: "Estimated cost must be a non-negative amount.",
        missingFields: ["estimated_cost"],
      };
    }
  }

  return {
    valid: true,
    missingFields: missing,
  };
}

/**
 * Validate decision recording (rule:b7bacc1ffb, rule:cb2f327ee7, rule:f811c03843)
 */
export function validateConsentDecision(
  consent: ConsentOut,
  mode: "Signed" | "EmergencyNote" | "VerbalRefusal",
  decision: {
    signer?: "Patient" | "DecisionMaker" | null;
    signerName?: string | null;
    signerRelationship?: string | null;
    signerCnic?: string | null;
    incapacityReason?: string | null;
    witnessName?: string | null;
    witnessRole?: string | null;
    questionsAnswers?: string | null;
    understandingConfirmed?: boolean;
    emergencyNote?: string | null;
    secondDoctorId?: number | null;
    refusalReason?: string | null;
  },
): {
  valid: boolean;
  error?: string;
} {
  if (consent.status !== "Draft") {
    return { valid: false, error: "Only a draft consent can record a decision." };
  }

  if (mode === "EmergencyNote") {
    if (!decision.emergencyNote || decision.emergencyNote.trim().length < 3) {
      return { valid: false, error: "Emergency note must be at least 3 characters explaining why treatment could not wait." };
    }
    if (!decision.incapacityReason) {
      return { valid: false, error: "Incapacity reason is required when recording an emergency note." };
    }
    if (consent.who_decides.emergency_second_doctor && !decision.secondDoctorId) {
      return { valid: false, error: "A second registered PMDC doctor is required by hospital policy." };
    }
    return { valid: true };
  }

  if (mode === "VerbalRefusal") {
    if (!decision.refusalReason || decision.refusalReason.trim().length < 3) {
      return { valid: false, error: "Refusal reason must be at least 3 characters in the patient's words." };
    }
    if (!decision.witnessName || !decision.witnessName.trim()) {
      return { valid: false, error: "A witness is required for a verbal refusal." };
    }
    return { valid: true };
  }

  // mode === "Signed"
  if (!decision.signer) {
    return { valid: false, error: "Choose whether the Patient or a Decision Maker made the decision." };
  }

  if (decision.signer === "Patient" && !consent.who_decides.patient_may_sign) {
    return { valid: false, error: "Patient cannot sign under hospital policy. An authorized decision maker must sign." };
  }

  if (decision.signer === "DecisionMaker") {
    if (!decision.signerName || !decision.signerName.trim()) {
      return { valid: false, error: "Decision maker name is required." };
    }
    if (!decision.incapacityReason) {
      return { valid: false, error: "Reason why the patient cannot decide is required." };
    }
    const allowed = consent.who_decides.decision_makers.some((dm) => dm.relationship === decision.signerRelationship);
    if (!allowed) {
      return { valid: false, error: "Selected relationship is not authorized by hospital consent policy." };
    }
  }

  if (decision.signerCnic && !/^\d{5}-?\d{7}-?\d$/.test(decision.signerCnic)) {
    return { valid: false, error: "Signer CNIC format must be valid (13 digits)." };
  }

  if (!decision.questionsAnswers || !decision.questionsAnswers.trim()) {
    return { valid: false, error: "Questions asked and answers given must be recorded (or 'None asked')." };
  }

  if (!decision.understandingConfirmed) {
    return { valid: false, error: "Confirmation that the patient or decision maker explained back is required." };
  }

  if (consent.requires_witness && (!decision.witnessName || !decision.witnessName.trim())) {
    return { valid: false, error: "This consent form requires a witness." };
  }

  return { valid: true };
}

/**
 * Bilingual domain error explainer
 */
export function explainConsentsTriageError(code: string, message?: string): { en: string; ur: string } {
  switch (code) {
    case "CONSENT_TEXT_MISSING":
      return {
        en: "The chosen consent form has no registered text in this language. Choose an available language.",
        ur: "منتخب کردہ رضامندی فارم کا اس زبان میں اندراج شدہ متن موجود نہیں ہے۔ دستیاب زبان منتخب کریں۔",
      };
    case "CONSENT_SIGNER_INVALID":
      return {
        en: "The chosen signer or relationship is not permitted under hospital consent policy.",
        ur: "ہسپتال پالیسی کے تحت منتخب کردہ فیصلہ کنندہ یا رشتہ مجاز نہیں ہے۔",
      };
    case "CONSENT_TAKER_NOT_AUTHORIZED":
      return {
        en: "The professional recording the consent must be a registered doctor for clinical procedures.",
        ur: "طبی طریقہ کار کے لیے رضامندی درج کرنے والے کا رجسٹرڈ ڈاکٹر ہونا لازمی ہے۔",
      };
    case "CONSENT_INCOMPLETE":
      return {
        en: "Consent cannot be recorded: required explanation fields are still incomplete.",
        ur: "رضامندی درج نہیں ہو سکتی: مطلوبہ وضاحتی خانے ابھی نامکمل ہیں۔",
      };
    case "VERSION_CONFLICT":
      return {
        en: "This consent was updated in another session. Please reload to see current changes.",
        ur: "یہ رضامندی کسی دوسرے سیشن میں تبدیل ہو چکی ہے۔ براہ کرم تازہ معلومات لوڈ کریں۔",
      };
    default:
      return {
        en: message || "An unexpected error occurred while processing the consent.",
        ur: "رضامندی پر عملدرآمد کے دوران ایک غیر متوقع خرابی پیش آئی۔",
      };
  }
}
