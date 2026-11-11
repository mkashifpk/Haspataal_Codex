import test from "node:test";
import assert from "node:assert/strict";
import {
  getRecoveryBoardScreenView,
  canViewRecoveryBoard,
  canRecordObservation,
  canDischargePatient,
  canOpenRecovery,
  canCorrectRecovery,
  canReportIncident,
  validateObservationInput,
  calculateAldreteScore,
  validateDischargeInput,
  validateCorrectionInput,
  validateIncidentInput,
  explainRecoveryBoardError,
} from "../src/recovery-board-policy.ts";

test("recovery_board_anaesthesia: getRecoveryBoardScreenView evaluates runtime service capability views (Rule b919e98af8)", () => {
  const activeEst = {
    capabilities: [{ capability: "surgery", state: "Active" }],
    views: { screens: [{ screen_id: "recovery_board_anaesthesia", view: "full" }] },
  };
  assert.equal(getRecoveryBoardScreenView(activeEst, "recovery_board_anaesthesia"), "full");

  const retiringEst = {
    capabilities: [{ capability: "surgery", state: "Retiring" }],
    views: { screens: [{ screen_id: "recovery_board_anaesthesia", view: "open_work" }] },
  };
  assert.equal(getRecoveryBoardScreenView(retiringEst, "recovery_board_anaesthesia"), "open_work");

  const retiredEst = {
    capabilities: [{ capability: "surgery", state: "Retired" }],
    views: { screens: [{ screen_id: "recovery_board_anaesthesia", view: "records" }] },
  };
  assert.equal(getRecoveryBoardScreenView(retiredEst, "recovery_board_anaesthesia"), "records");

  const prepEst = {
    capabilities: [{ capability: "surgery", state: "Preparing" }],
    views: { screens: [{ screen_id: "recovery_board_anaesthesia", view: "setup" }] },
  };
  assert.equal(getRecoveryBoardScreenView(prepEst, "recovery_board_anaesthesia"), "setup");
});

test("recovery_board_anaesthesia: role and permission gates for anaesthetist staff", () => {
  const anaesthetist = {
    user_id: 20,
    roles: ["anaesthetist"],
    permissions: ["ot.clinical.view", "ot.clinical.record", "ot.recovery.discharge", "ot.recovery.open", "ot.clinical.correct", "incident.report"],
  };
  assert.equal(canViewRecoveryBoard(anaesthetist), true);
  assert.equal(canRecordObservation(anaesthetist), true);
  assert.equal(canDischargePatient(anaesthetist), true);
  assert.equal(canOpenRecovery(anaesthetist), false);
  assert.equal(canCorrectRecovery(anaesthetist), true);
  assert.equal(canReportIncident(anaesthetist), true);

  const surgeon = {
    user_id: 21,
    roles: ["surgeon", "doctor"],
    permissions: ["ot.clinical.view", "ot.clinical.record"],
  };
  assert.equal(canViewRecoveryBoard(surgeon), true);
  assert.equal(canDischargePatient(surgeon), true);

  const unauthorized = { user_id: 22, roles: ["receptionist"], permissions: [] };
  assert.equal(canViewRecoveryBoard(unauthorized), false);
  assert.equal(canRecordObservation(unauthorized), false);
  assert.equal(canDischargePatient(unauthorized), false);
});

test("recovery_board_anaesthesia: validateObservationInput validates physiological vitals and airway bounds (Rule 08ba1ce134)", () => {
  const validObs = {
    heart_rate: 72,
    bp_systolic: 118,
    bp_diastolic: 76,
    respiratory_rate: 15,
    spo2: 99,
    airway: "Patent",
    consciousness: "Alert",
    pain_score: 2,
  };
  assert.equal(validateObservationInput(validObs), null);

  // Missing heart rate
  assert.equal(validateObservationInput({ ...validObs, heart_rate: null }), "Heart rate is required.");

  // Physiological bounds
  assert.equal(validateObservationInput({ ...validObs, heart_rate: 15 }), "Heart rate must be between 20 and 300 bpm.");
  assert.equal(validateObservationInput({ ...validObs, bp_systolic: 320 }), "Systolic blood pressure must be between 40 and 300 mmHg.");
  assert.equal(validateObservationInput({ ...validObs, bp_diastolic: 130, bp_systolic: 120 }), "Diastolic blood pressure must be lower than systolic blood pressure.");
  assert.equal(validateObservationInput({ ...validObs, spo2: 30 }), "Oxygen saturation must be between 40% and 100%.");
  assert.equal(validateObservationInput({ ...validObs, airway: "Invalid" }), "Airway patency assessment is required (Patent, Supported, or Obstructed).");
  assert.equal(validateObservationInput({ ...validObs, consciousness: "Sleepy" }), "Level of consciousness (AVPU) is required.");
  assert.equal(validateObservationInput({ ...validObs, pain_score: 12 }), "Pain score must be between 0 (none) and 10 (worst pain).");
});

