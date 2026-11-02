/**
 * Domain policy and business rules for Super Admin IT Console (Screen 144, workspace: super_admin).
 * Statutory Rules:
 * - rule:67877c44f8: Go-live first owner creation (name, CNIC, mobile, roles). Temporary password slip printed. Step disappears once done.
 * - rule:b184a46f61: Temporary passwords and station keys shown ONCE — offer print/copy, never store client-side.
 * - rule:05369643ae: Register BarcodeScanner stations without RFID hardware; bed QR stickers bed-labels.
 * - rule:616f98fff0: Kill switch: big red button, typed confirmation 'FORCE GLOBAL LOGOUT', clearly marked emergency-only.
 * - rule:e9ca3f6b5f: ICD code lists: WHO ICD-10 file load, ICD-11 release activation.
 * - rule:b9dbd0ab25: Control settings and privileged roles go to change-requests; self-role change forbidden; last owner kept.
 * - rule:b6c546385e: Terminal cash_node mapping: pharmacy counter mapped for dispensing/OTC cash.
 * - rule:d0dc21da29: Wards list and edit; closing ward only when beds_in_use is empty and waitlisted is 0 (WARD_IN_USE).
 */

import type {
  FirstOwnerIn,
  WardListItemOut,
  TerminalIn,
  StationIn,
  KillSwitchIn,
} from "./generated/it_console.ts";

