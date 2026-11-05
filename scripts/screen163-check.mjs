// Operates only the fresh synthetic fixture saved by this session's sandbox_call.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { session, expect, capture, help } from "./clinical-test-kit.mjs";
const fixture = JSON.parse(
  fs.readFileSync("docs/screen163-2026-11-05/review-a-valid-result.json"),
).body.data;
const file = "artifacts/screen163-journey.json";
assert(
  !fs.existsSync(file),
  "Reconcile the original journey before retrying any writes.",
);
const j = {
  started: new Date().toISOString(),
  incident_id: fixture.incident_id,
  checks: [],
  pending: null,
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
try {
  s = await session("screen163-investigator", "demo.nurse");
  s.p.on("dialog", (d) => d.accept());
  j.renderer = s.j.renderer;
  save();
  await s.p
    .getByRole("navigation")
    .locator('[data-screen-target="my_investigations"]')
    .click();
  const root = s.p.locator('[data-screen="my_investigations"]'),
    c = (id, tag = "") => root.locator(`${tag}[data-help="mi.${id}"]`);
  await root
    .getByRole("row")
    .filter({ hasText: fixture.incident_number })
    .getByRole("button", { name: "Open investigation", exact: true })
    .click();
  await expect(root).toContainText(fixture.description);
  await c("sign", "button").click();
  await c("confirm", "input").check();
  j.pending = "Expected initial incomplete-sign refusal";
  save();
  await c("submit", "button").click();
  await expect(root).toContainText("INCIDENT_ANALYSIS_INCOMPLETE");
  j.pending = null;
  save();
  await c("cancel", "button").click();
  await c("analysis", "button").click();
  await c("method", "select").selectOption("Review");
  await help(s, c("method", "select"), "Incidents I investigate");
  for (const [name, text] of Object.entries({
    chronology:
      "SYNTHETIC ONLY: test preparation, simulated gap noticed, tabletop review completed.",
    root_causes:
      "SYNTHETIC ONLY: process training gap; no individual blame or actual event.",
    lessons:
      "SYNTHETIC ONLY: verify process training and accountable follow-up.",
  }))
    await root.locator('textarea[name="' + name + '"]').fill(text);
  await root
    .locator("label")
    .filter({ hasText: "Individual" })
    .locator('input[type="checkbox"]')
    .check();
  await c("disclosure", "select").selectOption("NotApplicable");
  await c("confirm", "input").check();
  const savePath = `/incidents/${fixture.incident_id}/analysis`;
  j.pending =
    "Draft PUT committed reply deliberately dropped; no replay permitted";
  save();
  await s.fault({ failPath: savePath, failMethod: "PUT", once: true });
  await c("submit", "button").click();
  await expect(
    root.getByRole("button", { name: "Read current result", exact: true }),
  ).toBeEnabled();
  await expect(
    root.getByRole("button", { name: "Retry original request", exact: true }),
  ).toHaveCount(0);
  await expect(c("method", "select")).toBeDisabled();
  await s.p.keyboard.press("Control+,");
  await expect(root).toBeVisible();
  await root
    .getByRole("button", { name: "Read current result", exact: true })
    .click();
  await root
    .getByRole("button", {
      name: "Result reviewed; return to draft",
      exact: true,
    })
    .click();
  await expect(c("compare", "button")).toBeVisible();
  j.pending = null;
  save();
  await c("cancel", "button").click();
  await c("sign", "button").click();
  await c("confirm", "input").check();
  j.pending = "Expected sentinel method/system-factor refusal";
  save();
  await c("submit", "button").click();
  await expect(root).toContainText("INCIDENT_ANALYSIS_INCOMPLETE");
  j.pending = null;
  save();
  await c("cancel", "button").click();
  await c("analysis", "button").click();
  await c("method", "select").selectOption("RootCauseAnalysis");
  await root
    .locator("label")
    .filter({ hasText: "Training" })
    .locator('input[type="checkbox"]')
    .check();
  await c("confirm", "input").check();
  j.pending = "Valid analysis draft save";
  save();
  await c("submit", "button").click();
  await expect(c("submit", "button")).toHaveCount(0);
  j.pending = null;
  save();
  await c("sign", "button").click();
  await c("confirm", "input").check();
  j.pending = "Final business analysis signature";
  save();
  await c("submit", "button").click();
  await expect(c("submit", "button")).toHaveCount(0);
  await expect(root).toContainText("Analysed");
  await expect(c("analysis", "button")).toBeDisabled();
  j.pending = null;
  save();
  await c("action", "button").click();
  await c("action-description", "textarea").fill(
    "SYNTHETIC ONLY: confirm process training checklist, no actual operational task.",
  );
  const owner = root
    .locator(".directory-picker")
    .filter({ has: s.p.locator('input[data-help="mi.owner"]') });
  await owner.locator("input").fill("Hina");
  await owner
    .getByRole("button", { name: "Find by name", exact: true })
    .click();
  const option = owner.locator("option").filter({ hasText: "Nurse Hina" });
  await expect(option).toHaveCount(1);
  const ownerId = await option.getAttribute("value"),
    me = await s.native("api", { method: "GET", path: "/auth/me" });
  assert.equal(Number(ownerId), me.user_id);
  await owner.locator("select").selectOption(ownerId);
  const depts = root.locator('select[data-help="mi.department"]');
  await expect(depts.locator("option")).not.toHaveCount(1);
  await depts.selectOption(
    await depts.locator('option:not([value=""])').first().getAttribute("value"),
  );
  await c("due", "input").fill("2026-11-12");
  await c("confirm", "input").check();
  await help(s, c("action-description", "textarea"), "Incidents I investigate");
  j.pending =
    "Idempotent action committed reply dropped; original-key retry required";
  save();
  const actionPath = `/incidents/${fixture.incident_id}/actions`;
  await s.fault({ failPath: actionPath, failMethod: "POST", once: true });
  await c("submit", "button").click();
  await expect(
    root.getByRole("button", { name: "Retry original request", exact: true }),
  ).toBeEnabled();
  await root
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  await expect(c("submit", "button")).toHaveCount(0);
  const current = await s.native("api", {
    method: "GET",
    path: `/incidents/${fixture.incident_id}`,
  });
  assert.equal(current.actions.length, 1);
  assert.equal(current.actions[0].owner_user_id, me.user_id);
  assert.equal(current.analysis_method, "RootCauseAnalysis");
  assert(current.analysis_stamp);
  j.current = current;
  j.pending = null;
  const writes = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path.endsWith(actionPath),
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].key, writes[1].key);
  assert.deepEqual(writes[0].body, writes[1].body);
  assert.equal(writes[1].replay, "true");
  j.action_requests = writes.map((r) => ({
    key: r.key,
    body: r.body,
    status: r.status,
    replay: r.replay,
    request_id: r.result.request_id,
  }));
  save();
  const viewers = () => s.app.windows();
  await c("pdf", "button").filter({ hasText: "View / print report" }).click();
  await expect.poll(() => viewers().length).toBe(2);
  await viewers()
    .find((w) => w !== s.p)
    .close();
  const target = path.resolve("artifacts/screen163-incident.pdf");
  await s.app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  }, target);
  await c("pdf", "button").filter({ hasText: "Save report PDF" }).click();
  await expect.poll(() => fs.existsSync(target)).toBe(true);
  assert.equal(fs.readFileSync(target).subarray(0, 5).toString(), "%PDF-");
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await c("pdf", "button").filter({ hasText: "Save report PDF" }).click();
  await expect(root).toContainText("PDF save cancelled.");
  await capture(s, "my_investigations");
  j.checks.push(
    "Assigned incident read, initial/incomplete sentinel signing refusals, draft save committed reply loss with reread-only reconciliation/no replay, final RCA with system factor and immutable signature, named owner user_id + active department, idempotent action lost-answer exact-key/body replay with one effect, official native PDF preview/save/cancel, F1/focus and ENUR/themes250bounds.",
  );
  j.passed = true;
  s.j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  throw e;
} finally {
  if (s) await s.close();
}
