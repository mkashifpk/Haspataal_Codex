import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isVerbalOrderOverdue,
  validateCountersignReadback,
  validateQueryAnswer,
  validateStopItem,
} from "../src/medication-orders-doctor-policy.ts";

test("rule:15dd98f03c verbal order overdue detection marks unconfirmed orders past countersign_due_at", () => {
  const due = "2026-10-30T10:00:00Z";
  // Before due time
  assert.equal(
    isVerbalOrderOverdue({
      countersign_due_at: due,
      countersigned_at: null,
      now: "2026-10-30T09:59:00Z",
    }),
    false
  );
  // Past due time
  assert.equal(
    isVerbalOrderOverdue({
      countersign_due_at: due,
      countersigned_at: null,
      now: "2026-10-30T10:01:00Z",
    }),
    true
  );
  // Already countersigned: never overdue
  assert.equal(
    isVerbalOrderOverdue({
      countersign_due_at: due,
      countersigned_at: "2026-10-30T11:00:00Z",
      now: "2026-10-30T12:00:00Z",
    }),
    false
  );
});

test("rule:15dd98f03c countersignature requires readback verification and matches original prescriber", () => {
  const order = { prescriber_id: 10, countersigned_at: null };

  // Cannot countersign without readback confirmation
  const unconfirmed = validateCountersignReadback(false, order, 10);
  assert.equal(unconfirmed.ok, false);
  assert.equal(unconfirmed.code, "READBACK_REQUIRED");

  // Different user cannot countersign (VERBAL_ORDER_COUNTERSIGN_INVALID)
  const wrongDoctor = validateCountersignReadback(true, order, 99);
  assert.equal(wrongDoctor.ok, false);
  assert.equal(wrongDoctor.code, "VERBAL_ORDER_COUNTERSIGN_INVALID");

  // Already countersigned
  const alreadyDone = validateCountersignReadback(
    true,
    { prescriber_id: 10, countersigned_at: "2026-10-30T10:00:00Z" },
    10
  );
  assert.equal(alreadyDone.ok, false);
  assert.equal(alreadyDone.code, "VERBAL_ORDER_COUNTERSIGN_INVALID");

  // Happy path
  const valid = validateCountersignReadback(true, order, 10);
  assert.equal(valid.ok, true);
});

test("rule:aac4a043c3 query answer allows ConfirmedAsWritten, but Changed requires line stopped first", () => {
  // Empty answer is refused
  const empty = validateQueryAnswer("ConfirmedAsWritten", "   ", false);
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "VALIDATION_ERROR");

  // ConfirmedAsWritten does not require stopping the line
  const confirmed = validateQueryAnswer(
    "ConfirmedAsWritten",
    "Both orders intended; telephone order was initial stat dose",
    false
  );
  assert.equal(confirmed.ok, true);

  // Changed WITHOUT line stopped is refused with PRESCRIPTION_QUERY_STATE_INVALID
  const changedUnstopped = validateQueryAnswer(
    "Changed",
    "Stop duplicate oral line and replace with IV",
    false
  );
  assert.equal(changedUnstopped.ok, false);
  assert.equal(changedUnstopped.code, "PRESCRIPTION_QUERY_STATE_INVALID");

  // Changed WITH line stopped is permitted
  const changedStopped = validateQueryAnswer(
    "Changed",
    "Queried line has been stopped. New replacement order submitted.",
    true
  );
  assert.equal(changedStopped.ok, true);
});

test("stop medication line requires non-blank clinical reason bounded to 500 chars", () => {
  assert.equal(validateStopItem("").ok, false);
  assert.equal(validateStopItem("   ").ok, false);
  assert.equal(validateStopItem("x".repeat(501)).ok, false);

  const ok = validateStopItem("Ineffective dose, switched to alternative agent");
  assert.equal(ok.ok, true);
});

test("medication_orders_doctor component uses idempotency on query answer and registers event listeners", () => {
  const componentSrc = fs.readFileSync("src/screens/MedicationOrdersDoctor.tsx", "utf8");
  assert(componentSrc.includes("answerQuery(queryTarget.query_id"));
  assert(componentSrc.includes("medication.order.updated"));
  assert(componentSrc.includes("notification.created"));
  assert(componentSrc.includes("ConfirmedAsWritten"));
  assert(componentSrc.includes("Changed"));
  assert(componentSrc.includes("readbackConfirmed"));

  const contractSrc = fs.readFileSync("src/generated/medication_orders_doctor.ts", "utf8");
  assert(contractSrc.includes("idempotent: true"));
});
