/**
 * Domain policy and business rules for Blood Donors screen (`blood_donors`, Screen 76).
 * Adheres to PBTA Standards ch.2 S.1.1 and Haspataal MCP contracts.
 */

export interface DonorAccessPolicyInput {
  establishmentActive?: string[];
  screenView?: 'full' | 'open_work' | 'records' | 'setup' | 'hidden';
  permissions?: string[];
}

export interface DonorAccessPolicyResult {
  canView: boolean;
  canRegister: boolean;
  canUpdate: boolean;
  canDonate: boolean;
  isRetiring: boolean;
  isReadOnly: boolean;
  retiringBannerText?: string;
  reason?: string;
}

/**
 * Access policy evaluator for Blood Donors (`rule:6a58b93e99`, `rule:5850958062`).
 */
export function evaluateDonorAccessPolicy(input: DonorAccessPolicyInput): DonorAccessPolicyResult {
  const permissions = input.permissions ?? [];
  const screenView = input.screenView ?? 'full';
  const activeCapabilities = input.establishmentActive ?? [];

  const hasViewPerm = permissions.includes('blood_center.view');
  const hasRegisterPerm = permissions.includes('blood_center.donor.register');
  const isCapabilityActive = activeCapabilities.includes('blood_center');

  if (screenView === 'hidden') {
    return {
      canView: false,
      canRegister: false,
      canUpdate: false,
      canDonate: false,
      isRetiring: false,
      isReadOnly: true,
      reason: 'Blood center service is hidden for this establishment.',
    };
  }

  const isRetiring = screenView === 'open_work';
  const isReadOnly = screenView === 'records';

  // Rule 5850958062: POST /blood-center/donors starts new blood_center work; offer only while blood_center is Active
  const canRegister = hasRegisterPerm && isCapabilityActive && screenView === 'full';

  // Corrections to existing donors can be performed while active or in records/open_work if user has permission
  const canUpdate = hasRegisterPerm && !isReadOnly;

  const canView = hasViewPerm;

  return {
    canView,
    canRegister,
    canUpdate,
    canDonate: false, // Donors cannot donate if permanently deferred or deferred now; checked per donor
    isRetiring,
    isReadOnly,
    retiringBannerText: isRetiring ? 'No new donor registrations from now on' : undefined,
  };
}

/**
 * Search validation rule (`rule:71bc3f69b3`).
 * Search first (q, at least 2 characters: donor number, CNIC, mobile, or part of name).
 */
export function validateDonorSearchQuery(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'Enter at least 2 characters to search donors (donor number, CNIC, phone, or name).',
    };
  }
  return { valid: true };
}

export interface DonorRegistrationInput {
  full_name: string;
  sex: 'Male' | 'Female' | '';
  date_of_birth: string;
  id_kind: 'CNIC' | 'Passport' | 'ProofOfRegistration' | 'Other' | '';
  id_number: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Register validation rule (`rule:40349aea7e`).
 * Requires name, sex, date of birth, identification, and at least one contact.
 */
export function validateDonorRegistration(input: DonorRegistrationInput): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.full_name || input.full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters.';
  } else if (input.full_name.trim().length > 200) {
    errors.full_name = 'Full name cannot exceed 200 characters.';
  }

  if (input.sex !== 'Male' && input.sex !== 'Female') {
    errors.sex = 'Sex must be specified as Male or Female.';
  }

  if (!input.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required.';
  } else {
    const dob = new Date(input.date_of_birth);
    if (isNaN(dob.getTime())) {
      errors.date_of_birth = 'Invalid date of birth.';
    } else {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 17) {
        errors.date_of_birth = 'Donor must be at least 17 years old.';
      } else if (age > 70) {
        errors.date_of_birth = 'Donor age exceeds typical maximum threshold (70 years).';
      }
    }
  }

  const validIdKinds = ['CNIC', 'Passport', 'ProofOfRegistration', 'Other'];
  if (!validIdKinds.includes(input.id_kind)) {
    errors.id_kind = 'Identification kind is required (CNIC, Passport, Proof of Registration, or Other).';
  }

  if (!input.id_number || input.id_number.trim().length < 4) {
    errors.id_number = 'Identification number must be at least 4 characters.';
  } else if (input.id_number.trim().length > 40) {
    errors.id_number = 'Identification number cannot exceed 40 characters.';
  }

  // At least one contact is required (rule:40349aea7e)
  const hasPhone = Boolean(input.phone && input.phone.trim().length > 0);
  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  const hasAddress = Boolean(input.address && input.address.trim().length > 0);

  if (!hasPhone && !hasEmail && !hasAddress) {
    errors.contact = 'At least one contact method (phone, email, or address) is required.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface DonorCorrectionInput {
  expected_version: number;
  reason: string;
  full_name?: string | null;
  sex?: 'Male' | 'Female' | null;
  date_of_birth?: string | null;
  id_kind?: 'CNIC' | 'Passport' | 'ProofOfRegistration' | 'Other' | null;
  id_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Correction validation rule (`rule:73b2977f2f`).
 * Requires changed fields, reason (5-500 chars), and expected_version. Donor number never changes.
 */
export function validateDonorCorrection(input: DonorCorrectionInput): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (typeof input.expected_version !== 'number' || input.expected_version < 1) {
    errors.expected_version = 'Valid expected version number is required for concurrency control.';
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.reason = 'Correction reason must be at least 5 characters.';
  } else if (input.reason.trim().length > 500) {
    errors.reason = 'Correction reason cannot exceed 500 characters.';
  }

  if (input.full_name !== undefined && input.full_name !== null) {
    if (input.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    }
  }

  if (input.id_number !== undefined && input.id_number !== null) {
    if (input.id_number.trim().length < 4) {
      errors.id_number = 'Identification number must be at least 4 characters.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface DonorEligibilityResult {
  canDonate: boolean;
  statusBadge: {
    label: string;
    variant: 'success' | 'warning' | 'danger';
  };
  explanation: string;
}

/**
 * Donor eligibility evaluator (`rule:d7bf9e8097`).
 * Shows deferred_now and may_donate_from; permanently_deferred: never 'Donate'.
 */
export function evaluateDonorEligibility(donor: {
  deferred_now: boolean;
  permanently_deferred: boolean;
  may_donate_from: string | null;
}): DonorEligibilityResult {
  if (donor.permanently_deferred) {
    return {
      canDonate: false,
      statusBadge: {
        label: 'Permanently Deferred',
        variant: 'danger',
      },
      explanation: 'This donor is permanently deferred and must never donate blood.',
    };
  }

  if (donor.deferred_now) {
    const until = donor.may_donate_from ? ` until ${donor.may_donate_from}` : '';
    return {
      canDonate: false,
      statusBadge: {
        label: 'Deferred Today',
        variant: 'warning',
      },
      explanation: `Donor has an active temporary deferral in force${until}.`,
    };
  }

  return {
    canDonate: true,
    statusBadge: {
      label: 'Eligible to Donate',
      variant: 'success',
    },
    explanation: 'Donor meets all deferral criteria and may donate blood today.',
  };
}
