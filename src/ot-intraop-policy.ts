import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ConsumableIn,
  OtReasonIn,
  BookingConsumableOut,
} from "./generated/ot_intraop";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for ot_intraop (Rule 23588c8fc8).
 * Uses GET /establishment views.screens[screen_id]. Never decides from facility category.
 */
export function getOtIntraopScreenView(
  establishment?: EstablishmentOut | null,
  screenId: string = "ot_intraop"
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
 * Checks whether user can manage OT lifecycle transitions (Start, Complete Surgery, Complete Cleaning)
 */
export function canManageBookings(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  if (roles.includes("admin") || roles.includes("director")) return true;
  if (permissions.includes("ot.booking.manage")) return true;
  return roles.includes("ot_admin");
}

/**
 * Checks whether user can record or reverse intra-op consumables
 */
export function canRecordConsumables(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  if (roles.includes("admin") || roles.includes("director")) return true;
  if (permissions.includes("ot.consumable.record")) return true;
  return roles.includes("ot_admin") || roles.includes("ot_nurse");
}

/**
 * Checks whether user can view OT bookings
 */
export function canViewBookings(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  if (roles.includes("admin") || roles.includes("director")) return true;
  if (permissions.includes("ot.booking.view") || permissions.includes("ot.booking.manage")) return true;
  return roles.some((r) =>
    ["ot_admin", "ot_nurse", "doctor", "surgeon", "anaesthetist", "clinical_specialist"].includes(r)
  );
}

/**
 * Validates whether surgery can be started (Patient in theater -> InProgress)
 */
export function canStartSurgery(status?: string | null): boolean {
  if (!status) return false;
  return ["Scheduled", "EmergencyHold"].includes(status);
}

/**
 * Validates whether surgery can be completed (InProgress -> Cleaning)
 */
export function canCompleteSurgery(status?: string | null): boolean {
  if (!status) return false;
  return status === "InProgress";
}

/**
 * Validates whether theater cleaning can be marked complete (Cleaning -> Available/Completed)
 */
export function canCompleteCleaning(status?: string | null): boolean {
  if (!status) return false;
  return status === "Cleaning";
}

/**
 * Validates whether consumables can be scanned/added into the surgery
 */
export function canAddConsumables(status?: string | null): boolean {
  if (!status) return false;
  return status === "InProgress";
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
 * Statutory Rule f228c617bd:
 * Mistaken scans are reversed (never deleted).
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
export function explainOtIntraopError(
  code: string,
  lang: "en" | "ur" = "en"
): { title: string; detail: string; action: string } {
  switch (code) {
    case "OT_BOOKING_STATE_INVALID":
      return lang === "ur"
        ? {
            title: "سرجری کی حالت غلط ہے",
            detail: "سرجری کے اس مرحلے کی تبدیلی کی اجازت نہیں ہے (ممکن ہے کہ کسی دوسرے ٹرمینل نے پہلے ہی اسے اپ ڈیٹ کر دیا ہو)۔",
            action: "سرجری کا ڈیٹا دوبارہ لوڈ کریں اور موجودہ اسٹیٹس چیک کریں۔",
          }
        : {
            title: "Invalid State Change",
            detail: "The requested surgical state change is invalid for this booking's current lifecycle stage.",
            action: "Refresh the booking to reconcile with latest theatre state.",
          };

    case "OT_CHECKLIST_INCOMPLETE":
      return lang === "ur"
        ? {
            title: "چیک لسٹ نامکمل ہے",
            detail: "سرجری مکمل کرنے سے قبل جراحی سیفٹی چیک لسٹ کے ضروری مراحل (سائن آؤٹ) کا مکمل ہونا لازمی ہے۔",
            action: "سرجیکل سیفٹی چیک لسٹ کھولیں اور سائن آؤٹ کی توثیق کریں۔",
          }
        : {
            title: "Safety Checklist Incomplete",
            detail: "The surgical safety checklist (Sign Out pause) must be signed and completed before surgery can be marked finished.",
            action: "Open Surgical Safety Checklist and execute the Sign Out pause.",
          };

    case "OT_BOOKING_NOT_ACTIVE":
      return lang === "ur"
        ? {
            title: "سرجری فعال نہیں ہے",
            detail: "یہ سرجری فی الوقت فعال حالت (InProgress) میں نہیں ہے، لہٰذا مزید سامان اسکین نہیں کیا جا سکتا۔",
            action: "سرجری شروع کریں یا بکنگ کا جائزہ لیں۔",
          }
        : {
            title: "Surgery Not Active",
            detail: "The operative booking is not in an active In-Surgery state.",
            action: "Start the surgery before scanning consumables.",
          };

    case "OT_CONSUMABLE_REVERSAL_INVALID":
      return lang === "ur"
        ? {
            title: "منسوخی باطل ہے",
            detail: "یہ آئٹم پہلے ہی منسوخ ہو چکا ہے یا اس کی منسوخی کے تقاضے پورے نہیں ہیں۔",
            action: "اسکین شدہ اشیاء کی فہرست دوبارہ دیکھیں۔",
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
            action: "Verify required fields and item inputs.",
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
