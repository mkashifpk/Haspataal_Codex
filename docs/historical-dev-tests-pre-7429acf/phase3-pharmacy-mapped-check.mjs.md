# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Continuation ONLY: RX2 already supplied; no repeat of earlier business tests.
import { session, expect, help } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const file = "artifacts/phase3-pharmacy-mapped-ui-v3.json";
assert(!fs.existsSync(file), "Reconcile existing original journal");
const prior = JSON.parse(
  fs.readFileSync("artifacts/phase3-pharmacy-cash-ui.json"),
);
assert(
  prior.remainder.prescription.status === "FullyDispensed" && !prior.pending,
);
const terminal = JSON.parse(
  fs.readFileSync("artifacts/phase3-finish-terminal.json"),
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
  s = await session("phase3-pharmacy-mapped-profile", "demo.pharmacist");
  const p = s.p;
  // Emulate hardware identity ONLY, backed by a real owned DEV mapping. No server answers are mocked.
  await s.app.evaluate((_, mac) => {
    const https = process.getBuiltinModule("https"),
      original = https.request;
    https.request = function (url, options, callback) {
      const object = typeof url === "object" && !(url instanceof URL);
      const opts = object ? url : options;
      opts.headers = { ...opts.headers, "X-Terminal-Mac": mac };
      return original.call(this, url, options, callback);
    };
  }, terminal.mac);
  const who = await s.native("api", {
    method: "GET",
    path: "/terminals/whoami",
  });
  assert.equal(who.registered, true);
  assert.equal(who.mac, terminal.mac);
  assert.equal(who.cash_node, "PharmacyCounter");
  const mine = () =>
    s.native("api", {
      method: "GET",
      path: "/finance/cash-shifts/mine?node=PharmacyCounter",
    });
  async function closeOwn(label) {
    const d = await mine();
    assert.equal(d.user_id, 19);
    assert.equal(d.node, "PharmacyCounter");
    j[label + "Before"] = d;
    save();
    await s.nav("My cash shift");
    await expect(
      p.getByLabel("Counted cash in drawer", { exact: true }),
    ).toBeEnabled();
    await p
      .getByLabel("Counted cash in drawer", { exact: true })
      .fill(String(d.expected_cash));
    await p.getByRole("button", { name: "Close shift", exact: true }).click();
    const modal = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", {
          name: "Confirm Shift Closure",
          exact: true,
        }),
      });
    j.pending = {
      step: label,
      path: "/finance/cash-shifts/" + d.shift_id + "/close",
      declared_cash: d.expected_cash,
    };
    save();
    await modal
      .getByRole("button", { name: "Confirm & Close Shift", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await s.native("api", {
              method: "GET",
              path: "/finance/cash-shifts/" + d.shift_id,
            })
          ).status,
      )
      .toBe("PendingCollection");
    const closed = await s.native("api", {
      method: "GET",
      path: "/finance/cash-shifts/" + d.shift_id,
    });
    assert.equal(closed.status, "PendingCollection");
    assert.equal(closed.declared_cash, d.expected_cash);
    assert.equal(closed.declared_variance, 0);
    await expect(p.locator("main")).toContainText("0");
    j[label + "After"] = closed;
    delete j.pending;
    save();
    return closed;
  }
  const previous = JSON.parse(
    fs.readFileSync("artifacts/phase3-shift1-reconciled.json"),
  ).body.data;
  assert.equal(previous.status, "PendingCollection");
  assert.equal(previous.declared_variance, 0);
  assert.equal(await mine(), null);
  j.originalDrawerAfter = previous;
  save();
  await s.nav("My cash shift");
  pass(
    "Own earlier cash-dispense shift closed through mapped UI, whole server drawer counted including float, zero server variance",
  );
  if (
    await p
      .getByRole("button", { name: "Show my current shift", exact: true })
      .count()
  )
    await p
      .getByRole("button", { name: "Show my current shift", exact: true })
      .click();
  await expect(p.getByLabel("Opening float", { exact: true })).toBeVisible();
  await p.getByLabel("Opening float", { exact: true }).fill("1500");
  j.pending = {
    step: "open mapped own drawer",
    path: "/finance/cash-shifts/open",
    node: "PharmacyCounter",
    opening_float: 1500,
  };
  save();
  await p.getByRole("button", { name: "Open cash shift", exact: true }).click();
  await expect(
    p.getByLabel("Counted cash in drawer", { exact: true }),
  ).toBeVisible();
  const opened = await mine();
  assert.equal(opened.expected_cash, 1500);
  assert.equal(opened.terminal_id, terminal.terminal_id);
  j.opened = opened;
  delete j.pending;
  save();
  await expect(p.locator("main")).toContainText("Opening float");
  await help(
    s,
    p.getByLabel("Counted cash in drawer", { exact: true }),
    "My cash shift",
  );
  pass(
    "Pharmacy-scoped real mapped UI opening1500, exact server expected_cash1500 and Opening float ledger/totals, contextual F1",
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
        .fill("DEMO software-only, no card processed");
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
      drug_id: 1,
      qty: 1,
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
    const writes = (await s.trace()).requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/otc-sales"),
    );
    assert.equal(writes.length, method === "Cash" ? 1 : 2);
    assert.equal(writes.at(-1).status, 201);
    j["otc" + method] = {
      response: writes.at(-1).result,
      drawer: await mine(),
    };
    delete j.pending;
    save();
  }
  assert(j.otcCash.drawer.expected_cash > 1500);
  assert.equal(j.otcCard.drawer.expected_cash, j.otcCash.drawer.expected_cash);
  assert(
    j.otcCard.drawer.non_cash.some((x) => x.method === "Card" && x.count === 1),
  );
  pass(
    "Actual OTC Cash and Card201 on owned mapped Pharmacy drawer: Cash increases own server expected_cash, Card leaves it unchanged/noncash recorded, one POST each",
  );
  await help(
    s,
    p.getByLabel("Medicine name, code or barcode", { exact: true }),
    "OTC mode",
  );
  await closeOwn("finalDrawer");
  assert.equal(await mine(), null);
  pass(
    "Final own mapped shift closed through UI; entire drawer including float declared, server variance0 and mine null; no other shift touched",
  );
  j.passed = true;
} catch (e) {
  j.error = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  if (s) await s.close();
  j.finished = new Date().toISOString();
  save();
}

```
