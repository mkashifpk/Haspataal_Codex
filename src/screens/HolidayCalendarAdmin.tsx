import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { HolidayOut, HolidayIn, HolidayPatch } from "../generated/holiday_calendar_admin";
import { listHolidays, createHolidays, updateHoliday } from "../generated/holiday_calendar_admin";
import {
  getHolidayCalendarAdminCapabilityView,
  validateBatchHolidays,
  validateHolidayPatch,
  isPastOrTodayHoliday,
  groupHolidaysByMonth,
  HOLIDAY_ADMIN_ERROR_MESSAGES,
  type MonthGroup
} from "../holiday-calendar-admin-policy";

export interface HolidayCalendarAdminProps {
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

export const HolidayCalendarAdmin: React.FC<HolidayCalendarAdminProps> = ({
  lang = "en",
  establishment,
  user,
  userPermissions = [],
  currentUserRole,
  currentEmployeeId
}) => {
  const isUrdu = lang === "ur";

  // Permissions & Capability
  const effectivePermissions = useMemo(() => {
    return userPermissions.length > 0 ? userPermissions : (user?.permissions || []);
  }, [userPermissions, user?.permissions]);

  const effectiveRole = currentUserRole || user?.role || "";

  const capability = useMemo(() => {
    return getHolidayCalendarAdminCapabilityView(establishment, effectivePermissions, effectiveRole);
  }, [establishment, effectivePermissions, effectiveRole]);

  // Current year default (e.g. 2026)
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"months" | "table">("months");

  // Data & Feedback States
  const [loading, setLoading] = useState<boolean>(false);
  const [holidays, setHolidays] = useState<HolidayOut[]>([]);
  const [successMessage, setSuccessMessage] = useState<{ en: string; ur: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);

  // Batch Entry Modal State (rule:748c506511)
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchRows, setBatchRows] = useState<HolidayIn[]>([
    { holiday_date: `${selectedYear}-03-23`, name: "Pakistan Day", notes: "National Holiday" },
    { holiday_date: `${selectedYear}-05-01`, name: "Labour Day", notes: "International Workers' Day" },
    { holiday_date: `${selectedYear}-08-14`, name: "Independence Day", notes: "National Holiday" },
    { holiday_date: `${selectedYear}-12-25`, name: "Quaid-e-Azam Day / Christmas", notes: "National Holiday" },
  ]);
  const [batchRowErrors, setBatchRowErrors] = useState<Record<number, Record<string, string>>>({});
  const [batchGeneralError, setBatchGeneralError] = useState<string | null>(null);

