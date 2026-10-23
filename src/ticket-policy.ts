import type { OpdTicketDetailOut as Ticket } from "./generated/queue_management";
export function ticketExpired(
  t: Pick<Ticket, "status" | "valid_until">,
  serverNow: number,
) {
  return (
    t.status === "Expired" ||
    (!!t.valid_until &&
      Number.isFinite(serverNow) &&
      Date.parse(t.valid_until) <= serverNow)
  );
}
export function queueActions(
  t: Ticket,
  permissions: string[],
  serverNow: number,
) {
  const free =
    t.approval_lock === "None" &&
    !t.cash_back_prompts.length &&
    !ticketExpired(t, serverNow);
  return {
    defer:
      free &&
      t.status === "Waiting" &&
      permissions.includes("opd.ticket.defer"),
    reactivate:
      free &&
      Number.isFinite(serverNow) &&
      t.status === "Deferred" &&
      permissions.includes("opd.ticket.reactivate"),
    cancel:
      free &&
      t.status === "Issued" &&
      t.payment_status === "Unpaid" &&
      (t.invoice?.amount_paid ?? 0) === 0 &&
      permissions.includes("opd.ticket.cancel"),
  };
}
export function requestKinds(t: Ticket, p: string[]) {
  if (
    t.approval_lock !== "None" ||
    t.cash_back_prompts.length ||
    ["Cancelled", "Void", "Forfeited", "Refunded"].includes(t.status)
  )
    return [];
  const unpaid =
    t.payment_status === "Unpaid" && (t.invoice?.amount_paid ?? 0) === 0;
  return [
    ...(unpaid && p.includes("opd.ticket.void") ? ["void"] : []),
    ...((t.invoice?.amount_paid ?? 0) > (t.invoice?.amount_refunded ?? 0) &&
    p.includes("opd.refund.request")
      ? ["refund-request"]
      : []),
    ...(unpaid &&
    ["Issued", "Waiting"].includes(t.status) &&
    p.includes("opd.waiver.request")
      ? ["vip-waiver-request"]
      : []),
    ...(!!t.examined_at && p.includes("opd.waiver.request_post_consult")
      ? ["vip-waiver-post-consult"]
      : []),
    ...(["Unpaid", "PartiallyPaid"].includes(t.payment_status) &&
    ["Issued", "Waiting"].includes(t.status) &&
    p.includes("opd.credit.request")
      ? ["credit-request"]
      : []),
  ];
}
export function decimalAmount(value: string, min = 0, max = Infinity) {
  return (
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}
