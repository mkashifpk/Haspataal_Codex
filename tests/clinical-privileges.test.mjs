import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  evaluateClinicalPrivilegesView,
  canManagePrivileges,
  canViewPrivileges,
  canSearchEmployees,
  canViewTheatrePolicy,
  getPrivilegeStatus,
  validateGrantInput,
  validateUpdateInput,
  validateRevokeInput,
  explainClinicalPrivilegesError,
  PRIVILEGE_LABELS,
} from "../src/clinical-privileges-policy.ts";

test("evaluateClinicalPrivilegesView handles all runtime surgery service views (rule:caf82033b4)", () => {
  // 1. full view: normal active service
  const fullEst = {
    views: {
      screens: [{ screen_id: "clinical_privileges", view: "full" }],
    },
  };
  const fullResult = evaluateClinicalPrivilegesView(fullEst);
  assert.equal(fullResult.view, "full");
  assert.equal(fullResult.canCreateNew, true);
  assert.equal(fullResult.isReadOnly, false);
  assert.equal(fullResult.banner, undefined);

  // 2. open_work view: retiring service
  const openEst = {
    views: {
      screens: [{ screen_id: "clinical_privileges", view: "open_work" }],
    },
  };
  const openResult = evaluateClinicalPrivilegesView(openEst);
  assert.equal(openResult.view, "open_work");
  assert.equal(openResult.canCreateNew, false);
  assert.equal(openResult.isReadOnly, false);
  assert.match(openResult.banner || "", /No new clinical privilege grants/);

  // 3. records view: retired service
  const recEst = {
    views: {
      screens: [{ screen_id: "clinical_privileges", view: "records" }],
    },
  };
  const recResult = evaluateClinicalPrivilegesView(recEst);
  assert.equal(recResult.view, "records");
  assert.equal(recResult.canCreateNew, false);
  assert.equal(recResult.isReadOnly, true);
  assert.match(recResult.banner || "", /Records view/);

  // 4. setup view: service preparation before activation
  const setupEst = {
    views: {
      screens: [{ screen_id: "clinical_privileges", view: "setup" }],
    },
  };
  const setupResult = evaluateClinicalPrivilegesView(setupEst);
  assert.equal(setupResult.view, "setup");
  assert.equal(setupResult.canCreateNew, true);
  assert.equal(setupResult.isReadOnly, false);
  assert.match(setupResult.banner || "", /Setup mode/);

  // 5. hidden view: service inactive / unconfigured
  const hiddenEst = {
    views: {
      screens: [{ screen_id: "clinical_privileges", view: "hidden" }],
    },
  };
  const hiddenResult = evaluateClinicalPrivilegesView(hiddenEst);
  assert.equal(hiddenResult.view, "hidden");
  assert.equal(hiddenResult.canCreateNew, false);
  assert.equal(hiddenResult.isReadOnly, true);
});

test("role permissions gating restricts management and viewing actions", () => {
  const managerUser = {
    permissions: ["ot.privilege.manage", "hr.employee.view", "ot.clinical.view"],
  };
  assert.equal(canManagePrivileges(managerUser), true);
  assert.equal(canViewPrivileges(managerUser), true);
  assert.equal(canSearchEmployees(managerUser), true);
  assert.equal(canViewTheatrePolicy(managerUser), true);

  const viewerUser = {
    permissions: ["ot.status.view", "ot.checklist.configure"],
  };
  assert.equal(canManagePrivileges(viewerUser), false);
  assert.equal(canViewPrivileges(viewerUser), true);
  assert.equal(canSearchEmployees(viewerUser), false);
  assert.equal(canViewTheatrePolicy(viewerUser), true);

  const unauthorizedUser = {
    permissions: ["cashier.receipt.create"],
  };
  assert.equal(canManagePrivileges(unauthorizedUser), false);
  assert.equal(canViewPrivileges(unauthorizedUser), false);
  assert.equal(canSearchEmployees(unauthorizedUser), false);
  assert.equal(canViewTheatrePolicy(unauthorizedUser), false);
  assert.equal(canManagePrivileges(null), false);
});

