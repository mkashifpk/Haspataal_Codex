import type { MyBedOut } from "./generated/my_beds";
export const myBedKey = (b: MyBedOut) => `${b.roster_id}:${b.bed_id}`;
export const myBedSnapshot = (b: MyBedOut) =>
  JSON.stringify([
    b.roster_id,
    b.bed_id,
    b.ward_id,
    b.admission_id,
    b.current_state,
  ]);
export const myBedsReadable = (
  view: string | undefined,
  permissions: string[],
) =>
  ["full", "open_work", "records"].includes(view || "") &&
  permissions.includes("ipd.flowsheet.record");
export const canCleanMyBed = (
  b: MyBedOut,
  view: string | undefined,
  permissions: string[],
) =>
  ["full", "open_work"].includes(view || "") &&
  permissions.includes("ipd.bed.mark_cleaned") &&
  ["Dirty", "Cleaning"].includes(b.current_state);
export function urgentBeds(
  rows: MyBedOut[],
  overdue: Record<number, boolean | undefined>,
) {
  return [...rows].sort(
    (a, b) =>
      Number(!!(b.admission_id && overdue[b.admission_id])) -
        Number(!!(a.admission_id && overdue[a.admission_id])) ||
      Number(b.doses_due_next_hour > 0) - Number(a.doses_due_next_hour > 0) ||
      b.doses_due_next_hour - a.doses_due_next_hour ||
      a.ward_name.localeCompare(b.ward_name) ||
      a.bed_label.localeCompare(b.bed_label) ||
      a.roster_id - b.roster_id,
  );
}
