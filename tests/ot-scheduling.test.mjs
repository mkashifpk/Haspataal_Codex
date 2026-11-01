import test from "node:test";
import assert from "node:assert/strict";

import {
  getOtSchedulingScreenView,
  isSurgeryActive,
  canManageOt,
  canRequestOt,
  canViewOt,
  canProvisionTheater,
  checkSlotAvailability,
  validateBookingRequest,
  validateScheduleInput,
  validateTheaterState,
  validateBookingCancellation,
  explainOtSchedulingError,
} from "../src/ot-scheduling-policy.ts";

test("getOtSchedulingScreenView evaluates establishment views and surgery capability state (rule:b5f0fd9a68)", () => {
  // Null fallback
  assert.equal(getOtSchedulingScreenView(null), "full");

  // Server declared screen view takes precedence
  const estWithScreenView = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [],
    views: {
      screens: [{ screen_id: "ot_scheduling", view: "open_work" }],
      workspaces: [],
    },
  };
  assert.equal(getOtSchedulingScreenView(estWithScreenView), "open_work");

  // Capability state fallbacks
  const estRetiring = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Retiring" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtSchedulingScreenView(estRetiring), "open_work");

  const estRetired = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Retired" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtSchedulingScreenView(estRetired), "records");

  const estPreparing = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Preparing" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtSchedulingScreenView(estPreparing), "setup");

  const estAvailable = {
    revision: 1,
    profile: null,
    active: ["surgery"],
    rules_in_force: [],
    capabilities: [{ capability: "surgery", state: "Available" }],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtSchedulingScreenView(estAvailable), "hidden");

  // Inactive surgery fallback
  const estInactive = {
    revision: 1,
    profile: null,
    active: ["pharmacy", "opd"],
    rules_in_force: [],
    capabilities: [],
    views: { screens: [], workspaces: [] },
  };
  assert.equal(getOtSchedulingScreenView(estInactive), "setup");
});

test("isSurgeryActive and role permissions for OT scheduling (rule:ae87186675)", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive({ active: ["opd"] }), false);
  assert.equal(isSurgeryActive({ active: ["surgery", "cssd"] }), true);

  // canManageOt
  assert.equal(canManageOt(null), false);
  assert.equal(canManageOt({ permissions: ["ot.booking.request"] }), false);
  assert.equal(canManageOt({ permissions: ["ot.booking.manage"] }), true);

  // canRequestOt
  assert.equal(canRequestOt(null), false);
  assert.equal(canRequestOt({ permissions: ["ot.booking.request"] }), true);
  assert.equal(canRequestOt({ permissions: ["ot.booking.manage"] }), true);
  assert.equal(canRequestOt({ permissions: ["ward.view"] }), false);

  // canViewOt
  assert.equal(canViewOt(null), false);
  assert.equal(canViewOt({ permissions: ["ot.booking.view"] }), true);
  assert.equal(canViewOt({ permissions: ["ot.status.view"] }), true);
  assert.equal(canViewOt({ permissions: ["ot.booking.manage"] }), true);

  // canProvisionTheater
  assert.equal(canProvisionTheater(null), false);
  assert.equal(canProvisionTheater({ permissions: ["ot.theater.provision"] }), true);
  assert.equal(canProvisionTheater({ permissions: ["ot.booking.manage"] }), true);
  assert.equal(canProvisionTheater({ permissions: ["doctor.view"] }), false);
});

test("checkSlotAvailability detects overlapping booking and turnover buffer (rule:992db951e1)", () => {
  const existingBlocks = [
    {
      booking_id: 101,
      booking_number: "OT-2026-0001",
      ot_id: 1,
      ot_name: "OR 1",
      status: "Scheduled",
      booking_type: "Scheduled",
      scheduled_start: "2026-11-02T09:00:00Z",
      scheduled_end: "2026-11-02T10:30:00Z",
      actual_start: null,
      actual_end: null,
      procedure_name: "Cholecystectomy",
      surgeon_name: "Dr. Tariq",
      patient_name: "Ali Khan",
      mrn: "MRN-101",
    },
  ];

  // Conflict directly inside the booking
  const directConflict = checkSlotAvailability(
    1,
    "2026-11-02T09:30:00Z",
    60,
    existingBlocks,
    20
  );
  assert.equal(directConflict.hasConflict, true);
  assert.equal(directConflict.conflictingBookingId, 101);
  assert.equal(directConflict.conflictingProcedure, "Cholecystectomy");

  // Conflict inside the 20-minute post-op turnover buffer (10:30 - 10:50)
  const bufferConflict = checkSlotAvailability(
    1,
    "2026-11-02T10:40:00Z",
    30,
    existingBlocks,
    20
  );
  assert.equal(bufferConflict.hasConflict, true);
  assert.equal(bufferConflict.conflictingBookingId, 101);

  // No conflict after turnover buffer has cleared (10:50 onwards)
  const noConflict = checkSlotAvailability(
    1,
    "2026-11-02T11:00:00Z",
    60,
    existingBlocks,
    20
  );
  assert.equal(noConflict.hasConflict, false);

  // Different theatre suite -> no conflict
  const otherOt = checkSlotAvailability(
    2,
    "2026-11-02T09:30:00Z",
    60,
    existingBlocks,
    20
  );
  assert.equal(otherOt.hasConflict, false);
});

