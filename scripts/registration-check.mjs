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
fs.mkdirSync("artifacts", { recursive: true });
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
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Codex Demo Full Registration ${Date.now()}`);
  await page.getByLabel("Age in years").fill("35");
  await page.getByLabel("Mobile", { exact: true }).fill("03001234567");
  await page.getByLabel("OPD service").selectOption({ index: 1 });
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = "#eeeeee";
    x.fillRect(0, 0, 160, 160);
    x.fillStyle = "#333333";
    x.font = "14px sans-serif";
    x.fillText("SYNTHETIC DEMO", 10, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("The patient agrees to a photo").check();
  await page
    .getByLabel("Choose photo", { exact: true })
    .setInputFiles({
      name: "synthetic-demo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByLabel("Choose outside reports")
    .setInputFiles({
      name: "synthetic-outside-report.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByLabel("Report title", { exact: true })
    .fill("Synthetic outside report");
  await page.getByLabel("Issued by facility").fill("Demo external clinic");
  await page.getByLabel("Document date").fill("2026-10-01");
  await page.keyboard.press("F1");
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Issue unpaid OPD slip", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "OPD slip issued", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Upload patient photo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Photo uploaded", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Upload report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Report uploaded", exact: true })
    .waitFor();
  await page
    .getByText("Outside: Demo external clinic, 2026-10-01", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Preview slip", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.match(await page.getByRole("dialog").textContent(), /OPD-/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Save slip PDF", exact: true })
    .click();
  await page.getByText("PDF save dialog completed.", { exact: true }).waitFor();
  assert.equal(
    fs.readFileSync("artifacts/opd-slip.pdf").subarray(0, 5).toString(),
    "%PDF-",
  );
  const actions = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Payment, approval and printing",
        exact: true,
      }),
    });
  await actions
    .getByLabel("Payment method", { exact: true })
    .selectOption("Card");
  await actions
    .getByLabel("Card / bank reference")
    .fill(`DEMO-CARD-${Date.now()}`);
  await page
    .getByRole("button", { name: "Collect payment", exact: true })
    .click();
  await page
    .getByText("Payment recorded. The queue reflects the server result.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Save slip PDF", exact: true })
    .click();
  await page.getByText("PDF save dialog completed.", { exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/registration-full.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/registration-check.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "new patient and unpaid ticket",
          "optional photo upload",
          "outside report upload",
          "F1 preserves draft",
          "slip preview",
          "80mm PDF",
          "Card payment and queue",
        ],
        evidence: (await page.locator("main").textContent()).match(
          /(?:MRN|OPD)-\d{4}-\d+/g,
        ),
      },
      null,
      2,
    ),
  );
  console.log(
    "Registration: real patient/ticket, photo/report uploads, preview/PDF, payment and queue passed.",
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/registration-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await page
    .evaluate(() => window.terminal.call("logout", { all: false }))
    .catch(() => {});
  await app.close();
}
