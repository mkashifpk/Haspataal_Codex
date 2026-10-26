import type { VerificationItemOut, VerifyIn } from "./generated/lab_verification";

export function sortVerificationQueue<
  T extends { has_critical_value?: boolean; priority?: string; entered_at?: string }
>(items: T[]): T[] {
  const priorityWeight: Record<string, number> = {
    STAT: 3,
    Urgent: 2,
    Routine: 1,
  };
  return [...items].sort((a, b) => {
    // 1. Critical values first
    const aCrit = a.has_critical_value ? 1 : 0;
    const bCrit = b.has_critical_value ? 1 : 0;
    if (aCrit !== bCrit) return bCrit - aCrit;

    // 2. STAT / Priority next
    const aPrio = priorityWeight[a.priority ?? "Routine"] ?? 0;
    const bPrio = priorityWeight[b.priority ?? "Routine"] ?? 0;
    if (aPrio !== bPrio) return bPrio - aPrio;

    // 3. FIFO by entered_at
    const aTime = a.entered_at ? new Date(a.entered_at).getTime() : 0;
    const bTime = b.entered_at ? new Date(b.entered_at).getTime() : 0;
    return aTime - bTime;
  });
}

export function canVerifyResult(
  user: { user_id?: number; id?: number; name?: string; username?: string; display_name?: string } | null | undefined,
  item: { entered_by_name?: string }
): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: "Login required" };
  const uName = (user.name ?? user.display_name ?? user.username ?? "").trim().toLowerCase();
  const enteredByName = (item.entered_by_name ?? "").trim().toLowerCase();

  if (
    (uName && enteredByName && uName === enteredByName) ||
    (user.username && enteredByName && user.username.trim().toLowerCase() === enteredByName)
  ) {
    return {
      allowed: false,
      reason: "You entered this result; verification requires an independent verifier (LAB_VERIFIER_MUST_DIFFER).",
    };
  }
  return { allowed: true };
}

export function isResultOverdue(dueAt?: string | null, now: Date | string = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  const current = typeof now === "string" ? new Date(now).getTime() : now.getTime();
  return !isNaN(due) && current > due;
}

export function validateVerification(
  decision: "Verified" | "Rejected",
  note: string,
  isLate: boolean,
  delayReason: string
): { valid: boolean; error?: string; body: VerifyIn } {
  const trimmedNote = note.trim();
  const trimmedDelay = delayReason.trim();

  if (decision === "Rejected") {
    if (!trimmedNote) {
      return {
        valid: false,
        error: "Rejection requires an explanatory note for the technician.",
        body: { decision, note: null },
      };
    }
    if (trimmedNote.length > 1000) {
      return {
        valid: false,
        error: "Note cannot exceed 1000 characters.",
        body: { decision, note: trimmedNote.slice(0, 1000) },
      };
    }
  }

  if (trimmedDelay.length > 500) {
    return {
      valid: false,
      error: "Delay reason cannot exceed 500 characters.",
      body: { decision, note: trimmedNote || null, delay_reason: trimmedDelay.slice(0, 500) },
    };
  }

  return {
    valid: true,
    body: {
      decision,
      note: trimmedNote || null,
      delay_reason: isLate && trimmedDelay ? trimmedDelay : null,
    },
  };
}

export function verificationWritable(
  view?: { mode?: string },
  permissions: string[] = []
): { readable: boolean; writable: boolean; banner?: string } {
  const hasVerify = permissions.includes("lab.result.verify");
  const hasView = permissions.includes("lab.result.view") || permissions.includes("lab.requisition.view") || hasVerify;

  if (!hasView) {
    return { readable: false, writable: false, banner: "Access denied: missing lab verification permissions." };
  }

  const mode = view?.mode ?? "full";
  if (mode === "hidden") {
    return { readable: false, writable: false, banner: "This service is currently hidden." };
  }
  if (mode === "setup") {
    return { readable: false, writable: false, banner: "This service is in setup mode." };
  }
  if (mode === "records") {
    return { readable: true, writable: false, banner: "Records only: new verifications are not permitted." };
  }
  if (mode === "open_work") {
    return { readable: true, writable: hasVerify, banner: "Retiring service: completing existing open work only." };
  }

  return { readable: true, writable: hasVerify };
}
