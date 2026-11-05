# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Real independent DEV session families only; credentials/tokens never persisted.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const cfg = JSON.parse(fs.readFileSync(".dev-terminal.json"));
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const ca = checkedRoot(cfg.ca_pem, cfg.ca_fingerprint_sha256);
const j = { started: new Date().toISOString(), requests: [], passed: false };
async function call(method, path, body, access) {
  const r = await request(cfg.server_urls[0] + "/api/v1" + path, {
    ca,
    method,
    body,
    headers: {
      ...(access ? { Authorization: "Bearer " + access } : {}),
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
    },
  });
  j.requests.push({
    method,
    path,
    status: r.status,
    code: r.body?.error?.code,
    request_id: r.body?.request_id,
  });
  return r;
}
try {
  const first = await call("POST", "/auth/login", {
    username: "demo.reception",
    password: "Demo-pass-2026",
  });
  assert.equal(first.status, 200);
  const original = first.body.data,
    refresh = await call("POST", "/auth/refresh", {
      refresh_token: original.refresh_token,
    });
  assert.equal(refresh.status, 200);
  const latest = refresh.body.data;
  assert.notEqual(latest.refresh_token, original.refresh_token);
  assert.equal(
    (await call("GET", "/auth/me", undefined, latest.access_token)).status,
    200,
  );
  const reused = await call("POST", "/auth/refresh", {
    refresh_token: original.refresh_token,
  });
  assert.equal(reused.status, 401);
  assert.equal(reused.body.error.code, "REFRESH_TOKEN_REUSED");
  assert.equal(
    (await call("GET", "/auth/me", undefined, latest.access_token)).status,
    401,
  );
  const separate = await call("POST", "/auth/login", {
    username: "demo.reception",
    password: "Demo-pass-2026",
  });
  assert.equal(separate.status, 200);
  const active = separate.body.data;
  assert.equal(
    (
      await call(
        "POST",
        "/auth/logout",
        { all_sessions: false },
        active.access_token,
      )
    ).status,
    200,
  );
  const ended = await call("POST", "/auth/refresh", {
    refresh_token: active.refresh_token,
  });
  assert.equal(ended.status, 401);
  assert.equal(ended.body.error.code, "TOKEN_REVOKED");
  j.passed = true;
  console.log(
    "PASS actual refresh rotation/reused-token family revocation and ordinary logout/TOKEN_REVOKED; only independent test families, no business writes",
  );
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  j.finished = new Date().toISOString();
  fs.writeFileSync(
    "docs/reset-refresh-token-evidence-2026-10-25.json",
    JSON.stringify(j, null, 2),
  );
}

```
