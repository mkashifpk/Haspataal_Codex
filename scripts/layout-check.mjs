import { terminalPage } from "./terminal-page.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve("artifacts/layout-profile"),
};
delete env.ELECTRON_RUN_AS_NODE;
fs.mkdirSync("artifacts", { recursive: true });
const app = await electron.launch({ args: ["."], env });
const page = await terminalPage(app);
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.getByLabel("Username", { exact: true }).fill("demo.reception");
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Patient search", exact: false })
    .click();
  await page
    .getByRole("searchbox", { name: "Patient search query" })
    .fill("Codex");
  await page.locator(".patient-result").first().waitFor();
  await page.locator(".patient-result").first().click();
  await page.locator("article h2").waitFor();
  const left = await page.locator(".patient-results").boundingBox();
  const right = await page.locator("article.card").boundingBox();
  assert(Math.abs(left.y - right.y) < 2);
  await page.screenshot({
    path: "artifacts/search-layout.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New registration + OPD slip" })
    .click();
  await page
    .getByRole("button", { name: "Returning patient", exact: true })
    .click();
  await page.getByLabel("Search patient").fill("Codex");
  await page.locator(".registration-results button").first().waitFor();
  const widths = await page
    .locator(".registration-results button")
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width));
  assert(widths.every((w) => Math.abs(w - widths[0]) < 1));
  await page
    .locator(".patient-photo-layout")
    .screenshot({ path: "artifacts/photo-layout.png" });
  await page.screenshot({
    path: "artifacts/registration-layout.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    window.terminal.call("prefs", { language: "ur", ui_scale_pct: 250 }),
  );
  await page
    .getByRole("heading", {
      name: "نئی رجسٹریشن اور او پی ڈی پرچی",
      exact: true,
    })
    .waitFor();
  await page
    .locator(".patient-photo-layout")
    .screenshot({ path: "artifacts/photo-layout-urdu-250.png" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Layout: aligned search results, full-width registration results, photo controls, Urdu 250% without horizontal overflow passed.",
  );
} catch (e) {
  await page.screenshot({ path: "artifacts/layout-error.png", fullPage: true });
  throw e;
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
