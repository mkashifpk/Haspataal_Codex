import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { estimateView } from "../src/estimate-access.ts";
const native = createRequire(import.meta.url)(
  "../electron/estimate-access.cjs",
);
test("Billing estimates use the unscoped catalogue view, admissions require the service view, and explicit hidden views prevail", () => {
  const est = { views: { screens: [] } };
  assert.equal(estimateView("cost_estimates_billing", est), "full");
  assert.equal(estimateView("explain_estimate", est), "full");
  assert.equal(native.estimateView("explain_estimate", est), "full");
  assert.equal(estimateView("cost_estimates_admissions", est), undefined);
  for (const id of ["cost_estimates_admissions", "cost_estimates_billing", "explain_estimate"])
    for (const view of ["full", "records", "hidden", "open_work"]) {
      const e = { views: { screens: [{ screen_id: id, view }] } };
      assert.equal(estimateView(id, e), view);
      assert.equal(native.estimateView(id, e), view);
    }
  assert.throws(() => native.estimateView("settings", est));
});
