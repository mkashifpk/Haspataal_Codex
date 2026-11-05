import type {
  ComplianceDocumentIn,
  ComplianceDocumentOut,
  ComplianceDocumentUpdateIn,
  ComplianceRenewIn,
} from "./generated/compliance_register_ops";
export const kinds = [
  "Licence",
  "Registration",
  "Certificate",
  "Plan",
  "Law",
] as const;
export const categories = [
  "Hospital",
  "Radiation",
  "Building",
  "Fire",
  "Lift",
  "Boiler",
  "Power",
  "BloodTransfusion",
  "Food",
  "Waste",
  "Pharmacy",
  "Laboratory",
  "Water",
  "Environment",
  "Emergency",
  "Equipment",
  "Staff",
  "Other",
] as const;
export const states = [
  "Expired",
  "DueForRenewal",
  "Valid",
  "NoExpiry",
  "Renewed",
  "Withdrawn",
] as const;
export function complianceAccess(
  permissions: string[],
  establishment?: {
    views?: { screens: Array<{ screen_id: string; view: string }> };
  } | null,
) {
  const view = establishment?.views
    ? (establishment.views.screens.find(
        (s) => s.screen_id === "compliance_register_ops",
      )?.view ?? "full")
    : "hidden";
  const canView =
    view !== "hidden" &&
    permissions.some((p) =>
      ["facility.view", "facility.compliance.manage"].includes(p),
    );
  return {
    canView,
    canManage:
      canView &&
      view !== "records" &&
      permissions.includes("facility.compliance.manage"),
    view,
  };
}
export type Draft = Record<
  | "title"
  | "kind"
  | "category"
  | "authority"
  | "reference_no"
  | "issued_on"
  | "valid_until"
  | "renewal_lead_days"
  | "responsible_user_id"
  | "asset_id"
  | "department_id"
  | "note"
  | "renewal_applied_on"
  | "renewal_reference",
  string
>;
export function documentDraft(row?: ComplianceDocumentOut): Draft {
  return Object.fromEntries(
    [
      "title",
      "kind",
      "category",
      "authority",
      "reference_no",
      "issued_on",
      "valid_until",
      "renewal_lead_days",
      "responsible_user_id",
      "asset_id",
      "department_id",
      "note",
      "renewal_applied_on",
      "renewal_reference",
    ].map((k) => [
      k,
      row ? String((row as unknown as Record<string, unknown>)[k] ?? "") : "",
    ]),
  ) as Draft;
}
const nullable = (s: string) => s.trim() || null;
const number = (s: string) => (s === "" ? null : Number(s));
export function createDocumentPayload(d: Draft): ComplianceDocumentIn {
  return {
    kind: d.kind as ComplianceDocumentIn["kind"],
    category: d.category as ComplianceDocumentIn["category"],
    title: d.title.trim(),
    authority: nullable(d.authority),
    reference_no: nullable(d.reference_no),
    issued_on: nullable(d.issued_on),
    valid_until: nullable(d.valid_until),
    renewal_lead_days: number(d.renewal_lead_days),
    responsible_user_id: number(d.responsible_user_id),
    asset_id: number(d.asset_id),
    department_id: number(d.department_id),
    note: nullable(d.note),
  };
}
export function editDocumentPayload(
  d: Draft,
  original: ComplianceDocumentOut,
): ComplianceDocumentUpdateIn {
  const before = createDocumentPayload(documentDraft(original)),
    after = createDocumentPayload(d);
  const payload: Record<string, unknown> = {
    expected_version: original.row_version,
  };
  for (const [key, value] of Object.entries(after))
    if (
      !["kind", "category"].includes(key) &&
      value !== (before as unknown as Record<string, unknown>)[key]
    )
      payload[key] = value;
  for (const key of ["renewal_applied_on", "renewal_reference"] as const)
    if (nullable(d[key]) !== original[key]) payload[key] = nullable(d[key]);
  return payload as ComplianceDocumentUpdateIn;
}
export function renewalPayload(d: Draft): ComplianceRenewIn {
  return {
    issued_on: d.issued_on,
    valid_until: nullable(d.valid_until),
    reference_no: nullable(d.reference_no),
    title: d.title.trim(),
    note: nullable(d.note),
  };
}
export function validateDocument(
  d: Draft,
  mode: "create" | "edit" | "renew",
): string[] {
  const errors: string[] = [];
  if (d.title.trim().length < 3 || d.title.trim().length > 300)
    errors.push("title");
  if (!kinds.includes(d.kind as (typeof kinds)[number])) errors.push("kind");
  if (!categories.includes(d.category as (typeof categories)[number]))
    errors.push("category");
  if (
    (["Licence", "Plan"].includes(d.kind) ||
      (mode === "renew" && !!d.valid_until)) &&
    !d.valid_until
  )
    errors.push("valid_until");
  if (mode === "renew" && !d.issued_on) errors.push("issued_on");
  if (d.issued_on && d.valid_until && d.valid_until < d.issued_on)
    errors.push("date_order");
  if (
    d.renewal_lead_days !== "" &&
    (!Number.isInteger(Number(d.renewal_lead_days)) ||
      Number(d.renewal_lead_days) < 0 ||
      Number(d.renewal_lead_days) > 365)
  )
    errors.push("renewal_lead_days");
  for (const [key, max] of [
    ["authority", 200],
    ["reference_no", 100],
    ["note", 2000],
    ["renewal_reference", 200],
  ] as const)
    if (d[key].length > max) errors.push(key);
  return errors;
}
export function groupedDocuments(
  rows: ComplianceDocumentOut[],
  search: string,
) {
  const q = search.trim().toLocaleLowerCase();
  return states.map((state) => ({
    state,
    rows: rows.filter(
      (r) =>
        r.state === state &&
        (!q ||
          [
            r.title,
            r.authority,
            r.reference_no,
            r.asset_tag,
            r.responsible_name,
          ].some((s) => s?.toLocaleLowerCase().includes(q))),
    ),
  }));
}
