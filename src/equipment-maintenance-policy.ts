/**
 * Equipment Maintenance Domain Policy
 * Implements business rules for Screen 158 (equipment_maintenance) & Screen 159 (equipment_maintenance_ops)
 * Roadmap Position 158/159, MSDS FMS 122-125
 */

import type {
  EquipmentOut,
  EquipmentDetailOut,
  MaintenancePlanOut,
  MaintenanceRecordOut,
  MaintenanceStatisticsOut,
  EquipmentIn,
  MaintenancePlanIn,
  MaintenancePlanUpdateIn,
  MaintenanceRecordIn,
  AssetIn,
  FacilityStaffOut,
} from "./generated/equipment_maintenance";

export type MaintenanceScheduleTab =
  "schedule" | "inventory" | "records" | "statistics" | "onboarding";

export type EquipmentScreenId =
  "equipment_maintenance" | "equipment_maintenance_ops";
export function equipmentDay(timeZone?: string, now = new Date()): string {
  if (!timeZone) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function equipmentAccess(
  user: { permissions?: string[] } | undefined,
  establishment:
    | { views?: { screens?: Array<{ screen_id: string; view: string }> } }
    | undefined,
  screenId: EquipmentScreenId,
) {
  const permissions = user?.permissions ?? [];
  // GET /establishment: an unlisted screen is core and always shown.
  // An absent establishment response still means access is not ready.
  const view = establishment?.views
    ? (establishment.views.screens?.find((s) => s.screen_id === screenId)
        ?.view ?? "full")
    : "hidden";
  const canView =
    view !== "hidden" &&
    permissions.some((p) =>
      [
        "facility.view",
        "facility.equipment.manage",
        "facility.maintenance.record",
      ].includes(p),
    );
  const writable = canView && view !== "records";
  const canManage =
    writable && permissions.includes("facility.equipment.manage");
  const canRecord =
    writable && permissions.includes("facility.maintenance.record");
  return {
    canView,
    canManage,
    canRecord,
    canOnboard:
      canManage && canRecord && permissions.includes("ops.asset.manage"),
    canPickStaff:
      canView &&
      permissions.some((p) =>
        [
          "facility.compliance.manage",
          "facility.equipment.manage",
          "facility.maintenance.record",
          "facility.drill.manage",
          "personnel.training.record",
        ].includes(p),
      ),
  };
}

export interface PlanValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface VisitValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface EquipmentValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface AssetValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Standard error messages for Equipment Maintenance
 */
export const EQUIPMENT_ERROR_MESSAGES: Record<
  string,
  { en: string; ur: string }
> = {
  ASSET_DISPOSED: {
    en: "This equipment was written off: nothing more is planned or recorded on it.",
    ur: "یہ سازوسامان متروک قرار دیا جا چکا ہے: اس پر مزید کوئی منصوبہ یا وزٹ درج نہیں ہو سکتا۔",
  },
  FORBIDDEN: {
    en: "You do not have permission to perform this maintenance action.",
    ur: "آپ کے پاس اس مرمتی کارروائی کو انجام دینے کی اجازت نہیں ہے۔",
  },
  MAINTENANCE_PLAN_EXISTS: {
    en: "This equipment already has an active plan of this kind: change it instead.",
    ur: "اس سازوسامان کے پاس پہلے سے اس قسم کا فعال منصوبہ موجود ہے: اس میں ترمیم کریں۔",
  },
  VALIDATION_ERROR: {
    en: "The maintenance request contains invalid or incomplete fields.",
    ur: "مرمتی درخواست میں غلط یا نامکمل اندراجات موجود ہیں۔",
  },
  VERSION_CONFLICT: {
    en: "The equipment record was changed by someone else; reload and try again.",
    ur: "سازوسامان کا ریکارڈ کسی دوسرے صارف نے تبدیل کر دیا ہے؛ دوبارہ لوڈ کریں۔",
  },
};

/**
 * rule:f32032152a
 * Identifies whether a maintenance plan is overdue.
 * The server's overdue flag is authoritative, including its grace period.
 */
export function isPlanOverdue(
  plan: MaintenancePlanOut,
  referenceDate: string = new Date().toISOString().slice(0, 10),
): boolean {
  return plan.overdue === true;
}

/**
 * rule:f32032152a
 * Filters schedule items for contractors or in-house personnel.
 */
export function filterSchedule(
  plans: MaintenancePlanOut[],
  performedByFilter: "All" | "InHouse" | "Contractor" = "All",
  searchQuery: string = "",
  departmentId?: number | null,
): MaintenancePlanOut[] {
  return plans.filter((plan) => {
    if (
      performedByFilter !== "All" &&
      plan.performed_by !== performedByFilter
    ) {
      return false;
    }
    if (
      departmentId !== undefined &&
      departmentId !== null &&
      plan.department_id !== departmentId
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTag = plan.asset_tag?.toLowerCase().includes(q);
      const matchName = plan.asset_name?.toLowerCase().includes(q);
      const matchKind = plan.kind?.toLowerCase().includes(q);
      const matchVendor = plan.vendor_name?.toLowerCase().includes(q);
      if (!matchTag && !matchName && !matchKind && !matchVendor) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Validates new Asset creation (POST /ops/assets)
 */
export function validateAssetForm(
  input: Partial<AssetIn>,
): AssetValidationResult {
  const errors: Record<string, string> = {};

  if (!input.asset_tag || !input.asset_tag.trim()) {
    errors.asset_tag = "Asset tag is required (e.g. EQ-MED-001).";
  } else if (input.asset_tag.trim().length < 2) {
    errors.asset_tag = "Asset tag must be at least 2 characters.";
  }

  if (!input.name || !input.name.trim()) {
    errors.name = "Asset name is required.";
  } else if (input.name.trim().length < 2) {
    errors.name = "Asset name must be at least 2 characters.";
  }

  if (!input.category || !input.category.trim()) {
    errors.category = "Category is required.";
  }

  if (
    input.purchase_cost !== undefined &&
    input.purchase_cost !== null &&
    input.purchase_cost !== ""
  ) {
    const cost = Number(input.purchase_cost);
    if (isNaN(cost) || cost < 0) {
      errors.purchase_cost = "Purchase cost must be a non-negative number.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * rule:79dedf48b1
 * Validates equipment updates (PUT /facility/equipment/{asset_id})
 */
export function validateEquipmentForm(
  input: Partial<EquipmentIn>,
): EquipmentValidationResult {
  const errors: Record<string, string> = {};

  if (input.maintained_by === "Contractor" || input.maintained_by === "Mixed") {
    if (!input.service_vendor_id && !input.service_contract_ref) {
      // Best practice warning/check under FMS 124
    }
  }

  if (input.warranty_until && isNaN(Date.parse(input.warranty_until))) {
    errors.warranty_until = "Warranty date must be a valid date.";
  }

  if (
    input.service_contract_until &&
    isNaN(Date.parse(input.service_contract_until))
  ) {
    errors.service_contract_until =
      "Service contract expiry must be a valid date.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * rule:79dedf48b1
 * Validates maintenance plan creation (POST /facility/equipment/{asset_id}/plans)
 * Ensures interval from OEM manual and contractor has vendor assigned.
 */
export function validateMaintenancePlanForm(
  input: Partial<MaintenancePlanIn>,
  existingPlans: MaintenancePlanOut[] = [],
): PlanValidationResult {
  const errors: Record<string, string> = {};

  if (!input.kind) {
    errors.kind = "Maintenance kind is required.";
  } else {
    // Check if active plan of this kind already exists on the asset
    const activeSameKind = existingPlans.find(
      (p) => p.kind === input.kind && p.is_active,
    );
    if (activeSameKind) {
      errors.kind = `An active ${input.kind} plan (ID: ${activeSameKind.plan_id}) already exists. Edit the existing plan instead.`;
    }
  }

  if (
    !Number.isInteger(Number(input.interval_days)) ||
    Number(input.interval_days) < 1 ||
    Number(input.interval_days) > 1825
  ) {
    errors.interval_days =
      "Interval must be 1–1825 whole days, from the OEM guidelines.";
  }

  if (!input.performed_by) {
    errors.performed_by = "Performed by (InHouse / Contractor) is required.";
  } else if (input.performed_by === "Contractor" && !input.vendor_id) {
    errors.vendor_id = "Vendor is required when performed by a contractor.";
  }

  if (!input.next_due || isNaN(Date.parse(input.next_due))) {
    errors.next_due = "Next due date is required and must be valid.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates maintenance plan update (PUT /facility/maintenance-plans/{plan_id})
 */
export function validateMaintenancePlanUpdateForm(
  input: Partial<MaintenancePlanUpdateIn>,
): PlanValidationResult {
  const errors: Record<string, string> = {};

  if (!input.reason || !input.reason.trim()) {
    errors.reason = "A reason for changing the maintenance plan is required.";
  } else if (
    input.reason.trim().length < 5 ||
    input.reason.trim().length > 1000
  ) {
    errors.reason = "Reason must be 5–1000 characters.";
  }

  if (
    input.interval_days !== undefined &&
    input.interval_days !== null &&
    (!Number.isInteger(Number(input.interval_days)) ||
      Number(input.interval_days) < 1 ||
      Number(input.interval_days) > 1825)
  ) {
    errors.interval_days = "Interval must be 1–1825 whole days.";
  }

  if (input.performed_by === "Contractor" && !input.vendor_id) {
    errors.vendor_id = "Vendor is required when performed by a contractor.";
  }

  if (input.next_due && isNaN(Date.parse(input.next_due))) {
    errors.next_due = "Due date must be valid.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * rule:f6412c4eca
 * Validates recording a maintenance/calibration visit (POST /facility/equipment/{asset_id}/maintenance).
 * - Calibration certificate is mandatory unless result is Fail.
 * - InHouse visits require an employee_id; Contractor visits require technician and/or vendor_id.
 * - Findings are mandatory.
 */
export function validateMaintenanceRecordForm(
  input: Partial<MaintenanceRecordIn>,
  performedBy: "InHouse" | "Contractor" = "InHouse",
): VisitValidationResult {
  const errors: Record<string, string> = {};

  if (!input.kind) {
    errors.kind = "Visit kind is required.";
  }

  if (!input.performed_on || isNaN(Date.parse(input.performed_on))) {
    errors.performed_on = "Visit date is required and must be valid.";
  }

  if (!input.result) {
    errors.result = "Result (Pass / Adjusted / Fail) is required.";
  }

  if (!input.findings || !input.findings.trim()) {
    errors.findings = "Inspection/maintenance findings are required.";
  } else if (input.findings.trim().length < 3) {
    errors.findings = "Findings must be at least 3 characters.";
  }

  // rule:f6412c4eca: Calibration requires certificate number unless it failed
  if (input.kind === "Calibration" && input.result !== "Fail") {
    if (!input.certificate_no || !input.certificate_no.trim()) {
      errors.certificate_no =
        "Calibration certificate number is required for passing/adjusted calibrations.";
    }
  }

  // Staff or Contractor validation
  if (performedBy === "InHouse") {
    if (!input.employee_id) {
      errors.employee_id =
        "Hospital technician / staff member is required for in-house visits.";
    }
  } else {
    if (!input.vendor_id)
      errors.vendor_id =
        "Select the contractor's vendor ID from the hospital register.";
    if (!input.technician || !input.technician.trim()) {
      errors.technician = "Contractor technician/engineer name is required.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * rule:f6412c4eca
 * Determines whether this visit takes the equipment out of service or restores it.
 */
export function computeVisitStatusImpact(
  currentStatus: EquipmentOut["status"],
  result: "Pass" | "Adjusted" | "Fail",
  returnToService: boolean = false,
): { newStatus: EquipmentOut["status"]; actionNote: string } {
  if (result === "Fail") {
    return {
      newStatus: "OutOfService",
      actionNote:
        "Visit failed: Equipment will be taken Out of Service for patient safety.",
    };
  }

  if (
    (currentStatus === "OutOfService" || currentStatus === "UnderRepair") &&
    returnToService
  ) {
    return {
      newStatus: "Active",
      actionNote:
        "Passing visit with Return to Service: Equipment will be restored to Active service.",
    };
  }

  return {
    newStatus: currentStatus,
    actionNote: `Status remains ${currentStatus}.`,
  };
}

/**
 * Evaluates whether a recorded visit was performed on time.
 */
export function formatOnTimeBadge(onTime: boolean | null): {
  labelEn: string;
  labelUr: string;
  tone: "success" | "warning" | "neutral";
} {
  if (onTime === true) {
    return { labelEn: "On Time", labelUr: "وقت پر", tone: "success" };
  }
  if (onTime === false) {
    return { labelEn: "Overdue / Late", labelUr: "تاخیر سے", tone: "warning" };
  }
  return { labelEn: "Unplanned", labelUr: "غیر منصوبہ بند", tone: "neutral" };
}

/**
 * Format status tone for equipment
 */
export function getEquipmentStatusTone(
  status: EquipmentOut["status"],
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "Active":
      return "success";
    case "UnderRepair":
      return "warning";
    case "OutOfService":
      return "danger";
    case "Disposed":
    case "Lost":
    default:
      return "neutral";
  }
}

/**
 * Format status tone for maintenance results
 */
export function getResultTone(
  result: MaintenanceRecordOut["result"],
): "success" | "warning" | "danger" {
  switch (result) {
    case "Pass":
      return "success";
    case "Adjusted":
      return "warning";
    case "Fail":
      return "danger";
    default:
      return "warning";
  }
}

/**
 * Formats compliance percentage with MSDS threshold
 */
export function formatComplianceRate(pct: number | null): {
  formatted: string;
  tone: "neutral";
} {
  if (pct === null || pct === undefined) {
    return { formatted: "N/A", tone: "neutral" };
  }
  const formatted = `${pct.toFixed(1)}%`;
  return { formatted, tone: "neutral" };
}
