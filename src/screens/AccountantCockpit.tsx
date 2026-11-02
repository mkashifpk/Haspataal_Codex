import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  glAccounts,
  glLedger,
  addVendor,
  listShifts,
  getShift,
  cashDrop,
  listApprovals,
  apQueue,
  settleAp,
  listReturnsPharmacyAdminSupplier,
  getReturn,
  returnNote,
  confirmCredit,
  refuseCredit,
  type GlAccountOut,
  type LedgerEntryOut,
  type VendorIn,
  type VendorOut,
  type CashShiftListItemOut,
  type CashShiftSummaryOut,
  type ApprovalOut,
  type PayableQueueItemOut,
  type SupplierReturnOut,
  type CashDropIn,
  type SettleApIn,
  type SupplierCreditIn,
  type SupplierRefusalIn,
} from "../generated/accountant_cockpit";
import { publicSettings } from "../generated/app_shell";
import {
  getAccountantCockpitCapabilityView,
  isDualApprovalRequiredForCashDrop,
  isDualApprovalRequiredForApSettlement,
  validateDualApprover,
  validateCashDrop,
  validateApSettlement,
  validateSupplierCreditConfirmation,
  validateSupplierRefusal,
  ACCOUNTANT_ERROR_MESSAGES,
  DEFAULT_LARGE_CASH_THRESHOLD,
} from "../accountant-cockpit-policy";

export interface AccountantCockpitProps {
  user?: {
    username?: string;
    name?: string;
    user_id?: number;
    roles?: string[];
    permissions?: string[];
  } | null;
  establishment?: any;
  connected?: boolean;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

type ActivePane = "gl" | "shifts" | "ap" | "approvals";

export const AccountantCockpit: React.FC<AccountantCockpitProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const capabilityView = useMemo(
    () => getAccountantCockpitCapabilityView(establishment),
    [establishment]
  );

  const currentUser = useMemo(
    () => ({
      username: user?.username || "demo.accountant",
      user_id: user?.user_id,
      name: user?.name || user?.username || "Accountant",
    }),
    [user]
  );

  // Settings & Threshold
  const [largeCashThreshold, setLargeCashThreshold] = useState<number>(DEFAULT_LARGE_CASH_THRESHOLD);

  // Navigation / Panes
  const [activePane, setActivePane] = useState<ActivePane>("gl");

