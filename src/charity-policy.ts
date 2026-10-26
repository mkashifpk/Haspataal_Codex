import type { CharityIn, ApprovalOut } from "./generated/charity_override";
import type { PrescriptionDetailOut } from "./generated/rx_queue";
export type CharityBody = Omit<CharityIn, "approver_password">;
export type CharityHandoff = {
  prescriptionId: number;
  approvalId: number;
  fundType: "Zakat" | "SocialWelfare";
};
export const charityWritable = (permissions: string[], view: string) =>
  permissions.includes("pharmacy.dispense") &&
  ["full", "open_work"].includes(view);
export function makeCharityBody(
  id: number,
  fund: string,
  reason: string,
  signer?: string,
): CharityBody {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error(
      "Open an existing prescription before requesting assistance.",
    );
  if (
    !["Zakat", "SocialWelfare"].includes(fund) ||
    reason.trim().length < 3 ||
    reason.trim().length > 500
  )
    throw new Error("Choose a fund and enter a reason of 3–500 characters.");
  return {
    prescription_id: id,
    fund_type: fund as "Zakat" | "SocialWelfare",
    reason: reason.trim(),
    ...(signer ? { approver_username: signer.trim() } : {}),
  };
}
// Retained retry state must never contain the password, even if a caller supplies one.
export function nonSecretCharityBody(body: CharityIn): CharityBody {
  return makeCharityBody(
    body.prescription_id,
    body.fund_type || "Zakat",
    body.reason,
    body.approver_username || undefined,
  );
}
export const charitySnapshot = (p: PrescriptionDetailOut) =>
  JSON.stringify([
    p.prescription_id,
    p.patient_id,
    p.row_version,
    p.status,
    p.destination,
    p.items.map((i) => [
      i.prescription_item_id,
      i.item_status,
      i.qty_remaining,
      i.dose_text,
    ]),
  ]);
export function approvedCharityHandoff(
  a: ApprovalOut,
  p: PrescriptionDetailOut,
): CharityHandoff {
  const fund = a.payload_jsonb.fund_type;
  if (
    a.status !== "Approved" ||
    a.approval_type !== "PharmacyCharityOverride" ||
    a.subject_type !== "prescription" ||
    a.subject_id !== p.prescription_id ||
    a.patient_id !== p.patient_id ||
    !["Zakat", "SocialWelfare"].includes(String(fund))
  )
    throw new Error(
      "This is not a matching approved pharmacy assistance request.",
    );
  if (
    p.admission_id ||
    p.destination !== "HospitalPharmacy" ||
    !["Active", "PartiallyDispensed"].includes(p.status)
  )
    throw new Error(
      "This prescription is not ready for an outpatient charity dispense. Review the current billing and order.",
    );
  return {
    prescriptionId: p.prescription_id,
    approvalId: a.request_id,
    fundType: fund as "Zakat" | "SocialWelfare",
  };
}
export async function charityPasswordProof(salt: string, password: string) {
  const bytes = new TextEncoder().encode(salt + "\0" + password);
  try {
    return Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } finally {
    bytes.fill(0);
  }
}
export function charityLockSeconds(error: unknown) {
  const r = (
    error as {
      response?: {
        error?: {
          code?: string;
          retry_after_seconds?: unknown;
          details?: Record<string, unknown>;
        };
      };
    }
  )?.response?.error;
  if (r?.code !== "ACCOUNT_LOCKED") return 0;
  const n = Number(r.retry_after_seconds ?? r.details?.retry_after_seconds);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
}
