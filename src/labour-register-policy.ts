/**
 * Domain policy and business rules for Labour Register
 * (`labour_register`, Screen 85).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards & HISDU:
 * - Owner decision M1 (decisions 47); Punjab HMIS delivery and newborn forms.
 * - Dynamic register form from GET /maternity/labour-register/columns (rule:1146a499b0).
 * - Sections: Admission, Delivery, Mother, Discharge once per delivery; Baby once per baby (rule:1146a499b0).
 * - Live newborn registration required before naming in babies; stillbirth has no record (rule:632b575029).
 * - Draft saves via PATCH with expected_version; signing freezes record (rule:fe685a82bd).
 * - LABOUR_ENTRY_INCOMPLETE details.missing highlights incomplete required fields (rule:fe685a82bd).
 * - Union Council birth notification print for each liveborn baby (rule:b4fd64b49f).
 * - Service capability gating and screen views (rule:119a276f5a, rule:e108ec7978, rule:e261e1b4d0).
 */

import type {
  LabourFieldOut,
  LabourEntryIn,
  LabourEntryPatch,
  LabourBabyIn,
  LabourEntryOut,
  LabourBabyOut,
  AuthorStampOut,
} from "./generated/labour_register";
import type { EstablishmentOut } from "./generated/facility_profile";

export type ScreenView = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ScreenViewItem {
  screen_id: string;
  view: ScreenView;
}

export interface EstablishmentContext {
  active?: string[];
  views?: {
    screens?: ScreenViewItem[] | Record<string, ScreenView>;
  };
}

/**
 * Determines screen view mode for `labour_register` (rule:119a276f5a).
 */
export function getLabourRegisterScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "labour_register");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "labour_register" in screens) {
    return (screens as Record<string, ScreenView>)["labour_register"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the hospital's maternity capability is currently Active (rule:e108ec7978).
 */
export function isMaternityActive(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  return Array.isArray(establishment?.active) && establishment.active.includes("maternity");
}

export type DeliverySection = "Admission" | "Delivery" | "Mother" | "Baby" | "Discharge";

export const DELIVERY_SECTIONS: DeliverySection[] = [
  "Admission",
  "Delivery",
  "Mother",
  "Baby",
  "Discharge",
];

export const SECTION_TITLES: Record<DeliverySection, { en: string; ur: string }> = {
  Admission: { en: "Admission & Baseline", ur: "داخلہ اور بنیادی علامات" },
  Delivery: { en: "Delivery & Labour Progress", ur: "پیدائش اور درد زہ کی پیشرفت" },
  Mother: { en: "Mother Post-Delivery", ur: "پیدائش کے بعد ماں کی حالت" },
  Baby: { en: "Baby Particulars", ur: "نوزائیدہ کی تفصیلات" },
  Discharge: { en: "Discharge & Follow-Up", ur: "ڈسچارج اور فالو اپ" },
};

/**
 * Groups active register columns by their assigned section, sorted by sort_order (rule:1146a499b0).
 */
export function groupColumnsBySection(
  columns: LabourFieldOut[]
): Record<DeliverySection, LabourFieldOut[]> {
  const grouped: Record<DeliverySection, LabourFieldOut[]> = {
    Admission: [],
    Delivery: [],
    Mother: [],
    Baby: [],
    Discharge: [],
  };

  const sorted = [...columns].filter((c) => c.is_active !== false).sort((a, b) => a.sort_order - b.sort_order);

  for (const col of sorted) {
    if (col.section in grouped) {
      grouped[col.section].push(col);
    }
  }

  return grouped;
}

/**
 * Evaluates whether a column is required given the current field values (rule:1146a499b0).
 * A column is required if `col.required` is true, or if `col.when_code` matches `col.when_value`.
 */
export function isColumnRequired(
  col: LabourFieldOut,
  fieldValues?: Record<string, any> | null
): boolean {
  if (col.required) {
    return true;
  }
  if (col.when_code && col.when_value && fieldValues) {
    const parentVal = fieldValues[col.when_code];
    if (parentVal !== undefined && parentVal !== null) {
      return String(parentVal).trim().toLowerCase() === String(col.when_value).trim().toLowerCase();
    }
  }
  return false;
}

/**
 * Validates a single column value according to its declared kind and boundaries.
 */
export function validateColumnValue(
  col: LabourFieldOut,
  val: any,
  isRequired: boolean
): string | null {
  const isEmpty =
    val === undefined ||
    val === null ||
    val === "" ||
    (Array.isArray(val) && val.length === 0);

  if (isEmpty) {
    if (isRequired) {
      return `"${col.label}" is required.`;
    }
    return null;
  }

  switch (col.kind) {
    case "Number": {
      const num = Number(val);
      if (isNaN(num)) {
        return `"${col.label}" must be a valid number.`;
      }
      if (col.min_value !== null && num < col.min_value) {
        return `"${col.label}" cannot be less than ${col.min_value} ${col.unit || ""}.`.trim();
      }
      if (col.max_value !== null && num > col.max_value) {
        return `"${col.label}" cannot exceed ${col.max_value} ${col.unit || ""}.`.trim();
      }
      break;
    }
    case "YesNo": {
      if (val !== "Yes" && val !== "No") {
        return `"${col.label}" must be either "Yes" or "No".`;
      }
      break;
    }
    case "Choice": {
      if (col.choices && col.choices.length > 0 && !col.choices.includes(String(val))) {
        return `"${col.label}" must be one of the declared options.`;
      }
      break;
    }
    case "MultiChoice": {
      if (!Array.isArray(val)) {
        return `"${col.label}" must be a list of selected options.`;
      }
      break;
    }
    case "Date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val))) {
        return `"${col.label}" must be in YYYY-MM-DD format.`;
      }
      break;
    }
    case "Text": {
      // Free text is allowed
      break;
    }
  }

  return null;
}

