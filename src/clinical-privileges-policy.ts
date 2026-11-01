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
  ClinicalPrivilegeOut,
  PrivilegeGrantIn,
  PrivilegeUpdateIn,
  PrivilegeRevokeIn,
} from "./generated/clinical_privileges";

export type PrivilegeType =
  | "Surgery"
  | "Anaesthesia"
  | "PreAnaesthesiaAssessment"
  | "RecoveryDischarge"
  | "Prescribing"
  | "RestrictedPrescribing"
  | "MedicationAdministration"
  | "RadiologyReporting";

export const PRIVILEGE_LABELS: Record<PrivilegeType, { en: string; ur: string }> = {
  Surgery: { en: "Surgery", ur: "سرجری / جراحی" },
  Anaesthesia: { en: "Anaesthesia", ur: "اینستھیزیا / بے ہوشی" },
  PreAnaesthesiaAssessment: { en: "Pre-anaesthesia assessment", ur: "اینستھیزیا سے پہلے معائنہ" },
  RecoveryDischarge: { en: "Recovery discharge", ur: "ریکوری ڈسچارج" },
  Prescribing: { en: "Prescribing", ur: "نسخہ نویسی" },
  RestrictedPrescribing: { en: "Restricted prescribing", ur: "مخصوص ادویات کی نسخہ نویسی" },
  MedicationAdministration: { en: "Medication administration", ur: "ادویات دینا" },
  RadiologyReporting: { en: "Radiology reporting", ur: "ریڈیالوجی رپورٹنگ" },
};

export interface PrivilegeStatusInfo {
  status: "Active" | "ExpiringSoon" | "Expired" | "Revoked";
  badgeClass: string;
  label: string;
  labelUr: string;
  daysRemaining?: number;
}

/**
 * Evaluates the runtime screen view for clinical_privileges based on GET /establishment
 * Rule: caf82033b4
 */
export function evaluateClinicalPrivilegesView(establishment?: EstablishmentOut | null): {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  banner?: string;
  canCreateNew: boolean;
  isReadOnly: boolean;
} {
  const screens = establishment?.views?.screens || [];
  const screenView = screens.find((s: { screen_id: string; view: string }) => s.screen_id === "clinical_privileges")?.view || "full";

  switch (screenView) {
    case "open_work":
      return {
        view: "open_work",
        banner: "No new clinical privilege grants from now on (Surgery service is Retiring)",
        canCreateNew: false,
        isReadOnly: false,
      };
    case "records":
      return {
        view: "records",
        banner: "Records view: historical clinical privileges register (Surgery service is Retired)",
        canCreateNew: false,
        isReadOnly: true,
      };
    case "setup":
      return {
        view: "setup",
        banner: "Setup mode: configure clinical privileges before surgery service activation",
        canCreateNew: true,
        isReadOnly: false,
      };
    case "hidden":
      return {
        view: "hidden",
        canCreateNew: false,
        isReadOnly: true,
      };
    case "full":
    default:
      return {
        view: "full",
        canCreateNew: true,
        isReadOnly: false,
      };
  }
}

/**
 * Permission checks for clinical privileges screen
 */
export function canManagePrivileges(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("ot.privilege.manage");
}

export function canViewPrivileges(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.some((p: string) => p === "ot.status.view" || p === "ot.privilege.manage");
}

export function canSearchEmployees(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("hr.employee.view");
}

export function canViewTheatrePolicy(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.some((p: string) =>
    ["ot.clinical.view", "ot.checklist.configure", "ot.privilege.manage"].includes(p)
  );
}

/**
 * Calculates privilege grant status, flagging items expiring within 30 days (rule: fa7737b903)
 */
