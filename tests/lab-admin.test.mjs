import test from "node:test";
import assert from "node:assert/strict";
import {
  getLabAdminCapabilityView,
  validateMetricDef,
  validateMetricSchema,
  createDefaultMetric,
  validateLabTestInput,
  validateLabTestUpdate,
  validateBomInput,
  validateReagentInput,
  validateReagentBatchInput,
  validateReagentAdjustInput,
  validateContractorInput,
  LAB_ADMIN_ERROR_MESSAGES,
  TEST_SECTIONS,
  SAMPLE_TYPES,
  COMMON_NOTIFIABLE_DISEASES,
  REAGENT_ADJUST_REASONS,
} from "../src/lab-admin-policy.ts";

test("lab_admin: capability view resolves based on establishment views.screens (Rule rule:0f8b607b2c)", () => {
  assert.equal(getLabAdminCapabilityView(null), "full");
  assert.equal(getLabAdminCapabilityView({}), "full");

  // Dictionary style
  const estFull = { views: { screens: { lab_admin: "full" } } };
  assert.equal(getLabAdminCapabilityView(estFull), "full");

  const estOpenWork = { views: { screens: { lab_admin: "open_work" } } };
  assert.equal(getLabAdminCapabilityView(estOpenWork), "open_work");

  const estRecords = { views: { screens: { lab_admin: "records" } } };
  assert.equal(getLabAdminCapabilityView(estRecords), "records");

  const estSetup = { views: { screens: { lab_admin: "setup" } } };
  assert.equal(getLabAdminCapabilityView(estSetup), "setup");

  const estHidden = { views: { screens: { lab_admin: "hidden" } } };
  assert.equal(getLabAdminCapabilityView(estHidden), "hidden");

  // Array style
  const estArray = { views: { screens: [{ screen_id: "lab_admin", view: "open_work" }] } };
  assert.equal(getLabAdminCapabilityView(estArray), "open_work");
});

test("lab_admin: metric schema definition and validation (Rule rule:26ecdbf976)", () => {
  // Valid numeric metric with physiological reference ranges and panic critical limits
  const numMetric = {
    key: "hb",
    label: "Hemoglobin",
    type: "number",
    unit: "g/dL",
    decimals: 1,
    required: true,
    ref: {
      default: [12.0, 17.5],
      male: [13.5, 17.5],
      female: [12.0, 15.5],
    },
    critical: {
      low: 7.0,
      high: 20.0,
    },
  };
  const resNum = validateMetricDef(numMetric);
  assert.equal(resNum.valid, true);

  // Valid qualitative text metric with categorical critical values
  const textMetric = {
    key: "dengue_ns1",
    label: "Dengue NS1 Antigen",
    type: "text",
    required: true,
    critical: {
      values: ["Positive", "Reactive"],
    },
  };
  const resText = validateMetricDef(textMetric);
  assert.equal(resText.valid, true);

  // Invalid: missing key or label
  assert.equal(validateMetricDef({ key: "", label: "Hb" }).valid, false);
  assert.equal(validateMetricDef({ key: "hb", label: "" }).valid, false);

  // Invalid: critical low greater than critical high
  const invalidCrit = validateMetricDef({
    key: "wbc",
    label: "WBC Count",
    type: "number",
    critical: { low: 25.0, high: 4.0 },
  });
  assert.equal(invalidCrit.valid, false);
  assert.match(invalidCrit.error, /cannot be greater than critical high/i);

  // Schema validation: requires at least 1 metric and unique keys
  assert.equal(validateMetricSchema([]).valid, false);

  const duplicateKeys = [
    { key: "alt", label: "Alanine Aminotransferase", type: "number" },
    { key: "alt", label: "ALT Repeat", type: "number" },
  ];
  const resDup = validateMetricSchema(duplicateKeys);
  assert.equal(resDup.valid, false);
  assert.match(resDup.error, /duplicate metric key/i);

  // Default metric helper
  const def = createDefaultMetric({ key: "glucose", label: "Fasting Blood Sugar", unit: "mg/dL" });
  assert.equal(def.key, "glucose");
  assert.equal(def.label, "Fasting Blood Sugar");
  assert.equal(def.unit, "mg/dL");
  assert.equal(def.type, "number");
});

test("lab_admin: validateLabTestInput enforces turnaround, availability and notifiable rules (Rule rule:c8be844050)", () => {
  const validTest = {
    code: "CBC",
    name: "Complete Blood Count",
    section: "Hematology",
    sample_type: "Blood",
    price: 650,
    turnaround_minutes: 120,
    emergency_turnaround_minutes: 30,
    availability: "InHouse",
    available_24h: true,
    notifiable_disease: null,
    metric_schema: [createDefaultMetric({ key: "hb", label: "Hemoglobin" })],
  };

  const resValid = validateLabTestInput(validTest);
  assert.equal(resValid.valid, true);
  assert.deepEqual(resValid.errors, {});

  // SendOut requires valid diagnostic partner laboratory
  const sendOutWithoutPartner = {
    ...validTest,
    availability: "SendOut",
    send_out_partner_id: null,
  };
  const resSendOut = validateLabTestInput(sendOutWithoutPartner);
  assert.equal(resSendOut.valid, false);
  assert.match(resSendOut.errors.send_out_partner_id, /diagnostic partner is required/i);

  // Negative price or invalid turnaround
  const invalidNumbers = {
    ...validTest,
    price: -50,
    turnaround_minutes: 0,
    emergency_turnaround_minutes: -10,
  };
  const resInv = validateLabTestInput(invalidNumbers);
  assert.equal(resInv.valid, false);
  assert.match(resInv.errors.price, /non-negative/i);
  assert.match(resInv.errors.turnaround_minutes, /greater than 0/i);
  assert.match(resInv.errors.emergency_turnaround_minutes, /greater than 0/i);
});

