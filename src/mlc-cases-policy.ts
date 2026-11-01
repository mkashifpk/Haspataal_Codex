/**
 * Domain policy and validation rules for mlc_cases (Screen 102, Position 102, 75 points)
 * Medico-legal cases register under MSDS indicators 15, 16, 20
 *
 * Rules:
 * - rule:4d698e4d1b: Offer 'Open MLC' from the emergency visit whenever the complaint matches
 *   a case type (GET /mlc/case-types). An unknown patient gets a trauma profile first (POST /patients/trauma).
 * - rule:5bc7258288: Write the history as alleged, in the teller's words, and who told it;
 *   the examination may follow later (PATCH).
 * - rule:280a8e8493: Not brought by the police: 'Inform police' at once (police-intimation:
 *   station from GET /mlc/contacts, how, to whom, their reference). It is recorded once and never
 *   changes. Keep police_intimation_overdue cases in red at the top.
 * - rule:2b6e9d023c: Print the intimation for the police station (print-payload, A4) and hand over
 *   evidence item by item, each signed for (evidence: seal number, officer, receipt).
 * - rule:044cdb5a52: Settle the medico-legal report: IssuedHere (number, date; upload the copy as a
 *   MedicoLegalReport document), Referred (the designated hospital) or NotRequired (why); then 'Close'
 *   (MLC_NOT_READY_TO_CLOSE lists details.missing).
 * - rule:ca37655fad: Every screen of this patient shows the MLC number (patient.mlc_numbers).
 * - rule:81b46f9cf6: Exists for the service emergency_department (work): show it as GET /establishment
 *   views.screens says for screen_id mlc_cases (full; open_work: without its new work, with the banner
 *   "No new medico-legal cases from now on. Completing existing cases and intimation continue."; records:
 *   history and corrections only; setup: only from Facility settings; hidden: in no menu), after login
 *   and again on establishment.changed. Never decide it from the profile's category.
 */

import type {
  MlcCaseListOut,
  MlcCaseOut,
  MlcOpenIn,
  MlcUpdateIn,
  PoliceIntimationIn,
  EvidenceIn,
  MlcCloseIn,
} from "./generated/mlc_cases";
import type { EstablishmentOut } from "./generated/facility_profile";

export interface MlcViewEvaluation {
  view: "full" | "open_work" | "records" | "setup" | "hidden";
  canOpen: boolean;
  canCreateNew: boolean;
  canManageOpen: boolean;
  canViewRecords: boolean;
  banner: string | null;
}

