import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  evaluateChecklistSetupView,
  canConfigureChecklist,
  canViewChecklist,
  canViewTheatrePolicy,
  sortChecklistItems,
  validateChecklistItemIn,
  validateChecklistItemUpdate,
  explainChecklistSetupError,
  PHASE_CONFIG,
} from "../src/theatre-checklist-policy.ts";

test("evaluateChecklistSetupView evaluates runtime surgery service capability gates (rule:9c5c94d2a1)", () => {
  // 1. full view: normal active service
  const fullEst = {
    views: {
      screens: [{ screen_id: "theatre_checklist_setup", view: "full" }],
    },
  };
  const fullResult = evaluateChecklistSetupView(fullEst);
  assert.equal(fullResult.view, "full");
  assert.equal(fullResult.canConfigure, true);
  assert.equal(fullResult.isReadOnly, false);
  assert.equal(fullResult.banner, undefined);

  // 2. open_work view: retiring service
  const openEst = {
    views: {
      screens: [{ screen_id: "theatre_checklist_setup", view: "open_work" }],
    },
  };
  const openResult = evaluateChecklistSetupView(openEst);
  assert.equal(openResult.view, "open_work");
  assert.equal(openResult.canConfigure, false);
  assert.equal(openResult.isReadOnly, false);
  assert.match(openResult.banner || "", /No new checklist items/);

  // 3. records view: retired service
  const recEst = {
    views: {
      screens: [{ screen_id: "theatre_checklist_setup", view: "records" }],
    },
  };
  const recResult = evaluateChecklistSetupView(recEst);
  assert.equal(recResult.view, "records");
  assert.equal(recResult.canConfigure, false);
  assert.equal(recResult.isReadOnly, true);
  assert.match(recResult.banner || "", /Records view/);

  // 4. setup view: service preparation before activation
  const setupEst = {
    views: {
      screens: [{ screen_id: "theatre_checklist_setup", view: "setup" }],
    },
  };
  const setupResult = evaluateChecklistSetupView(setupEst);
  assert.equal(setupResult.view, "setup");
  assert.equal(setupResult.canConfigure, true);
  assert.equal(setupResult.isReadOnly, false);
  assert.match(setupResult.banner || "", /Setup mode/);

  // 5. hidden view: service inactive / unconfigured
  const hiddenEst = {
    views: {
      screens: [{ screen_id: "theatre_checklist_setup", view: "hidden" }],
    },
  };
  const hiddenResult = evaluateChecklistSetupView(hiddenEst);
  assert.equal(hiddenResult.view, "hidden");
  assert.equal(hiddenResult.canConfigure, false);
  assert.equal(hiddenResult.isReadOnly, true);
});

test("role permissions gating restricts checklist configuration and policy viewing", () => {
  const configUser = {
    permissions: ["ot.checklist.configure", "ot.clinical.view"],
  };
  assert.equal(canConfigureChecklist(configUser), true);
  assert.equal(canViewChecklist(configUser), true);
  assert.equal(canViewTheatrePolicy(configUser), true);

  const clinicalUser = {
    permissions: ["ot.checklist.record", "ot.clinical.view"],
  };
  assert.equal(canConfigureChecklist(clinicalUser), false);
  assert.equal(canViewChecklist(clinicalUser), true);
  assert.equal(canViewTheatrePolicy(clinicalUser), true);

  const privilegeManager = {
    permissions: ["ot.privilege.manage"],
  };
  assert.equal(canConfigureChecklist(privilegeManager), false);
  assert.equal(canViewChecklist(privilegeManager), false);
  assert.equal(canViewTheatrePolicy(privilegeManager), true);

  const unauthorized = {
    permissions: ["reception.view"],
  };
  assert.equal(canConfigureChecklist(unauthorized), false);
  assert.equal(canViewChecklist(unauthorized), false);
  assert.equal(canViewTheatrePolicy(unauthorized), false);
  assert.equal(canConfigureChecklist(null), false);
});

