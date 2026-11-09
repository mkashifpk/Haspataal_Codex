import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const journalPath = "artifacts/p9b/197-journey.json";
assert(!fs.existsSync(journalPath), "Reconcile the original review cycle before using another write.");
const journal = { title: `SYNTHETIC review cycle ${Date.now()}`, pending: null, checks: [] };
const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
save();
const s = await session("p9b197", "demo.quality");
try {
  await s.p.getByRole("navigation").locator('[data-screen-target="record_review_cycles"]').click();
  const root = s.p.locator('[data-screen="record_review_cycles"]');
  const button = (name) => root.getByRole("button", { name, exact: true });
  const field = (name) => root.locator(`[name="${name}"]`);
  const reviewer = (name) => root.getByRole("checkbox", { name: new RegExp(name) });
  const open = async () => {
    const cycles = await s.native("api", { method: "GET", path: "/quality/record-reviews?limit=200" });
    const row = cycles.find((cycle) => cycle.title === journal.title);
    assert(row);
    return s.native("api", { method: "GET", path: `/quality/record-reviews/${row.cycle_id}` });
  };
  const submit = async (description) => {
    await field("confirmed").check();
    journal.pending = description;
    save();
    await button("Save review action").click();
  };
  const confirmed = async (description) => {
    await expect(root.getByRole("heading", { name: "Review this change" })).toHaveCount(0);
    journal.pending = null;
    journal.checks.push(description);
    save();
  };
  const schedule = await s.native("api", { method: "GET", path: "/quality/record-review/status" });
  await button("Plan review").click();
  if (schedule.next_due) {
    await expect(field("period_start")).toHaveValue(schedule.next_due.period_start);
    await expect(field("period_end")).toHaveValue(schedule.next_due.period_end);
  }
  await field("period_start").fill("2021-11-01");
  await field("period_end").fill("2021-11-02");
  await field("title").fill(journal.title);
  await expect(reviewer("Nurse Hina")).toHaveCount(0);
  await expect(reviewer("Ops Admin")).toHaveCount(0);
  await reviewer("Dr. Ahmed Khan").check();
  await reviewer("Head Nurse Farzana").check();
  await help(s, reviewer("Head Nurse Farzana"), "Record review cycles");
  await expect(reviewer("Head Nurse Farzana")).toBeChecked();
  await s.fault({ failPath: "/quality/record-reviews", failMethod: "POST", once: true });
  await submit("Plan the unique synthetic review, retaining its original request/key.");
  await expect(button("Retry original request")).toBeVisible();
  await button("Retry original request").click();
  await confirmed("Planned one cycle after original-key replay. Eligible Medical and Nursing were selected; ineligible staff were absent.");
  let cycle = await open();
  journal.cycle_id = cycle.cycle_id;
  journal.cycle_number = cycle.cycle_number;
  save();
  assert.equal(cycle.status, "Planned");
  assert.deepEqual(cycle.reviewers.map((row) => row.discipline).sort(), ["Medical", "Nursing"]);
  await expect(root).toContainText("No eligible records in the selected period.");
  await expect(button("Start review")).toBeDisabled();
  await button("Edit review panel").click();
  await reviewer("Dr. Farhan Qureshi").check();
  await submit("Replace the panel of this synthetic cycle only.");
  await confirmed("Added an eligible second doctor to the synthetic cycle’s panel.");
  cycle = await open();
  assert.equal(cycle.reviewers.filter((row) => row.is_active).length, 3);
  await button("Cancel cycle").click();
  await field("reason").fill("SYNTHETIC test cycle ended without drawing any records.");
  await submit("Cancel this synthetic cycle. If the reply is lost, read only.");
  await confirmed("Cancelled the synthetic cycle with a reason; history remains readable.");
  cycle = await open();
  assert.equal(cycle.status, "Cancelled");
  assert.equal(cycle.items.length, 0);
  assert.equal(cycle.cancel_reason, "SYNTHETIC test cycle ended without drawing any records.");
  await expect(root).toContainText(cycle.cancel_reason);
  await capture(s, "record_review_cycles", () => expect(root).toBeVisible());

  const operations = (await s.trace()).requests.filter((row) => /\/quality\/record-review/.test(row.path));
  const creates = operations.filter((row) => row.method === "POST" && row.path.endsWith("/record-reviews"));
  assert.equal(creates.length, 2);
  assert.equal(creates[0].key, creates[1].key);
  assert.deepEqual(creates[0].body, creates[1].body);
  assert.equal(creates[0].result.data.cycle_id, creates[1].result.data.cycle_id);
  assert.equal(operations.filter((row) => row.method === "PUT").length, 1);
  assert.equal(operations.filter((row) => row.method === "POST" && row.path.endsWith("/cancel")).length, 1);
  assert(operations.some((row) => row.path.endsWith("/sample-plan") && row.status === 200));
  journal.operations = operations.map((row) => ({
    method: row.method, path: row.path, status: row.status, request_id: row.result?.request_id,
    key: row.key, body: row.body, reply_lost: row.reply_lost, replay: row.replay,
  }));
  journal.renderer = s.j.renderer;
  journal.passed = true;
  save();
  s.j.passed = true;
  s.pass("Review schedule, eligible panel, original-key planning, server sampling preview, panel replacement, cancellation, F1 and bilingual 250% layout.");
} catch (error) {
  journal.error = error.stack;
  s.j.error = error.stack;
  save();
  throw error;
} finally {
  await s.close();
}
