/**
 * Domain policy and clinical rules for Transfusion Bedside Verification and Administration
 * (`transfusion_bedside`, Screen 81).
 * Implements Punjab Blood Transfusion Authority (PBTA) and Hospital Transfusion Committee standards:
 * - 30-minute start_by window from issue; OutOfStorageTooLong refusal (rule:8e16f20b4a).
 * - Dual independent co-signature and 5 mandatory bedside safety checks (rule:0a07d57ff8).
 * - Transfusion consent withdrawal critical response (rule:e1211e09ae).
 * - Baseline and ongoing vital signs observations & 4-hour completion limit (rule:efcdf1e299).
 * - Adverse transfusion reaction reporting, PBTA Section 13 incidents and sentinel events (rule:a2f80c80d7).
 * - Service gating and retiring work continuation (rule:d97564a224, rule:877e58cf09).
 */

import type {
  BedsideChecks,
  ObservationIn,
  ReactionIn,
  ReturnIn,
} from "./generated/transfusion_bedside";
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
 * Determine screen view mode for `transfusion_bedside` (rule:d97564a224).
 */
export function getTransfusionBedsideScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "transfusion_bedside");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "transfusion_bedside" in screens) {
    return (screens as Record<string, ScreenView>)["transfusion_bedside"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the blood_transfusion service allows continuing bedside transfusions (rule:877e58cf09).
 * Work continues while blood_transfusion is Active or Retiring for requests made earlier.
 */
export function isBloodTransfusionActiveOrRetiring(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  if (!establishment?.active) return true;
  return establishment.active.includes("blood_transfusion");
}

/**
 * Calculates remaining seconds until the 30-minute start_by window expires (rule:8e16f20b4a).
 */
export function getStartByRemainingSeconds(startByIso: string, nowMs = Date.now()): number {
  const targetMs = new Date(startByIso).getTime();
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  return diffSec;
}

/**
 * Formats a seconds duration into MM:SS countdown.
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00 (EXPIRED)";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Checks if the unit has exceeded the 30-minute out-of-storage threshold (rule:8e16f20b4a).
 */
export function isUnitOutTooLong(startByIso: string, nowMs = Date.now()): boolean {
  return getStartByRemainingSeconds(startByIso, nowMs) <= 0;
}

/**
 * Checks if a transfusion ended later than 4 hours after issue (rule:efcdf1e299).
 */
export function isTransfusionLate(issuedAtIso: string, endedAtIso: string): boolean {
  const issuedMs = new Date(issuedAtIso).getTime();
  const endedMs = new Date(endedAtIso).getTime();
  const fourHoursMs = 4 * 60 * 60 * 1000;
  return endedMs - issuedMs > fourHoursMs;
}

/**
 * Validates the 5 mandatory bedside safety checkboxes (rule:0a07d57ff8).
 * All 5 must be true; none can be skipped.
 */
export function validateBedsideChecks(checks: BedsideChecks): { valid: boolean; failedItems: string[] } {
  const failed: string[] = [];
  if (!checks.identity) failed.push("Patient identity matching notes, wristband, and compatibility label");
  if (!checks.unit_number) failed.push("Unit number matching bag barcode");
  if (!checks.expiry) failed.push("Component expiry date verified");
  if (!checks.product) failed.push("Prescribed product and special requirements");
  if (!checks.bag) failed.push("Physical bag inspection (no clots, turbidity, leakage, or hemolysis)");

  return {
    valid: failed.length === 0,
    failedItems: failed,
  };
}

/**
 * Validates dual-control step-up credentials (rule:0a07d57ff8).
 * Second checker must be a different nurse or doctor.
 */
export function validateSecondChecker(
  secondUsername: string,
  secondPassword: string,
  currentUsername?: string | null
): { valid: boolean; error?: string } {
  const u = (secondUsername || "").trim();
  const p = (secondPassword || "").trim();

  if (!u) {
    return { valid: false, error: "Second checker (nurse or doctor) username is required" };
  }
  if (!p) {
    return { valid: false, error: "Second checker password is required" };
  }
  if (currentUsername && u.toLowerCase() === currentUsername.trim().toLowerCase()) {
    return {
      valid: false,
      error: "Dual control violation: Second checker must be a different nurse or doctor (DUAL_CONTROL_SAME_PERSON)",
    };
  }
  return { valid: true };
}

/**
 * Validates observation entry.
 */
export function validateObservationInput(obs: ObservationIn): { valid: boolean; error?: string } {
  if (!obs.observed_at) {
    return { valid: false, error: "Observation timestamp is required" };
  }
  if (obs.temperature_c !== null && obs.temperature_c !== undefined && obs.temperature_c !== "") {
    const temp = Number(obs.temperature_c);
    if (isNaN(temp) || temp < 25 || temp > 45) {
      return { valid: false, error: "Temperature must be between 25°C and 45°C" };
    }
  }
  if (obs.pulse !== null && obs.pulse !== undefined) {
    if (obs.pulse < 30 || obs.pulse > 250) {
      return { valid: false, error: "Pulse must be between 30 and 250 bpm" };
    }
  }
  return { valid: true };
}

/**
 * Validates adverse transfusion reaction input according to PBTA / Manual requirements (rule:a2f80c80d7).
 */
export function validateReactionInput(r: ReactionIn): { valid: boolean; error?: string } {
  if (!r.noticed_at) {
    return { valid: false, error: "Reaction noticed timestamp is required" };
  }
  if (!r.reaction_type?.trim()) {
    return { valid: false, error: "Clinical reaction type description is required" };
  }
  if (!r.signs?.trim()) {
    return { valid: false, error: "Observed signs and symptoms documentation is required" };
  }
  if (!r.action_taken?.trim()) {
    return { valid: false, error: "Immediate medical action taken documentation is required" };
  }
  if (r.reaction_class === "DelayedHaemolytic" && !r.delayed_after?.trim()) {
    return { valid: false, error: "Delayed hemolytic reaction requires documentation of time elapsed (delayed_after)" };
  }
  if (r.reaction_class === "Bacterial" && !r.organism?.trim()) {
    return { valid: false, error: "Bacterial contamination reaction requires suspected organism documentation" };
  }
  if (r.fatal && r.harm !== "Death") {
    return { valid: false, error: "Fatal reaction must specify harm severity as 'Death'" };
  }
  return { valid: true };
}

/**
 * Explains backend error codes for transfusion administration.
 */
export function explainTransfusionError(
  code: string,
  details?: Record<string, unknown>
): { title: string; message: string; action: string } {
  switch (code) {
    case "BLOOD_UNIT_OUT_TOO_LONG":
      return {
        title: "Cold Chain Threshold Exceeded (30 Minutes)",
        message: "The blood unit has been out of the blood refrigerator for more than 30 minutes. The server strictly refuses starting or signing back.",
        action: "Select 'Not given / Discard' with reason 'OutOfStorageTooLong' to discard the unit.",
      };
    case "BLOOD_CONSENT_REQUIRED":
      return {
        title: "Transfusion Consent Missing or Withdrawn",
        message: "Informed consent for transfusion is missing, expired, or has been withdrawn by the patient (rule:e1211e09ae).",
        action: "Do not start the transfusion. Return unit to blood bank or obtain newly signed consent.",
      };
    case "DUAL_CONTROL_SAME_PERSON":
      return {
        title: "Dual Independent Control Refusal",
        message: "The second checker must be a different authorized nurse or doctor.",
        action: "Have a second authorized clinician type their own username and password to co-sign.",
      };
    case "STEP_UP_REQUIRED":
      return {
        title: "Second Checker Co-Signature Required",
        message: "Bedside administration requires step-up co-signature by a second clinician.",
        action: "Enter valid credentials for an authorized second checker.",
      };
    case "BLOOD_REACTION_EXISTS":
      return {
        title: "Reaction Report Already Recorded",
        message: "An adverse transfusion reaction has already been submitted for this unit.",
        action: "Review the existing reaction report and incident details.",
      };
    case "TRANSFUSION_NOT_IN_PROGRESS":
      return {
        title: "Transfusion Not Running",
        message: "This action requires the transfusion to be currently in progress.",
        action: "Verify the current transfusion status and refresh data.",
      };
    case "BLOOD_UNIT_EXPIRED":
      return {
        title: "Blood Bag Expired",
        message: "The unit shelf life has passed. Expired blood must never be transfused.",
        action: "Return unit as Not Given with discard reason Expired.",
      };
    default:
      return {
        title: "Transfusion Action Refused",
        message: "The server refused the transfusion command.",
        action: "Check the details and retry.",
      };
  }
}
