import type { EstablishmentOut } from "./generated/facility_profile";
import type { TheaterBoardOut } from "./generated/ot_board";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for ot_board according to Rule cc0fcec2de.
 * Uses GET /establishment views.screens.ot_board. Never decides from facility category.
 */
export function getOtBoardScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "ot_board");
  if (screenEntry?.view) {
    return screenEntry.view;
  }

  // 2. Check surgery capability state
  const capabilities = establishment.capabilities || [];
  const surgeryCap = capabilities.find((c) => c.capability === "surgery");
  if (surgeryCap) {
    if (surgeryCap.state === "Active") return "full";
    if (surgeryCap.state === "Retiring") return "open_work";
    if (surgeryCap.state === "Retired") return "records";
    if (surgeryCap.state === "Preparing") return "setup";
    if (surgeryCap.state === "Available") return "hidden";
  }

  // 3. Check active capabilities
  if (establishment.active && !establishment.active.includes("surgery")) {
    return "setup";
  }

  return "full";
}

/**
 * Returns true if surgery capability is active in establishment.
 */
export function isSurgeryActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("surgery");
}

/**
 * Permission check for viewing the OT status board.
 */
export function canViewOtStatus(user: ClinicalUser | null | undefined): boolean {
  if (!user) return false;
  // If no explicit permissions array, allow authenticated users since ot_board is workspace "*" (airport-style board)
  if (!user.permissions || user.permissions.length === 0) return true;
  return (
    user.permissions.includes("ot.status.view") ||
    user.permissions.includes("ot.booking.view") ||
    user.permissions.includes("ot.booking.manage") ||
    user.permissions.includes("doctor.view") ||
    user.permissions.includes("ward.view")
  );
}

/**
 * Visual styling and metadata for each OT state under Rule 01511e9050.
 * 🟢 Available / 🔴 In-Surgery / 🟡 Cleaning-Prep / ⚠️ Emergency hold / ⚪ Out of Service
 */
export interface StateBadgeInfo {
  icon: string;
  label: string;
  labelUr: string;
  badgeClass: string;
  cardBorderClass: string;
}

export function getStateBadgeInfo(
  state: "Available" | "EmergencyHold" | "InSurgery" | "CleaningPrep" | "OutOfService" | string
): StateBadgeInfo {
  switch (state) {
    case "Available":
      return {
        icon: "🟢",
        label: "Available",
        labelUr: "دستیاب",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        cardBorderClass: "border-emerald-200 bg-white",
      };
    case "InSurgery":
      return {
        icon: "🔴",
        label: "In-Surgery",
        labelUr: "سرجری جاری ہے",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-bold",
        cardBorderClass: "border-rose-300 bg-rose-50/30",
      };
    case "CleaningPrep":
      return {
        icon: "🟡",
        label: "Cleaning-Prep",
        labelUr: "صفائی / تیاری",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 font-semibold",
        cardBorderClass: "border-amber-200 bg-amber-50/20",
      };
    case "EmergencyHold":
      return {
        icon: "⚠️",
        label: "Emergency Hold",
        labelUr: "ہنگامی ہولڈ",
        badgeClass: "bg-orange-100 text-orange-900 border-orange-400 font-bold",
        cardBorderClass: "border-orange-300 bg-orange-50/40",
      };
    case "OutOfService":
    default:
      return {
        icon: "⚪",
        label: "Out of Service",
        labelUr: "غیر فعال",
        badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
        cardBorderClass: "border-gray-200 bg-gray-50/50",
      };
  }
}

/**
 * Priority ordering for sorting operating theatres on the live board:
 * InSurgery -> EmergencyHold -> CleaningPrep -> Available -> OutOfService.
 */
export function sortTheatersForBoard(theaters: TheaterBoardOut[]): TheaterBoardOut[] {
  const priorityMap: Record<string, number> = {
    InSurgery: 1,
    EmergencyHold: 2,
    CleaningPrep: 3,
    Available: 4,
    OutOfService: 5,
  };

  return [...theaters].sort((a, b) => {
    const pA = priorityMap[a.current_state] ?? 99;
    const pB = priorityMap[b.current_state] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Formats time difference in minutes from now.
 */
export function formatDurationMinutes(startTimeIso: string | null): string {
  if (!startTimeIso) return "";
  const start = new Date(startTimeIso).getTime();
  const now = Date.now();
  const diffMinutes = Math.floor((now - start) / (60 * 1000));
  if (diffMinutes < 0) return "Starting soon";
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m elapsed`;
  }
  return `${mins}m elapsed`;
}

/**
 * Bilingual explanations for OT board errors.
 */
export function explainOtBoardError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    FORBIDDEN: {
      en: "You do not have permission to view the OT status board.",
      ur: "آپ کو آپریشن تھیٹر بورڈ دیکھنے کی اجازت نہیں ہے۔",
    },
    CAPABILITY_INACTIVE: {
      en: "Surgery service is inactive. OT board has no active data.",
      ur: "سرجری سروس غیر فعال ہے۔ او ٹی بورڈ پر کوئی ریکارڈ موجود نہیں ہے۔",
    },
    NETWORK_ERROR: {
      en: "Unable to reach the OT status service. Retrying...",
      ur: "او ٹی سٹیٹس سروس سے رابطہ نہیں ہو سکا۔ دوبارہ کوشش کی جا رہی ہے...",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please refresh the status board.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ براہ کرم بورڈ ریفریش کریں۔`,
    }
  );
}
