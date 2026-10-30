// Domain policies for Screen 70: Critical results of my patients (critical_results_ward)
// Covers rule:abc8a2c23d (Filter by admission_id or open_only=true, is_overdue in red, phone/read-back tracking)
// Covers rule:08c9ac4f44 (Inpatient service view gating via establishment.views.screens)

import type { CriticalResultOut } from "./generated/critical_results_ward";

export interface CriticalResultsWardAccess {
  canView: boolean;
  isRetiring: boolean;
  isRecordsOnly: boolean;
  isDenied: boolean;
}

export function criticalResultsWardAccess(
  permissions: string[] = [],
  screenView: string = "full"
): CriticalResultsWardAccess {
  if (screenView === "hidden" || screenView === "setup") {
    return {
      canView: false,
      isRetiring: false,
      isRecordsOnly: false,
      isDenied: true,
    };
  }

  const isRecordsOnly = screenView === "records";
  const isRetiring = screenView === "open_work";

  const hasPerm = (p: string) => permissions.includes(p);

  const canView = hasPerm("diagnostics.critical.view") || hasPerm("patient.view");

  return {
    canView,
    isRetiring,
    isRecordsOnly,
    isDenied: !canView,
  };
}

export interface CriticalFilterOptions {
  admissionId?: number | null;
  openOnly?: boolean;
  source?: "Lab" | "Imaging" | null;
}

export function filterCriticalResults(
  items: CriticalResultOut[],
  options: CriticalFilterOptions
): CriticalResultOut[] {
  return items.filter((item) => {
    if (options.admissionId !== undefined && options.admissionId !== null) {
      if (item.admission_id !== options.admissionId) return false;
    }
    if (options.openOnly) {
      if (item.status === "Acknowledged") return false;
    }
    if (options.source && item.source !== options.source) {
      return false;
    }
    return true;
  });
}

export function getCriticalStatusBadge(
  status: "Open" | "Communicated" | "Acknowledged",
  isOverdue: boolean
): { label: string; tone: "danger" | "warning" | "info" | "positive"; alertText: string } {
  if (isOverdue && status !== "Acknowledged") {
    return {
      label: "OVERDUE",
      tone: "danger",
      alertText: "Communication or action is past deadline!",
    };
  }

  switch (status) {
    case "Open":
      return {
        label: "Open",
        tone: "danger",
        alertText: "Critical result received — inform the responsible doctor immediately.",
      };
    case "Communicated":
      return {
        label: "Communicated",
        tone: "info",
        alertText: "Clinician notified — awaiting clinical acknowledgement.",
      };
    case "Acknowledged":
      return {
        label: "Acknowledged",
        tone: "positive",
        alertText: "Doctor has reviewed and recorded action taken.",
      };
    default:
      return {
        label: status,
        tone: "info",
        alertText: "",
      };
  }
}
