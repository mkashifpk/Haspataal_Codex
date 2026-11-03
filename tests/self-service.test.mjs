import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelfServiceCapabilityView,
  validateLeaveRequest,
  validateSwapRequest,
  validateIssueReport,
  buildDutyHorizon,
  canColleagueRespond,
  canRequesterCancel,
  isDutyUpcoming,
  SELF_SERVICE_ERROR_MESSAGES
} from "../src/self-service-policy.ts";

test("self-service capability view assigns full, records, and hidden modes", () => {
  // Full capability for staff with leave & swap permissions
  const full = getSelfServiceCapabilityView(
    { views: { screens: ["self_service"] } },
    ["self.profile.view", "self.leave.request", "self.roster.swap", "ops.workorder.report"],
    "staff_nurse"
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canView, true);
  assert.equal(full.canRequestLeave, true);
  assert.equal(full.canSwapRoster, true);
  assert.equal(full.canReportIssue, true);

  // Hidden mode when facility explicitly excludes self_service
  const hidden = getSelfServiceCapabilityView(
    { views: { screens: ["other_screen"] } },
    ["self.profile.view"],
    "staff_nurse"
  );
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canView, false);
});

test("validateLeaveRequest validates dates, chronological order, and calculates duration", () => {
  // Missing category fails
  const resNoCat = validateLeaveRequest({
    leave_type: "",
    from_date: "2026-06-01",
    to_date: "2026-06-03"
  });
  assert.equal(resNoCat.valid, false);
  assert.ok(resNoCat.errors.leave_type);

  // End date before start date fails
  const resBadDates = validateLeaveRequest({
    leave_type: "Annual",
    from_date: "2026-06-05",
    to_date: "2026-06-01"
  });
  assert.equal(resBadDates.valid, false);
  assert.ok(resBadDates.errors.to_date);

  // Valid multi-day span calculates exact days
  const resValid = validateLeaveRequest({
    leave_type: "Annual",
    from_date: "2026-06-01",
    to_date: "2026-06-05",
    half_day: false
  });
  assert.equal(resValid.valid, true);
  assert.equal(resValid.calculatedDays, 5);

  // Half day sets 0.5 days
  const resHalfDay = validateLeaveRequest({
    leave_type: "Casual",
    from_date: "2026-06-01",
    to_date: "2026-06-01",
    half_day: true
  });
  assert.equal(resHalfDay.valid, true);
  assert.equal(resHalfDay.calculatedDays, 0.5);
});

test("rule:9274755ac9 - validateSwapRequest enforces mandatory reason and colleague selection", () => {
  // Missing duty fails
  const resNoDuty = validateSwapRequest({
    roster_id: 0,
    covering_employee_id: 12,
    reason: "Doctor appointment"
  });
  assert.equal(resNoDuty.valid, false);
  assert.ok(resNoDuty.errors.roster_id);

  // Missing colleague fails
  const resNoColleague = validateSwapRequest({
    roster_id: 101,
    covering_employee_id: 0,
    reason: "Doctor appointment"
  });
  assert.equal(resNoColleague.valid, false);
  assert.ok(resNoColleague.errors.covering_employee_id);

  // Blank or short reason fails (rule:9274755ac9)
  const resShortReason = validateSwapRequest({
    roster_id: 101,
    covering_employee_id: 12,
    reason: "No"
  });
  assert.equal(resShortReason.valid, false);
  assert.ok(resShortReason.errors.reason);

  // Valid swap request
  const resValid = validateSwapRequest({
    roster_id: 101,
    covering_employee_id: 12,
    return_roster_id: 205,
    reason: "Family wedding in Lahore"
  });
  assert.equal(resValid.valid, true);
  assert.equal(Object.keys(resValid.errors).length, 0);
});

test("validateIssueReport validates maintenance category and description", () => {
  const resInvalid = validateIssueReport({
    category: "Plumbing",
    description: "Leak"
  });
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.description);

  const resValid = validateIssueReport({
    category: "Electrical",
    description: "Switchboard sparking in Ward 3 nursing station",
    priority: "High",
    location_text: "Ward 3"
  });
  assert.equal(resValid.valid, true);
});

