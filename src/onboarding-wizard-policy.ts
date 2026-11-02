/**
 * Domain policy and business rules for Staff Onboarding & Credentials Wizard (Screen 143, workspace: hr).
 * Statutory Rules:
 * - rule:adc6619db9: Step 6 never creates a login — it hands over to IT (status Awaiting_IT_Provisioning).
 * - rule:c1f853fceb: Grey out Submit until GET /hr/employees/{id}.checklist.ready is true.
 * - rule:44d2ead844: Upload files as multipart/form-data (file + doc_type + optional title); only paths stored in DB.
 * - rule:511519d15c: Documents are PDF, JPEG or PNG; Photo (ID card) is JPEG/PNG only, max 16MP.
 * - rule:cd04ca0d57: Step 4 Visiting OT split contract is configured by Billing Admin in billing_admin; wizard never sends it.
 */

import type {
  EmployeeIn,
  Step1In,
  Step2In,
  Step3In,
  QualificationIn,
  EmployeeDetailOut,
} from "./generated/onboarding_wizard.ts";

export type OnboardingWizardCapabilityMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface OnboardingWizardCapabilityView {
  mode: OnboardingWizardCapabilityMode;
  canCreate: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canSubmit: boolean;
  noticeEn?: string;
  noticeUr?: string;
}

export function getOnboardingWizardCapabilityView(establishment?: any): OnboardingWizardCapabilityView {
  const screens: string[] = establishment?.views?.screens || [];
  const hasOnboarding = screens.length === 0 || screens.includes("onboarding_wizard");

  if (!hasOnboarding) {
    return {
      mode: "hidden",
      canCreate: false,
      canEdit: false,
      canUpload: false,
      canSubmit: false,
      noticeEn: "Staff onboarding wizard is unavailable in current facility capabilities.",
      noticeUr: "موجودہ سہولت کی صلاحیتوں میں عملہ آن بورڈنگ وزرڈ دستیاب نہیں ہے۔",
    };
  }

  // Capability restrictions from establishment setup
  const isSetupOnly = Boolean(establishment?.views?.setup_only);
  const isRecordsOnly = Boolean(establishment?.views?.records_only);
  const isOpenWorkOnly = Boolean(establishment?.views?.open_work_only);

  if (isRecordsOnly) {
    return {
      mode: "records",
      canCreate: false,
      canEdit: false,
      canUpload: false,
      canSubmit: false,
      noticeEn: "Records View Mode: Viewing existing employee profiles only; new employee creation is disabled.",
      noticeUr: "صرف ریکارڈ موڈ: صرف موجودہ ملازمین کے پروفائلز دیکھے جا سکتے ہیں؛ نیا ملازم بنانا غیر فعال ہے۔",
    };
  }

  if (isOpenWorkOnly) {
    return {
      mode: "open_work",
      canCreate: false,
      canEdit: true,
      canUpload: true,
      canSubmit: true,
      noticeEn: "Restricted Mode: Finalizing in-progress onboarding drafts; new employee registrations are restricted.",
      noticeUr: "محدود موڈ: جاری آن بورڈنگ ڈرافٹس کو حتمی شکل دی جا رہی ہے؛ نئے ملازمین کی رجسٹریشن محدود ہے۔",
    };
  }

  if (isSetupOnly) {
    return {
      mode: "setup",
      canCreate: true,
      canEdit: true,
      canUpload: true,
      canSubmit: true,
      noticeEn: "Setup Mode: Initial human resource personnel configuration active.",
      noticeUr: "سیٹ اپ موڈ: ابتدائی افرادی قوت اور عملے کی تشکیل فعال ہے۔",
    };
  }

  return {
    mode: "full",
    canCreate: true,
    canEdit: true,
    canUpload: true,
    canSubmit: true,
  };
}

