export interface ClinicalUser {
  id?: number;
  username?: string;
  user_id?: number;
  role?: string;
  roles?: string[];
  permissions?: string[];
  token?: string;
}

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  DeathRegisterRowOut,
  DeathRecordOut,
  BodyReleaseIn,
} from "./generated/body_release_ward";

export interface BodyReleaseViewPolicy {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canRelease: boolean;
  canViewRegister: boolean;
  banner: string | null;
}

/**
 * Service view capability evaluation for body_release_ward and body_release_er
 * rule:20c304a0c8
 */
export function evaluateBodyReleaseView(
  establishment?: EstablishmentOut | null,
  screenId: "body_release_ward" | "body_release_er" = "body_release_ward"
): BodyReleaseViewPolicy {
  const capKey = screenId === "body_release_ward" ? "inpatient" : "emergency_department";
  const cap = establishment?.capabilities?.find((c) => c.capability === capKey);
  const screenView = establishment?.views?.screens?.find((s) => s.screen_id === screenId)?.view || "full";

  if (cap?.state === "Retired" || screenView === "records") {
    return {
      view: "records",
      canRelease: false,
      canViewRegister: true,
      banner: "Records only: viewing deceased handover register and certificates.",
    };
  }

  if (cap?.state === "Retiring" || screenView === "open_work") {
    return {
      view: "open_work",
      canRelease: true,
      canViewRegister: true,
      banner: screenId === "body_release_ward"
        ? "No new inpatient admissions from now on. Completing existing body handovers and printing continue."
        : "No new emergency arrivals from now on. Completing existing body handovers and printing continue.",
    };
  }

  if (screenView === "hidden" || screenView === "setup") {
    return {
      view: "hidden",
      canRelease: false,
      canViewRegister: false,
      banner: null,
    };
  }

  return {
    view: "full",
    canRelease: true,
    canViewRegister: true,
    banner: null,
  };
}

/**
 * Role permissions check for releasing a body
 */
export function canReleaseBody(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  if (user.permissions?.includes("death.body.release")) return true;
  const roles = [user.role, ...(user.roles || [])].filter(Boolean) as string[];
  const allowed = [
    "ward_nurse",
    "head_nurse",
    "triage_nurse",
    "doctor",
    "clinical_specialist",
    "surgeon",
    "anaesthetist",
    "mortuary_technician",
  ];
  return roles.some((r) => allowed.includes(r));
}

/**
 * Role permissions check for viewing the body release queue / register
 */
export function canViewBodyRegister(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  if (
    user.permissions?.some(
      (p) =>
        p === "death.body.release" ||
        p === "death.register.view" ||
        p === "death.record"
    )
  ) {
    return true;
  }
  const roles = [user.role, ...(user.roles || [])].filter(Boolean) as string[];
  const allowed = [
    "ward_nurse",
    "head_nurse",
    "triage_nurse",
    "doctor",
    "clinical_specialist",
    "surgeon",
    "anaesthetist",
    "hospital_admin",
    "hospital_director",
    "clinic_director",
    "mortuary_technician",
  ];
  return roles.some((r) => allowed.includes(r));
}

/**
 * Check whether a deceased record is ready for handover
 * rule:cd68894ad3: status === "Draft" means doctor has not certified yet, body cannot leave (DEATH_RECORD_NOT_CERTIFIED).
 */
export function checkHandoverReadiness(
  death: DeathRegisterRowOut | DeathRecordOut
): { ready: boolean; reason: string | null } {
  if (death.status === "Draft") {
    return {
      ready: false,
      reason: "The doctor has not certified the cause of death yet. The body cannot leave the hospital until certified (DEATH_RECORD_NOT_CERTIFIED).",
    };
  }
  if (death.body_released_at) {
    return {
      ready: false,
      reason: "The body has already been handed over and released from the hospital.",
    };
  }
  return { ready: true, reason: null };
}

/**
 * Validation for body handover inputs
 * rule:60aea191e4
 */
