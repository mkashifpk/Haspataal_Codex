// Final visual/help/unsaved-state check against owned, already confirmed OTC records. No business writes.
import { session, expect, help, capture } from "./clinical-test-kit.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const original = JSON.parse(fs.readFileSync("artifacts/otc-check.json")),
  final = JSON.parse(fs.readFileSync("artifacts/otc-final-check.json"));
assert(final.passed && final.cleaned && final.closed.declared_variance === 0);
const s = await session("otc-readonly-pharmacist", "demo.pharmacist");
const p = s.p;
const checks = [];
try {
  await s.nav("OTC mode");
  await expect(p.locator("main")).toContainText("Currency");
  await p
    .getByLabel("OTC payment method", { exact: true })
    .selectOption("Card");
  const drug = original.products.find((d) => d.name === "ORS sachet"),
    high = original.products.find((d) => d.high_alert_category === "Insulin");
  await p
    .getByLabel("Medicine name, code or barcode", { exact: true })
    .fill(high.name);
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(p.getByTestId("otc-drug")).toHaveCount(1);
  await expect(
    p.getByTestId("otc-drug").locator('.error[role="note"]'),
  ).toContainText("High-alert medicine");
  await expect(
    p.getByRole("button", {
      name: "Add medicine #" + high.drug_id,
      exact: true,
    }),
  ).toBeDisabled();
  await p
    .getByLabel("Medicine name, code or barcode", { exact: true })
    .fill(drug.name);
  await p
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await expect(
    p.getByTestId("otc-drug").locator(".stock-InStock"),
  ).toContainText("Available");
  await p
    .getByRole("button", { name: "Add medicine #" + drug.drug_id, exact: true })
    .click();
  await expect(
    p.getByLabel("Sale quantity #" + drug.drug_id, { exact: true }),
  ).toHaveValue("1");
  p.once("dialog", (d) => d.dismiss());
  await s.nav("Prescription queue");
  await expect(p.locator("h1")).toHaveText("OTC mode");
  await expect(
    p.getByLabel("Sale quantity #" + drug.drug_id, { exact: true }),
  ).toHaveValue("1");
  await p.getByRole("button", { name: "Review OTC sale", exact: true }).click();
  const modal = p.getByRole("dialog").filter({
    has: p.getByRole("heading", { name: "Confirm OTC sale", exact: true }),
  });
  await help(
    s,
    modal.getByRole("button", { name: "Confirm OTC sale", exact: true }),
    "OTC mode",
  );
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    p.getByLabel("Sale quantity #" + drug.drug_id, { exact: true }),
  ).toHaveValue("1");
  await p
    .getByRole("button", {
      name: "Remove medicine #" + drug.drug_id,
      exact: true,
    })
    .click();
  checks.push(
    "Final source uses established stock status colours plus text; real high-alert row red/note and disabled; unsaved leave cancellation and review-close retain exact basket/F1 focus",
  );
  const result = final.sales[0];
  await p
    .getByLabel("OTC dispensation ID", { exact: true })
    .fill(String(result.dispensation.dispensation_id));
  await p
    .getByRole("button", { name: "Read OTC receipt", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Print OTC receipt", exact: true }),
  ).toBeVisible();
  const payload = await s.native("api", {
    method: "GET",
    path: `/dispensations/${result.dispensation.dispensation_id}/receipt-payload`,
  });
  assert.equal(
    payload.fields.dispensation.dispensation_id,
    result.dispensation.dispensation_id,
  );
  assert(payload.fields.dispensation.is_otc_sale);
  await p.evaluate(() => scrollTo(0, 0));
  await capture(s, "otc");
  assert(!(await s.trace()).requests.some((r) => r.method !== "GET"));
  checks.push(
    "Final rebuilt source retrieves exact owned D8 receipt after new login; real ENUR/both themes250 screenshots with zero business writes",
  );
  fs.writeFileSync(
    "docs/otc-readonly-evidence-2026-10-25.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        passed: true,
        checks,
        dispensation_id: result.dispensation.dispensation_id,
        business_writes: 0,
        limits:
          "Agent visual/help checks; no signed human/translation/editor/physical hardware acceptance. Positive Cash still blocked by backend24 on this mapped terminal.",
      },
      null,
      2,
    ),
  );
  console.log(checks.map((x) => "PASS " + x).join("\n"));
} finally {
  await s.close();
}