test("recovery_board_anaesthesia: calculateAldreteScore computes total modified Aldrete score (0 to 10)", () => {
  assert.equal(calculateAldreteScore(2, 2, 2, 2, 2), 10);
  assert.equal(calculateAldreteScore(1, 2, 1, 1, 2), 7);
  assert.equal(calculateAldreteScore(0, 0, 0, 0, 0), 0);
  // Clamped bounds
  assert.equal(calculateAldreteScore(3, -1, 2, 2, 2), 8);
});

test("recovery_board_anaesthesia: validateDischargeInput enforces criteria and override reasons (Rule 99dea44a26)", () => {
  const targets = { min_score: 9, max_pain: 3, observation_minutes: 15, max_stay_minutes: 120 };

  // Full score passes to Ward
  const normalDischarge = {
    destination: "Ward",
    score_activity: 2,
    score_respiration: 2,
    score_circulation: 2,
    score_consciousness: 2,
    score_spo2: 2,
    pain_score: 1,
    shifting_note: "Patient fully awake, airway patent, stable haemodynamics. Handover given to Ward nurse.",
  };
  assert.equal(validateDischargeInput(normalDischarge, targets), null);

  // Missing destination
  assert.equal(validateDischargeInput({ ...normalDischarge, destination: "" }, targets), "Valid discharge destination is required (Ward, ICU, HDU, Home, ReturnedToTheatre, or Died).");

  // Premature score requires override reason
  const lowScoreDischarge = {
    ...normalDischarge,
    score_activity: 0, // total = 8 < 9
    override_reason: "",
  };
  assert.match(
    validateDischargeInput(lowScoreDischarge, targets),
    /Total Aldrete score \(8\) is below target threshold \(9\)\. A clinical override reason explaining premature discharge is required\./,
  );

  // With valid override reason
  assert.equal(
    validateDischargeInput({ ...lowScoreDischarge, override_reason: "Direct transfer to HDU under step-down monitoring." }, targets),
    null,
  );

  // High pain requires override reason
  const highPainDischarge = {
    ...normalDischarge,
    pain_score: 6,
    override_reason: "",
  };
  assert.match(
    validateDischargeInput(highPainDischarge, targets),
    /Pain score \(6\) exceeds maximum threshold \(3\)\. A clinical override reason is required\./,
  );

  // Missing shifting note
  assert.equal(
    validateDischargeInput({ ...normalDischarge, shifting_note: "" }, targets),
    "Shifting handover note is required (MSDS 39 handover details).",
  );
});

test("recovery_board_anaesthesia: validateCorrectionInput and validateIncidentInput enforce statutory audits (Rule 9e9cb593cb, Rule fe0c435dc9)", () => {
  assert.equal(validateCorrectionInput({ record: "Recovery", correction_text: "Awake at 15:30", correction_reason: "Factual timing addition" }), null);
  assert.equal(validateCorrectionInput({ record: "Recovery", correction_text: "", correction_reason: "Reason" }), "Correction text is required (minimum 3 characters).");

  assert.equal(validateIncidentInput({ type_code: "PACU_HYPOTENSION", description: "Transient hypotension responded to 250ml crystalloid bolus" }), null);
  assert.equal(validateIncidentInput({ type_code: "", description: "Summary" }), "Incident classification is required.");
});

test("recovery_board_anaesthesia: explainRecoveryBoardError provides clear English and Urdu guidance", () => {
  const critErr = explainRecoveryBoardError("OT_RECOVERY_CRITERIA_NOT_MET");
  assert.match(critErr.en, /Patient has not met the recovery discharge criteria/);
  assert(/[\u0600-\u06ff]/.test(critErr.ur));

  const opNoteErr = explainRecoveryBoardError("OT_OPERATIVE_NOTE_REQUIRED");
  assert.match(opNoteErr.en, /primary surgeon must sign the operative note/);
  assert(/[\u0600-\u06ff]/.test(opNoteErr.ur));

  const privErr = explainRecoveryBoardError("OT_PRIVILEGE_REQUIRED");
  assert.match(privErr.en, /active clinical privileges/);
  assert(/[\u0600-\u06ff]/.test(privErr.ur));
});
