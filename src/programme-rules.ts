export function programmeWork(
  state: string,
  canGive: boolean,
  readOnly: boolean,
  connected: boolean,
  enrolledAt?: string,
  stateSince?: string,
) {
  const permitted = canGive && !readOnly && connected;
  return {
    enrol: permitted && state === "Active",
    entry:
      permitted &&
      (state === "Active" ||
        (state === "Retiring" &&
          !!enrolledAt &&
          !!stateSince &&
          Number.isFinite(Date.parse(enrolledAt)) &&
          Date.parse(enrolledAt) <= Date.parse(stateSince))),
    close: permitted,
  };
}
export function programmeEntryIssues(
  value: { service: string; given_at: string; next_due_on?: string | null },
  services: string[],
  serverNow: string,
  givenLocalDate: string,
) {
  const missing: string[] = [];
  if (!services.includes(value.service)) missing.push("service");
  if (
    !Number.isFinite(Date.parse(value.given_at)) ||
    !Number.isFinite(Date.parse(serverNow)) ||
    Date.parse(value.given_at) > Date.parse(serverNow)
  )
    missing.push("given_at");
  if (
    value.next_due_on &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value.next_due_on) ||
      !Number.isFinite(Date.parse(value.next_due_on)) ||
      new Date(value.next_due_on).toISOString().slice(0, 10) !==
        value.next_due_on ||
      value.next_due_on < givenLocalDate)
  )
    missing.push("next_due_on");
  return missing;
}
