import type {
  WristbandIn,
  WristbandOut,
} from "./generated/wristbands_admissions";
export type BandStay = {
  kind: "admission" | "er";
  id: number;
  patient_id: number;
  name: string;
  mrn: string;
  number: string;
  status: string;
  ward?: string | null;
  bed?: string | null;
};
export const bandScope = (s: BandStay) =>
  s.kind === "admission" ? { admission_id: s.id } : { er_visit_id: s.id };
export const bandHistoryKey = (rows: WristbandOut[]) =>
  JSON.stringify(
    rows.map((r) => [
      r.wristband_id,
      r.row_version,
      r.is_current,
      r.replaced_at,
    ]),
  );
export const bandPersonKey = (p: {
  patient_id: number;
  mrn: string;
  full_name: string;
  dob?: string | null;
  gender?: string | null;
  allergies?: string | null;
  row_version?: number;
}) =>
  JSON.stringify([
    p.patient_id,
    p.mrn,
    p.full_name,
    p.dob,
    p.gender,
    p.allergies,
    p.row_version,
  ]);
export function bandAccess(view: string | undefined, permissions: string[]) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  return {
    read: visible && permissions.includes("patient.view"),
    issue:
      visible &&
      view !== "records" &&
      permissions.includes("patient.wristband.print"),
    print: visible && permissions.includes("patient.wristband.print"),
    worklist: visible && permissions.some(p=>['medication.safety.view','patient.wristband.print'].includes(p)),
  };
}
export function bandBody(
  s: BandStay,
  rows: WristbandOut[],
  reason: string,
  ack: boolean,
): WristbandIn {
  if (
    !Number.isSafeInteger(s.id) ||
    s.id < 1 ||
    !Number.isSafeInteger(s.patient_id) ||
    s.patient_id < 1 ||
    !s.name ||
    !s.mrn
  )
    throw Error("Read and select the actual patient stay first.");
  if (!ack) throw Error("Confirm the patient and stay before issuing a band.");
  const text = reason.trim();
  if (text.length > 300)
    throw Error("Replacement reason must be at most 300 characters.");
  if (rows.some((r) => r.patient_id !== s.patient_id))
    throw Error("The wristband history belongs to another patient.");
  if (rows.some((r) => r.is_current) && !text)
    throw Error(
      "A current band exists. Enter why it must be replaced, or reprint the same band.",
    );
  return { ...bandScope(s), ...(text ? { replacement_reason: text } : {}) };
}
export const bandScanCode = (code: string) => {
  const s = code.trim();
  if (s.length < 3 || s.length > 80)
    throw Error("Scan a patient wristband (3–80 characters).");
  return s;
};