export interface MissingColumnReport {
  section: DeliverySection;
  code: string;
  label: string;
  baby_no?: number;
}

/**
 * Finds all missing required columns across delivery sections and baby sections (rule:fe685a82bd).
 */
export function evaluateMissingRequiredColumns(
  columns: LabourFieldOut[],
  deliveryValues: Record<string, any>,
  babies: LabourBabyIn[]
): MissingColumnReport[] {
  const missing: MissingColumnReport[] = [];
  const grouped = groupColumnsBySection(columns);

  // Check Admission, Delivery, Mother, Discharge sections
  const deliverySections: DeliverySection[] = ["Admission", "Delivery", "Mother", "Discharge"];
  for (const sec of deliverySections) {
    for (const col of grouped[sec]) {
      if (isColumnRequired(col, deliveryValues)) {
        const val = deliveryValues[col.code];
        const err = validateColumnValue(col, val, true);
        if (err) {
          missing.push({ section: sec, code: col.code, label: col.label });
        }
      }
    }
  }

  // Check each baby
  for (const baby of babies) {
    const bValues = baby.field_values || {};
    for (const col of grouped.Baby) {
      if (isColumnRequired(col, bValues)) {
        const val = bValues[col.code];
        const err = validateColumnValue(col, val, true);
        if (err) {
          missing.push({
            section: "Baby",
            code: col.code,
            label: col.label,
            baby_no: baby.baby_no,
          });
        }
      }
    }
  }

  return missing;
}

/**
 * Validates delivery registration input before creation (rule:632b575029).
 */
export function validateLabourEntryIn(entry: LabourEntryIn): string[] {
  const errors: string[] = [];

  if (!entry.admission_id || entry.admission_id <= 0) {
    errors.push("Mother's admission context is required.");
  }

  if (!entry.delivered_at) {
    errors.push("Date and time of delivery is required.");
  } else {
    const dt = new Date(entry.delivered_at);
    if (isNaN(dt.getTime())) {
      errors.push("Delivery date and time is invalid.");
    } else if (dt > new Date(Date.now() + 60000)) {
      errors.push("Delivery date and time cannot be in the future.");
    }
  }

  if (!entry.attended_by || entry.attended_by <= 0) {
    errors.push("Attending staff member must be selected.");
  }

  if (!entry.babies || entry.babies.length === 0) {
    errors.push("At least one baby must be recorded for the delivery.");
  }

  return errors;
}

/**
 * Formats an author stamp for display (MSDS IMS 147).
 */
export function formatAuthorStamp(stamp: AuthorStampOut | null | undefined): string {
  if (!stamp) return "";
  if (stamp.text) return stamp.text;
  const parts: string[] = [];
  if (stamp.name) parts.push(stamp.name);
  if (stamp.designation) parts.push(stamp.designation);
  if (stamp.registration) parts.push(stamp.registration);
  if (stamp.at) parts.push(new Date(stamp.at).toLocaleString());
  return parts.join(" • ");
}

/**
 * Translates domain error codes into user-actionable messages.
 */
export function explainLabourRegisterError(
  err: any,
  columns?: LabourFieldOut[]
): { title: string; detail: string; missingFields?: string[] } {
  const code = err?.response?.data?.code || err?.code || "";
  const details = err?.response?.data?.details || err?.details || {};
  const message = err?.response?.data?.message || err?.message || "";

  switch (code) {
    case "LABOUR_ENTRY_INCOMPLETE": {
      const missingList: string[] = Array.isArray(details.missing)
        ? details.missing
        : [];
      const labels = missingList.map((m) => {
        const found = columns?.find((c) => c.code === m);
        return found ? found.label : m;
      });
      return {
        title: "Labour Register Incomplete (422)",
        detail:
          labels.length > 0
            ? `Please fill all required columns before signing: ${labels.join(", ")}.`
            : "Please fill all required columns before signing the register entry.",
        missingFields: missingList,
      };
    }
    case "LABOUR_ENTRY_SIGNED":
      return {
        title: "Entry Frozen & Signed (409)",
        detail:
          "This entry of the labour register has been signed and permanently frozen. It can no longer be modified.",
      };
    case "VERSION_CONFLICT":
      return {
        title: "Concurrent Modification (409)",
        detail:
          "This labour entry was updated by another terminal. Please reload to review the latest changes before reapplying.",
      };
    case "CAPABILITY_INACTIVE":
      return {
        title: "Maternity Capability Inactive (409)",
        detail:
          "Maternity services are currently inactive in hospital settings. New deliveries cannot be registered.",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        title: "Referenced Record Missing (422)",
        detail:
          details.field === "newborn_patient_id"
            ? "A live baby must first be registered via Newborn Registration before recording in the register."
            : message || "A referenced clinical record (admission, employee, or newborn) was not found.",
      };
    case "VALIDATION_ERROR":
      return {
        title: "Validation Error (422)",
        detail: message || "Please check the entered delivery fields and try again.",
      };
    default:
      return {
        title: "Request Error",
        detail: message || "An unexpected error occurred while saving the labour register entry.",
      };
  }
}
