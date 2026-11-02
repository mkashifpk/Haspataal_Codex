import test from "node:test";
import assert from "node:assert/strict";
import {
  getSupportRosterCapabilityView,
  getWeekDates,
  isStaffOnLeave,
  isStaffDefaultWeeklyOff,
  isPublicHoliday,
  validateCancelDuty,
  validateCopyPeriod,
  validateRecordSwap,
  canUserApproveSwap,
  validateRollCallSubmission,
  formatWeeklyPrintableSchedule,
  filterRollCallEntries,
  SUPPORT_ROSTER_ERROR_MESSAGES
} from "../src/support-roster-policy.ts";

test("getSupportRosterCapabilityView resolves establishment views accurately", () => {
  assert.equal(getSupportRosterCapabilityView(undefined), "full");
  assert.equal(getSupportRosterCapabilityView({}), "full");
  assert.equal(getSupportRosterCapabilityView({ views: { screens: { support_roster: "open_work" } } }), "open_work");
  assert.equal(getSupportRosterCapabilityView({ views: { screens: { support_roster: "records" } } }), "records");
  assert.equal(getSupportRosterCapabilityView({ views: { screens: { support_roster: "setup" } } }), "setup");
  assert.equal(getSupportRosterCapabilityView({ views: { screens: { support_roster: "hidden" } } }), "hidden");
  // Fallback to rosters view
  assert.equal(getSupportRosterCapabilityView({ views: { screens: { rosters: "records" } } }), "records");
});

test("getWeekDates calculates 7 consecutive days starting Monday with Sunday identified (rule:4ea9d4f624)", () => {
  const days = getWeekDates("2026-11-02");
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-11-02");
  assert.equal(days[0].dayNameEn, "Monday");
  assert.equal(days[0].dayNameUr, "پیر");
  assert.equal(days[0].dayNumber, 1);
  assert.equal(days[0].isSunday, false);

  assert.equal(days[6].date, "2026-11-08");
  assert.equal(days[6].dayNameEn, "Sunday");
  assert.equal(days[6].dayNameUr, "اتوار");
  assert.equal(days[6].dayNumber, 7);
  assert.equal(days[6].isSunday, true);
});

test("isStaffOnLeave detects approved leave blackout windows (rule:7ee9e5cda4)", () => {
  const staff = {
    employee_id: 101,
    emp_number: "EMP-101",
    full_name: "Rashid Ali",
    designation: "Sanitary Worker",
    staff_category: "SupportZeroInterface",
    department_id: 5,
    leave: [
      {
        employee_id: 101,
        from_date: "2026-11-03",
        to_date: "2026-11-05",
        leave_type: "Casual"
      }
    ]
  };

  assert.equal(isStaffOnLeave(staff, "2026-11-02"), false);
  assert.equal(isStaffOnLeave(staff, "2026-11-03"), true);
  assert.equal(isStaffOnLeave(staff, "2026-11-04"), true);
  assert.equal(isStaffOnLeave(staff, "2026-11-05"), true);
  assert.equal(isStaffOnLeave(staff, "2026-11-06"), false);
});

test("isStaffDefaultWeeklyOff identifies weekly rest days (rule:4ea9d4f624)", () => {
  const staff = {
    employee_id: 102,
    emp_number: "EMP-102",
    full_name: "Baber Khan",
    designation: "Security Guard",
    staff_category: "SupportZeroInterface",
    department_id: 6,
    default_weekly_off_days: [5] // Friday = 5
  };

  // 2026-11-06 is Friday (ISO weekday 5)
  assert.equal(isStaffDefaultWeeklyOff(staff, "2026-11-06"), true);
  // 2026-11-02 is Monday (ISO weekday 1)
  assert.equal(isStaffDefaultWeeklyOff(staff, "2026-11-02"), false);
});

test("isPublicHoliday flags official public holidays (rule:2e75984ff7)", () => {
  const holidays = [
    { holiday_id: 1, holiday_date: "2026-11-09", name: "Iqbal Day" }
  ];

  const match = isPublicHoliday(holidays, "2026-11-09");
  assert.ok(match);
  assert.equal(match.name, "Iqbal Day");

  assert.equal(isPublicHoliday(holidays, "2026-11-10"), undefined);
});

