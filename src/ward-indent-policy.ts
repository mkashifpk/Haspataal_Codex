// Domain policy and safety rules for Ward Supply Indent & Inventory (Screen 89)
// Follows Haspataal MSDS 59, 60, rule:6c0ce3ff85 and rule:af4d84840c.

import type { WardStockOut, DrugStockOut } from "./generated/ward_indent";

export interface EstablishmentScreenView {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  service: string;
}

export interface UserPermissions {
  permissions: string[];
  roles?: string[];
}

export type StockRemovalReason = "Expiry" | "Damage" | "ReturnToPharmacy";

export interface StockRemovalValidation {
  valid: boolean;
  errors: Record<string, string>;
}

export interface IndentLineDraft {
  drug_id: number;
  drug_name: string;
  qty: number | string;
  note?: string;
  available_stock?: number;
}

export interface IndentDraftValidation {
  valid: boolean;
  errors: Record<string, string>;
}

/** Pure local translation helper to avoid Node ESM test import issues */
const t = (en: string, _ur: string) => en;

/**
 * Screen view policy for ward_indent based on establishment service views.
 * rule:af4d84840c: Exists for service inpatient (work).
 */
export function evaluateWardIndentView(
  establishmentOrScreens?: any
): {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canCreateNewIndent: boolean;
  canRemoveStock: boolean;
  canViewRecords: boolean;
  bannerMessage: string | null;
} {
  let view: "full" | "open_work" | "records" | "setup" | "hidden" = "full";
  const screens = establishmentOrScreens?.views?.screens || establishmentOrScreens?.screens || establishmentOrScreens;
  if (Array.isArray(screens)) {
    const item = screens.find((s: any) => s.screen_id === "ward_indent");
    if (item?.view) view = item.view;
  } else if (screens && typeof screens === "object") {
    if (screens["ward_indent"]?.view) view = screens["ward_indent"].view;
  }

  switch (view) {
    case "full":
      return {
        view: "full",
        canCreateNewIndent: true,
        canRemoveStock: true,
        canViewRecords: true,
        bannerMessage: null,
      };
    case "open_work":
      return {
        view: "open_work",
        canCreateNewIndent: false,
        canRemoveStock: true,
        canViewRecords: true,
        bannerMessage: t(
          "Service Retiring: No new patient supply indents from now on. Active cabinet stock management and open requisitions continue.",
          "سروس ریٹائر ہو رہی ہے: اب سے کوئی نئی وارڈ سپلائی کی درخواست نہیں۔ موجودہ اسٹاک اور کھلی درخواستیں جاری ہیں۔"
        ),
      };
    case "records":
      return {
        view: "records",
        canCreateNewIndent: false,
        canRemoveStock: false,
        canViewRecords: true,
        bannerMessage: t(
          "Service Retired: Ward supply inventory and indents are in read-only records mode.",
          "سروس ریٹائرڈ: وارڈ سپلائی صرف ریکارڈ دیکھنے کے موڈ میں ہے۔"
        ),
      };
    case "setup":
    case "hidden":
    default:
      return {
        view,
        canCreateNewIndent: false,
        canRemoveStock: false,
        canViewRecords: false,
        bannerMessage: t(
          "Ward supply indent is not available in current facility service configuration.",
          "وارڈ سپلائی موجودہ سہولت کنفیگریشن میں دستیاب نہیں ہے۔"
        ),
      };
  }
}

/**
 * Check if user holds permissions to create a ward indent
 */
export function canCreateIndent(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes("ward.indent.create");
}

/**
 * Check if user holds permissions to remove or return ward cabinet stock
 */
export function canRemoveStock(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return (
    user.permissions.includes("ward.indent.create") ||
    user.permissions.includes("pharmacy.stock.adjust")
  );
}

/**
 * Check if user holds permissions to view ward inventory
 */
export function canViewInventory(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return (
    user.permissions.includes("ward.inventory.view") ||
    user.permissions.includes("ward.indent.create") ||
    user.permissions.includes("pharmacy.stock.adjust")
  );
}

/**
 * Check if user holds permissions to view an indent requisition
 */
export function canViewIndent(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return (
    user.permissions.includes("ward.indent.create") ||
    user.permissions.includes("approval.ward_indent.approve")
  );
}

/**
 * Check if user holds permissions to search hospital drug formulary
 */
