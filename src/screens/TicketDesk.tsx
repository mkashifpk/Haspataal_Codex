import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../bridge";
import { ErrorBox, Field, LoadState, Modal, useLoad } from "../components";
import { cashBackReviewKey, type CashBackDrawer } from "../cash-back-safety";
import type { OpdTicketDetailOut as Ticket } from "../generated/queue_management";
import { tr } from "../i18n";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";
import {
  definiteWriteRefusal,
  canRetryWrite,
  writeAttempt,
  type WriteAttempt,
} from "../write-attempt";
import { ticketExpired } from "../ticket-policy";
export type TicketRead = { ticket: Ticket; clock: number; at: number };
async function readTicket(path: string): Promise<TicketRead> {
  const r = await window.terminal.call("api", { method: "GET", path });
  if (!r.ok) throw new ApiError(r);
  const clock = Date.parse(
    (r as typeof r & { meta?: { server_time?: string } }).meta?.server_time ||
      "",
  );
  return { ticket: r.data, clock, at: performance.now() };
}
export function useTicketDesk(revision: number) {
  const [record, setRecord] = useState<TicketRead>(),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false);
  const id = useRef<number | undefined>(undefined),
    lastPath = useRef<string | undefined>(undefined),
    generation = useRef(0);
  const open = useCallback(async (path: string) => {
    lastPath.current = path;
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const r = await readTicket(path);
      if (n === generation.current) {
        id.current = r.ticket.ticket_id;
        setRecord(r);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, []);
  const select = useCallback(
    (ticketId: number) => {
      id.current = ticketId;
      generation.current++;
      setRecord(undefined);
      void open(`/opd-tickets/${ticketId}`);
    },
    [open],
  );
  const scan = async (number: string) => {
    id.current = undefined;
    generation.current++;
    setRecord(undefined);
    await open(`/opd-tickets/by-number/${encodeURIComponent(number.trim())}`);
  };
  const reload = useCallback(async () => {
    if (id.current) await open(`/opd-tickets/${id.current}`);
    else if (lastPath.current) await open(lastPath.current);
  }, [open]);
  useEffect(() => {
    void reload();
  }, [revision, reload]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  return { record, error, loading, scan, select, reload };
}
type Spec = {
  ticketId: number;
  path: string;
  body?: unknown;
  label: string;
  idempotent: boolean;
  identity?: string;
};
type Attempt = WriteAttempt<Spec>;
export function useTicketWrite(onSaved: (spec: Spec) => void | Promise<void>) {
  const [attempt, setAttempt] = useState<Attempt>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  const flight = useRef(false);
  async function send(a: Attempt) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    setAttempt(a);
    let confirmed = false;
    try {
      await api("POST", a.body.path, a.body.body, { key: a.key });
      confirmed = true;
      setAttempt(undefined);
      setNotice("Saved on the server. Refresh errors do not undo this action.");
      await onSaved(a.body);
    } catch (e) {
      setError(e);
      if (confirmed || definiteWriteRefusal(e)) setAttempt(undefined);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return {
    attempt,
    busy,
    error,
    notice: tr(notice),
    blocked: busy || !!attempt,
    start: (spec: Spec) => {
      if (!flight.current && !attempt) void send(writeAttempt(spec));
    },
    retry: () => {
      if (attempt?.body.idempotent && canRetryWrite(attempt))
        void send(attempt);
    },
    closeReviewed: () => {
      if (!flight.current) {
        setAttempt(undefined);
        setError(undefined);
        setNotice(
          "Uncertain action closed after your review; no success or reversal is asserted.",
        );
      }
    },
  };
}
export function TicketLookup({
  onScan,
  disabled,
}: {
  onScan: (n: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !disabled) onScan(value);
      }}
      data-unsaved="false"
    >
      <Field
        label={tr("OPD slip number")}
        hint={tr(
          "Scan the slip barcode and press Enter, or type its full number.",
        )}
      >
        <input
          data-help="desk.lookup"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          disabled={disabled}
          autoComplete="off"
        />
      </Field>
      <button data-help="desk.lookup" disabled={disabled || !value.trim()}>
        {tr("Open slip")}
      </button>
    </form>
  );
}
export function TicketSummary({
  record,
  timeZone,
  currency,
}: {
  record: TicketRead;
  timeZone?: string;
  currency?: string;
}) {
  const t = record.ticket,
    now = record.clock + (performance.now() - record.at),
    zoneError = hospitalTimeZoneError(timeZone);
  return (
    <section className="card">
      <h2>
        <bdi>{t.ticket_number}</bdi> · {t.patient_name}
      </h2>
      <p>
        <bdi>{t.mrn}</bdi> ·{" "}
        {t.doctor_name || t.department_name || tr("Unassigned")}
      </p>
      <p>
        {tr("Ticket status")}: {tr(t.status)} · {tr("Payment status")}:{" "}
        {tr(t.payment_status)} · {tr("Token")}:{" "}
        <bdi>{t.queue?.token_no ?? "—"}</bdi>
      </p>
      <ErrorBox error={zoneError} />
      <p>
        {tr("Valid until")}:{" "}
        {t.valid_until && !zoneError
          ? formatHospitalTime(t.valid_until, timeZone!)
          : t.valid_until
            ? tr("Hospital timezone unavailable")
            : tr("Not set")}
      </p>
      {ticketExpired(t, now) && (
        <p className="error" role="alert">
          {tr("Expired — new visit needs a new slip")}
        </p>
      )}
      {t.approval_lock !== "None" && (
        <p className="notice" role="status">
          {tr("Awaiting approval")}: {tr(t.approval_lock)}.{" "}
          {t.pending_approval?.summary}{" "}
          {tr("The ticket is locked and is off the doctor's queue.")}
        </p>
      )}
      {t.invoice && (
        <p>
          {t.invoice.invoice_no} · {tr("Amount paid")}:{" "}
          <bdi>
            {currency} {t.invoice.amount_paid}
          </bdi>{" "}
          · {tr("Balance due")}:{" "}
          <bdi>
            {currency} {t.invoice.balance_due}
          </bdi>
        </p>
      )}
    </section>
  );
}
export function WriteFeedback({
  write,
  onCheck,
}: {
  write: ReturnType<typeof useTicketWrite>;
  onCheck: () => void | Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [write.attempt?.key]);
  return (
    <>
      <ErrorBox error={write.error} />
      {write.notice && <p role="status">{write.notice}</p>}
      {write.attempt && !write.busy && (
        <section className="notice" role="alert">
          <p>
            {tr(
              "The result is uncertain. New actions and navigation are blocked. Check the latest slip before deciding what to do.",
            )}
          </p>
          <button data-help="desk.recovery" onClick={() => void onCheck()}>
            {tr("Check latest slip")}
          </button>
          {write.attempt.body.idempotent && canRetryWrite(write.attempt) && (
            <button data-help="desk.recovery" onClick={write.retry}>
              {tr("Retry original action")}
            </button>
          )}
          {!write.attempt.body.idempotent && (
            <p>
              {tr(
                "Deferral is never retried automatically or with a new action. Read the current status and history.",
              )}
            </p>
          )}
          <label className="check">
            <input
              data-help="desk.recovery"
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            {tr(
              "I have reviewed the latest server status and will close this uncertain action.",
            )}
          </label>
          <button
            data-help="desk.recovery"
            disabled={!checked}
            onClick={write.closeReviewed}
          >
            {tr("Close reviewed action")}
          </button>
        </section>
      )}
    </>
  );
}
export function CashBackModal({
  record,
  currency,
  permissions,
  readOnly,
  reload,
  onShift,
}: {
  record: TicketRead;
  currency?: string;
  permissions: string[];
  readOnly: boolean;
  reload: () => Promise<void>;
  onShift: () => void;
}) {
  const p = record.ticket.cash_back_prompts[0],
    completed = useRef(new Set<string>()),
    [handedFor, setHandedFor] = useState<string>(),
    [sessionError, setSessionError] = useState<unknown>();
  const write = useTicketWrite(async (spec) => {
    if (spec.identity) completed.current.add(spec.identity);
    await reload();
  });
  const drawer = useLoad(async ():Promise<CashBackDrawer|null> => {
    if (!p || !permissions.includes("opd.cash_back.dispense")) return null;
    const [user,terminal,shift] = await Promise.all([
      api<CashBackDrawer["user"]>("GET", "/auth/me"),
      api<CashBackDrawer["terminal"]>("GET", "/terminals/whoami"),
      api<CashBackDrawer["shift"]>("GET", "/finance/cash-shifts/mine"),
    ]);
    return {user,terminal,shift};
  }, [p?.id,p?.kind,p?.amount,record.at,permissions.includes("opd.cash_back.dispense")]);
  const reviewKey = p ? cashBackReviewKey(record.ticket,p,drawer.data) : undefined;
  const drawerReady = !!reviewKey && !drawer.loading && !drawer.error;
  const handed = drawerReady && handedFor === reviewKey;
  if (!p && !write.blocked) return null;
  return (
    <div data-write-pending="true">
      <Modal
        title={tr("Mandatory cash-back")}
        onClose={() => {}}
        closable={false}
      >
        <ErrorBox error={sessionError} />
        <p>
          <bdi>{record.ticket.ticket_number}</bdi> ·{" "}
          {record.ticket.patient_name} · <bdi>{record.ticket.mrn}</bdi>
        </p>
        {p && (
          <>
            <p className="error" role="alert">
              {p.message}
            </p>
            <h3>
              {tr("Exact cash to hand back")}:{" "}
              <bdi>
                {currency} {p.amount}
              </bdi>
            </h3>
            <p>
              {tr(
                "Cash leaves your own open shift at this counter. Open My cash shift in another window if needed, then check this slip again.",
              )}
            </p>
            <LoadState {...drawer} retry={drawer.reload} />
            {!drawer.loading && !drawer.error && !drawerReady && permissions.includes("opd.cash_back.dispense") && (
              <p className="error" role="alert">{tr("Before handing over cash, open your own shift at this terminal's assigned counter, then refresh the slip. Do not hand over cash while the drawer check is unavailable.")}</p>
            )}
            {drawerReady && <p>{tr("Verified open shift")}: <bdi>{drawer.data?.shift?.shift_id} · {drawer.data?.shift?.node}</bdi></p>}
            <button data-help="cashback.shift" onClick={onShift}>
              {tr("Open another window for My cash shift")}
            </button>
            <label className="check">
              <input
                data-help="cashback.confirm"
                type="checkbox"
                checked={handed}
                disabled={write.blocked || readOnly || !drawerReady || !permissions.includes("opd.cash_back.dispense")}
                onChange={(e) => setHandedFor(e.target.checked ? reviewKey : undefined)}
              />
              {tr(
                "I have verified the patient and handed over this exact cash amount.",
              )}
            </label>
            {!permissions.includes("opd.cash_back.dispense") && (
              <p role="alert">
                {tr("An authorized cashier must complete this handover.")}
              </p>
            )}
            <button
              data-help="cashback.confirm"
              className="primary"
              disabled={
                !handed ||
                write.blocked ||
                readOnly ||
                completed.current.has(`${record.ticket.ticket_id}:${p.kind}:${p.id}`) ||
                !permissions.includes("opd.cash_back.dispense")
              }
              onClick={() => {
                if (!handed || !drawerReady || write.blocked || readOnly || !permissions.includes("opd.cash_back.dispense")) return;
                write.start({
                  ticketId: record.ticket.ticket_id,
                  path: `/opd-tickets/${record.ticket.ticket_id}/${p.kind === "Refund" ? "refund" : "waiver-refund"}/confirm-dispensation`,
                  identity: `${record.ticket.ticket_id}:${p.kind}:${p.id}`,
                  label: p.message,
                  idempotent: true,
                });
              }}
            >
              {tr("Confirm cash handed back")}
            </button>
          </>
        )}
        <WriteFeedback write={write} onCheck={reload} />
        <button
          data-help="desk.refresh"
          disabled={write.busy}
          onClick={() => void reload()}
        >
          {tr("Refresh slip")}
        </button>
        <button
          data-help="cashback.shift"
          disabled={write.blocked}
          onClick={async () => {
            if (write.blocked) return;
            setSessionError(undefined);
            try {
              const r = await window.terminal.call("logout", { all: false });
              if (!r.ok) throw new ApiError(r);
            } catch (e) {
              setSessionError(e);
            }
          }}
        >
          {tr("Sign out; leave cash-back pending")}
        </button>
      </Modal>
    </div>
  );
}
export function DeskLoading({
  desk,
}: {
  desk: ReturnType<typeof useTicketDesk>;
}) {
  return (
    <LoadState loading={desk.loading} error={desk.error} retry={desk.reload} />
  );
}
