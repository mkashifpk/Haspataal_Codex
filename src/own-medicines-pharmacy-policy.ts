// Domain policies for Screen 69: Identify patients' own medicines (own_medicines_pharmacy)
// Covers rule:dfd5ef5981 (Worklist kind OwnMedicineToIdentify, Identification statuses, formulary matching, stored_at)
// Covers rule:040c55bd97 (Inpatient service view gating via establishment.views.screens)

import type { OwnMedicineOut, DrugStockOut } from "./generated/own_medicines_pharmacy";

export interface PharmacyOwnMedicinesAccess {
  canViewWorklist: boolean;
  canListOwn: boolean;
  canIdentify: boolean;
  canSearchFormulary: boolean;
  isRetiring: boolean;
  isRecordsOnly: boolean;
  isDenied: boolean;
}

export function pharmacyOwnMedicinesAccess(
  permissions: string[] = [],
  screenView: string = "full",
  roles: string[] = []
): PharmacyOwnMedicinesAccess {
  if (screenView === "hidden" || screenView === "setup") {
    return {
      canViewWorklist: false,
      canListOwn: false,
      canIdentify: false,
      canSearchFormulary: false,
      isRetiring: false,
      isRecordsOnly: false,
      isDenied: true,
    };
  }

  const isRecordsOnly = screenView === "records";
  const isRetiring = screenView === "open_work";

  const hasPerm = (p: string) => permissions.includes(p);
  const hasRole = (r: string) => roles.includes(r);

  const canViewWorklist = !isRecordsOnly && (
    hasPerm("medication.safety.view") ||
    hasPerm("patient.wristband.print") ||
    hasRole("pharmacist") ||
    hasRole("pharmacy_admin")
  );

  const canListOwn = (
    hasPerm("patient.own_medicine.identify") ||
    hasPerm("patient.own_medicine.record") ||
    hasPerm("prescription.view") ||
    hasRole("pharmacist") ||
    hasRole("pharmacy_admin") ||
    hasRole("ward_nurse") ||
    hasRole("doctor")
  );

  // In records-only mode, identifying new medicines is prohibited
  const canIdentify = !isRecordsOnly && (
    hasPerm("patient.own_medicine.identify") ||
    hasRole("pharmacist") ||
    hasRole("pharmacy_admin")
  );

  const canSearchFormulary = (
    hasPerm("pharmacy.formulary.view") ||
    hasRole("pharmacist") ||
    hasRole("pharmacy_admin") ||
    hasRole("doctor") ||
    hasRole("ward_nurse")
  );

  return {
    canViewWorklist,
    canListOwn,
    canIdentify,
    canSearchFormulary,
    isRetiring,
    isRecordsOnly,
    isDenied: !canListOwn && !canViewWorklist,
  };
}

export interface IdentifyValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateIdentifyInput(
  identification: string,
  drugId: number | null | undefined,
  note: string | null | undefined,
  storedAt: string | null | undefined
): IdentifyValidationResult {
  const errors: Record<string, string> = {};

  const allowedIdentifications = ["Identified", "NotIdentifiable", "Expired", "Damaged"];
  if (!identification || !allowedIdentifications.includes(identification)) {
    errors.identification = "Identification status must be Identified, NotIdentifiable, Expired, or Damaged.";
  }

  if (identification === "Identified") {
    if (!drugId || typeof drugId !== "number" || drugId <= 0) {
      errors.drug_id = "A matching formulary drug must be selected when status is Identified.";
    }
  }

  if (note && note.length > 500) {
    errors.note = "Note must not exceed 500 characters.";
  }

  if (storedAt && storedAt !== "Ward" && storedAt !== "Pharmacy") {
    errors.stored_at = "Storage location must be Ward or Pharmacy.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canIdentifyMedicine(item: OwnMedicineOut): { allowed: boolean; reason?: string } {
  // If already identified or not in Received state, transition is invalid
  if (item.identification !== null || item.status !== "Received") {
    return {
      allowed: false,
      reason: `Medicine already in ${item.status} state with identification: ${item.identification || "None"}. Once identified, repeat calls are prohibited (OWN_MEDICINE_STATE_INVALID).`,
    };
  }

  return { allowed: true };
}

export function formatStockBadge(drug: DrugStockOut): { label: string; tone: "positive" | "warning" | "danger" } {
  if (drug.stock_status === "OutOfStock" || drug.qty_available <= 0) {
    return { label: "Out of Stock", tone: "danger" };
  }
  if (drug.stock_status === "Low") {
    return { label: `Low Stock (${drug.qty_available} ${drug.unit})`, tone: "warning" };
  }
  return { label: `In Stock (${drug.qty_available} ${drug.unit})`, tone: "positive" };
}

export function getHighAlertTone(category: string | null): "danger" | "warning" | null {
  if (!category) return null;
  return "danger";
}