test("validateCancelDuty requires operational justification reason (rule:e255d6b71a)", () => {
  assert.equal(validateCancelDuty("").valid, false);
  assert.equal(validateCancelDuty("  no ").valid, false); // 2 chars trimmed
  const validRes = validateCancelDuty("Medical emergency replacement");
  assert.equal(validRes.valid, true);
  assert.equal(validRes.errorEn, undefined);
});

test("validateCopyPeriod validates source and target weeks (rule:f72ed8bfcb)", () => {
  assert.equal(validateCopyPeriod({ source_from: "", source_to: "", target_from: "" }).valid, false);
  assert.equal(validateCopyPeriod({ source_from: "2026-11-02", source_to: "2026-11-08", target_from: "2026-11-02" }).valid, false);
  const validRes = validateCopyPeriod({ source_from: "2026-11-02", source_to: "2026-11-08", target_from: "2026-11-09" });
  assert.equal(validRes.valid, true);
});

test("validateRecordSwap and canUserApproveSwap prevent self-approval (rule:83718fc56e)", () => {
  // Proposer equals receiver
  assert.equal(
    validateRecordSwap(10, 10, 1, 2).valid,
    false
  );

  // Missing duties
  assert.equal(
    validateRecordSwap(10, 20, 0, 2).valid,
    false
  );

  // Valid swap
  assert.equal(
    validateRecordSwap(10, 20, 1, 2).valid,
    true
  );

  const swap = {
    swap_id: 5,
    kind: "Swap",
    roster_id: 1,
    return_roster_id: 2,
    requester_employee_id: 10,
    requester_name: "Staff A",
    covering_employee_id: 20,
    covering_name: "Staff B",
    staff_category: "SupportZeroInterface",
    duty: {
      roster_id: 1,
      employee_id: 10,
      emp_number: "EMP-10",
      full_name: "Staff A",
      designation: "Sweeper",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-04",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Facility",
      zone_label: "Zone A",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: []
    },
    return_duty: {
      roster_id: 2,
      employee_id: 20,
      emp_number: "EMP-20",
      full_name: "Staff B",
      designation: "Sweeper",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-05",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Facility",
      zone_label: "Zone B",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: []
    },
    requested_at: "2026-11-01T10:00:00Z",
    responded_at: null,
    response_note: null,
    responded_by_name: null,
    decided_at: null,
    decision_note: null,
    decided_by_name: null,
    closed_at: null,
    cover_roster_id: null,
    return_cover_roster_id: null,
    status: "Accepted",
    reason: "Mutual agreement",
    row_version: 1
  };

  // Proposer cannot approve (SWAP_SELF_APPROVAL)
  assert.equal(canUserApproveSwap(swap, 10), false);
  // Receiver cannot approve (SWAP_SELF_APPROVAL)
  assert.equal(canUserApproveSwap(swap, 20), false);
  // Third-party operations supervisor CAN approve
  assert.equal(canUserApproveSwap(swap, 99), true);
  // Null employee ID (system/service admin) can approve
  assert.equal(canUserApproveSwap(swap, null), true);
});

test("validateRollCallSubmission enforces valid batch payload (rule:28262cb3f6)", () => {
  // Invalid date
  assert.equal(validateRollCallSubmission("invalid", [101]).valid, false);
  // Empty employee list
  assert.equal(validateRollCallSubmission("2026-11-03", []).valid, false);
  // Exceeding 300 items
  const largeList = Array.from({ length: 301 }, (_, i) => i + 1);
  assert.equal(validateRollCallSubmission("2026-11-03", largeList).valid, false);

  // Valid submission
  const validRes = validateRollCallSubmission("2026-11-03", [101, 102]);
  assert.equal(validRes.valid, true);
  assert.ok(validRes.payload);
  assert.equal(validRes.payload.roster_date, "2026-11-03");
  assert.equal(validRes.payload.present.length, 2);
  assert.equal(validRes.payload.present[0].employee_id, 101);
});

