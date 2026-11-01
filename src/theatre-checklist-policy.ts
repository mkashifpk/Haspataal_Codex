import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  ChecklistItemOut,
  ChecklistItemIn,
  ChecklistItemUpdateIn,
} from "./generated/theatre_checklist_setup";

export interface ClinicalUser {
  id?: number;
  username?: string;
  user_id?: number;
  role?: string;
  roles?: string[];
  permissions?: string[];
  token?: string;
}

export type ChecklistPhase = "SignIn" | "TimeOut" | "SignOut";

export const PHASE_CONFIG: Record<
  ChecklistPhase,
  {
    en: string;
    ur: string;
    descriptionEn: string;
    descriptionUr: string;
    timingEn: string;
    timingUr: string;
    badgeClass: string;
  }
> = {
  SignIn: {
    en: "Sign In",
    ur: "سائن اِن",
    descriptionEn: "Before induction of anaesthesia, with at least nurse and anaesthetist",
    descriptionUr: "اینستھیزیا دینے سے پہلے، کم از کم نرس اور اینستھیٹسٹ کی موجودگی میں",
    timingEn: "Before induction",
    timingUr: "بے ہوشی سے پہلے",
    badgeClass: "badge-primary",
  },
  TimeOut: {
    en: "Time Out",
    ur: "ٹائم آؤٹ (جراحی وقفہ)",
    descriptionEn: "Before skin incision, with entire surgical team (surgeon, anaesthetist, nurse)",
    descriptionUr: "چیرا لگانے سے پہلے، پوری سرجیکل ٹیم (سرجن، اینستھیٹسٹ اور نرس) کے ساتھ",
    timingEn: "Before skin incision",
    timingUr: "چیرے سے پہلے",
    badgeClass: "badge-warning",
  },
  SignOut: {
    en: "Sign Out",
    ur: "سائن آؤٹ",
    descriptionEn: "Before patient leaves operating theatre, with nurse, anaesthetist and surgeon",
    descriptionUr: "مریض کے آپریشن تھیٹر سے نکلنے سے پہلے، نرس، اینستھیٹسٹ اور سرجن کی موجودگی میں",
    timingEn: "Before leaving theatre",
    timingUr: "تھیٹر چھوڑنے سے پہلے",
    badgeClass: "badge-success",
  },
};

/**
 * Evaluates the runtime screen view for theatre_checklist_setup based on GET /establishment
 * Rule: 9c5c94d2a1
 */
export function evaluateChecklistSetupView(establishment?: EstablishmentOut | null): {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  banner?: string;
  canConfigure: boolean;
  isReadOnly: boolean;
} {
  const screens = establishment?.views?.screens || [];
  const screenView =
    screens.find((s: { screen_id: string; view: string }) => s.screen_id === "theatre_checklist_setup")
      ?.view || "full";

  switch (screenView) {
    case "open_work":
      return {
        view: "open_work",
        banner: "No new checklist items or policy updates from now on (Surgery service is Retiring)",
        canConfigure: false,
        isReadOnly: false,
      };
    case "records":
      return {
        view: "records",
        banner: "Records view: surgical safety checklist read-only (Surgery service is Retired)",
        canConfigure: false,
        isReadOnly: true,
      };
    case "setup":
      return {
        view: "setup",
        banner: "Setup mode: configure surgical safety checklist before surgery service activation",
        canConfigure: true,
        isReadOnly: false,
      };
    case "hidden":
      return {
        view: "hidden",
        canConfigure: false,
        isReadOnly: true,
      };
    case "full":
    default:
      return {
        view: "full",
        canConfigure: true,
        isReadOnly: false,
      };
  }
}

/**
 * Permission checks for theatre checklist setup
 */
export function canConfigureChecklist(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("ot.checklist.configure");
}

export function canViewChecklist(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.some((p: string) =>
    ["ot.clinical.view", "ot.checklist.record", "ot.checklist.configure"].includes(p)
  );
}

export function canViewTheatrePolicy(user?: ClinicalUser | null): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.some((p: string) =>
    ["ot.clinical.view", "ot.checklist.configure", "ot.privilege.manage"].includes(p)
  );
}

/**
 * Sorts checklist items by phase and sort_order
 */
export function sortChecklistItems(items: ChecklistItemOut[]): ChecklistItemOut[] {
  const phaseOrder: Record<ChecklistPhase, number> = {
    SignIn: 1,
    TimeOut: 2,
    SignOut: 3,
  };

  return [...items].sort((a, b) => {
    if (phaseOrder[a.phase] !== phaseOrder[b.phase]) {
      return phaseOrder[a.phase] - phaseOrder[b.phase];
    }
    return a.sort_order - b.sort_order;
  });
}

/**
 * Validates adding a new checklist item (POST /ot/checklist-items)
 */