export function canSearchDrugs(user: UserPermissions | null | undefined): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes("pharmacy.formulary.view");
}

/**
 * Validates stock removal request (rule:6c0ce3ff85)
 * Reasons:
 * - Expiry: write-off
 * - Damage: write-off
 * - ReturnToPharmacy: good unneeded stock returned to central pharmacy
 */
export function validateStockRemovalInput(input: {
  batch_id?: number | null;
  qty?: number | string | null;
  max_qty?: number | null;
  reason?: StockRemovalReason | string | null;
  note?: string | null;
}): StockRemovalValidation {
  const errors: Record<string, string> = {};

  if (!input.batch_id || input.batch_id <= 0) {
    errors.batch_id = t("Valid stock batch must be selected.", "درست اسٹاک بیچ منتخب کریں۔");
  }

  const numQty = Number(input.qty);
  if (!input.qty || isNaN(numQty) || numQty <= 0) {
    errors.qty = t("Quantity must be greater than 0.", "تعداد 0 سے زیادہ ہونی چاہیے۔");
  } else if (input.max_qty !== undefined && input.max_qty !== null && numQty > input.max_qty) {
    errors.qty = t(
      `Quantity cannot exceed available stock (${input.max_qty}).`,
      `تعداد دستیاب اسٹاک (${input.max_qty}) سے زیادہ نہیں ہو سکتی۔`
    );
  }

  const validReasons: StockRemovalReason[] = ["Expiry", "Damage", "ReturnToPharmacy"];
  if (!input.reason || !validReasons.includes(input.reason as StockRemovalReason)) {
    errors.reason = t(
      "Reason must be Expiry, Damage, or ReturnToPharmacy.",
      "وجہ Expiry، Damage، یا ReturnToPharmacy ہونی چاہیے۔"
    );
  }

  const trimmedNote = (input.note || "").trim();
  if (!trimmedNote || trimmedNote.length < 3) {
    errors.note = t(
      "Action note must be at least 3 characters.",
      "نوٹ کم از کم 3 حروف پر مشتمل ہونا چاہیے۔"
    );
  } else if (trimmedNote.length > 500) {
    errors.note = t(
      "Action note cannot exceed 500 characters.",
      "نوٹ 500 حروف سے زیادہ نہیں ہو سکتا۔"
    );
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates indent requisition draft before submission
 */
export function validateIndentDraft(input: {
  ward_id?: number | null;
  items: IndentLineDraft[];
  note?: string | null;
}): IndentDraftValidation {
  const errors: Record<string, string> = {};

  if (!input.ward_id || input.ward_id <= 0) {
    errors.ward_id = t("A valid destination ward is required.", "وارڈ کا انتخاب ضروری ہے۔");
  }

  if (!input.items || input.items.length === 0) {
    errors.items = t(
      "At least one medicine must be added to the indent.",
      "درخواست میں کم از کم ایک دوا شامل ہونی چاہیے۔"
    );
  } else {
    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      if (!it.drug_id || it.drug_id <= 0) {
        errors[`items[${i}].drug_id`] = t("Valid drug required.", "درست دوا منتخب کریں۔");
      }
      const numQty = Number(it.qty);
      if (!it.qty || isNaN(numQty) || numQty <= 0) {
        errors[`items[${i}].qty`] = t("Quantity must be greater than 0.", "تعداد 0 سے زیادہ ہونی چاہیے۔");
      }
    }
  }

  if (input.note && input.note.trim().length > 500) {
    errors.note = t("Note cannot exceed 500 characters.", "نوٹ 500 حروف سے زیادہ نہیں ہو سکتا۔");
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Inspects ward inventory batch status according to MSDS 59/60 (rule:6c0ce3ff85)
 * Returns status classification, warning flags, and required nursing action.
 */
export function inspectInventoryBatch(stock: WardStockOut): {
  isCritical: boolean;
  badgeLabel: string;
  badgeClass: "badge-danger" | "badge-warning" | "badge-success";
  clinicalInstruction: string;
  suggestedAction: StockRemovalReason | null;
} {
  if (stock.is_recalled) {
    return {
      isCritical: true,
      badgeLabel: t("BATCH RECALLED", "بیچ واپس طلب"),
      badgeClass: "badge-danger",
      clinicalInstruction: t(
        "CRITICAL: This batch is under active recall. Never administer to patients! Quarantine immediately or return to pharmacy.",
        "انتہائی اہم: یہ بیچ واپس طلب کیا گیا ہے۔ مریض کو ہرگز نہ دیں! فوری الگ کریں یا فارمیسی واپس کریں۔"
      ),
      suggestedAction: "ReturnToPharmacy",
    };
  }

  if (stock.is_expired) {
    return {
      isCritical: true,
      badgeLabel: t("EXPIRED BATCH", "میعاد ختم"),
      badgeClass: "badge-danger",
      clinicalInstruction: t(
        "EXPIRED: This batch has expired. Never administer to patients! Write off and remove immediately.",
        "میعاد ختم: اس بیچ کی میعاد ختم ہو چکی ہے۔ مریض کو ہرگز نہ دیں! فوری رائٹ آف کر کے ہٹائیں۔"
      ),
      suggestedAction: "Expiry",
    };
  }

  return {
    isCritical: false,
    badgeLabel: t("Usable Stock", "قابل استعمال اسٹاک"),
    badgeClass: "badge-success",
    clinicalInstruction: t(
      "Active stock verified for bedside inpatient administration.",
      "زیرِ علاج مریضوں کے استعمال کے لیے درست اسٹاک۔"
    ),
    suggestedAction: null,
  };
}

/**
 * Actionable error guidance for Ward Supply Indent operations
 */
export function explainIndentError(errorCode: string, details?: Record<string, unknown>): {
  message: string;
  actionGuidance: string;
} {
  switch (errorCode) {
    case "BATCH_EXPIRED":
      return {
        message: t("This batch has expired and cannot be issued.", "اس بیچ کی میعاد ختم ہو چکی ہے اور اسے جاری نہیں کیا جا سکتا۔"),
        actionGuidance: t(
          "Remove this batch from the ward cabinet using the write-off action (Reason: Expiry) to prevent accidental administration.",
          "حادثاتی استعمال سے بچنے کے لیے رائٹ آف ایکشن (وجہ: Expiry) کے ذریعے اسے وارڈ کیبنٹ سے ہٹائیں۔"
        ),
      };
    case "BATCH_RECALLED":
      return {
        message: t(
          "This batch is recalled: it cannot be dispensed, sent to a ward, used in theatre or given.",
          "یہ بیچ واپس طلب کیا گیا ہے: اسے مریض کو دیا یا استعمال نہیں کیا جا سکتا۔"
        ),
        actionGuidance: t(
          "Quarantine the recalled batch immediately and return to central pharmacy.",
          "واپس طلب شدہ بیچ کو فوری طور پر الگ کریں اور مرکزی فارمیسی واپس کریں۔"
        ),
      };
    case "INSUFFICIENT_STOCK":
      return {
        message: t("Not enough stock available.", "دستیاب اسٹاک ناکافی ہے۔"),
        actionGuidance: t(
          "The requested quantity exceeds the current batch inventory. Reloading live ward stock.",
          "مطلوبہ تعداد بیچ کے موجودہ اسٹاک سے زیادہ ہے۔ وارڈ کا لائیو اسٹاک دوبارہ لوڈ کیا جا رہا ہے۔"
        ),
      };
    case "REFERENCE_NOT_FOUND":
      return {
        message: t("A referenced record does not exist.", "مطلوبہ ریکارڈ موجود نہیں ہے۔"),
        actionGuidance: t(
          "Please check ward, drug, or batch identifier.",
          "براہ کرم وارڈ، دوا، یا بیچ نمبر چیک کریں۔"
        ),
      };
    case "VALIDATION_ERROR":
      return {
        message: t("The request is invalid.", "درخواست میں معلومات نامکمل یا غلط ہیں۔"),
        actionGuidance: t(
          "Please verify required fields, positive quantities, and note length (3-500 characters).",
          "براہ کرم تمام لازمی فیلڈز، مثبت تعداد اور نوٹ کی لمبائی (3 سے 500 حروف) چیک کریں۔"
        ),
      };
    default:
      return {
        message: errorCode,
        actionGuidance: t("An unexpected error occurred. Please verify your connection and retry.", "ایک غیر متوقع غلطی ہوئی۔ براہ کرم اپنا رابطہ چیک کریں اور دوبارہ کوشش کریں۔"),
      };
  }
}
