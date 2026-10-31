// Domain policies, PBTA standards and validation for Screen 77: donor_assessment
// Cites: PBTA Standards ch.1 S.1.9, ch.2 S.1.2 & S.2.3; Punjab Blood Transfusion Safety Act 2016 s.10(2)(e)
// Rules: rule:2f34c9a08a, rule:91e1708abe, rule:eee718a5dc, rule:a8bf19300f, rule:7abf8e8e44, rule:d8cd988a65, rule:eef3feb4b9, rule:1af6af6a9c, rule:21d2bc008e

import type { DonationIn, DonorDeferralIn, DonorDetailOut, DonorOut, DonorTellIn } from "./generated/donor_assessment";

export interface ScreenViewItem {
  screen_id: string;
  view: "full" | "open_work" | "records" | "setup" | "hidden";
}

export interface EstablishmentContext {
  active: string[];
  views?: {
    screens?: ScreenViewItem[] | Record<string, "full" | "open_work" | "records" | "setup" | "hidden">;
  };
}

export type ScreenView = "full" | "open_work" | "records" | "setup" | "hidden";

/**
 * Resolves the operational view for donor_assessment based on runtime establishment service status (rule:1af6af6a9c).
 */
export function getDonorAssessmentView(est: EstablishmentContext | null | undefined): ScreenView {
  if (!est) return "full";
  const views = est.views?.screens;
  if (Array.isArray(views)) {
    const s = views.find((item) => item.screen_id === "donor_assessment");
    if (s?.view) return s.view;
  } else if (views && typeof views === "object" && "donor_assessment" in views) {
    const v = views.donor_assessment;
    if (v) return v;
  }
  const isBloodCenterActive = est.active?.includes("blood_center");
  if (!isBloodCenterActive) return "records";
  return "full";
}

/**
 * Checks whether new donor assessments may be initiated (rule:21d2bc008e).
 * Only permitted when blood_center capability is Active and view is not 'open_work' or 'records'.
 */
export function canStartNewAssessment(
  est: EstablishmentContext | null | undefined,
  canAssess: boolean,
): boolean {
  if (!canAssess) return false;
  if (!est) return true;
  const isBloodCenterActive = est.active.includes("blood_center");
  if (!isBloodCenterActive) return false;
  const view = getDonorAssessmentView(est);
  return view === "full";
}

/**
 * Verifies whether the staff member is a PMDC-registered doctor authorized to assess/defer donors (rule:2f34c9a08a).
 */