export function validateChecklistItemIn(input: Partial<ChecklistItemIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.phase || !["SignIn", "TimeOut", "SignOut"].includes(input.phase)) {
    errors.phase = "Checklist phase (SignIn, TimeOut, SignOut) is required.";
  }

  if (!input.prompt || input.prompt.trim().length < 3) {
    errors.prompt = "Prompt text must be at least 3 characters.";
  } else if (input.prompt.length > 500) {
    errors.prompt = "Prompt text cannot exceed 500 characters.";
  }

  if (input.kind && !["Confirm", "Question"].includes(input.kind)) {
    errors.kind = "Item kind must be 'Confirm' or 'Question'.";
  }

  if (input.note_when && !["Yes", "No"].includes(input.note_when)) {
    errors.note_when = "Note required condition must be 'Yes' or 'No'.";
  }

  if (input.sort_order !== undefined && input.sort_order !== null) {
    if (isNaN(input.sort_order) || input.sort_order < 0) {
      errors.sort_order = "Sort order must be a non-negative integer.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates updating or retiring a checklist item (PATCH /ot/checklist-items/{id})
 */
export function validateChecklistItemUpdate(input: Partial<ChecklistItemUpdateIn>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (input.prompt !== undefined && input.prompt !== null) {
    if (input.prompt.trim().length < 3) {
      errors.prompt = "Prompt text must be at least 3 characters.";
    } else if (input.prompt.length > 500) {
      errors.prompt = "Prompt text cannot exceed 500 characters.";
    }
  }

  if (input.sort_order !== undefined && input.sort_order !== null) {
    if (isNaN(input.sort_order) || input.sort_order < 0) {
      errors.sort_order = "Sort order must be a non-negative integer.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Explains domain error codes in clear bilingual text
 */
export function explainChecklistSetupError(err: unknown): {
  code: string;
  message: string;
  messageUr: string;
  action: string;
  actionUr: string;
} {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let code = "UNKNOWN_ERROR";

  const match = rawMsg.match(
    /\b(CHECKLIST_ITEM_EXISTS|CHECKLIST_ITEM_IN_USE|VERSION_CONFLICT|FORBIDDEN|VALIDATION_ERROR)\b/
  );
  if (match) {
    code = match[1];
  }

  switch (code) {
    case "CHECKLIST_ITEM_EXISTS":
      return {
        code,
        message: "A checklist item with this prompt already exists in this phase.",
        messageUr: "اس مرحلے میں اس عبارت کا چیک لسٹ آئٹم پہلے سے موجود ہے۔",
        action: "Modify the wording or edit the existing item rather than duplicating it.",
        actionUr: "عبارت میں تبدیلی کریں یا ڈپلیکیٹ بنانے کے بجائے موجودہ آئٹم میں ترمیم کریں۔",
      };
    case "CHECKLIST_ITEM_IN_USE":
      return {
        code,
        message: "This item has already been recorded in surgical pauses: retire it instead (Rule dfc29fbd11).",
        messageUr: "یہ آئٹم پہلے سے سرجیکل ریکارڈز میں درج ہو چکا ہے: اسے ڈیلیٹ کرنے کے بجائے ریٹائر کریں (قاعدہ dfc29fbd11)۔",
        action: "Uncheck 'Active' to retire the item without corrupting past surgical pauses.",
        actionUr: "ماضی کے جراحی ریکارڈز کو محفوظ رکھنے کے لیے 'ایکٹو' ان چیک کر کے ریٹائر کریں۔",
      };
    case "VERSION_CONFLICT":
      return {
        code,
        message: "This checklist item was modified by another administrator.",
        messageUr: "اس چیک لسٹ آئٹم کو کسی دوسرے ایڈمن نے تبدیل کر دیا ہے۔",
        action: "Reloading latest checklist state to prevent conflicting overwrites.",
        actionUr: "تازہ ترین حالت لوڈ کی جا رہی ہے تاکہ متضاد تبدیلیوں سے بچا جا سکے۔",
      };
    case "FORBIDDEN":
      return {
        code,
        message: "You do not have permission to configure the surgical safety checklist.",
        messageUr: "آپ کے پاس سرجیکل سیفٹی چیک لسٹ کی ترتیب و ترمیم کی اجازت نہیں ہے۔",
        action: "Contact the Operating Theatre Administrator or Hospital Director.",
        actionUr: "آپریشن تھیٹر ایڈمنسٹریٹر یا ہسپتال ڈائریکٹر سے رابطہ کریں۔",
      };
    case "VALIDATION_ERROR":
      return {
        code,
        message: "The submitted checklist item form contains invalid data.",
        messageUr: "فارم میں فراہم کردہ معلومات درست نہیں ہیں۔",
        action: "Check text lengths and required fields.",
        actionUr: "متن کی طوالت اور لازمی خانے چیک کریں۔",
      };
    default:
      return {
        code: "UNEXPECTED_ERROR",
        message: rawMsg || "An unexpected error occurred while processing the checklist item.",
        messageUr: "چیک لسٹ کی پروسیسنگ کے دوران غیر متوقع خرابی پیش آئی۔",
        action: "Check server connection and retry.",
        actionUr: "کنکشن چیک کریں اور دوبارہ کوشش کریں۔",
      };
  }
}
