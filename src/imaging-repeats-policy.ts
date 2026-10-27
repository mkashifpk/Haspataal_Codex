import type { RepeatIn } from "./generated/imaging_repeats";
import type { ImagingOrderDetailOut } from "./generated/radiology_worklist";
export const repeatReasons = [
  "Positioning",
  "PatientMotion",
  "ExposureFactors",
  "Artefact",
  "EquipmentFault",
  "ProcessingError",
  "WrongPatientOrSite",
  "Other",
] as const;
export const repeatStageAllowed = (status: string) =>
  ["InProgress", "Completed", "Reported"].includes(status);
export function repeatAccess(view: string | undefined, permissions: string[]) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  return {
    visible,
    register:
      visible &&
      permissions.some((x) =>
        ["imaging.order.update", "diagnostics.quality.view"].includes(x),
      ),
    read: visible && permissions.includes("imaging.order.view"),
    work:
      visible &&
      view !== "records" &&
      permissions.includes("imaging.order.update"),
  };
}
export function repeatBody(
  reason: string,
  exposures: string,
  note: string,
  matched: boolean,
): RepeatIn {
  if (!matched)
    throw Error(
      "Match the patient and order and confirm that the repeated exposure already occurred.",
    );
  if (!repeatReasons.includes(reason as RepeatIn["reason"]))
    throw Error("Choose the actual reason for the repeated exposure.");
  if (
    !/^\d+$/.test(exposures) ||
    !Number.isSafeInteger(Number(exposures)) ||
    Number(exposures) < 1 ||
    Number(exposures) > 20
  )
    throw Error("Enter a whole number of repeated exposures from 1 to 20.");
  if (note.trim().length > 500)
    throw Error("The repeat note is limited to 500 characters.");
  if (reason === "Other" && !note.trim())
    throw Error("Other requires a note explaining the repeated exposure.");
  return {
    reason: reason as RepeatIn["reason"],
    exposures: Number(exposures),
    ...(note.trim() ? { note: note.trim() } : {}),
  };
}
export function repeatPeriod(from: string, to: string) {
  for (const d of [from, to])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw Error("Choose valid start and end dates for the register.");
  if (from > to)
    throw Error("The register start date must not follow the end date.");
  return { date_from: from, date_to: to };
}
// Reconciliation spans both authenticated UTC days and the hospital day, including
// midnight boundaries in timezones ahead of or behind UTC. Never use terminal time.
export function repeatRecoveryPeriod(originalServerDay: string, serverNow: string, hospitalDay: string) {
  const utcDay = serverNow.slice(0, 10);
  repeatPeriod(originalServerDay, originalServerDay);
  repeatPeriod(utcDay, utcDay);
  repeatPeriod(hospitalDay, hospitalDay);
  const days = [originalServerDay, utcDay, hospitalDay].sort();
  return repeatPeriod(days[0], days[2]);
}
export function repeatOrderSnapshot(o: ImagingOrderDetailOut) {
  return JSON.stringify([
    o.imaging_order_id,
    o.patient_id,
    o.patient_name,
    o.mrn,
    o.row_version,
    o.status,
    o.accession_number,
    o.modality,
    o.body_part,
    o.laterality,
    o.partner_id,
    o.reported_at,
  ]);
}
