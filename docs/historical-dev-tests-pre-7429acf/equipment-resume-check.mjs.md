# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Reconciles the exact previously committed visit before any new test action.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const original = JSON.parse(
  fs.readFileSync("artifacts/continuation-20261104/equipment-write.json"),
);
const lost = original.trace.requests.find(
  (r) =>
    r.reply_lost &&
    r.method === "POST" &&
    r.path.endsWith(`/equipment/${original.asset_id}/maintenance`),
);
assert.equal(lost.status, 201);
assert(lost.key && lost.result.data.record_id);
const file = "artifacts/continuation-20261104/equipment-resume.json";
assert(
  !fs.existsSync(file),
  "Reconcile resume journal before repeating a write",
);
const j = {
  started: new Date().toISOString(),
  asset_id: original.asset_id,
  tag: original.tag,
  checks: [],
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
try {
  s = await session("resume1104-equipment-reconciled", "demo.maintenance");
  const c = (k) => s.p.locator(`[data-help="${k}"]`);
  const detail = () =>
    s.native("api", {
      method: "GET",
      path: `/facility/equipment/${j.asset_id}`,
    });
  let d = await detail();
  assert.equal(d.asset_tag, j.tag);
  assert(d.records.some((r) => r.record_id === lost.result.data.record_id));
  assert.equal(d.records.filter((r) => r.kind === "Breakdown").length, 1);
  assert.equal(d.status, "OutOfService");
  j.checks.push(
    "Original lost result reconciled by its exact returned record_id and real detail read. One Breakdown exists; no replacement registration or visit was sent.",
  );
  save();
  await s.nav("Medical equipment and maintenance");
  await c("em-tab-inventory").click();
  await c("em-inv-search").fill(j.tag);
  await c("em-inv-item").filter({ hasText: j.tag }).click();
  await c("em-detail-record-visit-btn").waitFor();
  await c("em-detail-record-visit-btn").click();
  await c("em-visit-kind").selectOption("Inspection");
  await c("em-visit-result").selectOption("Fail");
  await c("em-visit-staff-select").selectOption(String(original.employee_id));
  await c("em-visit-findings").fill(
    "SCN SYNTHETIC SECOND RETRY TEST - NOT AN ACTUAL INSPECTION",
  );
  j.intent = "new distinct Inspection visit with deliberately lost real reply";
  save();
  await s.fault({
    failPath: `/equipment/${j.asset_id}/maintenance`,
    failMethod: "POST",
    once: true,
  });
  await c("em-visit-submit-btn").click();
  await expect(c("em-retry-original")).toBeEnabled();
  await expect(c("em-visit-findings")).toBeDisabled();
  await s.p.keyboard.press("Control+,");
  await expect(s.p.locator(".equipment-maintenance-screen")).toBeVisible();
  await c("em-retry-original").click();
  await expect(c("em-retry-original")).not.toBeVisible();
  d = await detail();
  assert.equal(d.records.filter((r) => r.kind === "Inspection").length, 1);
  const posts = (await s.trace()).requests.filter(
    (r) =>
      r.method === "POST" &&
      r.path.endsWith(`/equipment/${j.asset_id}/maintenance`) &&
      r.body?.kind === "Inspection",
  );
  assert.equal(posts.length, 2);
  assert.equal(posts[0].key, posts[1].key);
  assert.deepEqual(posts[0].body, posts[1].body);
  assert.equal(posts[1].replay, "true");
  j.checks.push(
    "New real Inspection commit/reply loss: input lock, keyboard-navigation guard and visible original retry. Same key/body receives Idempotent-Replay; exactly one Inspection.",
  );
  save();
  const stats = await s.native("api", {
    method: "GET",
    path: "/facility/maintenance/statistics",
  });
  await c("em-edit-plan-btn").first().click();
  await c("em-plan-due-date").fill(
    new Date(Date.now() - (stats.grace_days + 2) * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  await c("em-plan-edit-reason").fill(
    "SCN SYNTHETIC due date beyond configured grace",
  );
  await c("em-plan-submit-btn").click();
  await expect(c("em-plan-submit-btn")).not.toBeVisible();
  await c("em-detail-record-visit-btn").click();
  await c("em-visit-kind").selectOption("PreventiveMaintenance");
  await c("em-visit-result").selectOption("Pass");
  await c("em-visit-staff-select").selectOption(String(original.employee_id));
  await c("em-visit-findings").fill(
    "SCN SYNTHETIC RETURN TEST - NOT A REAL RELEASE",
  );
  await c("em-visit-return-service").check();
  j.intent = "passing visit and explicit return to service";
  save();
  await c("em-visit-submit-btn").click();
  await expect(c("em-visit-submit-btn")).not.toBeVisible();
  d = await detail();
  assert.equal(d.status, "Active");
  assert.equal(d.records.length, 4);
  assert.equal(
    d.records.find((r) => r.kind === "PreventiveMaintenance").on_time,
    false,
  );
  assert(d.plans[0].next_due > new Date().toISOString().slice(0, 10));
  await c("em-edit-plan-btn").first().click();
  await c("em-plan-active").uncheck();
  await c("em-plan-edit-reason").fill(
    "SCN SYNTHETIC test plan ended after review",
  );
  await c("em-plan-submit-btn").click();
  await expect(c("em-plan-submit-btn")).not.toBeVisible();
  d = await detail();
  assert.equal(d.plans[0].is_active, false);
  j.checks.push(
    "Passing late visit explicitly restores Active and advances plan; audited plan end persists, immutable visits retained.",
  );
  j.passed = true;
  j.final = d;
  save();
  s.j.passed = true;
  s.save();
  console.log(
    JSON.stringify({ asset_id: j.asset_id, checks: j.checks }, null, 2),
  );
} catch (error) {
  j.error = error.stack;
  if (s) j.trace = await s.trace();
  save();
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}

```
