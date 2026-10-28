import type { RollCallEntryOut, RollCallIn } from "./generated/roll_call";
import { hospitalTimeInput, hospitalTimeToUtc } from "./hospital-time";

export function dutyWindow(
  row: Pick<RollCallEntryOut, "roster_date" | "start_time" | "end_time">,
  zone: string,
) {
  const start = hospitalTimeToUtc(row.roster_date + "T" + row.start_time, zone);
  let endDay = row.roster_date;
  if (row.end_time <= row.start_time)
    endDay = new Date(Date.parse(endDay + "T12:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10);
  return { start, end: hospitalTimeToUtc(endDay + "T" + row.end_time, zone) };
}
export function rollCallEditable(
  row: RollCallEntryOut,
  now: string,
  zone: string,
  hr: boolean,
) {
  if (row.status !== "Active" || row.first_in) return false;
  const today = hospitalTimeInput(now, zone).slice(0, 10),
    w = dutyWindow(row, zone);
  return (
    Date.parse(now) >= Date.parse(w.start) &&
    (row.roster_date === today ||
      (row.roster_date < today && (hr || Date.parse(now) < Date.parse(w.end))))
  );
}
export function rollCallBody(
  rows: RollCallEntryOut[],
  times: Record<number, string>,
  now: string,
  zone: string,
  hr: boolean,
): RollCallIn {
  if (!rows.length || rows.length > 300)
    throw new Error("Choose between 1 and 300 rostered staff.");
  const day = rows[0].roster_date;
  if (rows.some((r) => r.roster_date !== day))
    throw new Error(
      "Confirm one duty date at a time; overnight duties keep their own date.",
    );
  if (new Set(rows.map((r) => r.employee_id)).size !== rows.length)
    throw new Error("Choose only one duty per employee in this request.");
  return {
    roster_date: day,
    present: rows.map((r) => {
      if (!rollCallEditable(r, now, zone, hr))
        throw new Error(
          "This duty is no longer available for roll call. Refresh the sheet.",
        );
      if (!times[r.roster_id])
        throw new Error(
          "Enter the actual arrival time for every selected person.",
        );
      const at = hospitalTimeToUtc(times[r.roster_id], zone),
        w = dutyWindow(r, zone);
      if (
        Date.parse(at) < Date.parse(w.start) ||
        Date.parse(at) >= Date.parse(w.end)
      )
        throw new Error("The arrival time must fall within this duty's shift.");
      if (Date.parse(at) > Date.parse(now))
        throw new Error("The actual arrival time cannot be in the future.");
      return { employee_id: r.employee_id, at };
    }),
  };
}
export function sameRollCallDuty(a: RollCallEntryOut, b: RollCallEntryOut) {
  return (
    a.roster_id === b.roster_id &&
    a.employee_id === b.employee_id &&
    a.roster_date === b.roster_date &&
    a.row_version === b.row_version &&
    !b.first_in &&
    b.status === "Active"
  );
}
