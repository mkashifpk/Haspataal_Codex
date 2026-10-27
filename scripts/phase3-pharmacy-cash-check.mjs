// Own synthetic PharmacyCounter drawer; no terminal remapping, real stock/money or paper.
import { session, expect, help } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/phase3-pharmacy-cash-ui.json";
assert(!fs.existsSync(file), "Reconcile original writes before restart");
const rx = JSON.parse(
  fs.readFileSync("artifacts/phase3-finish-opd-ticket-rx.json"),
).result.body.data;
const shift = JSON.parse(
  fs.readFileSync("artifacts/phase3-finish-open-shift.json"),
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
  s = await session("phase3-pharmacy-cash-profile", "demo.pharmacist");
  const p = s.p;
  const drawer = () =>
    s.native("api", {
      method: "GET",
      path: "/finance/cash-shifts/mine?node=PharmacyCounter",
    });
  const initial = await drawer();
  assert.equal(initial.shift_id, shift.shift_id);
  assert.equal(initial.user_id, shift.user_id);
  assert.equal(initial.expected_cash, 1500);
  j.initial = initial;
  save();
  await s.nav("Dispense");
  await p
    .getByLabel("Prescription ID", { exact: true })
    .fill(String(rx.prescription_id));
  await p
    .getByRole("button", { name: "Open prescription", exact: true })
    .click();
  await expect(p.locator("main")).toContainText(rx.prescription_number);
  for (const step of ["partial", "remainder"]) {
    await p
      .getByLabel("Dispense Now #" + rx.items[0].prescription_item_id, {
        exact: true,
      })
      .fill("1");
    const mode = p.getByLabel("Payment mode", { exact: true });
    await expect(mode.locator('option[value="Cash"]')).not.toHaveAttribute(
      "disabled",
    );
    await mode.selectOption("Cash");
    await p
      .getByRole("button", { name: "Review dispensing", exact: true })
      .click();
    const modal = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("button", {
          name: "Confirm pharmacy action",
          exact: true,
        }),
      });
    await modal
      .getByLabel(
        "I verified this patient, order, quantities and payment mode.",
        { exact: true },
      )
      .check();
    j.pending = {
      step,
      path: "/prescriptions/" + rx.prescription_id + "/dispense",
      quantity: 1,
      method: "Cash",
    };
    save();
    await modal
      .getByRole("button", { name: "Confirm pharmacy action", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    const saved = await s.native("api", {
      method: "GET",
      path: "/prescriptions/" + rx.prescription_id,
    });
    assert.equal(saved.dispensations.length, step === "partial" ? 1 : 2);
    assert.equal(saved.items[0].qty_remaining, step === "partial" ? 1 : 0);
    j[step] = { prescription: saved, drawer: await drawer() };
    delete j.pending;
    save();
  }
  const finalRx = j.remainder.prescription;
  assert.equal(finalRx.status, "FullyDispensed");
  assert(finalRx.dispensations.every((d) => d.payment_mode === "Cash"));
  const writeTrace = (await s.trace()).requests.filter(
    (r) => r.method === "POST" && r.path.endsWith("/dispense"),
  );
  assert.equal(writeTrace.length, 2);
  pass(
    "Own PharmacyCounter nonzero float1500; actual Cash UI partial and remainder, two deliberate supplies, FEFO/server amounts and final FullyDispensed",
  );
  await s.nav("OTC mode");
  for (const method of ["Cash", "Card"]) {
    await p
      .getByLabel("Medicine name, code or barcode", { exact: true })
      .fill("PCM-500");
    await p
      .getByRole("button", { name: "Search medicines", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Add medicine #1", exact: true })
      .click();
    await p.getByLabel("Sale quantity #1", { exact: true }).fill("1");
    await p
      .getByLabel("Customer name (optional)", { exact: true })
      .fill("DEMO-PHASE3-FINISH " + method);
    await p
      .getByLabel("OTC payment method", { exact: true })
      .selectOption(method);
    if (method === "Card")
      await p
        .getByLabel("Card reference (optional)", { exact: true })
        .fill("DEMO software-only card, no card processed");
    await p
      .getByRole("button", { name: "Review OTC sale", exact: true })
      .click();
    const modal = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", { name: "Confirm OTC sale", exact: true }),
      });
    j.pending = {
      step: "OTC " + method,
      path: "/otc-sales",
      qty: 1,
      drug_id: 1,
      method,
    };
    save();
    await modal
      .getByRole("button", { name: "Confirm OTC sale", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(
      p.getByRole("heading", { name: "Last confirmed OTC sale", exact: true }),
    ).toBeVisible();
    const trace = (await s.trace()).requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/otc-sales"),
    );
    assert.equal(trace.length, method === "Cash" ? 1 : 2);
    assert.equal(trace.at(-1).status, 201);
    j["otc" + method] = {
      response: trace.at(-1).result,
      drawer: await drawer(),
    };
    delete j.pending;
    save();
  }
  assert(j.otcCash.drawer.expected_cash > j.remainder.drawer.expected_cash);
  assert.equal(j.otcCard.drawer.expected_cash, j.otcCash.drawer.expected_cash);
  assert(
    j.otcCard.drawer.non_cash.some((x) => x.method === "Card" && x.count >= 1),
  );
  pass(
    "OTC Cash201 raises same own drawer; Card201 leaves expected_cash unchanged and appears under noncash; one write per deliberate sale",
  );
  await help(
    s,
    p.getByLabel("Medicine name, code or barcode", { exact: true }),
    "OTC mode",
  );
  j.finalDrawer = await drawer();
  j.passed = true;
  save();
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}
