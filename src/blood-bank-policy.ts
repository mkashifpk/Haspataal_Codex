export type BloodComponent =
  | "WholeBlood"
  | "RedCells"
  | "FreshFrozenPlasma"
  | "Cryoprecipitate"
  | "Platelets";

export type BloodAbo = "A" | "B" | "AB" | "O";
export type BloodRh = "Positive" | "Negative";

export type StorageKind =
  | "BloodRefrigerator"
  | "PlasmaFreezer"
  | "PlateletIncubator";

export type UnitDiscardReason =
  | "Expired"
  | "BagDamaged"
  | "OutOfStorageTooLong"
  | "StorageTemperature"
  | "IdentityDiscrepancy"
  | "Other";

export const STORAGE_LIMITS: Record<
  StorageKind,
  { min: number; max: number; labelEn: string; labelUr: string }
> = {
  BloodRefrigerator: {
    min: 2,
    max: 6,
    labelEn: "Blood Refrigerator (+2°C to +6°C)",
    labelUr: "بلڈ ریفریجریٹر (+2 سے +6 سینٹی گریڈ)",
  },
  PlasmaFreezer: {
    min: -50,
    max: -25,
    labelEn: "Plasma Freezer (-25°C or colder)",
    labelUr: "پلازما فریزر (-25 سینٹی گریڈ یا اس سے کم)",
  },
  PlateletIncubator: {
    min: 20,
    max: 24,
    labelEn: "Platelet Agitator / Incubator (+20°C to +24°C)",
    labelUr: "پلیٹلیٹ انکیوبیٹر (+20 سے +24 سینٹی گریڈ)",
  },
};

export function isStorageTempOutOfRange(
  kind: StorageKind,
  temp: number,
): { outOfRange: boolean; min: number; max: number; desc: string } {
  const limits = STORAGE_LIMITS[kind];
  if (!limits) return { outOfRange: false, min: -100, max: 100, desc: "" };

  let outOfRange = false;
  if (kind === "PlasmaFreezer") {
    // Must be -25C or colder
    outOfRange = temp > -25;
  } else {
    outOfRange = temp < limits.min || temp > limits.max;
  }

  return {
    outOfRange,
    min: limits.min,
    max: limits.max,
    desc: limits.labelEn,
  };
}

export function bloodBankAccess(
  view: string | undefined,
  permissions: string[],
  isServiceActive: boolean,
  isServiceRetiring: boolean,
) {
  const isViewAllowed = ["full", "open_work", "records", "setup"].includes(view || "");
  const canRead =
    permissions.includes("blood.view") ||
    permissions.includes("blood.bank.operate") ||
    permissions.includes("blood.bank.manage");
  const canOperate =
    permissions.includes("blood.bank.operate") ||
    permissions.includes("blood.bank.manage");

  const canReceiveNew =
    isViewAllowed &&
    view !== "records" &&
    view !== "open_work" &&
    canOperate &&
    isServiceActive;

  const canContinueWork =
    isViewAllowed &&
    view !== "records" &&
    canOperate &&
    (isServiceActive || isServiceRetiring);

  return {
    read: isViewAllowed && canRead,
    receive: canReceiveNew,
    crossmatch: canContinueWork,
    issue: canContinueWork,
    discard: isViewAllowed && view !== "records" && canOperate,
    returnToSource: isViewAllowed && view !== "records" && canOperate,
    returnUnit: isViewAllowed && view !== "records" && canOperate,
    storageCheck: isViewAllowed && view !== "records" && canOperate,
    isRetiring: view === "open_work",
    isRecords: view === "records",
    isSetup: view === "setup",
  };
}