  // Realtime Status
  const [realtimeState, setRealtimeState] = useState<"Live" | "Reconnecting">("Live");
  const [globalError, setGlobalError] = useState<{ code?: string; message: string; messageUr?: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Pane 1: General Ledger & Chart of Accounts & Vendors
  // -------------------------------------------------------------
  const [accounts, setAccounts] = useState<GlAccountOut[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryOut[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("");
  const [glDateFrom, setGlDateFrom] = useState<string>("");
  const [glDateTo, setGlDateTo] = useState<string>("");
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  // Add Vendor Modal
  const [showAddVendorModal, setShowAddVendorModal] = useState<boolean>(false);
  const [vendorForm, setVendorForm] = useState<VendorIn>({
    name: "",
    vendor_type: "PharmacySupplier",
    contact_name: "",
    phone: "",
    address: "",
    tax_number: "",
    cnic: "",
  });
  const [isSubmittingVendor, setIsSubmittingVendor] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Pane 2: Cash Shifts & Cash Drops
  // -------------------------------------------------------------
  const [shifts, setShifts] = useState<CashShiftListItemOut[]>([]);
  const [shiftStatusFilter, setShiftStatusFilter] = useState<string>("All");
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(false);

  // Shift Detail Modal
  const [selectedShiftSummary, setSelectedShiftSummary] = useState<CashShiftSummaryOut | null>(null);
  const [isLoadingShiftDetail, setIsLoadingShiftDetail] = useState<boolean>(false);

  // Cash Drop Modal
  const [shiftForDrop, setShiftForDrop] = useState<CashShiftListItemOut | null>(null);
  const [dropCountedCash, setDropCountedCash] = useState<string>("");
  const [dropNote, setDropNote] = useState<string>("");
  const [dropSecondUsername, setDropSecondUsername] = useState<string>("");
  const [dropSecondPassword, setDropSecondPassword] = useState<string>("");
  const [isSubmittingDrop, setIsSubmittingDrop] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Pane 3: Accounts Payable & Supplier Returns
  // -------------------------------------------------------------
  const [payables, setPayables] = useState<PayableQueueItemOut[]>([]);
  const [apStatusFilter, setApStatusFilter] = useState<string>("All");
  const [isLoadingPayables, setIsLoadingPayables] = useState<boolean>(false);

  const [supplierReturns, setSupplierReturns] = useState<SupplierReturnOut[]>([]);
  const [returnStatusFilter, setReturnStatusFilter] = useState<string>("All");
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(false);

  // AP Settle Modal
  const [selectedPayable, setSelectedPayable] = useState<PayableQueueItemOut | null>(null);
  const [apSettleAmount, setApSettleAmount] = useState<string>("");
  const [apSettleMethod, setApSettleMethod] = useState<"Cash" | "BankTransfer" | "Cheque" | "SupplierCredit">("Cash");
  const [apCashSource, setApCashSource] = useState<"Vault" | "Shift">("Vault");
  const [apReferenceNo, setApReferenceNo] = useState<string>("");
  const [apSupplierReturnId, setApSupplierReturnId] = useState<number | null>(null);
  const [apSecondUsername, setApSecondUsername] = useState<string>("");
  const [apSecondPassword, setApSecondPassword] = useState<string>("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);

  // Supplier Return Detail & PDF Modal
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<SupplierReturnOut | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [pdfDownloadedNotice, setPdfDownloadedNotice] = useState<string | null>(null);

  // Confirm Credit Note Modal
  const [returnForCredit, setReturnForCredit] = useState<SupplierReturnOut | null>(null);
  const [creditNoteNo, setCreditNoteNo] = useState<string>("");
  const [creditNoteDate, setCreditNoteDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [creditNoteText, setCreditNoteText] = useState<string>("");
  const [isSubmittingCredit, setIsSubmittingCredit] = useState<boolean>(false);

  // Refuse Credit Modal
  const [returnForRefusal, setReturnForRefusal] = useState<SupplierReturnOut | null>(null);
  const [refusalNoteText, setRefusalNoteText] = useState<string>("");
  const [isSubmittingRefusal, setIsSubmittingRefusal] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Pane 4: Approvals Queue
  // -------------------------------------------------------------
  const [approvals, setApprovals] = useState<ApprovalOut[]>([]);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<"Pending" | "Approved" | "Rejected" | "Cancelled">("Pending");
  const [isLoadingApprovals, setIsLoadingApprovals] = useState<boolean>(false);

  // Format Helper
  const formatMoney = (amount?: number | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "PKR 0.00";
    return `PKR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const explainError = (code?: string, defaultMsg?: string) => {
    if (code && ACCOUNTANT_ERROR_MESSAGES[code]) {
      return ACCOUNTANT_ERROR_MESSAGES[code];
    }
    return {
      en: defaultMsg || "An unexpected error occurred.",
      ur: "ایک غیر متوقع خرابی پیش آئی۔",
    };
  };

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  const loadSettings = useCallback(async () => {
    try {
      const res = await publicSettings();
      if (res && res.large_cash_settlement_threshold) {
        setLargeCashThreshold(Number(res.large_cash_settlement_threshold));
      }
    } catch {
      setLargeCashThreshold(DEFAULT_LARGE_CASH_THRESHOLD);
    }
  }, []);

  const loadGLData = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const [accs, entries] = await Promise.all([
        glAccounts().catch(() => []),
        glLedger({
          account_code: selectedAccountFilter || undefined,
          date_from: glDateFrom || undefined,
          date_to: glDateTo || undefined,
          limit: 100,
        }).catch(() => []),
      ]);
      setAccounts(accs || []);
      setLedgerEntries(entries || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedAccountFilter, glDateFrom, glDateTo]);

  const loadShifts = useCallback(async () => {
    setIsLoadingShifts(true);
    try {
      const statusQuery = shiftStatusFilter === "All" ? undefined : (shiftStatusFilter as "Open" | "PendingCollection" | "Verified");
      const list = await listShifts({ status: statusQuery, limit: 100 });
      setShifts(list || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingShifts(false);
    }
  }, [shiftStatusFilter]);

  const loadPayablesAndReturns = useCallback(async () => {
    setIsLoadingPayables(true);
    setIsLoadingReturns(true);
    try {
      const apStatusQuery = apStatusFilter === "All" ? undefined : apStatusFilter;
      const retStatusQuery = returnStatusFilter === "All" ? undefined : (returnStatusFilter as "Returned" | "Credited" | "Refused");
      const [apList, retList] = await Promise.all([
        apQueue({ status: apStatusQuery }).catch(() => []),
        listReturnsPharmacyAdminSupplier({ status: retStatusQuery, limit: 100 }).catch(() => []),
      ]);
      setPayables(apList || []);
      setSupplierReturns(retList || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingPayables(false);
      setIsLoadingReturns(false);
    }
  }, [apStatusFilter, returnStatusFilter]);

  const loadApprovals = useCallback(async () => {
    setIsLoadingApprovals(true);
    try {
      const res = await listApprovals({ status: approvalStatusFilter, limit: 100 });
      setApprovals(res || []);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingApprovals(false);
    }
  }, [approvalStatusFilter]);

  const refreshAll = useCallback(() => {
    setGlobalError(null);
    setSuccessBanner(null);
    loadSettings();
    loadGLData();
    loadShifts();
    loadPayablesAndReturns();
    loadApprovals();
  }, [loadSettings, loadGLData, loadShifts, loadPayablesAndReturns, loadApprovals]);

  // Initial Load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!window.terminal?.subscribe) return;
    const unsubscribe = window.terminal.subscribe((event: any) => {
      const eventType = event?.event_type || event?.type || event?.event;
      if (
        eventType === "approval.requested" ||
        eventType === "ot.settlement.finalized" ||
        eventType === "cash_shift.closed" ||
        eventType === "ap.settled"
      ) {
        setRealtimeState("Live");
        loadGLData();
        loadShifts();
        loadPayablesAndReturns();
        loadApprovals();
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [loadGLData, loadShifts, loadPayablesAndReturns, loadApprovals]);

  // -------------------------------------------------------------
  // Handlers: Vendor
  // -------------------------------------------------------------
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      setGlobalError({ message: "Vendor name is required.", messageUr: "سپلائر کا نام درکار ہے۔" });
      return;
    }
    setIsSubmittingVendor(true);
    setGlobalError(null);
    try {
      const created = await addVendor(vendorForm);
      setSuccessBanner(`Vendor "${created.name}" created successfully (Vendor ID: ${created.vendor_id}).`);
      setShowAddVendorModal(false);
      setVendorForm({
        name: "",
        vendor_type: "PharmacySupplier",
        contact_name: "",
        phone: "",
        address: "",
        tax_number: "",
        cnic: "",
      });
      loadPayablesAndReturns();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingVendor(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Cash Drop
  // -------------------------------------------------------------
  const handleOpenCashDrop = (shift: CashShiftListItemOut) => {
    setShiftForDrop(shift);
    setDropCountedCash(shift.declared_cash !== null ? String(shift.declared_cash) : String(shift.expected_cash));
    setDropNote("");
    setDropSecondUsername("");
    setDropSecondPassword("");
    setGlobalError(null);
  };

  const handleOpenShiftDetail = async (shiftId: number) => {
    setIsLoadingShiftDetail(true);
    setGlobalError(null);
    try {
      const summary = await getShift(shiftId);
      setSelectedShiftSummary(summary);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsLoadingShiftDetail(false);
    }
  };

  const handleSubmitCashDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForDrop) return;

    const inputPayload: CashDropIn = {
      counted_cash: Number(dropCountedCash),
      note: dropNote.trim() || null,
      second_approver_username: dropSecondUsername.trim() || null,
      second_approver_password: dropSecondPassword.trim() || null,
    };

    const val = validateCashDrop(shiftForDrop, inputPayload, currentUser, largeCashThreshold);
    if (!val.valid) {
      const errInfo = explainError(val.errorCode, val.errorMessage);
      setGlobalError({ code: val.errorCode, message: errInfo.en, messageUr: errInfo.ur });
      return;
    }

    setIsSubmittingDrop(true);
    setGlobalError(null);
    try {
      const res = await cashDrop(shiftForDrop.shift_id, inputPayload);
      const varMsg = val.hasVariance
        ? ` Note: Drawer variance of ${formatMoney(val.variance)} recorded for audit review.`
        : "";
      setSuccessBanner(`Cash drop for Shift #${res.shift_id} verified and moved to main vault.${varMsg}`);
      setShiftForDrop(null);
      loadShifts();
      loadGLData();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingDrop(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: AP Settlement
  // -------------------------------------------------------------
  const handleOpenSettleAp = (payable: PayableQueueItemOut) => {
    setSelectedPayable(payable);
    const openBal = payable.balance ?? (payable.amount - payable.amount_paid);
    setApSettleAmount(String(openBal));
    setApSettleMethod("Cash");
    setApCashSource("Vault");
    setApReferenceNo("");
    setApSupplierReturnId(null);
    setApSecondUsername("");
    setApSecondPassword("");
    setGlobalError(null);
  };

  const handleSubmitSettleAp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;

    const inputPayload: SettleApIn = {
      amount: Number(apSettleAmount),
      method: apSettleMethod,
      cash_source: apSettleMethod === "Cash" ? apCashSource : null,
      reference_no: apReferenceNo.trim() || null,
      supplier_return_id: apSettleMethod === "SupplierCredit" ? apSupplierReturnId : null,
      second_approver_username: apSecondUsername.trim() || null,
      second_approver_password: apSecondPassword.trim() || null,
    };

    const val = validateApSettlement(
      selectedPayable,
      inputPayload,
      currentUser,
      supplierReturns,
      largeCashThreshold
    );

    if (!val.valid) {
      const errInfo = explainError(val.errorCode, val.errorMessage);
      setGlobalError({ code: val.errorCode, message: errInfo.en, messageUr: errInfo.ur });
      return;
    }

    setIsSubmittingSettle(true);
    setGlobalError(null);
    try {
      const res = await settleAp(selectedPayable.ap_id, inputPayload);
      setSuccessBanner(
        `Payment settlement of ${formatMoney(res.settlement.amount)} confirmed for AP #${res.payable.ap_id} (${res.payable.status}).`
      );
      setSelectedPayable(null);
      loadPayablesAndReturns();
      loadGLData();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Supplier Returns & Credit Notes
  // -------------------------------------------------------------
  const handleViewReturn = async (returnId: number) => {
    setGlobalError(null);
    setPdfDownloadedNotice(null);
    try {
      const ret = await getReturn(returnId);
      setSelectedReturnDetail(ret);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    }
  };

  const handleDownloadReturnPdf = async (returnId: number) => {
    setIsDownloadingPdf(true);
    setGlobalError(null);
    try {
      await returnNote(returnId);
      setPdfDownloadedNotice(`Return Note PDF for SRN #${returnId} generated and verified.`);
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenConfirmCredit = (ret: SupplierReturnOut) => {
    setReturnForCredit(ret);
    setCreditNoteNo(`CN-${ret.return_number}`);
    setCreditNoteDate(new Date().toISOString().split("T")[0]);
    setCreditAmount(String(ret.value_at_cost));
    setCreditNoteText("");
    setGlobalError(null);
  };

  const handleSubmitConfirmCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForCredit) return;

    const inputPayload: SupplierCreditIn = {
      credit_note_no: creditNoteNo.trim(),
      credit_note_date: creditNoteDate,
      credit_amount: Number(creditAmount),
      note: creditNoteText.trim() || null,
    };

    const val = validateSupplierCreditConfirmation(returnForCredit, inputPayload, currentUser);
    if (!val.valid) {
      const errInfo = explainError(val.errorCode, val.errorMessage);
      setGlobalError({ code: val.errorCode, message: errInfo.en, messageUr: errInfo.ur });
      return;
    }

    setIsSubmittingCredit(true);
    setGlobalError(null);
    try {
      const updated = await confirmCredit(returnForCredit.return_id, inputPayload);
      setSuccessBanner(
        `Supplier credit note "${updated.credit_note_no}" confirmed for ${formatMoney(updated.credit_amount)}. Credit left: ${formatMoney(updated.credit_left)}.`
      );
      setReturnForCredit(null);
      loadPayablesAndReturns();
      loadGLData();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  const handleOpenRefuseCredit = (ret: SupplierReturnOut) => {
    setReturnForRefusal(ret);
    setRefusalNoteText("");
    setGlobalError(null);
  };

  const handleSubmitRefuseCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForRefusal) return;

    const inputPayload: SupplierRefusalIn = {
      note: refusalNoteText.trim(),
    };

    const val = validateSupplierRefusal(returnForRefusal, inputPayload, currentUser);
    if (!val.valid) {
      const errInfo = explainError(val.errorCode, val.errorMessage);
      setGlobalError({ code: val.errorCode, message: errInfo.en, messageUr: errInfo.ur });
      return;
    }

    setIsSubmittingRefusal(true);
    setGlobalError(null);
    try {
      const updated = await refuseCredit(returnForRefusal.return_id, inputPayload);
      setSuccessBanner(`Return #${updated.return_number} credit refusal recorded. Claim written off.`);
      setReturnForRefusal(null);
      loadPayablesAndReturns();
      loadGLData();
    } catch (err: any) {
      const errInfo = explainError(err?.response?.error?.code, err?.message);
      setGlobalError({ code: err?.response?.error?.code, message: errInfo.en, messageUr: errInfo.ur });
    } finally {
      setIsSubmittingRefusal(false);
    }
  };

  // Capability View Gating
  if (capabilityView === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold">Accountant Cockpit Unavailable</h2>
        <p className="mt-2 text-sm">This screen is hidden under the current facility service profile.</p>
      </div>
    );
  }

  // Dual Approval Checks
  const cashDropCountedNumber = Number(dropCountedCash) || 0;
  const isCashDropDualRequired = isDualApprovalRequiredForCashDrop(cashDropCountedNumber, largeCashThreshold);

  const apPayableTotal = selectedPayable?.amount || 0;
  const isApDualRequired = isDualApprovalRequiredForApSettlement(apPayableTotal, largeCashThreshold);

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans">
      {/* Top App Bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner">
            AC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight">Accountant 3-pane Cockpit</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                اکاؤنٹنٹ کاک پٹ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Shift reconciliation • Approval queue • Accounts payable • General ledger
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
          <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${realtimeState === "Live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
            />
            <span>{realtimeState}</span>
            <span className="text-slate-500">|</span>
            <span className="font-mono text-slate-300">{currentUser.name}</span>
          </div>

          <button
            type="button"
            data-help="accountant_cockpit.refresh_btn"
            onClick={refreshAll}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-md border border-slate-700 flex items-center space-x-1 transition-colors"
          >
            <span>↻ Refresh</span>
            <span className="text-slate-400 text-[10px]">(ریفریش)</span>
          </button>
        </div>
      </header>

      {/* Notifications / Error Banner */}
      {globalError && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-start justify-between text-sm text-rose-800">
          <div className="flex items-start space-x-2">
            <span className="font-bold text-rose-600">⚠ Error {globalError.code ? `[${globalError.code}]` : ""}:</span>
            <div>
              <p>{globalError.message}</p>
              {globalError.messageUr && <p className="text-xs text-rose-700 mt-0.5">{globalError.messageUr}</p>}
            </div>
          </div>
          <button
            type="button"
            data-help="accountant_cockpit.dismiss_error_btn"
            onClick={() => setGlobalError(null)}
            className="text-xs text-rose-600 hover:text-rose-900 font-semibold ml-4"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-sm text-emerald-800">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-emerald-600">✓ Success:</span>
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            data-help="accountant_cockpit.dismiss_success_btn"
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-600 hover:text-emerald-900 font-semibold ml-4"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs (3 Panes + Approvals) */}
      <div className="bg-white border-b border-slate-200 px-6 pt-2 flex space-x-4">
        <button
          type="button"
          data-help="accountant_cockpit.pane_gl_tab"
          onClick={() => setActivePane("gl")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activePane === "gl"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Pane 1: General Ledger & Vendors</span>
          <span className="text-xs font-normal text-slate-400">(کھاتہ جات)</span>
        </button>

        <button
          type="button"
          data-help="accountant_cockpit.pane_shifts_tab"
          onClick={() => setActivePane("shifts")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activePane === "shifts"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Pane 2: Cash Shifts & Cash Drops</span>
          <span className="text-xs font-normal text-slate-400">(کیش ڈراپ)</span>
          {shifts.filter((s) => s.status === "PendingCollection").length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300">
              {shifts.filter((s) => s.status === "PendingCollection").length}
            </span>
          )}
        </button>

        <button
          type="button"
          data-help="accountant_cockpit.pane_ap_tab"
          onClick={() => setActivePane("ap")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activePane === "ap"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Pane 3: Accounts Payable & Returns</span>
          <span className="text-xs font-normal text-slate-400">(واجب الادا رقوم)</span>
          {payables.filter((p) => p.status === "Approved" || p.status === "PartiallySettled").length > 0 && (
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-300">
              {payables.filter((p) => p.status === "Approved" || p.status === "PartiallySettled").length}
            </span>
          )}
        </button>

        <button
          type="button"
          data-help="accountant_cockpit.pane_approvals_tab"
          onClick={() => setActivePane("approvals")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 ${
            activePane === "approvals"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Approvals Queue</span>
          <span className="text-xs font-normal text-slate-400">(منظوری کیو)</span>
          {approvals.filter((a) => a.status === "Pending").length > 0 && (
            <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-rose-300">
              {approvals.filter((a) => a.status === "Pending").length}
            </span>
          )}
        </button>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ========================================================= */}
        {/* PANE 1: General Ledger & Chart of Accounts & Vendors      */}
        {/* ========================================================= */}
        {activePane === "gl" && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Chart of Accounts (کھاتہ منتخب کریں)
                  </label>
                  <select
                    data-help="accountant_cockpit.gl_account_filter"
                    value={selectedAccountFilter}
                    onChange={(e) => setSelectedAccountFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Accounts (تمام اکاؤنٹس)</option>
                    {accounts.map((acc) => (
                      <option key={acc.account_code} value={acc.account_code}>
                        {acc.account_code} - {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date From (شروع تاریخ)</label>
                  <input
                    type="date"
                    data-help="accountant_cockpit.gl_date_from_input"
                    value={glDateFrom}
                    onChange={(e) => setGlDateFrom(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date To (اختتامی تاریخ)</label>
                  <input
                    type="date"
                    data-help="accountant_cockpit.gl_date_to_input"
                    value={glDateTo}
                    onChange={(e) => setGlDateTo(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-end space-x-2 pt-4">
                  <button
                    type="button"
                    data-help="accountant_cockpit.gl_filter_btn"
                    onClick={loadGLData}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-colors"
                  >
                    Filter Entries (فلٹر کریں)
                  </button>
                  <button
                    type="button"
                    data-help="accountant_cockpit.gl_reset_btn"
                    onClick={() => {
                      setSelectedAccountFilter("");
                      setGlDateFrom("");
                      setGlDateTo("");
                      loadGLData();
                    }}
                    className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Reset (ری سیٹ)
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  data-help="accountant_cockpit.add_vendor_btn"
                  onClick={() => setShowAddVendorModal(true)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors"
                >
                  <span>+ Add Vendor / Contractor</span>
                  <span className="text-emerald-100 font-normal">(نیا سپلائر شامل کریں)</span>
                </button>
              </div>
            </div>

            {/* General Ledger Entries Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  General Ledger Entries (جنرل لیجر اندراجات)
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {ledgerEntries.length} records shown
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">ID / Txn</th>
                      <th className="px-4 py-2.5">Event / Source</th>
                      <th className="px-4 py-2.5">Account Code & Name</th>
                      <th className="px-4 py-2.5 text-right">Debit (ڈیبٹ)</th>
                      <th className="px-4 py-2.5 text-right">Credit (کریڈٹ)</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingLedger ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Loading ledger records...
                        </td>
                      </tr>
                    ) : ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No ledger records match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((row) => (
                        <tr key={row.entry_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-600">
                            #{row.entry_id} <span className="text-slate-400">({row.txn_id})</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-medium text-slate-900">{row.event}</span>
                            <span className="block text-[10px] text-slate-400">{row.source_type} #{row.source_id}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-mono text-indigo-700 font-medium">{row.account_code}</span>
                            <span className="block text-slate-600">{row.account_name}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-medium text-emerald-700">
                            {row.debit > 0 ? formatMoney(row.debit) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-medium text-blue-700">
                            {row.credit > 0 ? formatMoney(row.credit) : "—"}
                          </td>
                          <td className="px-4 py-2 text-slate-600 max-w-xs truncate" title={row.description || ""}>
                            {row.description || "—"}
                          </td>
                          <td className="px-4 py-2 text-slate-500 font-mono text-[10px]">
                            {new Date(row.posted_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANE 2: Cash Shifts & Cash Drops                          */}
        {/* ========================================================= */}
        {activePane === "shifts" && (
          <div className="space-y-6">
            {/* Shifts Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <label className="text-xs font-semibold text-slate-600">Filter Shift Status:</label>
                <select
                  data-help="accountant_cockpit.shift_status_filter"
                  value={shiftStatusFilter}
                  onChange={(e) => setShiftStatusFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Shifts (تمام شفٹس)</option>
                  <option value="PendingCollection">Pending Collection (ڈراپ کی منتظر)</option>
                  <option value="Open">Open (کھلی شفٹ)</option>
                  <option value="Verified">Verified (تصدیق شدہ)</option>
                </select>
                <span className="text-xs text-slate-500">
                  Dual Control Threshold: <strong className="font-mono text-slate-700">{formatMoney(largeCashThreshold)}</strong>
                </span>
              </div>
            </div>

            {/* Shifts List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  Cash Counter Shifts (کیش کاؤنٹر شفٹس)
                </h3>
                <span className="text-xs text-slate-500 font-medium">{shifts.length} shifts found</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Shift ID</th>
                      <th className="px-4 py-2.5">Node / Counter</th>
                      <th className="px-4 py-2.5">Cashier</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Opening Float</th>
                      <th className="px-4 py-2.5 text-right">Expected Cash</th>
                      <th className="px-4 py-2.5 text-right">Declared Cash</th>
                      <th className="px-4 py-2.5 text-right">Variance</th>
                      <th className="px-4 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingShifts ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          Loading shifts...
                        </td>
                      </tr>
                    ) : shifts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No cash shifts found for the selected status.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((s) => (
                        <tr key={s.shift_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-800">#{s.shift_id}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{s.node}</td>
                          <td className="px-4 py-2.5 text-slate-700">{s.cashier_name}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                s.status === "PendingCollection"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : s.status === "Verified"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-blue-100 text-blue-800 border border-blue-300"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{formatMoney(s.opening_float)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                            {formatMoney(s.expected_cash)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {s.declared_cash !== null ? formatMoney(s.declared_cash) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {s.declared_variance !== null ? (
                              <span
                                className={
                                  Math.abs(s.declared_variance) > 0.001 ? "text-rose-600 font-bold" : "text-emerald-700"
                                }
                              >
                                {formatMoney(s.declared_variance)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                type="button"
                                data-help="accountant_cockpit.view_shift_btn"
                                onClick={() => handleOpenShiftDetail(s.shift_id)}
                                className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                              >
                                View Breakdown
                              </button>

                              {s.status === "PendingCollection" && (
                                <button
                                  type="button"
                                  data-help="accountant_cockpit.open_cash_drop_btn"
                                  onClick={() => handleOpenCashDrop(s)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-sm transition-colors"
                                >
                                  Verify Cash Drop
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANE 3: Accounts Payable & Supplier Returns               */}
        {/* ========================================================= */}
        {activePane === "ap" && (
          <div className="space-y-8">
            {/* Accounts Payable Queue Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Accounts Payable Queue (واجب الادا بلز اور ادائیگیاں)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Settle vendor invoices, contractor fees, and consultant commissions
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-slate-600">Status:</label>
                  <select
                    data-help="accountant_cockpit.ap_status_filter"
                    value={apStatusFilter}
                    onChange={(e) => setApStatusFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Statuses (تمام)</option>
                    <option value="Approved">Approved (منظور شدہ)</option>
                    <option value="PartiallySettled">Partially Settled (جزوی ادا شدہ)</option>
                    <option value="PendingApproval">Pending Approval (زیرِ منظوری)</option>
                    <option value="Settled">Settled (مکمل ادا شدہ)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">AP ID</th>
                      <th className="px-4 py-2.5">Payee / Vendor</th>
                      <th className="px-4 py-2.5">Source Type</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5 text-right">Total Amount</th>
                      <th className="px-4 py-2.5 text-right">Paid</th>
                      <th className="px-4 py-2.5 text-right">Balance</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingPayables ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          Loading payables queue...
                        </td>
                      </tr>
                    ) : payables.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No accounts payable records found for the selected status.
                        </td>
                      </tr>
                    ) : (
                      payables.map((ap) => {
                        const canSettle = ap.status === "Approved" || ap.status === "PartiallySettled";
                        return (
                          <tr key={ap.ap_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-800">#{ap.ap_id}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {ap.vendor_name || ap.employee_name || ap.payee_name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                                {ap.source_type} #{ap.source_id}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={ap.description}>
                              {ap.description}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                              {formatMoney(ap.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                              {formatMoney(ap.amount_paid)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">
                              {formatMoney(ap.balance)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  ap.status === "Approved"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : ap.status === "PartiallySettled"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : ap.status === "Settled"
                                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-300"
                                }`}
                              >
                                {ap.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {canSettle && (
                                <button
                                  type="button"
                                  data-help="accountant_cockpit.open_settle_ap_btn"
                                  onClick={() => handleOpenSettleAp(ap)}
                                  className="px-3 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm transition-colors"
                                >
                                  Settle Bill
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supplier Returns & Credit Notes Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Supplier Returns & Credit Notes (سپلائر واپسی اور کریڈٹ نوٹس)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review returns, confirm vendor credit notes, and record refusals per rule:465292d1b4
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-slate-600">Status:</label>
                  <select
                    data-help="accountant_cockpit.return_status_filter"
                    value={returnStatusFilter}
                    onChange={(e) => setReturnStatusFilter(e.target.value)}
                    className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="All">All Returns (تمام واپسی)</option>
                    <option value="Returned">Returned (زیرِ کریڈٹ نوٹ)</option>
                    <option value="Credited">Credited (تصدیق شدہ کریڈٹ)</option>
                    <option value="Refused">Refused (مسترد شدہ)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Return #</th>
                      <th className="px-4 py-2.5">Supplier</th>
                      <th className="px-4 py-2.5">Drug / Item</th>
                      <th className="px-4 py-2.5 text-right">Qty</th>
                      <th className="px-4 py-2.5 text-right">Cost Value</th>
                      <th className="px-4 py-2.5">Returned By</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Credit Left</th>
                      <th className="px-4 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingReturns ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          Loading supplier returns...
                        </td>
                      </tr>
                    ) : supplierReturns.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No supplier returns found.
                        </td>
                      </tr>
                    ) : (
                      supplierReturns.map((ret) => (
                        <tr key={ret.return_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{ret.return_number}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{ret.vendor_name}</td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {ret.drug_name} <span className="text-[10px] text-slate-400">({ret.batch_no})</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium">{ret.qty}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                            {formatMoney(ret.value_at_cost)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{ret.returned_by_name}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ret.status === "Returned"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : ret.status === "Credited"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {ret.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                            {ret.credit_left !== null ? formatMoney(ret.credit_left) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                data-help="accountant_cockpit.view_return_btn"
                                onClick={() => handleViewReturn(ret.return_id)}
                                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                              >
                                View Note
                              </button>

                              {ret.status === "Returned" && (
                                <>
                                  <button
                                    type="button"
                                    data-help="accountant_cockpit.open_confirm_credit_btn"
                                    onClick={() => handleOpenConfirmCredit(ret)}
                                    className="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm transition-colors"
                                  >
                                    Confirm Credit
                                  </button>
                                  <button
                                    type="button"
                                    data-help="accountant_cockpit.open_refuse_credit_btn"
                                    onClick={() => handleOpenRefuseCredit(ret)}
                                    className="px-2 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm transition-colors"
                                  >
                                    Refuse
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANE 4: Approvals Queue                                   */}
        {/* ========================================================= */}
        {activePane === "approvals" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <label className="text-xs font-semibold text-slate-600">Approval Queue Status:</label>
                <select
                  data-help="accountant_cockpit.approval_status_filter"
                  value={approvalStatusFilter}
                  onChange={(e) => setApprovalStatusFilter(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Pending">Pending (منظوری کے منتظر)</option>
                  <option value="Approved">Approved (منظور شدہ)</option>
                  <option value="Rejected">Rejected (مسترد شدہ)</option>
                  <option value="Cancelled">Cancelled (منسوخ)</option>
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Pending requests visible to you based on granted finance permissions
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">Approvals List (منظوریوں کی فہرست)</h3>
                <span className="text-xs text-slate-500 font-medium">{approvals.length} requests</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Request #</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Requester</th>
                      <th className="px-4 py-2.5">Summary</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5">Required Permission</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Requested At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingApprovals ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          Loading approvals...
                        </td>
                      </tr>
                    ) : approvals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          No approval requests found for the selected status.
                        </td>
                      </tr>
                    ) : (
                      approvals.map((app) => (
                        <tr key={app.request_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2 font-mono font-bold text-slate-800">#{app.request_id}</td>
                          <td className="px-4 py-2 font-medium text-slate-900">
                            {app.approval_type}
                            {app.is_elevated && (
                              <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 font-bold">
                                Elevated
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{app.requester_name}</td>
                          <td className="px-4 py-2 text-slate-600 max-w-sm truncate" title={app.summary}>
                            {app.summary}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                            {app.amount ? formatMoney(app.amount) : "—"}
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                            {app.required_permission}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                app.status === "Pending"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : app.status === "Approved"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500 font-mono text-[10px]">
                            {new Date(app.requested_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: Add Vendor / Contractor (POST /finance/vendors)    */}
      {/* ========================================================= */}
      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Add Vendor / Contractor</h3>
                <p className="text-xs text-slate-400">نیا سپلائر یا کنٹریکٹر رجسٹر کریں</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.close_vendor_modal_btn"
                onClick={() => setShowAddVendorModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor Name * (سپلائر کا نام)
                </label>
                <input
                  type="text"
                  required
                  data-help="accountant_cockpit.vendor_name_input"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="e.g. Shaheen Pharmaceuticals Ltd"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Type * (قسم)
                  </label>
                  <select
                    data-help="accountant_cockpit.vendor_type_select"
                    value={vendorForm.vendor_type}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendor_type: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PharmacySupplier">Pharmacy Supplier</option>
                    <option value="ReagentSupplier">Reagent Supplier</option>
                    <option value="EquipmentSupplier">Equipment Supplier</option>
                    <option value="UtilityProvider">Utility Provider</option>
                    <option value="Contractor">Contractor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person (رابطہ کار)
                  </label>
                  <input
                    type="text"
                    data-help="accountant_cockpit.vendor_contact_input"
                    value={vendorForm.contact_name || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_name: e.target.value })}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone (فون نمبر)
                  </label>
                  <input
                    type="text"
                    data-help="accountant_cockpit.vendor_phone_input"
                    value={vendorForm.phone || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax Number / NTN (ٹیکس نمبر)
                  </label>
                  <input
                    type="text"
                    data-help="accountant_cockpit.vendor_tax_input"
                    value={vendorForm.tax_number || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, tax_number: e.target.value })}
                    placeholder="e.g. 1234567-8"
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CNIC (شناختی کارڈ)
                </label>
                <input
                  type="text"
                  data-help="accountant_cockpit.vendor_cnic_input"
                  value={vendorForm.cnic || ""}
                  onChange={(e) => setVendorForm({ ...vendorForm, cnic: e.target.value })}
                  placeholder="e.g. 35201-1234567-1"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address (پتہ)
                </label>
                <textarea
                  rows={2}
                  data-help="accountant_cockpit.vendor_address_input"
                  value={vendorForm.address || ""}
                  onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  placeholder="Street address, city"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.cancel_vendor_btn"
                  onClick={() => setShowAddVendorModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVendor}
                  data-help="accountant_cockpit.save_vendor_btn"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingVendor ? "Saving..." : "Save Vendor (محفوظ کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Cash Shift Breakdown (GET /finance/cash-shifts/{id})*/}
      {/* ========================================================= */}
      {selectedShiftSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Shift #{selectedShiftSummary.shift_id} Financial Summary
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedShiftSummary.node} • Cashier: {selectedShiftSummary.cashier_name}
                </p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.close_shift_detail_btn"
                onClick={() => setSelectedShiftSummary(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Opening Float</span>
                  <span className="text-sm font-mono font-bold text-slate-800">
                    {formatMoney(selectedShiftSummary.opening_float)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Expected Cash</span>
                  <span className="text-sm font-mono font-bold text-indigo-700">
                    {formatMoney(selectedShiftSummary.expected_cash)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Declared Cash</span>
                  <span className="text-sm font-mono font-bold text-slate-800">
                    {selectedShiftSummary.declared_cash !== null ? formatMoney(selectedShiftSummary.declared_cash) : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-semibold uppercase">Variance</span>
                  <span
                    className={`text-sm font-mono font-bold ${
                      selectedShiftSummary.declared_variance !== null && Math.abs(selectedShiftSummary.declared_variance) > 0.001
                        ? "text-rose-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {selectedShiftSummary.declared_variance !== null ? formatMoney(selectedShiftSummary.declared_variance) : "—"}
                  </span>
                </div>
              </div>

              {/* Cash Movements by Transaction Type */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Cash Collections by Transaction Type
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2">Movement Type</th>
                        <th className="px-3 py-2 text-right">Transactions</th>
                        <th className="px-3 py-2 text-right">Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedShiftSummary.by_type.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-medium">{t.txn_type}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{t.count}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                            {formatMoney(t.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Non-Cash Collections */}
              {selectedShiftSummary.non_cash && selectedShiftSummary.non_cash.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Non-Cash Collections (Cards, Bank Transfer, Insurance)
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-slate-600 font-semibold">
                        <tr>
                          <th className="px-3 py-2">Payment Method</th>
                          <th className="px-3 py-2 text-right">Transactions</th>
                          <th className="px-3 py-2 text-right">Total (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedShiftSummary.non_cash.map((nc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-medium">{nc.method}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{nc.count}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                              {formatMoney(nc.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                data-help="accountant_cockpit.close_shift_detail_btn"
                onClick={() => setSelectedShiftSummary(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Verify Cash Drop (POST /finance/cash-shifts/{id}/cash-drop) */}
      {/* ========================================================= */}
      {shiftForDrop && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Verify Cash Drop — Shift #{shiftForDrop.shift_id}</h3>
                <p className="text-xs text-amber-100">کاؤنٹر کیش ڈراپ کی تصدیق اور والٹ میں منتقلی</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.cancel_cash_drop_btn"
                onClick={() => setShiftForDrop(null)}
                className="text-amber-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCashDrop} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Counter / Node:</span>
                  <strong className="text-slate-800">{shiftForDrop.node}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cashier:</span>
                  <strong className="text-slate-800">{shiftForDrop.cashier_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Opening Float:</span>
                  <span className="font-mono">{formatMoney(shiftForDrop.opening_float)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-amber-200 pt-1">
                  <span>Expected Cash Total:</span>
                  <span className="font-mono text-indigo-700">{formatMoney(shiftForDrop.expected_cash)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Counted Cash in Drawer * (گنتی شدہ کل نقد رقم بمعہ فلوٹ)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">PKR</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-help="accountant_cockpit.drop_counted_cash_input"
                    value={dropCountedCash}
                    onChange={(e) => setDropCountedCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono font-bold pl-12 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Per rule:7cc7842e8a, count the whole drawer including opening float. The drop transfers all of it to the main vault.
                </p>
              </div>

              {/* Variance Indicator per rule:1109b23ad9 */}
              {dropCountedCash !== "" && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                    Math.abs(cashDropCountedNumber - shiftForDrop.expected_cash) > 0.001
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  <span className="font-semibold">Calculated Variance (فرق):</span>
                  <span className="font-mono font-bold">
                    {formatMoney(cashDropCountedNumber - shiftForDrop.expected_cash)}
                  </span>
                </div>
              )}

              {Math.abs(cashDropCountedNumber - shiftForDrop.expected_cash) > 0.001 && (
                <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                  ⚠ Rule 1109b23ad9: Count variance automatically creates an internal review audit item.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Note / Observations (نوٹ)
                </label>
                <input
                  type="text"
                  data-help="accountant_cockpit.drop_note_input"
                  value={dropNote}
                  onChange={(e) => setDropNote(e.target.value)}
                  placeholder="e.g. Verified by Accountant on duty"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Dual Approval Section per rule:8c0db74e85 */}
              {isCashDropDualRequired && (
                <div className="bg-amber-50/80 border border-amber-300 p-4 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-amber-800 font-bold text-xs">
                      🔒 Dual Control Required (مشترکہ منظوری لازمی ہے)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Rule 8c0db74e85: Cash drop amount ({formatMoney(cashDropCountedNumber)}) is at or above the threshold ({formatMoney(largeCashThreshold)}). A second authorized staff member must co-sign.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Second Approver Username *
                      </label>
                      <input
                        type="text"
                        required
                        data-help="accountant_cockpit.drop_second_approver_username_input"
                        value={dropSecondUsername}
                        onChange={(e) => setDropSecondUsername(e.target.value)}
                        placeholder="e.g. demo.owner"
                        className="w-full text-xs border border-amber-300 rounded-md px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Second Approver Password *
                      </label>
                      <input
                        type="password"
                        required
                        data-help="accountant_cockpit.drop_second_approver_password_input"
                        value={dropSecondPassword}
                        onChange={(e) => setDropSecondPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs border border-amber-300 rounded-md px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.cancel_cash_drop_btn"
                  onClick={() => setShiftForDrop(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDrop}
                  data-help="accountant_cockpit.submit_cash_drop_btn"
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingDrop ? "Verifying Drop..." : "Approve Cash Drop (ڈراپ منظور کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Settle Accounts Payable (POST /finance/ap/{id}/settle) */}
      {/* ========================================================= */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Settle Accounts Payable — #{selectedPayable.ap_id}</h3>
                <p className="text-xs text-indigo-200">واجب الادا رقم کی ادائیگی</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.cancel_settle_ap_btn"
                onClick={() => setSelectedPayable(null)}
                className="text-indigo-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSettleAp} className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Payee / Vendor:</span>
                  <strong className="text-slate-900">
                    {selectedPayable.vendor_name || selectedPayable.employee_name || selectedPayable.payee_name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Source:</span>
                  <span className="font-mono text-slate-700">{selectedPayable.source_type} #{selectedPayable.source_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Original Total:</span>
                  <span className="font-mono">{formatMoney(selectedPayable.amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-indigo-200 pt-1">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono text-indigo-700">{formatMoney(selectedPayable.balance)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Settlement Amount * (رقم)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-help="accountant_cockpit.ap_settle_amount_input"
                    value={apSettleAmount}
                    onChange={(e) => setApSettleAmount(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method * (طریقہ کار)
                  </label>
                  <select
                    data-help="accountant_cockpit.ap_settle_method_select"
                    value={apSettleMethod}
                    onChange={(e) => setApSettleMethod(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash (نقد)</option>
                    <option value="BankTransfer">Bank Transfer (بینک ٹرانسفر)</option>
                    <option value="Cheque">Cheque (چیک)</option>
                    <option value="SupplierCredit">Supplier Credit Note (سپلائر کریڈٹ نوٹ)</option>
                  </select>
                </div>
              </div>

              {apSettleMethod === "Cash" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cash Source * (کیش فنڈ)
                  </label>
                  <select
                    data-help="accountant_cockpit.ap_cash_source_select"
                    value={apCashSource}
                    onChange={(e) => setApCashSource(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Vault">Main Vault (مین والٹ)</option>
                    <option value="Shift">Active Cash Shift (کاؤنٹر دراز)</option>
                  </select>
                </div>
              )}

              {apSettleMethod === "SupplierCredit" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Confirmed Return Note * (کریڈٹ نوٹ منتخب کریں)
                  </label>
                  <select
                    data-help="accountant_cockpit.ap_supplier_return_select"
                    value={apSupplierReturnId || ""}
                    onChange={(e) => setApSupplierReturnId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Confirmed Return --</option>
                    {supplierReturns
                      .filter((r) => r.status === "Credited" && (r.credit_left ?? 0) > 0)
                      .map((r) => (
                        <option key={r.return_id} value={r.return_id}>
                          {r.return_number} - {r.vendor_name} ({formatMoney(r.credit_left)} credit left)
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Per rule:465292d1b4, a Credited return's credit_left pays that supplier's bills.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Cheque # (حوالہ نمبر)
                </label>
                <input
                  type="text"
                  data-help="accountant_cockpit.ap_reference_no_input"
                  value={apReferenceNo}
                  onChange={(e) => setApReferenceNo(e.target.value)}
                  placeholder="e.g. CHQ-98124 or FT-44021"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dual Control Section per rule:8c0db74e85 */}
              {isApDualRequired && (
                <div className="bg-indigo-50/80 border border-indigo-300 p-4 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-indigo-900 font-bold text-xs">
                      🔒 Dual Control Required (مشترکہ تصدیق لازمی ہے)
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-900">
                    Rule 8c0db74e85: Total payable amount ({formatMoney(selectedPayable.amount)}) is at or above the threshold ({formatMoney(largeCashThreshold)}). A second authorized person must co-sign before initial submission.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Second Approver Username *
                      </label>
                      <input
                        type="text"
                        required
                        data-help="accountant_cockpit.ap_second_approver_username_input"
                        value={apSecondUsername}
                        onChange={(e) => setApSecondUsername(e.target.value)}
                        placeholder="e.g. demo.owner"
                        className="w-full text-xs border border-indigo-300 rounded-md px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Second Approver Password *
                      </label>
                      <input
                        type="password"
                        required
                        data-help="accountant_cockpit.ap_second_approver_password_input"
                        value={apSecondPassword}
                        onChange={(e) => setApSecondPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs border border-indigo-300 rounded-md px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.cancel_settle_ap_btn"
                  onClick={() => setSelectedPayable(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  data-help="accountant_cockpit.submit_settle_ap_btn"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingSettle ? "Settling..." : "Confirm Settlement (ادائیگی تصدیق کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Confirm Supplier Credit (POST /finance/supplier-returns/{id}/credit) */}
      {/* ========================================================= */}
      {returnForCredit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Confirm Supplier Credit Note</h3>
                <p className="text-xs text-emerald-200">سپلائر کے کریڈٹ نوٹ کی تصدیق</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.cancel_confirm_credit_btn"
                onClick={() => setReturnForCredit(null)}
                className="text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitConfirmCredit} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Return Note #:</span>
                  <strong className="text-slate-900">{returnForCredit.return_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Supplier:</span>
                  <strong className="text-slate-800">{returnForCredit.vendor_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Item:</span>
                  <span className="text-slate-800">{returnForCredit.drug_name} (Qty: {returnForCredit.qty})</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-emerald-200 pt-1">
                  <span>Value at Cost:</span>
                  <span className="font-mono text-emerald-800">{formatMoney(returnForCredit.value_at_cost)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credit Note # * (کریڈٹ نوٹ نمبر)
                  </label>
                  <input
                    type="text"
                    required
                    data-help="accountant_cockpit.credit_note_no_input"
                    value={creditNoteNo}
                    onChange={(e) => setCreditNoteNo(e.target.value)}
                    placeholder="e.g. CN-2026-0042"
                    className="w-full text-xs font-mono border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credit Note Date * (تاریخ)
                  </label>
                  <input
                    type="date"
                    required
                    data-help="accountant_cockpit.credit_note_date_input"
                    value={creditNoteDate}
                    onChange={(e) => setCreditNoteDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credited Amount * (منظور شدہ رقم)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">PKR</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-help="accountant_cockpit.credit_amount_input"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono font-bold pl-12 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Any difference from cost value is automatically posted as write-off or gain on write-off account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Note / Remarks (تفصیل)
                </label>
                <input
                  type="text"
                  data-help="accountant_cockpit.credit_note_input"
                  value={creditNoteText}
                  onChange={(e) => setCreditNoteText(e.target.value)}
                  placeholder="e.g. Confirmed with supplier statement"
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.cancel_confirm_credit_btn"
                  onClick={() => setReturnForCredit(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCredit}
                  data-help="accountant_cockpit.submit_confirm_credit_btn"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingCredit ? "Confirming..." : "Confirm Credit Note (کریڈٹ نوٹ منظور کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Refuse Supplier Credit (POST /finance/supplier-returns/{id}/refuse) */}
      {/* ========================================================= */}
      {returnForRefusal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Record Supplier Credit Refusal</h3>
                <p className="text-xs text-rose-200">سپلائر کی جانب سے کریڈٹ انکار اور رائٹ آف کا اندراج</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.cancel_refusal_btn"
                onClick={() => setReturnForRefusal(null)}
                className="text-rose-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRefuseCredit} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Return Note #:</span>
                  <strong className="text-slate-900">{returnForRefusal.return_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Supplier:</span>
                  <strong className="text-slate-800">{returnForRefusal.vendor_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Item:</span>
                  <span className="text-slate-800">{returnForRefusal.drug_name}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-rose-200 pt-1">
                  <span>Claim to Write Off:</span>
                  <span className="font-mono text-rose-800">{formatMoney(returnForRefusal.value_at_cost)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refusal Reason / Justification * (انکار کی وجہ)
                </label>
                <textarea
                  rows={3}
                  required
                  data-help="accountant_cockpit.refusal_note_input"
                  value={refusalNoteText}
                  onChange={(e) => setRefusalNoteText(e.target.value)}
                  placeholder="Explain why the supplier refused credit (e.g. Return rejected due to damaged packaging; claimed written off per hospital policy)."
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.cancel_refusal_btn"
                  onClick={() => setReturnForRefusal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel (منسوخ)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefusal}
                  data-help="accountant_cockpit.submit_refusal_btn"
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingRefusal ? "Recording..." : "Record Refusal & Write Off (انکار کا اندراج کریں)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Return Note Detail & PDF (GET /pharmacy-admin/supplier-returns/{id}) */}
      {/* ========================================================= */}
      {selectedReturnDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Supplier Return Note #{selectedReturnDetail.return_number}</h3>
                <p className="text-xs text-slate-400">سپلائر واپسی تفصیلات اور پی ڈی ایف واؤچر</p>
              </div>
              <button
                type="button"
                data-help="accountant_cockpit.close_return_detail_btn"
                onClick={() => setSelectedReturnDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {pdfDownloadedNotice && (
                <div className="p-2.5 rounded bg-emerald-50 text-emerald-800 text-xs border border-emerald-200">
                  {pdfDownloadedNotice}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier / Vendor:</span>
                  <strong className="text-slate-800">{selectedReturnDetail.vendor_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Drug Name:</span>
                  <span className="text-slate-800 font-medium">{selectedReturnDetail.drug_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch # / Expiry:</span>
                  <span className="font-mono text-slate-700">
                    {selectedReturnDetail.batch_no} (Exp: {selectedReturnDetail.expiry_date})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity & Unit Cost:</span>
                  <span className="font-mono text-slate-700">
                    {selectedReturnDetail.qty} @ {formatMoney(selectedReturnDetail.unit_cost)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Value at Cost:</span>
                  <span className="font-mono text-indigo-700">{formatMoney(selectedReturnDetail.value_at_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Return Reason:</span>
                  <span className="text-slate-800">{selectedReturnDetail.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Returned By:</span>
                  <span className="text-slate-800">{selectedReturnDetail.returned_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-indigo-800 uppercase text-[10px]">{selectedReturnDetail.status}</span>
                </div>
                {selectedReturnDetail.credit_note_no && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-500">Credit Note No:</span>
                    <span className="font-mono font-bold text-emerald-700">{selectedReturnDetail.credit_note_no}</span>
                  </div>
                )}
                {selectedReturnDetail.credit_left !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Credit Left:</span>
                    <span className="font-mono font-bold text-emerald-700">{formatMoney(selectedReturnDetail.credit_left)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  data-help="accountant_cockpit.download_return_pdf_btn"
                  onClick={() => handleDownloadReturnPdf(selectedReturnDetail.return_id)}
                  disabled={isDownloadingPdf}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <span>🖶 View / Print Return Note PDF</span>
                  <span className="text-[10px] text-indigo-200 font-normal">(پی ڈی ایف)</span>
                </button>

                <button
                  type="button"
                  data-help="accountant_cockpit.close_return_detail_btn"
                  onClick={() => setSelectedReturnDetail(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
