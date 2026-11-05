# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Coordinate ONLY our owned synthetic material retirement through MCP while a real draft stays open.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect } from "./clinical-test-kit.mjs";
const fixture = JSON.parse(
  fs.readFileSync("artifacts/phase2-education-fixture.json"),
);
assert(fixture.passed);
const material = fixture.materials[process.argv.includes("--second") ? 1 : 0];
assert(material.title.startsWith(fixture.run));
const s = await session("phase2-education-retirement", "demo.doctor"),
  p = s.p;
try {
  const ticket = await s.native("api", {
    method: "GET",
    path: "/opd-tickets/5",
  });
  assert(ticket.patient_name.startsWith("DEMO-FINANCIAL-1792904985263 "));
  await s.nav("Consultation (EMR)");
  await p
    .getByLabel("OPD slip number", { exact: true })
    .fill(ticket.ticket_number);
  await p.getByLabel("OPD slip number", { exact: true }).press("Enter");
  await expect(p.locator("main")).toContainText(ticket.mrn);
  await p
    .getByRole("button", { name: "Patient education", exact: true })
    .click();
  const select = p.getByLabel("Material actually used", { exact: true });
  await expect(
    select.locator(`option[value="${material.material_id}"]`),
  ).toBeAttached();
  await p
    .getByLabel("Education topic", { exact: true })
    .fill(fixture.run + " retired refusal");
  await p
    .getByLabel("Education method", { exact: true })
    .selectOption("Leaflet");
  await p
    .getByLabel("Education given to", { exact: true })
    .selectOption("Patient");
  await select.selectOption(String(material.material_id));
  fs.writeFileSync(
    "artifacts/phase2-education-retirement-ready.json",
    JSON.stringify(
      {
        material,
        request: {
          method: "PATCH",
          path: "/education/materials/" + material.material_id,
          body: { is_active: false, expected_version: material.row_version },
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "READY: retire owned synthetic material via MCP only; draft open",
  );
  await expect
    .poll(
      async () =>
        !(
          await s.native("api", {
            method: "GET",
            path: "/education/materials?include_inactive=true",
          })
        ).find((m) => m.material_id === material.material_id).is_active,
      { timeout: 60000, intervals: [2000] },
    )
    .toBe(true);
  await p
    .getByRole("button", { name: "Save education record", exact: true })
    .click();
  await expect(
    p.getByRole("alert").filter({ hasText: "selected material was retired" }),
  ).toBeVisible();
  assert.equal(
    (await s.trace()).requests.filter((r) => r.method === "POST").length,
    0,
  );
  await p
    .getByRole("button", { name: "Refresh education materials", exact: true })
    .click();
  await expect(select.locator("option:checked")).toContainText(
    "no longer active",
  );
  await expect(select).toHaveValue(String(material.material_id));
  await expect(
    select.locator(`option[value="${material.material_id}"]`),
  ).toHaveAttribute("disabled", "");
  await p
    .getByRole("button", { name: "Save education record", exact: true })
    .click();
  await expect(
    p.getByRole("alert").filter({ hasText: "Select a current active" }),
  ).toBeVisible();
  await select.selectOption("");
  await p
    .getByLabel("Education method", { exact: true })
    .selectOption("Verbal");
  await s.fault({
    failPath: "/api/v1/patients/5/education",
    failMethod: "GET",
    once: false,
  });
  await p
    .getByRole("button", { name: "Older education entries", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("heading", { name: fixture.run + " clarified", exact: true }),
  ).toHaveCount(0);
  await expect(
    p.getByText(
      "No education entries in this page. Review a newer page or record actual guidance with permission.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await s.fault({ failPath: null });
  await p.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    p.getByText(
      "No education entries in this page. Review a newer page or record actual guidance with permission.",
      { exact: true },
    ),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Newer education entries", exact: true })
    .click();
  await expect(
    p.getByRole("heading", { name: fixture.run + " clarified", exact: true }),
  ).toBeVisible();
  s.pass(
    "Real master retirement of OWN fixture refused in fresh preflight without POST; refresh visibly retains inactive ID for replacement; actual history exhausted failure hides stale/empty, Retry and cursor restore history; draft retained",
  );
  s.j.passed = true;
  s.save();
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  try {
    fs.writeFileSync(
      "artifacts/phase2-education-retirement-ui.txt",
      await p.locator("body").innerText(),
    );
  } catch {}
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

```
