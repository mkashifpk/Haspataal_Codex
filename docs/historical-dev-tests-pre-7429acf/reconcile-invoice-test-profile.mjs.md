# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Restore ONLY the owned read-only invoice-test profile after an injected outage.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
const file = "artifacts/receivables-invoice-states.json",
  j = JSON.parse(fs.readFileSync(file));
const profile = path.resolve(j.profile),
  base = path.resolve("artifacts") + path.sep;
assert(
  profile.startsWith(base) &&
    path.basename(profile).startsWith("receivables-invoice-states-profile-"),
);
assert.equal(j.account, "demo.owner");
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: profile,
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const p = await terminalPage(app);
  p.setDefaultTimeout(45000);
  const native = async (action, args) => {
    const r = await p.evaluate((v) => window.terminal.call(v.action, v.args), {
      action,
      args,
    });
    assert(r.ok, action + ": " + r.error?.code);
    return r.data;
  };
  await expect
    .poll(
      async () => {
        const v = await native("state");
        return (
          !!v.user ||
          (await p.getByLabel("Username", { exact: true }).isVisible())
        );
      },
      { timeout: 60000 },
    )
    .toBe(true);
  if (!(await native("state")).user) {
    await p.getByText("Hospital server ready.", { exact: true }).waitFor();
    await p.getByLabel("Username", { exact: true }).fill(j.account);
    await p.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
    await p.getByRole("button", { name: "Sign in →", exact: true }).click();
    await p.getByRole("navigation").waitFor();
  }
  assert.equal((await native("state")).user.username, j.account);
  await native("prefs", j.original_preferences);
  const { updated_at: _, ...actual } = (
    await native("api", { method: "GET", path: "/auth/me" })
  ).preferences;
  const { updated_at: __, ...original } = j.original_preferences;
  assert.deepEqual(actual, original);
  await native("logout");
  assert(!(await native("state")).user);
  j.preferences_restored = true;
  j.signed_out = true;
  j.cleanup_reconciled_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
  fs.writeFileSync(
    "docs/receivables-invoice-profile-reconciliation-2026-10-25.json",
    JSON.stringify(
      {
        profile: path.basename(profile),
        account: j.account,
        preferences_restored: true,
        signed_out: true,
        reconciled_at: j.cleanup_reconciled_at,
        business_writes: 0,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS original invoice-test profile preferences restored against real auth/me; signed out; zero business writes",
  );
} finally {
  await app.close();
}

```
