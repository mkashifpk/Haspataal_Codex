// Own synthetic metadata/education only; no real guidance, video or leaflet is given.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const file = "artifacts/phase2-education-fixture.json";
const j = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file))
  : { run: "DEMO-EDUCATION-" + Date.now(), materials: [], attempts: [] };
const save = () => fs.writeFileSync(file, JSON.stringify(j, null, 2));
save();
const baseline = process.argv.includes("--baseline");
if (!baseline)
  assert(
    !j.original && !j.pending && !j.entries?.length,
    "Existing education writes must be reconciled; never rerun this business flow",
  );
assert.equal(
  j.materials.length,
  2,
  "Set up owned synthetic materials through MCP; terminal intentionally has no master-write route",
);
const s = await session(
    baseline ? "phase2-education-baseline" : "phase2-education-reset",
    "demo.doctor",
  ),
  p = s.p;
const writes = async () =>
  (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path === "/api/v1/patients/5/education",
  );
try {
  const ticket = await s.native("api", {
    method: "GET",
    path: "/opd-tickets/5",
  });
  assert.equal(
    ticket.patient_name,
    "DEMO-FINANCIAL-1792904985263 virtual postconsult waiver, no actual care",
  );
  const notes = await s.native("api", {
    method: "GET",
    path: "/patients/5/clinical-encounters",
  });
  assert(notes.some((n) => n.encounter_id === 1 && n.patient_id === 5));
  await s.nav("Consultation (EMR)");
  await p
    .getByLabel("OPD slip number", { exact: true })
    .fill(ticket.ticket_number);
  await p.getByLabel("OPD slip number", { exact: true }).press("Enter");
  await expect(p.locator("main")).toContainText(ticket.mrn);
  if (baseline)
    await s.fault({ delayPath: "/api/v1/education/materials", delayMs: 2500 });
  await p
    .getByRole("button", { name: "Patient education", exact: true })
    .click();
  await expect(p.locator("main h1")).toHaveText("Health education given");
  const material = p.getByLabel("Material actually used", { exact: true });
  await expect(material).toBeVisible();
  if (baseline) {
    assert.equal(await material.isEnabled(), true);
    s.pass(
      "BASELINE: material selector remains enabled while real catalogue response delayed",
    );
    s.j.passed = true;
    s.save();
  } else {
    await expect(material.locator("option")).toHaveCount(3);
    await expect(
      p.getByLabel("Education consultation", { exact: true }),
    ).toHaveValue("1");
    const topic = p.getByLabel("Education topic", { exact: true }),
      method = p.getByLabel("Education method", { exact: true }),
      recipient = p.getByLabel("Education given to", { exact: true });
    await topic.fill(j.run);
    await method.selectOption("Leaflet");
    await recipient.selectOption("Patient");
    await p
      .getByRole("button", { name: "Save education record", exact: true })
      .click();
    await expect(
      p.getByRole("alert").filter({ hasText: "actual active material used" }),
    ).toBeVisible();
    assert.equal((await writes()).length, 0);
    await material.selectOption(String(j.materials[0].material_id));
    await s.fault({ delayPath: "/api/v1/education/materials", delayMs: 2200 });
    await p
      .getByRole("button", { name: "Refresh education materials", exact: true })
      .click();
    await expect(material).toBeDisabled();
    await expect(material).toHaveValue(String(j.materials[0].material_id));
    await expect(material.locator("option")).toHaveCount(2);
    await expect(material).toBeEnabled();
    await s.fault({ delayPath: null });
    await s.fault({
      failPath: "/api/v1/education/materials",
      failMethod: "GET",
      once: false,
    });
    await p
      .getByRole("button", { name: "Refresh education materials", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await expect(material).toBeDisabled();
    await expect(material).toHaveValue(String(j.materials[0].material_id));
    await p
      .getByRole("button", { name: "Save education record", exact: true })
      .click();
    await expect(
      p
        .getByRole("alert")
        .filter({ hasText: "Refresh education materials before" }),
    ).toBeVisible();
    assert.equal((await writes()).length, 0);
    await s.fault({ failPath: null });
    await p.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(material).toBeEnabled();
    await help(s, material, "Health education given");
    await expect(material).toHaveValue(String(j.materials[0].material_id));
    s.pass(
      "Required material zero POST; real delayed/failed catalogue disables stale options, preserves draft ID, refuses save, Retry restores options; F1/focus draft retained",
    );
    await p
      .getByLabel("Education note (optional)", { exact: true })
      .fill(
        "Synthetic software verification only: no actual education, care, media playback or leaflet.",
      );
    j.pending = {
      topic: j.run,
      method: "Leaflet",
      given_to: "Patient",
      material_id: j.materials[0].material_id,
      encounter_id: 1,
    };
    save();
    await s.fault({
      failPath: "/api/v1/patients/5/education",
      failMethod: "POST",
      once: true,
    });
    await p
      .getByRole("button", { name: "Save education record", exact: true })
      .dblclick();
    await expect(
      p.getByRole("button", { name: "Retry original request", exact: true }),
    ).toBeVisible();
    const first = (await writes())[0];
    assert.equal(first.status, 201);
    j.original = first;
    save();
    assert.equal((await writes()).length, 1);
    await p
      .getByRole("button", { name: "Retry original request", exact: true })
      .click();
    await expect(
      p.getByRole("button", {
        name: new RegExp(
          "Record a corrective entry for.*#" + first.result.data.education_id,
        ),
      }),
    ).toBeVisible();
    const attempts = await writes();
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].key, attempts[1].key);
    assert.deepEqual(attempts[0].body, attempts[1].body);
    assert.equal(attempts[1].replay, "true");
    assert.equal(
      attempts[1].result.data.education_id,
      first.result.data.education_id,
    );
    assert.equal(first.result.data.encounter_id, 1);
    s.pass(
      "Fresh Leaflet positive encounter1, author stamp and lost201 exact-key/body replay SAME ID; doubleclick single write",
    );
    for (const [m, to, mat] of [
      ["Video", "Both", j.materials[1]],
      ["WrittenInstructions", "Attendant", null],
      ["Demonstration", "Patient", null],
      ["Verbal", "Both", null],
    ]) {
      await topic.fill(j.run + " " + m);
      await method.selectOption(m);
      await recipient.selectOption(to);
      await material.selectOption(mat ? String(mat.material_id) : "");
      await p
        .getByLabel("Education note (optional)", { exact: true })
        .fill(
          "Synthetic software verification only. No actual clinical guidance.",
        );
      j.pending = {
        topic: j.run + " " + m,
        method: m,
        given_to: to,
        material_id: mat?.material_id ?? null,
        encounter_id: 1,
      };
      save();
      await p
        .getByRole("button", { name: "Save education record", exact: true })
        .click();
      await expect(
        p.getByRole("heading", { name: j.run + " " + m, exact: true }),
      ).toBeVisible();
      j.entries = await s.native("api", {
        method: "GET",
        path: "/patients/5/education?limit=100",
      });
      save();
    }
    const id = first.result.data.education_id;
    await p
      .getByRole("button", {
        name: new RegExp("Record a corrective entry for.*#" + id),
      })
      .click();
    await topic.fill(j.run + " clarified");
    await p
      .getByLabel("Correction explanation", { exact: true })
      .fill("Synthetic correction only; original retained. No actual care.");
    j.pending = { correction_of: id, topic: j.run + " clarified" };
    save();
    await p
      .getByRole("button", { name: "Save education record", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: j.run + " clarified", exact: true }),
    ).toBeVisible();
    j.entries = await s.native("api", {
      method: "GET",
      path: "/patients/5/education?limit=100",
    });
    assert.deepEqual(
      j.entries.find((x) => x.education_id === id),
      first.result.data,
    );
    assert(
      j.entries
        .find((x) => x.topic === j.run + " clarified")
        .note.includes("#" + id),
    );
    delete j.pending;
    save();
    await p
      .getByRole("button", { name: "Older education entries", exact: true })
      .click();
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
      p.getByRole("heading", { name: j.run + " clarified", exact: true }),
    ).toBeVisible();
    s.pass(
      "All five real method values/three recipients; Video positive; separate correction preserves original stamp/content; real cursor Older/empty/Newer",
    );
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
    for (const language of ["en", "ur"]) {
      await s.prefs({ language, theme: "Light", ui_scale_pct: 100 });
      await p.evaluate(() => scrollTo(0, 0));
      await p.screenshot({
        path: `public/handbook/patient_education-${language}.png`,
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
    s.pass(
      "Native keys upper/lower/reset and shared settings250; English/Urdu both themes250 no overflow; refreshed full-page synthetic handbook images",
    );
    s.j.passed = true;
    s.save();
    j.passed = true;
    save();
  }
} catch (e) {
  s.j.error = e.stack;
  s.save();
  console.error(e.stack);
  try {
    await p.screenshot({ path: "artifacts/phase2-education-failure.png" });
    fs.writeFileSync(
      "artifacts/phase2-education-ui.txt",
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
