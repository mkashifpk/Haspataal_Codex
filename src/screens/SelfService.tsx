import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  LeaveIn,
  LeaveRequestOut,
  LeaveBalanceOut,
  SelfProfileOut,
  PayslipOut,
  RosterEntryOut,
  HolidayOut,
  SwapOptionsOut,
  SwapIn,
  MyDutySwapOut,
  IssueIn,
  WorkOrderOut
} from "../generated/self_service";
import {
  requestLeave,
  myLeave,
  cancelLeave,
  myBalances,
  myProfile,
  myPayslip,
  myDuties,
  listHolidays,
  swapOptions,
  requestSwap,
  mySwaps,
  acceptSwap,
  declineSwap,
  cancelSwap,
  reportOpsWorkOrders
} from "../generated/self_service";
import {
  getSelfServiceCapabilityView,
  validateLeaveRequest,
  validateSwapRequest,
  validateIssueReport,
  buildDutyHorizon,
  canColleagueRespond,
  canRequesterCancel,
  isDutyUpcoming,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  SELF_SERVICE_ERROR_MESSAGES
} from "../self-service-policy";

export interface SelfServiceProps {
  token?: string;
  lang?: "en" | "ur";
  establishment?: any;
  user?: {
    user_id?: number;
    employee_id?: number | null;
    username?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
  };
  userPermissions?: string[];
  currentUserRole?: string;
  currentEmployeeId?: number | null;
  connected?: boolean;
}

