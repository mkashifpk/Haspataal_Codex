import type {
  LabScanOut,
  MetricGridOut,
  IdentityIn,
  SampleRejectIn,
} from "./generated/lab_bench";
export function metricValue(metric: MetricGridOut, raw: string) {
  if (!raw.trim()) {
    if (metric.required === true)
      throw Error("Complete the required result fields.");
    return undefined;
  }
  if (metric.type === "text") return raw.trim();
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()) ||
    !Number.isFinite(Number(raw))
  )
    throw Error("Enter a valid finite numeric result.");
  return Number(raw);
}
export function metricFlag(metric: MetricGridOut, raw: string) {
  let v;
  try {
    v = metricValue(metric, raw);
  } catch {
    return "Invalid";
  }
  if (v === undefined) return "";
  if (typeof v === "string")
    return metric.critical?.values?.includes(v) ? "C" : "N";
  if (metric.critical?.low != null && v < metric.critical.low) return "CL";
  if (metric.critical?.high != null && v > metric.critical.high) return "CH";
  if (metric.reference_range?.length === 2) {
    if (v < metric.reference_range[0]) return "L";
    if (v > metric.reference_range[1]) return "H";
  }
  return "N";
}
export function benchMetrics(
  grid: MetricGridOut[],
  draft: Record<string, string>,
) {
  const metrics: Record<string, unknown> = {};
  for (const m of grid) {
    const v = metricValue(m, draft[m.key] || "");
    if (v !== undefined) metrics[m.key] = v;
  }
  if (!Object.keys(metrics).length)
    throw Error("Enter at least one result value.");
  return metrics;
}
export function benchIdentity(
  mode: string,
  code: string,
  note: string,
  asked: boolean,
  emergency: boolean,
): IdentityIn {
  if (note.trim().length > 300)
    throw Error("Identity note must be at most 300 characters.");
  if (mode === "WristbandScan") {
    if (!code.trim() || code.trim().length > 80)
      throw Error("Scan the actual patient wristband.");
    return { wristband_code: code.trim() };
  }
  if (mode === "TwoIdentifiers" && asked)
    return {
      identity_check: "TwoIdentifiers",
      ...(note.trim() ? { identity_note: note.trim() } : {}),
    };
  if (mode === "EmergencyOverride" && emergency && note.trim())
    return { identity_check: "EmergencyOverride", identity_note: note.trim() };
  throw Error(
    "Identify the patient first; emergency override needs a factual note.",
  );
}
export function benchRejection(code: string, note: string): SampleRejectIn {
  if (
    ![
      "Haemolysed",
      "Clotted",
      "InsufficientVolume",
      "WrongContainer",
      "Unlabelled",
      "Mislabelled",
      "Leaked",
      "DelayedTransport",
      "Contaminated",
      "RejectedByPartner",
      "Other",
    ].includes(code) ||
    note.trim().length > 500 ||
    (code === "Other" && !note.trim())
  )
    throw Error("Choose the rejection reason; Other needs a note.");
  return {
    code: code as SampleRejectIn["code"],
    ...(note.trim() ? { note: note.trim() } : {}),
  };
}
export function benchSnapshot(s: LabScanOut) {
  return JSON.stringify([
    s.sample.sample_id,
    s.sample.barcode,
    s.sample.status,
    s.sample.row_version,
    s.item.lab_requisition_item_id,
    s.item.status,
    s.item.row_version,
    s.patient.patient_id,
    s.patient.mrn,
    s.metric_grid,
    s.previous_results.map((r) => [r.result_id, r.status]),
  ]);
}
export const sameBenchSample = (s: LabScanOut, a: LabScanOut) =>
  s.sample.sample_id === a.sample.sample_id &&
  s.sample.barcode === a.sample.barcode &&
  s.item.lab_requisition_item_id === a.item.lab_requisition_item_id &&
  s.patient.patient_id === a.patient.patient_id;
export const benchWritable = (
  permissions: string[],
  permission: string,
  view: string,
) => permissions.includes(permission) && ["full", "open_work"].includes(view);
