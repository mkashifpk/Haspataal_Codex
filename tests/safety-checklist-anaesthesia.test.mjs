import test from "node:test";
import assert from "node:assert/strict";

import {
  getSafetyChecklistScreenView,
  isSurgeryActive,
  canOperateChecklist,
  determineNextPhase,
  checkPhasePrerequisites,
  validateChecklistAnswers,
  validateTimeOutTeam,
  explainSafetyChecklistError,
} from "../src/safety-checklist-policy.ts";

test("safety_checklist_anaesthesia: getSafetyChecklistScreenView evaluates views and capability fallbacks (Rule 02fc9c5710)", () => {
  assert.equal(getSafetyChecklistScreenView(null, "safety_checklist_anaesthesia"), "full");

  // 1. Explicit server view for safety_checklist_anaesthesia
  const estExplicit = {
    views: {
      screens: [{ screen_id: "safety_checklist_anaesthesia", view: "records" }],
    },
  };
  assert.equal(getSafetyChecklistScreenView(estExplicit, "safety_checklist_anaesthesia"), "records");

  // 2. Capability state evaluation for surgery
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getSafetyChecklistScreenView(estRetiring, "safety_checklist_anaesthesia"), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getSafetyChecklistScreenView(estRetired, "safety_checklist_anaesthesia"), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getSafetyChecklistScreenView(estPreparing, "safety_checklist_anaesthesia"), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getSafetyChecklistScreenView(estAvailable, "safety_checklist_anaesthesia"), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getSafetyChecklistScreenView(estNoSurgery, "safety_checklist_anaesthesia"), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getSafetyChecklistScreenView(estWithSurgery, "safety_checklist_anaesthesia"), "full");
});

test("safety_checklist_anaesthesia: canOperateChecklist verifies anaesthetist role and permissions", () => {
  assert.equal(canOperateChecklist(null), false);
  assert.equal(canOperateChecklist({ permissions: [] }), false);
  assert.equal(canOperateChecklist({ roles: ["anaesthetist"], permissions: [] }), true);
  assert.equal(canOperateChecklist({ permissions: ["ot.clinical.anaesthesia"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["ot.checklist.manage"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["ot.checklist.record"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["doctor.view"] }), true);
  assert.equal(canOperateChecklist({ roles: ["accountant"], permissions: ["billing.read"] }), false);
});

test("safety_checklist_anaesthesia: chronological pause sequence (Rule cafa8b3761)", () => {
  assert.equal(determineNextPhase(null), "SignIn");
  assert.equal(determineNextPhase({ checklist: [] }), "SignIn");

  const withSignIn = {
    checklist: [{ phase: "SignIn" }],
  };
  assert.equal(determineNextPhase(withSignIn), "TimeOut");

  const withTimeOut = {
    checklist: [{ phase: "SignIn" }, { phase: "TimeOut" }],
  };
  assert.equal(determineNextPhase(withTimeOut), "SignOut");

  const allDone = {
    checklist: [{ phase: "SignIn" }, { phase: "TimeOut" }, { phase: "SignOut" }],
  };
  assert.equal(determineNextPhase(allDone), null);
});

test("safety_checklist_anaesthesia: prerequisite gate blocks Sign In if PreOpNote, PAC, or Consents missing (Rule a90b6173b4)", () => {
  const incompleteRecord = {
    pre_op_note: null,
    pre_anaesthesia: [],
    consents: [],
    checklist: [],
  };
  const res = checkPhasePrerequisites("SignIn", incompleteRecord);
  assert.equal(res.allowed, false);
  assert.ok(res.blockers.some((b) => b.includes("pre-operative note")));
  assert.ok(res.blockers.some((b) => b.includes("Pre-anaesthesia clinic assessment")));
  assert.ok(res.blockers.some((b) => b.includes("Operation Consent")));
  assert.ok(res.blockers.some((b) => b.includes("Anaesthesia Consent")));

  const completeRecord = {
    pre_op_note: { note_id: 1 },
    pre_anaesthesia: [{ decision: "Fit" }],
    consents: [
      { form_code: "OPERATION", status: "Given" },
      { form_code: "ANAESTHESIA", status: "Given" },
    ],
    checklist: [],
  };
  const resValid = checkPhasePrerequisites("SignIn", completeRecord);
  assert.equal(resValid.allowed, true);
  assert.equal(resValid.blockers.length, 0);
});

test("safety_checklist_anaesthesia: Time Out requires operating surgeon and anaesthetist (Rule c4919df195)", () => {
  const missingSurgeon = [
    { employee_id: 10, role_in_ot: "Anesthetist" },
  ];
  const res1 = validateTimeOutTeam(missingSurgeon);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes("Primary Operating Surgeon")));

  const validTeam = [
    { employee_id: 1, role_in_ot: "PrimarySurgeon" },
    { employee_id: 10, role_in_ot: "Anesthetist" },
  ];
  const res2 = validateTimeOutTeam(validTeam);
  assert.equal(res2.valid, true);
});

test("safety_checklist_anaesthesia: validateChecklistAnswers verifies Yes and notes on note_when (Rule b410c48dc4)", () => {
  const items = [
    {
      item_id: 1,
      phase: "SignIn",
      prompt: "Difficult airway / aspiration risk evaluated",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      is_active: true,
    },
    {
      item_id: 2,
      phase: "SignIn",
      prompt: "Known allergy to anaesthetic agents",
      kind: "Question",
      allow_na: false,
      note_when: "Yes",
      is_active: true,
    },
  ];

  const answersWithoutNote = [
    { item_id: 1, answer: "Yes", note: null },
    { item_id: 2, answer: "Yes", note: "" },
  ];
  const resNoNote = validateChecklistAnswers(items, answersWithoutNote);
  assert.equal(resNoNote.valid, false);
  assert.ok(resNoNote.errors.some((e) => e.includes("requires an explanatory clinical note")));

  const validAnswers = [
    { item_id: 1, answer: "Yes", note: null },
    { item_id: 2, answer: "Yes", note: "Anaphylaxis to suxamethonium; plan rocuronium." },
  ];
  const resValid = validateChecklistAnswers(items, validAnswers);
  assert.equal(resValid.valid, true);
});

test("safety_checklist_anaesthesia: explainSafetyChecklistError bilingual messages", () => {
  const err1 = explainSafetyChecklistError("OT_PRE_ANAESTHESIA_REQUIRED");
  assert.ok(err1.en.includes("Pre-anaesthesia"));
  assert.ok(err1.ur.includes("اینستھیزیا"));

  const err2 = explainSafetyChecklistError("CONSENT_REQUIRED");
  assert.ok(err2.en.includes("consent"));
  assert.ok(err2.ur.includes("رضامندی"));

  const err3 = explainSafetyChecklistError("OT_RECORD_FINAL");
  assert.ok(err3.en.includes("final"));
  assert.ok(err3.ur.includes("حتمی"));
});
