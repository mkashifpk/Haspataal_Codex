// Domain policy and clinical rules for Discharge Summary (Screen 90)
// Follows Haspataal MSDS IMS 147, rule:b6ad13f99c, rule:b730ca524e, rule:a0859fbcc9, rule:6ac70d5b94, rule:73f0bf7236, rule:a8b60a1d88, rule:ca1992cc8d.

import type {
  DischargeSummaryOut,
  DischargeSummaryIn,
  SummaryCorrectionIn,
  DischargeSummarySuggestionOut,
  IcdTermOut,
} from "./generated/discharge_summary";

export type DischargeOutcome = "Home" | "Transferred" | "LAMA" | "Absconded" | "Died";
export type DischargeCondition = "Recovered" | "Improved" | "Unchanged" | "Deteriorated";

export interface UserPermissions {
  permissions: string[];
  roles?: string[];
}

/** Pure local translation helper to avoid Node ESM test import issues */
const t = (en: string, _ur: string) => en;

/**
 * Screen view policy for discharge_summary based on establishment service views.
 * rule:ca1992cc8d: Exists for service inpatient (work).
 */
export function evaluateDischargeSummaryView(
  establishmentOrScreens?: any
): {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canDraft: boolean;
  canSign: boolean;
  canCorrect: boolean;
  canPrint: boolean;
  bannerMessage: string | null;
} {
  let view: "full" | "open_work" | "records" | "setup" | "hidden" = "full";
  const screens = establishmentOrScreens?.views?.screens || establishmentOrScreens?.screens || establishmentOrScreens;
  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "discharge_summary");
    if (item?.view) view = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["discharge_summary"]?.view) view = screens["discharge_summary"].view;
  }

  switch (view) {
    case "full":
      return {
        view: "full",
        canDraft: true,
        canSign: true,
        canCorrect: true,
        canPrint: true,
        bannerMessage: null,
      };
    case "open_work":
      return {
        view: "open_work",
        canDraft: false,
        canSign: true,
        canCorrect: true,
        canPrint: true,
        bannerMessage: t(
          "Service Retiring: No new discharge summaries from now on. Finalizing open summaries and corrections continue.",
          "سروس ریٹائر ہو رہی ہے: اب سے کوئی نئی ڈسچارج سمری شروع نہیں ہو سکتی۔ کھلی سمریز کو حتمی شکل دینا اور تصحیح جاری ہے۔"
        ),
      };
    case "records":
      return {
        view: "records",
        canDraft: false,
        canSign: false,
        canCorrect: true,
        canPrint: true,
        bannerMessage: t(
          "Service Retired: Discharge summaries are in read-only records and corrections mode.",
          "سروس ریٹائرڈ: ڈسچارج سمری صرف ریکارڈ دیکھنے اور تصحیح کے موڈ میں ہے۔"
        ),
      };
    case "setup":
    case "hidden":
    default:
      return {
        view,
        canDraft: false,
        canSign: false,
        canCorrect: false,
        canPrint: false,
        bannerMessage: t(
          "Discharge summary is not available in current facility service configuration.",
          "ڈسچارج سمری موجودہ سہولت کنفیگریشن میں دستیاب نہیں ہے۔"
        ),
      };
  }
}

/**
 * Checks if user holds permission to draft or edit discharge summaries
 */
export function canEditDischargeSummary(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes("ipd.discharge.summary.edit");
}

/**
 * Checks if user holds clinician permission to sign discharge summaries
 */
export function canSignDischargeSummary(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes("ipd.discharge.summary.sign");
}

/**
 * Checks if user holds permission to view and print discharge summaries
 */
export function canViewDischargeSummary(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return (
    user.permissions.includes("ipd.discharge.summary.view") ||
    user.permissions.includes("ipd.discharge.summary.edit")
  );
}

/**
 * Returns required fields for the chosen outcome (rule:b6ad13f99c, rule:a0859fbcc9)
 */
export function getRequiredFieldsForOutcome(outcome: DischargeOutcome | null | undefined): string[] {
  if (!outcome) return ["outcome"];

  const common = ["reason_for_admission", "final_diagnosis"];

  switch (outcome) {
    case "Home":
      return [
        ...common,
        "condition_at_discharge",
        "procedures_and_treatment",
        "discharge_medications",
        "follow_up_instructions",
      ];
    case "Transferred":
      return [
        ...common,
        "condition_at_discharge",
        "receiving_hospital",
        "transfer_reason",
        "transfer_arrangements",
      ];
    case "LAMA":
      return [...common, "condition_at_discharge", "outcome_note"];
    case "Absconded":
      return [...common, "outcome_note"];
    case "Died":
      return [...common];
    default:
      return common;
  }
}

