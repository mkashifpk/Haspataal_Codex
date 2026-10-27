// Fresh, guarded Phase3 clearance regression. Never blindly replay after a partial run.
import { session, expect, help } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/phase3-clearance-ui.json";
assert(!fs.existsSync(file), "Reconcile original journal before restarting");
const fixture = JSON.parse(
  fs.readFileSync("artifacts/phase3-finish-ipd-rx.json"),
).result.body.data;
const j = { started: new Date().toISOString(), checks: [], passed: false };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
let s;
const pass = (m) => {
  j.checks.push(m);
  save();
  console.log("PASS " + m);
};
try {
  s = await session("phase3-clearance-profile", "demo.pharmacist");
  const p = s.p;
  await s.nav("Dispense");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(fixture.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription", exact: true })
    .click();
  await expect(p.locator("main")).toContainText("DEMO-PHASE3-FINISH-20261027");
  const section = p
    .locator("section.card")
    .filter({
      has: p.getByRole("heading", {
        name: "Pharmacy discharge clearance",
        exact: true,
      }),
    });
  await expect(section).toContainText("MRN-2026-000004");
  await expect(section).toContainText("ADM-2026-00001");
  const action = section.getByRole("button", {
    name: "Review Pharmacy clearance",
    exact: true,
  });
  await expect(action).toBeDisabled();
  await section.getByRole("checkbox").check();
  await expect(action).toBeEnabled();
  await help(s, section.getByRole("checkbox"), "Dispense");
  pass(
    "Actual pharmacist identity/stage read, returned-medicine acknowledgement and contextual F1 preserve draft",
  );
  await action.click();
  const modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("button", {
        name: "Confirm pharmacy action",
        exact: true,
      }),
    });
  await modal
    .getByLabel("Reason / clearance note", { exact: true })
    .fill(
      "DEMO software-only clearance test; no real medicines held or returned",
    );
  await s.fault({
    failPath:
      "/admissions/" +
      fixture.admission_id +
      "/discharge/PharmacyClearance/clear",
    failMethod: "POST",
    once: true,
  });
  j.pending = {
    path:
      "/admissions/" +
      fixture.admission_id +
      "/discharge/PharmacyClearance/clear",
    note: "DEMO software-only clearance test; no real medicines held or returned",
  };
  save();
  await modal
    .getByRole("button", { name: "Confirm pharmacy action", exact: true })
    .click();
  await expect(
    p.getByText(
      "The result is unknown. This draft and navigation stay locked; do not create a replacement.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Retry original request", exact: true }),
  ).toHaveCount(0);
  const writes = () =>
    s
      .trace()
      .then((t) =>
        t.requests.filter(
          (r) =>
            r.method === "POST" &&
            r.path.endsWith("/discharge/PharmacyClearance/clear"),
        ),
      );
  const before = await writes();
  assert.equal(before.length, 1);
  assert.equal(before[0].status, 200);
  j.original = before[0];
  save();
  await p
    .getByRole("button", { name: "Read current result", exact: true })
    .click();
  await expect(
    p.getByRole("button", {
      name: "Result reviewed; return to draft",
      exact: true,
    }),
  ).toBeVisible();
  const status = await s.native("api", {
    method: "GET",
    path: "/admissions/" + fixture.admission_id + "/discharge-status",
  });
  const stage = status.stages.find((s) => s.stage === "PharmacyClearance");
  assert.equal(stage.status, "Cleared");
  assert(stage.cleared_by_name && stage.cleared_at);
  assert.equal(status.blocked_on, "NursingMARVerification");
  j.confirmed = status;
  delete j.pending;
  save();
  await p
    .getByRole("button", {
      name: "Result reviewed; return to draft",
      exact: true,
    })
    .click();
  await expect(section).toContainText("Pharmacy clearance recorded");
  await expect(section).toContainText(stage.cleared_by_name);
  await expect(action).toBeDisabled();
  assert.equal((await writes()).length, 1);
  pass(
    "Real committed clearance with lost200: no automatic retry or retry button; exact discharge-status read confirms actor/time after next-stage advance; one POST only",
  );
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, ui_scale_pct: 250, theme: "DarkHighContrast" });
    await expect(p.locator("html")).toHaveAttribute("lang", language);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    await p.screenshot({
      path: "artifacts/phase3-clearance-" + language + ".png",
    });
  }
  pass("Actual clearance EN/Urdu high-contrast 250% no horizontal overflow");
  j.passed = true;
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}
