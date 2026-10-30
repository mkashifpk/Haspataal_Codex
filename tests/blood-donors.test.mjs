import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDonorAccessPolicy,
  validateDonorSearchQuery,
  validateDonorRegistration,
  validateDonorCorrection,
  evaluateDonorEligibility,
} from "../src/blood-donors-policy.ts";

test("blood_donors access policy enforces capability gating, retiring view work continuation, and operator permissions (rule:6a58b93e99, rule:5850958062)", () => {
  // Case 1: Full active blood_center with full permissions
  const fullAccess = evaluateDonorAccessPolicy({
    establishmentActive: ["blood_center"],
    screenView: "full",
    permissions: ["blood_center.view", "blood_center.donor.register"],
  });
  assert.equal(fullAccess.canView, true);
  assert.equal(fullAccess.canRegister, true);
  assert.equal(fullAccess.canUpdate, true);
  assert.equal(fullAccess.isRetiring, false);
  assert.equal(fullAccess.isReadOnly, false);

  // Case 2: Inactive blood_center capability (rule:5850958062 - starts new blood_center work, offered only while Active)
  const inactiveCap = evaluateDonorAccessPolicy({
    establishmentActive: ["laboratory"], // blood_center not active
    screenView: "full",
    permissions: ["blood_center.view", "blood_center.donor.register"],
  });
  assert.equal(inactiveCap.canView, true);
  assert.equal(inactiveCap.canRegister, false, "Cannot register new donors when blood_center capability is inactive");
  assert.equal(inactiveCap.canUpdate, true, "Existing donors can still be consulted and corrected");

  // Case 3: Retiring view open_work (rule:6a58b93e99)
  const retiringView = evaluateDonorAccessPolicy({
    establishmentActive: ["blood_center"],
    screenView: "open_work",
    permissions: ["blood_center.view", "blood_center.donor.register"],
  });
  assert.equal(retiringView.isRetiring, true);
  assert.equal(retiringView.canRegister, false, "Cannot start new registrations when retiring");
  assert.equal(retiringView.canUpdate, true, "Corrections to existing donors continue while retiring");
  assert.equal(retiringView.retiringBannerText, "No new donor registrations from now on");

  // Case 4: Records view
  const recordsView = evaluateDonorAccessPolicy({
    establishmentActive: [],
    screenView: "records",
    permissions: ["blood_center.view", "blood_center.donor.register"],
  });
  assert.equal(recordsView.isReadOnly, true);
  assert.equal(recordsView.canRegister, false);
  assert.equal(recordsView.canUpdate, false, "Cannot edit records in records mode");
  assert.equal(recordsView.canView, true);

  // Case 5: Hidden view
  const hiddenView = evaluateDonorAccessPolicy({
    screenView: "hidden",
    permissions: ["blood_center.view", "blood_center.donor.register"],
  });
  assert.equal(hiddenView.canView, false);
  assert.equal(hiddenView.canRegister, false);

  // Case 6: Missing register permission
  const viewOnly = evaluateDonorAccessPolicy({
    establishmentActive: ["blood_center"],
    screenView: "full",
    permissions: ["blood_center.view"], // lacks blood_center.donor.register
  });
  assert.equal(viewOnly.canView, true);
  assert.equal(viewOnly.canRegister, false);
  assert.equal(viewOnly.canUpdate, false);
});

