/**
 * Domain policy and statutory business rules for Screen 137: drug_recalls
 * ("Drug recall campaigns & quarantine management", Position 137, 63 points, Workspace `pharmacy_admin`).
 * 
 * Statutory & Quality Rules:
 * - rule:fe2af7a43c: Open: the medicine, the batches (from GET /drugs/{drug_id}/stock-status, or all_batches),
 *                    the source and reference (the DRAP alert), the class, the reason, contact_patients.
 *                    The batches are blocked at once everywhere; the wards and the pharmacy are alerted.
 * - rule:6e16f97bd1: Detail: per batch what is left in the pharmacy and on each ward and what was dispensed,
 *                    given and used in theatre; the people who received it with their phone numbers.
 *                    'Remove stock' writes off every unit left (the note: returned to the supplier or destroyed).
 *                    Record each contact (Contacted, Unreachable, NotNeeded with a note).
 * - rule:2b020bd53b: Close when can_close (RECALL_NOT_COMPLETE shows what is left). Opened by mistake: Cancel
 *                    (the batches are released).
 * - rule:0bdb1f574d: Exists for the service dispensing (work): show it as GET /establishment views.screens says
 *                    for screen_id drug_recalls (full; open_work: without its new work, with the banner
 *                    "No new ... from now on"; records: history and corrections only; setup: only from Facility settings;
 *                    hidden: in no menu), after login and again on establishment.changed. Never decide it from the
 *                    profile's category.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  RecallIn,
  RecallDetailOut,
  RecallNoteIn,
  RecallContactIn,
  MedicationReasonIn,
} from "./generated/drug_recalls";

export type DrugRecallsCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const RECALL_SOURCES = ["DRAP", "Manufacturer", "Supplier", "Internal"] as const;
export type RecallSource = typeof RECALL_SOURCES[number];

export const RECALL_SOURCE_LABELS: Record<RecallSource, { en: string; ur: string }> = {
  DRAP: { en: "DRAP (Drug Regulatory Authority of Pakistan)", ur: "ڈرگ ریگولیٹری اتھارٹی آف پاکستان (DRAP)" },
  Manufacturer: { en: "Manufacturer Direct Alert", ur: "دوا ساز کمپنی کی جانب سے براہ راست اطلاع" },
  Supplier: { en: "Supplier / Distributor Recall", ur: "سپلائر / ڈسٹری بیوٹر کی جانب سے واپسی" },
  Internal: { en: "Internal Hospital Inspection / Safety Committee", ur: "ہسپتال کا اندرونی حفاظتی معائنہ" },
};

export const RECALL_CLASSES = ["ClassI", "ClassII", "ClassIII"] as const;
export type RecallClass = typeof RECALL_CLASSES[number];

export const RECALL_CLASS_LABELS: Record<RecallClass, { en: string; ur: string; severity: "critical" | "warning" | "info" }> = {
  ClassI: {
    en: "Class I (Serious adverse health consequences or death; notify & contact all patients)",
    ur: "کلاس اول (شدید خطرہ، جان کا زیاں ممکن؛ ہر مریض سے رابطہ لازمی ہے)",
    severity: "critical",
  },
  ClassII: {
    en: "Class II (Temporary or medically reversible adverse health consequences)",
    ur: "کلاس دوم (عارضی یا قابل علاج طبی مضر اثرات)",
    severity: "warning",
  },
  ClassIII: {
    en: "Class III (Unlikely to cause adverse health consequences; technical defect)",
    ur: "کلاس سوم (مضر صحت اثرات کا امکان کم؛ تکنیکی یا پیکنگ خرابی)",
    severity: "info",
  },
};

export const RECALL_STATUSES = ["Open", "Closed", "Cancelled"] as const;
export type RecallStatus = typeof RECALL_STATUSES[number];

export const RECALL_STATUS_LABELS: Record<RecallStatus, { en: string; ur: string }> = {
  Open: { en: "Open (Batches quarantined & blocked)", ur: "کھلی مہم (اسٹاک قرنطینہ و بلاک شدہ)" },
  Closed: { en: "Closed (Stock removed & contacts finalized)", ur: "بند (اسٹاک تلف/واپس، مہم مکمل)" },
  Cancelled: { en: "Cancelled (Mistake - batches released)", ur: "منسوخ شدہ (غلطی سے کھولی گئی - بیجز بحال)" },
};

export const PATIENT_CONTACT_OUTCOMES = ["ToContact", "Contacted", "Unreachable", "NotNeeded"] as const;
export type PatientContactOutcome = typeof PATIENT_CONTACT_OUTCOMES[number];

export const PATIENT_CONTACT_OUTCOME_LABELS: Record<PatientContactOutcome, { en: string; ur: string }> = {
  ToContact: { en: "To Contact", ur: "رابطہ باقی ہے" },
  Contacted: { en: "Contacted (Patient / guardian informed)", ur: "رابطہ مکمل (مریض کو آگاہ کر دیا گیا)" },
  Unreachable: { en: "Unreachable (Phone switched off / invalid)", ur: "رابطہ نہ ہو سکا (نمبر بند یا غلط ہے)" },
  NotNeeded: { en: "Not Needed (Clinical review determined not required)", ur: "رابطے کی ضرورت نہیں" },
};

export const DRUG_RECALL_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  BATCH_RECALLED: {
    en: "This batch is recalled: it cannot be dispensed, sent to a ward, used in theatre or given.",
    ur: "یہ بیج واپس بلایا جا چکا ہے: اسے جاری، وارڈ کو منتقل، آپریشن تھیٹر میں استعمال یا مریض کو نہیں دیا جا سکتا۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this.",
    ur: "آپ کے پاس یہ اقدام کرنے کا مجاز اختیار نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ur: "مطلوبہ ریکارڈ نہیں ملا۔",
  },
  RECALL_NOT_COMPLETE: {
    en: "The recall cannot close yet: stock of the batches is left, or patients are still to be contacted.",
    ur: "دوا کی واپسی ابھی بند نہیں ہو سکتی: بیجز کا بقایا اسٹاک موجود ہے، یا مریضوں سے رابطہ باقی ہے۔",
  },
  RECALL_STATE_INVALID: {
    en: "The recall cannot change that way.",
    ur: "دوا کی واپسی کی مہم کی کیفیت اس طرح تبدیل نہیں ہو سکتی۔",
  },
  REFERENCE_NOT_FOUND: {
    en: "A referenced record does not exist.",
    ur: "حوالہ دیا گیا ریکارڈ سسٹم میں موجود نہیں ہے۔",
  },
  STOCK_BATCH_MISMATCH: {
    en: "The batch does not belong to this item.",
    ur: "منتخب کردہ بیج اس دوا سے مطابقت نہیں رکھتا۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid. Please check the entered fields.",
    ur: "درخواست غلط ہے۔ برائے مہربانی درج کردہ خانے چیک کریں۔",
  },
};

/**
 * Resolves capability view for drug_recalls from establishment configuration.
 * Under Rule rule:0bdb1f574d, runtime view is derived from GET /establishment views.screens.
 */
