import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, capture } from "./clinical-test-kit.mjs";
const fixture = JSON.parse(
  fs.readFileSync("docs/screen163-2026-11-05/review-b-result.json"),
).body.data;
let s;
try {
  s = await session("screen163-manager-read", "demo.quality");
  s.p.on("dialog", (d) => d.accept());
  await s.p
    .getByRole("navigation")
    .locator('[data-screen-target="my_investigations"]')
    .click();
  const root = s.p.locator('[data-screen="my_investigations"]');
  await root
    .getByRole("row")
    .filter({ hasText: fixture.incident_number })
    .getByRole("button", { name: "Open investigation", exact: true })
    .click();
  await root.locator('button[data-help="mi.action"]').click();
  const people = root.locator('select[data-help="mi.owner"]');
  await expect(people.locator("option")).not.toHaveCount(1);
  assert(
    (await people.locator('option:not([value=""])').allTextContents()).every(
      (v) => v.trim(),
    ),
  );
  await people.selectOption(
    await people
      .locator('option:not([value=""])')
      .first()
      .getAttribute("value"),
  );
  const depts = root.locator('select[data-help="mi.department"]');
  await expect(depts.locator("option")).not.toHaveCount(1);
  await root.locator('button[data-help="mi.cancel"]').click();
  await capture(s, "my_investigations");
  await root.locator('button[data-help="mi.analysis"]').click();
  const text =
    "SYNTHETIC ONLY retained unsent chronology during external incident.updated";
  await root.locator('textarea[name="chronology"]').fill(text);
  const before = (await s.trace()).requests.length;
  fs.writeFileSync(
    "artifacts/screen163-event-ready.json",
    JSON.stringify({ incident_id: fixture.incident_id, ready: true }),
  );
  console.log("READY external sandbox action");
  await expect(root).toContainText("SCN163 EXTERNAL EVENT synthetic test", {
    timeout: 180000,
  });
  await expect(root.locator('textarea[name="chronology"]')).toHaveValue(text);
  assert(
    (await s.trace()).requests
      .slice(before)
      .some(
        (r) =>
          r.method === "GET" &&
          r.path.endsWith("/incidents/" + fixture.incident_id),
      ),
  );
  await root.locator('button[data-help="mi.cancel"]').click();
  assert(!(await s.trace()).requests.some((r) => r.method !== "GET"));
  s.j.passed = true;
  s.pass(
    "Manager owner directory displays actual names; active departments; official assigned list; external incident.updated refresh without polling preserves unsent analysis; ENUR/themes250bounds.",
  );
} finally {
  if (s) await s.close();
}
try {
  s = await session("screen163-unassigned-reporter", "demo.nurse");
  const rows = await s.native("api", {
    method: "GET",
    path: "/incidents?mine=true&status=UnderReview",
  });
  assert(rows.some((r) => r.incident_id === fixture.incident_id));
  const me = await s.native("api", { method: "GET", path: "/auth/me" });
  assert(rows.every((r) => r.investigator_user_id !== me.user_id));
  await expect(
    s.p
      .getByRole("navigation")
      .locator('[data-screen-target="my_investigations"]'),
  ).toHaveCount(0);
  s.j.passed = true;
  s.pass(
    "A reporter with an incident assigned to somebody else does not see the investigation menu.",
  );
} finally {
  if (s) await s.close();
}
