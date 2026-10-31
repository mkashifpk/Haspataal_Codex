import test from "node:test";
import assert from "node:assert/strict";
import {
  getBloodCollectionScreenView,
  isBloodCenterActive,
  getMaxAllowableVolumeMl,
  isAssessmentExpired,
  sortDonationsOldestFirst,
  validateCollectionInput,
} from "../src/blood-collection-policy.ts";

test("blood_collection view modes and service capability gates (rule:28291a1e73)", () => {
  // Case 1: Active blood_center, full view
  const fullEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_collection", view: "full" }] },
  };
  assert.equal(getBloodCollectionScreenView(fullEst), "full");
  assert.equal(isBloodCenterActive(fullEst), true);

  // Case 2: Inactive blood_center capability
  const inactiveEst = {
    active: ["laboratory"],
    views: { screens: [{ screen_id: "blood_collection", view: "full" }] },
  };
  assert.equal(isBloodCenterActive(inactiveEst), false);

  // Case 3: Retiring open_work view (banner shown, no new collections started)
  const retiringEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_collection", view: "open_work" }] },
  };
  assert.equal(getBloodCollectionScreenView(retiringEst), "open_work");

  // Case 4: Records view (read-only history)
  const recordsEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "blood_collection", view: "records" }] },
  };
  assert.equal(getBloodCollectionScreenView(recordsEst), "records");

  // Case 5: Dictionary views structure
  const dictEst = {
    active: ["blood_center"],
    views: { screens: { blood_collection: "full" } },
  };
  assert.equal(getBloodCollectionScreenView(dictEst), "full");
});

test("volume calculation limits for adult >= 50kg and low-weight < 50kg donors (rule:368f4aace1)", () => {
  // Donor weighing 70 kg: maximum is 495 mL
  assert.equal(getMaxAllowableVolumeMl(70), 495);

  // Donor weighing exactly 50 kg: maximum is 495 mL
  assert.equal(getMaxAllowableVolumeMl(50), 495);

  // Donor weighing 45 kg: 45 * 9 * 1.10 = 445.5 -> floor is 445 mL
  assert.equal(getMaxAllowableVolumeMl(45), 445);

  // Donor weighing 40 kg: 40 * 9 * 1.10 = 396 mL
  assert.equal(getMaxAllowableVolumeMl(40), 396);
});

test("assessment expiry after 24 hours triggers expiry detection (rule:834ffec14a)", () => {
  const baseTime = new Date("2026-10-31T10:00:00Z");

  // Assessment performed 2 hours ago: not expired
  const twoHoursAgo = "2026-10-31T08:00:00Z";
  assert.equal(isAssessmentExpired(twoHoursAgo, baseTime), false);

  // Assessment performed exactly 24 hours ago: not expired
  const twentyFourHoursAgo = "2026-10-30T10:00:00Z";
  assert.equal(isAssessmentExpired(twentyFourHoursAgo, baseTime), false);

  // Assessment performed 25 hours ago: expired (> 24h)
  const twentyFiveHoursAgo = "2026-10-30T09:00:00Z";
  assert.equal(isAssessmentExpired(twentyFiveHoursAgo, baseTime), true);
});

test("waiting worklist sorts accepted donations oldest first (rule:6282d69357)", () => {
  const donations = [
    {
      donation_id: 1,
      attended_at: "2026-10-31T09:30:00Z",
    },
    {
      donation_id: 2,
      attended_at: "2026-10-31T08:15:00Z", // Oldest
    },
    {
      donation_id: 3,
      attended_at: "2026-10-31T10:00:00Z", // Newest
    },
  ];

  const sorted = sortDonationsOldestFirst(donations);
  assert.equal(sorted[0].donation_id, 2);
  assert.equal(sorted[1].donation_id, 1);
  assert.equal(sorted[2].donation_id, 3);
});

