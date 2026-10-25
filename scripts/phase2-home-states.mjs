// Real policy/history/detail response losses. Read-only; never replays a clinical write.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const fixture = JSON.parse(fs.readFileSync("artifacts/phase2-home-reset.json"));
assert(fixture.passed);
const { original_visit: original, corrected_visit: corrected } = fixture,
  baseline = process.argv.includes("--baseline");
const s = await session(
    baseline ? "phase2-home-states-baseline" : "phase2-home-states",
    "demo.doctor",
  ),
  p = s.p;
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  await s.nav("Record a home visit");
  await p
    .getByLabel("Find clinical patient", { exact: true })
    .fill(patient.mrn);
  await p
    .getByRole("button", {
      name: patient.full_name + " · " + patient.mrn,
      exact: true,
    })
    .click();
  await expect(
    p.getByRole("heading", { name: "Completed visit facts", exact: true }),
  ).toBeVisible();
  await p
    .getByLabel("Reason for the visit", { exact: true })
    .fill("DEMO unsent policy-retry draft");
  const policy = p.locator("section.card").filter({
    has: p.getByRole("heading", { name: "Home-visit policy", exact: true }),
  });
  await s.fault({
    failPath: "/api/v1/home-visits/policy",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Refresh home-visit policy", exact: true })
    .click();
  await expect(
    policy.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  if (baseline) {
    await expect(
      policy.getByText("Home visits are provided.", { exact: false }).first(),
    ).toBeVisible();
    s.pass(
      "BASELINE: cached provided policy still shown beside real failed refresh",
    );
  } else {
    await expect(
      policy.getByText("Home visits are provided.", { exact: false }),
    ).toHaveCount(0);
    await expect(
      p.getByRole("button", {
        name: "Record completed home visit",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(p.locator("main")).toContainText(
      "Home-visit policy could not be verified",
    );
  }
  await s.fault({ failPath: null });
  await policy.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    p.getByLabel("Reason for the visit", { exact: true }),
  ).toHaveValue("DEMO unsent policy-retry draft");
  const list = p.locator("section.card").filter({
    has: p.getByRole("heading", {
      name: "Signed home-visit history",
      exact: true,
    }),
  });
  await list.getByLabel("Home visits from", { exact: true }).fill("2026-10-25");
  await list.getByLabel("Home visits to", { exact: true }).fill("2026-10-25");
  await list
    .getByRole("button", { name: "Read home-visit history", exact: true })
    .click();
  await list
    .getByRole("button")
    .filter({ hasText: corrected.visit_number })
    .click();
  await expect(
    list.getByText(corrected.address, { exact: true }),
  ).toBeVisible();
  await s.fault({
    failPath: "/api/v1/home-visits/" + original.home_visit_id,
    failMethod: "GET",
    once: false,
  });
  await list
    .getByRole("button")
    .filter({ hasText: original.visit_number })
    .click();
  await expect(list.getByRole("alert")).toBeVisible();
  if (baseline) {
    await expect(
      list.getByText(corrected.address, { exact: true }),
    ).toBeVisible();
    s.pass(
      "BASELINE: previously selected different home-visit detail survives actual next-detail failure",
    );
  } else {
    await expect(
      list.getByText(corrected.address, { exact: true }),
    ).toHaveCount(0);
    await expect(
      list.getByRole("button", { name: /Record a corrective home visit for/ }),
    ).toHaveCount(0);
    await s.fault({ failPath: null });
    await list
      .getByRole("button")
      .filter({ hasText: original.visit_number })
      .click();
    await expect(
      list.getByText(original.address, { exact: true }),
    ).toBeVisible();
    await help(
      s,
      list.getByRole("button", {
        name: "Record a corrective home visit for #" + original.home_visit_id,
        exact: true,
      }),
      "Record a home visit",
    );
    await s.fault({
      failPath: "/api/v1/home-visits?",
      failMethod: "GET",
      once: false,
    });
    await list
      .getByRole("button", { name: "Read home-visit history", exact: true })
      .click();
    await expect(
      list.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await expect(list.getByText(original.address, { exact: true })).toHaveCount(
      0,
    );
    await expect(list).not.toContainText("No home visits returned");
    await s.fault({ failPath: null });
    await list.getByRole("button", { name: "Try again", exact: true }).click();
    await list
      .getByRole("button")
      .filter({ hasText: corrected.visit_number })
      .click();
    await expect(
      list.getByText(corrected.address, { exact: true }),
    ).toBeVisible();
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
      "Failed policy hides cached availability and new form, Retry restores unsent draft; failed next detail clears stale previous selection/correction action, actual row retry succeeds; list failure no falseempty/stale details, retry restores actual history; F1/focus/nativezoom100-250/reset",
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
