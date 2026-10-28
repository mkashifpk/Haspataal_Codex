import type {
  BedMatrixBedOut,
  BedMatrixOut,
  BedStateIn,
} from "./generated/bed_matrix";
export const bedStates = [
  "Available",
  "Reserved",
  "Occupied",
  "Dirty",
  "Cleaning",
  "OutOfService",
] as const;
export type BedState = (typeof bedStates)[number];
export const bedTone: Record<BedState, string> = {
  Available: "available",
  Reserved: "reserved",
  Occupied: "occupied",
  Dirty: "turnover",
  Cleaning: "turnover",
  OutOfService: "out-of-service",
};
export function bedAccess(view: string | undefined, permissions: string[]) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  return {
    visible,
    read: visible && permissions.includes("ipd.bed.view"),
    manage:
      visible &&
      view !== "records" &&
      permissions.includes("ipd.bed.view") &&
      permissions.includes("ipd.bed.manage"),
  };
}
export function bedTargets(bed: BedMatrixBedOut): BedStateIn["state"][] {
  if (bed.current_state === "OutOfService") return ["Available"];
  return ["Available", "Dirty", "Cleaning"].includes(bed.current_state)
    ? ["OutOfService"]
    : [];
}
export const bedSnapshot = (b: BedMatrixBedOut) =>
  JSON.stringify([
    b.bed_id,
    b.ward_id,
    b.label,
    b.current_state,
    b.state_changed_at,
    b.admission_id,
    b.mrn,
    b.discharge_blocked_on,
  ]);
export const verifiedMatrixBed = (matrix: BedMatrixOut | undefined, id: number | undefined) =>
  matrix?.beds?.find(b => b.bed_id === id && matrix.wards.some(w => w.ward_id === b.ward_id));
export function bedStateBody(
  bed: BedMatrixBedOut,
  state: BedStateIn["state"],
  reason: string,
  ack: boolean,
): BedStateIn {
  if (!bedTargets(bed).includes(state))
    throw Error(
      "This bed no longer permits that action. Read the current bed and keep your reason.",
    );
  if (!ack)
    throw Error(
      "Check the actual bed, ward and service readiness before review.",
    );
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 300)
    throw Error("Enter a factual bed service reason of 3–300 characters.");
  return { state, reason: trimmed };
}
// Events confirm a state only, not the occupant. Suppress old patient details until REST reconciles.
export function applyBedStateEvent(
  matrix: BedMatrixOut,
  event: { payload?: unknown; created_at?: string },
): BedMatrixOut {
  const p = event.payload as Record<string, unknown> | undefined;
  if (
    !p ||
    !Number.isSafeInteger(p.bed_id) ||
    !Number.isSafeInteger(p.ward_id) ||
    !bedStates.includes(p.to_state as BedState) ||
    !bedStates.includes(p.from_state as BedState)
  )
    return matrix;
  const before = matrix.beds?.find(
    (b) => b.bed_id === p.bed_id && b.ward_id === p.ward_id,
  );
  if (event.created_at && !Number.isFinite(Date.parse(event.created_at))) return matrix;
  if (
    !before ||
    before.current_state !== p.from_state ||
    p.to_state === p.from_state
  )
    return matrix;
  if (
    event.created_at &&
    Number.isFinite(Date.parse(event.created_at)) &&
    Date.parse(event.created_at) < Date.parse(before.state_changed_at)
  )
    return matrix;
  const bucket = (state: string) =>
    (
      ({
        Available: "available",
        Reserved: "reserved",
        Occupied: "occupied",
        Dirty: "turnover",
        Cleaning: "turnover",
        OutOfService: "out_of_service",
      }) as const
    )[state as BedState];
  const from = bucket(before.current_state),
    to = bucket(p.to_state as string);
  return {
    ...matrix,
    beds: matrix.beds?.map((b) =>
      b === before
        ? {
            ...b,
            current_state: p.to_state as BedState,
            state_changed_at: event.created_at || b.state_changed_at,
            patient_name: null,
            mrn: null,
            admission_id: null,
            admission_status: null,
            is_overflow: null,
            discharge_blocked_on: null,
          }
        : b,
    ),
    wards: matrix.wards.map((w) =>
      w.ward_id !== p.ward_id || from === to
        ? w
        : { ...w, [from]: Math.max(0, w[from] - 1), [to]: w[to] + 1 },
    ),
    summary: Object.fromEntries(
      matrix.wards.map((w) => [
        w.name,
        w.available +
          (w.ward_id === p.ward_id
            ? (to === "available" ? 1 : 0) - (from === "available" ? 1 : 0)
            : 0),
      ]),
    ),
  };
}
