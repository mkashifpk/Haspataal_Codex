// Read-only roster UI verification; all roster writes are refused before transport.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/roster-readonly-ui-v3.json";
assert(!fs.existsSync(file), "Review previous read-only profile/journal first");
const j = { started: new Date().toISOString(), checks: [], passed: false };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
try {
  s = await session("roster-readonly-headnurse", "demo.headnurse");
  const p = s.p;
  p.on("dialog", (d) => d.accept());
  j.renderer = s.j.renderer;
  save();
  const visible = await s.app.browserWindow(p);
  await visible.evaluate((w) => {
    w.show();
    w.focus();
  });
  await s.app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.rosterBlockedWrites = 0;
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL),
        opts = object ? url : options;
      const pathname = object ? url.path : new URL(url).pathname;
      if (
        pathname.includes("/api/v1/rosters") &&
        (opts?.method || "GET") !== "GET"
      ) {
        globalThis.rosterBlockedWrites++;
        throw Error("READ_ONLY_ROSTER: no business writes");
      }
      return original.call(this, url, options, callback);
    };
    const WS = process
        .getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("ws"),
      emit = WS.prototype.emit;
    WS.prototype.emit = function (e, ...a) {
      if (e === "message") globalThis.rosterReadonlySocket = this;
      return emit.call(this, e, ...a);
    };
  });
  await s.nav("Nursing duty roster");
  await p
    .getByLabel("Any date in roster week", { exact: true })
    .fill("2026-11-09");
  await p.getByRole("button", { name: "Open week", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.getByLabel("Filter ward", { exact: true }).selectOption("1");
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  await p.evaluate(() => {
    window.rosterReadonlyEvents = [];
    window.rosterReadonlyStreams = [];
    window.rosterDragEvents = [];
    window.terminal.subscribe((e) => {
      if (e.type === "event") window.rosterReadonlyEvents.push(e);
      if (e.type === "stream") window.rosterReadonlyStreams.push(e);
    });
    for (const type of ["dragstart", "dragover", "drop", "dragend"])
      document.addEventListener(
        type,
        (e) =>
          window.rosterDragEvents.push({
            type,
            target: e.target.tagName,
            types: [...(e.dataTransfer?.types || [])],
            data: e.dataTransfer?.getData("application/haspataal-roster-staff"),
          }),
        true,
      );
  });
  const target = p
    .locator(".roster-grid tbody tr")
    .nth(2)
    .locator("td")
    .first();
  await p
    .getByRole("button", { name: "IPC Nurse Shazia", exact: false })
    .dragTo(target, {
      sourcePosition: { x: 4, y: 4 },
      targetPosition: { x: 4, y: 4 },
    });
  let d = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", { name: "Add to duty batch", exact: true }),
    });
  await expect(d.getByLabel("Duty employee", { exact: true })).toHaveValue(
    "30",
  );
  await expect(d.getByLabel("Duty shift", { exact: true })).toHaveValue("2");
  await expect(d.getByLabel("Duty start date", { exact: true })).toHaveValue(
    "2026-11-09",
  );
  await d
    .getByLabel("Duty notes", { exact: true })
    .fill("UNSENT read-only drag draft");
  await help(
    s,
    d.getByLabel("Duty notes", { exact: true }),
    "Nursing duty roster",
  );
  await expect(d.getByLabel("Duty notes", { exact: true })).toHaveValue(
    "UNSENT read-only drag draft",
  );
  j.dragEvents = await p.evaluate(() => window.rosterDragEvents);
  pass(
    "Actual native HTML drag opens IPC nurse30/Evening2/Nov9; F1 preserves unsent notes/focus with zero roster writes",
  );
  j.waiting_for_independent_cleanup_event = true;
  save();
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.rosterReadonlyEvents.some(
            (e) => e.event_type === "roster.swap.updated",
          ),
        ),
      { timeout: 60000 },
    )
    .toBe(true);
  await expect(d.getByLabel("Duty notes", { exact: true })).toHaveValue(
    "UNSENT read-only drag draft",
  );
  j.waiting_for_independent_cleanup_event = false;
  save();
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, theme: "DarkHighContrast", ui_scale_pct: 250 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    await p.screenshot({
      path: "artifacts/roster-readonly-dialog-" + language + "-250.png",
    });
  }
  await s.prefs({ language: "en", theme: "Light", ui_scale_pct: 100 });
  await expect(d.getByLabel("Duty notes", { exact: true })).toHaveValue(
    "UNSENT read-only drag draft",
  );
  await d.getByRole("button", { name: "Close", exact: true }).click();
  pass(
    "Actual independent swap event refresh preserves unsent form; Urdu/EN high-contrast250 layouts, cancel unsent draft has zero POST",
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
  await s.fault({
    failPath: "/api/v1/rosters?",
    failMethod: "GET",
    once: false,
  });
  await p.getByRole("button", { name: "Refresh roster", exact: true }).click();
  await expect(p.locator("main .error").first()).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toHaveCount(0);
  await expect(p.locator(".roster-duty")).toHaveCount(0);
  await s.fault({ failPath: null });
  await p.getByRole("button", { name: "Refresh roster", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Add duty", exact: true }),
  ).toBeEnabled();
  pass(
    "Real Electron native upper250/lower100/reset100 match Settings; failed real list read hides stale grid/actions and explicit refresh recovers",
  );
  await expect
    .poll(() => s.app.evaluate(() => !!globalThis.rosterReadonlySocket), {
      timeout: 45000,
    })
    .toBe(true);
  const at = Date.now();
  await s.app.evaluate(() => globalThis.rosterReadonlySocket.terminate());
  await expect
    .poll(
      () =>
        p.evaluate(() =>
          window.rosterReadonlyStreams.some(
            (e) => e.status === "Live" && e.resync,
          ),
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
  await p.evaluate(() => window.scrollTo(0, 0));
  await capture(s, "duty_roster");
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method !== "GET").length,
    0,
  );
  assert.equal(await s.app.evaluate(() => globalThis.rosterBlockedWrites), 0);
  j.events = await p.evaluate(() =>
    window.rosterReadonlyEvents
      .filter((e) => e.event_type.startsWith("roster."))
      .map((e) => ({ event_type: e.event_type, payload: e.payload })),
  );
  pass(
    "Actual socket reconnect rereads all five required sources; final bilingual media/themes250 captured with ZERO business writes",
  );
  j.passed = true;
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  try {
    if (s) {
      j.ui = await s.p.locator("main").innerText();
      j.dragEvents = await s.p.evaluate(() => window.rosterDragEvents);
      j.dragSource = await s.p
        .getByRole("button", { name: "IPC Nurse Shazia", exact: false })
        .evaluate((e) => ({
          html: e.outerHTML,
          dragStyle: getComputedStyle(e).webkitUserDrag,
          rect: e.getBoundingClientRect().toJSON(),
        }));
      await s.p.screenshot({ path: "artifacts/roster-readonly-failure.png" });
    }
  } catch {}
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}
