/**
 * Domain policy and business rules for Screen 156: ops_console
 * (Facility operations 3-pane console: work orders, assets/utilities, live badge feed)
 *
 * Rules:
 * - rule:a7fc19b5fc: Ops/maintenance can raise payables but never pay: completion routes to the Accountant's AP queue.
 */

export interface SessionInfo {
  user_id?: number;
  employee_id?: number | null;
  username?: string;
  roles?: string[];
  permissions?: string[];
}

export interface Establishment {
  services?: Array<{ code: string; status: string }>;
  views?: {
    screens?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface OpsConsoleCapabilityView {
  mode: "full" | "records" | "hidden";
  canManageWorkOrders: boolean;
  canManageAssets: boolean;
  canRecordUtilities: boolean;
  canClearDischarge: boolean;
  canMarkBedCleaned: boolean;
  canViewFeed: boolean;
  reason?: string;
}

/**
 * Resolves capability view based on permissions and establishment profile.
 */
export function getOpsConsoleCapabilityView(
  session: SessionInfo | null,
  establishment?: Establishment | null
): OpsConsoleCapabilityView {
  if (!session || !session.roles) {
    return {
      mode: "hidden",
      canManageWorkOrders: false,
      canManageAssets: false,
      canRecordUtilities: false,
      canClearDischarge: false,
      canMarkBedCleaned: false,
      canViewFeed: false,
      reason: "Authentication required",
    };
  }

  // Check establishment service capability gate if present
  const opsService = establishment?.services?.find((s: any) => s.code === "ops" || s.code === "maintenance");
  if (opsService && opsService.status === "Inactive") {
    return {
      mode: "hidden",
      canManageWorkOrders: false,
      canManageAssets: false,
      canRecordUtilities: false,
      canClearDischarge: false,
      canMarkBedCleaned: false,
      canViewFeed: false,
      reason: "Facility operations service is currently inactive in this facility",
    };
  }

  const permissions = session.permissions || [];
  const roles = session.roles || [];

  const isOpsAdmin = roles.includes("ops_admin") || roles.includes("super_admin") || roles.includes("maintenance_admin");
  const canManageWorkOrders = isOpsAdmin || permissions.includes("ops.workorder.manage");
  const canManageAssets = isOpsAdmin || permissions.includes("ops.asset.manage");
  const canRecordUtilities = isOpsAdmin || permissions.includes("ops.utility.record");
  const canClearDischarge = isOpsAdmin || permissions.includes("ipd.discharge.clear");
  const canMarkBedCleaned = isOpsAdmin || permissions.includes("ipd.bed.mark_cleaned");
  const canViewFeed = isOpsAdmin || permissions.includes("ops.feed.view");

  const canView =
    isOpsAdmin ||
    canManageWorkOrders ||
    canManageAssets ||
    canRecordUtilities ||
    canViewFeed ||
    permissions.includes("ops.workorder.report") ||
    permissions.includes("ops.asset.view");

  if (!canView) {
    return {
      mode: "hidden",
      canManageWorkOrders: false,
      canManageAssets: false,
      canRecordUtilities: false,
      canClearDischarge: false,
      canMarkBedCleaned: false,
      canViewFeed: false,
      reason: "User lacks facility operations permissions",
    };
  }

  if (isOpsAdmin || canManageWorkOrders) {
    return {
      mode: "full",
      canManageWorkOrders: true,
      canManageAssets,
      canRecordUtilities,
      canClearDischarge,
      canMarkBedCleaned,
      canViewFeed,
    };
  }

  return {
    mode: "records",
    canManageWorkOrders: false,
    canManageAssets: false,
    canRecordUtilities: false,
    canClearDischarge: false,
    canMarkBedCleaned,
    canViewFeed,
  };
}

/**
 * Evaluates rule:a7fc19b5fc:
 * Ops/maintenance can raise payables but never pay: completion routes to the Accountant's AP queue.
 */
export function evaluatePayableRouting(
  assignedVendorId: number | null | undefined,
  finalCost: number | null | undefined
): {
  routesToAp: boolean;
  explanationEn: string;
  explanationUr: string;
} {
  const cost = Number(finalCost || 0);
  const isVendorWork = assignedVendorId !== null && assignedVendorId !== undefined && assignedVendorId > 0;

  if (isVendorWork && cost > 0) {
    return {
      routesToAp: true,
      explanationEn: `External contractor payment of Rs. ${cost.toLocaleString()} automatically routes to Accountant AP queue for payment approval (Rule a7fc19b5fc). Ops staff cannot settle funds.`,
      explanationUr: `بیرونی ٹھیکیدار کی ادائیگی روپے ${cost.toLocaleString()} خودکار طور پر اکاؤنٹنٹ کی اے پی قطار میں منظوری کے لیے چلی جائے گی (قاعدہ a7fc19b5fc)۔ آپریشنز عملہ ادائیگی نہیں کر سکتا۔`,
    };
  }

  return {
    routesToAp: false,
    explanationEn: "Internal maintenance work does not incur external accounts payable.",
    explanationUr: "اندرونی دیکھ بھال کے کام کے لیے بیرونی ادائیگی واجب الادا نہیں ہوتی۔",
  };
}

/**
 * Validates work order assignment input.
 */
export function validateAssignForm(
  employeeId?: number | null,
  vendorId?: number | null,
  estimatedCost?: number | string | null
): {
  valid: boolean;
  error?: string;
} {
  const hasEmp = employeeId !== null && employeeId !== undefined && employeeId > 0;
  const hasVendor = vendorId !== null && vendorId !== undefined && vendorId > 0;

  if (!hasEmp && !hasVendor) {
    return {
      valid: false,
      error: "Please assign either an internal employee or an external contractor.",
    };
  }

  if (hasEmp && hasVendor) {
    return {
      valid: false,
      error: "Assign to either an internal employee or external vendor, not both.",
    };
  }

  if (estimatedCost !== undefined && estimatedCost !== null && estimatedCost !== "") {
    const cost = Number(estimatedCost);
    if (isNaN(cost) || cost < 0) {
      return {
        valid: false,
        error: "Estimated cost must be a non-negative number.",
      };
    }
  }

  return { valid: true };
}

/**
 * Validates work order completion input.
 */
export function validateCompleteForm(finalCost?: number | string | null): {
  valid: boolean;
  error?: string;
} {
  if (finalCost !== undefined && finalCost !== null && finalCost !== "") {
    const cost = Number(finalCost);
    if (isNaN(cost) || cost < 0) {
      return {
        valid: false,
        error: "Final cost must be a non-negative number.",
      };
    }
  }
  return { valid: true };
}

/**
 * Validates cancellation reason.
 */
export function validateCancelForm(reason: string): {
  valid: boolean;
  error?: string;
} {
  if (!reason || reason.trim().length < 3) {
    return {
      valid: false,
      error: "Cancellation reason must be at least 3 characters.",
    };
  }
  if (reason.trim().length > 500) {
    return {
      valid: false,
      error: "Cancellation reason cannot exceed 500 characters.",
    };
  }
  return { valid: true };
}

/**
 * Validates asset registration input.
 */
export function validateAssetForm(
  assetTag: string,
  name: string,
  category: string
): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!assetTag || !assetTag.trim()) {
    errors.asset_tag = "Asset tag is required.";
  } else if (assetTag.trim().length < 2) {
    errors.asset_tag = "Asset tag must be at least 2 characters.";
  }

