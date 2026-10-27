import test from "node:test";
import assert from "node:assert/strict";
import {
  rosterAddDays,
  rosterDay,
  rosterIsoDay,
  rosterOnLeave,
  validateDuty,
  dutyPatch,
  rosterCopyPeriod,
  swapIsSelf,
  rosterSnapshot,
  rosterRecoveryMayRelease,
} from "../src/roster-policy.ts";
const person = {
    employee_id: 100,
    leave: [{ from_date: "2026-11-03", to_date: "2026-11-04" }],
  },
  patterns = [
    { shift_pattern_id: 1, is_active: true },
    { shift_pattern_id: 2, is_active: false },
  ],
  beds = [
    { bed_id: 10, ward_id: 5 },
    { bed_id: 11, ward_id: 6 },
  ];
const entry = {
  employee_id: 100,
  roster_date: "2026-11-02",
  shift_pattern_id: 1,
  duty_area: "Ward",
  ward_id: 5,
  bed_ids: [10],
  zone_label: null,
  department_id: null,
  is_on_call: false,
  notes: null,
};
test("duty dates stay calendar days across month, year, Sunday and leap boundaries", () => {
  assert.equal(rosterAddDays("2026-12-31", 1), "2027-01-01");
  assert.equal(rosterAddDays("2028-02-28", 1), "2028-02-29");
  assert.equal(rosterIsoDay("2026-11-01"), 7);
  for (const date of ["2026-02-29", "2026-11-31", "2026-1-01", "", "not-date"])
    assert.throws(() => rosterDay(date));
});
test("scope, leave inclusivity, active patterns and exact ward beds fail closed before scheduling", () => {
  assert.equal(
    validateDuty(entry, [person], patterns, beds, "2026-11-01", false),
    entry,
  );
  for (const day of ["2026-11-03", "2026-11-04"]) {
    assert(rosterOnLeave(person, day));
    assert.throws(
      () =>
        validateDuty(
          { ...entry, roster_date: day },
          [person],
          patterns,
          beds,
          "2026-11-01",
          false,
        ),
      /leave/,
    );
  }
  assert(!rosterOnLeave(person, "2026-11-05"));
  for (const patch of [
    { employee_id: 101 },
    { shift_pattern_id: 2 },
    { ward_id: null },
    { bed_ids: [11] },
    { bed_ids: [10, 10] },
    { duty_area: "Department", bed_ids: [10] },
    { zone_label: "x".repeat(101) },
    { notes: "x".repeat(501) },
  ])
    assert.throws(() =>
      validateDuty(
        { ...entry, ...patch },
        [person],
        patterns,
        beds,
        "2026-11-01",
        false,
      ),
    );
  assert.throws(
    () => validateDuty(entry, [person], patterns, beds, "2026-11-03", false),
    /HR/,
  );
  assert(validateDuty(entry, [person], patterns, beds, "2026-11-03", true));
});
test("versioned edit sends only changed fields and cannot edit a cancelled duty or replace its employee", () => {
  const old = { ...entry, roster_id: 7, row_version: 4, status: "Active" };
  assert.deepEqual(dutyPatch(old, { ...entry, zone_label: "Bay B" }), {
    expected_version: 4,
    zone_label: "Bay B",
  });
  assert.throws(() => dutyPatch(old, entry), /Change/);
  assert.throws(
    () =>
      dutyPatch({ ...old, status: "Cancelled" }, { ...entry, notes: "change" }),
    /original active/,
  );
  assert.throws(
    () => dutyPatch(old, { ...entry, employee_id: 101 }),
    /original active/,
  );
  assert.notEqual(
    rosterSnapshot(old),
    rosterSnapshot({ ...old, row_version: 5 }),
  );
});
test("copy scope requires a later target and bounded integral rotation without silently changing the requested dates", () => {
  assert.throws(
    () =>
      rosterCopyPeriod(
        "2026-10-01",
        "2026-10-07",
        "2026-10-08",
        0,
        "2026-10-27",
        false,
      ),
    /HR/,
  );
  assert(
    rosterCopyPeriod(
      "2026-10-01",
      "2026-10-07",
      "2026-10-08",
      0,
      "2026-10-27",
      true,
    ),
  );
  assert.deepEqual(
    rosterCopyPeriod("2026-11-02", "2026-11-08", "2026-11-09", 1),
    {
      source_from: "2026-11-02",
      source_to: "2026-11-08",
      target_from: "2026-11-09",
      rotate_days: 1,
    },
  );
  for (const [from, to, target, rotation] of [
    ["2026-11-08", "2026-11-02", "2026-11-09", 0],
    ["2026-11-02", "2026-11-08", "2026-11-08", 0],
    ["2026-01-01", "2026-11-08", "2026-11-09", 0],
    ["2026-11-02", "2026-11-08", "2026-11-09", 1.5],
    ["2026-11-02", "2026-11-08", "2026-11-09", 31],
  ])
    assert.throws(() => rosterCopyPeriod(from, to, target, rotation));
});
test("a swap manager must be independent by employee ID, never by display name", () => {
  const swap = { requester_employee_id: 100, covering_employee_id: 101 };
  assert(swapIsSelf(100, swap));
  assert(swapIsSelf(101, swap));
  assert(!swapIsSelf(102, swap));
  assert(!swapIsSelf(null, swap));
});
test("an unknown create/copy/record cannot release on a list match; duty and swap decisions require the exact original ID", () => {
  for (const kind of ["batch", "copy", "record"])
    assert(!rosterRecoveryMayRelease(kind, 7, { roster_id: 7, swap_id: 7 }));
  for (const kind of ["edit", "cancel"]) {
    assert(rosterRecoveryMayRelease(kind, 7, { roster_id: 7 }));
    assert(!rosterRecoveryMayRelease(kind, 7, { roster_id: 8 }));
    assert(!rosterRecoveryMayRelease(kind, 7, undefined));
  }
  for (const kind of ["approve", "reject"]) {
    assert(rosterRecoveryMayRelease(kind, 7, { swap_id: 7 }));
    assert(!rosterRecoveryMayRelease(kind, 7, { swap_id: 8 }));
  }
});
