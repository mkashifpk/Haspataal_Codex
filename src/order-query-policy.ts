import type {
  PrescriptionDetailOut,
  PrescriptionQueryOut,
  QueryIn,
} from "./generated/order_queries";
export const queryReasons = [
  "Unclear",
  "DoseOrFrequency",
  "Allergy",
  "Interaction",
  "Duplicate",
  "ChildDose",
  "Restricted",
  "WrongPatient",
  "Other",
] as const;
export function makeOrderQuery(
  p: PrescriptionDetailOut,
  target: string,
  reason: string,
  question: string,
): QueryIn {
  const item =
    target === "whole"
      ? null
      : /^[1-9]\d*$/.test(target)
        ? Number(target)
        : undefined;
  if (
    item === undefined ||
    (item !== null && !p.items.some((i) => i.prescription_item_id === item))
  )
    throw new Error(
      "Choose the whole prescription or a current medicine line.",
    );
  if (
    !queryReasons.includes(reason as QueryIn["reason"]) ||
    question.trim().length < 3 ||
    question.trim().length > 1000
  )
    throw new Error(
      "Choose a reason and enter a question of 3–1000 characters.",
    );
  if (
    p.queries.some(
      (q) => q.status === "Open" && q.prescription_item_id === item,
    )
  )
    throw new Error(
      "An open query already exists for this selection. Review it instead.",
    );
  return {
    prescription_item_id: item,
    reason: reason as QueryIn["reason"],
    question: question.trim(),
  };
}
export const queryPrescriptionSnapshot = (p: PrescriptionDetailOut) =>
  JSON.stringify([
    p.prescription_id,
    p.patient_id,
    p.row_version,
    p.status,
    p.items.map(
      ({ qty_available: _stock, stock_status: _availability, ...order }) =>
        order,
    ),
    p.queries,
  ]);
export const queryRowSnapshot = (q: PrescriptionQueryOut) =>
  JSON.stringify([
    q.query_id,
    q.prescription_id,
    q.patient_id,
    q.prescription_item_id,
    q.status,
    q.row_version,
    q.question,
    q.raised_by,
  ]);
export function mayChangeQueries(permissions: string[], view: string) {
  return (
    permissions.includes("prescription.query.raise") &&
    ["full", "open_work"].includes(view)
  );
}
