import { ApiError } from "./bridge";

export function patientErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.response.error?.code : undefined;
}

export function isDuplicatePatient(error: unknown): boolean {
  return ["PATIENT_CNIC_EXISTS", "PATIENT_UPMRN_EXISTS"].includes(patientErrorCode(error) || "");
}

// Definitive refusals leave the draft editable. Unknown outcomes must be reconciled
// against the current version before another PATCH can overwrite a saved change.
export function patientEditNeedsReconcile(error: unknown): boolean {
  if (patientErrorCode(error) === "VERSION_CONFLICT") return true;
  if (!(error instanceof ApiError)) return true;
  const status = error.response.status;
  return !status || status >= 500 || status === 408 || status === 429;
}