/**
 * Evaluates missing required fields for the draft (rule:b6ad13f99c, rule:6ac70d5b94)
 */
export function evaluateMissingSummaryFields(
  draft: DischargeSummaryIn,
  suggestedOutcome?: DischargeOutcome | null
): {
  missing: string[];
  fieldErrors: Record<string, string>;
  canAttemptSign: boolean;
} {
  const fieldErrors: Record<string, string> = {};
  const missing: string[] = [];

  // Death outcome constraint (rule:a0859fbcc9)
  if (suggestedOutcome === "Died" && draft.outcome !== "Died") {
    fieldErrors.outcome = t(
      "The patient died during this stay: the outcome must be Died.",
      "مریض کا دورانِ داخلہ انتقال ہوا ہے: نتیجہ 'Died' منتخب کرنا لازمی ہے۔"
    );
    missing.push("outcome");
  }

  if (!draft.outcome) {
    fieldErrors.outcome = t("Discharge outcome must be chosen.", "ڈسچارج کا نتیجہ منتخب کریں۔");
    missing.push("outcome");
    return { missing, fieldErrors, canAttemptSign: false };
  }

  const required = getRequiredFieldsForOutcome(draft.outcome);

  for (const field of required) {
    const val = (draft as any)[field];
    if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
      missing.push(field);
      fieldErrors[field] = t("This field is required before signing.", "دستخط کرنے سے پہلے یہ فیلڈ پر کرنا لازمی ہے۔");
    }
  }

  return {
    missing,
    fieldErrors,
    canAttemptSign: missing.length === 0,
  };
}

/**
 * Validates post-signing correction note input (rule:6ac70d5b94)
 */
