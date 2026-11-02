/**
 * Domain policy and statutory business rules for Screen 139: lab_admin
 * ("Lab administration: Test catalogue, prices, reagents, BOM, profit & contractor share", Position 139, 76 points, Workspace `lab_admin`).
 *
 * Statutory & Quality Rules:
 * - rule:26ecdbf976: A metric schema editor builds metric_schema (key, label, unit, ref ranges,
 *                    critical: low/high for a number, values for a text metric such as Positive).
 * - rule:c8be844050: Per test (MSDS AAC 1, 4-6): turnaround_minutes (routine) and emergency_turnaround_minutes
 *                    (Urgent, STAT; empty: the hospital defaults), availability InHouse or SendOut with
 *                    send_out_partner_id (GET /diagnostic-partners?services=Lab), available_24h for the
 *                    basic tests, notifiable_disease for a test whose positive result is a priority disease.
 * - rule:0f8b607b2c: Exists for the service laboratory or outsourced_diagnostics (setup): show it as
 *                    GET /establishment views.screens says for screen_id lab_admin (full; open_work: without
 *                    its new work, with the banner "No new ... from now on"; records: history and corrections
 *                    only; setup: only from Facility settings; hidden: in no menu), after login and again
 *                    on establishment.changed. Never decide it from the profile's category.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  LabTestIn,
  LabTestUpdate,
  MetricDef,
  CriticalDef,
  BomLineIn,
  ReagentIn,
  ReagentBatchIn,
  ReagentAdjustIn,
  ContractorIn,
} from "./generated/lab_admin";

export type LabAdminCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const TEST_SECTIONS = [
  "Hematology",
  "Clinical Biochemistry",
  "Microbiology & Serology",
  "Histopathology & Cytology",
  "Immunology",
  "Urinalysis & Clinical Microscopy",
  "Molecular Diagnostics",
  "General",
] as const;

export const SAMPLE_TYPES = [
  "Blood",
  "Serum",
  "Plasma",
  "Urine",
  "CSF (Cerebrospinal Fluid)",
  "Sputum",
  "Stool",
  "Swab",
  "Tissue Biopsy",
  "Body Fluid (Pleural/Peritoneal)",
  "Bone Marrow",
  "Other",
] as const;

export const COMMON_NOTIFIABLE_DISEASES = [
  "Dengue Fever",
  "Cholera",
  "COVID-19",
  "Poliomyelitis",
  "Tuberculosis (MDR/XDR)",
  "Malaria (Falciparum)",
  "Typhoid Fever",
  "Measles",
  "Hepatitis B",
  "Hepatitis C",
  "HIV/AIDS",
  "Crimean-Congo Hemorrhagic Fever (CCHF)",
  "Diphtheria",
] as const;

export const REAGENT_ADJUST_REASONS = ["Adjustment", "Expiry", "Damage"] as const;

export const LAB_ADMIN_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  DIAGNOSTIC_PARTNER_INVALID: {
    en: "The partner is not active for this service, or its MOU has expired.",
    ur: "یہ شراکت دار لیبارٹری اس سروس کے لیے فعال نہیں ہے یا اس کا معاہدہ (MOU) ختم ہو چکا ہے۔",
  },
  INSUFFICIENT_STOCK: {
    en: "Not enough stock available.",
    ur: "مطلوبہ ری ایجنٹ کا اسٹاک کافی نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ur: "مطلوبہ ریکارڈ سسٹم میں نہیں ملا۔",
  },
  VERSION_CONFLICT: {
    en: "The record was changed by someone else; reload and try again.",
    ur: "یہ ریکارڈ کسی دوسرے صارف نے تبدیل کر دیا ہے؛ براہ کرم صفحہ دوبارہ لوڈ کر کے کوشش کریں۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this.",
    ur: "آپ کے پاس یہ اقدام کرنے کا مجاز اختیار نہیں ہے۔",
  },
  REFERENCE_NOT_FOUND: {
    en: "A referenced record does not exist.",
    ur: "حوالہ دیا گیا ریکارڈ سسٹم میں موجود نہیں ہے۔",
  },
  UNAUTHENTICATED: {
    en: "Authentication is required. Please sign in again.",
    ur: "لاگ ان ہونا لازمی ہے۔ برائے مہربانی دوبارہ سائن ان کریں۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid. Please check the entered fields.",
    ur: "درخواست نامکمل یا غلط ہے۔ برائے مہربانی درج کردہ خانے چیک کریں۔",
  },
};

/**
 * Resolves capability view for lab_admin from establishment configuration.
 * Enforces Rule rule:0f8b607b2c.
 */
