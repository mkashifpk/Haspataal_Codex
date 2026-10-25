import type { PrescriptionDetailOut, DispenseLineIn } from "./generated/dispense";
export function dispenseQuantity(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return undefined;
  const n = Number(value);return Number.isFinite(n) && n > 0 ? n : undefined;
}
export function openQuery(p: PrescriptionDetailOut, itemId: number) {
  return p.queries.some(q => q.status === "Open" && (q.prescription_item_id === null || q.prescription_item_id === itemId));
}
export function selectedDispenseLines(p: PrescriptionDetailOut, quantities: Record<number,string>): DispenseLineIn[] {
  const result: DispenseLineIn[]=[];
  for(const [id,text] of Object.entries(quantities)) {
    if (!text.trim()) continue;
    const item=p.items.find(i => i.prescription_item_id===Number(id)),qty=dispenseQuantity(text);
    if(!item || qty===undefined || qty>item.qty_remaining || item.item_status!=="Active" || item.is_external || openQuery(p,item.prescription_item_id)) throw new Error("Check quantities and open queries before dispensing.");
    result.push({prescription_item_id:item.prescription_item_id,qty:text.trim()});
  }
  if(!result.length)throw new Error("Enter a quantity for at least one available line.");
  return result;
}
export const dispensingAllowed = (permissions:string[],view:string,active:string[],retiring:string[]) => permissions.includes("pharmacy.dispense") && ["full","open_work"].includes(view) && (active.includes("dispensing") || retiring.includes("dispensing"));
export const dispenseSnapshot = (p:PrescriptionDetailOut,patientVersion:number) => JSON.stringify([p.prescription_id,p.patient_id,p.destination,p.status,p.row_version,patientVersion,p.items,p.queries]);
