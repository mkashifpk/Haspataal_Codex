export type CashBackDrawer = {
  user: {user_id:number};
  terminal: {registered:boolean;cash_node?:string|null};
  shift: {shift_id:number;user_id:number;node:string;status:string}|null;
};
export function cashBackDrawerReady(read:CashBackDrawer|null|undefined) {
  return !!read && !!read.terminal.registered && !!read.terminal.cash_node &&
    read.shift?.status === "Open" && read.shift.user_id === read.user.user_id &&
    read.shift.node === read.terminal.cash_node;
}
export function cashBackReviewKey(
  ticket:{ticket_id:number;patient_id:number},
  prompt:{kind:string;id:number;amount:number},
  drawer:CashBackDrawer|null|undefined,
) {
  if (!cashBackDrawerReady(drawer) || !Number.isFinite(prompt.amount) || prompt.amount <= 0) return undefined;
  return JSON.stringify([ticket.ticket_id,ticket.patient_id,prompt.kind,prompt.id,prompt.amount,
    drawer!.user.user_id,drawer!.shift!.shift_id,drawer!.shift!.node]);
}
