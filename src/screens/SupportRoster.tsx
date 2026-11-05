import {DirectoryPicker} from "../DirectoryPicker";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  RosterRangeOut,
  RosterEntryOut,
  RosterPlannerOut,
  RosterableStaffOut,
  HolidayBriefOut,
  ShiftPatternOut,
  DutySwapOut,
  RosterWeekOut,
  RollCallSheetOut,
  RollCallEntryOut,
  RollCallOut,
  EntriesIn,
  EntryPatch,
  RosterReasonIn,
  CopyIn,
  SwapIn,
  SwapRejectIn,
  RollCallIn
} from "../generated/support_roster";
import {
  listEntriesRosters,
  staffRosters,
  createEntries,
  updateEntryRosters,
  cancelEntry,
  copyPeriod,
  weekCheck,
  managerSwaps,
  recordSwap,
  approveSwap,
  rejectSwap,
  rollCallSheet,
  takeRollCall
} from "../generated/support_roster";
import {
  getSupportRosterCapabilityView,
  getWeekDates,
  getCurrentMonday,
  isStaffOnLeave,
  isStaffDefaultWeeklyOff,
  isPublicHoliday,
  validateCancelDuty,
  validateCopyPeriod,
  validateRecordSwap,
  canUserApproveSwap,
  validateRollCallSubmission,
  formatWeeklyPrintableSchedule,
  filterRollCallEntries,
  SUPPORT_ROSTER_ERROR_MESSAGES,
  type WeekDayInfo
} from "../support-roster-policy";

export interface SupportRosterProps {
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
  timeZone?: string;
  onNavigateScreen?: (screen: string) => void;
  onOpenHelp?: (topic?: string) => void;
}

