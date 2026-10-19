import type { ApprovalOut } from "./generated/approval_queue";
type Approval = Pick<
  ApprovalOut,
  "status" | "requester_id" | "can_decide" | "self_decision"
>;

// Eligibility is returned for the signed-in user by the server. Do not infer it from roles or approval type.
export function approvalControls(
  request: Approval,
  userId: number,
  note: string,
) {
  const pending = request.status === "Pending";
  const hasNote = note.trim().length > 0;
  const showDecisions = pending && request.can_decide === true;
  const approveNeedsNote = request.self_decision === "allowed_with_note";
  return {
    showDecisions,
    approveNeedsNote,
    canApprove: showDecisions && (!approveNeedsNote || hasNote),
    canReject: showDecisions && hasNote,
    canCancel: pending && request.requester_id === userId && hasNote,
  };
}