test("getPrivilegeStatus identifies active, 30-day expiring, expired, and revoked grants (rule:fa7737b903)", () => {
  const fixedNow = new Date("2026-11-01T12:00:00Z");

  // 1. Revoked privilege
  const revoked = {
    privilege_id: 1,
    employee_id: 10,
    full_name: "Dr. A",
    designation: "Surgeon",
    specialty: null,
    license_type: "PMDC",
    license_number: "LIC-1",
    privilege: "Surgery",
    scope: "General surgery",
    basis: "Committee",
    valid_from: "2025-01-01",
    valid_until: "2027-01-01",
    granted_by: 1,
    granted_by_name: "Admin",
    granted_at: "2025-01-01T00:00:00Z",
    revoked_at: "2026-06-01T00:00:00Z",
    revoked_by_name: "Director",
    revoke_reason: "Resigned",
    row_version: 1,
    is_current: false,
  };
  const revStatus = getPrivilegeStatus(revoked, fixedNow);
  assert.equal(revStatus.status, "Revoked");
  assert.equal(revStatus.badgeClass, "badge-danger");

  // 2. Indefinite active privilege
  const indefinite = {
    ...revoked,
    revoked_at: null,
    revoke_reason: null,
    valid_until: null,
    is_current: true,
  };
  const indStatus = getPrivilegeStatus(indefinite, fixedNow);
  assert.equal(indStatus.status, "Active");
  assert.equal(indStatus.badgeClass, "badge-success");

  // 3. Expiring soon (15 days remaining) -> rule:fa7737b903
  const expiringSoon = {
    ...revoked,
    revoked_at: null,
    revoke_reason: null,
    valid_until: "2026-11-16",
    is_current: true,
  };
  const expStatus = getPrivilegeStatus(expiringSoon, fixedNow);
  assert.equal(expStatus.status, "ExpiringSoon");
  assert.equal(expStatus.badgeClass, "badge-warning");
  assert.equal(expStatus.daysRemaining, 15);

  // 4. Expired (10 days ago)
  const expired = {
    ...revoked,
    revoked_at: null,
    revoke_reason: null,
    valid_until: "2026-10-22",
    is_current: false,
  };
  const expiredStatus = getPrivilegeStatus(expired, fixedNow);
  assert.equal(expiredStatus.status, "Expired");
  assert.equal(expiredStatus.badgeClass, "badge-danger");
  assert.equal(expiredStatus.daysRemaining, -10);

  // 5. Far future active (> 30 days)
  const futureActive = {
    ...revoked,
    revoked_at: null,
    revoke_reason: null,
    valid_until: "2027-05-01",
    is_current: true,
  };
  const futStatus = getPrivilegeStatus(futureActive, fixedNow);
  assert.equal(futStatus.status, "Active");
  assert.equal(futStatus.badgeClass, "badge-success");
});

test("validateGrantInput validates employee, category, scope, basis, and dates", () => {
  // Empty payload
  const empty = validateGrantInput({});
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.employee_id);
  assert.ok(empty.errors.privilege);
  assert.ok(empty.errors.scope);
  assert.ok(empty.errors.basis);

  // Valid payload
  const valid = validateGrantInput({
    employee_id: 14,
    privilege: "Surgery",
    scope: "Laparoscopic cholecystectomy, open appendectomy",
    basis: "FCPS General Surgery, Credentials Committee 2026",
    valid_from: "2026-11-01",
    valid_until: "2027-11-01",
  });
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);

  // Invalid date ordering
  const badDates = validateGrantInput({
    employee_id: 14,
    privilege: "Anaesthesia",
    scope: "Adult general anaesthesia",
    basis: "MCPS Anaesthesia",
    valid_from: "2026-11-01",
    valid_until: "2025-11-01",
  });
  assert.equal(badDates.valid, false);
  assert.ok(badDates.errors.valid_until);
});

test("validateUpdateInput and validateRevokeInput enforce scope, basis, and mandatory reasons", () => {
  // Update validation
  const validUpdate = validateUpdateInput({
    scope: "Updated scope: emergency laparotomy added",
    basis: "Additional training credential verified",
    valid_until: "2028-01-01",
  });
  assert.equal(validUpdate.valid, true);

  const shortUpdate = validateUpdateInput({
    scope: "x",
  });
  assert.equal(shortUpdate.valid, false);
  assert.ok(shortUpdate.errors.scope);

  // Revoke validation
  const validRevoke = validateRevokeInput({
    reason: "Resigned from hospital clinical service on 2026-11-01",
  });
  assert.equal(validRevoke.valid, true);

  const emptyRevoke = validateRevokeInput({
    reason: "  ",
  });
  assert.equal(emptyRevoke.valid, false);
  assert.ok(emptyRevoke.errors.reason);
});

test("explainClinicalPrivilegesError provides clear guidance for all statutory domain errors", () => {
  const exists = explainClinicalPrivilegesError(new Error("409 OT_PRIVILEGE_EXISTS: person holds privilege"));
  assert.equal(exists.code, "OT_PRIVILEGE_EXISTS");
  assert.match(exists.message, /already holds this privilege/);
  assert.match(exists.messageUr, /پہلے سے موجود ہے/);

  const revoked = explainClinicalPrivilegesError(new Error("409 OT_PRIVILEGE_REVOKED: grant was revoked"));
  assert.equal(revoked.code, "OT_PRIVILEGE_REVOKED");
  assert.match(revoked.message, /already revoked/);

  const required = explainClinicalPrivilegesError(new Error("403 OT_PRIVILEGE_REQUIRED: theatre authorization needed"));
  assert.equal(required.code, "OT_PRIVILEGE_REQUIRED");
  assert.match(required.message, /not authorized this person/);

  const conflict = explainClinicalPrivilegesError(new Error("409 VERSION_CONFLICT: expected version 1 but was 2"));
  assert.equal(conflict.code, "VERSION_CONFLICT");
  assert.match(conflict.message, /updated by another user/);
});

test("clinical privileges contract bundle defines all 6 endpoints, value lists, and delivery gate", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/clinical_privileges.json", "utf8"));
  assert.equal(bundle.screen_id, "clinical_privileges");
  assert.equal(bundle.endpoints.length, 6);
  assert.ok(bundle.delivery_gate);
  assert.equal(bundle.definition_of_done.points, 55);

  const epNames = bundle.endpoints.map((e) => e.endpoint);
  assert.ok(epNames.includes("GET /ot/privileges"));
  assert.ok(epNames.includes("POST /ot/privileges"));
  assert.ok(epNames.includes("PATCH /ot/privileges/{privilege_id}"));
  assert.ok(epNames.includes("POST /ot/privileges/{privilege_id}/revoke"));
  assert.ok(epNames.includes("GET /hr/employees"));
  assert.ok(epNames.includes("GET /ot/theatre-policy/pdf"));
});
