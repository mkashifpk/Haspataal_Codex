import test from "node:test";
import assert from "node:assert/strict";
import {
  getMedicationSafetyWardScreenView,
  isInpatientActive,
  calculateSafetyWorklistCounts,
  filterSafetyWorklist,
  SAFETY_KINDS_META,
  HIGH_ALERT_CATEGORY_NOTES,
} from "../src/medication-safety-ward-policy.ts";

test("medication_safety_ward view modes and service capability gates (rule:d8f589b50a)", () => {
  // Full view
  assert.equal(
    getMedicationSafetyWardScreenView({
      views: { screens: [{ screen_id: "medication_safety_ward", view: "full" }] },
    }),
    "full"
  );

  // Retiring open_work view
  assert.equal(
    getMedicationSafetyWardScreenView({
      views: { screens: [{ screen_id: "medication_safety_ward", view: "open_work" }] },
    }),
    "open_work"
  );

  // Retired records view
  assert.equal(
    getMedicationSafetyWardScreenView({
      views: { screens: [{ screen_id: "medication_safety_ward", view: "records" }] },
    }),
    "records"
  );

  // Default fallback when not configured
  assert.equal(getMedicationSafetyWardScreenView({}), "full");
  assert.equal(getMedicationSafetyWardScreenView(null), "full");

  // Inpatient capability check
  assert.equal(isInpatientActive({ active: ["inpatient", "pharmacy"] }), true);
  assert.equal(isInpatientActive({ active: ["pharmacy", "opd"] }), false);
  assert.equal(isInpatientActive(null), false);
});

test("calculate safety worklist counts across 7 categories (rule:b9e1768945)", () => {
  const mockItems = [
    {
      kind: "NoWristband",
      title: "Missing wristband",
      detail: "Bed 1",
      due_at: null,
      is_overdue: true,
      patient_id: 1,
      patient_name: "Patient A",
      mrn: "MRN-1",
      admission_id: 10,
      er_visit_id: null,
      ward_id: 1,
      ward_name: "Ward 1",
      bed_label: "B1",
      prescription_id: null,
      prescription_number: null,
      query_id: null,
      own_medicine_id: null,
      recall_id: null,
      recall_number: null,
      batch_id: null,
    },
    {
      kind: "VerbalOrderToCountersign",
      title: "Unsigned order",
      detail: "Morphine 10mg",
      due_at: null,
      is_overdue: false,
      patient_id: 2,
      patient_name: "Patient B",
      mrn: "MRN-2",
      admission_id: 11,
      er_visit_id: null,
      ward_id: 1,
      ward_name: "Ward 1",
      bed_label: "B2",
      prescription_id: 101,
      prescription_number: "RX-1",
      query_id: null,
      own_medicine_id: null,
      recall_id: null,
      recall_number: null,
      batch_id: null,
    },
    {
      kind: "QueryOpen",
      title: "Dose discrepancy",
      detail: "Check renal function",
      due_at: null,
      is_overdue: true,
      patient_id: 3,
      patient_name: "Patient C",
      mrn: "MRN-3",
      admission_id: 12,
      er_visit_id: null,
      ward_id: 2,
      ward_name: "Ward 2",
      bed_label: "B5",
      prescription_id: 102,
      prescription_number: "RX-2",
      query_id: 5,
      own_medicine_id: null,
      recall_id: null,
      recall_number: null,
      batch_id: null,
    },
  ];

  const counts = calculateSafetyWorklistCounts(mockItems);
  assert.equal(counts.Total, 3);
  assert.equal(counts.Overdue, 2);
  assert.equal(counts.NoWristband, 1);
  assert.equal(counts.VerbalOrderToCountersign, 1);
  assert.equal(counts.QueryOpen, 1);
  assert.equal(counts.OwnMedicineToIdentify, 0);
});

test("filter safety worklist items by ward, kind, overdue status, and search query (rule:b9e1768945)", () => {
  const mockItems = [
    {
      kind: "NoWristband",
      title: "Missing wristband",
      detail: "Bed 1",
      due_at: null,
      is_overdue: true,
      patient_id: 1,
      patient_name: "Fatima Bibi",
      mrn: "MRN-101",
      admission_id: 10,
      er_visit_id: null,
      ward_id: 1,
      ward_name: "Female Ward",
      bed_label: "B1",
      prescription_id: null,
      prescription_number: null,
      query_id: null,
      own_medicine_id: null,
      recall_id: null,
      recall_number: null,
      batch_id: null,
    },
    {
      kind: "VerbalOrderToCountersign",
      title: "Emergency verbal order",
      detail: "Adrenaline",
      due_at: null,
      is_overdue: false,
      patient_id: 2,
      patient_name: "Muhammad Ali",
      mrn: "MRN-102",
      admission_id: 11,
      er_visit_id: null,
      ward_id: 2,
      ward_name: "Male Ward",
      bed_label: "B4",
      prescription_id: null,
      prescription_number: null,
      query_id: null,
      own_medicine_id: null,
      recall_id: null,
      recall_number: null,
      batch_id: null,
    },
  ];

  // Filter by Ward
  const ward1Only = filterSafetyWorklist(mockItems, { wardId: 1 });
  assert.equal(ward1Only.length, 1);
  assert.equal(ward1Only[0].patient_name, "Fatima Bibi");

  // Filter by Kind
  const verbalOnly = filterSafetyWorklist(mockItems, { kind: "VerbalOrderToCountersign" });
  assert.equal(verbalOnly.length, 1);
  assert.equal(verbalOnly[0].patient_name, "Muhammad Ali");

  // Filter by Overdue
  const overdueOnly = filterSafetyWorklist(mockItems, { overdueOnly: true });
  assert.equal(overdueOnly.length, 1);
  assert.equal(overdueOnly[0].kind, "NoWristband");

  // Search by query
  const searchMatch = filterSafetyWorklist(mockItems, { searchQuery: "Muhammad" });
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].patient_name, "Muhammad Ali");
});

test("high-alert categories and safety metadata integrity (rule:a810f77980, MSDS 56 ii)", () => {
  // Check that ConcentratedElectrolyte and Insulin hazard warnings exist
  assert.ok(HIGH_ALERT_CATEGORY_NOTES.ConcentratedElectrolyte);
  assert.match(HIGH_ALERT_CATEGORY_NOTES.ConcentratedElectrolyte.en, /Fatal if infused directly/);
  assert.ok(HIGH_ALERT_CATEGORY_NOTES.Insulin);
  assert.match(HIGH_ALERT_CATEGORY_NOTES.Insulin.en, /Dual independent verification/);

  // Check safety metadata mapping
  assert.equal(SAFETY_KINDS_META.NoWristband.targetScreen, "wristbands_ward");
  assert.equal(SAFETY_KINDS_META.VerbalOrderToCountersign.targetScreen, "verbal_orders_ward");
  assert.equal(SAFETY_KINDS_META.OwnMedicineToIdentify.targetScreen, "own_medicines_ward");
  assert.equal(SAFETY_KINDS_META.QueryOpen.targetScreen, "order_queries");
});
