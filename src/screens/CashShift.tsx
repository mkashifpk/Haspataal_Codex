import { useEffect, useRef, useState } from "react";
import { tr } from "../i18n";
import * as cashShift from "../generated/my_cash_shift";
import { api } from "../bridge";
import type { TerminalIdentityOut } from "../generated/connect_server";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  cashAmount,
  createShiftOpen,
  definiteShiftRefusal,
  mayRetryShiftOpen,
  matchesShiftCloseReview,
  type ShiftCloseReview,
  type ShiftAttempt,
} from "../cash-shift-safety";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";

const NODE_LABELS: Record<string, [string, string]> = {
  MainReception: ["Main reception", "مرکزی استقبالیہ"],
  PharmacyCounter: ["Pharmacy counter", "فارمیسی کاؤنٹر"],
  LabReception: ["Lab reception", "لیب کا استقبالیہ"],
  IPDBilling: ["IPD billing", "آئی پی ڈی بلنگ"],
  EmergencyCounter: ["Emergency counter", "ایمرجنسی کاؤنٹر"],
  CashierDesk: ["Cashier desk", "کیشیئر ڈیسک"],
};

const TXN_LABELS: Record<string, [string, string]> = {
  Sale: ["Sale", "فروخت"],
  ARCollection: ["AR collection", "بقایا وصولی"],
  Refund: ["Refund", "واپسی (ریفنڈ)"],
  WaiverDispensation: ["Waiver dispensation", "رعایت کی ادائیگی"],
  APPayout: ["AP payout", "ادائیگی (اے پی)"],
  Adjustment: ["Adjustment", "ترمیم / مطابقت"],
  CashDrop: ["Cash drop", "کیش ڈراپ"],
};

const METHOD_LABELS: Record<string, [string, string]> = {
  Cash: ["Cash", "نقد"],
  Card: ["Card", "کارڈ"],
  BankTransfer: ["Bank transfer", "بینک ٹرانسفر"],
  PanelCredit: ["Panel credit", "پینل کریڈٹ"],
  PayrollDeduction: ["Payroll deduction", "تنخواہ سے کٹوتی"],
  Charity: ["Charity", "فلاحی امداد"],
};

const STATUS_LABELS: Record<string, [string, string]> = {
  Open: ["Open", "کھلی ہوئی"],
  PendingCollection: ["Pending collection", "وصولی کا انتظار"],
  Verified: ["Verified", "تصدیق شدہ"],
  AwaitingSecondApproval: [
    "Awaiting second approval",
    "دوسری منظوری کا انتظار",
  ],
  Approved: ["Approved", "منظور شدہ"],
  Rejected: ["Rejected", "مسترد شدہ"],
};

