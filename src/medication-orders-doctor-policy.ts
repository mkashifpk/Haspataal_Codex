/**
 * Medication Orders Doctor screen policies and validation rules.
 * Governs verbal order countersignatures (MSDS 55, rule 15dd98f03c)
 * and pharmacy query answers (MSDS 51, rule aac4a043c3).
 */

export function isVerbalOrderOverdue(order: {
  countersign_due_at: string;
  countersigned_at: string | null;
  now?: string | Date;
}): boolean {
  if (order.countersigned_at) return false;
  const due = new Date(order.countersign_due_at).getTime();
  const current = order.now ? new Date(order.now).getTime() : Date.now();
  return current > due;
}

export function validateCountersignReadback(
  confirmed: boolean,
  order: { prescriber_id: number; countersigned_at?: string | null },
  currentUserId: number
): { ok: boolean; code?: string; message?: string } {
  if (order.countersigned_at) {
    return {
      ok: false,
      code: "VERBAL_ORDER_COUNTERSIGN_INVALID",
      message: "This verbal order has already been countersigned.",
    };
  }
  if (order.prescriber_id !== currentUserId) {
    return {
      ok: false,
      code: "VERBAL_ORDER_COUNTERSIGN_INVALID",
      message: "Only the prescriber who gave the verbal instruction can countersign it.",
    };
  }
  if (!confirmed) {
    return {
      ok: false,
      code: "READBACK_REQUIRED",
      message: "Read-back verification must be confirmed before countersigning.",
    };
  }
  return { ok: true };
}

export function validateQueryAnswer(
  outcome: "ConfirmedAsWritten" | "Changed",
  answer: string,
  isItemStoppedOrPrescriptionCancelled: boolean
): { ok: boolean; code?: string; message?: string } {
  const trimmed = answer.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "An answer and clinical explanation are required.",
    };
  }
  if (outcome === "Changed" && !isItemStoppedOrPrescriptionCancelled) {
    return {
      ok: false,
      code: "PRESCRIPTION_QUERY_STATE_INVALID",
      message:
        "The query cannot change that way: a change needs the queried line stopped (or prescription cancelled) first.",
    };
  }
  return { ok: true };
}

export function validateStopItem(reason: string): { ok: boolean; code?: string; message?: string } {
  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "A reason for stopping the medication line is required.",
    };
  }
  if (trimmed.length > 500) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "The reason must not exceed 500 characters.",
    };
  }
  return { ok: true };
}
