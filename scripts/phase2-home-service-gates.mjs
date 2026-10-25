// Read-only UI while MCP transitions this newly enabled DEV service; restore Active before exit.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const f = JSON.parse(fs.readFileSync("artifacts/phase2-home-reset.json"));
assert(f.passed);
const s = await session("phase2-home-service-gates", "demo.doctor"),
  p = s.p;
const stage = (v) => {
  s.j.stage = v;
  s.save();
  console.log("STAGE " + v);
};
const state = async () => {
  const e = await s.native("api", { method: "GET", path: "/establishment" });
  return e.capabilities.find((c) => c.capability === "home_visits").state;
};
try {
  assert.equal(await state(), "Active");
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(patient.full_name, f.original_visit.patient_name);
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
    p.getByRole("button", { name: "Record completed home visit", exact: true }),
  ).toBeVisible();
  const list = p
    .locator("section.card")
    .filter({
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
    .filter({ hasText: f.corrected_visit.visit_number })
    .click();
  await expect(
    list.getByText(f.corrected_visit.address, { exact: true }),
  ).toBeVisible();
  stage("ready-retiring");
  await expect
    .poll(state, { timeout: 60000, intervals: [2000] })
    .toBe("Retiring");
  await expect(p.locator("main")).toContainText(
    "No new home-visit records from now on",
  );
  await expect(
    p.getByRole("button", { name: "Record completed home visit", exact: true }),
  ).toHaveCount(0);
  await expect(
    list.getByRole("button", { name: /Record a corrective home visit for/ }),
  ).toHaveCount(0);
  await expect(
    list.getByText(f.corrected_visit.address, { exact: true }),
  ).toBeVisible();
  stage("ready-retired");
  await expect
    .poll(state, { timeout: 60000, intervals: [2000] })
    .toBe("Retired");
  await expect(
    p.getByRole("button", { name: "Record completed home visit", exact: true }),
  ).toHaveCount(0);
  await expect(
    list.getByText(f.corrected_visit.address, { exact: true }),
  ).toBeVisible();
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: process.cwd() + "/artifacts/phase2-home-retired-notice.pdf",
    });
  });
  await s.native("clinical-pdf", { path: "/home-visits/notice/pdf" });
  assert.equal(
    fs
      .readFileSync("artifacts/phase2-home-retired-notice.pdf")
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  stage("ready-reactivate");
  await expect
    .poll(state, { timeout: 60000, intervals: [2000] })
    .toBe("Active");
  await expect(
    p.getByRole("button", { name: "Record completed home visit", exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("button", {
      name:
        "Record a corrective home visit for #" +
        f.corrected_visit.home_visit_id,
      exact: true,
    }),
  ).toBeVisible();
  for (const language of ["en", "ur"]) {
    await s.prefs({ language, theme: "Light", ui_scale_pct: 100 });
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({
      path: "public/handbook/home_visit_record-" + language + ".png",
      fullPage: true,
    });
    for (const theme of ["Light", "DarkHighContrast"]) {
      await s.prefs({ language, theme, ui_scale_pct: 250 });
      await expect
        .poll(() =>
          p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        )
        .toBe(true);
    }
  }
  assert.equal(
    (await s.trace()).requests.filter((x) => x.method !== "GET").length,
    0,
  );
  s.pass(
    "Real establishment.changed Active/Retiring/Retired/Active: no new or corrective records while inactive, signed history persists, official inactive noticePDF200; Active restored/form available; zero clinicalPOST; final ENURboth themes250/fullpage images",
  );
  s.j.passed = true;
  stage("finished-active");
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await s.close();
}
