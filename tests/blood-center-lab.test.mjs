import test from "node:test";
import assert from "node:assert/strict";
import {
  getBloodCenterLabScreenView,
  isBloodCenterActive,
  canRecordTests,
  canPrepareComponents,
  isProcessingTimeExceeded,
  calculateDefaultExpiry,
  validateTestsInput,
  getQuarantineCategory,
} from "../src/blood-center-lab-policy.ts";

test("blood_center_lab view modes and service capability gates (rule:e9c40bc39d)", () => {
  // Case 1: Active blood_center, full view
  const fullEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "full" }] },
  };
  assert.equal(getBloodCenterLabScreenView(fullEst), "full");
  assert.equal(isBloodCenterActive(fullEst), true);

  // Case 2: Inactive blood_center capability
  const inactiveEst = {
    active: ["laboratory"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "full" }] },
  };
  assert.equal(isBloodCenterActive(inactiveEst), false);

  // Case 3: Retiring open_work view
  const retiringEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "open_work" }] },
  };
  assert.equal(getBloodCenterLabScreenView(retiringEst), "open_work");

  // Case 4: Records view
  const recordsEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "records" }] },
  };
  assert.equal(getBloodCenterLabScreenView(recordsEst), "records");

  // Case 5: Dictionary views structure
  const dictEst = {
    active: ["blood_center"],
    views: { screens: { blood_center_lab: "full" } },
  };
  assert.equal(getBloodCenterLabScreenView(dictEst), "full");
});

test("testing and component preparation continue during retiring mode (rule:9f918de113, rule:6dab3d3a8e)", () => {
  const fullEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "full" }] },
  };
  const retiringEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "open_work" }] },
  };
  const recordsEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_lab", view: "records" }] },
  };

  // User with blood_center.process permission
  assert.equal(canRecordTests(fullEst, true), true);
  assert.equal(canRecordTests(retiringEst, true), true, "POST /tests continues in retiring mode");
  assert.equal(canRecordTests(recordsEst, true), false, "POST /tests blocked in records mode");
  assert.equal(canRecordTests(fullEst, false), false, "Blocked without permission");

  assert.equal(canPrepareComponents(fullEst, true), true);
  assert.equal(canPrepareComponents(retiringEst, true), true, "POST /components continues in retiring mode");
  assert.equal(canPrepareComponents(recordsEst, true), false, "POST /components blocked in records mode");
  assert.equal(canPrepareComponents(fullEst, false), false, "Blocked without permission");
});

test("8-hour processing window detection for platelets and plasma (rule:22b4758a41)", () => {
  const baseTime = new Date("2026-10-31T12:00:00Z");

  // Venepuncture completed 4 hours ago: within 8h window
  const fourHoursAgo = "2026-10-31T08:00:00Z";
  assert.equal(isProcessingTimeExceeded(fourHoursAgo, baseTime), false);

  // Venepuncture completed 8 hours ago: within 8h limit
  const eightHoursAgo = "2026-10-31T04:00:00Z";
  assert.equal(isProcessingTimeExceeded(eightHoursAgo, baseTime), false);

  // Venepuncture completed 9 hours ago: time exceeded (> 8h)
  const nineHoursAgo = "2026-10-31T03:00:00Z";
  assert.equal(isProcessingTimeExceeded(nineHoursAgo, baseTime), true);
});

test("PBTA component default shelf life calculations", () => {
  const baseTime = "2026-10-31T10:00:00Z";

  // Whole Blood & Red Cells: 35 days
  const wbExp = calculateDefaultExpiry("WholeBlood", baseTime);
  assert.equal(wbExp.slice(0, 10), "2026-12-05");

  const prbcExp = calculateDefaultExpiry("RedCells", baseTime);
  assert.equal(prbcExp.slice(0, 10), "2026-12-05");

  // Platelets: 5 days
  const pltExp = calculateDefaultExpiry("Platelets", baseTime);
  assert.equal(pltExp.slice(0, 10), "2026-11-05");

  // FFP & Cryo: 365 days
  const ffpExp = calculateDefaultExpiry("FreshFrozenPlasma", baseTime);
  assert.equal(ffpExp.slice(0, 10), "2027-10-31");
});

test("laboratory test input validation (rule:ac0462c02a)", () => {
  // Empty test array
  const valEmpty = validateTestsInput([]);
  assert.equal(valEmpty.valid, false);

  // Valid test entries
  const validTests = [
    { marker: "HBsAg", method: "ELISA", result: "NonReactive" },
    { marker: "ABOForward", method: "Tube", result: "A" },
  ];
  const valSuccess = validateTestsInput(validTests);
  assert.equal(valSuccess.valid, true);

  // Test missing result
  const incompleteTest = [
    { marker: "HBsAg", method: "ELISA", result: "" },
  ];
  const valFail = validateTestsInput(incompleteTest);
  assert.equal(valFail.valid, false);
});

test("quarantine status categorization (rule:7e769d8e04)", () => {
  const discardedComp = {
    component_id: 1,
    status: "Discarded",
  };
  assert.equal(getQuarantineCategory(discardedComp), "discarded");

  const releasedComp = {
    component_id: 2,
    status: "Released",
  };
  assert.equal(getQuarantineCategory(releasedComp), "cleared");

  const quarantineComp = {
    component_id: 3,
    status: "Quarantine",
  };
  assert.equal(getQuarantineCategory(quarantineComp), "untested");
});
