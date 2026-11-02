/**
 * Domain policy and statutory business rules for Screen 133: accountant_cockpit
 * ("Accountant 3-pane cockpit", Position 133, 83 points, Workspace `finance_accountant`).
 * 
 * Statutory & Quality Rules:
 * - rule:8c0db74e85: A cash drop, or the settlement of a payable whose total is, at or above
 *   large_cash_settlement_threshold (GET /meta/settings) needs a second, different person:
 *   show second_approver_username/_password before the first attempt, however small the part paid.
 * - rule:1109b23ad9: Variance creates a review item automatically.
 * - rule:7cc7842e8a: Cash drop: count the whole drawer, the opening float included, against
 *   expected_cash; the drop takes all of it to the main vault.
 * - rule:465292d1b4: Returns to suppliers awaiting a credit note (GET /pharmacy-admin/supplier-returns?status=Returned):
 *   confirm the credit note (number, date, amount) or record the refusal with its reason; the person who returned
 *   the goods cannot (DUAL_CONTROL_SAME_PERSON). A Credited return's credit_left pays that supplier's bills:
 *   Settle with method SupplierCredit and its supplier_return_id (SUPPLIER_CREDIT_UNAVAILABLE beyond it).
 */

import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  CashShiftListItemOut,
  CashShiftSummaryOut,
  PayableQueueItemOut,
  SupplierReturnOut,
  CashDropIn,
  SettleApIn,
  SupplierCreditIn,
  SupplierRefusalIn,
} from "./generated/accountant_cockpit";

export type AccountantCockpitCapabilityView = "full" | "open_work" | "records" | "setup" | "hidden";

export const DEFAULT_LARGE_CASH_THRESHOLD = 100000;

export interface DualApproverValidationResult {
  valid: boolean;
  errorCode?: "DUAL_CONTROL_REQUIRED" | "DUAL_CONTROL_SAME_PERSON" | "VALIDATION_ERROR";
  messageEn?: string;
  messageUr?: string;
}

