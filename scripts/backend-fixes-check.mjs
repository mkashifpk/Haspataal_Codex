import { terminalPage } from "./terminal-page.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve("artifacts/backend-fixes-profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
fs.mkdirSync("artifacts", { recursive: true });
const app = await electron.launch({ args: ["."], env });
const page = await terminalPage(app);
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function login(username) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
}
try {
  await page.getByLabel("Username", { exact: true }).waitFor();
  const live = await page.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/health/live" }),
  );
  assert(live.ok);
  assert.equal(live.data.status, "alive");
  await login("demo.reception");
  await page.getByText("READY FOR YOUR NEXT TASK", { exact: true }).waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Report an incident", exact: false })
    .click();
  await page.locator('select[name="affected"]').selectOption("Staff");
  await page.getByLabel("Staff member", { exact: true }).fill("Ahmed");
  await page
    .getByRole("button", { name: "Find staff member", exact: true })
    .click();
  await page
    .getByLabel("Select staff member", { exact: true })
    .selectOption("10");
  assert.match(
    await page.getByLabel("Select staff member", { exact: true }).textContent(),
    /Ahmed/,
  );
  await page.screenshot({
    path: "artifacts/incident-staff-fixed.png",
    fullPage: true,
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New registration + OPD slip" })
    .click();
  await page
    .getByLabel("Staff member (payroll link)", { exact: true })
    .fill("EMP-2026-0010");
  await page
    .getByRole("button", { name: "Find staff member", exact: true })
    .click();
  await page
    .getByLabel("Select staff member", { exact: true })
    .selectOption("10");
  assert.equal(
    await page.getByLabel("Select staff member", { exact: true }).inputValue(),
    "10",
  );
  await page.screenshot({
    path: "artifacts/registration-staff-fixed.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Approvals", exact: false })
    .click();
  await page
    .getByRole("checkbox", { name: "My requests", exact: true })
    .check();
  await page.locator(".list-row").first().click();
  await page.getByLabel("Decision note", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Approve", exact: true }).count(),
    0,
  );
  await page
    .getByLabel("Decision note", { exact: true })
    .fill("Read-only eligibility check; no cancellation");
  assert(
    await page
      .getByRole("button", { name: "Cancel request", exact: true })
      .isEnabled(),
  );
  await page.screenshot({
    path: "artifacts/approval-requester-fixed.png",
    fullPage: true,
  });
  await page.evaluate(() => window.terminal.call("logout", { all: false }));
  await login("demo.owner");
  await page
    .getByRole("heading", { name: "Where are you working today?" })
    .waitFor();
  const owner = page.locator(".workspace-card").filter({
    has: page.getByRole("heading", {
      name: "Owner / Hospital Admin",
      exact: true,
    }),
  });
  await owner
    .getByRole("button", { name: "Open workspace →", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Approvals", exact: false })
    .click();
  await page.locator(".list-row").first().click();
  await page.getByLabel("Decision note", { exact: true }).waitFor();
  assert(
    await page
      .getByRole("button", { name: "Approve", exact: true })
      .isEnabled(),
  );
  assert(
    await page
      .getByRole("button", { name: "Reject", exact: true })
      .isDisabled(),
  );
  await page
    .getByLabel("Decision note", { exact: true })
    .fill("Read-only eligibility check; no decision sent");
  assert(
    await page.getByRole("button", { name: "Reject", exact: true }).isEnabled(),
  );
  await page.screenshot({
    path: "artifacts/approval-decider-fixed.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/backend-fixes-check.json",
    JSON.stringify(
      {
        passed: true,
        writes: "No approval decisions, registrations or payments submitted",
        checks: [
          "public health envelope",
          "incident staff lookup as reception",
          "registration staff lookup as reception",
          "requester cannot approve but can cancel",
          "eligible owner can approve",
          "reject requires note",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Backend fixes: health, both staff pickers and real requester/decider approval controls passed without business writes.",
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/backend-fixes-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await page
    .evaluate(() => window.terminal.call("logout", { all: false }))
    .catch(() => {});
  await app.close();
}
