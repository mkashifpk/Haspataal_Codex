import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ConsumableIn,
  OtReasonIn,
  BookingConsumableOut,
} from "./generated/ot_consumables_nurse";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for ot_consumables_nurse (Rule 77e2100829).
 * Uses GET /establishment views.screens[screen_id]. Never decides from facility category.
 */
export function getOtConsumablesScreenView(
  establishment?: EstablishmentOut | null,
  screenId: string = "ot_consumables_nurse"
): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === screenId);
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
 * Checks whether user can view OT bookings
 */
export function canViewBookings(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  if (roles.includes("admin") || roles.includes("director") || roles.includes("medical_director")) return true;
  if (permissions.includes("ot.booking.view") || permissions.includes("ot.booking.manage")) return true;
  return roles.some((r) =>
    ["ot_nurse", "ot_admin", "doctor", "surgeon", "anaesthetist", "clinical_specialist"].includes(r)
  );
}

/**
 * Checks whether user can record or reverse consumables
 */
export function canRecordConsumables(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  if (roles.includes("admin") || roles.includes("director")) return true;
  if (permissions.includes("ot.consumable.record")) return true;
  return roles.includes("ot_nurse") || roles.includes("ot_admin");
}

/**
 * Checks if a booking's surgery is considered active for recording/reversing consumables.
 * Status must not be Completed or Cancelled.
 */
export function isSurgeryActive(status?: string | null): boolean {
  if (!status) return false;
  return !["Completed", "Cancelled"].includes(status);
}

/**
 * Validates a consumable scan payload.
 */
export function validateConsumableScan(body: ConsumableIn): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: "Consumable data is required" };
  }

  const numQty = Number(body.qty);
  if (isNaN(numQty) || numQty <= 0) {
    return { valid: false, error: "Quantity must be greater than zero" };
  }

  const hasBarcode = Boolean(body.barcode && body.barcode.trim().length > 0);
  const hasDrugId = typeof body.drug_id === "number" && body.drug_id > 0;
  const hasDescription = Boolean(body.description && body.description.trim().length > 0);
  const hasAssetId = typeof body.asset_id === "number" && body.asset_id > 0;

  if (!hasBarcode && !hasDrugId && !hasDescription && !hasAssetId) {
    return {
      valid: false,
      error: "Must provide a scanned barcode, formulary drug, implant asset, or description",
    };
  }

  return { valid: true };
}

/**
 * Statutory Rule 0a80234be9:
 * Mistaken scans are reversed with a reason (never deleted).
 * Reason must be 3-1000 characters.
 */
export function validateReversalReason(body: OtReasonIn): { valid: boolean; error?: string } {
  if (!body || !body.reason) {
    return { valid: false, error: "Reversal reason is mandatory (minimum 3 characters)" };
  }
  const trimmed = body.reason.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: "Reversal reason must be at least 3 characters" };
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: "Reversal reason must not exceed 1000 characters" };
  }
  return { valid: true };
}

/**
 * Checks whether an existing consumable row can be reversed.
 * Rows that are already reversed or are themselves reversals cannot be reversed again.
 */
export function canReverseConsumable(item: BookingConsumableOut): boolean {
  if (!item) return false;
  if (item.is_reversal) return false;
  if (item.is_reversed) return false;
  return true;
}

/**
 * Bilingual explanations for backend error codes
 */
export function explainConsumablesError(
  code: string,
  lang: "en" | "ur" = "en"
): { title: string; detail: string; action: string } {
  switch (code) {
    case "OT_BOOKING_NOT_ACTIVE":
      return lang === "ur"
        ? {
            title: "سرجری فعال نہیں ہے",
            detail: "اس سرجری کا اسٹیٹس فعال نہیں ہے، لہٰذا مزید اشیاء اسکین یا منسوخ نہیں کی جا سکتیں۔",
            action: "سرجری کی تازہ ترین تفصیلات دیکھیں اور بکنگ کا جائزہ لیں۔",
          }
        : {
            title: "Surgery Not Active",
            detail: "The operative booking is not in an active surgical state (it may be completed or cancelled).",
            action: "Refresh the booking and check current theatre status.",
          };

    case "OT_CONSUMABLE_REVERSAL_INVALID":
      return lang === "ur"
        ? {
            title: "منسوخی باطل ہے",
            detail: "یہ آئٹم پہلے ہی منسوخ ہو چکا ہے یا اس کی منسوخی کے تقاضے پورے نہیں ہیں۔",
            action: "براہ کرم اسکین شدہ اشیاء کی فہرست دوبارہ دیکھیں۔",
          }
        : {
            title: "Invalid Consumable Reversal",
            detail: "The consumable item cannot be reversed (it may already be reversed or is a reversal row).",
            action: "Review the consumables list to confirm current status.",
          };

    case "REFERENCE_NOT_FOUND":
      return lang === "ur"
        ? {
            title: "ریکارڈ موجود نہیں",
            detail: "فراہم کردہ بارکوڈ یا دوا کا ریفرنس ریکارڈ سسٹم میں نہیں ملا۔",
            action: "بارکوڈ دوبارہ اسکین کریں یا فارمیسی ریکارڈ چیک کریں۔",
          }
        : {
            title: "Reference Not Found",
            detail: "The referenced barcode, medication, or asset could not be located.",
            action: "Rescan the barcode or search the pharmacy formulary.",
          };

    case "VALIDATION_ERROR":
      return lang === "ur"
        ? {
            title: "درخواست کی تصدیق ناکام",
            detail: "فارم کے اندراجات سرور کے معیار پر پورے نہیں اترتے۔",
            action: "تمام ضروری فیلڈز اور مقدار درست کریں۔",
          }
        : {
            title: "Validation Error",
            detail: "The submitted data failed server validation rules.",
            action: "Verify required fields, positive quantity, and item details.",
          };

    default:
      return lang === "ur"
        ? {
            title: "خرابی",
            detail: `سرور نے خرابی کوڈ ${code} دیا ہے۔`,
            action: "دوبارہ کوشش کریں یا ہیلپ ڈیسک سے رابطہ کریں۔",
          }
        : {
            title: "System Error",
            detail: `The server returned error code ${code}.`,
            action: "Please retry or contact IT support if the issue persists.",
          };
  }
}
