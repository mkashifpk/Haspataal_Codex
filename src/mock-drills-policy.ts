import type {
  DrillDetailOut,
  DrillFieldsIn,
  QualityActionIn,
} from "./generated/mock_drills_ops";
import { hospitalTimeInput, hospitalTimeToUtc } from "./hospital-time";
export const drillKinds = [
  "Fire",
  "Evacuation",
  "CodeBlue",
  "MassCasualty",
  "Earthquake",
  "BombThreat",
  "ChemicalSpill",
  "PowerFailure",
  "InfantAbduction",
  "Flood",
  "Other",
] as const;
export const drillShifts = ["Morning", "Evening", "Night"] as const;
export const drillOutcomes = [
  "Satisfactory",
  "NeedsImprovement",
  "Unsatisfactory",
] as const;
export function drillAccess(
  permissions: string[],
  establishment?: {
    views?: { screens: { screen_id: string; view: string }[] };
  } | null,
) {
  const view = establishment?.views
    ? (establishment.views.screens.find(
        (s) => s.screen_id === "mock_drills_ops",
      )?.view ?? "full")
    : "hidden";
  const canView =
    view !== "hidden" &&
    permissions.some((p) =>
      ["facility.view", "facility.drill.manage"].includes(p),
    );
  return {
    canView,
    canManage:
      canView &&
      view !== "records" &&
      permissions.includes("facility.drill.manage"),
    view,
  };
}
export type DrillDraft = {
  kind: string;
  scenario: string;
  department_id: string;
  ward_id: string;
  area: string;
  shift: string;
  held_at: string;
  announced: string;
  external_agency: string;
  response_minutes: string;
  evacuation_minutes: string;
  observations: string;
  outcome: string;
  participants: { employee_id: string; drill_role: string }[];
};
export function drillDraft(row?: DrillDetailOut, zone?: string): DrillDraft {
  return {
    kind: row?.kind ?? "",
    scenario: row?.scenario ?? "",
    department_id: String(row?.department_id ?? ""),
    ward_id: String(row?.ward_id ?? ""),
    area: row?.area ?? "",
    shift: row?.shift ?? "",
    held_at: row && zone ? hospitalTimeInput(row.held_at, zone) : "",
    announced: row ? (row.announced ? "yes" : "no") : "",
    external_agency: row?.external_agency ?? "",
    response_minutes: String(row?.response_minutes ?? ""),
    evacuation_minutes: String(row?.evacuation_minutes ?? ""),
    observations: row?.observations ?? "",
    outcome: row?.outcome ?? "",
    participants:
      row?.participants.map((p) => ({
        employee_id: String(p.employee_id),
        drill_role: p.drill_role,
      })) ?? [],
  };
}
export function drillPayload(
  d: DrillDraft,
  zone: string,
  original?: DrillDetailOut,
): DrillFieldsIn {
  const number = (s: string) => (s === "" ? null : Number(s)),
    text = (s: string) => s.trim() || null;
  return {
    kind: d.kind as DrillFieldsIn["kind"],
    scenario: d.scenario.trim(),
    department_id: number(d.department_id),
    ward_id: number(d.ward_id),
    area: text(d.area),
    shift: d.shift as DrillFieldsIn["shift"],
    held_at:
      original && d.held_at === hospitalTimeInput(original.held_at, zone)
        ? original.held_at
        : hospitalTimeToUtc(d.held_at, zone),
    announced: d.announced === "yes",
    external_agency: text(d.external_agency),
    response_minutes: number(d.response_minutes),
    evacuation_minutes: number(d.evacuation_minutes),
    observations: text(d.observations),
    outcome: text(d.outcome) as DrillFieldsIn["outcome"],
    participants: d.participants.map((p) => ({
      employee_id: Number(p.employee_id),
      drill_role: p.drill_role.trim(),
    })),
  };
}
export function validateDrill(d: DrillDraft): string[] {
  const errors: string[] = [];
  if (!drillKinds.includes(d.kind as (typeof drillKinds)[number]))
    errors.push("kind");
  if (d.scenario.trim().length < 5 || d.scenario.length > 2000)
    errors.push("scenario");
  if (!d.department_id && !d.ward_id && !d.area.trim()) errors.push("place");
  if (!drillShifts.includes(d.shift as (typeof drillShifts)[number]))
    errors.push("shift");
  if (!["yes", "no"].includes(d.announced)) errors.push("announced");
  if (!d.held_at) errors.push("held_at");
  if (
    d.area.length > 200 ||
    d.external_agency.length > 200 ||
    d.observations.length > 8000
  )
    errors.push("length");
  for (const key of ["response_minutes", "evacuation_minutes"] as const)
    if (
      d[key] !== "" &&
      (!Number.isFinite(Number(d[key])) ||
        Number(d[key]) < 0 ||
        Number(d[key]) > 600)
    )
      errors.push(key);
  if (
    d.participants.length > 500 ||
    new Set(d.participants.map((p) => p.employee_id)).size !==
      d.participants.length ||
    d.participants.some(
      (p) =>
        !p.employee_id ||
        p.drill_role.trim().length < 2 ||
        p.drill_role.length > 200,
    )
  )
    errors.push("participants");
  return errors;
}
export function missingToSign(
  row: Pick<DrillDetailOut, "observations" | "outcome" | "participants">,
): string[] {
  return [
    !row.observations?.trim() ? "observations" : "",
    !row.outcome ? "outcome" : "",
    !row.participants.length ? "participants" : "",
  ].filter(Boolean);
}
export function actionPayload(d: {
  action_type: string;
  description: string;
  owner_user_id: string;
  due_date: string;
  department_id: string;
}): QualityActionIn {
  return {
    action_type: d.action_type as QualityActionIn["action_type"],
    description: d.description.trim(),
    owner_user_id: Number(d.owner_user_id),
    due_date: d.due_date,
    department_id: d.department_id ? Number(d.department_id) : null,
  };
}
