import type { RxItemIn } from "./generated/verbal_orders_ward";
export const medicationRoutes = [
  "Oral",
  "IV",
  "IM",
  "SC",
  "Topical",
  "Inhaled",
  "PR",
  "SL",
  "Ophthalmic",
  "Otic",
  "Nasal",
  "Other",
] as const;
export const medicationFrequencies = [
  "OD",
  "BD",
  "TDS",
  "QID",
  "Q4H",
  "Q6H",
  "Q8H",
  "Q12H",
  "HS",
  "STAT",
  "PRN",
  "Other",
] as const;
export function validateVerbalLine(line: RxItemIn) {
  const qty = Number(line.qty_prescribed);
  if (!Number.isFinite(qty) || qty <= 0)
    throw Error("Quantity must be positive.");
  if (
    !line.dose_text?.trim() ||
    !line.route ||
    !line.frequency_code ||
    !line.start_at
  )
    throw Error(
      "Record the dose, route, frequency and actual start time as ordered.",
    );
  if (
    line.interval_hours != null &&
    (!Number.isInteger(line.interval_hours) ||
      line.interval_hours < 1 ||
      line.interval_hours > 168)
  )
    throw Error("Interval must be1–168whole hours.");
  if (
    line.duration_days != null &&
    (!Number.isInteger(line.duration_days) ||
      line.duration_days < 1 ||
      line.duration_days > 365)
  )
    throw Error("Duration must be1–365whole days.");
  if (line.end_at && Date.parse(line.end_at) < Date.parse(line.start_at))
    throw Error("End time precedes start time.");
  return line;
}
