import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getStaffDirectoryCapabilityView,
  getAllowedStatusActions,
  validateStatusChangeInput,
  validateLeaveBalanceInput,
  STAFF_DIRECTORY_ERROR_MESSAGES,
} from "../src/staff-directory-policy.ts";

test("Staff directory capability view evaluates mode and permission gates", () => {
  const permissions=['hr.employee.view','hr.employee.update','hr.leave.manage'];
  const full = getStaffDirectoryCapabilityView({views:{screens:[{screen_id:'staff_directory',view:'full'}]}},permissions);
  assert.equal(full.mode, "full");
  assert.equal(full.canViewDirectory, true);
  assert.equal(full.canUpdateStatus, true);
  assert.equal(full.canManageLeaveBalances, true);
  assert.equal(full.canViewOrgChart, true);

  const records = getStaffDirectoryCapabilityView({
    views: { screens: [{screen_id:'staff_directory',view:'records'}] },
  },permissions);
  assert.equal(records.mode, "records");
  assert.equal(records.canUpdateStatus, false);
  assert.equal(records.canManageLeaveBalances, false);
  assert(records.noticeEn?.includes("Records Mode"));

  const openWork = getStaffDirectoryCapabilityView({
    views: { screens: [{screen_id:'staff_directory',view:'open_work'}] },
  },permissions);
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canUpdateStatus, true);
  assert.equal(openWork.canManageLeaveBalances, false);

  const setup = getStaffDirectoryCapabilityView({
    views: { screens: [{screen_id:'staff_directory',view:'setup'}] },
  },permissions);
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canUpdateStatus, false);
  assert.equal(setup.canManageLeaveBalances, true);

  const hidden = getStaffDirectoryCapabilityView({
    views: { screens: [{screen_id:'staff_directory',view:'hidden'}] },
  },permissions);
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canViewDirectory, false);
  assert.equal(hidden.canUpdateStatus, false);
  assert.equal(getStaffDirectoryCapabilityView(undefined,permissions).canViewDirectory,false);
  assert.equal(getStaffDirectoryCapabilityView({views:{screens:[]}},permissions).canViewDirectory,true);
  assert.equal(getStaffDirectoryCapabilityView({views:{screens:[{screen_id:'staff_directory',view:'full'}]}},['hr.employee.view']).canUpdateStatus,false);
});

test("Rule rule:2cc308be05: status transitions offered strictly by current employment_status", () => {
  // 1. Draft offers none (must finish wizard)
  const draftActions = getAllowedStatusActions("Draft");
  assert.equal(draftActions.length, 0);

  // 2. Awaiting_IT_Provisioning: suspend, resign, terminate, never 'Activate'
  const awaitingActions = getAllowedStatusActions("Awaiting_IT_Provisioning");
  assert.equal(awaitingActions.length, 3);
  const awaitingTargets = awaitingActions.map((a) => a.targetStatus);
  assert.deepEqual(awaitingTargets, ["Suspended", "Resigned", "Terminated"]);
  assert(!awaitingTargets.includes("Active"), "Must never offer Activate on Awaiting_IT_Provisioning");

  // 3. Active: suspend, resign, terminate
  const activeActions = getAllowedStatusActions("Active");
  assert.equal(activeActions.length, 3);
  assert.deepEqual(
    activeActions.map((a) => a.targetStatus),
    ["Suspended", "Resigned", "Terminated"]
  );

  // 4. Suspended: reinstate, resign, terminate
  const suspendedActions = getAllowedStatusActions("Suspended");
  assert.equal(suspendedActions.length, 3);
  assert.deepEqual(
    suspendedActions.map((a) => a.targetStatus),
    ["Active", "Resigned", "Terminated"]
  );
  const reinstate = suspendedActions.find((a) => a.targetStatus === "Active");
  assert(reinstate?.hintEn?.includes("IT re-enables the login"));

  // 5. Resigned / Terminated: 're-join'
  const resignedActions = getAllowedStatusActions("Resigned");
  assert.equal(resignedActions.length, 1);
  assert.equal(resignedActions[0].targetStatus, "Active");
  assert.equal(resignedActions[0].labelEn, "Re-join Staff");

  const terminatedActions = getAllowedStatusActions("Terminated");
  assert.equal(terminatedActions.length, 1);
  assert.equal(terminatedActions[0].targetStatus, "Active");
  assert.equal(terminatedActions[0].labelEn, "Re-join Staff");
});

