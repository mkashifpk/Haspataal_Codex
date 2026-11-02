/**
 * Screen 141: owner_dashboard
 * "Owner dashboard"
 * Workspace: `owner_dashboard`, Position: 141, Points: 41.
 *
 * Statutory & Quality Rules:
 * - rule:8e0811036c: Refresh every 60 s while visible; figures are live from the ledger.
 * - Delivery Gate: Loading, empty and error states (q:states), permission-based actions (q:permissions),
 *   F1 contextual help (q:f1_help), bilingual English/Urdu role FAQs (q:role_faq), bounded 100-250% zoom (q:zoom).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  pnlFlash,
  pnlTrend,
  patientVolume,
  trialBalance,
  type PnlFlashOut,
  type PnlTrendDayOut,
  type PatientVolumeOut,
  type TrialBalanceRowOut,
} from "../generated/owner_dashboard";
import {
  getOwnerDashboardCapabilityView,
  calculateOpdConversionMetrics,
  calculateDoctorMetrics,
  summarizePnlFlash,
  summarizeTrialBalance,
  validateDateRange,
  validateTrendDays,
  AUTO_REFRESH_INTERVAL_SECONDS,
  OWNER_DASHBOARD_ERROR_MESSAGES,
  type OwnerDashboardCapabilityView,
} from "../owner-dashboard-policy";

export interface OwnerDashboardProps {
  user: {
    user_id: number;
    username: string;
    roles: string[];
    permissions: string[];
  };
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  timeZone?: string;
  onNavigateScreen?: (screenId: string) => void;
}

type DashboardTab = "pnl_flash" | "pnl_trend" | "patient_volume" | "trial_balance";

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  // Capability View derivation
  const capabilityView: OwnerDashboardCapabilityView = useMemo(
    () => getOwnerDashboardCapabilityView(establishment),
    [establishment]
  );

  // Permission Checks
  const hasOwnerPerm = useMemo(
    () => user.permissions?.includes("finance.dashboard.owner") || user.roles?.includes("owner") || user.roles?.includes("hospital_admin") || user.roles?.includes("hospital_director") || user.roles?.includes("clinic_director"),
    [user]
  );
  const hasGlPerm = useMemo(
    () => user.permissions?.includes("finance.gl.view") || user.roles?.includes("accountant") || hasOwnerPerm,
    [user, hasOwnerPerm]
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>("pnl_flash");

  // Date filters (defaults to today's date formatted YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [dateFrom, setDateFrom] = useState<string>(todayStr);
  const [dateTo, setDateTo] = useState<string>(todayStr);

  // Applied dates
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(todayStr);
  const [appliedDateTo, setAppliedDateTo] = useState<string>(todayStr);

  // Trend days filter (1-92, default 30)
  const [trendDays, setTrendDays] = useState<number>(30);

  // Search & filter states
  const [doctorSearch, setDoctorSearch] = useState<string>("");
  const [tbTypeFilter, setTbTypeFilter] = useState<string>("All");
  const [tbSearch, setTbSearch] = useState<string>("");

  // Data States
  const [flashData, setFlashData] = useState<PnlFlashOut | null>(null);
  const [trendData, setTrendData] = useState<PnlTrendDayOut[]>([]);
  const [volumeData, setVolumeData] = useState<PatientVolumeOut | null>(null);
  const [tbData, setTbData] = useState<TrialBalanceRowOut[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(AUTO_REFRESH_INTERVAL_SECONDS);

  // Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    if (!hasOwnerPerm && !hasGlPerm) {
      setErrorMessage(OWNER_DASHBOARD_ERROR_MESSAGES.FORBIDDEN);
      return;
    }

    const rangeVal = validateDateRange(appliedDateFrom, appliedDateTo);
    if (!rangeVal.valid) {
      setErrorMessage({
        en: rangeVal.error || OWNER_DASHBOARD_ERROR_MESSAGES.VALIDATION_ERROR.en,
        ur: OWNER_DASHBOARD_ERROR_MESSAGES.VALIDATION_ERROR.ur,
      });
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const promises: Promise<any>[] = [];

      // Fetch P&L Flash & Volume if user has owner dashboard permission
      if (hasOwnerPerm) {
        promises.push(
          pnlFlash({ date_from: appliedDateFrom || null, date_to: appliedDateTo || null })
            .then((res) => setFlashData(res))
            .catch((err) => {
              console.warn("pnlFlash error:", err);
            })
        );

        promises.push(
          pnlTrend({ days: trendDays })
            .then((res) => setTrendData(res))
            .catch((err) => {
              console.warn("pnlTrend error:", err);
            })
        );

        promises.push(
          patientVolume({ date_from: appliedDateFrom || null, date_to: appliedDateTo || null })
            .then((res) => setVolumeData(res))
            .catch((err) => {
              console.warn("patientVolume error:", err);
            })
        );
      }

      // Fetch Trial Balance if user has GL view permission
      if (hasGlPerm) {
        promises.push(
          trialBalance({ date_from: appliedDateFrom || null, date_to: appliedDateTo || null })
            .then((res) => setTbData(res))
            .catch((err) => {
              console.warn("trialBalance error:", err);
            })
        );
      }

      await Promise.all(promises);
      setLastRefreshedAt(new Date());
      setSecondsUntilRefresh(AUTO_REFRESH_INTERVAL_SECONDS);
    } catch (err: any) {
      console.error("Owner dashboard fetch error:", err);
      const code = err?.code || (err?.status === 403 ? "FORBIDDEN" : "NETWORK_ERROR");
      setErrorMessage(OWNER_DASHBOARD_ERROR_MESSAGES[code] || OWNER_DASHBOARD_ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  }, [hasOwnerPerm, hasGlPerm, appliedDateFrom, appliedDateTo, trendDays]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Rule rule:8e0811036c: Refresh every 60 s while visible; figures are live from the ledger.
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchData();
          return AUTO_REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchData]);

  // Quick Date Preset Handlers
  const handleSetPreset = (preset: "today" | "yesterday" | "week" | "month") => {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    if (preset === "today") {
      from = now;
      to = now;
    } else if (preset === "yesterday") {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      to = from;
    } else if (preset === "week") {
      from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      to = now;
    } else if (preset === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    setDateFrom(fromStr);
    setDateTo(toStr);
    setAppliedDateFrom(fromStr);
    setAppliedDateTo(toStr);
  };

  const handleApplyCustomDates = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  // Summaries and derived metrics
  const pnlSummary = useMemo(() => {
    if (!flashData) return null;
    return summarizePnlFlash(flashData);
  }, [flashData]);

  const volumeMetrics = useMemo(() => {
    if (!volumeData?.totals) return null;
    return calculateOpdConversionMetrics(volumeData.totals);
  }, [volumeData]);

  const tbSummary = useMemo(() => {
    return summarizeTrialBalance(tbData);
  }, [tbData]);

  // Filtered Doctors
  const filteredDoctors = useMemo(() => {
    if (!volumeData?.per_doctor) return [];
    if (!doctorSearch.trim()) return volumeData.per_doctor;
    const q = doctorSearch.toLowerCase();
    return volumeData.per_doctor.filter(
      (d) =>
        (d.doctor_name && d.doctor_name.toLowerCase().includes(q)) ||
        (d.department_name && d.department_name.toLowerCase().includes(q))
    );
  }, [volumeData, doctorSearch]);

  // Filtered Trial Balance Rows
  const filteredTbRows = useMemo(() => {
    return tbData.filter((row) => {
      if (tbTypeFilter !== "All" && row.type !== tbTypeFilter) return false;
      if (tbSearch.trim()) {
        const q = tbSearch.toLowerCase();
        return (
          row.account_code.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tbData, tbTypeFilter, tbSearch]);

  // Format currency in PKR
  const formatPkr = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "Rs. 0";
    return `Rs. ${Number(val).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  if (capabilityView === "hidden") {
    return (
      <div className="p-6 text-center text-gray-500 bg-white rounded-lg border shadow-sm">
        <p className="font-semibold text-base">Screen is currently disabled under establishment settings.</p>
        <p className="text-sm mt-1">مالک ڈیش بورڈ ہسپتال کی ترتیبات میں غیر فعال ہے۔</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header and Capability View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Owner Dashboard
            </h1>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded">
              مالک ڈیش بورڈ
            </span>
            <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded">
              Workspace: Owner / Hospital Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Live P&L flash, revenue trends, and visited vs examined patient conversion metrics.
          </p>
        </div>

        {/* Refresh & Timer Controls (rule:8e0811036c) */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-gray-500 block">
              Auto-refresh: <strong className="text-gray-700">{secondsUntilRefresh}s</strong>
            </span>
            <span className="text-[11px] text-gray-400 block">
              Updated: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => {
              fetchData();
              setSecondsUntilRefresh(AUTO_REFRESH_INTERVAL_SECONDS);
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            data-help="owner_dashboard.btn_refresh"
          >
            {loading ? (
              <span>Refreshing...</span>
            ) : (
              <>
                <span>🔄</span>
                <span>Refresh Now | تازہ دم</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Capability View Alert Banner */}
      {capabilityView === "open_work" && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <div>
            <strong>Restricted Mode:</strong> Hospital administrative services in restricted mode; reviewing live financial records without new operations.
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>❌</span>
            <div>
              <p className="font-semibold">{errorMessage.en}</p>
              <p className="text-red-700 mt-0.5">{errorMessage.ur}</p>
            </div>
          </div>
          <span
            role="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-800 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </span>
        </div>
      )}

      {/* Date Filters & Presets Bar */}
      <div className="bg-gray-50 p-3 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <span className="font-semibold text-gray-700 mr-1">Period:</span>
          <button
            onClick={() => handleSetPreset("today")}
            className={`px-2.5 py-1 rounded border transition-colors ${
              appliedDateFrom === todayStr && appliedDateTo === todayStr
                ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
            data-help="owner_dashboard.btn_filter_today"
          >
            Today | آج
          </button>
          <button
            onClick={() => handleSetPreset("yesterday")}
            className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            data-help="owner_dashboard.btn_filter_yesterday"
          >
            Yesterday | کل
          </button>
          <button
            onClick={() => handleSetPreset("week")}
            className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            data-help="owner_dashboard.btn_filter_week"
          >
            Last 7 Days | پچھلے 7 دن
          </button>
          <button
            onClick={() => handleSetPreset("month")}
            className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            data-help="owner_dashboard.btn_filter_month"
          >
            This Month | رواں ماہ
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1">
            <span className="text-gray-600">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border rounded bg-white text-gray-800"
              data-help="owner_dashboard.input_date_from"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border rounded bg-white text-gray-800"
              data-help="owner_dashboard.input_date_to"
            />
          </div>
          <button
            onClick={handleApplyCustomDates}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded font-medium transition-colors"
            data-help="owner_dashboard.btn_apply_dates"
          >
            Apply | لاگو کریں
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b text-xs sm:text-sm font-semibold overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab("pnl_flash")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "pnl_flash"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="owner_dashboard.tab_pnl_flash"
        >
          <span>📊</span>
          <span>P&L Flash & Income Streams | پی اینڈ ایل فلیش</span>
        </button>

        <button
          onClick={() => setActiveTab("pnl_trend")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "pnl_trend"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="owner_dashboard.tab_pnl_trend"
        >
          <span>📈</span>
          <span>Revenue Trend (Max 92 Days) | آمدنی کا رجحان</span>
        </button>

        <button
          onClick={() => setActiveTab("patient_volume")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "patient_volume"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="owner_dashboard.tab_patient_volume"
        >
          <span>👥</span>
          <span>Visited vs Examined (OPD / IPD) | مریضوں کا حجم</span>
        </button>

        <button
          onClick={() => setActiveTab("trial_balance")}
          className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "trial_balance"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
          data-help="owner_dashboard.tab_trial_balance"
        >
          <span>⚖️</span>
          <span>GL Trial Balance | کھاتہ ٹرائل بیلنس</span>
        </button>
      </div>

      {/* TAB 1: P&L Flash & Income Streams */}
      {activeTab === "pnl_flash" && (
        <div className="space-y-4">
          {flashData ? (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* Gross Income */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Gross Income | مجموعی آمدنی</span>
                  <span className="text-lg font-bold text-gray-900 mt-1 block">
                    {formatPkr(flashData.gross_income)}
                  </span>
                  <span className="text-[11px] text-gray-400">Total billings before contra</span>
                </div>

                {/* Net Income */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Net Income | خالص آمدنی</span>
                  <span className="text-lg font-bold text-indigo-600 mt-1 block">
                    {formatPkr(flashData.net_income)}
                  </span>
                  <span className="text-[11px] text-gray-400">After discounts & refunds</span>
                </div>

                {/* Total Expenses */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Total Expenses | کل اخراجات</span>
                  <span className="text-lg font-bold text-red-600 mt-1 block">
                    {formatPkr(flashData.total_expenses)}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Includes run-rate {formatPkr(flashData.payroll_run_rate)}
                  </span>
                </div>

                {/* Net Profit / Loss */}
                <div className={`p-3 border rounded-lg shadow-sm ${
                  flashData.net_profit >= 0 ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"
                }`}>
                  <span className="text-gray-500 font-medium block">Net Profit / Loss | نفع / نقصان</span>
                  <span className={`text-lg font-bold mt-1 block ${
                    flashData.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}>
                    {formatPkr(flashData.net_profit)}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Margin: {pnlSummary?.profitMarginPct || 0}%
                  </span>
                </div>

                {/* Cash Collected */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Cash Flow Collected | وصول شدہ کیش</span>
                  <span className="text-lg font-bold text-emerald-600 mt-1 block">
                    {formatPkr(flashData.cash?.cash_collected)}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Gross: {formatPkr(flashData.cash?.collected)} | Refunds: {formatPkr(flashData.cash?.paid_back)}
                  </span>
                </div>

                {/* Receivables Outstanding */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Receivables | واجب الوصول</span>
                  <span className="text-lg font-bold text-amber-600 mt-1 block">
                    {formatPkr(flashData.receivables_outstanding)}
                  </span>
                  <span className="text-[11px] text-gray-400">Corporate & panel uncollected</span>
                </div>

                {/* Payables Open */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Payables Open | واجب الادا</span>
                  <span className="text-lg font-bold text-orange-600 mt-1 block">
                    {formatPkr(flashData.payables_open)}
                  </span>
                  <span className="text-[11px] text-gray-400">Vendors & suppliers pending</span>
                </div>

                {/* Daily Payroll Run Rate */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Daily Payroll Run-Rate | تنخواہوں کا تخمینہ</span>
                  <span className="text-lg font-bold text-blue-600 mt-1 block">
                    {formatPkr(flashData.payroll_run_rate)}
                  </span>
                  <span className="text-[11px] text-gray-400">Daily accrued salaries</span>
                </div>
              </div>

              {/* Income Streams vs Overheads Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Income Streams */}
                <div className="bg-white border rounded-lg shadow-sm p-4">
                  <h3 className="font-bold text-sm text-gray-800 pb-2 border-b flex items-center justify-between">
                    <span>Income Streams | آمدنی کے ذرائع</span>
                    <span className="text-xs text-indigo-600 font-medium">
                      Net: {formatPkr(flashData.net_income)}
                    </span>
                  </h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="py-2 px-3">Stream</th>
                          <th className="py-2 px-3">Account</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flashData.income?.length > 0 ? (
                          flashData.income.map((item, idx) => {
                            const share = flashData.gross_income > 0 ? ((item.amount / flashData.gross_income) * 100).toFixed(1) : "0";
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="py-2 px-3 font-semibold text-gray-800">{item.stream}</td>
                                <td className="py-2 px-3 text-gray-500">{item.account_code}</td>
                                <td className="py-2 px-3 text-right font-medium text-emerald-700">
                                  {formatPkr(item.amount)}
                                </td>
                                <td className="py-2 px-3 text-right text-gray-500">{share}%</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-gray-400">
                              No income entries recorded for this period.
                            </td>
                          </tr>
                        )}
                        {/* Contra Income Rows */}
                        {flashData.contra_income?.map((contra, idx) => (
                          <tr key={`contra-${idx}`} className="bg-rose-50/30 text-rose-800">
                            <td className="py-2 px-3 font-medium">Less: {contra.stream} (Contra)</td>
                            <td className="py-2 px-3">{contra.account_code}</td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {formatPkr(contra.amount)}
                            </td>
                            <td className="py-2 px-3 text-right">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operating Expenses & Overheads */}
                <div className="bg-white border rounded-lg shadow-sm p-4">
                  <h3 className="font-bold text-sm text-gray-800 pb-2 border-b flex items-center justify-between">
                    <span>Overheads & Operating Expenses | اخراجات</span>
                    <span className="text-xs text-red-600 font-medium">
                      Total: {formatPkr(flashData.total_expenses)}
                    </span>
                  </h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Account</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flashData.expenses?.length > 0 ? (
                          flashData.expenses.map((exp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="py-2 px-3 font-semibold text-gray-800">{exp.category}</td>
                              <td className="py-2 px-3 text-gray-500">{exp.account_code}</td>
                              <td className="py-2 px-3 text-right font-medium text-rose-700">
                                {formatPkr(exp.amount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-gray-400">
                              No overhead expense vouchers posted for this period.
                            </td>
                          </tr>
                        )}
                        {/* Daily Payroll Run Rate entry */}
                        <tr className="bg-blue-50/30 text-blue-900 font-medium">
                          <td className="py-2 px-3">Salaries & Payroll Daily Run-Rate</td>
                          <td className="py-2 px-3">5000</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatPkr(flashData.payroll_run_rate)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center bg-white border rounded-lg text-gray-500">
              {loading ? "Loading live P&L flash..." : "No financial ledger data found for this period."}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: P&L Trend (Max 92 Days) */}
      {activeTab === "pnl_trend" && (
        <div className="space-y-4">
          <div className="bg-white p-4 border rounded-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-sm text-gray-800">
                P&L Daily Net Income vs Expenses Trajectory
              </h3>
              <p className="text-gray-500 text-xs mt-0.5">
                Displays day-by-day operational margin (without periodic salary adjustments).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Trend Horizon:</span>
              <select
                value={trendDays}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  setTrendDays(days);
                }}
                className="px-2 py-1 border rounded bg-white text-gray-800 font-medium"
                data-help="owner_dashboard.select_trend_days"
              >
                <option value={7}>Last 7 Days (1 Week)</option>
                <option value={14}>Last 14 Days (2 Weeks)</option>
                <option value={30}>Last 30 Days (1 Month)</option>
                <option value={60}>Last 60 Days (2 Months)</option>
                <option value={90}>Last 90 Days (Quarter)</option>
                <option value={92}>Max 92 Days</option>
              </select>
            </div>
          </div>

          {/* Trend Data Table */}
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date (Day)</th>
                    <th className="py-2.5 px-3 text-right">Net Income</th>
                    <th className="py-2.5 px-3 text-right">Operating Expenses</th>
                    <th className="py-2.5 px-3 text-right">Operational Margin</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trendData.length > 0 ? (
                    trendData.map((d, idx) => {
                      const margin = d.net_income - d.expenses;
                      const isPositive = margin >= 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{d.day}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                            {formatPkr(d.net_income)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                            {formatPkr(d.expenses)}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {formatPkr(margin)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isPositive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {isPositive ? "Surplus | منافع" : "Deficit | خسارہ"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        {loading ? "Loading revenue trend..." : "No daily trend entries found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Visited vs Examined (OPD / IPD Volume) */}
      {activeTab === "patient_volume" && (
        <div className="space-y-4">
          {volumeData ? (
            <>
              {/* Overall Patient Volume KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-xs">
                {/* Visited */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Visited (Sold)</span>
                  <span className="text-lg font-bold text-indigo-700 mt-1 block">
                    {volumeData.totals?.visited || 0}
                  </span>
                  <span className="text-[10px] text-gray-400">Tickets settled</span>
                </div>

                {/* Examined */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Examined</span>
                  <span className="text-lg font-bold text-emerald-700 mt-1 block">
                    {volumeData.totals?.examined || 0}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {volumeMetrics?.examinationRatePct || 0}% seen
                  </span>
                </div>

                {/* Attrition */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Attrition</span>
                  <span className="text-lg font-bold text-rose-700 mt-1 block">
                    {volumeData.totals?.attrition || 0}
                  </span>
                  <span className="text-[10px] text-rose-600 font-semibold">
                    {volumeMetrics?.attritionRatePct || 0}% left unseen
                  </span>
                </div>

                {/* Issued Unpaid */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Issued Unpaid</span>
                  <span className="text-lg font-bold text-amber-700 mt-1 block">
                    {volumeData.totals?.issued_unpaid || 0}
                  </span>
                  <span className="text-[10px] text-gray-400">Unsettled counter tickets</span>
                </div>

                {/* Expired */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Expired</span>
                  <span className="text-lg font-bold text-gray-700 mt-1 block">
                    {volumeData.totals?.expired || 0}
                  </span>
                  <span className="text-[10px] text-gray-400">Timed out tickets</span>
                </div>

                {/* Refunded */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Refunded</span>
                  <span className="text-lg font-bold text-blue-700 mt-1 block">
                    {volumeData.totals?.refunded || 0}
                  </span>
                  <span className="text-[10px] text-gray-400">Void / cash back</span>
                </div>

                {/* Inpatient Admissions */}
                <div className="p-3 bg-white border rounded-lg shadow-sm">
                  <span className="text-gray-500 font-medium block">Admissions (IPD)</span>
                  <span className="text-lg font-bold text-purple-700 mt-1 block">
                    {volumeData.admissions || 0}
                  </span>
                  <span className="text-[10px] text-purple-600 font-semibold">Inpatient bedded</span>
                </div>
              </div>

              {/* Per-Doctor Performance Table */}
              <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-bold text-sm text-gray-800">
                    Per-Doctor Clinic Volume & Examination Conversion
                  </h3>
                  <input
                    type="text"
                    placeholder="Search doctor or department..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="px-3 py-1 border rounded text-xs w-full sm:w-64"
                    data-help="owner_dashboard.input_doctor_search"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b">
                      <tr>
                        <th className="py-2.5 px-3">Doctor</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3 text-right">Visited</th>
                        <th className="py-2.5 px-3 text-right">Examined</th>
                        <th className="py-2.5 px-3 text-right">Attrition</th>
                        <th className="py-2.5 px-3 text-right">Conversion %</th>
                        <th className="py-2.5 px-3 text-right">Issued Unpaid</th>
                        <th className="py-2.5 px-3 text-right">Refunded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredDoctors.length > 0 ? (
                        filteredDoctors.map((doc, idx) => {
                          const docMetrics = calculateDoctorMetrics(doc);
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="py-2.5 px-3 font-semibold text-gray-900">
                                {doc.doctor_name || "Department-Level"}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">
                                {doc.department_name || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium">{doc.visited}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                {doc.examined}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                                {doc.attrition}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-indigo-700">
                                {docMetrics.examinationRatePct}%
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-500">
                                {doc.issued_unpaid}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-500">
                                {doc.refunded}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-400">
                            {loading ? "Loading doctor volumes..." : "No doctor performance records match filter."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center bg-white border rounded-lg text-gray-500">
              {loading ? "Loading patient volumes..." : "No patient volume data found for this period."}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: General Ledger Trial Balance */}
      {activeTab === "trial_balance" && (
        <div className="space-y-4">
          {!hasGlPerm ? (
            <div className="p-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs">
              <h4 className="font-bold text-sm">Permission Required</h4>
              <p className="mt-1">
                Viewing General Ledger Trial Balance requires <code>finance.gl.view</code> permission.
              </p>
            </div>
          ) : (
            <>
              {/* Trial Balance Status & Summary Banner */}
              <div className="bg-white p-4 border rounded-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${
                    tbSummary.isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {tbSummary.isBalanced ? "✓" : "⚠️"}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">
                      {tbSummary.isBalanced
                        ? "General Ledger is Balanced (Debits = Credits)"
                        : `Ledger Out of Balance (Variance: ${formatPkr(tbSummary.variance)})`}
                    </h4>
                    <p className="text-gray-500 mt-0.5">
                      Debits: <strong className="text-gray-700">{formatPkr(tbSummary.totalDebits)}</strong> | Credits:{" "}
                      <strong className="text-gray-700">{formatPkr(tbSummary.totalCredits)}</strong>
                    </p>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={tbTypeFilter}
                    onChange={(e) => setTbTypeFilter(e.target.value)}
                    className="px-2 py-1 border rounded bg-white text-xs text-gray-800 font-medium"
                    data-help="owner_dashboard.select_tb_type"
                  >
                    <option value="All">All Types | تمام اقسام</option>
                    <option value="Asset">Asset | اثاثہ جات</option>
                    <option value="Liability">Liability | واجبات</option>
                    <option value="Equity">Equity | ملکیتی سرمایہ</option>
                    <option value="Income">Income | آمدنی</option>
                    <option value="Expense">Expense | اخراجات</option>
                    <option value="ContraIncome">Contra Income | کٹوتی</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Search account code/name..."
                    value={tbSearch}
                    onChange={(e) => setTbSearch(e.target.value)}
                    className="px-3 py-1 border rounded text-xs w-48 sm:w-56"
                    data-help="owner_dashboard.input_tb_search"
                  />
                </div>
              </div>

              {/* Trial Balance Table */}
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Debit</th>
                        <th className="py-2.5 px-3 text-right">Credit</th>
                        <th className="py-2.5 px-3 text-right">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTbRows.length > 0 ? (
                        filteredTbRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-mono font-semibold text-gray-800">
                              {row.account_code}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{row.name}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                                {row.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                              {row.debit > 0 ? formatPkr(row.debit) : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                              {row.credit > 0 ? formatPkr(row.credit) : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                              {formatPkr(row.balance)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            {loading ? "Loading trial balance..." : "No ledger accounts match current filter."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
