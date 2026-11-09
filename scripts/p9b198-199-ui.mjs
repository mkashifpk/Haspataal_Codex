import assert from "node:assert/strict";
import fs from "node:fs";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

for (const [position, id, account] of [
  [198, "record_review_worklist_doctor", "demo.doctor"],
  [199, "record_review_worklist_nursing", "demo.headnurse"],
]) {
  const s = await session(`p9b${position}`, account);
  try {
    await s.p.getByRole("navigation").locator(`[data-screen-target="${id}"]`).click();
    const root = s.p.locator(`[data-screen="${id}"]`);
    await expect(root.getByRole("heading", { name: "Assigned records", exact: true })).toBeVisible();
    await expect(root).toContainText("You have no records in this worklist.");
    const history = root.getByRole("checkbox", { name: "Include reviewed records", exact: true });
    await history.check();
    await expect.poll(async () => (await s.trace()).requests.some((r) =>
      r.path.includes("/record-review-items/mine?include_reviewed=true") && r.status === 200,
    )).toBe(true);
    await history.uncheck();
    const active = root.getByRole("button", { name: "Show active criteria", exact: true });
    await help(s, active, "My record reviews");
    await active.click();
    await expect(root.getByRole("button", { name: "Hide active criteria", exact: true })).toBeVisible();
    const catalogue = await s.native("api", { method: "GET", path: "/quality/record-review/criteria?active_only=true" });
    assert(catalogue.length > 0);
    await expect(root).toContainText(catalogue[0].title);
    await expect(root.getByRole("button", { name: "Submit final review", exact: true })).toHaveCount(0);
    await capture(s, id, () => expect(root).toBeVisible());
    const trace = await s.trace();
    assert(trace.requests.every((entry) => entry.method === "GET"));
    const reads = trace.requests.filter((entry) => /\/quality\/record-review/.test(entry.path));
    assert(reads.some((entry) => entry.path.includes("/criteria?active_only=true") && entry.status === 200));
    assert(!reads.some((entry) => /record-review-items\/\d+$/.test(entry.path)));
    fs.writeFileSync(`docs/phase-p9b-2026-11-09/${position}-journey.json`, JSON.stringify({
      passed: true, account, screen: id, renderer: s.j.renderer, active_criteria: catalogue.length,
      requests: reads.map((entry) => ({ path: entry.path, status: entry.status, request_id: entry.result?.request_id })),
      limits: "Empty assigned list and active criteria tested. No assigned sample or final review was used.",
    }, null, 2) + "\n");
    s.j.passed = true;
    s.pass("Role-scoped reviewer worklist, empty state, reviewed filter, live criteria, F1 and bilingual 250% layout.");
  } catch (error) {
    s.j.error = error.stack;
    throw error;
  } finally {
    await s.close();
  }
}