export interface CashDropValidationResult {
  valid: boolean;
  variance: number;
  hasVariance: boolean;
  requiresDualApproval: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface ApSettlementValidationResult {
  valid: boolean;
  settleAmount: number;
  requiresDualApproval: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface SupplierCreditValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface SupplierRefusalValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Resolves capability view for accountant_cockpit from establishment configuration.
 */
export function getAccountantCockpitCapabilityView(
  establishment?: EstablishmentOut | null
): AccountantCockpitCapabilityView {
  if (!establishment) return "full";

  const screens = establishment.views?.screens;
  if (Array.isArray(screens)) {
    const screenEntry = screens.find((s) => s.screen_id === "accountant_cockpit");
    if (
      screenEntry?.view === "full" ||
      screenEntry?.view === "open_work" ||
      screenEntry?.view === "records" ||
      screenEntry?.view === "setup" ||
      screenEntry?.view === "hidden"
    ) {
      return screenEntry.view;
    }
  } else if (screens && typeof screens === "object") {
    const configured = (screens as Record<string, { view?: string }>)?.["accountant_cockpit"]?.view;
    if (
      configured === "full" ||
      configured === "open_work" ||
      configured === "records" ||
      configured === "setup" ||
      configured === "hidden"
    ) {
      return configured as AccountantCockpitCapabilityView;
    }
  }

  return "full";
}

/**
 * Determines whether dual approval is required for a cash drop under rule:8c0db74e85.
 * A drop amount at or above large_cash_settlement_threshold requires co-signature.
 */
export function isDualApprovalRequiredForCashDrop(
  amount: number | string,
  threshold: number = DEFAULT_LARGE_CASH_THRESHOLD
): boolean {
  const num = Number(amount);
  if (isNaN(num)) return false;
  return num >= threshold;
}

/**
 * Determines whether dual approval is required for AP settlement under rule:8c0db74e85.
 * "the settlement of a payable whose total is, at or above large_cash_settlement_threshold
 * needs a second, different person: show second_approver_username/_password before the first attempt,
 * however small the part paid."
 */
export function isDualApprovalRequiredForApSettlement(
  payableTotalAmount: number | string,
  threshold: number = DEFAULT_LARGE_CASH_THRESHOLD
): boolean {
  const total = Number(payableTotalAmount);
  if (isNaN(total)) return false;
  return total >= threshold;
}

/**
 * Validates dual approver credentials for co-signing under rule:8c0db74e85.
 */
export function validateDualApprover(
  currentUsername: string,
  secondUsername?: string | null,
  secondPassword?: string | null
): DualApproverValidationResult {
  const second = (secondUsername || "").trim();
  const pass = (secondPassword || "").trim();

  if (!second || !pass) {
    return {
      valid: false,
      errorCode: "DUAL_CONTROL_REQUIRED",
      messageEn: "Second approver username and password are required.",
      messageUr: "دوسرے منظوری دینے والے کا صارف نام اور پاس ورڈ درکار ہے۔",
    };
  }

  if (second.toLowerCase() === currentUsername.trim().toLowerCase()) {
    return {
      valid: false,
      errorCode: "DUAL_CONTROL_SAME_PERSON",
      messageEn: "The second approver must be a different person.",
      messageUr: "دوسرا منظوری دینے والا مختلف شخص ہونا ضروری ہے۔",
    };
  }

  return { valid: true };
}

/**
 * Validates cash drop submission under rule:7cc7842e8a, rule:1109b23ad9, rule:8c0db74e85.
 */
export function validateCashDrop(
  shift: CashShiftSummaryOut | CashShiftListItemOut,
  input: CashDropIn,
  currentUser: { username: string; user_id?: number },
  threshold: number = DEFAULT_LARGE_CASH_THRESHOLD
): CashDropValidationResult {
  if (shift.status !== "PendingCollection") {
    return {
      valid: false,
      variance: 0,
      hasVariance: false,
      requiresDualApproval: false,
      errorCode: "SHIFT_NOT_PENDING_COLLECTION",
      errorMessage: "The shift is not waiting for its cash drop (must be PendingCollection: close it first).",
    };
  }

  const counted = Number(input.counted_cash);
  if (isNaN(counted) || counted < 0) {
    return {
      valid: false,
      variance: 0,
      hasVariance: false,
      requiresDualApproval: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Counted cash amount must be a non-negative number.",
    };
  }

  const expected = Number(shift.expected_cash || 0);
  const variance = counted - expected;
  const hasVariance = Math.abs(variance) > 0.001;

  const requiresDual = isDualApprovalRequiredForCashDrop(counted, threshold);
  if (requiresDual) {
    const dualCheck = validateDualApprover(
      currentUser.username,
      input.second_approver_username,
      input.second_approver_password
    );
    if (!dualCheck.valid) {
      return {
        valid: false,
        variance,
        hasVariance,
        requiresDualApproval: true,
        errorCode: dualCheck.errorCode,
        errorMessage: dualCheck.messageEn,
      };
    }
  }

  return {
    valid: true,
    variance,
    hasVariance,
    requiresDualApproval: requiresDual,
  };
}

/**
 * Validates Accounts Payable settlement under rule:8c0db74e85 and rule:465292d1b4.
 */
export function validateApSettlement(
  payable: PayableQueueItemOut,
  input: SettleApIn,
  currentUser: { username: string; user_id?: number },
  returnsList: SupplierReturnOut[] = [],
  threshold: number = DEFAULT_LARGE_CASH_THRESHOLD
): ApSettlementValidationResult {
  if (payable.status !== "Approved" && payable.status !== "PartiallySettled") {
    return {
      valid: false,
      settleAmount: 0,
      requiresDualApproval: false,
      errorCode: "AP_NOT_SETTLEABLE",
      errorMessage: "This payable cannot be settled now (must be Approved or PartiallySettled).",
    };
  }

  const openBalance = Number(payable.balance ?? (payable.amount - payable.amount_paid));
  const settleAmount = input.amount !== undefined && input.amount !== null && input.amount !== ""
    ? Number(input.amount)
    : openBalance;

  if (isNaN(settleAmount) || settleAmount <= 0) {
    return {
      valid: false,
      settleAmount: 0,
      requiresDualApproval: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Settlement amount must be greater than zero.",
    };
  }

  if (settleAmount > openBalance + 0.001) {
    return {
      valid: false,
      settleAmount,
      requiresDualApproval: false,
      errorCode: "AP_OVERPAYMENT",
      errorMessage: "Settlement exceeds the outstanding payable.",
    };
  }

  // Supplier Credit check per rule:465292d1b4
  if (input.method === "SupplierCredit") {
    if (!input.supplier_return_id) {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: false,
        errorCode: "SUPPLIER_CREDIT_UNAVAILABLE",
        errorMessage: "Supplier credit settlement requires selecting a confirmed supplier return note.",
      };
    }

    const ret = returnsList.find((r) => r.return_id === input.supplier_return_id);
    if (!ret) {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: false,
        errorCode: "SUPPLIER_CREDIT_UNAVAILABLE",
        errorMessage: "The specified supplier return was not found.",
      };
    }

    if (ret.status !== "Credited") {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: false,
        errorCode: "SUPPLIER_CREDIT_UNAVAILABLE",
        errorMessage: "This return is not in Credited status.",
      };
    }

