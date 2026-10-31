import test from "node:test";
import assert from "node:assert/strict";
import {
  getDonorAssessmentView,
  canStartNewAssessment,
  isDoctorAuthorizedForAssessment,
  evaluateDonorEligibility,
  validateDonationAssessment,
  validateDeferralInput,
  validateDonorTellInput,
  validateRevokeDeferral,
  PBTA_TEMPORARY_DEFERRAL_GUIDANCE,
  PBTA_PERMANENT_DEFERRAL_GUIDANCE,
} from "../src/donor-assessment-policy.ts";

test("donor_assessment view and capability gates enforce Active blood_center and view modes (rule:1af6af6a9c, rule:21d2bc008e)", () => {
  // Case 1: Active blood_center, full view
  const fullEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "donor_assessment", view: "full" }] },
  };
  assert.equal(getDonorAssessmentView(fullEst), "full");
  assert.equal(canStartNewAssessment(fullEst, true), true);

  // Case 2: Inactive blood_center capability (rule:21d2bc008e)
  const inactiveEst = {
    active: ["laboratory"],
    views: { screens: [{ screen_id: "donor_assessment", view: "full" }] },
  };
  assert.equal(canStartNewAssessment(inactiveEst, true), false, "Cannot start assessments when blood_center is inactive");

  // Case 3: Retiring open_work view (rule:1af6af6a9c)
  const retiringEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "donor_assessment", view: "open_work" }] },
  };
  assert.equal(getDonorAssessmentView(retiringEst), "open_work");
  assert.equal(canStartNewAssessment(retiringEst, true), false, "Cannot start new assessments when view is open_work");

  // Case 4: Records view
  const recordsEst = {
    active: ["blood_center"],
    views: { screens: [{ screen_id: "donor_assessment", view: "records" }] },
  };
  assert.equal(getDonorAssessmentView(recordsEst), "records");
  assert.equal(canStartNewAssessment(recordsEst, true), false);

  // Case 5: When user lacks assess permission
  assert.equal(canStartNewAssessment(fullEst, false), false);
});

test("doctor PMDC credential enforcement (rule:2f34c9a08a)", () => {
  // Doctor role with PMDC
  assert.equal(
    isDoctorAuthorizedForAssessment({
      roles: ["doctor"],
      registration: "PMDC 12345-P",
    }),
    true,
  );

  // Clinical specialist role
  assert.equal(
    isDoctorAuthorizedForAssessment({
      roles: ["clinical_specialist"],
      registration: "PMC 99887",
    }),
    true,
  );

  // Non-doctor role without PMDC (e.g. lab_technician, nurse)
  assert.equal(
    isDoctorAuthorizedForAssessment({
      roles: ["lab_technician"],
      registration: "PNC 12345",
    }),
    false,
  );

  assert.equal(isDoctorAuthorizedForAssessment(null), false);
});

