// Own newly configured DEV programme only. Coordinate real service transitions through MCP, restore Active.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const file = "artifacts/phase2-programme-gates-fixture.json";
assert(
  !fs.existsSync(file),
  "Reconcile existing fixture/stage; never replace a confirmed enrolment",
);
const j = { card: "DEMO-RETIRING-P2-20261025", stage: "starting", writes: [] };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const s = await session("phase2-programme-service-gates", "demo.doctor"),
  p = s.p;
const stage = (v) => {
  j.stage = v;
  save();
  console.log("STAGE " + v);
};
const state = async () => {
  const e = await s.native("api", { method: "GET", path: "/establishment" });
  return e.capabilities.find((c) => c.capability === "preventive_programmes")
    .state;
};
try {
  assert.equal(await state(), "Active");
  const patient = await s.native("api", { method: "GET", path: "/patients/5" });
  assert.equal(
    patient.full_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  const programme = (
    await s.native("api", {
      method: "GET",
      path: "/preventive-programmes?include_inactive=true",
    })
  ).find((x) => x.programme_id === 1);
  assert.equal(programme.name, "DEMO Phase2 software test programme 20261025");
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
  stage("ready-retiring");
  await expect
    .poll(state, { timeout: 60000, intervals: [2000] })
    .toBe("Retiring");
  await expect(p.locator("main")).toContainText("No new enrolment from now on");
  await expect(
    p.getByRole("button", { name: "Enrol patient", exact: true }),
  ).toHaveCount(0);
  await expect(
    p.getByRole("button", { name: "Record programme service", exact: true }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Record programme service", exact: true })
    .click();
  const modal = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", {
        name: "Record programme service",
        exact: true,
      }),
    });
  await modal
    .getByLabel("Service from programme card", { exact: true })
    .selectOption(programme.services[0]);
  const response = await p.evaluate(() =>
    window.terminal.call("api", { method: "GET", path: "/home-visits/policy" }),
  );
  assert(response.ok);
  const meta = await s.native("api", { method: "GET", path: "/meta/settings" });
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: meta.hospital_timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.parse(response.meta.server_time) - 300000))
      .map((x) => [x.type, x.value]),
  );
  await modal
    .getByLabel("Service given at (hospital time)", { exact: true })
    .fill(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`,
    );
  await expect(
    modal.getByLabel("Next date exactly as card says (optional)", {
      exact: true,
    }),
  ).toHaveValue("");
  await modal
    .getByLabel("Programme service note (optional)", { exact: true })
    .fill(
      "DEMO Retiring continuation software test only, no clinical service given.",
    );
  j.pending = {
    path: "/programme-enrolments/" + j.enrolment.enrolment_id + "/entries",
    service: programme.services[0],
    note: "DEMO Retiring continuation software test only, no clinical service given.",
  };
  save();
  await modal
    .getByRole("button", { name: "Confirm programme action", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  j.after_entry = (
    await s.native("api", { method: "GET", path: "/patients/5/programmes" })
  ).find((x) => x.enrolment_id === j.enrolment.enrolment_id);
  assert.equal(j.after_entry.entries.length, 1);
  delete j.pending;
  save();
  await p.getByRole("button", { name: "Close enrolment", exact: true }).click();
  const close = p
    .getByRole("dialog")
    .filter({
      has: p.getByRole("heading", {
        name: "Close programme enrolment",
        exact: true,
      }),
    });
  await close
    .getByLabel("Close with outcome", { exact: true })
    .selectOption("Completed");
  await close
    .getByLabel("Closure note (optional)", { exact: true })
    .fill(
      "DEMO software fixture completed; no actual clinical service or course completed.",
    );
  j.pending = {
    path: "/programme-enrolments/" + j.enrolment.enrolment_id + "/close",
    status: "Completed",
  };
  save();
  await close
    .getByRole("button", { name: "Confirm programme action", exact: true })
    .click();
  await expect(close).toHaveCount(0);
  j.closed = (
    await s.native("api", { method: "GET", path: "/patients/5/programmes" })
  ).find((x) => x.enrolment_id === j.enrolment.enrolment_id);
  assert.equal(j.closed.status, "Completed");
  delete j.pending;
  stage("ready-retired");
  await expect
    .poll(state, { timeout: 60000, intervals: [2000] })
    .toBe("Retired");
  await expect(p.locator("main")).toContainText(
    "Existing history remains readable",
  );
  await expect(
    p.getByRole("button", { name: "Enrol patient", exact: true }),
  ).toHaveCount(0);
  await expect(
    p.getByRole("button", { name: "Record programme service", exact: true }),
  ).toHaveCount(0);
  await expect(
    p.getByText(j.closed.entries[0].given_by_stamp.text, { exact: true }),
  ).toBeVisible();
  stage("ready-reactivate");
  await expect
    .poll(state, { timeout: 90000, intervals: [2000] })
    .toBe("Active");
  await expect(
    p.getByRole("button", { name: "Enrol patient", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Record programme service", exact: true }),
  ).toHaveCount(0);
  stage("finished-active");
  s.pass(
    "Actual establishment.changed Active -> Retiring hides new enrolment while existing pre-retirement service/close201/200 continue; Retired history readable/no new work; restored Active via server, closed fixture stays closed. No fabricated capability/event state.",
  );
  s.j.passed = true;
  s.save();
  j.passed = true;
  save();
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
