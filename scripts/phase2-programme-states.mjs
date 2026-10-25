// Read-only real-response failures; no fabricated successful backend replies.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const baseline = process.argv.includes("--baseline"),
  old = JSON.parse(fs.readFileSync("artifacts/phase2-programme-reset.json"));
assert(old.passed && old.closed);
const current = old.closed;
const s = await session(
    baseline ? "phase2-programme-states-baseline" : "phase2-programme-states",
    "demo.doctor",
  ),
  p = s.p;
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  await s.nav("Preventive programmes of a patient");
  await p
    .getByLabel("Find clinical patient", { exact: true })
    .fill(patient.mrn);
  await p
    .getByRole("button", {
      name: patient.full_name + " · " + patient.mrn,
      exact: true,
    })
    .click();
  await p
    .getByRole("button", {
      name: "Open enrolment " + current.enrolment_number,
      exact: true,
    })
    .click();
  const stamp = p.getByText(current.entries[0].given_by_stamp.text, {
    exact: true,
  });
  await expect(stamp).toBeVisible();
  await s.fault({
    failPath: "/api/v1/patients/5/programmes",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", {
      name: "Refresh programme history and due list",
      exact: true,
    })
    .click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  if (baseline) {
    await expect(stamp).toBeVisible();
    s.pass(
      "BASELINE: cached selected enrolment and author stamp still rendered after actual history read failure",
    );
  } else {
    await expect(stamp).toHaveCount(0);
    await expect(
      p.getByText("No programme enrolments returned for this patient.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await s.fault({ failPath: null });
    await p.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(stamp).toBeVisible();
    const select = p.getByLabel("Offered programme", { exact: true });
    await select.selectOption("1");
    await p
      .getByLabel("Programme card / register number", { exact: true })
      .fill("DEMO unsent draft only");
    await s.fault({
      failPath: "/api/v1/preventive-programmes",
      failMethod: "GET",
      once: false,
    });
    await p
      .getByRole("button", {
        name: "Refresh programme history and due list",
        exact: true,
      })
      .click();
    await expect(
      p.getByRole("button", { name: "Try again", exact: true }).first(),
    ).toBeVisible();
    await expect(select).toBeDisabled();
    await expect(select).toHaveValue("1");
    await expect(select.locator("option")).toHaveCount(2);
    await p.getByRole("button", { name: "Enrol patient", exact: true }).click();
    await expect(
      p
        .getByRole("alert")
        .filter({ hasText: "Refresh the programme catalogue before" }),
    ).toBeVisible();
    await s.fault({ failPath: null });
    await p
      .getByRole("button", {
        name: "Refresh programme history and due list",
        exact: true,
      })
      .click();
    await expect(select).toBeEnabled();
    await expect(
      p.getByLabel("Programme card / register number", { exact: true }),
    ).toHaveValue("DEMO unsent draft only");
    await help(s, select, "Preventive programmes of a patient");
    await s.prefs({ ui_scale_pct: 245 });
    const win = await s.app.browserWindow(p);
    const key = async (k) =>
      win.evaluate((w, k) => {
        for (const type of ["keyDown", "keyUp"])
          w.webContents.sendInputEvent({
            type,
            keyCode: k,
            modifiers: ["control"],
          });
      }, k);
    await key("=");
    await expect
      .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
      .toBe(250);
    await key("=");
    assert.equal((await s.native("state")).prefs.ui_scale_pct, 250);
    await key("0");
    await expect
      .poll(async () => (await s.native("state")).prefs.ui_scale_pct)
      .toBe(100);
    await key("-");
    assert.equal((await s.native("state")).prefs.ui_scale_pct, 100);
    s.pass(
      "Actual history failure hides stale selected detail and falseempty; Retry restores original. Catalogue failure disables cached offered choices, retains ID/card draft and refuses enrol without POST; F1/draft/focus; native zoom bounds/reset shared settings",
    );
  }
  assert.equal(
    (await s.trace()).requests.filter((x) => x.method !== "GET").length,
    0,
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.fault({ failPath: null, delayPath: null });
  await expect
    .poll(
      async () =>
        (
          await p.evaluate(() =>
            window.terminal.call("api", { method: "GET", path: "/auth/me" }),
          )
        ).ok,
      { timeout: 60000 },
    )
    .toBe(true);
  await s.close();
}
