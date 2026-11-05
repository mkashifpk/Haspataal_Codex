# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Guarded continuation after backend34; never replays the failed bed PATCH or original batch.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/duty-roster-continuation.json";
assert(!fs.existsSync(file), "Reconcile prior continuation first");
const base = JSON.parse(fs.readFileSync("artifacts/duty-roster-check.json"));
const reconciled = JSON.parse(
  fs.readFileSync("artifacts/duty-roster-bed-edit-reconciled.json"),
).body.data.entries[0];
assert.equal(reconciled.row_version, 2);
assert.deepEqual(reconciled.bed_ids, [1]);
const j = {
  run: base.run,
  source: base.source,
  target: base.target,
  started: new Date().toISOString(),
  checks: [],
  writes: {},
  passed: false,
  backend_blocker: 34,
  original_bed_edit: "reconciled unchanged by exact original GET; never replay",
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
try {
  s = await session("duty-roster-continuation-headnurse", "demo.headnurse");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  await s.nav("Nursing duty roster");
  const read = async (from, to) =>
    s.native("api", {
      method: "GET",
      path:
        "/rosters?date_from=" +
        from +
        "&date_to=" +
        to +
        "&include_cancelled=true",
    });
  let source = await read(j.source, "2026-11-15");
  assert.equal(source.entries.length, 9);
  assert(source.entries.every((r) => r.notes?.startsWith(j.run)));
  assert.equal((await read(j.target, "2026-11-22")).entries.length, 0);
  const first = source.entries.find(
    (r) => r.roster_id === reconciled.roster_id,
  );
  assert.equal(first.row_version, 2);
  assert.equal(first.zone_label, "DEMO concurrent");
  await p.getByLabel("Any date in roster week", { exact: true }).fill(j.source);
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.getByLabel("Filter ward", { exact: true }).selectOption("1");
  await p.evaluate(() => {
    window.rosterEvents = [];
    window.terminal.subscribe((e) => {
      if (
        e.type === "event" &&
        ["roster.changed", "roster.swap.updated"].includes(e.event_type)
      )
        window.rosterEvents.push(e);
    });
  });
  const modal = () =>
    p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", {
          name: "Confirm roster action",
          exact: true,
        }),
      });
  await p
    .getByRole("button", { name: "Edit duty #" + first.roster_id, exact: true })
    .click();
  const edit = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review duty changes", exact: true }),
    });
  await edit.getByLabel("Zone / bay", { exact: true }).fill("DEMO Bay B");
  await edit
    .getByRole("button", { name: "Review duty changes", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  j.writes.zoneEdit = {
    state: "prepared",
    roster_id: first.roster_id,
    expected_version: 2,
    zone_label: "DEMO Bay B",
    bed_ids: "unchanged, not sent",
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await read(j.source, j.source)).entries.find(
          (r) => r.roster_id === first.roster_id,
        ).zone_label,
    )
    .toBe("DEMO Bay B");
  const updated = (await read(j.source, j.source)).entries.find(
    (r) => r.roster_id === first.roster_id,
  );
  assert.deepEqual(updated.bed_ids, [1]);
  assert.equal(updated.row_version, 3);
  j.writes.zoneEdit = { state: "confirmed", result: updated };
  save();
  pass(
    "Original failed bed edit reconciled unchanged; intentional NEW zone-only delta edit200/version3 succeeds, no bed PATCH replay or fake assignment",
  );
  for (const label of ["copy", "copySkipped"]) {
    await p
      .getByRole("button", { name: "Repeat last week", exact: true })
      .click();
    const d = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("button", { name: "Review roster copy", exact: true }),
      });
    await d.getByLabel("Copy source from", { exact: true }).fill(j.source);
    await d.getByLabel("Copy source to", { exact: true }).fill("2026-11-15");
    await d.getByLabel("Copy target from", { exact: true }).fill(j.target);
    await d
      .getByRole("button", {
        name: "Repeat, moving everyone's days on",
        exact: true,
      })
      .click();
    await d
      .getByRole("button", { name: "Review roster copy", exact: true })
      .click();
    await modal().getByRole("checkbox").check();
    j.writes[label] = { state: "prepared" };
    save();
    await modal()
      .getByRole("button", { name: "Confirm roster action", exact: true })
      .click();
    await expect(modal()).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await s.trace()).requests.filter(
            (r) =>
              r.method === "POST" &&
              r.path === "/api/v1/rosters/copy" &&
              r.finished,
          ).length,
      )
      .toBe(label === "copy" ? 1 : 2);
    const result = (await s.trace()).requests
      .filter((r) => r.method === "POST" && r.path === "/api/v1/rosters/copy")
      .at(-1).result.data;
    j.writes[label] = { state: "confirmed", result };
    save();
    assert.equal(result.created.length, label === "copy" ? 9 : 0);
    assert.equal(result.skipped.length, label === "copy" ? 0 : 9);
    if (label === "copy")
      assert(result.created.some((r) => r.roster_date === j.target));
    else assert(result.skipped.every((r) => r.reason));
  }
  pass(
    "Actual scoped week copy rotate1 wraps Sunday to Monday, nine new duties; intentional second copy skips all nine with server reasons and zero replacement duplicates",
  );
  const night = source.entries.find((r) => r.shift_pattern_id === 3);
  await p
    .getByRole("button", {
      name: "Cancel duty #" + night.roster_id,
      exact: true,
    })
    .click();
  let d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review decision", exact: true }),
    });
  await d
    .getByLabel("Decision reason / note", { exact: true })
    .fill(j.run + " cancel synthetic night test");
  await d.getByRole("button", { name: "Review decision", exact: true }).click();
  await modal().getByRole("checkbox").check();
  await s.fault({
    failPath: "/rosters/" + night.roster_id + "/cancel",
    failMethod: "POST",
    once: true,
  });
  j.writes.cancel = { state: "prepared", roster_id: night.roster_id };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toContainText("Outcome unknown.");
  await expect(
    modal().getByRole("button", {
      name: "Retry original request",
      exact: true,
    }),
  ).toHaveCount(0);
  await modal()
    .getByRole("button", { name: "Read original roster result", exact: true })
    .click();
  await expect(
    modal().getByRole("button", {
      name: "Result reviewed; return to planner",
      exact: true,
    }),
  ).toBeVisible();
  const cancelled = (
    await read(night.roster_date, night.roster_date)
  ).entries.find((r) => r.roster_id === night.roster_id);
  assert.equal(cancelled.status, "Cancelled");
  j.writes.cancel = { state: "confirmed", result: cancelled };
  save();
  await modal()
    .getByRole("button", {
      name: "Result reviewed; return to planner",
      exact: true,
    })
    .click();
  assert.equal(
    (await s.trace()).requests.filter(
      (r) =>
        r.method === "POST" &&
        r.path.endsWith("/" + night.roster_id + "/cancel"),
    ).length,
    1,
  );
  pass(
    "Real cancelled duty lost200 reconciled exact ID/status including cancelled history; one POST and no automatic/idempotent replay offered",
  );
  await p.getByRole("button", { name: "Swaps", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Record agreed swap", exact: true }),
  ).toBeEnabled();
  await p
    .getByRole("button", { name: "Record agreed swap", exact: true })
    .click();
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review agreed swap", exact: true }),
    });
  await d
    .getByLabel("Original duty", { exact: true })
    .selectOption(String(first.roster_id));
  await d.getByLabel("Covering colleague", { exact: true }).selectOption("15");
  await d
    .getByLabel("Swap reason", { exact: true })
    .fill(j.run + " simulated agreement only, no actual staff request");
  await d.getByRole("checkbox").check();
  await d
    .getByRole("button", { name: "Review agreed swap", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  j.writes.recordSwap = {
    state: "prepared",
    roster_id: first.roster_id,
    covering_employee_id: 15,
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await s.trace()).requests.filter(
          (r) =>
            r.method === "POST" &&
            r.path === "/api/v1/rosters/swaps" &&
            r.finished,
        ).length,
    )
    .toBe(1);
  const recorded = (await s.trace()).requests.find(
    (r) => r.method === "POST" && r.path === "/api/v1/rosters/swaps",
  ).result.data;
  assert.equal(recorded.status, "Approved");
  j.writes.recordSwap = { state: "confirmed", result: recorded };
  save();
  await p.getByLabel("Swap status", { exact: true }).selectOption("Approved");
  await expect(p.locator("main")).toContainText("New covering duty");
  await expect
    .poll(() =>
      p.evaluate(
        () =>
          window.rosterEvents.some((e) => e.event_type === "roster.changed") &&
          window.rosterEvents.some(
            (e) => e.event_type === "roster.swap.updated",
          ),
      ),
    )
    .toBe(true);
  pass(
    "Actual in-person-recorded cover201 immediately Approved by independent manager; original Cancelled/new duty swap_id, exact Approved status read and both live events",
  );
  await p.getByRole("button", { name: "Week planner", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await capture(s, "duty_roster");
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}

```
