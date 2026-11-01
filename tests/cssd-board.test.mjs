import test from "node:test";
import assert from "node:assert/strict";

import {
  getCssdBoardScreenView,
  isCssdActive,
  canOperateCssd,
  canManageCssd,
  canViewCssd,
  canPrintLabels,
  validateCycleStart,
  validateCycleResults,
  isBowieDickRequired,
  sortCyclesBoardOrder,
  getCompatibleSetTypes,
  explainCssdBoardError,
} from "../src/cssd-board-policy.ts";

test("getCssdBoardScreenView evaluates establishment views and service status (rule:dfad4a25d2)", () => {
  // Fallback when establishment is null
  assert.equal(getCssdBoardScreenView(null), "full");

  // Server declared screen view takes precedence
  const estWithScreenView = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [],
    views: {
      screens: [{ screen_id: "cssd_board", view: "open_work" }],
      workspaces: [],
    },
  };
  assert.equal(getCssdBoardScreenView(estWithScreenView), "open_work");

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
  assert.equal(getCssdBoardScreenView(estRetiring), "open_work");

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
  assert.equal(getCssdBoardScreenView(estRetired), "records");

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
  assert.equal(getCssdBoardScreenView(estPreparing), "setup");

  const estAvailable = {
    revision: 1,
    profile: null,
    active: ["cssd"],
    rules_in_force: [],
    capabilities: [{ capability: "cssd", state: "Available" }],
    views: {
      screens: [],
      workspaces: [],
    },
  };
  assert.equal(getCssdBoardScreenView(estAvailable), "hidden");
});

test("isCssdActive and role permission checks", () => {
  assert.equal(isCssdActive(null), false);
  assert.equal(isCssdActive({ active: ["cssd"] }), true);
  assert.equal(isCssdActive({ active: ["ot"] }), false);

  const technician = { permissions: ["cssd.operate"] };
  const manager = { permissions: ["cssd.manage"] };
  const viewer = { permissions: ["cssd.view"] };
  const other = { permissions: ["billing.view"] };

  assert.equal(canOperateCssd(technician), true);
  assert.equal(canOperateCssd(viewer), false);

  assert.equal(canManageCssd(manager), true);
  assert.equal(canManageCssd(technician), false);

  assert.equal(canViewCssd(viewer), true);
  assert.equal(canViewCssd(technician), true);
  assert.equal(canViewCssd(manager), true);
  assert.equal(canViewCssd(other), false);

  assert.equal(canPrintLabels(technician), true);
  assert.equal(canPrintLabels(manager), true);
  assert.equal(canPrintLabels(viewer), false);
});

test("validateCycleStart validates sterilizer, packs and method compatibility (rule:9a5570e2a6)", () => {
  const sterilizers = [
    { sterilizer_id: 1, name: "Autoclave 1", method: "Steam", is_active: true },
    { sterilizer_id: 2, name: "Plasma 1", method: "Plasma", is_active: true },
  ];
  const setTypes = [
    { set_type_id: 10, name: "Major Set", method: "Steam", is_active: true },
    { set_type_id: 20, name: "Endo Scope", method: "Plasma", is_active: true },
  ];

  // Missing sterilizer
  const noSterilizer = validateCycleStart({
    sterilizer_id: null,
    cycle_type: "Load",
    packs: [{ set_type_id: 10, count: 1 }],
    sterilizers,
    setTypes,
  });
  assert.equal(noSterilizer.valid, false);
  assert.ok(noSterilizer.errors.some((e) => e.includes("Select a sterilizer")));

  // Load with no packs
  const emptyLoad = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "Load",
    packs: [],
    sterilizers,
    setTypes,
  });
  assert.equal(emptyLoad.valid, false);
  assert.ok(emptyLoad.errors.some((e) => e.includes("at least one set")));

  // Load with zero count
  const zeroCount = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "Load",
    packs: [{ set_type_id: 10, count: 0 }],
    sterilizers,
    setTypes,
  });
  assert.equal(zeroCount.valid, false);
  assert.ok(zeroCount.errors.some((e) => e.includes("greater than zero")));

  // Method mismatch (Steam autoclave with Plasma set)
  const mismatch = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "Load",
    packs: [{ set_type_id: 20, count: 1 }],
    sterilizers,
    setTypes,
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.some((e) => e.includes("uses Plasma method but this sterilizer uses Steam")));

  // Test cycle with packs (BowieDick must have no packs per rule:9a5570e2a6)
  const testWithPacks = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "BowieDick",
    packs: [{ set_type_id: 10, count: 1 }],
    sterilizers,
    setTypes,
  });
  assert.equal(testWithPacks.valid, false);
  assert.ok(testWithPacks.errors.some((e) => e.includes("Test cycles must not include any packs")));

  // Valid Load cycle
  const validLoad = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "Load",
    packs: [{ set_type_id: 10, count: 2 }],
    sterilizers,
    setTypes,
  });
  assert.equal(validLoad.valid, true);

  // Valid Bowie-Dick test cycle
  const validBD = validateCycleStart({
    sterilizer_id: 1,
    cycle_type: "BowieDick",
    packs: [],
    sterilizers,
    setTypes,
  });
  assert.equal(validBD.valid, true);
});

