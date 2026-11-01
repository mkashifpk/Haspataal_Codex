import type { EstablishmentOut } from "./generated/facility_profile";
import type {
  OtBookingDetailOut,
  OtCalendarBlockOut,
  OtQueueItemOut,
  TheaterOut,
  BookingIn,
  OtScheduleIn,
  TheaterStateIn,
  OtReasonIn,
} from "./generated/ot_scheduling";

export type ScreenViewMode = "full" | "open_work" | "records" | "setup" | "hidden";

export interface ClinicalUser {
  user_id?: number;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Evaluates the runtime screen view mode for ot_scheduling according to Rule b5f0fd9a68.
 * Uses GET /establishment views.screens.ot_scheduling. Never decides from facility category.
 */
export function getOtSchedulingScreenView(establishment?: EstablishmentOut | null): ScreenViewMode {
  if (!establishment) {
    return "full";
  }

  // 1. Check server-declared screen view
  const screens = establishment.views?.screens || [];
  const screenEntry = screens.find((s) => s.screen_id === "ot_scheduling");
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
 * Returns true if surgery service is active in the establishment (Rule ae87186675).
 */
export function isSurgeryActive(establishment?: EstablishmentOut | null): boolean {
  if (!establishment) return false;
  return Array.isArray(establishment.active) && establishment.active.includes("surgery");
}

/**
 * Permission checks for OT scheduling tasks.
 */
export function canManageOt(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes("ot.booking.manage");
}

export function canRequestOt(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("ot.booking.request") ||
    user.permissions.includes("ot.booking.manage")
  );
}

export function canViewOt(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("ot.booking.view") ||
    user.permissions.includes("ot.booking.manage") ||
    user.permissions.includes("ot.status.view")
  );
}

export function canProvisionTheater(user: ClinicalUser | null | undefined): boolean {
  if (!user || !user.permissions) return false;
  return (
    user.permissions.includes("ot.theater.provision") ||
    user.permissions.includes("ot.booking.manage")
  );
}

/**
 * Checks for slot overlap including turnover buffer (Rule 992db951e1).
 * If overlap is detected, calculates the next available free slot.
 */
export interface SlotCheckResult {
  hasConflict: boolean;
  conflictingBookingId?: number;
  conflictingProcedure?: string;
  nextFreeSlot?: string;
}

export function checkSlotAvailability(
  otId: number,
  startTime: string,
  durationMinutes: number,
  calendarBlocks: OtCalendarBlockOut[],
  turnoverBufferMinutes: number = 20
): SlotCheckResult {
  const proposedStart = new Date(startTime).getTime();
  const proposedEnd = proposedStart + (durationMinutes + turnoverBufferMinutes) * 60 * 1000;

  // Filter blocks for the specific theatre and non-cancelled statuses
  const blocksForOt = calendarBlocks.filter(
    (b) => b.ot_id === otId && b.status !== "Cancelled"
  );

  let conflictingBlock: OtCalendarBlockOut | undefined;

  for (const block of blocksForOt) {
    const blockStart = new Date(block.scheduled_start).getTime();
    // Use scheduled_end, or add turnover
    const blockEnd = new Date(block.scheduled_end).getTime() + turnoverBufferMinutes * 60 * 1000;

    // Overlap condition: proposed interval overlaps with block interval
    if (proposedStart < blockEnd && proposedEnd > blockStart) {
      conflictingBlock = block;
      break;
    }
  }

  if (!conflictingBlock) {
    return { hasConflict: false };
  }

  // Suggest next free slot: search right after the latest end time of conflicting blocks
  let candidateStart = new Date(conflictingBlock.scheduled_end).getTime() + turnoverBufferMinutes * 60 * 1000;

  // Round up to nearest 15 minutes
  const remainder = candidateStart % (15 * 60 * 1000);
  if (remainder > 0) {
    candidateStart += 15 * 60 * 1000 - remainder;
  }

  let found = false;
  let iterations = 0;

  while (!found && iterations < 24) {
    iterations++;
    const candidateEnd = candidateStart + (durationMinutes + turnoverBufferMinutes) * 60 * 1000;

    const overlap = blocksForOt.some((b) => {
      const bStart = new Date(b.scheduled_start).getTime();
      const bEnd = new Date(b.scheduled_end).getTime() + turnoverBufferMinutes * 60 * 1000;
      return candidateStart < bEnd && candidateEnd > bStart;
    });

    if (!overlap) {
      found = true;
    } else {
      candidateStart += 15 * 60 * 1000;
    }
  }

  return {
    hasConflict: true,
    conflictingBookingId: conflictingBlock.booking_id,
    conflictingProcedure: conflictingBlock.procedure_name,
    nextFreeSlot: new Date(candidateStart).toISOString(),
  };
}

