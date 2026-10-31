/**
 * Domain policy and business rules for Medication Safety Board
 * (`medication_safety_ward`, Screen 86).
 * Implements Punjab Healthcare Commission (PHC) MSDS Standards:
 * - MSDS MOM 51-71, AAC 30, COP 37.
 * - Medication safety worklist across 7 risk categories (rule:b9e1768945):
 *   1. NoWristband (patients without active wristband)
 *   2. OwnMedicineToIdentify (patient's own medicines needing verification)
 *   3. OwnMedicineToHandBack (own medicines to hand back upon discharge)
 *   4. ExpiredWardStock (expired items in ward floor stock)
 *   5. RecallOpen (open drug recalls affecting ward)
 *   6. VerbalOrderToCountersign (verbal orders needing doctor co-signature)
 *   7. QueryOpen (open pharmacy queries on ward orders)
 * - High-alert medicines, restricted medicines, and LASA pairs (rule:a810f77980).
 * - High-alert nursing station PDF and hospital medication policy PDF (MSDS 56 ii).
 * - Service capability gating and views for service inpatient (rule:d8f589b50a).
 */

import type {
  MedicationWorklistItemOut,
  HighAlertListOut,
  HighAlertCategoryOut,
  SafetyDrugOut,
  LasaPairOut,
} from "./generated/medication_safety_ward";
import type { EstablishmentOut } from "./generated/facility_profile";

export type ScreenView = "full" | "open_work" | "records" | "setup" | "hidden";

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
 * Determines screen view mode for `medication_safety_ward` (rule:d8f589b50a).
 */
export function getMedicationSafetyWardScreenView(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): ScreenView {
  if (!establishment?.views?.screens) {
    return "full";
  }
  const screens = establishment.views.screens;
  if (Array.isArray(screens)) {
    const item = screens.find((s) => s.screen_id === "medication_safety_ward");
    return item ? (item.view as ScreenView) : "full";
  }
  if (typeof screens === "object" && "medication_safety_ward" in screens) {
    return (screens as Record<string, ScreenView>)["medication_safety_ward"] ?? "full";
  }
  return "full";
}

/**
 * Checks whether the hospital's inpatient capability is currently Active.
 */
export function isInpatientActive(
  establishment: EstablishmentContext | EstablishmentOut | null | undefined
): boolean {
  return Array.isArray(establishment?.active) && establishment.active.includes("inpatient");
}

export type SafetyItemKind =
  | "VerbalOrderToCountersign"
  | "QueryOpen"
  | "NoWristband"
  | "OwnMedicineToIdentify"
  | "OwnMedicineToHandBack"
  | "RecallOpen"
  | "ExpiredWardStock";

export interface SafetyKindMeta {
  code: SafetyItemKind;
  labelEn: string;
  labelUr: string;
  icon: string;
  color: string;
  bgLight: string;
  borderColor: string;
  targetScreen?: string;
  descriptionEn: string;
  descriptionUr: string;
}

