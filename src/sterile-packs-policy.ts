import type { EstablishmentOut } from "./generated/facility_profile";
import type { PackOut } from "./generated/sterile_packs_ot";

export interface ClinicalUser {
  user_id: number;
  username: string;
  roles?: string[];
  permissions?: string[];
  employee_id?: number | null;
  name?: string;
}

/**
 * Evaluates runtime service capability views for sterile packs screens under Rule 26e45f89a1.
 * Never branch on facility category; evaluate GET /establishment views.screens for screen_id.
 */
export function getSterilePacksScreenView(
  establishment?: EstablishmentOut | null,
  screenId = "sterile_packs_ot"
): "full" | "open_work" | "records" | "setup" | "hidden" {
  if (!establishment || !establishment.views || !establishment.views.screens) {
    return "full";
  }
  const screenView = establishment.views.screens.find(
    (s) => s.screen_id === screenId
  );
  if (!screenView) {
    return "full";
  }
  return screenView.view;
}

/**
 * Permission checks for opening and recording sterile packs (POST /cssd/packs/use).
 * Requires cssd.pack.use or authorized clinical nursing/theatre roles.
 */
export function canUsePack(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];

  if (permissions.includes("cssd.pack.use")) return true;
  const allowedRoles = [
    "head_nurse",
    "ot_admin",
    "ot_nurse",
    "triage_nurse",
    "ward_nurse",
  ];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Permission checks for viewing sterile pack stock and details (GET /cssd/packs, GET /cssd/packs/{code}).
 * Requires cssd.view, cssd.operate, cssd.manage, or cssd.pack.use.
 */
