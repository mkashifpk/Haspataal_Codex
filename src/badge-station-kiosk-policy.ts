/**
 * Domain policy and statutory business rules for Screen 157: badge_station_kiosk
 * Workspace: badge_station
 *
 * Statutory Rules:
 * - rule:f98f89a7b6: Configure once with the station id and its key (X-Station-Key); never show the key.
 * - rule:141cb8255f: A USB scanner types the code and Enter: keep an invisible input focused; or decode the camera stream.
 * - rule:b2f4ebb077: needs_bed_code: collect two scans (bed sticker HMS-BED-… and badge) within 60 s, then post them together.
 * - rule:2554916922: Big green / red result with the outcome in words and a sound; ready for the next person after 3 s.
 * - rule:438ca845ec: Queue scans with a gateway_event_id while the server is unreachable and resend them (retries are idempotent).
 */

import type { ScanIn, BadgeScanResultOut, DirtyBedOut, StationProfileOut } from "./generated/badge_station_kiosk.ts";

export interface StationConfig {
  station_id: string;
  station_key: string;
}

export interface DualScanState {
  status: "idle" | "waiting_for_badge" | "waiting_for_bed" | "complete" | "expired";
  bed_code: string | null;
  badge_code: string | null;
  started_at: number | null; // epoch ms
  expires_at: number | null; // epoch ms
  seconds_left: number;
}

export type OutcomeTone = "success" | "danger" | "warning";
// A queued scan has no business outcome until the server confirms it.
export type KioskDisplayOutcome = BadgeScanResultOut["outcome"] | "Queued";

export function shouldQueueStationScan(error: unknown): boolean {
  const reply = (error as { response?: { status?: number; error?: { code?: string } } })?.response;
  // ApiError wraps the secure bridge reply; HTTP refusals are never network failures.
  if (reply?.status) return reply.status >= 500;
  return ["OFFLINE", "NETWORK_ERROR", "TIMEOUT"].includes(reply?.error?.code ?? "");
}

/**
 * Validate station setup configuration.
 * Station ID must be 2-64 chars (alphanumeric with _.:-).
 * Station key must not be blank.
 */
