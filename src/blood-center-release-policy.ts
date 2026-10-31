/**
 * Domain policy and business rules for Blood Center Release (`blood_center_release`, Screen 80).
 * Implements Punjab Blood Transfusion Authority (PBTA) standards:
 * - Dual independent co-signature and step-up verification for release to blood bank (rule:1e77b26ed6).
 * - Mandatory infectious clearance and ABO/Rh concordance verification (rule:d1b6b7c78b).
 * - Service view gating and retiring work continuation (rule:e8afafb775, rule:e4772411e5).
 * - Idempotency and error handling for blood center release (rule:adbb482acd, rule:bd509b7d5a).
 */

import type { DonationDetailOut, DonationTestOut } from "./generated/blood_center_release";
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
 * Evaluates the screen view mode for `blood_center_release`.
 * Follows rule:e8afafb775: read GET /establishment views.screens for screen_id blood_center_release.
 */
export function getBloodCenterReleaseScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "blood_center_release");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "blood_center_release" in screens) {
    return (screens as Record<string, ScreenView>)["blood_center_release"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the blood center service allows continuing release of existing quarantine units (rule:e4772411e5).
 * Work continues while blood_center is Active or Retiring.
 */
export function isBloodCenterActiveOrRetiring(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  if (!establishment?.active) return true;
  return establishment.active.includes("blood_center");
}

export const MANDATORY_TTI_MARKERS = [
  "HBsAg",
  "AntiHCV",
  "AntiHIV",
  "Syphilis",
  "Malaria",
] as const;

export interface ClearanceEvaluation {
  canClear: boolean;
  isReactive: boolean;
  hasDiscrepancy: boolean;
  missingTests: string[];
  reactiveMarkers: string[];
  discrepancies: string[];
  repeatNeeded: string[];
  suggestedOutcome: "Cleared" | "Reactive" | "Incomplete" | "Discrepant";
}

/**
 * Evaluates donation laboratory tests according to PBTA release criteria (rule:d1b6b7c78b).
 * Requires:
 * 1. All 5 mandatory TTI markers tested and non-reactive.
 * 2. If any marker was initially reactive, a repeat sample from the bag must be recorded.
 * 3. Dual determination for ABO: forward grouping and reverse grouping must agree.
 * 4. RhD determined at least twice and agreeing.
 */
export function evaluateDonationClearance(tests: DonationTestOut[]): ClearanceEvaluation {
  const missingTests: string[] = [];
  const reactiveMarkers: string[] = [];
  const discrepancies: string[] = [];
  const repeatNeeded: string[] = [];

  // Check mandatory TTI markers
  for (const marker of MANDATORY_TTI_MARKERS) {
    const markerTests = tests.filter((t) => t.marker === marker);
    if (markerTests.length === 0) {
      missingTests.push(marker);
      continue;
    }

    const initialTest = markerTests.find((t) => t.sample === "Initial") || markerTests[0];
    if (initialTest.result === "Reactive") {
      reactiveMarkers.push(marker);
      const repeatTest = markerTests.find((t) => t.sample === "Repeat");
      if (!repeatTest) {
        repeatNeeded.push(`${marker} (Repeat on another sample from the bag required)`);
      }
    }
  }

  // Check ABO grouping
  const aboForwardTests = tests.filter((t) => t.marker === "ABOForward");
  const aboReverseTests = tests.filter((t) => t.marker === "ABOReverse");

  if (aboForwardTests.length === 0) {
    missingTests.push("ABO Forward grouping");
  }
  if (aboReverseTests.length === 0) {
    missingTests.push("ABO Reverse grouping");
  }

  if (aboForwardTests.length > 0 && aboReverseTests.length > 0) {
    const forwardResult = aboForwardTests[aboForwardTests.length - 1].result;
    const reverseResult = aboReverseTests[aboReverseTests.length - 1].result;
    if (forwardResult !== reverseResult) {
      discrepancies.push(`ABO Forward (${forwardResult}) disagrees with ABO Reverse (${reverseResult})`);
    }
  }

  // Check RhD grouping
  const rhDTests = tests.filter((t) => t.marker === "RhD");
  if (rhDTests.length < 2) {
    missingTests.push(`RhD determination (recorded ${rhDTests.length}/2 times)`);
  } else {
    const firstRh = rhDTests[0].result;
    const secondRh = rhDTests[1].result;
    if (firstRh !== secondRh) {
      discrepancies.push(`RhD determination #1 (${firstRh}) disagrees with #2 (${secondRh})`);
    }
  }

  const isReactive = reactiveMarkers.length > 0;
  const hasDiscrepancy = discrepancies.length > 0;
  const hasMissing = missingTests.length > 0 || repeatNeeded.length > 0;

  let suggestedOutcome: "Cleared" | "Reactive" | "Incomplete" | "Discrepant";
  if (isReactive) {
    suggestedOutcome = "Reactive";
  } else if (hasDiscrepancy) {
    suggestedOutcome = "Discrepant";
  } else if (hasMissing) {
    suggestedOutcome = "Incomplete";
  } else {
    suggestedOutcome = "Cleared";
  }

  return {
    canClear: !isReactive && !hasDiscrepancy && !hasMissing,
    isReactive,
    hasDiscrepancy,
    missingTests,
    reactiveMarkers,
    discrepancies,
    repeatNeeded,
    suggestedOutcome,
  };
}

/**
 * Validates dual-control credentials for release co-signature (rule:1e77b26ed6).
 * Enforces that the checker is a different user than the currently logged-in user.
 */
export function validateDualControlInput(
  checkerUsername: string,
  checkerPassword: string,
  currentUsername?: string | null
): { valid: boolean; error?: string } {
  const trimmedUser = (checkerUsername || "").trim();
  const trimmedPass = (checkerPassword || "").trim();

  if (!trimmedUser) {
    return { valid: false, error: "Second approver (checker) username is required" };
  }
  if (!trimmedPass) {
    return { valid: false, error: "Second approver (checker) password is required" };
  }
  if (currentUsername && trimmedUser.toLowerCase() === currentUsername.trim().toLowerCase()) {
    return {
      valid: false,
      error: "Dual control violation: Co-signer must be a different authorized staff member (DUAL_CONTROL_SAME_PERSON)",
    };
  }
  return { valid: true };
}

/**
 * Human-readable explanations for blood center release error codes.
 */
export function explainReleaseError(
  code: string,
  details?: Record<string, unknown>
): { title: string; message: string; action: string } {
  switch (code) {
    case "BLOOD_DONATION_TESTS_INCOMPLETE":
      return {
        title: "Mandatory Screening Incomplete",
        message: "Not every mandatory test is recorded yet. All 5 TTI screens and dual ABO/Rh determinations are required.",
        action: "Return to Laboratory screen to complete missing tests or repeats.",
      };
    case "BLOOD_GROUP_DISCREPANCY":
      return {
        title: "Blood Group Discrepancy",
        message: "ABO forward and reverse determinations or duplicate RhD determinations disagree.",
        action: "Send sample back to Laboratory for discrepancy investigation.",
      };
    case "BLOOD_DONATION_REACTIVE":
      return {
        title: "Reactive Screening Marker",
        message: "A screen was confirmed reactive. PBTA standards require recording donation as Reactive and discarding all components.",
        action: "Record donation Reactive; quarantine components will be discarded automatically.",
      };
    case "DUAL_CONTROL_SAME_PERSON":
      return {
        title: "Dual Control Policy Refusal",
        message: "The second approver must be a different person holding blood_center.process or blood_center.release.",
        action: "Have a second authorized verifier or laboratory administrator log in to co-sign.",
      };
    case "STEP_UP_REQUIRED":
      return {
        title: "Verification Co-Signature Required",
        message: "A second authorized person must co-sign this release into blood bank inventory.",
        action: "Provide valid credentials for an authorized co-signer.",
      };
    case "BLOOD_CENTER_SOURCE_REQUIRED":
      return {
        title: "Own Blood Center Source Missing",
        message: "The blood center's own licensed source (kind OwnBloodCenter) must be configured first in Facility Blood Sources (rule:bd509b7d5a).",
        action: "Ask the Laboratory Administrator to add the center's OwnBloodCenter source with licence number.",
      };
    case "BLOOD_UNIT_EXPIRED":
      return {
        title: "Component Expired",
        message: "The component shelf life has expired while in quarantine. Expired units cannot be released to inventory.",
        action: "Discard the expired component with reason Expired.",
      };
    case "BLOOD_COMPONENT_STATE":
      return {
        title: "Component Not In Quarantine",
        message: `The component is already ${String(details?.status || "released or discarded")}.`,
        action: "Refresh the component list to inspect updated inventory status.",
      };
    case "CAPABILITY_INACTIVE":
      return {
        title: "Blood Center Inactive",
        message: "Blood center service is inactive at this facility. No new inventory releases can be performed.",
        action: "Check Facility service status in Settings.",
      };
    case "ACCOUNT_LOCKED":
      return {
        title: "Account Temporarily Locked",
        message: "Too many failed co-signature attempts. The checker account is temporarily locked.",
        action: "Wait for the retry timeout or use another authorized co-signer.",
      };
    default:
      return {
        title: "Release Refused",
        message: "The server refused the release request.",
        action: "Check the details and retry.",
      };
  }
}