    if (payable.payee_vendor_id && ret.vendor_id !== payable.payee_vendor_id) {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: false,
        errorCode: "SUPPLIER_CREDIT_UNAVAILABLE",
        errorMessage: "This credit note belongs to a different supplier.",
      };
    }

    const availableCredit = Number(ret.credit_left ?? 0);
    if (availableCredit < settleAmount - 0.001) {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: false,
        errorCode: "SUPPLIER_CREDIT_UNAVAILABLE",
        errorMessage: `Insufficient credit left on this return note (Available: PKR ${availableCredit.toLocaleString()}, Required: PKR ${settleAmount.toLocaleString()}).`,
      };
    }
  }

  // Dual approver check per rule:8c0db74e85 (based on payable total amount)
  const requiresDual = isDualApprovalRequiredForApSettlement(payable.amount, threshold);
  if (requiresDual) {
    const dualCheck = validateDualApprover(
      currentUser.username,
      input.second_approver_username,
      input.second_approver_password
    );
    if (!dualCheck.valid) {
      return {
        valid: false,
        settleAmount,
        requiresDualApproval: true,
        errorCode: dualCheck.errorCode,
        errorMessage: dualCheck.messageEn,
      };
    }
  }

  return {
    valid: true,
    settleAmount,
    requiresDualApproval: requiresDual,
  };
}

/**
 * Validates Supplier Credit note confirmation under rule:465292d1b4.
 */
export function validateSupplierCreditConfirmation(
  ret: SupplierReturnOut,
  input: SupplierCreditIn,
  currentUser: { username: string; user_id?: number; name?: string }
): SupplierCreditValidationResult {
  if (ret.status !== "Returned") {
    return {
      valid: false,
      errorCode: "SUPPLIER_RETURN_STATE_INVALID",
      errorMessage: "This return is not awaiting a credit note (must be status Returned).",
    };
  }

  // Dual control check: person who returned the goods cannot confirm credit
  const returnedBy = (ret.returned_by_name || "").trim().toLowerCase();
  const currentName = (currentUser.name || currentUser.username || "").trim().toLowerCase();
  if (returnedBy && currentName && returnedBy === currentName) {
    return {
      valid: false,
      errorCode: "DUAL_CONTROL_SAME_PERSON",
      errorMessage: "The person who returned the goods cannot confirm or refuse the credit note (DUAL_CONTROL_SAME_PERSON).",
    };
  }

  if (!input.credit_note_no || !input.credit_note_no.trim()) {
    return {
      valid: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Credit note number is required.",
    };
  }

  if (!input.credit_note_date || !input.credit_note_date.trim()) {
    return {
      valid: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Credit note date is required.",
    };
  }

  const creditAmt = Number(input.credit_amount);
  if (isNaN(creditAmt) || creditAmt <= 0) {
    return {
      valid: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "Credit amount must be greater than zero.",
    };
  }

  return { valid: true };
}

/**
 * Validates Supplier Return refusal under rule:465292d1b4.
 */