export const SupportRoster: React.FC<SupportRosterProps> = ({
  token,
  lang = "en",
  establishment,
  user,
  userPermissions = [],
  currentUserRole,
  currentEmployeeId = null,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
  onOpenHelp
}) => {
  const isUrdu = lang === "ur";
  const effectiveEmployeeId = currentEmployeeId ?? user?.employee_id ?? null;
  const capabilityMode = getSupportRosterCapabilityView(establishment);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"planner" | "roll_call" | "swaps" | "week_check">("planner");

  // Week selection
  const [selectedMonday, setSelectedMonday] = useState<string>(getCurrentMonday());
  const weekDays = useMemo(() => getWeekDates(selectedMonday), [selectedMonday]);
  const dateFrom = weekDays[0]?.date || selectedMonday;
  const dateTo = weekDays[6]?.date || selectedMonday;

  // Planner Data
  const [entries, setEntries] = useState<RosterEntryOut[]>([]);
  const [plannerData, setPlannerData] = useState<RosterPlannerOut | null>(null);
  const [staffFilterCategory, setStaffFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Roll-Call Data
  const [rollCallDate, setRollCallDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [rollCallEntries, setRollCallEntries] = useState<RollCallEntryOut[]>([]);
  const [rollCallShiftFilter, setRollCallShiftFilter] = useState<number | null>(null);
  const [rollCallAreaFilter, setRollCallAreaFilter] = useState<string>("");
  const [rollCallSearchQuery, setRollCallSearchQuery] = useState<string>("");
  const [selectedRollCallEmpIds, setSelectedRollCallEmpIds] = useState<number[]>([]);
  const [lastRollCallResult, setLastRollCallResult] = useState<RollCallOut | null>(null);

  // Swaps Data
  const [swaps, setSwaps] = useState<DutySwapOut[]>([]);
  const [swapStatusFilter, setSwapStatusFilter] = useState<string>("All");

  // Week Check Data
  const [weekSummary, setWeekSummary] = useState<RosterWeekOut | null>(null);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ en: string; ur: string } | null>(null);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignTargetDate, setAssignTargetDate] = useState<string>(selectedMonday);
  const [assignTargetShiftId, setAssignTargetShiftId] = useState<number>(0);
  const [assignEmployeeId, setAssignEmployeeId] = useState<number>(0);
  const [assignWard,setAssignWard]=useState("");
  const [assignDepartment,setAssignDepartment]=useState("");
  const [editWard,setEditWard]=useState("");
  const [editDepartment,setEditDepartment]=useState("");
  const [assignDutyArea, setAssignDutyArea] = useState<"Ward" | "Department" | "Emergency" | "OT" | "Facility" | "Other">("Facility");
  const [assignZoneLabel, setAssignZoneLabel] = useState<string>("Zone A - Entrance");
  const [assignIsOnCall, setAssignIsOnCall] = useState<boolean>(false);
  const [assignNotes, setAssignNotes] = useState<string>("");

  // Edit / Cancel Duty Modal
  const [selectedDutyForEdit, setSelectedDutyForEdit] = useState<RosterEntryOut | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>("");
  const [editDutyArea, setEditDutyArea] = useState<"Ward" | "Department" | "Emergency" | "OT" | "Facility" | "Other">("Facility");
  const [editZoneLabel, setEditZoneLabel] = useState<string>("");
  const [editIsOnCall, setEditIsOnCall] = useState<boolean>(false);
  const [editNotes, setEditNotes] = useState<string>("");

  // Copy Week Modal
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState<string>("");
  const [copyRotateDays, setCopyRotateDays] = useState<number>(0);
  const [lastCopyResult, setLastCopyResult] = useState<{ copied: number; skipped: any[] } | null>(null);

  // Record Verbal Swap Modal
  const [showRecordSwapModal, setShowRecordSwapModal] = useState<boolean>(false);
  const [swapProposerId, setSwapProposerId] = useState<number>(0);
  const [swapProposerDutyId, setSwapProposerDutyId] = useState<number>(0);
  const [swapReceiverId, setSwapReceiverId] = useState<number>(0);
  const [swapReceiverDutyId, setSwapReceiverDutyId] = useState<number>(0);
  const [swapReason, setSwapReason] = useState<string>("");

  // Reject Swap Modal
  const [rejectingSwapId, setRejectingSwapId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>("");

  // Printable Schedules
  const [showPrintView, setShowPrintView] = useState<boolean>(false);

  // Map API Errors
  const handleError = useCallback((err: any) => {
    console.error("Support Roster error:", err);
    const code = err?.code || (err?.status === 403 ? "FORBIDDEN" : "NETWORK_ERROR");
    const mapped = SUPPORT_ROSTER_ERROR_MESSAGES[code] || {
      en: err?.message || "An unexpected system error occurred.",
      ur: "ایک غیر متوقع خرابی پیش آئی ہے۔"
    };
    setErrorMessage(mapped);
  }, []);

  // Clear messages
  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Fetch Planner & Entries
  const fetchPlannerData = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const [plannerRes, entriesRes] = await Promise.all([
        staffRosters({ date_from: dateFrom, date_to: dateTo }),
        listEntriesRosters({ date_from: dateFrom, date_to: dateTo, include_cancelled: false })
      ]);
      setPlannerData(plannerRes);
      setEntries(entriesRes.entries || []);
      if (plannerRes.shift_patterns && plannerRes.shift_patterns.length > 0) {
        setAssignTargetShiftId(plannerRes.shift_patterns[0].shift_pattern_id);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, handleError]);

  // Fetch Roll-Call Sheet
  const fetchRollCallData = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const res = await rollCallSheet({ roster_date: rollCallDate });
      setRollCallEntries(res.entries || []);
      setSelectedRollCallEmpIds([]);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [rollCallDate, handleError]);

  // Fetch Swaps
  const fetchSwapsData = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const statusParam = swapStatusFilter === "All" ? null : (swapStatusFilter as any);
      const res = await managerSwaps({ status: statusParam });
      setSwaps(res || []);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [swapStatusFilter, handleError]);

  // Fetch Week Check
  const fetchWeekSummary = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const res = await weekCheck({ week_of: selectedMonday });
      setWeekSummary(res);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonday, handleError]);

  // Initial & Tab Triggered Load
  useEffect(() => {
    if (activeTab === "planner") {
      fetchPlannerData();
    } else if (activeTab === "roll_call") {
      fetchRollCallData();
    } else if (activeTab === "swaps") {
      fetchSwapsData();
    } else if (activeTab === "week_check") {
      fetchWeekSummary();
    }
  }, [activeTab, fetchPlannerData, fetchRollCallData, fetchSwapsData, fetchWeekSummary]);

  // Realtime Listeners (rule:6e21482f49)
  useEffect(() => {
    const handleRosterChanged = () => {
      if (activeTab === "planner") fetchPlannerData();
      if (activeTab === "roll_call") fetchRollCallData();
      if (activeTab === "week_check") fetchWeekSummary();
    };
    const handleSwapUpdated = () => {
      if (activeTab === "swaps") fetchSwapsData();
    };

    window.addEventListener("ev:roster.changed", handleRosterChanged);
    window.addEventListener("ev:roster.swap.updated", handleSwapUpdated);
    return () => {
      window.removeEventListener("ev:roster.changed", handleRosterChanged);
      window.removeEventListener("ev:roster.swap.updated", handleSwapUpdated);
    };
  }, [activeTab, fetchPlannerData, fetchRollCallData, fetchSwapsData, fetchWeekSummary]);

  // Week Navigation
  const changeWeek = (deltaWeeks: number) => {
    const parts = selectedMonday.split("-").map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    setSelectedMonday(`${yyyy}-${mm}-${dd}`);
  };

  // Filtered Staff for Planner
  const filteredStaff = useMemo(() => {
    if (!plannerData?.staff) return [];
    return plannerData.staff.filter(s => {
      if (staffFilterCategory !== "All" && s.staff_category !== staffFilterCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = s.full_name.toLowerCase().includes(q) ||
          s.emp_number.toLowerCase().includes(q) ||
          s.designation.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [plannerData, staffFilterCategory, searchQuery]);

  // Filtered Roll-Call entries
  const filteredRollCall = useMemo(() => {
    return filterRollCallEntries(rollCallEntries, rollCallShiftFilter, rollCallAreaFilter, rollCallSearchQuery);
  }, [rollCallEntries, rollCallShiftFilter, rollCallAreaFilter, rollCallSearchQuery]);

  // Printable Weekly Matrix (Rule rule:28262cb3f6)
  const printableSchedule = useMemo(() => {
    return formatWeeklyPrintableSchedule(weekDays, entries);
  }, [weekDays, entries]);

  // Handlers: Assign Duty (POST /rosters)
  const handleAssignDuty = async () => {
    if (!assignEmployeeId || !assignTargetShiftId || !assignTargetDate) {
      setErrorMessage({
        en: "Please select employee, shift pattern, and date.",
        ur: "برائے مہربانی ملازم، شفٹ پیٹرن اور تاریخ منتخب کریں۔"
      });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const payload: EntriesIn = {
        entries: [
          {
            employee_id: assignEmployeeId,
            roster_date: assignTargetDate,
            shift_pattern_id: assignTargetShiftId,
            duty_area: assignDutyArea,
            ward_id:assignDutyArea==="Ward"&&assignWard?Number(assignWard):null,
            department_id:assignDutyArea==="Department"&&assignDepartment?Number(assignDepartment):null,
            zone_label: assignZoneLabel.trim() || null,
            is_on_call: assignIsOnCall,
            notes: assignNotes.trim() || null
          }
        ]
      };
      await createEntries(payload);
      setSuccessMessage({
        en: "Duty successfully assigned.",
        ur: "ڈیوٹی کامیابی کے ساتھ تفویض کر دی گئی ہے۔"
      });
      setShowAssignModal(false);
      setAssignNotes("");
      fetchPlannerData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Update Duty (PATCH /rosters/{roster_id})
  const handleUpdateDuty = async () => {
    if (!selectedDutyForEdit) return;
    setActionLoading(true);
    clearMessages();
    try {
      const patchBody: EntryPatch = {
        expected_version: selectedDutyForEdit.row_version,
        duty_area: editDutyArea,
        ward_id:editDutyArea==="Ward"&&editWard?Number(editWard):null,
        department_id:editDutyArea==="Department"&&editDepartment?Number(editDepartment):null,
        zone_label: editZoneLabel.trim() || null,
        is_on_call: editIsOnCall,
        notes: editNotes.trim() || null
      };
      await updateEntryRosters(selectedDutyForEdit.roster_id, patchBody);
      setSuccessMessage({
        en: "Duty updated successfully.",
        ur: "ڈیوٹی میں ترمیم کامیابی سے مکمل ہوئی۔"
      });
      setSelectedDutyForEdit(null);
      fetchPlannerData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Cancel Duty (POST /rosters/{roster_id}/cancel)
  const handleCancelDuty = async () => {
    if (!selectedDutyForEdit) return;
    const val = validateCancelDuty(cancelReasonInput);
    if (!val.valid) {
      setErrorMessage({ en: val.errorEn!, ur: val.errorUr! });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const body: RosterReasonIn = {
        reason: cancelReasonInput.trim()
      };
      await cancelEntry(selectedDutyForEdit.roster_id, body);
      setSuccessMessage({
        en: "Duty cancelled with documented justification.",
        ur: "ڈیوٹی وجہ کے اندراج کے ساتھ منسوخ کر دی گئی ہے۔"
      });
      setSelectedDutyForEdit(null);
      setCancelReasonInput("");
      fetchPlannerData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Copy Period (POST /rosters/copy)
  const handleCopyPeriod = async () => {
    const val = validateCopyPeriod({
      source_from: selectedMonday,
      source_to: weekDays[6]?.date || selectedMonday,
      target_from: copyTargetWeek
    });
    if (!val.valid) {
      setErrorMessage({ en: val.errorEn!, ur: val.errorUr! });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const body: CopyIn = {
        source_from: selectedMonday,
        source_to: weekDays[6]?.date || selectedMonday,
        target_from: copyTargetWeek,
        rotate_days: copyRotateDays
      };
      const res = await copyPeriod(body);
      setLastCopyResult({ copied: res.created.length, skipped: res.skipped });
      setSuccessMessage({
        en: `Successfully duplicated ${res.created.length} duties to target week.`,
        ur: `ہدف کے ہفتے میں ${res.created.length} ڈیوٹیاں کامیابی سے نقل کر دی گئیں۔`
      });
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Roll-Call Submission (POST /rosters/roll-call)
  const handleSubmitRollCall = async (empIdsToMark?: number[]) => {
    const ids = empIdsToMark || selectedRollCallEmpIds;
    const val = validateRollCallSubmission(rollCallDate, ids);
    if (!val.valid || !val.payload) {
      setErrorMessage({ en: val.errorEn!, ur: val.errorUr! });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const res = await takeRollCall(val.payload);
      setLastRollCallResult(res);
      setSuccessMessage({
        en: `Roll call recorded: ${res.recorded.length} staff marked present (${res.skipped.length} already punched in).`,
        ur: `حاضری درج ہو گئی: ${res.recorded.length} ملازمین کی حاضری لگ گئی (${res.skipped.length} پہلے سے پنچ تھے)۔`
      });
      setSelectedRollCallEmpIds([]);
      fetchRollCallData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Record Verbal Swap (POST /rosters/swaps)
  const handleRecordVerbalSwap = async () => {
    const val = validateRecordSwap(
      swapProposerId,
      swapReceiverId,
      swapProposerDutyId,
      swapReceiverDutyId
    );
    if (!val.valid) {
      setErrorMessage({ en: val.errorEn!, ur: val.errorUr! });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const body: SwapIn = {
        roster_id: swapProposerDutyId,
        covering_employee_id: swapReceiverId,
        return_roster_id: swapReceiverDutyId || null,
        reason: swapReason.trim() || "Mutual verbal agreement"
      };
      await recordSwap(body);
      setSuccessMessage({
        en: "Verbal shift swap successfully recorded.",
        ur: "زبانی تبادلہ کامیابی کے ساتھ درج کر لیا گیا ہے۔"
      });
      setShowRecordSwapModal(false);
      setSwapReason("");
      fetchSwapsData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Approve Swap (POST /rosters/swaps/{id}/approve)
  const handleApproveSwap = async (swapId: number) => {
    setActionLoading(true);
    clearMessages();
    try {
      await approveSwap(swapId, { note: "Approved by operations supervisor" });
      setSuccessMessage({
        en: "Duty swap approved and roster updated.",
        ur: "ڈیوٹی کا تبادلہ منظور ہو گیا اور روسٹر اپ ڈیٹ ہو گیا۔"
      });
      fetchSwapsData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers: Reject Swap (POST /rosters/swaps/{id}/reject)
  const handleRejectSwap = async () => {
    if (!rejectingSwapId) return;
    if (rejectReasonInput.trim().length < 3) {
      setErrorMessage({
        en: "Operational rejection reason must be at least 3 characters.",
        ur: "مسترد کرنے کی آپریشنل وجہ کم از کم 3 حروف پر مشتمل ہونی چاہیے۔"
      });
      return;
    }
    setActionLoading(true);
    clearMessages();
    try {
      const body: SwapRejectIn = { note: rejectReasonInput.trim() };
      await rejectSwap(rejectingSwapId, body);
      setSuccessMessage({
        en: "Duty swap rejected.",
        ur: "ڈیوٹی کا تبادلہ مسترد کر دیا گیا۔"
      });
      setRejectingSwapId(null);
      setRejectReasonInput("");
      fetchSwapsData();
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Roll-Call checkbox
  const toggleSelectRollCallEmp = (empId: number) => {
    setSelectedRollCallEmpIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Select all un-arrived staff for roll call
  const selectAllUncheckedRollCall = () => {
    const unarrived = filteredRollCall.filter(e => !e.first_in).map(e => e.employee_id);
    setSelectedRollCallEmpIds(unarrived);
  };

  return (
    <div
      className={`support-roster-container ${isUrdu ? "rtl" : "ltr"}`}
      style={{ padding: "16px", minHeight: "100%", display: "flex", flexDirection: "column", gap: "16px" }}
    >
      {/* Printable Weekly Duty Sheet (Rule rule:28262cb3f6) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #support-roster-print-target, #support-roster-print-target * {
            visibility: visible;
          }
          #support-roster-print-target {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12px;
            font-size: 11pt;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid var(--border-color, #e0e0e0)",
          paddingBottom: "12px"
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "1.4rem" }}>
            {isUrdu ? "معاون عملے کا ڈیوٹی روسٹر اور رول کال" : "Support-Staff Duty Roster & Roll Call"}
          </h1>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted, #666)" }}>
            {isUrdu
              ? "صفائی کارکن، سیکیورٹی گارڈز اور گیٹ اسٹاف کے لیے ہفتہ وار شفٹ پلاننگ اور بغیر کارڈ حاضری"
              : "Plan duties by shift for sweepers, janitors, and guards onto zones, wards, and gates."}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {capabilityMode === "open_work" && (
            <span
              style={{
                backgroundColor: "#fff3cd",
                color: "#856404",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "0.8rem",
                fontWeight: 600
              }}
            >
              {isUrdu ? "صرف کھلے کام کی حالت" : "Open Work Mode"}
            </span>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onOpenHelp?.("support_roster")}
            data-help="support_roster.btn_f1_help"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <span>ℹ️</span>
            <span>{isUrdu ? "رہنمائی (F1)" : "Help (F1)"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid var(--border-color, #e0e0e0)" }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === "planner" ? "active" : ""}`}
          onClick={() => setActiveTab("planner")}
          data-help="support_roster.tab_planner"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "planner" ? "3px solid var(--primary-color, #0056b3)" : "none",
            backgroundColor: activeTab === "planner" ? "var(--bg-active, #eef4fc)" : "transparent",
            fontWeight: activeTab === "planner" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          {isUrdu ? "ہفتہ وار روسٹر گرڈ" : "Weekly Planner Grid"}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "roll_call" ? "active" : ""}`}
          onClick={() => setActiveTab("roll_call")}
          data-help="support_roster.tab_roll_call"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "roll_call" ? "3px solid var(--primary-color, #0056b3)" : "none",
            backgroundColor: activeTab === "roll_call" ? "var(--bg-active, #eef4fc)" : "transparent",
            fontWeight: activeTab === "roll_call" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          {isUrdu ? "آج کی رول کال (حاضری)" : "Today's Roll Call"}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "swaps" ? "active" : ""}`}
          onClick={() => setActiveTab("swaps")}
          data-help="support_roster.tab_swaps"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "swaps" ? "3px solid var(--primary-color, #0056b3)" : "none",
            backgroundColor: activeTab === "swaps" ? "var(--bg-active, #eef4fc)" : "transparent",
            fontWeight: activeTab === "swaps" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          {isUrdu ? "ڈیوٹی تبادلے اور کور" : "Duty Swaps & Covers"}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "week_check" ? "active" : ""}`}
          onClick={() => setActiveTab("week_check")}
          data-help="support_roster.tab_week_check"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "week_check" ? "3px solid var(--primary-color, #0056b3)" : "none",
            backgroundColor: activeTab === "week_check" ? "var(--bg-active, #eef4fc)" : "transparent",
            fontWeight: activeTab === "week_check" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          {isUrdu ? "ہفتہ وار جائزہ اور آرام کا آڈٹ" : "Week Check & Rest Audit"}
        </button>
      </div>

      {/* Notification Banners */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "10px 14px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{isUrdu ? errorMessage.ur : errorMessage.en}</span>
          <button
            type="button"
            onClick={clearMessages}
            data-help="support_roster.btn_dismiss_error"
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#721c24" }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            backgroundColor: "#d4edda",
            color: "#155724",
            padding: "10px 14px",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{isUrdu ? successMessage.ur : successMessage.en}</span>
          <button
            type="button"
            onClick={clearMessages}
            data-help="support_roster.btn_dismiss_success"
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#155724" }}
            aria-label="Dismiss success"
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: WEEKLY PLANNER GRID */}
      {activeTab === "planner" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Week Selector Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              padding: "10px",
              backgroundColor: "var(--bg-card, #f8f9fa)",
              borderRadius: "6px"
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => changeWeek(-1)}
                data-help="support_roster.btn_prev_week"
              >
                ◀ {isUrdu ? "پچھلا ہفتہ" : "Prev Week"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setSelectedMonday(getCurrentMonday())}
                data-help="support_roster.btn_current_week"
              >
                {isUrdu ? "موجودہ ہفتہ" : "Current Week"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => changeWeek(1)}
                data-help="support_roster.btn_next_week"
              >
                {isUrdu ? "اگلا ہفتہ" : "Next Week"} ▶
              </button>
              <span style={{ fontWeight: 600, margin: "0 8px" }}>
                {weekDays[0]?.date} — {weekDays[6]?.date}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder={isUrdu ? "ملازم یا عہدہ تلاش کریں..." : "Search staff or role..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-help="support_roster.input_search_staff"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />

              <select
                value={staffFilterCategory}
                onChange={e => setStaffFilterCategory(e.target.value)}
                data-help="support_roster.select_filter_category"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="All">{isUrdu ? "تمام عملہ" : "All Staff"}</option>
                <option value="SupportZeroInterface">{isUrdu ? "معاون عملہ (سویپر/گارڈ)" : "Support (Sweeper/Guard)"}</option>
                <option value="Technical">{isUrdu ? "تکنیکی عملہ" : "Technical"}</option>
                <option value="Administrative">{isUrdu ? "انتظامی عملہ" : "Administrative"}</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setAssignTargetDate(selectedMonday);
                  setShowAssignModal(true);
                }}
                data-help="support_roster.btn_open_assign_modal"
                style={{ backgroundColor: "var(--primary-color, #0056b3)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}
              >
                + {isUrdu ? "ڈیوٹی لگائیں" : "Assign Duty"}
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowCopyModal(true)}
                data-help="support_roster.btn_open_copy_modal"
              >
                📋 {isUrdu ? "پچھلا ہفتہ دہرائیں" : "Duplicate Week"}
              </button>

              {/* Printable Schedule Button (Rule rule:28262cb3f6) */}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => window.print()}
                data-help="support_roster.btn_print_weekly_sheet"
                title={isUrdu ? "معاون عملے کے لیے ہفتہ وار شیٹ پرنٹ کریں" : "Print weekly duty job aid for support staff"}
              >
                🖨️ {isUrdu ? "ہفتہ وار روسٹر پرنٹ کریں" : "Print Weekly Duty Sheet"}
              </button>
            </div>
          </div>

          {/* Grid View */}
          <div style={{ overflowX: "auto", border: "1px solid var(--border-color, #e0e0e0)", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-header, #f1f3f5)", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left", width: "160px" }}>
                    {isUrdu ? "شفٹ پیٹرن" : "Shift Pattern"}
                  </th>
                  {weekDays.map(day => {
                    const holiday = plannerData?.holidays ? isPublicHoliday(plannerData.holidays, day.date) : undefined;
                    return (
                      <th
                        key={day.date}
                        style={{
                          padding: "8px",
                          textAlign: "center",
                          backgroundColor: day.isSunday ? "#fff8f0" : holiday ? "#f0f8ff" : "inherit",
                          borderLeft: "1px solid #e0e0e0"
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{isUrdu ? day.dayNameUr : day.dayNameEn}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>{day.date}</div>
                        {holiday && (
                          <div style={{ fontSize: "0.7rem", color: "#0066cc", fontWeight: 600 }}>
                            🎉 {holiday.name}
                          </div>
                        )}
                        {day.isSunday && (
                          <div style={{ fontSize: "0.7rem", color: "#d9534f" }}>
                            {isUrdu ? "اتوار (کام جاری)" : "Sunday (Active)"}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {plannerData?.shift_patterns && plannerData.shift_patterns.length > 0 ? (
                  plannerData.shift_patterns.map(pattern => (
                    <tr key={pattern.shift_pattern_id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                      <td style={{ padding: "8px", fontWeight: 600, backgroundColor: "#fafbfc" }}>
                        <div>{pattern.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>
                          {pattern.start_time} - {pattern.end_time}
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dayDuties = entries.filter(
                          e => e.roster_date === day.date && e.shift_pattern_id === pattern.shift_pattern_id
                        );
                        return (
                          <td
                            key={day.date}
                            style={{
                              padding: "6px",
                              verticalAlign: "top",
                              borderLeft: "1px solid #e0e0e0",
                              minHeight: "80px",
                              backgroundColor: day.isSunday ? "#fffcf9" : "transparent"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {dayDuties.map(duty => (
                                <div
                                  key={duty.roster_id}
                                  onClick={() => {
                                    setSelectedDutyForEdit(duty);
                                    setEditDutyArea(duty.duty_area);setEditWard(duty.ward_id?String(duty.ward_id):"");setEditDepartment(duty.department_id?String(duty.department_id):"");
                                    setEditZoneLabel(duty.zone_label || "");
                                    setEditIsOnCall(duty.is_on_call);
                                    setEditNotes(duty.notes || "");
                                  }}
                                  style={{
                                    backgroundColor: duty.is_on_call ? "#fff3cd" : "#e8f4fd",
                                    border: `1px solid ${duty.is_on_call ? "#ffeeba" : "#b8daff"}`,
                                    borderRadius: "4px",
                                    padding: "4px 6px",
                                    fontSize: "0.8rem",
                                    cursor: "pointer"
                                  }}
                                  title={`${duty.full_name} (${duty.emp_number}) - ${duty.zone_label || duty.ward_name || duty.duty_area}`}
                                >
                                  <div style={{ fontWeight: 600 }}>{duty.full_name}</div>
                                  <div style={{ fontSize: "0.7rem", color: "#555" }}>
                                    📍 {duty.zone_label || duty.ward_name || duty.duty_area}
                                  </div>
                                  {duty.is_on_call && (
                                    <span style={{ fontSize: "0.65rem", color: "#856404", fontWeight: 600 }}>
                                      ☎ {isUrdu ? "آن کال" : "On-Call"}
                                    </span>
                                  )}
                                  {duty.swap_id && (
                                    <span style={{ fontSize: "0.65rem", color: "#004085" }}>
                                      🔄 {isUrdu ? "تبادلہ شدہ" : "Swapped"}
                                    </span>
                                  )}
                                </div>
                              ))}

                              {/* Cell Quick Assign Action */}
                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                onClick={() => {
                                  setAssignTargetDate(day.date);
                                  setAssignTargetShiftId(pattern.shift_pattern_id);
                                  setShowAssignModal(true);
                                }}
                                data-help="support_roster.btn_cell_quick_assign"
                                style={{
                                  padding: "2px 4px",
                                  fontSize: "0.75rem",
                                  color: "#0056b3",
                                  textAlign: isUrdu ? "right" : "left",
                                  border: "1px dashed #ccc",
                                  borderRadius: "4px",
                                  background: "transparent",
                                  cursor: "pointer"
                                }}
                              >
                                + {isUrdu ? "ملازم شامل کریں" : "Add Staff"}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                      {loading
                        ? (isUrdu ? "روسٹر لوڈ ہو رہا ہے..." : "Loading roster grid...")
                        : (isUrdu ? "کوئی شفٹ پیٹرن دستیاب نہیں۔" : "No shift patterns found.")}
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Bottom Daily Staffing Totals (Rule rule:fb45bf026f) */}
              <tfoot>
                <tr style={{ backgroundColor: "#f1f3f5", borderTop: "2px solid #ccc", fontWeight: 600 }}>
                  <td style={{ padding: "8px" }}>{isUrdu ? "کل عملہ فی دن" : "Total Staff / Day"}</td>
                  {weekDays.map(day => {
                    const totalDayDuties = entries.filter(e => e.roster_date === day.date).length;
                    return (
                      <td
                        key={day.date}
                        style={{
                          padding: "8px",
                          textAlign: "center",
                          borderLeft: "1px solid #e0e0e0",
                          color: totalDayDuties === 0 ? "#dc3545" : "#28a745"
                        }}
                      >
                        {totalDayDuties}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TODAY'S ROLL CALL (RULE rule:28262cb3f6) */}
      {activeTab === "roll_call" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Roll Call Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              padding: "10px",
              backgroundColor: "var(--bg-card, #f8f9fa)",
              borderRadius: "6px"
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontWeight: 600 }}>{isUrdu ? "تاریخ:" : "Date:"}</label>
              <input
                type="date"
                value={rollCallDate}
                onChange={e => setRollCallDate(e.target.value)}
                data-help="support_roster.input_roll_call_date"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />

              <input
                type="text"
                placeholder={isUrdu ? "نام یا نمبر سے تلاش کریں..." : "Filter by name or ID..."}
                value={rollCallSearchQuery}
                onChange={e => setRollCallSearchQuery(e.target.value)}
                data-help="support_roster.input_roll_call_search"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />

              <input
                type="text"
                placeholder={isUrdu ? "زون یا گیٹ فلٹر..." : "Filter by Zone or Gate..."}
                value={rollCallAreaFilter}
                onChange={e => setRollCallAreaFilter(e.target.value)}
                data-help="support_roster.input_roll_call_area"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />

              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={selectAllUncheckedRollCall}
                data-help="support_roster.btn_select_all_unarrived"
              >
                {isUrdu ? "غیر حاضرین کا انتخاب کریں" : "Select All Un-arrived"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleSubmitRollCall()}
                disabled={actionLoading || selectedRollCallEmpIds.length === 0}
                data-help="support_roster.btn_submit_roll_call"
                style={{
                  backgroundColor: "var(--primary-color, #0056b3)",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "4px",
                  cursor: selectedRollCallEmpIds.length > 0 ? "pointer" : "not-allowed"
                }}
              >
                ✓ {isUrdu ? `حاضری درج کریں (${selectedRollCallEmpIds.length})` : `Mark Present (${selectedRollCallEmpIds.length})`}
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => window.print()}
                data-help="support_roster.btn_print_roll_call_sheet"
                title={isUrdu ? "کاغذ پر حاضری کے لیے پرنٹ کریں" : "Print physical attendance roll call sheet"}
              >
                🖨️ {isUrdu ? "رول کال شیٹ پرنٹ کریں" : "Print Sheet"}
              </button>
            </div>
          </div>

          {/* Roll Call Results Feedback */}
          {lastRollCallResult && (
            <div
              style={{
                backgroundColor: "#e8f4fd",
                border: "1px solid #b8daff",
                borderRadius: "4px",
                padding: "8px 12px",
                fontSize: "0.85rem"
              }}
            >
              <div>
                <strong>{isUrdu ? "حالیہ رول کال نتیجہ:" : "Recent Roll Call Result:"}</strong>{" "}
                {lastRollCallResult.recorded.length} {isUrdu ? "ملازمین حاضر درج ہوئے" : "staff marked present"}
                {lastRollCallResult.skipped.length > 0 &&
                  `, ${lastRollCallResult.skipped.length} ${isUrdu ? "پہلے سے کارڈ پنچ تھے" : "skipped (already punched)"}`}
              </div>
            </div>
          )}

          {/* Roll Call Roster Table */}
          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: "8px", width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredRollCall.length > 0 &&
                        filteredRollCall.every(e => e.first_in || selectedRollCallEmpIds.includes(e.employee_id))
                      }
                      onChange={e => {
                        if (e.target.checked) selectAllUncheckedRollCall();
                        else setSelectedRollCallEmpIds([]);
                      }}
                      data-help="support_roster.check_roll_call_all"
                    />
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "ملازم کا نام اور نمبر" : "Employee Name & ID"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "عہدہ اور زمرہ" : "Designation & Category"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "شفٹ" : "Shift"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "مقام / زون / گیٹ" : "Duty Area / Zone / Gate"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "حاضری کی حالت" : "Arrival Status"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "فوری اقدام" : "Action"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRollCall.length > 0 ? (
                  filteredRollCall.map(entry => {
                    const isArrived = !!entry.first_in;
                    const isSelected = selectedRollCallEmpIds.includes(entry.employee_id);
                    return (
                      <tr
                        key={entry.roster_id}
                        style={{
                          borderBottom: "1px solid #e0e0e0",
                          backgroundColor: isArrived ? "#f0fff4" : isSelected ? "#eef4fc" : "transparent"
                        }}
                      >
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isArrived || isSelected}
                            disabled={isArrived}
                            onChange={() => toggleSelectRollCallEmp(entry.employee_id)}
                            data-help="support_roster.check_roll_call_item"
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{entry.full_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>{entry.emp_number}</div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div>{entry.designation}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>{entry.staff_category}</div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{entry.shift_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            {entry.start_time} - {entry.end_time}
                          </div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span
                            style={{
                              backgroundColor: "#e9ecef",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                              fontWeight: 500
                            }}
                          >
                            📍 {entry.zone_label || entry.ward_name || entry.department_name || entry.duty_area}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          {isArrived ? (
                            <span
                              style={{
                                backgroundColor: "#d4edda",
                                color: "#155724",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600
                              }}
                            >
                              ✓ {isUrdu ? "حاضر" : "Arrived"} ({entry.first_source || "RollCall"})
                              <div style={{ fontSize: "0.65rem", fontWeight: 400 }}>{entry.first_in?.slice(11, 16)}</div>
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: "#fff3cd",
                                color: "#856404",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600
                              }}
                            >
                              ⏳ {isUrdu ? "غیر حاضر / منتظر" : "Pending Arrival"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          {!isArrived && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleSubmitRollCall([entry.employee_id])}
                              data-help="support_roster.btn_mark_single_present"
                              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            >
                              {isUrdu ? "ابھی حاضر لگائیں" : "Mark Present"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                      {loading
                        ? (isUrdu ? "رول کال ڈیٹا لوڈ ہو رہا ہے..." : "Loading roll-call sheet...")
                        : (isUrdu ? "اس تاریخ کے لیے کوئی معاون عملہ روسٹر نہیں ہے۔" : "No rostered support staff found for this date.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DUTY SWAPS & COVERS (RULE rule:83718fc56e) */}
      {activeTab === "swaps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Action Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              padding: "10px",
              backgroundColor: "var(--bg-card, #f8f9fa)",
              borderRadius: "6px"
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontWeight: 600 }}>{isUrdu ? "حالت فلٹر:" : "Status Filter:"}</label>
              <select
                value={swapStatusFilter}
                onChange={e => setSwapStatusFilter(e.target.value)}
                data-help="support_roster.select_filter_swap_status"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="All">{isUrdu ? "تمام حالتیں" : "All Statuses"}</option>
                <option value="Requested">{isUrdu ? "درخواست شدہ" : "Requested"}</option>
                <option value="Accepted">{isUrdu ? "باہم متفق (منظوری منتظر)" : "Accepted (Awaiting Approval)"}</option>
                <option value="Approved">{isUrdu ? "منظور شدہ" : "Approved"}</option>
                <option value="Rejected">{isUrdu ? "مسترد شدہ" : "Rejected"}</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowRecordSwapModal(true)}
                data-help="support_roster.btn_open_record_swap"
                style={{ backgroundColor: "var(--primary-color, #0056b3)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}
              >
                + {isUrdu ? "زبانی تبادلہ درج کریں" : "Record Verbal Swap"}
              </button>
            </div>
          </div>

          {/* Swaps Table */}
          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>ID</th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "درخواست کنندہ ملازم" : "Proposing Staff"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "متبادل ملازم" : "Covering Staff"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "تبادلہ کی وجہ" : "Reason"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "حالت" : "Status"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "اقدامات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {swaps.length > 0 ? (
                  swaps.map(swap => {
                    const canApprove = canUserApproveSwap(swap, effectiveEmployeeId);
                    return (
                      <tr key={swap.swap_id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>#{swap.swap_id}</td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{swap.requester_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            📅 {swap.duty?.roster_date} ({swap.duty?.shift_name})
                          </div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{swap.covering_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            {swap.return_duty ? (
                              <span>📅 {swap.return_duty.roster_date} ({swap.return_duty.shift_name})</span>
                            ) : (
                              <span style={{ color: "#888" }}>Cover Only (No return shift)</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "8px", fontSize: "0.85rem" }}>
                          {swap.reason || (isUrdu ? "کوئی وجہ درج نہیں" : "No reason provided")}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor:
                                swap.status === "Approved" ? "#d4edda" :
                                swap.status === "Accepted" ? "#fff3cd" :
                                swap.status === "Rejected" ? "#f8d7da" : "#e2e3e5",
                              color:
                                swap.status === "Approved" ? "#155724" :
                                swap.status === "Accepted" ? "#856404" :
                                swap.status === "Rejected" ? "#721c24" : "#383d41"
                            }}
                          >
                            {swap.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          {(swap.status === "Accepted" || swap.status === "Requested") && (
                            <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => handleApproveSwap(swap.swap_id)}
                                disabled={!canApprove || actionLoading}
                                data-help="support_roster.btn_approve_swap"
                                style={{
                                  backgroundColor: canApprove ? "#28a745" : "#ccc",
                                  color: "#fff",
                                  border: "none",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  cursor: canApprove ? "pointer" : "not-allowed"
                                }}
                                title={!canApprove ? "Self-approval prohibited (SWAP_SELF_APPROVAL)" : ""}
                              >
                                {isUrdu ? "منظور کریں" : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => setRejectingSwapId(swap.swap_id)}
                                disabled={actionLoading}
                                data-help="support_roster.btn_open_reject_swap"
                                style={{
                                  backgroundColor: "#dc3545",
                                  color: "#fff",
                                  border: "none",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  cursor: "pointer"
                                }}
                              >
                                {isUrdu ? "مسترد" : "Reject"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                      {loading
                        ? (isUrdu ? "تبادلے لوڈ ہو رہے ہیں..." : "Loading swaps...")
                        : (isUrdu ? "کوئی تبادلہ درخواست نہیں ملی۔" : "No duty swaps found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: WEEK CHECK & REST AUDIT (RULE rule:fb45bf026f) */}
      {activeTab === "week_check" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#666" }}>
                {isUrdu ? "ہفتے کی کل ڈیوٹیاں" : "Total Week Duties"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary-color, #0056b3)" }}>
                {entries.length}
              </span>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ffc107",
                borderRadius: "6px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#856404", fontWeight: 600 }}>
                ⚠️ {isUrdu ? "بغیر آرام والے ملازمین (اضافی الاؤنس)" : "No Rest Day Alert (Extra Duty)"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#856404" }}>
                {weekSummary?.staff.filter(s => s.status === "NoRestDay").length || 0}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>
                {isUrdu ? "قانون کے مطابق اضافی ڈیوٹی معاوضہ لازم ہے" : "Statutory overtime allowance due"}
              </span>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#666" }}>
                {isUrdu ? "غیر روسٹرڈ عملہ" : "Not Rostered Staff"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#6c757d" }}>
                {weekSummary?.staff.filter(s => s.status === "NotRostered").length || 0}
              </span>
            </div>
          </div>

          {/* Rest Audit Table */}
          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ccc" }}>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "ملازم" : "Staff Member"}
                  </th>
                  <th style={{ padding: "8px", textAlign: isUrdu ? "right" : "left" }}>
                    {isUrdu ? "عہدہ" : "Designation"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "کام کے دن" : "Working Days"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "آرام کے دن" : "Rest Days"}
                  </th>
                  <th style={{ padding: "8px", textAlign: "center" }}>
                    {isUrdu ? "حالت و تنبیہ" : "Status & Compliance"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekSummary?.staff && weekSummary.staff.length > 0 ? (
                  weekSummary.staff.map(item => (
                    <tr key={item.employee_id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>{item.full_name}</td>
                      <td style={{ padding: "8px", color: "#555" }}>{item.designation}</td>
                      <td style={{ padding: "8px", textAlign: "center", fontWeight: 600 }}>{item.working_days}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{item.rest_dates.length}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {item.status === "NoRestDay" ? (
                          <span
                            style={{
                              backgroundColor: "#fff3cd",
                              color: "#856404",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600
                            }}
                          >
                            ⚠️ NoRestDay ({item.extra_duty_days || 1} {isUrdu ? "دن اوور ٹائم" : "day OT"})
                          </span>
                        ) : item.status === "NotRostered" ? (
                          <span
                            style={{
                              backgroundColor: "#e2e3e5",
                              color: "#383d41",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem"
                            }}
                          >
                            {isUrdu ? "غیر روسٹرڈ" : "Not Rostered"}
                          </span>
                        ) : (
                          <span
                            style={{
                              backgroundColor: "#d4edda",
                              color: "#155724",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600
                            }}
                          >
                            ✓ {isUrdu ? "قواعد کے مطابق" : "Compliant"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                      {loading
                        ? (isUrdu ? "آڈٹ ڈیٹا لوڈ ہو رہا ہے..." : "Loading rest audit...")
                        : (isUrdu ? "اس ہفتے کے لیے کوئی عملہ روسٹر نہیں ہے۔" : "No staff rostered for this week.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT TARGET: Dedicated Print Layout for Rule rule:28262cb3f6 */}
      <div id="support-roster-print-target" style={{ display: "none" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
          <h2 style={{ margin: "0 0 4px 0" }}>Haspataal Medical Complex — Operations & Facility Division</h2>
          <h3 style={{ margin: "0 0 4px 0" }}>Weekly Support Staff Duty Roster & Work Assignments</h3>
          <p style={{ margin: 0 }}>
            Week of: {weekDays[0]?.date} through {weekDays[6]?.date} | Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0", borderBottom: "1px solid #000" }}>
              <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Staff Member</th>
              <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Role</th>
              {weekDays.map(d => (
                <th key={d.date} style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>
                  {d.dayNameEn.slice(0, 3)} {d.date.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {printableSchedule.map(row => (
              <tr key={row.employee_id}>
                <td style={{ border: "1px solid #000", padding: "6px", fontWeight: 600 }}>
                  {row.full_name} ({row.emp_number})
                </td>
                <td style={{ border: "1px solid #000", padding: "6px" }}>{row.designation}</td>
                {weekDays.map(d => {
                  const assign = row.assignments[d.date];
                  return (
                    <td key={d.date} style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontSize: "8.5pt" }}>
                      {assign ? (
                        <div>
                          <strong>{assign.shift}</strong>
                          <div>{assign.place}</div>
                          {assign.isOnCall && <div>(On-Call)</div>}
                        </div>
                      ) : (
                        <span style={{ color: "#888" }}>OFF</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: ASSIGN DUTY */}
      {showAssignModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>
              {isUrdu ? "نئی ڈیوٹی تفویض کریں" : "Assign Support Duty"}
            </h3>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "ملازم منتخب کریں:" : "Select Employee:"}
              </label>
              <select
                value={assignEmployeeId}
                onChange={e => setAssignEmployeeId(Number(e.target.value))}
                data-help="support_roster.select_assign_employee"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value={0}>{isUrdu ? "-- ملازم کا انتخاب کریں --" : "-- Select Employee --"}</option>
                {filteredStaff.map(s => {
                  const onLeave = isStaffOnLeave(s, assignTargetDate);
                  const isOff = isStaffDefaultWeeklyOff(s, assignTargetDate);
                  return (
                    <option key={s.employee_id} value={s.employee_id} disabled={onLeave}>
                      {s.full_name} ({s.emp_number}) - {s.designation}
                      {onLeave ? " [ON LEAVE]" : isOff ? " [Weekly Off]" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "شفٹ پیٹرن:" : "Shift Pattern:"}
              </label>
              <select
                value={assignTargetShiftId}
                onChange={e => setAssignTargetShiftId(Number(e.target.value))}
                data-help="support_roster.select_assign_shift"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                {plannerData?.shift_patterns.map(p => (
                  <option key={p.shift_pattern_id} value={p.shift_pattern_id}>
                    {p.name} ({p.start_time} - {p.end_time})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "ڈیوٹی کا شعبہ:" : "Duty Area:"}
                </label>
                <select
                  value={assignDutyArea}
                  onChange={e => setAssignDutyArea(e.target.value as any)}
                  data-help="support_roster.select_assign_duty_area"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="Facility">{isUrdu ? "ہسپتال کا احاطہ / زون" : "Facility / Zone"}</option>
                  <option value="Ward">{isUrdu ? "وارڈ" : "Ward"}</option>
                  <option value="Emergency">{isUrdu ? "ایمرجنسی" : "Emergency"}</option>
                  <option value="OT">{isUrdu ? "آپریشن تھیٹر" : "OT"}</option>
                  <option value="Department">{isUrdu ? "ڈیپارٹمنٹ" : "Department"}</option>
                  <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "مقام / زون لیبل:" : "Zone / Gate Label:"}
                </label>
                <>{assignDutyArea==='Ward'&&<label>Ward / وارڈ<DirectoryPicker path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" value={assignWard} onChange={e=>setAssignWard(e.target.value)} data-help="support_roster.input_assign_zone_label"/></label>}{assignDutyArea==='Department'&&<label>Department / شعبہ<DirectoryPicker path="/admin/departments" idField="department_id" value={assignDepartment} onChange={e=>setAssignDepartment(e.target.value)} data-help="support_roster.input_assign_zone_label"/></label>}<input
                  type="text"
                  value={assignZoneLabel}
                  onChange={e => setAssignZoneLabel(e.target.value)}
                  placeholder="e.g. Zone A - Main Gate"
                  data-help="support_roster.input_assign_zone_label"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                /></>
              </div>
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={assignIsOnCall}
                  onChange={e => setAssignIsOnCall(e.target.checked)}
                  data-help="support_roster.check_assign_on_call"
                />
                <span>{isUrdu ? "آن کال ڈیوٹی ہے" : "Is On-Call Duty"}</span>
              </label>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "اضافی نوٹس:" : "Notes:"}
              </label>
              <textarea
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                rows={2}
                placeholder={isUrdu ? "ضروری ہدایات..." : "Operational notes..."}
                data-help="support_roster.textarea_assign_notes"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAssignModal(false)}
                disabled={actionLoading}
                data-help="support_roster.btn_cancel_assign_modal"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAssignDuty}
                disabled={actionLoading}
                data-help="support_roster.btn_confirm_assign_duty"
                style={{ backgroundColor: "var(--primary-color, #0056b3)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}
              >
                {actionLoading ? (isUrdu ? "محفوظ ہو رہا ہے..." : "Saving...") : (isUrdu ? "ڈیوٹی محفوظ کریں" : "Save Duty")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / CANCEL DUTY */}
      {selectedDutyForEdit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 4px 0" }}>
              {isUrdu ? "ڈیوٹی میں ترمیم یا منسوخی" : "Edit / Cancel Duty"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
              {selectedDutyForEdit.full_name} ({selectedDutyForEdit.emp_number}) | {selectedDutyForEdit.roster_date}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "شعبہ:" : "Duty Area:"}
                </label>
                <select
                  value={editDutyArea}
                  onChange={e => setEditDutyArea(e.target.value as any)}
                  data-help="support_roster.select_edit_duty_area"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="Facility">{isUrdu ? "ہسپتال کا احاطہ / زون" : "Facility / Zone"}</option>
                  <option value="Ward">{isUrdu ? "وارڈ" : "Ward"}</option>
                  <option value="Emergency">{isUrdu ? "ایمرجنسی" : "Emergency"}</option>
                  <option value="OT">{isUrdu ? "آپریشن تھیٹر" : "OT"}</option>
                  <option value="Department">{isUrdu ? "ڈیپارٹمنٹ" : "Department"}</option>
                  <option value="Other">{isUrdu ? "دیگر" : "Other"}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "مقام / زون لیبل:" : "Zone / Gate Label:"}
                </label>
                <>{editDutyArea==='Ward'&&<label>Ward / وارڈ<DirectoryPicker path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" value={editWard} onChange={e=>setEditWard(e.target.value)} data-help="support_roster.input_edit_zone_label"/></label>}{editDutyArea==='Department'&&<label>Department / شعبہ<DirectoryPicker path="/admin/departments" idField="department_id" value={editDepartment} onChange={e=>setEditDepartment(e.target.value)} data-help="support_roster.input_edit_zone_label"/></label>}<input
                  type="text"
                  value={editZoneLabel}
                  onChange={e => setEditZoneLabel(e.target.value)}
                  data-help="support_roster.input_edit_zone_label"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                /></>
              </div>
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editIsOnCall}
                  onChange={e => setEditIsOnCall(e.target.checked)}
                  data-help="support_roster.check_edit_on_call"
                />
                <span>{isUrdu ? "آن کال ڈیوٹی ہے" : "Is On-Call Duty"}</span>
              </label>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "نوٹس:" : "Notes:"}
              </label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                data-help="support_roster.textarea_edit_notes"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleUpdateDuty}
                disabled={actionLoading}
                data-help="support_roster.btn_save_duty_edit"
                style={{ backgroundColor: "#28a745", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "4px", cursor: "pointer" }}
              >
                {isUrdu ? "ترمیم محفوظ کریں" : "Update Duty"}
              </button>
            </div>

            {/* Cancel Section */}
            <div style={{ borderTop: "1px solid #eee", paddingTop: "12px", marginTop: "8px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#dc3545", marginBottom: "4px" }}>
                {isUrdu ? "ڈیوٹی منسوخ کریں (آپریشنل وجہ لازمی ہے):" : "Cancel Duty (Operational Reason Required):"}
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={e => setCancelReasonInput(e.target.value)}
                placeholder={isUrdu ? "منسوخی کی وجہ..." : "Reason for cancellation..."}
                data-help="support_roster.input_cancel_reason"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "8px" }}
              />
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelDuty}
                disabled={actionLoading || cancelReasonInput.trim().length < 3}
                data-help="support_roster.btn_confirm_cancel_duty"
                style={{
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: cancelReasonInput.trim().length >= 3 ? "pointer" : "not-allowed"
                }}
              >
                {isUrdu ? "ڈیوٹی منسوخ کریں" : "Confirm Cancellation"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedDutyForEdit(null)}
                data-help="support_roster.btn_close_edit_modal"
              >
                {isUrdu ? "بند کریں" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: COPY PERIOD (RULE rule:f72ed8bfcb) */}
      {showCopyModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>
              {isUrdu ? "روسٹر ہفتہ نقل کریں (دہرائیں)" : "Duplicate Roster Week"}
            </h3>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "ماخذ ہفتہ:" : "Source Week (Starting Monday):"}
              </label>
              <input
                type="date"
                value={selectedMonday}
                disabled
                data-help="support_roster.input_copy_source_week"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "#f5f5f5" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "ہدف ہفتہ (پیر کی تاریخ):" : "Target Week (Target Monday):"}
              </label>
              <input
                type="date"
                value={copyTargetWeek}
                onChange={e => setCopyTargetWeek(e.target.value)}
                data-help="support_roster.input_copy_target_week"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "شفٹ روٹیشن (دن آگے بڑھائیں):" : "Rotation (Shift Days Forward):"}
              </label>
              <select
                value={copyRotateDays}
                onChange={e => setCopyRotateDays(Number(e.target.value))}
                data-help="support_roster.select_copy_rotation"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value={0}>{isUrdu ? "بغیر تبدیلی یکساں دہرائیں (0 دن)" : "Exact Duplicate (0 days)"}</option>
                <option value={1}>{isUrdu ? "ایک دن آگے روٹیٹ کریں (1 دن - منصفانہ اتوار تقسیم)" : "Rotate +1 day (Fair Sunday distribution)"}</option>
              </select>
            </div>

            {lastCopyResult && (
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  padding: "8px",
                  borderRadius: "4px",
                  fontSize: "0.8rem"
                }}
              >
                <strong>{isUrdu ? "نقل کا نتیجہ:" : "Copy Result:"}</strong> {lastCopyResult.copied} {isUrdu ? "ڈیوٹیاں نقل ہوئیں" : "duties copied"}
                {lastCopyResult.skipped.length > 0 && (
                  <div style={{ color: "#856404", marginTop: "4px" }}>
                    ⚠️ {lastCopyResult.skipped.length} {isUrdu ? "ڈیوٹیاں تنازع کی وجہ سے چھوڑی گئیں" : "duties skipped due to conflicts"}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setShowCopyModal(false);
                  setLastCopyResult(null);
                }}
                data-help="support_roster.btn_close_copy_modal"
              >
                {isUrdu ? "بند کریں" : "Close"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyPeriod}
                disabled={actionLoading || !copyTargetWeek}
                data-help="support_roster.btn_confirm_copy_period"
                style={{ backgroundColor: "var(--primary-color, #0056b3)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: copyTargetWeek ? "pointer" : "not-allowed" }}
              >
                {actionLoading ? (isUrdu ? "نقل ہو رہا ہے..." : "Copying...") : (isUrdu ? "ہفتہ نقل کریں" : "Duplicate Week")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD VERBAL SWAP (RULE rule:83718fc56e) */}
      {showRecordSwapModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>
              {isUrdu ? "معاون عملے کا زبانی تبادلہ درج کریں" : "Record Verbal Shift Swap"}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
              {isUrdu
                ? "معاون عملہ لاگ ان نہیں کرتا: جب دو ساتھی باہم متفق ہوں تو سپروائزر ان کا تبادلہ یہاں درج کرتا ہے۔"
                : "Support staff do not log in. Record the agreed verbal swap here."}
            </p>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "درخواست کنندہ ملازم:" : "Proposing Staff Member:"}
              </label>
              <select
                value={swapProposerId}
                onChange={e => {
                  const id = Number(e.target.value);
                  setSwapProposerId(id);
                  const firstDuty = entries.find(d => d.employee_id === id);
                  if (firstDuty) setSwapProposerDutyId(firstDuty.roster_id);
                }}
                data-help="support_roster.select_swap_proposer"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value={0}>{isUrdu ? "-- ملازم منتخب کریں --" : "-- Select Employee --"}</option>
                {filteredStaff.map(s => (
                  <option key={s.employee_id} value={s.employee_id}>
                    {s.full_name} ({s.emp_number})
                  </option>
                ))}
              </select>
            </div>

            {swapProposerId > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "درخواست کنندہ کی ڈیوٹی:" : "Duty to Swap Out:"}
                </label>
                <select
                  value={swapProposerDutyId}
                  onChange={e => setSwapProposerDutyId(Number(e.target.value))}
                  data-help="support_roster.select_swap_proposer_duty"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  {entries
                    .filter(d => d.employee_id === swapProposerId)
                    .map(d => (
                      <option key={d.roster_id} value={d.roster_id}>
                        {d.roster_date} - {d.shift_name} ({d.zone_label || d.duty_area})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "متبادل ملازم:" : "Covering Staff Member:"}
              </label>
              <select
                value={swapReceiverId}
                onChange={e => {
                  const id = Number(e.target.value);
                  setSwapReceiverId(id);
                  const firstDuty = entries.find(d => d.employee_id === id);
                  if (firstDuty) setSwapReceiverDutyId(firstDuty.roster_id);
                }}
                data-help="support_roster.select_swap_receiver"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value={0}>{isUrdu ? "-- ملازم منتخب کریں --" : "-- Select Employee --"}</option>
                {filteredStaff
                  .filter(s => s.employee_id !== swapProposerId)
                  .map(s => (
                    <option key={s.employee_id} value={s.employee_id}>
                      {s.full_name} ({s.emp_number})
                    </option>
                  ))}
              </select>
            </div>

            {swapReceiverId > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  {isUrdu ? "متبادل ملازم کی ڈیوٹی:" : "Duty to Take Over:"}
                </label>
                <select
                  value={swapReceiverDutyId}
                  onChange={e => setSwapReceiverDutyId(Number(e.target.value))}
                  data-help="support_roster.select_swap_receiver_duty"
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  {entries
                    .filter(d => d.employee_id === swapReceiverId)
                    .map(d => (
                      <option key={d.roster_id} value={d.roster_id}>
                        {d.roster_date} - {d.shift_name} ({d.zone_label || d.duty_area})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "تبادلہ کی وجہ:" : "Reason:"}
              </label>
              <input
                type="text"
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                placeholder={isUrdu ? "مثال: گھریلو مجبوری، باہمی رضامندی" : "e.g. Mutual verbal agreement"}
                data-help="support_roster.input_swap_reason"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRecordSwapModal(false)}
                data-help="support_roster.btn_close_swap_modal"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRecordVerbalSwap}
                disabled={actionLoading || !swapProposerDutyId || !swapReceiverDutyId}
                data-help="support_roster.btn_confirm_record_swap"
                style={{ backgroundColor: "var(--primary-color, #0056b3)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}
              >
                {actionLoading ? (isUrdu ? "درج ہو رہا ہے..." : "Recording...") : (isUrdu ? "تبادلہ درج کریں" : "Record Swap")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REJECT SWAP REASON */}
      {rejectingSwapId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "450px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>
              {isUrdu ? "ڈیوٹی تبادلہ مسترد کریں" : "Reject Duty Swap"}
            </h3>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                {isUrdu ? "مسترد کرنے کی آپریشنل وجہ (کم از کم 3 حروف):" : "Operational Rejection Reason (min 3 chars):"}
              </label>
              <textarea
                value={rejectReasonInput}
                onChange={e => setRejectReasonInput(e.target.value)}
                rows={3}
                placeholder={isUrdu ? "مسترد کرنے کی وجہ درج کریں..." : "Enter operational justification..."}
                data-help="support_roster.textarea_reject_swap_reason"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setRejectingSwapId(null);
                  setRejectReasonInput("");
                }}
                data-help="support_roster.btn_cancel_reject_swap"
              >
                {isUrdu ? "منسوخ" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRejectSwap}
                disabled={actionLoading || rejectReasonInput.trim().length < 3}
                data-help="support_roster.btn_confirm_reject_swap"
                style={{ backgroundColor: "#dc3545", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: rejectReasonInput.trim().length >= 3 ? "pointer" : "not-allowed" }}
              >
                {isUrdu ? "مسترد کریں" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportRoster;