export function validateReceiveUnitIn(data: {
  source_id?: number | null;
  unit_number: string;
  component: string;
  abo: string;
  rh: string;
  expires_at: string;
  screened: boolean;
  volume_ml?: number | null;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.source_id) {
    errors.source_id = "Select the blood source or center.";
  }

  if (!data.unit_number || !data.unit_number.trim()) {
    errors.unit_number = "Enter the blood bag unit number.";
  } else if (data.unit_number.trim().length > 50) {
    errors.unit_number = "Unit number must not exceed 50 characters.";
  }

  if (!["WholeBlood", "RedCells", "FreshFrozenPlasma", "Cryoprecipitate", "Platelets"].includes(data.component)) {
    errors.component = "Select a valid blood component.";
  }

  if (!["A", "B", "AB", "O"].includes(data.abo)) {
    errors.abo = "Select ABO blood group.";
  }

  if (!["Positive", "Negative"].includes(data.rh)) {
    errors.rh = "Select Rh factor.";
  }

  if (!data.expires_at) {
    errors.expires_at = "Enter the expiry date printed on the blood bag label.";
  } else {
    const expDate = new Date(data.expires_at);
    if (isNaN(expDate.getTime())) {
      errors.expires_at = "Invalid expiry date.";
    } else if (expDate.getTime() < Date.now()) {
      errors.expires_at = "Unit is already expired. Expired units cannot be received.";
    }
  }

  if (!data.screened) {
    errors.screened = "Mandatory screening check: the unit must be verified screened for TTI before receiving.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCrossmatchIn(data: {
  unit_id?: number | null;
  patient_abo: string;
  patient_rh: string;
  sample_taken_at: string;
  method: string;
  result: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.unit_id) {
    errors.unit_id = "Select an available in-stock unit of the requested component.";
  }

  if (!["A", "B", "AB", "O"].includes(data.patient_abo)) {
    errors.patient_abo = "Select patient ABO group.";
  }

  if (!["Positive", "Negative"].includes(data.patient_rh)) {
    errors.patient_rh = "Select patient Rh factor.";
  }

  if (!data.sample_taken_at) {
    errors.sample_taken_at = "Enter sample collection timestamp.";
  }

  if (!data.method || !data.method.trim()) {
    errors.method = "Enter crossmatch testing technique / method (e.g. Gel Card, Tube AHG).";
  }

  if (!["Compatible", "Incompatible"].includes(data.result)) {
    errors.result = "Select test result (Compatible or Incompatible).";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateBloodIssueIn(data: {
  unit_id?: number | null;
  collector_username: string;
  collector_password: string;
  crossmatch_id?: number | null;
  isEmergencyWithNote?: boolean;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.unit_id) {
    errors.unit_id = "Select the reserved unit to issue.";
  }

  if (!data.crossmatch_id && !data.isEmergencyWithNote) {
    errors.crossmatch_id = "Crossmatch compatibility test required before issuing blood (BLOOD_CROSSMATCH_REQUIRED).";
  }

  if (!data.collector_username || !data.collector_username.trim()) {
    errors.collector_username = "Collector's staff username is required to sign for blood at the bank.";
  }

  if (!data.collector_password) {
    errors.collector_password = "Collector's password is required for verification.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStorageCheckIn(data: {
  equipment: string;
  storage_kind: StorageKind;
  temperature_c: number | string;
  action_taken?: string | null;
}): { valid: boolean; errors: Record<string, string>; isOutOfRange: boolean } {
  const errors: Record<string, string> = {};

  if (!data.equipment || !data.equipment.trim()) {
    errors.equipment = "Equipment identifier is required (e.g. Fridge A, Plasma Freezer 1).";
  }

  const tempNum = Number(data.temperature_c);
  if (isNaN(tempNum) || typeof tempNum !== "number") {
    errors.temperature_c = "Enter a valid temperature reading.";
  }

  const outCheck = isStorageTempOutOfRange(data.storage_kind, tempNum);
  if (outCheck.outOfRange) {
    if (!data.action_taken || !data.action_taken.trim()) {
      errors.action_taken = `Temperature is out of range (${outCheck.desc}). Corrective action taken is required (STORAGE_CHECK_ACTION_REQUIRED).`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    isOutOfRange: outCheck.outOfRange,
  };
}
