import test from "node:test";
import assert from "node:assert/strict";
import {
  getPharmacyStorageLogCapabilityView,
  resolveStorageLimits,
  isTemperatureOutOfRange,
  validateStorageCheckInput,
  STORAGE_LOG_ERROR_MESSAGES,
  STORAGE_KINDS,
  DEFAULT_STORAGE_RANGES,
} from "../src/pharmacy-storage-log-policy.ts";

test("pharmacy_storage_log: capability view resolves based on establishment views.screens", () => {
  assert.equal(getPharmacyStorageLogCapabilityView(null), "full");
  assert.equal(getPharmacyStorageLogCapabilityView({}), "full");

  const estFull = { views: { screens: { pharmacy_storage_log: "full" } } };
  assert.equal(getPharmacyStorageLogCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { pharmacy_storage_log: "open_work" } } };
  assert.equal(getPharmacyStorageLogCapabilityView(estOpenWork), "open_work");

  const estOpenWorkArray = { views: { screens: [{ screen_id: "pharmacy_storage_log", view: "open_work" }] } };
  assert.equal(getPharmacyStorageLogCapabilityView(estOpenWorkArray), "open_work");

  const estRecords = { views: { screens: { pharmacy_storage_log: "records" } } };
  assert.equal(getPharmacyStorageLogCapabilityView(estRecords), "records");

  const estHidden = { views: { screens: { pharmacy_storage_log: "hidden" } } };
  assert.equal(getPharmacyStorageLogCapabilityView(estHidden), "hidden");
});

test("pharmacy_storage_log: resolveStorageLimits applies standard limits and custom boundaries", () => {
  // Defaults
  assert.deepEqual(resolveStorageLimits("Room"), { min_c: 15, max_c: 25 });
  assert.deepEqual(resolveStorageLimits("Refrigerator"), { min_c: 2, max_c: 8 });
  assert.deepEqual(resolveStorageLimits("Freezer"), { min_c: -20, max_c: -10 });
  assert.deepEqual(resolveStorageLimits("ColdChainBox"), { min_c: 2, max_c: 8 });

  // Custom limits
  assert.deepEqual(resolveStorageLimits("ColdChainBox", 3.0, 6.0), { min_c: 3, max_c: 6 });
  assert.deepEqual(resolveStorageLimits("Refrigerator", "1.5", "5.5"), { min_c: 1.5, max_c: 5.5 });
});

test("pharmacy_storage_log: isTemperatureOutOfRange evaluates correctly", () => {
  // Fridge (2 to 8)
  assert.equal(isTemperatureOutOfRange(4.5, 2, 8), false);
  assert.equal(isTemperatureOutOfRange(2.0, 2, 8), false);
  assert.equal(isTemperatureOutOfRange(8.0, 2, 8), false);
  assert.equal(isTemperatureOutOfRange(1.9, 2, 8), true);
  assert.equal(isTemperatureOutOfRange(8.1, 2, 8), true);
});

test("pharmacy_storage_log: validateStorageCheckInput enforces mandatory fields and format (Rule rule:09925ecb70)", () => {
  // Missing storage area
  const r1 = validateStorageCheckInput({
    storage_area: "",
    storage_kind: "Refrigerator",
    temperature_c: 4.5,
  });
  assert.equal(r1.valid, false);
  assert.match(r1.errors.storage_area, /storage area name is required/i);

  // Invalid storage kind
  const r2 = validateStorageCheckInput({
    storage_area: "Main Fridge",
    storage_kind: "IceCreamBox",
    temperature_c: 4.5,
  });
  assert.equal(r2.valid, false);
  assert.match(r2.errors.storage_kind, /valid storage kind/i);

  // Missing or non-numeric temperature
  const r3 = validateStorageCheckInput({
    storage_area: "Main Fridge",
    storage_kind: "Refrigerator",
    temperature_c: "hot",
  });
  assert.equal(r3.valid, false);
  assert.match(r3.errors.temperature_c, /numeric temperature reading/i);

  // Invalid humidity percentage (>100 or <0)
  const r4 = validateStorageCheckInput({
    storage_area: "Main Fridge",
    storage_kind: "Refrigerator",
    temperature_c: 4.5,
    humidity_pct: 120,
  });
  assert.equal(r4.valid, false);
  assert.match(r4.errors.humidity_pct, /between 0 and 100/i);

  // Mismatched custom limits
  const r5 = validateStorageCheckInput({
    storage_area: "Vaccine Box",
    storage_kind: "ColdChainBox",
    temperature_c: 4.0,
    min_c: 2.0,
    max_c: "",
  });
  assert.equal(r5.valid, false);
  assert.match(r5.errors.custom_limits, /both minimum and maximum/i);

  const r6 = validateStorageCheckInput({
    storage_area: "Vaccine Box",
    storage_kind: "ColdChainBox",
    temperature_c: 4.0,
    min_c: 8.0,
    max_c: 2.0,
  });
  assert.equal(r6.valid, false);
  assert.match(r6.errors.custom_limits, /strictly less than maximum/i);
});

test("pharmacy_storage_log: out-of-range readings strictly demand action_taken (Rule rule:e66d8b92db)", () => {
  // In-range reading: action_taken not required
  const inRange = validateStorageCheckInput({
    storage_area: "Ward 3 Refrigerator",
    storage_kind: "Refrigerator",
    ward_id: 3,
    temperature_c: 4.5,
    humidity_pct: 60,
  });
  assert.equal(inRange.valid, true);
  assert.equal(inRange.isOutOfRange, false);
  assert.equal(Object.keys(inRange.errors).length, 0);

  // Out-of-range reading without action_taken: fails with STORAGE_CHECK_ACTION_REQUIRED
  const outOfRangeNoAction = validateStorageCheckInput({
    storage_area: "Ward 3 Refrigerator",
    storage_kind: "Refrigerator",
    ward_id: 3,
    temperature_c: 9.2,
    action_taken: "",
  });
  assert.equal(outOfRangeNoAction.valid, false);
  assert.equal(outOfRangeNoAction.isOutOfRange, true);
  assert.match(outOfRangeNoAction.errors.action_taken, /STORAGE_CHECK_ACTION_REQUIRED/i);

  // Out-of-range reading with action_taken: passes
  const outOfRangeWithAction = validateStorageCheckInput({
    storage_area: "Ward 3 Refrigerator",
    storage_kind: "Refrigerator",
    ward_id: 3,
    temperature_c: 9.2,
    action_taken: "Door was left ajar; verified door seal, adjusted thermostat, and verified temperature returned to 5.0C.",
  });
  assert.equal(outOfRangeWithAction.valid, true);
  assert.equal(outOfRangeWithAction.isOutOfRange, true);
  assert.equal(Object.keys(outOfRangeWithAction.errors).length, 0);
});

test("pharmacy_storage_log: error messages dictionary covers all contract error codes", () => {
  const codes = [
    "STORAGE_CHECK_ACTION_REQUIRED",
    "FORBIDDEN",
    "REFERENCE_NOT_FOUND",
    "VALIDATION_ERROR",
  ];
  for (const c of codes) {
    assert.ok(STORAGE_LOG_ERROR_MESSAGES[c], `Missing error message for ${c}`);
    assert.ok(STORAGE_LOG_ERROR_MESSAGES[c].en, `Missing English text for ${c}`);
    assert.ok(STORAGE_LOG_ERROR_MESSAGES[c].ur, `Missing Urdu text for ${c}`);
  }
});
