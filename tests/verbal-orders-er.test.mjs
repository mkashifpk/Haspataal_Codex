import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateVerbalOrdersErView,
  canRecordVerbal,
  canViewVerbalOrders,
  canSearchDrugs,
  isDispensingActive,
  validateVerbalOrderTarget,
  validateVerbalOrderLineSafety,
  isVerbalOrderOverdue,
} from "../src/verbal-orders-er-policy.ts";
import { validateVerbalLine } from "../src/verbal-order-policy.ts";

test("verbal_orders_er: permissions gating", () => {
  assert.equal(canRecordVerbal(["prescription.verbal.record"]), true);
  assert.equal(canRecordVerbal(["prescription.view"]), false);
  assert.equal(canRecordVerbal([]), false);

  assert.equal(canViewVerbalOrders(["prescription.view"]), true);
  assert.equal(canViewVerbalOrders(["prescription.verbal.record"]), true);
  assert.equal(canViewVerbalOrders(["opd.ticket.create"]), false);

  assert.equal(canSearchDrugs(["pharmacy.formulary.view"]), true);
  assert.equal(canSearchDrugs(["pharmacy.stock.view"]), false);
});

test("verbal_orders_er: service view evaluation (rule 0f229c1efb)", () => {
  const full = evaluateVerbalOrdersErView({
    views: {
      screens: [{ screen_id: "verbal_orders_er", view: "full" }],
    },
  });
  assert.equal(full.isFull, true);
  assert.equal(full.canStartNew, true);
  assert.equal(full.banner, null);

  const openWork = evaluateVerbalOrdersErView({
    views: {
      screens: [{ screen_id: "verbal_orders_er", view: "open_work" }],
    },
  });
  assert.equal(openWork.isOpenWork, true);
  assert.equal(openWork.canStartNew, false);
  assert.match(openWork.banner.en, /No new verbal orders from now on/i);

  const records = evaluateVerbalOrdersErView({
    views: {
      screens: [{ screen_id: "verbal_orders_er", view: "records" }],
    },
  });
  assert.equal(records.isRecords, true);
  assert.equal(records.canStartNew, false);
  assert.match(records.banner.en, /Records/i);

  const hidden = evaluateVerbalOrdersErView({
    views: {
      screens: [{ screen_id: "verbal_orders_er", view: "hidden" }],
    },
  });
  assert.equal(hidden.isHidden, true);
  assert.equal(hidden.canStartNew, false);
});

test("verbal_orders_er: dispensing capability gate (rule 7cbb490706)", () => {
  assert.equal(isDispensingActive(["emergency_department", "dispensing"]), true);
  assert.equal(isDispensingActive(["emergency_department"]), false);
  assert.equal(isDispensingActive([]), false);
});

test("verbal_orders_er: target patient validation (rule b72c59a315)", () => {
  // Emergency patient with ticket_id is valid
  assert.equal(
    validateVerbalOrderTarget({
      patient_id: 101,
      ticket_id: 501,
      source: "ER",
    }),
    true,
  );

  // Inpatient with admission_id is valid
  assert.equal(
    validateVerbalOrderTarget({
      patient_id: 102,
      admission_id: 42,
      source: "IPD",
    }),
    true,
  );

  // Both ticket and admission is valid
  assert.equal(
    validateVerbalOrderTarget({
      patient_id: 103,
      ticket_id: 502,
      admission_id: 43,
      source: "ER",
    }),
    true,
  );

  // Deceased patient is rejected
  assert.throws(
    () =>
      validateVerbalOrderTarget({
        patient_id: 104,
        ticket_id: 503,
        is_deceased: true,
      }),
    /deceased/i,
  );

  // Missing ticket and admission (unbilled/outpatient) is rejected
  assert.throws(
    () =>
      validateVerbalOrderTarget({
        patient_id: 105,
        ticket_id: null,
        admission_id: null,
      }),
    /VERBAL_ORDER_INVALID/i,
  );

  // Explicit outpatient OPD is rejected
  assert.throws(
    () =>
      validateVerbalOrderTarget({
        patient_id: 106,
        ticket_id: 504,
        source: "OPD",
      }),
    /outpatient verbal orders are strictly prohibited/i,
  );
});

test("verbal_orders_er: chemotherapy is strictly prohibited (rule b72c59a315)", () => {
  // Normal medicine is permitted
  assert.equal(
    validateVerbalOrderLineSafety({
      drug: { high_alert_category: "Insulin", lasa_with: [] },
      destination: "HospitalPharmacy",
    }),
    true,
  );

  // Chemotherapy is rejected with VERBAL_ORDER_INVALID
  assert.throws(
    () =>
      validateVerbalOrderLineSafety({
        drug: { high_alert_category: "Chemotherapy", lasa_with: [] },
        destination: "HospitalPharmacy",
      }),
    /Chemotherapy cannot be a verbal order/i,
  );
});

test("verbal_orders_er: line validation constraints", () => {
  const validLine = {
    qty_prescribed: 10,
    dose_text: "500 mg",
    route: "Oral",
    frequency_code: "TDS",
    start_at: "2026-11-01T10:00:00Z",
    interval_hours: 8,
    duration_days: 5,
  };
  assert.deepEqual(validateVerbalLine(validLine), validLine);

  // Invalid quantity
  assert.throws(
    () => validateVerbalLine({ ...validLine, qty_prescribed: 0 }),
    /Quantity must be positive/i,
  );

  // Missing route
  assert.throws(
    () => validateVerbalLine({ ...validLine, route: "" }),
    /route/i,
  );

  // End time before start time
  assert.throws(
    () =>
      validateVerbalLine({
        ...validLine,
        start_at: "2026-11-01T12:00:00Z",
        end_at: "2026-11-01T10:00:00Z",
      }),
    /End time precedes start time/i,
  );
});

test("verbal_orders_er: overdue countersignature calculation (rule 21e60a9c9a)", () => {
  const past = new Date(Date.now() - 3600000).toISOString();
  const future = new Date(Date.now() + 3600000).toISOString();

  // Already countersigned: not overdue
  assert.equal(
    isVerbalOrderOverdue({
      countersigned_at: "2026-10-31T12:00:00Z",
      countersign_due_at: past,
      is_overdue: true,
    }),
    false,
  );

  // Server marked overdue
  assert.equal(
    isVerbalOrderOverdue({
      countersigned_at: null,
      is_overdue: true,
    }),
    true,
  );

  // Past due time
  assert.equal(
    isVerbalOrderOverdue({
      countersigned_at: null,
      is_overdue: false,
      countersign_due_at: past,
    }),
    true,
  );

  // In the future and not countersigned: not overdue
  assert.equal(
    isVerbalOrderOverdue({
      countersigned_at: null,
      is_overdue: false,
      countersign_due_at: future,
    }),
    false,
  );
});
