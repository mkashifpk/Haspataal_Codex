import type { HomeVisitIn } from "./generated/home_visit_record";
export function homeVisitDateRange(from: string, to: string): boolean {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
  return valid(from) && valid(to) && from <= to;
}
export function homeVisitIssues(b: HomeVisitIn, now: number): string[] {
  const problems: string[] = [];
  const requested = Date.parse(b.requested_at),
    visited = Date.parse(b.visited_at);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(requested) ||
    !Number.isFinite(visited)
  )
    problems.push(
      "Enter valid request and visit times using the hospital timezone and a current server clock.",
    );
  else {
    if (visited > now) problems.push("The visit cannot be in the future.");
    if (visited < requested)
      problems.push("The visit cannot be before the request.");
  }
  for (const [key, min, max] of [
    ["requested_by", 2, 200],
    ["reason", 3, 1000],
    ["address", 3, 500],
    ["history", 3, 4000],
    ["assessment", 3, 2000],
    ["care_given", 3, 4000],
  ] as const) {
    const value = b[key].trim();
    if (value.length < min || value.length > max)
      problems.push(`${key}: enter ${min}–${max} characters.`);
  }
  if (
    !["VerbalObtained", "Declined", "NotExamined"].includes(
      b.examination_consent,
    )
  )
    problems.push("Deliberately choose examination consent.");
  if (b.examination?.trim() && b.examination_consent !== "VerbalObtained")
    problems.push("Examination findings require verbal consent.");
  if (!["ManagedAtHome", "AskedToAttend", "Referred"].includes(b.outcome))
    problems.push("Choose the actual outcome.");
  if (b.outcome === "Referred" && !b.referred_to?.trim())
    problems.push("For a referral, say where the patient was referred.");
  return problems;
}
