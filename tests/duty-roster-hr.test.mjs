import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getDutyRosterCapabilityView,
  getWeekDates,
  isStaffOnLeave,
  isStaffDefaultWeeklyOff,
  isPublicHoliday,
  validateCancelDuty,
  validateCopyPeriod,
  validateRecordSwap,
  validateShiftPattern,
  canUserApproveSwap,
  DUTY_ROSTER_ERROR_MESSAGES,
} from "../src/duty-roster-policy.ts";

test("DutyRosterHr capability view evaluates facility profiles and mode gates", () => {
  const full = getDutyRosterCapabilityView({});
  assert.equal(full.mode, "full");
  assert.equal(full.canViewRoster, true);
  assert.equal(full.canManageRoster, true);
  assert.equal(full.canCopyRoster, true);
  assert.equal(full.canManageSwaps, true);
  assert.equal(full.canManageShiftPatterns, true);

  const records = getDutyRosterCapabilityView({
    views: { records_only: true, screens: ["duty_roster_hr"] },
  });
  assert.equal(records.mode, "records");
  assert.equal(records.canViewRoster, true);
  assert.equal(records.canManageRoster, false);
  assert.equal(records.canCopyRoster, false);
  assert.equal(records.canManageSwaps, false);
  assert.equal(records.canManageShiftPatterns, false);
  assert(records.noticeEn?.includes("Records Mode"));

  const openWork = getDutyRosterCapabilityView({
    views: { open_work_only: true, screens: ["duty_roster_hr"] },
  });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canViewRoster, true);
  assert.equal(openWork.canManageRoster, true);
  assert.equal(openWork.canCopyRoster, true);
  assert.equal(openWork.canManageSwaps, true);
  assert.equal(openWork.canManageShiftPatterns, false);
  assert(openWork.noticeEn?.includes("Restricted Mode"));

  const setup = getDutyRosterCapabilityView({
    views: { setup_only: true, screens: ["duty_roster_hr"] },
  });
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canViewRoster, true);
  assert.equal(setup.canManageRoster, false);
  assert.equal(setup.canManageShiftPatterns, true);
  assert(setup.noticeEn?.includes("Setup Mode"));

  const hidden = getDutyRosterCapabilityView({
    views: { screens: ["other_screen"] },
  });
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canViewRoster, false);
  assert.equal(hidden.canManageRoster, false);
  assert(hidden.noticeEn?.includes("hidden"));
});

test("Week dates calculation strictly computes 7 consecutive days starting Monday", () => {
  const week = getWeekDates("2026-11-03"); // Tuesday
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].dayName, "Mon");
  assert.equal(week.days[0].weekday, 1);
  assert.equal(week.days[6].dayName, "Sun");
  assert.equal(week.days[6].weekday, 7);
  assert.equal(week.days[6].isSunday, true);
  assert.equal(week.weekStart, week.days[0].date);
  assert.equal(week.weekEnd, week.days[6].date);
});

test("Rule rule:7ee9e5cda4: isStaffOnLeave identifies approved leave ranges", () => {
  const staff = {
    employee_id: 10,
    emp_number: "EMP-010",
    full_name: "Nurse Fatima",
    designation: "Staff Nurse",
    staff_category: "Nursing",
    department_id: 1,
    department_name: "Ward 1",
    default_shift_pattern_id: null,
    default_weekly_off_days: [],
    leave: [
      {
        employee_id: 10,
        from_date: "2026-11-05",
        to_date: "2026-11-07",
        leave_type: "Annual",
      },
    ],
  };

  assert.equal(isStaffOnLeave(staff, "2026-11-04").onLeave, false);
  assert.equal(isStaffOnLeave(staff, "2026-11-05").onLeave, true);
  assert.equal(isStaffOnLeave(staff, "2026-11-05").leaveType, "Annual");
  assert.equal(isStaffOnLeave(staff, "2026-11-07").onLeave, true);
  assert.equal(isStaffOnLeave(staff, "2026-11-08").onLeave, false);
});

test("Rule rule:4ea9d4f624: isStaffDefaultWeeklyOff flags fixed rest days", () => {
  const staff = {
    employee_id: 12,
    emp_number: "EMP-012",
    full_name: "Dr. Tariq",
    designation: "Medical Officer",
    staff_category: "Clinical",
    department_id: 2,
    department_name: "Emergency",
    default_shift_pattern_id: 1,
    default_weekly_off_days: [6, 7], // Saturday and Sunday off
    leave: [],
  };

  assert.equal(isStaffDefaultWeeklyOff(staff, 1), false); // Monday
  assert.equal(isStaffDefaultWeeklyOff(staff, 5), false); // Friday
  assert.equal(isStaffDefaultWeeklyOff(staff, 6), true); // Saturday
  assert.equal(isStaffDefaultWeeklyOff(staff, 7), true); // Sunday
});

