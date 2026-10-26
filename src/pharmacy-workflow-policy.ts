import type { DischargeStatusViewOut } from "./generated/discharge_status";
export function otherPharmacyCashCounter(error: unknown) {
  const e = (
    error as {
      response?: {
        error?: {
          code?: string;
          details?: { open_shift?: { node?: unknown } };
        };
      };
    }
  )?.response?.error;
  const node = e?.details?.open_shift?.node;
  return e?.code === "SHIFT_NOT_OPEN" &&
    typeof node === "string" &&
    node !== "PharmacyCounter"
    ? node
    : undefined;
}
export const pharmacyCashShift = (
  shift: { user_id: number; status: string; node: string } | null | undefined,
  userId: number,
) =>
  !!shift &&
  shift.user_id === userId &&
  shift.status === "Open" &&
  shift.node === "PharmacyCounter";
export const cashOpeningAllowed = (
  workspace: string | undefined,
  node: string | null | undefined,
) => !!node && (workspace !== "pharmacy" || node === "PharmacyCounter");
export function pharmacyClearanceState(
  status: DischargeStatusViewOut | undefined,
  admissionId: number,
  patientId: number,
) {
  if (
    !status ||
    status.admission_id !== admissionId ||
    status.patient_id !== patientId
  )
    return undefined;
  return status.stages.find((s) => s.stage === "PharmacyClearance");
}
export function pharmacyClearanceAllowed(
  status: DischargeStatusViewOut | undefined,
  admissionId: number,
  patientId: number,
) {
  return (
    !!status?.started &&
    status.blocked_on === "PharmacyClearance" &&
    pharmacyClearanceState(status, admissionId, patientId)?.status === "Pending"
  );
}
