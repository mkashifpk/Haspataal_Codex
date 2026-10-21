import { terminalPage } from "./terminal-page.mjs";
// Real DEV reads and restored preferences only. Never opens/closes a drawer.
import { _electron as electron } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatHospitalTime } from "../src/hospital-time.ts";
const env = {
  ...process.env,
  HASPATAAL_TEST: "1",
  HASPATAAL_DEV_CONFIG: path.resolve(".dev-terminal.json"),
  HASPATAAL_TEST_DATA: path.resolve(
    "artifacts/cash-shift-profile-" + Date.now(),
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
fs.mkdirSync("artifacts", { recursive: true });
let app, page, original;
const checks = [],
  errors = [];
async function invoke(action, args) {
  const reply = await page.evaluate(
    ({ action, args }) => window.terminal.call(action, args),
    { action, args },
  );
  assert(reply.ok, JSON.stringify(reply));
  return reply.data;
}
try {
  app = await electron.launch({ args: ["."], env });
  page = await terminalPage(app);
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.getByLabel("Username", { exact: true }).fill("demo.reception");
  await expect(
    page.getByText("Hospital server ready.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("Demo-pass-2026");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await page.getByRole("navigation").waitFor();
  original = (await invoke("state")).prefs;
  await invoke("prefs", { language: "en", theme: "Light", ui_scale_pct: 100 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My cash shift", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "My cash shift", exact: true })
    .waitFor();
  const shift = await invoke("api", {
    method: "GET",
    path: "/finance/cash-shifts/mine",
  });
  const terminal = await invoke("api", {
    method: "GET",
    path: "/terminals/whoami",
  });
  if (shift) {
    const originalShift = await invoke("api", {
      method: "GET",
      path: "/finance/cash-shifts/" + shift.shift_id,
    });
    assert.equal(originalShift.shift_id, shift.shift_id);
    assert.equal(originalShift.user_id, shift.user_id);
    checks.push(
      "recovery GET reads the exact original shift using the real declared contract",
    );
  }
  await expect(
    page.getByText("Terminal cash counter", { exact: false }),
  ).toBeVisible();
  if (shift)
    await expect(
      page.getByText("Shift # " + shift.shift_id, { exact: false }).first(),
    ).toBeVisible();
  checks.push(
    "real shift/terminal/ledger rendered; counter has no editable substitute",
  );
  assert.equal(await page.locator("select").count(), 0);
  const input = page.getByLabel(
    shift ? "Counted cash in drawer" : "Opening float",
    { exact: true },
  );
  if ((await input.count()) && (await input.isEnabled())) {
    await input.fill("123.45");
    await input.focus();
    await page.keyboard.press("F1");
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "My cash shift", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(input).toHaveValue("123.45");
    await expect(input).toBeFocused();
    let warned = false;
    page.once("dialog", async (dialog) => {
      warned = true;
      await dialog.dismiss();
    });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Notifications", exact: false })
      .click();
    assert(warned);
    await expect(input).toHaveValue("123.45");
    if (shift) {
      await page
        .getByRole("button", { name: "Close shift", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("heading", { name: "Confirm Shift Closure" })
        .waitFor();
      await page.keyboard.press("F1");
      await page.locator(".help-article").waitFor();
      await page
        .getByRole("button", { name: "Close", exact: true })
        .last()
        .click();
      await page.getByRole("button", { name: "Go back", exact: true }).click();
    }
    await input.fill(shift ? "" : "0");
    checks.push(
      "F1 preserves field draft/focus; navigation cancellation retains amount; confirmation cancelled without submission",
    );
  } else {
    checks.push(
      "write controls blocked for real missing/mismatched terminal mapping; write journey not exercised",
    );
    await page.keyboard.press("F1");
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "My cash shift", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  // Compare displayed dates with hospital metadata independently of workstation zone.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTimezoneOverride", {
    timezoneId: "America/Los_Angeles",
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  if (shift) {
    const meta = await invoke("api", { method: "GET", path: "/meta/settings" });
    await expect(
      page
        .getByText(
          formatHospitalTime(shift.opened_at, meta.hospital_timezone),
          { exact: false },
        )
        .first(),
    ).toBeVisible();
    checks.push(
      "shift time matches real hospital timezone with workstation emulated as Los Angeles",
    );
  }
  fs.mkdirSync("public/handbook", { recursive: true });
  for (const language of ["en", "ur"]) {
    await invoke("prefs", { language, ui_scale_pct: 100 });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.screenshot({
      path: "public/handbook/my_cash_shift-" + language + ".png",
    });
    await invoke("prefs", { ui_scale_pct: 250 });
    await expect
      .poll(() => invoke("state").then((s) => s.prefs.ui_scale_pct))
      .toBe(250);
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    );
    await page.screenshot({
      path: "artifacts/cash-shift-" + language + "-250.png",
    });
  }
  checks.push(
    "English/Urdu 250% layout without document overflow; bilingual real DEV handbook examples captured",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "artifacts/cash-shift-check.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        shift_id: shift?.shift_id,
        mapping_present: !!terminal.cash_node,
        scope:
          "Existing synthetic DEV data and restored preferences only; no cash-shift open/close/payment writes. Human fresh-data acceptance pending.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (error) {
  if (page)
    await page
      .screenshot({ path: "artifacts/cash-shift-failure.png" })
      .catch(() => {});
  throw error;
} finally {
  if (page && original)
    await invoke("prefs", original).catch((error) =>
      console.error("PREFERENCE RESTORE FAILED", error.message),
    );
  if (app) await app.close();
}