  if (!name || !name.trim()) {
    errors.name = "Asset name is required.";
  }

  if (!category || !category.trim()) {
    errors.category = "Asset category is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates utility log input.
 */
export function validateUtilityForm(
  categoryId: number | null | undefined,
  vendorId: number | null | undefined,
  billingPeriod: string,
  cost: number | string
): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!categoryId || categoryId <= 0) {
    errors.category_id = "Utility overhead category is required.";
  }

  if (!vendorId || vendorId <= 0) {
    errors.vendor_id = "Utility vendor is required.";
  }

  if (!billingPeriod || !billingPeriod.trim()) {
    errors.billing_period = "Billing period (e.g. 2026-09) is required.";
  }

  const numCost = Number(cost);
  if (isNaN(numCost) || numCost <= 0) {
    errors.cost = "Cost must be a positive number.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Status badge formatting for work orders.
 */
export function formatWorkOrderStatusBadge(status: string): {
  label: string;
  labelUr: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "Reported":
      return { label: "Reported", labelUr: "درج شدہ", color: "#b45309", bg: "#fef3c7" };
    case "Assigned":
      return { label: "Assigned", labelUr: "مقرر شدہ", color: "#1d4ed8", bg: "#dbeafe" };
    case "InProgress":
      return { label: "In Progress", labelUr: "جاری ہے", color: "#7c3aed", bg: "#ede9fe" };
    case "Completed":
      return { label: "Completed", labelUr: "مکمل", color: "#15803d", bg: "#dcfce7" };
    case "PendingPayment":
      return { label: "Pending Payment", labelUr: "ادائیگی زیر التواء", color: "#ea580c", bg: "#ffedd5" };
    case "Paid":
      return { label: "Paid", labelUr: "ادا شدہ", color: "#047857", bg: "#d1fae5" };
    case "Cancelled":
      return { label: "Cancelled", labelUr: "منسوخ", color: "#b91c1c", bg: "#fee2e2" };
    default:
      return { label: status || "Unknown", labelUr: status || "نامعلوم", color: "#475569", bg: "#f1f5f9" };
  }
}

/**
 * Priority badge formatting.
 */
export function formatWorkOrderPriorityBadge(priority: string): {
  label: string;
  labelUr: string;
  color: string;
  bg: string;
} {
  switch (priority) {
    case "Emergency":
      return { label: "Emergency", labelUr: "ہنگامی", color: "#991b1b", bg: "#fee2e2" };
    case "High":
      return { label: "High", labelUr: "اہم", color: "#c2410c", bg: "#ffedd5" };
    case "Normal":
      return { label: "Normal", labelUr: "معمول", color: "#1e40af", bg: "#dbeafe" };
    case "Low":
      return { label: "Low", labelUr: "کم ترجیح", color: "#475569", bg: "#f1f5f9" };
    default:
      return { label: priority || "Normal", labelUr: priority || "معمول", color: "#475569", bg: "#f1f5f9" };
  }
}

/**
 * Payable status badge formatting.
 */
export function formatPayableStatusBadge(status: string | null): {
  label: string;
  labelUr: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "PendingApproval":
      return { label: "AP Pending", labelUr: "اے پی زیر التواء", color: "#c2410c", bg: "#ffedd5" };
    case "Approved":
      return { label: "AP Approved", labelUr: "اے پی منظور شدہ", color: "#1d4ed8", bg: "#dbeafe" };
    case "PartiallySettled":
      return { label: "Partial", labelUr: "جزوی ادا شدہ", color: "#7c3aed", bg: "#ede9fe" };
    case "Settled":
      return { label: "AP Settled", labelUr: "اے پی ادا شدہ", color: "#15803d", bg: "#dcfce7" };
    case "Cancelled":
      return { label: "AP Cancelled", labelUr: "اے پی منسوخ", color: "#b91c1c", bg: "#fee2e2" };
    default:
      return { label: "No AP", labelUr: "کوئی ادائیگی نہیں", color: "#64748b", bg: "#f8fafc" };
  }
}

