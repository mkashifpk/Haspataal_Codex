/**
 * Domain policy and statutory business rules for Screen 135: pharmacy_admin
 * ("Pharmacy inventory, formulary & procurement", Position 135, 76 points, Workspace `pharmacy_admin`).
 * 
 * Statutory & Quality Rules:
 * - rule:b828c195cc: Batch intake: boxes × units per box and total invoice cost; the server derives unit cost.
 * - rule:f65fc1a5a8: Return to supplier (expired, near expiry, recalled, damaged, excess, wrongly supplied):
 *                    from a batch, quantity, reason, and note (recalled batch requires reason Recall and recall_id),
 *                    then print return note PDF; tracks status Returned -> Credited / Refused.
 * - rule:609bbe13b3: A new drug may be high-alert (high_alert_category) or restricted (is_restricted) from the start;
 *                    never both high-alert and OTC.
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  DrugIn,
  BatchIn,
  AdjustIn,
  VendorInvoiceIn,
  SupplierReturnIn,
} from "./generated/pharmacy_admin";

export type PharmacyAdminCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const DRUG_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Infusion",
  "Cream",
  "Ointment",
  "Drops",
  "Inhaler",
  "Suppository",
  "Powder",
  "Consumable",
  "Device",
  "Other",
] as const;

export type DrugForm = typeof DRUG_FORMS[number];

export const DRUG_SCHEDULES = [
  "OTC",
  "ScheduleG",
  "ScheduleH",
  "ScheduleX",
  "HospitalOnly",
] as const;

export type DrugSchedule = typeof DRUG_SCHEDULES[number];

export const HIGH_ALERT_CATEGORIES = [
  "ConcentratedElectrolyte",
  "Chemotherapy",
  "Anticoagulant",
  "Insulin",
  "Opioid",
  "Sedative",
  "NeuromuscularBlocker",
  "Inotrope",
  "Thrombolytic",
  "Psychotropic",
  "HighCost",
  "Other",
] as const;

export type HighAlertCategory = typeof HIGH_ALERT_CATEGORIES[number];

export const HIGH_ALERT_CATEGORY_LABELS: Record<HighAlertCategory, { en: string; ur: string }> = {
  ConcentratedElectrolyte: { en: "Concentrated Electrolyte", ur: "مرکوز الیکٹرولائٹ" },
  Chemotherapy: { en: "Chemotherapy / Cytotoxic", ur: "کیموتھراپی ادویات" },
  Anticoagulant: { en: "Anticoagulant / Blood Thinner", ur: "خون پتلا کرنے والی دوا" },
  Insulin: { en: "Insulin / Hypoglycemic", ur: "انسولین" },
  Opioid: { en: "Opioid / Narcotic Analgesic", ur: "اوپیئڈ نشہ آور دوا" },
  Sedative: { en: "Sedative / Hypnotic", ur: "مسکن دوا" },
  NeuromuscularBlocker: { en: "Neuromuscular Blocker", ur: "اعصابی و پٹھوں کو سن کرنے والی دوا" },
  Inotrope: { en: "Inotrope / Cardiac Vasopressor", ur: "قلبی ادویات" },
  Thrombolytic: { en: "Thrombolytic / Clot Buster", ur: "تھرومبولیٹک دوا" },
  Psychotropic: { en: "Psychotropic Drug", ur: "نفسیاتی ادویات" },
  HighCost: { en: "High Cost Medicine", ur: "انتہائی قیمتی دوا" },
  Other: { en: "Other High-Alert Medicine", ur: "دیگر ہائی الرٹ ادویات" },
};

export const ADJUSTMENT_REASONS = [
  "Adjustment",
  "Expiry",
  "Damage",
] as const;

export type AdjustmentReason = typeof ADJUSTMENT_REASONS[number];

export const SUPPLIER_RETURN_REASONS = [
  "Expired",
  "NearExpiry",
  "Recall",
  "Damaged",
  "Excess",
  "WrongSupply",
  "Other",
] as const;

export type SupplierReturnReason = typeof SUPPLIER_RETURN_REASONS[number];

export const SUPPLIER_RETURN_REASON_LABELS: Record<SupplierReturnReason, { en: string; ur: string }> = {
  Expired: { en: "Expired Stock", ur: "میعاد ختم شدہ اسٹاک" },
  NearExpiry: { en: "Near Expiry Stock", ur: "قریب المیعاد اسٹاک" },
  Recall: { en: "Manufacturer / DRA Recall", ur: "کمپنی یا ڈریپ ریکال" },
  Damaged: { en: "Damaged / Broken", ur: "خراب یا ٹوٹا ہوا" },
  Excess: { en: "Excess / Slow Moving", ur: "اضافی اسٹاک" },
  WrongSupply: { en: "Wrongly Supplied", ur: "غلط سپلائی" },
  Other: { en: "Other Justified Reason", ur: "دیگر جواز" },
};

export const VENDOR_INVOICE_TYPES = [
  "Purchase",
  "Return",
  "CreditNote",
  "Service",
  "Utility",
  "Other",
] as const;

export type VendorInvoiceType = typeof VENDOR_INVOICE_TYPES[number];

export const VENDOR_INVOICE_MODULES = [
  "Pharmacy",
  "Lab",
  "Ops",
  "OT",
  "Other",
] as const;

export type VendorInvoiceModule = typeof VENDOR_INVOICE_MODULES[number];

/**
 * Resolves capability view for pharmacy_admin from establishment configuration.
 */