export const SAFETY_KINDS_META: Record<SafetyItemKind, SafetyKindMeta> = {
  NoWristband: {
    code: "NoWristband",
    labelEn: "Missing Wristband",
    labelUr: "کلائی بینڈ غائب",
    icon: "🏷️",
    color: "#b45309",
    bgLight: "#fef3c7",
    borderColor: "#fde68a",
    targetScreen: "wristbands_ward",
    descriptionEn: "Admitted or emergency patient without an active barcode wristband",
    descriptionUr: "داخل یا ایمرجنسی مریض جس کے پاس فعال شناختی کلائی بینڈ موجود نہیں",
  },
  VerbalOrderToCountersign: {
    code: "VerbalOrderToCountersign",
    labelEn: "Verbal Order Unsigned",
    labelUr: "زبانی آرڈر غیر تصدیق شدہ",
    icon: "📞",
    color: "#c2410c",
    bgLight: "#ffedd5",
    borderColor: "#fed7aa",
    targetScreen: "verbal_orders_ward",
    descriptionEn: "Emergency verbal order awaiting prescribing doctor countersignature",
    descriptionUr: "ہنگامی زبانی آرڈر جس پر ڈاکٹر کے تصدیقی دستخط تاحال باقی ہیں",
  },
  QueryOpen: {
    code: "QueryOpen",
    labelEn: "Pharmacy Query Open",
    labelUr: "فارمیسی سوال زیر التواء",
    icon: "❓",
    color: "#4338ca",
    bgLight: "#e0e7ff",
    borderColor: "#c7d2fe",
    targetScreen: "order_queries",
    descriptionEn: "Clinical query from pharmacy regarding dose, allergy or interaction",
    descriptionUr: "خوراک، الرجی یا تضاد پر فارماسسٹ کا طبی سوال",
  },
  OwnMedicineToIdentify: {
    code: "OwnMedicineToIdentify",
    labelEn: "Own Medicine Verification",
    labelUr: "مریض کی ذاتی دوائی کی تصدیق",
    icon: "💊",
    color: "#7e22ce",
    bgLight: "#f3e8ff",
    borderColor: "#e9d5ff",
    targetScreen: "own_medicines_ward",
    descriptionEn: "Patient-brought home medicine requires nurse/pharmacist identification",
    descriptionUr: "گھر سے لائی گئی ادویات کی جانچ اور محفوظ استعمال کی تصدیق درکار ہے",
  },
  OwnMedicineToHandBack: {
    code: "OwnMedicineToHandBack",
    labelEn: "Hand Back at Discharge",
    labelUr: "ڈسچارج پر دوائی واپسی",
    icon: "📦",
    color: "#1d4ed8",
    bgLight: "#eff6ff",
    borderColor: "#bfdbfe",
    targetScreen: "own_medicines_ward",
    descriptionEn: "Safekept home medicine to return to patient/family upon discharge",
    descriptionUr: "ہسپتال میں محفوظ رکھی گئی ادویات ڈسچارج پر مریض یا لواحقین کو واپس کرنی ہیں",
  },
  RecallOpen: {
    code: "RecallOpen",
    labelEn: "Active Drug Recall",
    labelUr: "دوائی کا سرکاری ری کال",
    icon: "🚨",
    color: "#b91c1c",
    bgLight: "#fee2e2",
    borderColor: "#fecaca",
    targetScreen: "rx_queue",
    descriptionEn: "Safety alert or batch recall issued by DRAP/hospital pharmacy",
    descriptionUr: "ڈریپ یا ہسپتال فارمیسی کی طرف سے بیچ یا ادویات کی فوری واپسی کا حکم",
  },
  ExpiredWardStock: {
    code: "ExpiredWardStock",
    labelEn: "Expired Ward Stock",
    labelUr: "وارڈ سٹاک کی معیاد ختم",
    icon: "⚠️",
    color: "#be123c",
    bgLight: "#ffe4e6",
    borderColor: "#fecdd3",
    descriptionEn: "Expired medicine or consumable in ward cabinet requires removal",
    descriptionUr: "وارڈ کی کیبنٹ میں ایکسپائر شدہ ادویات کو فوری الگ کر کے واپس کرنا ہے",
  },
};

/**
 * Calculates worklist counts grouped by safety kind.
 */
export function calculateSafetyWorklistCounts(
  items: MedicationWorklistItemOut[]
): Record<SafetyItemKind | "Total" | "Overdue", number> {
  const counts: Record<SafetyItemKind | "Total" | "Overdue", number> = {
    NoWristband: 0,
    VerbalOrderToCountersign: 0,
    QueryOpen: 0,
    OwnMedicineToIdentify: 0,
    OwnMedicineToHandBack: 0,
    RecallOpen: 0,
    ExpiredWardStock: 0,
    Total: items.length,
    Overdue: 0,
  };

  for (const item of items) {
    if (item.kind in counts) {
      counts[item.kind]++;
    }
    if (item.is_overdue) {
      counts.Overdue++;
    }
  }

  return counts;
}

