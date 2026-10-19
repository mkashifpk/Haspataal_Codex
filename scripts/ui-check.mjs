import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
fs.mkdirSync("artifacts", { recursive: true });
const environment = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve("artifacts/test-profile"),
};
delete environment.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env: environment });
const page = await app.firstWindow();
await page.setViewportSize({ width: 1400, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page
    .getByRole("heading", { name: "Sign in to your workspace" })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/login.png", fullPage: true });
  await page.getByLabel("Username", { exact: true }).fill("demo.owner");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page
    .getByRole("heading", { name: "Where are you working today?" })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/workspaces.png", fullPage: true });
  const owner = page.locator(".workspace-card").filter({
    has: page.getByRole("heading", {
      name: "Owner / Hospital Admin",
      exact: true,
    }),
  });
  await owner
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  await page.getByText("READY FOR YOUR NEXT TASK").waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Your display preferences" })
    .waitFor();
  await page.keyboard.press("F1");
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: "artifacts/help.png", fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (let i = 0; i < 20; i++) await page.keyboard.press("Control+-");
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(() =>
      window.terminal.call("state").then((r) => r.data.prefs.ui_scale_pct),
    ),
    100,
  );
  await page
    .getByLabel("Theme", { exact: false })
    .selectOption("DarkHighContrast");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/settings-dark.png",
    fullPage: true,
  });
  await page.getByLabel("Language", { exact: false }).selectOption("ur");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/settings-urdu.png",
    fullPage: true,
  });
  await page
    .locator("label", { hasText: /Language|زبان/ })
    .locator("select")
    .selectOption("en");
  await page
    .locator("label", { hasText: /Theme|تھِیم/ })
    .locator("select")
    .selectOption("Light");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Facility & services", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Facility profile & services" })
    .waitFor();
  await page
    .getByRole("heading", { name: "Services", exact: true })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/facility.png", fullPage: true });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Report an incident", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Report an incident", exact: true })
    .waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/incident.png", fullPage: true });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Approvals", exact: false })
    .click();
  await page.getByRole("heading", { name: "Approvals", exact: true }).waitFor();

  // Test Receptionist role and My cash shift
  await page.locator(".avatar").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Sign in to your workspace" })
    .waitFor({ timeout: 15000 });
  await page.getByLabel("Username", { exact: true }).fill("demo.reception");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();

  const cardOrShell = await Promise.race([
    page
      .getByRole("heading", { name: "Where are you working today?" })
      .waitFor({ timeout: 15000 })
      .then(() => "picker"),
    page
      .getByText("READY FOR YOUR NEXT TASK")
      .waitFor({ timeout: 15000 })
      .then(() => "shell"),
  ]);
  if (cardOrShell === "picker") {
    const recep = page.locator(".workspace-card").filter({
      has: page.getByRole("heading", { name: /Reception/i }),
    });
    await recep
      .getByRole("button", { name: "Open workspace →", exact: true })
      .click();
    await page.getByText("READY FOR YOUR NEXT TASK").waitFor();
  }

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My cash shift", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "My cash shift", exact: true })
    .waitFor({ timeout: 15000 });
  await page.keyboard.press("F1");
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: "artifacts/cash-shift-help.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "artifacts/cash-shift.png", fullPage: true });

  // Test Patient search (Screen 13)
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient search", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Patient search", exact: true })
    .waitFor({ timeout: 15000 });

  const searchInput = page.getByRole("searchbox", {
    name: "Patient search query",
  });
  await searchInput.fill("SCN");

  // Wait for debounced search results to arrive and click the first hit
  const hitCard = page.locator(".results-list .card[role='button']").first();
  await hitCard.waitFor({ timeout: 10000 });
  // Exercise rapid selection using real DEV responses.
  const cards = page.locator(".results-list .card[role='button']");
  if ((await cards.count()) >= 2) {
    const lastName = await cards.nth(1).locator("h4").first().textContent();
    for (let i = 0; i < 3; i++) {
      await cards.nth(0).click();
      await cards.nth(1).click();
    }
    await page.locator("article h2").filter({ hasText: lastName }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator("article h2").textContent(), lastName);
  }
  await hitCard.click();

  // Wait for patient profile card and inspect details
  await page
    .getByRole("button", { name: "View dues & invoices" })
    .waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "View dues & invoices" }).click();
  await page
    .getByRole("heading", { name: "Recent Invoices" })
    .waitFor({ timeout: 5000 });

  // Test F1 contextual help on Patient search
  await page.keyboard.press("F1");
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: "artifacts/patient-search-help.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/patient-search.png",
    fullPage: true,
  });

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New registration + OPD slip" })
    .click();
  await page
    .getByRole("heading", { name: "New registration + OPD slip" })
    .waitFor();
  await page.getByRole("button", { name: "Returning patient" }).click();
  await page.getByLabel("Search patient").fill("SCN");
  await page
    .locator(".results-list button")
    .first()
    .waitFor({ timeout: 10000 });
  await page.locator(".results-list button").first().click();
  await page.locator(".notice strong").waitFor();
  await page.getByRole("button", { name: "New patient" }).click();

  if (process.env.HASPATAAL_TEST_REGISTRATION === "1") {
    await page
      .getByLabel("Full name")
      .fill(`Codex Demo Registration ${Date.now()}`);
    await page.getByLabel("Age in years").fill("40");
    await page.getByLabel("Mobile").fill("03001234567");
    await page.getByLabel("OPD service").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Issue unpaid OPD slip" }).click();
    await page
      .getByRole("heading", { name: "OPD slip issued" })
      .waitFor({ timeout: 30000 });
    await page.screenshot({
      path: "artifacts/registration-issued.png",
      fullPage: true,
    });
  }

  assert.deepEqual(errors, []);
  console.log(
    "Electron UI: live login, workspace, settings, F1, zoom lower bound, themes, Urdu, facility, incident, my_cash_shift, and patient_search navigation passed.",
  );
} catch (err) {
  await page
    .screenshot({ path: "artifacts/error.png", fullPage: true })
    .catch(() => {});
  throw err;
} finally {
  await page
    .evaluate(() =>
      window.terminal.call("prefs", {
        language: "en",
        theme: "Light",
        ui_scale_pct: 100,
      }),
    )
    .catch(() => {});
  await page
    .evaluate(() => window.terminal.call("logout", { all: false }))
    .catch(() => {});
  fs.writeFileSync("artifacts/ui-errors.json", JSON.stringify(errors));
  await app.close();
}
