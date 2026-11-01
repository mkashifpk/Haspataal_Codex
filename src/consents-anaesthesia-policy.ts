import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ConsentIn,
  ConsentOut,
  ConsentSignIn,
  ConsentRefuseIn,
  WhoDecidesOut,
  DecisionMakerChoiceOut,
} from "./generated/consents_anaesthesia";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for consents_anaesthesia according to Rule a52becc623.
 * Uses GET /establishment views.screens.consents_anaesthesia. Never decides from facility category.
 */
export function getConsentsAnaesthesiaScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "consents_anaesthesia");
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
 * Role permissions for managing and signing anaesthesia consents.
 */
export function canManageConsents(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("consent.record") ||
    user.permissions.includes("consent.configure") ||
    user.permissions.includes("consent.view") ||
    user.permissions.includes("ot.clinical.anaesthesia") ||
    user.permissions.includes("doctor.view")
  );
}

/**
 * Role check for taking anaesthesia consent (Rule f811c03843).
 * Anaesthesia consent requires an anaesthetist or doctor of the anaesthesia team.
 */
export function isAuthorizedConsentTaker(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  return (
    roles.includes("anaesthetist") ||
    roles.includes("doctor") ||
    roles.includes("clinical_specialist") ||
    permissions.includes("ot.clinical.anaesthesia")
  );
}

/**
 * Validates consent preparation input (Rule d84307d9b2).
 */
export function validateConsentDraft(input: ConsentIn): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.form_code || input.form_code.trim().length === 0) {
    errors.push("Consent form code is required.");
  }

  if (!input.language) {
    errors.push("Consent language selection is required.");
  }

  if (input.form_code === "ANAESTHESIA" || input.form_code === "OPERATION") {
    if (!input.procedure_name || input.procedure_name.trim().length === 0) {
      errors.push("Surgical procedure name is required for procedural consents.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates consent signature decision according to Rule b7bacc1ffb & Rule cb2f327ee7.
 * Uses the server's who_decides payload rather than hardcoding client age logic.
 */
export function validateConsentSign(
  input: ConsentSignIn,
  whoDecides?: WhoDecidesOut | null
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.mode === "EmergencyNote") {
    if (!input.emergency_note || input.emergency_note.trim().length < 5) {
      errors.push("Emergency note explaining why treatment cannot wait is required.");
    }
    if (whoDecides?.emergency_second_doctor && !input.second_doctor_id) {
      errors.push("Concurring second PMDC-registered doctor is required for emergency consent.");
    }
    return { valid: errors.length === 0, errors };
  }

  // Mode is standard Signed
  if (whoDecides) {
    if (!whoDecides.patient_may_sign && input.signer === "Patient") {
      errors.push(
        `Patient is under legal consent age (${whoDecides.adult_age} years). A recognized decision maker must sign.`
      );
    }

    if (input.signer === "DecisionMaker") {
      if (!input.signer_relationship) {
        errors.push("Decision maker legal relationship is required.");
      } else {
        const allowedRelationships = whoDecides.decision_makers.map((dm) => dm.relationship);
        if (!allowedRelationships.includes(input.signer_relationship)) {
          errors.push(
            `Relationship "${input.signer_relationship}" is not permitted to sign for this patient.`
          );
        }
      }

      if (!input.signer_name || input.signer_name.trim().length === 0) {
        errors.push("Decision maker full legal name is required.");
      }

      if (!input.incapacity_reason) {
        errors.push("Reason for patient incapacity must be documented.");
      }
    }
  }

  if (input.signer_mark === "ThumbImpression" && (!input.witness_name || input.witness_name.trim().length === 0)) {
    errors.push("Witness name is strictly required when consent is confirmed by thumb impression.");
  }

  if (!input.questions_answers || input.questions_answers.trim().length === 0) {
    errors.push("Questions asked and answers given must be recorded ('None asked' if none).");
  }

  if (!input.understanding_confirmed) {
    errors.push("Confirmation that the patient or guardian explained the procedure back is required.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates refusal of consent (Rule b7bacc1ffb).
 */
export function validateConsentRefuse(input: ConsentRefuseIn): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.refusal_reason || input.refusal_reason.trim().length < 3) {
    errors.push("Refusal reason in patient's or guardian's own words is required.");
  }

  if (input.mode === "VerbalRefusal" && (!input.witness_name || input.witness_name.trim().length === 0)) {
    errors.push("Witness name is required for verbal refusal of consent.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Bilingual explanations for Consents Anaesthesia errors.
 */
export function explainConsentError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    CONSENT_TAKER_NOT_AUTHORIZED: {
      en: "Unauthorized consent taker: Anaesthesia consent must be explained and taken by a doctor of the anaesthesia team.",
      ur: "غیر مجاز معالج: اینستھیزیا کی رضامندی اینستھیزیا ٹیم کے مستند ڈاکٹر کے ذریعے ہی لی جا سکتی ہے۔",
    },
    CONSENT_SIGNER_INVALID: {
      en: details?.message || "Signer is invalid according to hospital consent policy and patient age.",
      ur: "ہسپتال کی پالیسی کے تحت منتخب کردہ فرد رضامندی کے دستخط کا مجاز نہیں ہے۔",
    },
    CONSENT_TEXT_MISSING: {
      en: details?.available
        ? `This consent form is not available in the selected language. Available languages: ${details.available.join(", ")}.`
        : "Selected language text is not available for this consent form.",
      ur: "اس رضامندی فارم کا متن منتخب کردہ زبان میں دستیاب نہیں ہے۔",
    },
    CONSENT_INCOMPLETE: {
      en: details?.missing
        ? `Consent information is incomplete. Missing fields: ${details.missing.join(", ")}.`
        : "Consent information is incomplete. Please fill all required clinical fields.",
      ur: "رضامندی فارم نامکمل ہے۔ برائے مہربانی تمام لازمی خانے پر کریں۔",
    },
    CONSENT_DECIDED_FINAL: {
      en: "This consent has already been signed or refused and is final. To change the decision, withdraw this consent and create a new one.",
      ur: "یہ رضامندی حتمی ہو چکی ہے۔ تبدیلی کے لیے اسے منسوخ کر کے نئی رضامندی حاصل کریں۔",
    },
    CAPABILITY_INACTIVE: {
      en: "Surgery service is inactive. Consents cannot be recorded.",
      ur: "سرجری سروس غیر فعال ہے۔ رضامندی محفوظ نہیں کی جا سکتی۔",
    },
    FORBIDDEN: {
      en: "You do not have permission to perform this consent operation.",
      ur: "آپ کے پاس اس کارروائی کی اجازت نہیں ہے۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ دوبارہ کوشش کریں۔`,
    }
  );
}
