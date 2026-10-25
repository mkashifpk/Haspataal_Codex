import test from "node:test";
import assert from "node:assert/strict";
import {
  makeOtcSale,
  otcQuantity,
  otcWritable,
  otcReadable,
  prescriptionRequired,
  otcDrugIdentity,
} from "../src/otc-policy.ts";
const drug = () => ({
  drug_id: 1,
  name: "Synthetic OTC",
  code: "DEMO",
  barcode: "00123",
  unit: "unit",
  strength: null,
  form: "Tablet",
  schedule: "OTC",
  is_active: true,
  is_otc_allowed: true,
  high_alert_category: null,
  is_restricted: false,
  qty_available: 10,
  stock_status: "InStock",
});
const sale = (lines) => makeOtcSale(lines, "Cash", "ignored", "", "");
test("OTC preserves scanned leading zeros, exact request identity, positive decimal units and optional customer fields", () => {
  const r = makeOtcSale(
    [{ drug: drug(), barcode: "00123", qty: "2.5" }],
    "Card",
    " test ref ",
    " Synthetic ",
    " 123 ",
  );
  assert.deepEqual(r, {
    items: [{ barcode: "00123", qty: "2.5" }],
    method: "Card",
    reference_no: "test ref",
    customer_name: "Synthetic",
    customer_mobile: "123",
  });
  assert.deepEqual(sale([{ drug: drug(), qty: "1" }]).items, [
    { drug_id: 1, qty: "1" },
  ]);
  assert.equal(sale([{ drug: drug(), qty: "1" }]).reference_no, null);
  for (const n of ["", "0", "-1", "1x", "1e3", "NaN", "Infinity"])
    assert.throws(() => otcQuantity(n));
});
test("OTC cannot sell prescription/high-alert/restricted/inactive lines, duplicates, missing/too many items or stale scanned identities", () => {
  for (const change of [
    { is_otc_allowed: false },
    { schedule: "ScheduleH" },
    { high_alert_category: "Insulin" },
    { is_restricted: true },
  ])
    assert.throws(() => sale([{ drug: { ...drug(), ...change }, qty: "1" }]), {
      message: prescriptionRequired,
    });
  for (const lines of [
    [],
    [{ drug: { ...drug(), is_active: false }, qty: "1" }],
    [{ drug: drug(), qty: "11" }],
    [{ drug: drug(), qty: "1", barcode: "wrong" }],
    [
      { drug: drug(), qty: "1" },
      { drug: drug(), qty: "1" },
    ],
    Array.from({ length: 51 }, (_, i) => ({
      drug: { ...drug(), drug_id: i + 1 },
      qty: "1",
    })),
  ])
    assert.throws(() => sale(lines));
  assert.throws(() =>
    makeOtcSale([{ drug: drug(), qty: "1" }], "Card", "", "x".repeat(101), ""),
  );
});
test("new OTC sales need both permission and Active/full; retirement permits reads but never a new sale", () => {
  assert(otcWritable(["pharmacy.otc.sell"], "full", ["dispensing"]));
  assert(!otcWritable([], "full", ["dispensing"]));
  assert(!otcWritable(["pharmacy.otc.sell"], "full", []));
  for (const view of ["records", "open_work", "setup", "hidden", ""])
    assert(!otcWritable(["pharmacy.otc.sell"], view, ["dispensing"]));
  for (const v of ["full", "records", "open_work"]) assert(otcReadable(v));
  for (const v of ["setup", "hidden", ""]) assert(!otcReadable(v));
  assert.equal(
    otcDrugIdentity(drug()),
    otcDrugIdentity({ ...drug(), qty_available: 9 }),
  );
  assert.notEqual(
    otcDrugIdentity(drug()),
    otcDrugIdentity({ ...drug(), barcode: "changed" }),
  );
});
