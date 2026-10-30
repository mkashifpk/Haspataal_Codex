import type {
  BloodRequestIn,
  BloodRequestDetailOut,
  ConsentBriefOut,
} from "./generated/blood_request";

export type BloodComponent =
  | "WholeBlood"
  | "RedCells"
  | "FreshFrozenPlasma"
  | "Cryoprecipitate"
  | "Platelets";

export type BloodUrgency = "Routine" | "Urgent" | "Emergency";

export const BLOOD_COMPONENTS: { value: BloodComponent; en: string; ur: string }[] = [
  { value: "RedCells", en: "Packed Red Blood Cells (PRBC)", ur: "سرخ خلیات (پی آر بی سی)" },
  { value: "WholeBlood", en: "Whole Blood", ur: "مکمل خون" },
  { value: "FreshFrozenPlasma", en: "Fresh Frozen Plasma (FFP)", ur: "تازہ منجمد پلازما" },
  { value: "Platelets", en: "Platelet Concentrate", ur: "پلیٹلیٹس" },
  { value: "Cryoprecipitate", en: "Cryoprecipitate", ur: "کرائیو پریسیپیٹیٹ" },
];

export const BLOOD_URGENCIES: { value: BloodUrgency; en: string; ur: string }[] = [
  { value: "Routine", en: "Routine (Elective / Next Day)", ur: "معمول (روٹین)" },
  { value: "Urgent", en: "Urgent (Within 2-4 Hours)", ur: "فوری (ارجنٹ)" },
  { value: "Emergency", en: "Emergency (Immediate / Uncrossmatched)", ur: "ہنگامی (ایمرجنسی)" },
];

export function bloodRequestAccess(
  view: string | undefined,
  permissions: string[],
  isServiceActive: boolean,
) {
  const isViewAllowed = ["full", "open_work", "records", "setup"].includes(view || "");
  const canRead = permissions.includes("blood.view") || permissions.includes("blood.request");
  const canRequest = permissions.includes("blood.request");
  const canClose = permissions.includes("blood.request") || permissions.includes("blood.bank.operate");

  return {
    read: isViewAllowed && canRead,
    write: isViewAllowed && view !== "records" && view !== "open_work" && canRequest && isServiceActive,
    close: isViewAllowed && view !== "records" && canClose,
    cancel: isViewAllowed && view !== "records" && canRequest,
    isRetiring: view === "open_work",
    isRecords: view === "records",
    isSetup: view === "setup",
  };
}

export function validateBloodRequestIn(data: {
  patient_id?: number | null;
  admission_id?: number | null;
  er_visit_id?: number | null;
  component: string;
  units_requested: number;
  urgency: string;
  indication: string;
  consent_id?: number | null;
  uncrossmatched_note?: string | null;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.admission_id && !data.er_visit_id) {
    errors.stay = "Select an active admission or emergency visit for the patient.";
  }

  if (!["WholeBlood", "RedCells", "FreshFrozenPlasma", "Cryoprecipitate", "Platelets"].includes(data.component)) {
    errors.component = "Select a valid blood component.";
  }

  if (
    typeof data.units_requested !== "number" ||
    isNaN(data.units_requested) ||
    data.units_requested < 1 ||
    data.units_requested > 20 ||
    !Number.isInteger(data.units_requested)
  ) {
    errors.units_requested = "Units requested must be a whole number between 1 and 20.";
  }

  if (!["Routine", "Urgent", "Emergency"].includes(data.urgency)) {
    errors.urgency = "Select request urgency.";
  }

  if (!data.indication || !data.indication.trim()) {
    errors.indication = "Clinical indication is required.";
  } else if (data.indication.trim().length > 500) {
    errors.indication = "Clinical indication must not exceed 500 characters.";
  }

  if (!data.consent_id) {
    errors.consent_id = "A Given transfusion consent of this stay is required.";
  }

  if (data.urgency === "Emergency") {
    // Uncrossmatched note is permitted and recommended for emergency requests
    if (data.uncrossmatched_note && data.uncrossmatched_note.trim().length > 1000) {
      errors.uncrossmatched_note = "Uncrossmatched blood authorization note must not exceed 1000 characters.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canCancelBloodRequest(req: BloodRequestDetailOut): {
  allowed: boolean;
  reason?: string;
} {
  if (req.status !== "Open") {
    return {
      allowed: false,
      reason: "Only Open requests can be cancelled.",
    };
  }

  if (req.units_issued > 0) {
    return {
      allowed: false,
      reason: "Units have already been issued. Close the request instead of cancelling.",
    };
  }

  const hasTransfusions = req.transfusions && req.transfusions.length > 0;
  if (hasTransfusions) {
    return {
      allowed: false,
      reason: "Blood was already given. Close the request instead of cancelling.",
    };
  }

  return { allowed: true };
}

export function canCloseBloodRequest(req: BloodRequestDetailOut): {
  allowed: boolean;
  reason?: string;
} {
  if (req.status !== "Open") {
    return {
      allowed: false,
      reason: "Request is already closed or cancelled.",
    };
  }
  return { allowed: true };
}
