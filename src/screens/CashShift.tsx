import { useEffect, useState } from "react";
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

export function CashShift({ user, revision }: { user: any; revision: number }) {
  const canOperate = user?.permissions?.includes("finance.shift.operate");

  // Form states for opening shift
  const [selectedNode, setSelectedNode] = useState<
    cashShift.OpenShiftIn["node"] | ""
  >("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState<unknown>();

  // Form states for closing shift
  const [declaredCash, setDeclaredCash] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<unknown>();

  // Feedback notice
  const [notice, setNotice] = useState<string>("");

  // Load active shift
  const shiftReq = useLoad(() => cashShift.myShift(), [revision]);
  const shift = shiftReq.data;

  const terminalReq = useLoad(
    () => api<TerminalIdentityOut>("GET", "/terminals/whoami"),
    [],
  );
  useEffect(() => {
    setSelectedNode(terminalReq.data?.cash_node || "");
  }, [terminalReq.data]);

  // Load shift ledger transactions when shift is open
  const txnsReq = useLoad(async () => {
    if (!shift?.shift_id) return [];
    return cashShift.shiftTxns(shift.shift_id);
  }, [shift?.shift_id, revision]);

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    if (
      !selectedNode ||
      terminalReq.loading ||
      terminalReq.error ||
      !terminalReq.data ||
      shiftReq.error
    )
      return;
    setOpenBusy(true);
    setOpenError(undefined);
    setNotice("");
    try {
      const floatNum = parseFloat(openingFloat) || 0;
      await cashShift.openShift({
        node: selectedNode,
        opening_float: floatNum,
      });
      setNotice(tr("Cash shift opened successfully."));
      setOpeningFloat("0");
      await shiftReq.reload();
    } catch (err) {
      setOpenError(err);
    } finally {
      setOpenBusy(false);
    }
  }

  async function handleCloseShift() {
    if (!shift) return;
    setCloseBusy(true);
    setCloseError(undefined);
    try {
      const declaredNum = parseFloat(declaredCash);
      if (isNaN(declaredNum) || declaredNum < 0) {
        throw new Error(tr("Please enter a valid cash amount (0 or more)."));
      }
      await cashShift.closeShift(shift.shift_id, {
        declared_cash: declaredNum,
      });
      setNotice(
        tr("Shift closed successfully. Pending collection by accountant."),
      );
      setCloseConfirmOpen(false);
      setDeclaredCash("");
      await shiftReq.reload();
    } catch (err: any) {
      setCloseError(err);
      // If error is SHIFT_NOT_OPEN, reload to reflect server state
      if (err?.response?.error?.code === "SHIFT_NOT_OPEN") {
        await shiftReq.reload();
      }
    } finally {
      setCloseBusy(false);
    }
  }

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null) return "₨ 0.00";
    return `₨ ${Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (!canOperate) {
    return (
      <div className="card" role="alert">
        <h2>{tr("Access denied")}</h2>
        <p className="muted">
          {tr(
            "Your account does not have permission to operate a cash shift (finance.shift.operate).",
          )}
        </p>
      </div>
    );
  }

  return (
    <>
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
        <div className="actions">
          <button
            onClick={() => {
              shiftReq.reload();
              txnsReq.reload();
            }}
            title={tr("Refresh shift details")}
          >
            {tr("Refresh")}
          </button>
        </div>
      </div>

      <LoadState {...shiftReq} retry={shiftReq.reload} />

      {notice && (
        <div className="notice" role="status">
          <p>{notice}</p>
        </div>
      )}

      {/* No open shift state */}
      {!shiftReq.loading && !shiftReq.error && !shift && (
        <section className="card narrow" style={{ margin: "20px auto" }}>
          <h2>{tr("Open cash shift")}</h2>
          <p className="muted">
            {tr(
              "Every cash action needs an open shift at this counter (node from GET /terminals/whoami cash_node).",
            )}
          </p>

          <LoadState {...terminalReq} retry={terminalReq.reload} />
          <ErrorBox error={openError} />

          <form onSubmit={handleOpenShift}>
            <Field
              label={tr("Cash counter (Node)")}
              hint={tr(
                "The designated service counter where you are collecting cash.",
              )}
            >
              <select
                value={selectedNode}
                onChange={(e) =>
                  setSelectedNode(
                    e.target.value as cashShift.OpenShiftIn["node"],
                  )
                }
                disabled={openBusy}
                aria-label={tr("Cash counter (Node)")}
              >
                <option value="" disabled>
                  {tr("Select cash counter")}
                </option>
                {Object.keys(NODE_LABELS).map((nodeKey) => (
                  <option key={nodeKey} value={nodeKey}>
                    {tr(NODE_LABELS[nodeKey][0])}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={tr("Opening float")}
              hint={tr(
                "Cash in the drawer at shift start (e.g. for making change).",
              )}
            >
              <input
                type="number"
                min="0"
                step="any"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                disabled={openBusy}
                placeholder="0.00"
                required
                aria-label={tr("Opening float")}
              />
            </Field>

            <div className="actions">
              <button
                type="submit"
                className="primary"
                disabled={
                  openBusy ||
                  !selectedNode ||
                  terminalReq.loading ||
                  !!terminalReq.error ||
                  !terminalReq.data
                }
              >
                {openBusy ? tr("Opening…") : tr("Open cash shift")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Open / active shift view */}
      {shift && (
        <>
          {/* Shift Header & KPI Card */}
          <section className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span
                  className="fine"
                  style={{ letterSpacing: "1px", textTransform: "uppercase" }}
                >
                  {tr("Shift #")} {shift.shift_id} · {shift.business_date}
                </span>
                <h2 style={{ margin: "4px 0 8px" }}>
                  {tr(NODE_LABELS[shift.node]?.[0] || shift.node)}
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {tr("Cashier")}: <strong>{shift.cashier_name}</strong> ·{" "}
                  {tr("Opened at")}: {formatDateTime(shift.opened_at)}
                  {shift.closed_at && (
                    <>
                      {" "}
                      · {tr("Closed at")}: {formatDateTime(shift.closed_at)}
                    </>
                  )}
                </p>
              </div>
              <div>
                <span
                  className="badge"
                  style={{
                    fontSize: 14,
                    padding: "6px 12px",
                    fontWeight: 600,
                  }}
                >
                  {tr(STATUS_LABELS[shift.status]?.[0] || shift.status)}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div>
                <small className="muted">{tr("Opening float")}</small>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {formatMoney(shift.opening_float)}
                </div>
              </div>
              <div>
                <small className="muted">{tr("Expected cash")}</small>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {formatMoney(shift.expected_cash)}
                </div>
              </div>
              <div>
                <small className="muted">{tr("Declared cash")}</small>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {shift.declared_cash !== null
                    ? formatMoney(shift.declared_cash)
                    : "—"}
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown: By Type & Non-cash */}
          <div className="split">
            {/* Collections by Transaction Type */}
            <section className="card" style={{ margin: 0 }}>
              <h3>{tr("Collections by transaction type")}</h3>
              {shift.by_type.length === 0 ? (
                <p className="muted fine">
                  {tr("No transaction collections recorded yet.")}
                </p>
              ) : (
                <div className="details-list" style={{ marginTop: 12 }}>
                  {shift.by_type.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <div>
                        <strong>
                          {tr(TXN_LABELS[item.txn_type]?.[0] || item.txn_type)}
                        </strong>
                        <span
                          className="fine muted"
                          style={{ display: "block" }}
                        >
                          {item.count} {tr("transactions")}
                        </span>
                      </div>
                      <div style={{ textAlign: "end", fontWeight: 600 }}>
                        {formatMoney(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Non-cash Collections */}
            <section className="card" style={{ margin: 0 }}>
              <h3>{tr("Non-cash collections")}</h3>
              {shift.non_cash.length === 0 ? (
                <p className="muted fine">
                  {tr("No non-cash payments in this shift.")}
                </p>
              ) : (
                <div className="details-list" style={{ marginTop: 12 }}>
                  {shift.non_cash.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <div>
                        <strong>
                          {tr(METHOD_LABELS[item.method]?.[0] || item.method)}
                        </strong>
                        <span
                          className="fine muted"
                          style={{ display: "block" }}
                        >
                          {item.count} {tr("payments")}
                        </span>
                      </div>
                      <div style={{ textAlign: "end", fontWeight: 600 }}>
                        {formatMoney(item.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cash Drop information if exists */}
              {shift.cash_drop && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <h3>{tr("Cash drop details")}</h3>
                  <p className="fine muted">
                    {tr("Status")}:{" "}
                    <strong>
                      {tr(
                        STATUS_LABELS[shift.cash_drop.status]?.[0] ||
                          shift.cash_drop.status,
                      )}
                    </strong>
                  </p>
                  <p className="fine muted">
                    {tr("Counted cash")}:{" "}
                    {formatMoney(shift.cash_drop.counted_cash)}
                    {shift.cash_drop.variance !== null && (
                      <>
                        {" "}
                        · {tr("Variance")}:{" "}
                        {formatMoney(shift.cash_drop.variance)}
                      </>
                    )}
                  </p>
                  {shift.cash_drop.note && (
                    <p className="fine muted">
                      {tr("Note")}: {shift.cash_drop.note}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Drawer Transactions Ledger */}
          <section className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3>{tr("Drawer ledger of a shift")}</h3>
              <span className="fine muted">
                {txnsReq.data?.length || 0} {tr("recorded entries")}
              </span>
            </div>

            <LoadState {...txnsReq} retry={txnsReq.reload} />

            {txnsReq.data?.length === 0 && (
              <Empty>{tr("No drawer transactions recorded yet.")}</Empty>
            )}

            {txnsReq.data && txnsReq.data.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "start",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--line)",
                        textAlign: "start",
                      }}
                    >
                      <th style={{ padding: "10px 8px", textAlign: "start" }}>
                        {tr("Time")}
                      </th>
                      <th style={{ padding: "10px 8px", textAlign: "start" }}>
                        {tr("Txn Type")}
                      </th>
                      <th style={{ padding: "10px 8px", textAlign: "start" }}>
                        {tr("Receipt / Invoice")}
                      </th>
                      <th style={{ padding: "10px 8px", textAlign: "start" }}>
                        {tr("Note")}
                      </th>
                      <th style={{ padding: "10px 8px", textAlign: "end" }}>
                        {tr("Amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {txnsReq.data.map((txn) => (
                      <tr
                        key={txn.shift_txn_id}
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <td style={{ padding: "10px 8px" }} className="fine">
                          {formatDateTime(txn.at)}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <span className="badge">
                            {tr(TXN_LABELS[txn.txn_type]?.[0] || txn.txn_type)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px" }} className="fine">
                          {txn.receipt_no && <span>{txn.receipt_no}</span>}
                          {txn.invoice_id && (
                            <span
                              className="muted"
                              style={{ display: "block" }}
                            >
                              Inv #{txn.invoice_id}
                            </span>
                          )}
                          {!txn.receipt_no && !txn.invoice_id && "—"}
                        </td>
                        <td
                          style={{ padding: "10px 8px" }}
                          className="fine muted"
                        >
                          {txn.note || "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 8px",
                            textAlign: "end",
                            fontWeight: 600,
                            color: txn.amount < 0 ? "#ba2525" : "inherit",
                          }}
                        >
                          {formatMoney(txn.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Close Shift Section (Only if shift is Open) */}
          {shift.status === "Open" && (
            <section className="card" style={{ borderColor: "#cf9851" }}>
              <h2>{tr("Close shift → PendingCollection")}</h2>
              <p className="muted">
                {tr(
                  "Closing asks for the counted cash; the Accountant verifies it later.",
                )}
              </p>

              <ErrorBox error={closeError} />

              <Field
                label={tr("Counted cash in drawer")}
                hint={tr(
                  "Cash the cashier counted in the drawer (excluding the opening float).",
                )}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                    placeholder="0.00"
                    style={{ maxWidth: 280 }}
                    aria-label={tr("Counted cash in drawer")}
                  />
                  <button
                    type="button"
                    className="primary"
                    disabled={closeBusy || !declaredCash}
                    onClick={() => setCloseConfirmOpen(true)}
                  >
                    {tr("Close shift")}
                  </button>
                </div>
              </Field>
            </section>
          )}

          {/* Close Confirmation Modal */}
          {closeConfirmOpen && (
            <Modal
              title={tr("Confirm Shift Closure")}
              onClose={() => setCloseConfirmOpen(false)}
            >
              <p>{tr("Are you sure you want to close this cash shift?")}</p>
              <dl className="details" style={{ margin: "16px 0" }}>
                <div>
                  <dt>{tr("Expected cash")}</dt>
                  <dd>
                    <strong>{formatMoney(shift.expected_cash)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>{tr("Counted cash (Declared)")}</dt>
                  <dd>
                    <strong>
                      {formatMoney(parseFloat(declaredCash) || 0)}
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>{tr("Opening float")}</dt>
                  <dd>{formatMoney(shift.opening_float)}</dd>
                </div>
              </dl>
              <p className="muted fine">
                {tr(
                  "Closing hands over the counted cash to the accountant. You will not be able to record further counter cash on this shift.",
                )}
              </p>
              <div className="actions">
                <button
                  type="button"
                  disabled={closeBusy}
                  onClick={() => setCloseConfirmOpen(false)}
                >
                  {tr("Go back")}
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={closeBusy}
                  onClick={handleCloseShift}
                >
                  {closeBusy ? tr("Closing…") : tr("Confirm & Close Shift")}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </>
  );
}
