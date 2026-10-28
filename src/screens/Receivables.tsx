import { useRef, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import {
  arAging,
  arOutstanding,
  getInvoice,
  listInvoices,
  type InvoiceDetailOut,
  type InvoiceListItemOut,
  type PaymentRecordOut,
  type ReceivableAgingOut,
  type ReceivableOut,
  type ReceivableQueueItemOut,
} from "../generated/receivables";
import { tr } from "../i18n";
import { api } from "../bridge";
import { decimalAmount } from "../ticket-policy";
import { writeAttempt, canRetryWrite, definiteWriteRefusal, type WriteAttempt } from "../write-attempt";
import { cashBackDrawerReady, type CashBackDrawer } from "../cash-back-safety";

export function Receivables({
  user,
  revision,
  currency = "PKR",
  readOnly = false,
}: {
  user: { user_id: number; permissions: string[] };
  revision: number;
  currency?: string;
  readOnly?: boolean;
}) {
  const canViewAr = user.permissions.includes("finance.ar.view");
  const canCollectAr = user.permissions.includes("finance.ar.collect");
  const canWriteOff = user.permissions.includes("finance.ar.write_off");
  const canViewInvoices = user.permissions.includes("finance.invoice.view");
  const canCollectPayment = user.permissions.includes("finance.payment.collect");

  const [activeTab, setActiveTab] = useState<"ar" | "invoices">("ar");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  type FinancialAction = { kind: "settle" | "writeoff" | "payment"; path: string; data: Record<string, unknown>; actor: number; permission: string };
  const [attempt, setAttempt] = useState<WriteAttempt<FinancialAction> | null>(null);
  const retained = useRef<WriteAttempt<FinancialAction> | null>(null);
  const locked = busy || !!attempt;
  function closeDraft(close: () => void) {
    if (flight.current || retained.current) return;
    if (!window.confirm(tr("Discard this financial draft?"))) return;
    setError(undefined); close();
  }

  async function runFinancial(action: FinancialAction) {
    if (flight.current) return;
    const original = retained.current;
    const chosen = original?.body || action;
    if (readOnly || chosen.actor !== user.user_id || !user.permissions.includes(chosen.permission)) {
      setError(new Error(tr("This financial action is unavailable with your current permissions or record-only access."))); return;
    }
    if (original && (!canRetryWrite(original) || original.body.path !== action.path)) {
      setError(new Error(tr("The original financial request needs IT reconciliation. Do not collect again or start a replacement."))); return;
    }
    flight.current = true; setBusy(true); setError(undefined);
    try {
      if (!original) {
        if (chosen.data.method === "Cash") {
          const [terminal, shift] = await Promise.all([
            api<CashBackDrawer["terminal"]>("GET", "/terminals/whoami"),
            api<CashBackDrawer["shift"]>("GET", "/finance/cash-shifts/mine"),
          ]);
          if (!cashBackDrawerReady({ user, terminal, shift })) throw new Error(tr("Before collecting cash, open your own shift at this terminal's assigned counter. No payment has been submitted."));
        }
        if (chosen.kind === "payment") {
          const latest = await getInvoice(payInvoice!.invoice_id);
          if (latest.is_locked || ["Draft", "Cancelled", "Paid", "Refunded", "Waivered"].includes(latest.status) || latest.balance_due !== payInvoice!.balance_due || latest.status !== payInvoice!.status)
            throw new Error(tr("The invoice changed or is locked. Close this draft, refresh and review it before collecting."));
        } else {
          const selected = chosen.kind === "settle" ? settleItem! : writeOffItem!;
          const latest = (await arOutstanding()).find(row => row.ar_id === selected.ar_id);
          if (!latest || latest.balance !== selected.balance || latest.status !== selected.status || latest.patient_id !== selected.patient_id || latest.invoice_id !== selected.invoice_id || !["Active", "PartiallySettled"].includes(latest.status))
            throw new Error(tr("The receivable changed. Close this draft, refresh and review the current balance."));
        }
      }
      const request = original || writeAttempt(chosen);
      retained.current = request; setAttempt(request);
      const result = await api<any>("POST", request.body.path, request.body.data, { key: request.key });
      // Release only after the actual original write is confirmed. Follow-up reads cannot turn it into a failed payment.
      retained.current = null; setAttempt(null);
      if (request.body.kind === "settle") setSettleReceipt(result);
      else if (request.body.kind === "writeoff") setWriteOffResult(result);
      else setPayReceipt({ receipt_no: result.payment.receipt_no, amount: result.payment.amount, balance_due: result.invoice.balance_due });
      void arQueueReq.reload(); void arAgingReq.reload(); if (canViewInvoices) void invoicesReq.reload();
    } catch (cause) {
      if (definiteWriteRefusal(cause)) { retained.current = null; setAttempt(null); }
      setError(cause);
    } finally { flight.current = false; setBusy(false); }
  }

  // AR Outstanding and Aging data
  const arQueueReq = useLoad(
    () => (canViewAr ? arOutstanding() : Promise.resolve([])),
    [revision, canViewAr],
  );
  const arAgingReq = useLoad(
    () => (canViewAr ? arAging() : Promise.resolve([])),
    [revision, canViewAr],
  );

  // Invoices data
  const [invoiceStatus, setInvoiceStatus] = useState("all");
  const [invoiceType, setInvoiceType] = useState("all");
  const invoicesReq = useLoad(
    () =>
      canViewInvoices
        ? listInvoices({
            status: invoiceStatus === "all" ? undefined : invoiceStatus,
            invoice_type: invoiceType === "all" ? undefined : invoiceType,
            limit: 50,
          })
        : Promise.resolve([]),
    [revision, canViewInvoices, invoiceStatus, invoiceType],
  );

  // Settle Modal State
  const [settleItem, setSettleItem] = useState<ReceivableQueueItemOut | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMethod, setSettleMethod] = useState<"Cash" | "Card" | "BankTransfer">("Cash");
  const [settleRef, setSettleRef] = useState("");
  const [settleReceipt, setSettleReceipt] = useState<{
    payment: PaymentRecordOut;
    receivable: ReceivableOut;
  } | null>(null);

  // Write-Off Modal State
  const [writeOffItem, setWriteOffItem] = useState<ReceivableQueueItemOut | null>(null);
  const [writeOffAmount, setWriteOffAmount] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writeOffResult, setWriteOffResult] = useState<ReceivableOut | null>(null);

  // Invoice Detail & Payment Modal State
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetailOut | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [payInvoice, setPayInvoice] = useState<InvoiceListItemOut | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"Cash" | "Card" | "BankTransfer">("Cash");
  const [payRef, setPayRef] = useState("");
  const [payReceipt, setPayReceipt] = useState<{
    receipt_no: string;
    amount: number;
    balance_due: number;
  } | null>(null);

  const formatMoney = (amount: number | null | undefined) =>
    amount === null || amount === undefined
      ? "-"
      : `${currency} ${amount}`;

  // Filter AR queue items
  const queueItems = arQueueReq.data || [];
  const filteredQueue = queueItems.filter((item) => {
    if (typeFilter !== "all" && item.ar_type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const patient = (item.patient_name || "").toLowerCase();
      const mrn = (item.mrn || "").toLowerCase();
      const mobile = (item.mobile || "").toLowerCase();
      const panel = (item.panel_name || "").toLowerCase();
      const invoice = (item.invoice_no || "").toLowerCase();
      const arId = String(item.ar_id);
      if (
        !patient.includes(q) &&
        !mrn.includes(q) &&
        !mobile.includes(q) &&
        !panel.includes(q) &&
        !invoice.includes(q) &&
        !arId.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Aging summary calculation
  const agingList = arAgingReq.data || [];
  const overallAging = agingList.reduce(
    (acc, curr) => ({
      b0_30: acc.b0_30 + (curr["0_30"] || 0),
      b31_60: acc.b31_60 + (curr["31_60"] || 0),
      b61_90: acc.b61_90 + (curr["61_90"] || 0),
      b90_plus: acc.b90_plus + (curr["90_plus"] || 0),
      total: acc.total + (curr.total || 0),
      items: acc.items + (curr.items || 0),
    }),
    { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0, items: 0 },
  );

  async function openSettle(item: ReceivableQueueItemOut) {
    if (flight.current || retained.current || readOnly || !canCollectAr) return;
    setError(undefined);
    setNotice("");
    setSettleReceipt(null);
    setSettleItem(item);
    setSettleAmount(String(item.balance));
    setSettleMethod("Cash");
    setSettleRef("");
  }

  async function handleSettleSubmit() {
    if (!settleItem || flight.current) return;
    if (!retained.current && (!decimalAmount(settleAmount, 0.01, settleItem.balance) || (settleMethod !== "Cash" && !settleRef.trim()))) {
      setError(new Error(tr("Enter a complete positive amount within the balance and a reference for card or bank payments."))); return;
    }
    await runFinancial({kind:"settle",path:`/finance/ar/${settleItem.ar_id}/settle`,data:{amount:Number(settleAmount),method:settleMethod,reference_no:settleRef.trim() || null},actor:user.user_id,permission:"finance.ar.collect"});
  }

  function openWriteOff(item: ReceivableQueueItemOut) {
    if (flight.current || retained.current || readOnly || !canWriteOff) return;
    setError(undefined);
    setNotice("");
    setWriteOffResult(null);
    setWriteOffItem(item);
    setWriteOffAmount(String(item.balance));
    setWriteOffReason("");
  }

  async function handleWriteOffSubmit() {
    if (!writeOffItem || flight.current) return;
    if (!retained.current && (!decimalAmount(writeOffAmount, 0.01, writeOffItem.balance) || writeOffReason.trim().length < 5 || writeOffReason.trim().length > 500)) {
      setError(new Error(tr("Enter a complete positive write-off amount within the balance and a reason of 5–500 characters."))); return;
    }
    await runFinancial({kind:"writeoff",path:`/finance/ar/${writeOffItem.ar_id}/write-off`,data:{amount:Number(writeOffAmount),reason:writeOffReason.trim()},actor:user.user_id,permission:"finance.ar.write_off"});
  }

  async function handleViewInvoice(invoiceId: number) {
    if (!canViewInvoices) { setError(new Error(tr("You do not have permission to view invoice details."))); return; }
    setError(undefined);
    setLoadingInvoice(true);
    try {
      const detail = await getInvoice(invoiceId);
      setViewInvoice(detail);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoadingInvoice(false);
    }
  }

  function openPayInvoice(inv: InvoiceListItemOut) {
    if (flight.current || retained.current || readOnly || !canCollectPayment) return;
    setError(undefined);
    setNotice("");
    setPayReceipt(null);
    setPayInvoice(inv);
    setPayAmount(String(inv.balance_due || 0));
    setPayMethod("Cash");
    setPayRef("");
  }

  async function handleInvoicePaymentSubmit() {
    if (!payInvoice || flight.current) return;
    if (!retained.current && (payInvoice.balance_due === null || !decimalAmount(payAmount, 0.01, payInvoice.balance_due) || (payMethod !== "Cash" && !payRef.trim()))) {
      setError(new Error(tr("Enter a complete positive amount within the balance and a reference for card or bank payments."))); return;
    }
    await runFinancial({kind:"payment",path:`/finance/invoices/${payInvoice.invoice_id}/payments`,data:{amount:Number(payAmount),method:payMethod,reference_no:payRef.trim() || null},actor:user.user_id,permission:"finance.payment.collect"});
  }

  const recovery = <>
    <ErrorBox error={error} />
    {attempt && <div role="status">
      <p>{tr("The financial result is unknown. Keep the original request; do not collect again, change the draft or close it. Retry only this original action within 24 hours; outside that window ask IT to reconcile it.")}</p>
      <button data-help="receivables.settle" type="button" disabled={busy || !canRetryWrite(attempt)} onClick={() => void runFinancial(attempt.body)}>{tr("Retry original financial action")}</button>
    </div>}
  </>;

  return (
    <section data-write-pending={locked} data-unsaved={!!(settleItem && !settleReceipt || writeOffItem && !writeOffResult || payInvoice && !payReceipt)}>
      <h1>{tr("Outstanding dues (Udhaar)")}</h1>
      <p>
        {tr(
          "Collect patient dues, inspect debt aging, and record authorized write-offs. A cashier collects and settles; only the Owner and Hospital Admin write off.",
        )}
      </p>

      <div className="actions">
        <button
          data-help="receivables.list"
          className={activeTab === "ar" ? "primary" : ""}
          onClick={() => setActiveTab("ar")}
        >
          {tr("Outstanding dues queue")}
        </button>
        {canViewInvoices && (
          <button
            data-help="receivables.invoice"
            className={activeTab === "invoices" ? "primary" : ""}
            onClick={() => setActiveTab("invoices")}
          >
            {tr("Invoices & direct payments")}
          </button>
        )}
        <button
          data-help="receivables.list"
          onClick={() => {
            void arQueueReq.reload();
            void arAgingReq.reload();
            if (canViewInvoices) void invoicesReq.reload();
          }}
          disabled={arQueueReq.loading || arAgingReq.loading || invoicesReq.loading}
        >
          {tr("Refresh")}
        </button>
      </div>

      <ErrorBox error={error} />
      {notice && <p role="status">{notice}</p>}

      {activeTab === "ar" && (
        <>
          {/* Aging Buckets Summary */}
          <section className="card">
            <h2>{tr("Receivables aging summary")}</h2>
            <LoadState {...arAgingReq} retry={arAgingReq.reload} />
            {!arAgingReq.loading && !arAgingReq.error && arAgingReq.data && <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("0–30 Days")}</div>
                <strong><bdi>{formatMoney(overallAging.b0_30)}</bdi></strong>
              </div>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("31–60 Days")}</div>
                <strong><bdi>{formatMoney(overallAging.b31_60)}</bdi></strong>
              </div>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("61–90 Days")}</div>
                <strong><bdi>{formatMoney(overallAging.b61_90)}</bdi></strong>
              </div>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("90+ Days")}</div>
                <strong><bdi>{formatMoney(overallAging.b90_plus)}</bdi></strong>
              </div>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("Total outstanding")}</div>
                <strong style={{ color: "var(--color-primary, #0056b3)" }}>
                  <bdi>{formatMoney(overallAging.total)}</bdi>
                </strong>
              </div>
              <div className="card" style={{ padding: "0.5rem" }}>
                <div className="muted">{tr("Receivables count")}</div>
                <strong><bdi>{overallAging.items}</bdi></strong>
              </div>
            </div>}
          </section>

          {/* Filter & Search Bar */}
          <section className="card">
            <div className="form-grid">
              <Field label={tr("Search patient, MRN, invoice, mobile")}>
                <input
                  data-help="receivables.list"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("Type to search...")}
                  maxLength={100}
                />
              </Field>
              <Field label={tr("Receivable type")}>
                <select
                  data-help="receivables.list"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">{tr("All types")}</option>
                  <option value="PatientCredit">{tr("Patient credit (Udhaar)")}</option>
                  <option value="Panel">{tr("Panel receivable")}</option>
                </select>
              </Field>
              <Field label={tr("Status")}>
                <select
                  data-help="receivables.list"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{tr("All statuses")}</option>
                  <option value="Active">{tr("Active")}</option>
                  <option value="PartiallySettled">{tr("Partially settled")}</option>
                  <option value="Cancelled">{tr("Cancelled")}</option>
                </select>
              </Field>
            </div>
            <div className="actions">
              <button
                data-help="receivables.list"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
              >
                {tr("Show all")}
              </button>
            </div>
          </section>

          {/* Outstanding Queue Table */}
          <LoadState {...arQueueReq} retry={arQueueReq.reload} />
          {!arQueueReq.loading && !arQueueReq.error && arQueueReq.data && (
            <section className="card">
              <h2>{tr("Outstanding accounts receivable")}</h2>
              {filteredQueue.length === 0 ? (
                <Empty>
                  {queueItems.length === 0
                    ? tr("No outstanding patient receivables or panel dues are recorded.")
                    : tr("No receivables match the active search or filters.")}
                </Empty>
              ) : (
                <div className="table-wrap">
                  <table aria-label={tr("Outstanding receivables")}>
                    <thead>
                      <tr>
                        <th>{tr("ID / Type")}</th>
                        <th>{tr("Debtor / Patient")}</th>
                        <th>{tr("Invoice")}</th>
                        <th>{tr("Amount due")}</th>
                        <th>{tr("Paid")}</th>
                        <th>{tr("Written off")}</th>
                        <th>{tr("Balance due")}</th>
                        <th>{tr("Aging")}</th>
                        <th>{tr("Status")}</th>
                        <th>{tr("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((item) => (
                        <tr key={item.ar_id}>
                          <td>
                            <strong>#{item.ar_id}</strong>
                            <div className="muted">{tr(item.ar_type === "PatientCredit" ? "Patient credit" : "Panel")}</div>
                          </td>
                          <td>
                            {item.ar_type === "PatientCredit" ? (
                              <>
                                <div><strong>{item.patient_name || tr("Walk-in")}</strong></div>
                                {item.mrn && <div className="muted">MRN: <bdi>{item.mrn}</bdi></div>}
                                {item.mobile && <div className="muted">📱 <bdi>{item.mobile}</bdi></div>}
                              </>
                            ) : (
                              <strong>{item.panel_name || tr("Panel")}</strong>
                            )}
                          </td>
                          <td>
                            <button
                              data-help="receivables.invoice"
                              className="link"
                              onClick={() => void handleViewInvoice(item.invoice_id)}
                              disabled={loadingInvoice}
                            >
                              <bdi>{item.invoice_no}</bdi>
                            </button>
                          </td>
                          <td><bdi>{formatMoney(item.amount_due)}</bdi></td>
                          <td><bdi>{formatMoney(item.amount_paid)}</bdi></td>
                          <td><bdi>{formatMoney(item.amount_written_off)}</bdi></td>
                          <td>
                            <strong style={{ color: item.balance > 0 ? "var(--color-error, #b00020)" : undefined }}>
                              <bdi>{formatMoney(item.balance)}</bdi>
                            </strong>
                          </td>
                          <td>
                            <div><bdi>{item.age_label}</bdi></div>
                            {item.days_overdue > 0 && (
                              <div className="muted">{item.days_overdue} {tr("days")}</div>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${item.status.toLowerCase()}`}>
                              {tr(item.status)}
                            </span>
                          </td>
                          <td>
                            <div className="actions" style={{ margin: 0, gap: "0.25rem" }}>
                              {!readOnly && canCollectAr && !arQueueReq.loading && !arQueueReq.error && item.balance > 0 && (
                                <button
                                  data-help="receivables.settle"
                                  onClick={() => void openSettle(item)}
                                >
                                  {tr("Settle")}
                                </button>
                              )}
                              {!readOnly && canWriteOff && !arQueueReq.loading && !arQueueReq.error && item.balance > 0 ? (
                                <button
                                  data-help="receivables.write_off"
                                  onClick={() => openWriteOff(item)}
                                >
                                  {tr("Write off")}
                                </button>
                              ) : (!canWriteOff || readOnly) && item.balance > 0 ? (
                                <span className="fine muted">
                                  {tr(readOnly
                                    ? "Records only — new actions are unavailable for this service."
                                    : "Ask an authorised administrator about debt write-offs.")}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && canViewInvoices && (
        <section className="card">
          <h2>{tr("Invoices and payment collection")}</h2>
          <div className="form-grid">
            <Field label={tr("Invoice status")}>
              <select data-field="status"
                data-help="receivables.invoice"
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value)}
              >
                <option value="all">{tr("All statuses")}</option>
                <option value="Open">{tr("Open")}</option>
                <option value="PartiallyPaid">{tr("Partially paid")}</option>
                <option value="Paid">{tr("Paid")}</option>
                <option value="Draft">{tr("Draft")}</option>
                <option value="CreditAuthorized">{tr("Credit authorized")}</option>
                <option value="Cancelled">{tr("Cancelled")}</option>
              </select>
            </Field>
            <Field label={tr("Invoice type")}>
              <select
                data-help="receivables.invoice"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
              >
                <option value="all">{tr("All types")}</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="Pharmacy">{tr("Pharmacy")}</option>
                <option value="Lab">{tr("Lab")}</option>
                <option value="Imaging">{tr("Imaging")}</option>
                <option value="OT">OT</option>
              </select>
            </Field>
          </div>

          <LoadState {...invoicesReq} retry={invoicesReq.reload} />
          {!invoicesReq.loading && !invoicesReq.error && invoicesReq.data?.length === 0 && (
            <Empty>{tr("No invoices match these filters. Choose All statuses and All types, or refresh to check again.")}</Empty>
          )}
          {!invoicesReq.loading && !invoicesReq.error && !!invoicesReq.data?.length && (
            <div className="table-wrap">
              <table aria-label={tr("Invoices")}>
                <thead>
                  <tr>
                    <th>{tr("Invoice #")}</th>
                    <th>{tr("Type")}</th>
                    <th>{tr("Net payable")}</th>
                    <th>{tr("Paid")}</th>
                    <th>{tr("Credit")}</th>
                    <th>{tr("Balance due")}</th>
                    <th>{tr("Status")}</th>
                    <th>{tr("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesReq.data.map((inv) => (
                    <tr key={inv.invoice_id}>
                      <td>
                        <button
                          data-help="receivables.invoice"
                          className="link"
                          onClick={() => void handleViewInvoice(inv.invoice_id)}
                        >
                          <bdi>{inv.invoice_no}</bdi>
                        </button>
                      </td>
                      <td>{inv.invoice_type}</td>
                      <td><bdi>{formatMoney(inv.net_payable)}</bdi></td>
                      <td><bdi>{formatMoney(inv.amount_paid)}</bdi></td>
                      <td><bdi>{formatMoney(inv.credit_amount)}</bdi></td>
                      <td>
                        <strong style={{ color: (inv.balance_due || 0) > 0 ? "var(--color-error, #b00020)" : undefined }}>
                          <bdi>{formatMoney(inv.balance_due)}</bdi>
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${inv.status.toLowerCase()}`}>
                          {tr(inv.status)}
                        </span>
                      </td>
                      <td>
                        <div className="actions" style={{ margin: 0 }}>
                          <button
                            data-help="receivables.invoice"
                            onClick={() => void handleViewInvoice(inv.invoice_id)}
                          >
                            {tr("View")}
                          </button>
                          {!readOnly && canCollectPayment && !invoicesReq.loading && !invoicesReq.error && (inv.balance_due || 0) > 0 && !["Draft", "Cancelled", "Paid", "Refunded", "Waivered"].includes(inv.status) && (
                            <button
                              data-help="receivables.payment"
                              onClick={() => openPayInvoice(inv)}
                            >
                              {tr("Collect payment")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Settle Debt Modal */}
      {settleItem && (
        <Modal
          closable={!locked}
          title={`${tr("Settle Debt")} — AR #${settleItem.ar_id}`}
          onClose={() => {
            if (!flight.current && !retained.current) closeDraft(() => setSettleItem(null));
          }}
        >
          {recovery}
          {settleReceipt ? (
            <div>
              <p>
                <strong>{tr("Settlement Completed")}</strong>
              </p>
              <div className="card">
                <p>{tr("Receipt No")}: <bdi><strong>{settleReceipt.payment.receipt_no}</strong></bdi></p>
                <p>{tr("Amount Paid")}: <bdi>{formatMoney(settleReceipt.payment.amount)}</bdi></p>
                <p>{tr("Method")}: {tr(settleReceipt.payment.method)}</p>
                <p>{tr("Receivable Status")}: {tr(settleReceipt.receivable.status)}</p>
                <p>{tr("Remaining Balance")}: <bdi>{formatMoney(settleReceipt.receivable.amount_due - settleReceipt.receivable.amount_paid - settleReceipt.receivable.amount_written_off)}</bdi></p>
              </div>
              <div className="actions">
                <button
                  data-help="receivables.settle"
                  onClick={() => setSettleItem(null)}
                >
                  {tr("Close")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>
                {tr("Debtor")}: <strong>{settleItem.patient_name || settleItem.panel_name || tr("Walk-in")}</strong>
                {settleItem.mrn && <span> · MRN: <bdi>{settleItem.mrn}</bdi></span>}
              </p>
              <p>
                {tr("Invoice")}: <bdi>{settleItem.invoice_no}</bdi> · {tr("Current Balance")}:{" "}
                <strong><bdi>{formatMoney(settleItem.balance)}</bdi></strong>
              </p>
              <div className="form-grid">
                <Field label={tr("Settlement amount")}>
                  <input data-field="amount"
                    data-help="receivables.settle"
                    type="number"
                    step="any"
                    min="0.01"
                    max={settleItem.balance}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    disabled={locked}
                  />
                </Field>
                <Field label={tr("Payment method")}>
                  <select data-field="method"
                    data-help="receivables.settle"
                    value={settleMethod}
                    onChange={(e) =>
                      setSettleMethod(e.target.value as "Cash" | "Card" | "BankTransfer")
                    }
                    disabled={locked}
                  >
                    <option value="Cash">{tr("Cash")}</option>
                    <option value="Card">{tr("Card")}</option>
                    <option value="BankTransfer">{tr("Bank transfer")}</option>
                  </select>
                </Field>
                {settleMethod !== "Cash" && (
                  <Field label={tr("Transaction reference #")}>
                    <input data-field="reference_no"
                      data-help="receivables.settle"
                      type="text"
                      value={settleRef}
                      onChange={(e) => setSettleRef(e.target.value)}
                      placeholder={tr("Auth code or transaction ID")}
                      maxLength={100}
                      disabled={locked}
                    />
                  </Field>
                )}
              </div>
              <p className="muted">
                {tr(
                  "Cash payments require an open cash shift on your account. An unknown or timed-out result preserves your request for safe retry.",
                )}
              </p>
              <div className="actions">
                <button
                  data-help="receivables.settle"
                  className="primary"
                  onClick={() => void handleSettleSubmit()}
                  disabled={locked}
                >
                  {tr(busy ? "Processing settlement…" : "Confirm settlement")}
                </button>
                <button
                  data-help="receivables.settle"
                  onClick={() => closeDraft(() => setSettleItem(null))}
                  disabled={locked}
                >
                  {tr("Cancel")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Write-Off Modal */}
      {writeOffItem && (
        <Modal
          closable={!locked}
          title={`${tr("Write Off Receivable")} — AR #${writeOffItem.ar_id}`}
          onClose={() => {
            if (!flight.current && !retained.current) closeDraft(() => setWriteOffItem(null));
          }}
        >
          {recovery}
          {writeOffResult ? (
            <div>
              <p>
                <strong>{tr("Write-off recorded")}</strong>
              </p>
              <div className="card">
                <p>{tr("Receivable ID")}: #{writeOffResult.ar_id}</p>
                <p>{tr("Amount Written Off")}: <bdi>{formatMoney(writeOffResult.amount_written_off)}</bdi></p>
                <p>{tr("Remaining Balance")}: <bdi>{formatMoney(writeOffResult.amount_due - writeOffResult.amount_paid - writeOffResult.amount_written_off)}</bdi></p>
                <p>{tr("Status")}: {tr(writeOffResult.status)}</p>
              </div>
              <div className="actions">
                <button
                  data-help="receivables.write_off"
                  onClick={() => setWriteOffItem(null)}
                >
                  {tr("Close")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>
                {tr("Debtor")}: <strong>{writeOffItem.patient_name || writeOffItem.panel_name || tr("Walk-in")}</strong>
                {writeOffItem.mrn && <span> · MRN: <bdi>{writeOffItem.mrn}</bdi></span>}
              </p>
              <p>
                {tr("Current Balance")}: <strong><bdi>{formatMoney(writeOffItem.balance)}</bdi></strong>
              </p>
              <div className="form-grid">
                <Field label={tr("Amount to write off")}>
                  <input data-field="amount"
                    data-help="receivables.write_off"
                    type="number"
                    step="any"
                    min="0.01"
                    max={writeOffItem.balance}
                    value={writeOffAmount}
                    onChange={(e) => setWriteOffAmount(e.target.value)}
                    disabled={locked}
                  />
                </Field>
                <Field label={tr("Reason for write-off (mandatory)")}>
                  <textarea data-field="reason"
                    data-help="receivables.write_off"
                    value={writeOffReason}
                    onChange={(e) => setWriteOffReason(e.target.value)}
                    placeholder={tr("Explain why this debt cannot be collected (min 5 characters)...")}
                    rows={3}
                    maxLength={500}
                    disabled={locked}
                  />
                </Field>
              </div>
              <p className="muted">
                {tr(
                  "'Write off' is restricted to finance.ar.write_off (Owner and Hospital Admin). Cashiers collect and settle but never write off.",
                )}
              </p>
              <div className="actions">
                <button
                  data-help="receivables.write_off"
                  className="primary"
                  onClick={() => void handleWriteOffSubmit()}
                  disabled={locked || writeOffReason.trim().length < 5}
                >
                  {tr(busy ? "Writing off…" : "Confirm write-off")}
                </button>
                <button
                  data-help="receivables.write_off"
                  onClick={() => closeDraft(() => setWriteOffItem(null))}
                  disabled={locked}
                >
                  {tr("Cancel")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Invoice Detail Modal */}
      {viewInvoice && (
        <Modal
          title={tr(`Invoice Details — ${viewInvoice.invoice_no}`)}
          onClose={() => setViewInvoice(null)}
        >
          <div>
            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <div><strong>{tr("Type")}:</strong> {viewInvoice.invoice_type}</div>
              <div><strong>{tr("Status")}:</strong> {tr(viewInvoice.status)}</div>
              <div><strong>{tr("Gross total")}:</strong> <bdi>{formatMoney(viewInvoice.gross_total)}</bdi></div>
              <div><strong>{tr("Discount")}:</strong> <bdi>{formatMoney(viewInvoice.discount_total)}</bdi></div>
              <div><strong>{tr("Net payable")}:</strong> <bdi>{formatMoney(viewInvoice.net_payable)}</bdi></div>
              <div><strong>{tr("Amount paid")}:</strong> <bdi>{formatMoney(viewInvoice.amount_paid)}</bdi></div>
              <div><strong>{tr("Balance due")}:</strong> <bdi>{formatMoney(viewInvoice.balance_due)}</bdi></div>
            </div>

            {viewInvoice.lines && viewInvoice.lines.length > 0 && (
              <div className="table-wrap">
                <table aria-label={tr("Invoice lines")}>
                  <thead>
                    <tr>
                      <th>{tr("Line")}</th>
                      <th>{tr("Description")}</th>
                      <th>{tr("Qty")}</th>
                      <th>{tr("Unit price")}</th>
                      <th>{tr("Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.lines.map((line) => (
                      <tr key={line.invoice_item_id}>
                        <td>{line.line_type}</td>
                        <td>{line.description}</td>
                        <td><bdi>{line.qty}</bdi></td>
                        <td><bdi>{formatMoney(line.unit_price)}</bdi></td>
                        <td><bdi>{formatMoney(line.line_total)}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="actions" style={{ marginTop: "1rem" }}>
              <button
                data-help="receivables.invoice"
                onClick={() => setViewInvoice(null)}
              >
                {tr("Close")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Collect Invoice Payment Modal */}
      {payInvoice && (
        <Modal
          closable={!locked}
          title={`${tr("Collect Payment")} — ${payInvoice.invoice_no}`}
          onClose={() => {
            if (!flight.current && !retained.current) closeDraft(() => setPayInvoice(null));
          }}
        >
          {recovery}
          {payReceipt ? (
            <div>
              <p><strong>{tr("Payment Collected Successfully")}</strong></p>
              <div className="card">
                <p>{tr("Receipt No")}: <bdi><strong>{payReceipt.receipt_no}</strong></bdi></p>
                <p>{tr("Amount Paid")}: <bdi>{formatMoney(payReceipt.amount)}</bdi></p>
                <p>{tr("Remaining Balance")}: <bdi>{formatMoney(payReceipt.balance_due)}</bdi></p>
              </div>
              <div className="actions">
                <button
                  data-help="receivables.payment"
                  onClick={() => setPayInvoice(null)}
                >
                  {tr("Close")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>
                {tr("Invoice")}: <bdi><strong>{payInvoice.invoice_no}</strong></bdi> ({payInvoice.invoice_type})
              </p>
              <p>
                {tr("Balance Due")}: <strong><bdi>{formatMoney(payInvoice.balance_due)}</bdi></strong>
              </p>
              <div className="form-grid">
                <Field label={tr("Amount to collect")}>
                  <input data-field="amount"
                    data-help="receivables.payment"
                    type="number"
                    step="any"
                    min="0.01"
                    max={payInvoice.balance_due || undefined}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    disabled={locked}
                  />
                </Field>
                <Field label={tr("Payment method")}>
                  <select data-field="method"
                    data-help="receivables.payment"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as "Cash" | "Card" | "BankTransfer")}
                    disabled={locked}
                  >
                    <option value="Cash">{tr("Cash")}</option>
                    <option value="Card">{tr("Card")}</option>
                    <option value="BankTransfer">{tr("Bank transfer")}</option>
                  </select>
                </Field>
                {payMethod !== "Cash" && (
                  <Field label={tr("Reference number")}>
                    <input data-field="reference_no"
                      data-help="receivables.payment"
                      type="text"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder={tr("Auth code or transaction ID")}
                      maxLength={100}
                      disabled={locked}
                    />
                  </Field>
                )}
              </div>
              <div className="actions">
                <button
                  data-help="receivables.payment"
                  className="primary"
                  onClick={() => void handleInvoicePaymentSubmit()}
                  disabled={locked}
                >
                  {tr(busy ? "Collecting payment…" : "Confirm payment")}
                </button>
                <button
                  data-help="receivables.payment"
                  onClick={() => closeDraft(() => setPayInvoice(null))}
                  disabled={locked}
                >
                  {tr("Cancel")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