export function getPrivilegeStatus(
  privilege: ClinicalPrivilegeOut,
  now: Date = new Date()
): PrivilegeStatusInfo {
  if (privilege.revoked_at) {
    return {
      status: "Revoked",
      badgeClass: "badge-danger",
      label: "Revoked",
      labelUr: "منسوخ شدہ",
    };
  }

  if (!privilege.valid_until) {
    return {
      status: "Active",
      badgeClass: "badge-success",
      label: "Active (Indefinite)",
      labelUr: "فعال (مستقل)",
    };
  }

  const untilDate = new Date(privilege.valid_until);
  const diffTime = untilDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "Expired",
      badgeClass: "badge-danger",
      label: "Expired",
      labelUr: "مدت ختم",
      daysRemaining: diffDays,
    };
  }

  // Highlight grants ending within a month (30 days) - rule: fa7737b903
  if (diffDays <= 30) {
    return {
      status: "ExpiringSoon",
      badgeClass: "badge-warning",
      label: `Expiring soon (${diffDays}d)`,
      labelUr: `قریب الختم (${diffDays} دن)`,
      daysRemaining: diffDays,
    };
  }

  return {
    status: "Active",
    badgeClass: "badge-success",
    label: "Active",
    labelUr: "فعال",
    daysRemaining: diffDays,
  };
}

/**
 * Validates input for creating a privilege grant (POST /ot/privileges)
 */
