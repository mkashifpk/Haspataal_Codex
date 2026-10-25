// Read-only actual empty-list failure on verified synthetic patient, before any optional upload.
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const base = process.argv.includes("--baseline"),
  s = await session(
    base ? "phase2-document-empty-baseline" : "phase2-document-empty",
    "demo.reception",
  ),
  p = s.p;
try {
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  assert.equal(
    (await s.native("api", { method: "GET", path: "/patients/5/documents" }))
      .length,
    0,
  );
  await s.nav("Patient document vault");
  await p
    .getByLabel("Patient name, mobile, CNIC or MRN", { exact: true })
    .fill(patient.mrn);
  await p.getByRole("button", { name: "Search", exact: true }).click();
  await p
    .getByRole("button", {
      name: new RegExp(patient.mrn + " · " + patient.full_name),
    })
    .click();
  const empty = p.getByText("No patient documents have been uploaded.", {
    exact: true,
  });
  await expect(empty).toBeVisible();
  await s.fault({
    failPath: "/api/v1/patients/5/documents",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Refresh documents", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  if (base) {
    await expect(empty).toBeVisible();
    s.pass(
      "BASELINE actual failed document refresh still claims no documents from cached empty list",
    );
  } else {
    await expect(empty).toHaveCount(0);
    await s.fault({ failPath: null });
    await p.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(empty).toBeVisible();
    s.pass(
      "Failed document refresh no falseempty/cached list; Retry restores actual empty result, zero business writes",
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