export function isDoctorAuthorizedForAssessment(user: {
  roles?: string[];
  registration?: string | null;
  designation?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  const isDoctorRole = roles.some((r) =>
    ["doctor", "clinical_specialist", "surgeon", "anaesthetist"].includes(r.toLowerCase()),
  );
  const reg = (user.registration || "").toUpperCase();
  const hasPmdc = reg.includes("PMDC") || reg.includes("PMC");
  return isDoctorRole || hasPmdc;
}

export interface DonorEligibilityCheck {
  eligible: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * PBTA minimums and normative bounds (rule:eee718a5dc):
 * - Age: 18 or older; first-time donor at most 60 (repeat donor up to 70)
 * - Weight: at least 50 kg
 * - Haemoglobin: >= 13.0 g/dL for men, >= 12.5 g/dL for women
 * - Blood pressure: Systolic 100-140 mmHg, Diastolic 60-90 mmHg
 * - Pulse: 60-100 bpm
 * - Temperature: 36.5°C to 37.5°C
 * - Donation interval: 90 days for men, 120 days for women (or check may_donate_from)
 */
export function evaluateDonorEligibility(
  donor: DonorOut | DonorDetailOut,
  form: Partial<DonationIn>,
  firstTimeDonor = false,
): DonorEligibilityCheck {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Deferrals in force
  if (donor.permanently_deferred) {
    issues.push("Permanently deferred donor: donation is strictly prohibited by law.");
  } else if (donor.deferred_now) {
    issues.push("Donor is currently deferred under an active temporary deferral.");
  }

  // Interval check
  if (donor.may_donate_from) {
    const today = new Date().toISOString().slice(0, 10);
    if (donor.may_donate_from > today) {
      issues.push(
        `Minimum donation interval not reached. Earliest eligible date is ${donor.may_donate_from}.`,
      );
    }
  }

  // Age checks
  if (donor.age_years < 18) {
    issues.push(`Donor age (${donor.age_years} yrs) is below legal minimum (18 yrs).`);
  } else if (firstTimeDonor && donor.age_years > 60) {
    issues.push(`First-time donor age (${donor.age_years} yrs) exceeds maximum allowable (60 yrs).`);
  } else if (donor.age_years > 70) {
    issues.push(`Donor age (${donor.age_years} yrs) exceeds maximum allowable (70 yrs).`);
  }

  // Weight check
  const weight = Number(form.weight_kg);
  if (!Number.isFinite(weight) || weight <= 0) {
    issues.push("Weight is required.");
  } else if (weight < 50) {
    issues.push(`Weight (${weight} kg) is below minimum safe threshold (50.0 kg).`);
  }

  // Haemoglobin check
  const hb = Number(form.hb_g_dl);
  if (!Number.isFinite(hb) || hb <= 0) {
    issues.push("Haemoglobin (Hb) reading is required.");
  } else {
    const minHb = donor.sex === "Female" ? 12.5 : 13.0;
    if (hb < minHb) {
      issues.push(
        `Haemoglobin (${hb} g/dL) is below PBTA standard for ${donor.sex} (${minHb} g/dL).`,
      );
    }
  }

  // Vital signs checks (warnings or issues depending on extremity)
  if (form.pulse !== null && form.pulse !== undefined) {
    const pulse = Number(form.pulse);
    if (pulse < 50 || pulse > 120) {
      issues.push(`Pulse (${pulse} bpm) is outside acceptable donor limits (50–120 bpm).`);
    } else if (pulse < 60 || pulse > 100) {
      warnings.push(`Pulse (${pulse} bpm) is outside normative resting range (60–100 bpm).`);
    }
  }

  if (form.bp_systolic !== null && form.bp_systolic !== undefined) {
    const sys = Number(form.bp_systolic);
    if (sys < 90 || sys > 160) {
      issues.push(`Systolic blood pressure (${sys} mmHg) is outside safe limits (90–160 mmHg).`);
    } else if (sys < 100 || sys > 140) {
      warnings.push(`Systolic blood pressure (${sys} mmHg) deviates from ideal range (100–140 mmHg).`);
    }
  }

  if (form.bp_diastolic !== null && form.bp_diastolic !== undefined) {
    const dia = Number(form.bp_diastolic);
    if (dia < 50 || dia > 100) {
      issues.push(`Diastolic blood pressure (${dia} mmHg) is outside safe limits (50–100 mmHg).`);
    } else if (dia < 60 || dia > 90) {
      warnings.push(`Diastolic blood pressure (${dia} mmHg) deviates from ideal range (60–90 mmHg).`);
    }
  }

  if (form.temperature_c !== null && form.temperature_c !== undefined) {
    const temp = Number(form.temperature_c);
    if (temp < 36.0 || temp > 37.8) {
      issues.push(`Body temperature (${temp}°C) indicates fever or hypothermia (safe 36.5–37.5°C).`);
    } else if (temp < 36.5 || temp > 37.5) {
      warnings.push(`Body temperature (${temp}°C) is borderline.`);
    }
  }

  return {
    eligible: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Validates assessment submission payload (rule:91e1708abe, rule:a8bf19300f).
 */
export function validateDonationAssessment(
  form: Partial<DonationIn>,
  donor: DonorOut | DonorDetailOut,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!form.donor_id) {
    errors.donor_id = "Donor must be selected.";
  }

  if (!form.donation_kind) {
    errors.donation_kind = "Donation kind (Voluntary, Replacement, Autologous) is required.";
  }

  if (!form.venue) {
    errors.venue = "Venue (BloodCenter or Camp) is required.";
  }

  if (form.venue === "Camp" && !form.venue_note?.trim()) {
    errors.venue_note = "Camp location note is required when venue is Camp.";
  }

  if (!form.history_completed) {
    errors.history_completed = "The donor health history questionnaire must be completed and reviewed.";
  }

  const weight = Number(form.weight_kg);
  if (!Number.isFinite(weight) || weight <= 0) {
    errors.weight_kg = "Valid weight in kg is required.";
  }

  const hb = Number(form.hb_g_dl);
  if (!Number.isFinite(hb) || hb <= 0) {
    errors.hb_g_dl = "Valid haemoglobin reading in g/dL is required.";
  }

  if (!form.hb_method) {
    errors.hb_method = "Haemoglobin testing method must be specified.";
  }

  if (!form.outcome) {
    errors.outcome = "Assessment outcome (Accepted or Deferred) must be decided.";
  } else if (form.outcome === "Accepted") {
    // Both consent and unpaid declaration MUST be separate checked boxes (rule:91e1708abe)
    if (!form.consent_signed) {
      errors.consent_signed =
        "The written informed consent must be signed by the donor prior to collection (rule:91e1708abe).";
    }
    if (!form.unpaid_declared) {
      errors.unpaid_declared =
        "The donor must declare in writing that donation is voluntary and without payment/compensation (the Act s.2(k)).";
    }
    if (donor.permanently_deferred || donor.deferred_now) {
      errors.outcome = "Cannot accept a donor who is under an active or permanent deferral (BLOOD_DONOR_DEFERRED).";
    }
  } else if (form.outcome === "Deferred") {
    if (!form.deferral) {
      errors.deferral = "Deferral particulars must be provided when outcome is Deferred.";
    } else {
      const defErrors = validateDeferralInput(form.deferral);
      if (!defErrors.valid) {
        Object.entries(defErrors.errors).forEach(([k, v]) => {
          errors[`deferral.${k}`] = v;
        });
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates deferral entry (rule:a8bf19300f).
 */
export function validateDeferralInput(
  deferral: Partial<DonorDeferralIn>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!deferral.kind) {
    errors.kind = "Deferral kind (Temporary or Permanent) is required.";
  }

  if (!deferral.reason?.trim() || deferral.reason.trim().length < 3) {
    errors.reason = "Clinical reason for deferral is required (minimum 3 characters).";
  }

  if (deferral.kind === "Temporary") {
    if (!deferral.deferred_until) {
      errors.deferred_until = "Last day of temporary deferral (deferred_until) is required.";
    } else {
      const today = new Date().toISOString().slice(0, 10);
      if (deferral.deferred_until <= today) {
        errors.deferred_until = "Temporary deferral end date must be in the future.";
      }
    }
  }

  if (deferral.told) {
    const tellErrors = validateDonorTellInput(deferral.told);
    if (!tellErrors.valid) {
      Object.entries(tellErrors.errors).forEach(([k, v]) => {
        errors[`told.${k}`] = v;
      });
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates communication of deferral to donor (PBTA Act s.10(2)(e)).
 */
export function validateDonorTellInput(
  told: Partial<DonorTellIn>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!told.communication) {
    errors.communication = "Communication method (InPerson, Phone, or Letter) is required.";
  }

  if (!told.communicated_at) {
    errors.communicated_at = "Communication timestamp is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates deferral revocation reason (rule:d8cd988a65).
 */
export function validateRevokeDeferral(reason: string): { valid: boolean; error?: string } {
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length < 5) {
    return {
      valid: false,
      error: "Detailed explanation of why the deferral was entered in error is required (min 5 characters).",
    };
  }
  return { valid: true };
}

/**
 * Standard PBTA clinical guidance categories for deferrals (displayed as selectable aids, not hard limits).
 */
export const PBTA_TEMPORARY_DEFERRAL_GUIDANCE = [
  { reason: "Low haemoglobin (< 13.0 g/dL male, < 12.5 g/dL female)", defaultDays: 30 },
  { reason: "Underweight (< 50 kg)", defaultDays: 60 },
  { reason: "Recent antibiotic therapy", defaultDays: 14 },
  { reason: "Dental extraction / minor oral surgery", defaultDays: 3 },
  { reason: "Major surgery", defaultDays: 365 },
  { reason: "Treated malaria (completion of full treatment course)", defaultDays: 90 },
  { reason: "Recent tattoo, body piercing or scarification", defaultDays: 180 },
  { reason: "Recent vaccination (attenuated live virus)", defaultDays: 28 },
  { reason: "Pregnancy or lactation (post-delivery)", defaultDays: 180 },
  { reason: "Blood transfusion recipient", defaultDays: 365 },
  { reason: "Elevated blood pressure or abnormal resting pulse", defaultDays: 14 },
  { reason: "Acute febrile illness or respiratory infection", defaultDays: 14 },
];

export const PBTA_PERMANENT_DEFERRAL_GUIDANCE = [
  { reason: "Confirmed reactive TTI screening: Hepatitis B (HBsAg)" },
  { reason: "Confirmed reactive TTI screening: Hepatitis C (Anti-HCV)" },
  { reason: "Confirmed reactive TTI screening: HIV-1/2 (Anti-HIV)" },
  { reason: "Confirmed syphilis / Treponema pallidum infection" },
  { reason: "Severe cardiovascular disease / coronary artery disease / cardiomyopathy" },
  { reason: "Chronic renal failure or glomerulonephritis" },
  { reason: "Chronic liver disease or cirrhosis" },
  { reason: "History of malignancy or lymphoproliferative disorder" },
  { reason: "Coagulopathy or bleeding disorder" },
  { reason: "Insulin-dependent diabetes mellitus with vascular complications" },
];
