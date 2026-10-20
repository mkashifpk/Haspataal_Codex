export type ShiftAttempt =
  | {
      kind: "open";
      key: string;
      createdAt: number;
      body: { node: string; opening_float: number };
    }
  | { kind: "close"; shiftId: number; body: { declared_cash: number } };

// Reject partial numbers, whitespace-only values, Infinity and negative amounts.
export function cashAmount(value: string): number | undefined {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function definiteShiftRefusal(error: unknown): boolean {
  const reply = (
    error as { response?: { status?: number; error?: { code?: string } } }
  )?.response;
  // A successful HTTP status with a bad response envelope may hide a committed write.
  return (
    !!reply?.status &&
    reply.status >= 400 &&
    reply.status < 500 &&
    ![408, 429].includes(reply.status)
  );
}

export function mayRetryShiftOpen(
  attempt: ShiftAttempt,
  now = Date.now(),
): boolean {
  return (
    attempt.kind === "open" &&
    now >= attempt.createdAt &&
    now - attempt.createdAt < 24 * 60 * 60 * 1000
  );
}

export function createShiftOpen(
  node: string,
  amount: number,
  key: string,
  now = Date.now(),
): ShiftAttempt {
  return Object.freeze({
    kind: "open",
    key,
    createdAt: now,
    body: Object.freeze({ node, opening_float: amount }),
  });
}