export function getLabAdminCapabilityView(
  establishment?: EstablishmentOut | null
): LabAdminCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const entry = screens.find((s: any) => s.screen_id === "lab_admin");
    if (entry && entry.view) {
      return entry.view as LabAdminCapabilityView;
    }
  } else if (screens && typeof screens === "object") {
    const entry = (screens as Record<string, any>)["lab_admin"];
    if (entry) {
      if (typeof entry === "string") return entry as LabAdminCapabilityView;
      if (typeof entry === "object" && entry.view) return entry.view as LabAdminCapabilityView;
    }
  }

  return "full";
}

/**
 * Validates a single metric definition under Rule rule:26ecdbf976.
 */
export function validateMetricDef(metric: MetricDef): { valid: boolean; error?: string } {
  if (!metric.key || metric.key.trim().length === 0) {
    return { valid: false, error: "Metric key is required." };
  }
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(metric.key.trim())) {
    return { valid: false, error: "Metric key must be 1-50 alphanumeric characters or underscores/hyphens." };
  }
  if (!metric.label || metric.label.trim().length === 0) {
    return { valid: false, error: "Metric label is required." };
  }
  if (metric.label.trim().length > 100) {
    return { valid: false, error: "Metric label cannot exceed 100 characters." };
  }

  const metricType = metric.type || "number";
  if (metricType !== "number" && metricType !== "text") {
    return { valid: false, error: "Metric type must be either 'number' or 'text'." };
  }

  if (metric.decimals !== undefined && metric.decimals !== null) {
    const dec = Number(metric.decimals);
    if (isNaN(dec) || dec < 0 || dec > 4) {
      return { valid: false, error: "Decimals must be an integer between 0 and 4." };
    }
  }

  if (metric.ref) {
    for (const [group, range] of Object.entries(metric.ref)) {
      if (!Array.isArray(range) || range.length !== 2) {
        return { valid: false, error: `Reference range for '${group}' must be a 2-element array [low, high].` };
      }
      if (typeof range[0] !== "number" || typeof range[1] !== "number" || range[0] > range[1]) {
        return { valid: false, error: `Reference range for '${group}' must have numeric low <= high.` };
      }
    }
  }

  if (metric.critical) {
    if (metricType === "number") {
      if (metric.critical.low !== null && metric.critical.low !== undefined && isNaN(Number(metric.critical.low))) {
        return { valid: false, error: "Critical low must be a valid number." };
      }
      if (metric.critical.high !== null && metric.critical.high !== undefined && isNaN(Number(metric.critical.high))) {
        return { valid: false, error: "Critical high must be a valid number." };
      }
      if (
        metric.critical.low !== null &&
        metric.critical.low !== undefined &&
        metric.critical.high !== null &&
        metric.critical.high !== undefined &&
        Number(metric.critical.low) > Number(metric.critical.high)
      ) {
        return { valid: false, error: "Critical low cannot be greater than critical high." };
      }
    } else if (metricType === "text") {
      if (metric.critical.values && !Array.isArray(metric.critical.values)) {
        return { valid: false, error: "Critical values for text metric must be an array of strings." };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates a list of metric definitions for a test (minItems: 1, unique keys) under Rule rule:26ecdbf976.
 */
export function validateMetricSchema(metrics: MetricDef[]): { valid: boolean; error?: string } {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return { valid: false, error: "At least one result metric is required in metric_schema." };
  }

  const keys = new Set<string>();
  for (let i = 0; i < metrics.length; i++) {
    const res = validateMetricDef(metrics[i]);
    if (!res.valid) {
      return { valid: false, error: `Metric #${i + 1} (${metrics[i]?.label || "untitled"}): ${res.error}` };
    }
    const normalizedKey = metrics[i].key.trim().toLowerCase();
    if (keys.has(normalizedKey)) {
      return { valid: false, error: `Duplicate metric key '${metrics[i].key}' detected. Keys must be unique.` };
    }
    keys.add(normalizedKey);
  }

  return { valid: true };
}

/**
 * Creates a helper default metric definition.
 */
export function createDefaultMetric(params?: {
  key?: string;
  label?: string;
  type?: "number" | "text";
  unit?: string;
  decimals?: number;
  refDefault?: [number, number];
  critLow?: number | null;
  critHigh?: number | null;
  textCritical?: string[];
}): MetricDef {
  const isNumber = params?.type !== "text";
  return {
    key: params?.key || (isNumber ? "result_value" : "interpretation"),
    label: params?.label || (isNumber ? "Result Value" : "Finding"),
    type: isNumber ? "number" : "text",
    unit: isNumber ? (params?.unit || "mg/dL") : null,
    decimals: isNumber ? (params?.decimals ?? 2) : undefined,
    required: true,
    ref: isNumber && params?.refDefault
      ? { default: params.refDefault }
      : isNumber
      ? { default: [10.0, 50.0] }
      : null,
    critical: isNumber
      ? {
          low: params?.critLow !== undefined ? params.critLow : null,
          high: params?.critHigh !== undefined ? params.critHigh : null,
        }
      : {
          values: params?.textCritical || ["Positive", "Reactive"],
        },
  };
}

/**
 * Validates new lab test input under Rule rule:c8be844050 and rule:26ecdbf976.
 */
export function validateLabTestInput(input: LabTestIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.code || input.code.trim().length < 2) {
    errors.code = "Test code must be at least 2 characters.";
  } else if (input.code.trim().length > 30) {
    errors.code = "Test code cannot exceed 30 characters.";
  }

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Test name must be at least 2 characters.";
  } else if (input.name.trim().length > 200) {
    errors.name = "Test name cannot exceed 200 characters.";
  }

  if (input.price !== undefined && input.price !== null) {
    const numPrice = Number(input.price);
    if (isNaN(numPrice) || numPrice < 0) {
      errors.price = "Price must be a non-negative number.";
    }
  }

  if (input.turnaround_minutes !== undefined && input.turnaround_minutes !== null) {
    const ta = Number(input.turnaround_minutes);
    if (isNaN(ta) || ta <= 0) {
      errors.turnaround_minutes = "Routine turnaround must be greater than 0 minutes.";
    }
  }

  if (input.emergency_turnaround_minutes !== undefined && input.emergency_turnaround_minutes !== null) {
    const eta = Number(input.emergency_turnaround_minutes);
    if (isNaN(eta) || eta <= 0) {
      errors.emergency_turnaround_minutes = "Urgent/STAT turnaround must be greater than 0 minutes.";
    }
  }

  const availability = input.availability || "InHouse";
  if (availability === "SendOut") {
    if (!input.send_out_partner_id || Number(input.send_out_partner_id) <= 0) {
      errors.send_out_partner_id = "A valid diagnostic partner is required for SendOut tests.";
    }
  }

  const schemaValidation = validateMetricSchema(input.metric_schema);
  if (!schemaValidation.valid) {
    errors.metric_schema = schemaValidation.error || "Invalid metric schema.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates lab test update input under Rule rule:c8be844050.
 */
export function validateLabTestUpdate(update: LabTestUpdate): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (update.name !== undefined && update.name !== null) {
    if (update.name.trim().length < 2) {
      errors.name = "Test name must be at least 2 characters.";
    } else if (update.name.trim().length > 200) {
      errors.name = "Test name cannot exceed 200 characters.";
    }
  }

  if (update.turnaround_minutes !== undefined && update.turnaround_minutes !== null) {
    const ta = Number(update.turnaround_minutes);
    if (isNaN(ta) || ta <= 0) {
      errors.turnaround_minutes = "Routine turnaround must be greater than 0 minutes.";
    }
  }

  if (update.emergency_turnaround_minutes !== undefined && update.emergency_turnaround_minutes !== null) {
    const eta = Number(update.emergency_turnaround_minutes);
    if (isNaN(eta) || eta <= 0) {
      errors.emergency_turnaround_minutes = "Urgent/STAT turnaround must be greater than 0 minutes.";
    }
  }

  if (update.availability === "SendOut") {
    if (!update.send_out_partner_id || Number(update.send_out_partner_id) <= 0) {
      errors.send_out_partner_id = "A valid diagnostic partner is required for SendOut tests.";
    }
  }

  if (update.metric_schema !== undefined && update.metric_schema !== null) {
    const schemaValidation = validateMetricSchema(update.metric_schema);
    if (!schemaValidation.valid) {
      errors.metric_schema = schemaValidation.error || "Invalid metric schema.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Bill of Materials (BOM) replacement input.
 */
export function validateBomInput(lines: BomLineIn[]): { valid: boolean; error?: string } {
  if (!Array.isArray(lines)) {
    return { valid: false, error: "BOM lines must be an array." };
  }

  const reagentIds = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.reagent_id || Number(line.reagent_id) <= 0) {
      return { valid: false, error: `Line #${i + 1}: Valid reagent ID is required.` };
    }
    const qty = Number(line.qty_per_test);
    if (isNaN(qty) || qty <= 0) {
      return { valid: false, error: `Line #${i + 1}: Quantity per test must be greater than 0.` };
    }
    if (reagentIds.has(Number(line.reagent_id))) {
      return { valid: false, error: `Duplicate reagent ID #${line.reagent_id} in BOM lines.` };
    }
    reagentIds.add(Number(line.reagent_id));
  }

  return { valid: true };
}

/**
 * Validates new reagent creation input.
 */
export function validateReagentInput(input: ReagentIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.code || input.code.trim().length < 2) {
    errors.code = "Reagent code must be at least 2 characters.";
  } else if (input.code.trim().length > 30) {
    errors.code = "Reagent code cannot exceed 30 characters.";
  }

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Reagent name must be at least 2 characters.";
  } else if (input.name.trim().length > 200) {
    errors.name = "Reagent name cannot exceed 200 characters.";
  }

  if (!input.unit || input.unit.trim().length === 0) {
    errors.unit = "Unit of measurement is required (e.g. ml, strip, test).";
  }

  if (input.low_stock_threshold !== undefined && input.low_stock_threshold !== null) {
    const threshold = Number(input.low_stock_threshold);
    if (isNaN(threshold) || threshold < 0) {
      errors.low_stock_threshold = "Low stock threshold must be a non-negative number.";
    }
  }

  if (input.near_expiry_alert_days !== undefined && input.near_expiry_alert_days !== null) {
    const days = Number(input.near_expiry_alert_days);
    if (isNaN(days) || days < 0) {
      errors.near_expiry_alert_days = "Near expiry alert days must be a non-negative integer.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates receipt of a reagent batch.
 */
export function validateReagentBatchInput(input: ReagentBatchIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.reagent_id || Number(input.reagent_id) <= 0) {
    errors.reagent_id = "Reagent selection is required.";
  }

  if (!input.batch_no || input.batch_no.trim().length === 0) {
    errors.batch_no = "Batch number is required.";
  } else if (input.batch_no.trim().length > 60) {
    errors.batch_no = "Batch number cannot exceed 60 characters.";
  }

  if (!input.expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.expiry_date)) {
    errors.expiry_date = "Expiry date must be a valid YYYY-MM-DD date.";
  }

  const qty = Number(input.qty_received);
  if (isNaN(qty) || qty <= 0) {
    errors.qty_received = "Received quantity must be greater than 0.";
  }

  const cost = Number(input.total_cost);
  if (isNaN(cost) || cost < 0) {
    errors.total_cost = "Total cost must be a non-negative number.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates reagent stock adjustment / write-off input.
 */
export function validateReagentAdjustInput(input: ReagentAdjustIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.reagent_batch_id || Number(input.reagent_batch_id) <= 0) {
    errors.reagent_batch_id = "Batch selection is required.";
  }

  const qty = Number(input.qty);
  if (isNaN(qty) || qty <= 0) {
    errors.qty = "Adjustment quantity must be greater than 0.";
  }

  if (!input.reason || !REAGENT_ADJUST_REASONS.includes(input.reason)) {
    errors.reason = "Reason must be 'Adjustment', 'Expiry', or 'Damage'.";
  }

  if (!input.note || input.note.trim().length < 3) {
    errors.note = "Adjustment note must be at least 3 characters explaining the reason.";
  } else if (input.note.trim().length > 500) {
    errors.note = "Note cannot exceed 500 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates contractor revenue share agreement input.
 */
export function validateContractorInput(input: ContractorIn): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const share = Number(input.hospital_share_pct);
  if (isNaN(share) || share < 0 || share > 100) {
    errors.hospital_share_pct = "Hospital share percentage must be between 0 and 100.";
  }

  if (!input.effective_from || !/^\d{4}-\d{2}-\d{2}$/.test(input.effective_from)) {
    errors.effective_from = "Effective from date must be a valid YYYY-MM-DD date.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
