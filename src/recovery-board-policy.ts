/**
 * Recovery Board Domain Policy & Statutory Standard Rules
 *
 * Implements Pakistan MSDS COP 38, 39, 41, 46 and Haspataal PACU recovery requirements:
 * - rule:f995066a59: Longest in recovery first, last observations, and status flags
 * - rule:08ba1ce134: Observation form (pulse, BP, breathing, SpO2, airway, AVPU, pain)
 * - rule:99dea44a26: Discharge form (destination, 5 recovery signs 0-2 against targets.min_score, pain, shifting note, override reason)
 * - rule:1653612103: Recovery / anaesthesia clinical privileges (OT_PRIVILEGE_REQUIRED) and local anaesthesia openRecovery
 * - rule:ba79b41973: Runtime service capability gating (GET /establishment views for recovery_board)
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  RecoveryObservationIn,
  RecoveryDischargeIn,
  RecoveryTargetsOut,
  SurgicalCorrectionIn,
  IncidentIn,
} from "./generated/recovery_board";

export interface ClinicalUser {
  user_id?: number;
  roles?: string[];
  permissions?: string[];
  department_id?: number | null;
  name?: string;
  designation?: string | null;
}

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export const AIRWAY_STATES = ["Patent", "Supported", "Obstructed"] as const;
export type AirwayState = (typeof AIRWAY_STATES)[number];

export const CONSCIOUSNESS_LEVELS = ["Alert", "Voice", "Pain", "Unresponsive"] as const;
export type ConsciousnessLevel = (typeof CONSCIOUSNESS_LEVELS)[number];

export const DISCHARGE_DESTINATIONS = [
  "Ward",
  "ICU",
  "HDU",
  "Home",
  "ReturnedToTheatre",
  "Died",
] as const;
export type DischargeDestination = (typeof DISCHARGE_DESTINATIONS)[number];

/**
 * Evaluates runtime service capability views for recovery_board / recovery_board_admin / recovery_board_anaesthesia
 * under Rule ba79b41973.
 */
export function getRecoveryBoardScreenView(
  establishment: EstablishmentOut | null | undefined,
  screenId: string = "recovery_board",
): ScreenViewMode {
  if (!establishment) return "full";

  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === screenId);
  if (screenEntry?.view) {
    return screenEntry.view as ScreenViewMode;
  }

  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Retired") return "records";
    if (surgeryCap.state === "Retiring") return "open_work";
    if (surgeryCap.state === "Preparing") return "setup";
  }

  return "full";
}

/**
 * Role and permission access controls
 */
export function canViewRecoveryBoard(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return (
    permissions.includes("ot.clinical.view") ||
    permissions.includes("ot.recovery.view") ||
    roles.some((r) =>
      [
        "ot_nurse",
        "head_nurse",
        "anaesthetist",
        "ot_admin",
        "doctor",
        "surgeon",
        "ward_nurse",
        "clinical_specialist",
      ].includes(r),
    )
  );
}

export function canRecordObservation(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return (
    permissions.includes("ot.clinical.record") ||
    permissions.includes("ot.recovery.record") ||
    roles.some((r) => ["ot_nurse", "head_nurse", "anaesthetist"].includes(r))
  );
}

export function canDischargePatient(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return (
    permissions.includes("ot.recovery.discharge") ||
    permissions.includes("ot.clinical.record") ||
    roles.some((r) => ["ot_nurse", "head_nurse", "anaesthetist", "surgeon", "doctor"].includes(r))
  );
}

export function canOpenRecovery(user: ClinicalUser | null | undefined): boolean {
  return user?.permissions?.includes("ot.recovery.record") ?? false;
}

export function canCorrectRecovery(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return (
    permissions.includes("ot.clinical.correct") ||
    permissions.includes("ot.recovery.record") ||
    roles.some((r) => ["ot_nurse", "head_nurse", "anaesthetist", "ot_admin"].includes(r))
  );
}

export function canReportIncident(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return (
    permissions.includes("incident.report") ||
    roles.some((r) =>
      [
        "ot_nurse",
        "head_nurse",
        "anaesthetist",
        "doctor",
        "surgeon",
        "ot_admin",
        "ward_nurse",
      ].includes(r),
    )
  );
}

/**
 * Validates PACU observation input under Rule 08ba1ce134 and MSDS 38
 */