test("collection input validation for successful and unsuccessful bleeds (rule:368f4aace1)", () => {
  const mockDonation = {
    donation_id: 10,
    weight_kg: 60,
    attended_at: "2026-10-31T08:00:00Z",
  };

  // Valid successful collection
  const validCollected = {
    outcome: "Collected",
    bag_type: "Triple",
    bag_lot: "LOT-2026-X1",
    anticoagulant: "CPDA-1",
    started_at: "2026-10-31T08:10:00Z",
    ended_at: "2026-10-31T08:20:00Z",
    volume_ml: 450,
    donor_reaction: "None",
  };
  const valSuccess = validateCollectionInput(validCollected, mockDonation);
  assert.equal(valSuccess.valid, true);

  // Invalid: missing bag lot and volume exceeding 495 mL limit
  const invalidCollected = {
    outcome: "Collected",
    bag_type: "Single",
    bag_lot: "",
    anticoagulant: "CPDA-1",
    started_at: "2026-10-31T08:10:00Z",
    ended_at: "2026-10-31T08:20:00Z",
    volume_ml: 500, // Exceeds 495 limit
    donor_reaction: "None",
  };
  const valFail = validateCollectionInput(invalidCollected, mockDonation);
  assert.equal(valFail.valid, false);
  assert.ok(valFail.errors.bag_lot);
  assert.ok(valFail.errors.volume_ml);

  // Valid unsuccessful bleed with reason
  const validUnsuccessful = {
    outcome: "Unsuccessful",
    unsuccessful_reason: "Vein collapsed after 50 mL draw.",
    donor_reaction: "None",
  };
  const valUnsuccessful = validateCollectionInput(validUnsuccessful, mockDonation);
  assert.equal(valUnsuccessful.valid, true);

  // Invalid unsuccessful bleed: empty reason
  const invalidUnsuccessful = {
    outcome: "Unsuccessful",
    unsuccessful_reason: "",
    donor_reaction: "None",
  };
  const valEmptyReason = validateCollectionInput(invalidUnsuccessful, mockDonation);
  assert.equal(valEmptyReason.valid, false);
  assert.ok(valEmptyReason.errors.unsuccessful_reason);
});

test("donor adverse reaction validation & Section 13 Severe harm requirements (rule:8c56f5bd5c)", () => {
  const mockDonation = {
    donation_id: 11,
    weight_kg: 70,
    attended_at: "2026-10-31T08:00:00Z",
  };

  // Mild reaction requires action taken
  const reactionWithoutAction = {
    outcome: "Collected",
    bag_type: "Double",
    bag_lot: "LOT-99",
    anticoagulant: "CPDA-1",
    started_at: "2026-10-31T08:10:00Z",
    ended_at: "2026-10-31T08:20:00Z",
    volume_ml: 450,
    donor_reaction: "Vasovagal",
    reaction_action: "", // missing
  };
  const valNoAction = validateCollectionInput(reactionWithoutAction, mockDonation);
  assert.equal(valNoAction.valid, false);
  assert.ok(valNoAction.errors.reaction_action);

  // Severe reaction requires both action and harm severity level (Section 13 incident)
  const severeWithoutHarm = {
    outcome: "Collected",
    bag_type: "Double",
    bag_lot: "LOT-99",
    anticoagulant: "CPDA-1",
    started_at: "2026-10-31T08:10:00Z",
    ended_at: "2026-10-31T08:20:00Z",
    volume_ml: 450,
    donor_reaction: "Severe",
    reaction_action: "IV saline, legs elevated, oxygen mask",
    reaction_harm: null, // missing harm
  };
  const valNoHarm = validateCollectionInput(severeWithoutHarm, mockDonation);
  assert.equal(valNoHarm.valid, false);
  assert.ok(valNoHarm.errors.reaction_harm);

  // Complete valid Severe reaction
  const severeValid = {
    outcome: "Collected",
    bag_type: "Double",
    bag_lot: "LOT-99",
    anticoagulant: "CPDA-1",
    started_at: "2026-10-31T08:10:00Z",
    ended_at: "2026-10-31T08:20:00Z",
    volume_ml: 450,
    donor_reaction: "Severe",
    reaction_action: "IV saline, legs elevated, oxygen mask, stabilized",
    reaction_harm: "Moderate",
  };
  const valSevereOk = validateCollectionInput(severeValid, mockDonation);
  assert.equal(valSevereOk.valid, true);
});
