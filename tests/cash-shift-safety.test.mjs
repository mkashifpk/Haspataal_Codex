import test from "node:test";
import assert from "node:assert/strict";
import {
  cashAmount,
  createShiftOpen,
  definiteShiftRefusal,
  mayRetryShiftOpen,
  matchesShiftCloseReview,
} from "../src/cash-shift-safety.ts";

test("closing retains the reviewed drawer and totals across refreshes", () => {
  const review = Object.freeze({
    shiftId: 12,
    node: "MainReception",
    expectedCash: 50,
    declaredCash: 45,
  });
  const shift = {
    shift_id: 12,
    node: "MainReception",
    expected_cash: 50,
    status: "Open",
  };
  assert(matchesShiftCloseReview(review, shift));
  for (const change of [
    { shift_id: 13 },
    { node: "CashierDesk" },
    { expected_cash: 51 },
    { status: "PendingCollection" },
  ])
    assert(!matchesShiftCloseReview(review, { ...shift, ...change }));
  assert(!matchesShiftCloseReview(review, null));
  assert(!matchesShiftCloseReview(review, undefined));
  assert.equal(review.declaredCash, 45);
});

test("cash amounts refuse empty/partial/nonfinite/negative values without turning them into zero", () => {
  for (const input of [
    "",
    " ",
    "12oops",
    "-1",
    "Infinity",
    "NaN",
    "1e309",
    "1,000",
  ])
    assert.equal(cashAmount(input), undefined, input);
  assert.equal(cashAmount("0"), 0);
  assert.equal(cashAmount(" 1250.50 "), 1250.5);
});
test("lost opening retains an immutable identity/body; only the opening can replay inside retention", () => {
  const action = createShiftOpen("MainReception", 50, "original-action", 1000);
  assert.throws(() => {
    action.body.opening_float = 900;
  }, TypeError);
  assert.equal(action.key, "original-action");
  assert(mayRetryShiftOpen(action, 1001));
  assert(!mayRetryShiftOpen(action, 999));
  assert(!mayRetryShiftOpen(action, 1000 + 86400000));
  assert(
    !mayRetryShiftOpen(
      { kind: "close", shiftId: 12, body: { declared_cash: 50 } },
      1001,
    ),
  );
});
test("transport, throttling and bad successful responses remain uncertain; definitive refusals are distinct", () => {
  for (const status of [undefined, 200, 201, 408, 429, 500, 503])
    assert(!definiteShiftRefusal({ response: { status } }), String(status));
  for (const status of [400, 403, 409, 422])
    assert(definiteShiftRefusal({ response: { status } }), String(status));
  assert(!definiteShiftRefusal(new Error("connection lost")));
});
