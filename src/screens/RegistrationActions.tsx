import { useEffect, useRef, useState } from "react";
import { api, call, ApiError } from "../bridge";
import { ErrorBox, Field, LoadState, Modal, useLoad } from "../components";
import * as reg from "../generated/registration";
import { tr } from "../i18n";

export function RegistrationActions({
  ticketId,
  permissions,
  revision,
  onTicket,
  onPending,
}: {
  ticketId: number;
  permissions: string[];
  revision: number;
  onTicket: (ticket: reg.OpdTicketDetailOut) => void;
  onPending: (pending: boolean) => void;
}) {
  const ticket = useLoad(
    () => api<reg.OpdTicketDetailOut>("GET", `/opd-tickets/${ticketId}`),
    [ticketId, revision],
  );
  const terminal = useLoad(
    () =>
      api<{
        registered: boolean;
        hint?: string;
        receipt_printer_address?: string;
      }>("GET", "/terminals/whoami"),
    [],
  );
  const [method, setMethod] = useState<"Cash" | "Card" | "BankTransfer">(
    "Cash",
  );
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [pct, setPct] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<reg.PrintOut_OpdSlipFieldsOut_>();
  useEffect(() => {
    if (ticket.data) onTicket(ticket.data);
  }, [ticket.data]);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  useEffect(() => {
    onPending(busy || unknownOutcome);
  }, [busy, unknownOutcome]);
  const pending = useRef<{
    fn: () => Promise<unknown>;
    message: string;
  } | null>(null);
  async function act(
    fn: () => Promise<unknown>,
    message: string,
    write = false,
  ) {
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      if (write) pending.current = { fn, message };
      await fn();
      if (write) {
        pending.current = null;
        setUnknownOutcome(false);
      }
      setNotice(message);
      await ticket.reload();
    } catch (e) {
      setError(e);
      if (write) {
        const status = e instanceof ApiError ? e.response.status : undefined;
        setUnknownOutcome(!status || status < 400 || status >= 500);
      }
    } finally {
      setBusy(false);
    }
  }
  const t = ticket.data;
  return (
    <section className="card">
      <h2>{tr("Payment, approval and printing")}</h2>
      <LoadState {...ticket} retry={ticket.reload} />
      <ErrorBox error={error} />
      {unknownOutcome && (
        <div role="alert">
          <p>
            {tr(
              "The action outcome is unknown. Retry the original payment or waiver request before starting another action.",
            )}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              pending.current &&
              void act(pending.current.fn, pending.current.message, true)
            }
          >
            {tr("Retry original action")}
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {t?.pending_approval && (
        <p role="status">
          {tr("Awaiting approval")}: {t.pending_approval.summary} ·{" "}
          {t.pending_approval.status}
        </p>
      )}
      {t?.cash_back_prompts.map((p) => (
        <p className="error" role="alert" key={`${p.kind}-${p.id}`}>
          {p.message}
        </p>
      ))}
      {t &&
        t.approval_lock === "None" &&
        ["Unpaid", "PartiallyPaid"].includes(t.payment_status) &&
        permissions.includes("finance.payment.collect") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                () =>
                  reg.pay(ticketId, {
                    method,
                    ...(amount ? { amount } : {}),
                    ...(reference ? { reference_no: reference } : {}),
                  }),
                tr("Payment recorded. The queue reflects the server result."),
                true,
              );
            }}
          >
            <fieldset disabled={busy || unknownOutcome}>
              <div className="form-grid">
                <Field label={tr("Payment method")}>
                  <select
                    aria-label={tr("Payment method")}
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                  >
                    {["Cash", "Card", "BankTransfer"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={tr("Payment amount")}
                  hint={tr("Leave blank to collect the full amount due.")}
                >
                  <input
                    aria-label={tr("Payment amount")}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label={tr("Card / bank reference")}>
                  <input
                    aria-label={tr("Card / bank reference")}
                    maxLength={60}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required={method !== "Cash"}
                  />
                </Field>
              </div>
              <button className="primary">{tr("Collect payment")}</button>
              <p className="fine muted">
                {tr(
                  "Cash requires your own open cash shift. A failed or lost answer must be retried with the same amount and method.",
                )}
              </p>
            </fieldset>
          </form>
        )}
      {t &&
        t.approval_lock === "None" &&
        t.payment_status === "Unpaid" &&
        permissions.includes("opd.waiver.request") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                () =>
                  api("POST", `/opd-tickets/${ticketId}/vip-waiver-request`, {
                    reason,
                    waiver_pct: pct,
                  }),
                tr("Waiver request sent for approval."),
                true,
              );
            }}
          >
            <fieldset disabled={busy || unknownOutcome}>
              <h3>{tr("Request VIP waiver")}</h3>
              <div className="form-grid">
                <Field label={tr("Waiver percent")}>
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    required
                    value={pct}
                    onChange={(e) => setPct(e.target.value)}
                  />
                </Field>
                <Field label={tr("Reason")}>
                  <input
                    minLength={3}
                    maxLength={1000}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
              <button>{tr("Request VIP waiver")}</button>
            </fieldset>
          </form>
        )}
      <h3>{tr("OPD slip")}</h3>
      <LoadState {...terminal} retry={terminal.reload} />
      {terminal.data && (
        <p className="fine muted">
          {terminal.data.registered
            ? `${tr("Receipt printer")}: ${terminal.data.receipt_printer_address || tr("Not configured")}`
            : terminal.data.hint ||
              tr(
                "Unregistered terminal: choose a printer in the print dialog.",
              )}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act(
              async () => setPreview(await reg.printPayload(ticketId)),
              "",
            )
          }
        >
          {tr("Preview slip")}
        </button>
        <button
          type="button"
          disabled={busy || terminal.loading || !!terminal.error}
          onClick={() =>
            void act(
              () => call("print-opd", { ticketId }),
              tr("Slip sent to printer."),
            )
          }
        >
          {tr("Print / reprint slip")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act(
              () => call("print-opd", { ticketId, pdf: true }),
              tr("PDF save dialog completed."),
            )
          }
        >
          {tr("Save slip PDF")}
        </button>
      </div>
      <p className="fine muted">
        {tr(
          "If printing fails, retry printing this ticket. Never repeat registration or payment to reprint.",
        )}
      </p>
      {preview && (
        <Modal
          title={tr("OPD slip preview")}
          onClose={() => setPreview(undefined)}
        >
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              direction: "ltr",
            }}
          >
            {preview.text}
          </pre>
          {[preview.barcode_svg, preview.qr_svg]
            .filter(Boolean)
            .map((svg, i) => (
              <img
                key={i}
                alt={i === 0 ? "Ticket barcode" : "Ticket QR"}
                src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg!)))}`}
                style={{ maxWidth: "100%", maxHeight: 140 }}
              />
            ))}
        </Modal>
      )}
    </section>
  );
}
