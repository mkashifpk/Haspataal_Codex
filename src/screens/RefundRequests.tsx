import { useState } from "react";
import * as requests from "../generated/refund_waiver_credit";
import { Empty, Field, LoadState, Modal, useLoad } from "../components";
import { tr } from "../i18n";
import { decimalAmount, requestKinds } from "../ticket-policy";
import {
  CashBackModal,
  DeskLoading,
  TicketLookup,
  TicketSummary,
  useTicketDesk,
  useTicketWrite,
  WriteFeedback,
} from "./TicketDesk";
import type { DeskProps } from "./QueueManagement";
import type { TicketRead } from "./TicketDesk";
const names: Record<string, string> = {
  void: "Void unpaid slip",
  "refund-request": "Request refund",
  "vip-waiver-request": "Request pre-consult waiver",
  "vip-waiver-post-consult": "Request post-consult waiver",
  "credit-request": "Request credit",
};
export function RefundRequests({
  permissions,
  revision,
  readOnly,
  timeZone,
  currency,
  onShift,
}: DeskProps) {
  const desk = useTicketDesk(revision),
    t = desk.record?.ticket;
  const [kind, setKind] = useState(""),
    [reason, setReason] = useState(""),
    [amount, setAmount] = useState(""),
    [pct, setPct] = useState("100"),
    [paidNow, setPaidNow] = useState("0"),
    [method, setMethod] = useState<"Cash" | "Card" | "BankTransfer">("Cash"),
    [due, setDue] = useState(""),
    [reasonCode, setReasonCode] =
      useState<requests.RefundRequestIn["reason_code"]>("Other"),
    [review, setReview] = useState<{ticket:TicketRead["ticket"];kind:string;payload:unknown;reason:string;amount:string;pct:string;paidNow:string;method:string;due:string;reasonCode:string}>();
  const approvals = useLoad(
    () => requests.listApprovals({ mine: true, limit: 100 }),
    [revision],
  );
  const clear = () => {
    setReview(undefined);
    setKind("");
    setReason("");
    setAmount("");
    setPct("100");
    setPaidNow("0");
    setMethod("Cash");
    setDue("");
    setReasonCode("Other");
  };
  const write = useTicketWrite(async () => {
    clear();
    await Promise.all([desk.reload(), approvals.reload()]);
  });
  const dirty =
    !!kind ||
    !!reason.trim() ||
    !!amount ||
    pct !== "100" ||
    paidNow !== "0" ||
    !!due ||
    method !== "Cash" ||
    reasonCode !== "Other";
  const blocked =
    write.blocked ||
    desk.loading ||
    !!desk.error ||
    readOnly ||
    !!t?.cash_back_prompts.length;
  const kinds = t ? requestKinds(t, permissions) : [];
  const changedDuringReview = !!review && (!t || review.ticket.ticket_id !== t.ticket_id || review.ticket.row_version !== t.row_version);
  const valid =
    !!t &&
    kinds.includes(kind) &&
    reason.trim().length >= 3 &&
    reason.trim().length <=
      (kind === "void" || kind === "credit-request" ? 500 : 1000) &&
    (kind !== "refund-request" ||
      !amount ||
      decimalAmount(
        amount,
        0.01,
        Math.max(
          0,
          (t.invoice?.amount_paid ?? 0) - (t.invoice?.amount_refunded ?? 0),
        ),
      )) &&
    (kind !== "vip-waiver-request" || decimalAmount(pct, 0.01, 100)) &&
    (kind !== "credit-request" ||
      decimalAmount(paidNow, 0, t.invoice?.balance_due ?? 0));
  function body():
    | requests.OpdReasonIn
    | requests.RefundRequestIn
    | requests.WaiverRequestIn
    | requests.PostConsultWaiverIn
    | requests.CreditRequestIn {
    if (kind === "refund-request")
      return {
        reason_code: reasonCode,
        note: reason.trim(),
        ...(amount ? { amount } : {}),
      };
    if (kind === "vip-waiver-request")
      return { reason: reason.trim(), waiver_pct: pct };
    if (kind === "credit-request")
      return {
        reason: reason.trim(),
        amount_paid_now: paidNow,
        method,
        ...(due ? { due_date: due } : {}),
      };
    return { reason: reason.trim() };
  }
  return (
    <div data-write-pending={write.blocked} data-unsaved={dirty}>
      <div className="section-heading">
        <div>
          <h1>{tr("Refund / waiver / credit requests")}</h1>
          <p>
            {tr(
              "Request a permitted change; the approver decides. A request is not a cash handover.",
            )}
          </p>
        </div>
        <button
          data-help="requests.refresh"
          disabled={write.busy}
          onClick={() => {
            void desk.reload();
            void approvals.reload();
          }}
        >
          {tr("Refresh requests")}
        </button>
      </div>
      {readOnly && (
        <p className="notice">
          {tr("Records only — new actions are unavailable for this service.")}
        </p>
      )}
      <TicketLookup
        disabled={write.blocked || !!t?.cash_back_prompts.length}
        onScan={(number) => {
          if (!dirty || window.confirm(tr("Discard the unsaved request?"))) {
            clear();
            void desk.scan(number);
          }
        }}
      />
      <DeskLoading desk={desk} />
      <WriteFeedback
        write={write}
        onCheck={async () => {
          await desk.reload();
          await approvals.reload();
        }}
      />
      {desk.record && (
        <>
          <TicketSummary
            record={desk.record}
            timeZone={timeZone}
            currency={currency}
          />
          <section className="card">
            <h2>{tr("Request action")}</h2>
            {(!!t?.called_at || !!t?.examined_at || !!t?.completed_at) && (
              <p className="notice">
                {tr(
                  "Clinical activity is recorded. A refund needs elevated approval and is risk-flagged. Ask the authorized doctor about a post-consult waiver after a finalized note.",
                )}
              </p>
            )}
            {kinds.length === 0 ? (
              <p>
                {tr(
                  "No request action is available for this slip and your permissions.",
                )}
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid && !blocked && t) setReview({ticket:structuredClone(t),kind,payload:structuredClone(body()),reason,amount,pct,paidNow,method,due,reasonCode});
                }}
              >
                <fieldset disabled={blocked || !!review}>
                  <Field label={tr("Request type")}>
                    <select data-field="kind"
                      data-help="requests.form"
                      value={kind}
                      onChange={(e) => {
                        if (
                          !dirty ||
                          window.confirm(tr("Discard the unsaved request?"))
                        ) {
                          clear();
                          setKind(e.target.value);
                        }
                      }}
                    >
                      <option value="">{tr("Choose an action")}</option>
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {tr(names[k])}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {kind && (
                    <>
                      <Field label={tr("Reason")}>
                        <textarea data-field="reason note"
                          data-help="requests.form"
                          value={reason}
                          minLength={3}
                          maxLength={
                            kind === "void" || kind === "credit-request"
                              ? 500
                              : 1000
                          }
                          required
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                      {kind === "refund-request" && (
                        <>
                          <Field label={tr("Refund reason")}>
                            <select data-field="reason_code"
                              data-help="requests.form"
                              value={reasonCode}
                              onChange={(e) =>
                                setReasonCode(
                                  e.target.value as typeof reasonCode,
                                )
                              }
                            >
                              {(
                                [
                                  "DoctorUnavailable",
                                  "PatientRefusedTreatment",
                                  "EmergencyDeparture",
                                  "DuplicateTicket",
                                  "BillingError",
                                  "Other",
                                ] as const
                              ).map((r) => (
                                <option key={r} value={r}>
                                  {tr(r)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field
                            label={tr("Refund amount")}
                            hint={tr(
                              "Leave blank to request the remaining refundable amount.",
                            )}
                          >
                            <input data-field="amount"
                              data-help="requests.form"
                              inputMode="decimal"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                            />
                          </Field>
                        </>
                      )}
                      {kind === "vip-waiver-request" && (
                        <Field label={tr("Waiver percentage")}>
                          <input data-field="waiver_pct"
                            data-help="requests.form"
                            inputMode="decimal"
                            value={pct}
                            onChange={(e) => setPct(e.target.value)}
                          />
                        </Field>
                      )}
                      {kind === "vip-waiver-post-consult" && (
                        <p>
                          {tr(
                            "The server uses the latest finalized note of this visit. Approval ends as Waivered, never Refunded.",
                          )}
                        </p>
                      )}
                      {kind === "credit-request" && (
                        <>
                          <p className="notice">
                            {tr(
                              "The amount paid now is collected immediately. The remaining balance waits for approval and may become outstanding dues.",
                            )}
                          </p>
                          <Field label={tr("Amount paid now")}>
                            <input data-field="amount_paid_now"
                              data-help="requests.form"
                              inputMode="decimal"
                              value={paidNow}
                              onChange={(e) => setPaidNow(e.target.value)}
                            />
                          </Field>
                          <Field label={tr("Payment method")}>
                            <select data-field="method"
                              data-help="requests.form"
                              value={method}
                              onChange={(e) =>
                                setMethod(e.target.value as typeof method)
                              }
                            >
                              {["Cash", "Card", "BankTransfer"].map((m) => (
                                <option key={m} value={m}>
                                  {tr(m)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={tr("Due date (optional)")}>
                            <input data-field="due_date"
                              data-help="requests.form"
                              type="date"
                              value={due}
                              onChange={(e) => setDue(e.target.value)}
                            />
                          </Field>
                        </>
                      )}
                      <button
                        data-help="requests.form"
                        className="primary"
                        disabled={!valid}
                      >
                        {tr("Review request")}
                      </button>
                    </>
                  )}
                </fieldset>
              </form>
            )}
          </section>
          <CashBackModal
            currency={currency}
            record={desk.record}
            permissions={permissions}
            readOnly={readOnly || desk.loading || !!desk.error}
            reload={desk.reload}
            onShift={onShift}
          />
        </>
      )}
      <section className="card">
        <h2>{tr("My requests")}</h2>
        <LoadState {...approvals} retry={approvals.reload} />
        {approvals.data?.length === 0 && (
          <Empty>{tr("No requests found.")}</Empty>
        )}
        {approvals.data?.map((a) => (
          <article key={a.request_id}>
            <p>
              #{a.request_id} · {tr(a.status)} · {a.summary}
            </p>
            <p>{a.decision_note}</p>
          </article>
        ))}
      </section>
      {review && t && (
        <Modal
          title={tr("Review request")}
          onClose={() => !write.busy && setReview(undefined)}
        >
          <h3>{tr(names[review.kind])}</h3>
          <p>
            <bdi>{review.ticket.ticket_number}</bdi> · {review.ticket.patient_name} · <bdi>{review.ticket.mrn}</bdi>
          </p>
          <p>{review.reason}</p>
          {changedDuringReview && <p className="error" role="alert">{tr("The slip changed during request review. Go back and review the current balance and status before submitting.")}</p>}
          {review.kind === "refund-request" && (
            <p>
              {tr(review.reasonCode)} · {tr("Refund amount")}:{" "}
              <bdi>{review.amount || tr("Remaining refundable amount")}</bdi>
            </p>
          )}
          {review.kind === "vip-waiver-request" && (
            <p>
              {tr("Waiver percentage")}: <bdi>{review.pct}%</bdi>
            </p>
          )}
          {review.kind === "credit-request" && (
            <p>
              {tr("Amount paid now")}: <bdi>{review.paidNow}</bdi> · {tr(review.method)} ·{" "}
              {review.due || tr("No due date")}
            </p>
          )}
          <p>
            {tr(
              "A pending approval locks the ticket. Do not hand back cash until its approved cash-back prompt is confirmed.",
            )}
          </p>
          <button
            data-help="requests.confirm"
            disabled={!valid || blocked || changedDuringReview}
            onClick={() => {
              if (!valid || blocked || changedDuringReview) return;
              write.start({
                ticketId: review.ticket.ticket_id,
                path: `/opd-tickets/${review.ticket.ticket_id}/${review.kind}`,
                body: review.payload,
                label: names[review.kind],
                idempotent: true,
              });
              setReview(undefined);
            }}
          >
            {tr("Confirm request")}
          </button>
        </Modal>
      )}
    </div>
  );
}
