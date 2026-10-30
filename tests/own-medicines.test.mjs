import test from "node:test";
import assert from "node:assert/strict";
import {
  ownMedicinesAccess,
  validateRecordLines,
  validateHandBack,
  validateDestroy,
  isHeldMedicine,
} from "../src/own-medicines-policy.ts";

test("own medicines access follows establishment screen view and permissions", () => {
  const perms = [
    "patient.own_medicine.record",
    "medication.safety.view",
    "patient.wristband.print",
  ];
  // full view
  const full = ownMedicinesAccess("full", perms);
  assert.equal(full.read, true);
  assert.equal(full.record, true);
  assert.equal(full.handBack, true);
  assert.equal(full.destroy, true);
  assert.equal(full.worklist, true);

  // open_work view allows recording and hand-backs
  const openWork = ownMedicinesAccess("open_work", perms);
  assert.equal(openWork.read, true);
  assert.equal(openWork.record, true);
  assert.equal(openWork.handBack, true);
  assert.equal(openWork.destroy, true);

  // records view disables new recording but allows reading and hand-backs/destruction of held stock
  const records = ownMedicinesAccess("records", perms);
  assert.equal(records.read, true);
  assert.equal(records.record, false);
  assert.equal(records.handBack, true);
  assert.equal(records.destroy, true);

  // hidden and setup views fail closed
  for (const v of ["hidden", "setup", undefined]) {
    const closed = ownMedicinesAccess(v, perms);
    assert.equal(closed.read, false);
    assert.equal(closed.record, false);
    assert.equal(closed.handBack, false);
    assert.equal(closed.destroy, false);
  }

  // user without permissions fails closed
  const noPerms = ownMedicinesAccess("full", []);
  assert.equal(noPerms.read, false);
  assert.equal(noPerms.record, false);
  assert.equal(noPerms.handBack, false);
  assert.equal(noPerms.destroy, false);
  assert.equal(noPerms.worklist, false);
});

test("validateRecordLines validates brought_by, pack limits, and individual line constraints", () => {
  // Valid lines
  const valid = validateRecordLines("Patient herself", "Ward", [
    {
      medicine_name: "  Augmentin 625mg  ",
      strength: " 625mg ",
      form: " Tablet ",
      quantity: " 10 tabs ",
      batch_no: " B9921 ",
      expiry_date: "2027-12-31",
    },
  ]);
  assert.equal(valid.brought_by, "Patient herself");
  assert.equal(valid.stored_at, "Ward");
  assert.equal(valid.medicines.length, 1);
  assert.equal(valid.medicines[0].medicine_name, "Augmentin 625mg");
  assert.equal(valid.medicines[0].strength, "625mg");
  assert.equal(valid.medicines[0].quantity, "10 tabs");
  assert.equal(valid.medicines[0].batch_no, "B9921");
  assert.equal(valid.medicines[0].expiry_date, "2027-12-31");

  // Missing brought_by
  assert.throws(() => validateRecordLines("   ", "Ward", [{ medicine_name: "Panadol", quantity: "1" }]), /brought the medicines/);
  // Too long brought_by
  assert.throws(() => validateRecordLines("x".repeat(121), "Ward", [{ medicine_name: "Panadol", quantity: "1" }]), /120 characters/);
  // Empty lines array
  assert.throws(() => validateRecordLines("Self", "Ward", []), /at least one/);
  // > 50 lines
  const fiftyOne = Array.from({ length: 51 }, () => ({ medicine_name: "A", quantity: "1" }));
  assert.throws(() => validateRecordLines("Self", "Ward", fiftyOne), /maximum of 50/);
  // Missing medicine_name
  assert.throws(() => validateRecordLines("Self", "Ward", [{ medicine_name: " ", quantity: "1" }]), /Medicine name is required/);
  // Medicine name > 200
  assert.throws(() => validateRecordLines("Self", "Ward", [{ medicine_name: "x".repeat(201), quantity: "1" }]), /200 characters/);
  // Missing quantity
  assert.throws(() => validateRecordLines("Self", "Ward", [{ medicine_name: "Panadol", quantity: " " }]), /Quantity is required/);
  // Invalid expiry date format
  assert.throws(() => validateRecordLines("Self", "Ward", [{ medicine_name: "Panadol", quantity: "1", expiry_date: "31-12-2027" }]), /Invalid expiry date/);
});

test("validateHandBack checks recipient and optional medicine identifiers", () => {
  const valid = validateHandBack("Son Kamran", [10, 20]);
  assert.equal(valid.handed_to, "Son Kamran");
  assert.deepEqual(valid.own_medicine_ids, [10, 20]);

  // Default: all held (omitted ids)
  const allHeld = validateHandBack("Patient herself");
  assert.equal(allHeld.handed_to, "Patient herself");
  assert.equal(allHeld.own_medicine_ids, undefined);

  // Missing recipient
  assert.throws(() => validateHandBack(" "), /handed to/);
  // Recipient > 120 chars
  assert.throws(() => validateHandBack("a".repeat(121)), /120 characters/);
  // Invalid id
  assert.throws(() => validateHandBack("Self", [0]), /Invalid medicine identifier/);
  assert.throws(() => validateHandBack("Self", [-5]), /Invalid medicine identifier/);
});

test("validateDestroy checks reason and witness boundaries", () => {
  const valid = validateDestroy("Expired pack, patient agreed to safe destruction", "Staff Nurse Zainab");
  assert.equal(valid.reason, "Expired pack, patient agreed to safe destruction");
  assert.equal(valid.witness, "Staff Nurse Zainab");

  // Reason too short
  assert.throws(() => validateDestroy("no", "Nurse"), /at least 3 characters/);
  // Reason too long
  assert.throws(() => validateDestroy("x".repeat(301), "Nurse"), /300 characters or fewer/);
  // Witness too short
  assert.throws(() => validateDestroy("Expired pack", "N"), /at least 2 characters/);
  // Witness too long
  assert.throws(() => validateDestroy("Expired pack", "x".repeat(121)), /120 characters or fewer/);
});

test("isHeldMedicine identifies Received and Retained packs", () => {
  assert.equal(isHeldMedicine({ status: "Received" }), true);
  assert.equal(isHeldMedicine({ status: "Retained" }), true);
  assert.equal(isHeldMedicine({ status: "Returned" }), false);
  assert.equal(isHeldMedicine({ status: "Destroyed" }), false);
});