export function validateGrantInput(input: Partial<PrivilegeGrantIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.employee_id || input.employee_id <= 0) {
    errors.employee_id = "Please select a clinician / employee.";
  }

  const validPrivileges: PrivilegeType[] = [
    "Surgery",
    "Anaesthesia",
    "PreAnaesthesiaAssessment",
    "RecoveryDischarge",
    "Prescribing",
    "RestrictedPrescribing",
    "MedicationAdministration",
    "RadiologyReporting",
  ];

  if (!input.privilege || !validPrivileges.includes(input.privilege as PrivilegeType)) {
    errors.privilege = "Please select a valid privilege category.";
  }

  if (!input.scope || input.scope.trim().length < 3) {
    errors.scope = "Scope must be at least 3 characters.";
  } else if (input.scope.length > 1000) {
    errors.scope = "Scope cannot exceed 1000 characters.";
  }

  if (!input.basis || input.basis.trim().length < 3) {
    errors.basis = "Basis must be at least 3 characters (e.g. qualifications, credentials committee decision).";
  } else if (input.basis.length > 1000) {
    errors.basis = "Basis cannot exceed 1000 characters.";
  }

  if (input.valid_from && !/^\d{4}-\d{2}-\d{2}$/.test(input.valid_from)) {
    errors.valid_from = "Valid from date must follow YYYY-MM-DD format.";
  }

  if (input.valid_until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.valid_until)) {
      errors.valid_until = "Valid until date must follow YYYY-MM-DD format.";
    } else if (input.valid_from && input.valid_until < input.valid_from) {
      errors.valid_until = "Valid until date cannot be earlier than valid from date.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates input for updating a privilege grant (PATCH /ot/privileges/{id})
 */
export function validateUpdateInput(input: Partial<PrivilegeUpdateIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (input.scope !== undefined && input.scope !== null) {
    if (input.scope.trim().length < 3) {
      errors.scope = "Scope must be at least 3 characters.";
    } else if (input.scope.length > 1000) {
      errors.scope = "Scope cannot exceed 1000 characters.";
    }
  }

  if (input.basis !== undefined && input.basis !== null) {
    if (input.basis.trim().length < 3) {
      errors.basis = "Basis must be at least 3 characters.";
    } else if (input.basis.length > 1000) {
      errors.basis = "Basis cannot exceed 1000 characters.";
    }
  }

  if (input.valid_until !== undefined && input.valid_until !== null && input.valid_until !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.valid_until)) {
      errors.valid_until = "Valid until date must follow YYYY-MM-DD format.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates input for revoking a privilege grant (POST /ot/privileges/{id}/revoke)
 */
export function validateRevokeInput(input: Partial<PrivilegeRevokeIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.reason || input.reason.trim().length < 3) {
    errors.reason = "Revocation reason is required and must be at least 3 characters.";
  } else if (input.reason.length > 1000) {
    errors.reason = "Revocation reason cannot exceed 1000 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Translates domain error codes into clear bilingual guidance
 */
export function explainClinicalPrivilegesError(err: unknown): {
  code: string;
  message: string;
  messageUr: string;
  action: string;
  actionUr: string;
} {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let code = "UNKNOWN_ERROR";

  const match = rawMsg.match(
    /\b(OT_PRIVILEGE_EXISTS|OT_PRIVILEGE_REVOKED|OT_PRIVILEGE_REQUIRED|REFERENCE_NOT_FOUND|VERSION_CONFLICT|FORBIDDEN|VALIDATION_ERROR)\b/
  );
  if (match) {
    code = match[1];
  }

  switch (code) {
    case "OT_PRIVILEGE_EXISTS":
      return {
        code,
        message: "This person already holds this privilege: extend it or revoke it first.",
        messageUr: "اس اہلکار کے پاس یہ اختیار پہلے سے موجود ہے: اس کی تجدید کریں یا منسوخ کریں۔",
        action: "Locate the existing grant in the register and edit its validity or revoke it.",
        actionUr: "رجسٹر میں موجودہ ریکارڈ تلاش کریں اور تاریخ میں توسیع یا منسوخی کریں۔",
      };
    case "OT_PRIVILEGE_REVOKED":
      return {
        code,
        message: "This privilege was already revoked: grant it again instead.",
        messageUr: "یہ اختیار پہلے ہی منسوخ ہو چکا ہے: اس کی جگہ نیا اختیار جاری کریں۔",
        action: "A revoked privilege cannot be updated. Create a new grant if needed.",
        actionUr: "منسوخ شدہ اختیار کو تبدیل نہیں کیا جا سکتا۔ نیا اختیار جاری کریں۔",
      };
    case "OT_PRIVILEGE_REQUIRED":
      return {
        code,
        message: "The hospital has not authorized this person for this clinical privilege.",
        messageUr: "ہسپتال نے اس اہلکار کو اس کلینیکل اختیار کے لیے مجاز نہیں کیا ہے۔",
        action: "Grant the necessary privilege before proceeding with surgical procedures.",
        actionUr: "طریقہ کار شروع کرنے سے پہلے مطلوبہ اختیار جاری کریں۔",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        code,
        message: "The referenced employee or department record does not exist.",
        messageUr: "متعلقہ ملازم یا شعبے کا ریکارڈ نہیں ملا۔",
        action: "Verify the employee exists in HR active staff and search again.",
        actionUr: "ملازم کی ایچ آر میں موجودگی کی تصدیق کریں اور دوبارہ تلاش کریں۔",
      };
    case "VERSION_CONFLICT":
      return {
        code,
        message: "This privilege record was updated by another user or terminal.",
        messageUr: "اس ریکارڈ کو کسی اور نے تبدیل کر دیا ہے۔",
        action: "Reloading latest record state to prevent conflicting overwrites.",
        actionUr: "تازہ ترین ریکارڈ لوڈ کیا جا رہا ہے تاکہ اوور رائٹ سے بچا جا سکے۔",
      };
    case "FORBIDDEN":
      return {
        code,
        message: "You do not have permission to manage clinical privileges.",
        messageUr: "آپ کے پاس کلینیکل اختیارات کے انتظام کی اجازت نہیں ہے۔",
        action: "Contact the Hospital Director, Owner, or Clinic Director for assistance.",
        actionUr: "ہسپتال کے ڈائریکٹر، مالک یا کلینک ڈائریکٹر سے رابطہ کریں۔",
      };
    case "VALIDATION_ERROR":
      return {
        code,
        message: "The submitted privilege form contains invalid data.",
        messageUr: "فارم میں فراہم کردہ معلومات درست نہیں ہیں۔",
        action: "Check highlighted fields, ensure dates and text lengths are valid.",
        actionUr: "نشان زدہ فیلڈز کو چیک کریں اور درست معلومات درج کریں۔",
      };
    default:
      return {
        code: "UNEXPECTED_ERROR",
        message: rawMsg || "An unexpected error occurred while processing clinical privileges.",
        messageUr: "کلینیکل اختیارات کی پروسیسنگ کے دوران غیر متوقع خرابی پیش آئی۔",
        action: "Check server connection and retry.",
        actionUr: "کنکشن چیک کریں اور دوبارہ کوشش کریں۔",
      };
  }
}