export interface ClinicalUser {
  id?: number;
  username?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Service view evaluation under rule:81b46f9cf6
 */
export function evaluateMlcCasesView(
  establishment: EstablishmentOut,
  screenId: string = "mlc_cases",
): MlcViewEvaluation {
  const match = establishment.views?.screens?.find((s) => s.screen_id === screenId);
  const viewMode = (match?.view ?? "full") as "full" | "open_work" | "records" | "setup" | "hidden";

  switch (viewMode) {
    case "full":
      return {
        view: "full",
        canOpen: true,
        canCreateNew: true,
        canManageOpen: true,
        canViewRecords: true,
        banner: null,
      };
    case "open_work":
      return {
        view: "open_work",
        canOpen: true,
        canCreateNew: false,
        canManageOpen: true,
        canViewRecords: true,
        banner: "No new medico-legal cases from now on. Completing existing cases and intimation continue.",
      };
    case "records":
      return {
        view: "records",
        canOpen: true,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: true,
        banner: "Records only: viewing medico-legal cases and printed intimations.",
      };
    case "setup":
      return {
        view: "setup",
        canOpen: false,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: false,
        banner: "Screen accessible from facility settings setup only.",
      };
    case "hidden":
    default:
      return {
        view: "hidden",
        canOpen: false,
        canCreateNew: false,
        canManageOpen: false,
        canViewRecords: false,
        banner: null,
      };
  }
}

/**
 * Permissions check for MLC write operations
 */
export function canManageMlc(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  if (user.permissions?.includes("mlc.case.manage")) return true;
  const userRoles = [user.role, ...(user.roles || [])].filter(Boolean) as string[];
  const allowedRoles = ["triage_nurse", "doctor", "clinical_specialist", "surgeon", "anaesthetist"];
  return userRoles.some((r) => allowedRoles.includes(r));
}

/**
 * Permissions check for MLC view operations
 */
export function canViewMlcRegister(user?: ClinicalUser | null): boolean {
  if (!user) return false;
  if (user.permissions?.some((p) => p === "mlc.case.manage" || p === "mlc.register.view")) return true;
  const userRoles = [user.role, ...(user.roles || [])].filter(Boolean) as string[];
  const allowedRoles = [
    "triage_nurse",
    "doctor",
    "clinical_specialist",
    "surgeon",
    "anaesthetist",
    "owner",
    "hospital_admin",
    "hospital_director",
    "clinic_director",
    "quality_officer",
  ];
  return userRoles.some((r) => allowedRoles.includes(r));
}

/**
 * Acuity & Statutory Priority Sorting under rule:280a8e8493
 * Keep police_intimation_overdue cases in red at the top.
 */
export function sortMlcCases(cases: MlcCaseListOut[]): MlcCaseListOut[] {
  return [...cases].sort((a, b) => {
    // 1. Overdue police intimation in Open cases comes first
    const aOverdue = Boolean(a.police_intimation_overdue && a.status === "Open");
    const bOverdue = Boolean(b.police_intimation_overdue && b.status === "Open");
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // 2. Open cases before Closed cases
    if (a.status === "Open" && b.status !== "Open") return -1;
    if (a.status !== "Open" && b.status === "Open") return 1;

    // 3. Newer arrivals first
    const timeA = new Date(a.arrived_at).getTime() || 0;
    const timeB = new Date(b.arrived_at).getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Validation for opening a medico-legal case (POST /mlc/cases)
 * rule:4d698e4d1b & rule:5bc7258288
 */
export function validateOpenMlc(input: Partial<MlcOpenIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.patient_id || input.patient_id <= 0) {
    errors.patient_id = "Valid patient ID is required. Unknown patient requires a trauma profile first.";
  }

  if (!input.case_type_id || input.case_type_id <= 0) {
    errors.case_type_id = "Medico-legal case type is required.";
  }

  const validBroughtBy = ["Police", "Rescue1122", "Ambulance", "Relatives", "Self", "Bystander", "Other"];
  if (!input.brought_by || !validBroughtBy.includes(input.brought_by)) {
    errors.brought_by = "Valid brought-by category is required.";
  }

  const history = input.alleged_history?.trim() ?? "";
  if (history.length < 3) {
    errors.alleged_history = "Alleged history must be at least 3 characters.";
  } else if (history.length > 5000) {
    errors.alleged_history = "Alleged history cannot exceed 5000 characters.";
  }

  if (input.brought_by === "Police" && (!input.police_station_id || input.police_station_id <= 0)) {
    errors.police_station_id = "Police station is required when patient is brought by police.";
  }

  if (input.brought_by_phone && input.brought_by_phone.trim().length > 30) {
    errors.brought_by_phone = "Phone number cannot exceed 30 characters.";
  }

  if (input.brought_by_name && input.brought_by_name.trim().length > 200) {
    errors.brought_by_name = "Brought by name cannot exceed 200 characters.";
  }

  return errors;
}

/**
 * Validation for updating an open case (PATCH /mlc/cases/{id})
 * rule:5bc7258288 & rule:044cdb5a52
 */
export function validateUpdateMlc(input: Partial<MlcUpdateIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.alleged_history !== undefined) {
    const history = input.alleged_history?.trim() ?? "";
    if (history.length < 3) {
      errors.alleged_history = "Alleged history must be at least 3 characters.";
    } else if (history.length > 5000) {
      errors.alleged_history = "Alleged history cannot exceed 5000 characters.";
    }
  }

  if (input.examination_findings !== undefined && input.examination_findings) {
    if (input.examination_findings.length > 10000) {
      errors.examination_findings = "Examination findings cannot exceed 10000 characters.";
    }
  }

  if (input.mlr_status) {
    if (input.mlr_status === "IssuedHere") {
      if (!input.mlr_number?.trim()) {
        errors.mlr_number = "MLR number is required when report is issued here.";
      }
      if (!input.mlr_issued_at?.trim()) {
        errors.mlr_issued_at = "MLR issue date is required when report is issued here.";
      }
    } else if (input.mlr_status === "Referred") {
      if (!input.referred_to_id || input.referred_to_id <= 0) {
        errors.referred_to_id = "Designated hospital is required when patient is referred for MLR.";
      }
    } else if (input.mlr_status === "NotRequired") {
      if (!input.mlr_note?.trim()) {
        errors.mlr_note = "Reason why MLR is not required must be recorded.";
      }
    }
  }

  return errors;
}

/**
 * Validation for recording police intimation (POST /mlc/cases/{id}/police-intimation)
 * rule:280a8e8493
 */
export function validatePoliceIntimation(input: Partial<PoliceIntimationIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.police_station_id || input.police_station_id <= 0) {
    errors.police_station_id = "Please select a police station from contacts.";
  }

  const validMethods = ["BroughtByPolice", "Phone", "InPerson", "Written"];
  if (!input.informed_how || !validMethods.includes(input.informed_how)) {
    errors.informed_how = "Please specify how police were informed.";
  }

  if (input.informed_to && input.informed_to.trim().length > 200) {
    errors.informed_to = "Officer name cannot exceed 200 characters.";
  }

  if (input.police_reference && input.police_reference.trim().length > 100) {
    errors.police_reference = "Police reference (roznamcha/FIR) cannot exceed 100 characters.";
  }

  return errors;
}

/**
 * Validation for evidence handover (POST /mlc/cases/{id}/evidence)
 * rule:2b6e9d023c
 */
export function validateEvidence(input: Partial<EvidenceIn>): Record<string, string> {
  const errors: Record<string, string> = {};

  const desc = input.description?.trim() ?? "";
  if (desc.length < 3) {
    errors.description = "Evidence description must be at least 3 characters.";
  } else if (desc.length > 1000) {
    errors.description = "Evidence description cannot exceed 1000 characters.";
  }

  const handedTo = input.handed_to?.trim() ?? "";
  if (handedTo.length < 3) {
    errors.handed_to = "Police officer name, rank and belt number required (at least 3 characters).";
  } else if (handedTo.length > 200) {
    errors.handed_to = "Officer details cannot exceed 200 characters.";
  }

  if (input.seal_number && input.seal_number.trim().length > 100) {
    errors.seal_number = "Seal number cannot exceed 100 characters.";
  }

  if (input.receipt_reference && input.receipt_reference.trim().length > 100) {
    errors.receipt_reference = "Receipt reference cannot exceed 100 characters.";
  }

  return errors;
}

/**
 * Validation for closing a case (POST /mlc/cases/{id}/close)
 * rule:044cdb5a52
 */
export function validateCloseMlc(
  caseRecord: Partial<MlcCaseOut>,
  input: Partial<MlcCloseIn>,
): { valid: boolean; errors: Record<string, string>; missing: string[] } {
  const errors: Record<string, string> = {};
  const missing: string[] = [];

  const note = input.note?.trim() ?? "";
  if (note.length < 3) {
    errors.note = "Closure note must be at least 3 characters.";
  } else if (note.length > 2000) {
    errors.note = "Closure note cannot exceed 2000 characters.";
  }

  // Settle report and intimation before closing per rule:044cdb5a52
  if (!caseRecord.police_informed_at && !caseRecord.police_station_id) {
    missing.push("police_intimation");
  }

  if (!caseRecord.mlr_status || caseRecord.mlr_status === "Pending") {
    missing.push("mlr_status");
  }

  if (missing.length > 0) {
    errors.general = "Cannot close case: Police intimation and Medico-Legal Report (MLR) settlement are required before closing.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    missing,
  };
}

/**
 * Error explanation mapping for clinical users under rule:81b46f9cf6 & definition of done
 */
export function explainMlcError(error: any): string {
  const code = error?.code || error?.error?.code || "";

  switch (code) {
    case "MLC_CLOSED":
      return "This medico-legal case is closed and cannot be modified. No further updates or police intimations are permitted.";
    case "MLC_CONTACT_TYPE_INVALID":
      return "Please select a registered police station (or designated MLR hospital for referrals) from the contact list.";
    case "MLC_NOT_READY_TO_CLOSE":
      return "Cannot close case: Inform the police and settle the Medico-Legal Report (Issued, Referred, or Not Required) before closure.";
    case "MLC_POLICE_ALREADY_INFORMED":
      return "Police intimation has already been recorded for this case and cannot be changed or overwritten.";
    case "PATIENT_MERGED_CANNOT_TRANSACT":
      return "This patient record was merged into another profile. Please access the master patient record to continue.";
    case "REFERENCE_NOT_FOUND":
      return "The referenced patient, emergency ticket, or contact record could not be found.";
    case "FORBIDDEN":
      return "You do not have authorization to manage medico-legal records or view this register.";
    case "VERSION_CONFLICT":
      return "This case record was updated concurrently by another terminal. Reloading latest records.";
    case "VALIDATION_ERROR":
      return "The submitted data is incomplete or invalid. Please check required fields.";
    default:
      return error?.message || "An unexpected error occurred while communicating with the medico-legal service.";
  }
}
