# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Actual known DEV CA read after login; no token/header values are recorded.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session } from "./clinical-test-kit.mjs";
const s = await session("public-bootstrap-auth", "demo.reception");
try {
  await s.app.evaluate(() => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    globalThis.bootstrapHeaderChecks = [];
    https.request = function (...args) {
      const req = original.apply(this, args);
      const u =
        typeof args[0] === "object" && !(args[0] instanceof URL)
          ? args[0].path
          : new URL(args[0]).pathname;
      if (u === "/ca.crt")
        globalThis.bootstrapHeaderChecks.push({
          has_authorization: req.hasHeader("Authorization"),
          developer_present: req.hasHeader("X-Haspataal-Developer"),
          implementation_present: req.hasHeader("X-Haspataal-Implementation"),
          review_present: req.hasHeader("X-Haspataal-Review"),
        });
      return req;
    };
  });
  const cfg = JSON.parse(fs.readFileSync(".dev-terminal.json"));
  const denied = await s.p.evaluate(
    (url) => window.terminal.call("inspect-server", { url }),
    cfg.server_urls[0],
  );
  assert.equal(denied.ok, false);
  assert.match(denied.error.message, /Sign out before changing servers/);
  assert.equal(
    (await s.app.evaluate(() => globalThis.bootstrapHeaderChecks)).length,
    0,
  );
  await s.prefs(s.original);
  await s.native("logout");
  s.original = undefined;
  const managed = await s.p.evaluate(
    (url) => window.terminal.call("inspect-server", { url }),
    cfg.server_urls[0],
  );
  assert.equal(managed.ok, false);
  assert.match(managed.error.message, /IT manages this terminal/);
  const checks = await s.app.evaluate(() => globalThis.bootstrapHeaderChecks);
  assert.equal(checks.length, 0);
  s.j.headers = checks;
  s.j.passed = true;
  s.save();
  console.log(
    "PASS signed-in and provisioned CA inspection guards refuse before any HTTP; no token or review code sent",
  );
} catch (e) {
  s.j.error = e.stack;
  s.save();
  process.exitCode = 1;
  console.error(e.stack);
} finally {
  await s.close();
  fs.writeFileSync(
    "docs/public-bootstrap-auth-evidence-2026-10-25.json",
    JSON.stringify(
      {
        passed: s.j.passed,
        headers: s.j.headers,
        renderer: s.j.renderer,
        preferences_restored: s.j.preferences_restored,
        signed_out: s.j.signed_out,
        error: s.j.error,
      },
      null,
      2,
    ),
  );
}

```
