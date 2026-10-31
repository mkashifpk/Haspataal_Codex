/**
 * Domain policy and business rules for Head Nurse Ward Patient Transfer
 * (`ward_transfer_head_nurse`, Screen 88).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS PRE 79: Head nurse moves a patient between beds and wards with documented clinical reason.
 * - Live Bed Matrix (rule:cbaa60994a): As at the admissions desk; desk is notified to explain new estimate.
 * - Establishment screen views for service inpatient (rule:7defdd4e70).
 */

import type {
  AdmissionTransferOut,
  BedMatrixOut,
  BedMatrixBedOut,
  WardOccupancyOut,
} from "./generated/ward_transfer_head_nurse";
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
 * Determines screen view mode for `ward_transfer_head_nurse` (rule:7defdd4e70).
 */
export function getWardTransferHeadNurseScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined,
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "ward_transfer_head_nurse");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "ward_transfer_head_nurse" in screens) {
    return (screens as Record<string, ScreenView>)["ward_transfer_head_nurse"] ?? "full";
  }
  return "full";
}

/**
 * Access permissions evaluator for ward_transfer_head_nurse.
 */
export function wardTransferHeadNurseAccess(
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
 * Pre-defined clinical reasons customized for Head Nurse clinical supervision (MSDS PRE 79).
 */
export const HEAD_NURSE_TRANSFER_REASONS = [
  {
    labelEn: "Clinical deterioration: ICU escalation",
    labelUr: "طبی حالت خراب: آئی سی یو وینٹیلیشن کی ضرورت",
    reason: "Clinical deterioration: patient requires ICU monitoring and mechanical ventilation",
  },
  {
    labelEn: "Clinical improvement: Step-down to General Ward",
    labelUr: "طبی بہتری: آئی سی یو سے جنرل وارڈ منتقلی",
    reason: "Clinical improvement: stabilized and approved by intensivist for step-down to General Ward",
  },
  {
    labelEn: "Infection control: Isolation Ward transfer",
    labelUr: "انفیکشن کنٹرول: آئسولیشن وارڈ میں منتقلی",
    reason: "Infection control: suspected or confirmed droplet/airborne transmissible infection requiring isolation",
  },
  {
    labelEn: "Post-operative surgical care",
    labelUr: "آپریشن کے بعد کی نگہداشت: سرجیکل وارڈ منتقلی",
    reason: "Post-operative care: transfer to Surgical Ward for wound monitoring and post-op nursing care",
  },
  {
    labelEn: "Head nurse bed balancing: room upgrade",
    labelUr: "ہیڈ نرس بیڈ مینجمنٹ: پرائیویٹ روم الاٹمنٹ",
    reason: "Patient/family request: upgraded to Private Inpatient Room",
  },
  {
    labelEn: "Maternity / Post-natal rooming-in",
    labelUr: "زچگی کے بعد کی نگہداشت: میٹرنٹی وارڈ منتقلی",
    reason: "Post-delivery transfer: transfer to Postnatal Inpatient Ward for mother and infant care",
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
    errors.reason = `Transfer reason is too short (${trimmedReason.length}/5 characters). Enter a factual clinical reason.`;
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
 * Formats rate change difference description (rule:cbaa60994a, MSDS PRE 79).
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
        title: "Bed No Longer Available / بستر اب دستیاب نہیں ہے",
        message: "The selected bed was reserved or occupied by another terminal just now.",
        action: "Refresh the bed matrix and choose another available bed.",
      };

    case "ADMISSION_STATE_INVALID":
      return {
        title: "Admission State Invalid / داخلے کی حالت ناقابل قبول",
        message: "Only an admitted inpatient currently occupying a bed can be transferred.",
        action: "Verify the patient is actively admitted and not discharged or cancelled.",
      };

    case "REFERENCE_NOT_FOUND":
      return {
        title: "Reference Not Found / حوالہ دستیاب نہیں",
        message: "The referenced bed, ward, or admission does not exist on the server.",
        action: "Re-open the patient chart and reload available beds.",
      };

    case "FORBIDDEN":
      return {
        title: "Permission Denied / اجازت نہیں ہے",
        message: "You do not hold the required 'ipd.admission.transfer' permission to transfer patients.",
        action: "Ensure your head nurse account has 'ipd.admission.transfer' assigned.",
      };

    case "VALIDATION_ERROR":
      return {
        title: "Validation Refusal / درخواست میں نقص",
        message: "The server rejected the transfer parameters. The patient may already be in this bed, or reason is invalid.",
        action: "Check input values and try with an alternative available bed.",
      };

    default:
      return {
        title: "Transfer Failed / منتقلی ناکام ہوئی",
        message: String(details?.message || "An unexpected error occurred."),
        action: "Check the server connection and try again.",
      };
  }
}
