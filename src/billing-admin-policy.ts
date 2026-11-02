/**
 * Domain policy and statutory business rules for Screen 134: billing_admin
 * ("Price & policy management", Position 134, 70 points, Workspace `billing_admin`).
 * 
 * Statutory & Quality Rules:
 * - rule:55973e6dbd: Price changes never alter issued tickets/invoices (prices are snapshotted).
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ServiceIn,
  ServicePatch,
  PanelIn,
  PanelDiscountIn,
  DiscountPolicyIn,
  ContractIn,
} from "./generated/billing_admin";

export type BillingAdminCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const SERVICE_CATEGORIES = [
  "OPD",
  "IPD",
  "OT",
  "Imaging",
  "RoomCharge",
  "Procedure",
  "Other",
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, { en: string; ur: string }> = {
  OPD: { en: "OPD Consultation", ur: "او پی ڈی مشاورت" },
  IPD: { en: "Inpatient Service", ur: "ان ڈور سروس" },
  OT: { en: "Operation Theatre", ur: "آپریشن تھیٹر" },
  Imaging: { en: "Radiology & Imaging", ur: "ریڈیالوجی و امیجنگ" },
  RoomCharge: { en: "Bed & Room Charges", ur: "کمرہ و بیڈ چارجز" },
  Procedure: { en: "Clinical Procedure", ur: "طبی طریقہ کار" },
  Other: { en: "Other Services", ur: "دیگر خدمات" },
};

export const PANEL_TYPES = [
  "SehatSahulat",
  "Zakat",
  "GovernmentEmployee",
  "Corporate",
  "Other",
] as const;

export type PanelType = typeof PANEL_TYPES[number];

export const PANEL_TYPE_LABELS: Record<PanelType, { en: string; ur: string }> = {
  SehatSahulat: { en: "Sehat Sahulat Program", ur: "صحت سہولت پروگرام" },
  Zakat: { en: "Zakat / Mustahiq Fund", ur: "زکوٰۃ و مستحق فنڈ" },
  GovernmentEmployee: { en: "Government Employee Panel", ur: "سرکاری ملازمین پینل" },
  Corporate: { en: "Corporate Insurance / Panel", ur: "کارپوریٹ انشورنس پینل" },
  Other: { en: "Other Welfare / Panel", ur: "دیگر فلاحی پینل" },
};

export const CONTRACT_RULE_TYPES = [
  "FixedFee",
  "PercentGross",
  "PercentNet",
] as const;

export type ContractRuleType = typeof CONTRACT_RULE_TYPES[number];

export const CONTRACT_RULE_TYPE_LABELS: Record<ContractRuleType, { en: string; ur: string }> = {
  FixedFee: { en: "Fixed Fee per Procedure", ur: "مقررہ فیس فی پروسیجر" },
  PercentGross: { en: "Percentage of Gross Revenue", ur: "مجموعی آمدنی کا فیصد" },
  PercentNet: { en: "Percentage of Net Profit (Post-Consumables)", ur: "خالص منافع کا فیصد (بعد از اخراجات)" },
};

/**
 * Resolves capability view for billing_admin from establishment configuration.
 */
export function getBillingAdminCapabilityView(
  establishment?: EstablishmentOut | null
): BillingAdminCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "billing_admin");
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
    const configured = (screens as Record<string, { view?: string }>)?.["billing_admin"]?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured as BillingAdminCapabilityView;
    }
  }

  return "full";
}

/**
 * Validates adding a priced service under rule:55973e6dbd.
 */
export function validateServiceInput(input: ServiceIn): { valid: boolean; error?: string } {
  if (!input.code || !input.code.trim()) {
    return { valid: false, error: "Service code is required." };
  }
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "Service name is required." };
  }
  if (!input.category || !SERVICE_CATEGORIES.includes(input.category)) {
    return { valid: false, error: "Valid service category is required." };
  }
  const price = Number(input.default_price);
  if (isNaN(price) || price < 0) {
    return { valid: false, error: "Default price must be a non-negative number." };
  }
  return { valid: true };
}

/**
 * Validates service price update under rule:55973e6dbd.
 * Price changes update the catalogue for future visits; issued records remain snapshotted.
 */
export function validateServicePatch(patch: ServicePatch): { valid: boolean; error?: string } {
  if (patch.default_price !== undefined && patch.default_price !== null && patch.default_price !== "") {
    const price = Number(patch.default_price);
    if (isNaN(price) || price < 0) {
      return { valid: false, error: "Updated price must be a non-negative number." };
    }
  }
  if (patch.name !== undefined && patch.name !== null && !patch.name.trim()) {
    return { valid: false, error: "Service name cannot be empty." };
  }
  return { valid: true };
}

