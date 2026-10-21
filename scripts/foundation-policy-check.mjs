import { terminalPage } from "./terminal-page.mjs";
// Fresh policy approval journeys using the SAME existing value: no setting value,
// service, permission or financial record is changed. Every target is recorded.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { request, checkedRoot } = createRequire(import.meta.url)(
  "../electron/transport.cjs",
);
const c = JSON.parse(fs.readFileSync(".dev-terminal.json", "utf8"));
const ca = checkedRoot(c.ca_pem, c.ca_fingerprint_sha256);
const file = "artifacts/foundation-policy-run.json";
const journal = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : { run: "DEMO-FOUNDATION-POLICY-" + Date.now(), records: {}, checks: [] };
const save = () => fs.writeFileSync(file, JSON.stringify(journal, null, 2));
save();
let app, page, activePrefs, it;
async function server(method, route, body) {
  const response = await request(c.server_urls[0] + "/api/v1" + route, {
    ca,
    method,
    body,
    headers: {
      ...(it ? { Authorization: "Bearer " + it } : {}),
      "X-Haspataal-Developer": "mkashif",
      "X-Haspataal-Implementation": "1",
    },
  });
  assert(
    response.status < 400,
    `${method} ${route}: ${response.status} ${response.body?.error?.code}`,
  );
  return response.body.data;
}
const state = () =>
  page.evaluate(() => window.terminal.call("state").then((r) => r.data));
async function preferences(value) {
  const result = await page.evaluate(
    (v) => window.terminal.call("prefs", v),
    value,
  );
  assert(result.ok, JSON.stringify(result));
}
async function account(username) {
  if ((await state()).user) {
    if (activePrefs) {
      await preferences(activePrefs);
      activePrefs = undefined;
    }
    const result = await page.evaluate(() =>
      window.terminal.call("logout", {}),
    );
    assert(result.ok);
  }
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await expect(
    page.getByRole("button", { name: "Sign in →", exact: true }),
  ).toBeEnabled({ timeout: 40000 });
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect
    .poll(() => state().then((s) => s.user?.username), { timeout: 50000 })
    .toBe(username);
  activePrefs = (await state()).prefs;
  await preferences({ language: "en", theme: "Light", ui_scale_pct: 100 });
  // Workspace selection is always obtained from the authenticated server state.
  const current = await state();
  const code = current.user.workspaces.find(
    (w) => w.code === "owner_dashboard" || w.code === "super_admin",
  )?.code;
  if (code) {
    const result = await page.evaluate(
      (code) => window.terminal.call("workspace", { code }),
      code,
    );
    assert(result.ok);
    await page.reload();
  }
  await page
    .getByText("READY FOR YOUR NEXT TASK", { exact: true })
    .waitFor({ timeout: 60000 });
}
const nav = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: false })
    .click();
