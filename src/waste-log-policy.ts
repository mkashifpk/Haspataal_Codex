import type { WasteIn } from "./generated/waste_log_ops";
export const wasteCategories = [
  "Infectious",
  "Sharps",
  "Pathological",
  "Pharmaceutical",
  "Chemical",
  "Radioactive",
  "NonRisk",
] as const;
export const wasteDisposals = [
  "Incineration",
  "Autoclave",
  "Encapsulation",
  "Landfill",
  "Recycling",
  "Other",
] as const;
export function wasteAccess(
  permissions: string[],
  establishment?: {
    views?: { screens: { screen_id: string; view: string }[] };
  } | null,
  screenId = "waste_log_ops",
) {
  const view = establishment?.views
    ? (establishment.views.screens.find((s) => s.screen_id === screenId)
        ?.view ?? "full")
    : "hidden";
  const canView =
    view !== "hidden" &&
    permissions.some((p) =>
      [
        "infection.waste.record",
        "infection.control.manage",
        "infection.statistics.view",
      ].includes(p),
    );
  return {
    canView,
    canRecord:
      canView &&
      view !== "records" &&
      permissions.includes("infection.waste.record"),
    view,
  };
}
export const wasteDraft = () => ({
  recorded_on: "",
  category: "",
  ward_id: "",
  department_id: "",
  location: "",
  bags: "",
  weight_kg: "",
  handover: false,
  vendor_id: "",
  manifest_number: "",
  disposal: "",
  note: "",
});
export type WasteDraft = ReturnType<typeof wasteDraft>;
export function wasteProblems(d: WasteDraft): string[] {
  const p: string[] = [];
  if (!wasteCategories.includes(d.category as any)) p.push("category");
  if (!d.location.trim() && !d.ward_id && !d.department_id) p.push("area");
  if (
    !d.weight_kg.trim() ||
    !Number.isFinite(Number(d.weight_kg)) ||
    Number(d.weight_kg) <= 0 ||
    Number(d.weight_kg) > 100000
  )
    p.push("weight");
  if (
    d.bags !== "" &&
    (!Number.isInteger(Number(d.bags)) ||
      Number(d.bags) < 0 ||
      Number(d.bags) > 10000)
  )
    p.push("bags");
  if (d.handover && (!d.vendor_id || !d.manifest_number.trim()))
    p.push("handover");
  if (d.handover && d.disposal && !wasteDisposals.includes(d.disposal as any))
    p.push("disposal");
  if (
    d.location.trim().length > 300 ||
    d.manifest_number.trim().length > 100 ||
    d.note.trim().length > 1000
  )
    p.push("length");
  return p;
}
export function wastePayload(d: WasteDraft): WasteIn {
  return {
    recorded_on: d.recorded_on || null,
    category: d.category as WasteIn["category"],
    ward_id: d.ward_id ? Number(d.ward_id) : null,
    department_id: d.department_id ? Number(d.department_id) : null,
    location: d.location.trim() || null,
    bags: d.bags === "" ? null : Number(d.bags),
    weight_kg: Number(d.weight_kg),
    vendor_id: d.handover ? Number(d.vendor_id) : null,
    manifest_number: d.handover ? d.manifest_number.trim() : null,
    disposal: d.handover ? ((d.disposal || null) as WasteIn["disposal"]) : null,
    note: d.note.trim() || null,
  };
}