export function CashShift({
  user,
  revision,
  timeZone,
  currency,
}: {
  user: { user_id: number; permissions: string[] };
  revision: number;
  timeZone?: string;
  currency?: string;
}) {
  const canOperate = user.permissions.includes("finance.shift.operate");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [declaredCash, setDeclaredCash] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [confirmClose, setConfirmClose] = useState<ShiftCloseReview>();
  const [attempt, setAttempt] = useState<ShiftAttempt>();
  const [checked, setChecked] =
    useState<cashShift.CashShiftSummaryOut | null>();
  const [review, setReview] = useState<cashShift.CashShiftSummaryOut>();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const shiftReq = useLoad(
    () => (canOperate ? cashShift.myShift() : Promise.resolve(null)),
    [revision, canOperate],
  );
  const terminalReq = useLoad(
    () =>
      canOperate
        ? api<TerminalIdentityOut>("GET", "/terminals/whoami")
        : Promise.resolve(null),
    [canOperate],
  );
  const shift = review || shiftReq.data;
  const node = terminalReq.data?.cash_node;
  const sameCounter = !!node && !!shift && node === shift.node;
  const readyToClose =
    canOperate &&
    sameCounter &&
    shift?.user_id === user.user_id &&
    shift.status === "Open" &&
    !shiftReq.loading &&
    !shiftReq.error &&
    !terminalReq.loading &&
    !terminalReq.error;
  const txnsReq = useLoad(
    async () => ({
      shiftId: shift?.shift_id,
      rows: shift ? await cashShift.shiftTxns(shift.shift_id) : [],
    }),
    [shift?.shift_id, revision],
  );
  const transactions =
    txnsReq.data?.shiftId === shift?.shift_id ? txnsReq.data?.rows : undefined;
  const zoneProblem = hospitalTimeZoneError(timeZone);
  const formatTime = (value?: string | null) =>
    !value
      ? "—"
      : zoneProblem
        ? tr("Hospital timezone unavailable")
        : formatHospitalTime(value, timeZone!);
  const money = (value?: number | null) =>
    value == null ? "—" : (currency ? currency + " " : "") + String(value);
  const blocked = busy || !!attempt;
  useEffect(() => {
    if (!blocked) return;
    const keepAttempt = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", keepAttempt);
    return () => window.removeEventListener("beforeunload", keepAttempt);
  }, [blocked]);
  const readShift = (id: number) =>
    api<cashShift.CashShiftSummaryOut>("GET", "/finance/cash-shifts/" + id);

  async function refresh() {
    if (flight.current) return;
    setError(undefined);
    if (review) {
      try {
        setReview(await readShift(review.shift_id));
      } catch (cause) {
        setError(cause);
      }
    } else await shiftReq.reload();
    await terminalReq.reload();
    await txnsReq.reload();
  }
  async function send(action: ShiftAttempt) {
    if (flight.current) return;
    if (action.kind === "open" && !mayRetryShiftOpen(action)) {
      setError(
        new Error(
          tr(
            "The original opening cannot be retried after 24 hours or a clock change. Check with your supervisor.",
          ),
        ),
      );
      return;
    }
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    setChecked(undefined);
    setAttempt(action);
    try {
      if (action.kind === "open") {
        const opened = await api<cashShift.CashShiftOut>(
          "POST",
          "/finance/cash-shifts/open",
          action.body,
          { key: action.key },
        );
        // The write is confirmed even if the following read fails; never repeat it for a read failure.
        setAttempt(undefined);
        setOpeningFloat("0");
        setNotice(
          tr("Cash shift opened successfully.") + " #" + opened.shift_id,
        );
        await shiftReq.reload();
      } else {
        const closed = await cashShift.closeShift(action.shiftId, action.body);
        setReview(closed);
        setAttempt(undefined);
        setDeclaredCash("");
        setConfirmClose(undefined);
        setNotice(
          tr("Shift closed successfully. Pending collection by accountant."),
        );
        await shiftReq.reload();
      }
    } catch (cause) {
      setError(cause);
      if (definiteShiftRefusal(cause)) {
        // SHIFT_NOT_OPEN still needs the original record, rather than a blind new close.
        if (action.kind === "close") setAttempt(action);
        else setAttempt(undefined);
      }
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function openShift(event: React.FormEvent) {
    event.preventDefault();
    const amount = cashAmount(openingFloat);
    if (
      blocked ||
      !canOperate ||
      shiftReq.loading ||
      shiftReq.error ||
      shift ||
      terminalReq.loading ||
      terminalReq.error ||
      !node ||
      amount === undefined
    )
      return;
    const action = createShiftOpen(node, amount, crypto.randomUUID());
    void send(action);
  }
  async function checkAttempt() {
    if (!attempt || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    setChecked(undefined);
    try {
      const current =
        attempt.kind === "close"
          ? await readShift(attempt.shiftId)
          : await cashShift.myShift();
      // Do not substitute a different user's or shift's record after a missing/lost result.
      if (
        current &&
        (current.user_id !== user.user_id ||
          (attempt.kind === "open" && current.node !== attempt.body.node) ||
          (attempt.kind === "close" && current.shift_id !== attempt.shiftId))
      )
        throw new Error(
          tr(
            "The returned shift does not match this attempt. Contact your supervisor.",
          ),
        );
      setChecked(current);
      if (current) setReview(current);
      await shiftReq.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function releaseAttempt() {
    if (busy || checked === undefined) return;
    if (
      !window.confirm(
        tr(
          "Confirm that you checked the original shift with your supervisor. This clears the hold only; it does not declare success or undo anything.",
        ),
      )
    )
      return;
    setAttempt(undefined);
    setChecked(undefined);
    setConfirmClose(undefined);
    setNotice(
      tr(
        "Recovery hold cleared after review. Check the current shift before starting another action.",
      ),
    );
  }

  if (!canOperate)
    return (
      <section className="card" role="alert">
        <h1>{tr("Access denied")}</h1>
        <p>
          {tr(
            "Your account does not have permission to operate a cash shift (finance.shift.operate).",
          )}
        </p>
      </section>
    );
  return (
    <div
      data-unsaved={!attempt && (openingFloat !== "0" || !!declaredCash)}
      data-write-pending={blocked}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{tr("COUNTER CASH & DRAWER")}</span>
          <h1>{tr("My cash shift")}</h1>
          <p className="muted">
            {tr(
              "Open/close the drawer; see collections by type; hand over the cash drop.",
            )}
          </p>
        </div>
        <button
          data-help="cash.refresh"
          disabled={blocked || shiftReq.loading}
          onClick={() => void refresh()}
        >
          {tr("Refresh")}
        </button>
      </div>
      <LoadState {...shiftReq} retry={shiftReq.reload} />
      <LoadState {...terminalReq} retry={terminalReq.reload} />
      <ErrorBox error={error} />
      <ErrorBox error={zoneProblem} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {review && (
        <button
          data-help="cash.refresh"
          disabled={blocked}
          onClick={() => {
            setReview(undefined);
            void shiftReq.reload();
          }}
        >
          {tr("Show my current shift")}
        </button>
      )}
      <p className="muted">
        {tr("Terminal cash counter")}:{" "}
        <strong>
          {node
            ? tr(NODE_LABELS[node]?.[0] || node)
            : tr("Not mapped — ask IT")}
        </strong>
        {timeZone && " · " + timeZone}
      </p>
      {!node && !terminalReq.loading && !terminalReq.error && (
        <p className="notice">
          {tr(
            "Ask IT to map this terminal to a cash counter before opening a shift.",
          )}
        </p>
      )}
      {attempt && (
        <section className="card" aria-label={tr("Cash shift recovery")}>
          <h2>{tr("Check the original shift before continuing")}</h2>
          <p>
            {tr(
              "The result needs review. Do not start a replacement action. Keep this window open; this attempt is held in memory only.",
            )}
          </p>
          <p>
            {attempt.kind === "open"
              ? tr(
                  "An opening retry uses the exact original amount, counter and request identity within 24 hours.",
                )
              : tr(
                  "A close request is never automatically retried. Read the original shift and review its status first.",
                )}
          </p>
          <Details
            value={
              attempt.kind === "open"
                ? attempt.body
                : { shift_id: attempt.shiftId, ...attempt.body }
            }
          />
          <div className="actions">
            <button
              data-help="cash.recovery"
              disabled={busy}
              onClick={() => void checkAttempt()}
            >
              {tr("Check original shift")}
            </button>
            {attempt.kind === "open" && mayRetryShiftOpen(attempt) && (
              <button
                data-help="cash.recovery"
                disabled={busy}
                onClick={() => void send(attempt)}
              >
                {tr("Retry original opening")}
              </button>
            )}
            <button
              data-help="cash.recovery"
              disabled={busy || checked === undefined}
              onClick={releaseAttempt}
            >
              {tr("Close reviewed attempt")}
            </button>
          </div>
          {checked !== undefined && (
            <>
              <h3>{tr("Server status checked")}</h3>
              {checked ? (
                <Details value={checked} />
              ) : (
                <p>
                  {tr(
                    "No open shift was returned. This alone does not prove the original action failed.",
                  )}
                </p>
              )}
            </>
          )}
        </section>
      )}
      {!shiftReq.loading && !shiftReq.error && !shift && !attempt && (
        <section className="card narrow">
          <h2>{tr("Open cash shift")}</h2>
          <p>
            {tr(
              "The cash counter comes from this terminal's mapping. Ask IT if it is incorrect.",
            )}
          </p>
          <form onSubmit={openShift}>
            <fieldset disabled={busy}>
              <Field
                label={tr("Opening float")}
                hint={tr(
                  "Cash in the drawer at shift start (e.g. for making change).",
                )}
              >
                <input
                  data-help="cash.open"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={openingFloat}
                  onChange={(event) => setOpeningFloat(event.target.value)}
                />
              </Field>
              <button
                data-help="cash.open"
                className="primary"
                disabled={
                  !node ||
                  !!terminalReq.error ||
                  terminalReq.loading ||
                  cashAmount(openingFloat) === undefined
                }
              >
                {busy ? tr("Opening…") : tr("Open cash shift")}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      {shift && (
        <>
          <section className="card">
            <span className="eyebrow">
              {tr("Shift #")} {shift.shift_id} ·{" "}
              <bdi>{shift.business_date}</bdi>
            </span>
            <h2>
              {tr(NODE_LABELS[shift.node]?.[0] || shift.node)} ·{" "}
              {tr(STATUS_LABELS[shift.status]?.[0] || shift.status)}
            </h2>
            <p>
              {tr("Cashier")}: {shift.cashier_name}
            </p>
            <p>
              {tr("Opened at")}: {formatTime(shift.opened_at)}
              {shift.closed_at && (
                <>
                  {" "}
                  · {tr("Closed at")}: {formatTime(shift.closed_at)}
                </>
              )}
            </p>
            <dl className="details">
              <div>
                <dt>{tr("Opening float")}</dt>
                <dd dir="ltr">{money(shift.opening_float)}</dd>
              </div>
              <div>
                <dt>{tr("Expected cash")}</dt>
                <dd dir="ltr">{money(shift.expected_cash)}</dd>
              </div>
              <div>
                <dt>{tr("Declared cash")}</dt>
                <dd dir="ltr">{money(shift.declared_cash)}</dd>
              </div>
            </dl>
            {!sameCounter && (
              <p className="notice">
                {tr(
                  "This shift belongs to another counter, or the terminal mapping is unavailable. Check with your supervisor before handling cash here.",
                )}
              </p>
            )}
          </section>
          <div className="split">
            <section className="card">
              <h2>{tr("Collections by transaction type")}</h2>
              {!shift.by_type.length && (
                <Empty>{tr("No transaction collections recorded yet.")}</Empty>
              )}
              {shift.by_type.map((item) => (
                <p key={item.txn_type}>
                  {tr(TXN_LABELS[item.txn_type]?.[0] || item.txn_type)} ·{" "}
                  {item.count} {tr("transactions")} ·{" "}
                  <bdi>{money(item.total)}</bdi>
                </p>
              ))}
            </section>
            <section className="card">
              <h2>{tr("Non-cash collections")}</h2>
              {!shift.non_cash.length && (
                <Empty>{tr("No non-cash payments in this shift.")}</Empty>
              )}
              {shift.non_cash.map((item) => (
                <p key={item.method}>
                  {tr(METHOD_LABELS[item.method]?.[0] || item.method)} ·{" "}
                  {item.count} {tr("transactions")} ·{" "}
                  <bdi>{money(item.total)}</bdi>
                </p>
              ))}
            </section>
          </div>
          {shift.cash_drop && (
            <section className="card">
              <h2>{tr("Cash drop details")}</h2>
              <p>
                {tr("Status")}:{" "}
                {tr(
                  STATUS_LABELS[shift.cash_drop.status]?.[0] ||
                    shift.cash_drop.status,
                )}
              </p>
              <p>
                {tr("Counted cash")}:{" "}
                <bdi>{money(shift.cash_drop.counted_cash)}</bdi> ·{" "}
                {tr("Variance")}: <bdi>{money(shift.cash_drop.variance)}</bdi>
              </p>
              {shift.cash_drop.note && <p>{shift.cash_drop.note}</p>}
            </section>
          )}
          <section className="card">
            <h2>{tr("Drawer ledger of a shift")}</h2>
            <LoadState {...txnsReq} retry={txnsReq.reload} />
            {transactions?.length === 0 && (
              <Empty>{tr("No drawer transactions recorded yet.")}</Empty>
            )}
            <div className="cash-ledger">
              {transactions?.map((txn) => (
                <article className="list-row" key={txn.shift_txn_id}>
                  <span>{formatTime(txn.at)}</span>
                  <strong>
                    {tr(TXN_LABELS[txn.txn_type]?.[0] || txn.txn_type)}
                  </strong>
                  <bdi>{txn.receipt_no || "—"}</bdi>
                  {txn.invoice_id && (
                    <span>
                      {tr("Invoice")} #{txn.invoice_id}
                    </span>
                  )}
                  <span>{txn.note || "—"}</span>
                  <strong dir="ltr">{money(txn.amount)}</strong>
                </article>
              ))}
            </div>
          </section>
          {shift.status === "Open" && !attempt && (
            <section className="card">
              <h2>{tr("Close shift")}</h2>
              <p>
                {tr(
                  "Closing asks for the counted cash; the Accountant verifies it later.",
                )}
              </p>
              <Field
                label={tr("Counted cash in drawer")}
                hint={tr(
                  "Cash the cashier counted in the drawer (excluding the opening float).",
                )}
              >
                <input
                  data-help="cash.close"
                  type="number"
                  min="0"
                  step="any"
                  value={declaredCash}
                  disabled={
                    busy ||
                    !readyToClose ||
                    shiftReq.loading ||
                    !!shiftReq.error ||
                    !!terminalReq.error
                  }
                  onChange={(event) => setDeclaredCash(event.target.value)}
                />
              </Field>
              <button
                data-help="cash.close"
                className="primary"
                disabled={
                  blocked ||
                  !readyToClose ||
                  !!terminalReq.error ||
                  shiftReq.loading ||
                  !!shiftReq.error ||
                  cashAmount(declaredCash) === undefined
                }
                onClick={() => {
                  const amount = cashAmount(declaredCash);
                  if (amount !== undefined && readyToClose)
                    setConfirmClose(
                      Object.freeze({
                        shiftId: shift.shift_id,
                        node: shift.node,
                        expectedCash: shift.expected_cash,
                        declaredCash: amount,
                      }),
                    );
                }}
              >
                {tr("Close shift")}
              </button>
            </section>
          )}
          {confirmClose && !attempt && (
            <Modal
              title={tr("Confirm Shift Closure")}
              onClose={() => {
                if (!busy) setConfirmClose(undefined);
              }}
            >
              <p>
                {tr(
                  "Closing records your counted cash for the accountant to verify. You will not be able to record further counter cash on this shift.",
                )}
              </p>
              <dl className="details">
                <div>
                  <dt>{tr("Shift #")}</dt>
                  <dd>
                    {confirmClose.shiftId} ·{" "}
                    {tr(
                      NODE_LABELS[confirmClose.node]?.[0] || confirmClose.node,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Expected cash")}</dt>
                  <dd dir="ltr">{money(confirmClose.expectedCash)}</dd>
                </div>
                <div>
                  <dt>{tr("Counted cash")}</dt>
                  <dd dir="ltr">{money(confirmClose.declaredCash)}</dd>
                </div>
              </dl>
              {!matchesShiftCloseReview(confirmClose, shift) && (
                <p role="alert">
                  {tr(
                    "The shift or expected cash changed. Go back, refresh and review the counted cash again.",
                  )}
                </p>
              )}
              <div className="actions">
                <button
                  data-help="cash.close"
                  disabled={busy}
                  onClick={() => setConfirmClose(undefined)}
                >
                  {tr("Go back")}
                </button>
                <button
                  data-help="cash.close"
                  className="primary"
                  disabled={
                    busy ||
                    !readyToClose ||
                    !matchesShiftCloseReview(confirmClose, shift)
                  }
                  onClick={() => {
                    if (
                      matchesShiftCloseReview(confirmClose, shift) &&
                      !blocked &&
                      readyToClose &&
                      canOperate
                    )
                      void send({
                        kind: "close",
                        shiftId: confirmClose.shiftId,
                        body: { declared_cash: confirmClose.declaredCash },
                      });
                  }}
                >
                  {tr("Confirm & Close Shift")}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