test("PBTA donor eligibility bounds (rule:eee718a5dc)", () => {
  const eligibleMaleDonor = {
    donor_id: 1,
    donor_number: "BD-2026-000001",
    full_name: "Muhammad Ali",
    sex: "Male",
    date_of_birth: "1995-01-01",
    age_years: 31,
    deferred_now: false,
    permanently_deferred: false,
    may_donate_from: "2026-01-01",
  };

  // Valid physical reading
  const validForm = {
    weight_kg: 68,
    hb_g_dl: 14.0,
    pulse: 72,
    bp_systolic: 120,
    bp_diastolic: 80,
    temperature_c: 36.8,
  };
  const res = evaluateDonorEligibility(eligibleMaleDonor, validForm);
  assert.equal(res.eligible, true);
  assert.equal(res.issues.length, 0);

  // Below weight threshold (< 50.0 kg)
  const lowWeight = evaluateDonorEligibility(eligibleMaleDonor, { ...validForm, weight_kg: 48 });
  assert.equal(lowWeight.eligible, false);
  assert.match(lowWeight.issues[0], /50\.0 kg/);

  // Below Hb threshold for Male (< 13.0 g/dL)
  const lowHbMale = evaluateDonorEligibility(eligibleMaleDonor, { ...validForm, hb_g_dl: 12.6 });
  assert.equal(lowHbMale.eligible, false);
  assert.match(lowHbMale.issues[0], /13/);

  // Female donor: 12.6 is valid (threshold is >= 12.5)
  const femaleDonor = { ...eligibleMaleDonor, sex: "Female" };
  const validFemaleHb = evaluateDonorEligibility(femaleDonor, { ...validForm, hb_g_dl: 12.6 });
  assert.equal(validFemaleHb.eligible, true);

  // Female donor below threshold (< 12.5)
  const lowHbFemale = evaluateDonorEligibility(femaleDonor, { ...validForm, hb_g_dl: 12.2 });
  assert.equal(lowHbFemale.eligible, false);
  assert.match(lowHbFemale.issues[0], /12\.5/);

  // Underage (< 18 yrs)
  const underage = evaluateDonorEligibility({ ...eligibleMaleDonor, age_years: 17 }, validForm);
  assert.equal(underage.eligible, false);
  assert.match(underage.issues[0], /18 yrs/);

  // Permanently deferred donor
  const permDeferred = evaluateDonorEligibility({ ...eligibleMaleDonor, permanently_deferred: true }, validForm);
  assert.equal(permDeferred.eligible, false);
  assert.match(permDeferred.issues[0], /Permanently deferred/);
});

test("separate informed consent and unpaid declaration verification (rule:91e1708abe)", () => {
  const donor = {
    donor_id: 1,
    donor_number: "BD-2026-000001",
    full_name: "Ali Raza",
    sex: "Male",
    age_years: 28,
    deferred_now: false,
    permanently_deferred: false,
  };

  const validAccepted = {
    donor_id: 1,
    donation_kind: "Voluntary",
    venue: "BloodCenter",
    history_completed: true,
    weight_kg: 70,
    hb_g_dl: 14.5,
    hb_method: "Photometer",
    outcome: "Accepted",
    consent_signed: true,
    unpaid_declared: true,
  };

  assert.equal(validateDonationAssessment(validAccepted, donor).valid, true);

  // Missing consent_signed
  const missingConsent = { ...validAccepted, consent_signed: false };
  const v1 = validateDonationAssessment(missingConsent, donor);
  assert.equal(v1.valid, false);
  assert.ok(v1.errors.consent_signed);

  // Missing unpaid_declared
  const missingUnpaid = { ...validAccepted, unpaid_declared: false };
  const v2 = validateDonationAssessment(missingUnpaid, donor);
  assert.equal(v2.valid, false);
  assert.ok(v2.errors.unpaid_declared);

  // Attempting to Accept a deferred donor
  const defDonor = { ...donor, deferred_now: true };
  const v3 = validateDonationAssessment(validAccepted, defDonor);
  assert.equal(v3.valid, false);
  assert.ok(v3.errors.outcome);
});

test("deferral validation and revoke explanation requirements (rule:a8bf19300f, rule:d8cd988a65)", () => {
  // Temporary deferral requires future date
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const validTemp = {
    kind: "Temporary",
    reason: "Low haemoglobin (< 13.0 g/dL)",
    deferred_until: tomorrow,
  };
  assert.equal(validateDeferralInput(validTemp).valid, true);

  const missingDate = { kind: "Temporary", reason: "Low Hb" };
  assert.equal(validateDeferralInput(missingDate).valid, false);

  // Permanent deferral requires reason
  const validPerm = {
    kind: "Permanent",
    reason: "Confirmed reactive TTI screening: Hepatitis B (HBsAg)",
  };
  assert.equal(validateDeferralInput(validPerm).valid, true);

  // Revoke explanation requires minimum 5 characters
  assert.equal(validateRevokeDeferral("Valid clerical error explanation").valid, true);
  assert.equal(validateRevokeDeferral("err").valid, false);
  assert.equal(validateRevokeDeferral("").valid, false);

  // Standard guidance categories populated
  assert.ok(PBTA_TEMPORARY_DEFERRAL_GUIDANCE.length >= 10);
  assert.ok(PBTA_PERMANENT_DEFERRAL_GUIDANCE.length >= 8);
});
