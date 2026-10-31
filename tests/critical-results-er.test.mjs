import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCriticalResultsErView,
  canViewCriticalResults,
  filterCriticalResults,
  isCriticalResultOverdue,
  getCriticalStatusBadge,
} from "../src/critical-results-er-policy.ts";

test("critical_results_er: role access and permissions gating", () => {
  // diagnostics.critical.view or patient.view allows view
  assert.equal(canViewCriticalResults(["diagnostics.critical.view"]), true);
  assert.equal(canViewCriticalResults(["patient.view"]), true);
  assert.equal(canViewCriticalResults(["prescription.view"]), false);
  assert.equal(canViewCriticalResults([]), false);
});

test("critical_results_er: service view evaluation (rule 9ef18690f5)", () => {
  const perms = ["diagnostics.critical.view"];

  // Full view
  const full = evaluateCriticalResultsErView(
    { views: { screens: [{ screen_id: "critical_results_er", view: "full" }] } },
    perms,
  );
  assert.equal(full.canView, true);
  assert.equal(full.isRetiring, false);
  assert.equal(full.isRecordsOnly, false);
  assert.equal(full.isDenied, false);
  assert.equal(full.banner, null);

  // Retiring / open_work view
  const openWork = evaluateCriticalResultsErView(
    { views: { screens: [{ screen_id: "critical_results_er", view: "open_work" }] } },
    perms,
  );
  assert.equal(openWork.canView, true);
  assert.equal(openWork.isRetiring, true);
  assert.equal(openWork.isRecordsOnly, false);
  assert.match(openWork.banner.en, /No new critical results from now on/i);

  // Records only view
  const records = evaluateCriticalResultsErView(
    { views: { screens: [{ screen_id: "critical_results_er", view: "records" }] } },
    perms,
  );
  assert.equal(records.canView, true);
  assert.equal(records.isRetiring, false);
  assert.equal(records.isRecordsOnly, true);
  assert.match(records.banner.en, /Records Only Mode/i);

  // Hidden view
  const hidden = evaluateCriticalResultsErView(
    { views: { screens: [{ screen_id: "critical_results_er", view: "hidden" }] } },
    perms,
  );
  assert.equal(hidden.canView, false);
  assert.equal(hidden.isDenied, true);

  // Denied by permissions
  const denied = evaluateCriticalResultsErView(
    { views: { screens: [{ screen_id: "critical_results_er", view: "full" }] } },
    [],
  );
  assert.equal(denied.canView, false);
  assert.equal(denied.isDenied, true);
});

test("critical_results_er: filtering options (rule abc8a2c23d)", () => {
  const sampleItems = [
    {
      critical_result_id: 1,
      admission_id: 101,
      ticket_id: 201,
      source: "Lab",
      status: "Open",
    },
    {
      critical_result_id: 2,
      admission_id: 101,
      ticket_id: 201,
      source: "Imaging",
      status: "Communicated",
    },
    {
      critical_result_id: 3,
      admission_id: 102,
      ticket_id: 202,
      source: "Lab",
      status: "Acknowledged",
    },
  ];

  // Filter by admission_id
  const byAdmission = filterCriticalResults(sampleItems, { admissionId: 101 });
  assert.equal(byAdmission.length, 2);
  assert.deepEqual(byAdmission.map((i) => i.critical_result_id), [1, 2]);

  // Filter by ticket_id
  const byTicket = filterCriticalResults(sampleItems, { ticketId: 202 });
  assert.equal(byTicket.length, 1);
  assert.equal(byTicket[0].critical_result_id, 3);

  // Filter openOnly (omits Acknowledged)
  const openOnly = filterCriticalResults(sampleItems, { openOnly: true });
  assert.equal(openOnly.length, 2);
  assert.deepEqual(openOnly.map((i) => i.critical_result_id), [1, 2]);

  // Filter by source Lab
  const labOnly = filterCriticalResults(sampleItems, { source: "Lab" });
  assert.equal(labOnly.length, 2);
  assert.deepEqual(labOnly.map((i) => i.critical_result_id), [1, 3]);

  // Filter by source Imaging
  const imgOnly = filterCriticalResults(sampleItems, { source: "Imaging" });
  assert.equal(imgOnly.length, 1);
  assert.equal(imgOnly[0].critical_result_id, 2);
});

test("critical_results_er: overdue calculation (rule abc8a2c23d)", () => {
  const past = new Date(Date.now() - 1000 * 60 * 30).toISOString();
  const future = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  // Overdue flag from server
  assert.equal(
    isCriticalResultOverdue({ is_overdue: true, status: "Open" }),
    true,
  );

  // Past communication due time
  assert.equal(
    isCriticalResultOverdue({
      is_overdue: false,
      status: "Communicated",
      communicate_due_at: past,
    }),
    true,
  );

  // Future communication due time
  assert.equal(
    isCriticalResultOverdue({
      is_overdue: false,
      status: "Open",
      communicate_due_at: future,
    }),
    false,
  );

  // Acknowledged results are never overdue
  assert.equal(
    isCriticalResultOverdue({
      is_overdue: true,
      status: "Acknowledged",
      communicate_due_at: past,
    }),
    false,
  );
});

test("critical_results_er: status badge tones and alerts", () => {
  // Overdue status badge
  const overdueBadge = getCriticalStatusBadge("Open", true);
  assert.equal(overdueBadge.label, "OVERDUE");
  assert.equal(overdueBadge.tone, "danger");

  // Open status badge
  const openBadge = getCriticalStatusBadge("Open", false);
  assert.equal(openBadge.label, "Open");
  assert.equal(openBadge.tone, "danger");

  // Communicated status badge
  const commBadge = getCriticalStatusBadge("Communicated", false);
  assert.equal(commBadge.label, "Communicated");
  assert.equal(commBadge.tone, "info");

  // Acknowledged status badge
  const ackBadge = getCriticalStatusBadge("Acknowledged", false);
  assert.equal(ackBadge.label, "Acknowledged");
  assert.equal(ackBadge.tone, "positive");
});
