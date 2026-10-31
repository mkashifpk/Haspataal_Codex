import type { EstablishmentOut } from "./generated/facility_profile";
import type { RxItemIn, VerbalOrderIn } from "./generated/verbal_orders_er";

export function evaluateVerbalOrdersErView(establishment?: { views?: { screens?: Array<{ screen_id: string; view: string }> } }) {
  const view = establishment?.views?.screens?.find((s) => s.screen_id === "verbal_orders_er")?.view || "full";
  return {
    view,
    isFull: view === "full",
    isOpenWork: view === "open_work",
    isRecords: view === "records",
    isHidden: view === "hidden",
    canStartNew: view === "full",
    banner:
      view === "open_work"
        ? {
            en: "No new verbal orders from now on",
            ur: "اب سے کوئی نیا زبانی حکم نہیں",
          }
        : view === "records"
        ? {
            en: "Records — verbal orders history only",
            ur: "ریکارڈز — صرف زبانی احکام کی تاریخ",
          }
        : null,
  };
}

export function canRecordVerbal(permissions: string[] = []): boolean {
  return permissions.includes("prescription.verbal.record");
}

export function canViewVerbalOrders(permissions: string[] = []): boolean {
  return (
    permissions.includes("prescription.verbal.record") ||
    permissions.includes("prescription.view")
  );
}

export function canSearchDrugs(permissions: string[] = []): boolean {
  return permissions.includes("pharmacy.formulary.view");
}

export function isDispensingActive(activeServices: string[] = []): boolean {
  return activeServices.includes("dispensing");
}

export function validateVerbalOrderTarget(target: {
  patient_id?: number | null;
  ticket_id?: number | null;
  admission_id?: number | null;
  source?: string | null;
  is_deceased?: boolean | null;
}): boolean {
  if (target.is_deceased) {
    throw Error(
      "VERBAL_ORDER_INVALID: Patient is deceased; cannot record verbal orders.",
    );
  }
  if (!target.ticket_id && !target.admission_id) {
    throw Error(
      "VERBAL_ORDER_INVALID: Verbal orders are permitted only for an inpatient (admission_id) or an emergency patient (ticket_id); never an outpatient.",
    );
  }
  if (target.source === "OPD") {
    throw Error(
      "VERBAL_ORDER_INVALID: Outpatient verbal orders are strictly prohibited.",
    );
  }
  return true;
}

export function validateVerbalOrderLineSafety(line: {
  drug?: { high_alert_category?: string | null; lasa_with?: string[] } | null;
  external_drug_name?: string | null;
  destination?: "HospitalPharmacy" | "ExternalMarket";
}): boolean {
  if (line.drug?.high_alert_category === "Chemotherapy") {
    throw Error(
      "VERBAL_ORDER_INVALID: Chemotherapy cannot be a verbal order. Ask the doctor to write it.",
    );
  }
  return true;
}

export function isVerbalOrderOverdue(
  order: {
    countersigned_at?: string | null;
    is_overdue?: boolean;
    countersign_due_at?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (order.countersigned_at) return false;
  if (order.is_overdue === true) return true;
  if (order.countersign_due_at) {
    return now.getTime() > new Date(order.countersign_due_at).getTime();
  }
  return false;
}
