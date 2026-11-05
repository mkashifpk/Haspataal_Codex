// Real DEV, synthetic equipment only. Never re-run a missing write result.
// Reconcile the saved tag/asset and transport journal before retrying this test.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const ops = process.argv.includes("--ops");
const file = ops
  ? "artifacts/continuation-20261104/equipment-write-ops.json"
  : "artifacts/continuation-20261104/equipment-write.json";
assert(
  !fs.existsSync(file),
  "Reconcile the existing equipment write journal before rerun",
);
const j = {
  started: new Date().toISOString(),
  tag: "SCN1104EQ-" + Date.now().toString(36),
  stage: "intent",
  checks: [],
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
try {
  s = await session(
    ops ? "resume1104-equipment-write-ops" : "resume1104-equipment-write",
    ops ? "demo.ops" : "demo.maintenance",
  );
  const c = (key) => s.p.locator(`[data-help="${key}"]`);
  const detail = () =>
    s.native("api", {
      method: "GET",
      path: `/facility/equipment/${j.asset_id}`,
    });
  const stats = await s.native("api", {
    method: "GET",
    path: "/facility/maintenance/statistics",
  });
  const today = new Date().toISOString().slice(0, 10),
    yesterday = new Date(Date.now() - (stats.grace_days + 2) * 86400000)
      .toISOString()
      .slice(0, 10);
  await s.nav("Medical equipment and maintenance");
  await c("em-onboard-btn").click();
  await c("em-onboard-tag").fill(j.tag);
  await c("em-onboard-name").fill(j.tag + " SYNTHETIC NOT A REAL DEVICE");
  await c("em-onboard-category").fill("SyntheticTestOnly");
  j.stage = "asset-create-intent";
  save();
  await c("em-onboard-step1-btn").click();
  await c("em-onboard-maker").waitFor();
  const created = (await s.trace()).requests.find(
    (r) =>
      r.method === "POST" &&
      r.path.endsWith("/ops/assets") &&
      r.body?.asset_tag === j.tag,
  );
  assert.equal(created.status, 201);
  j.asset_id = created.result.data.asset_id;
  j.asset_create_key = created.key;
  j.stage = "asset-created";
  save();
  await c("em-onboard-maker").fill("SYNTHETIC TEST MANUFACTURER");
  await c("em-onboard-model").fill("NOT A CLINICAL DEVICE");
  await c("em-onboard-step2-btn").click();
  await c("em-onboard-interval").waitFor();
  await c("em-onboard-interval").fill("90");
  await c("em-onboard-plan-due").fill(yesterday);
  await c("em-onboard-plan-oem").fill(
    "SYNTHETIC TEST MANUAL; NOT AN ACTUAL OEM INSTRUCTION",
  );
  await c("em-onboard-step3-btn").click();
  await c("em-onboard-comm-findings").waitFor();
  await expect(c("em-onboard-comm-findings")).toHaveValue("");
  await c("em-onboard-comm-result").selectOption("Pass");
  await c("em-onboard-comm-date").fill(today);
  await expect
    .poll(() => c("em-onboard-comm-staff").locator("option").count())
    .toBeGreaterThan(1);
  const staff = await c("em-onboard-comm-staff")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  j.employee_id = Number(staff);
  save();
  await c("em-onboard-comm-staff").selectOption(staff);
  await c("em-onboard-comm-findings").fill(
    "SYNTHETIC TEST ONLY - NO ACTUAL EQUIPMENT INSPECTION",
  );
  await help(
    s,
    c("em-onboard-comm-findings"),
    "Medical equipment and maintenance",
  );
  j.stage = "commissioning-intent";
  save();
  await c("em-onboard-step4-btn").click();
  await c("em-detail-record-visit-btn").waitFor();
  let d = await detail();
  assert.equal(d.asset_tag, j.tag);
  assert.equal(d.commissioned_on, today);
  assert.equal(d.records.length, 1);
  assert.equal(d.plans.length, 1);
  j.plan_id = d.plans[0].plan_id;
  j.stage = "commissioned";
  save();
  j.checks.push(
    "Four real UI onboarding steps use one confirmed asset ID; no prefilled inspection success; commissioning read back once.",
  );

  // A second writer changes the plan after the first editor opened it.
  await c("em-edit-plan-btn").first().click();
  const originalVersion = d.plans[0].row_version;
  j.concurrent_intent = {
    method: "PUT",
    path: `/facility/maintenance-plans/${j.plan_id}`,
    body: {
      interval_days: 91,
      reason: "SCN SYNTHETIC concurrent writer",
      expected_version: originalVersion,
    },
  };
  save();
  await s.native("api", j.concurrent_intent);
  await c("em-plan-interval").fill("120");
  await c("em-plan-edit-reason").fill(
    "SCN SYNTHETIC stale editor must be refused",
  );
  await c("em-plan-submit-btn").click();
  await expect
    .poll(async () => {
      const t = await s.trace();
      return t.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith(`/maintenance-plans/${j.plan_id}`) &&
          r.status === 409 &&
          r.result?.error?.code === "VERSION_CONFLICT",
      );
    })
    .toBe(true);
  assert.equal((await detail()).plans[0].interval_days, 91);
  await c("em-plan-cancel").click();
  await c("em-edit-plan-btn").first().click();
  await expect(c("em-plan-interval")).toHaveValue("91");
  await c("em-plan-interval").fill("120");
  await c("em-plan-edit-reason").fill("SCN SYNTHETIC reviewed latest version");
  await c("em-plan-submit-btn").click();
  await expect(c("em-plan-submit-btn")).not.toBeVisible();
  d = await detail();
  assert.equal(d.plans[0].interval_days, 120);
  j.checks.push(
    "Stale UI expected_version refused409; cancel/reopen sees actual version and reviewed edit succeeds without overwrite.",
  );
  save();

  // Commit a real failing visit and lose its reply; replay must not append twice.
  await c("em-detail-record-visit-btn").click();
  await c("em-visit-kind").selectOption("Breakdown");
  await c("em-visit-date").fill(today);
  await c("em-visit-result").selectOption("Fail");
  await c("em-visit-staff-select").selectOption(staff);
  await c("em-visit-findings").fill(
    "SYNTHETIC FAILURE TEST - NO ACTUAL DEVICE OR CARE",
  );
  await expect(c("em-visit-return-service")).not.toBeChecked();
  j.stage = "failing-visit-lost-reply-intent";
  save();
  await s.fault({
    failPath: `/facility/equipment/${j.asset_id}/maintenance`,
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
  assert.equal(d.status, "OutOfService");
  assert.equal(d.records.filter((r) => r.kind === "Breakdown").length, 1);
  const calls = (await s.trace()).requests.filter(
    (r) =>
      r.method === "POST" &&
      r.path.endsWith(`/equipment/${j.asset_id}/maintenance`) &&
      r.body?.kind === "Breakdown",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(calls[1].replay, "true");
  j.checks.push(
    "Actual DEV visit commits, reply is lost, inputs/navigation lock, explicit original retry uses same key/body and server replay; one Fail visit and OutOfService.",
  );
  j.stage = "failing-visit-reconciled";
  save();

  // Explicit later passing planned work restores service and advances due date.
  await c("em-detail-record-visit-btn").click();
  await c("em-visit-kind").selectOption("PreventiveMaintenance");
  await c("em-visit-date").fill(today);
  await c("em-visit-result").selectOption("Pass");
  await c("em-visit-staff-select").selectOption(staff);
  await c("em-visit-findings").fill(
    "SYNTHETIC RESTORE TEST - NOT A REAL SERVICE RELEASE",
  );
  await c("em-visit-return-service").check();
  j.stage = "passing-visit-intent";
  save();
  await c("em-visit-submit-btn").click();
  await expect(c("em-visit-submit-btn")).not.toBeVisible();
  d = await detail();
  assert.equal(d.status, "Active");
  assert.equal(d.records.length, 3);
  assert.equal(
    d.records.find((r) => r.kind === "PreventiveMaintenance").on_time,
    false,
  );
  assert(d.plans[0].next_due > today);
  j.checks.push(
    "Actual passing planned visit with explicit Return to Service restores Active, records late/on_time=false and advances its plan.",
  );
  save();
  await c("em-edit-plan-btn").first().click();
  await c("em-plan-active").uncheck();
  await c("em-plan-edit-reason").fill(
    "SCN SYNTHETIC test plan ended after verification",
  );
  await c("em-plan-submit-btn").click();
  await expect(c("em-plan-submit-btn")).not.toBeVisible();
  d = await detail();
  assert.equal(d.plans[0].is_active, false);
  j.checks.push(
    "Plan ended through supported audited update; visits remain append-only.",
  );
  j.stage = "complete";
  j.passed = true;
  j.final = d;
  save();
  s.j.passed = true;
  s.save();
  console.log(
    JSON.stringify(
      { tag: j.tag, asset_id: j.asset_id, checks: j.checks },
      null,
      2,
    ),
  );
} catch (error) {
  j.error = error.stack;
  if (s) {
    try {
      j.trace = await s.trace();
      await s.p.screenshot({
        path: "artifacts/continuation-20261104/equipment-write-failure.png",
      });
    } catch {}
  }
  save();
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}
