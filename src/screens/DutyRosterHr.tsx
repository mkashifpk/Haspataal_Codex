import {DirectoryPicker} from "../DirectoryPicker";
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  shiftPatterns,
  createShiftPattern,
  type RosterRangeOut,
  type RosterEntryOut,
  type RosterPlannerOut,
  type ShiftPatternOut,
  type RosterableStaffOut,
  type RosterWeekOut,
  type DutySwapOut,
  type EntryIn,
  type CopyIn,
  type SwapIn,
  type ShiftPatternIn,
  type RosterCopyOut,
} from "../generated/duty_roster_hr";
import {
  getDutyRosterCapabilityView,
  getWeekDates,
  isStaffOnLeave,
  isStaffDefaultWeeklyOff,
  isPublicHoliday,
  validateCancelDuty,
  validateCopyPeriod,
  validateRecordSwap,
  validateShiftPattern,
  canUserApproveSwap,
  DUTY_ROSTER_ERROR_MESSAGES,
  type DayColInfo,
} from "../duty-roster-policy";

export interface DutyRosterHrProps {
  establishment?: any;
  user?: {
    user_id?: number;
    employee_id?: number | null;
    username?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
  };
  connected?: boolean;
  timeZone?: string;
  onNavigateScreen?: (screen: string) => void;
  onOpenHelp?: (topic?: string) => void;
}

