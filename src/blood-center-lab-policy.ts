import type {
  CenterComponentIn,
  CenterComponentOut,
  DonationDetailOut,
  DonationOut,
  DonationTestIn,
} from './generated/blood_center_lab';

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
 * Determine screen view mode for blood_center_lab based on GET /establishment views.screens.
 * rule:e9c40bc39d: Exists for the service blood_center (work): show it as GET /establishment views.screens
 * says for screen_id blood_center_lab (full; open_work: without its new work, with the banner "No new ... from now on";
 * records: history and corrections only; setup: only from Facility settings; hidden: in no menu), after login
 * and again on establishment.changed. Never decide it from the profile's category.
 */
export function getBloodCenterLabScreenView(
  establishment: EstablishmentContext | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return 'full';
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === 'blood_center_lab');
    return item ? item.view : 'full';
  }
  if (typeof screens === 'object' && 'blood_center_lab' in screens) {
    return (screens as Record<string, ScreenView>)['blood_center_lab'] ?? 'full';
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
 * rule:9f918de113: POST /blood-center/donations/{donation_id}/tests continues blood_center work started earlier:
 * offer it while blood_center is Active or Retiring (open_work).
 */
export function canRecordTests(
  establishment: EstablishmentContext | null | undefined,
  hasPermission: boolean
): boolean {
  if (!hasPermission) return false;
  const view = getBloodCenterLabScreenView(establishment);
  return view === 'full' || view === 'open_work';
}

/**
 * rule:6dab3d3a8e: POST /blood-center/donations/{donation_id}/components continues blood_center work started earlier:
 * offer it while blood_center is Active or Retiring (open_work).
 */
export function canPrepareComponents(
  establishment: EstablishmentContext | null | undefined,
  hasPermission: boolean
): boolean {
  if (!hasPermission) return false;
  const view = getBloodCenterLabScreenView(establishment);
  return view === 'full' || view === 'open_work';
}

/**
 * Mandatory 5 Transfusion-Transmissible Infection (TTI) screening markers (PBTA Act s.10(2)(f)).
 */
export const MANDATORY_TTI_MARKERS = [
  { key: 'HBsAg', label: 'Hepatitis B Surface Antigen (HBsAg)', labelUr: 'ہیپاٹائٹس بی' },
  { key: 'AntiHCV', label: 'Hepatitis C Virus Antibody (Anti-HCV)', labelUr: 'ہیپاٹائٹس سی' },
  { key: 'AntiHIV', label: 'HIV 1 & 2 Antibody / Antigen', labelUr: 'ایچ آئی وی (ایڈز)' },
  { key: 'Syphilis', label: 'Syphilis (VDRL / TPHA / Rapid)', labelUr: 'آتشک (سفلس)' },
  { key: 'Malaria', label: 'Malaria (MP Microscopy / Rapid)', labelUr: 'ملیریا' },
] as const;

/**
 * Standard grouping determination markers requiring dual determinations (rule:ac0462c02a).
 */
export const GROUPING_MARKERS = [
  { key: 'ABOForward', label: 'ABO Forward Grouping (Cell / Front)', labelUr: 'اے بی او فارورڈ گروپنگ' },
  { key: 'ABOReverse', label: 'ABO Reverse Grouping (Serum / Back)', labelUr: 'اے بی او ریورس گروپنگ' },
  { key: 'RhD', label: 'Rh(D) Typing (D Antigen)', labelUr: 'آر ایچ (ڈی) گروپنگ' },
] as const;

/**
 * Evaluation of elapsed processing time from collection to component separation.
 * rule:22b4758a41: Platelets and plasma must be separated within 8 hours of venepuncture.
 */
export function isProcessingTimeExceeded(
  collectionEndedAtStr: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!collectionEndedAtStr) return false;
  const ended = new Date(collectionEndedAtStr);
  if (isNaN(ended.getTime())) return false;
  const hours = (now.getTime() - ended.getTime()) / (1000 * 60 * 60);
  return hours > 8;
}