export function validateObservationInput(obs: Partial<RecoveryObservationIn>): string | null {
  if (obs.heart_rate === undefined || obs.heart_rate === null || isNaN(Number(obs.heart_rate))) {
    return "Heart rate is required.";
  }
  const hr = Number(obs.heart_rate);
  if (hr < 20 || hr > 300) {
    return "Heart rate must be between 20 and 300 bpm.";
  }

  if (obs.bp_systolic === undefined || obs.bp_systolic === null || isNaN(Number(obs.bp_systolic))) {
    return "Systolic blood pressure is required.";
  }
  const sys = Number(obs.bp_systolic);
  if (sys < 40 || sys > 300) {
    return "Systolic blood pressure must be between 40 and 300 mmHg.";
  }

  if (obs.bp_diastolic === undefined || obs.bp_diastolic === null || isNaN(Number(obs.bp_diastolic))) {
    return "Diastolic blood pressure is required.";
  }
  const dia = Number(obs.bp_diastolic);
  if (dia < 20 || dia > 200) {
    return "Diastolic blood pressure must be between 20 and 200 mmHg.";
  }
  if (dia >= sys) {
    return "Diastolic blood pressure must be lower than systolic blood pressure.";
  }

  if (obs.respiratory_rate === undefined || obs.respiratory_rate === null || isNaN(Number(obs.respiratory_rate))) {
    return "Respiratory rate is required.";
  }
  const rr = Number(obs.respiratory_rate);
  if (rr < 4 || rr > 80) {
    return "Respiratory rate must be between 4 and 80 breaths/min.";
  }

  if (obs.spo2 === undefined || obs.spo2 === null || isNaN(Number(obs.spo2))) {
    return "Oxygen saturation (SpO2) is required.";
  }
  const spo2 = Number(obs.spo2);
  if (spo2 < 40 || spo2 > 100) {
    return "Oxygen saturation must be between 40% and 100%.";
  }

  if (!obs.airway || !AIRWAY_STATES.includes(obs.airway as AirwayState)) {
    return "Airway patency assessment is required (Patent, Supported, or Obstructed).";
  }

  if (!obs.consciousness || !CONSCIOUSNESS_LEVELS.includes(obs.consciousness as ConsciousnessLevel)) {
    return "Level of consciousness (AVPU) is required.";
  }

  if (obs.pain_score === undefined || obs.pain_score === null || isNaN(Number(obs.pain_score))) {
    return "Pain score (0-10) is required.";
  }
  const pain = Number(obs.pain_score);
  if (pain < 0 || pain > 10) {
    return "Pain score must be between 0 (none) and 10 (worst pain).";
  }

  return null;
}

/**
 * Calculates modified Aldrete recovery score (0 to 10)
 */
export function calculateAldreteScore(
  activity: number = 0,
  respiration: number = 0,
  circulation: number = 0,
  consciousness: number = 0,
  spo2: number = 0,
): number {
  return (
    Math.max(0, Math.min(2, activity)) +
    Math.max(0, Math.min(2, respiration)) +
    Math.max(0, Math.min(2, circulation)) +
    Math.max(0, Math.min(2, consciousness)) +
    Math.max(0, Math.min(2, spo2))
  );
}

/**
 * Validates PACU discharge input under Rule 99dea44a26
 */
export function validateDischargeInput(
  discharge: Partial<RecoveryDischargeIn>,
  targets?: RecoveryTargetsOut | null,
): string | null {
  if (!discharge.destination || !DISCHARGE_DESTINATIONS.includes(discharge.destination as DischargeDestination)) {
    return "Valid discharge destination is required (Ward, ICU, HDU, Home, ReturnedToTheatre, or Died).";
  }

  if (discharge.destination === "Died") {
    // When patient died in recovery, death certificate / death record must precede PACU discharge
    return null;
  }

  const scoreTotal = calculateAldreteScore(
    discharge.score_activity ?? 0,
    discharge.score_respiration ?? 0,
    discharge.score_circulation ?? 0,
    discharge.score_consciousness ?? 0,
    discharge.score_spo2 ?? 0,
  );

  const minScore = targets?.min_score ?? 9;
  const maxPain = targets?.max_pain ?? 3;

  // Below criteria to Ward or Home requires mandatory clinical override reason (OT_RECOVERY_CRITERIA_NOT_MET)
  if (["Ward", "Home"].includes(discharge.destination)) {
    if (scoreTotal < minScore && (!discharge.override_reason || discharge.override_reason.trim().length < 5)) {
      return `Total Aldrete score (${scoreTotal}) is below target threshold (${minScore}). A clinical override reason explaining premature discharge is required.`;
    }

    if (
      discharge.pain_score !== undefined &&
      discharge.pain_score !== null &&
      Number(discharge.pain_score) > maxPain &&
      (!discharge.override_reason || discharge.override_reason.trim().length < 5)
    ) {
      return `Pain score (${discharge.pain_score}) exceeds maximum threshold (${maxPain}). A clinical override reason is required.`;
    }
  }

  if (!discharge.shifting_note || discharge.shifting_note.trim().length < 5) {
    return "Shifting handover note is required (MSDS 39 handover details).";
  }

  return null;
}

/**
 * Validates retrospective correction addendum under Rule 9e9cb593cb
 */
