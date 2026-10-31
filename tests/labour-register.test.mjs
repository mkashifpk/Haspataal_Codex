import test from "node:test";
import assert from "node:assert/strict";
import {
  getLabourRegisterScreenView,
  isMaternityActive,
  groupColumnsBySection,
  isColumnRequired,
  validateColumnValue,
  evaluateMissingRequiredColumns,
  validateLabourEntryIn,
  explainLabourRegisterError,
  DELIVERY_SECTIONS,
} from "../src/labour-register-policy.ts";

test("labour_register view modes and service capability gates (rule:119a276f5a, rule:e108ec7978)", () => {
  // Full view
  assert.equal(
    getLabourRegisterScreenView({
      views: { screens: [{ screen_id: "labour_register", view: "full" }] },
    }),
    "full"
  );

  // Retiring open_work view
  assert.equal(
    getLabourRegisterScreenView({
      views: { screens: [{ screen_id: "labour_register", view: "open_work" }] },
    }),
    "open_work"
  );

  // Retired records view
  assert.equal(
    getLabourRegisterScreenView({
      views: { screens: [{ screen_id: "labour_register", view: "records" }] },
    }),
    "records"
  );

  // Default fallback when not configured
  assert.equal(getLabourRegisterScreenView({}), "full");
  assert.equal(getLabourRegisterScreenView(null), "full");

  // Maternity capability check
  assert.equal(isMaternityActive({ active: ["maternity", "pharmacy"] }), true);
  assert.equal(isMaternityActive({ active: ["pharmacy", "opd"] }), false);
  assert.equal(isMaternityActive(null), false);
});

test("labour register dynamic column grouping by section and sort_order (rule:1146a499b0)", () => {
  const mockColumns = [
    {
      field_id: 1,
      code: "col_deliv_2",
      label: "Partograph used",
      section: "Delivery",
      kind: "YesNo",
      choices: [],
      unit: null,
      min_value: null,
      max_value: null,
      required: true,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 120,
      is_active: true,
      row_version: 1,
    },
    {
      field_id: 2,
      code: "col_adm_1",
      label: "Haemoglobin",
      section: "Admission",
      kind: "Number",
      choices: [],
      unit: "g/dl",
      min_value: 3,
      max_value: 20,
      required: false,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 10,
      is_active: true,
      row_version: 1,
    },
    {
      field_id: 3,
      code: "col_baby_1",
      label: "Birth weight",
      section: "Baby",
      kind: "Number",
      choices: [],
      unit: "kg",
      min_value: 0.5,
      max_value: 6,
      required: true,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 320,
      is_active: true,
      row_version: 1,
    },
    {
      field_id: 4,
      code: "col_inactive",
      label: "Legacy field",
      section: "Admission",
      kind: "Text",
      choices: [],
      unit: null,
      min_value: null,
      max_value: null,
      required: false,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 5,
      is_active: false,
      row_version: 1,
    },
  ];

  const grouped = groupColumnsBySection(mockColumns);

  // Inactive column excluded
  assert.equal(grouped.Admission.length, 1);
  assert.equal(grouped.Admission[0].code, "col_adm_1");

  assert.equal(grouped.Delivery.length, 1);
  assert.equal(grouped.Delivery[0].code, "col_deliv_2");

  assert.equal(grouped.Baby.length, 1);
  assert.equal(grouped.Baby[0].code, "col_baby_1");

  assert.equal(grouped.Mother.length, 0);
  assert.equal(grouped.Discharge.length, 0);
});

