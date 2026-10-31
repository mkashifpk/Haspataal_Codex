// Domain policies for Screen 98: Critical results of my patients (critical_results_er)
// Covers rule:abc8a2c23d (Filter by admission_id or open_only=true, is_overdue in red, phone/read-back tracking)
// Covers rule:9ef18690f5 (Emergency department service view gating via establishment.views.screens)

import type { CriticalResultOut } from "./generated/critical_results_er";

export interface CriticalResultsErAccess {
  canView: boolean;
  isRetiring: boolean;
  isRecordsOnly: boolean;
  isDenied: boolean;
  view: string;
  banner: { en: string; ur: string } | null;
}

export function evaluateCriticalResultsErView(
  establishment?: { views?: { screens?: Array<{ screen_id: string; view: string }> } },
  permissions: string[] = []
): CriticalResultsErAccess {
  const screenView =
    establishment?.views?.screens?.find((s) => s.screen_id === "critical_results_er")
      ?.view || "full";

  if (screenView === "hidden" || screenView === "setup") {
    return {
      canView: false,
      isRetiring: false,
      isRecordsOnly: false,
      isDenied: true,
      view: screenView,
      banner: null,
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
    view: screenView,
    banner:
      screenView === "open_work"
        ? {
            en: "No new critical results from now on",
            ur: "اب سے نئے ہنگامی نتائج موصول نہیں ہوں گے",
          }
        : screenView === "records"
        ? {
            en: "Records Only Mode — Critical results history",
            ur: "صرف ریکارڈز موڈ — ہنگامی نتائج کی تاریخ",
          }
        : null,
  };
}

export function canViewCriticalResults(permissions: string[] = []): boolean {
  return (
    permissions.includes("diagnostics.critical.view") ||
    permissions.includes("patient.view")
  );
}

export interface CriticalFilterOptions {
  admissionId?: number | null;
  ticketId?: number | null;
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
    if (options.ticketId !== undefined && options.ticketId !== null) {
      if (item.ticket_id !== options.ticketId) return false;
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

export function isCriticalResultOverdue(item: {
  is_overdue?: boolean;
  status?: string;
  communicate_due_at?: string | null;
}, now: Date = new Date()): boolean {
  if (item.status === "Acknowledged") return false;
  if (item.is_overdue === true) return true;
  if (item.communicate_due_at) {
    return now.getTime() > new Date(item.communicate_due_at).getTime();
  }
  return false;
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
