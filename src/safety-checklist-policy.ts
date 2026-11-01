import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ChecklistItemOut,
  ChecklistAnswerIn,
  SafetyCheckIn,
  SurgicalRecordOut,
  ClinicalPrivilegeOut,
  TeamMemberIn,
} from "./generated/safety_checklist";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number | null;
  employee_id?: number | null;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for safety_checklist (Rule 63f7754901)
 * or safety_checklist_admin (Rule 3028300996).
 * Uses GET /establishment views.screens[screen_id]. Never decides from facility category.
 */
export function getSafetyChecklistScreenView(
  establishment?: EstablishmentOut | null,
  screenId: string = "safety_checklist"
): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === screenId);
  if (screenEntry?.view) {
    return screenEntry.view;
  }

  // 2. Check surgery capability state
  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Active") return "full";
    if (surgeryCap.state === "Retiring") return "open_work";
    if (surgeryCap.state === "Retired") return "records";
    if (surgeryCap.state === "Preparing") return "setup";
    if (surgeryCap.state === "Available") return "hidden";
  }

  // 3. Check active capabilities
  if (establishment.active && !establishment.active.includes("surgery")) {
    return "setup";
  }

  return "full";
}

/**
 * Returns true if surgery service is active in establishment.
 */
export function isSurgeryActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("surgery");
}

/**
 * Role permissions for surgical safety checklist execution.
 */
export function canOperateChecklist(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("ot.checklist.manage") ||
    user.permissions.includes("ot.checklist.record") ||
    user.permissions.includes("ot.clinical.record") ||
    user.permissions.includes("ot.clinical.view") ||
    user.permissions.includes("doctor.view") ||
    (Array.isArray(user.roles) && user.roles.includes("ot_admin"))
  );
}

/**
 * Determines the next required pause in order: SignIn -> TimeOut -> SignOut (Rule cafa8b3761).
 */
export function determineNextPhase(record?: SurgicalRecordOut | null): "SignIn" | "TimeOut" | "SignOut" | null {
  if (!record || !record.checklist) return "SignIn";
  const pauses = record.checklist.map((p) => p.phase);
  if (!pauses.includes("SignIn")) return "SignIn";
  if (!pauses.includes("TimeOut")) return "TimeOut";
  if (!pauses.includes("SignOut")) return "SignOut";
  return null; // All 3 complete
}

/**
 * Validates prerequisites before launching a specific checklist phase (Rule a90b6173b4, c4919df195, 45c2bd9ac6).
 */
export function checkPhasePrerequisites(
  phase: "SignIn" | "TimeOut" | "SignOut",
  record?: SurgicalRecordOut | null
): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!record) {
    return { allowed: false, blockers: ["Surgical record is not loaded."] };
  }

  const existingPhases = (record.checklist || []).map((p) => p.phase);

  if (phase === "SignIn") {
    // 1. Pre-op note required (Rule a90b6173b4)
    if (!record.pre_op_note) {
      blockers.push("Surgeon's pre-operative note (PreOpNote) is missing (OT_PRE_OP_NOTE_REQUIRED).");
    }

    // 2. Pre-anaesthesia assessment finding fit required
    const assessments = record.pre_anaesthesia || [];
    const latestPac = assessments.length > 0 ? assessments[assessments.length - 1] : null;
    if (!latestPac) {
      blockers.push("Pre-anaesthesia clinic assessment (PAC) is missing (OT_PRE_ANAESTHESIA_REQUIRED).");
    } else if (latestPac.decision !== "Fit" && latestPac.decision !== "FitWithConditions") {
      blockers.push(`Pre-anaesthesia assessment decision is "${latestPac.decision}". Patient is not cleared fit for surgery.`);
    }

    // 3. Operation consent and anaesthesia consent required
    const consents = record.consents || [];
    const hasOpConsent = consents.some(
      (c) => (c.category === "Procedure" || c.form_code === "OPERATION") && c.status === "Given"
    );
    const hasAnaesthConsent = consents.some(
      (c) => (c.category === "Anaesthesia" || c.form_code === "ANAESTHESIA") && c.status === "Given"
    );

    if (!hasOpConsent) {
      blockers.push("Informed Operation Consent is not recorded as Given (CONSENT_REQUIRED).");
    }
    if (!hasAnaesthConsent) {
      blockers.push("Informed Anaesthesia Consent is not recorded as Given (CONSENT_REQUIRED).");
    }
  } else if (phase === "TimeOut") {
    // Time out strictly requires Sign In to be completed first (Rule cafa8b3761)
    if (!existingPhases.includes("SignIn")) {
      blockers.push("Sign In pause must be recorded before Time Out can proceed (Rule cafa8b3761).");
    }
  } else if (phase === "SignOut") {
    // Sign out strictly requires Time Out to be completed first (Rule 45c2bd9ac6)
    if (!existingPhases.includes("TimeOut")) {
      blockers.push("Time Out pause must be completed before Sign Out (Rule 45c2bd9ac6).");
    }
  }

  return { allowed: blockers.length === 0, blockers };
}

