import test from "node:test";
import assert from "node:assert/strict";
import {
  getAttendanceCapabilityView,
  validateManualPunch,
  validateShiftAssignment,
  formatAttendanceStatusBadge,
  formatPunchSourceBadge,
  formatWorkedMinutes,
  formatLateMinutes,
  formatPunchTime,
  ISO_WEEKDAY_NAMES,
  ATTENDANCE_ERROR_MESSAGES
} from "../src/attendance-policy.ts";

test("attendance capability view assigns modes and permission flags", () => {
  // Full permissions
  const full = getAttendanceCapabilityView(
    { views: { screens: ["attendance"] } },
    ["hr.attendance.view", "hr.attendance.manual", "hr.shift.manage", "attendance.roll_call"]
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canView, true);
  assert.equal(full.canCorrect, true);
  assert.equal(full.canCompute, true);
  assert.equal(full.canManageShift, true);
  assert.equal(full.canRollCall, true);

  // Read-only / records mode
  const records = getAttendanceCapabilityView(
    { views: { screens: ["attendance"] } },
    ["hr.attendance.view"]
  );
  assert.equal(records.mode, "records");
  assert.equal(records.canView, true);
  assert.equal(records.canCorrect, false);
  assert.equal(records.canManageShift, false);

  // Hidden when permission missing
  const hiddenPerm = getAttendanceCapabilityView(
    { views: { screens: ["attendance"] } },
    ["unrelated.perm"]
  );
  assert.equal(hiddenPerm.mode, "hidden");

  // Hidden when establishment explicitly excludes screen
  const hiddenEst = getAttendanceCapabilityView(
    { views: { screens: ["other_screen"] } },
    ["*"]
  );
  assert.equal(hiddenEst.mode, "hidden");
});

test("rule:7e57360f0f - validateManualPunch mandates employee_id, valid timestamp, and documented reason (min 3 chars)", () => {
  // Missing employee
  const res1 = validateManualPunch({
    employee_id: 0,
    punch_time: "2026-11-03T08:00:00Z",
    reason: "Valid reason for badge reader glitch"
  });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.employee_id);

  // Missing timestamp
  const res2 = validateManualPunch({
    employee_id: 1,
    punch_time: "",
    reason: "Valid reason"
  });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.punch_time);

  // Invalid timestamp
  const res3 = validateManualPunch({
    employee_id: 1,
    punch_time: "not-a-timestamp",
    reason: "Valid reason"
  });
  assert.equal(res3.valid, false);
  assert.ok(res3.errors.punch_time);

  // Reason too short (< 3 chars)
  const res4 = validateManualPunch({
    employee_id: 1,
    punch_time: "2026-11-03T08:00:00Z",
    reason: "ok"
  });
  assert.equal(res4.valid, false);
  assert.ok(res4.errors.reason);

  // Valid manual punch without optional attendance_date
  const res5 = validateManualPunch({
    employee_id: 5,
    punch_time: "2026-11-03T08:15:00Z",
    reason: "RFID scanner offline at North Gate; verified arrival with supervisor."
  });
  assert.equal(res5.valid, true);
  assert.equal(Object.keys(res5.errors).length, 0);
});

test("rule:57ff2b4a55 - validateManualPunch validates optional attendance_date override format", () => {
  // Invalid duty date format
  const res1 = validateManualPunch({
    employee_id: 5,
    punch_time: "2026-11-03T08:15:00Z",
    reason: "Night shift exit attribution",
    attendance_date: "03-11-2026"
  });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.attendance_date);

  // Valid duty date format (YYYY-MM-DD)
  const res2 = validateManualPunch({
    employee_id: 5,
    punch_time: "2026-11-03T08:15:00Z",
    reason: "Night shift exit counted for previous evening duty start",
    attendance_date: "2026-11-02"
  });
  assert.equal(res2.valid, true);
});

test("rule:edc1438113 - validateShiftAssignment allows shift_pattern_id null for roster-only staff", () => {
  // Roster-only staff (shift_pattern_id null) has no default shift
  const res = validateShiftAssignment({
    employee_id: 12,
    shift_pattern_id: null,
    effective_from: "2026-11-01",
    weekly_off_days: null
  });
  assert.equal(res.valid, true);
  assert.equal(Object.keys(res.errors).length, 0);
});

