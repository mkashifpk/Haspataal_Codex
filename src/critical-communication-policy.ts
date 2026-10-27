import type {
  CommunicationIn,
  CriticalResultDetailOut,
  DiagnosticsWorklistItemOut,
} from "./generated/critical_results_bench";
export const communicationMeans = [
  "Telephone",
  "InPerson",
  "Written",
  "Electronic",
] as const;
export const recipientRoles = [
  "RequestingDoctor",
  "TreatingDoctor",
  "OnCallDoctor",
  "WardNurse",
  "Patient",
  "Attendant",
  "HealthAuthority",
] as const;
export const requiresReadBack = (means: string) =>
  means === "Telephone" || means === "InPerson";
export const criticalSource = (screenId: string): "Lab" | "Imaging" =>
  screenId === "critical_results_radiology" ? "Imaging" : "Lab";
export function communicationBody(
  means: string,
  role: string,
  name: string,
  readBack: boolean,
  note: string,
  actuallyTold: boolean,
): CommunicationIn {
  if (
    !communicationMeans.includes(means as CommunicationIn["means"]) ||
    !recipientRoles.includes(role as CommunicationIn["recipient_role"])
  )
    throw Error("Choose the actual means and recipient role.");
  if (!actuallyTold)
    throw Error(
      "Tell the recipient first, then confirm that this records a completed communication.",
    );
  if (name.trim().length < 2 || name.trim().length > 200)
    throw Error(
      "Enter the actual recipient name and designation (2–200 characters).",
    );
  if (requiresReadBack(means) && !readBack)
    throw Error(
      "Telephone and in-person communication require the recipient to read the result back.",
    );
  if (note.trim().length > 1000)
    throw Error("The communication note is limited to 1000 characters.");
  return {
    means: means as CommunicationIn["means"],
    recipient_role: role as CommunicationIn["recipient_role"],
    recipient_name: name.trim(),
    read_back: readBack,
    ...(note.trim() ? { note: note.trim() } : {}),
  };
}
export const criticalAccess = (permissions: string[], view: string) => ({
  read:
    permissions.includes("diagnostics.critical.view") &&
    ["full", "open_work", "records"].includes(view),
  work:
    permissions.includes("diagnostics.critical.view") &&
    ["full", "open_work"].includes(view),
  communicate:
    permissions.includes("diagnostics.critical.view") &&
    permissions.includes("diagnostics.critical.communicate") &&
    ["full", "open_work"].includes(view),
});
export function criticalSnapshot(r: CriticalResultDetailOut): string {
  return JSON.stringify([
    r.critical_result_id,
    r.source,
    r.result_id,
    r.imaging_order_id,
    r.requisition_id,
    r.patient_id,
    r.mrn,
    r.test_name,
    r.finding,
    r.row_version,
    r.status,
    r.authority_pending,
    r.notifiable_disease,
    r.communicate_due_at,
    r.communications.map((c) => c.communication_id),
  ]);
}
export const benchCriticalWork = (rows: DiagnosticsWorklistItemOut[], source: "Lab" | "Imaging" = "Lab") =>
  rows.filter(
    (r) =>
      r.area === source &&
      ["CriticalToCommunicate", "PriorityDiseaseToNotify"].includes(r.kind),
  );
export function criticalFilters(limit: string, from: string, to: string) {
  if (
    !/^\d+$/.test(limit) ||
    !Number.isSafeInteger(Number(limit)) ||
    Number(limit) < 1 ||
    Number(limit) > 1000
  )
    throw Error("Choose a result limit from 1 to 1000.");
  for (const date of [from, to])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw Error("Choose valid dates.");
  if (from && to && from > to)
    throw Error("The start date must not follow the end date.");
  return {
    limit: Number(limit),
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
  };
}
