import type {
  EntryIn,
  EntryPatch,
  RosterEntryOut,
  RosterableStaffOut,
  ShiftPatternOut,
  BedMatrixBedOut,
} from "./generated/duty_roster";
export const rosterManagePermissions = [
  "roster.manage.all",
  "roster.manage.nursing",
  "roster.manage.support",
];
export const rosterReadPermissions = [
  ...rosterManagePermissions,
  "roster.view.all",
];
export const rosterAreas = [
  "Ward",
  "Department",
  "Emergency",
  "OT",
  "Facility",
  "Other",
] as const;
export function rosterDay(day: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day + "T00:00:00Z")) ||
    new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day
  )
    throw Error("Choose a valid duty date.");
  return day;
}
export function rosterAddDays(day: string, count: number) {
  return new Date(Date.parse(rosterDay(day) + "T00:00:00Z") + count * 86400000)
    .toISOString()
    .slice(0, 10);
}
export const rosterIsoDay = (day: string) =>
  new Date(rosterDay(day) + "T00:00:00Z").getUTCDay() || 7;
export const rosterOnLeave = (staff: RosterableStaffOut, day: string) =>
  staff.leave.some((l) => l.from_date <= day && day <= l.to_date);
export function validateDuty(
  entry: EntryIn,
  staff: RosterableStaffOut[],
  patterns: ShiftPatternOut[],
  beds: BedMatrixBedOut[],
  today: string,
  mayPast: boolean,
) {
  rosterDay(entry.roster_date);
  rosterDay(today);
  const person = staff.find((s) => s.employee_id === entry.employee_id);
  if (!person) throw Error("Choose staff from the current permitted list.");
  if (entry.roster_date < today && !mayPast)
    throw Error("Past duties require HR roster management.");
  if (rosterOnLeave(person, entry.roster_date))
    throw Error("This employee is on approved leave that day.");
  if (
    !patterns.some(
      (s) => s.shift_pattern_id === entry.shift_pattern_id && s.is_active,
    )
  )
    throw Error("Choose an active shift pattern.");
  if (!rosterAreas.includes(entry.duty_area || "Department"))
    throw Error("Choose a valid duty area.");
  if (entry.duty_area === "Ward" && !entry.ward_id)
    throw Error("Choose the ward for this duty.");
  if (
    (entry.bed_ids?.length || 0) > 60 ||
    new Set(entry.bed_ids).size !== (entry.bed_ids?.length || 0) ||
    entry.bed_ids?.some(
      (id) =>
        entry.duty_area !== "Ward" ||
        !beds.some((b) => b.bed_id === id && b.ward_id === entry.ward_id),
    )
  )
    throw Error("Choose beds from this ward only.");
  if ((entry.zone_label?.length || 0) > 100 || (entry.notes?.length || 0) > 500)
    throw Error("Zone is limited to 100 characters and notes to 500.");
  return entry;
}
export function dutyPatch(old: RosterEntryOut, next: EntryIn): EntryPatch {
  if (old.status !== "Active" || old.employee_id !== next.employee_id)
    throw Error("Reload the original active duty before changing it.");
  const patch: Record<string, unknown> = { expected_version: old.row_version };
  for (const k of [
    "roster_date",
    "shift_pattern_id",
    "duty_area",
    "ward_id",
    "department_id",
    "zone_label",
    "bed_ids",
    "is_on_call",
    "notes",
  ] as const)
    if (JSON.stringify(old[k] ?? null) !== JSON.stringify(next[k] ?? null))
      patch[k] = next[k] ?? null;
  if (Object.keys(patch).length === 1)
    throw Error("Change a field before reviewing.");
  return patch as EntryPatch;
}
export function rosterCopyPeriod(
  from: string,
  to: string,
  target: string,
  rotate: number,
  today?: string,
  mayPast = false,
) {
  rosterDay(from);
  rosterDay(to);
  rosterDay(target);
  if (today && !mayPast && target < rosterDay(today))
    throw Error("Past duties require HR roster management.");
  if (
    to < from ||
    Date.parse(to) - Date.parse(from) > 61 * 86400000 ||
    target <= to ||
    !Number.isInteger(rotate) ||
    rotate < 0 ||
    rotate > 30
  )
    throw Error(
      "Use a valid period up to 62 days and a later target; rotation is 0 to 30.",
    );
  return {
    source_from: from,
    source_to: to,
    target_from: target,
    rotate_days: rotate,
  };
}
export const rosterSnapshot = (r: RosterEntryOut) => JSON.stringify(r);
export function rosterRecoveryMayRelease(
  kind: string,
  id: number | undefined,
  record: { roster_id?: number; swap_id?: number } | undefined,
) {
  if (!id || !record) return false;
  if (["edit", "cancel"].includes(kind)) return record.roster_id === id;
  if (["approve", "reject"].includes(kind)) return record.swap_id === id;
  return false;
}
export const swapIsSelf = (
  employeeId: number | null | undefined,
  s: { requester_employee_id: number; covering_employee_id: number },
) =>
  employeeId === s.requester_employee_id ||
  employeeId === s.covering_employee_id;