test("conditional requirement evaluation and field value validation (rule:1146a499b0)", () => {
  const colDirect = {
    field_id: 10,
    code: "cervical_dilatation",
    label: "Cervical dilatation",
    section: "Admission",
    kind: "Number",
    choices: [],
    unit: "cm",
    min_value: 0,
    max_value: 10,
    required: true,
    when_code: null,
    when_value: null,
    source: null,
    sort_order: 50,
    is_active: true,
    row_version: 1,
  };

  const colConditional = {
    field_id: 11,
    code: "hours_since_rupture",
    label: "Hours since rupture",
    section: "Admission",
    kind: "Choice",
    choices: ["< 6 hours", "6-12 hours", "> 12 hours"],
    unit: null,
    min_value: null,
    max_value: null,
    required: false,
    when_code: "membranes_ruptured",
    when_value: "Yes",
    source: null,
    sort_order: 90,
    is_active: true,
    row_version: 1,
  };

  // Direct required
  assert.equal(isColumnRequired(colDirect, {}), true);

  // Conditional: not required when membranes_ruptured is "No" or undefined
  assert.equal(isColumnRequired(colConditional, {}), false);
  assert.equal(isColumnRequired(colConditional, { membranes_ruptured: "No" }), false);

  // Conditional: required when membranes_ruptured is "Yes"
  assert.equal(isColumnRequired(colConditional, { membranes_ruptured: "Yes" }), true);

  // Number validation
  assert.equal(validateColumnValue(colDirect, 5, true), null);
  assert.match(validateColumnValue(colDirect, -1, true), /cannot be less than 0 cm/);
  assert.match(validateColumnValue(colDirect, 12, true), /cannot exceed 10 cm/);
  assert.match(validateColumnValue(colDirect, "", true), /is required/);

  // Choice validation
  assert.equal(validateColumnValue(colConditional, "< 6 hours", true), null);
  assert.match(validateColumnValue(colConditional, "Unknown option", true), /must be one of the declared options/);
});

test("missing required columns evaluation before signing (rule:fe685a82bd)", () => {
  const mockColumns = [
    {
      field_id: 20,
      code: "partograph_used",
      label: "Partograph used",
      section: "Delivery",
      kind: "YesNo",
      choices: [],
      unit: null,
      min_value: null,
      max_value: null,
      required: true,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 100,
      is_active: true,
      row_version: 1,
    },
    {
      field_id: 25,
      code: "baby_condition",
      label: "Condition of the baby",
      section: "Baby",
      kind: "Choice",
      choices: ["Alive, crying", "Alive, not crying", "Stillbirth, macerated", "Stillbirth, fresh"],
      unit: null,
      min_value: null,
      max_value: null,
      required: true,
      when_code: null,
      when_value: null,
      source: null,
      sort_order: 340,
      is_active: true,
      row_version: 1,
    },
  ];

  // Incomplete delivery: both fields missing
  const missing1 = evaluateMissingRequiredColumns(
    mockColumns,
    {},
    [{ baby_no: 1, newborn_patient_id: null, field_values: {} }]
  );
  assert.equal(missing1.length, 2);
  assert.equal(missing1[0].code, "partograph_used");
  assert.equal(missing1[1].code, "baby_condition");
  assert.equal(missing1[1].baby_no, 1);

  // Completed delivery
  const missing2 = evaluateMissingRequiredColumns(
    mockColumns,
    { partograph_used: "Yes" },
    [{ baby_no: 1, newborn_patient_id: 42, field_values: { baby_condition: "Alive, crying" } }]
  );
  assert.equal(missing2.length, 0);
});

test("validate labour entry input and domain error explanations (rule:632b575029, rule:fe685a82bd)", () => {
  // Input validation
  const invalidEntry = {
    admission_id: 0,
    delivered_at: new Date(Date.now() + 86400000).toISOString(), // Future date
    attended_by: 0,
    babies: [],
  };
  const errors = validateLabourEntryIn(invalidEntry);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /Mother's admission context is required/);
  assert.match(errors[1], /Delivery date and time cannot be in the future/);
  assert.match(errors[2], /Attending staff member must be selected/);
  assert.match(errors[3], /At least one baby must be recorded/);

  // Error explanation: LABOUR_ENTRY_INCOMPLETE
  const incompleteErr = {
    response: {
      data: {
        code: "LABOUR_ENTRY_INCOMPLETE",
        details: { missing: ["partograph_used", "baby_condition"] },
      },
    },
  };
  const exp1 = explainLabourRegisterError(incompleteErr, [
    { code: "partograph_used", label: "Partograph used" },
    { code: "baby_condition", label: "Condition of the baby" },
  ]);
  assert.match(exp1.detail, /Partograph used/);
  assert.match(exp1.detail, /Condition of the baby/);
  assert.deepEqual(exp1.missingFields, ["partograph_used", "baby_condition"]);

  // Error explanation: LABOUR_ENTRY_SIGNED
  const signedErr = {
    response: {
      data: {
        code: "LABOUR_ENTRY_SIGNED",
        message: "This entry is signed",
      },
    },
  };
  const exp2 = explainLabourRegisterError(signedErr);
  assert.match(exp2.title, /Entry Frozen & Signed/);
  assert.match(exp2.detail, /permanently frozen/);
});
