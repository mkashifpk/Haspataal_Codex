# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// User-authorised brief shared DEV window. Always restore the original settings.
// No business writes or review code; real HTTP/WS only, no fabricated responses.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright";
import { session, expect } from "./clinical-test-kit.mjs";
import { terminalPage } from "./terminal-page.mjs";
const file = "docs/maintenance-live-evidence-2026-10-25.json";
assert(
  !fs.existsSync(file),
  "Reconcile original shared maintenance journal before another run",
);
const j = {
  started: new Date().toISOString(),
  message: "DEMO ONLY — Back at 12:00\nصرف سافٹ ویئر جانچ؛ اصل سرور پیغام",
  passed: false,
  requests: [],
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const config = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const ca = checkedRoot(config.ca_pem, config.ca_fingerprint_sha256);
async function raw(method, route, token, body) {
  const r = await request(
    config.server_urls[0] + (route === "/health" ? route : "/api/v1" + route),
    {
      ca,
      method,
      body,
      timeoutMs: 10000,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        "X-Haspataal-Developer": "mkashif",
        "X-Haspataal-Implementation": "1",
      },
    },
  );
  if (route !== "/auth/login") {
    j.requests.push({
      method,
      route,
      body,
      status: r.status,
      request_id: r.body?.request_id,
    });
    save();
  }
  return r;
}
let s, preApp, pre, it, restoreFlight, timer;
async function restore() {
  if (j.restored || !j.enable_attempted) return;
  if (restoreFlight) return restoreFlight;
  restoreFlight = (async () => {
    const h = await raw("GET", "/health");
    assert.equal(h.status, 200);
    if (h.body.data.maintenance_mode) {
      assert.equal(
        h.body.data.maintenance_message,
        j.message,
        "Do not overwrite somebody else’s maintenance update",
      );
      j.restore_pending = j.original_put;
      save();
      const r = await raw("PUT", "/admin/maintenance", it, j.original_put);
      assert.equal(r.status, 200);
    }
    const final = await raw("GET", "/admin/settings", it);
    assert.equal(final.status, 200);
    const find = (k) => final.body.data.find((x) => x.key === k)?.value;
    assert.equal(find("maintenance_mode"), j.original_put.enabled);
    assert.equal(find("maintenance_message"), j.original_put.message);
    j.restored = true;
    delete j.restore_pending;
    j.restored_at = new Date().toISOString();
    save();
  })();
  return restoreFlight;
}
try {
  const auth = await raw("POST", "/auth/login", null, {
    username: "demo.it",
    password: "Demo-pass-2026",
  });
  assert.equal(auth.status, 200);
  it = auth.body.data.access_token;
  const settings = await raw("GET", "/admin/settings", it);
  assert.equal(settings.status, 200);
  j.original_put = {
    enabled: settings.body.data.find((x) => x.key === "maintenance_mode").value,
    message: settings.body.data.find((x) => x.key === "maintenance_message")
      .value,
  };
  assert.equal(
    j.original_put.enabled,
    false,
    "A different maintenance window is already active",
  );
  save();
  s = await session("maintenance-authenticated", "demo.reception");
  await s.nav("Tariff");
  await expect(
    s.p.getByRole("button", { name: "Refresh tariff", exact: true }),
  ).toBeEnabled();
  await s.p.evaluate(() => {
    window.maintenanceObserved = [];
    window.terminal.subscribe((e) => {
      if (JSON.stringify(e).includes("system.maintenance"))
        window.maintenanceObserved.push(e);
    });
  });
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve(
      "artifacts/maintenance-prelogin-" + Date.now(),
    ),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  preApp = await electron.launch({ args: ["."], env });
  pre = await terminalPage(preApp);
  await pre.getByText("Hospital server ready.", { exact: true }).waitFor();
  await pre.evaluate(() =>
    window.terminal.call("prefs", {
      language: "ur",
      theme: "Light",
      ui_scale_pct: 100,
    }),
  );
  // Guard against a hung assertion leaving the shared server in maintenance.
  timer = setTimeout(() => {
    j.deadline_restore = true;
    save();
    void restore().catch((e) => {
      j.deadline_restore_error = e.message;
      save();
    });
  }, 45000);
  j.enable_attempted = true;
  j.enable_pending = { enabled: true, message: j.message };
  save();
  const enabled = await raw("PUT", "/admin/maintenance", it, j.enable_pending);
  assert.equal(enabled.status, 200);
  delete j.enable_pending;
  save();
  await expect
    .poll(() => s.p.evaluate(() => window.maintenanceObserved), {
      timeout: 15000,
    })
    .not.toEqual([]);
  j.events = await s.p.evaluate(() => window.maintenanceObserved);
  assert(JSON.stringify(j.events).includes(j.message.replaceAll("\n", "\\n")));
  await expect(s.p.locator(".blocking-banner p")).toHaveText(j.message);
  assert.equal(
    await s.p.locator(".blocking-banner p").textContent(),
    j.message,
  );
  await expect(pre.locator('.login-form [role="status"] span'), {
    timeout: 15000,
  }).toHaveText(j.message);
  assert.equal(
    await pre.locator('.login-form [role="status"] span').textContent(),
    j.message,
  );
  j.health = (await raw("GET", "/health")).body;
  assert.equal(j.health.data.maintenance_message, j.message);
  // Exercise the actual frontend API/error path on a read, with the real server503.
  await s.p
    .getByRole("button", { name: "Refresh tariff", exact: true })
    .evaluate((b) => b.click());
  await expect(
    s.p
      .locator('main .error[role="alert"]')
      .filter({ hasText: "MAINTENANCE" })
      .first(),
  ).toContainText("MAINTENANCE");
  assert.equal(
    await s.p
      .locator('main .error[role="alert"]')
      .filter({ hasText: "MAINTENANCE" })
      .first()
      .locator("strong")
      .textContent(),
    j.message,
  );
  await expect(s.p.locator(".blocking-banner p")).toHaveText(j.message);
  j.raw_error = await s.p.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/meta/enums" }),
  );
  assert.equal(j.raw_error.error.code, "MAINTENANCE");
  assert.equal(j.raw_error.error.message, j.message);
  j.channels_passed = [
    "actual system.maintenance event/message",
    "prelogin actual health polling in Urdu/raw multiline text",
    "authenticated exact full-screen event/error/health text",
    "actual frontend MAINTENANCE error verbatim",
  ];
  save();
  await restore();
  clearTimeout(timer);
  await expect(s.p.locator(".blocking-banner")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(pre.locator('.login-form [role="status"]')).toContainText(
    "ہسپتال سرور تیار ہے۔",
    { timeout: 15000 },
  );
  // Use direct health as the recovery assertion regardless of translated wording.
  j.final_health = (await raw("GET", "/health")).body;
  assert.equal(j.final_health.data.maintenance_mode, false);
  s.j.passed = true;
  j.passed = true;
  save();
  console.log(
    "PASS actual maintenance health/event/API error text verbatim; shared original state restored; no business writes",
  );
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (timer) clearTimeout(timer);
  try {
    await restore();
  } catch (e) {
    j.restore_error = e.stack;
    save();
    process.exitCode = 1;
  }
  if (preApp) {
    try {
      await pre.evaluate(() =>
        window.terminal.call("prefs", {
          language: "en",
          theme: "Light",
          ui_scale_pct: 100,
        }),
      );
    } catch {}
    await preApp.close();
  }
  if (s) {
    await s.close();
    j.session = {
      renderer: s.j.renderer,
      preferences_restored: s.j.preferences_restored,
      signed_out: s.j.signed_out,
      requests: s.j.trace?.requests.map((r) => ({
        method: r.method,
        path: r.path,
        status: r.status,
        request_id: r.result?.request_id,
      })),
    };
  }
  j.finished = new Date().toISOString();
  save();
}

```
