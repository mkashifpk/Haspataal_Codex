import type {
  TargetIn,
  FindingIn,
  TurnaroundTargetOut,
  CriticalFindingOut,
} from "./generated/imaging_quality_setup";
export const imagingModalities = [
  "XRay",
  "MRI",
  "CT",
  "Ultrasound",
  "Doppler",
  "Mammography",
  "Fluoroscopy",
  "Other",
] as const;
export const imagingSetupAccess = (
  view: string,
  permissions: string[],
  fromFacility = false,
) => {
  const visible =
    ["full", "open_work", "records"].includes(view) ||
    (view === "setup" && fromFacility);
  return {
    visible,
    manage: visible && permissions.includes("diagnostics.setup.manage"),
    create:
      visible &&
      view !== "records" &&
      permissions.includes("diagnostics.setup.manage"),
  };
};
export const targetFields = [
  "routine_perform_minutes",
  "routine_report_minutes",
  "emergency_perform_minutes",
  "emergency_report_minutes",
] as const;
export function targetInput(draft: Record<string, string>): TargetIn {
  const values = targetFields.map((k) => {
    const s = draft[k]?.trim();
    if (!s || !/^\d+$/.test(s) || Number(s) < 1 || Number(s) > 43200)
      throw Error("Enter whole minutes from 1 to 43200 in every target.");
    return Number(s);
  });
  if (values[2] > values[0] || values[3] > values[1])
    throw Error(
      "Emergency targets cannot exceed the corresponding routine targets.",
    );
  return Object.fromEntries(
    targetFields.map((k, i) => [k, values[i]]),
  ) as unknown as TargetIn;
}
export function findingInput(
  name: string,
  modality: string,
  description: string,
  order: string,
): FindingIn {
  if (
    name.trim().length < 3 ||
    name.trim().length > 200 ||
    description.trim().length > 500 ||
    !/^\d+$/.test(order.trim()) ||
    Number(order) > 10000
  )
    throw Error(
      "Enter a finding name of 3–200 characters, description up to 500 and a whole sort order from 0 to 10000.",
    );
  if (
    modality &&
    !imagingModalities.includes(modality as (typeof imagingModalities)[number])
  )
    throw Error("Choose a supported imaging modality or Any modality.");
  return {
    name: name.trim(),
    modality: (modality || null) as FindingIn["modality"],
    description: description.trim() || null,
    sort_order: Number(order),
  };
}
export const targetSnapshot = (row: TurnaroundTargetOut | undefined) =>
  JSON.stringify(
    row
      ? [row.modality, row.row_version, ...targetFields.map((k) => row[k])]
      : null,
  );
export const findingSnapshot = (row: CriticalFindingOut | undefined) =>
  JSON.stringify(
    row
      ? [
          row.finding_id,
          row.row_version,
          row.name,
          row.modality,
          row.description,
          row.sort_order,
          row.is_active,
        ]
      : null,
  );