test("rule:907c770e92 - buildDutyHorizon marks days without a duty as statutory paid rest days", () => {
  const sampleDuties = [
    {
      roster_id: 1,
      employee_id: 10,
      emp_number: "EMP010",
      full_name: "Staff Nurse Fatima",
      designation: "Staff Nurse",
      staff_category: "Nursing",
      roster_date: "2026-06-01",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Ward",
      ward_id: 1,
      ward_name: "General Ward",
      department_id: 1,
      department_name: "Nursing",
      zone_label: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: [101, 102]
    },
    {
      roster_id: 2,
      employee_id: 10,
      emp_number: "EMP010",
      full_name: "Staff Nurse Fatima",
      designation: "Staff Nurse",
      staff_category: "Nursing",
      roster_date: "2026-06-03",
      shift_pattern_id: 2,
      shift_name: "Evening",
      start_time: "15:00",
      end_time: "23:00",
      duty_area: "Ward",
      ward_id: 1,
      ward_name: "General Ward",
      department_id: 1,
      department_name: "Nursing",
      zone_label: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: []
    }
  ];

  // 3-day horizon: 2026-06-01 to 2026-06-03
  const horizon = buildDutyHorizon(sampleDuties, "2026-06-01", "2026-06-03");
  assert.equal(horizon.length, 3);

  // Day 1 has morning duty
  assert.equal(horizon[0].date, "2026-06-01");
  assert.equal(horizon[0].isRestDay, false);
  assert.equal(horizon[0].duty?.shift_name, "Morning");

  // Day 2 has no duty -> statutory paid Rest Day per rule:907c770e92
  assert.equal(horizon[1].date, "2026-06-02");
  assert.equal(horizon[1].isRestDay, true);
  assert.equal(horizon[1].duty, undefined);

  // Day 3 has evening duty
  assert.equal(horizon[2].date, "2026-06-03");
  assert.equal(horizon[2].isRestDay, false);
  assert.equal(horizon[2].duty?.shift_name, "Evening");
});

test("rule:adfadf7120 - canColleagueRespond and canRequesterCancel govern swap lifecycle", () => {
  const baseSwap = {
    swap_id: 50,
    kind: "Cover",
    status: "Requested",
    reason: "Emergency",
    roster_id: 1,
    return_roster_id: null,
    requester_employee_id: 10,
    requester_name: "Requester Nurse",
    covering_employee_id: 20,
    covering_name: "Covering Colleague",
    staff_category: "Nursing",
    duty: {
      roster_id: 1,
      employee_id: 10,
      emp_number: "E10",
      full_name: "Requester Nurse",
      designation: "Nurse",
      staff_category: "Nursing",
      roster_date: "2099-01-01",
      shift_pattern_id: 1,
      shift_name: "Morning",
      start_time: "07:00",
      end_time: "15:00",
      duty_area: "Ward",
      ward_id: 1,
      ward_name: "Ward A",
      department_id: 1,
      department_name: "Nursing",
      zone_label: null,
      is_on_call: false,
      notes: null,
      status: "Active",
      cancel_reason: null,
      swap_id: null,
      row_version: 1,
      bed_ids: []
    },
    return_duty: null,
    requested_at: "2026-05-01T10:00:00Z",
    responded_at: null,
    response_note: null,
    responded_by_name: null,
    decided_at: null,
    decision_note: null,
    decided_by_name: null,
    closed_at: null,
    cover_roster_id: null,
    return_cover_roster_id: null,
    row_version: 1,
    my_role: "Colleague"
  };

  // Colleague can respond when status is Requested
  assert.equal(canColleagueRespond(baseSwap), true);

  // Requester can cancel before approval on future duties
  const requesterSwap = { ...baseSwap, my_role: "Requester" };
  assert.equal(canRequesterCancel(requesterSwap, "2026-05-01"), true);

  // Expired / past duty cannot be cancelled
  const pastSwap = {
    ...requesterSwap,
    duty: { ...requesterSwap.duty, roster_date: "2020-01-01" }
  };
  assert.equal(canRequesterCancel(pastSwap, "2026-05-01"), false);
});

test("isDutyUpcoming checks future active duties", () => {
  const futureDuty = {
    roster_id: 1,
    roster_date: "2099-12-31",
    status: "Active"
  };
  assert.equal(isDutyUpcoming(futureDuty, "2026-05-01"), true);

  const pastDuty = {
    roster_id: 2,
    roster_date: "2020-01-01",
    status: "Active"
  };
  assert.equal(isDutyUpcoming(pastDuty, "2026-05-01"), false);
});

test("SELF_SERVICE_ERROR_MESSAGES contains complete bilingual messages", () => {
  const codes = [
    "LEAVE_INSUFFICIENT_BALANCE",
    "LEAVE_OVERLAPPING",
    "DUTY_ALREADY_STARTED",
    "SWAP_ALREADY_DECIDED",
    "SWAP_SELF_FORBIDDEN",
    "WORK_ORDER_LOCATION_REQUIRED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "NETWORK_ERROR"
  ];
  for (const code of codes) {
    const entry = SELF_SERVICE_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing translation for ${code}`);
    assert.ok(entry.en.length > 5, `Missing English text for ${code}`);
    assert.ok(entry.ur.length > 5, `Missing Urdu text for ${code}`);
  }
});