export function canViewPacks(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  const permissions = user.permissions || [];
  const roles = user.roles || [];

  const validPerms = ["cssd.view", "cssd.operate", "cssd.manage", "cssd.pack.use"];
  if (permissions.some((p) => validPerms.includes(p))) return true;

  const allowedRoles = [
    "clinic_director",
    "cssd_technician",
    "head_nurse",
    "hospital_admin",
    "hospital_director",
    "ipc_nurse",
    "ot_admin",
    "ot_nurse",
    "owner",
    "quality_officer",
    "triage_nurse",
    "ward_nurse",
  ];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Evaluates whether a sterile pack can be safely used/opened under Rule 5eabbbecca.
 * CSSD_PACK_UNUSABLE: The pack has expired, failed, or been recalled; or is already used/quarantined.
 */
export function isPackUsable(pack?: PackOut | null): {
  usable: boolean;
  reason?: string;
  reasonUr?: string;
} {
  if (!pack) {
    return {
      usable: false,
      reason: "No sterile pack details provided.",
      reasonUr: "پیک کی تفصیلات فراہم نہیں کی گئیں۔",
    };
  }

  // Check cycle status first: A cycle that failed or was recalled invalidates all packs in the load
  if (pack.cycle_status === "Failed") {
    return {
      usable: false,
      reason: `Sterilization cycle #${pack.cycle_number} failed. Do NOT use this pack; return it to CSSD.`,
      reasonUr: `سٹرلائزیشن سائیکل نمبر ${pack.cycle_number} فیل ہو گیا تھا۔ اس پیک کو استعمال نہ کریں اور سی ایس ایس ڈی واپس کریں۔`,
    };
  }

  if (pack.cycle_status === "Recalled") {
    return {
      usable: false,
      reason: `Sterilization cycle #${pack.cycle_number} has been RECALLED. Quarantined for safety; return to CSSD immediately.`,
      reasonUr: `سٹرلائزیشن سائیکل نمبر ${pack.cycle_number} کو واپس منگوا لیا گیا ہے (Recalled)۔ فوری طور پر سی ایس ایس ڈی واپس کریں۔`,
    };
  }

  // Check individual pack status
  if (pack.status === "Recalled") {
    return {
      usable: false,
      reason: `Sterile pack ${pack.pack_code} is RECALLED (Rule 5eabbbecca). Do NOT use it.`,
      reasonUr: `جراثیم سے پاک پیک ${pack.pack_code} واپس منگوایا جا چکا ہے (قاعدہ 5eabbbecca)۔ اسے استعمال نہ کریں۔`,
    };
  }

  if (pack.status === "Expired") {
    return {
      usable: false,
      reason: `Sterile pack ${pack.pack_code} has EXPIRED on ${pack.expires_on}. Sterility cannot be guaranteed.`,
      reasonUr: `جراثیم سے پاک پیک ${pack.pack_code} کی میعاد ${pack.expires_on} کو ختم ہو چکی ہے۔`,
    };
  }

  if (pack.status === "Failed") {
    return {
      usable: false,
      reason: `Sterile pack ${pack.pack_code} failed sterilization indicators. Do NOT use it.`,
      reasonUr: `جراثیم سے پاک پیک ${pack.pack_code} سٹرلائزیشن ٹیسٹ میں فیل ہو چکا ہے۔`,
    };
  }

  if (pack.status === "Used") {
    return {
      usable: false,
      reason: `Sterile pack ${pack.pack_code} was ALREADY USED on ${pack.used_at || "earlier"} by ${pack.used_by_name || "staff"}.`,
      reasonUr: `جراثیم سے پاک پیک ${pack.pack_code} پہلے ہی استعمال ہو چکا ہے۔`,
    };
  }

  if (pack.status === "Quarantined") {
    return {
      usable: false,
      reason: `Sterile pack ${pack.pack_code} is Quarantined awaiting biological indicator clearance.`,
      reasonUr: `جراثیم سے پاک پیک ${pack.pack_code} قرنطینہ میں ہے اور بائیولوجیکل ٹیسٹ کلیئرنس کا منتظر ہے۔`,
    };
  }

  return { usable: true };
}

/**
 * Validates point-of-use scan submission input under Rule d8f4d7af47 and cross-field rules.
 * Requires pack_code and at least one of booking_id (theatre) or admission_id (ward).
 */
export function validatePackUseInput(
  packCode: string,
  context: { booking_id?: number | null; admission_id?: number | null }
): { valid: boolean; error?: string; errorUr?: string } {
  const trimmed = packCode ? packCode.trim() : "";
  if (!trimmed) {
    return {
      valid: false,
      error: "Pack code barcode is required.",
      errorUr: "پیک کا بارکوڈ درکار ہے۔",
    };
  }

  const hasBooking = typeof context.booking_id === "number" && context.booking_id > 0;
  const hasAdmission = typeof context.admission_id === "number" && context.admission_id > 0;

  if (!hasBooking && !hasAdmission) {
    return {
      valid: false,
      error: "Say on which operation (theatre) or admission (ward) the pack was used (Rule d8f4d7af47, MSDS IPC 92).",
      errorUr: "براہ کرم منتخب کریں کہ یہ پیک کس آپریشن (تھیٹر) یا داخلہ (وارڈ) میں استعمال ہوا (قاعدہ d8f4d7af47)۔",
    };
  }

  return { valid: true };
}

/**
 * Checks if a pack is expiring soon and should be highlighted in red warning colors (Rule 5eabbbecca).
 */
export function isPackExpiringSoon(pack?: PackOut | null): boolean {
  if (!pack) return false;
  return Boolean(pack.expiring_soon);
}

/**
 * Detects if a realtime event is a CSSD recall alert under Rule 4357be8acb.
 */
export function isCssdRecallEvent(payload?: { status?: string; cycle_status?: string } | null): boolean {
  if (!payload) return false;
  return payload.status === "Recalled" || payload.cycle_status === "Recalled";
}

/**
 * Bilingual error code explanation for sterile pack operations.
 */
export function explainSterilePackError(
  code: string,
  details?: unknown
): { en: string; ur: string } {
  switch (code) {
    case "CSSD_PACK_UNUSABLE":
      return {
        en: "This sterile pack cannot be opened or used: it has expired, failed sterilization, or been recalled. Do NOT use it. Take another pack and return this one to CSSD (Rule 5eabbbecca).",
        ur: "یہ جراثیم سے پاک پیک استعمال نہیں کیا جا سکتا کیونکہ یہ زائد المیعاد ہے، فیل ہو چکا ہے یا واپس منگوایا جا چکا ہے۔ اسے ہرگز استعمال نہ کریں، دوسرا پیک لیں اور اسے سی ایس ایس ڈی واپس کریں (قاعدہ 5eabbbecca)۔",
      };
    case "REFERENCE_NOT_FOUND":
      return {
        en: "The referenced sterile pack, surgical booking, or ward admission does not exist.",
        ur: "متعلقہ سٹرائل پیک، سرجیکل بکنگ یا وارڈ داخلہ سسٹم میں موجود نہیں ہے۔",
      };
    case "VALIDATION_ERROR":
      return {
        en: "Invalid pack use request. Please verify the scanned barcode and ensure an active operation or ward stay is selected.",
        ur: "درخواست کی تصدیق میں خرابی۔ براہ کرم اسکین شدہ بارکوڈ اور فعال سرجری یا وارڈ کا انتخاب چیک کریں۔",
      };
    default:
      return {
        en: "A system error occurred while recording the sterile pack. Please refresh and retry.",
        ur: "سٹرائل پیک کے اندراج کے دوران سسٹم میں خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
      };
  }
}