test("validateCycleResults validates physical parameters, chemical, and biological indicators (rule:4d7517d090)", () => {
  // Valid running cycle results
  const validResults = validateCycleResults({
    temperature_c: 134,
    pressure_kpa: 210,
    exposure_minutes: 4,
    mechanical_pass: true,
    chemical_result: "Pass",
    biological_result: "NotUsed",
    failure_note: "",
    cycleStatus: "Running",
  });
  assert.equal(validResults.valid, true);

  // Out of range temperature
  const badTemp = validateCycleResults({
    temperature_c: 15,
    pressure_kpa: 210,
    exposure_minutes: 4,
    mechanical_pass: true,
    chemical_result: "Pass",
    biological_result: "NotUsed",
    failure_note: "",
    cycleStatus: "Running",
  });
  assert.equal(badTemp.valid, false);
  assert.ok(badTemp.errors.some((e) => e.includes("between 20 and 250")));

  // Failed chemical indicator without failure_note
  const failedNoNote = validateCycleResults({
    temperature_c: 134,
    pressure_kpa: 210,
    exposure_minutes: 4,
    mechanical_pass: true,
    chemical_result: "Fail",
    biological_result: "NotUsed",
    failure_note: "",
    cycleStatus: "Running",
  });
  assert.equal(failedNoNote.valid, false);
  assert.ok(failedNoNote.errors.some((e) => e.includes("failure note is required")));

  // Failed chemical indicator with failure_note
  const failedWithNote = validateCycleResults({
    temperature_c: 134,
    pressure_kpa: 210,
    exposure_minutes: 4,
    mechanical_pass: true,
    chemical_result: "Fail",
    biological_result: "NotUsed",
    failure_note: "Indicator strip did not undergo full color change",
    cycleStatus: "Running",
  });
  assert.equal(failedWithNote.valid, true);

  // Quarantined load: requires Pass or Fail, not Pending
  const quarantinedPending = validateCycleResults({
    temperature_c: null,
    pressure_kpa: null,
    exposure_minutes: null,
    mechanical_pass: null,
    chemical_result: null,
    biological_result: "Pending",
    failure_note: "",
    cycleStatus: "Quarantined",
  });
  assert.equal(quarantinedPending.valid, false);
  assert.ok(quarantinedPending.errors.some((e) => e.includes("Pass or Fail")));

  // Quarantined load: Fail requires failure_note
  const quarantinedFailNoNote = validateCycleResults({
    temperature_c: null,
    pressure_kpa: null,
    exposure_minutes: null,
    mechanical_pass: null,
    chemical_result: null,
    biological_result: "Fail",
    failure_note: "",
    cycleStatus: "Quarantined",
  });
  assert.equal(quarantinedFailNoNote.valid, false);
  assert.ok(quarantinedFailNoNote.errors.some((e) => e.includes("failure note is required")));

  const quarantinedPass = validateCycleResults({
    temperature_c: null,
    pressure_kpa: null,
    exposure_minutes: null,
    mechanical_pass: null,
    chemical_result: null,
    biological_result: "Pass",
    failure_note: "",
    cycleStatus: "Quarantined",
  });
  assert.equal(quarantinedPass.valid, true);
});

