import test from "node:test";
import assert from "node:assert/strict";

import {
  getCssdSetupScreenView,
  canManageCssd,
  canViewCssd,
  canViewOpsAssets,
  validateSetTypeIn,
  validateSterilizerIn,
  validateLoadRecall,
  explainCssdError,
  PACKAGING_PRESETS,
} from "../src/cssd-setup-policy.ts";

test("getCssdSetupScreenView evaluates establishment views and service status (rule:37dd1f7236)", () => {
  // Fallback when establishment is null
  assert.equal(getCssdSetupScreenView(null), "full");

  // Server declared screen view takes precedence
  const estWithScreenView = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [],
    views: {
      screens: [{ screen_id: "cssd_setup", view: "open_work" }],
      workspaces: [],
    },
  };
  assert.equal(getCssdSetupScreenView(estWithScreenView), "open_work");

  // Capability state fallback
  const estRetiring = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Retiring" }],
    views: {
      screens: [],
      workspaces: [],
    },
  };
  assert.equal(getCssdSetupScreenView(estRetiring), "open_work");

  const estRetired = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Retired" }],
    views: {
      screens: [],
      workspaces: [],
    },
  };
  assert.equal(getCssdSetupScreenView(estRetired), "records");

  const estPreparing = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Preparing" }],
    views: {
      screens: [],
      workspaces: [],
    },
  };
  assert.equal(getCssdSetupScreenView(estPreparing), "setup");

  const estDisabled = {
    revision: 1,
    profile: null,
    active: [],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Available" }],
    views: {
      screens: [],
      workspaces: [],
    },
  };
  assert.equal(getCssdSetupScreenView(estDisabled), "hidden");
});

test("role and permission gating checks for cssd_setup", () => {
  const managerUser = { permissions: ["cssd.manage", "ops.asset.view"] };
  const operatorUser = { permissions: ["cssd.view", "cssd.operate"] };
  const assetUser = { permissions: ["ops.asset.view"] };
  const unauthorizedUser = { permissions: ["reception.view"] };

  assert.equal(canManageCssd(managerUser), true);
  assert.equal(canManageCssd(operatorUser), false);
  assert.equal(canManageCssd(unauthorizedUser), false);

  assert.equal(canViewCssd(managerUser), true);
  assert.equal(canViewCssd(operatorUser), true);
  assert.equal(canViewCssd(unauthorizedUser), false);

  assert.equal(canViewOpsAssets(managerUser), true);
  assert.equal(canViewOpsAssets(assetUser), true);
  assert.equal(canViewOpsAssets(operatorUser), false);
});

test("validateSetTypeIn enforces packaging shelf life and implant rules (rule:494306e208)", () => {
  // Valid set
  const valid = validateSetTypeIn({
    code: "MAJ-LAP-01",
    name: "Major Laparotomy Set",
    kind: "InstrumentSet",
    method: "Steam",
    shelf_life_days: 180,
    contains_implant: false,
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  // Presets exist
  assert.equal(PACKAGING_PRESETS.InstrumentSet.defaultDays, 180);
  assert.equal(PACKAGING_PRESETS.Linen.defaultDays, 30);
  assert.equal(PACKAGING_PRESETS.Pack.defaultDays, 90);
  assert.equal(PACKAGING_PRESETS.Single.defaultDays, 60);

  // Missing code and name
  const invalidEmpty = validateSetTypeIn({
    code: "",
    name: "",
    kind: "Pack",
    shelf_life_days: 0,
  });
  assert.equal(invalidEmpty.valid, false);
  assert.ok(invalidEmpty.errors.code);
  assert.ok(invalidEmpty.errors.name);
  assert.ok(invalidEmpty.errors.shelf_life_days);

  // Shelf life exceeding 2 years
  const excessiveShelfLife = validateSetTypeIn({
    code: "TEST-01",
    name: "Test Pack",
    kind: "Single",
    shelf_life_days: 1000,
  });
  assert.equal(excessiveShelfLife.valid, false);
  assert.ok(excessiveShelfLife.errors.shelf_life_days);
});

test("validateSterilizerIn enforces name and method validation", () => {
  const valid = validateSterilizerIn({
    name: "Autoclave 1 - Clean Room",
    method: "Steam",
    asset_id: 10,
    location: "CSSD Bay A",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  const invalid = validateSterilizerIn({
    name: "",
    // @ts-expect-error test invalid method
    method: "Microwave",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.method);
});

test("validateLoadRecall enforces released load condition and mandatory reason (rule:dc520ffa20, MSDS IPC 92)", () => {
  const releasedCycle = {
    cycle_id: 101,
    cycle_number: "CYC-2026-101",
    status: "Released",
  };

  const quarantinedCycle = {
    cycle_id: 102,
    cycle_number: "CYC-2026-102",
    status: "Quarantined",
  };

  // Valid recall on released cycle
  const valid = validateLoadRecall(
    "Biological indicator showed spore growth after 24h incubation",
    releasedCycle
  );
  assert.equal(valid.valid, true);

  // Rejection on non-released cycle
  const invalidState = validateLoadRecall(
    "Testing recall on quarantined load",
    quarantinedCycle
  );
  assert.equal(invalidState.valid, false);
  assert.match(invalidState.error, /Only released loads can be recalled/);

  // Rejection on empty or short reason
  const emptyReason = validateLoadRecall("   ", releasedCycle);
  assert.equal(emptyReason.valid, false);
  assert.match(emptyReason.error, /mandatory/);

  const shortReason = validateLoadRecall("bad", releasedCycle);
  assert.equal(shortReason.valid, false);
  assert.match(shortReason.error, /at least 5 characters/);
});

test("explainCssdError provides actionable bilingual error instructions", () => {
  const duplicateSet = explainCssdError("CSSD_SET_EXISTS");
  assert.match(duplicateSet.en, /already exists/);
  assert.match(duplicateSet.ur, /پہلے سے موجود ہے/);

  const duplicateSterilizer = explainCssdError("STERILIZER_EXISTS");
  assert.match(duplicateSterilizer.en, /sterilizer autoclave with this name already exists/i);
  assert.match(duplicateSterilizer.ur, /سٹرلائزر آٹوکلیو پہلے سے موجود ہے/);

  const invalidState = explainCssdError("CSSD_CYCLE_STATE_INVALID");
  assert.match(invalidState.en, /Released/);
  assert.match(invalidState.ur, /Released/);

  const forbidden = explainCssdError("FORBIDDEN");
  assert.match(forbidden.en, /cssd\.manage/);
  assert.match(forbidden.ur, /cssd\.manage/);
});
