import type {
  PartnerOut,
  OutsourceIn,
  ExternalReportIn,
} from "./generated/imaging_outsourced";
import type { ImagingOrderDetailOut } from "./generated/radiology_worklist";
export function outsourcedAccess(
  view: string | undefined,
  permissions: string[],
) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  const update = permissions.includes("imaging.order.update");
  return {
    visible,
    read: visible && permissions.includes("imaging.order.view"),
    list: visible && view !== "records" && update,
    write: visible && view !== "records" && update,
  };
}
export const imagingPartnerEligible = (p: PartnerOut | undefined) =>
  !!p &&
  p.is_active &&
  !p.mou_expired &&
  ["Imaging", "Both"].includes(p.services);
export const outsourceAllowed = (status: string) =>
  ["Ordered", "Scheduled"].includes(status);
export const partnerSnapshot = (p: PartnerOut) => JSON.stringify(p);
export function outsourceBody(
  partner: PartnerOut | undefined,
  note: string,
  checked: boolean,
): OutsourceIn {
  if (!imagingPartnerEligible(partner))
    throw Error("Choose an active imaging partner with a valid MOU.");
  if (!checked)
    throw Error(
      "Check the patient, order and partner agreement before sending.",
    );
  if (note.trim().length > 500)
    throw Error("The outsourcing note is limited to 500 characters.");
  return {
    partner_id: partner!.partner_id,
    ...(note.trim() ? { note: note.trim() } : {}),
  };
}
export function externalReportBody(
  report: string,
  reporter: string,
  reportedAt: string,
  finding: string,
  note: string,
  checked: boolean,
): ExternalReportIn {
  if (!checked)
    throw Error(
      "Match the partner report to this patient and order, and verify the reporter name and registration first.",
    );
  if (report.trim().length < 3 || report.trim().length > 20000)
    throw Error("Enter the partner report (3–20000 characters).");
  if (reporter.trim().length < 3 || reporter.trim().length > 200)
    throw Error(
      "Enter the partner radiologist name and registration (3–200 characters).",
    );
  if (
    reportedAt &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(reportedAt)
  )
    throw Error("Enter a valid hospital date and time.");
  if (note.trim().length > 1000)
    throw Error("The critical finding note is limited to 1000 characters.");
  if (
    finding &&
    (!/^\d+$/.test(finding) ||
      !Number.isSafeInteger(Number(finding)) ||
      Number(finding) < 1)
  )
    throw Error("Choose an actual critical finding from the list.");
  return {
    report_text: report.trim(),
    external_reporter: reporter.trim(),
    ...(reportedAt ? { reported_at: reportedAt } : {}),
    ...(finding ? { critical_finding_id: Number(finding) } : {}),
    ...(note.trim() ? { critical_finding_note: note.trim() } : {}),
  };
}
export function outsourcedSnapshot(o: ImagingOrderDetailOut) {
  return JSON.stringify([
    o.imaging_order_id,
    o.patient_id,
    o.mrn,
    o.patient_name,
    o.row_version,
    o.status,
    o.partner_id,
    o.outsourced_at,
    o.reported_at,
    o.external_reporter,
    o.report_text,
  ]);
}
