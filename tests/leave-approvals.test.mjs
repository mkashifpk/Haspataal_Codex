import test from "node:test";
import assert from "node:assert/strict";
import {
  getLeaveApprovalsCapabilityView,
  validateLeaveDecision,
  formatLeaveTypeBadge,
  formatLeaveStatusBadge,
  formatLeaveDateRange,
  LEAVE_ERROR_MESSAGES
} from "../src/leave-approvals-policy.ts";

test("leave approvals capability view resolves full, records, and hidden modes", () => {
  // Full capability for supervisor with hr.leave.approve
  const full = getLeaveApprovalsCapabilityView(
    { views: { screens: ["leave_approvals"] } },
    ["hr.leave.approve"],
    "head_nurse"
  );
  assert.equal(full.mode, "full");
  assert.equal(full.canView, true);
  assert.equal(full.canApprove, true);
  assert.equal(full.isHrAdmin, false);

  // Full capability for HR admin with hr.leave.manage
  const hrAdmin = getLeaveApprovalsCapabilityView(
    { views: { screens: ["leave_approvals"] } },
    ["hr.leave.manage"],
    "hr_admin"
  );
  assert.equal(hrAdmin.mode, "full");
  assert.equal(hrAdmin.canApprove, true);
  assert.equal(hrAdmin.isHrAdmin, true);

  // Executive roles automatically have hr admin status
  const exec = getLeaveApprovalsCapabilityView(
    { views: { screens: ["leave_approvals"] } },
    [],
    "hospital_admin"
  );
  assert.equal(exec.mode, "full");
  assert.equal(exec.isHrAdmin, true);

  // Records view-only mode for user with hr.leave.view but not approve
  const records = getLeaveApprovalsCapabilityView(
    { views: { screens: ["leave_approvals"] } },
    ["hr.leave.view"],
    "clerk"
  );
  assert.equal(records.mode, "records");
  assert.equal(records.canView, true);
  assert.equal(records.canApprove, false);

  // Hidden when facility profile explicitly omits leave_approvals
  const hidden = getLeaveApprovalsCapabilityView(
    { views: { screens: ["other_screen"] } },
    ["hr.leave.approve"],
    "head_nurse"
  );
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canView, false);
  assert.equal(hidden.canApprove, false);
});

test("validateLeaveDecision validates approval and enforces mandatory reason on rejection", () => {
  // Valid approval without note
  const resApprove = validateLeaveDecision("Approved");
  assert.equal(resApprove.valid, true);
  assert.equal(Object.keys(resApprove.errors).length, 0);

  // Valid approval with optional note
  const resApproveNote = validateLeaveDecision("Approved", "Coverage arranged by Staff Nurse Fatima.");
  assert.equal(resApproveNote.valid, true);

  // Rejection without note fails validation
  const resRejectNoNote = validateLeaveDecision("Rejected", "");
  assert.equal(resRejectNoNote.valid, false);
  assert.ok(resRejectNoNote.errors.note);

  // Rejection with short note fails validation
  const resRejectShort = validateLeaveDecision("Rejected", "No");
  assert.equal(resRejectShort.valid, false);
  assert.ok(resRejectShort.errors.note);

  // Valid rejection with explanatory note
  const resRejectValid = validateLeaveDecision("Rejected", "Insufficient staffing on critical care ward.");
  assert.equal(resRejectValid.valid, true);
  assert.equal(Object.keys(resRejectValid.errors).length, 0);

  // Invalid decision keyword fails
  const resInvalid = validateLeaveDecision("Pending");
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.decision);
});

test("formatLeaveTypeBadge provides bilingual titles and styling for all statutory leave types", () => {
  const annual = formatLeaveTypeBadge("Annual");
  assert.equal(annual.labelEn, "Annual Leave");
  assert.equal(annual.labelUr, "سالانہ چھٹی");

  const casual = formatLeaveTypeBadge("Casual");
  assert.equal(casual.labelEn, "Casual Leave");
  assert.equal(casual.labelUr, "اتفاقی چھٹی");

  const sick = formatLeaveTypeBadge("Sick");
  assert.equal(sick.labelEn, "Sick Leave");
  assert.equal(sick.labelUr, "طبی چھٹی");

  const maternity = formatLeaveTypeBadge("Maternity");
  assert.equal(maternity.labelEn, "Maternity Leave");
  assert.equal(maternity.labelUr, "زچگی کی چھٹی");

  const unpaid = formatLeaveTypeBadge("Unpaid");
  assert.equal(unpaid.labelEn, "Unpaid Leave");
  assert.equal(unpaid.labelUr, "بلا تنخواہ چھٹی");
});

test("formatLeaveStatusBadge formats Pending, Approved, Rejected, and Cancelled states", () => {
  const pending = formatLeaveStatusBadge("Pending");
  assert.equal(pending.labelEn, "Pending Approval");
  assert.equal(pending.labelUr, "زیر التواء منظوری");

  const approved = formatLeaveStatusBadge("Approved");
  assert.equal(approved.labelEn, "Approved");
  assert.equal(approved.labelUr, "منظور شدہ");

  const rejected = formatLeaveStatusBadge("Rejected");
  assert.equal(rejected.labelEn, "Rejected");
  assert.equal(rejected.labelUr, "مسترد");

  const cancelled = formatLeaveStatusBadge("Cancelled");
  assert.equal(cancelled.labelEn, "Cancelled");
  assert.equal(cancelled.labelUr, "منسوخ شدہ");
});

test("formatLeaveDateRange handles single day and multi-day spans cleanly", () => {
  assert.equal(formatLeaveDateRange("2026-05-01", "2026-05-01", 1), "2026-05-01 (1 day)");
  assert.equal(formatLeaveDateRange("2026-05-01", "2026-05-05", 5), "2026-05-01 → 2026-05-05 (5 days)");
});

test("LEAVE_ERROR_MESSAGES provides bilingual error mappings for all contract codes", () => {
  const codes = [
    "LEAVE_ALREADY_DECIDED",
    "LEAVE_INSUFFICIENT_BALANCE",
    "LEAVE_NOT_YOUR_REPORT",
    "SELF_APPROVAL_FORBIDDEN",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
    "NETWORK_ERROR"
  ];
  for (const code of codes) {
    const entry = LEAVE_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error dictionary for ${code}`);
    assert.ok(entry.en.length > 5, `Missing English text for ${code}`);
    assert.ok(entry.ur.length > 5, `Missing Urdu text for ${code}`);
  }
});
