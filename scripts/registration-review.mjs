import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve("artifacts/registration-profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.getByLabel("Username", { exact: true }).fill("demo.reception");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New registration + OPD slip" })
    .click();
  const evidence = JSON.parse(
    fs.readFileSync("artifacts/registration-check.json", "utf8"),
  );
  const ticket = evidence.evidence.find((x) => x.startsWith("OPD-"));
  await page.getByLabel("Open an existing OPD slip").fill(ticket);
  await page.getByRole("button", { name: "Open ticket", exact: true }).click();
  await page.getByRole("heading", { name: "OPD slip issued" }).waitFor();
  await page
    .getByRole("button", { name: "Patient photo", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .locator("img")
    .evaluate((i) => i.decode());
  assert.equal(
    await page
      .getByRole("dialog")
      .locator("img")
      .evaluate((i) => i.naturalWidth),
    160,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() =>
    window.terminal.call("prefs", { language: "ur", ui_scale_pct: 250 }),
  );
  await page
    .getByRole("heading", {
      name: "نئی رجسٹریشن اور او پی ڈی پرچی",
      exact: true,
    })
    .waitFor();
  await page.screenshot({
    path: "artifacts/registration-urdu-250.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    window.terminal.call("prefs", { language: "en", ui_scale_pct: 100 }),
  );
  await page
    .getByRole("button", { name: "Start another registration", exact: true })
    .click();
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Codex Demo Panel Intake ${Date.now()}`);
  await page.getByLabel("Date of birth", { exact: true }).fill("1990-01-01");
  await page.getByLabel("Mobile", { exact: true }).fill("03001234567");
  await page.getByLabel("Father / husband name").fill("Synthetic guardian");
  await page.getByLabel("Address", { exact: true }).fill("Demo address");
  await page.getByLabel("Emergency contact name").fill("Synthetic contact");
  await page.getByLabel("Emergency contact phone").fill("03007654321");
  await page
    .getByLabel("Allergies (not recorded if blank)")
    .fill("Synthetic test entry");
  await page.getByLabel("Billing category").selectOption("Panel");
  await page.getByLabel("Panel", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Panel member number").fill("DEMO-MEMBER");
  await page.getByLabel("Patient record only — no OPD visit").check();
  await page
    .getByRole("button", { name: "Register patient only", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Patient registered", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/registration-panel-intake.png",
    fullPage: true,
  });
  const patientText = await page.getByRole("status").first().textContent();
  await page
    .getByRole("button", { name: "Start another registration", exact: true })
    .click();
  await page.getByLabel("Open an existing OPD slip").fill("OPD-2026-000006");
  await page.getByRole("button", { name: "Open ticket", exact: true }).click();
  await page
    .getByRole("heading", { name: "OPD slip issued", exact: true })
    .waitFor();
  await page.getByLabel("Waiver percent").fill("50");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic DEMO waiver workflow verification");
  await page
    .getByRole("button", { name: "Request VIP waiver", exact: true })
    .click();
  await page
    .getByText("Waiver request sent for approval.", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/registration-waiver.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/registration-review.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "stored photo download",
          "Urdu 250% screenshot",
          "full optional intake",
          "panel billing",
          "patient-only registration",
          "waiver request",
        ],
        patient: patientText,
      },
      null,
      2,
    ),
  );
  console.log(
    "Registration review: stored photo, Urdu, optional intake, panel billing, patient-only record and VIP waiver passed.",
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/registration-review-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await page
    .evaluate(() =>
      window.terminal.call("prefs", { language: "en", ui_scale_pct: 100 }),
    )
    .catch(() => {});
  await page
    .evaluate(() => window.terminal.call("logout", { all: false }))
    .catch(() => {});
  await app.close();
}