export function validateStationSetup(stationId: string, stationKey: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmedId = stationId.trim();
  const trimmedKey = stationKey.trim();

  if (!trimmedId) {
    errors.push("Station ID is required.");
  } else if (!/^[A-Za-z0-9_.:-]{2,64}$/.test(trimmedId)) {
    errors.push("Station ID must be 2-64 alphanumeric characters (may include _ . : -).");
  }

  if (!trimmedKey) {
    errors.push("Station Key (X-Station-Key) is required.");
  } else if (trimmedKey.length < 4) {
    errors.push("Station Key must be at least 4 characters long.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * rule:f98f89a7b6: Configure once with the station id and its key (X-Station-Key); never show the key.
 * Masks key for display so secret material is never exposed on the kiosk terminal.
 */
export function maskStationKey(key: string): string {
  if (!key) return "••••••••";
  if (key.length <= 4) return "••••";
  return "•".repeat(Math.min(key.length, 12));
}

/**
 * rule:438ca845ec: Generate unique gateway_event_id per station to guarantee idempotent retries.
 */
export function generateGatewayEventId(stationId: string): string {
  const cleanId = stationId.replace(/[^A-Za-z0-9_-]/g, "_");
  const rand = Math.random().toString(36).substring(2, 9);
  const ts = Date.now();
  return `gw-${cleanId}-${ts}-${rand}`.slice(0, 80);
}

/**
 * Detect whether a scanned string is a bed identifier/code.
 * Matches HMS-BED-..., BED-..., or explicit dirty bed labels/codes.
 */
export function isBedCode(code: string, dirtyBeds?: DirtyBedOut[]): boolean {
  if (!code) return false;
  const upper = code.trim().toUpperCase();

  // Pattern checks: HMS-BED-xxx or BED-xxx
  if (upper.startsWith("HMS-BED-") || upper.startsWith("BED-")) {
    return true;
  }

  // Explicit match against known dirty beds for the station
  if (dirtyBeds && dirtyBeds.length > 0) {
    const matched = dirtyBeds.some(
      (b) =>
        b.label.toUpperCase() === upper ||
        `HMS-BED-${b.bed_id}`.toUpperCase() === upper ||
        `BED-${b.bed_id}`.toUpperCase() === upper,
    );
    if (matched) return true;
  }

  return false;
}

/**
 * rule:b2f4ebb077: needs_bed_code: collect two scans (bed sticker HMS-BED-… and badge) within 60 s, then post them together.
 * Evaluates dual scan state transitions.
 */
export function processDualScanInput(
  current: DualScanState,
  scannedCode: string,
  dirtyBeds?: DirtyBedOut[],
  nowMs: number = Date.now(),
): { next: DualScanState; readyToSubmit: boolean; error: string | null } {
  const code = scannedCode.trim();
  if (!code) {
    return { next: current, readyToSubmit: false, error: "Empty code scanned." };
  }

  // Check if current session expired
  if (current.expires_at && nowMs > current.expires_at) {
    // Current session expired, restart with this scan as the fresh first scan
    return processFirstScan(code, dirtyBeds, nowMs);
  }

  // If in idle state or complete/expired, start fresh
  if (current.status === "idle" || current.status === "complete" || current.status === "expired") {
    return processFirstScan(code, dirtyBeds, nowMs);
  }

  // In waiting state: check if 60s timeout exceeded
  if (current.status === "waiting_for_badge") {
    if (isBedCode(code, dirtyBeds)) {
      // Scanned another bed code; update the bed code and refresh 60s window
      const expiresAt = nowMs + 60000;
      return {
        next: {
          status: "waiting_for_badge",
          bed_code: code,
          badge_code: null,
          started_at: nowMs,
          expires_at: expiresAt,
          seconds_left: 60,
        },
        readyToSubmit: false,
        error: null,
      };
    } else {
      // Scanned badge code -> Pair is complete!
      return {
        next: {
          status: "complete",
          bed_code: current.bed_code,
          badge_code: code,
          started_at: current.started_at,
          expires_at: current.expires_at,
          seconds_left: Math.max(0, Math.round(((current.expires_at || nowMs) - nowMs) / 1000)),
        },
        readyToSubmit: true,
        error: null,
      };
    }
  }

  if (current.status === "waiting_for_bed") {
    if (!isBedCode(code, dirtyBeds)) {
      // Scanned another badge code; update badge and refresh 60s window
      const expiresAt = nowMs + 60000;
      return {
        next: {
          status: "waiting_for_bed",
          bed_code: null,
          badge_code: code,
          started_at: nowMs,
          expires_at: expiresAt,
          seconds_left: 60,
        },
        readyToSubmit: false,
        error: null,
      };
    } else {
      // Scanned bed code -> Pair is complete!
      return {
        next: {
          status: "complete",
          bed_code: code,
          badge_code: current.badge_code,
          started_at: current.started_at,
          expires_at: current.expires_at,
          seconds_left: Math.max(0, Math.round(((current.expires_at || nowMs) - nowMs) / 1000)),
        },
        readyToSubmit: true,
        error: null,
      };
    }
  }

  return { next: current, readyToSubmit: false, error: null };
}

function processFirstScan(
  code: string,
  dirtyBeds?: DirtyBedOut[],
  nowMs: number = Date.now(),
): { next: DualScanState; readyToSubmit: boolean; error: string | null } {
  const expiresAt = nowMs + 60000;
  if (isBedCode(code, dirtyBeds)) {
    return {
      next: {
        status: "waiting_for_badge",
        bed_code: code,
        badge_code: null,
        started_at: nowMs,
        expires_at: expiresAt,
        seconds_left: 60,
      },
      readyToSubmit: false,
      error: null,
    };
  } else {
    return {
      next: {
        status: "waiting_for_bed",
        bed_code: null,
        badge_code: code,
        started_at: nowMs,
        expires_at: expiresAt,
        seconds_left: 60,
      },
      readyToSubmit: false,
      error: null,
    };
  }
}

/**
 * Create initial idle dual scan state.
 */
export function createInitialDualScanState(): DualScanState {
  return {
    status: "idle",
    bed_code: null,
    badge_code: null,
    started_at: null,
    expires_at: null,
    seconds_left: 0,
  };
}

/**
 * Check debounce: prevent duplicate scans within debounceSeconds.
 */
export function checkDebounce(
  lastScan: { code: string; timestamp: number } | null,
  code: string,
  debounceSeconds: number,
  nowMs: number = Date.now(),
): boolean {
  if (!lastScan) return true;
  if (lastScan.code !== code) return true;
  const elapsedSeconds = (nowMs - lastScan.timestamp) / 1000;
  return elapsedSeconds >= debounceSeconds;
}

/**
 * rule:2554916922: Big green / red result with the outcome in words and a sound; ready for the next person after 3 s.
 * Classifies scan outcome into visual tone and bilingual label.
 */
export function formatScanOutcome(
  outcome: KioskDisplayOutcome,
  lang: "en" | "ur" = "en",
): {
  tone: OutcomeTone;
  title: string;
  subtitle: string;
  isGreen: boolean;
  isRed: boolean;
} {
  switch (outcome) {
    case "Queued":
      return {
        tone: "warning", isGreen: false, isRed: false,
        title: lang === "ur" ? "اسکین تصدیق کا منتظر ہے" : "Scan awaiting confirmation",
        subtitle: lang === "ur" ? "اسکین مقامی طور پر محفوظ ہے۔ سرور کی تصدیق تک حاضری، داخلہ یا صفائی کی تصدیق نہیں ہوئی۔" : "Saved locally. Attendance, access or cleaning has not been confirmed by the server.",
      };
    case "AttendanceIn":
      return {
        tone: "success",
        isGreen: true,
        isRed: false,
        title: lang === "ur" ? "حاضری درج (آمد)" : "Attendance In Recorded",
        subtitle: lang === "ur" ? "خوش آمدید، آپ کی حاضری کامیابی سے لگ گئی ہے۔" : "Welcome! Your shift entry is confirmed.",
      };
    case "AttendanceOut":
      return {
        tone: "success",
        isGreen: true,
        isRed: false,
        title: lang === "ur" ? "حاضری درج (روانگی)" : "Attendance Out Recorded",
        subtitle: lang === "ur" ? "اللہ حافظ، آپ کی روانگی کامیابی سے درج ہو گئی ہے۔" : "Goodbye! Your shift exit is confirmed.",
      };
    case "BedCleaned":
      return {
        tone: "success",
        isGreen: true,
        isRed: false,
        title: lang === "ur" ? "بیڈ کی صفائی تصدیق شدہ" : "Bed Cleaned & Released",
        subtitle: lang === "ur" ? "بیڈ اب صاف اور نئے مریض کے داخلے کے لیے تیار ہے۔" : "Bed sanitization verified. Bed is now Available.",
      };
    case "BedCleaningRecorded":
      return {
        tone: "success",
        isGreen: true,
        isRed: false,
        title: lang === "ur" ? "صفائی درج، کلیئرنس کا انتظار" : "Cleaning recorded; clearance pending",
        subtitle: lang === "ur" ? "صفائی درج ہو گئی ہے۔ بیڈ کی دستیابی کے لیے ڈسچارج کلیئرنس باقی ہے۔" : "Cleaning is recorded. The bed still awaits discharge clearance.",
      };
    case "SecurityPass":
      return {
        tone: "success",
        isGreen: true,
        isRed: false,
        title: lang === "ur" ? "سیکیورٹی داخلہ مجاز" : "Security Pass Granted",
        subtitle: lang === "ur" ? "رسائی کا اسکین درج ہو گیا۔ ہسپتال کے داخلے کے طریقہ کار پر عمل کریں۔" : "Access scan recorded. Follow the facility's entry procedure.",
      };
    case "Duplicate":
      return {
        tone: "warning",
        isGreen: false,
        isRed: false,
        title: lang === "ur" ? "ڈپلیکیٹ اسکین (پہلے سے درج)" : "Duplicate Scan Ignored",
        subtitle: lang === "ur" ? "یہ اسکین پہلے ہی چند لمحے قبل درج کیا جا چکا ہے۔" : "Already recorded moments ago.",
      };
    case "NoAction":
      return {
        tone: "warning",
        isGreen: false,
        isRed: false,
        title: lang === "ur" ? "کوئی کارروائی درکار نہیں" : "No Action Taken",
        subtitle: lang === "ur" ? "اس اسٹیشن پر اس بیج کے لیے کوئی تبدیلی درکار نہیں تھی۔" : "No state change required for this station.",
      };
    case "UnknownBadge":
      return {
        tone: "danger",
        isGreen: false,
        isRed: true,
        title: lang === "ur" ? "نامعلوم بیج" : "Unknown Badge Code",
        subtitle: lang === "ur" ? "یہ بیج اسپتال کے ریکارڈ میں موجود نہیں ہے۔ ایچ آر سے رجوع کریں۔" : "Badge not recognized in hospital registry. Contact HR.",
      };
    case "InactiveBadge":
      return {
        tone: "danger",
        isGreen: false,
        isRed: true,
        title: lang === "ur" ? "غیر فعال / معطل شدہ بیج" : "Inactive or Revoked Badge",
        subtitle: lang === "ur" ? "یہ بیج معطل یا غیر فعال ہو چکا ہے۔" : "Badge has been suspended or revoked.",
      };
    case "UnknownStation":
      return {
        tone: "danger",
        isGreen: false,
        isRed: true,
        title: lang === "ur" ? "نامعلوم اسٹیشن" : "Unknown Badge Station",
        subtitle: lang === "ur" ? "اسٹیشن کی شناخت غلط ہے۔ آئی ٹی ایڈمن سے رابطہ کریں۔" : "Station profile mismatch. Contact IT.",
      };
    case "Rejected":
    default:
      return {
        tone: "danger",
        isGreen: false,
        isRed: true,
        title: lang === "ur" ? "اسکین مسترد" : "Scan Rejected",
        subtitle: lang === "ur" ? "اسکین مسترد کر دیا گیا۔ برائے مہربانی دوبارہ کوشش کریں۔" : "Scan was rejected by the station rule engine.",
      };
  }
}

/**
 * rule:438ca845ec: Queue scans with a gateway_event_id while the server is unreachable and resend them.
 * Offline queue helper functions.
 */
export function enqueueOfflineScan(scan: ScanIn, queue: ScanIn[]): ScanIn[] {
  // Check if identical gateway_event_id already in queue
  if (scan.gateway_event_id && queue.some((s) => s.gateway_event_id === scan.gateway_event_id)) {
    return queue;
  }
  return [...queue, scan];
}

export function dequeueOfflineScan(gatewayEventId: string, queue: ScanIn[]): ScanIn[] {
  return queue.filter((s) => s.gateway_event_id !== gatewayEventId);
}

/**
 * Synthesizes audio feedback via Web Audio API without requiring external audio assets.
 * rule:2554916922: sound with big green / red result.
 */
export function playOutcomeAudio(tone: OutcomeTone): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (tone === "success") {
      // Pleasant high dual ascending chime (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } else if (tone === "warning") {
      // Neutral double pip (587Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      // Low descending buzz for error / rejected (220Hz -> 110Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Graceful fallback if Web Audio is blocked or unavailable
  }
}

/**
 * Standard bilingual error dictionary for badge station kiosk.
 */
export const BADGE_STATION_ERROR_MESSAGES: Record<string, { en: string; ur: string }> = {
  BADGE_STATION_UNKNOWN: {
    en: "Unknown or unauthorised badge station. Please verify Station ID and Station Key.",
    ur: "نامعلوم یا غیر مجاز بیج اسٹیشن۔ براہ کرم اسٹیشن آئی ڈی اور اسٹیشن کی تصدیق کریں۔",
  },
  VALIDATION_ERROR: {
    en: "The scan payload or station parameter is invalid.",
    ur: "اسکین کا ڈیٹا یا اسٹیشن پیرامیٹر غلط ہے۔",
  },
  OFFLINE_QUEUED: {
    en: "Server unreachable. Scan queued locally with unique event ID for idempotent submission.",
    ur: "سرور دستیاب نہیں۔ اسکین منفرد ایونٹ آئی ڈی کے ساتھ مقامی طور پر محفوظ کر لیا گیا ہے۔",
  },
  SCAN_TIMEOUT: {
    en: "60-second dual scan session timed out. Please scan bed and badge together.",
    ur: "ساٹھ سیکنڈ کے اندر دونوں اسکین مکمل نہیں ہوئے۔ براہ کرم بیڈ اور بیج دوبارہ اسکین کریں۔",
  },
  DEBOUNCE_WAIT: {
    en: "Duplicate scan ignored. Please wait before scanning the same badge again.",
    ur: "بار بار اسکین کو نظر انداز کیا گیا۔ براہ کرم اسی بیج کو دوبارہ اسکین کرنے سے قبل انتظار کریں۔",
  },
};
