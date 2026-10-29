export const vitalFields = [
  ["bp_systolic", "Systolic BP", "سسٹولک فشار", 30, 300, true],
  ["bp_diastolic", "Diastolic BP", "ڈائسٹولک فشار", 10, 200, true],
  ["heart_rate", "Heart rate", "نبض", 10, 300, true],
  ["temp_c", "Temperature °C", "درجہ حرارت °C", 25, 45, false],
  ["spo2", "SpO₂ %", "آکسیجن %", 30, 100, true],
  ["respiratory_rate", "Respiratory rate", "تنفس", 2, 80, true],
  ["pain_score", "Pain score", "درد اسکور", 0, 10, true],
  ["blood_glucose", "Blood glucose", "خون میں گلوکوز", 10, 1000, false],
] as const;
export function vitalBody(values: Record<string, string>) {
  const body: Record<string, number | null> = {};
  for (const [key, label, , min, max, integer] of vitalFields) {
    const text = values[key] ?? "";
    if (text === "") {
      body[key] = null;
      continue;
    }
    const value = Number(text);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw Error(`${label}: ${min}–${max}${integer ? " (whole number)" : ""}`);
    body[key] = value;
  }
  return body;
}
export const flowsheetWritable = (
  view: string,
  state: string,
  permissions: string[],
  schedule = false,
  correction = false,
) =>
  (correction
    ? ["full", "open_work", "records"].includes(view)
    : ["full", "open_work"].includes(view) &&
      ["Admitted", "DischargeInProgress", "CodeRedActive"].includes(state)) &&
  (schedule
    ? permissions.some((p) =>
        ["ipd.flowsheet.record", "ipd.admission.request"].includes(p),
      )
    : permissions.includes("ipd.flowsheet.record"));
export const scheduleSnapshot = (
  s:
    | {
        schedule_id: number;
        row_version: number;
        interval_minutes: number;
        is_active: boolean;
      }
    | null
    | undefined,
) =>
  JSON.stringify(
    s ? [s.schedule_id, s.row_version, s.interval_minutes, s.is_active] : null,
  );
