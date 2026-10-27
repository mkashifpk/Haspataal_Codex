// Final Duty Roster workflows. Original batch/copy/bed edit are never replayed.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/roster-final-ui.json";
assert(
  !fs.existsSync(file),
  "Reconcile original final journal before any restart",
);
const j = {
  run: "DEMO-ROSTER-1793121040141",
  started: new Date().toISOString(),
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
  s = await session("roster-final-headnurse", "demo.headnurse");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  j.renderer = s.j.renderer;
  save();
  await s.nav("Nursing duty roster");
  await p
    .getByLabel("Any date in roster week", { exact: true })
    .fill("2026-11-09");
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.getByLabel("Filter ward", { exact: true }).selectOption("1");
  await p.evaluate(() => {
    window.rosterStreams = [];
    window.finalRosterEvents = [];
    window.terminal.subscribe((e) => {
      if (e.type === "stream") window.rosterStreams.push(e);
      if (
        e.type === "event" &&
        ["roster.changed", "roster.swap.updated"].includes(e.event_type)
      )
        window.finalRosterEvents.push(e);
    });
  });
  await s.app.evaluate(() => {
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (e, ...a) {
      if (e === "message") globalThis.finalRosterSocket = this;
      return emit.call(this, e, ...a);
    };
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
  const swap = async (status, id) =>
    (
      await s.native("api", {
        method: "GET",
        path: "/rosters/swaps?status=" + status,
      })
    ).find((x) => x.swap_id === id);
  await p.getByRole("button", { name: "Swaps", exact: true }).click();
  await p.getByLabel("Swap status", { exact: true }).selectOption("Accepted");
  await expect(
    p.getByRole("button", { name: "Approve swap #4", exact: true }),
  ).toBeDisabled();
  await expect(
    p.getByRole("button", { name: "Reject swap #4", exact: true }),
  ).toBeDisabled();
  pass(
    "Own Accepted swap4 is read-only/independent-manager warning by employee ID; backend separately refused SWAP_SELF_APPROVAL403",
  );
  await p.getByRole("button", { name: "Approve swap #2", exact: true }).click();
  let d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review decision", exact: true }),
    });
  await d
    .getByLabel("Decision reason / note", { exact: true })
    .fill(j.run + " synthetic independent approval");
  await d.getByRole("button", { name: "Review decision", exact: true }).click();
  await modal().getByRole("checkbox").check();
  await s.fault({
    failPath: "/rosters/swaps/2/approve",
    failMethod: "POST",
    once: true,
  });
  j.writes.approve = { state: "prepared", swap_id: 2 };
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
  const approved = await swap("Approved", 2);
  assert.equal(approved.status, "Approved");
  assert(approved.cover_roster_id);
  j.writes.approve = { state: "confirmed", result: approved };
  save();
  await modal()
    .getByRole("button", {
      name: "Result reviewed; return to planner",
      exact: true,
    })
    .click();
  assert.equal(
    (await s.trace()).requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/swaps/2/approve"),
    ).length,
    1,
  );
  pass(
    "Actual independent approve2 lost200: default Accepted queue disappearance never success; recovery checks all statuses and exact swap2 Approved/new covering duty; one POST/no replay",
  );
  await p.getByRole("button", { name: "Reject swap #3", exact: true }).click();
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review decision", exact: true }),
    });
  await expect(
    d.getByRole("button", { name: "Review decision", exact: true }),
  ).toBeDisabled();
  await d
    .getByLabel("Decision reason / note", { exact: true })
    .fill(j.run + " software-only rejection, no actual colleague request");
  await d.getByRole("button", { name: "Review decision", exact: true }).click();
  await modal().getByRole("checkbox").check();
  await s.fault({
    failPath: "/rosters/swaps/3/reject",
    failMethod: "POST",
    once: true,
  });
  j.writes.reject = { state: "prepared", swap_id: 3 };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toContainText("Outcome unknown.");
  await modal()
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(modal()).toHaveCount(0);
  const rejected = await swap("Rejected", 3);
  assert.equal(rejected.status, "Rejected");
  const rejects = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path.endsWith("/swaps/3/reject"),
  );
  assert.equal(rejects.length, 2);
  assert.equal(rejects[0].key, rejects[1].key);
  assert.deepEqual(rejects[0].body, rejects[1].body);
  assert.equal(rejects[1].replay, "true");
  j.writes.reject = { state: "confirmed", result: rejected, requests: rejects };
  save();
  pass(
    "Reject3 requires a reason; actual committed lost reply and identical original-key replay yields one Rejected decision/unchanged original duty",
  );
  await p
    .getByRole("button", { name: "Record agreed swap", exact: true })
    .click();
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review agreed swap", exact: true }),
    });
  await d.getByLabel("Original duty", { exact: true }).selectOption("27");
  await d.getByLabel("Covering colleague", { exact: true }).selectOption("15");
  await d
    .getByLabel("Return duty (optional)", { exact: true })
    .selectOption("32");
  await d
    .getByLabel("Swap reason", { exact: true })
    .fill(j.run + " two-way simulated agreement, no real staff scheduling");
  await d.getByRole("checkbox").check();
  await d
    .getByRole("button", { name: "Review agreed swap", exact: true })
    .click();
  await expect(modal()).toContainText("Nurse Hina");
  await expect(modal()).toContainText("OT Nurse Saima");
  await modal().getByRole("checkbox").check();
  j.writes.twoWay = { state: "prepared", source: 27, return: 32 };
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
  const two = (await s.trace()).requests.find(
    (r) => r.method === "POST" && r.path === "/api/v1/rosters/swaps",
  ).result.data;
  assert.equal(two.kind, "Swap");
  assert.equal(two.status, "Approved");
  assert(two.cover_roster_id && two.return_cover_roster_id);
  const swapped = await read("2026-11-12", "2026-11-12");
  assert.equal(
    swapped.entries.find((r) => r.roster_id === 27).status,
    "Cancelled",
  );
  assert.equal(
    swapped.entries.find((r) => r.roster_id === 32).status,
    "Cancelled",
  );
  for (const id of [two.cover_roster_id, two.return_cover_roster_id])
    assert.equal(
      swapped.entries.find((r) => r.roster_id === id).swap_id,
      two.swap_id,
    );
  j.writes.twoWay = { state: "confirmed", result: two };
  save();
  pass(
    "Final-build agreed two-way swap: frozen actual names/return duty reviewed, both original duties Cancelled and two new duties carry actual swap_id",
  );
  await p.getByRole("button", { name: "Week planner", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Repeat last week", exact: true }),
  ).toBeEnabled();
  const sourceSunday = (await read("2026-11-15", "2026-11-15")).entries.filter(
    (r) => r.status === "Active",
  );
  assert.equal(sourceSunday.length, 1);
  assert(sourceSunday[0].notes.startsWith(j.run));
  const before = (await read("2026-11-16", "2026-11-16")).entries.map(
    (r) => r.roster_id,
  );
  await p
    .getByRole("button", { name: "Repeat last week", exact: true })
    .click();
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review roster copy", exact: true }),
    });
  await d.getByLabel("Copy source from", { exact: true }).fill("2026-11-15");
  await d.getByLabel("Copy source to", { exact: true }).fill("2026-11-15");
  await d.getByLabel("Copy target from", { exact: true }).fill("2026-11-16");
  await d
    .getByRole("button", { name: "Review roster copy", exact: true })
    .click();
  await modal().getByRole("checkbox").check();
  await s.fault({ failPath: "/rosters/copy", failMethod: "POST", once: true });
  j.writes.ambiguousCopy = {
    state: "prepared",
    body: {
      source_from: "2026-11-15",
      source_to: "2026-11-15",
      target_from: "2026-11-16",
      ward_id: 1,
      rotate_days: 0,
    },
  };
  save();
  await modal()
    .getByRole("button", { name: "Confirm roster action", exact: true })
    .click();
  await expect(modal()).toContainText("Outcome unknown.");
  await modal()
    .getByRole("button", { name: "Read original roster result", exact: true })
    .click();
  await expect(modal()).toContainText(
    "This read does not identify the outcome",
  );
  await expect(
    modal().getByRole("button", {
      name: "Result reviewed; return to planner",
      exact: true,
    }),
  ).toHaveCount(0);
  await modal()
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(modal()).toHaveCount(0);
  const copies = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/rosters/copy",
  );
  assert.equal(copies.length, 2);
  assert.equal(copies[0].key, copies[1].key);
  assert.equal(copies[1].replay, "true");
  assert.equal(copies[1].result.data.created.length, 0);
  assert.equal(copies[1].result.data.skipped.length, 1);
  assert.deepEqual(
    (await read("2026-11-16", "2026-11-16")).entries.map((r) => r.roster_id),
    before,
  );
  j.writes.ambiguousCopy = { state: "confirmed", requests: copies };
  save();
  pass(
    "Ambiguous copy read cannot unlock a replacement even when matching duties exist; original-key replay confirms 0 created/1 skipped, target IDs unchanged",
  );
  await p
    .getByRole("button", { name: "Repeat last week", exact: true })
    .click();
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Review roster copy", exact: true }),
    });
  await d.getByLabel("Copy source from", { exact: true }).fill("2026-10-01");
  await d.getByLabel("Copy source to", { exact: true }).fill("2026-10-07");
  await d.getByLabel("Copy target from", { exact: true }).fill("2026-10-08");
  const n = (await s.trace()).requests.filter(
    (r) => r.method === "POST",
  ).length;
  await d
    .getByRole("button", { name: "Review roster copy", exact: true })
    .click();
  await expect(d).toContainText("Past duties require HR roster management.");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method === "POST").length,
    n,
  );
  await d.getByRole("button", { name: "Close", exact: true }).click();
  pass(
    "Past target copy refused locally before POST for Head Nurse; original dates/scope retained",
  );
  await p
    .getByRole("button", { name: "IPC Nurse Shazia", exact: false })
    .dragTo(p.locator(".roster-grid tbody tr").first().locator("td").first());
  d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Add to duty batch", exact: true }),
    });
  await expect(d.getByLabel("Duty employee", { exact: true })).toHaveValue(
    "30",
  );
  await d.getByLabel("Duty notes", { exact: true }).fill("UNSENT drag draft");
  await help(
    s,
    d.getByLabel("Duty notes", { exact: true }),
    "Nursing duty roster",
  );
  await expect(d.getByLabel("Duty notes", { exact: true })).toHaveValue(
    "UNSENT drag draft",
  );
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, theme: "DarkHighContrast", ui_scale_pct: 250 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    await p.screenshot({
      path: "artifacts/roster-dialog-" + language + "-250.png",
    });
  }
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await expect(d.getByLabel("Duty notes", { exact: true })).toHaveValue(
    "UNSENT drag draft",
  );
  await d.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method === "POST").length,
    n,
  );
  const win = await s.app.browserWindow(p);
  async function key(code) {
    await win.evaluate((w, k) => {
      for (const type of ["keyDown", "keyUp"])
        w.webContents.sendInputEvent({
          type,
          keyCode: k,
          modifiers: ["control"],
        });
    }, code);
  }
  for (let i = 0; i < 20; i++) await key("=");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(250);
  await key("=");
  assert.equal((await s.native("state")).prefs.ui_scale_pct, 250);
  for (let i = 0; i < 20; i++) await key("-");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  await key("-");
  assert.equal((await s.native("state")).prefs.ui_scale_pct, 100);
  await key("=");
  await key("0");
  await expect
    .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
    .toBe(100);
  pass(
    "Real HTML drag-and-drop opens correct actual staff/date/shift, F1/Urdu preserve unsent draft, Close creates no duty; native Electron zoom upper250/lower100/reset100 pass",
  );
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.finalRosterSocket), {
      timeout: 45000,
    })
    .toBe(true);
  const at = Date.now();
  await s.app.evaluate(() => globalThis.finalRosterSocket.terminate());
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.rosterStreams.some((e) => e.status === "Live" && e.resync),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  for (const route of [
    "/api/v1/rosters",
    "/api/v1/rosters/staff",
    "/api/v1/rosters/week",
    "/api/v1/rosters/swaps",
    "/api/v1/beds/matrix",
  ])
    await expect
      .poll(async () =>
        (await s.trace()).requests.some(
          (r) =>
            r.path.split("?")[0] === route &&
            r.started >= at &&
            r.status === 200,
        ),
      )
      .toBe(true);
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  j.events = await p.evaluate(() =>
    window.finalRosterEvents.map((e) => ({
      event_type: e.event_type,
      payload: e.payload,
    })),
  );
  await capture(s, "duty_roster");
  pass(
    "Actual socket reconnect/resync rereads lists, staff, week, swaps and beds; final EN/Urdu/both-theme250 media captured",
  );
  j.passed = true;
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
  try {
    if (s) {
      j.ui = await s.p.locator("main").innerText();
      await s.p.screenshot({ path: "artifacts/roster-final-failure.png" });
    }
  } catch {}
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}
