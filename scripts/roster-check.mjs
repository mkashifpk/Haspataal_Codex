// Fresh owned DEV duties only. Do not replay after a partial run: read original journal/keys.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const file = "artifacts/duty-roster-check.json";
assert(
  !fs.existsSync(file),
  "Reconcile existing roster journal; never rerun committed creates/copies/swaps",
);
const j = {
  run: "DEMO-ROSTER-" + Date.now(),
  started: new Date().toISOString(),
  source: "2026-11-09",
  target: "2026-11-16",
  checks: [],
  writes: {},
  passed: false,
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
  s = await session("duty-roster-headnurse", "demo.headnurse");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  await s.nav("Nursing duty roster");
  await expect(
    p.getByRole("heading", { name: "Nursing duty roster", exact: true }),
  ).toBeVisible();
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
  assert.equal(
    (await read(j.source, "2026-11-22")).entries.length,
    0,
    "Empty owned future test period required, do not overwrite another test",
  );
  await p.getByLabel("Any date in roster week", { exact: true }).fill(j.source);
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await expect(p.locator("main")).toContainText("2026-11-15");
  await p.getByLabel("Filter ward", { exact: true }).selectOption("1");
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
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
  const add = async (employee, date, shift = 1) => {
    await p.getByRole("button", { name: "Add duty", exact: true }).click();
    const d = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("button", { name: "Add to duty batch", exact: true }),
      });
    await d
      .getByLabel("Duty employee", { exact: true })
      .selectOption(String(employee));
    await d.getByLabel("Duty start date", { exact: true }).fill(date);
    await d
      .getByLabel("Duty shift", { exact: true })
      .selectOption(String(shift));
    await d.getByLabel("Duty ward", { exact: true }).selectOption("1");
    await d
      .getByLabel("Duty notes", { exact: true })
      .fill(j.run + " software test only");
    await d.getByRole("checkbox", { name: /^GW-M-1 ·/ }).check();
    await d
      .getByRole("button", { name: "Add to duty batch", exact: true })
      .click();
    await expect(d).toHaveCount(0);
  };
  for (let n = 9; n <= 15; n++)
    await add(17, "2026-11-" + n.toString().padStart(2, "0"));
  await add(17, "2026-11-10", 3);
  await add(15, "2026-11-12");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method === "POST").length,
    0,
  );
  await help(
    s,
    p.getByRole("button", { name: "Review duty batch", exact: true }),
    "Nursing duty roster",
  );
  pass(
    "Actual Head Nurse scope, server-aligned seven-day/Sunday grid, Ward bed labels, keyboard add nine unsent duties, F1 preserves batch; zero POST before confirmation",
  );
  await p
    .getByRole("button", { name: "Review duty batch", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  await s.fault({
    failPath: "/api/v1/rosters",
    failMethod: "POST",
    once: true,
  });
  j.writes.batch = { state: "prepared", count: 9 };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await expect(modal()).toContainText("Outcome unknown.");
  let writes = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/rosters",
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, 201);
  j.writes.batch.original = writes[0];
  save();
  await modal()
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(modal()).toHaveCount(0);
  let source = await read(j.source, "2026-11-15");
  assert.equal(source.entries.length, 9);
  writes = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/rosters",
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].key, writes[1].key);
  assert.deepEqual(writes[0].body, writes[1].body);
  assert.equal(writes[1].replay, "true");
  j.writes.batch.state = "confirmed";
  j.sourceRows = source.entries;
  save();
  pass(
    "Real atomic nine-duty201 lost AFTER commit; double click one flight, deliberate original-key replay SAME nine rows, no duplicate roster/notification action",
  );
  await p.getByRole("button", { name: "Week check", exact: true }).click();
  await expect(p.locator("main")).toContainText("No rest day");
  const wk = await s.native("api", {
    method: "GET",
    path: "/rosters/week?week_of=" + j.source + "&ward_id=1",
  });
  assert.equal(wk.staff.find((x) => x.employee_id === 17).status, "NoRestDay");
  assert.equal(wk.staff.find((x) => x.employee_id === 17).extra_duty_days, 1);
  j.weekCheck = wk;
  save();
  await p.getByRole("button", { name: "Week planner", exact: true }).click();
  await add(15, "2026-11-15");
  await add(17, "2026-11-09");
  await p
    .getByRole("button", { name: "Review duty batch", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  j.writes.atomicRefusal = { state: "prepared" };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toContainText("ROSTER_CONFLICT");
  const failed = (await s.trace()).requests
    .filter((r) => r.method === "POST" && r.path === "/api/v1/rosters")
    .at(-1);
  assert.equal(failed.status, 409);
  assert.equal(failed.result.error.details.entry_index, 1);
  assert.equal((await read(j.source, "2026-11-15")).entries.length, 9);
  j.writes.atomicRefusal = { state: "refused", result: failed };
  save();
  await modal().getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    p
      .getByRole("listitem")
      .filter({
        has: p.getByRole("button", {
          name: "Remove unsent entry 2",
          exact: true,
        }),
      }),
  ).toHaveAttribute("aria-invalid", "true");
  await p
    .getByRole("button", { name: "Remove unsent entry 2", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Remove unsent entry 1", exact: true })
    .click();
  pass(
    "Actual second-entry overnight/overlap refusal409 index1 highlighted; first valid entry rolled back, still nine rows; server week check NoRestDay/extra duty1",
  );
  const first = source.entries.find(
    (r) => r.employee_id === 17 && r.roster_date === j.source,
  );
  await p
    .getByRole("button", { name: "Edit duty #" + first.roster_id, exact: true })
    .click();
  let edit = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review duty changes", exact: true }),
    });
  await edit
    .getByLabel("Zone / bay", { exact: true })
    .fill("DEMO reviewed stale");
  await edit
    .getByRole("button", { name: "Review duty changes", exact: true })
    .click();
  const concurrent = {
    expected_version: first.row_version,
    zone_label: "DEMO concurrent",
  };
  j.writes.concurrent = {
    state: "prepared",
    path: "/rosters/" + first.roster_id,
    body: concurrent,
    key: crypto.randomUUID(),
  };
  save();
  const changed = await s.native("api", {
    method: "PATCH",
    path: "/rosters/" + first.roster_id,
    body: concurrent,
    key: j.writes.concurrent.key,
  });
  j.writes.concurrent.result = changed;
  j.writes.concurrent.state = "confirmed";
  save();
  const patchesBefore = (await s.trace()).requests.filter(
    (r) => r.method === "PATCH",
  ).length;
  await modal().getByRole("checkbox").check();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toContainText("This duty changed.");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method === "PATCH").length,
    patchesBefore,
  );
  await modal().getByRole("button", { name: "Close", exact: true }).click();
  await edit.getByRole("button", { name: "Close", exact: true }).click();
  await p.getByRole("button", { name: "Refresh roster", exact: true }).click();
  await expect(
    p.getByRole("button", {
      name: "Edit duty #" + first.roster_id,
      exact: true,
    }),
  ).toBeEnabled();
  await p
    .getByRole("button", { name: "Edit duty #" + first.roster_id, exact: true })
    .click();
  edit = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review duty changes", exact: true }),
    });
  await edit.getByLabel("Zone / bay", { exact: true }).fill("DEMO Bay B");
  await edit.getByRole("checkbox", { name: /^GW-M-1 ·/ }).uncheck();
  await edit.getByRole("checkbox", { name: /^GW-M-2 ·/ }).check();
  await edit
    .getByRole("button", { name: "Review duty changes", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  j.writes.edit = { state: "prepared", roster_id: first.roster_id };
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
  assert.deepEqual(updated.bed_ids, [2]);
  j.writes.edit = { state: "confirmed", result: updated };
  save();
  pass(
    "Live concurrent PATCH event preserves unsent edit; stale review refused BEFORE PATCH; explicit fresh delta edit carries latest expected_version and exact ward bed2",
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
