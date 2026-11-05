import test from "node:test";
import assert from "node:assert/strict";
import {
  isPlanOverdue,
  filterSchedule,
  validateAssetForm,
  validateEquipmentForm,
  validateMaintenancePlanForm,
  validateMaintenancePlanUpdateForm,
  validateMaintenanceRecordForm,
  computeVisitStatusImpact,
  formatOnTimeBadge,
  getEquipmentStatusTone,
  getResultTone,
  formatComplianceRate,
  EQUIPMENT_ERROR_MESSAGES,
  equipmentAccess,
  equipmentDay,
} from "../src/equipment-maintenance-policy.ts";

test("equipment dates follow hospital timezone, with no invented date before metadata", () => {
  const now = new Date("2026-11-04T20:30:00Z");
  assert.equal(equipmentDay("Asia/Karachi", now), "2026-11-05");
  assert.equal(equipmentDay("America/Los_Angeles", now), "2026-11-04");
  assert.equal(equipmentDay(undefined, now), "");
});

test("equipment_maintenance: core visibility, explicit permissions and runtime records/hidden views", () => {
  const permissions = [
    "facility.view",
    "facility.equipment.manage",
    "facility.maintenance.record",
    "ops.asset.manage",
  ];
  const user = { permissions };
  assert.equal(
    equipmentAccess(user, { views: { screens: [] } }, "equipment_maintenance")
      .canOnboard,
    true,
  );
  assert.equal(
    equipmentAccess(
      { permissions: [] },
      { views: { screens: [] } },
      "equipment_maintenance",
    ).canView,
    false,
  );
  assert.equal(
    equipmentAccess(user, undefined, "equipment_maintenance").canView,
    false,
  );
  const records = equipmentAccess(
    user,
    {
      views: {
        screens: [{ screen_id: "equipment_maintenance_ops", view: "records" }],
      },
    },
    "equipment_maintenance_ops",
  );
  assert.equal(records.canView, true);
  assert.equal(records.canManage, false);
  assert.equal(records.canRecord, false);
  assert.equal(
    equipmentAccess(
      user,
      {
        views: {
          screens: [{ screen_id: "equipment_maintenance", view: "hidden" }],
        },
      },
      "equipment_maintenance",
    ).canView,
    false,
  );
});

test("equipment_maintenance: rule:f32032152a overdue plan detection and schedule filtering", () => {
  const futureDate = "2026-12-01";
  const pastDate = "2026-10-01";
  const refDate = "2026-11-04";

  // Plan marked overdue by server
  assert.equal(
    isPlanOverdue(
      {
        plan_id: 1,
        asset_id: 10,
        asset_tag: "EQ-001",
        asset_name: "Defibrillator",
        department_id: 1,
        department_name: "ER",
        kind: "PreventiveMaintenance",
        interval_days: 90,
        performed_by: "InHouse",
        vendor_id: null,
        vendor_name: null,
        oem_reference: null,
        checklist: null,
        next_due: futureDate,
        is_active: true,
        row_version: 1,
        overdue: true,
        days_left: 5,
        last_done_on: null,
      },
      refDate,
    ),
    true,
  );

  // Server overdue=false remains authoritative over days_left and the client clock.
  assert.equal(
    isPlanOverdue(
      {
        plan_id: 2,
        asset_id: 11,
        asset_tag: "EQ-002",
        asset_name: "Ventilator",
        department_id: 2,
        department_name: "ICU",
        kind: "Calibration",
        interval_days: 180,
        performed_by: "Contractor",
        vendor_id: 5,
        vendor_name: "MedTech Ltd",
        oem_reference: null,
        checklist: null,
        next_due: pastDate,
        is_active: true,
        row_version: 1,
        overdue: false,
        days_left: -14,
        last_done_on: null,
      },
      refDate,
    ),
    false,
  );

  // Plan in the future and not overdue
  assert.equal(
    isPlanOverdue(
      {
        plan_id: 3,
        asset_id: 12,
        asset_tag: "EQ-003",
        asset_name: "ECG Machine",
        department_id: 1,
        department_name: "ER",
        kind: "ElectricalSafety",
        interval_days: 365,
        performed_by: "InHouse",
        vendor_id: null,
        vendor_name: null,
        oem_reference: null,
        checklist: null,
        next_due: futureDate,
        is_active: true,
        row_version: 1,
        overdue: false,
        days_left: 27,
        last_done_on: null,
      },
      refDate,
    ),
    false,
  );

  // Contractor filtering
  const testPlans = [
    {
      plan_id: 1,
      asset_tag: "EQ-01",
      asset_name: "Ventilator A",
      performed_by: "Contractor",
      department_id: 1,
      kind: "Calibration",
    },
    {
      plan_id: 2,
      asset_tag: "EQ-02",
      asset_name: "Defibrillator B",
      performed_by: "InHouse",
      department_id: 1,
      kind: "Inspection",
    },
    {
      plan_id: 3,
      asset_tag: "EQ-03",
      asset_name: "Infusion Pump C",
      performed_by: "Contractor",
      department_id: 2,
      kind: "PreventiveMaintenance",
    },
  ];

  const contractorList = filterSchedule(testPlans, "Contractor");
  assert.equal(contractorList.length, 2);
  assert(contractorList.every((p) => p.performed_by === "Contractor"));

  const inHouseList = filterSchedule(testPlans, "InHouse");
  assert.equal(inHouseList.length, 1);
  assert.equal(inHouseList[0].asset_tag, "EQ-02");

  const queryFiltered = filterSchedule(testPlans, "All", "Ventilator");
  assert.equal(queryFiltered.length, 1);
  assert.equal(queryFiltered[0].plan_id, 1);
});