test("formatWeeklyPrintableSchedule creates matrix for offline support workers (rule:28262cb3f6)", () => {
  const days = getWeekDates("2026-11-02");
  const entries = [
    {
      roster_id: 1,
      employee_id: 101,
      emp_number: "EMP-101",
      full_name: "Ali Raza",
      designation: "Sweeper",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-02",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Facility",
      zone_label: "Zone A - Entrance",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: []
    },
    {
      roster_id: 2,
      employee_id: 101,
      emp_number: "EMP-101",
      full_name: "Ali Raza",
      designation: "Sweeper",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-03",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Facility",
      zone_label: "Zone A - Entrance",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Cancelled", // Should be ignored
      cancel_reason: "Sick",
      swap_id: null,
      row_version: 2,
      bed_ids: []
    }
  ];

  const rows = formatWeeklyPrintableSchedule(days, entries);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employee_id, 101);
  assert.equal(rows[0].assignments["2026-11-02"]?.shift, "Morning");
  assert.equal(rows[0].assignments["2026-11-02"]?.place, "Zone A - Entrance");
  // Cancelled duty on 2026-11-03 should remain null (OFF)
  assert.equal(rows[0].assignments["2026-11-03"], null);
});

test("filterRollCallEntries filters by shift, zone area, and search query", () => {
  const entries = [
    {
      roster_id: 1,
      employee_id: 101,
      emp_number: "EMP-101",
      full_name: "Ali Raza",
      designation: "Sweeper",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-02",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Facility",
      zone_label: "Zone A - Main Gate",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: [],
      first_in: "2026-11-02T06:55:00Z",
      first_source: "Badge"
    },
    {
      roster_id: 2,
      employee_id: 102,
      emp_number: "EMP-102",
      full_name: "Kashif Mehmood",
      designation: "Security Guard",
      staff_category: "SupportZeroInterface",
      roster_date: "2026-11-02",
      shift_pattern_id: 2,
      shift_name: "Evening",
      start_time: "15:00",
      end_time: "23:00",
      duty_area: "Emergency",
      zone_label: "ER Gate",
      ward_id: null,
      ward_name: null,
      department_id: null,
      department_name: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: [],
      first_in: null,
      first_source: null
    }
  ];

  // Filter by shift pattern
  assert.equal(filterRollCallEntries(entries, 1, "", "").length, 1);
  assert.equal(filterRollCallEntries(entries, 2, "", "").length, 1);

  // Filter by area
  assert.equal(filterRollCallEntries(entries, null, "Main Gate", "").length, 1);
  assert.equal(filterRollCallEntries(entries, null, "ER", "").length, 1);
  assert.equal(filterRollCallEntries(entries, null, "NonExistent", "").length, 0);

  // Filter by search query
  assert.equal(filterRollCallEntries(entries, null, "", "Kashif").length, 1);
  assert.equal(filterRollCallEntries(entries, null, "", "EMP-101").length, 1);
});

test("SUPPORT_ROSTER_ERROR_MESSAGES contains all required domain error codes with English and Urdu translations", () => {
  const requiredCodes = [
    "ROLL_CALL_NOT_ROSTERED",
    "ROSTER_CONFLICT",
    "LEAVE_CONFLICT",
    "ROSTER_DATE_CLOSED",
    "SWAP_SELF_APPROVAL",
    "SWAP_TRANSITION_INVALID",
    "VERSION_CONFLICT",
    "ROSTER_EMPLOYEE_INACTIVE",
    "ROSTER_OUT_OF_SCOPE",
    "NOT_FOUND",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NETWORK_ERROR"
  ];

  for (const code of requiredCodes) {
    const entry = SUPPORT_ROSTER_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error code mapping: ${code}`);
    assert.ok(entry.en && entry.en.length > 5, `Missing English text for ${code}`);
    assert.ok(entry.ur && entry.ur.length > 5, `Missing Urdu text for ${code}`);
  }
});
