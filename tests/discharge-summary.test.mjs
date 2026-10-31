import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateDischargeSummaryView,
  canEditDischargeSummary,
  canSignDischargeSummary,
  canViewDischargeSummary,
  getRequiredFieldsForOutcome,
  evaluateMissingSummaryFields,
  validateSummaryCorrectionInput,
  explainDischargeSummaryError,
} from "../src/discharge-summary-policy.ts";

test("discharge_summary view evaluation and service capability rules (rule:ca1992cc8d)", () => {
  // full view
  const full = evaluateDischargeSummaryView({ discharge_summary: { view: "full" } });
  assert.equal(full.view, "full");
  assert.equal(full.canDraft, true);
  assert.equal(full.canSign, true);
  assert.equal(full.canCorrect, true);
  assert.equal(full.canPrint, true);
  assert.equal(full.bannerMessage, null);

  // open_work (retiring service)
  const openWork = evaluateDischargeSummaryView({ discharge_summary: { view: "open_work" } });
  assert.equal(openWork.view, "open_work");
  assert.equal(openWork.canDraft, false);
  assert.equal(openWork.canSign, true);
  assert.equal(openWork.canCorrect, true);
  assert.ok(openWork.bannerMessage && openWork.bannerMessage.includes("No new discharge summaries from now on"));

  // records view (retired service)
  const records = evaluateDischargeSummaryView({ discharge_summary: { view: "records" } });
  assert.equal(records.view, "records");
  assert.equal(records.canDraft, false);
  assert.equal(records.canSign, false);
  assert.equal(records.canCorrect, true);
  assert.ok(records.bannerMessage && records.bannerMessage.includes("read-only"));
});

test("role permissions gating for discharge summary operations", () => {
  const doctor = { permissions: ["ipd.discharge.summary.edit", "ipd.discharge.summary.sign", "ipd.discharge.summary.view"] };
  const nurse = { permissions: ["ipd.discharge.summary.view"] };
  const cashier = { permissions: ["billing.payment.create"] };

  assert.equal(canEditDischargeSummary(doctor), true);
  assert.equal(canSignDischargeSummary(doctor), true);
  assert.equal(canViewDischargeSummary(doctor), true);

  assert.equal(canEditDischargeSummary(nurse), false);
  assert.equal(canSignDischargeSummary(nurse), false);
  assert.equal(canViewDischargeSummary(nurse), true);

  assert.equal(canEditDischargeSummary(cashier), false);
  assert.equal(canSignDischargeSummary(cashier), false);
  assert.equal(canViewDischargeSummary(cashier), false);
});

test("getRequiredFieldsForOutcome rules for each outcome (rule:b6ad13f99c, rule:a0859fbcc9)", () => {
  const homeFields = getRequiredFieldsForOutcome("Home");
  assert.ok(homeFields.includes("reason_for_admission"));
  assert.ok(homeFields.includes("final_diagnosis"));
  assert.ok(homeFields.includes("condition_at_discharge"));
  assert.ok(homeFields.includes("discharge_medications"));
  assert.ok(homeFields.includes("follow_up_instructions"));

  const transferFields = getRequiredFieldsForOutcome("Transferred");
  assert.ok(transferFields.includes("receiving_hospital"));
  assert.ok(transferFields.includes("transfer_reason"));
  assert.ok(transferFields.includes("transfer_arrangements"));

  const lamaFields = getRequiredFieldsForOutcome("LAMA");
  assert.ok(lamaFields.includes("outcome_note"));

  const diedFields = getRequiredFieldsForOutcome("Died");
  assert.ok(!diedFields.includes("discharge_medications"));
  assert.ok(!diedFields.includes("follow_up_instructions"));
});

test("evaluateMissingSummaryFields enforces outcome first and death constraint (rule:b6ad13f99c, rule:a0859fbcc9)", () => {
  // Empty draft without outcome
  const noOutcome = evaluateMissingSummaryFields({});
  assert.equal(noOutcome.canAttemptSign, false);
  assert.ok(noOutcome.missing.includes("outcome"));

  // Death recorded on stay requires Died outcome
  const deathMismatch = evaluateMissingSummaryFields({ outcome: "Home" }, "Died");
  assert.equal(deathMismatch.canAttemptSign, false);
  assert.ok(deathMismatch.fieldErrors.outcome.includes("Died"));

  // Incomplete Home draft
  const incompleteHome = evaluateMissingSummaryFields({
    outcome: "Home",
    reason_for_admission: "Acute appendicitis",
  });
  assert.equal(incompleteHome.canAttemptSign, false);
  assert.ok(incompleteHome.missing.includes("final_diagnosis"));
  assert.ok(incompleteHome.missing.includes("condition_at_discharge"));

  // Complete Transferred draft
  const completeTransfer = evaluateMissingSummaryFields({
    outcome: "Transferred",
    reason_for_admission: "Polytrauma with subdural hematoma",
    final_diagnosis: "Traumatic brain injury requiring neurosurgery",
    condition_at_discharge: "Improved",
    receiving_hospital: "Punjab Institute of Neurosciences",
    transfer_reason: "Higher specialized neurosurgical intervention",
    transfer_arrangements: "Advanced life support ambulance with ventilator and escort doctor",
  });
  assert.equal(completeTransfer.canAttemptSign, true);
  assert.equal(completeTransfer.missing.length, 0);
});

test("validateSummaryCorrectionInput validates post-signing addendum (rule:6ac70d5b94)", () => {
  // Empty correction
  const invalid = validateSummaryCorrectionInput({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.field);
  assert.ok(invalid.errors.correction_text);
  assert.ok(invalid.errors.correction_reason);

  // Valid correction
  const valid = validateSummaryCorrectionInput({
    field: "discharge_medications",
    correction_text: "Tab Augmentin 625mg PO TDS for 5 days added after culture sensitivity report.",
    correction_reason: "Culture sensitivity received post-discharge showing Co-amoxiclav susceptibility.",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test("explainDischargeSummaryError provides actionable clinical guidance", () => {
  const incomplete = explainDischargeSummaryError("DISCHARGE_SUMMARY_INCOMPLETE", {
    missing: ["receiving_hospital", "transfer_reason"],
  });
  assert.ok(incomplete.actionGuidance.includes("receiving_hospital"));

  const died = explainDischargeSummaryError("DISCHARGE_SUMMARY_PATIENT_DIED");
  assert.ok(died.actionGuidance.includes("Died"));

  const deathUncert = explainDischargeSummaryError("DISCHARGE_SUMMARY_DEATH_NOT_CERTIFIED");
  assert.ok(deathUncert.actionGuidance.includes("Death Certificate"));
});