test("equipment_maintenance: rule:79dedf48b1 asset onboarding and maintenance plan creation", () => {
  // Asset form validation
  const emptyAsset = validateAssetForm({});
  assert.equal(emptyAsset.valid, false);
  assert(emptyAsset.errors.asset_tag);
  assert(emptyAsset.errors.name);
  assert(emptyAsset.errors.category);

  const validAsset = validateAssetForm({
    asset_tag: "EQ-ANAE-004",
    name: "Anaesthesia Workstation",
    category: "MedicalEquipment",
    purchase_cost: "450000",
  });
  assert.equal(validAsset.valid, true);

  // Equipment form validation
  const validEquip = validateEquipmentForm({
    manufacturer: "Dräger",
    model: "Perseus A500",
    maintained_by: "Contractor",
    service_contract_ref: "MOU-2026-MED",
    warranty_until: "2027-12-31",
  });
  assert.equal(validEquip.valid, true);

  // Maintenance plan validation: interval <= 0
  const invalidPlan = validateMaintenancePlanForm({
    kind: "PreventiveMaintenance",
    interval_days: 0,
    performed_by: "InHouse",
    next_due: "2026-12-15",
  });
  assert.equal(invalidPlan.valid, false);
  assert(invalidPlan.errors.interval_days);

  // Maintenance plan validation: contractor requires vendor_id
  const contractorNoVendor = validateMaintenancePlanForm({
    kind: "Calibration",
    interval_days: 180,
    performed_by: "Contractor",
    next_due: "2026-12-15",
  });
  assert.equal(contractorNoVendor.valid, false);
  assert(contractorNoVendor.errors.vendor_id);

  // Maintenance plan validation: duplicate active plan of same kind
  const existingPlans = [
    {
      plan_id: 101,
      asset_id: 5,
      asset_tag: "EQ-005",
      asset_name: "Autoclave",
      kind: "Calibration",
      is_active: true,
      interval_days: 90,
      performed_by: "InHouse",
      next_due: "2026-12-01",
    },
  ];
  const duplicatePlan = validateMaintenancePlanForm(
    {
      kind: "Calibration",
      interval_days: 90,
      performed_by: "InHouse",
      next_due: "2027-01-01",
    },
    existingPlans,
  );
  assert.equal(duplicatePlan.valid, false);
  assert(duplicatePlan.errors.kind.includes("already exists"));

  // Valid plan
  const validPlan = validateMaintenancePlanForm(
    {
      kind: "ElectricalSafety",
      interval_days: 365,
      performed_by: "InHouse",
      next_due: "2027-01-01",
    },
    existingPlans,
  );
  assert.equal(validPlan.valid, true);

  // Maintenance plan update validation
  const emptyUpdate = validateMaintenancePlanUpdateForm({});
  assert.equal(emptyUpdate.valid, false);
  assert(emptyUpdate.errors.reason);

  const validUpdate = validateMaintenancePlanUpdateForm({
    reason: "OEM service bulletin changed recommended inspection interval",
    interval_days: 120,
    is_active: true,
  });
  assert.equal(validUpdate.valid, true);
});

