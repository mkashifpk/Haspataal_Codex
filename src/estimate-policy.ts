import type {
  EstimateIn,
  EstimateOut,
  TariffOut,
} from "./generated/cost_estimates_admissions";
export const estimateSnapshot = (e: EstimateOut) =>
  JSON.stringify([
    e.estimate_id,
    e.patient_id,
    e.row_version,
    e.status,
    e.total,
    e.deposit,
    e.transfer_id,
  ]);
export function checkedEstimate(
  body: EstimateIn,
  tariff: TariffOut,
): EstimateIn {
  if (!body.admission_id && !body.patient_id)
    throw Error("Choose the patient or admission.");
  if (body.reason === "ChangeOfWard" ? !body.transfer_id : !!body.transfer_id)
    throw Error("Choose the actual transfer only for a change of ward.");
  if (
    body.expected_days != null &&
    (!Number.isInteger(body.expected_days) ||
      body.expected_days < 0 ||
      body.expected_days > 365)
  )
    throw Error("Expected days must be a whole number from 0 to 365.");
  if (
    body.ward_id &&
    !tariff.wards.some(
      (w) => w.ward_id === body.ward_id && w.bed_day_price !== null,
    )
  )
    throw Error("Choose a ward with a published bed-day price.");
  const services = body.services || [],
    allowances = body.allowances || [];
  if (services.length > 50 || allowances.length > 20)
    throw Error("Too many estimate lines.");
  const items = tariff.categories.flatMap((c) => c.items);
  if (
    services.some(
      (s) =>
        !items.some((i) => i.service_id === s.service_id) ||
        !Number.isFinite(s.quantity ?? 1) ||
        (s.quantity ?? 1) <= 0 ||
        (s.quantity ?? 1) > 1000,
    )
  )
    throw Error(
      "Choose published services and quantities greater than zero, up to 1000.",
    );
  if (
    allowances.some(
      (a) =>
        a.description.trim().length < 3 ||
        a.description.length > 300 ||
        !Number.isFinite(a.amount) ||
        a.amount <= 0 ||
        a.amount > 100000000,
    )
  )
    throw Error(
      "Each allowance needs a description of 3–300 characters and a positive amount up to 100000000.",
    );
  if (
    !(body.expected_days && body.ward_id) &&
    !services.length &&
    !allowances.length
  )
    throw Error("Price bed-days, a service or an allowance.");
  if (
    body.deposit != null &&
    (!Number.isFinite(body.deposit) || body.deposit < 0)
  )
    throw Error("Deposit must be nonnegative.");
  return body;
}