export function validateBodyRelease(
  input: Partial<BodyReleaseIn>,
  death?: DeathRegisterRowOut | DeathRecordOut | null
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.released_to) {
    errors.released_to = "Recipient entity type is required.";
  }

  const receiverName = input.receiver_name?.trim() ?? "";
  if (receiverName.length < 3) {
    errors.receiver_name = "Receiver full name is required (minimum 3 characters).";
  }

  const isMlc = Boolean(death?.mlc_number || (death && "mlc_id" in death && death.mlc_id));

  if (isMlc) {
    // Medico-legal death: must release against police letter or roznamcha diary reference (rule:60aea191e4)
    const polRef = input.police_reference?.trim() ?? "";
    if (polRef.length < 3) {
      errors.police_reference = "Police diary or letter reference is mandatory for medico-legal casualty handover.";
    }
  } else if (input.released_to === "NextOfKin") {
    // Next of kin: relationship and CNIC / identity document required
    const rel = input.receiver_relationship?.trim() ?? "";
    if (rel.length < 2) {
      errors.receiver_relationship = "Relationship to deceased is required.";
    }

    const cnic = input.receiver_id_number?.trim() ?? "";
    if (cnic.length < 5) {
      errors.receiver_id_number = "CNIC or national identity document number is required.";
    }
  }

  return errors;
}

/**
 * Sort body handover queue: Certified pending release first, then Drafts, then Released
 */
export function sortBodyReleaseQueue(
  rows: DeathRegisterRowOut[]
): DeathRegisterRowOut[] {
  return [...rows].sort((a, b) => {
    // 1. Unreleased certified bodies first
    const aReady = a.status === "Certified" && !a.body_released_at;
    const bReady = b.status === "Certified" && !b.body_released_at;
    if (aReady && !bReady) return -1;
    if (!aReady && bReady) return 1;

    // 2. Drafts awaiting doctor certification second
    const aDraft = a.status === "Draft" && !a.body_released_at;
    const bDraft = b.status === "Draft" && !b.body_released_at;
    if (aDraft && !bDraft) return -1;
    if (!aDraft && bDraft) return 1;

    // 3. Newest death timestamp first
    const aTime = new Date(a.death_at).getTime() || 0;
    const bTime = new Date(b.death_at).getTime() || 0;
    return bTime - aTime;
  });
}

/**
 * Bilingual domain error mapping for body release operations
 */
export function explainBodyReleaseError(error: any): [string, string] {
  const code = error?.code || error?.error?.code || "";

  switch (code) {
    case "DEATH_RECORD_NOT_CERTIFIED":
      return [
        "The doctor has not certified the cause of death yet: the body cannot leave the ward.",
        "ڈاکٹر نے ابھی تک وفات کے اسباب کی تصدیق نہیں کی: میت وارڈ سے روانہ نہیں ہو سکتی۔",
      ];
    case "BODY_ALREADY_RELEASED":
      return [
        "The body has already been released and handed over.",
        "میت پہلے ہی باضابطہ طور پر لواحقین یا پولیس کے حوالے کی جا چکی ہے۔",
      ];
    case "FORBIDDEN":
      return [
        "You do not have permission to hand over or release deceased bodies.",
        "آپ کو میت کی حوالگی یا اخراج درج کرنے کا مجاز اختیار حاصل نہیں ہے۔",
      ];
    case "VERSION_CONFLICT":
      return [
        "This death record was updated by another terminal. Reloading latest records.",
        "یہ ریکارڈ کسی دوسرے ٹرمینل سے تبدیل کیا جا چکا ہے۔ تازہ ڈیٹا لوڈ کیا جا رہا ہے۔",
      ];
    case "VALIDATION_ERROR":
      return [
        "Please provide all required recipient details and identity credentials.",
        "براہ کرم وصول کنندہ کے تمام لازمی کوائف اور شناختی دستاویزات درج کریں۔",
      ];
    default:
      return [
        error?.message || "An unexpected error occurred during body handover.",
        "میت کی حوالگی کے دوران غیر متوقع خرابی پیش آئی ہے۔",
      ];
  }
}