/**
 * Validates creating a hospital panel or welfare fund.
 */
export function validatePanelInput(input: PanelIn): { valid: boolean; error?: string } {
  if (!input.code || !input.code.trim()) {
    return { valid: false, error: "Panel code is required." };
  }
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "Panel name is required." };
  }
  if (!input.panel_type || !PANEL_TYPES.includes(input.panel_type)) {
    return { valid: false, error: "Valid panel type is required." };
  }
  if (input.discount_pct !== undefined && input.discount_pct !== null && input.discount_pct !== "") {
    const pct = Number(input.discount_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return { valid: false, error: "Panel baseline discount must be between 0% and 100%." };
    }
  }
  return { valid: true };
}

/**
 * Validates creating an effective-dated panel discount rule.
 */
export function validatePanelDiscountInput(input: PanelDiscountIn): { valid: boolean; error?: string } {
  if (!input.panel_id || input.panel_id <= 0) {
    return { valid: false, error: "Panel selection is required." };
  }
  const pct = Number(input.discount_pct);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return { valid: false, error: "Discount percentage must be between 0% and 100%." };
  }
  if (!input.effective_from || !input.effective_from.trim()) {
    return { valid: false, error: "Effective start date is required." };
  }
  if (input.effective_to && input.effective_to.trim()) {
    if (new Date(input.effective_to) < new Date(input.effective_from)) {
      return { valid: false, error: "Effective end date cannot precede effective start date." };
    }
  }
  return { valid: true };
}

/**
 * Validates setting a role or user discount ceiling policy.
 */
export function validateDiscountPolicyInput(input: DiscountPolicyIn): { valid: boolean; error?: string } {
  if (!input.role_code && !input.user_id) {
    return { valid: false, error: "Either a target role code or user ID is required." };
  }
  const pct = Number(input.max_discount_pct);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return { valid: false, error: "Maximum discount percentage must be between 0% and 100%." };
  }
  if (input.max_discount_amount !== undefined && input.max_discount_amount !== null && input.max_discount_amount !== "") {
    const amt = Number(input.max_discount_amount);
    if (isNaN(amt) || amt < 0) {
      return { valid: false, error: "Maximum discount amount must be non-negative." };
    }
  }
  return { valid: true };
}

/**
 * Validates consultant commission contract creation.
 */
export function validateContractInput(input: ContractIn): { valid: boolean; error?: string } {
  if (!input.employee_id || input.employee_id <= 0) {
    return { valid: false, error: "Consultant / employee selection is required." };
  }
  if (!input.rule_type || !CONTRACT_RULE_TYPES.includes(input.rule_type)) {
    return { valid: false, error: "Valid commission rule type is required." };
  }

  if (input.rule_type === "FixedFee") {
    const amt = Number(input.amount);
    if (isNaN(amt) || amt <= 0) {
      return { valid: false, error: "Fixed fee commission amount must be greater than zero." };
    }
  } else {
    const pct = Number(input.percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return { valid: false, error: "Commission percentage must be between 0.1% and 100%." };
    }
  }

  if (!input.effective_from || !input.effective_from.trim()) {
    return { valid: false, error: "Effective start date is required." };
  }

  if (input.effective_to && input.effective_to.trim()) {
    if (new Date(input.effective_to) < new Date(input.effective_from)) {
      return { valid: false, error: "Effective end date cannot precede effective start date." };
    }
  }

  return { valid: true };
}

/**
 * Statutory error messages dictionary matching backend contract.
 */
export const BILLING_ADMIN_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ur: "درخواست کردہ ریکارڈ نہیں ملا۔",
  },
  REFERENCE_NOT_FOUND: {
    en: "A referenced record does not exist.",
    ur: "حوالہ دیا گیا متعلقہ ریکارڈ موجود نہیں ہے۔",
  },
  TEMPORAL_OVERLAP: {
    en: "This overlaps an existing effective period.",
    ur: "یہ تاریخیں پہلے سے موجود فعال مدت سے متصادم ہیں۔",
  },
  UNAUTHENTICATED: {
    en: "Authentication is required.",
    ur: "لاگ ان اور تصدیق درکار ہے۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid.",
    ur: "درخواست کے کوائف درست نہیں ہیں۔",
  },
  VERSION_CONFLICT: {
    en: "The record was changed by someone else; reload and try again.",
    ur: "یہ ریکارڈ کسی اور صارف نے تبدیل کر دیا ہے؛ براہ کرم صفحہ ریفریش کر کے دوبارہ کوشش کریں۔",
  },
};