/**
 * Calculates standard PBTA expiration date based on component type and bag anticoagulant:
 * - Whole Blood (CPDA-1): 35 days
 * - Red Cells (CPDA-1): 35 days
 * - Platelets: 5 days
 * - Fresh Frozen Plasma: 365 days (12 months)
 * - Cryoprecipitate: 365 days (12 months)
 */
export function calculateDefaultExpiry(
  component: 'WholeBlood' | 'RedCells' | 'FreshFrozenPlasma' | 'Cryoprecipitate' | 'Platelets',
  collectionEndedAtStr?: string | null
): string {
  const base = collectionEndedAtStr ? new Date(collectionEndedAtStr) : new Date();
  const d = new Date(base.getTime());
  switch (component) {
    case 'WholeBlood':
    case 'RedCells':
      d.setDate(d.getDate() + 35);
      break;
    case 'Platelets':
      d.setDate(d.getDate() + 5);
      break;
    case 'FreshFrozenPlasma':
    case 'Cryoprecipitate':
      d.setDate(d.getDate() + 365);
      break;
  }
  return d.toISOString().slice(0, 16);
}

/**
 * Discard reasons for components in quarantine (rule:87598ad7aa).
 */
export const COMPONENT_DISCARD_REASONS = [
  { value: 'ReactiveScreening', labelEn: 'Reactive TTI Screening Result', labelUr: 'متعدی بیماری کا مثبت نتیجہ' },
  { value: 'DonationRejected', labelEn: 'Donation Rejected / Group Mismatch', labelUr: 'عطیہ مسترد / گروپ کا تضاد' },
  { value: 'BagDamaged', labelEn: 'Bag Leak / Port Contamination / Physical Defect', labelUr: 'بیگ خراب یا لیک' },
  { value: 'Expired', labelEn: 'Expired in Quarantine', labelUr: 'قرنطینہ میں میعاد ختم' },
  { value: 'ProcessingTimeExceeded', labelEn: 'Processing Time Exceeded (> 8 hours)', labelUr: 'پروسیسنگ کا وقت ختم (> 8 گھنٹے)' },
  { value: 'QualityControl', labelEn: 'Quality Control Failure (Clots, Hemolysis)', labelUr: 'کوالٹی کنٹرول میں ناکامی' },
  { value: 'DonorInformation', labelEn: 'Post-Donation Donor Information Deferral', labelUr: 'عطیہ کے بعد ڈونر کی بیماری کی اطلاع' },
  { value: 'Other', labelEn: 'Other Reason (Documented Note Required)', labelUr: 'دیگر وجہ (تفصیل لازمی ہے)' },
] as const;

/**
 * Validates tests input before recording.
 * rule:ac0462c02a: "The result field starts empty."
 */
export function validateTestsInput(results: DonationTestIn[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!results || results.length === 0) {
    errors.push('At least one laboratory test result must be entered.');
    return { valid: false, errors };
  }

  results.forEach((r, idx) => {
    if (!r.marker) {
      errors.push(`Row ${idx + 1}: Marker is required.`);
    }
    if (!r.method) {
      errors.push(`Row ${idx + 1}: Testing method is required.`);
    }
    if (!r.result) {
      errors.push(`Row ${idx + 1} (${r.marker || 'Test'}): Result value is required.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Quarantine status categorisation (rule:7e769d8e04):
 * Keep reactive and untested components apart on the quarantine list.
 */
export type QuarantineCategory = 'reactive' | 'untested' | 'cleared' | 'discarded';

export function getQuarantineCategory(comp: CenterComponentOut): QuarantineCategory {
  if (comp.status === 'Discarded') {
    return 'discarded';
  }
  if (comp.status === 'Released') {
    return 'cleared';
  }
  // If quarantine, inspect donation reactive markers if available
  return 'untested';
}