test("checkSlotAvailability calculates next free slot when overlap is detected (rule:992db951e1)", () => {
  const existingBlocks = [
    {
      booking_id: 101,
      booking_number: "OT-2026-0001",
      ot_id: 1,
      ot_name: "OR 1",
      status: "Scheduled",
      booking_type: "Scheduled",
      scheduled_start: "2026-11-02T09:00:00Z",
      scheduled_end: "2026-11-02T10:30:00Z",
      actual_start: null,
      actual_end: null,
      procedure_name: "Cholecystectomy",
      surgeon_name: "Dr. Tariq",
      patient_name: "Ali Khan",
      mrn: "MRN-101",
    },
  ];

  const conflict = checkSlotAvailability(
    1,
    "2026-11-02T09:00:00Z",
    60,
    existingBlocks,
    20
  );
  assert.equal(conflict.hasConflict, true);
  assert.ok(conflict.nextFreeSlot);
  // Next free slot should start after scheduled_end (10:30) + 20 min turnover = 10:50, rounded to 11:00
  const freeTime = new Date(conflict.nextFreeSlot).getTime();
  const minExpected = new Date("2026-11-02T10:50:00Z").getTime();
  assert.ok(freeTime >= minExpected);
});

test("validateBookingRequest validates patient, procedure name, and emergency reasons", () => {
  // Empty request
  const emptyRes = validateBookingRequest({});
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.errors[0], /Patient selection is required/);

  // Valid elective request
  const validElective = validateBookingRequest({
    patient_id: 12,
    procedure_name: "Inguinal Hernia Repair",
    booking_type: "Scheduled",
  });
  assert.equal(validElective.valid, true);
  assert.equal(validElective.errors.length, 0);

  // Emergency request missing justification
  const emergencyNoReason = validateBookingRequest({
    patient_id: 12,
    procedure_name: "Exploratory Laparotomy",
    booking_type: "Emergency",
    emergency_reason: "",
  });
  assert.equal(emergencyNoReason.valid, false);
  assert.match(emergencyNoReason.errors[0], /emergency justification reason/);

  // Valid Emergency request with justification
  const validEmergency = validateBookingRequest({
    patient_id: 12,
    procedure_name: "Exploratory Laparotomy",
    booking_type: "Emergency",
    emergency_reason: "Acute hemoperitoneum following blunt abdominal trauma",
  });
  assert.equal(validEmergency.valid, true);
  assert.equal(validEmergency.errors.length, 0);
});

test("validateScheduleInput validates theatre selection, valid ISO start datetime, and positive duration", () => {
  // Missing theatre
  const missingOt = validateScheduleInput({
    scheduled_start: "2026-11-02T14:00:00Z",
    duration_minutes: 60,
  });
  assert.equal(missingOt.valid, false);
  assert.match(missingOt.errors[0], /Select an active operating theatre/);

  // Invalid date
  const invalidDate = validateScheduleInput({
    ot_id: 1,
    scheduled_start: "not-a-date",
    duration_minutes: 60,
  });
  assert.equal(invalidDate.valid, false);
  assert.match(invalidDate.errors[0], /valid date and time/);

  // Non-positive duration
  const badDuration = validateScheduleInput({
    ot_id: 1,
    scheduled_start: "2026-11-02T14:00:00Z",
    duration_minutes: 0,
  });
  assert.equal(badDuration.valid, false);
  assert.match(badDuration.errors[0], /greater than 0 minutes/);

  // Valid schedule input
  const validSchedule = validateScheduleInput({
    ot_id: 1,
    scheduled_start: "2026-11-02T14:00:00Z",
    duration_minutes: 90,
  });
  assert.equal(validSchedule.valid, true);
  assert.equal(validSchedule.errors.length, 0);
});

test("validateTheaterState and validateBookingCancellation require non-blank reasons", () => {
  assert.equal(validateTheaterState({ reason: "" }).valid, false);
  assert.equal(validateTheaterState({ reason: "   " }).valid, false);
  assert.equal(validateTheaterState({ reason: "Fumigation" }).valid, true);

  assert.equal(validateBookingCancellation({ reason: "" }).valid, false);
  assert.equal(validateBookingCancellation({ reason: "Postponed by surgeon" }).valid, true);
});

test("explainOtSchedulingError provides accurate bilingual explanations", () => {
  // OT_DOUBLE_BOOKING
  const doubleBook = explainOtSchedulingError("OT_DOUBLE_BOOKING");
  assert.match(doubleBook.en, /overlaps with an existing booking/);
  assert.match(doubleBook.ur, /وقت کا تصادم|دوسری بکنگ/);

  // OT_PRIVILEGE_REQUIRED
  const privRequired = explainOtSchedulingError("OT_PRIVILEGE_REQUIRED", { privilege: "Cardiac Surgery" });
  assert.match(privRequired.en, /Cardiac Surgery/);
  assert.match(privRequired.ur, /Cardiac Surgery/);

  // CAPABILITY_INACTIVE
  const capInactive = explainOtSchedulingError("CAPABILITY_INACTIVE");
  assert.match(capInactive.en, /Surgery service is currently inactive/);
  assert.match(capInactive.ur, /سرجری سروس فی الوقت غیر فعال ہے/);

  // FORBIDDEN
  const forbidden = explainOtSchedulingError("FORBIDDEN");
  assert.match(forbidden.en, /ot.booking.manage or ot.booking.request/);
  assert.match(forbidden.ur, /ot.booking.manage یا ot.booking.request/);

  // Fallback
  const fallback = explainOtSchedulingError("UNKNOWN_ERR");
  assert.match(fallback.en, /UNKNOWN_ERR/);
  assert.match(fallback.ur, /UNKNOWN_ERR/);
});