/** Format CNIC as 00000-0000000-0 */
export function formatCnic(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** Standard CNIC validation: exactly 13 digits */
export function isValidCnic(cnic: string): boolean {
  const digits = cnic.replace(/\D/g, "");
  return digits.length === 13;
}

/** Pakistan mobile number validation: 03XX-XXXXXXX or 11 digits */
export function isValidPakMobile(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(03\d{9}|\+923\d{9}|923\d{9})$/.test(cleaned);
}

/** Standard email validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface ValidationErrorResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates Demographics (Step 1)
 * CNIC is strictly required for employees per MSDS HRM regulations.
 */
export function validateStep1Input(body: Record<string, any>): ValidationErrorResult {
  const errors: Record<string, string> = {};

  if (!body.full_name || body.full_name.trim().length < 3) {
    errors.full_name = "Full name is required (minimum 3 characters).";
  }

  if (!body.cnic || !isValidCnic(body.cnic)) {
    errors.cnic = "Valid 13-digit CNIC is strictly mandatory for staff onboarding.";
  }

  if (!body.mobile || !isValidPakMobile(body.mobile)) {
    errors.mobile = "Valid 11-digit Pakistan mobile number is required (03XX-XXXXXXX).";
  }

  if (body.email && !isValidEmail(body.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (body.dob) {
    const dobDate = new Date(body.dob);
    const now = new Date();
    if (isNaN(dobDate.getTime()) || dobDate >= now) {
      errors.dob = "Date of birth must be a valid past date.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Job & Finance Taxonomy (Step 2)
 */
export function validateStep2Input(body: Record<string, any>, currentEmployeeId?: number): ValidationErrorResult {
  const errors: Record<string, string> = {};

  if (!body.designation || body.designation.trim().length === 0) {
    errors.designation = "Designation/job title is required.";
  }

  if (body.base_salary !== undefined && body.base_salary !== null && body.base_salary !== "") {
    const salary = Number(body.base_salary);
    if (isNaN(salary) || salary < 0) {
      errors.base_salary = "Base salary must be a non-negative number.";
    }
  }

  // Prevent immediate self-supervision cycle (CYCLE_DETECTED)
  if (currentEmployeeId && body.supervisor_id && Number(body.supervisor_id) === currentEmployeeId) {
    errors.supervisor_id = "An employee cannot be their own supervisor (reporting hierarchy cycle).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Professional Licensing (Step 3)
 */
export function validateStep3Input(body: Record<string, any>, isClinical: boolean): ValidationErrorResult {
  const errors: Record<string, string> = {};

  if (isClinical) {
    if (!body.license_type) {
      errors.license_type = "Licensing body (PMDC / PNC / Other) is required for clinical staff.";
    }
    if (!body.license_number || body.license_number.trim().length === 0) {
      errors.license_number = "Valid medical/nursing licence registration number is mandatory.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Qualification Entry
 */
export function validateQualificationInput(body: Record<string, any>): ValidationErrorResult {
  const errors: Record<string, string> = {};

  if (!body.qualification_type) {
    errors.qualification_type = "Qualification type is required.";
  }

  if (!body.title || body.title.trim().length === 0) {
    errors.title = "Degree/diploma/certification title is required.";
  }

  if (body.year !== undefined && body.year !== null) {
    const currentYear = new Date().getFullYear();
    if (isNaN(body.year) || body.year < 1950 || body.year > currentYear) {
      errors.year = `Graduation year must be between 1950 and ${currentYear}.`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Allowed MIME types per Rule rule:511519d15c */
export const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
];

export const MAX_DOC_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
export const MAX_PHOTO_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

/**
 * Validates Document Vault upload file per Rule rule:44d2ead844 and rule:511519d15c
 */
export function validateDocumentFile(
  file: { name?: string; type?: string; size?: number },
  docType: string
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "Please select a file to upload." };
  }

  const mimeType = (file.type || "").toLowerCase();
  const fileName = (file.name || "").toLowerCase();

  // Photo must be JPEG or PNG only (PDF is forbidden for photo)
  if (docType === "Photo") {
    const isJpegOrPng =
      ALLOWED_PHOTO_TYPES.includes(mimeType) ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png");

    if (!isJpegOrPng) {
      return {
        valid: false,
        error: "Staff ID card Photo must be JPEG or PNG only. PDFs or unsupported formats are rejected (UNSUPPORTED_MEDIA_TYPE).",
      };
    }

    if (file.size && file.size > MAX_PHOTO_FILE_SIZE) {
      return {
        valid: false,
        error: "Photo size exceeds 8MB limit. High resolution photos must be under 16 megapixels.",
      };
    }

    return { valid: true };
  }

  // Other documents: PDF, JPEG, PNG
  const isAllowed =
    ALLOWED_DOC_TYPES.includes(mimeType) ||
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png");

  if (!isAllowed) {
    return {
      valid: false,
      error: "Uploaded document must be PDF, JPEG, or PNG format.",
    };
  }

  if (file.size && file.size > MAX_DOC_FILE_SIZE) {
    return {
      valid: false,
      error: "Document file size exceeds maximum 15MB limit.",
    };
  }

  return { valid: true };
}

/**
 * Evaluates whether Submit action can proceed per Rule rule:c1f853fceb
 * Grey out Submit until GET /hr/employees/{id}.checklist.ready is true.
 */
export function canSubmitEmployeeProfile(
  employee: EmployeeDetailOut | null
): { canSubmit: boolean; reasonEn?: string; reasonUr?: string } {
  if (!employee) {
    return {
      canSubmit: false,
      reasonEn: "No employee profile loaded.",
      reasonUr: "کوئی ملازم پروفائل لوڈ نہیں ہوئی۔",
    };
  }

  if (employee.employment_status !== "Draft") {
    return {
      canSubmit: false,
      reasonEn: `Profile is in '${employee.employment_status}' status. Only Draft profiles can be finalized.`,
      reasonUr: `پروفائل '${employee.employment_status}' حالت میں ہے۔ صرف ڈرافٹ پروفائلز حتمی کی جا سکتی ہیں۔`,
    };
  }

  if (!employee.checklist?.ready) {
    const missingItems = employee.checklist?.missing?.join(", ") || "Mandatory documentation";
    return {
      canSubmit: false,
      reasonEn: `Onboarding incomplete. Required items missing: ${missingItems}`,
      reasonUr: `آن بورڈنگ نامکمل ہے۔ ضروری دستاویزات غیر حاضر: ${missingItems}`,
    };
  }

  return { canSubmit: true };
}

/**
 * Standard Bilingual Error Messages
 */
export const ONBOARDING_WIZARD_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string }
> = {
  CNIC_ALREADY_EXISTS: {
    en: "An employee with this CNIC already exists in the personnel directory.",
    ur: "اس قومی شناختی کارڈ کا حامل ملازم پہلے سے عملہ ڈائریکٹری میں موجود ہے۔",
  },
  EMPLOYEE_DOCUMENT_REQUIRED: {
    en: "Mandatory employee document missing (CNIC document and photo are compulsory).",
    ur: "لازمی ملازم دستاویز غیر حاضر ہے (شناختی کارڈ اور تصویر ضروری ہیں)۔",
  },
  CLINICAL_LICENSE_REQUIRED: {
    en: "Valid clinical registration licence (PMDC / PNC) is mandatory for medical/nursing staff.",
    ur: "طبی و نرسنگ عملے کے لیے پی ایم ڈی سی / پی این سی رجسٹریشن لازمی ہے۔",
  },
  CYCLE_DETECTED: {
    en: "Circular reporting hierarchy detected: an employee cannot report to themselves or a subordinate.",
    ur: "دائرہ دار رپورٹنگ کا پتہ چلا: ملازم خود کو یا ماتحت کو رپورٹ نہیں کر سکتا۔",
  },
  EMPLOYEE_STATUS_INVALID: {
    en: "Operation not permitted on current employment status.",
    ur: "موجودہ ملازمت کی حیثیت پر یہ کارروائی ممنوع ہے۔",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    en: "Unsupported document format. Employee photo must be JPEG or PNG; documents PDF, JPEG or PNG.",
    ur: "غیر معاون فائل فارمیٹ۔ ملازم کی تصویر صرف جے پی ای جی یا پی این جی ہونی چاہیے۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to execute this onboarding action.",
    ur: "آپ کے پاس اس آن بورڈنگ کارروائی کے مطلوبہ اختیارات نہیں ہیں۔",
  },
  VALIDATION_ERROR: {
    en: "Validation error: please verify all highlighted fields.",
    ur: "تصدیقی خرابی: براہ کرم تمام نمایاں فیلڈز کی جانچ کریں۔",
  },
  NOT_FOUND: {
    en: "The requested employee profile was not found.",
    ur: "مطلوبہ ملازم کی پروفائل نہیں ملی۔",
  },
};
