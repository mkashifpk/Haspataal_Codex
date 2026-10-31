import test from "node:test";
import assert from "node:assert/strict";
import {
  getBloodCenterReleaseScreenView,
  isBloodCenterActiveOrRetiring,
  evaluateDonationClearance,
  validateDualControlInput,
  explainReleaseError,
} from "../src/blood-center-release-policy.ts";

test("blood_center_release view modes and service capability gates (rule:e8afafb775)", () => {
  // Case 1: Active blood_center, full view
  const fullEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_release", view: "full" }] },
  };
  assert.equal(getBloodCenterReleaseScreenView(fullEst), "full");
  assert.equal(isBloodCenterActiveOrRetiring(fullEst), true);

  // Case 2: Inactive blood_center capability
  const inactiveEst = {
    active: ["laboratory"],
    views: { screens: [{ screen_id: "blood_center_release", view: "full" }] },
  };
  assert.equal(isBloodCenterActiveOrRetiring(inactiveEst), false);

  // Case 3: Retiring open_work view
  const retiringEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_release", view: "open_work" }] },
  };
  assert.equal(getBloodCenterReleaseScreenView(retiringEst), "open_work");
  assert.equal(isBloodCenterActiveOrRetiring(retiringEst), true, "Continues during retiring mode (rule:e4772411e5)");

  // Case 4: Records view
  const recordsEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_center_release", view: "records" }] },
  };
  assert.equal(getBloodCenterReleaseScreenView(recordsEst), "records");

  // Case 5: Dictionary views structure
  const dictEst = {
    active: ["blood_center"],
    views: { screens: { blood_center_release: "full" } },
  };
  assert.equal(getBloodCenterReleaseScreenView(dictEst), "full");
});

test("complete non-reactive donation with concordant ABO/Rh passes clearance (rule:d1b6b7c78b)", () => {
  const completeTests = [
    { marker: "HBsAg", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHCV", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHIV", sample: "Initial", result: "NonReactive" },
    { marker: "Syphilis", sample: "Initial", result: "NonReactive" },
    { marker: "Malaria", sample: "Initial", result: "NonReactive" },
    { marker: "ABOForward", sample: "Initial", result: "B" },
    { marker: "ABOReverse", sample: "Initial", result: "B" },
    { marker: "RhD", sample: "Initial", result: "Positive" },
    { marker: "RhD", sample: "Repeat", result: "Positive" },
  ];

  const evalResult = evaluateDonationClearance(completeTests);
  assert.equal(evalResult.canClear, true);
  assert.equal(evalResult.isReactive, false);
  assert.equal(evalResult.hasDiscrepancy, false);
  assert.equal(evalResult.suggestedOutcome, "Cleared");
  assert.equal(evalResult.missingTests.length, 0);
  assert.equal(evalResult.discrepancies.length, 0);
});

test("incomplete screening tests or missing RhD repeat blocks clearance (rule:d1b6b7c78b)", () => {
  // Missing Malaria and Reverse ABO
  const partialTests = [
    { marker: "HBsAg", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHCV", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHIV", sample: "Initial", result: "NonReactive" },
    { marker: "Syphilis", sample: "Initial", result: "NonReactive" },
    { marker: "ABOForward", sample: "Initial", result: "O" },
    { marker: "RhD", sample: "Initial", result: "Positive" },
  ];

  const evalResult = evaluateDonationClearance(partialTests);
  assert.equal(evalResult.canClear, false);
  assert.equal(evalResult.suggestedOutcome, "Incomplete");
  assert(evalResult.missingTests.includes("Malaria"));
  assert(evalResult.missingTests.includes("ABO Reverse grouping"));
  assert(evalResult.missingTests.some((m) => m.includes("RhD determination")));
});