test("blood_donors search and registration validation enforces PBTA standards (rule:71bc3f69b3, rule:40349aea7e)", () => {
  // Search validation: rule:71bc3f69b3 - Search first (q, at least 2 characters)
  const emptySearch = validateDonorSearchQuery("");
  assert.equal(emptySearch.valid, false);
  assert.match(emptySearch.error, /at least 2 characters/i);

  const oneCharSearch = validateDonorSearchQuery("a");
  assert.equal(oneCharSearch.valid, false);

  const validSearch = validateDonorSearchQuery("35202-1234567-1");
  assert.equal(validSearch.valid, true);

  // Registration validation: rule:40349aea7e - Name, sex, DOB, identification, and at least one contact
  // 1. Missing fields
  const missingAll = validateDonorRegistration({
    full_name: "",
    sex: "",
    date_of_birth: "",
    id_kind: "",
    id_number: "",
  });
  assert.equal(missingAll.valid, false);
  assert.ok(missingAll.errors.full_name);
  assert.ok(missingAll.errors.sex);
  assert.ok(missingAll.errors.date_of_birth);
  assert.ok(missingAll.errors.id_kind);
  assert.ok(missingAll.errors.id_number);
  assert.ok(missingAll.errors.contact);

  // 2. Underage donor check (< 17 years)
  const now = new Date();
  const underageDob = new Date(now.getFullYear() - 15, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const underage = validateDonorRegistration({
    full_name: "Tariq Mahmood",
    sex: "Male",
    date_of_birth: underageDob,
    id_kind: "CNIC",
    id_number: "35202-9999999-1",
    phone: "03001234567",
  });
  assert.equal(underage.valid, false);
  assert.match(underage.errors.date_of_birth, /at least 17 years old/i);

  // 3. Valid donor registration with phone
  const validDob = new Date(now.getFullYear() - 28, 5, 15).toISOString().slice(0, 10);
  const validReg = validateDonorRegistration({
    full_name: "Muhammad Usman",
    sex: "Male",
    date_of_birth: validDob,
    id_kind: "CNIC",
    id_number: "35201-1234567-3",
    phone: "0300-9876543",
    email: "usman@example.com",
    address: "Gulberg III, Lahore",
  });
  assert.equal(validReg.valid, true);
  assert.equal(Object.keys(validReg.errors).length, 0);

  // 4. Valid with email only (meets at least one contact requirement)
  const validEmailOnly = validateDonorRegistration({
    full_name: "Zainab Bibi",
    sex: "Female",
    date_of_birth: validDob,
    id_kind: "Passport",
    id_number: "PK88776655",
    email: "zainab@example.com",
  });
  assert.equal(validEmailOnly.valid, true);
});

test("blood_donors eligibility and corrections enforce lifetime rules and audit (rule:d7bf9e8097, rule:73b2977f2f)", () => {
  // Eligibility: rule:d7bf9e8097 - Permanently deferred: never 'Donate'
  const permDeferred = evaluateDonorEligibility({
    permanently_deferred: true,
    deferred_now: true,
    may_donate_from: null,
  });
  assert.equal(permDeferred.canDonate, false);
  assert.equal(permDeferred.statusBadge.variant, "danger");
  assert.match(permDeferred.explanation, /permanently deferred and must never donate/i);

  // Eligibility: Active temporary deferral
  const tempDeferred = evaluateDonorEligibility({
    permanently_deferred: false,
    deferred_now: true,
    may_donate_from: "2026-12-01",
  });
  assert.equal(tempDeferred.canDonate, false);
  assert.equal(tempDeferred.statusBadge.variant, "warning");
  assert.match(tempDeferred.explanation, /temporary deferral in force until 2026-12-01/i);

  // Eligibility: Clean record
  const eligible = evaluateDonorEligibility({
    permanently_deferred: false,
    deferred_now: false,
    may_donate_from: null,
  });
  assert.equal(eligible.canDonate, true);
  assert.equal(eligible.statusBadge.variant, "success");

  // Correction validation: rule:73b2977f2f - reason (min 5 chars) and expected_version mandatory
  const missingReason = validateDonorCorrection({
    expected_version: 2,
    reason: "",
    full_name: "Muhammad Ali",
  });
  assert.equal(missingReason.valid, false);
  assert.match(missingReason.errors.reason, /at least 5 characters/i);

  const missingVersion = validateDonorCorrection({
    expected_version: 0,
    reason: "Corrected typo in residential address",
    address: "Model Town, Lahore",
  });
  assert.equal(missingVersion.valid, false);
  assert.match(missingVersion.errors.expected_version, /expected version/i);

  const validCorrection = validateDonorCorrection({
    expected_version: 1,
    reason: "Updated contact telephone number as requested by donor",
    phone: "0321-4455667",
  });
  assert.equal(validCorrection.valid, true);
  assert.equal(Object.keys(validCorrection.errors).length, 0);
});