test("sortChecklistItems sorts items chronologically across WHO phases (rule:dfc29fbd11)", () => {
  const sampleItems = [
    {
      item_id: 20,
      phase: "SignOut",
      prompt: "Operation name read out",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      reference: "MSDS 46",
      sort_order: 10,
      is_active: true,
      row_version: 1,
    },
    {
      item_id: 1,
      phase: "SignIn",
      prompt: "Patient identity confirmed",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      reference: "MSDS 44",
      sort_order: 20,
      is_active: true,
      row_version: 1,
    },
    {
      item_id: 11,
      phase: "TimeOut",
      prompt: "Team introductions",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      reference: "MSDS 44 ii",
      sort_order: 10,
      is_active: true,
      row_version: 1,
    },
    {
      item_id: 2,
      phase: "SignIn",
      prompt: "Consent forms signed",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      reference: "MSDS 35",
      sort_order: 10,
      is_active: true,
      row_version: 1,
    },
  ];

  const sorted = sortChecklistItems(sampleItems);
  assert.equal(sorted[0].item_id, 2); // SignIn sort_order 10
  assert.equal(sorted[1].item_id, 1); // SignIn sort_order 20
  assert.equal(sorted[2].item_id, 11); // TimeOut sort_order 10
  assert.equal(sorted[3].item_id, 20); // SignOut sort_order 10

  assert.ok(PHASE_CONFIG.SignIn);
  assert.ok(PHASE_CONFIG.TimeOut);
  assert.ok(PHASE_CONFIG.SignOut);
});

test("validateChecklistItemIn and validateChecklistItemUpdate enforce valid inputs and retirement rules", () => {
  // Empty input
  const empty = validateChecklistItemIn({});
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.phase);
  assert.ok(empty.errors.prompt);

  // Valid input
  const valid = validateChecklistItemIn({
    phase: "TimeOut",
    prompt: "Confirm availability of crossmatched blood in theatre",
    kind: "Confirm",
    allow_na: true,
    note_when: null,
    reference: "MSDS 44",
    sort_order: 45,
  });
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);

  // Update retiring item (is_active: false) under rule:dfc29fbd11
  const updateRetire = validateChecklistItemUpdate({
    is_active: false,
    expected_version: 1,
  });
  assert.equal(updateRetire.valid, true);

  const invalidPrompt = validateChecklistItemUpdate({
    prompt: "ab",
  });
  assert.equal(invalidPrompt.valid, false);
  assert.ok(invalidPrompt.errors.prompt);
});

test("explainChecklistSetupError translates error codes into actionable bilingual guidance", () => {
  const exists = explainChecklistSetupError(new Error("409 CHECKLIST_ITEM_EXISTS"));
  assert.equal(exists.code, "CHECKLIST_ITEM_EXISTS");
  assert.match(exists.message, /already exists/);
  assert.match(exists.messageUr, /پہلے سے موجود ہے/);

  const inUse = explainChecklistSetupError(new Error("400 CHECKLIST_ITEM_IN_USE"));
  assert.equal(inUse.code, "CHECKLIST_ITEM_IN_USE");
  assert.match(inUse.message, /retire it instead/);
  assert.match(inUse.messageUr, /ریٹائر کریں/);

  const conflict = explainChecklistSetupError(new Error("409 VERSION_CONFLICT"));
  assert.equal(conflict.code, "VERSION_CONFLICT");
  assert.match(conflict.message, /modified by another/);

  const forbidden = explainChecklistSetupError(new Error("403 FORBIDDEN"));
  assert.equal(forbidden.code, "FORBIDDEN");
  assert.match(forbidden.message, /permission to configure/);
});

test("theatre checklist setup contract bundle defines all 5 endpoints, rules, and delivery gate", () => {
  const bundle = JSON.parse(fs.readFileSync("contracts/theatre_checklist_setup.json", "utf8"));
  assert.equal(bundle.screen_id, "theatre_checklist_setup");
  assert.equal(bundle.endpoints.length, 5);
  assert.ok(bundle.delivery_gate);
  assert.equal(bundle.definition_of_done.points, 52);

  const epNames = bundle.endpoints.map((e) => e.endpoint);
  assert.ok(epNames.includes("GET /ot/checklist-items"));
  assert.ok(epNames.includes("POST /ot/checklist-items"));
  assert.ok(epNames.includes("PATCH /ot/checklist-items/{item_id}"));
  assert.ok(epNames.includes("GET /ot/theatre-policy/pdf"));
  assert.ok(epNames.includes("GET /ot/privileges"));
});
