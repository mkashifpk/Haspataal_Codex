import type {
  BloodSourceIn,
  BloodSourcePatch,
  BloodSourceOut,
  ComplianceDocumentOut,
} from "./generated/blood_sources";

export type BloodSourceKind = "BloodCenter" | "HospitalBloodBank" | "OwnBloodCenter";

export const BLOOD_SOURCE_KINDS: { kind: BloodSourceKind; en: string; ur: string }[] = [
  { kind: "BloodCenter", en: "Regional Blood Center (RBC)", ur: "ریجنل بلڈ سنٹر" },
  { kind: "HospitalBloodBank", en: "Partner Hospital Blood Bank", ur: "شراکت دار ہسپتال کا بلڈ بینک" },
  { kind: "OwnBloodCenter", en: "Hospital's Own Blood Center", ur: "ہسپتال کا اپنا بلڈ سنٹر" },
];

export function bloodSourcesAccess(view: string | undefined, permissions: string[]) {
  const isViewAllowed = ["full", "open_work", "records", "setup"].includes(view || "");
  const canRead = permissions.includes("blood.view") || permissions.includes("blood.bank.manage");
  const canManage = permissions.includes("blood.bank.manage");
  return {
    read: isViewAllowed && canRead,
    write: ["full", "setup"].includes(view || "") && canManage,
    retire: ["full", "open_work", "setup"].includes(view || "") && canManage,
    isRetiring: view === "open_work",
    isRecords: view === "records",
    isSetup: view === "setup",
  };
}

export function validateBloodSourceIn(data: {
  name: string;
  kind: string;
  licence_number: string;
  agreement_document_id?: number | null;
  hasOwnCenterAlready?: boolean;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) {
    errors.name = "Enter the blood source or center name.";
  } else if (data.name.trim().length > 200) {
    errors.name = "Name must not exceed 200 characters.";
  }

  if (!["BloodCenter", "HospitalBloodBank", "OwnBloodCenter"].includes(data.kind)) {
    errors.kind = "Select a valid blood source category.";
  } else if (data.kind === "OwnBloodCenter" && data.hasOwnCenterAlready) {
    errors.kind = "The hospital can only have one Own Blood Center.";
  }

  if (!data.licence_number.trim()) {
    errors.licence_number = "Enter the PBTA license number.";
  } else if (data.licence_number.trim().length > 100) {
    errors.licence_number = "PBTA license number must not exceed 100 characters.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function checkTransfusionReadiness(sources: { is_active: boolean }[]) {
  const activeSourcesCount = sources.filter((s) => s.is_active).length;
  return {
    hasActiveSource: activeSourcesCount > 0,
    activeSourcesCount,
    readyToActivate: activeSourcesCount > 0,
  };
}