/**
 * Validates new surgical booking request (Rule ae87186675).
 */
export function validateBookingRequest(input: Partial<BookingIn>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.patient_id || input.patient_id <= 0) {
    errors.push("Patient selection is required.");
  }

  if (!input.procedure_name || input.procedure_name.trim().length === 0) {
    errors.push("Procedure name is required.");
  }

  if (input.booking_type === "Emergency" || input.booking_type === "CodeRed") {
    if (!input.emergency_reason || input.emergency_reason.trim().length === 0) {
      errors.push("Emergency bookings require an emergency justification reason.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates scheduling an existing booking into a theatre slot.
 */
export function validateScheduleInput(input: Partial<OtScheduleIn>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.ot_id || input.ot_id <= 0) {
    errors.push("Select an active operating theatre.");
  }

  if (!input.scheduled_start) {
    errors.push("Scheduled start date and time is required.");
  } else {
    const date = new Date(input.scheduled_start);
    if (isNaN(date.getTime())) {
      errors.push("Scheduled start time must be a valid date and time.");
    }
  }

  if (!input.duration_minutes || input.duration_minutes <= 0) {
    errors.push("Procedure duration must be greater than 0 minutes.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates theatre state change.
 */
export function validateTheaterState(input: Partial<TheaterStateIn>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.reason || input.reason.trim().length === 0) {
    errors.push("A reason must be provided when changing theatre service status.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates cancellation of an OT booking.
 */
export function validateBookingCancellation(input: Partial<OtReasonIn>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.reason || input.reason.trim().length === 0) {
    errors.push("Cancellation reason is required.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Bilingual explanations for OT scheduling errors.
 */
export function explainOtSchedulingError(code: string, details?: any): { en: string; ur: string } {
  const messages: Record<string, { en: string; ur: string }> = {
    OT_DOUBLE_BOOKING: {
      en: details?.constraint
        ? `Theatre double-booking conflict: ${details.constraint}. The slot overlaps with an existing procedure or turnover buffer.`
        : "The selected theatre slot overlaps with an existing booking or cleaning turnover buffer. Suggesting next free slot.",
      ur: details?.constraint
        ? `آپریشن تھیٹر میں وقت کا تصادم: ${details.constraint}۔ یہ سلاٹ کسی دوسری بکنگ یا صفائی کے وقفے سے ٹکرا رہا ہے۔`
        : "منتخب کردہ وقت کسی دوسری بکنگ یا صفائی کے وقفے سے ٹکرا رہا ہے۔ اگلا دستیاب وقت منتخب کریں۔",
    },
    OT_PRIVILEGE_REQUIRED: {
      en: details?.privilege
        ? `Clinical privilege missing: primary surgeon requires "${details.privilege}" privilege for this surgical procedure.`
        : "The primary surgeon does not possess the mandatory clinical privileges for this surgical procedure.",
      ur: details?.privilege
        ? `کلینیکل مراعات درکار ہیں: سرجن کے پاس اس جراحی کے لیے "${details.privilege}" کی اجازت ہونا ضروری ہے۔`
        : "پرائمری سرجن کے پاس اس جراحی کے لیے لازمی کلینیکل مراعات موجود نہیں ہیں۔",
    },
    CAPABILITY_INACTIVE: {
      en: "Surgery service is currently inactive. No new OT bookings can be initiated.",
      ur: "سرجری سروس فی الوقت غیر فعال ہے۔ نئی او ٹی بکنگز شروع نہیں کی جا سکتیں۔",
    },
    FORBIDDEN: {
      en: "You do not have the necessary permissions for this OT operation (ot.booking.manage or ot.booking.request required).",
      ur: "آپ کو اس آپریشن تھیٹر کے کام کی اجازت نہیں ہے (ot.booking.manage یا ot.booking.request درکار ہے)۔",
    },
    REFERENCE_NOT_FOUND: {
      en: "Referenced record (patient, surgeon, procedure, or theatre) was not found.",
      ur: "حوالہ شدہ ریکارڈ (مریض، سرجن، طریقہ کار یا تھیٹر) نہیں ملا۔",
    },
    VALIDATION_ERROR: {
      en: "The booking details are invalid. Please check patient, date, and theatre selection.",
      ur: "بکنگ کی تفصیلات غلط ہیں۔ مریض، تاریخ اور تھیٹر کے انتخاب کی تصدیق کریں۔",
    },
  };

  return (
    messages[code] ?? {
      en: `An error occurred: ${code}. Please try again.`,
      ur: `ایک خرابی پیش آئی: ${code}۔ دوبارہ کوشش کریں۔`,
    }
  );
}
