/**
 * Domain policy and business rules for Ward Patient Transfer
 * (`ward_transfer`, Screen 87).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS PRE 79: Move an inpatient to another bed or ward with clinical reason;
 *   if tariff/daily rate changes (rate_changed), family must be notified with new cost estimate.
 * - Live Bed Matrix (rule:e867f67863): pick an Available bed on matrix; BED_NO_LONGER_AVAILABLE handling.
 * - Rate Changed notification (rule:dfe411b7e9): ChangeOfWard estimate trigger.
 * - Establishment screen views for service inpatient (rule:d136cb7db9).
 */

import type {
  AdmissionTransferOut,
  BedMatrixOut,
  BedMatrixBedOut,
  WardOccupancyOut,
} from "./generated/ward_transfer";
import type { EstablishmentOut } from "./generated/facility_profile";
const t = (en: string, _ur: string) => en;

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
 * Determines screen view mode for `ward_transfer` (rule:d136cb7db9).
 */
export function getWardTransferScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined,
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "ward_transfer");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "ward_transfer" in screens) {
    return (screens as Record<string, ScreenView>)["ward_transfer"] ?? "full";
  }
  return "full";
}

/**
 * Access permissions evaluator for ward_transfer.
 */
export function wardTransferAccess(
  permissions: string[],
  screenView: ScreenView,
) {
  const visible = ["full", "open_work", "records"].includes(screenView);
  const canView =
    visible &&
    permissions.includes("ipd.admission.view") &&
    permissions.includes("ipd.bed.view");
  const canTransfer =
    canView &&
    screenView !== "records" &&
    permissions.includes("ipd.admission.transfer");

  return {
    canView,
    canTransfer,
    isRetiring: screenView === "open_work",
    isReadOnly: screenView === "records",
  };
}

/**
 * Pre-defined clinical and administrative transfer reasons (MSDS PRE 79).
 */
export const QUICK_TRANSFER_REASONS = [
  {
    labelEn: "Clinical deterioration: ICU escalation",
    labelUr: "طبی حالت خراب: آئی سی یو وینٹیلیشن کی ضرورت",
    reason: "Clinical deterioration: patient requires ICU monitoring and ventilation",
  },
  {
    labelEn: "Clinical improvement: Step-down to General Ward",
    labelUr: "طبی بہتری: آئی سی یو سے جنرل وارڈ منتقلی",
    reason: "Clinical improvement: stabilized and ready for step-down to General Inpatient Ward",
  },
  {
    labelEn: "Infection control: Isolation Ward transfer",
    labelUr: "انفیکشن کنٹرول: آئسولیشن وارڈ میں منتقلی",
    reason: "Infection control: suspected/confirmed transmissible infection requiring isolation",
  },
  {
    labelEn: "Post-operative surgical care",
    labelUr: "آپریشن کے بعد کی نگہداشت: سرجیکل وارڈ منتقلی",
    reason: "Post-operative care: transfer to Surgical Ward for wound monitoring and post-op care",
  },
  {
    labelEn: "Room tariff upgrade: Private room requested",
    labelUr: "کمرہ اپ گریڈ: مریض کی جانب سے پرائیویٹ روم کی درخواست",
    reason: "Patient/family request: upgraded to Private Inpatient Room",
  },
  {
    labelEn: "Maternity / Post-natal recovery",
    labelUr: "زچگی کے بعد کی نگہداشت: میٹرنٹی وارڈ منتقلی",
    reason: "Post-delivery transfer: transfer to Postnatal Ward for mother and baby rooming-in",
  },
];

/**
 * Filters available beds from BedMatrixOut.
 * Destination bed must have current_state === "Available" and not be the patient's current bed.
 */
export function filterAvailableBeds(
  matrix: BedMatrixOut | null | undefined,
  currentBedId?: number | null,
  wardFilter?: number | "all",
): BedMatrixBedOut[] {
  if (!matrix?.beds) return [];

  return matrix.beds.filter((bed) => {
    if (bed.current_state !== "Available") return false;
    if (currentBedId && bed.bed_id === currentBedId) return false;
    if (wardFilter && wardFilter !== "all" && bed.ward_id !== wardFilter) return false;
    return true;
  });
}

/**
 * Groups beds by ward with occupancy summary.
 */
export function groupWardsSummary(
  matrix: BedMatrixOut | null | undefined,
): WardOccupancyOut[] {
  return matrix?.wards ?? [];
}

/**
 * Validates the transfer request form before sending to API.
 */