/**
 * Filters safety worklist items by ward ID, kind, and overdue status.
 */
export function filterSafetyWorklist(
  items: MedicationWorklistItemOut[],
  options?: {
    wardId?: number | null;
    kind?: SafetyItemKind | "All";
    overdueOnly?: boolean;
    searchQuery?: string;
  }
): MedicationWorklistItemOut[] {
  return items.filter((item) => {
    if (options?.wardId && item.ward_id !== null && item.ward_id !== options.wardId) {
      return false;
    }
    if (options?.kind && options.kind !== "All" && item.kind !== options.kind) {
      return false;
    }
    if (options?.overdueOnly && !item.is_overdue) {
      return false;
    }
    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase().trim();
      const matchName = item.patient_name?.toLowerCase().includes(q) ?? false;
      const matchMrn = item.mrn?.toLowerCase().includes(q) ?? false;
      const matchTitle = item.title?.toLowerCase().includes(q) ?? false;
      const matchDetail = item.detail?.toLowerCase().includes(q) ?? false;
      const matchBed = item.bed_label?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchMrn && !matchTitle && !matchDetail && !matchBed) {
        return false;
      }
    }
    return true;
  });
}

/**
 * High-alert drug category descriptions and safety notes (MSDS 56 ii).
 */
export const HIGH_ALERT_CATEGORY_NOTES: Record<string, { en: string; ur: string }> = {
  ConcentratedElectrolyte: {
    en: "Fatal if infused directly. Dilute before infusion. Never store in open ward trays.",
    ur: "براہ راست لگانے پر جان لیوا۔ فوری ڈائلیوٹ کریں۔ کھلی ٹرے میں نہ رکھیں۔",
  },
  Insulin: {
    en: "High risk of severe hypoglycaemia. Dual independent verification of dose and units required.",
    ur: "شدید شوگر کمی کا خطرہ۔ خوراک اور یونٹس کی دوہری آزادانہ تصدیق لازمی ہے۔",
  },
  Anticoagulant: {
    en: "High risk of haemorrhage. Verify INR/aPTT and confirm target dose before administration.",
    ur: "خون بہنے کا خطرہ۔ دوا دینے سے قبل لیب رپورٹ اور خوراک کی تصدیق کریں۔",
  },
  Opioid: {
    en: "Risk of respiratory depression and arrest. Ensure naloxone is readily accessible.",
    ur: "سانس رکنے کا خطرہ۔ ایمرجنسی میں نیلوکسون دستیابی یقینی بنائیں۔",
  },
  NeuromuscularBlocker: {
    en: "Causes respiratory paralysis. Administer only with mechanical ventilation support.",
    ur: "پٹھوں اور سانس کا مکمل فالج۔ صرف وینٹی لیٹر سپورٹ کے دوران استعمال کریں۔",
  },
  Chemotherapy: {
    en: "Cytotoxic hazards. Handle with protective personal equipment and specialized infusion sets.",
    ur: "خلیات کے لیے زہریلا اثر۔ حفاظتی دستانوں اور خصوصی انفیوژن سیٹ کے ساتھ لگائیں۔",
  },
  Inotrope: {
    en: "Potent vasoactive agents. Administer via dedicated central line with automated infusion pump.",
    ur: "طاقتور عروقی اثرات۔ صرف انفیوژن پمپ اور مخصوص سینٹرل لائن سے دیں۔",
  },
  Sedative: {
    en: "Monitored conscious sedation. Continuous pulse oximetry and airway monitoring required.",
    ur: "مسکن ادویات۔ نبض اور سانس کی مسلسل مانیٹرنگ درکار ہے۔",
  },
};