test("rule:e3a5ef53f8 - validateShiftAssignment mandates weekly_off_days when fixed default shift is assigned", () => {
  // Missing weekly_off_days for fixed shift
  const res1 = validateShiftAssignment({
    employee_id: 10,
    shift_pattern_id: 2,
    effective_from: "2026-11-01",
    weekly_off_days: null
  });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.weekly_off_days);

  // Invalid weekday number (0 or 8 outside 1..7 ISO weekdays)
  const res2 = validateShiftAssignment({
    employee_id: 10,
    shift_pattern_id: 2,
    effective_from: "2026-11-01",
    weekly_off_days: [0, 7]
  });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.weekly_off_days);

  // Valid fixed shift assignment with Sunday off (day 7)
  const res3 = validateShiftAssignment({
    employee_id: 10,
    shift_pattern_id: 2,
    effective_from: "2026-11-01",
    weekly_off_days: [7]
  });
  assert.equal(res3.valid, true);

  // Valid fixed shift assignment with Saturday & Sunday off (days 6 and 7)
  const res4 = validateShiftAssignment({
    employee_id: 10,
    shift_pattern_id: 2,
    effective_from: "2026-11-01",
    weekly_off_days: [6, 7]
  });
  assert.equal(res4.valid, true);
});

test("formatAttendanceStatusBadge formats all standard flags including paid rest days (Holiday, Off)", () => {
  const present = formatAttendanceStatusBadge("Present");
  assert.equal(present.labelEn, "Present");
  assert.equal(present.labelUr, "حاضر");

  const late = formatAttendanceStatusBadge("Late");
  assert.equal(late.labelEn, "Late");
  assert.equal(late.labelUr, "دیر سے");

  const absent = formatAttendanceStatusBadge("Absent");
  assert.equal(absent.labelEn, "Absent");
  assert.equal(absent.labelUr, "غیر حاضر");

  const halfDay = formatAttendanceStatusBadge("HalfDay");
  assert.equal(halfDay.labelEn, "Half Day");
  assert.equal(halfDay.labelUr, "نصف دن");

  const leave = formatAttendanceStatusBadge("Leave");
  assert.equal(leave.labelEn, "On Leave");
  assert.equal(leave.labelUr, "رخصت");

  // Rule e3a5ef53f8: Holiday and Off are paid rest days
  const holiday = formatAttendanceStatusBadge("Holiday");
  assert.equal(holiday.labelEn, "Public Holiday");
  assert.equal(holiday.labelUr, "سرکاری تعطیل");

  const off = formatAttendanceStatusBadge("Off");
  assert.equal(off.labelEn, "Weekly Off");
  assert.equal(off.labelUr, "ہفتہ وار آرام");
});

test("rule:7e57360f0f - formatPunchSourceBadge distinguishes Badge, RollCall, and Manual sources", () => {
  const badge = formatPunchSourceBadge("Badge");
  assert.equal(badge.labelEn, "RFID Badge");
  assert.equal(badge.labelUr, "آر ایف آئی ڈی بیج");

  const rollCall = formatPunchSourceBadge("RollCall");
  assert.equal(rollCall.labelEn, "Roll Call");
  assert.equal(rollCall.labelUr, "رول کال");

  const manual = formatPunchSourceBadge("Manual");
  assert.equal(manual.labelEn, "Manual Correction");
  assert.equal(manual.labelUr, "دستی تصحیح");
});

test("formatting helpers convert minutes and timestamps accurately", () => {
  assert.equal(formatWorkedMinutes(0), "0m");
  assert.equal(formatWorkedMinutes(45), "45m");
  assert.equal(formatWorkedMinutes(120), "2h");
  assert.equal(formatWorkedMinutes(510), "8h 30m");

  assert.equal(formatLateMinutes(0), "—");
  assert.equal(formatLateMinutes(15), "15 min late");

  assert.equal(formatPunchTime(null), "—");
  assert.ok(formatPunchTime("2026-11-03T08:00:00Z").length > 0);
});

test("ISO_WEEKDAY_NAMES provides complete bilingual weekday mappings for all 7 days", () => {
  assert.equal(ISO_WEEKDAY_NAMES.length, 7);
  assert.equal(ISO_WEEKDAY_NAMES[0].day, 1);
  assert.equal(ISO_WEEKDAY_NAMES[0].nameEn, "Monday");
  assert.equal(ISO_WEEKDAY_NAMES[6].day, 7);
  assert.equal(ISO_WEEKDAY_NAMES[6].nameEn, "Sunday");
});

test("ATTENDANCE_ERROR_MESSAGES dictionary contains complete bilingual messages", () => {
  const requiredCodes = [
    "PUNCH_OUT_OF_RANGE",
    "PUNCH_DUPLICATE",
    "PUNCH_DATE_CLOSED",
    "SHIFT_OVERLAP",
    "EMPLOYEE_NOT_FOUND",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "NETWORK_ERROR"
  ];
  for (const code of requiredCodes) {
    const msg = ATTENDANCE_ERROR_MESSAGES[code];
    assert.ok(msg, `Missing message for code ${code}`);
    assert.ok(msg.en && msg.en.length > 0);
    assert.ok(msg.ur && msg.ur.length > 0);
  }
});
