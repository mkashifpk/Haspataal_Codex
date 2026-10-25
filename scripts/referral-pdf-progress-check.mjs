// Real current cancelled synthetic letter, read-only. --baseline records the missing pending state.
import fs from "node:fs";
import assert from "node:assert/strict";
import { session, expect, help } from "./clinical-test-kit.mjs";
const doctor = process.argv.includes("--doctor");
const base = process.argv.includes("--baseline"),
  fixture = JSON.parse(
    fs.readFileSync("docs/reset-referral-register-evidence-2026-10-25.json"),
  );
assert(fixture.passed);
const id = fixture.created.result.data.referral_id;
const s = await session(
    base
      ? "referral-pdf-progress-baseline"
      : doctor
        ? "referral-pdf-progress-doctor"
        : "referral-pdf-progress",
    doctor ? "demo.doctor" : "demo.quality",
  ),
  p = s.p;
try {
  const actual = await s.native("api", {
    method: "GET",
    path: "/referrals/" + id,
  });
  assert.equal(actual.reason, fixture.run);
  assert.equal(actual.status, "Cancelled");
  if (doctor) {
    const ticket = await s.native("api", {
      method: "GET",
      path: "/opd-tickets/" + actual.ticket_id,
    });
    assert.equal(ticket.patient_id, actual.patient_id);
    await s.nav("Consultation (EMR)");
    await p
      .getByLabel("OPD slip number", { exact: true })
      .fill(ticket.ticket_number);
    await p.getByLabel("OPD slip number", { exact: true }).press("Enter");
    await expect(p.locator("main")).toContainText(actual.mrn);
    await p
      .getByRole("button", { name: "External referral", exact: true })
      .click();
    await p
      .getByRole("button", { name: actual.referral_number, exact: true })
      .click();
  } else {
    await s.nav("Referral register");
    await p
      .getByRole("button", {
        name: "Open referral " + actual.referral_number,
        exact: true,
      })
      .click();
  }
  const pdf = p.getByRole("button", {
      name: "Save referral letter PDF",
      exact: true,
    }),
    preview = p.getByRole("button", {
      name: "Open referral letter / print",
      exact: true,
    });
  await expect(pdf).toBeVisible();
  await s.app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await s.fault({ delayPath: "/referrals/" + id + "/pdf", delayMs: 1800 });
  const count = async () =>
      (await s.trace()).requests.filter(
        (r) => r.path === "/api/v1/referrals/" + id + "/pdf",
      ).length,
    before = await count();
  await pdf.evaluate((b) => {
    b.click();
    b.click();
  });
  if (base) {
    s.j.missing_pending = !(await pdf.isDisabled());
    assert(s.j.missing_pending);
    await expect(
      p.getByText("Save cancelled; referral remains in the record.", {
        exact: true,
      }),
    ).toBeVisible();
    s.j.observed_requests = (await count()) - before;
    s.j.passed = true;
    console.log(
      "BASELINE confirmed: PDF controls stay enabled during actual delayed read; double-click makes duplicate reads",
    );
  } else {
    await expect(pdf).toBeDisabled();
    await expect(preview).toBeDisabled();
    await expect(
      p.getByText("Preparing referral PDF…", { exact: true }),
    ).toBeVisible();
    await expect(
      p.getByText("Save cancelled; referral remains in the record.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(pdf).toBeEnabled();
    assert.equal((await count()) - before, 1);
    await s.fault({
      delayPath: null,
      failPath: "/referrals/" + id + "/pdf",
      failMethod: "GET",
      once: false,
    });
    await pdf.click();
    const record = p.locator(
      'section.card[data-help-screen="' +
        (doctor ? "external_referral" : "referral_register") +
        '"]',
    );
    await expect(record.getByRole("alert")).toBeVisible({ timeout: 60000 });
    await expect(pdf).toBeEnabled();
    await expect(preview).toBeEnabled();
    await s.fault({ failPath: null });
    await pdf.click();
    await expect(
      p.getByText("Save cancelled; referral remains in the record.", {
        exact: true,
      }),
    ).toBeVisible();
    await help(
      s,
      pdf,
      doctor ? "Refer out (external referral)" : "Referral register",
    );
    await s.prefs({ language: "ur", theme: "Light", ui_scale_pct: 100 });
    await s.fault({ delayPath: "/referrals/" + id + "/pdf", delayMs: 1800 });
    const ur = p.getByRole("button", {
      name: "حوالے کا خط پی ڈی ایف محفوظ کریں",
      exact: true,
    });
    await ur.click();
    await expect(
      p.getByText("حوالے کی پی ڈی ایف تیار ہو رہی ہے…", { exact: true }),
    ).toBeVisible();
    await expect(ur).toBeDisabled();
    await expect(
      p.getByText("محفوظ کرنا منسوخ؛ حوالہ ریکارڈ میں ہے۔", { exact: true }),
    ).toBeVisible();
    assert.equal(
      (await s.trace()).requests.filter((r) => r.method !== "GET").length,
      0,
    );
    s.j.passed = true;
    console.log(
      "PASS PDF preparing/double-click guard/cancel/error/recovery/F1/Urdu; actual server reads, zero business writes",
    );
  }
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
      async () => {
        const r = await p.evaluate(() =>
          window.terminal.call("api", { method: "GET", path: "/auth/me" }),
        );
        return r.ok;
      },
      { timeout: 60000 },
    )
    .toBe(true);
  await s.close();
  fs.writeFileSync(
    "docs/" +
      (base
        ? "referral-pdf-progress-baseline"
        : doctor
          ? "referral-pdf-progress-doctor-evidence"
          : "referral-pdf-progress-evidence") +
      "-2026-10-25.json",
    JSON.stringify(s.j, null, 2),
  );
}