export function getPharmacyAdminCapabilityView(
  establishment?: EstablishmentOut | null
): PharmacyAdminCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "pharmacy_admin");
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
    const configured = (screens as Record<string, { view?: string }>)?.["pharmacy_admin"]?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured as PharmacyAdminCapabilityView;
    }
  }

  return "full";
}

/**
 * Validates adding a formulary drug under rule:609bbe13b3.
 * Statutory rule: A new drug may be high-alert or restricted from the start; never both high-alert and OTC.
 */
export function validateDrugInput(input: DrugIn): { valid: boolean; error?: string } {
  if (!input.code || !input.code.trim()) {
    return { valid: false, error: "Drug code is required." };
  }
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "Drug name is required." };
  }
  if (!input.form || !DRUG_FORMS.includes(input.form)) {
    return { valid: false, error: "Valid dosage form is required." };
  }
  if (!input.schedule || !DRUG_SCHEDULES.includes(input.schedule)) {
    return { valid: false, error: "Valid dispensing schedule is required." };
  }

  // Statutory Rule rule:609bbe13b3: Never both high-alert and OTC
  const isHighAlert = Boolean(input.high_alert_category);
  const isOtcSchedule = input.schedule === "OTC";
  const isOtcAllowed = Boolean(input.is_otc_allowed);

  if (isHighAlert && isOtcSchedule) {
    return {
      valid: false,
      error: "Statutory violation: A high-alert drug cannot have an OTC schedule (rule:609bbe13b3).",
    };
  }

  if (isHighAlert && isOtcAllowed) {
    return {
      valid: false,
      error: "Statutory violation: A high-alert drug cannot be marked as OTC allowed (rule:609bbe13b3).",
    };
  }

  if (isOtcAllowed && !isOtcSchedule) {
    return {
      valid: false,
      error: "The is_otc_allowed flag is only permitted when drug schedule is OTC.",
    };
  }

  if (input.low_stock_threshold !== undefined && input.low_stock_threshold !== null && input.low_stock_threshold !== "") {
    const threshold = Number(input.low_stock_threshold);
    if (isNaN(threshold) || threshold < 0) {
      return { valid: false, error: "Low stock threshold must be a non-negative number." };
    }
  }

  if (input.near_expiry_alert_days !== undefined && input.near_expiry_alert_days !== null) {
    const days = Number(input.near_expiry_alert_days);
    if (isNaN(days) || days < 1) {
      return { valid: false, error: "Near expiry alert days must be a positive number." };
    }
  }

  return { valid: true };
}

/**
 * Validates batch intake and derives unit cost under rule:b828c195cc.
 * Statutory rule: Batch intake: boxes × units per box and total invoice cost; the server derives unit cost.
 */
export function validateBatchInput(input: BatchIn): {
  valid: boolean;
  error?: string;
  derived?: { total_units: number; unit_cost: number };
} {
  if (!input.drug_id || Number(input.drug_id) <= 0) {
    return { valid: false, error: "Drug selection is required." };
  }
  if (!input.batch_no || !input.batch_no.trim()) {
    return { valid: false, error: "Batch number is required." };
  }
  if (!input.expiry_date || !input.expiry_date.trim()) {
    return { valid: false, error: "Expiry date is required." };
  }

  const expiry = new Date(input.expiry_date);
  if (isNaN(expiry.getTime())) {
    return { valid: false, error: "Invalid expiry date format." };
  }

  const boxes = Number(input.box_quantity);
  if (isNaN(boxes) || boxes <= 0) {
    return { valid: false, error: "Box quantity must be greater than zero." };
  }

  const unitsPerBox = Number(input.units_per_box);
  if (isNaN(unitsPerBox) || unitsPerBox <= 0) {
    return { valid: false, error: "Units per box must be greater than zero." };
  }

  const totalCost = Number(input.total_invoice_cost);
  if (isNaN(totalCost) || totalCost < 0) {
    return { valid: false, error: "Total invoice cost must be non-negative." };
  }

  const retailPrice = Number(input.retail_price);
  if (isNaN(retailPrice) || retailPrice <= 0) {
    return { valid: false, error: "Retail price per unit must be greater than zero." };
  }

  const total_units = boxes * unitsPerBox;
  const unit_cost = total_units > 0 ? totalCost / total_units : 0;

  return {
    valid: true,
    derived: {
      total_units,
      unit_cost: Number(unit_cost.toFixed(4)),
    },
  };
}

