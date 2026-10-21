export type WriteAttempt<T> = { key: string; body: T; createdAt: number };
export function writeAttempt<T>(body: T, now = Date.now()): WriteAttempt<T> {
  return {
    key: crypto.randomUUID(),
    body: structuredClone(body),
    createdAt: now,
  };
}
export function canRetryWrite(
  attempt: WriteAttempt<unknown>,
  now = Date.now(),
) {
  return (
    now >= attempt.createdAt && now - attempt.createdAt < 24 * 60 * 60 * 1000
  );
}
export function definiteWriteRefusal(cause: unknown) {
  const response = (
    cause as { response?: { status?: number; error?: { code?: string } } }
  )?.response;
  if (!response) return false;
  const { status, error } = response;
  return (
    !!status &&
    status >= 400 &&
    status < 500 &&
    ![408, 429].includes(status) &&
    error?.code !== "REQUEST_IN_PROGRESS"
  );
}