export const DutyRosterHr: React.FC<DutyRosterHrProps> = ({
  establishment,
  user,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
  onOpenHelp,
}) => {
  // Capability view
  const capability = useMemo(
    () => getDutyRosterCapabilityView(establishment),
    [establishment]
  );

  // Active view tab: planner, swaps, patterns, week_check
  const [activeTab, setActiveTab] = useState<"planner" | "swaps" | "patterns" | "week_check">("planner");

  // Week date state (Monday to Sunday)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const weekInfo = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  // Filters
  const [staffCategoryFilter, setStaffCategoryFilter] = useState<string>("All");
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");
  const [swapStatusFilter, setSwapStatusFilter] = useState<string>("All");

  // Planner data
  const [plannerData, setPlannerData] = useState<RosterPlannerOut | null>(null);
  const [rosterEntries, setRosterEntries] = useState<RosterEntryOut[]>([]);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(false);
  const [gridError, setGridError] = useState<string | null>(null);

  // Swaps data
  const [swapsList, setSwapsList] = useState<DutySwapOut[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState<boolean>(false);
  const [swapActionFeedback, setSwapActionFeedback] = useState<string | null>(null);

  // Shift Patterns data
  const [patternsList, setPatternsList] = useState<ShiftPatternOut[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState<boolean>(false);

  // Week Check data
  const [weekAudit, setWeekAudit] = useState<RosterWeekOut | null>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addEntryDraft, setAddEntryDraft] = useState<{
    employee_id: number;
    roster_date: string;
    shift_pattern_id: number;
    duty_area: "Ward" | "Department" | "Emergency" | "OT" | "Facility" | "Other";
    ward_id: string;
    department_id?: string;
    zone_label: string;
    notes: string;
    is_on_call: boolean;
  }>({
    employee_id: 0,
    roster_date: selectedDate,
    shift_pattern_id: 0,
    duty_area: "Facility",
    ward_id: "",
    zone_label: "",
    notes: "",
    is_on_call: false,
  });

  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<RosterEntryOut | null>(null);
  const [editNotes, setEditNotes] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [showCancelSection, setShowCancelSection] = useState<boolean>(false);

  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [copyRotateDays, setCopyRotateDays] = useState<number>(0);
  const [copyFeedback, setCopyFeedback] = useState<RosterCopyOut | null>(null);

  const [showPatternModal, setShowPatternModal] = useState<boolean>(false);
  const [newPattern, setNewPattern] = useState<ShiftPatternIn>({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    grace_minutes: 15,
    half_day_after_minutes: 240,
  });

  const [showRecordSwapModal, setShowRecordSwapModal] = useState<boolean>(false);
  const [swapDraft, setSwapDraft] = useState<SwapIn>({
    roster_id: 0,
    covering_employee_id: 0,
    reason: "",
  });

  // Fetch Planner Grid & Entries (GET /rosters/staff, GET /rosters)
  const loadPlannerData = useCallback(async () => {
    setLoadingGrid(true);
    setGridError(null);
    try {
      const categoryParam =
        staffCategoryFilter !== "All"
          ? (staffCategoryFilter as any)
          : undefined;

      const [plannerRes, entriesRes] = await Promise.all([
        staffRosters({
          date_from: weekInfo.weekStart,
          date_to: weekInfo.weekEnd,
          staff_category: categoryParam,
          q: staffSearchQuery.trim() || undefined,
        }),
        listEntriesRosters({
          date_from: weekInfo.weekStart,
          date_to: weekInfo.weekEnd,
          staff_category: categoryParam,
        }),
      ]);

      setPlannerData(plannerRes);
      setRosterEntries(entriesRes.entries || []);
    } catch (err: any) {
      console.error("Failed to load duty planner:", err);
      const code = err?.code || "NETWORK_ERROR";
      const msg = DUTY_ROSTER_ERROR_MESSAGES[code]?.en || err?.message || "Error loading duty roster.";
      setGridError(msg);
    } finally {
      setLoadingGrid(false);
    }
  }, [weekInfo.weekStart, weekInfo.weekEnd, staffCategoryFilter, staffSearchQuery]);

  // Fetch Duty Swaps (GET /rosters/swaps)
  const loadSwaps = useCallback(async () => {
    setLoadingSwaps(true);
    try {
      const statusParam = swapStatusFilter !== "All" ? (swapStatusFilter as any) : undefined;
      const swaps = await managerSwaps({ status: statusParam });
      setSwapsList(swaps);
    } catch (err: any) {
      console.error("Failed to load duty swaps:", err);
    } finally {
      setLoadingSwaps(false);
    }
  }, [swapStatusFilter]);

  // Fetch Shift Patterns (GET /hr/shift-patterns)
  const loadPatterns = useCallback(async () => {
    setLoadingPatterns(true);
    try {
      const patterns = await shiftPatterns();
      setPatternsList(patterns);
    } catch (err: any) {
      console.error("Failed to load shift patterns:", err);
    } finally {
      setLoadingPatterns(false);
    }
  }, []);

  // Fetch Week Check Audit (GET /rosters/week)
  const loadWeekCheck = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const categoryParam =
        staffCategoryFilter !== "All"
          ? (staffCategoryFilter as any)
          : undefined;
      const res = await weekCheck({
        week_of: weekInfo.weekStart,
        staff_category: categoryParam,
      });
      setWeekAudit(res);
    } catch (err: any) {
      console.error("Failed to load week audit:", err);
    } finally {
      setLoadingAudit(false);
    }
  }, [weekInfo.weekStart, staffCategoryFilter]);

  // Initial & Tab Change Loading
  useEffect(() => {
    if (activeTab === "planner") {
      void loadPlannerData();
    } else if (activeTab === "swaps") {
      void loadSwaps();
    } else if (activeTab === "patterns") {
      void loadPatterns();
    } else if (activeTab === "week_check") {
      void loadWeekCheck();
    }
  }, [activeTab, loadPlannerData, loadSwaps, loadPatterns, loadWeekCheck]);

  // Realtime events listener (Rule rule:6e21482f49)
  useEffect(() => {
    const handleRosterChanged = (e: any) => {
      console.log("Realtime event received: roster.changed", e);
      if (activeTab === "planner") void loadPlannerData();
      if (activeTab === "week_check") void loadWeekCheck();
    };

    const handleSwapUpdated = (e: any) => {
      console.log("Realtime event received: roster.swap.updated", e);
      if (activeTab === "swaps") void loadSwaps();
    };

    window.addEventListener("roster.changed", handleRosterChanged);
    window.addEventListener("roster.swap.updated", handleSwapUpdated);

    return () => {
      window.removeEventListener("roster.changed", handleRosterChanged);
      window.removeEventListener("roster.swap.updated", handleSwapUpdated);
    };
  }, [activeTab, loadPlannerData, loadWeekCheck, loadSwaps]);

  // Week Navigation
  const handlePrevWeek = () => {
    const d = new Date(weekInfo.weekStart);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(weekInfo.weekStart);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleCurrentWeek = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // Open Add Duty Modal for a specific day and pattern
  const handleOpenAddForCell = (date: string, patternId: number) => {
    setAddEntryDraft({
      employee_id: plannerData?.staff?.[0]?.employee_id || 0,
      roster_date: date,
      shift_pattern_id: patternId,
      duty_area: "Facility",
      ward_id: "",
      zone_label: "",
      notes: "",
      is_on_call: false,
    });
    setShowAddModal(true);
  };

  // Submit Single Duty (POST /rosters)
  const handleSaveDutySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEntryDraft.employee_id || !addEntryDraft.shift_pattern_id) {
      alert("Please select staff member and shift pattern.");
      return;
    }

    try {
      const entry: EntryIn = {
        employee_id: addEntryDraft.employee_id,
        roster_date: addEntryDraft.roster_date,
        shift_pattern_id: addEntryDraft.shift_pattern_id,
        duty_area: addEntryDraft.duty_area,
        ward_id: addEntryDraft.ward_id ? Number(addEntryDraft.ward_id) : undefined,
        department_id: addEntryDraft.department_id ? Number(addEntryDraft.department_id) : undefined,
        zone_label: addEntryDraft.zone_label.trim() || undefined,
        notes: addEntryDraft.notes.trim() || undefined,
        is_on_call: addEntryDraft.is_on_call,
      };

      await createEntries({ entries: [entry] });
      setShowAddModal(false);
      void loadPlannerData();
    } catch (err: any) {
      console.error("Save duty error:", err);
      const code = err?.code || "ROSTER_CONFLICT";
      const msg = DUTY_ROSTER_ERROR_MESSAGES[code]?.en || err?.message || "Failed to roster duty.";
      alert(msg);
    }
  };

  // Open Edit Duty Modal (Rule rule:e255d6b71a)
  const handleOpenEditEntry = (entry: RosterEntryOut) => {
    setSelectedEntry(entry);
    setEditNotes(entry.notes || "");
    setCancelReason("");
    setShowCancelSection(false);
    setShowEditModal(true);
  };

  // Update Duty (PATCH /rosters/{id})
  const handleUpdateEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    try {
      await updateEntryRosters(selectedEntry.roster_id, {
        expected_version: selectedEntry.row_version,
        notes: editNotes.trim() || undefined,
      });
      setShowEditModal(false);
      void loadPlannerData();
    } catch (err: any) {
      console.error("Update entry error:", err);
      const code = err?.code || "VERSION_CONFLICT";
      alert(DUTY_ROSTER_ERROR_MESSAGES[code]?.en || err?.message || "Update failed.");
    }
  };

  // Cancel Duty (POST /rosters/{id}/cancel, Rule rule:e255d6b71a)
  const handleCancelEntrySubmit = async () => {
    if (!selectedEntry) return;
    const validation = validateCancelDuty(cancelReason);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      await cancelEntry(selectedEntry.roster_id, { reason: cancelReason.trim() });
      setShowEditModal(false);
      void loadPlannerData();
    } catch (err: any) {
      console.error("Cancel entry error:", err);
      alert(err?.message || "Failed to cancel duty.");
    }
  };

  // Copy Period / Repeat Last Week (POST /rosters/copy, Rule rule:f72ed8bfcb)
  const handleCopyPeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Previous week source
    const srcStart = new Date(weekInfo.weekStart);
    srcStart.setDate(srcStart.getDate() - 7);
    const srcEnd = new Date(weekInfo.weekEnd);
    srcEnd.setDate(srcEnd.getDate() - 7);

    const copyInput: CopyIn = {
      source_from: srcStart.toISOString().split("T")[0],
      source_to: srcEnd.toISOString().split("T")[0],
      target_from: weekInfo.weekStart,
      rotate_days: copyRotateDays,
    };

    const validation = validateCopyPeriod(copyInput);
    if (!validation.valid) {
      alert(Object.values(validation.errors).join("\n"));
      return;
    }

    try {
      const res = await copyPeriod(copyInput);
      setCopyFeedback(res);
      void loadPlannerData();
    } catch (err: any) {
      console.error("Copy period error:", err);
      alert(err?.message || "Failed to repeat roster from last week.");
    }
  };

  // Create Shift Pattern (POST /hr/shift-patterns, Rule rule:f0c97c644e)
  const handleCreatePatternSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateShiftPattern(newPattern);
    if (!validation.valid) {
      alert(Object.values(validation.errors).join("\n"));
      return;
    }

    try {
      await createShiftPattern(newPattern);
      setShowPatternModal(false);
      setNewPattern({
        name: "",
        start_time: "08:00",
        end_time: "16:00",
        grace_minutes: 15,
        half_day_after_minutes: 240,
      });
      if (activeTab === "patterns") void loadPatterns();
      if (activeTab === "planner") void loadPlannerData();
    } catch (err: any) {
      console.error("Create pattern error:", err);
      alert(err?.message || "Failed to create shift pattern.");
    }
  };

  // Record Verbal Swap (POST /rosters/swaps, Rule rule:83718fc56e)
  const handleRecordSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRecordSwap(swapDraft);
    if (!validation.valid) {
      alert(Object.values(validation.errors).join("\n"));
      return;
    }

    try {
      await recordSwap(swapDraft);
      setShowRecordSwapModal(false);
      setSwapDraft({ roster_id: 0, covering_employee_id: 0, reason: "" });
      void loadSwaps();
    } catch (err: any) {
      console.error("Record swap error:", err);
      alert(err?.message || "Failed to record duty swap.");
    }
  };

  // Approve Duty Swap (POST /rosters/swaps/{id}/approve)
  const handleApproveSwap = async (swap: DutySwapOut) => {
    if (!canUserApproveSwap(swap, user?.employee_id)) {
      alert(DUTY_ROSTER_ERROR_MESSAGES.SWAP_SELF_APPROVAL.en);
      return;
    }

    try {
      await approveSwap(swap.swap_id, { note: "Approved by HR administration." });
      setSwapActionFeedback(`Duty swap #${swap.swap_id} approved.`);
      void loadSwaps();
    } catch (err: any) {
      console.error("Approve swap error:", err);
      alert(err?.message || "Failed to approve swap.");
    }
  };

  // Reject Duty Swap (POST /rosters/swaps/{id}/reject)
  const handleRejectSwap = async (swap: DutySwapOut) => {
    const note = prompt("Enter mandatory rejection reason:", "Operational shift conflict.");
    if (!note || note.trim().length < 3) {
      alert("Rejection note is required (minimum 3 characters).");
      return;
    }

    try {
      await rejectSwap(swap.swap_id, { note: note.trim() });
      setSwapActionFeedback(`Duty swap #${swap.swap_id} rejected.`);
      void loadSwaps();
    } catch (err: any) {
      console.error("Reject swap error:", err);
      alert(err?.message || "Failed to reject swap.");
    }
  };

  return (
    <div className="container-fluid py-3 duty-roster-hr-workspace">
      {/* Header Context Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-2 mb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h4 className="mb-0 fw-bold text-dark">Staff Duty Rosters & Shift Patterns</h4>
            <span className="badge bg-primary">Workspace HR &bull; Position 148</span>
            <span className={`badge ${connected ? "bg-success" : "bg-danger"}`}>
              {connected ? "Realtime Live" : "Offline"}
            </span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Weekly 7-day duty planning, shift patterns, swap authorisations, public holidays, and statutory rest day audits.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
          {/* Week Navigation Buttons */}
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handlePrevWeek}
              data-help="duty_roster_hr.nav_prev_week"
              title="Previous 7-Day Cycle"
            >
              &larr; Prev Week
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleCurrentWeek}
              data-help="duty_roster_hr.nav_current_week"
            >
              This Week
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleNextWeek}
              data-help="duty_roster_hr.nav_next_week"
              title="Next 7-Day Cycle"
            >
              Next Week &rarr;
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onOpenHelp?.("duty_roster_hr")}
            data-help="duty_roster_hr.btn_f1_help"
            title="Press F1 for Duty Roster Handbook & FAQs"
          >
            F1 Help
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              if (activeTab === "planner") void loadPlannerData();
              if (activeTab === "swaps") void loadSwaps();
              if (activeTab === "patterns") void loadPatterns();
              if (activeTab === "week_check") void loadWeekCheck();
            }}
            data-help="duty_roster_hr.btn_refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Facility Capability Warning Banner */}
      {capability.noticeEn && (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center justify-content-between" role="alert">
          <div>
            <strong>Facility Mode: </strong>
            <span>{capability.noticeEn}</span>
          </div>
          <span className="badge bg-dark text-white text-uppercase">{capability.mode}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "planner" ? "active fw-bold" : "text-secondary"}`}
            onClick={() => setActiveTab("planner")}
            data-help="duty_roster_hr.tab_planner"
          >
            📅 Weekly Planner Grid ({weekInfo.weekStart} &mdash; {weekInfo.weekEnd})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "swaps" ? "active fw-bold" : "text-secondary"}`}
            onClick={() => setActiveTab("swaps")}
            data-help="duty_roster_hr.tab_swaps"
          >
            🔄 Duty Swaps & Covers
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "patterns" ? "active fw-bold" : "text-secondary"}`}
            onClick={() => setActiveTab("patterns")}
            data-help="duty_roster_hr.tab_patterns"
          >
            ⏰ Shift Patterns Directory
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "week_check" ? "active fw-bold" : "text-secondary"}`}
            onClick={() => setActiveTab("week_check")}
            data-help="duty_roster_hr.tab_week_check"
          >
            📊 Week Check & Rest Audit
          </button>
        </li>
      </ul>

      {/* TAB 1: WEEKLY PLANNER GRID */}
      {activeTab === "planner" && (
        <div>
          {/* Controls Bar: Filters & Actions */}
          <div className="card shadow-sm mb-3 border-light">
            <div className="card-body py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="small fw-semibold text-secondary">Filter Category:</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={staffCategoryFilter}
                  onChange={(e) => setStaffCategoryFilter(e.target.value)}
                  data-help="duty_roster_hr.select_category"
                >
                  <option value="All">All Staff Categories</option>
                  <option value="Nursing">Nursing</option>
                  <option value="Clinical">Clinical / Doctors</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Technical">Technical / Lab</option>
                  <option value="SupportZeroInterface">Support / Janitorial</option>
                  <option value="Visiting">Visiting Consultants</option>
                </select>

                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search staff name or #..."
                  style={{ width: "200px" }}
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  data-help="duty_roster_hr.input_search_staff"
                />
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info"
                  onClick={() => setShowCopyModal(true)}
                  disabled={!capability.canCopyRoster}
                  data-help="duty_roster_hr.btn_open_copy_modal"
                  title="Repeat last week's duties (POST /rosters/copy)"
                >
                  Repeat Last Week (rule:f72ed8bfcb)
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => setShowPatternModal(true)}
                  disabled={!capability.canManageShiftPatterns}
                  data-help="duty_roster_hr.btn_open_pattern_modal"
                >
                  + New Shift Pattern
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setAddEntryDraft({
                      employee_id: plannerData?.staff?.[0]?.employee_id || 0,
                      roster_date: selectedDate,
                      shift_pattern_id: plannerData?.shift_patterns?.[0]?.shift_pattern_id || 0,
                      duty_area: "Facility",
                      ward_id: "",
                      zone_label: "",
                      notes: "",
                      is_on_call: false,
                    });
                    setShowAddModal(true);
                  }}
                  disabled={!capability.canManageRoster}
                  data-help="duty_roster_hr.btn_open_add_duty"
                >
                  + Assign Duty (POST /rosters)
                </button>
              </div>
            </div>
          </div>

          {gridError && (
            <div className="alert alert-danger py-2 mb-3" role="alert">
              <strong>Error: </strong>
              <span>{gridError}</span>
            </div>
          )}

          {loadingGrid ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-2" role="status" />
              <div className="text-muted small">Loading duty planner grid and staff schedules...</div>
            </div>
          ) : (
            <div className="card shadow-sm border-0">
              <div className="table-responsive">
                <table className="table table-bordered align-middle mb-0" style={{ minWidth: "900px" }}>
                  {/* Grid Column Headers: 7 days of the week */}
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "180px" }} className="text-secondary small text-uppercase">
                        Shift Pattern (rule:f0c97c644e)
                      </th>
                      {weekInfo.days.map((d: DayColInfo) => {
                        const holiday = isPublicHoliday(plannerData?.holidays, d.date);
                        return (
                          <th
                            key={d.date}
                            className={`text-center ${
                              d.isSunday
                                ? "bg-light-subtle border-start border-end border-2"
                                : d.isToday
                                ? "bg-primary-subtle"
                                : ""
                            }`}
                            style={{ minWidth: "120px" }}
                          >
                            <div className="fw-bold fs-6">
                              {d.dayName}{" "}
                              <span className="text-muted small">({d.dayNumber})</span>
                            </div>
                            <div className="text-muted small">{d.dayNameUr}</div>
                            {holiday.isHoliday && (
                              <span
                                className="badge bg-warning text-dark mt-1"
                                style={{ fontSize: "10px" }}
                                title="Public Holiday (rule:2e75984ff7)"
                              >
                                🎈 {holiday.name}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Grid Rows: One row per shift pattern (Rule rule:50af6ba770) */}
                  <tbody>
                    {!plannerData?.shift_patterns || plannerData.shift_patterns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted">
                          No shift patterns defined. Create a shift pattern using "+ New Shift Pattern" above.
                        </td>
                      </tr>
                    ) : (
                      plannerData.shift_patterns.map((sp: ShiftPatternOut) => (
                        <tr key={sp.shift_pattern_id}>
                          {/* Row Header: Pattern Name & Timings */}
                          <td className="bg-light fw-semibold">
                            <div className="text-dark">{sp.name}</div>
                            <div className="font-monospace small text-primary" style={{ fontSize: "11px" }}>
                              {sp.start_time} &mdash; {sp.end_time}
                            </div>
                            {sp.start_time > sp.end_time && (
                              <span className="badge bg-dark mt-1" style={{ fontSize: "9px" }}>
                                🌙 Overnight
                              </span>
                            )}
                          </td>

                          {/* 7 Day Cells */}
                          {weekInfo.days.map((d: DayColInfo) => {
                            // Find all active entries for this date & pattern
                            const cellEntries = rosterEntries.filter(
                              (re) =>
                                re.roster_date === d.date &&
                                re.shift_pattern_id === sp.shift_pattern_id &&
                                re.status === "Active"
                            );

                            return (
                              <td
                                key={d.date}
                                className={`p-1 align-top ${d.isSunday ? "bg-light-subtle" : ""}`}
                                style={{ minHeight: "80px" }}
                              >
                                <div className="d-flex flex-column gap-1">
                                  {cellEntries.map((entry) => (
                                    <div
                                      key={entry.roster_id}
                                      className="p-1 rounded border bg-white shadow-sm cursor-pointer"
                                      onClick={() => handleOpenEditEntry(entry)}
                                      title="Click to edit or cancel duty (rule:e255d6b71a)"
                                      style={{ fontSize: "11px", cursor: "pointer" }}
                                    >
                                      <div className="d-flex justify-content-between align-items-center">
                                        <strong className="text-dark text-truncate">{entry.full_name}</strong>
                                        {entry.is_on_call && <span title="On-Call">⭐</span>}
                                      </div>
                                      <div className="text-muted text-truncate" style={{ fontSize: "10px" }}>
                                        {entry.designation}
                                      </div>
                                      {entry.ward_name && (
                                        <span className="badge bg-info-subtle text-info border" style={{ fontSize: "9px" }}>
                                          {entry.ward_name}
                                        </span>
                                      )}
                                      {entry.swap_id && (
                                        <span className="badge bg-success-subtle text-success border ms-1" style={{ fontSize: "9px" }}>
                                          Swap #{entry.swap_id}
                                        </span>
                                      )}
                                    </div>
                                  ))}

                                  {/* Quick assign button on cell */}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border border-dashed text-secondary py-0 px-1 mt-1 text-center w-100"
                                    onClick={() => handleOpenAddForCell(d.date, sp.shift_pattern_id)}
                                    disabled={!capability.canManageRoster}
                                    data-help="duty_roster_hr.duty_cell_assign"
                                    style={{ fontSize: "10px" }}
                                  >
                                    + Assign
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Summary Footer: Staff counts per day (Rule rule:fb45bf026f) */}
                  <tfoot className="table-light">
                    <tr>
                      <td className="fw-bold small text-secondary">
                        Staff on Duty (Total)
                      </td>
                      {weekInfo.days.map((d: DayColInfo) => {
                        const totalOnDay = rosterEntries.filter(
                          (re) => re.roster_date === d.date && re.status === "Active"
                        ).length;
                        return (
                          <td key={d.date} className="text-center fw-bold text-dark small">
                            <span className={`badge ${totalOnDay === 0 ? "bg-warning text-dark" : "bg-primary"}`}>
                              {totalOnDay} staff
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DUTY SWAPS & COVERS */}
      {activeTab === "swaps" && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <strong className="text-dark small text-uppercase">
                Staff Duty Swaps & Cover Requests (Rule rule:83718fc56e)
              </strong>
              <select
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={swapStatusFilter}
                onChange={(e) => setSwapStatusFilter(e.target.value)}
                data-help="duty_roster_hr.select_swap_filter"
              >
                <option value="All">All Swap Statuses</option>
                <option value="Accepted">Accepted (Awaiting Approval)</option>
                <option value="Requested">Requested (Waiting Colleague)</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowRecordSwapModal(true)}
              disabled={!capability.canManageSwaps}
              data-help="duty_roster_hr.btn_open_record_swap"
            >
              + Record Verbal Swap (POST /rosters/swaps)
            </button>
          </div>

          <div className="card-body p-0">
            {swapActionFeedback && (
              <div className="alert alert-success m-3 py-2 small" role="alert">
                {swapActionFeedback}
              </div>
            )}

            {loadingSwaps ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-2" role="status" />
                <div className="text-muted small">Loading duty swaps and covers...</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Swap #</th>
                      <th>Kind</th>
                      <th>Requester</th>
                      <th>Covering Colleague</th>
                      <th>Shift & Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swapsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted">
                          No duty swap records found for this filter.
                        </td>
                      </tr>
                    ) : (
                      swapsList.map((sw: DutySwapOut) => (
                        <tr key={sw.swap_id}>
                          <td className="fw-bold font-monospace">#{sw.swap_id}</td>
                          <td>
                            <span className="badge bg-light text-dark border">{sw.kind}</span>
                          </td>
                          <td>
                            <strong>{sw.requester_name}</strong>
                          </td>
                          <td>
                            <strong>{sw.covering_name}</strong>
                          </td>
                          <td>
                            <div>{sw.duty?.roster_date}</div>
                            <span className="small text-muted">{sw.duty?.shift_name}</span>
                          </td>
                          <td className="small text-muted">{sw.reason}</td>
                          <td>
                            <span
                              className={`badge ${
                                sw.status === "Approved"
                                  ? "bg-success"
                                  : sw.status === "Accepted"
                                  ? "bg-warning text-dark"
                                  : sw.status === "Rejected"
                                  ? "bg-danger"
                                  : "bg-secondary"
                              }`}
                            >
                              {sw.status}
                            </span>
                          </td>
                          <td className="text-end">
                            {sw.status === "Accepted" && (
                              <div className="d-flex justify-content-end gap-1">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleApproveSwap(sw)}
                                  disabled={!capability.canManageSwaps}
                                  data-help="duty_roster_hr.btn_approve_swap"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleRejectSwap(sw)}
                                  disabled={!capability.canManageSwaps}
                                  data-help="duty_roster_hr.btn_reject_swap"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHIFT PATTERNS DIRECTORY */}
      {activeTab === "patterns" && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
            <strong className="text-dark small text-uppercase">
              Hospital Shift Patterns & Duty Timing Windows (Rule rule:f0c97c644e)
            </strong>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowPatternModal(true)}
              disabled={!capability.canManageShiftPatterns}
              data-help="duty_roster_hr.btn_open_pattern_modal"
            >
              + Create Shift Pattern (POST /hr/shift-patterns)
            </button>
          </div>

          <div className="card-body p-0">
            {loadingPatterns ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-2" role="status" />
                <div className="text-muted small">Loading shift pattern catalogue...</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Pattern ID</th>
                      <th>Pattern Name</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Grace Window</th>
                      <th>Half Day After</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patternsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-5 text-muted">
                          No shift patterns defined in database.
                        </td>
                      </tr>
                    ) : (
                      patternsList.map((p) => (
                        <tr key={p.shift_pattern_id}>
                          <td className="font-monospace">#{p.shift_pattern_id}</td>
                          <td className="fw-bold text-dark">{p.name}</td>
                          <td className="font-monospace text-primary">{p.start_time}</td>
                          <td className="font-monospace text-primary">
                            {p.end_time}{" "}
                            {p.start_time > p.end_time && (
                              <span className="badge bg-dark ms-1" style={{ fontSize: "9px" }}>
                                Overnight
                              </span>
                            )}
                          </td>
                          <td className="text-muted small">{p.grace_minutes} mins</td>
                          <td className="text-muted small">{p.half_day_after_minutes} mins</td>
                          <td>
                            <span className={`badge ${p.is_active ? "bg-success" : "bg-secondary"}`}>
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WEEK CHECK & REST AUDIT */}
      {activeTab === "week_check" && (
        <div>
          {/* Summary KPI Cards */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-0 bg-primary-subtle p-3">
                <div className="text-primary small fw-semibold text-uppercase">Statutory Rest Days Due</div>
                <div className="fs-3 fw-bold text-dark mt-1">
                  {weekAudit?.rest_days_due ?? 1} day(s) / week
                </div>
                <div className="small text-muted">Statutory minimum rest allowance per staff member.</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-0 bg-warning-subtle p-3">
                <div className="text-warning-emphasis small fw-semibold text-uppercase">
                  Staff Without Rest Day (rule:fb45bf026f)
                </div>
                <div className="fs-3 fw-bold text-dark mt-1">
                  {weekAudit?.staff_without_rest_day ?? 0}
                </div>
                <div className="small text-muted">Flagged as NoRestDay in amber; eligible for extra duty pay.</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card shadow-sm border-0 bg-success-subtle p-3">
                <div className="text-success small fw-semibold text-uppercase">Rostered Staff Members</div>
                <div className="fs-3 fw-bold text-dark mt-1">
                  {weekAudit?.staff?.length ?? 0}
                </div>
                <div className="small text-muted">Active staff evaluated across this 7-day period.</div>
              </div>
            </div>
          </div>

          {/* Detailed Week Staff Table */}
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-2">
              <strong className="text-dark small text-uppercase">
                Staff Week Duty Roster & Rest Audit (GET /rosters/week)
              </strong>
            </div>

            <div className="card-body p-0">
              {loadingAudit ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-2" role="status" />
                  <div className="text-muted small">Calculating weekly rest compliance...</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Employee</th>
                        <th>Category</th>
                        <th>Department</th>
                        <th>Working Days</th>
                        <th>Rest Days</th>
                        <th>Leave Days</th>
                        <th>Extra Duty Days</th>
                        <th>Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!weekAudit?.staff || weekAudit.staff.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            No staff records found for this week audit.
                          </td>
                        </tr>
                      ) : (
                        weekAudit.staff.map((ws) => (
                          <tr key={ws.employee_id}>
                            <td>
                              <strong>{ws.full_name}</strong>
                              <div className="text-muted small font-monospace">{ws.emp_number}</div>
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border">{ws.staff_category}</span>
                            </td>
                            <td>{ws.department_name || "—"}</td>
                            <td className="fw-bold">{ws.working_days}</td>
                            <td>{ws.rest_dates.length}</td>
                            <td>{ws.leave_dates.length}</td>
                            <td>
                              {ws.extra_duty_days > 0 ? (
                                <span className="badge bg-info text-dark">+{ws.extra_duty_days} paid</span>
                              ) : (
                                "0"
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  ws.status === "Ok"
                                    ? "bg-success"
                                    : ws.status === "NoRestDay"
                                    ? "bg-warning text-dark"
                                    : "bg-secondary"
                                }`}
                              >
                                {ws.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD SINGLE DUTY (POST /rosters) */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Assign Staff Duty (POST /rosters)</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close"
                  data-help="duty_roster_hr.modal_add_cancel"
                />
              </div>

              <form onSubmit={handleSaveDutySubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Staff Member</label>
                    <select
                      className="form-select"
                      data-help="duty_roster_hr.modal_add_staff_select"
                      value={addEntryDraft.employee_id}
                      onChange={(e) =>
                        setAddEntryDraft({ ...addEntryDraft, employee_id: Number(e.target.value) })
                      }
                      required
                    >
                      <option value={0}>-- Select Staff --</option>
                      {plannerData?.staff?.map((st) => {
                        const leaveInfo = isStaffOnLeave(st, addEntryDraft.roster_date);
                        return (
                          <option
                            key={st.employee_id}
                            value={st.employee_id}
                            disabled={leaveInfo.onLeave}
                          >
                            {st.full_name} ({st.designation}) {leaveInfo.onLeave ? `[On Leave: ${leaveInfo.leaveType}]` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Roster Date</label>
                      <input
                        type="date"
                        className="form-control"
                        data-help="duty_roster_hr.modal_add_date_input"
                        value={addEntryDraft.roster_date}
                        onChange={(e) =>
                          setAddEntryDraft({ ...addEntryDraft, roster_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Shift Pattern</label>
                      <select
                        className="form-select"
                        data-help="duty_roster_hr.modal_add_shift_select"
                        value={addEntryDraft.shift_pattern_id}
                        onChange={(e) =>
                          setAddEntryDraft({ ...addEntryDraft, shift_pattern_id: Number(e.target.value) })
                        }
                        required
                      >
                        <option value={0}>-- Select Shift --</option>
                        {plannerData?.shift_patterns?.map((sp) => (
                          <option key={sp.shift_pattern_id} value={sp.shift_pattern_id}>
                            {sp.name} ({sp.start_time} - {sp.end_time})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Duty Area</label>
                    <select
                      className="form-select"
                      data-help="duty_roster_hr.modal_add_area_select"
                      value={addEntryDraft.duty_area}
                      onChange={(e) =>
                        setAddEntryDraft({ ...addEntryDraft, duty_area: e.target.value as any })
                      }
                    >
                      <option value="Facility">Facility (General Hospital)</option>
                      <option value="Ward">Ward</option>
                      <option value="Emergency">Emergency</option>
                      <option value="OT">Operating Theater</option>
                      <option value="Department">Department</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    {addEntryDraft.duty_area==='Ward'&&<DirectoryPicker path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" value={addEntryDraft.ward_id} onChange={e=>setAddEntryDraft({...addEntryDraft,ward_id:e.target.value})} data-help="duty_roster_hr.modal_add_area_select"/>}
                    {addEntryDraft.duty_area==='Department'&&<DirectoryPicker path="/admin/departments" idField="department_id" value={addEntryDraft.department_id??''} onChange={e=>setAddEntryDraft({...addEntryDraft,department_id:e.target.value})} data-help="duty_roster_hr.modal_add_area_select"/>}
                    <label className="form-label small fw-semibold">Duty Notes / Assignment Instructions</label>
                    <input
                      type="text"
                      className="form-control"
                      data-help="duty_roster_hr.modal_add_notes_input"
                      placeholder="e.g. In-charge nurse, Ward 2B bed lead"
                      value={addEntryDraft.notes}
                      onChange={(e) =>
                        setAddEntryDraft({ ...addEntryDraft, notes: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      data-help="duty_roster_hr.modal_add_on_call_check"
                      id="on-call-check"
                      checked={addEntryDraft.is_on_call}
                      onChange={(e) =>
                        setAddEntryDraft({ ...addEntryDraft, is_on_call: e.target.checked })
                      }
                    />
                    <label className="form-check-label small" htmlFor="on-call-check">
                      Mark as On-Call Duty (Available for emergency recall)
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                    data-help="duty_roster_hr.modal_add_cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="duty_roster_hr.modal_add_submit"
                  >
                    Save Duty Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT OR CANCEL DUTY (PATCH / POST /cancel, Rule rule:e255d6b71a) */}
      {showEditModal && selectedEntry && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Edit Duty Assignment #{selectedEntry.roster_id}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                  aria-label="Close"
                  data-help="duty_roster_hr.modal_edit_close"
                />
              </div>

              <div className="modal-body">
                <div className="alert alert-light border py-2 mb-3">
                  <div>
                    <strong>Staff: </strong>
                    <span>{selectedEntry.full_name} ({selectedEntry.designation})</span>
                  </div>
                  <div>
                    <strong>Date & Shift: </strong>
                    <span>{selectedEntry.roster_date} &bull; {selectedEntry.shift_name}</span>
                  </div>
                  <div>
                    <strong>Current Area: </strong>
                    <span>{selectedEntry.duty_area}</span>
                  </div>
                </div>

                {!showCancelSection ? (
                  <form onSubmit={handleUpdateEntrySubmit}>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Assignment Notes</label>
                      <input
                        type="text"
                        className="form-control"
                        data-help="duty_roster_hr.modal_edit_notes_input"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Duty instructions..."
                      />
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-4">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        data-help="duty_roster_hr.modal_open_cancel_btn"
                        onClick={() => setShowCancelSection(true)}
                        disabled={!capability.canManageRoster}
                      >
                        Cancel This Duty (rule:e255d6b71a)
                      </button>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!capability.canManageRoster}
                        data-help="duty_roster_hr.modal_edit_submit"
                      >
                        Save Updates (PATCH)
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="border border-danger rounded p-3 bg-danger-subtle">
                    <h6 className="fw-bold text-danger mb-2">
                      Cancel Duty Assignment (POST /rosters/{selectedEntry.roster_id}/cancel)
                    </h6>
                    <p className="small text-muted mb-2">
                      Under Rule rule:e255d6b71a, duty records are never hard deleted. Please enter an auditable operational cancellation reason:
                    </p>

                    <input
                      type="text"
                      className="form-control mb-3"
                      data-help="duty_roster_hr.modal_cancel_reason_input"
                      placeholder="e.g. Staff called in sick; duty reallocated"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />

                    <div className="d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        data-help="duty_roster_hr.modal_cancel_back_btn"
                        onClick={() => setShowCancelSection(false)}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={handleCancelEntrySubmit}
                        data-help="duty_roster_hr.modal_cancel_duty"
                      >
                        Confirm Cancellation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REPEAT LAST WEEK (POST /rosters/copy, Rule rule:f72ed8bfcb) */}
      {showCopyModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Repeat Last Week's Roster (POST /rosters/copy)</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCopyModal(false)}
                  aria-label="Close"
                  data-help="duty_roster_hr.modal_copy_cancel"
                />
              </div>

              <form onSubmit={handleCopyPeriodSubmit}>
                <div className="modal-body">
                  <p className="small text-muted">
                    Copies duties from the previous 7-day period onto the current week ({weekInfo.weekStart} to {weekInfo.weekEnd}).
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Rotation Option (Rule rule:f72ed8bfcb)
                    </label>
                    <div className="form-check mb-1">
                      <input
                        type="radio"
                        className="form-check-input"
                        data-help="duty_roster_hr.modal_copy_radio_exact"
                        id="rotate-0"
                        name="rotate_opt"
                        checked={copyRotateDays === 0}
                        onChange={() => setCopyRotateDays(0)}
                      />
                      <label className="form-check-label small" htmlFor="rotate-0">
                        Exact copy (Same days and rest days as last week)
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        data-help="duty_roster_hr.modal_copy_radio_rotate"
                        id="rotate-1"
                        name="rotate_opt"
                        checked={copyRotateDays === 1}
                        onChange={() => setCopyRotateDays(1)}
                      />
                      <label className="form-check-label small" htmlFor="rotate-1">
                        Rotate days forward by 1 day (Rest days and Sunday duty rotate week by week)
                      </label>
                    </div>
                  </div>

                  {copyFeedback && (
                    <div className="alert alert-info py-2 small mb-0">
                      <div>Created: <strong>{copyFeedback.created.length}</strong> duty entries.</div>
                      <div>Skipped: <strong>{copyFeedback.skipped.length}</strong> entries (conflicts/leave).</div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCopyModal(false)}
                    data-help="duty_roster_hr.modal_copy_cancel"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="duty_roster_hr.modal_copy_submit"
                  >
                    Execute Copy (POST /rosters/copy)
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE SHIFT PATTERN (POST /hr/shift-patterns, Rule rule:f0c97c644e) */}
      {showPatternModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Create Shift Pattern (POST /hr/shift-patterns)</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPatternModal(false)}
                  aria-label="Close"
                  data-help="duty_roster_hr.modal_pattern_cancel"
                />
              </div>

              <form onSubmit={handleCreatePatternSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Shift Pattern Name</label>
                    <input
                      type="text"
                      className="form-control"
                      data-help="duty_roster_hr.modal_pattern_name_input"
                      placeholder="e.g. Morning OPD, Evening Ward, Night Emergency"
                      value={newPattern.name}
                      onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Start Time (HH:MM)</label>
                      <input
                        type="time"
                        className="form-control"
                        data-help="duty_roster_hr.modal_pattern_start_input"
                        value={newPattern.start_time}
                        onChange={(e) => setNewPattern({ ...newPattern, start_time: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">End Time (HH:MM)</label>
                      <input
                        type="time"
                        className="form-control"
                        data-help="duty_roster_hr.modal_pattern_end_input"
                        value={newPattern.end_time}
                        onChange={(e) => setNewPattern({ ...newPattern, end_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Grace Window (mins)</label>
                      <input
                        type="number"
                        className="form-control"
                        data-help="duty_roster_hr.modal_pattern_grace_input"
                        value={newPattern.grace_minutes}
                        onChange={(e) =>
                          setNewPattern({ ...newPattern, grace_minutes: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Half-Day Threshold (mins)</label>
                      <input
                        type="number"
                        className="form-control"
                        data-help="duty_roster_hr.modal_pattern_halfday_input"
                        value={newPattern.half_day_after_minutes}
                        onChange={(e) =>
                          setNewPattern({
                            ...newPattern,
                            half_day_after_minutes: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPatternModal(false)}
                    data-help="duty_roster_hr.modal_pattern_cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="duty_roster_hr.modal_pattern_submit"
                  >
                    Save Shift Pattern
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RECORD VERBAL SWAP (POST /rosters/swaps, Rule rule:83718fc56e) */}
      {showRecordSwapModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Record Verbal Swap (POST /rosters/swaps)</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowRecordSwapModal(false)}
                  aria-label="Close"
                  data-help="duty_roster_hr.modal_swap_cancel"
                />
              </div>

              <form onSubmit={handleRecordSwapSubmit}>
                <div className="modal-body">
                  <p className="small text-muted">
                    Record duty cover agreed on the ward for staff without system logins (Rule rule:83718fc56e).
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Duty To Cover</label>
                    <select
                      className="form-select"
                      data-help="duty_roster_hr.modal_swap_duty_select"
                      value={swapDraft.roster_id}
                      onChange={(e) =>
                        setSwapDraft({ ...swapDraft, roster_id: Number(e.target.value) })
                      }
                      required
                    >
                      <option value={0}>-- Select Active Duty --</option>
                      {rosterEntries
                        .filter((re) => re.status === "Active")
                        .map((re) => (
                          <option key={re.roster_id} value={re.roster_id}>
                            #{re.roster_id}: {re.full_name} &bull; {re.roster_date} ({re.shift_name})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Covering Colleague</label>
                    <select
                      className="form-select"
                      data-help="duty_roster_hr.modal_swap_cover_select"
                      value={swapDraft.covering_employee_id}
                      onChange={(e) =>
                        setSwapDraft({ ...swapDraft, covering_employee_id: Number(e.target.value) })
                      }
                      required
                    >
                      <option value={0}>-- Select Colleague --</option>
                      {plannerData?.staff?.map((st) => (
                        <option key={st.employee_id} value={st.employee_id}>
                          {st.full_name} ({st.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Operational Swap Reason</label>
                    <input
                      type="text"
                      className="form-control"
                      data-help="duty_roster_hr.modal_swap_reason_input"
                      placeholder="e.g. Mutual family emergency agreement on ward"
                      value={swapDraft.reason}
                      onChange={(e) => setSwapDraft({ ...swapDraft, reason: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRecordSwapModal(false)}
                    data-help="duty_roster_hr.modal_swap_cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="duty_roster_hr.modal_swap_submit"
                  >
                    Record Swap
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyRosterHr;