test("isBowieDickRequired checks if steam sterilizer passed daily test (rule:2e3fcc57c7)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // No cycles at all
  assert.equal(isBowieDickRequired(1, []), true);

  // BowieDick yesterday does not satisfy today
  const yesterdayCycles = [
    { sterilizer_id: 1, cycle_type: "BowieDick", status: "Released", started_at: `${yesterday}T08:00:00Z` },
  ];
  assert.equal(isBowieDickRequired(1, yesterdayCycles), true);

  // Failed BowieDick today does not satisfy
  const failedTodayCycles = [
    { sterilizer_id: 1, cycle_type: "BowieDick", status: "Failed", started_at: `${today}T08:00:00Z` },
  ];
  assert.equal(isBowieDickRequired(1, failedTodayCycles), true);

  // Passed BowieDick today satisfies rule
  const passedTodayCycles = [
    { sterilizer_id: 1, cycle_type: "BowieDick", status: "Released", started_at: `${today}T08:00:00Z` },
  ];
  assert.equal(isBowieDickRequired(1, passedTodayCycles), false);
});

test("sortCyclesBoardOrder pins Running and Quarantined cycles at top (rule:b48c7fa7a8)", () => {
  const cycles = [
    { cycle_id: 1, status: "Released", started_at: "2026-10-01T10:00:00Z" },
    { cycle_id: 2, status: "Running", started_at: "2026-10-01T08:00:00Z" },
    { cycle_id: 3, status: "Failed", started_at: "2026-10-01T12:00:00Z" },
    { cycle_id: 4, status: "Quarantined", started_at: "2026-10-01T09:00:00Z" },
  ];

  const sorted = sortCyclesBoardOrder(cycles);
  assert.equal(sorted[0].cycle_id, 2); // Running first
  assert.equal(sorted[1].cycle_id, 4); // Quarantined second
  assert.equal(sorted[2].cycle_id, 3); // Newer finished
  assert.equal(sorted[3].cycle_id, 1); // Older finished
});

test("getCompatibleSetTypes filters by sterilizer method", () => {
  const sterilizers = [
    { sterilizer_id: 1, name: "Steam 1", method: "Steam", is_active: true },
    { sterilizer_id: 2, name: "Plasma 1", method: "Plasma", is_active: true },
  ];
  const setTypes = [
    { set_type_id: 1, name: "Major Set", method: "Steam", is_active: true },
    { set_type_id: 2, name: "Retired Set", method: "Steam", is_active: false },
    { set_type_id: 3, name: "Camera Set", method: "Plasma", is_active: true },
  ];

  const steamSets = getCompatibleSetTypes(1, sterilizers, setTypes);
  assert.equal(steamSets.length, 1);
  assert.equal(steamSets[0].set_type_id, 1);

  const plasmaSets = getCompatibleSetTypes(2, sterilizers, setTypes);
  assert.equal(plasmaSets.length, 1);
  assert.equal(plasmaSets[0].set_type_id, 3);
});

test("explainCssdBoardError provides bilingual error explanations", () => {
  const dailyTestErr = explainCssdBoardError("CSSD_DAILY_TEST_REQUIRED");
  assert.ok(dailyTestErr.en.includes("Bowie-Dick"));
  assert.ok(dailyTestErr.ur.includes("بووی-ڈک"));

  const bioErr = explainCssdBoardError("CSSD_BIOLOGICAL_REQUIRED");
  assert.ok(bioErr.en.includes("biological indicator"));
  assert.ok(bioErr.ur.includes("حیاتیاتی"));

  const fallback = explainCssdBoardError("UNKNOWN_ERR");
  assert.ok(fallback.en.includes("UNKNOWN_ERR"));
});
