import test from "node:test";
import assert from "node:assert/strict";
import {
  writeAttempt,
  canRetryWrite,
  definiteWriteRefusal,
} from "../src/write-attempt.ts";
test("retained write freezes a deep snapshot and has bounded explicit retry", () => {
  const source = { value: { a: 1 } },
    time = 1000;
  const attempt = writeAttempt(source, time);
  source.value.a = 2;
  assert.equal(attempt.body.value.a, 1);
  assert(canRetryWrite(attempt, time));
  assert(!canRetryWrite(attempt, time - 1));
  assert(!canRetryWrite(attempt, time + 86400000));
  assert(attempt.key !== writeAttempt(source, time).key);
});
test("lost/in-progress/throttled/server replies keep original identity; only definitive refusal releases", () => {
  for (const error of [
    new Error("lost"),
    { response: { status: 200 } },
    { response: { status: 408 } },
    { response: { status: 429 } },
    { response: { status: 503 } },
    { response: { status: 409, error: { code: "REQUEST_IN_PROGRESS" } } },
  ])
    assert(!definiteWriteRefusal(error));
  assert(
    definiteWriteRefusal({
      response: { status: 422, error: { code: "VALIDATION_ERROR" } },
    }),
  );
});