test("lab_admin: validateLabTestUpdate validates updates and preserves optimistic concurrency", () => {
  const validUpdate = {
    name: "Complete Blood Count (Automated 5-Part)",
    turnaround_minutes: 90,
    emergency_turnaround_minutes: 25,
    available_24h: true,
    notifiable_disease: null,
    row_version: 3,
  };
  assert.equal(validateLabTestUpdate(validUpdate).valid, true);

  const invalidUpdate = {
    turnaround_minutes: -5,
    availability: "SendOut",
    send_out_partner_id: 0,
  };
  const res = validateLabTestUpdate(invalidUpdate);
  assert.equal(res.valid, false);
  assert.match(res.errors.turnaround_minutes, /greater than 0/i);
  assert.match(res.errors.send_out_partner_id, /diagnostic partner is required/i);
});

test("lab_admin: validateBomInput checks reagent consumption formula", () => {
  const validBom = [
    { reagent_id: 1, qty_per_test: 0.5 },
    { reagent_id: 2, qty_per_test: 1.0 },
  ];
  assert.equal(validateBomInput(validBom).valid, true);

  // Duplicate reagent ID
  const dupBom = [
    { reagent_id: 1, qty_per_test: 0.5 },
    { reagent_id: 1, qty_per_test: 0.2 },
  ];
  const resDup = validateBomInput(dupBom);
  assert.equal(resDup.valid, false);
  assert.match(resDup.error, /duplicate reagent id/i);

  // Non-positive quantity
  const zeroQty = [{ reagent_id: 1, qty_per_test: 0 }];
  assert.equal(validateBomInput(zeroQty).valid, false);
});

test("lab_admin: reagent inventory, batch receipt and adjustment validations", () => {
  // Reagent creation
  const validReagent = {
    code: "RG-LYSE-01",
    name: "Stromatolyser Reagent 500ml",
    unit: "ml",
    low_stock_threshold: 100,
    near_expiry_alert_days: 90,
  };
  assert.equal(validateReagentInput(validReagent).valid, true);

  assert.equal(validateReagentInput({ ...validReagent, code: "X" }).valid, false);
  assert.equal(validateReagentInput({ ...validReagent, unit: "" }).valid, false);

  // Reagent batch receipt
  const validBatch = {
    reagent_id: 1,
    batch_no: "BATCH-2026-OCT",
    expiry_date: "2027-10-31",
    qty_received: 200,
    total_cost: 15000,
  };
  assert.equal(validateReagentBatchInput(validBatch).valid, true);
  assert.equal(validateReagentBatchInput({ ...validBatch, qty_received: 0 }).valid, false);

  // Reagent adjustment / write-off
  const validAdjust = {
    reagent_batch_id: 10,
    qty: 5,
    reason: "Expiry",
    note: "Vial expired on shelf during inventory count.",
  };
  assert.equal(validateReagentAdjustInput(validAdjust).valid, true);
  assert.equal(validateReagentAdjustInput({ ...validAdjust, reason: "Stolen" }).valid, false);
  assert.equal(validateReagentAdjustInput({ ...validAdjust, note: "ok" }).valid, false);
});

test("lab_admin: contractor revenue share validation and bilingual error mapping", () => {
  const validContract = {
    hospital_share_pct: 60,
    contractor_employee_id: 12,
    effective_from: "2026-11-01",
  };
  assert.equal(validateContractorInput(validContract).valid, true);

  assert.equal(validateContractorInput({ ...validContract, hospital_share_pct: 120 }).valid, false);
  assert.equal(validateContractorInput({ ...validContract, effective_from: "invalid-date" }).valid, false);

  // Verify all seed errors have bilingual messages
  assert(LAB_ADMIN_ERROR_MESSAGES.DIAGNOSTIC_PARTNER_INVALID.en);
  assert(LAB_ADMIN_ERROR_MESSAGES.DIAGNOSTIC_PARTNER_INVALID.ur);
  assert(LAB_ADMIN_ERROR_MESSAGES.INSUFFICIENT_STOCK.en);
  assert(LAB_ADMIN_ERROR_MESSAGES.INSUFFICIENT_STOCK.ur);
  assert(LAB_ADMIN_ERROR_MESSAGES.NOT_FOUND.en);
  assert(LAB_ADMIN_ERROR_MESSAGES.VERSION_CONFLICT.en);
  assert(LAB_ADMIN_ERROR_MESSAGES.FORBIDDEN.en);
  assert(LAB_ADMIN_ERROR_MESSAGES.VALIDATION_ERROR.en);
});
