# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Fresh own synthetic fixture only. Start before setting the overdue schedule.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const fixture = JSON.parse(
  fs.readFileSync("docs/continuation-2026-11-04/due51-code-red-result.json"),
).body.data;
assert.match(fixture.patient_name, /SCN-Codex-1104 SYNTHETIC/);
const file = "artifacts/continuation-20261104/due51-live.json";
assert(!fs.existsSync(file), "Reconcile previous journal before rerunning");
const j = {
  admission_id: fixture.admission_id,
  started: new Date().toISOString(),
  checks: [],
};
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
let doctor, nurse;
try {
  [doctor, nurse] = await Promise.all([
    session("resume1104-due51-doctor", "demo.doctor"),
    session("resume1104-due51-nurse", "demo.nurse"),
  ]);
  for (const s of [doctor, nurse])
    await s.p.evaluate(() => {
      window.__dueEvents = [];
      window.terminal.subscribe((e) => {
        if (e.type === "event") window.__dueEvents.push(e);
      });
    });
  const current = await doctor.native("api", {
    method: "GET",
    path: `/admissions/${fixture.admission_id}`,
  });
  assert.equal(current.patient_id, fixture.patient_id);
  assert.equal(current.primary_doctor_id, null);
  assert.equal(current.status, "CodeRedActive");
  await doctor.nav("Inpatient rounds");
  await doctor.p
    .getByLabel("Admission status filter", { exact: true })
    .selectOption("Admitted");
  await doctor.p.getByLabel("Rounds", { exact: true }).selectOption("waiting");
  await doctor.p
    .locator(".inpatient-rounds aside")
    .getByRole("button")
    .filter({ hasText: fixture.mrn })
    .click();
  j.ready = true;
  save();
  console.log(
    "READY: both real event clients subscribed; now set overdue vitals/schedule for own admission " +
      fixture.admission_id,
  );
  for (const s of [doctor, nurse])
    await s.p.waitForFunction(
      (id) =>
        window.__dueEvents.some(
          (e) =>
            e.event_type === "vitals.due" &&
            e.payload.admission_id === id &&
            !e.replay,
        ),
      fixture.admission_id,
      { timeout: 150000 },
    );
  j.doctor_events = await doctor.p.evaluate(() => window.__dueEvents);
  j.nurse_events = await nurse.p.evaluate(() => window.__dueEvents);
  j.flowsheet = await doctor.native("api", {
    method: "GET",
    path: `/admissions/${fixture.admission_id}/flowsheet`,
  });
  assert.equal(j.flowsheet.is_overdue, true);
  assert(j.flowsheet.schedule.last_alerted_at);
  await expect(doctor.p.locator(".inpatient-rounds aside")).toContainText(
    "Vitals overdue",
  );
  j.checks.push(
    "CodeRedActive with null doctor: worker emits live non-replay vitals.due to both nurse and doctor; flowsheet last_alerted_at advances and waiting-patient badge appears despite previous Admitted filter.",
  );
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  save();
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  for (const s of [doctor, nurse]) if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}

```