test("Rule rule:f57cfa01c4: status validation requires reason and enforces revocation warnings", () => {
  // Missing reason
  const noReason = validateStatusChangeInput(
    { status: "Suspended", reason: "  " },
    "Active"
  );
  assert.equal(noReason.valid, false);
  assert(noReason.errors.reason?.includes("minimum 3 characters"));

  // Forbidden transition per rule:2cc308be05 (e.g. Draft -> Active directly)
  const forbiddenTrans = validateStatusChangeInput(
    { status: "Active", reason: "Direct activation" },
    "Draft"
  );
  assert.equal(forbiddenTrans.valid, false);
  assert(forbiddenTrans.errors.status?.includes("Cannot transition"));

  // Valid Active -> Suspended transition
  const validSuspend = validateStatusChangeInput(
    { status: "Suspended", reason: "Pending administrative inquiry" },
    "Active"
  );
  assert.equal(validSuspend.valid, true);

  // Valid Active -> Resigned with left_on date
  const validResign = validateStatusChangeInput(
    {
      status: "Resigned",
      reason: "Personal relocation",
      left_on: "2026-11-15",
    },
    "Active"
  );
  assert.equal(validResign.valid, true);

  // Invalid date format
  const invalidDate = validateStatusChangeInput(
    {
      status: "Resigned",
      reason: "Personal relocation",
      left_on: "15-11-2026",
    },
    "Active"
  );
  assert.equal(invalidDate.valid, false);
  assert(invalidDate.errors.left_on?.includes("YYYY-MM-DD"));
});

test("Rule rule:83e8fefdaf: leave balance configuration validates allowances and types", () => {
  // Valid balance payload
  const validBalance = validateLeaveBalanceInput({
    employee_id: 10,
    leave_type: "Annual",
    year: 2026,
    opening: 14,
    accrued: 2,
    carried_forward: 5,
  });
  assert.equal(validBalance.valid, true);
  assert.equal(Object.keys(validBalance.errors).length, 0);

  // Invalid year
  const invalidYear = validateLeaveBalanceInput({
    employee_id: 10,
    leave_type: "Casual",
    year: 1990,
  });
  assert.equal(invalidYear.valid, false);
  assert(invalidYear.errors.year?.includes("Valid calendar year"));

  // Negative days
  const negativeDays = validateLeaveBalanceInput({
    employee_id: 10,
    leave_type: "Sick",
    year: 2026,
    opening: -3,
    accrued: 0,
    carried_forward: 0,
  });
  assert.equal(negativeDays.valid, false);
  assert(negativeDays.errors.opening?.includes("non-negative"));
});

test("Error dictionary covers statutory refusals with Urdu translations", () => {
  const codes = [
    "EMPLOYEE_STATUS_INVALID",
    "EMPLOYEE_DOCUMENT_REQUIRED",
    "CLINICAL_LICENSE_REQUIRED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "NOT_FOUND",
  ];

  for (const code of codes) {
    const entry = STAFF_DIRECTORY_ERROR_MESSAGES[code];
    assert(entry, `Missing error dictionary entry for ${code}`);
    assert(entry.en.trim().length > 0, `${code} English message empty`);
    assert(entry.ur.trim().length > 0, `${code} Urdu message empty`);
    assert(/[\u0600-\u06ff]/.test(entry.ur), `${code} missing Urdu characters`);
  }
});

test("Catalogue and task-map inventory covers all 7 contract endpoints", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/staff_directory.json", "utf8"));
  const catalogue = JSON.parse(fs.readFileSync("src/foundation-catalogue.json", "utf8"));
  const taskMap = JSON.parse(fs.readFileSync("src/foundation-task-map.json", "utf8"));

  assert(catalogue.screens.staff_directory, "catalogue missing staff_directory screen");
  assert.equal(bundle.endpoints.length, 7);

  for (const ep of bundle.endpoints) {
    assert(
      catalogue.screens.staff_directory.taskCalls.includes(ep.endpoint),
      `Catalogue missing taskCall ${ep.endpoint}`
    );
    assert(
      taskMap.staff_directory?.[ep.endpoint],
      `Task map missing mapping for ${ep.endpoint}`
    );
  }
});
