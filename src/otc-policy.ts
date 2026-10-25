import type { DrugStockOut, OtcIn } from "./generated/otc";
export type OtcBasketLine = {
  drug: DrugStockOut;
  qty: string;
  barcode?: string;
};
export const prescriptionRequired =
  "Prescription required. Cannot sell via OTC.";
export const otcReadable = (view: string) =>
  ["full", "open_work", "records"].includes(view);
export const otcWritable = (
  permissions: string[],
  view: string,
  active: string[],
) =>
  permissions.includes("pharmacy.otc.sell") &&
  view === "full" &&
  active.includes("dispensing");
export function otcQuantity(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim()))
    throw new Error("Enter a positive quantity without exponent notation.");
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new Error("Enter a positive quantity without exponent notation.");
  return n;
}
export function requireOtcDrug(drug: DrugStockOut) {
  if (!drug.is_active)
    throw new Error("This medicine is inactive. Refresh the formulary.");
  if (
    !drug.is_otc_allowed ||
    drug.schedule !== "OTC" ||
    drug.high_alert_category ||
    drug.is_restricted
  )
    throw new Error(prescriptionRequired);
}
export const otcDrugIdentity = (d: DrugStockOut) =>
  JSON.stringify([
    d.drug_id,
    d.name,
    d.code,
    d.barcode,
    d.unit,
    d.strength,
    d.form,
    d.schedule,
    d.is_active,
    d.is_otc_allowed,
    d.high_alert_category,
    d.is_restricted,
  ]);
export function makeOtcSale(
  lines: OtcBasketLine[],
  method: string,
  reference: string,
  name: string,
  mobile: string,
): OtcIn {
  if (!lines.length || lines.length > 50)
    throw new Error("Add between 1 and 50 different medicines.");
  if (
    !["Cash", "Card"].includes(method) ||
    name.trim().length > 100 ||
    mobile.trim().length > 30
  )
    throw new Error("Check the payment method and customer details.");
  const seen = new Set<number>();
  const items = lines.map((line) => {
    requireOtcDrug(line.drug);
    const qty = otcQuantity(line.qty);
    if (seen.has(line.drug.drug_id))
      throw new Error(
        "This medicine is already in the basket. Edit its quantity.",
      );
    seen.add(line.drug.drug_id);
    if (
      qty > line.drug.qty_available ||
      line.drug.stock_status === "OutOfStock"
    )
      throw new Error(
        "The quantity exceeds current available stock. Refresh and review.",
      );
    if (line.barcode && line.barcode !== line.drug.barcode)
      throw new Error(
        "The scanned medicine changed. Remove it and scan again.",
      );
    return line.barcode
      ? { barcode: line.barcode, qty: line.qty.trim() }
      : { drug_id: line.drug.drug_id, qty: line.qty.trim() };
  });
  return {
    items,
    method: method as "Cash" | "Card",
    reference_no: method === "Card" ? reference.trim() || null : null,
    customer_name: name.trim() || null,
    customer_mobile: mobile.trim() || null,
  };
}
