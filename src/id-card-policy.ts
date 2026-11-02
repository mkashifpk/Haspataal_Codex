/**
 * Domain policy and business rules for Staff ID Card Designer & Print (Screen 147, workspace: hr).
 *
 * Capabilities:
 * - printing: card_role thermal/PVC card printer output conforming to CR80 dimensions (85.6mm x 54.0mm).
 * - f1_help: contextual F1 help with bilingual English/Urdu guidance.
 * - zoom: bounded 100-250% zoom state.
 *
 * Endpoints:
 * - GET /hr/employees/{employee_id}/id-card: ID card designer payload with CR80 dimensions, employee details, dual SVG barcode + QR, and access QR badge if issued (rule:1cc0496368).
 * - GET /terminals/whoami: Terminal identity, location, and mapped card printer detection.
 */

import type { TerminalIdentityOut } from "./generated/id_card";

export type IdCardCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface IdCardCapabilityView {
  mode: IdCardCapabilityMode;
  canViewIdCard: boolean;
  canPrintIdCard: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getIdCardCapabilityView(establishment?: any): IdCardCapabilityView {
  const screens: string[] = establishment?.views?.screens || [];
  const hasIdCard = screens.length === 0 || screens.includes("id_card");

  if (!hasIdCard) {
    return {
      mode: "hidden",
      canViewIdCard: false,
      canPrintIdCard: false,
      noticeEn: "Staff ID card designer is hidden in current facility configuration.",
      noticeUr: "موجودہ سہولت کی تشکیل میں عملے کے شناختی کارڈ کا ڈیزائنر پوشیدہ ہے۔",
    };
  }

  const isRecordsOnly = Boolean(establishment?.views?.records_only);
  const isOpenWorkOnly = Boolean(establishment?.views?.open_work_only);
  const isSetupOnly = Boolean(establishment?.views?.setup_only);

  if (isRecordsOnly) {
    return {
      mode: "records",
      canViewIdCard: true,
      canPrintIdCard: false,
      noticeEn: "Records Mode: Reviewing staff ID card layouts in read-only mode.",
      noticeUr: "صرف ریکارڈ موڈ: شناختی کارڈ کا لے آؤٹ صرف مطالعہ کے لیے کھلا ہے۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canViewIdCard: true,
      canPrintIdCard: true,
      noticeEn: "Restricted Mode: Operational staff ID card preview and printing active.",
      noticeUr: "محدود موڈ: آپریشنل شناختی کارڈ کا پیش نظارہ اور پرنٹنگ فعال ہے۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canViewIdCard: true,
      canPrintIdCard: false,
      noticeEn: "Setup Mode: Hardware card printer routing configuration active.",
      noticeUr: "سیٹ اپ موڈ: کارڈ پرنٹر روٹنگ کی تشکیل فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canViewIdCard: true,
    canPrintIdCard: true,
  };
}

export interface CardPrinterStatus {
  isRegistered: boolean;
  hasCardPrinter: boolean;
  printerName: string;
  printerAddress: string;
  locationLabel: string;
  statusBadgeClass: string;
  statusTextEn: string;
  statusTextUr: string;
}

/**
 * Detects mapped card printer from terminal identity (GET /terminals/whoami).
 */
export function getCardPrinterStatus(identity?: TerminalIdentityOut | null): CardPrinterStatus {
  if (!identity) {
    return {
      isRegistered: false,
      hasCardPrinter: false,
      printerName: "Unknown",
      printerAddress: "",
      locationLabel: "Unidentified Terminal",
      statusBadgeClass: "bg-secondary",
      statusTextEn: "Terminal identity loading or unavailable.",
      statusTextUr: "ٹرمینل کی شناخت لوڈ ہو رہی ہے یا دستیاب نہیں۔",
    };
  }

  const isRegistered = Boolean(identity.registered);
  const locationLabel = identity.location_label || (isRegistered ? "Registered Terminal" : "Unregistered Terminal");
  const printerName = identity.card_printer?.trim() || "";
  const printerAddress = identity.card_printer_address?.trim() || "";
  const hasCardPrinter = Boolean(printerName);

  if (hasCardPrinter) {
    return {
      isRegistered,
      hasCardPrinter: true,
      printerName,
      printerAddress,
      locationLabel,
      statusBadgeClass: "bg-success",
      statusTextEn: `Card printer configured: ${printerName}${printerAddress ? ` (${printerAddress})` : ""}`,
      statusTextUr: `کارڈ پرنٹر فعال ہے: ${printerName}${printerAddress ? ` (${printerAddress})` : ""}`,
    };
  }

  if (isRegistered) {
    return {
      isRegistered: true,
      hasCardPrinter: false,
      printerName: "System Default / Fallback",
      printerAddress: "",
      locationLabel,
      statusBadgeClass: "bg-warning text-dark",
      statusTextEn: "No dedicated card printer mapped. Print output will use system default printer or browser dialog.",
      statusTextUr: "کوئی مخصوص کارڈ پرنٹر منسلک نہیں۔ پرنٹ سسٹم کے ڈیفالٹ پرنٹر پر جائے گا۔",
    };
  }

  return {
    isRegistered: false,
    hasCardPrinter: false,
    printerName: "Unregistered Terminal",
    printerAddress: "",
    locationLabel,
    statusBadgeClass: "bg-secondary",
    statusTextEn: "This terminal is not registered in IT Console. Mapped hardware routing is unavailable.",
    statusTextUr: "یہ ٹرمینل آئی ٹی کنسول میں رجسٹرڈ نہیں ہے۔ مخصوص ہارڈ ویئر روٹنگ دستیاب نہیں۔",
  };
}

/**
 * Validates staff employee ID search/lookup input.
 */
export function validateEmployeeIdInput(employeeIdRaw: unknown): {
  valid: boolean;
  employeeId?: number;
  errorEn?: string;
  errorUr?: string;
} {
  if (employeeIdRaw === undefined || employeeIdRaw === null || String(employeeIdRaw).trim() === "") {
    return {
      valid: false,
      errorEn: "Please enter a valid staff Employee ID.",
      errorUr: "براہ کرم عملے کا درست ملازم نمبر درج کریں۔",
    };
  }

  const num = Number(employeeIdRaw);
  if (!Number.isInteger(num) || num <= 0) {
    return {
      valid: false,
      errorEn: "Employee ID must be a positive integer.",
      errorUr: "ملازم کا شناختی نمبر ایک مثبت عدد ہونا چاہیے۔",
    };
  }

  return {
    valid: true,
    employeeId: num,
  };
}

/**
 * Formats card dimensions string from mm array.
 */
export function formatCardSize(cardSizeMm?: number[] | null): string {
  if (Array.isArray(cardSizeMm) && cardSizeMm.length >= 2) {
    return `${cardSizeMm[0].toFixed(1)}mm × ${cardSizeMm[1].toFixed(1)}mm (CR80 Standard)`;
  }
  return "85.6mm × 54.0mm (CR80 Standard)";
}

/**
 * Bilingual error dictionary for Screen 147 id_card.
 */
export const ID_CARD_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  VALIDATION_ERROR: {
    en: "The ID card request is invalid. Please verify the staff employee identifier.",
    ur: "شناختی کارڈ کی درخواست غلط ہے۔ براہ کرم ملازم کی معلومات کی تصدیق کریں۔",
  },
  FORBIDDEN: {
    en: "Permission denied: 'hr.idcard.print' permission is required to design and print staff ID cards.",
    ur: "رسائی مسترد: عملے کے شناختی کارڈ پرنٹ کرنے کے لیے 'hr.idcard.print' اجازت نامہ لازمی ہے۔",
  },
  NOT_FOUND: {
    en: "Employee record not found. Please verify the staff employee ID.",
    ur: "ملازم کا ریکارڈ نہیں ملا۔ براہ کرم ملازم کے شناختی نمبر کی تصدیق کریں۔",
  },
  PRINTER_OFFLINE: {
    en: "The mapped card printer appears offline or unreachable. Please check network connection and power.",
    ur: "منسلک کارڈ پرنٹر آف لائن ہے۔ براہ کرم پاور اور نیٹ ورک کیبل کی تصدیق کریں۔",
  },
  PRINT_FAILED: {
    en: "Print dispatch failed. Printing is separate from employee data: you may reprint safely without redoing changes.",
    ur: "پرنٹ ناکام رہا۔ پرنٹنگ ڈیٹا کی تبدیلی سے علیحدہ عمل ہے: آپ دوبارہ پرنٹ کرنے کی کوشش کر سکتے ہیں۔",
  },
  NETWORK_ERROR: {
    en: "Network communication failure connecting to Haspataal server.",
    ur: "ہسپتال سرور سے رابطہ قائم نہیں ہو سکا۔ نیٹ ورک کی خرابی۔",
  },
};
