import type {
  OwnMedicinesIn,
  OwnMedicineLineIn,
  OwnMedicineHandBackIn,
  OwnMedicineDestroyIn,
  OwnMedicineOut,
} from "./generated/own_medicines_ward";

export function ownMedicinesAccess(
  view: string | undefined,
  permissions: string[],
) {
  const visible = ["full", "open_work", "records"].includes(view || "");
  const can = (p: string) => permissions.includes(p);
  return {
    read:
      visible &&
      (can("patient.own_medicine.record") ||
        can("patient.own_medicine.identify") ||
        can("prescription.view")),
    record:
      visible &&
      view !== "records" &&
      can("patient.own_medicine.record"),
    handBack: visible && can("patient.own_medicine.record"),
    destroy: visible && can("patient.own_medicine.record"),
    worklist:
      visible &&
      (can("medication.safety.view") || can("patient.wristband.print")),
  };
}

export function validateRecordLines(
  broughtBy: string,
  storedAt: "Ward" | "Pharmacy",
  lines: OwnMedicineLineIn[],
): OwnMedicinesIn {
  const by = broughtBy.trim();
  if (!by) {
    throw new Error("Enter who brought the medicines (patient or attendant name & relation).");
  }
  if (by.length > 120) {
    throw new Error("Brought by must be 120 characters or fewer.");
  }
  if (!lines || lines.length === 0) {
    throw new Error("Add at least one medicine pack line.");
  }
  if (lines.length > 50) {
    throw new Error("A maximum of 50 packs can be recorded in one batch.");
  }
  const cleanLines = lines.map((l, index) => {
    const name = (l.medicine_name || "").trim();
    if (!name) {
      throw new Error(`Medicine name is required for line ${index + 1}.`);
    }
    if (name.length > 200) {
      throw new Error(`Medicine name in line ${index + 1} must be 200 characters or fewer.`);
    }
    const qty = (l.quantity || "").trim();
    if (!qty) {
      throw new Error(`Quantity is required for line ${index + 1}.`);
    }
    if (qty.length > 50) {
      throw new Error(`Quantity in line ${index + 1} must be 50 characters or fewer.`);
    }
    const strength = l.strength?.trim() || null;
    const form = l.form?.trim() || null;
    const batch_no = l.batch_no?.trim() || null;
    const expiry_date = l.expiry_date?.trim() || null;
    if (expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
      throw new Error(`Invalid expiry date in line ${index + 1}; use YYYY-MM-DD.`);
    }
    return {
      medicine_name: name,
      quantity: qty,
      strength: strength || undefined,
      form: form || undefined,
      batch_no: batch_no || undefined,
      expiry_date: expiry_date || undefined,
    };
  });

  return {
    brought_by: by,
    stored_at: storedAt,
    medicines: cleanLines,
  };
}

export function validateHandBack(
  handedTo: string,
  selectedIds?: number[],
): OwnMedicineHandBackIn {
  const to = handedTo.trim();
  if (!to) {
    throw new Error("Enter who the medicines are handed to (patient or attendant name & relation).");
  }
  if (to.length > 120) {
    throw new Error("Handed to must be 120 characters or fewer.");
  }
  if (selectedIds && selectedIds.length > 0) {
    for (const id of selectedIds) {
      if (!Number.isSafeInteger(id) || id < 1) {
        throw new Error("Invalid medicine identifier selected.");
      }
    }
  }
  return {
    handed_to: to,
    own_medicine_ids: selectedIds && selectedIds.length > 0 ? selectedIds : undefined,
  };
}

export function validateDestroy(
  reason: string,
  witness: string,
): OwnMedicineDestroyIn {
  const r = reason.trim();
  if (r.length < 3) {
    throw new Error("Destruction reason must be at least 3 characters.");
  }
  if (r.length > 300) {
    throw new Error("Destruction reason must be 300 characters or fewer.");
  }
  const w = witness.trim();
  if (w.length < 2) {
    throw new Error("Witness name and role must be at least 2 characters.");
  }
  if (w.length > 120) {
    throw new Error("Witness name and role must be 120 characters or fewer.");
  }
  return {
    reason: r,
    witness: w,
  };
}

export function isHeldMedicine(item: OwnMedicineOut): boolean {
  return item.status === "Received" || item.status === "Retained";
}
