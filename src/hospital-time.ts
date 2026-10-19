export function hospitalTimeZoneError(
  zone: string | undefined,
): Error | undefined {
  if (!zone)
    return new Error(
      "Hospital timezone is unavailable. Refresh before recording a time.",
    );
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  } catch {
    return new Error("The hospital supplied an invalid timezone. Contact IT.");
  }
}
function parts(instant: string | number, zone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export function hospitalTimeInput(
  instant: string | number,
  zone: string,
): string {
  return parts(instant, zone).slice(0, 16);
}
export function formatHospitalTime(instant: string, zone: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant)) + ` · ${zone}`
  );
}
export function hospitalTimeToUtc(value: string, zone: string): string {
  const problem = hospitalTimeZoneError(zone);
  if (problem) throw problem;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error("Enter a valid hospital date and time.");
  const target = value.length === 16 ? value + ":00" : value;
  const naive = Date.parse(target + "Z");
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 19) !== target
  )
    throw new Error("Enter a valid hospital date and time.");
  // Collect the actual zone offsets around the entered day. Comparing the
  // resulting wall times also detects DST gaps and ambiguous repeated hours.
  const offsets = new Set<number>();
  for (const days of [-2, -1, 0, 1, 2]) {
    const sample = naive + days * 86400000;
    offsets.add(Date.parse(parts(sample, zone) + "Z") - sample);
  }
  const matches = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => parts(instant, zone) === target);
  if (matches.length !== 1)
    throw new Error(
      matches.length === 0
        ? "This time does not exist in the hospital timezone. Check the date and time."
        : "This time is ambiguous in the hospital timezone. Ask IT to confirm the correct occurrence before reporting.",
    );
  return new Date(matches[0]).toISOString();
}
