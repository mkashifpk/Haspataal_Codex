import test from "node:test";
import assert from "node:assert/strict";
import {
  getNewbornRegistrationScreenView,
  isMaternityActive,
  validateNewbornInput,
  validateReplacementWristbandInput,
  formatNewbornLabel,
  explainNewbornError,
} from "../src/newborn-registration-policy.ts";

test("newborn_registration view modes and service capability gates (rule:0b0674e405, rule:e261e1b4d0)", () => {
  // Case 1: Active maternity service, full view
  const activeEst = {
    active: ["maternity", "inpatient"],
    views: { screens: [{ screen_id: "newborn_registration", view: "full" }] },
  };
  assert.equal(getNewbornRegistrationScreenView(activeEst), "full");
  assert.equal(isMaternityActive(activeEst), true);

  // Case 2: Inactive maternity service
  const inactiveEst = {
    active: ["inpatient"],
    views: { screens: [{ screen_id: "newborn_registration", view: "full" }] },
  };
  assert.equal(isMaternityActive(inactiveEst), false);

  // Case 3: Retiring open_work view
  const retiringEst = {
    active: ["maternity"],
    views: { screens: [{ screen_id: "newborn_registration", view: "open_work" }] },
  };
  assert.equal(getNewbornRegistrationScreenView(retiringEst), "open_work");

  // Case 4: Records mode
  const recordsEst = {
    active: ["maternity"],
    views: { screens: [{ screen_id: "newborn_registration", view: "records" }] },
  };
  assert.equal(getNewbornRegistrationScreenView(recordsEst), "records");

  // Case 5: Dictionary view mode structure
  const dictEst = {
    active: ["maternity"],
    views: { screens: { newborn_registration: "records" } },
  };
  assert.equal(getNewbornRegistrationScreenView(dictEst), "records");
});

test("newborn registration input validation (rule:c4dcf395e2)", () => {
  const referenceNow = "2026-10-31T12:00:00Z";

  // Valid newborn birth registration
  assert.equal(
    validateNewbornInput(
      {
        admission_id: 42,
        born_at: "2026-10-31T11:45:00Z",
        gender: "female",
      },
      referenceNow
    ).valid,
    true
  );

  // Missing admission_id -> invalid
  const missingAdmission = validateNewbornInput(
    {
      born_at: "2026-10-31T11:45:00Z",
      gender: "female",
    },
    referenceNow
  );
  assert.equal(missingAdmission.valid, false);
  assert.equal(missingAdmission.field, "admission_id");

  // Future birth date/time -> invalid (rule:c4dcf395e2)
  const futureBirth = validateNewbornInput(
    {
      admission_id: 42,
      born_at: "2026-10-31T14:30:00Z", // 2.5 hours in future
      gender: "male",
    },
    referenceNow
  );
  assert.equal(futureBirth.valid, false);
  assert.equal(futureBirth.field, "born_at");
  assert.match(futureBirth.error, /cannot be in the future/);

  // Missing gender -> invalid
  const missingGender = validateNewbornInput(
    {
      admission_id: 42,
      born_at: "2026-10-31T11:45:00Z",
    },
    referenceNow
  );
  assert.equal(missingGender.valid, false);
  assert.equal(missingGender.field, "gender");
});

test("replacement wristband input validation (rule:695cc4d1de)", () => {
  // Missing replacement_reason -> invalid
  const missingReason = validateReplacementWristbandInput({
    admission_id: 42,
    newborn_patient_id: 108,
    replacement_reason: "",
  });
  assert.equal(missingReason.valid, false);
  assert.equal(missingReason.field, "replacement_reason");
  assert.match(missingReason.error, /Replacement reason is required/);

  // Missing newborn_patient_id -> invalid
  const missingBabyId = validateReplacementWristbandInput({
    admission_id: 42,
    replacement_reason: "Band soiled during bathing",
  });
  assert.equal(missingBabyId.valid, false);
  assert.equal(missingBabyId.field, "newborn_patient_id");

  // Complete valid replacement
  assert.equal(
    validateReplacementWristbandInput({
      admission_id: 42,
      newborn_patient_id: 108,
      replacement_reason: "Band torn and unreadable",
    }).valid,
    true
  );
});

test("newborn label formatting and unidentified mother handling (decision 61)", () => {
  const normalBaby = {
    full_name: "Baby of Fatima Zahra",
    mother_name: "Fatima Zahra",
    mrn: "MRN-2026-00088",
  };
  assert.equal(formatNewbornLabel(normalBaby), "Baby of Fatima Zahra (MRN-2026-00088)");

  const unidentifiedBaby = {
    full_name: "Baby of Trauma Female 04",
    mother_name: "Trauma Female 04",
    mrn: "MRN-2026-00099",
  };
  assert.equal(formatNewbornLabel(unidentifiedBaby), "Baby of Trauma Female 04 (MRN-2026-00099)");
});

test("domain error explanations for newborn actions", () => {
  const capErr = explainNewbornError("CAPABILITY_INACTIVE");
  assert.equal(capErr.title, "Maternity Capability Inactive");

  const notFoundErr = explainNewbornError("NOT_FOUND");
  assert.equal(notFoundErr.title, "Mother Admission Not Found");
  assert.match(notFoundErr.action, /Verify that the mother is currently admitted/);

  const permErr = explainNewbornError("FORBIDDEN");
  assert.equal(permErr.title, "Permission Denied");
  assert.match(permErr.message, /patient.wristband.print/);
});
