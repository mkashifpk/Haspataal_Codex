import assert from "node:assert/strict";
import fs from "node:fs";
import { expect, help, session } from "./clinical-test-kit.mjs";

const evidence = "docs/phase-p9a-2026-11-06/nov9-closeout";
const read = (file) => JSON.parse(fs.readFileSync(`${evidence}/${file}.json`, "utf8"));
const { complaint_id: withdrawnId, complaint_number: withdrawnNumber } =
  read("56-58-create-result").body.data;
const journey = JSON.parse(fs.readFileSync("docs/phase-p9a-2026-11-06/nov9-tracking-journey.json", "utf8"));
const results = [];
async function check(account, checkScreen) {
  const s = await session(`p9a-closeout-${account}`, account);
  try {
    await checkScreen(s);
    const trace = await s.trace();
    assert(trace.requests.every((r) => r.method === "GET"));
    s.j.passed = true;
    results.push({
      account,
      checks: s.j.checks,
      requests: trace.requests.filter((r) =>
        /\/(complaints|incident-screening|quality\/actions|admin\/departments)(?:[/?]|$)/.test(r.path),
      ).map((r) => ({ path: r.path, status: r.status, request_id: r.result?.request_id })),
    });
  } catch (error) {
    s.j.error = error.stack;
    throw error;
  } finally {
    await s.close();
  }
}
const open = (s, id) => s.p.getByRole("navigation").locator(`[data-screen-target="${id}"]`).click();

await check("demo.reception", async (s) => {
  await open(s, "record_complaint_reception");
  const tracking = s.p.getByRole("heading", { name: "Track a complaint" }).locator("..");
  const input = tracking.locator('input[name="tracking_number"]');
  const find = tracking.getByRole("button", { name: "Find tracking card", exact: true });
  await input.fill("CMP-1999-99999");
  await find.click();
  await expect(tracking.getByRole("alert")).toContainText("No complaint has that tracking number.");
  await input.fill(journey.number.toLowerCase());
  await find.click();
  const card = tracking.getByRole("region", { name: "Complaint tracking card" });
  await expect(card).toContainText(journey.number);
  await expect(card.getByText("Appealed", { exact: true })).toHaveCount(0);
  await card.locator('input[data-help="ci.track-identity"]').check();
  await expect(card.getByText("Appealed", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Record appeal from tracking card" })).toHaveCount(0);
  await card.getByRole("button", { name: "Open permitted complaint" }).click();
  await expect.poll(async () => (await s.trace()).requests.some((r) =>
    r.path.endsWith(`/complaints/${journey.complaint_id}`) && r.status === 200,
  )).toBe(true);
  await help(s, input, "Record a complaint");
  s.pass("Missing-number copy, confirmed identity, open after the original appeal and contextual F1.");
});

await check("demo.quality", async (s) => {
  await open(s, "complaints_register");
  const register = s.p.locator('[data-screen="complaints_register"]');
  const row = (number) => register.getByRole("row").filter({ hasText: number });
  await row("CMP-2026-00008").getByRole("button", { name: "Open complaint", exact: true }).click();
  await expect.poll(async () => (await s.trace()).requests.some((r) =>
    r.path.endsWith("/complaints/9") && r.status === 200,
  )).toBe(true);
  await expect(register.locator('button[data-help="cqr.paper"]')).toHaveCount(0);
  await row(withdrawnNumber).getByRole("button", { name: "Open complaint", exact: true }).click();
  const preview = register.getByRole("button", { name: "Preview server PDF Acknowledgement", exact: true });
  await expect(preview).toBeEnabled();
  await expect(register.locator('button[data-help="cqr.paper"]')).toHaveCount(3);
  await preview.click();
  await expect(register).toContainText("Server PDF opened.");
  await expect.poll(async () => (await s.trace()).requests.some((r) =>
    r.path.endsWith(`/complaints/${withdrawnId}/letter/pdf?letter=Acknowledgement`) && r.status === 200,
  )).toBe(true);
  for (const page of s.app.windows()) {
    if (page !== s.p && page.url().startsWith("data:application/pdf")) await page.close();
  }
  await open(s, "incident_screening");
  const screening = s.p.locator('[data-screen="incident_screening"]');
  await help(s, screening.locator('input[data-help="isc.filter"]'), "Possible sentinel events: screening and reasoned decisions");
  await open(s, "action_register");
  const actions = s.p.locator('[data-screen="action_register"]');
  const department = actions.locator('select[data-help="acr.department"]');
  const option = department.locator("option").filter({ hasText: "General Medicine" });
  const departmentId = await option.getAttribute("value");
  assert(departmentId);
  await department.selectOption(departmentId);
  await actions.getByRole("button", { name: "Apply action filters", exact: true }).click();
  await expect(actions).toContainText("CAPA-2026-0016");
  await expect.poll(async () => (await s.trace()).requests.some((r) =>
    r.path.includes(`department_id=${departmentId}`) && r.status === 200,
  )).toBe(true);
  const establishment = await s.native("api", { method: "GET", path: "/establishment" });
  const home = establishment.views.screens.find((view) => view.screen_id === "home_visit_register");
  assert.equal(home?.view, "hidden");
  await expect(s.p.locator('[data-screen-target="home_visit_register"]')).toHaveCount(0);
  s.pass("Letter gating on both withdrawals, acknowledgement PDF, screening F1, named department filter and hidden home-visit gate.");
});

fs.writeFileSync(`${evidence}/native-read.json`, JSON.stringify(results, null, 2) + "\n");