export const SelfService: React.FC<SelfServiceProps> = ({
  lang = "en",
  establishment,
  user,
  userPermissions = [],
  currentUserRole,
  currentEmployeeId,
  connected = true
}) => {
  const isUrdu = lang === "ur";

  // Permissions & Capability
  const effectivePermissions = useMemo(() => {
    return userPermissions.length > 0 ? userPermissions : (user?.permissions || []);
  }, [userPermissions, user?.permissions]);

  const effectiveRole = currentUserRole || user?.role || user?.roles?.[0] || "";

  const capability = useMemo(() => {
    return getSelfServiceCapabilityView(establishment, effectivePermissions, effectiveRole);
  }, [establishment, effectivePermissions, effectiveRole]);

  // Active Tab: "duties" | "leave" | "payslips" | "support"
  const [activeTab, setActiveTab] = useState<"duties" | "leave" | "payslips" | "support">("duties");

  // Common Feedback States
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Tab 1: Duties & Swaps Data States
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultEndStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  }, []);
  const [dutiesStartDate, setDutiesStartDate] = useState<string>(todayStr);
  const [dutiesEndDate, setDutiesEndDate] = useState<string>(defaultEndStr);
  const [duties, setDuties] = useState<RosterEntryOut[]>([]);
  const [swaps, setSwaps] = useState<MyDutySwapOut[]>([]);

  // Swap Modal States
  const [swapModalOpen, setSwapModalOpen] = useState<boolean>(false);
  const [selectedDutyForSwap, setSelectedDutyForSwap] = useState<RosterEntryOut | null>(null);
  const [swapOptionsData, setSwapOptionsData] = useState<SwapOptionsOut | null>(null);
  const [swapOptionsLoading, setSwapOptionsLoading] = useState<boolean>(false);
  const [selectedColleagueId, setSelectedColleagueId] = useState<number | "">("");
  const [selectedReturnRosterId, setSelectedReturnRosterId] = useState<number | "">("");
  const [swapKind, setSwapKind] = useState<"Cover" | "Swap">("Cover");
  const [swapReason, setSwapReason] = useState<string>("");
  const [swapErrors, setSwapErrors] = useState<Record<string, string>>({});

  // Tab 2: Leave & Balances States
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestOut[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceOut[]>([]);
  const [applyLeaveModalOpen, setApplyLeaveModalOpen] = useState<boolean>(false);
  const [leaveForm, setLeaveForm] = useState<LeaveIn>({
    leave_type: "Annual",
    from_date: todayStr,
    to_date: todayStr,
    half_day: false,
    reason: ""
  });
  const [leaveFormErrors, setLeaveFormErrors] = useState<Record<string, string>>({});

  // Tab 3: Profile & Payslips States
  const [profile, setProfile] = useState<SelfProfileOut | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipOut | null>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState<boolean>(false);
  const [payslipLoading, setPayslipLoading] = useState<boolean>(false);

  // Tab 4: Holidays & Work Orders States
  const [holidays, setHolidays] = useState<HolidayOut[]>([]);
  const [issueModalOpen, setIssueModalOpen] = useState<boolean>(false);
  const [issueForm, setIssueForm] = useState<IssueIn>({
    category: "Plumbing",
    description: "",
    priority: "Normal",
    location_text: ""
  });
  const [issueFormErrors, setIssueFormErrors] = useState<Record<string, string>>({});

  // Fetch Duties & Swaps
  const fetchDutiesAndSwaps = useCallback(async () => {
    try {
      const [dutiesList, swapsList] = await Promise.all([
        myDuties({ date_from: dutiesStartDate, date_to: dutiesEndDate }),
        mySwaps()
      ]);
      setDuties(dutiesList || []);
      setSwaps(swapsList || []);
    } catch (err: any) {
      // Handled silently or mapped
    }
  }, [dutiesStartDate, dutiesEndDate]);

  // Fetch Leave Data
  const fetchLeaveData = useCallback(async () => {
    try {
      const [reqs, bals] = await Promise.all([
        myLeave(),
        myBalances()
      ]);
      setLeaveRequests(reqs || []);
      setLeaveBalances(bals || []);
    } catch (err: any) {
      // Handled silently
    }
  }, []);

  // Fetch Profile & Payslips
  const fetchProfileData = useCallback(async () => {
    try {
      const p = await myProfile();
      setProfile(p);
    } catch (err: any) {
      // Handled silently
    }
  }, []);

  // Fetch Holidays
  const fetchHolidaysData = useCallback(async () => {
    try {
      const list = await listHolidays();
      setHolidays(list || []);
    } catch (err: any) {
      // Handled silently
    }
  }, []);

  // Primary data loader based on active tab
  const loadActiveTabData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (activeTab === "duties") {
        await fetchDutiesAndSwaps();
      } else if (activeTab === "leave") {
        await fetchLeaveData();
      } else if (activeTab === "payslips") {
        await fetchProfileData();
      } else if (activeTab === "support") {
        await fetchHolidaysData();
      }
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = SELF_SERVICE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to load self-service data.",
        ur: "سیلف سروس ڈیٹا حاصل کرنے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchDutiesAndSwaps, fetchLeaveData, fetchProfileData, fetchHolidaysData, isUrdu]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Realtime Listeners for notification.created and roster.swap.updated
  useEffect(() => {
    const handleSwapUpdated = () => {
      setRealtimeNotice(isUrdu ? "ڈیوٹی کے تبادلے کی حالت اپ ڈیٹ ہو گئی ہے۔" : "Duty swap request status updated.");
      fetchDutiesAndSwaps();
      setTimeout(() => setRealtimeNotice(null), 5000);
    };

    const handleNotification = () => {
      setRealtimeNotice(isUrdu ? "نئی اطلاع موصول ہوئی ہے۔" : "New personal notification received.");
      fetchDutiesAndSwaps();
      fetchLeaveData();
      setTimeout(() => setRealtimeNotice(null), 5000);
    };

    window.addEventListener("haspataal:roster.swap.updated", handleSwapUpdated);
    window.addEventListener("haspataal:notification.created", handleNotification);

    return () => {
      window.removeEventListener("haspataal:roster.swap.updated", handleSwapUpdated);
      window.removeEventListener("haspataal:notification.created", handleNotification);
    };
  }, [fetchDutiesAndSwaps, fetchLeaveData, isUrdu]);

  // Actions: Open Ask Colleague Swap Modal
  const handleOpenSwapModal = async (duty: RosterEntryOut) => {
    setSelectedDutyForSwap(duty);
    setSwapKind("Cover");
    setSelectedColleagueId("");
    setSelectedReturnRosterId("");
    setSwapReason("");
    setSwapErrors({});
    setSwapModalOpen(true);
    setSwapOptionsLoading(true);

    try {
      const opts = await swapOptions({ roster_id: duty.roster_id });
      setSwapOptionsData(opts);
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = SELF_SERVICE_ERROR_MESSAGES[code] || {
        en: "Unable to load free colleagues for this duty.",
        ur: "اس ڈیوٹی کے لیے دستیاب عملے کی فہرست نہیں مل سکی۔"
      };
      setSwapErrors({ general: isUrdu ? mapped.ur : mapped.en });
    } finally {
      setSwapOptionsLoading(false);
    }
  };

  // Actions: Submit Swap Request
  const handleSubmitSwap = async () => {
    if (!selectedDutyForSwap || !selectedColleagueId) return;

    const payload: SwapIn = {
      roster_id: selectedDutyForSwap.roster_id,
      covering_employee_id: Number(selectedColleagueId),
      return_roster_id: swapKind === "Swap" && selectedReturnRosterId ? Number(selectedReturnRosterId) : null,
      reason: swapReason
    };

    const val = validateSwapRequest(payload);
    if (!val.valid) {
      setSwapErrors(val.errors);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      await requestSwap(payload);
      setSuccessMessage(isUrdu ? "تبادلے یا کور کی درخواست کامیابی کے ساتھ بھیج دی گئی۔" : "Shift cover/swap request submitted to colleague.");
      setSwapModalOpen(false);
      setSelectedDutyForSwap(null);
      fetchDutiesAndSwaps();
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = SELF_SERVICE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to submit swap request.",
        ur: "تبادلے کی درخواست بھیجنے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setActionLoading(false);
    }
  };

  // Actions: Respond to Swap (Accept / Decline)
  const handleAcceptSwap = async (swapId: number) => {
    setActionLoading(true);
    try {
      await acceptSwap(swapId, {});
      setSuccessMessage(isUrdu ? "ڈیوٹی کور کی درخواست قبول کر لی گئی۔ مینیجر کی منظوری کا انتظار ہے۔" : "Duty swap accepted. Awaiting final roster manager approval.");
      fetchDutiesAndSwaps();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to accept swap.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineSwap = async (swapId: number) => {
    setActionLoading(true);
    try {
      await declineSwap(swapId, {});
      setSuccessMessage(isUrdu ? "ڈیوٹی کور کی درخواست مسترد کر دی گئی۔" : "Duty swap request declined.");
      fetchDutiesAndSwaps();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to decline swap.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSwap = async (swapId: number) => {
    setActionLoading(true);
    try {
      await cancelSwap(swapId);
      setSuccessMessage(isUrdu ? "درخواست کامیابی سے منسوخ کر دی گئی۔" : "Swap request cancelled.");
      fetchDutiesAndSwaps();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to cancel swap.");
    } finally {
      setActionLoading(false);
    }
  };

  // Actions: Apply for Leave
  const handleApplyLeave = async () => {
    const val = validateLeaveRequest(leaveForm);
    if (!val.valid) {
      setLeaveFormErrors(val.errors);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      await requestLeave(leaveForm);
      setSuccessMessage(isUrdu ? "رخصت کی درخواست سپروائزر کو کامیابی سے ارسال کر دی گئی۔" : "Leave request successfully submitted to supervisor.");
      setApplyLeaveModalOpen(false);
      setLeaveForm({
        leave_type: "Annual",
        from_date: todayStr,
        to_date: todayStr,
        half_day: false,
        reason: ""
      });
      fetchLeaveData();
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = SELF_SERVICE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to submit leave request.",
        ur: "رخصت کی درخواست جمع کرانے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setActionLoading(false);
    }
  };

  // Actions: Cancel Leave
  const handleCancelLeave = async (leaveId: number) => {
    setActionLoading(true);
    try {
      await cancelLeave(leaveId);
      setSuccessMessage(isUrdu ? "رخصت کی درخواست کامیابی سے واپس لے لی گئی۔" : "Leave request withdrawn.");
      fetchLeaveData();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to withdraw leave request.");
    } finally {
      setActionLoading(false);
    }
  };

  // Actions: View Payslip Detail
  const handleViewPayslip = async (payrollItemId: number) => {
    setPayslipLoading(true);
    try {
      const ps = await myPayslip(payrollItemId);
      setSelectedPayslip(ps);
      setPayslipModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to retrieve payslip details.");
    } finally {
      setPayslipLoading(false);
    }
  };

  // Actions: Submit Work Order Issue Report
  const handleReportIssue = async () => {
    const val = validateIssueReport(issueForm);
    if (!val.valid) {
      setIssueFormErrors(val.errors);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await reportOpsWorkOrders(issueForm);
      setSuccessMessage(isUrdu ? `خرابی کی رپورٹ درج ہو گئی (#${res.wo_number})۔ متعلقہ ٹیم کو مطلع کر دیا گیا۔` : `Issue reported successfully (#${res.wo_number}). Ops team notified.`);
      setIssueModalOpen(false);
      setIssueForm({
        category: "Plumbing",
        description: "",
        priority: "Normal",
        location_text: ""
      });
    } catch (err: any) {
      const code = err?.code || "NETWORK_ERROR";
      const mapped = SELF_SERVICE_ERROR_MESSAGES[code] || {
        en: err?.message || "Failed to submit maintenance report.",
        ur: "شکایت درج کرنے میں ناکامی۔"
      };
      setErrorMessage(isUrdu ? mapped.ur : mapped.en);
    } finally {
      setActionLoading(false);
    }
  };

  // Duty horizon calculation per rule:907c770e92
  const dutyHorizon = useMemo(() => {
    return buildDutyHorizon(duties, dutiesStartDate, dutiesEndDate);
  }, [duties, dutiesStartDate, dutiesEndDate]);

  // Selected colleague object for swap return duties
  const selectedColleague = useMemo(() => {
    if (!swapOptionsData || !selectedColleagueId) return null;
    return swapOptionsData.colleagues.find(c => c.employee_id === Number(selectedColleagueId));
  }, [swapOptionsData, selectedColleagueId]);

  if (capability.mode === "hidden") {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 m-4">
        <h2 className="text-xl font-bold mb-2">
          {isUrdu ? "سیلف سروس پورٹل غیر فعال ہے" : "Self-Service Unavailable"}
        </h2>
        <p>{capability.reason || (isUrdu ? "اس سہولت کے لیے سیلف سروس فعال نہیں ہے۔" : "Self-service staff portal is not enabled for this facility profile.")}</p>
      </div>
    );
  }

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${isUrdu ? "rtl" : "ltr"}`} dir={isUrdu ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {isUrdu ? "میرا ورک اسپیس (اسٹاف سیلف سروس پورٹل)" : "My Workspace (Staff Self-Service Portal)"}
            </h1>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {connected ? (isUrdu ? "براہ راست آن لائن" : "Live") : (isUrdu ? "رابطہ منقطع" : "Offline")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isUrdu
              ? "ذاتی ڈیوٹی روسٹر، ہفتہ وار آرام کے دن، چھٹیوں کا بیلنس، پے سلپس، شفٹ کا تبادلہ اور سہولیات کی شکایات کا انتظام۔"
              : "Review personal duty schedule and rest days, request leave, manage shift swaps with colleagues, inspect verified payslips, and report facility issues."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-help="self_service.btn_refresh"
            onClick={loadActiveTabData}
            disabled={loading}
            className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? (isUrdu ? "لوڈ ہو رہا ہے..." : "Refreshing...") : (isUrdu ? "تازہ کریں" : "Refresh")}
          </button>
        </div>
      </div>

      {/* Realtime Notification Banner */}
      {realtimeNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs uppercase tracking-wider bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
              {isUrdu ? "لائیو اپ ڈیٹ" : "Live Notice"}
            </span>
            <span className="text-sm">{realtimeNotice}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{isUrdu ? "خرابی:" : "Error:"}</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            data-help="self_service.banner_dismiss_error"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-900 text-sm font-medium underline"
          >
            {isUrdu ? "بند کریں" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{isUrdu ? "کامیابی:" : "Success:"}</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            data-help="self_service.banner_dismiss_success"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-900 text-sm font-medium underline"
          >
            {isUrdu ? "بند کریں" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-4">
        <button
          type="button"
          data-help="self_service.tab_duties"
          onClick={() => setActiveTab("duties")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "duties"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {isUrdu ? "میری ڈیوٹیاں اور آرام کے دن" : "My Duties & Rest Days"}
        </button>

        <button
          type="button"
          data-help="self_service.tab_leave"
          onClick={() => setActiveTab("leave")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "leave"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {isUrdu ? "چھٹیاں اور بیلنس" : "Leave & Balances"}
        </button>

        <button
          type="button"
          data-help="self_service.tab_payslips"
          onClick={() => setActiveTab("payslips")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "payslips"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {isUrdu ? "میری پے سلپس اور پروفائل" : "Payslips & Profile"}
        </button>

        <button
          type="button"
          data-help="self_service.tab_support"
          onClick={() => setActiveTab("support")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "support"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {isUrdu ? "تعطیلات اور شکایت درج کریں" : "Holidays & Report Issue"}
        </button>
      </div>

      {/* Tab 1: Duties & Swaps */}
      {activeTab === "duties" && (
        <div className="space-y-6">
          {/* Statutory rest days explanation notice per rule:907c770e92 */}
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-4 rounded-xl text-sm flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <div className="font-bold">{isUrdu ? "روسٹر ضابطہ (قاعدہ 907c770e92):" : "Statutory Rest Day Policy (Rule rule:907c770e92):"}</div>
              <p className="mt-0.5">
                {isUrdu
                  ? "ہسپتال کے چوبیس گھنٹے معمول کے تحت، جن تاریخوں پر آپ کی کوئی ڈیوٹی تفویض نہیں کی گئی، وہ دن قانوناً آپ کے بامعاوضہ ہفتہ وار آرام کے دن (Rest Days) ہیں۔"
                  : "Under continuous hospital operations, the days without a rostered duty in your schedule are your statutory paid weekly rest days."}
              </p>
            </div>
          </div>

          {/* Horizon Date Controls */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-600 uppercase">
                {isUrdu ? "از تاریخ:" : "From:"}
              </label>
              <input
                type="date"
                data-help="self_service.duties_filter_from"
                value={dutiesStartDate}
                onChange={(e) => setDutiesStartDate(e.target.value)}
                className="px-2.5 py-1 text-sm border border-gray-300 rounded-lg"
              />
              <label className="text-xs font-semibold text-gray-600 uppercase">
                {isUrdu ? "تا تاریخ:" : "To:"}
              </label>
              <input
                type="date"
                data-help="self_service.duties_filter_to"
                value={dutiesEndDate}
                onChange={(e) => setDutiesEndDate(e.target.value)}
                className="px-2.5 py-1 text-sm border border-gray-300 rounded-lg"
              />
              <button
                type="button"
                data-help="self_service.duties_btn_query"
                onClick={fetchDutiesAndSwaps}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {isUrdu ? "تلاش کریں" : "Apply Filter"}
              </button>
            </div>
          </div>

          {/* Daily Schedule Horizon (Duties vs Rest Days) */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-gray-800">
              {isUrdu ? "روزانہ کا شیڈول (ڈیوٹیاں بمقابلہ آرام کے دن)" : "Daily Schedule Horizon"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dutyHorizon.map((day) => {
                const isUpcoming = day.duty ? isDutyUpcoming(day.duty, todayStr) : false;

                return (
                  <div
                    key={day.date}
                    className={`p-4 rounded-xl border transition-all ${
                      day.isRestDay
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                        : "bg-white border-gray-200 text-gray-900 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <div className="font-bold text-sm">{day.date}</div>
                      {day.isRestDay ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">
                          {isUrdu ? "آرام کا دن (Rest Day)" : "Rest Day"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                          {day.duty?.shift_name}
                        </span>
                      )}
                    </div>

                    {day.isRestDay ? (
                      <div className="text-xs text-emerald-700 py-2">
                        {isUrdu
                          ? "کوئی شفٹ تفویض نہیں ہے۔ قانونی آرام کا دن۔"
                          : "No shift assigned. Official statutory paid rest day."}
                      </div>
                    ) : day.duty ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{isUrdu ? "وقت:" : "Hours:"}</span>
                          <span className="font-medium">{day.duty.start_time} - {day.duty.end_time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{isUrdu ? "شعبہ / وارڈ:" : "Area:"}</span>
                          <span className="font-medium">{day.duty.duty_area} {day.duty.ward_name ? `(${day.duty.ward_name})` : ""}</span>
                        </div>
                        {day.duty.is_on_call && (
                          <div className="text-amber-700 font-semibold">
                            ⚠️ {isUrdu ? "آن کال ڈیوٹی" : "On-Call Shift"}
                          </div>
                        )}
                        {day.duty.notes && (
                          <div className="text-gray-600 bg-gray-50 p-1 rounded">
                            {day.duty.notes}
                          </div>
                        )}

                        {/* Ask colleague button for upcoming duties (rule:9274755ac9) */}
                        {isUpcoming && capability.canSwapRoster && (
                          <div className="pt-2 border-t mt-2 flex justify-end">
                            <button
                              type="button"
                              data-help="self_service.table_btn_ask_colleague"
                              onClick={() => handleOpenSwapModal(day.duty!)}
                              className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                            >
                              {isUrdu ? "ساتھی سے کور یا تبادلہ مانگیں" : "Ask a Colleague"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-panel: My Shift Swaps & Requests (rule:adfadf7120) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-base font-bold text-gray-900">
              {isUrdu ? "میری شفٹ کے تبادلے اور کور کی درخواستیں" : "Duty Swaps & Cover Requests"}
            </h3>

            {swaps.length === 0 ? (
              <p className="text-sm text-gray-500 py-3 text-center">
                {isUrdu ? "تبادلے یا کور کی کوئی زیر التواء درخواست موجود نہیں ہے۔" : "No open shift swap or cover requests."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">{isUrdu ? "کردار" : "My Role"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "قسم" : "Kind"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "ڈیوٹی تاریخ" : "Duty"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "ساتھی ملازم" : "Colleague"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "وجہ" : "Reason"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "حالت" : "Status"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {swaps.map((s) => {
                      const canRespond = canColleagueRespond(s);
                      const canCancel = canRequesterCancel(s, todayStr);

                      return (
                        <tr key={s.swap_id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-semibold text-xs text-gray-700">
                            {s.my_role === "Requester" ? (isUrdu ? "سائل (میری درخواست)" : "Requester") : (isUrdu ? "ہمکار (مجھ سے التجا)" : "Colleague")}
                          </td>
                          <td className="py-2.5 px-3 font-medium">{s.kind}</td>
                          <td className="py-2.5 px-3">
                            <div>{s.duty.roster_date} ({s.duty.shift_name})</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {s.my_role === "Requester" ? s.covering_name : s.requester_name}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-600 max-w-xs truncate">
                            {s.reason}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canRespond && (
                                <>
                                  <button
                                    type="button"
                                    data-help="self_service.swap_btn_accept"
                                    onClick={() => handleAcceptSwap(s.swap_id)}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded"
                                  >
                                    {isUrdu ? "قبول کریں" : "Accept"}
                                  </button>
                                  <button
                                    type="button"
                                    data-help="self_service.swap_btn_decline"
                                    onClick={() => handleDeclineSwap(s.swap_id)}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                                  >
                                    {isUrdu ? "انکار کریں" : "Decline"}
                                  </button>
                                </>
                              )}

                              {canCancel && (
                                <button
                                  type="button"
                                  data-help="self_service.swap_btn_cancel"
                                  onClick={() => handleCancelSwap(s.swap_id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                                >
                                  {isUrdu ? "واپس لیں" : "Withdraw"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Leave & Balances */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          {/* Statutory Leave Balances Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">
                {isUrdu ? "میرے چھٹیوں کا قانونی بیلنس" : "Statutory Leave Balances"}
              </h2>
              <button
                type="button"
                data-help="self_service.btn_apply_leave"
                onClick={() => setApplyLeaveModalOpen(true)}
                disabled={!capability.canRequestLeave}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                + {isUrdu ? "نئی رخصت کی درخواست دیں" : "Apply for Leave"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {leaveBalances.map((b) => (
                <div key={b.leave_type} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                  <div className="text-xs font-semibold text-gray-500 uppercase">{b.leave_type}</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">{b.available}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {isUrdu ? "دستیاب دن" : "Days Available"}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 border-t pt-1">
                    {isUrdu ? "استعمال شدہ:" : "Used:"} {b.used} • {isUrdu ? "حاصل کردہ:" : "Accrued:"} {b.accrued}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Requests History Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-base font-bold text-gray-900">
              {isUrdu ? "میری چھٹیوں کی درخواستوں کا ریکارڈ" : "My Leave Requests History"}
            </h3>

            {leaveRequests.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {isUrdu ? "کوئی رخصت درخواست ریکارڈ نہیں ہے۔" : "No leave requests recorded yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">{isUrdu ? "قسم" : "Type"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "تاریخیں" : "Dates"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "دن" : "Days"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "وجہ" : "Reason"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "حالت" : "Status"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "سپروائزر فیصلہ / نوٹ" : "Decision Note"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaveRequests.map((r) => (
                      <tr key={r.leave_request_id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold">{r.leave_type}</td>
                        <td className="py-2.5 px-3">{r.from_date} → {r.to_date}</td>
                        <td className="py-2.5 px-3">{r.days}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-600 max-w-xs truncate">{r.reason || "-"}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            r.status === "Approved" ? "bg-green-100 text-green-800" :
                            r.status === "Rejected" ? "bg-red-100 text-red-800" :
                            r.status === "Cancelled" ? "bg-gray-100 text-gray-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-600">{r.decision_note || "-"}</td>
                        <td className="py-2.5 px-3 text-right">
                          {r.status === "Pending" && (
                            <button
                              type="button"
                              data-help="self_service.leave_btn_withdraw"
                              onClick={() => handleCancelLeave(r.leave_request_id)}
                              disabled={actionLoading}
                              className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded"
                            >
                              {isUrdu ? "واپس لیں" : "Withdraw"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Profile & Payslips */}
      {activeTab === "payslips" && (
        <div className="space-y-6">
          {profile && (
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
                  <div className="text-xs text-gray-500 mt-0.5">
                    #{profile.emp_number} • {profile.designation} ({profile.department_name || "General"})
                  </div>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <div><span className="font-semibold">{isUrdu ? "شناختی کارڈ:" : "CNIC:"}</span> {profile.cnic}</div>
                  <div><span className="font-semibold">{isUrdu ? "موبائل:" : "Mobile:"}</span> {profile.mobile}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div><span className="text-gray-500 block">{isUrdu ? "ملازمت کی حالت:" : "Employment Status:"}</span><span className="font-bold">{profile.employment_status}</span></div>
                <div><span className="text-gray-500 block">{isUrdu ? "معاہدہ کی قسم:" : "Contract Type:"}</span><span className="font-bold">{profile.contract_type}</span></div>
                <div><span className="text-gray-500 block">{isUrdu ? "بنیادی تنخواہ:" : "Base Salary:"}</span><span className="font-bold">Rs. {profile.base_salary?.toLocaleString()}</span></div>
                <div><span className="text-gray-500 block">{isUrdu ? "نگران افسر:" : "Supervisor:"}</span><span className="font-bold">{profile.supervisor_name || "-"}</span></div>
              </div>
            </div>
          )}

          {/* Payslips History */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-base font-bold text-gray-900">
              {isUrdu ? "منظور شدہ ماہانہ پے سلپس" : "Finalized Monthly Payslips"}
            </h3>

            {(!profile || !profile.payslips || profile.payslips.length === 0) ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {isUrdu ? "کوئی جاری شدہ پے سلپ دستیاب نہیں ہے۔" : "No finalized payslips generated yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">{isUrdu ? "پے رول رن #" : "Run #"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "مدت" : "Period"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "خالص ادائیگی" : "Net Payable"}</th>
                      <th className="py-2.5 px-3">{isUrdu ? "حالت" : "Status"}</th>
                      <th className="py-2.5 px-3 text-right">{isUrdu ? "کارروائی" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.payslips.map((ps) => (
                      <tr key={ps.payroll_item_id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold">{ps.run_number}</td>
                        <td className="py-2.5 px-3 text-xs">{ps.period_start} → {ps.period_end}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">Rs. {ps.net_payable?.toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {ps.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            data-help="self_service.payslip_btn_view"
                            onClick={() => handleViewPayslip(ps.payroll_item_id)}
                            disabled={payslipLoading}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                          >
                            {isUrdu ? "تفصیل / پرنٹ" : "View & Print"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Holidays & Report Issue */}
      {activeTab === "support" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {isUrdu ? "سرکاری و قومی تعطیلات" : "Gazetted Public Holidays"}
            </h2>
            <button
              type="button"
              data-help="self_service.btn_open_issue_modal"
              onClick={() => setIssueModalOpen(true)}
              disabled={!capability.canReportIssue}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
            >
              ⚠️ {isUrdu ? "خرابی یا مرمت کی شکایت درج کریں" : "Report Facility Issue"}
            </button>
          </div>

          {/* Holidays list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {holidays.map((h) => (
              <div key={h.holiday_id} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900">{h.name}</div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                    {isUrdu ? "چھٹی بمع تنخواہ" : "Paid Holiday"}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{h.holiday_date}</div>
                {h.notes && <div className="text-xs text-gray-600 mt-1 italic">{h.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask Colleague Swap Modal (rule:9274755ac9) */}
      {swapModalOpen && selectedDutyForSwap && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {isUrdu ? "ساتھی سے ڈیوٹی کا تبادلہ یا کور" : "Ask a Colleague (Cover or Swap)"}
              </h3>
              <button
                type="button"
                data-help="self_service.swap_modal_btn_close"
                onClick={() => setSwapModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg text-xs text-purple-900 space-y-1">
              <div><span className="font-semibold">{isUrdu ? "میری ڈیوٹی:" : "My Duty:"}</span> {selectedDutyForSwap.roster_date} ({selectedDutyForSwap.shift_name})</div>
              <div><span className="font-semibold">{isUrdu ? "شعبہ:" : "Area:"}</span> {selectedDutyForSwap.duty_area} • {selectedDutyForSwap.start_time} - {selectedDutyForSwap.end_time}</div>
            </div>

            {swapOptionsLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">
                {isUrdu ? "دستیاب عملے کی فہرست حاصل کی جا رہی ہے..." : "Checking available colleagues free for this duty..."}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Swap Kind */}
                <div className="flex gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      data-help="self_service.swap_radio_cover"
                      name="swapKind"
                      checked={swapKind === "Cover"}
                      onChange={() => setSwapKind("Cover")}
                    />
                    <span>{isUrdu ? "صرف کور (وہ میری ڈیوٹی کریں)" : "Cover (They work my duty)"}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      data-help="self_service.swap_radio_swap"
                      name="swapKind"
                      checked={swapKind === "Swap"}
                      onChange={() => setSwapKind("Swap")}
                    />
                    <span>{isUrdu ? "باہمی تبادلہ (میں بدلے میں ان کی ڈیوٹی کروں)" : "Swap (I work their return duty in exchange)"}</span>
                  </label>
                </div>

                {/* Colleague Select */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {isUrdu ? "ہمکار کا انتخاب:" : "Select Free Colleague:"}
                  </label>
                  <select
                    data-help="self_service.swap_select_colleague"
                    value={selectedColleagueId}
                    onChange={(e) => setSelectedColleagueId(Number(e.target.value) || "")}
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">{isUrdu ? "-- ساتھی ملازم منتخب کریں --" : "-- Choose a free colleague --"}</option>
                    {swapOptionsData?.colleagues?.map((c) => (
                      <option key={c.employee_id} value={c.employee_id}>
                        {c.full_name} (#{c.emp_number}) • {c.designation} {c.department_name ? `[${c.department_name}]` : ""}
                      </option>
                    ))}
                  </select>
                  {swapErrors.covering_employee_id && (
                    <p className="text-xs text-red-600 mt-1">{swapErrors.covering_employee_id}</p>
                  )}
                </div>

                {/* Return Duty Select (if Swap) */}
                {swapKind === "Swap" && selectedColleague && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      {isUrdu ? "بدلے میں ساتھی کی ڈیوٹی:" : "Colleague's Return Duty to Work:"}
                    </label>
                    <select
                      data-help="self_service.swap_select_return_duty"
                      value={selectedReturnRosterId}
                      onChange={(e) => setSelectedReturnRosterId(Number(e.target.value) || "")}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="">{isUrdu ? "-- بدلے کی ڈیوٹی منتخب کریں --" : "-- Select return duty --"}</option>
                      {selectedColleague.their_duties?.filter(d => d.you_can_work_it).map((d) => (
                        <option key={d.roster_id} value={d.roster_id}>
                          {d.roster_date} ({d.shift_name} - {d.duty_area})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {isUrdu ? "تبادلے کی ٹھوس وجہ (لازمی):" : "Operational Reason (Required):"}
                  </label>
                  <textarea
                    data-help="self_service.swap_input_reason"
                    rows={2}
                    placeholder={isUrdu ? "مثلاً گھریلو مجبوری، ڈاکٹر اپائنٹمنٹ..." : "e.g. Family emergency, university exam, medical visit..."}
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                  />
                  {swapErrors.reason && (
                    <p className="text-xs text-red-600 mt-1">{swapErrors.reason}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                data-help="self_service.swap_btn_modal_cancel"
                onClick={() => setSwapModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="self_service.swap_btn_modal_submit"
                onClick={handleSubmitSwap}
                disabled={actionLoading || !selectedColleagueId}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
              >
                {actionLoading ? (isUrdu ? "ارسال ہو رہا ہے..." : "Submitting...") : (isUrdu ? "درخواست بھیجیں" : "Send Request")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply for Leave Modal */}
      {applyLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {isUrdu ? "نئی رخصت کی درخواست" : "Apply for Leave"}
              </h3>
              <button
                type="button"
                data-help="self_service.leave_modal_btn_close"
                onClick={() => setApplyLeaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "رخصت کی قسم:" : "Leave Category:"}
                </label>
                <select
                  data-help="self_service.leave_select_type"
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="Annual">Annual (سالانہ)</option>
                  <option value="Casual">Casual (اتفاقی)</option>
                  <option value="Sick">Sick (طبی)</option>
                  <option value="Maternity">Maternity (زچگی)</option>
                  <option value="Unpaid">Unpaid (بلا تنخواہ)</option>
                  <option value="Other">Other (دیگر)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {isUrdu ? "از تاریخ:" : "From Date:"}
                  </label>
                  <input
                    type="date"
                    data-help="self_service.leave_input_from"
                    value={leaveForm.from_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    {isUrdu ? "تا تاریخ:" : "To Date:"}
                  </label>
                  <input
                    type="date"
                    data-help="self_service.leave_input_to"
                    value={leaveForm.to_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              {leaveFormErrors.to_date && (
                <p className="text-xs text-red-600">{leaveFormErrors.to_date}</p>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    data-help="self_service.leave_check_half_day"
                    checked={leaveForm.half_day}
                    onChange={(e) => setLeaveForm({ ...leaveForm, half_day: e.target.checked })}
                  />
                  <span>{isUrdu ? "نصف دن کی رخصت (Half-day leave)" : "Half-day leave"}</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "رخصت کی وجہ:" : "Reason / Justification:"}
                </label>
                <textarea
                  data-help="self_service.leave_input_reason"
                  rows={2}
                  placeholder={isUrdu ? "رخصت کی تفصیل درج کریں..." : "Optional description or handover note..."}
                  value={leaveForm.reason || ""}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                data-help="self_service.leave_btn_modal_cancel"
                onClick={() => setApplyLeaveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="self_service.leave_btn_modal_submit"
                onClick={handleApplyLeave}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                {actionLoading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Submitting...") : (isUrdu ? "درخواست جمع کریں" : "Submit Leave")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Payslip Modal */}
      {payslipModalOpen && selectedPayslip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isUrdu ? "ماہانہ تنخواہ سلپ" : "Monthly Salary Payslip"}
                </h3>
                <div className="text-xs text-gray-500">
                  {selectedPayslip.run_number} • {selectedPayslip.period_start} → {selectedPayslip.period_end}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-help="self_service.payslip_btn_print"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  🖨️ {isUrdu ? "پرنٹ" : "Print"}
                </button>
                <button
                  type="button"
                  data-help="self_service.payslip_btn_close"
                  onClick={() => setPayslipModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                <div><span className="text-gray-500">{isUrdu ? "ملازم:" : "Staff Name:"}</span> <span className="font-bold">{selectedPayslip.full_name}</span></div>
                <div><span className="text-gray-500">{isUrdu ? "ملازم نمبر:" : "Emp #:"}</span> <span className="font-bold">{selectedPayslip.emp_number}</span></div>
                <div><span className="text-gray-500">{isUrdu ? "عہدہ:" : "Designation:"}</span> <span className="font-bold">{selectedPayslip.designation}</span></div>
                <div><span className="text-gray-500">{isUrdu ? "شعبہ:" : "Department:"}</span> <span className="font-bold">{selectedPayslip.department_name || "-"}</span></div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg">
                <div className="space-y-1.5">
                  <div className="font-bold text-gray-700 uppercase border-b pb-1">{isUrdu ? "آمدنی (Earnings)" : "Earnings"}</div>
                  <div className="flex justify-between"><span>{isUrdu ? "بنیادی تنخواہ:" : "Base Salary:"}</span><span>Rs. {selectedPayslip.base_salary?.toLocaleString()}</span></div>
                  {selectedPayslip.extra_duty_pay > 0 && (
                    <div className="flex justify-between text-green-700"><span>{isUrdu ? "اضافی ڈیوٹی الاؤنس:" : "Extra Duty Pay:"}</span><span>+Rs. {selectedPayslip.extra_duty_pay?.toLocaleString()}</span></div>
                  )}
                  {selectedPayslip.accrued_commissions > 0 && (
                    <div className="flex justify-between text-green-700"><span>{isUrdu ? "کمیشن الاؤنس:" : "Commissions:"}</span><span>+Rs. {selectedPayslip.accrued_commissions?.toLocaleString()}</span></div>
                  )}
                  {selectedPayslip.other_additions > 0 && (
                    <div className="flex justify-between text-green-700"><span>{isUrdu ? "دیگر ادائیگیاں:" : "Other Additions:"}</span><span>+Rs. {selectedPayslip.other_additions?.toLocaleString()}</span></div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-gray-700 uppercase border-b pb-1">{isUrdu ? "کٹوتیاں (Deductions)" : "Deductions"}</div>
                  {selectedPayslip.unpaid_absence_deduction > 0 && (
                    <div className="flex justify-between text-red-600"><span>{isUrdu ? "غیر حاضر کٹوتی:" : "Unpaid Absence:"}</span><span>-Rs. {selectedPayslip.unpaid_absence_deduction?.toLocaleString()}</span></div>
                  )}
                  {selectedPayslip.internal_credit_deduction > 0 && (
                    <div className="flex justify-between text-red-600"><span>{isUrdu ? "اسٹاف کریڈٹ (فارمیسی):" : "Staff Purchases:"}</span><span>-Rs. {selectedPayslip.internal_credit_deduction?.toLocaleString()}</span></div>
                  )}
                  {selectedPayslip.other_deductions > 0 && (
                    <div className="flex justify-between text-red-600"><span>{isUrdu ? "دیگر کٹوتیاں:" : "Other Deductions:"}</span><span>-Rs. {selectedPayslip.other_deductions?.toLocaleString()}</span></div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg font-bold text-sm text-blue-900">
                <span>{isUrdu ? "کل خالص قابل ادائیگی (Net Payable):" : "Net Payable Amount:"}</span>
                <span className="text-lg">Rs. {selectedPayslip.net_payable?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Maintenance Issue Modal (POST /ops/work-orders) */}
      {issueModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {isUrdu ? "ہسپتال سہولیات میں خرابی کی شکایت" : "Report Maintenance Issue"}
              </h3>
              <button
                type="button"
                data-help="self_service.issue_btn_close"
                onClick={() => setIssueModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "خرابی کا زمرہ:" : "Category:"}
                </label>
                <select
                  data-help="self_service.issue_select_category"
                  value={issueForm.category}
                  onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "ترجیح:" : "Priority:"}
                </label>
                <select
                  data-help="self_service.issue_select_priority"
                  value={issueForm.priority}
                  onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "مقام / کمرہ / وارڈ:" : "Location / Room / Ward:"}
                </label>
                <input
                  type="text"
                  data-help="self_service.issue_input_location"
                  placeholder={isUrdu ? "مثلاً وارڈ 3، واش روم یا او پی ڈی کمرہ 4..." : "e.g. Ward 3, Washroom or OPD Counter 2..."}
                  value={issueForm.location_text || ""}
                  onChange={(e) => setIssueForm({ ...issueForm, location_text: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  {isUrdu ? "خرابی کی تفصیل (لازمی):" : "Description (Required):"}
                </label>
                <textarea
                  data-help="self_service.issue_input_description"
                  rows={3}
                  placeholder={isUrdu ? "خرابی کی تفصیلی وضاحت بیان کریں..." : "Describe the equipment failure or facility problem in detail..."}
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
                {issueFormErrors.description && (
                  <p className="text-xs text-red-600 mt-1">{issueFormErrors.description}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                data-help="self_service.issue_btn_cancel"
                onClick={() => setIssueModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="self_service.issue_btn_submit"
                onClick={handleReportIssue}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {actionLoading ? (isUrdu ? "درج ہو رہا ہے..." : "Submitting...") : (isUrdu ? "شکایت درج کریں" : "Submit Report")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