  // Edit / Move Modal State (rule:6b35ae8101)
  const [editingHoliday, setEditingHoliday] = useState<HolidayOut | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editValidationErrors, setEditValidationErrors] = useState<Record<string, string>>({});

  // Withdraw Confirmation Modal State (rule:6b35ae8101)
  const [withdrawingHoliday, setWithdrawingHoliday] = useState<HolidayOut | null>(null);

  // Error Handler
  const handleError = useCallback((err: any) => {
    console.error("Holiday Calendar Admin error:", err);
    const code = err?.code || (err?.status === 403 ? "FORBIDDEN" : "NETWORK_ERROR");
    const mapped = HOLIDAY_ADMIN_ERROR_MESSAGES[code] || {
      en: err?.message || "An unexpected error occurred while processing holidays.",
      ur: "تعطیلات کی پروسیسنگ کے دوران ایک غیر متوقع خرابی پیش آئی۔",
    };
    setErrorMessage(mapped);

    // If batch error has details.entry_index (rule:748c506511)
    if (code === "HOLIDAY_DATE_TAKEN" && err?.details?.entry_index !== undefined) {
      const idx = Number(err.details.entry_index);
      setBatchRowErrors((prev) => ({
        ...prev,
        [idx]: {
          ...prev[idx],
          holiday_date: "Date is already registered on the server as a public holiday."
        }
      }));
    }
  }, []);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Fetch Holidays (GET /holidays)
  const fetchHolidays = useCallback(async () => {
    if (!capability.canView) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await listHolidays({
        year: dateFrom || dateTo ? null : selectedYear,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        include_inactive: includeInactive,
      });
      setHolidays(res || []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [capability.canView, selectedYear, dateFrom, dateTo, includeInactive, handleError]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Year Navigation
  const handlePrevYear = () => {
    setSelectedYear((prev) => Math.max(2000, prev - 1));
    setDateFrom("");
    setDateTo("");
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => Math.min(2100, prev + 1));
    setDateFrom("");
    setDateTo("");
  };

  // Open Batch Entry Modal
  const openBatchModal = () => {
    clearMessages();
    setBatchRowErrors({});
    setBatchGeneralError(null);
    setBatchRows([
      { holiday_date: `${selectedYear}-03-23`, name: "Pakistan Day", notes: "National Holiday" },
      { holiday_date: `${selectedYear}-05-01`, name: "Labour Day", notes: "Workers' Day" },
      { holiday_date: `${selectedYear}-08-14`, name: "Independence Day", notes: "National Holiday" },
    ]);
    setShowBatchModal(true);
  };

  // Add row to batch
  const handleAddBatchRow = () => {
    setBatchRows((prev) => [...prev, { holiday_date: `${selectedYear}-01-01`, name: "", notes: "" }]);
  };

  // Remove row from batch
  const handleRemoveBatchRow = (index: number) => {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
    setBatchRowErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Preload standard gazetted national holidays
  const handlePreloadStandardHolidays = () => {
    setBatchRows([
      { holiday_date: `${selectedYear}-02-05`, name: "Kashmir Solidarity Day", notes: "Public Holiday" },
      { holiday_date: `${selectedYear}-03-23`, name: "Pakistan Day", notes: "National Day" },
      { holiday_date: `${selectedYear}-05-01`, name: "Labour Day", notes: "International Workers' Day" },
      { holiday_date: `${selectedYear}-08-14`, name: "Independence Day", notes: "National Day" },
      { holiday_date: `${selectedYear}-09-06`, name: "Defence Day", notes: "National Observance" },
      { holiday_date: `${selectedYear}-11-09`, name: "Iqbal Day", notes: "National Holiday" },
      { holiday_date: `${selectedYear}-12-25`, name: "Quaid-e-Azam Day / Christmas", notes: "National Holiday" },
    ]);
    setBatchRowErrors({});
    setBatchGeneralError(null);
  };

  // Submit Batch Holidays (POST /holidays, rule:748c506511)
  const handleSubmitBatch = async () => {
    clearMessages();
    setBatchRowErrors({});
    setBatchGeneralError(null);

    const val = validateBatchHolidays(batchRows);
    if (!val.valid) {
      setBatchRowErrors(val.rowErrors);
      if (val.generalError) setBatchGeneralError(val.generalError);
      return;
    }

    setLoading(true);
    try {
      const res = await createHolidays({ holidays: batchRows });
      setSuccessMessage({
        en: `Administrative gazette registration confirmed: ${res.length} public holidays recorded for ${selectedYear}.`,
        ur: `سرکاری گزٹ رجسٹریشن مکمل: سال ${selectedYear} کے لیے ${res.length} تعطیلات کامیابی سے درج ہو گئیں۔`,
      });
      setShowBatchModal(false);
      fetchHolidays();
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (holiday: HolidayOut) => {
    clearMessages();
    setEditingHoliday(holiday);
    setEditDate(holiday.holiday_date);
    setEditName(holiday.name);
    setEditNotes(holiday.notes || "");
    setEditValidationErrors({});
  };

  // Submit Edit (PATCH /holidays/{id}, rule:6b35ae8101)
  const handleSubmitEdit = async () => {
    if (!editingHoliday) return;
    clearMessages();

    const patch: HolidayPatch = {
      expected_version: editingHoliday.row_version,
      holiday_date: editDate !== editingHoliday.holiday_date ? editDate : undefined,
      name: editName.trim() !== editingHoliday.name ? editName.trim() : undefined,
      notes: editNotes.trim() !== (editingHoliday.notes || "") ? editNotes.trim() : undefined,
    };

    const val = validateHolidayPatch(patch);
    if (!val.valid) {
      setEditValidationErrors(val.errors);
      return;
    }

    setLoading(true);
    try {
      const updated = await updateHoliday(editingHoliday.holiday_id, patch);
      const isPast = isPastOrTodayHoliday(updated.holiday_date, todayStr);
      setSuccessMessage({
        en: isPast
          ? `Holiday '${updated.name}' modified. Modifying current/past dates recomputes staff attendance while finalized payroll remains protected.`
          : `Holiday '${updated.name}' modified successfully.`,
        ur: isPast
          ? `تعطیل '${updated.name}' تبدیل ہو گئی۔ موجودہ یا ماضی کی تاریخ بدلنے سے حاضری دوبارہ پروسیس ہوگی جبکہ پے رول محفوظ رہے گا۔`
          : `تعطیل '${updated.name}' کامیابی سے تبدیل ہو گئی۔`,
      });
      setEditingHoliday(null);
      fetchHolidays();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Withdraw Holiday (PATCH /holidays/{id} with is_active: false, rule:6b35ae8101)
  const handleConfirmWithdraw = async () => {
    if (!withdrawingHoliday) return;
    clearMessages();
    setLoading(true);
    try {
      const res = await updateHoliday(withdrawingHoliday.holiday_id, {
        is_active: false,
        expected_version: withdrawingHoliday.row_version,
      });
      setSuccessMessage({
        en: `Holiday '${res.name}' (${res.holiday_date}) withdrawn (is_active: false). Permanent deletion is prevented by governance policy.`,
        ur: `تعطیل '${res.name}' (${res.holiday_date}) واپس لے لی گئی۔ پالیسی کے تحت مستقل حذف ممنوع ہے۔`,
      });
      setWithdrawingHoliday(null);
      fetchHolidays();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Reactivate Holiday (PATCH /holidays/{id} with is_active: true)
  const handleReactivateHoliday = async (holiday: HolidayOut) => {
    clearMessages();
    setLoading(true);
    try {
      const res = await updateHoliday(holiday.holiday_id, {
        is_active: true,
        expected_version: holiday.row_version,
      });
      setSuccessMessage({
        en: `Holiday '${res.name}' (${res.holiday_date}) reactivated.`,
        ur: `تعطیل '${res.name}' (${res.holiday_date}) دوبارہ فعال کر دی گئی۔`,
      });
      fetchHolidays();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Print Calendar
  const handlePrintCalendar = () => {
    window.print();
  };

  // Month-grouped view data
  const monthGroups: MonthGroup[] = useMemo(() => {
    return groupHolidaysByMonth(holidays);
  }, [holidays]);

  // Access Denied Screen
  if (capability.mode === "hidden") {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center" dir={isUrdu ? "rtl" : "ltr"}>
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">
            {isUrdu ? "تعطیلات ایڈمن ماڈیول تک رسائی محدود ہے" : "Executive Holiday Calendar Access Restricted"}
          </h2>
          <p className="text-amber-700 dark:text-amber-300">
            {capability.reason || (isUrdu ? "آپ کے پاس اس اسکرین تک رسائی کی اجازت نہیں ہے۔" : "Access to the executive holiday calendar is not enabled for this terminal.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="holiday-calendar-admin-screen flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-screen" dir={isUrdu ? "rtl" : "ltr"}>
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isUrdu ? "ہسپتال انتظامیہ و ڈائریکٹرز تعطیلات کیلنڈر" : "Hospital Operations & Executive Holiday Calendar"}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {selectedYear}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
              {isUrdu ? "انتظامی نگرانی" : "Executive Oversight"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isUrdu
              ? "ہسپتال ایڈمن، ڈائریکٹرز اور مالکان کے لیے سالانہ سرکاری تعطیلات کا شیڈول اور آپریشنل اثرات۔"
              : "Executive holiday schedule oversight for Hospital Administration, Directors, and Owners."}
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-help="holiday_calendar_admin.btn_print_calendar"
            onClick={handlePrintCalendar}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm transition-colors"
          >
            {isUrdu ? "پرنٹ نوٹس شیٹ" : "Print Notice Sheet"}
          </button>
          {capability.canManage && (
            <button
              type="button"
              data-help="holiday_calendar_admin.btn_open_batch_modal"
              onClick={openBatchModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
            >
              <span>+</span>
              <span>{isUrdu ? "سرکاری تعطیلات کا اندراج" : "+ Enter Gazetted Holidays"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Statutory Guidance Banners */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs shadow-sm leading-relaxed">
            <span className="font-bold flex items-center gap-1 mb-1">
              <span>ℹ</span>
              <span>{isUrdu ? "مستقل اور روسٹر عملے کا قانونی ضابطہ (قاعدہ e7b6fb1f5e):" : "Statutory Rule e7b6fb1f5e (Paid Rest vs Rostered Service):"}</span>
            </span>
            {isUrdu
              ? "مستقل شیڈول والے عملے کو تعطیل پر بامعاوضہ چھٹی ملتی ہے (flag: Holiday)؛ جبکہ وارڈز اور ایمرجنسی کا روسٹرڈ عملہ معمول کے مطابق ڈیوٹی دیتا ہے اور اضافی ڈیوٹی معاوضے کا حقدار بنتا ہے۔"
              : "Fixed-schedule staff are off on a public holiday (flag Holiday, paid rest day); rostered staff (nurses, ER, wards) work as scheduled on duty rosters with statutory compensation."}
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs shadow-sm leading-relaxed">
            <span className="font-bold flex items-center gap-1 mb-1">
              <span>ℹ</span>
              <span>{isUrdu ? "حذف کی ممانعت اور عدم تکرار (قواعد 748c506511 و 6b35ae8101):" : "Statutory Rules 748c506511 & 6b35ae8101 (Non-Recurring & Audit):"}</span>
            </span>
            {isUrdu
              ? "قمری عیدیں ہر سال بدلتی ہیں اس لیے تعطیلات خودکار دہرائی نہیں جاتیں۔ مستقل حذف ممنوع ہے: منسوخی کے لیے 'واپس لیں' (is_active: false) استعمال ہوتا ہے۔"
              : "Lunar Eids move every year so holidays do not recur. Hard deletion is prohibited: records are withdrawn (is_active: false) with version concurrency protection."}
          </div>
        </div>
      </div>

      {/* Banner Feedback Area */}
      {successMessage && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-sm">
          <p className="text-sm font-medium">{isUrdu ? successMessage.ur : successMessage.en}</p>
          <button
            type="button"
            data-help="holiday_calendar_admin.banner_dismiss_success"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-semibold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between shadow-sm">
          <p className="text-sm font-medium">{isUrdu ? errorMessage.ur : errorMessage.en}</p>
          <button
            type="button"
            data-help="holiday_calendar_admin.banner_dismiss_error"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 text-sm font-semibold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Year & Filter Controls */}
      <section className="px-6 pt-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-help="holiday_calendar_admin.btn_prev_year"
              onClick={handlePrevYear}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
            >
              ◀ {isUrdu ? "پچھلا سال" : "Prev Year"}
            </button>

            <select
              data-help="holiday_calendar_admin.year_select"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setDateFrom("");
                setDateTo("");
              }}
              className="px-3 py-1.5 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from({ length: 21 }, (_, i) => currentYear - 5 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-help="holiday_calendar_admin.btn_next_year"
              onClick={handleNextYear}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
            >
              {isUrdu ? "اگلا سال" : "Next Year"} ▶
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                {isUrdu ? "از:" : "From:"}
              </label>
              <input
                type="date"
                data-help="holiday_calendar_admin.filter_date_from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                {isUrdu ? "تا:" : "To:"}
              </label>
              <input
                type="date"
                data-help="holiday_calendar_admin.filter_date_to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                data-help="holiday_calendar_admin.toggle_inactive"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{isUrdu ? "منسوخ شدہ دیکھیں" : "Include Withdrawn"}</span>
            </label>

            <button
              type="button"
              data-help="holiday_calendar_admin.btn_refresh"
              onClick={fetchHolidays}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
            >
              {loading ? (isUrdu ? "لوڈ ہو رہا ہے..." : "Loading...") : (isUrdu ? "تازہ کریں" : "Refresh")}
            </button>
          </div>

          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-100 dark:bg-slate-900">
            <button
              type="button"
              data-help="holiday_calendar_admin.btn_view_months"
              onClick={() => setViewMode("months")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "months"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              {isUrdu ? "ماہانہ منظر" : "Months View"}
            </button>
            <button
              type="button"
              data-help="holiday_calendar_admin.btn_view_table"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              {isUrdu ? "ٹیبل منظر" : "Table View"}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-auto">
        {holidays.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 shadow-sm">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {isUrdu
                ? `سال ${selectedYear} کے لیے کوئی سرکاری تعطیلات درج نہیں ہیں`
                : `No public holidays registered for year ${selectedYear}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
              {isUrdu
                ? "قاعدہ 748c506511 کے تحت قمری عیدیں اور سرکاری تعطیلات خودکار نہیں دہرائی جاتیں۔ نئے سال کی تعطیلات کا اندراج کرنے کے لیے اوپر دیا گیا بٹن استعمال کریں۔"
                : "Under Rule 748c506511, lunar Eids move each year and nothing recurs automatically. Use '+ Enter Gazetted Holidays' to register the official gazette."}
            </p>
            {capability.canManage && (
              <button
                type="button"
                data-help="holiday_calendar_admin.btn_open_batch_modal"
                onClick={openBatchModal}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              >
                {isUrdu ? "+ سرکاری تعطیلات درج کریں" : "+ Enter Gazetted Holidays"}
              </button>
            )}
          </div>
        ) : viewMode === "months" ? (
          /* MONTHS CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {monthGroups.map((group) => (
              <div
                key={group.monthKey}
                className={`rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-colors ${
                  group.holidays.length > 0
                    ? "bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-900/50"
                    : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {isUrdu ? group.monthNameUr : group.monthNameEn}
                    </h4>
                    {group.holidays.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                        {group.holidays.length} {isUrdu ? "تعطیلات" : "holidays"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </div>

                  {group.holidays.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      {isUrdu ? "کوئی سرکاری چھٹی نہیں" : "No public holidays"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {group.holidays.map((h) => {
                        const isPast = isPastOrTodayHoliday(h.holiday_date, todayStr);
                        return (
                          <div
                            key={h.holiday_id}
                            className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 transition-colors ${
                              !h.is_active
                                ? "bg-slate-100 dark:bg-slate-850 border-slate-300 dark:border-slate-600 opacity-60"
                                : isPast
                                ? "bg-slate-50 dark:bg-slate-750 border-slate-200 dark:border-slate-700"
                                : "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {h.holiday_date}
                              </span>
                              {!h.is_active ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  {isUrdu ? "منسوخ" : "Withdrawn"}
                                </span>
                              ) : isPast ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  {isUrdu ? "ماضی" : "Past"}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                  {isUrdu ? "سرکاری" : "Gazetted"}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {h.name}
                            </div>
                            {h.notes && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                {h.notes}
                              </div>
                            )}

                            {/* Actions */}
                            {capability.canManage && (
                              <div className="flex items-center justify-end gap-1.5 pt-1.5 mt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                {h.is_active ? (
                                  <>
                                    <button
                                      type="button"
                                      data-help="holiday_calendar_admin.table_btn_edit"
                                      onClick={() => openEditModal(h)}
                                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    >
                                      {isUrdu ? "ترمیم" : "Edit"}
                                    </button>
                                    <button
                                      type="button"
                                      data-help="holiday_calendar_admin.table_btn_withdraw"
                                      onClick={() => setWithdrawingHoliday(h)}
                                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                                    >
                                      {isUrdu ? "واپس لیں" : "Withdraw"}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    data-help="holiday_calendar_admin.table_btn_reactivate"
                                    onClick={() => handleReactivateHoliday(h)}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                  >
                                    {isUrdu ? "دوبارہ فعال کریں" : "Reactivate"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* TABULAR LIST VIEW */
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                {isUrdu ? `سال ${selectedYear} کی سرکاری تعطیلات کی فہرست` : `Public Holidays Directory for ${selectedYear}`}
              </h3>
              <span className="text-xs text-slate-500">
                {isUrdu ? `${holidays.length} تعطیلات` : `${holidays.length} holidays total`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">{isUrdu ? "تعطیل کی تاریخ" : "Holiday Date"}</th>
                    <th className="py-3 px-4">{isUrdu ? "نام / تہوار" : "Occasion / Name"}</th>
                    <th className="py-3 px-4">{isUrdu ? "نوٹس" : "Notes"}</th>
                    <th className="py-3 px-4">{isUrdu ? "حالت" : "Status"}</th>
                    {capability.canManage && (
                      <th className="py-3 px-4 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {holidays.map((h) => {
                    const isPast = isPastOrTodayHoliday(h.holiday_date, todayStr);
                    return (
                      <tr
                        key={h.holiday_id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                          !h.is_active ? "opacity-60 bg-slate-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {h.holiday_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {h.name}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {h.notes || "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {!h.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                              {isUrdu ? "منسوخ شدہ" : "Withdrawn"}
                            </span>
                          ) : isPast ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                              {isUrdu ? "ماضی کی تعطیل" : "Past Holiday"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                              {isUrdu ? "سرکاری چھٹی" : "Active Holiday"}
                            </span>
                          )}
                        </td>
                        {capability.canManage && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {h.is_active ? (
                                <>
                                  <button
                                    type="button"
                                    data-help="holiday_calendar_admin.table_btn_edit"
                                    onClick={() => openEditModal(h)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                  >
                                    {isUrdu ? "ترمیم" : "Edit"}
                                  </button>
                                  <button
                                    type="button"
                                    data-help="holiday_calendar_admin.table_btn_withdraw"
                                    onClick={() => setWithdrawingHoliday(h)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
                                  >
                                    {isUrdu ? "واپس لیں" : "Withdraw"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  data-help="holiday_calendar_admin.table_btn_reactivate"
                                  onClick={() => handleReactivateHoliday(h)}
                                  className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
                                >
                                  {isUrdu ? "دوبارہ فعال کریں" : "Reactivate"}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* BATCH ENTRY MODAL (rule:748c506511) */}
      {showBatchModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {isUrdu
                    ? `سال ${selectedYear} کی سرکاری تعطیلات کا بیک وقت اندراج`
                    : `Enter Gazetted Holidays for Year ${selectedYear} (All or Nothing)`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isUrdu
                    ? "قاعدہ 748c506511: پورا سال ایک ساتھ درج کریں۔ تمام اندراجات ایک ہی باری میں محفوظ ہوں گے۔"
                    : "Rule 748c506511: Enter the gazetted list at once (POST /holidays is all or nothing)."}
                </p>
              </div>
              <button
                type="button"
                data-help="holiday_calendar_admin.batch_btn_cancel"
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {batchGeneralError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium">
                {batchGeneralError}
              </div>
            )}

            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-750 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {isUrdu
                  ? "معیاری قومی تعطیلات (یوم پاکستان، یوم آزادی، یوم مزدور، قائداعظم ڈے وغیرہ) خودکار بھریں:"
                  : "Quickly populate standard statutory national holidays:"}
              </span>
              <button
                type="button"
                data-help="holiday_calendar_admin.batch_btn_preload_gazetted"
                onClick={handlePreloadStandardHolidays}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                {isUrdu ? "معیاری تعطیلات لوڈ کریں" : "Preload National Holidays"}
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 sticky top-0 z-10 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-40">{isUrdu ? "تاریخ (YYYY-MM-DD)" : "Date (YYYY-MM-DD)"}</th>
                    <th className="py-2.5 px-3">{isUrdu ? "تعطیل کا نام / تہوار" : "Holiday Occasion / Name"}</th>
                    <th className="py-2.5 px-3">{isUrdu ? "نوٹس (اختیاری)" : "Notes (Optional)"}</th>
                    <th className="py-2.5 px-3 w-12 text-center">{isUrdu ? "حذف" : "Del"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {batchRows.map((row, idx) => {
                    const errors = batchRowErrors[idx] || {};
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            data-help="holiday_calendar_admin.batch_input_date"
                            value={row.holiday_date}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, holiday_date: val } : r))
                              );
                            }}
                            className={`w-full px-2 py-1 rounded border text-xs bg-white dark:bg-slate-900 ${
                              errors.holiday_date
                                ? "border-rose-500 text-rose-700"
                                : "border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100"
                            }`}
                          />
                          {errors.holiday_date && (
                            <div className="text-[10px] text-rose-600 mt-0.5">{errors.holiday_date}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            data-help="holiday_calendar_admin.batch_input_name"
                            placeholder={isUrdu ? "تعطیل کا نام..." : "Holiday name..."}
                            value={row.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, name: val } : r))
                              );
                            }}
                            className={`w-full px-2 py-1 rounded border text-xs bg-white dark:bg-slate-900 ${
                              errors.name
                                ? "border-rose-500 text-rose-700"
                                : "border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100"
                            }`}
                          />
                          {errors.name && (
                            <div className="text-[10px] text-rose-600 mt-0.5">{errors.name}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            data-help="holiday_calendar_admin.batch_input_notes"
                            placeholder={isUrdu ? "نوٹس..." : "Notes..."}
                            value={row.notes || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, notes: val } : r))
                              );
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {batchRows.length > 1 && (
                            <button
                              type="button"
                              data-help="holiday_calendar_admin.batch_btn_remove_row"
                              onClick={() => handleRemoveBatchRow(idx)}
                              className="text-rose-500 hover:text-rose-700 font-bold p-1"
                              title={isUrdu ? "قطار خارج کریں" : "Remove Row"}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                data-help="holiday_calendar_admin.batch_btn_add_row"
                onClick={handleAddBatchRow}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
              >
                + {isUrdu ? "نئی قطار شامل کریں" : "Add Another Row"}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-help="holiday_calendar_admin.batch_btn_cancel"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {isUrdu ? "منسوخ" : "Cancel"}
                </button>
                <button
                  type="button"
                  data-help="holiday_calendar_admin.batch_btn_submit"
                  onClick={handleSubmitBatch}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  {loading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving Batch...") : (isUrdu ? "تمام تعطیلات محفوظ کریں" : "Save Gazetted Holidays")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / MOVE HOLIDAY MODAL (rule:6b35ae8101) */}
      {editingHoliday && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {isUrdu ? "تعطیل میں ترمیم / تاریخ تبدیلی" : "Edit / Move Public Holiday"}
              </h3>
              <button
                type="button"
                data-help="holiday_calendar_admin.edit_btn_cancel"
                onClick={() => setEditingHoliday(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {isPastOrTodayHoliday(editingHoliday.holiday_date, todayStr) && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                <span className="font-semibold">{isUrdu ? "قاعدہ 6b35ae8101:" : "Statutory Rule 6b35ae8101:"}</span>{" "}
                {isUrdu
                  ? "آج یا ماضی کی تعطیل میں تبدیلی حاضری کو خودکار دوبارہ پروسیس کرے گی، جبکہ پہلے سے بن چکے پے رول منجمد رہیں گے۔"
                  : "Changing today or a past day recomputes its attendance; a payroll run already generated is not changed."}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "تعطیل کی تاریخ:" : "Holiday Date:"}
                </label>
                <input
                  type="date"
                  data-help="holiday_calendar_admin.edit_input_date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {editValidationErrors.holiday_date && (
                  <p className="text-xs text-rose-600 mt-1">{editValidationErrors.holiday_date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "تعطیل کا نام / تہوار:" : "Occasion / Name:"}
                </label>
                <input
                  type="text"
                  data-help="holiday_calendar_admin.edit_input_name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {editValidationErrors.name && (
                  <p className="text-xs text-rose-600 mt-1">{editValidationErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "نوٹس:" : "Notes:"}
                </label>
                <input
                  type="text"
                  data-help="holiday_calendar_admin.edit_input_notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                row_version: {editingHoliday.row_version}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                data-help="holiday_calendar_admin.edit_btn_cancel"
                onClick={() => setEditingHoliday(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="holiday_calendar_admin.edit_btn_submit"
                onClick={handleSubmitEdit}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              >
                {loading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving...") : (isUrdu ? "تبدیلی محفوظ کریں" : "Save Changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW HOLIDAY MODAL (rule:6b35ae8101) */}
      {withdrawingHoliday && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white text-rose-600 dark:text-rose-400">
                {isUrdu ? "سرکاری تعطیل کی واپسی (منسوخی)" : "Withdraw Public Holiday"}
              </h3>
              <button
                type="button"
                data-help="holiday_calendar_admin.withdraw_btn_cancel"
                onClick={() => setWithdrawingHoliday(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                {isUrdu ? (
                  <>
                    کیا آپ واقعی تعطیل <strong>{withdrawingHoliday.name}</strong> ({withdrawingHoliday.holiday_date}) کو واپس لینا چاہتے ہیں؟
                  </>
                ) : (
                  <>
                    Are you sure you want to withdraw the holiday <strong>{withdrawingHoliday.name}</strong> ({withdrawingHoliday.holiday_date})?
                  </>
                )}
              </p>

              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                <span className="font-bold">{isUrdu ? "قاعدہ 6b35ae8101:" : "Statutory Rule 6b35ae8101:"}</span>{" "}
                {isUrdu
                  ? "تعطیلات کو سسٹم سے کبھی حذف نہیں کیا جاتا۔ یہ تعطیل غیر فعال (is_active: false) ہو جائے گی۔ اگر یہ آج یا ماضی کی تاریخ ہے تو حاضری کے ریکارڈز خودکار دوبارہ پروسیس ہوں گے۔"
                  : "Never delete: entries are withdrawn with is_active false. Changing today or a past day recomputes its attendance."}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                data-help="holiday_calendar_admin.withdraw_btn_cancel"
                onClick={() => setWithdrawingHoliday(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="holiday_calendar_admin.withdraw_btn_confirm"
                onClick={handleConfirmWithdraw}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
              >
                {loading ? (isUrdu ? "کارروائی جاری ہے..." : "Withdrawing...") : (isUrdu ? "تعطیل واپس لیں" : "Confirm Withdrawal")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidayCalendarAdmin;
