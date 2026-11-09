import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { capture, expect, help, session } from "./clinical-test-kit.mjs";

const dir = "docs/phase-p9b-2026-11-09";
const fixture = (language) => {
  const result = JSON.parse(fs.readFileSync(`${dir}/195-draft-${language}-result.json`, "utf8"));
  assert.equal(result.status, 201);
  assert.equal(result.result.status, "Draft");
  return result.result;
};
const english = fixture("English");
const urdu = fixture("Urdu");

for (const [position, screen, account, workspace] of [
  [195, "consent_register", "demo.quality", undefined],
  [196, "consent_register_owner", "demo.owner", "Owner / Hospital Admin"],
]) {
  const s = await session(`p9b${position}`, account, workspace);
  try {
    const title = "Consent register and statistics";
    await s.p.getByRole("navigation").locator(`[data-screen-target="${screen}"]`).click();
    const root = s.p.locator(`[data-screen="${screen}"]`);
    const button = (name) => root.getByRole("button", { name, exact: true });
    const row = (record) => root.getByRole("row").filter({ hasText: record.number });
    const paper = root.getByRole("region", { name: "Printed consent form", exact: true });
    await expect(row(english)).toBeVisible();
    await expect(row(urdu)).toBeVisible();
    const category = root.getByLabel("Category", { exact: true });
    const state = root.getByLabel("Status", { exact: true });
    await category.selectOption("Procedure");
    await state.selectOption("Draft");
    const unscanned = root.getByRole("checkbox", { name: "Signed forms still to scan", exact: true });
    await unscanned.check();
    await expect(root).toContainText("No consents match these filters.");
    await unscanned.uncheck();
    const openEnglish = row(english).getByRole("button", { name: "Open consent", exact: true });
    await openEnglish.click();
    await help(s, openEnglish, title);
    await button("Preview printed form").click();
    await expect(paper).toHaveAttribute("dir", "ltr");
    await expect(paper).toContainText("SYNTHETIC register verification English");
    await button("Preview consent PDF").click();
    await expect(root).toContainText("PDF opened.");
    for (const page of s.app.windows()) if (page !== s.p && page.url().startsWith("data:application/pdf")) await page.close();

    await row(urdu).getByRole("button", { name: "Open consent", exact: true }).click();
    await button("Preview printed form").click();
    await expect(paper).toHaveAttribute("dir", "rtl");
    await expect(button("Preview consent PDF")).toHaveCount(0);
    const filename = path.resolve(`artifacts/p9b/${position}-rtl-${Date.now()}.pdf`);
    await s.app.evaluate(({ dialog }, filename) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename }); }, filename);
    await button("Save terminal consent PDF").click();
    await expect(root).toContainText("Consent PDF saved.");
    assert.equal(fs.readFileSync(filename).subarray(0, 5).toString(), "%PDF-");
    await button("Close consent").click();

    const statistics = root.locator("article").filter({ has: s.p.getByRole("heading", { name: "Consent statistics", exact: true }) });
    await expect(statistics).toContainText("MSDS 72");
    await expect(statistics).toContainText("No applicable records");
    await expect(statistics.getByRole("heading", { name: "By decision maker" })).toBeVisible();
    await help(s, statistics.locator('input[name="date_from"]'), title);
    await capture(s, screen, () => expect(root).toBeVisible());

    const trace = await s.trace();
    assert(trace.requests.every((entry) => entry.method === "GET"));
    const operations = trace.requests.filter((entry) => /\/consents?(?:[/?]|-statistics)/.test(entry.path));
    for (const suffix of [`/consents/${english.id}`, `/consents/${english.id}/pdf`, `/consents/${urdu.id}/print-payload`]) {
      assert(operations.some((entry) => entry.path.endsWith(suffix) && entry.status === 200), suffix);
    }
    assert(operations.some((entry) => entry.path.includes("/consent-statistics?") && entry.status === 200));
    assert(operations.some((entry) => entry.path.includes("unscanned=true") && entry.status === 200));
    fs.writeFileSync(`${dir}/${position}-journey.json`, JSON.stringify({
      passed: true, account, screen, renderer: s.j.renderer, pdf_bytes: fs.statSync(filename).size,
      fixture: [english, urdu],
      requests: operations.map((entry) => ({ path: entry.path, status: entry.status, request_id: entry.result?.request_id })),
    }, null, 2) + "\n");
    s.j.passed = true;
    s.pass("Consent register filters, immutable detail, English server PDF, Urdu terminal PDF, statistics, scoped F1 and bilingual 250% layout.");
  } catch (error) {
    s.j.error = error.stack;
    throw error;
  } finally {
    await s.close();
  }
}