export function validateTransferInput(params: {
  bed_id?: number | null;
  reason: string;
  current_bed_id?: number | null;
}): { valid: boolean; errors: { bed_id?: string; reason?: string } } {
  const errors: { bed_id?: string; reason?: string } = {};

  if (!params.bed_id || params.bed_id <= 0) {
    errors.bed_id = "Select an available destination bed from the bed matrix.";
  } else if (params.current_bed_id && params.bed_id === params.current_bed_id) {
    errors.bed_id = "Destination bed cannot be the patient's current bed.";
  }

  const trimmedReason = (params.reason || "").trim();
  if (!trimmedReason) {
    errors.reason = "Transfer reason is required (minimum 5 characters).";
  } else if (trimmedReason.length < 5) {
    errors.reason = `Transfer reason is too short (${trimmedReason.length}/5 characters). Enter a clinical reason.`;
  } else if (trimmedReason.length > 2000) {
    errors.reason = `Transfer reason exceeds maximum length of 2000 characters.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Formats Pakistani Rupee daily bed rate.
 */
export function formatDailyRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "Rs. 0";
  return `Rs. ${rate.toLocaleString()}`;
}

/**
 * Formats rate change difference description.
 */
export function formatRateDifference(
  fromRate: number | null | undefined,
  toRate: number | null | undefined,
): { changed: boolean; text: string; direction: "increase" | "decrease" | "same" } {
  const from = fromRate ?? 0;
  const to = toRate ?? 0;
  const diff = to - from;

  if (diff === 0) {
    return {
      changed: false,
      text: "Same daily bed rate",
      direction: "same",
    };
  }

  if (diff > 0) {
    return {
      changed: true,
      text: `+Rs. ${diff.toLocaleString()} / day increase (${formatDailyRate(from)} → ${formatDailyRate(to)})`,
      direction: "increase",
    };
  }

  return {
    changed: true,
    text: `-Rs. ${Math.abs(diff).toLocaleString()} / day reduction (${formatDailyRate(from)} → ${formatDailyRate(to)})`,
    direction: "decrease",
  };
}

/**
 * Explains API errors for ward transfer operations.
 */
export function explainTransferError(
  code: string,
  details?: Record<string, unknown>,
): { title: string; message: string; action: string } {
  switch (code) {
    case "BED_NO_LONGER_AVAILABLE":
      return {
        title: t("Bed No Longer Available", "بستر اب دستیاب نہیں ہے"),
        message: t(
          "The selected bed was reserved or occupied by another terminal just now.",
          "منتخب کردہ بستر ابھی کسی اور ٹرمینل نے بک یا استعمال کر لیا ہے۔",
        ),
        action: t(
          "Refresh the bed matrix and choose another available bed.",
          "بیڈ میٹرکس ریفریش کریں اور کوئی دوسرا دستیاب بستر منتخب کریں۔",
        ),
      };

    case "ADMISSION_STATE_INVALID":
      return {
        title: t("Admission State Invalid", "داخلے کی حالت ناقابل قبول"),
        message: t(
          "Only an admitted inpatient currently occupying a bed can be transferred.",
          "صرف باقاعدہ داخل شدہ مریض جو بستر پر موجود ہو، اسے ہی منتقل کیا جا سکتا ہے۔",
        ),
        action: t(
          "Verify the patient is actively admitted and not discharged or cancelled.",
          "تصدیق کریں کہ مریض کا داخلہ فعال ہے اور خارج یا منسوخ نہیں ہوا۔",
        ),
      };

    case "REFERENCE_NOT_FOUND":
      return {
        title: t("Reference Not Found", "حوالہ دستیاب نہیں"),
        message: t(
          "The referenced bed, ward, or admission does not exist on the server.",
          "سرور پر مطلوبہ بستر، وارڈ یا داخلہ کا ریکارڈ موجود نہیں ملا۔",
        ),
        action: t(
          "Re-open the patient chart and reload available beds.",
          "مریض کا چارٹ دوبارہ کھولیں اور دستیاب بستر دوبارہ لوڈ کریں۔",
        ),
      };

    case "FORBIDDEN":
      return {
        title: t("Permission Denied", "اجازت نہیں ہے"),
        message: t(
          "You do not hold the required 'ipd.admission.transfer' permission to transfer patients.",
          "مریض کی منتقلی کے لیے 'ipd.admission.transfer' کی اجازت ضروری ہے۔",
        ),
        action: t(
          "Contact the head nurse or admissions officer to perform the transfer.",
          "منتقلی کے لیے ہیڈ نرس یا داخلہ افسر سے رابطہ کریں۔",
        ),
      };

    case "VALIDATION_ERROR":
      return {
        title: t("Validation Refusal", "درخواست میں نقص"),
        message: t(
          "The server rejected the transfer parameters. The patient may already be in this bed, or reason is invalid.",
          "سرور نے منتقلی کی معلومات مسترد کر دیں۔ ہو سکتا ہے مریض پہلے ہی اس بستر پر ہو یا وجہ درست نہیں۔",
        ),
        action: t(
          "Check input values and try with an alternative available bed.",
          "درج شدہ معلومات چیک کریں اور کسی دوسرے بستر کا انتخاب کریں۔",
        ),
      };

    default:
      return {
        title: t("Transfer Failed", "منتقلی ناکام ہوئی"),
        message: String(details?.message || t("An unexpected error occurred.", "ایک غیر متوقع خرابی پیش آئی۔")),
        action: t("Check the server connection and try again.", "سرور کنکشن چیک کرکے دوبارہ کوشش کریں۔"),
      };
  }
}