export function validateCorrectionInput(corr: Partial<SurgicalCorrectionIn>): string | null {
  if (!corr.record) {
    return "Target record part is required.";
  }
  if (!corr.correction_text || corr.correction_text.trim().length < 3) {
    return "Correction text is required (minimum 3 characters).";
  }
  if (!corr.correction_reason || corr.correction_reason.trim().length < 3) {
    return "Audit reason justifying correction is required (minimum 3 characters).";
  }
  return null;
}

/**
 * Validates in-theatre incident input under Rule fe0c435dc9
 */
export function validateIncidentInput(inc: Partial<IncidentIn>): string | null {
  if (!inc.type_code) {
    return "Incident classification is required.";
  }
  if (!inc.description || inc.description.trim().length < 5) {
    return "Incident clinical description summary is required (minimum 5 characters).";
  }
  return null;
}

/**
 * Explains recovery board error codes in English and Urdu
 */
export function explainRecoveryBoardError(
  code: string | undefined,
  details?: any,
): { en: string; ur: string } {
  switch (code) {
    case "OT_RECOVERY_CRITERIA_NOT_MET":
      return {
        en: `Patient has not met the recovery discharge criteria (Aldrete score below threshold or pain too high). Please document an explicit clinical override reason or continue recovery monitoring.`,
        ur: `مریض ریکوری ڈسچارج کے معیارات پر پورا نہیں اترا (اسکور کم ہے یا درد زیادہ ہے)۔ براہ کرم کلینیکل استثنا کی وجہ درج کریں یا نگرانی جاری رکھیں۔`,
      };
    case "OT_OPERATIVE_NOTE_REQUIRED":
      return {
        en: "The primary surgeon must sign the operative note and establish post-operative orders before the patient can be discharged from PACU recovery.",
        ur: "پی اے سی یو ریکوری سے ڈسچارج کے لیے سرجن کا آپریٹو نوٹ پر دستخط کرنا اور آپریشن کے بعد کی ہدایات درج کرنا لازمی ہے۔",
      };
    case "OT_RECORD_INCOMPLETE":
      return {
        en: details?.missing?.length
          ? `Surgical/anaesthetic record is incomplete. Missing items: ${details.missing.join(", ")}.`
          : "Required intra-operative documentation must be completed before PACU discharge.",
        ur: details?.missing?.length
          ? `سرجیکل یا اینستھیزیا ریکارڈ نامکمل ہے۔ ضروری امور: ${details.missing.join("، ")}۔`
          : "ریکوری ڈسچارج سے قبل آپریشن کی تمام ضروری دستاویزات مکمل ہونا لازمی ہیں۔",
      };
    case "OT_RECORD_FINAL":
      return {
        en: "The record has been signed and is legally final. Modifications must be submitted as an addendum via 'Add a correction'.",
        ur: "ریکارڈ پر دستخط ہو چکے ہیں اور یہ حتمی ہے۔ مزید تفصیلات 'تصحیح شامل کریں' کے ذریعے شامل کی جا سکتی ہیں۔",
      };
    case "OT_PRIVILEGE_REQUIRED":
      return {
        en: "You do not hold active clinical privileges for post-anaesthesia recovery discharge. Please ask the credentialed anaesthetist or PACU lead to execute discharge.",
        ur: "آپ کے پاس پی اے سی یو ریکوری ڈسچارج کے فعال کلینیکل اختیارات نہیں ہیں۔ براہ کرم نامزد اینستھیٹسٹ سے ڈسچارج کروائیں۔",
      };
    case "OT_BOOKING_STATE_INVALID":
      return {
        en: "The surgical booking state does not permit this operation. Verify the patient has concluded surgery.",
        ur: "سرجیکل بکنگ کی موجودہ حالت اس عمل کی اجازت نہیں دیتی۔ تصدیق کریں کہ آپریشن مکمل ہو چکا ہے۔",
      };
    case "OT_RECOVERY_ALREADY_OPEN":
      return {
        en: "A recovery stay is already open for this surgical case.",
        ur: "اس سرجیکل کیس کے لیے پہلے سے ریکوری قیام موجود ہے۔",
      };
    case "DEATH_RECORD_REQUIRED":
      return {
        en: "When a patient passes away in recovery, the clinical death record must be initiated before executing discharge.",
        ur: "ریکوری میں مریض کے انتقال کی صورت میں ڈسچارج سے قبل موت کا طبی ریکارڈ درج ہونا لازمی ہے۔",
      };
    case "VALIDATION_ERROR":
      return {
        en: details?.message || "The submitted recovery data is invalid. Please review input fields.",
        ur: details?.message || "درج شدہ ریکوری ڈیٹا درست نہیں ہے۔ براہ کرم تمام خانے چیک کریں۔",
      };
    default:
      return {
        en: details?.message || code || "An error occurred in PACU recovery management.",
        ur: details?.message || code || "پی اے سی یو ریکوری بورڈ کے عمل کے دوران ایک خرابی پیش آئی۔",
      };
  }
}
