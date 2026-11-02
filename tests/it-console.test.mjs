import test from "node:test";
import assert from "node:assert/strict";

import {
  getItConsoleCapabilityView,
  formatCnic,
  isValidCnic,
  isValidPakMobile,
  validateFirstOwnerInput,
  validateKillSwitchInput,
  PRIVILEGED_ROLES,
  isPrivilegedRole,
  validateUserRolesChange,
  canCloseWard,
  validateTerminalInput,
  IT_CONSOLE_ERROR_MESSAGES,
} from "../src/it-console-policy.ts";

test("getItConsoleCapabilityView correctly resolves facility capabilities", () => {
  // Full mode
  const full = getItConsoleCapabilityView();
  assert.equal(full.mode, "full");
  assert.equal(full.canManageUsers, true);
  assert.equal(full.canManageHardware, true);
  assert.equal(full.canManageWards, true);
  assert.equal(full.canManageSettings, true);
  assert.equal(full.canKillSwitch, true);

  // Hidden mode
  const hidden = getItConsoleCapabilityView({ views: { screens: ["triage", "opd_registration"] } });
  assert.equal(hidden.mode, "hidden");
  assert.equal(hidden.canManageUsers, false);
  assert.match(hidden.noticeEn, /hidden/i);

  // Records only
  const records = getItConsoleCapabilityView({ views: { screens: ["it_console"], records_only: true } });
  assert.equal(records.mode, "records");
  assert.equal(records.canManageUsers, false);
  assert.equal(records.canKillSwitch, false);
  assert.match(records.noticeEn, /read-only/i);

  // Open work only
  const openWork = getItConsoleCapabilityView({ views: { screens: ["it_console"], open_work_only: true } });
  assert.equal(openWork.mode, "open_work");
  assert.equal(openWork.canManageUsers, true);
  assert.equal(openWork.canManageWards, false);
  assert.equal(openWork.canKillSwitch, true);

  // Setup only
  const setup = getItConsoleCapabilityView({ views: { screens: ["it_console"], setup_only: true } });
  assert.equal(setup.mode, "setup");
  assert.equal(setup.canManageWards, true);
  assert.equal(setup.canKillSwitch, false);
});

test("formatCnic and isValidCnic enforce 13-digit Pakistani CNIC pattern", () => {
  assert.equal(formatCnic("3520212345671"), "35202-1234567-1");
  assert.equal(isValidCnic("35202-1234567-1"), true);
  assert.equal(isValidCnic("3520212345671"), true);
  assert.equal(isValidCnic("12345"), false);
  assert.equal(isValidCnic("352021234567199"), false);
});

test("isValidPakMobile validates Pakistani mobile formats", () => {
  assert.equal(isValidPakMobile("03001234567"), true);
  assert.equal(isValidPakMobile("0300-1234567"), true);
  assert.equal(isValidPakMobile("+923001234567"), true);
  assert.equal(isValidPakMobile("042111222333"), false);
  assert.equal(isValidPakMobile("0300"), false);
});

test("validateFirstOwnerInput enforces Rule rule:67877c44f8", () => {
  const valid = validateFirstOwnerInput({
    full_name: "Dr. Tariq Khan",
    cnic: "35202-1234567-1",
    mobile: "0300-1234567",
    roles: ["hr_admin", "doctor"],
  });
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);

  // Invalid CNIC and mobile
  const invalid = validateFirstOwnerInput({
    full_name: "A",
    cnic: "123",
    mobile: "999",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.full_name);
  assert.ok(invalid.errors.cnic);
  assert.ok(invalid.errors.mobile);

  // Disallowed roles during first-owner creation
  const badRoles = validateFirstOwnerInput({
    full_name: "Tariq Khan",
    cnic: "35202-1234567-1",
    mobile: "0300-1234567",
    roles: ["super_admin"],
  });
  assert.equal(badRoles.valid, false);
  assert.match(badRoles.errors.roles, /super_admin/);
});

test("validateKillSwitchInput enforces Rule rule:616f98fff0 confirmation phrase", () => {
  const pass = validateKillSwitchInput({
    reason: "Catastrophic ransomware intrusion detected on network",
    confirm: "FORCE GLOBAL LOGOUT",
  });
  assert.equal(pass.valid, true);

  // Missing reason
  const noReason = validateKillSwitchInput({
    reason: "",
    confirm: "FORCE GLOBAL LOGOUT",
  });
  assert.equal(noReason.valid, false);
  assert.match(noReason.error, /reason/i);

  // Mismatched confirmation
  const wrongConfirm = validateKillSwitchInput({
    reason: "Severe security breach",
    confirm: "force global logout",
  });
  assert.equal(wrongConfirm.valid, false);
  assert.match(wrongConfirm.error, /FORCE GLOBAL LOGOUT/);
});

