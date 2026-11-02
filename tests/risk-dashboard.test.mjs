import test from "node:test";
import assert from "node:assert/strict";
import {
  getRiskDashboardCapabilityView,
  validateReviewInput,
  calculateRiskSummaryStats,
  getSeverityBadge,
  getReviewStatusBadge,
  RISK_DASHBOARD_ERROR_MESSAGES,
} from "../src/risk-dashboard-policy.ts";

test("risk_dashboard: capability view resolves based on establishment views.screens", () => {
  assert.equal(getRiskDashboardCapabilityView(null), "full");
  assert.equal(getRiskDashboardCapabilityView({}), "full");

  // Dictionary format
  const estFull = { views: { screens: { risk_dashboard: "full" } } };
  assert.equal(getRiskDashboardCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { risk_dashboard: "open_work" } } };
  assert.equal(getRiskDashboardCapabilityView(estOpenWork), "open_work");

  const estRecords = { views: { screens: { risk_dashboard: "records" } } };
  assert.equal(getRiskDashboardCapabilityView(estRecords), "records");

  const estSetup = { views: { screens: { risk_dashboard: "setup" } } };
  assert.equal(getRiskDashboardCapabilityView(estSetup), "setup");

  const estHidden = { views: { screens: { risk_dashboard: "hidden" } } };
  assert.equal(getRiskDashboardCapabilityView(estHidden), "hidden");

  // Array format
  const estArray = { views: { screens: [{ screen_id: "risk_dashboard", view: "open_work" }] } };
  assert.equal(getRiskDashboardCapabilityView(estArray), "open_work");
});

test("risk_dashboard: Rule rule:a50f18c5d4 enforces 'flagged for review' and dual-control review validation", () => {
  const currentUserId = 5;

  // Self-approval forbidden when user is the subject user
  const selfRes = validateReviewInput("Resolved", "Checked and ok", 5, currentUserId);
  assert.equal(selfRes.valid, false);
  assert.equal(selfRes.errorCode, "SELF_APPROVAL_FORBIDDEN");
  assert.match(selfRes.messageEn, /cannot review or resolve/i);

  // Different user review is permitted
  const validRes = validateReviewInput("Resolved", "Doctor confirmed consultation before refund attempt", 12, currentUserId);
  assert.equal(validRes.valid, true);

  // UnderReview allows null or empty note
  const underReviewRes = validateReviewInput("UnderReview", "", 12, currentUserId);
  assert.equal(underReviewRes.valid, true);

  // Resolved requires non-empty explanation note
  const missingNoteRes = validateReviewInput("Resolved", "   ", 12, currentUserId);
  assert.equal(missingNoteRes.valid, false);
  assert.equal(missingNoteRes.errorCode, "NOTE_REQUIRED");

  // FalsePositive requires note
  const fpMissingRes = validateReviewInput("FalsePositive", null, 12, currentUserId);
  assert.equal(fpMissingRes.valid, false);
  assert.equal(fpMissingRes.errorCode, "NOTE_REQUIRED");

  // Escalated requires note
  const escMissingRes = validateReviewInput("Escalated", "", 12, currentUserId);
  assert.equal(escMissingRes.valid, false);
  assert.equal(escMissingRes.errorCode, "NOTE_REQUIRED");

  // Note length boundary check (max 2000 chars)
  const longNote = "a".repeat(2001);
  const tooLongRes = validateReviewInput("Resolved", longNote, 12, currentUserId);
  assert.equal(tooLongRes.valid, false);
  assert.equal(tooLongRes.errorCode, "NOTE_TOO_LONG");
});

test("risk_dashboard: calculateRiskSummaryStats accurately aggregates open counts and critical alerts", () => {
  const summaries = [
    {
      rule_code: "VOIDED_BUT_EXAMINED",
      name: "Voided ticket after doctor consultation",
      description: "Confirmed theft signal",
      severity: "Critical",
      open_count: 2,
      max_score: 95,
      latest: "2026-11-02T10:00:00Z",
    },
    {
      rule_code: "POST_DECEASED_CLINICAL_EDIT",
      name: "Clinical entry after death",
      description: "Post-mortem charting deviation",
      severity: "Critical",
      open_count: 1,
      max_score: 90,
      latest: "2026-11-02T09:00:00Z",
    },
    {
      rule_code: "DRUG_SHRINKAGE_HIGH",
      name: "Pharmacy inventory variance",
      description: "Controlled drug write-off exceeds threshold",
      severity: "High",
      open_count: 4,
      max_score: 75,
      latest: "2026-11-01T15:00:00Z",
    },
    {
      rule_code: "OVERDUE_CRITICAL_ACK",
      name: "Unacknowledged panic lab result",
      description: "Critical result alert unviewed by doctor",
      severity: "Medium",
      open_count: 6,
      max_score: 50,
      latest: "2026-11-02T11:00:00Z",
    },
    {
      rule_code: "UNPAID_TICKET_EXPIRY_HIGH",
      name: "Unpaid ticket expiration wave",
      description: "Multiple counter tickets abandoned",
      severity: "Low",
      open_count: 10,
      max_score: 25,
      latest: "2026-11-02T12:00:00Z",
    },
  ];

  const stats = calculateRiskSummaryStats(summaries);
  assert.equal(stats.totalOpenCount, 23);
  assert.equal(stats.criticalCount, 3);
  assert.equal(stats.highCount, 4);
  assert.equal(stats.mediumCount, 6);
  assert.equal(stats.lowCount, 10);
  assert.equal(stats.highestScore, 95);
  assert.equal(stats.hasCriticalAlerts, true);
});

test("risk_dashboard: severity and review status badge helpers format bilingual labels", () => {
  const crit = getSeverityBadge("Critical");
  assert.equal(crit.labelEn, "Critical");
  assert.equal(crit.labelUr, "انتہائی نازک");
  assert.match(crit.className, /rose/);

  const openStatus = getReviewStatusBadge("Open");
  assert.equal(openStatus.labelEn, "Flagged for review");
  assert.equal(openStatus.labelUr, "برائے جائزہ نشان زد");

  const resStatus = getReviewStatusBadge("Resolved");
  assert.equal(resStatus.labelEn, "Resolved");
  assert.equal(resStatus.labelUr, "حل شدہ");
});

test("risk_dashboard: bilingual error dictionary covers all required error codes", () => {
  for (const [code, msg] of Object.entries(RISK_DASHBOARD_ERROR_MESSAGES)) {
    assert(typeof msg.en === "string" && msg.en.length > 0, `${code}: missing English`);
    assert(typeof msg.ur === "string" && msg.ur.length > 0, `${code}: missing Urdu`);
    assert(/[\u0600-\u06ff]/.test(msg.ur), `${code}: invalid Urdu script`);
  }
});
