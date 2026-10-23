// A fresh authenticated connection starts at welcome.last_event_id, then reads
// current REST state. Replay deliberately overlaps its cursor. Events at/before
// that initial watermark belong to the earlier session/history, not this view.
// Keep accepting unseen events above it even if delivery is out of order.
function unseenEvent(stream, message) {
  return (
    message.type === "event" &&
    Number.isSafeInteger(message.event_id) &&
    message.event_id > 0 &&
    (stream.initialCursor === null ||
      message.event_id > stream.initialCursor) &&
    !stream.seen.has(message.event_id)
  );
}
// DEV-only socket-scoped licence fixtures are authenticated events, not durable
// history. Deliver them without changing the cursor or the normal dedup set.
function simulatedLicenseEvent(message) {
  return (
    message.type === "event" &&
    message.event_type === "system.license" &&
    message.simulated === true &&
    Number.isSafeInteger(message.event_id) &&
    message.event_id < 0 &&
    ["grace", "locked", "dev", "ok"].includes(message.payload?.state)
  );
}
module.exports = { unseenEvent, simulatedLicenseEvent };