/**
 * Validates stock write-off or adjustment.
 */
export function validateAdjustInput(input: AdjustIn): { valid: boolean; error?: string } {
  const qty = Number(input.qty);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: "Adjustment quantity must be greater than zero." };
  }
  if (!input.reason || !ADJUSTMENT_REASONS.includes(input.reason)) {
    return { valid: false, error: "Valid adjustment reason (Adjustment, Expiry, Damage) is required." };
  }
  if (!input.note || !input.note.trim()) {
    return { valid: false, error: "Mandatory justification note is required for stock adjustments." };
  }
  return { valid: true };
}

/**
 * Validates recording a supplier invoice (Accounts Payable).
 */
export function validateVendorInvoiceInput(input: VendorInvoiceIn): { valid: boolean; error?: string } {
  if (!input.vendor_id || Number(input.vendor_id) <= 0) {
    return { valid: false, error: "Supplier selection is required." };
  }
  if (!input.invoice_no || !input.invoice_no.trim()) {
    return { valid: false, error: "Supplier invoice number is required." };
  }
  const cost = Number(input.total_cost);
  if (isNaN(cost) || cost <= 0) {
    return { valid: false, error: "Total invoice cost must be greater than zero." };
  }
  return { valid: true };
}

/**
 * Validates supplier return under rule:f65fc1a5a8.
 * Statutory rule: Return to supplier: batch quantity, reason, and note.
 * Cross-field rule: recall_id goes with reason Recall, and only with it.
 */
export function validateSupplierReturnInput(input: SupplierReturnIn): { valid: boolean; error?: string } {
  const qty = Number(input.qty);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: "Return quantity must be greater than zero." };
  }
  if (!input.reason || !SUPPLIER_RETURN_REASONS.includes(input.reason)) {
    return { valid: false, error: "Valid return reason is required." };
  }

  // Cross-field validation: recall_id goes with reason Recall, and only with it
  if (input.reason === "Recall") {
    if (!input.recall_id || Number(input.recall_id) <= 0) {
      return {
        valid: false,
        error: "A valid recall ID is strictly required when return reason is Recall (rule:f65fc1a5a8).",
      };
    }
  } else {
    if (input.recall_id !== undefined && input.recall_id !== null && Number(input.recall_id) > 0) {
      return {
        valid: false,
        error: "Recall ID can only be specified when return reason is Recall.",
      };
    }
  }

  if (!input.note || !input.note.trim()) {
    return { valid: false, error: "A note explaining the supplier agreement or transport is required." };
  }

  return { valid: true };
}

/**
 * Statutory error messages dictionary matching backend contract.
 */
export const PHARMACY_ADMIN_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  FORBIDDEN: {
    en: "You do not have permission to perform this pharmacy administration task.",
    ur: "آپ کو فارمیسی ایڈمنسٹریشن کا یہ کام انجام دینے کی اجازت نہیں ہے۔",
  },
  INSUFFICIENT_STOCK: {
    en: "Not enough stock available in this batch to complete the return or adjustment.",
    ur: "اس بیچ میں واپسی یا ایڈجسٹمنٹ کے لیے مطلوبہ اسٹاک موجود نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "The requested drug, batch, supplier, or invoice was not found.",
    ur: "درخواست کردہ دوا، بیچ، سپلائر یا انوائس نہیں مل سکی۔",
  },
  VALIDATION_ERROR: {
    en: "The request data is invalid. Please review input fields.",
    ur: "درخواست کے کوائف درست نہیں ہیں۔ براہ کرم فیلڈز چیک کریں۔",
  },
  DUPLICATE_RECORD: {
    en: "A record with this code, batch number, or invoice number already exists.",
    ur: "اس کوڈ، بیچ نمبر یا انوائس نمبر کا ریکارڈ پہلے سے موجود ہے۔",
  },
};