export function validateSummaryCorrectionInput(input: {
  field?: string | null;
  correction_text?: string | null;
  correction_reason?: string | null;
}): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const allowedFields = [
    "reason_for_admission",
    "final_diagnosis",
    "significant_findings",
    "procedures_and_treatment",
    "response_to_treatment",
    "discharge_medications",
    "follow_up_instructions",
    "transfer",
    "general",
  ];

  if (!input.field || !allowedFields.includes(input.field)) {
    errors.field = t("Please select the clinical section to correct.", "تصحیح کے لیے کلینیکل سیکشن منتخب کریں۔");
  }

  const text = (input.correction_text || "").trim();
  if (!text || text.length < 3) {
    errors.correction_text = t(
      "Correction text must be at least 3 characters.",
      "تصحیحی متن کم از کم 3 حروف پر مشتمل ہونا چاہیے۔"
    );
  }

  const reason = (input.correction_reason || "").trim();
  if (!reason || reason.length < 3) {
    errors.correction_reason = t(
      "Correction reason is required (min 3 characters).",
      "تصحیح کی وجہ درج کرنا لازمی ہے (کم از کم 3 حروف)۔"
    );
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Actionable error guidance for Discharge Summary operations
 */
export function explainDischargeSummaryError(
  errorCode: string,
  details?: Record<string, unknown>
): {
  message: string;
  actionGuidance: string;
} {
  switch (errorCode) {
    case "DISCHARGE_NOT_ALLOWED":
      return {
        message: t("Discharge cannot proceed in the admission's current state.", "داخلے کی موجودہ حالت میں ڈسچارج کا عمل نہیں ہو سکتا۔"),
        actionGuidance: t("Ensure the patient is actively admitted and ready for clinical discharge.", "یقینی بنائیں کہ مریض زیرِ علاج ہے اور کلینیکل ڈسچارج کے لیے تیار ہے۔"),
      };
    case "DISCHARGE_SUMMARY_DEATH_NOT_CERTIFIED":
      return {
        message: t(
          "Record the death on this admission and certify its cause before signing a death summary.",
          "ڈیتھ سمری پر دستخط کرنے سے پہلے داخلے پر موت کا ریکارڈ درج کریں اور وجہ کی تصدیق کریں۔"
        ),
        actionGuidance: t(
          "Complete the Death Certificate first under Death Registration workflow.",
          "پہلے ڈیتھ رجسٹریشن ورک فلو میں جا کر ڈیتھ سرٹیفکیٹ مکمل کریں۔"
        ),
      };
    case "DISCHARGE_SUMMARY_FINAL":
      return {
        message: t("A signed discharge summary cannot change; append a correction.", "دستخط شدہ ڈسچارج سمری میں براہِ راست تبدیلی نہیں ہو سکتی؛ تصحیح شامل کریں۔"),
        actionGuidance: t(
          "Use the 'Add Correction' action to append an official audited addendum.",
          "آڈٹ شدہ تصحیح شامل کرنے کے لیے 'تصحیح شامل کریں' کا استعمال کریں۔"
        ),
      };
    case "DISCHARGE_SUMMARY_INCOMPLETE": {
      const missingList = Array.isArray(details?.missing) ? (details?.missing as string[]).join(", ") : "";
      return {
        message: t("The discharge summary is missing required parts.", "ڈسچارج سمری میں لازمی معلومات نامکمل ہیں۔"),
        actionGuidance: missingList
          ? t(`Please populate required fields: ${missingList}`, `براہ کرم لازمی فیلڈز مکمل کریں: ${missingList}`)
          : t("Please review required fields marked in red.", "براہ کرم سرخ نشان زدہ لازمی فیلڈز مکمل کریں۔"),
      };
    }
    case "DISCHARGE_SUMMARY_NOT_FINAL":
      return {
        message: t("The discharge summary is not signed yet.", "ڈسچارج سمری پر ابھی دستخط نہیں ہوئے ہیں۔"),
        actionGuidance: t("Sign the discharge summary before printing the final official document.", "حتمی سرکاری دستاویز پرنٹ کرنے سے پہلے ڈسچارج سمری پر دستخط کریں۔"),
      };
    case "DISCHARGE_SUMMARY_PATIENT_DIED":
      return {
        message: t("The patient died during this stay: the outcome is Died.", "مریض کا اس داخلے کے دوران انتقال ہوا ہے: نتیجہ لازماً Died ہونا چاہیے۔"),
        actionGuidance: t("Switch outcome to 'Died' to complete the summary.", "سمری مکمل کرنے کے لیے نتیجہ 'Died' پر تبدیل کریں۔"),
      };
    case "DISCHARGE_SUMMARY_SIGNER_NOT_CLINICAL":
      return {
        message: t("Only an authorized clinician can sign a discharge summary.", "صرف مجاز معالج ڈسچارج سمری پر دستخط کر سکتا ہے۔"),
        actionGuidance: t("A medical officer or consultant with PMDC licence must log in to sign.", "دستخط کے لیے پی ایم ڈی سی لائسنس یافتہ ڈاکٹر کا لاگ ان ہونا ضروری ہے۔"),
      };
    case "ICD_CODE_UNKNOWN": {
      const unknown = (details?.unknown as string) || "";
      return {
        message: t("A code is not in the active ICD code list.", "کوئی تشخیص کوڈ فعال آئی سی ڈی کوڈ لسٹ میں موجود نہیں ہے۔"),
        actionGuidance: t(
          `Please select valid ICD codes using the diagnosis search picker (${unknown}).`,
          `براہ کرم ڈائیگنوسس سرچ پکر کے ذریعے درست کوڈ منتخب کریں (${unknown})۔`
        ),
      };
    }
    case "VERSION_CONFLICT":
      return {
        message: t("The record was changed by someone else; reload and try again.", "یہ ریکارڈ کسی دوسرے صارف یا ٹرمینل نے تبدیل کر دیا ہے؛ دوبارہ لوڈ کریں۔"),
        actionGuidance: t("Reloading latest discharge summary draft to reconcile edits.", "تازہ ترین ڈسچارج سمری ڈرافٹ دوبارہ لوڈ کیا جا رہا ہے۔"),
      };
    case "VALIDATION_ERROR":
      return {
        message: t("The request is invalid.", "درخواست میں معلومات نامکمل یا غلط ہیں۔"),
        actionGuidance: t("Please review highlighted form inputs and constraints.", "براہ کرم فارم کے اندراجات اور شرائط کا جائزہ لیں۔"),
      };
    default:
      return {
        message: errorCode,
        actionGuidance: t("An unexpected error occurred. Please verify your connection and retry.", "ایک غیر متوقع غلطی ہوئی۔ رابطہ چیک کر کے دوبارہ کوشش کریں۔"),
      };
  }
}
