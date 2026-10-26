import type {
  LabOnlyWalkIn,
  LabTestListItemOut,
  InvoiceDetailOut,
  CollectIn,
} from "./generated/lab_only_walkin";
export function walkinTestAllowed(test: LabTestListItemOut, active: string[]) {
  return (
    test.is_active &&
    active.includes(
      test.availability === "SendOut" ? "outsourced_diagnostics" : "laboratory",
    )
  );
}
export function makeLabWalkin(
  name: string,
  mobile: string,
  ids: number[],
  catalogue: LabTestListItemOut[],
  active: string[],
  priority: LabOnlyWalkIn["priority"],
  notes: string,
  referrer: string,
): LabOnlyWalkIn {
  if (
    !name.trim() ||
    name.trim().length > 200 ||
    !/^\+?[0-9][0-9 -]{6,19}$/.test(mobile.trim())
  )
    throw Error("Enter a name of 1–200 characters and a valid mobile number.");
  if (
    !["Routine", "Urgent", "STAT"].includes(priority || "") ||
    notes.trim().length > 1000 ||
    referrer.trim().length > 200
  )
    throw Error("Check priority, clinical notes and referring doctor.");
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !catalogue.some(
          (t) => t.test_id === id && walkinTestAllowed(t, active),
        ),
    )
  )
    throw Error(
      "A selected test is unavailable. Refresh and review the selection.",
    );
  return {
    full_name: name.trim(),
    mobile: mobile.trim(),
    test_ids: ids,
    priority,
    ...(notes.trim() ? { clinical_notes: notes.trim() } : {}),
    ...(referrer.trim() ? { referring_doctor_name: referrer.trim() } : {}),
  };
}
export function labWalkinWritable(permissions: string[], view: string) {
  return (
    view === "full" &&
    ["patient.create", "lab.requisition.create"].every((p) =>
      permissions.includes(p),
    )
  );
}
export function labInvoiceCollectible(
  i: InvoiceDetailOut | undefined,
  invoiceId: number,
  patientId: number,
) {
  return (
    !!i &&
    i.invoice_id === invoiceId &&
    i.patient_id === patientId &&
    i.invoice_type === "Lab" &&
    !i.is_locked &&
    ["Open", "PartiallyPaid"].includes(i.status) &&
    i.balance_due > 0
  );
}
export function makeLabCollection(
  i: InvoiceDetailOut,
  amount: string,
  method: string,
  reference: string,
): CollectIn {
  if (!["Cash", "Card", "BankTransfer"].includes(method))
    throw Error("Choose Cash, Card or Bank transfer.");
  if (amount.trim() && !/^\d+(?:\.\d+)?$/.test(amount.trim()))
    throw Error(
      "Enter a positive payment amount or leave it empty for the full server balance.",
    );
  const value = amount.trim() ? Number(amount) : i.balance_due;
  if (!Number.isFinite(value) || value <= 0 || value > i.balance_due)
    throw Error(
      "The payment must be positive and no more than the server balance.",
    );
  return {
    amount: amount.trim() || i.balance_due,
    method: method as CollectIn["method"],
    ...(reference.trim() ? { reference_no: reference.trim() } : {}),
  };
}
export const labInvoiceSnapshot = (i: InvoiceDetailOut) =>
  JSON.stringify([
    i.invoice_id,
    i.patient_id,
    i.row_version,
    i.status,
    i.balance_due,
    i.is_locked,
  ]);
