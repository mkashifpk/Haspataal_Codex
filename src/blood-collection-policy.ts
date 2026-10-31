import type { DonationCollectionIn, DonationOut } from './generated/blood_collection';

export type ScreenView = 'full' | 'open_work' | 'records' | 'setup' | 'hidden';

export interface ScreenViewItem {
  screen_id: string;
  view: ScreenView;
}

export interface EstablishmentContext {
  active?: string[];
  views?: {
    screens?: ScreenViewItem[] | Record<string, ScreenView>;
  };
}

/**
 * Determine the screen view mode for blood_collection based on GET /establishment views.screens.
 * rule:28291a1e73: Show it as GET /establishment views.screens says for screen_id blood_collection
 * (full; open_work: without its new work, with the banner "No new ... from now on"; records: history and corrections only;
 * setup: only from Facility settings; hidden: in no menu), after login and again on establishment.changed.
 * Never decide it from the profile's category.
 */
export function getBloodCollectionScreenView(
  establishment: EstablishmentContext | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return 'full';
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === 'blood_collection');
    return item ? item.view : 'full';
  }
  if (typeof screens === 'object' && 'blood_collection' in screens) {
    return (screens as Record<string, ScreenView>)['blood_collection'] ?? 'full';
  }
  return 'full';
}

/**
 * Checks whether the blood_center capability is active for this establishment.
 */
export function isBloodCenterActive(establishment: EstablishmentContext | null | undefined): boolean {
  if (!establishment?.active || !Array.isArray(establishment.active)) {
    return true; // default open if not specified
  }
  return establishment.active.includes('blood_center');
}

/**
 * Calculate the maximum allowable collection volume in mL according to PBTA Standards ch.2 S.3 & S.5:
 * At most 495 mL for weight >= 50 kg; for a donor under 50 kg, at most weight_kg * 9 mL + 10%.
 * (rule:368f4aace1)
 */
export function getMaxAllowableVolumeMl(weightKg: number): number {
  if (weightKg >= 50) {
    return 495;
  }
  return Math.min(495, Math.floor(weightKg * 9 * 1.1));
}

/**
 * Checks if a donation's medical assessment has expired (> 24 hours since attendance/assessment).
 * (rule:834ffec14a)
 */
export function isAssessmentExpired(attendedAtStr: string, now: Date = new Date()): boolean {
  const attendedAt = new Date(attendedAtStr);
  if (isNaN(attendedAt.getTime())) return false;
  const elapsedMs = now.getTime() - attendedAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return elapsedHours > 24;
}

/**
 * Common PBTA Adverse Reactions categories.
 */
export const DONOR_REACTIONS = [
  { value: 'None', labelEn: 'None (Uncomplicated)', labelUr: 'کوئی نہیں (معمول کے مطابق)' },
  { value: 'Vasovagal', labelEn: 'Vasovagal Syncope / Dizziness', labelUr: 'چکر / غشی (واسوویگل)' },
  { value: 'Haematoma', labelEn: 'Haematoma / Bruise', labelUr: 'خون جمنا / نیل (ہیماٹوما)' },
  { value: 'Convulsions', labelEn: 'Convulsions / Twitching', labelUr: 'جھٹکے / اینٹھن' },
  { value: 'Vomiting', labelEn: 'Nausea / Vomiting', labelUr: 'متلی / الٹی' },
  { value: 'Tetany', labelEn: 'Hyperventilation / Tetany', labelUr: 'ہانپنا / کھچاؤ' },
  { value: 'LocalAllergic', labelEn: 'Local Allergic Reaction / Rash', labelUr: 'مقامی الرجی / خارش' },
  { value: 'Severe', labelEn: 'Severe Reaction (Mandatory Incident)', labelUr: 'شدید ردعمل (لازمی واقعہ رپورٹ)' },
  { value: 'Other', labelEn: 'Other Adverse Event', labelUr: 'دیگر ردعمل' },
] as const;

export const REACTION_HARMS = [
  { value: 'NoHarm', labelEn: 'No Harm', labelUr: 'کوئی نقصان نہیں' },
  { value: 'Mild', labelEn: 'Mild Harm', labelUr: 'ہلکا نقصان' },
  { value: 'Moderate', labelEn: 'Moderate Harm', labelUr: 'درمیانہ نقصان' },
  { value: 'Severe', labelEn: 'Severe Harm', labelUr: 'شدید نقصان' },
  { value: 'Death', labelEn: 'Death / Fatal', labelUr: 'وفات' },
] as const;

