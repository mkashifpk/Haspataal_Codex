import test from "node:test";
import assert from "node:assert/strict";
import {
  getMaternityPolicyScreenView,
  isMaternityActive,
  evaluateConditionsReadiness,
  evaluateCommunicationsCompliance,
  validateConditionPatch,
  validateConditionCreate,
  validateCommunicationCreate,
  explainMaternityPolicyError,
} from "../src/maternity-policy-policy.ts";

test("maternity_policy screen view and active service gate (rule:b7a7a7f1e6)", () => {
  // Case 1: Active maternity service
  const activeEst = {
    active: ["maternity", "emergency"],
    views: { screens: [{ screen_id: "maternity_policy", view: "full" }] },
  };
  assert.equal(getMaternityPolicyScreenView(activeEst), "full");
  assert.equal(isMaternityActive(activeEst), true);

  // Case 2: Inactive maternity service (hospital does not run maternity)
  const inactiveEst = {
    active: ["emergency", "pharmacy"],
    views: { screens: [{ screen_id: "maternity_policy", view: "full" }] },
  };
  assert.equal(getMaternityPolicyScreenView(inactiveEst), "full", "maternity_policy is always accessible");
  assert.equal(isMaternityActive(inactiveEst), false, "Maternity is not active");

  // Case 3: Dictionary views structure
  const dictEst = {
    active: ["maternity"],
    views: { screens: { maternity_policy: "records" } },
  };
  assert.equal(getMaternityPolicyScreenView(dictEst), "records");

  // Case 4: Default fallback
  assert.equal(getMaternityPolicyScreenView(null), "full");
  assert.equal(isMaternityActive(null), false);
});

test("conditions readiness evaluation and activation gate (rule:585417c0ea, rule:7ac44a354a)", () => {
  // 12 standard examples from manual starting Undecided
  const initialConditions = [
    { condition_id: 1, name: "Severe Pre-eclampsia / Eclampsia", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 2, name: "Placenta Praevia with bleeding", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 3, name: "Abruptio Placentae", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 4, name: "Previous 2 or more caesarean sections", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 5, name: "Obstructed Labour / Ruptured Uterus", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 6, name: "Multiple pregnancy (triplets or higher order)", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 7, name: "Cardiac disease complicating pregnancy", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 8, name: "Severe anaemia with Hb < 7 g/dl", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 9, name: "Postpartum Haemorrhage (PPH)", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 10, name: "Preterm labour < 34 weeks gestation", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 11, name: "Intrauterine Fetal Demise (IUFD)", provision: null, is_active: true, from_manual: true, row_version: 1 },
    { condition_id: 12, name: "Malpresentation (transverse/oblique lie at term)", provision: null, is_active: true, from_manual: true, row_version: 1 },
  ];

  const evalInit = evaluateConditionsReadiness(initialConditions);
  assert.equal(evalInit.totalCount, 12);
  assert.equal(evalInit.undecidedCount, 12);
  assert.equal(evalInit.managedCount, 0);
  assert.equal(evalInit.referredCount, 0);
  assert.equal(evalInit.fromManualCount, 12);
  assert.equal(evalInit.canActivateMaternity, false, "Cannot activate maternity when any condition is undecided (rule:7ac44a354a)");
  assert.equal(evalInit.undecidedConditions.length, 12);

  // Partially decided conditions
  const partialConditions = initialConditions.map((c, i) => {
    if (i < 8) return { ...c, provision: "Managed" };
    if (i < 11) return { ...c, provision: "Referred", referral_note: "Tertiary DHQ Hospital" };
    return c; // 1 left undecided
  });

  const evalPartial = evaluateConditionsReadiness(partialConditions);
  assert.equal(evalPartial.undecidedCount, 1);
  assert.equal(evalPartial.managedCount, 8);
  assert.equal(evalPartial.referredCount, 3);
  assert.equal(evalPartial.canActivateMaternity, false, "Still cannot activate with 1 undecided condition");

  // Fully decided conditions
  const fullyDecidedConditions = partialConditions.map((c) =>
    c.provision === null ? { ...c, provision: "Referred", referral_note: "Specialized Maternity Institute" } : c
  );

  const evalFull = evaluateConditionsReadiness(fullyDecidedConditions);
  assert.equal(evalFull.undecidedCount, 0);
  assert.equal(evalFull.managedCount, 8);
  assert.equal(evalFull.referredCount, 4);
  assert.equal(evalFull.canActivateMaternity, true, "Maternity can be activated when every condition is decided (rule:7ac44a354a)");

  // With inactive condition: ignored from undecided check
  const withInactive = [
    ...fullyDecidedConditions,
    { condition_id: 13, name: "Archived condition", provision: null, is_active: false, from_manual: false, row_version: 1 },
  ];
  const evalWithInactive = evaluateConditionsReadiness(withInactive);
  assert.equal(evalWithInactive.inactiveCount, 1);
  assert.equal(evalWithInactive.canActivateMaternity, true, "Inactive conditions do not block activation");
});

