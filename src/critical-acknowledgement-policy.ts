import type {
  AcknowledgeIn,
  CriticalResultDetailOut,
  DiagnosticsWorklistItemOut,
} from "./generated/critical_results_doctor";
export const doctorCriticalAccess = (permissions: string[], view: string) => ({
  read:
    permissions.includes("diagnostics.critical.view") &&
    ["full", "open_work", "records"].includes(view),
  work:
    permissions.includes("diagnostics.critical.view") &&
    ["full", "open_work"].includes(view),
  acknowledge:
    permissions.includes("diagnostics.critical.view") &&
    permissions.includes("diagnostics.critical.acknowledge") &&
    ["full", "open_work"].includes(view),
});
export function acknowledgementBody(
  record: CriticalResultDetailOut,
  action: string,
): AcknowledgeIn {
  if (record.status === "Acknowledged")
    throw Error(
      "This result is already acknowledged and final. Read its recorded action; do not submit again.",
    );
  if (!Number.isSafeInteger(record.row_version) || record.row_version < 1)
    throw Error("A current server version is required. Refresh this result.");
  const action_taken = action.trim();
  if (action_taken.length < 3 || action_taken.length > 2000)
    throw Error("Describe the actual action taken (3–2000 characters).");
  return { action_taken, expected_version: record.row_version };
}
export const acknowledgementSnapshot = (r: CriticalResultDetailOut) =>
  JSON.stringify([
    r.critical_result_id,
    r.patient_id,
    r.source,
    r.result_id,
    r.mrn,
    r.test_name,
    r.finding,
    r.row_version,
    r.status,
    r.authority_pending,
    r.notifiable_disease,
    r.communicate_due_at,
    r.communications.map((c) => c.communication_id),
    r.requisition_id,
    r.imaging_order_id,
    r.acknowledged_by,
    r.acknowledged_at,
    r.action_taken,
  ]);
export const doctorCriticalWork = (rows: DiagnosticsWorklistItemOut[]) =>
  rows.filter(
    (r) =>
      r.kind === "CriticalToAcknowledge" &&
      Number.isSafeInteger(r.critical_result_id) &&
      r.critical_result_id! > 0,
  );
export function criticalReport(
  r: CriticalResultDetailOut,
  permissions: string[],
) {
  const id = r.source === "Lab" ? r.requisition_id : r.imaging_order_id;
  const allowed =
    r.source === "Lab"
      ? permissions.some((p) =>
          ["lab.requisition.view", "lab.result.view"].includes(p),
        )
      : permissions.includes("imaging.order.view");
  if (!id || !Number.isSafeInteger(id) || id < 1 || !allowed) return undefined;
  return {
    id,
    kind: r.source === "Lab" ? "lab" : "imaging",
    path:
      r.source === "Lab"
        ? `/lab/requisitions/${id}/report/pdf`
        : `/imaging/orders/${id}/report/pdf`,
  };
}
