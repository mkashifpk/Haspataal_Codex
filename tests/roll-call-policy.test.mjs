import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const url = (s) =>
  "data:text/javascript;base64," +
  Buffer.from(stripTypeScriptTypes(s, { mode: "transform" })).toString(
    "base64",
  );
const time = url(fs.readFileSync("src/hospital-time.ts", "utf8"));
const policy = await import(
  url(
    fs
      .readFileSync("src/roll-call-policy.ts", "utf8")
      .replace('"./hospital-time"', JSON.stringify(time)),
  )
);
const r = {
    roster_id: 700,
    employee_id: 100,
    roster_date: "2026-10-27",
    start_time: "20:00:00",
    end_time: "08:00:00",
    status: "Active",
    first_in: null,
    row_version: 1,
  },
  now = "2026-10-28T01:00:00Z",
  zone = "Asia/Karachi";
test("After midnight overnight attendance retains start date and accepts actual late time", () => {
  assert.deepEqual(policy.dutyWindow(r, zone), {
    start: "2026-10-27T15:00:00.000Z",
    end: "2026-10-28T03:00:00.000Z",
  });
  assert.deepEqual(
    policy.rollCallBody([r], { 700: "2026-10-28T05:30" }, now, zone, false),
    {
      roster_date: "2026-10-27",
      present: [{ employee_id: 100, at: "2026-10-28T00:30:00.000Z" }],
    },
  );
});
test("Closed earlier shifts require HR and a real within-shift time; future shifts unavailable", () => {
  const old = { ...r, roster_date: "2026-10-26" };
  assert(!policy.rollCallEditable(old, now, zone, false));
  assert(policy.rollCallEditable(old, now, zone, true));
  assert.throws(
    () => policy.rollCallBody([old], {}, now, zone, true),
    /actual arrival/,
  );
  assert.throws(
    () =>
      policy.rollCallBody([old], { 700: "2026-10-26T19:59" }, now, zone, true),
    /within/,
  );
  assert(
    !policy.rollCallEditable(
      { ...r, roster_date: "2026-10-28" },
      now,
      zone,
      true,
    ),
  );
});
test("Badge, roll-call and manual arrivals/cancellations/stale versions cannot be selected or overwritten", () => {
  for (const first_source of ["Badge", "RollCall", "Manual"]) {
    const arrived = { ...r, first_in: "2026-10-27T16:00Z", first_source };
    assert(!policy.rollCallEditable(arrived, now, zone, false));
    assert(!policy.sameRollCallDuty(r, arrived));
  }
  assert(!policy.sameRollCallDuty(r, { ...r, row_version: 2 }));
  assert(
    !policy.rollCallEditable({ ...r, status: "Cancelled" }, now, zone, true),
  );
});
test("Separate date requests, unique employee, shift end exclusion and no future attendance", () => {
  assert.throws(
    () =>
      policy.rollCallBody(
        [
          r,
          { ...r, roster_id: 701, employee_id: 101, roster_date: "2026-10-28" },
        ],
        {},
        now,
        zone,
        true,
      ),
    /one duty date/,
  );
  assert.throws(
    () =>
      policy.rollCallBody([r, { ...r, roster_id: 701 }], {}, now, zone, true),
    /one duty per employee/,
  );
  assert.throws(
    () =>
      policy.rollCallBody([r], { 700: "2026-10-28T08:00" }, now, zone, false),
    /within/,
  );
  assert.throws(
    () =>
      policy.rollCallBody([r], { 700: "2026-10-28T07:00" }, now, zone, false),
    /future/,
  );
  assert.throws(
    () => policy.rollCallBody([], {}, now, zone, false),
    /between 1/,
  );
});