/**
 * Validates checklist answers before submission (Rule b410c48dc4).
 * Confirm must be Yes or NotApplicable; Question must be Yes or No.
 * note_when requires note if response matches.
 */
export function validateChecklistAnswers(
  items: ChecklistItemOut[] | any[],
  answers: ChecklistAnswerIn[] | any[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const item of items) {
    if (!item.is_active) continue;
    const ans = answers.find((a: any) => a.item_id === item.item_id);
    const itemText = item.prompt || item.label || `Item #${item.item_id}`;
    if (!ans) {
      errors.push(`Checklist item "${itemText}" has not been answered.`);
      continue;
    }

    const answerVal = ans.answer ?? ans.response;
    if (item.kind === "Confirm") {
      if (answerVal !== "Yes" && answerVal !== "NotApplicable") {
        errors.push(`Confirmation item "${itemText}" must be verified Yes (or N/A if allowed).`);
      }
    }

    if (item.note_when && answerVal === item.note_when) {
      if (!ans.note || ans.note.trim().length === 0) {
        errors.push(`Item "${itemText}" answered "${answerVal}" requires an explanatory clinical note.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates team attendance for TimeOut (Rule c4919df195).
 * Primary surgeon and anaesthetist are mandatory.
 */
export function validateTimeOutTeam(team: TeamMemberIn[] | any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const roles = team.map((t: any) => t.role_in_ot || t.role);

  if (!roles.includes("PrimarySurgeon") && !roles.includes("Surgeon")) {
    errors.push("Primary Operating Surgeon is required in theatre team attendance for Time Out (Rule c4919df195).");
  }
  if (!roles.includes("Anesthetist") && !roles.includes("Anaesthetist")) {
    errors.push("Primary Anaesthetist is required in theatre team attendance for Time Out (Rule c4919df195).");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Bilingual explanations for Surgical Safety Checklist errors.
 */
export function explainSafetyChecklistError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    OT_PRE_OP_NOTE_REQUIRED: {
      en: "Sign In blocked: Surgeon's pre-operative clinical note is missing. Surgeon must record pre-op note before induction.",
      ur: "سائن ان بلاک: سرجن کا آپریشن سے قبل کا تفصیلی نوٹ موجود نہیں ہے۔ سرجن کو پہلے نوٹ لکھنا لازمی ہے۔",
    },
    OT_PRE_ANAESTHESIA_REQUIRED: {
      en: "Sign In blocked: Pre-anaesthesia clinic assessment finding patient fit is required before induction.",
      ur: "سائن ان بلاک: اینستھیزیا فٹنس کا باضابطہ سرٹیفکیٹ موجود نہیں ہے۔ اینستھیٹسٹ کی کلیئرنس درکار ہے۔",
    },
    CONSENT_REQUIRED: {
      en: "Sign In blocked: Informed surgical and anaesthesia consents must be signed and given before surgery.",
      ur: "سائن ان بلاک: آپریشن اور اینستھیزیا کے باضابطہ رضامندی فارم پر دستخط ہونا لازمی ہیں۔",
    },
    OT_CHECKLIST_ANSWERS_INVALID: {
      en: details?.items
        ? `Checklist verification failed for: ${details.items.join(", ")}. Confirmations must be true before proceeding.`
        : "Checklist answers are invalid. All safety checks must be positively confirmed before proceeding.",
      ur: "حفاظتی چیک لسٹ نامکمل ہے۔ تمام حفاظتی اقدامات کی باضابطہ تصدیق لازمی ہے۔",
    },
    OT_PRIVILEGE_REQUIRED: {
      en: details?.privilege
        ? `Clinical privilege missing: operation requires "${details.privilege}" privilege authorized by hospital registry.`
        : "Clinical privilege missing for this surgical safety act.",
      ur: "ہسپتال کے استحقاق رجسٹر کے مطابق کلینیکل اختیارات موجود نہیں ہیں۔",
    },
    OT_RECORD_FINAL: {
      en: "This surgical checklist pause is signed and final. Use 'Add Correction' to document any amendment.",
      ur: "یہ چیک لسٹ حتمی اور دستخط شدہ ہے۔ تصحیح کے لیے نیا نوٹ درج کریں۔",
    },
    OT_CHECKLIST_INCOMPLETE: {
      en: "The operation cannot be completed before all three safety pauses (Sign In, Time Out, Sign Out) are performed.",
      ur: "تینوں حفاظتی مراحل (سائن ان، ٹائم آؤٹ، سائن آؤٹ) مکمل کیے بغیر سرجری ختم نہیں کی جا سکتی۔",
    },
    CAPABILITY_INACTIVE: {
      en: "Surgery service is inactive. Checklist pauses cannot be recorded.",
      ur: "سرجری سروس غیر فعال ہے۔ چیک لسٹ محفوظ نہیں کی جا سکتی۔",
    },
    FORBIDDEN: {
      en: "You do not have permission to manage this surgical safety checklist.",
      ur: "آپ کو اس سرجیکل سیفٹی چیک لسٹ کو چلانے کی اجازت نہیں ہے۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ دوبارہ کوشش کریں۔`,
    }
  );
}
