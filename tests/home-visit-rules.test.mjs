import { test } from "node:test";
import assert from "node:assert/strict";
import {
  homeVisitIssues,
  homeVisitDateRange,
} from "../src/home-visit-rules.ts";
const body = {
  patient_id: 18,
  requested_by: "Synthetic relative",
  requested_at: "2026-10-23T10:00:00Z",
  visited_at: "2026-10-23T11:00:00Z",
  reason: "Synthetic software check",
  address: "Synthetic address",
  examination_consent: "NotExamined",
  history: "Synthetic history",
  assessment: "Synthetic assessment",
  care_given: "Software test only",
  outcome: "ManagedAtHome",
};
test("Completed home visit requires a real server clock and cannot precede the request or be future", () => {
  assert.deepEqual(
    homeVisitIssues(body, Date.parse("2026-10-23T12:00:00Z")),
    [],
  );
  assert(homeVisitIssues(body, NaN).length);
  assert(
    homeVisitIssues(body, Date.parse("2026-10-23T10:30:00Z")).some((s) =>
      s.includes("future"),
    ),
  );
  assert(
    homeVisitIssues(
      { ...body, visited_at: "2026-10-23T09:59:00Z" },
      Date.parse("2026-10-23T12:00:00Z"),
    ).some((s) => s.includes("before")),
  );
});
test("Consent cannot be inferred and examination findings require VCO; actual referral destination is required", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  assert(homeVisitIssues({ ...body, examination_consent: "" }, now).length);
  assert(
    homeVisitIssues({ ...body, examination: "Recorded findings" }, now).length,
  );
  assert.deepEqual(
    homeVisitIssues(
      {
        ...body,
        examination_consent: "VerbalObtained",
        examination: "Recorded findings",
      },
      now,
    ),
    [],
  );
  assert(
    homeVisitIssues({ ...body, outcome: "Referred", referred_to: "   " }, now)
      .length,
  );
});
test("History refuses impossible/reversed dates but allows a single actual day", () => {
  assert.equal(homeVisitDateRange("2026-02-30", "2026-03-01"), false);
  assert.equal(homeVisitDateRange("2026-10-24", "2026-10-23"), false);
  assert.equal(homeVisitDateRange("2026-10-23", "2026-10-23"), true);
});