export type ItConsoleCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ItConsoleCapabilityView {
  mode: ItConsoleCapabilityMode;
  canManageUsers: boolean;
  canManageHardware: boolean;
  canManageWards: boolean;
  canManageSettings: boolean;
  canKillSwitch: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getItConsoleCapabilityView(establishment?: any): ItConsoleCapabilityView {
  const screens: string[] = establishment?.views?.screens || [];
  const hasConsole = screens.length === 0 || screens.includes("it_console");

  if (!hasConsole) {
    return {
      mode: "hidden",
      canManageUsers: false,
      canManageHardware: false,
      canManageWards: false,
      canManageSettings: false,
      canKillSwitch: false,
      noticeEn: "IT administration console is hidden in current facility configuration.",
      noticeUr: "موجودہ سہولت کی تشکیل میں آئی ٹی ایڈمنسٹریشن کنسول پوشیدہ ہے۔",
    };
  }

  const isRecordsOnly = Boolean(establishment?.views?.records_only);
  const isOpenWorkOnly = Boolean(establishment?.views?.open_work_only);
  const isSetupOnly = Boolean(establishment?.views?.setup_only);

  if (isRecordsOnly) {
    return {
      mode: "records",
      canManageUsers: false,
      canManageHardware: false,
      canManageWards: false,
      canManageSettings: false,
      canKillSwitch: false,
      noticeEn: "Records Mode: Reviewing IT system configurations, users, and server telemetry in read-only mode.",
      noticeUr: "صرف ریکارڈ موڈ: آئی ٹی سسٹم کی تشکیل، صارفین اور ٹیلی میٹری صرف مطالعہ کے لیے کھلی ہے۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canManageUsers: true,
      canManageHardware: true,
      canManageWards: false,
      canManageSettings: false,
      canKillSwitch: true,
      noticeEn: "Restricted Mode: Provisioning pending staff and maintaining operational terminals; structural changes restricted.",
      noticeUr: "محدود موڈ: زیر التواء عملے کی لاگ ان فراہمی اور ٹرمینلز کی دیکھ بھال؛ ساختی تبدیلیاں محدود ہیں۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canManageUsers: true,
      canManageHardware: true,
      canManageWards: true,
      canManageSettings: true,
      canKillSwitch: false,
      noticeEn: "Setup Mode: Initial IT infrastructure deployment and device mapping active.",
      noticeUr: "سیٹ اپ موڈ: ابتدائی آئی ٹی انفراسٹرکچر کی تعیناتی اور آلات کی نقشہ سازی فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canManageUsers: true,
    canManageHardware: true,
    canManageWards: true,
    canManageSettings: true,
    canKillSwitch: true,
  };
}

/** Formats CNIC as 00000-0000000-0 */
export function formatCnic(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidCnic(cnic: string): boolean {
  const digits = cnic.replace(/\D/g, "");
  return digits.length === 13;
}

export function isValidPakMobile(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(03\d{9}|\+923\d{9}|923\d{9})$/.test(cleaned);
}

/**
 * Validates First Owner Input per Rule rule:67877c44f8
 */
export function validateFirstOwnerInput(body: Record<string, any>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.full_name || body.full_name.trim().length < 3) {
    errors.full_name = "Full name is required (minimum 3 characters).";
  }

  if (!body.cnic || !isValidCnic(body.cnic)) {
    errors.cnic = "Valid 13-digit CNIC is strictly mandatory for the hospital owner.";
  }

  if (!body.mobile || !isValidPakMobile(body.mobile)) {
    errors.mobile = "Valid 11-digit Pakistan mobile number is required (03XX-XXXXXXX).";
  }

  const forbiddenRoles = ["super_admin", "phc_inspector"];
  const roles = body.roles || [];
  for (const r of roles) {
    if (forbiddenRoles.includes(r)) {
      errors.roles = `Role '${r}' cannot be assigned during initial owner creation.`;
      break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Kill Switch Input per Rule rule:616f98fff0
 */
export function validateKillSwitchInput(body: Record<string, any>): { valid: boolean; error?: string } {
  if (!body.reason || body.reason.trim().length < 5) {
    return { valid: false, error: "Detailed emergency reason is required for invoking global kill switch." };
  }

  if (body.confirm !== "FORCE GLOBAL LOGOUT") {
    return { valid: false, error: 'Confirmation string must exactly match "FORCE GLOBAL LOGOUT".' };
  }

  return { valid: true };
}

/**
 * Privileged roles requiring Owner approval per Rule rule:b9dbd0ab25
 */
export const PRIVILEGED_ROLES = [
  "owner",
  "hospital_admin",
  "billing_admin",
  "accountant",
  "medical_director",
  "nursing_director",
];

export function isPrivilegedRole(roleCode: string): boolean {
  return PRIVILEGED_ROLES.includes(roleCode);
}

/**
 * Validates role changes per Rule rule:b9dbd0ab25
 */
export function validateUserRolesChange(
  targetUserId: number,
  currentUserId: number,
  newRoles: string[],
  existingTargetRoles: string[]
): { allowedDirectly: boolean; requiresChangeRequest: boolean; error?: string } {
  // Self-role change forbidden
  if (targetUserId === currentUserId) {
    return {
      allowedDirectly: false,
      requiresChangeRequest: false,
      error: "Self-role modification is strictly forbidden (SELF_ROLE_CHANGE_FORBIDDEN).",
    };
  }

  // Last owner protection
  const wasOwner = existingTargetRoles.includes("owner");
  const isStillOwner = newRoles.includes("owner");
  if (wasOwner && !isStillOwner) {
    // Attempting to remove owner role
    return {
      allowedDirectly: false,
      requiresChangeRequest: true,
      error: "Removing an Owner role requires approval and cannot orphan the hospital (LAST_OWNER).",
    };
  }

  // Check if any privileged role is being granted or changed
  const containsPrivileged = newRoles.some((r) => isPrivilegedRole(r));
  if (containsPrivileged) {
    return {
      allowedDirectly: false,
      requiresChangeRequest: true,
    };
  }

  return {
    allowedDirectly: true,
    requiresChangeRequest: false,
  };
}

/**
 * Validates Ward closing per Rule rule:d0dc21da29
 * Closing a ward (is_active false) is only permitted when beds_in_use is empty and waitlisted is 0.
 */
export function canCloseWard(ward: WardListItemOut): { canClose: boolean; reason?: string } {
  const inUseCount = ward.beds_in_use?.length || 0;
  const waitlistCount = ward.waitlisted || 0;

  if (inUseCount > 0 || waitlistCount > 0) {
    return {
      canClose: false,
      reason: `Cannot close ward (WARD_IN_USE): ${inUseCount} bed(s) actively in use (${ward.beds_in_use.join(", ")}), ${waitlistCount} patient(s) waitlisted. Transfer or discharge all patients first.`,
    };
  }

  return { canClose: true };
}

/**
 * Validates Terminal Configuration per Rule rule:b6c546385e
 * Terminal cash_node: map every PC where pharmacy takes cash (dispensing, OTC) to PharmacyCounter.
 */
export function validateTerminalInput(body: Partial<TerminalIn>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.mac || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(body.mac)) {
    errors.mac = "Valid hardware MAC address is required (XX:XX:XX:XX:XX:XX).";
  }

  if (!body.location_label || body.location_label.trim().length === 0) {
    errors.location_label = "Terminal location description is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Standard Bilingual Error Messages for IT Console
 */
export const IT_CONSOLE_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string }
> = {
  FIRST_OWNER_EXISTS: {
    en: "The primary hospital Owner already exists; initial setup route is closed.",
    ur: "ہسپتال کا بنیادی مالک پہلے سے موجود ہے؛ ابتدائی سیٹ اپ بند ہو چکا ہے۔",
  },
  SELF_ROLE_CHANGE_FORBIDDEN: {
    en: "Self-modification of user roles or permissions is strictly forbidden.",
    ur: "اپنے صارف کے کردار یا اختیارات میں خود تبدیلی سختی سے ممنوع ہے۔",
  },
  LAST_OWNER: {
    en: "Cannot revoke owner role: the hospital must maintain at least one active Owner.",
    ur: "مالک کا کردار ختم نہیں کیا جا سکتا: ہسپتال کا کم از کم ایک فعال مالک ہونا ضروری ہے۔",
  },
  WARD_IN_USE: {
    en: "Cannot deactivate ward while beds are occupied/dirty or patients are waitlisted.",
    ur: "جب تک بستر استعمال میں ہوں یا مریض انتظار میں ہوں، وارڈ بند نہیں کیا جا سکتا۔",
  },
  MAINTENANCE: {
    en: "Hospital system is currently under scheduled IT maintenance.",
    ur: "ہسپتال کا سسٹم فی الوقت شیڈول شدہ آئی ٹی مینٹیننس پر ہے۔",
  },
  KILL_SWITCH_CONFIRMATION_INVALID: {
    en: 'Emergency kill switch requires typing exact confirmation "FORCE GLOBAL LOGOUT".',
    ur: 'ایمرجنسی سوئچ کے لیے "FORCE GLOBAL LOGOUT" کا درست اندراج لازمی ہے۔',
  },
  FORBIDDEN: {
    en: "Insufficient administrative privileges for this IT console action.",
    ur: "اس آئی ٹی کارروائی کے لیے مطلوبہ انتظامی اختیارات ناکافی ہیں۔",
  },
  VALIDATION_ERROR: {
    en: "Validation error: please verify highlighted configuration parameters.",
    ur: "تصدیقی خرابی: براہ کرم نمایاں کردہ ترتیبات کی جانچ کریں۔",
  },
  NOT_FOUND: {
    en: "The requested user, terminal, ward, or setting was not found.",
    ur: "مطلوبہ صارف، ٹرمینل، وارڈ یا سیٹنگ نہیں ملی۔",
  },
};
