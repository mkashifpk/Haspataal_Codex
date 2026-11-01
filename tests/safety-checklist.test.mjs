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

test("safety_checklist: getSafetyChecklistScreenView evaluates views and capability fallbacks (Rule 63f7754901)", () => {
  assert.equal(getSafetyChecklistScreenView(null), "full");

  // 1. Explicit server view
  const estExplicit = {
    views: {
      screens: [{ screen_id: "safety_checklist", view: "records" }],
    },
  };
  assert.equal(getSafetyChecklistScreenView(estExplicit), "records");

  // 2. Capability state evaluation
  const estRetiring = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
  };
  assert.equal(getSafetyChecklistScreenView(estRetiring), "open_work");

  const estRetired = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
  };
  assert.equal(getSafetyChecklistScreenView(estRetired), "records");

  const estPreparing = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
  };
  assert.equal(getSafetyChecklistScreenView(estPreparing), "setup");

  const estAvailable = {
    capabilities: [{ capability: "surgery", state: "Available" }],
  };
  assert.equal(getSafetyChecklistScreenView(estAvailable), "hidden");

  // 3. Active array fallback
  const estNoSurgery = {
    active: ["opd", "pharmacy"],
  };
  assert.equal(getSafetyChecklistScreenView(estNoSurgery), "setup");

  const estWithSurgery = {
    active: ["opd", "surgery"],
  };
  assert.equal(getSafetyChecklistScreenView(estWithSurgery), "full");
});

test("safety_checklist: isSurgeryActive checks surgery active status", () => {
  assert.equal(isSurgeryActive(null), false);
  assert.equal(isSurgeryActive(undefined), false);
  assert.equal(isSurgeryActive({ active: ["opd"] }), false);
  assert.equal(isSurgeryActive({ active: ["surgery", "opd"] }), true);
});