export function validateSupplierRefusal(
  ret: SupplierReturnOut,
  input: SupplierRefusalIn,
  currentUser: { username: string; user_id?: number; name?: string }
): SupplierRefusalValidationResult {
  if (ret.status !== "Returned") {
    return {
      valid: false,
      errorCode: "SUPPLIER_RETURN_STATE_INVALID",
      errorMessage: "This return is not awaiting a decision (must be status Returned).",
    };
  }

  // Dual control check: person who returned the goods cannot refuse credit
  const returnedBy = (ret.returned_by_name || "").trim().toLowerCase();
  const currentName = (currentUser.name || currentUser.username || "").trim().toLowerCase();
  if (returnedBy && currentName && returnedBy === currentName) {
    return {
      valid: false,
      errorCode: "DUAL_CONTROL_SAME_PERSON",
      errorMessage: "The person who returned the goods cannot confirm or refuse the credit note (DUAL_CONTROL_SAME_PERSON).",
    };
  }

  if (!input.note || !input.note.trim()) {
    return {
      valid: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: "A refusal reason/note is required to write off the return claim.",
    };
  }

  return { valid: true };
}

/**
 * Statutory error code descriptions dictionary matching backend contract.
 */
export const ACCOUNTANT_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  ACCOUNT_LOCKED: {
    en: "Too many failed attempts; the account is temporarily locked.",
    ur: "بہت زیادہ غلط کوششیں؛ اکاؤنٹ عارضی طور پر مقفل ہو چکا ہے۔",
  },
  AP_NOT_SETTLEABLE: {
    en: "This payable cannot be settled now.",
    ur: "یہ واجب الادا رقم فی الوقت ادا نہیں کی جا سکتی۔",
  },
  AP_OVERPAYMENT: {
    en: "Settlement exceeds the outstanding payable.",
    ur: "ادائیگی واجب الادا بقایا رقم سے زیادہ ہے۔",
  },
  DUAL_CONTROL_REQUIRED: {
    en: "A second approver (different person) is required for this amount.",
    ur: "اس رقم کے لیے دوسرے منظور کنندہ (مختلف فرد) کی تصدیق درکار ہے۔",
  },
  DUAL_CONTROL_SAME_PERSON: {
    en: "The second approver must be a different person.",
    ur: "دوسرا منظوری دینے والا مختلف شخص ہونا ضروری ہے۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this.",
    ur: "آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔",
  },
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ur: "درخواست کردہ ریکارڈ نہیں ملا۔",
  },
  SELF_APPROVAL_FORBIDDEN: {
    en: "You cannot approve your own request.",
    ur: "آپ اپنی ہی درخواست کی منظوری نہیں دے سکتے۔",
  },
  SHIFT_NOT_OPEN: {
    en: "Open a cash shift before handling cash.",
    ur: "نقد رقم سنبھالنے سے پہلے کیش شفٹ کھولیں۔",
  },
  SHIFT_NOT_PENDING_COLLECTION: {
    en: "The shift is not waiting for its cash drop (details.status): close it first.",
    ur: "شفٹ کیش ڈراپ کی منتظر نہیں ہے؛ پہلے اسے بند کریں۔",
  },
  STEP_UP_REQUIRED: {
    en: "A second authorised person must co-sign this action.",
    ur: "ایک دوسرے مجاز فرد کا اس کارروائی پر مشترکہ دستخط کرنا لازمی ہے۔",
  },
  SUPPLIER_CREDIT_UNAVAILABLE: {
    en: "This credit note cannot pay that bill: it is not confirmed, belongs to another supplier, or is used up.",
    ur: "یہ کریڈٹ نوٹ اس بل کی ادائیگی نہیں کر سکتا: یہ غیر تصدیق شدہ ہے، دوسرے سپلائر کا ہے یا ختم ہو چکا ہے۔",
  },
  SUPPLIER_RETURN_STATE_INVALID: {
    en: "This return to the supplier cannot change that way: it is recorded once, then credited or refused by another person.",
    ur: "سپلائر کو واپسی کا اسٹیٹس تبدیل نہیں ہو سکتا؛ یہ دوسرے شخص کے ذریعے کریڈٹ یا مسترد ہونا چاہیے۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid.",
    ur: "درخواست کے کوائف درست نہیں ہیں۔",
  },
};
