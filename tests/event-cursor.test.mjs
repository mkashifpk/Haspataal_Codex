import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { unseenEvent, simulatedLicenseEvent } = createRequire(import.meta.url)(
  "../electron/event-cursor.cjs",
);

test("socket-scoped DEV licence events deliver without joining durable replay history", () => {
  const stream = { initialCursor: 100, last: 101, seen: new Set([101]) };
  const message = {
    type: "event",
    event_type: "system.license",
    event_id: -1,
    simulated: true,
    payload: { state: "grace" },
  };
  for (const state of ["grace", "locked", "dev", "ok"]) {
    const event = { ...message, payload: { state } };
    assert(simulatedLicenseEvent(event));
    assert(!unseenEvent(stream, event));
  }
  for (const change of [
    { simulated: false },
    { event_id: 1 },
    { event_type: "session.revoked" },
    { payload: { state: "invalid" } },
    { type: "welcome" },
  ])
    assert(!simulatedLicenseEvent({ ...message, ...change }));
  assert.equal(stream.last, 101);
  assert.deepEqual([...stream.seen], [101]);
});
test("old reset at initial welcome/replay boundary cannot revoke the new session", () => {
  const stream = { initialCursor: 353, last: 354, seen: new Set([354]) };
  const revoked = {
    type: "event",
    event_type: "session.revoked",
    event_id: 353,
  };
  assert.equal(unseenEvent(stream, revoked), false);
  assert.equal(unseenEvent(stream, { ...revoked, event_id: 352 }), false);
  assert.equal(unseenEvent(stream, { ...revoked, event_id: 355 }), true);
});
test("new notification replay de-duplicates without dropping unseen out-of-order delivery", () => {
  const stream = { initialCursor: 353, last: 356, seen: new Set([356]) };
  const notification = {
    type: "event",
    event_type: "notification.created",
    event_id: 355,
  };
  assert.equal(unseenEvent(stream, notification), true);
  stream.seen.add(355);
  assert.equal(unseenEvent(stream, notification), false);
  assert.equal(unseenEvent(stream, { ...notification, event_id: 357 }), true);
});
test("protocol messages and malformed event identities never advance replay", () => {
  const stream = { initialCursor: null, last: null, seen: new Set() };
  for (const event_id of [0, -1, NaN, Infinity, "355", 1.5])
    assert.equal(unseenEvent(stream, { type: "event", event_id }), false);
  assert.equal(unseenEvent(stream, { type: "welcome", event_id: 355 }), false);
  assert.equal(unseenEvent(stream, { type: "event", event_id: 355 }), true);
});
