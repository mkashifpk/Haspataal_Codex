import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  admissionBody,
  emptyAdmissionDraft,
  admissionAccess,
  admissionActionAllowed,
  admissionSnapshot,
  admissionPatientSnapshot,
} from "../src/admissions-policy.ts";
import { hasBlockingWrite } from "../src/independent-write.ts";
import { refusalReadPath } from "../src/refusal-recovery.ts";
const j = JSON.parse(
  fs.readFileSync("docs/pending-admissions-live-2026-10-28.json"),
);
const get = (n) =>
  structuredClone(j.requests.find((x) => x.label === n).result.body.data);
test("admission safeguards use current server states and actual beds/panels", () => {
  const a = get("source-detail"),
    m = get("beds-current");
  const d = {
    ...emptyAdmissionDraft(a),
    ack: true,
    bed: String(m.beds.find((b) => b.current_state === "Available").bed_id),
  };
  assert.equal(admissionBody("allocate", a, d, m.beds, []).admit_now, false);
  assert.throws(
    () => admissionBody("allocate", a, { ...d, ack: false }, m.beds, []),
    /Check the actual/,
  );
  assert.throws(
    () => admissionBody("allocate", a, { ...d, bed: "999999" }, m.beds, []),
    /no longer available/,
  );
  assert.throws(
    () =>
      admissionBody(
        "allocate",
        a,
        { ...d, category: "Panel", panel: "999999" },
        m.beds,
        [],
      ),
    /actual active/,
  );
  assert.equal(
    admissionActionAllowed({ ...a, status: "Admitted" }, "cancel"),
    false,
  );
  assert.equal(
    admissionActionAllowed({ ...a, status: "BedReserved" }, "admit"),
    true,
  );
  assert.equal(
    admissionActionAllowed({ ...a, status: "Waitlisted" }, "waitlist"),
    false,
  );
  for (const priority of ["-1", "101", "1.5", "NaN"])
    assert.throws(
      () =>
        admissionBody("waitlist", a, { ...d, ward: "1", priority }, m.beds, []),
      /whole-number/,
    );
  assert.throws(
    () => admissionBody("cancel", a, { ...d, reason: "a" }, [], []),
    /cancellation reason/,
  );
});
test("record views and independent uploads cannot bypass identity or another write", () => {
  assert.equal(admissionAccess("records", ["ipd.admission.view"]).work, false);
  assert.equal(
    admissionAccess("hidden", ["ipd.admission.view"]).visible,
    false,
  );
  assert.equal(admissionAccess("open_work", ["ipd.admission.view"]).work, true);
  assert.equal(hasBlockingWrite(["3"], 3), false);
  for (const markers of [[null], ["4"], ["3", null], ["3", "4"]])
    assert.equal(hasBlockingWrite(markers, 3), true);
  assert.equal(hasBlockingWrite(["3"]), true);
  for (const invalid of [0, -1, NaN, 1.5])
    assert.equal(hasBlockingWrite(["3"], invalid), true);
});
test("admission refusal recovery targets original record without replay", () => {
  for (const x of [
    "allocate-bed",
    "overflow-override",
    "waitlist",
    "cancel",
    "admit",
  ])
    assert.equal(
      refusalReadPath("POST", "/admissions/2/" + x, "ADMISSION_STATE_INVALID"),
      "/admissions/2",
    );
  assert.equal(
    refusalReadPath(
      "POST",
      "/admissions/2/discharge/BillingSettlement/clear",
      "DISCHARGE_STAGE_IMMUTABLE",
    ),
    "/admissions/2/discharge-status",
  );
  const a = get("source-detail");
  assert.notEqual(
    admissionSnapshot(a),
    admissionSnapshot({ ...a, status: "Cancelled" }),
  );
  assert.equal(
    admissionSnapshot(a),
    admissionSnapshot({ ...a, photo_document_id: 777 }),
  );
  const p = {
    patient_id: 3,
    mrn: "synthetic",
    full_name: "DEMO",
    photo_document_id: null,
  };
  assert.equal(
    admissionPatientSnapshot(p),
    admissionPatientSnapshot({ ...p, row_version: 2, photo_document_id: 777 }),
  );
  assert.notEqual(
    admissionPatientSnapshot(p),
    admissionPatientSnapshot({ ...p, mrn: "changed" }),
  );
});
