// New own enrolment for actual backend refusal matrix; closes Discontinued after checks, no clinical service.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const file = "artifacts/phase2-programme-refusal-record.json";
const j = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file))
  : { card: "DEMO-REFUSALS-P2-20261025" };
assert(
  !j.enrolment && !j.pending,
  "Reconcile original fixture; never repeat enrolment",
);
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const s = await session("phase2-programme-refusal-fixture", "demo.doctor"),
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
  await p.getByLabel("Offered programme", { exact: true }).selectOption("1");
  await p
    .getByLabel("Programme card / register number", { exact: true })
    .fill(j.card);
  j.pending = {
    path: "/patients/5/programmes",
    body: { programme_id: 1, card_number: j.card },
  };
  save();
  await p.getByRole("button", { name: "Enrol patient", exact: true }).click();
  await expect(
    p.getByLabel("Programme card / register number", { exact: true }),
  ).toHaveValue("");
  j.enrolment = (
    await s.native("api", { method: "GET", path: "/patients/5/programmes" })
  ).find((x) => x.card_number === j.card);
  assert(j.enrolment);
  delete j.pending;
  j.stage = "ready-refusals";
  save();
  console.log(
    "READY actual refusal matrix enrolment " + j.enrolment.enrolment_id,
  );
  await expect
    .poll(
      () => fs.existsSync("artifacts/phase2-programme-refusals-done.json"),
      { timeout: 120000, intervals: [2000] },
    )
    .toBe(true);
  await p.getByRole("button", { name: "Close enrolment", exact: true }).click();
  const modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", {
        name: "Close programme enrolment",
        exact: true,
      }),
    });
  await modal
    .getByLabel("Close with outcome", { exact: true })
    .selectOption("Discontinued");
  const count = async () =>
    (await s.trace()).requests.filter(
      (x) => x.method === "POST" && x.path.endsWith("/close"),
    ).length;
  await modal
    .getByRole("button", { name: "Confirm programme action", exact: true })
    .click();
  await expect(modal).toContainText("reason");
  assert.equal(await count(), 0);
  await modal
    .getByLabel("Why discontinued", { exact: true })
    .fill(
      "DEMO refusal test fixture finished. No clinical course or care discontinued.",
    );
  j.pending = {
    path: "/programme-enrolments/" + j.enrolment.enrolment_id + "/close",
    status: "Discontinued",
  };
  save();
  await modal
    .getByRole("button", { name: "Confirm programme action", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  j.closed = (
    await s.native("api", { method: "GET", path: "/patients/5/programmes" })
  ).find((x) => x.enrolment_id === j.enrolment.enrolment_id);
  assert.equal(j.closed.status, "Discontinued");
  assert.equal(j.closed.entries.length, 0);
  delete j.pending;
  j.passed = true;
  save();
  s.pass(
    "Fresh own enrolment for actual API refusals; Discontinued requires explicit why (zeroPOST until supplied), closes once with no clinical entries",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  j.writes = (await s.trace()).requests.filter((x) => x.method !== "GET");
  save();
  await s.close();
}
