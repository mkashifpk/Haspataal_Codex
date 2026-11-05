import {DirectoryPicker} from "../DirectoryPicker";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  AttendanceDayOut,
  AttendanceLogOut,
  ManualPunchIn,
  AttendanceSummaryOut,
  ShiftAssignIn,
  ShiftAssignmentOut,
  HolidayOut,
  RollCallSheetOut,
  RollCallEntryOut,
  RollCallOut,
  Present
} from "../generated/attendance";
import {
  attendance,
  punches,
  manualPunch,
  compute,
  assignShift,
  listHolidays,
  rollCallSheet,
  takeRollCall
} from "../generated/attendance";
import {
  getAttendanceCapabilityView,
  validateManualPunch,
  validateShiftAssignment,
  formatAttendanceStatusBadge,
  formatPunchSourceBadge,
  formatWorkedMinutes,
  formatLateMinutes,
  formatPunchTime,
  ISO_WEEKDAY_NAMES,
  ATTENDANCE_ERROR_MESSAGES,
  type AttendanceStatus,
  type PunchSource
} from "../attendance-policy";

export interface AttendanceProps {
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

export const Attendance: React.FC<AttendanceProps> = ({
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

  const capability = useMemo(() => {
    return getAttendanceCapabilityView(establishment, effectivePermissions);
  }, [establishment, effectivePermissions]);

  // Current Date Helper (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Tabs: timecards, shift_policy, roll_call
  const [activeTab, setActiveTab] = useState<"timecards" | "shift_policy" | "roll_call">("timecards");

  // General Loading & Feedback State
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<{ en: string; ur: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);

  // Timecards State
  const [dateFrom, setDateFrom] = useState<string>(todayStr);
  const [dateTo, setDateTo] = useState<string>(todayStr);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [timecardsList, setTimecardsList] = useState<AttendanceDayOut[]>([]);

  // Recompute State
  const [computeDate, setComputeDate] = useState<string>(todayStr);
  const [isComputing, setIsComputing] = useState<boolean>(false);

  // Raw Punches Drawer State
  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceDayOut | null>(null);
  const [dayPunches, setDayPunches] = useState<AttendanceLogOut[]>([]);
  const [loadingPunches, setLoadingPunches] = useState<boolean>(false);

  // Manual Punch Modal State
  const [showManualPunchModal, setShowManualPunchModal] = useState<boolean>(false);
  const [punchEmployeeId, setPunchEmployeeId] = useState<number>(0);
  const [punchEmployeeName, setPunchEmployeeName] = useState<string>("");
  const [punchTime, setPunchTime] = useState<string>("");
  const [punchDutyDate, setPunchDutyDate] = useState<string>("");
  const [punchReason, setPunchReason] = useState<string>("");
  const [punchValidationErrors, setPunchValidationErrors] = useState<Record<string, string>>({});

  // Shift Assignment Modal State
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [shiftEmployeeId, setShiftEmployeeId] = useState<number>(0);
  const [shiftEmployeeName, setShiftEmployeeName] = useState<string>("");
  const [shiftMode, setShiftMode] = useState<"fixed" | "roster">("fixed");
  const [shiftPatternId, setShiftPatternId] = useState<number>(1);
  const [shiftEffectiveFrom, setShiftEffectiveFrom] = useState<string>(todayStr);
  const [shiftWeeklyOffDays, setShiftWeeklyOffDays] = useState<number[]>([7]); // Default Sunday off
  const [shiftValidationErrors, setShiftValidationErrors] = useState<Record<string, string>>({});

  // Roll Call & Holidays State
  const [rollCallDate, setRollCallDate] = useState<string>(todayStr);
  const [rollCallSheetData, setRollCallSheetData] = useState<RollCallSheetOut | null>(null);
  const [selectedRollCallIds, setSelectedRollCallIds] = useState<number[]>([]);
  const [holidaysList, setHolidaysList] = useState<HolidayOut[]>([]);

  // Map API Errors
  const handleError = useCallback((err: any) => {
    console.error("Attendance error:", err);
    const code = err?.code || (err?.status === 403 ? "FORBIDDEN" : "NETWORK_ERROR");
    const mapped = ATTENDANCE_ERROR_MESSAGES[code] || {
      en: err?.message || "An unexpected system error occurred.",
      ur: "ایک غیر متوقع خرابی پیش آئی ہے۔"
    };
    setErrorMessage(mapped);
  }, []);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Fetch Timecards
  const fetchTimecards = useCallback(async () => {
    if (!capability.canView) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await attendance({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      });
      setTimecardsList(res || []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, capability.canView, handleError]);

  // Fetch Raw Punches for employee on specific date
  const openPunchesDrawer = useCallback(async (record: AttendanceDayOut) => {
    setSelectedDayRecord(record);
    setLoadingPunches(true);
    setDayPunches([]);
    try {
      const res = await punches({
        employee_id: record.employee_id,
        day: record.attendance_date
      });
      setDayPunches(res || []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingPunches(false);
    }
  }, [handleError]);

  // Close Punches Drawer
  const closePunchesDrawer = () => {
    setSelectedDayRecord(null);
    setDayPunches([]);
  };

  // Trigger Recomputation (POST /hr/attendance/compute)
  const handleTriggerCompute = async () => {
    if (!capability.canCompute || !computeDate) return;
    setIsComputing(true);
    clearMessages();
    try {
      const summaries = await compute({ day: computeDate });
      setSuccessMessage({
        en: `Attendance computed successfully for ${computeDate} (${summaries.length} staff timecard records updated).`,
        ur: `${computeDate} کے لیے حاضری کامیابی سے پروسیس ہو گئی (${summaries.length} ملازمین کے کارڈز اپ ڈیٹ ہوئے)۔`
      });
      fetchTimecards();
    } catch (err) {
      handleError(err);
    } finally {
      setIsComputing(false);
    }
  };

  // Open Manual Punch Modal
  const openManualPunchModal = (empId?: number, empName?: string, date?: string) => {
    clearMessages();
    setPunchEmployeeId(empId || 0);
    setPunchEmployeeName(empName || "");
    const now = new Date();
    // default to local ISO format for datetime-local
    const pad = (n: number) => (n < 10 ? "0" + n : n);
    const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setPunchTime(localIso);
    setPunchDutyDate(date || todayStr);
    setPunchReason("");
    setPunchValidationErrors({});
    setShowManualPunchModal(true);
  };

  // Submit Manual Punch Correction (POST /hr/attendance/manual)
  const handleSubmitManualPunch = async () => {
    clearMessages();
    const payload: ManualPunchIn = {
      employee_id: Number(punchEmployeeId),
      punch_time: punchTime,
      reason: punchReason.trim(),
      attendance_date: punchDutyDate.trim() ? punchDutyDate.trim() : undefined
    };

    const val = validateManualPunch(payload);
    if (!val.valid) {
      setPunchValidationErrors(val.errors);
      return;
    }

    setLoading(true);
    try {
      const result = await manualPunch(payload);
      setSuccessMessage({
        en: `Manual punch correction recorded (Log #${result.attendance_log_id}) for employee #${result.employee_id} on duty date ${result.attendance_date}.`,
        ur: `دستی پنچ تصحیح کامیابی سے محفوظ ہو گئی (لاگ #${result.attendance_log_id}) ملازم #${result.employee_id} برائے تاریخ ${result.attendance_date}۔`
      });
      setShowManualPunchModal(false);
      fetchTimecards();
      if (selectedDayRecord && selectedDayRecord.employee_id === result.employee_id) {
        openPunchesDrawer(selectedDayRecord);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Open Shift Assignment Modal
  const openShiftModal = (empId?: number, empName?: string) => {
    clearMessages();
    setShiftEmployeeId(empId || 0);
    setShiftEmployeeName(empName || "");
    setShiftMode("fixed");
    setShiftPatternId(1);
    setShiftEffectiveFrom(todayStr);
    setShiftWeeklyOffDays([7]); // Default Sunday
    setShiftValidationErrors({});
    setShowShiftModal(true);
  };

  // Toggle Weekly Off Day Selection
  const toggleWeeklyOffDay = (day: number) => {
    setShiftWeeklyOffDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort();
      }
    });
  };

  // Submit Shift Assignment (POST /hr/employees/{employee_id}/shift)
  const handleSubmitShiftAssignment = async () => {
    clearMessages();
    const isRosterOnly = shiftMode === "roster";
    const payload: ShiftAssignIn = {
      shift_pattern_id: isRosterOnly ? null : Number(shiftPatternId),
      effective_from: shiftEffectiveFrom,
      weekly_off_days: isRosterOnly ? null : shiftWeeklyOffDays
    };

    const val = validateShiftAssignment({
      employee_id: Number(shiftEmployeeId),
      shift_pattern_id: payload.shift_pattern_id,
      effective_from: payload.effective_from,
      weekly_off_days: payload.weekly_off_days
    });

    if (!val.valid) {
      setShiftValidationErrors(val.errors);
      return;
    }

    setLoading(true);
    try {
      const res = await assignShift(Number(shiftEmployeeId), payload);
      setSuccessMessage({
        en: isRosterOnly
          ? `Employee #${res.employee_id} set to Roster-Only (no default shift; rest days determined by duty roster).`
          : `Default shift pattern #${res.shift_pattern_id} assigned to employee #${res.employee_id} effective from ${res.effective_from}.`,
        ur: isRosterOnly
          ? `ملازم #${res.employee_id} کو صرف روسٹر پر مقرر کیا گیا (بغیر ڈیفالٹ شفٹ؛ آرام کے دن روسٹر سے طے ہوں گے)۔`
          : `ملازم #${res.employee_id} کو ڈیفالٹ شفٹ #${res.shift_pattern_id} تفویض کر دی گئی بمطابق ${res.effective_from}۔`
      });
      setShowShiftModal(false);
      fetchTimecards();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Roll Call Sheet & Gazetted Holidays
  const fetchRollCallAndHolidays = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const [rcRes, holRes] = await Promise.all([
        capability.canRollCall ? rollCallSheet({ roster_date: rollCallDate }) : Promise.resolve(null),
        listHolidays({ date_from: rollCallDate })
      ]);
      if (rcRes) setRollCallSheetData(rcRes);
      if (holRes) setHolidaysList(holRes);
      setSelectedRollCallIds([]);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [rollCallDate, capability.canRollCall, handleError]);

  // Batch Mark Present via Roll Call (POST /rosters/roll-call)
  const handleMarkRollCall = async () => {
    if (!capability.canRollCall || selectedRollCallIds.length === 0) return;
    setLoading(true);
    clearMessages();
    try {
      const presentList: Present[] = selectedRollCallIds.map((id) => ({
        employee_id: id
      }));
      const res: RollCallOut = await takeRollCall({
        roster_date: rollCallDate,
        present: presentList
      });
      const recordedCount = res.recorded?.length || 0;
      const skippedCount = res.skipped?.length || 0;
      setSuccessMessage({
        en: `Roll call attendance submitted: ${recordedCount} staff marked present, ${skippedCount} already punched in.`,
        ur: `رول کال حاضری مکمل: ${recordedCount} عملے کی حاضری لگائی گئی، ${skippedCount} پہلے سے حاضر تھے۔`
      });
      fetchRollCallAndHolidays();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for all pending roll call entries
  const toggleSelectAllRollCall = () => {
    if (!rollCallSheetData?.entries) return;
    const pendingStaff = rollCallSheetData.entries.filter((e) => !e.first_in);
    if (selectedRollCallIds.length === pendingStaff.length) {
      setSelectedRollCallIds([]);
    } else {
      setSelectedRollCallIds(pendingStaff.map((e) => e.employee_id));
    }
  };

  // Print Physical Roll Call Sheet
  const handlePrintRollCallSheet = () => {
    window.print();
  };

  // Initial & Tab-Triggered Load
  useEffect(() => {
    if (activeTab === "timecards" || activeTab === "shift_policy") {
      fetchTimecards();
    } else if (activeTab === "roll_call") {
      fetchRollCallAndHolidays();
    }
  }, [activeTab, fetchTimecards, fetchRollCallAndHolidays]);

  // Realtime Event Listener (ev:attendance.flagged)
  useEffect(() => {
    const handleAttendanceFlagged = () => {
      if (activeTab === "timecards" || activeTab === "shift_policy") {
        fetchTimecards();
      }
    };
    window.addEventListener("ev:attendance.flagged", handleAttendanceFlagged);
    return () => {
      window.removeEventListener("ev:attendance.flagged", handleAttendanceFlagged);
    };
  }, [activeTab, fetchTimecards]);

  // Filtered Timecards List
  const filteredTimecards = useMemo(() => {
    return timecardsList.filter((item) => {
      if (departmentFilter.trim() && item.department_name) {
        if (!item.department_name.toLowerCase().includes(departmentFilter.trim().toLowerCase())) {
          return false;
        }
      }
      if (employeeSearch.trim()) {
        const query = employeeSearch.trim().toLowerCase();
        const matchesName = item.full_name?.toLowerCase().includes(query);
        const matchesNum = item.emp_number?.toLowerCase().includes(query);
        if (!matchesName && !matchesNum) return false;
      }
      return true;
    });
  }, [timecardsList, departmentFilter, employeeSearch]);

  // Distinct Staff for Policy Tab
  const distinctStaff = useMemo(() => {
    const map = new Map<number, AttendanceDayOut>();
    for (const item of timecardsList) {
      if (!map.has(item.employee_id)) {
        map.set(item.employee_id, item);
      }
    }
    return Array.from(map.values());
  }, [timecardsList]);

  // Render Access Denied if hidden
  if (capability.mode === "hidden") {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center" dir={isUrdu ? "rtl" : "ltr"}>
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">
            {isUrdu ? "حاضری ماڈیول تک رسائی محدود ہے" : "Attendance Access Restricted"}
          </h2>
          <p className="text-amber-700 dark:text-amber-300">
            {capability.reason || (isUrdu ? "آپ کے پاس اس اسکرین تک رسائی کی اجازت نہیں ہے۔" : "You do not have permission to access the attendance screen.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-screen flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-screen" dir={isUrdu ? "rtl" : "ltr"}>
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isUrdu ? "عملے کی حاضری، پنچز اور ٹائم کارڈز" : "Staff Attendance, Punches & Timecards"}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {isUrdu ? "ایچ آر حاضری" : "HR Attendance"}
            </span>
            {capability.canCorrect && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800">
                {isUrdu ? "دستی تصحیح فعال" : "Correction Authority"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isUrdu
              ? "آر ایف آئی ڈی بیجز، رول کال اور دستی تصحیحات سے روزانہ حاضر/دیر/غیر حاضر کے جھنڈے اور شیڈول کے مطابق ٹائم کارڈز۔"
              : "Daily Present/Late/Absent flags and timecards computed against rostered shifts from RFID badges, roll calls, and manual corrections."}
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {capability.canCorrect && (
            <button
              type="button"
              data-help="attendance.btn_open_manual_punch"
              onClick={() => openManualPunchModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
            >
              <span>+</span>
              <span>{isUrdu ? "دستی پنچ تصحیح" : "+ Manual Punch Correction"}</span>
            </button>
          )}

          {capability.canManageShift && (
            <button
              type="button"
              data-help="attendance.btn_open_shift_modal"
              onClick={() => openShiftModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm transition-colors"
            >
              <span>{isUrdu ? "شفٹ تفویض" : "Assign Default Shift"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 px-6 flex gap-1">
        <button
          type="button"
          data-help="attendance.tab_timecards"
          onClick={() => setActiveTab("timecards")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "timecards"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {isUrdu ? "روزانہ ٹائم کارڈز اور پنچ لاگز" : "Daily Timecards & Punches"}
        </button>
        <button
          type="button"
          data-help="attendance.tab_shift_policy"
          onClick={() => setActiveTab("shift_policy")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shift_policy"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {isUrdu ? "ڈیفالٹ شفٹ اور روسٹر پالیسی" : "Default Shift & Roster Policy"}
        </button>
        <button
          type="button"
          data-help="attendance.tab_roll_call"
          onClick={() => setActiveTab("roll_call")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roll_call"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {isUrdu ? "لائیو رول کال اور سرکاری تعطیلات" : "Live Roll Call & Holidays"}
        </button>
      </nav>

      {/* Banner Feedback Area */}
      {successMessage && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-sm">
          <p className="text-sm font-medium">{isUrdu ? successMessage.ur : successMessage.en}</p>
          <button
            type="button"
            data-help="attendance.banner_dismiss_success"
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
            data-help="attendance.banner_dismiss_error"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 text-sm font-semibold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-auto">
        {/* TAB 1: TIMECARDS & PUNCHES */}
        {activeTab === "timecards" && (
          <div className="space-y-6">
            {/* Filter Bar & Recompute Controls */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    {isUrdu ? "از تاریخ:" : "From:"}
                  </label>
                  <input
                    type="date"
                    data-help="attendance.filter_date_from"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    {isUrdu ? "تا تاریخ:" : "To:"}
                  </label>
                  <input
                    type="date"
                    data-help="attendance.filter_date_to"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-help="attendance.filter_department"
                    placeholder={isUrdu ? "شعبہ سے فلٹر..." : "Filter by department..."}
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-help="attendance.filter_employee"
                    placeholder={isUrdu ? "ملازم کا نام یا نمبر..." : "Search employee..."}
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  data-help="attendance.btn_refresh"
                  onClick={fetchTimecards}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
                >
                  {loading ? (isUrdu ? "لوڈ ہو رہا ہے..." : "Refreshing...") : (isUrdu ? "تازہ کریں" : "Refresh")}
                </button>
              </div>

              {/* Recompute Daily Flags (POST /hr/attendance/compute?day=...) */}
              {capability.canCompute && (
                <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 sm:pl-4 pt-3 sm:pt-0">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    {isUrdu ? "تاریخ پروسیسنگ:" : "Compute Day:"}
                  </label>
                  <input
                    type="date"
                    data-help="attendance.compute_date"
                    value={computeDate}
                    onChange={(e) => setComputeDate(e.target.value)}
                    className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    data-help="attendance.btn_compute"
                    onClick={handleTriggerCompute}
                    disabled={isComputing}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors"
                  >
                    {isComputing ? (isUrdu ? "پروسیس ہو رہا ہے..." : "Computing...") : (isUrdu ? "(دوبارہ) پروسیس کریں" : "(Re)compute")}
                  </button>
                </div>
              )}
            </div>

            {/* Timecards Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  {isUrdu ? "حاضری ٹائم کارڈز ریکارڈ" : "Attendance Timecards"}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isUrdu ? `${filteredTimecards.length} ریکارڈز دکھائے جا رہے ہیں` : `Showing ${filteredTimecards.length} records`}
                </span>
              </div>

              {filteredTimecards.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-sm">
                    {isUrdu
                      ? "منتخب کردہ تاریخوں یا فلٹرز کے لیے کوئی حاضری ریکارڈ نہیں ملا۔ نیا ریکارڈ پروسیس کرنے کے لیے اوپر دیا گیا ری کمپیوٹ کا بٹن دبائیں۔"
                      : "No attendance timecards found for the selected period or filters. Use the '(Re)compute' button above to generate daily flags."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">{isUrdu ? "ڈیوٹی تاریخ" : "Duty Date"}</th>
                        <th className="py-3 px-4">{isUrdu ? "ملازم" : "Employee"}</th>
                        <th className="py-3 px-4">{isUrdu ? "شعبہ" : "Department"}</th>
                        <th className="py-3 px-4">{isUrdu ? "حاضری حالت" : "Status"}</th>
                        <th className="py-3 px-4">{isUrdu ? "پہلا پنچ (آمد)" : "First In"}</th>
                        <th className="py-3 px-4">{isUrdu ? "آخری پنچ (روانگی)" : "Last Out"}</th>
                        <th className="py-3 px-4">{isUrdu ? "ڈیوٹی دورانیہ" : "Worked Time"}</th>
                        <th className="py-3 px-4">{isUrdu ? "تاخیر" : "Late"}</th>
                        <th className="py-3 px-4 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredTimecards.map((item) => {
                        const statusBadge = formatAttendanceStatusBadge(item.status);
                        return (
                          <tr
                            key={`${item.employee_id}-${item.attendance_date}`}
                            className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {item.attendance_date}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {item.full_name}
                              </div>
                              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                {item.emp_number}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                              {item.department_name || "—"}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                title={isUrdu ? statusBadge.descriptionUr : statusBadge.descriptionEn}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.border} ${statusBadge.text}`}
                              >
                                {isUrdu ? statusBadge.labelUr : statusBadge.labelEn}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {formatPunchTime(item.first_punch)}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {formatPunchTime(item.last_punch)}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {formatWorkedMinutes(item.worked_minutes)}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              {formatLateMinutes(item.late_minutes)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  data-help="attendance.table_btn_punches"
                                  onClick={() => openPunchesDrawer(item)}
                                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
                                >
                                  {isUrdu ? "پنچز دیکھیں" : "View Punches"}
                                </button>
                                {capability.canCorrect && (
                                  <button
                                    type="button"
                                    data-help="attendance.table_btn_manual"
                                    onClick={() => openManualPunchModal(item.employee_id, item.full_name, item.attendance_date)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                  >
                                    {isUrdu ? "+ پنچ" : "+ Punch"}
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

        {/* TAB 2: SHIFT & ROSTER POLICY */}
        {activeTab === "shift_policy" && (
          <div className="space-y-6">
            {/* Statutory Guidance Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 shadow-sm">
                <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <span>ℹ</span>
                  <span>{isUrdu ? "روسٹر کے مطابق عملہ (قاعدہ edc1438113)" : "Roster-Only Staff Policy (Rule edc1438113)"}</span>
                </div>
                <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                  {isUrdu
                    ? "وہ عملہ جن کی ڈیوٹیاں ہر ہفتے روسٹر پر طے ہوتی ہیں ان کی کوئی مستقل ڈیفالٹ شفٹ نہیں ہونی چاہیے (shift_pattern_id: null)؛ بصورت دیگر ان کے غیر ڈیوٹی والے دن غیر حاضر ظاہر ہوں گے۔"
                    : "Staff planned on the duty roster should have NO default shift (shift_pattern_id: null); otherwise their scheduled rest days will falsely show as Absent."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-sm">
                <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <span>ℹ</span>
                  <span>{isUrdu ? "بامعاوضہ آرام کے دن (قاعدہ e3a5ef53f8)" : "Paid Rest Days & Weekly Off (Rule e3a5ef53f8)"}</span>
                </div>
                <p className="text-xs text-purple-800 dark:text-purple-300 leading-relaxed">
                  {isUrdu
                    ? "سرکاری تعطیلات (Holiday) اور ہفتہ وار چھٹی (Off) بامعاوضہ آرام کے دن ہیں۔ ہر ملازم کی ہفتہ وار چھٹیاں الگ ہوتی ہیں (ہسپتال کا کوئی مشترکہ بند دن نہیں ہے)۔ ڈیفالٹ شفٹ لگاتے وقت weekly_off_days کا انتخاب لازمی ہے۔"
                    : "Holiday and Off are paid rest days: a gazetted public holiday, or a weekly day off of the person's default shift. A hospital never closes, so each person has their own weekly off days. A default shift must be assigned with its weekly_off_days."}
                </p>
              </div>
            </div>

            {/* Staff Shift Configuration Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {isUrdu ? "ملازمین کی ڈیفالٹ شفٹ پالیسی اور تفویض" : "Staff Default Shift Assignment Directory"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isUrdu
                      ? "ہر ملازم کے لیے مستقل شفٹ اور ہفتہ وار آرام کے دن منتخب کریں، یا روسٹر ڈرائیون موڈ تفویض کریں۔"
                      : "Configure fixed default shifts with individual weekly off days, or assign roster-only status."}
                  </p>
                </div>
                {capability.canManageShift && (
                  <button
                    type="button"
                    data-help="attendance.btn_open_shift_modal"
                    onClick={() => openShiftModal()}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                  >
                    {isUrdu ? "+ نئی شفٹ تفویض کریں" : "+ Assign Default Shift"}
                  </button>
                )}
              </div>

              {distinctStaff.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-sm">
                    {isUrdu
                      ? "کوئی ملازمین کا ریکارڈ نہیں ملا۔ ٹائم کارڈز کا ڈیٹا لوڈ ہونے کے بعد یہاں فہرست دکھائی دے گی۔"
                      : "No employee records found. Once attendance data is loaded, staff configuration will appear here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">{isUrdu ? "ملازم نمبر" : "Emp Number"}</th>
                        <th className="py-3 px-4">{isUrdu ? "مکمل نام" : "Full Name"}</th>
                        <th className="py-3 px-4">{isUrdu ? "شعبہ" : "Department"}</th>
                        <th className="py-3 px-4">{isUrdu ? "پالیسی کی قسم" : "Policy Mode"}</th>
                        <th className="py-3 px-4 text-right">{isUrdu ? "کارروائی" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {distinctStaff.map((staff) => (
                        <tr
                          key={staff.employee_id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {staff.emp_number}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                            {staff.full_name}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {staff.department_name || "—"}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                              {isUrdu ? "روسٹر / شفٹ تفویض شدہ" : "Roster / Shift Assigned"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {capability.canManageShift && (
                              <button
                                type="button"
                                data-help="attendance.shift_modal_emp"
                                onClick={() => openShiftModal(staff.employee_id, staff.full_name)}
                                className="px-3 py-1 text-xs font-medium rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                              >
                                {isUrdu ? "شفٹ تبدیل کریں" : "Update Shift"}
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

        {/* TAB 3: ROLL CALL & HOLIDAYS */}
        {activeTab === "roll_call" && (
          <div className="space-y-6">
            {/* Top Controls for Roll Call */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    {isUrdu ? "روسٹر تاریخ:" : "Roster Date:"}
                  </label>
                  <input
                    type="date"
                    data-help="attendance.roll_call_date"
                    value={rollCallDate}
                    onChange={(e) => setRollCallDate(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  data-help="attendance.btn_refresh_roll_call"
                  onClick={fetchRollCallAndHolidays}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors"
                >
                  {loading ? (isUrdu ? "لوڈ ہو رہا ہے..." : "Loading...") : (isUrdu ? "تازہ کریں" : "Refresh Sheet")}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-help="attendance.btn_print_roll_call"
                  onClick={handlePrintRollCallSheet}
                  className="px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm transition-colors"
                >
                  {isUrdu ? "پرنٹ رول کال شیٹ" : "Print Roll Call Sheet"}
                </button>
                {capability.canRollCall && (
                  <button
                    type="button"
                    data-help="attendance.btn_mark_roll_call"
                    onClick={handleMarkRollCall}
                    disabled={selectedRollCallIds.length === 0 || loading}
                    className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {isUrdu
                      ? `منتخب شدہ کی حاضری لگائیں (${selectedRollCallIds.length})`
                      : `Mark Present (${selectedRollCallIds.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Roll Call Sheet Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {isUrdu ? "آج کا رول کال شیٹ" : "Today's Roll Call Attendance"}
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {rollCallSheetData?.roster_date || rollCallDate}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      data-help="attendance.roll_call_select_all"
                      onChange={toggleSelectAllRollCall}
                      checked={
                        Boolean(rollCallSheetData?.entries?.length) &&
                        selectedRollCallIds.length ===
                          rollCallSheetData!.entries.filter((e) => !e.first_in).length &&
                        selectedRollCallIds.length > 0
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{isUrdu ? "تمام غیر حاضر منتخب کریں" : "Select all unpunched"}</span>
                  </label>
                </div>
              </div>

              {!rollCallSheetData?.entries || rollCallSheetData.entries.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-sm">
                    {isUrdu
                      ? "اس تاریخ کے لیے کوئی ڈیوٹی روسٹر شیڈول موجود نہیں ہے۔"
                      : "No scheduled staff found on the duty roster for this date."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4 w-10 text-center">{isUrdu ? "انتخاب" : "Select"}</th>
                        <th className="py-3 px-4">{isUrdu ? "ملازم" : "Employee"}</th>
                        <th className="py-3 px-4">{isUrdu ? "عہدہ اور زمرہ" : "Designation / Category"}</th>
                        <th className="py-3 px-4">{isUrdu ? "شفٹ" : "Shift"}</th>
                        <th className="py-3 px-4">{isUrdu ? "ڈیوٹی کا مقام" : "Duty Location"}</th>
                        <th className="py-3 px-4">{isUrdu ? "آمد کی کیفیت" : "Arrival Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {rollCallSheetData.entries.map((entry) => {
                        const hasArrived = Boolean(entry.first_in);
                        const sourceInfo = entry.first_source ? formatPunchSourceBadge(entry.first_source) : null;
                        const isChecked = selectedRollCallIds.includes(entry.employee_id);

                        return (
                          <tr
                            key={entry.roster_id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                              hasArrived ? "bg-emerald-50/30 dark:bg-emerald-950/20" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              {!hasArrived && capability.canRollCall ? (
                                <input
                                  type="checkbox"
                                  data-help="attendance.roll_call_check_emp"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedRollCallIds((prev) =>
                                      isChecked ? prev.filter((id) => id !== entry.employee_id) : [...prev, entry.employee_id]
                                    );
                                  }}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {entry.full_name}
                              </div>
                              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                {entry.emp_number}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <div>{entry.designation}</div>
                              <div className="text-slate-400 dark:text-slate-500">{entry.staff_category}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300">
                                {entry.shift_name}
                              </span>
                              <div className="text-xs font-mono text-slate-500">
                                {entry.start_time} – {entry.end_time}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {entry.ward_name || entry.department_name || entry.duty_area || "—"}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {hasArrived ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    {isUrdu ? "حاضر" : "Arrived"}: {formatPunchTime(entry.first_in)}
                                  </span>
                                  {sourceInfo && (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${sourceInfo.badgeClass}`}
                                    >
                                      {isUrdu ? sourceInfo.labelUr : sourceInfo.labelEn}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {isUrdu ? "ابھی تک نہیں پہنچے" : "Not Arrived"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gazetted Public Holidays Directory */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {isUrdu ? "سرکاری و قومی تعطیلات (بامعاوضہ آرام کے دن)" : "Gazetted Public Holidays (Paid Rest Days)"}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                    {isUrdu ? "قاعدہ e3a5ef53f8" : "Rule e3a5ef53f8"}
                  </span>
                </div>
              </div>

              {holidaysList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="text-sm">
                    {isUrdu ? "کوئی آئندہ سرکاری تعطیلات درج نہیں ہیں۔" : "No upcoming public holidays listed."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse" dir={isUrdu ? "rtl" : "ltr"}>
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">{isUrdu ? "تعطیل کی تاریخ" : "Holiday Date"}</th>
                        <th className="py-3 px-4">{isUrdu ? "نام / تہوار" : "Occasion / Name"}</th>
                        <th className="py-3 px-4">{isUrdu ? "نوٹس" : "Notes"}</th>
                        <th className="py-3 px-4">{isUrdu ? "حالت" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {holidaysList.map((h) => (
                        <tr key={h.holiday_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                            {h.holiday_date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {h.name}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {h.notes || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {isUrdu ? "سرکاری چھٹی" : "Paid Holiday"}
                            </span>
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
      </main>

      {/* RAW PUNCHES DRAWER / MODAL */}
      {selectedDayRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700 animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {isUrdu ? "خام پنچ لاگز کی تفصیل" : "Raw Punches Timeline"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedDayRecord.full_name} ({selectedDayRecord.emp_number}) — {selectedDayRecord.attendance_date}
                </p>
              </div>
              <button
                type="button"
                data-help="attendance.drawer_punches_close"
                onClick={closePunchesDrawer}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Night shift explanation notice (rule:57ff2b4a55) */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              <span className="font-semibold">{isUrdu ? "قاعدہ 57ff2b4a55:" : "Duty Date Grouping Rule (57ff2b4a55):"}</span>{" "}
              {isUrdu
                ? "پنچز ڈیوٹی تاریخ کے تحت گروپ ہوتے ہیں: نائٹ شفٹ سے صبح کی روانگی اسی شام کے تحت درج ہوگی جب شفٹ شروع ہوئی تھی۔"
                : "Punches are grouped by duty date: a night shift's morning exit is listed under the evening it started."}
            </div>

            {/* Drawer Body: Punch List */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {loadingPunches ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {isUrdu ? "پنچز لوڈ ہو رہے ہیں..." : "Loading raw punches..."}
                </div>
              ) : dayPunches.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                  {isUrdu ? "اس تاریخ کے لیے کوئی پنچز لاگ نہیں ملے۔" : "No raw punches found for this date."}
                </div>
              ) : (
                <div className="space-y-3">
                  {dayPunches.map((punch) => {
                    const sourceInfo = formatPunchSourceBadge(punch.source);
                    return (
                      <div
                        key={punch.attendance_log_id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-750 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded ${
                                punch.punch_type === "In"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}
                            >
                              {punch.punch_type}
                            </span>
                            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {formatPunchTime(punch.punch_time)}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded border ${sourceInfo.badgeClass}`}
                          >
                            {isUrdu ? sourceInfo.labelUr : sourceInfo.labelEn}
                          </span>
                        </div>

                        {/* Audit Details */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {punch.badge_code && (
                            <span>{isUrdu ? "بیج کوڈ:" : "Badge:"} {punch.badge_code}</span>
                          )}
                          {punch.station_id && (
                            <span>{isUrdu ? "اسٹیشن:" : "Station:"} {punch.station_id}</span>
                          )}
                          <span>{isUrdu ? "ڈیوٹی تاریخ:" : "Duty Date:"} {punch.attendance_date}</span>
                        </div>

                        {/* Mandatory reason for manual corrections (rule:7e57360f0f) */}
                        {punch.source === "Manual" && punch.manual_reason && (
                          <div className="mt-1 p-2 rounded bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-800 text-xs text-fuchsia-800 dark:text-fuchsia-300">
                            <span className="font-semibold">{isUrdu ? "تصحیح کی وجہ (آڈٹ):" : "Mandatory Audit Reason:"}</span>{" "}
                            {punch.manual_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
              {capability.canCorrect ? (
                <button
                  type="button"
                  data-help="attendance.drawer_btn_add_manual"
                  onClick={() => openManualPunchModal(selectedDayRecord.employee_id, selectedDayRecord.full_name, selectedDayRecord.attendance_date)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  {isUrdu ? "+ اس ملازم کا دستی پنچ شامل کریں" : "+ Add Manual Punch"}
                </button>
              ) : <div />}
              <button
                type="button"
                data-help="attendance.drawer_punches_close"
                onClick={closePunchesDrawer}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                {isUrdu ? "بند کریں" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PUNCH MODAL */}
      {showManualPunchModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isUrdu ? "دستی پنچ تصحیح (آڈٹ شدہ)" : "Manual Punch Correction (Audited)"}
              </h3>
              <button
                type="button"
                data-help="attendance.modal_punch_cancel"
                onClick={() => setShowManualPunchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Employee ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "ملازم آئی ڈی / نمبر:" : "Employee ID:"}
                </label>
                {punchEmployeeName ? (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                    {punchEmployeeName} (#{punchEmployeeId})
                  </div>
                ) : (
                  <DirectoryPicker
                    data-help="attendance.modal_punch_emp"
                    value={punchEmployeeId || ""}
                    onChange={(e) => setPunchEmployeeId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   path="/staff/lookup" idField="employee_id" search />
                )}
                {punchValidationErrors.employee_id && (
                  <p className="text-xs text-rose-600 mt-1">{punchValidationErrors.employee_id}</p>
                )}
              </div>

              {/* Punch Timestamp */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "پنچ کا وقت:" : "Punch Timestamp (Local Time):"}
                </label>
                <input
                  type="datetime-local"
                  data-help="attendance.modal_punch_time"
                  value={punchTime}
                  onChange={(e) => setPunchTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {punchValidationErrors.punch_time && (
                  <p className="text-xs text-rose-600 mt-1">{punchValidationErrors.punch_time}</p>
                )}
              </div>

              {/* Duty Date Override (rule:57ff2b4a55) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "ڈیوٹی تاریخ (اختیاری):" : "Duty Date Override (Optional):"}
                </label>
                <input
                  type="date"
                  data-help="attendance.modal_punch_date"
                  value={punchDutyDate}
                  onChange={(e) => setPunchDutyDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {isUrdu
                    ? "رات کی شفٹ کے بعد صبح کی روانگی پچھلی شام کے ڈیوٹی دن کے تحت درج ہوتی ہے۔ اگر خودکار تاریخ درست نہ ہو تو یہاں تاریخ درج کریں۔"
                    : "Punches are grouped by duty date (rule:57ff2b4a55). Only specify if the automatic shift boundary attribution is incorrect."}
                </p>
                {punchValidationErrors.attendance_date && (
                  <p className="text-xs text-rose-600 mt-1">{punchValidationErrors.attendance_date}</p>
                )}
              </div>

              {/* Mandatory Reason (rule:7e57360f0f) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "تصحیح کی لازمی وجہ (آڈٹ کے لیے):" : "Mandatory Correction Reason (Audited):"}
                </label>
                <textarea
                  rows={3}
                  data-help="attendance.modal_punch_reason"
                  placeholder={
                    isUrdu
                      ? "مثلاً: ملازم کا آر ایف آئی ڈی بیج عارضی خراب تھا، سپروائزر نے دستی تصدیق کی..."
                      : "e.g., RFID reader offline at North Gate; supervisor confirmed physical presence..."
                  }
                  value={punchReason}
                  onChange={(e) => setPunchReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {punchValidationErrors.reason && (
                  <p className="text-xs text-rose-600 mt-1">{punchValidationErrors.reason}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                data-help="attendance.modal_punch_cancel"
                onClick={() => setShowManualPunchModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="attendance.modal_punch_submit"
                onClick={handleSubmitManualPunch}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              >
                {loading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving...") : (isUrdu ? "پنچ محفوظ کریں" : "Save Manual Punch")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT ASSIGNMENT MODAL */}
      {showShiftModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isUrdu ? "ڈیفالٹ شفٹ اور ہفتہ وار آرام کے دن" : "Assign Default Shift & Weekly Off Days"}
              </h3>
              <button
                type="button"
                data-help="attendance.shift_modal_cancel"
                onClick={() => setShowShiftModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "ملازم آئی ڈی:" : "Employee ID:"}
                </label>
                {shiftEmployeeName ? (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                    {shiftEmployeeName} (#{shiftEmployeeId})
                  </div>
                ) : (
                  <DirectoryPicker
                    data-help="attendance.shift_modal_emp"
                    value={shiftEmployeeId || ""}
                    onChange={(e) => setShiftEmployeeId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   path="/staff/lookup" idField="employee_id" search />
                )}
                {shiftValidationErrors.employee_id && (
                  <p className="text-xs text-rose-600 mt-1">{shiftValidationErrors.employee_id}</p>
                )}
              </div>

              {/* Mode Toggle: Fixed vs Roster */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "پالیسی کا طریقہ:" : "Shift Mode Policy:"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-help="attendance.shift_modal_mode_fixed"
                    onClick={() => setShiftMode("fixed")}
                    className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      shiftMode === "fixed"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isUrdu ? "مستقل ڈیفالٹ شفٹ" : "Fixed Default Shift"}
                  </button>
                  <button
                    type="button"
                    data-help="attendance.shift_modal_mode_roster"
                    onClick={() => setShiftMode("roster")}
                    className={`p-2.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      shiftMode === "roster"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isUrdu ? "صرف روسٹر (کوئی ڈیفالٹ شفٹ نہیں)" : "Roster-Only (No Default Shift)"}
                  </button>
                </div>
              </div>

              {/* Effective From */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {isUrdu ? "نافذ العمل از تاریخ:" : "Effective From Date:"}
                </label>
                <input
                  type="date"
                  data-help="attendance.shift_modal_effective_from"
                  value={shiftEffectiveFrom}
                  onChange={(e) => setShiftEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {shiftValidationErrors.effective_from && (
                  <p className="text-xs text-rose-600 mt-1">{shiftValidationErrors.effective_from}</p>
                )}
              </div>

              {/* Fixed Shift Settings */}
              {shiftMode === "fixed" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      {isUrdu ? "شفٹ پیٹرن آئی ڈی:" : "Shift Pattern ID:"}
                    </label>
                    <DirectoryPicker
                      data-help="attendance.shift_modal_pattern_id"
                      value={shiftPatternId}
                      onChange={(e) => setShiftPatternId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     path="/hr/shift-patterns" idField="shift_pattern_id" />
                    {shiftValidationErrors.shift_pattern_id && (
                      <p className="text-xs text-rose-600 mt-1">{shiftValidationErrors.shift_pattern_id}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                      {isUrdu ? "ہفتہ وار آرام کے دن (قاعدہ e3a5ef53f8):" : "Weekly Off Days (Rule e3a5ef53f8):"}
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ISO_WEEKDAY_NAMES.map((w) => {
                        const isOff = shiftWeeklyOffDays.includes(w.day);
                        return (
                          <label
                            key={w.day}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                              isOff
                                ? "bg-purple-50 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800"
                                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              data-help="attendance.shift_modal_off_days"
                              checked={isOff}
                              onChange={() => toggleWeeklyOffDay(w.day)}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>{isUrdu ? w.nameUr : w.nameEn}</span>
                          </label>
                        );
                      })}
                    </div>
                    {shiftValidationErrors.weekly_off_days && (
                      <p className="text-xs text-rose-600 mt-1">{shiftValidationErrors.weekly_off_days}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {isUrdu
                    ? "روسٹر کے مطابق عملہ (shift_pattern_id: null): اس ملازم کا کوئی مستقل ہفتہ وار آرام کا دن نہیں ہوگا، بلکہ روسٹر کے بغیر والے دن خودکار طور پر 'Off' گنے جائیں گے (قاعدہ edc1438113)۔"
                    : "Roster-Only Staff (shift_pattern_id: null): This staff member works strictly according to the duty roster. Any day without a scheduled duty counts as a rest day ('Off') rather than 'Absent' (rule:edc1438113)."}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                data-help="attendance.shift_modal_cancel"
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                data-help="attendance.shift_modal_submit"
                onClick={handleSubmitShiftAssignment}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              >
                {loading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving...") : (isUrdu ? "شفٹ محفوظ کریں" : "Save Shift Policy")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