export const BAG_TYPES = [
  { value: 'Single', labelEn: 'Single Bag (Whole Blood)', labelUr: 'سنگل بیگ (ہول بلڈ)', bagLabels: 1 },
  { value: 'Double', labelEn: 'Double Bag (PRBC + Plasma)', labelUr: 'ڈبل بیگ (پی آر بی سی + پلازما)', bagLabels: 2 },
  { value: 'Triple', labelEn: 'Triple Bag (PRBC + Platelets + Plasma)', labelUr: 'ٹرپل بیگ (پلیٹ لیٹس + پلازما)', bagLabels: 3 },
  { value: 'Quadruple', labelEn: 'Quadruple Bag (PRBC + Platelets + Cryo + Plasma)', labelUr: 'کواڈرپل بیگ (کرائیو + پلیٹ لیٹس)', bagLabels: 4 },
] as const;

export const COMMON_ANTICOAGULANTS = [
  'CPDA-1',
  'SAGM',
  'ACD-A',
  'CPD',
  'CP2D',
];

export const COMMON_UNSUCCESSFUL_REASONS = [
  'Vein collapsed / poor venous flow',
  'Haematoma formed at venepuncture site',
  'Arterial puncture suspected - immediate release',
  'Donor distress / requested premature cessation',
  'Severe vasovagal syncope before completion',
  'Blood bag or tubing defect / leak',
  'Clotting in collection line',
];

export interface CollectionValidationErrors {
  bag_type?: string;
  bag_lot?: string;
  anticoagulant?: string;
  started_at?: string;
  ended_at?: string;
  volume_ml?: string;
  unsuccessful_reason?: string;
  reaction_action?: string;
  reaction_harm?: string;
}

/**
 * Validates collection input against PBTA guidelines and server cross-field constraints.
 */
export function validateCollectionInput(
  input: DonationCollectionIn,
  donation: DonationOut
): { valid: boolean; errors: CollectionValidationErrors } {
  const errors: CollectionValidationErrors = {};

  if (input.outcome === 'Collected') {
    if (!input.bag_type) {
      errors.bag_type = 'Please select a blood bag type.';
    }
    if (!input.bag_lot || !input.bag_lot.trim()) {
      errors.bag_lot = 'Blood bag lot barcode/number is required.';
    } else if (input.bag_lot.length > 60) {
      errors.bag_lot = 'Bag lot must be 60 characters or less.';
    }
    if (!input.anticoagulant || !input.anticoagulant.trim()) {
      errors.anticoagulant = 'Anticoagulant solution is required (e.g. CPDA-1).';
    }

    if (!input.started_at) {
      errors.started_at = 'Collection start time is required.';
    }
    if (!input.ended_at) {
      errors.ended_at = 'Collection end time is required.';
    }
    if (input.started_at && input.ended_at) {
      const s = new Date(input.started_at).getTime();
      const e = new Date(input.ended_at).getTime();
      if (e < s) {
        errors.ended_at = 'Collection end time cannot be earlier than start time.';
      }
      if (donation.attended_at) {
        const att = new Date(donation.attended_at).getTime();
        if (s < att) {
          errors.started_at = 'Collection cannot start before donor assessment attendance.';
        }
      }
    }

    const maxVol = getMaxAllowableVolumeMl(donation.weight_kg);
    if (input.volume_ml === undefined || input.volume_ml === null || isNaN(input.volume_ml)) {
      errors.volume_ml = 'Collected volume is required.';
    } else if (input.volume_ml < 1) {
      errors.volume_ml = 'Collected volume must be at least 1 mL.';
    } else if (input.volume_ml > maxVol) {
      errors.volume_ml = `Volume exceeds maximum allowable limit (${maxVol} mL for donor weight ${donation.weight_kg} kg).`;
    }
  } else if (input.outcome === 'Unsuccessful') {
    if (!input.unsuccessful_reason || !input.unsuccessful_reason.trim()) {
      errors.unsuccessful_reason = 'Please explain why the collection was unsuccessful.';
    } else if (input.unsuccessful_reason.trim().length < 3) {
      errors.unsuccessful_reason = 'Unsuccessful reason must be at least 3 characters.';
    }
  }

  // Adverse reaction checks
  if (input.donor_reaction && input.donor_reaction !== 'None') {
    if (!input.reaction_action || !input.reaction_action.trim()) {
      errors.reaction_action = 'Action taken for donor reaction is required.';
    }
    if (input.donor_reaction === 'Severe') {
      if (!input.reaction_harm) {
        errors.reaction_harm = 'Harm severity is required for Severe reaction (dispatches Incident Report).';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Sorts accepted donations for phlebotomy worklist: oldest waiting first.
 * (rule:6282d69357)
 */
export function sortDonationsOldestFirst(donations: DonationOut[]): DonationOut[] {
  return [...donations].sort((a, b) => {
    const timeA = new Date(a.attended_at).getTime() || 0;
    const timeB = new Date(b.attended_at).getTime() || 0;
    return timeA - timeB;
  });
}
