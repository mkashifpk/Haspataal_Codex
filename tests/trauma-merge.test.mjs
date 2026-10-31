import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateTraumaMergeView,
  canSearchPatients,
  canMergePatient,
  canApproveMerge,
  compareProfilesSideBySide,
  validateMergeRequest,
  explainTraumaMergeError,
} from "../src/trauma-merge-policy.ts";

test("evaluateTraumaMergeView respects screen view modes", () => {
  const fullEst = { views: { screens: { trauma_merge: "full" } } };
  const fullEval = evaluateTraumaMergeView(fullEst);
  assert.equal(fullEval.canShow, true);
  assert.equal(fullEval.canStartNewWork, true);
  assert.equal(fullEval.bannerNotice, null);

  const recordsEst = { views: { screens: { trauma_merge: "records" } } };
  const recordsEval = evaluateTraumaMergeView(recordsEst);
  assert.equal(recordsEval.canShow, true);
  assert.equal(recordsEval.canStartNewWork, false);
  assert.equal(recordsEval.isReadOnly, true);

  const hiddenEst = { views: { screens: { trauma_merge: "hidden" } } };
  const hiddenEval = evaluateTraumaMergeView(hiddenEst);
  assert.equal(hiddenEval.canShow, false);
});

test("role permissions gating for patient merge operations", () => {
  const clerk = {
    user_id: 1,
    permissions: ["patient.search", "patient.merge"],
  };
  assert.equal(canSearchPatients(clerk), true);
  assert.equal(canMergePatient(clerk), true);
  assert.equal(canApproveMerge(clerk), false);

  const supervisor = {
    user_id: 2,
    permissions: ["patient.search", "patient.merge", "patient.merge.approve"],
  };
  assert.equal(canApproveMerge(supervisor), true);
});

test("compareProfilesSideBySide detects discrepancies and conflicts (rule:ba9b5a51e2)", () => {
  const sourceTrauma = {
    patient_id: 101,
    mrn: "TRM-001",
    full_name: "Unknown Male 1",
    father_or_husband_name: null,
    gender: "male",
    dob: null,
    age_years: 30,
    cnic: null,
    mobile: null,
    registration_type: "TraumaTemp",
  };

  const targetMaster = {
    patient_id: 202,
    mrn: "MRN-100202",
    full_name: "Muhammad Ali",
    father_or_husband_name: "Tariq Mahmood",
    gender: "male",
    dob: "1994-05-15",
    age_years: 32,
    cnic: "35201-1234567-1",
    mobile: "0300-1234567",
    registration_type: "Regular",
  };

  const comparison = compareProfilesSideBySide(sourceTrauma, targetMaster);
  assert.equal(comparison.length, 8);

  const genderField = comparison.find((c) => c.field === "Gender");
  assert.equal(genderField.isConflict, false);

  // When gender conflicts
  const femaleTarget = { ...targetMaster, gender: "female" };
  const conflictComp = compareProfilesSideBySide(sourceTrauma, femaleTarget);
  const conflictGender = conflictComp.find((c) => c.field === "Gender");
  assert.equal(conflictGender.isConflict, true);
});

test("validateMergeRequest enforces co-signer for Regular profile and prevents self-merge (rule:a0a7f261f7)", () => {
  const traumaProfile = {
    patient_id: 101,
    mrn: "TRM-001",
    registration_type: "TraumaTemp",
  };

  const regularProfile1 = {
    patient_id: 201,
    mrn: "MRN-201",
    registration_type: "Regular",
  };

  const regularProfile2 = {
    patient_id: 202,
    mrn: "MRN-202",
    registration_type: "Regular",
  };

  // Self merge blocked
  const errSelf = validateMergeRequest(traumaProfile, traumaProfile, {
    target_patient_id: 101,
    reason: "Duplicate entry",
  });
  assert(errSelf.target);

  // Merging TraumaTemp into Regular requires reason but no co-signer
  const validTrauma = validateMergeRequest(traumaProfile, regularProfile2, {
    target_patient_id: 202,
    reason: "Identified trauma patient with CNIC match",
  });
  assert.deepEqual(validTrauma, {});

  // Merging Regular into Regular requires supervisor co-signature (rule:a0a7f261f7)
  const errNoCosigner = validateMergeRequest(regularProfile1, regularProfile2, {
    target_patient_id: 202,
    reason: "Accidental duplicate registration",
    cosigner_username: "",
    cosigner_password: "",
  });
  assert(errNoCosigner.cosigner_username);
  assert(errNoCosigner.cosigner_password);

  // With co-signer, merging Regular profile passes
  const validRegular = validateMergeRequest(regularProfile1, regularProfile2, {
    target_patient_id: 202,
    reason: "Accidental duplicate registration",
    cosigner_username: "supervisor_dr_ahmed",
    cosigner_password: "secure_pass_123",
  });
  assert.deepEqual(validRegular, {});
});

test("explainTraumaMergeError handles MERGE_IDENTITY_CONFLICT without override (rule:de91bfcdbd)", () => {
  const errConflict = {
    code: "MERGE_IDENTITY_CONFLICT",
    details: { conflicts: ["cnic", "gender"] },
  };
  const msg = explainTraumaMergeError(errConflict);
  assert.match(msg, /MERGE CONFLICT/);
  assert.match(msg, /cnic, gender/);
  assert.match(msg, /Overriding is prohibited/);
});
