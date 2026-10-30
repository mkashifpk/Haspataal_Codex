import type { MarEntryOut } from "./generated/mar";
export const marSnapshot = (r: MarEntryOut) =>
  JSON.stringify([
    r.mar_id,
    r.prescription_item_id,
    r.status,
    r.dose_text,
    r.route,
    r.scheduled_at,
    r.high_alert_category,
    r.lasa_with,
    r.self_administration,
    r.prepared_at,
  ]);
export const marCanWrite = (
  view: string,
  state: string,
  permissions: string[],
  correction = false,
) =>
  (correction
    ? ["full", "open_work", "records"].includes(view)
    : ["full", "open_work"].includes(view) &&
      ["Admitted", "DischargeInProgress", "CodeRedActive"].includes(state)) &&
  permissions.includes("ipd.mar.administer");
export const marStopCodes = ["PATIENT_IDENTITY_MISMATCH", "DRUG_MISMATCH"];
export const marRereadCodes = [
  "MAR_STATE_INVALID",
  "MEDICATION_ORDER_STOPPED",
  "MEDICATION_ORDER_INVALID",
  "REFERENCE_NOT_FOUND",
  "DOSE_NOT_PREPARED",
  "BATCH_EXPIRED",
  "BATCH_RECALLED",
  "INSUFFICIENT_STOCK",
  "DISCHARGE_STAGE_IMMUTABLE",
  "DISCHARGE_STAGE_OUT_OF_ORDER",
  "DISCHARGE_NOT_ALLOWED",
  "OWN_MEDICINES_HELD",
  "ADMINISTRATION_NOT_AUTHORIZED",
  ...marStopCodes,
];