test("safety_checklist: canOperateChecklist verifies user permissions", () => {
  assert.equal(canOperateChecklist(null), false);
  assert.equal(canOperateChecklist({ permissions: [] }), false);
  assert.equal(canOperateChecklist({ permissions: ["ot.checklist.manage"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["ot.clinical.record"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["ot.clinical.view"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["doctor.view"] }), true);
  assert.equal(canOperateChecklist({ permissions: ["billing.read"] }), false);
});

test("safety_checklist: determineNextPhase tracks chronological pause progress (Rule cafa8b3761)", () => {
  // Empty checklist -> SignIn
  assert.equal(determineNextPhase(null), "SignIn");
  assert.equal(determineNextPhase({ checklist: [] }), "SignIn");

  // SignIn done -> TimeOut
  const withSignIn = {
    checklist: [{ phase: "SignIn" }],
  };
  assert.equal(determineNextPhase(withSignIn), "TimeOut");

  // TimeOut done -> SignOut
  const withTimeOut = {
    checklist: [{ phase: "SignIn" }, { phase: "TimeOut" }],
  };
  assert.equal(determineNextPhase(withTimeOut), "SignOut");

  // All 3 done -> null
  const allDone = {
    checklist: [{ phase: "SignIn" }, { phase: "TimeOut" }, { phase: "SignOut" }],
  };
  assert.equal(determineNextPhase(allDone), null);
});

test("safety_checklist: checkPhasePrerequisites blocks SignIn if PreOpNote, PAC, or Consents missing (Rule a90b6173b4)", () => {
  // 1. Missing PreOpNote, PAC, and Consents
  const emptyRecord = {
    pre_op_note: null,
    pre_anaesthesia: [],
    consents: [],
    checklist: [],
  };
  const resEmpty = checkPhasePrerequisites("SignIn", emptyRecord);
  assert.equal(resEmpty.allowed, false);
  assert.ok(resEmpty.blockers.some((b) => b.includes("pre-operative note")));
  assert.ok(resEmpty.blockers.some((b) => b.includes("Pre-anaesthesia clinic assessment")));
  assert.ok(resEmpty.blockers.some((b) => b.includes("Operation Consent")));
  assert.ok(resEmpty.blockers.some((b) => b.includes("Anaesthesia Consent")));

  // 2. PAC not fit -> blocked
  const unfitRecord = {
    pre_op_note: { note_id: 1 },
    pre_anaesthesia: [{ decision: "Deferred" }],
    consents: [
      { form_code: "OPERATION", status: "Given" },
      { form_code: "ANAESTHESIA", status: "Given" },
    ],
    checklist: [],
  };
  const resUnfit = checkPhasePrerequisites("SignIn", unfitRecord);
  assert.equal(resUnfit.allowed, false);
  assert.ok(resUnfit.blockers.some((b) => b.includes("not cleared fit")));

  // 3. Fully satisfied prerequisites -> allowed
  const validRecord = {
    pre_op_note: { note_id: 1 },
    pre_anaesthesia: [{ decision: "Fit" }],
    consents: [
      { form_code: "OPERATION", status: "Given" },
      { form_code: "ANAESTHESIA", status: "Given" },
    ],
    checklist: [],
  };
  const resValid = checkPhasePrerequisites("SignIn", validRecord);
  assert.equal(resValid.allowed, true);
  assert.equal(resValid.blockers.length, 0);

  // 4. TimeOut requires SignIn first (Rule cafa8b3761)
  const resTimeOutNoSignIn = checkPhasePrerequisites("TimeOut", validRecord);
  assert.equal(resTimeOutNoSignIn.allowed, false);
  assert.ok(resTimeOutNoSignIn.blockers.some((b) => b.includes("Sign In pause must be recorded")));

  // 5. SignOut requires TimeOut first (Rule 45c2bd9ac6)
  const recordWithSignInOnly = {
    ...validRecord,
    checklist: [{ phase: "SignIn" }],
  };
  const resSignOutNoTimeOut = checkPhasePrerequisites("SignOut", recordWithSignInOnly);
  assert.equal(resSignOutNoTimeOut.allowed, false);
  assert.ok(resSignOutNoTimeOut.blockers.some((b) => b.includes("Time Out pause must be completed")));
});

test("safety_checklist: validateChecklistAnswers verifies Yes on confirmations and notes on note_when (Rule b410c48dc4)", () => {
  const items = [
    {
      item_id: 101,
      phase: "SignIn",
      label: "Patient identity confirmed",
      kind: "Confirm",
      allow_na: false,
      note_when: null,
      is_active: true,
    },
    {
      item_id: 102,
      phase: "SignIn",
      label: "Known allergy",
      kind: "Question",
      allow_na: false,
      note_when: "Yes",
      is_active: true,
    },
  ];

  // 1. Missing answer
  const resMissing = validateChecklistAnswers(items, []);
  assert.equal(resMissing.valid, false);
  assert.ok(resMissing.errors.some((e) => e.includes("not been answered")));

  // 2. Note required when note_when matched but note is empty
  const answersNoNote = [
    { item_id: 101, response: "Yes", note: null },
    { item_id: 102, response: "Yes", note: "" }, // note_when is "Yes", needs note
  ];
  const resNoNote = validateChecklistAnswers(items, answersNoNote);
  assert.equal(resNoNote.valid, false);
  assert.ok(resNoNote.errors.some((e) => e.includes("requires an explanatory clinical note")));

  // 3. Valid answers with note
  const answersValid = [
    { item_id: 101, response: "Yes", note: null },
    { item_id: 102, response: "Yes", note: "Allergic to amoxicillin; flagged on wristband." },
  ];
  const resValid = validateChecklistAnswers(items, answersValid);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});

test("safety_checklist: validateTimeOutTeam mandates Operating Surgeon and Anaesthetist (Rule c4919df195)", () => {
  // Missing anaesthetist
  const teamNoAnaesth = [
    { employee_id: 101, role: "Surgeon", name: "Dr. Tariq" },
    { role: "ScrubNurse", name: "Nurse Fatima" },
  ];
  const resNoAnaesth = validateTimeOutTeam(teamNoAnaesth);
  assert.equal(resNoAnaesth.valid, false);
  assert.ok(resNoAnaesth.errors.some((e) => e.includes("Primary Anaesthetist")));

  // Missing surgeon
  const teamNoSurgeon = [
    { employee_id: 102, role: "Anaesthetist", name: "Dr. Salman" },
    { role: "CirculatingNurse", name: "Nurse Aisha" },
  ];
  const resNoSurgeon = validateTimeOutTeam(teamNoSurgeon);
  assert.equal(resNoSurgeon.valid, false);
  assert.ok(resNoSurgeon.errors.some((e) => e.includes("Primary Operating Surgeon")));

  // Valid team
  const validTeam = [
    { employee_id: 101, role: "Surgeon", name: "Dr. Tariq" },
    { employee_id: 102, role: "Anaesthetist", name: "Dr. Salman" },
    { role: "ScrubNurse", name: "Nurse Fatima" },
  ];
  const resValid = validateTimeOutTeam(validTeam);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});

test("safety_checklist: explainSafetyChecklistError returns clear bilingual messages", () => {
  const preOpErr = explainSafetyChecklistError("OT_PRE_OP_NOTE_REQUIRED");
  assert.ok(preOpErr.en.includes("pre-operative"));
  assert.ok(preOpErr.ur.includes("سرجن"));

  const pacErr = explainSafetyChecklistError("OT_PRE_ANAESTHESIA_REQUIRED");
  assert.ok(pacErr.en.includes("Pre-anaesthesia"));
  assert.ok(pacErr.ur.includes("اینستھیزیا"));

  const finalErr = explainSafetyChecklistError("OT_RECORD_FINAL");
  assert.ok(finalErr.en.includes("final"));
  assert.ok(finalErr.ur.includes("حتمی"));

  const fallback = explainSafetyChecklistError("UNKNOWN_ERROR");
  assert.ok(fallback.en.includes("UNKNOWN_ERROR"));
  assert.ok(fallback.ur.includes("UNKNOWN_ERROR"));
});