test("grouping discrepancies (ABO forward/reverse or Rh duplicate mismatch) block clearance (rule:d1b6b7c78b)", () => {
  // ABO forward A, reverse B discrepancy
  const discrepantTests = [
    { marker: "HBsAg", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHCV", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHIV", sample: "Initial", result: "NonReactive" },
    { marker: "Syphilis", sample: "Initial", result: "NonReactive" },
    { marker: "Malaria", sample: "Initial", result: "NonReactive" },
    { marker: "ABOForward", sample: "Initial", result: "A" },
    { marker: "ABOReverse", sample: "Initial", result: "B" },
    { marker: "RhD", sample: "Initial", result: "Positive" },
    { marker: "RhD", sample: "Repeat", result: "Positive" },
  ];

  const evalResult = evaluateDonationClearance(discrepantTests);
  assert.equal(evalResult.canClear, false);
  assert.equal(evalResult.hasDiscrepancy, true);
  assert.equal(evalResult.suggestedOutcome, "Discrepant");
  assert(evalResult.discrepancies[0].includes("ABO Forward (A) disagrees with ABO Reverse (B)"));
});

test("reactive marker requires repeat sample from bag and sets Reactive outcome (rule:d1b6b7c78b)", () => {
  // Reactive AntiHCV without repeat
  const reactiveTests = [
    { marker: "HBsAg", sample: "Initial", result: "NonReactive" },
    { marker: "AntiHCV", sample: "Initial", result: "Reactive" },
    { marker: "AntiHIV", sample: "Initial", result: "NonReactive" },
    { marker: "Syphilis", sample: "Initial", result: "NonReactive" },
    { marker: "Malaria", sample: "Initial", result: "NonReactive" },
    { marker: "ABOForward", sample: "Initial", result: "O" },
    { marker: "ABOReverse", sample: "Initial", result: "O" },
    { marker: "RhD", sample: "Initial", result: "Positive" },
    { marker: "RhD", sample: "Repeat", result: "Positive" },
  ];

  const evalResult = evaluateDonationClearance(reactiveTests);
  assert.equal(evalResult.canClear, false);
  assert.equal(evalResult.isReactive, true);
  assert.equal(evalResult.suggestedOutcome, "Reactive");
  assert(evalResult.reactiveMarkers.includes("AntiHCV"));
  assert(evalResult.repeatNeeded[0].includes("Repeat on another sample from the bag required"));
});

test("dual control co-signature validation prevents self-approval (rule:1e77b26ed6)", () => {
  // Case 1: Empty username
  const emptyUser = validateDualControlInput("", "pass123", "current.user");
  assert.equal(emptyUser.valid, false);
  assert(emptyUser.error.includes("username is required"));

  // Case 2: Empty password
  const emptyPass = validateDualControlInput("checker.user", "", "current.user");
  assert.equal(emptyPass.valid, false);
  assert(emptyPass.error.includes("password is required"));

  // Case 3: Same person attempting co-signature (DUAL_CONTROL_SAME_PERSON)
  const samePerson = validateDualControlInput("demo.labverifier", "secret", "demo.labverifier");
  assert.equal(samePerson.valid, false);
  assert(samePerson.error.includes("DUAL_CONTROL_SAME_PERSON"));

  // Case 4: Case-insensitive same person attempt
  const samePersonCase = validateDualControlInput("Demo.LabVerifier", "secret", "demo.labverifier");
  assert.equal(samePersonCase.valid, false);
  assert(samePersonCase.error.includes("DUAL_CONTROL_SAME_PERSON"));

  // Case 5: Valid independent second approver
  const validApprover = validateDualControlInput("demo.labadmin", "secret123", "demo.labverifier");
  assert.equal(validApprover.valid, true);
  assert.equal(validApprover.error, undefined);
});

test("domain error explanations provide actionable guidance (rule:bd509b7d5a, rule:1e77b26ed6)", () => {
  const srcRequired = explainReleaseError("BLOOD_CENTER_SOURCE_REQUIRED");
  assert(srcRequired.message.includes("OwnBloodCenter"));
  assert(srcRequired.action.includes("Laboratory Administrator"));

  const dualControl = explainReleaseError("DUAL_CONTROL_SAME_PERSON");
  assert(dualControl.message.includes("must be a different person"));

  const testsIncomplete = explainReleaseError("BLOOD_DONATION_TESTS_INCOMPLETE");
  assert(testsIncomplete.message.includes("mandatory test"));

  const unitExpired = explainReleaseError("BLOOD_UNIT_EXPIRED");
  assert(unitExpired.message.includes("expired while in quarantine"));
});
