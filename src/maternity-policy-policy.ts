/**
 * Domain policy and business rules for Maternity Policy & High-Risk Obstetric Guidelines
 * (`maternity_policy`, Screen 82).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS Cat I 26, II A 87, II B and II C 66 (decisions 44).
 * - High-risk conditions catalog starting with PHC manual's 12 standard examples (rule:585417c0ea).
 * - Managed vs Referred determinations and mandatory referral note destinations (rule:585417c0ea, rule:b7a7a7f1e6).
 * - Public high-risk notice PDF display instructions for main entrance and antenatal waiting area (rule:b7a7a7f1e6).
 * - Stakeholder communications compliance: OwnPatients vs Referrers indicator criteria (rule:1e04f5eed7).
 * - Maternity service activation prerequisites: all conditions decided (rule:7ac44a354a).
 */

import type {
  ConditionIn,
  ConditionPatch,
  ObstetricCommunicationIn,
  ObstetricCommunicationOut,
  ObstetricConditionOut,
} from "./generated/maternity_policy";
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
 * Determine screen view mode for `maternity_policy`.
 * maternity_policy is a core quality screen kept whether or not the hospital runs maternity.
 */
export function getMaternityPolicyScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "maternity_policy");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "maternity_policy" in screens) {
    return (screens as Record<string, ScreenView>)["maternity_policy"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the hospital's maternity capability is currently Active.
 * Under rule:b7a7a7f1e6:
 * - When maternity is Active: notice displays Managed cases cared for here, and Referred cases.
 * - When maternity is Inactive: notice declares hospital manages none and refers all cases.
 */
export function isMaternityActive(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  if (!establishment?.active) return false;
  return establishment.active.includes("maternity");
}

export interface ConditionsReadinessSummary {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  decidedCount: number;
  undecidedCount: number;
  managedCount: number;
  referredCount: number;
  fromManualCount: number;
  canActivateMaternity: boolean;
  undecidedConditions: ObstetricConditionOut[];
}

/**
 * Evaluates high-risk conditions readiness for maternity service activation (rule:7ac44a354a).
 * Maternity service can only be activated when every case on the list is decided (Managed or Referred).
 */
export function evaluateConditionsReadiness(
  conditions: ObstetricConditionOut[]
): ConditionsReadinessSummary {
  const activeConditions = conditions.filter((c) => c.is_active);
  const inactiveConditions = conditions.filter((c) => !c.is_active);

  const managed = activeConditions.filter((c) => c.provision === "Managed");
  const referred = activeConditions.filter((c) => c.provision === "Referred");
  const undecided = activeConditions.filter((c) => c.provision === null || c.provision === undefined);
  const fromManual = activeConditions.filter((c) => c.from_manual);

  const canActivate = activeConditions.length > 0 && undecided.length === 0;

  return {
    totalCount: conditions.length,
    activeCount: activeConditions.length,
    inactiveCount: inactiveConditions.length,
    decidedCount: managed.length + referred.length,
    undecidedCount: undecided.length,
    managedCount: managed.length,
    referredCount: referred.length,
    fromManualCount: fromManual.length,
    canActivateMaternity: canActivate,
    undecidedConditions: undecided,
  };
}

export type IndicatorComplianceStatus = "FullyMet" | "PartiallyMet" | "NotMet";

export interface CommunicationsComplianceSummary {
  totalCount: number;
  hasOwnPatients: boolean;
  hasReferrers: boolean;
  status: IndicatorComplianceStatus;
  statusExplanation: string;
}

/**
 * Evaluates MSDS indicator compliance for stakeholder communications (rule:1e04f5eed7).
 * - Both OwnPatients and Referrers communicated: Fully Met.
 * - OwnPatients only (without Referrers): Partially Met.
 * - No communications recorded: Not Met.
 */
export function evaluateCommunicationsCompliance(
  comms: ObstetricCommunicationOut[]
): CommunicationsComplianceSummary {
  const hasOwnPatients = comms.some((c) => c.audience === "OwnPatients");
  const hasReferrers = comms.some((c) => c.audience === "Referrers");

  let status: IndicatorComplianceStatus = "NotMet";
  let statusExplanation = "No communications recorded. Hospital must inform both its patients and referring practitioners/facilities.";

  if (hasOwnPatients && hasReferrers) {
    status = "FullyMet";
    statusExplanation = "Indicator fully met: Communications documented for both hospital patients and referring practitioners.";
  } else if (hasOwnPatients && !hasReferrers) {
    status = "PartiallyMet";
    statusExplanation = "Indicator only partially met: Patients have been informed, but communication to referrers (practitioners & facilities) is missing.";
  } else if (!hasOwnPatients && hasReferrers) {
    status = "PartiallyMet";
    statusExplanation = "Indicator only partially met: Referrers have been informed, but patient-facing notices (boards, banners, brochures) are missing.";
  }

  return {
    totalCount: comms.length,
    hasOwnPatients,
    hasReferrers,
    status,
    statusExplanation,
  };
}

/**
 * Validates condition patch input (rule:585417c0ea).
 */
export function validateConditionPatch(
  patch: ConditionPatch
): { valid: boolean; error?: string } {
  if (patch.expected_version === undefined || patch.expected_version === null || patch.expected_version < 1) {
    return { valid: false, error: "expected_version is required for concurrency protection" };
  }
  if (patch.provision === "Referred" && (!patch.referral_note || !patch.referral_note.trim())) {
    return {
      valid: false,
      error: "Referral note is required when a condition is Referred: document where and how the patient is referred",
    };
  }
  if (patch.name !== undefined && patch.name !== null && patch.name.trim().length < 3) {
    return { valid: false, error: "Condition name must be at least 3 characters" };
  }
  return { valid: true };
}

/**
 * Validates custom condition creation input.
 */
export function validateConditionCreate(
  cond: ConditionIn
): { valid: boolean; error?: string } {
  if (!cond.name || cond.name.trim().length < 3) {
    return { valid: false, error: "Condition name must be at least 3 characters" };
  }
  if (cond.name.trim().length > 200) {
    return { valid: false, error: "Condition name cannot exceed 200 characters" };
  }
  if (cond.provision === "Referred" && (!cond.referral_note || !cond.referral_note.trim())) {
    return {
      valid: false,
      error: "Referral note is required when provision is Referred: specify destination facility or clinic",
    };
  }
  return { valid: true };
}

/**
 * Validates communication record creation (rule:1e04f5eed7).
 */
export function validateCommunicationCreate(
  comm: ObstetricCommunicationIn,
  todayStr = new Date().toISOString().slice(0, 10)
): { valid: boolean; error?: string } {
  if (!comm.communicated_on) {
    return { valid: false, error: "Communication date is required" };
  }
  if (comm.communicated_on > todayStr) {
    return { valid: false, error: "Communication date cannot be in the future" };
  }
  if (!comm.audience) {
    return { valid: false, error: "Audience (OwnPatients or Referrers) is required" };
  }
  if (!comm.means) {
    return { valid: false, error: "Means of communication is required" };
  }
  if ((comm.means === "Letter" || comm.means === "Meeting") && (!comm.recipients || !comm.recipients.trim())) {
    return {
      valid: false,
      error: "Recipients list is required for Letter or Meeting communication (specify practitioners or facilities)",
    };
  }
  if (!comm.summary || comm.summary.trim().length < 3) {
    return { valid: false, error: "Summary must be at least 3 characters" };
  }
  if (comm.summary.trim().length > 2000) {
    return { valid: false, error: "Summary cannot exceed 2000 characters" };
  }
  return { valid: true };
}

/**
 * Domain error explanations for maternity policy.
 */
export function explainMaternityPolicyError(
  code: string,
  details?: Record<string, unknown>
): { title: string; message: string; action: string } {
  switch (code) {
    case "OBSTETRIC_CONDITION_EXISTS":
      return {
        title: "Condition Name Already Exists",
        message: "A high-risk obstetric case with this name is already on the hospital's policy list.",
        action: "Enter a different condition name or edit the existing condition row.",
      };
    case "VERSION_CONFLICT":
      return {
        title: "Concurrent Policy Modification",
        message: "This condition was updated on another terminal or session while you were reviewing it.",
        action: "The screen has refreshed with the latest data. Review the updated record and re-apply your decision.",
      };
    case "FORBIDDEN":
      return {
        title: "Permission Denied",
        message: "Updating high-risk obstetric policy requires the 'maternity.policy.manage' permission.",
        action: "Contact your quality director or hospital administrator to grant policy management access.",
      };
    case "VALIDATION_ERROR":
      return {
        title: "Invalid Input",
        message: "The submitted policy information did not meet validation requirements.",
        action: "Ensure referral notes are provided for Referred conditions, and recipient names are specified for letters/meetings.",
      };
    default:
      return {
        title: "Maternity Policy Action Refused",
        message: "The server refused the policy command.",
        action: "Check the details and retry.",
      };
  }
}