test("Rule rule:2e75984ff7: isPublicHoliday matches official holidays", () => {
  const holidays = [
    { holiday_id: 1, holiday_date: "2026-11-09", name: "Iqbal Day" },
  ];

  assert.equal(isPublicHoliday(holidays, "2026-11-08").isHoliday, false);
  const match = isPublicHoliday(holidays, "2026-11-09");
  assert.equal(match.isHoliday, true);
  assert.equal(match.name, "Iqbal Day");
});

test("Rule rule:e255d6b71a: validateCancelDuty requires minimum 3-character reason", () => {
  assert.equal(validateCancelDuty("").valid, false);
  assert.equal(validateCancelDuty("  ").valid, false);
  assert.equal(validateCancelDuty("no").valid, false);
  assert.equal(validateCancelDuty("Staff called in sick").valid, true);
});

test("Rule rule:f72ed8bfcb: validateCopyPeriod validates date ranges", () => {
  const valid = validateCopyPeriod({
    source_from: "2026-10-26",
    source_to: "2026-11-01",
    target_from: "2026-11-02",
    rotate_days: 1,
  });
  assert.equal(valid.valid, true);

  const invalid = validateCopyPeriod({
    source_from: "2026-11-05",
    source_to: "2026-11-01",
    target_from: "2026-11-02",
  });
  assert.equal(invalid.valid, false);
  assert(invalid.errors.source_to);
});

test("Rule rule:83718fc56e: canUserApproveSwap strictly forbids self-approval", () => {
  const swap = {
    swap_id: 101,
    kind: "Cover",
    status: "Accepted",
    reason: "Family emergency",
    roster_id: 55,
    return_roster_id: null,
    requester_employee_id: 4,
    requester_name: "Staff Nurse A",
    covering_employee_id: 7,
    covering_name: "Staff Nurse B",
    staff_category: "Nursing",
    duty: {},
    return_duty: null,
    requested_at: "2026-11-01",
    responded_at: "2026-11-01",
    response_note: null,
    responded_by_name: null,
    decided_at: null,
    decision_note: null,
    decided_by_name: null,
    closed_at: null,
    cover_roster_id: null,
    return_cover_roster_id: null,
    row_version: 1,
  };

  // Third party administrator (employee_id 1) CAN approve
  assert.equal(canUserApproveSwap(swap, 1), true);

  // Requester (employee_id 4) CANNOT approve (SWAP_SELF_APPROVAL)
  assert.equal(canUserApproveSwap(swap, 4), false);

  // Covering staff member (employee_id 7) CANNOT approve
  assert.equal(canUserApproveSwap(swap, 7), false);
});

test("Rule rule:f0c97c644e: validateShiftPattern checks mandatory fields", () => {
  assert.equal(
    validateShiftPattern({ name: "", start_time: "08:00", end_time: "16:00" }).valid,
    false
  );
  assert.equal(
    validateShiftPattern({ name: "Morning", start_time: "", end_time: "16:00" }).valid,
    false
  );
  assert.equal(
    validateShiftPattern({ name: "Morning", start_time: "08:00", end_time: "16:00" }).valid,
    true
  );
});

test("Error dictionary provides complete bilingual English and Urdu messages", () => {
  const codes = [
    "ROSTER_CONFLICT",
    "LEAVE_CONFLICT",
    "ROSTER_DATE_CLOSED",
    "SWAP_SELF_APPROVAL",
    "VERSION_CONFLICT",
    "NOT_FOUND",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
  ];

  for (const code of codes) {
    const entry = DUTY_ROSTER_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error entry for ${code}`);
    assert.ok(entry.en && entry.en.length > 5, `English message too short for ${code}`);
    assert.ok(entry.ur && entry.ur.length > 5, `Urdu message too short for ${code}`);
  }
});

test("Contracts and generated TypeScript definitions are present and valid", () => {
  assert.ok(fs.existsSync("contracts/duty_roster_hr.json"), "contracts/duty_roster_hr.json must exist");
  assert.ok(fs.existsSync("src/generated/duty_roster_hr.ts"), "src/generated/duty_roster_hr.ts must exist");
  assert.ok(fs.existsSync("public/handbook/duty_roster_hr-en.png"), "public/handbook/duty_roster_hr-en.png must exist");
  assert.ok(fs.existsSync("public/handbook/duty_roster_hr-ur.png"), "public/handbook/duty_roster_hr-ur.png must exist");

  const contract = JSON.parse(fs.readFileSync("contracts/duty_roster_hr.json", "utf8"));
  assert.equal(contract.screen_id, "duty_roster_hr");
  assert.equal(contract.endpoints.length, 13);
  assert.equal(contract.definition_of_done.items.length, 37);
});
