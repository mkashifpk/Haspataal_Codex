// Real DEV reads and local display preferences only. NEVER enter a review code.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import { terminalPage } from "./terminal-page.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const release = process.argv.includes("--release");
const checks = [];
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve(
    `artifacts/review-code-${release ? "release" : "dev"}-${Date.now()}`,
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [release ? "artifacts/release-terminal" : "."],
  env,
});
try {
  const page = await terminalPage(app);
  page.setDefaultTimeout(40000);
  await page.getByLabel("Username", { exact: true }).waitFor();
  await expect(page.getByLabel("Review code", { exact: true })).toHaveCount(0);
  await page.getByTitle("This terminal", { exact: true }).click();
  await expect(page.getByLabel("Review code", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .locator(".settings-nav button")
    .filter({ hasText: "This terminal: its location and printers" })
    .click();
  if (release) {
    await expect(page.getByLabel("Review code", { exact: true })).toHaveCount(
      0,
    );
    const reply = await page.evaluate(() => window.terminal.call("dev-review"));
    assert.equal(reply.ok, false);
    checks.push(
      "release has no field and refuses DEV review IPC even in an unpackaged process with DEV configuration",
    );
  } else {
    const input = page.getByLabel("Review code", { exact: true });
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Apply review code", exact: true }),
    ).toBeDisabled();
    assert.deepEqual(
      await page.evaluate(() =>
        window.terminal.call("dev-review").then((r) => r.data),
      ),
      { code: "" },
    );
    // Only exercise clearing an already-empty value; never supply a code.
    assert(
      (
        await page.evaluate(() =>
          window.terminal.call("dev-review", { code: "" }),
        )
      ).ok,
    );
    await input.focus();
    await page.keyboard.press("F1");
    await expect(page.locator(".help-article")).toContainText(
      "Agents and automated tests must never enter a code.",
    );
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    checks.push(
      "exactly one empty field before login; apply disabled until edited; empty clear IPC; public F1 and focus restoration",
    );
    for (const language of ["en", "ur"])
      for (const theme of ["Light", "DarkHighContrast"]) {
        assert(
          (
            await page.evaluate(
              (prefs) => window.terminal.call("prefs", prefs),
              { language, theme, ui_scale_pct: 250 },
            )
          ).ok,
        );
        const field = page.getByLabel(
          language === "ur" ? "جائزے کا کوڈ" : "Review code",
          { exact: true },
        );
        await expect(field).toHaveValue("");
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await field.focus();
        await page.keyboard.press("F1");
        await expect(page.locator(".help-article")).toContainText(
          language === "ur"
            ? "جائزے کا کوڈ (صرف ڈیَو)"
            : "Review code (DEV only)",
        );
        await page.keyboard.press("Escape");
        await expect(field).toBeFocused();
      }
    assert(
      (
        await page.evaluate(() =>
          window.terminal.call("prefs", {
            language: "en",
            theme: "Light",
            ui_scale_pct: 100,
          }),
        )
      ).ok,
    );
    checks.push(
      "English/Urdu and both themes at250%, local preferences reset, no code populated",
    );
  }
  // Observe the actual transport without replacing responses or recording credentials.
  await app.evaluate(() => {
    globalThis.reviewHeaderEvidence = [];
    for (const protocol of ["node:https", "node:http"]) {
      const transport = process.getBuiltinModule(protocol),
        original = transport.request;
      transport.request = function (...args) {
        const request = original.apply(this, args);
        globalThis.reviewHeaderEvidence.push(
          Object.fromEntries(
            Object.entries(request.getHeaders()).filter(([name]) =>
              /^x-haspataal-/i.test(name),
            ),
          ),
        );
        return request;
      };
    }
  });
  for (const endpoint of [
    "/health",
    "/settings/sections",
    "/terminals/whoami",
  ]) {
    const reply = await page.evaluate(
      (path) => window.terminal.call("api", { method: "GET", path }),
      endpoint,
    );
    assert(reply.ok, endpoint + ": " + reply.error?.message);
  }
  const observed = await app.evaluate(() => globalThis.reviewHeaderEvidence);
  assert(observed.length >= 3);
  for (const headers of observed)
    assert.deepEqual(
      headers,
      release
        ? {}
        : {
            "x-haspataal-developer": "mkashif",
            "x-haspataal-implementation": "1",
          },
    );
  checks.push(
    "real health/settings/terminal HTTP requests: " +
      (release
        ? "none of the three DEV headers"
        : "verified developer/implementation attribution; review header absent while empty"),
  );
  const evidence = {
    passed: true,
    release,
    checks,
    renderer: await page.locator("script[src]").getAttribute("src"),
    limitation:
      "Nonempty review code and review-attributed writes intentionally reserved for human testing. No business writes or review codes supplied.",
  };
  fs.writeFileSync(
    `artifacts/review-code-${release ? "release" : "dev"}-check.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await app.close();
}
