import { test } from "node:test";
import assert from "node:assert/strict";
import {
  queueActions,
  ticketExpired,
  requestKinds,
  decimalAmount,
} from "../src/ticket-policy.ts";
// Minimal unit inputs, never substituted for DEV responses or runtime evidence.
const ticket = () => ({
  status: "Waiting",
  payment_status: "Paid",
  approval_lock: "None",
  valid_until: "2026-10-23T12:00:00Z",
  cash_back_prompts: [],
  invoice: { amount_paid: 1000, amount_refunded: 0, balance_due: 0 },
});
const p = ["opd.ticket.defer", "opd.ticket.reactivate", "opd.ticket.cancel"];
test("queue writes require permissions and unlocked eligible lifecycle", () => {
  const t = ticket(),
    now = Date.parse("2026-10-22T12:00:00Z");
  assert.deepEqual(queueActions(t, p, now), {
    defer: true,
    reactivate: false,
    cancel: false,
  });
  assert.equal(queueActions(t, [], now).defer, false);
  t.approval_lock = "RefundPending";
  assert.equal(queueActions(t, p, now).defer, false);
  t.approval_lock = "None";
  t.cash_back_prompts = [{ kind: "Refund", id: 1 }];
  assert.equal(queueActions(t, p, now).defer, false);
});
test("expiry uses supplied server clock, and unknown clock cannot reactivate", () => {
  const t = ticket();
  t.status = "Deferred";
  assert.equal(
    queueActions(t, p, Date.parse("2026-10-22T12:00:00Z")).reactivate,
    true,
  );
  assert.equal(queueActions(t, p, Date.parse(t.valid_until)).reactivate, false);
  assert.equal(queueActions(t, p, NaN).reactivate, false);
  t.status = "Expired";
  assert.equal(ticketExpired(t, NaN), true);
});
test("cancellation never offers an invoice with actual payments", () => {
  const t = ticket();
  t.status = "Issued";
  t.payment_status = "Unpaid";
  assert.equal(queueActions(t, p, 0).cancel, false);
  t.invoice.amount_paid = 0;
  assert.equal(queueActions(t, p, 0).cancel, true);
});
test("requests respect permission, clinical handover and real money remaining", () => {
  const t = ticket();
  assert.deepEqual(requestKinds(t, ["opd.refund.request"]), ["refund-request"]);
  t.invoice.amount_refunded = 1000;
  assert.deepEqual(requestKinds(t, ["opd.refund.request"]), []);
  t.examined_at = "2026-10-22T12:00:00Z";
  assert.deepEqual(requestKinds(t, ["opd.waiver.request_post_consult"]), [
    "vip-waiver-post-consult",
  ]);
  assert.deepEqual(requestKinds(t, []), []);
  t.approval_lock = "WaiverPending";
  assert.deepEqual(requestKinds(t, ["opd.waiver.request_post_consult"]), []);
});
test("unpaid void/waiver/credit disappear for paid and closed visits", () => {
  const t = ticket(),
    perms = ["opd.ticket.void", "opd.waiver.request", "opd.credit.request"];
  assert.deepEqual(requestKinds(t, perms), []);
  t.status = "Issued";
  t.payment_status = "Unpaid";
  t.invoice.amount_paid = 0;
  assert.deepEqual(requestKinds(t, perms), [
    "void",
    "vip-waiver-request",
    "credit-request",
  ]);
  t.status = "Cancelled";
  assert.deepEqual(requestKinds(t, perms), []);
});
test("money fields reject partial, exponential, negative, nonfinite and over-limit inputs", () => {
  for (const s of [
    "",
    " ",
    "-1",
    "1e3",
    "1.001",
    "NaN",
    "Infinity",
    ".5",
    "1.",
    "10x",
  ])
    assert.equal(decimalAmount(s), false, s);
  assert.equal(decimalAmount("0", 0, 100), true);
  assert.equal(decimalAmount("0", 0.01, 100), false);
  assert.equal(decimalAmount("100.01", 0.01, 100), false);
  assert.equal(decimalAmount("10.50", 0.01, 100), true);
});