test("equipment_maintenance: rule:f6412c4eca visit recording, calibration certificates, and in/out of service lifecycle", () => {
  // In-house visit requires staff employee_id
  const inHouseNoStaff = validateMaintenanceRecordForm(
    {
      kind: "PreventiveMaintenance",
      performed_on: "2026-11-04",
      result: "Pass",
      findings: "All filters replaced and seals inspected cleanly.",
    },
    "InHouse",
  );
  assert.equal(inHouseNoStaff.valid, false);
  assert(inHouseNoStaff.errors.employee_id);

  // Contractor visit requires technician name
  const contractorNoTech = validateMaintenanceRecordForm(
    {
      kind: "PreventiveMaintenance",
      performed_on: "2026-11-04",
      result: "Pass",
      findings: "Serviced according to OEM protocol.",
    },
    "Contractor",
  );
  assert.equal(contractorNoTech.valid, false);
  assert(contractorNoTech.errors.technician);

  // Calibration passing visit requires certificate number
  const passingCalibrationNoCert = validateMaintenanceRecordForm(
    {
      kind: "Calibration",
      performed_on: "2026-11-04",
      result: "Pass",
      findings: "Transducer calibrated against standard.",
      employee_id: 15,
    },
    "InHouse",
  );
  assert.equal(passingCalibrationNoCert.valid, false);
  assert(passingCalibrationNoCert.errors.certificate_no);

  // Calibration failing visit does NOT require certificate number
  const failingCalibrationNoCert = validateMaintenanceRecordForm(
    {
      kind: "Calibration",
      performed_on: "2026-11-04",
      result: "Fail",
      findings: "Pressure sensor drifted beyond permissible tolerances.",
      employee_id: 15,
    },
    "InHouse",
  );
  assert.equal(failingCalibrationNoCert.valid, true);

  // Valid calibration with certificate
  const validCalibration = validateMaintenanceRecordForm(
    {
      kind: "Calibration",
      performed_on: "2026-11-04",
      result: "Pass",
      findings: "Calibrated to ISO 17025 standard.",
      certificate_no: "CAL-2026-8871",
      employee_id: 15,
    },
    "InHouse",
  );
  assert.equal(validCalibration.valid, true);

  // In/Out of service lifecycle: Fail takes OutOfService
  const failImpact = computeVisitStatusImpact("Active", "Fail", false);
  assert.equal(failImpact.newStatus, "OutOfService");

  // In/Out of service lifecycle: Pass with return_to_service restores Active
  const returnImpact = computeVisitStatusImpact("OutOfService", "Pass", true);
  assert.equal(returnImpact.newStatus, "Active");

  // In/Out of service lifecycle: Pass without return_to_service keeps OutOfService
  const keepOutOfServiceImpact = computeVisitStatusImpact(
    "OutOfService",
    "Pass",
    false,
  );
  assert.equal(keepOutOfServiceImpact.newStatus, "OutOfService");

  // On time badges
  assert.equal(formatOnTimeBadge(true).tone, "success");
  assert.equal(formatOnTimeBadge(false).tone, "warning");
  assert.equal(formatOnTimeBadge(null).tone, "neutral");
});

test("equipment_maintenance: status tones, compliance rates, and standard error messages", () => {
  // Status tones
  assert.equal(getEquipmentStatusTone("Active"), "success");
  assert.equal(getEquipmentStatusTone("UnderRepair"), "warning");
  assert.equal(getEquipmentStatusTone("OutOfService"), "danger");
  assert.equal(getEquipmentStatusTone("Disposed"), "neutral");

  // Result tones
  assert.equal(getResultTone("Pass"), "success");
  assert.equal(getResultTone("Adjusted"), "warning");
  assert.equal(getResultTone("Fail"), "danger");

  // Compliance formatting
  for (const value of [95, 80, 65, null])
    assert.equal(formatComplianceRate(value).tone, "neutral");

  // Error messages
  assert(EQUIPMENT_ERROR_MESSAGES.ASSET_DISPOSED.en.includes("written off"));
  assert(
    EQUIPMENT_ERROR_MESSAGES.MAINTENANCE_PLAN_EXISTS.en.includes(
      "already has an active plan",
    ),
  );
  assert(EQUIPMENT_ERROR_MESSAGES.VERSION_CONFLICT.ur.length > 0);
});
