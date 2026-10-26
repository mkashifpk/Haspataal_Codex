import type {
  PartnerOut,
  SendOutPendingOut,
  SendOutIn,
  SendOutItemOut,
} from "./generated/lab_send_outs";
import type { LabScanOut } from "./generated/lab_bench";
export const sendOutAccess = (permissions: string[], view: string) => ({
  read:
    ["full", "open_work", "records"].includes(view) &&
    permissions.some((p) =>
      ["lab.sendout.manage", "diagnostics.quality.view"].includes(p),
    ),
  work:
    ["full", "open_work"].includes(view) &&
    permissions.includes("lab.sendout.manage"),
  result:
    ["full", "open_work"].includes(view) &&
    permissions.some((p) =>
      ["lab.sendout.manage", "diagnostics.quality.view"].includes(p),
    ) &&
    permissions.includes("lab.result.enter"),
  print:
    ["full", "open_work", "records"].includes(view) &&
    permissions.includes("lab.sendout.manage"),
});
export const partnerEligible = (p: PartnerOut) =>
  p.is_active && !p.mou_expired && ["Lab", "Both"].includes(p.services);
export function dispatchBody(
  partner: PartnerOut | undefined,
  ids: number[],
  pending: SendOutPendingOut[],
  courier: string,
  note: string,
): SendOutIn {
  if (!partner || !partnerEligible(partner))
    throw Error("Choose an active laboratory partner with a valid MOU.");
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !pending.some((p) => p.sample_id === id),
    )
  )
    throw Error("Select current pending samples for this dispatch.");
  if (courier.trim().length > 200 || note.trim().length > 500)
    throw Error("Courier is limited to200characters and note to500characters.");
  return {
    partner_id: partner.partner_id,
    sample_ids: [...ids],
    ...(courier.trim() ? { courier: courier.trim() } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  };
}
export const pendingSnapshot = (r: SendOutPendingOut) =>
  JSON.stringify([
    r.sample_id,
    r.barcode,
    r.sample_status,
    r.collected_at,
    r.received_at,
    r.lab_requisition_item_id,
    r.item_status,
    r.requisition_id,
    r.mrn,
    r.partner_id,
  ]);
export const manifestItemSnapshot = (r: SendOutItemOut) =>
  JSON.stringify([
    r.sample_id,
    r.barcode,
    r.sample_status,
    r.lab_requisition_item_id,
    r.item_status,
    r.requisition_id,
    r.mrn,
    r.result_entered_at,
    r.partner_report_ref,
    r.partner_reported_at,
    r.rejection_code,
  ]);
export function assertManifestSample(
  scan: LabScanOut,
  item: SendOutItemOut,
  manifestId: number,
) {
  if (
    scan.sample.sample_id !== item.sample_id ||
    scan.sample.barcode !== item.barcode ||
    scan.sample.send_out_id !== manifestId ||
    scan.item.lab_requisition_item_id !== item.lab_requisition_item_id ||
    scan.patient.mrn !== item.mrn
  )
    throw Error(
      "Sample and manifest identity differ. Refresh before proceeding.",
    );
  if (
    scan.sample.status !== "Dispatched" ||
    scan.item.status !== "Processing" ||
    item.result_entered_at
  )
    throw Error(
      "This partner sample is no longer awaiting a result or rejection. Refresh its current state.",
    );
}
export function partnerReportFields(
  reference: string,
  reportedAt: string,
  interpretation: string,
) {
  if (!reference.trim() || reference.trim().length > 100 || !reportedAt)
    throw Error("Enter the partner report reference and reporting time.");
  if (interpretation.trim().length > 4000)
    throw Error("Interpretation is limited to4000characters.");
  return {
    partner_report_ref: reference.trim(),
    partner_reported_at: reportedAt,
    ...(interpretation.trim() ? { interpretation: interpretation.trim() } : {}),
  };
}
export function sendOutLimit(raw: string) {
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1 ||
    Number(raw) > 500
  )
    throw Error("Choose a manifest limit from1to500.");
  return Number(raw);
}
