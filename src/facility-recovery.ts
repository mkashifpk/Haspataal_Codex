import type {
  EstablishmentApplyIn,
  EstablishmentPreviewOut,
} from "./generated/facility_profile";
export type PendingFacilityApply = {
  version: 1;
  key: string;
  body: EstablishmentApplyIn;
  preview: EstablishmentPreviewOut;
  createdAt: number;
};
export function createFacilityAttempt(
  body: EstablishmentApplyIn,
  preview: EstablishmentPreviewOut,
  now = Date.now(),
): PendingFacilityApply {
  return {
    version: 1,
    key: crypto.randomUUID(),
    body: structuredClone(body),
    preview: structuredClone(preview),
    createdAt: now,
  };
}
export function readFacilityAttempt(
  text: string | null,
): PendingFacilityApply | undefined {
  if (text === null) return;
  const p = JSON.parse(text);
  if (
    p?.version !== 1 ||
    typeof p.key !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(p.key) ||
    !Number.isFinite(p.createdAt) ||
    !Number.isInteger(p.body?.expected_revision) ||
    typeof p.body.reason !== "string" ||
    !Array.isArray(p.body.acknowledged) ||
    p.preview?.revision !== p.body.expected_revision
  )
    throw new Error(
      "The saved Facility attempt is invalid. Ask IT to reconcile it before changing the facility.",
    );
  return p;
}
export function mayRetryFacilityAttempt(
  p: PendingFacilityApply,
  now = Date.now(),
): boolean {
  const elapsed = now - p.createdAt;
  return elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
}
export function definitiveFacilityRefusal(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  // A timeout, throttling, a transport error, a malformed success response or a
  // server failure does not establish whether the transaction committed.
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}
// Each action has its own durable record. Two windows must never overwrite or
// delete one another's original idempotency keys.
export function storedFacilityAttempt(
  store: Storage,
  scope: string,
): PendingFacilityApply | undefined {
  const attempts: PendingFacilityApply[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(scope + ":")) {
      const attempt = readFacilityAttempt(store.getItem(key));
      if (attempt) attempts.push(attempt);
    }
  }
  return attempts.sort(
    (a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key),
  )[0];
}
export function storeFacilityAttempt(
  store: Storage,
  scope: string,
  attempt: PendingFacilityApply,
) {
  store.setItem(scope + ":" + attempt.key, JSON.stringify(attempt));
}
export function removeFacilityAttempt(
  store: Storage,
  scope: string,
  attempt: PendingFacilityApply,
) {
  store.removeItem(scope + ":" + attempt.key);
}