test("validateUserRolesChange enforces Rule rule:b9dbd0ab25", () => {
  // Self role change is strictly forbidden
  const selfChange = validateUserRolesChange(10, 10, ["pharmacist"], ["doctor"]);
  assert.equal(selfChange.allowedDirectly, false);
  assert.match(selfChange.error, /SELF_ROLE_CHANGE_FORBIDDEN/);

  // Removing last owner triggers protection
  const removeOwner = validateUserRolesChange(12, 10, ["doctor"], ["owner", "doctor"]);
  assert.equal(removeOwner.allowedDirectly, false);
  assert.equal(removeOwner.requiresChangeRequest, true);
  assert.match(removeOwner.error, /LAST_OWNER/);

  // Privileged roles require change request
  assert.equal(isPrivilegedRole("owner"), true);
  assert.equal(isPrivilegedRole("billing_admin"), true);
  assert.equal(isPrivilegedRole("pharmacist"), false);

  const grantPrivileged = validateUserRolesChange(15, 10, ["accountant"], ["cashier"]);
  assert.equal(grantPrivileged.allowedDirectly, false);
  assert.equal(grantPrivileged.requiresChangeRequest, true);

  // Ordinary role change is directly allowed
  const grantOrdinary = validateUserRolesChange(15, 10, ["nurse"], ["receptionist"]);
  assert.equal(grantOrdinary.allowedDirectly, true);
  assert.equal(grantOrdinary.requiresChangeRequest, false);
});

test("canCloseWard enforces Rule rule:d0dc21da29 WARD_IN_USE check", () => {
  // Ward with empty beds and 0 waiting can close
  const emptyWard = {
    ward_id: 1,
    code: "GEN-M",
    name: "General Male",
    ward_type: "General",
    beds: 10,
    beds_in_use: [],
    waitlisted: 0,
    is_active: true,
  };
  assert.equal(canCloseWard(emptyWard).canClose, true);

  // Ward with occupied beds cannot close
  const busyWard = {
    ...emptyWard,
    beds_in_use: ["B01", "B02"],
  };
  const busyRes = canCloseWard(busyWard);
  assert.equal(busyRes.canClose, false);
  assert.match(busyRes.reason, /WARD_IN_USE/);
  assert.match(busyRes.reason, /B01, B02/);

  // Ward with waitlisted patients cannot close
  const waitlistWard = {
    ...emptyWard,
    waitlisted: 3,
  };
  const waitRes = canCloseWard(waitlistWard);
  assert.equal(waitRes.canClose, false);
  assert.match(waitRes.reason, /WARD_IN_USE/);
  assert.match(waitRes.reason, /3 patient\(s\) waitlisted/);
});

test("validateTerminalInput enforces Rule rule:b6c546385e cash node requirements", () => {
  const valid = validateTerminalInput({
    mac: "00:1A:2B:3C:4D:5E",
    location_label: "OPD Pharmacy Counter 1",
    cash_node: "PharmacyCounter",
  });
  assert.equal(valid.valid, true);

  const invalid = validateTerminalInput({
    mac: "invalid-mac",
    location_label: "",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.mac);
  assert.ok(invalid.errors.location_label);
});

test("IT_CONSOLE_ERROR_MESSAGES provides bilingual translations for all statutory codes", () => {
  const requiredCodes = [
    "FIRST_OWNER_EXISTS",
    "SELF_ROLE_CHANGE_FORBIDDEN",
    "LAST_OWNER",
    "WARD_IN_USE",
    "MAINTENANCE",
    "KILL_SWITCH_CONFIRMATION_INVALID",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "NOT_FOUND",
  ];

  for (const code of requiredCodes) {
    const entry = IT_CONSOLE_ERROR_MESSAGES[code];
    assert.ok(entry, `Missing error dictionary code: ${code}`);
    assert.ok(entry.en.length > 0, `Empty en text for ${code}`);
    assert.ok(entry.ur.length > 0, `Empty ur text for ${code}`);
    assert.match(entry.ur, /[\u0600-\u06ff]/, `No Urdu text for ${code}`);
  }
});