export function getDrugRecallsCapabilityView(
  establishment?: EstablishmentOut | null
): DrugRecallsCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "drug_recalls");
    if (
      screenEntry?.view === "full" ||
      screenEntry?.view === "open_work" ||
      screenEntry?.view === "records" ||
      screenEntry?.view === "setup" ||
      screenEntry?.view === "hidden"
    ) {
      return screenEntry.view;
    }
  } else if (screens && typeof screens === "object") {
    const entry = (screens as Record<string, any>)?.["drug_recalls"];
    const configured = typeof entry === "string" ? entry : entry?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured;
    }
  }
  return "full";
}

/**
 * Validates opening a recall campaign under Rule rule:fe2af7a43c.
 * Requires drug selection, either all_batches or explicit batch_ids, valid source,
 * recall_class, non-empty reason, and contact_patients flag.
 */
export function validateOpenRecallInput(input: Partial<RecallIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.drug_id || input.drug_id <= 0) {
    errors.drug_id = "A valid formulary medicine must be selected.";
  }

  if (!input.all_batches && (!input.batch_ids || input.batch_ids.length === 0)) {
    errors.batch_ids = "Please select specific batches to recall or check 'Recall all batches'.";
  }

  if (!input.source || !RECALL_SOURCES.includes(input.source as RecallSource)) {
    errors.source = "A valid recall alert source is required.";
  }

  if (!input.recall_class || !RECALL_CLASSES.includes(input.recall_class as RecallClass)) {
    errors.recall_class = "A statutory recall class (Class I, II, or III) is required.";
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = "A detailed recall reason / statutory defect note (at least 5 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates stock removal / write-off under Rule rule:6e16f97bd1.
 * Requires a note explaining whether remaining stock was returned to supplier or destroyed.
 */
export function validateRemoveStockInput(input: Partial<RecallNoteIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.note || input.note.trim().length < 5) {
    errors.note = "Please record an explanatory note on whether quarantined stock was returned to supplier or destroyed.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates recording a patient contact under Rule rule:6e16f97bd1.
 */
export function validateRecordContactInput(input: Partial<RecallContactIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.outcome || !["Contacted", "Unreachable", "NotNeeded"].includes(input.outcome)) {
    errors.outcome = "Please choose a contact outcome: Contacted, Unreachable, or Not Needed.";
  }

  if (!input.note || input.note.trim().length < 3) {
    errors.note = "Please record who was reached and what clinical advice was given, or why contact failed/not needed.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates closing a recall under Rule rule:2b020bd53b.
 * Prevents closing if stock is still left or patients are still to be contacted.
 */
export function validateCloseRecallInput(
  recall: RecallDetailOut,
  input: Partial<RecallNoteIn>
): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!recall.can_close) {
    if (recall.stock_left > 0) {
      errors.stock_left = `Cannot close: ${recall.stock_left} units of recalled batches are still in pharmacy/ward stock. Please 'Remove stock' first.`;
    }
    if (recall.patients_to_contact > 0) {
      errors.patients_to_contact = `Cannot close: ${recall.patients_to_contact} patients have not yet been contacted or finalized.`;
    }
  }

  if (!input.note || input.note.trim().length < 5) {
    errors.note = "A closing audit summary note (minimum 5 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates cancelling an open recall under Rule rule:2b020bd53b.
 */
export function validateCancelRecallInput(
  recall: RecallDetailOut,
  input: Partial<MedicationReasonIn>
): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (recall.status !== "Open") {
    errors.status = `Only an Open recall can be cancelled. Current status is ${recall.status}.`;
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = "A cancellation reason explaining why the recall was opened by mistake (minimum 5 characters) is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