/**
 * Bilingual statutory error messages for ops_console.
 */
export const OPS_CONSOLE_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string; actionEn: string; actionUr: string }
> = {
  ASSET_DISPOSED: {
    en: "This equipment was written off: nothing more is planned or recorded on it.",
    ur: "یہ ساز و سامان ناکارہ قرار دیا جا چکا ہے: اس پر مزید کام یا ریکارڈنگ ممکن نہیں ہے۔",
    actionEn: "Check asset status before scheduling maintenance or updates.",
    actionUr: "دیکھ بھال یا تبدیلی سے پہلے اثاثے کی حالت کی جانچ کریں۔",
  },
  BILLING_DEFERRED: {
    en: "Confirm how this emergency admission is paid first.",
    ur: "پہلے تصدیق کریں کہ اس ہنگامی داخلے کی ادائیگی کیسے کی جائے گی۔",
    actionEn: "Verify patient billing arrangements before clearing discharge stage.",
    actionUr: "ڈسچارج مرحلہ کلیئر کرنے سے پہلے مریض کے بلنگ انتظامات کی تصدیق کریں۔",
  },
  DISCHARGE_NOT_ALLOWED: {
    en: "Discharge cannot proceed in the admission's current state.",
    ur: "مریض کے داخلے کی موجودہ حالت میں ڈسچارج کا عمل آگے نہیں بڑھ سکتا۔",
    actionEn: "Review admission clinical notes and prerequisite orders.",
    actionUr: "مریض کے کلینیکل نوٹس اور ضروری احکامات کا جائزہ لیں۔",
  },
  DISCHARGE_STAGE_IMMUTABLE: {
    en: "A cleared discharge stage cannot change.",
    ur: "ایک بار منظور شدہ ڈسچارج مرحلہ تبدیل نہیں کیا جا سکتا۔",
    actionEn: "Stages already marked clear are finalized audit records.",
    actionUr: "کلیئر شدہ مراحل حتمی آڈٹ ریکارڈ کا حصہ ہیں۔",
  },
  DISCHARGE_STAGE_OUT_OF_ORDER: {
    en: "Discharge stages must be cleared in order.",
    ur: "ڈسچارج کے مراحل کو ترتیب وار ہی کلیئر کیا جانا چاہیے۔",
    actionEn: "Clear earlier prerequisite clearance stages first.",
    actionUr: "پہلے پچھلے ضروری کلیئرنس مراحل مکمل کریں۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to do this.",
    ur: "آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔",
    actionEn: "Contact your facility operations supervisor or HR administrator.",
    actionUr: "اپنے آپریشنز سپروائزر یا ایچ آر ایڈمنسٹریٹر سے رابطہ کریں۔",
  },
  NOT_FOUND: {
    en: "The requested resource was not found.",
    ur: "درخواست کردہ ریکارڈ موجود نہیں ہے۔",
    actionEn: "Check the identifier or refresh the work orders queue.",
    actionUr: "نمبر کی تصدیق کریں یا فہرست کو تازہ کریں۔",
  },
  OWN_MEDICINES_HELD: {
    en: "The patient's own medicines are still held: hand them back, or record their destruction, first.",
    ur: "مریض کی اپنی ادویات ابھی بھی تحویل میں ہیں: پہلے انہیں واپس کریں یا ضائع کرنے کا ریکارڈ درج کریں۔",
    actionEn: "Contact the ward or pharmacy custodian to release patient medicines.",
    actionUr: "مریض کی ادویات کی واپسی کے لیے وارڈ یا فارمیسی سے رابطہ کریں۔",
  },
  REFERENCE_NOT_FOUND: {
    en: "A referenced record does not exist.",
    ur: "حوالہ شدہ ریکارڈ موجود نہیں ہے۔",
    actionEn: "Verify that the selected employee, vendor, or asset is active.",
    actionUr: "تصدیق کریں کہ منتخب ملازم، ٹھیکیدار یا اثاثہ فعال ہے۔",
  },
  UNAUTHENTICATED: {
    en: "Authentication is required.",
    ur: "لاگ ان ہونا لازمی ہے۔",
    actionEn: "Sign in with valid staff credentials.",
    actionUr: "درست شناختی معلومات کے ساتھ دوبارہ لاگ ان کریں۔",
  },
  VALIDATION_ERROR: {
    en: "The request is invalid.",
    ur: "درخواست کا ڈیٹا درست نہیں ہے۔",
    actionEn: "Verify all mandatory inputs and numeric constraints.",
    actionUr: "تمام لازمی خانوں اور عددی شرائط کی تصدیق کریں۔",
  },
  WORK_ORDER_STATE_INVALID: {
    en: "Invalid work order state change.",
    ur: "ورک آرڈر کی حالت کی تبدیلی نااہل ہے۔",
    actionEn: "Work orders must transition: Reported → Assigned → InProgress → Completed.",
    actionUr: "ورک آرڈرز کو مرحلہ وار ہی آگے بڑھایا جا سکتا ہے۔",
  },
};
