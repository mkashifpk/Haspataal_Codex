import test from "node:test";
import assert from "node:assert/strict";
import {
  criticalResultsWardAccess,
  filterCriticalResults,
  getCriticalStatusBadge,
} from "../src/critical-results-ward-policy.ts";

test("critical results ward access respects permissions and establishment views", () => {
  // Hidden or setup view denies access
  const hiddenAccess = criticalResultsWardAccess(["diagnostics.critical.view"], "hidden");
  assert.equal(hiddenAccess.isDenied, true);
  assert.equal(hiddenAccess.canView, false);

  const setupAccess = criticalResultsWardAccess(["diagnostics.critical.view"], "setup");
  assert.equal(setupAccess.isDenied, true);

  // User without permissions is denied
  const noPerms = criticalResultsWardAccess([], "full");
  assert.equal(noPerms.isDenied, true);
  assert.equal(noPerms.canView, false);

  // Authorised ward nurse with full view
  const wardNurseAccess = criticalResultsWardAccess(["diagnostics.critical.view"], "full");
  assert.equal(wardNurseAccess.isDenied, false);
  assert.equal(wardNurseAccess.canView, true);
  assert.equal(wardNurseAccess.isRecordsOnly, false);
  assert.equal(wardNurseAccess.isRetiring, false);

  // Records only mode flags isRecordsOnly
  const recordsAccess = criticalResultsWardAccess(["diagnostics.critical.view"], "records");
  assert.equal(recordsAccess.isRecordsOnly, true);
  assert.equal(recordsAccess.canView, true);

  // Retiring mode flags isRetiring
  const retiringAccess = criticalResultsWardAccess(["diagnostics.critical.view"], "open_work");
  assert.equal(retiringAccess.isRetiring, true);
  assert.equal(retiringAccess.canView, true);
});

test("filterCriticalResults filters correctly by openOnly, source, and admissionId", () => {
  const dummyItems = [
    {
      critical_result_id: 1,
      critical_number: "CR-001",
      source: "Lab",
      result_id: 10,
      imaging_order_id: null,
      requisition_id: 5,
      patient_id: 1,
      patient_name: "Patient A",
      mrn: "MRN-001",
      admission_id: 100,
      admission_number: "ADM-100",
      ward_name: "Ward 1",
      bed_label: "B1",
      ticket_id: null,
      requester_doctor_id: 1,
      requester_doctor_name: "Dr. Smith",
      test_name: "Serum Potassium",
      finding: "7.2 mmol/L",
      notifiable_disease: null,
      reported_by: 2,
      reported_by_name: "Lab Tech",
      reported_at: "2026-10-30T10:00:00Z",
      status: "Open",
      communicated_at: null,
      authority_informed_at: null,
      acknowledged_by: null,
      acknowledged_by_name: null,
      acknowledged_at: null,
      action_taken: null,
      escalation_level: 0,
      escalated_at: null,
      row_version: 1,
      communicate_due_at: "2026-10-30T10:30:00Z",
      minutes_to_communicate: null,
      is_overdue: true,
      authority_pending: false,
    },
    {
      critical_result_id: 2,
      critical_number: "CR-002",
      source: "Imaging",
      result_id: null,
      imaging_order_id: 20,
      requisition_id: null,
      patient_id: 2,
      patient_name: "Patient B",
      mrn: "MRN-002",
      admission_id: 100,
      admission_number: "ADM-100",
      ward_name: "Ward 1",
      bed_label: "B2",
      ticket_id: null,
      requester_doctor_id: 1,
      requester_doctor_name: "Dr. Smith",
      test_name: "Chest X-Ray",
      finding: "Tension pneumothorax",
      notifiable_disease: null,
      reported_by: 3,
      reported_by_name: "Radiologist",
      reported_at: "2026-10-30T10:15:00Z",
      status: "Communicated",
      communicated_at: "2026-10-30T10:20:00Z",
      authority_informed_at: null,
      acknowledged_by: null,
      acknowledged_by_name: null,
      acknowledged_at: null,
      action_taken: null,
      escalation_level: 0,
      escalated_at: null,
      row_version: 1,
      communicate_due_at: "2026-10-30T10:45:00Z",
      minutes_to_communicate: null,
      is_overdue: false,
      authority_pending: false,
    },
    {
      critical_result_id: 3,
      critical_number: "CR-003",
      source: "Lab",
      result_id: 30,
      imaging_order_id: null,
      requisition_id: 6,
      patient_id: 3,
      patient_name: "Patient C",
      mrn: "MRN-003",
      admission_id: 200,
      admission_number: "ADM-200",
      ward_name: "Ward 2",
      bed_label: "B1",
      ticket_id: null,
      requester_doctor_id: 2,
      requester_doctor_name: "Dr. Jones",
      test_name: "Blood Culture",
      finding: "Gram negative bacilli",
      notifiable_disease: null,
      reported_by: 2,
      reported_by_name: "Lab Tech",
      reported_at: "2026-10-30T09:00:00Z",
      status: "Acknowledged",
      communicated_at: "2026-10-30T09:10:00Z",
      authority_informed_at: null,
      acknowledged_by: 2,
      acknowledged_by_name: "Dr. Jones",
      acknowledged_at: "2026-10-30T09:25:00Z",
      action_taken: "IV Meropenem started",
      escalation_level: 0,
      escalated_at: null,
      row_version: 2,
      communicate_due_at: "2026-10-30T09:30:00Z",
      minutes_to_communicate: null,
      is_overdue: false,
      authority_pending: false,
    },
  ];

  // Open only filter: excludes Acknowledged
  const openOnlyResults = filterCriticalResults(dummyItems, { openOnly: true });
  assert.equal(openOnlyResults.length, 2);
  assert.ok(!openOnlyResults.some((i) => i.status === "Acknowledged"));

  // Source filter: Lab only
  const labResults = filterCriticalResults(dummyItems, { source: "Lab" });
  assert.equal(labResults.length, 2);
  assert.ok(labResults.every((i) => i.source === "Lab"));

  // Source filter: Imaging only
  const imagingResults = filterCriticalResults(dummyItems, { source: "Imaging" });
  assert.equal(imagingResults.length, 1);
  assert.equal(imagingResults[0].critical_result_id, 2);

  // Admission filter
  const admissionResults = filterCriticalResults(dummyItems, { admissionId: 100 });
  assert.equal(admissionResults.length, 2);
  assert.ok(admissionResults.every((i) => i.admission_id === 100));

  // Combined filters: admissionId 100 + openOnly + source Lab
  const combined = filterCriticalResults(dummyItems, { admissionId: 100, openOnly: true, source: "Lab" });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].critical_result_id, 1);
});

test("getCriticalStatusBadge flags overdue and provides appropriate alert tones", () => {
  // Overdue Open result
  const overdueOpen = getCriticalStatusBadge("Open", true);
  assert.equal(overdueOpen.label, "OVERDUE");
  assert.equal(overdueOpen.tone, "danger");

  // Non-overdue Open result
  const normalOpen = getCriticalStatusBadge("Open", false);
  assert.equal(normalOpen.label, "Open");
  assert.equal(normalOpen.tone, "danger");

  // Communicated result
  const communicated = getCriticalStatusBadge("Communicated", false);
  assert.equal(communicated.label, "Communicated");
  assert.equal(communicated.tone, "info");

  // Acknowledged result (not overdue even if is_overdue flag is true)
  const acked = getCriticalStatusBadge("Acknowledged", true);
  assert.equal(acked.label, "Acknowledged");
  assert.equal(acked.tone, "positive");
});