async function verifySetting() {
  const settings = await server("GET", "/admin/settings");
  const row = settings.find((s) => s.key === journal.setting_key);
  assert.deepEqual(
    row.value,
    journal.original_value,
    "another actor changed policy: do not overwrite it",
  );
}
function passed(value) {
  journal.checks.push(value);
  save();
  console.log("PASS " + value);
}
try {
  it = (
    await server("POST", "/auth/login", {
      username: "demo.it",
      password: "Demo-pass-2026",
    })
  ).access_token;
  const settings = await server("GET", "/admin/settings");
  const setting = settings.find(
    (s) => s.key === "reception_max_discount_pct" && s.is_control,
  );
  assert(setting);
  if (!journal.setting_key) {
    journal.setting_key = setting.key;
    journal.original_value = setting.value;
    save();
  }
  await verifySetting();
  const env = {
    ...process.env,
    HASPATAAL_TEST: "1",
    HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
    HASPATAAL_TEST_DATA: path.resolve("artifacts/policy-profile-" + Date.now()),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(40000);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await account("demo.it");
  for (const action of ["approve", "reject", "cancel"]) {
    const reason = journal.run + " " + action + " SAME VALUE verification";
    if (!journal.records[action]?.approval_id) {
      const existing = (await server("GET", "/admin/change-requests")).find(
        (r) => r.reason === reason,
      );
      if (existing) {
        journal.records[action] = {
          id: existing.change_request_id,
          approval_id: existing.approval_request_id,
          reason,
        };
        save();
        continue;
      }
      assert(
        !journal.records[action]?.pending,
        "uncertain previous request must be reconciled before a replacement",
      );
      await nav("Settings");
      await page
        .locator(".settings-nav button")
        .filter({ hasText: "Hospital policy settings" })
        .click();
      await page
        .locator(".policy-list .list-row")
        .filter({ hasText: "reception max discount pct" })
        .click();
      await page
        .getByLabel("New value", { exact: true })
        .fill(JSON.stringify(journal.original_value));
      await page.getByLabel("Reason", { exact: true }).fill(reason);
      journal.records[action] = { pending: true, reason };
      save();
      await page
        .getByRole("button", { name: "Save policy", exact: true })
        .click();
      await expect(page.locator('[data-write-pending="true"]')).toHaveCount(0);
      const created = (await server("GET", "/admin/change-requests")).find(
        (r) => r.reason === reason,
      );
      assert(
        created?.approval_request_id,
        "real request and approval IDs must be returned",
      );
      assert.equal(created.status, "Pending");
      journal.records[action] = {
        id: created.change_request_id,
        approval_id: created.approval_request_id,
        reason,
      };
      save();
    }
  }
  passed(
    "IT submits three fresh same-value policy requests through Settings and reads actual request detail",
  );
  await account("demo.owner");
  for (const action of ["approve", "reject"]) {
    const target = journal.records[action];
    const existing = await server("GET", `/approvals/${target.approval_id}`);
    assert(existing.payload_jsonb && existing.status);
    if (existing.status !== "Pending") {
      assert.equal(
        existing.status,
        action === "approve" ? "Approved" : "Rejected",
      );
      continue;
    }
    await verifySetting();
    await nav("Approvals");
    await page
      .getByRole("button", {
        name: new RegExp(`^Request ${target.approval_id}:`),
      })
      .click();
    await page
      .getByLabel("Decision note", { exact: true })
      .fill(journal.run + " reviewed same unchanged value");
    await page
      .getByRole("button", {
        name: action === "approve" ? "Approve" : "Reject",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "This applies the decision on the hospital server.",
    );
    journal.records[action].decision_pending = true;
    save();
    await dialog
      .getByRole("button", {
        name: action === "approve" ? "Confirm Approve" : "Confirm Reject",
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    const decided = await server("GET", `/approvals/${target.approval_id}`);
    assert.equal(
      decided.status,
      action === "approve" ? "Approved" : "Rejected",
    );
    target.decision_pending = false;
    target.status = decided.status;
    save();
  }
  passed(
    "Owner approves/rejects only new same-value requests; separate requester/decider and actual saved effects verified",
  );
  await account("demo.it");
  const target = journal.records.cancel;
  const existing = await server("GET", `/approvals/${target.approval_id}`);
  if (existing.status === "Pending") {
    await nav("Approvals");
    await page.getByLabel("My requests", { exact: false }).check();
    await page
      .getByRole("button", {
        name: new RegExp(`^Request ${target.approval_id}:`),
      })
      .click();
    await page
      .getByLabel("Decision note", { exact: true })
      .fill(journal.run + " withdraw own synthetic request");
    await page
      .getByRole("button", { name: "Cancel request", exact: true })
      .click();
    journal.records.cancel.decision_pending = true;
    save();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Cancel", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const cancelled = await server("GET", `/approvals/${target.approval_id}`);
  assert.equal(cancelled.status, "Cancelled");
  target.decision_pending = false;
  target.status = cancelled.status;
  save();
  await verifySetting();
  passed(
    "requester cancels its own new request; policy value remains identical to the pre-run server value",
  );
  delete journal.error;
  journal.passed = true;
  journal.checks = [...new Set(journal.checks)];
  save();
} catch (error) {
  journal.error = error.message;
  save();
  if (page)
    await page
      .screenshot({ path: "artifacts/foundation-policy-failure.png" })
      .catch(() => {});
  throw error;
} finally {
  if (app) {
    if (activePrefs)
      await preferences(activePrefs).catch((error) => {
        journal.preference_restore_error = error.message;
        save();
      });
    await app.close();
  }
}
