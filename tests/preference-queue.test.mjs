import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { createPreferenceQueue } = createRequire(import.meta.url)(
  "../electron/preference-queue.cjs",
);

test("rapid relative zoom, slider and reset changes resolve in order against confirmed state", async () => {
  let prefs = { ui_scale_pct: 100, language: "en" },
    active = 0;
  const written = [];
  const queue = createPreferenceQueue({
    read: () => prefs,
    context: () => 0,
    write: async (value) => {
      assert.equal(active++, 0, "only one save may be active");
      await new Promise((resolve) => setTimeout(resolve, 2));
      prefs = {
        ...prefs,
        ...value,
        ui_scale_pct: Math.max(
          100,
          Math.min(250, value.ui_scale_pct ?? prefs.ui_scale_pct),
        ),
      };
      written.push(prefs.ui_scale_pct);
      active--;
      return { ok: true, data: prefs };
    },
  });
  const increment = (current) => ({ ui_scale_pct: current.ui_scale_pct + 10 });
  await Promise.all(Array.from({ length: 20 }, () => queue(increment)));
  assert.deepEqual(written.slice(0, 5), [110, 120, 130, 140, 150]);
  assert.equal(prefs.ui_scale_pct, 250);
  await Promise.all([
    queue({ ui_scale_pct: 170 }),
    queue(increment),
    queue({ ui_scale_pct: 100 }),
    queue((c) => ({ ui_scale_pct: c.ui_scale_pct - 10 })),
    queue({ language: "ur" }),
  ]);
  assert.deepEqual(written.slice(-5), [170, 180, 100, 100, 100]);
  assert.equal(prefs.language, "ur");
});

test("a refusal/rejection does not poison the queue or fabricate a successful preference", async () => {
  let prefs = { ui_scale_pct: 100 },
    n = 0;
  const queue = createPreferenceQueue({
    read: () => prefs,
    context: () => 0,
    write: async (v) => {
      n++;
      if (n === 1) return { ok: false, error: { code: "OFFLINE" } };
      if (n === 2) throw Error("network");
      prefs = v;
      return { ok: true, data: v };
    },
  });
  assert.equal((await queue({ ui_scale_pct: 150 })).ok, false);
  await assert.rejects(queue({ ui_scale_pct: 160 }), /network/);
  assert.equal(prefs.ui_scale_pct, 100);
  await queue((c) => ({ ui_scale_pct: c.ui_scale_pct + 10 }));
  assert.equal(prefs.ui_scale_pct, 110);
});

test("queued changes are refused when the login context changes", async () => {
  let context = 0,
    writes = 0;
  const queue = createPreferenceQueue({
    read: () => ({}),
    context: () => context,
    write: async () => {
      writes++;
      return { ok: true };
    },
  });
  const pending = queue({ language: "ur" });
  context++;
  await assert.rejects(pending, /session changed/);
  assert.equal(writes, 0);
  await queue({ language: "en" });
  assert.equal(writes, 1);
});