test("stakeholder communications compliance evaluation (rule:1e04f5eed7)", () => {
  // Case 1: No communications recorded
  const evalEmpty = evaluateCommunicationsCompliance([]);
  assert.equal(evalEmpty.totalCount, 0);
  assert.equal(evalEmpty.hasOwnPatients, false);
  assert.equal(evalEmpty.hasReferrers, false);
  assert.equal(evalEmpty.status, "NotMet");

  // Case 2: Only OwnPatients communicated (banners/brochures) -> PartiallyMet
  const onlyPatients = [
    {
      comm_id: 1,
      communicated_on: "2026-10-15",
      audience: "OwnPatients",
      means: "Board",
      recipients: null,
      summary: "High-risk pregnancy guidance board displayed in antenatal clinic.",
      recorded_by: 1,
      created_at: "2026-10-15T09:00:00Z",
    },
  ];
  const evalOnlyPatients = evaluateCommunicationsCompliance(onlyPatients);
  assert.equal(evalOnlyPatients.hasOwnPatients, true);
  assert.equal(evalOnlyPatients.hasReferrers, false);
  assert.equal(evalOnlyPatients.status, "PartiallyMet", "Partially met without referrers (rule:1e04f5eed7)");

  // Case 3: Only Referrers communicated -> PartiallyMet
  const onlyReferrers = [
    {
      comm_id: 2,
      communicated_on: "2026-10-18",
      audience: "Referrers",
      means: "Letter",
      recipients: "Local General Practitioners and BHU Medical Officers",
      summary: "Official notification letter regarding high-risk maternity referral protocol.",
      recorded_by: 1,
      created_at: "2026-10-18T11:00:00Z",
    },
  ];
  const evalOnlyReferrers = evaluateCommunicationsCompliance(onlyReferrers);
  assert.equal(evalOnlyReferrers.hasOwnPatients, false);
  assert.equal(evalOnlyReferrers.hasReferrers, true);
  assert.equal(evalOnlyReferrers.status, "PartiallyMet");

  // Case 4: Both OwnPatients AND Referrers communicated -> FullyMet
  const bothAudiences = [...onlyPatients, ...onlyReferrers];
  const evalBoth = evaluateCommunicationsCompliance(bothAudiences);
  assert.equal(evalBoth.hasOwnPatients, true);
  assert.equal(evalBoth.hasReferrers, true);
  assert.equal(evalBoth.status, "FullyMet", "Fully met when both own patients and referrers are communicated (rule:1e04f5eed7)");
});

test("condition patch and creation validation (rule:585417c0ea)", () => {
  // Valid patch to Managed
  assert.equal(
    validateConditionPatch({ expected_version: 1, provision: "Managed" }).valid,
    true
  );

  // Missing expected_version
  assert.equal(
    validateConditionPatch({ provision: "Managed" }).valid,
    false
  );

  // Referred without referral note -> invalid
  const referredNoNote = validateConditionPatch({
    expected_version: 1,
    provision: "Referred",
    referral_note: "",
  });
  assert.equal(referredNoNote.valid, false);
  assert.match(referredNoNote.error, /Referral note is required/);

  // Referred with referral note -> valid
  assert.equal(
    validateConditionPatch({
      expected_version: 1,
      provision: "Referred",
      referral_note: "DHQ Hospital South Gynae Ward",
    }).valid,
    true
  );

  // Create custom condition
  assert.equal(
    validateConditionCreate({
      name: "Gestational Diabetes with ketoacidosis",
      provision: "Managed",
      sort_order: 20,
    }).valid,
    true
  );

  // Create Referred without note -> invalid
  assert.equal(
    validateConditionCreate({
      name: "Severe Thrombocytopenia",
      provision: "Referred",
      sort_order: 25,
    }).valid,
    false
  );

  // Short name -> invalid
  assert.equal(
    validateConditionCreate({
      name: "AB",
      provision: null,
      sort_order: 10,
    }).valid,
    false
  );
});

test("communication creation validation (rule:1e04f5eed7)", () => {
  const today = "2026-10-31";

  // Valid board notice for own patients
  assert.equal(
    validateCommunicationCreate(
      {
        communicated_on: "2026-10-30",
        audience: "OwnPatients",
        means: "Board",
        summary: "Display board placed at main entry and antenatal clinic.",
      },
      today
    ).valid,
    true
  );

  // Letter communication requires recipients
  const letterNoRecipients = validateCommunicationCreate(
    {
      communicated_on: "2026-10-30",
      audience: "Referrers",
      means: "Letter",
      recipients: "",
      summary: "Letter dispatched to all peripheral medical officers.",
    },
    today
  );
  assert.equal(letterNoRecipients.valid, false);
  assert.match(letterNoRecipients.error, /Recipients list is required for Letter or Meeting/);

  // Letter with recipients -> valid
  assert.equal(
    validateCommunicationCreate(
      {
        communicated_on: "2026-10-30",
        audience: "Referrers",
        means: "Letter",
        recipients: "District Health Authority & Area GPs",
        summary: "Letter dispatched with full list of Managed and Referred conditions.",
      },
      today
    ).valid,
    true
  );

  // Future communication date -> invalid
  assert.equal(
    validateCommunicationCreate(
      {
        communicated_on: "2026-11-05",
        audience: "OwnPatients",
        means: "Website",
        summary: "Notice posted to hospital website.",
      },
      today
    ).valid,
    false
  );
});

test("maternity policy domain error explanations", () => {
  const dupErr = explainMaternityPolicyError("OBSTETRIC_CONDITION_EXISTS");
  assert.equal(dupErr.title, "Condition Name Already Exists");
  assert.match(dupErr.action, /Enter a different condition name/);

  const verErr = explainMaternityPolicyError("VERSION_CONFLICT");
  assert.equal(verErr.title, "Concurrent Policy Modification");
  assert.match(verErr.action, /Review the updated record/);

  const permErr = explainMaternityPolicyError("FORBIDDEN");
  assert.equal(permErr.title, "Permission Denied");
  assert.match(permErr.message, /maternity.policy.manage/);

  const fallback = explainMaternityPolicyError("UNKNOWN_ERROR");
  assert.equal(fallback.title, "Maternity Policy Action Refused");
});
