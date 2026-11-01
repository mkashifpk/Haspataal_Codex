import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  OtBookingDetailOut,
  OtBookingListItemOut,
  OtCalendarBlockOut,
  OtQueueItemOut,
  TheaterOut,
  BookingIn,
  OtScheduleIn,
  TheaterStateIn,
  OtReasonIn,
  requestBooking,
  scheduleOtBookings,
  cancelOtBookings,
  theaterState,
  queue as fetchQueue,
  calendar as fetchCalendar,
  theaters as fetchTheaters,
  listBookings,
} from "../generated/ot_scheduling";
import {
  getOtSchedulingScreenView,
  isSurgeryActive,
  canManageOt,
  canRequestOt,
  canViewOt,
  canProvisionTheater,
  checkSlotAvailability,
  validateBookingRequest,
  validateScheduleInput,
  validateTheaterState,
  validateBookingCancellation,
  explainOtSchedulingError,
  ClinicalUser,
  SlotCheckResult,
} from "../ot-scheduling-policy";

interface OTSchedulingProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

type TabMode = "calendar" | "queue" | "bookings" | "theaters";

export const OTScheduling: React.FC<OTSchedulingProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getOtSchedulingScreenView(establishment);
  const isServiceActive = isSurgeryActive(establishment);
  const canManage = canManageOt(currentUser);
  const canRequest = canRequestOt(currentUser);
  const canView = canViewOt(currentUser);
  const canProvision = canProvisionTheater(currentUser);

  // Active view tab
  const [activeTab, setActiveTab] = useState<TabMode>("calendar");

  // State collections
  const [theatersList, setTheatersList] = useState<TheaterOut[]>([]);
  const [queueItems, setQueueItems] = useState<OtQueueItemOut[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<OtCalendarBlockOut[]>([]);
  const [bookingsList, setBookingsList] = useState<OtBookingListItemOut[]>([]);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [filterOtId, setFilterOtId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [mineOnly, setMineOnly] = useState<boolean>(false);

  // Modals
  const [showNewBookingModal, setShowNewBookingModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showTheaterStateModal, setShowTheaterStateModal] = useState<boolean>(false);

  // Selected entities for actions
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedBookingNumber, setSelectedBookingNumber] = useState<string>("");
  const [selectedTheaterForState, setSelectedTheaterForState] = useState<TheaterOut | null>(null);

  // Form states: New Booking
  const [newBookingPatientId, setNewBookingPatientId] = useState<number>(0);
  const [newBookingProcedure, setNewBookingProcedure] = useState<string>("");
  const [newBookingType, setNewBookingType] = useState<"Scheduled" | "Emergency" | "CodeRed">("Scheduled");
  const [newBookingEmergencyReason, setNewBookingEmergencyReason] = useState<string>("");
  const [newBookingAnesthesia, setNewBookingAnesthesia] = useState<string>("General");
  const [newBookingPreferredStart, setNewBookingPreferredStart] = useState<string>("");

  // Form states: Schedule Booking
  const [scheduleOtId, setScheduleOtId] = useState<number>(0);
  const [scheduleStart, setScheduleStart] = useState<string>("");
  const [scheduleDurationMinutes, setScheduleDurationMinutes] = useState<number>(60);
  const [slotConflict, setSlotConflict] = useState<SlotCheckResult | null>(null);

  // Form states: Cancel
  const [cancelReason, setCancelReason] = useState<string>("");

  // Form states: Theater State
  const [theaterStateReason, setTheaterStateReason] = useState<string>("");
  const [theaterOutOfService, setTheaterOutOfService] = useState<boolean>(true);

  // UI status
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Load all OT data
  const loadData = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setErrorBanner(null);

    try {
      // 1. Fetch Theaters
      const thList = await fetchTheaters();
      setTheatersList(thList);

      // 2. Fetch Calendar for selected date
      const calQuery: { start?: string; end?: string; ot_id?: number } = {};
      if (selectedDate) {
        calQuery.start = `${selectedDate}T00:00:00Z`;
        calQuery.end = `${selectedDate}T23:59:59Z`;
      }
      if (filterOtId) {
        calQuery.ot_id = filterOtId;
      }
      const calList = await fetchCalendar(calQuery);
      setCalendarBlocks(calList);

      // 3. Fetch Queue if manager
      if (canManage) {
        const qList = await fetchQueue();
        setQueueItems(qList);
      }

      // 4. Fetch Bookings list
      const bookQuery: { mine?: boolean; status?: any; limit?: number } = {
        limit: 50,
      };
      if (mineOnly) bookQuery.mine = true;
      if (filterStatus) bookQuery.status = filterStatus;
      const bList = await listBookings(bookQuery);
      setBookingsList(bList);
    } catch (err: any) {
      console.error("Failed to load OT scheduling data", err);
      const explained = explainOtSchedulingError(err?.code || "INTERNAL_ERROR", err?.details);
      setErrorBanner(explained);
    } finally {
      setLoading(false);
    }
  }, [connected, selectedDate, filterOtId, canManage, mineOnly, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle slot conflict check dynamically when scheduling inputs change
  useEffect(() => {
    if (scheduleOtId && scheduleStart && scheduleDurationMinutes > 0 && calendarBlocks.length > 0) {
      const res = checkSlotAvailability(
        scheduleOtId,
        scheduleStart,
        scheduleDurationMinutes,
        calendarBlocks,
        20 // 20-min turnover buffer
      );
      setSlotConflict(res.hasConflict ? res : null);
    } else {
      setSlotConflict(null);
    }
  }, [scheduleOtId, scheduleStart, scheduleDurationMinutes, calendarBlocks]);

  // Submit New Booking
  const handleCreateBooking = async () => {
    if (!isServiceActive) {
      setErrorBanner(explainOtSchedulingError("CAPABILITY_INACTIVE"));
      return;
    }

    const payload: BookingIn = {
      patient_id: Number(newBookingPatientId),
      procedure_name: newBookingProcedure.trim(),
      booking_type: newBookingType,
      emergency_reason:
        newBookingType !== "Scheduled" ? newBookingEmergencyReason.trim() : null,
      anesthesia_type: newBookingAnesthesia as any,
      preferred_start: newBookingPreferredStart ? new Date(newBookingPreferredStart).toISOString() : null,
    };

    const val = validateBookingRequest(payload);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "درخواست نامکمل ہے۔ تمام لازمی فیلڈز درج کریں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await requestBooking(payload);
      setSuccessBanner({
        en: `OT booking ${res.booking_number} requested successfully.`,
        ur: `او ٹی بکنگ ${res.booking_number} کامیابی سے درج ہو گئی۔`,
      });
      setShowNewBookingModal(false);
      // Reset form
      setNewBookingPatientId(0);
      setNewBookingProcedure("");
      setNewBookingEmergencyReason("");
      setNewBookingPreferredStart("");
      loadData();
    } catch (err: any) {
      setErrorBanner(explainOtSchedulingError(err?.code || "VALIDATION_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Submit Schedule Assignment
  const handleScheduleBooking = async () => {
    if (!selectedBookingId) return;

    const payload: OtScheduleIn = {
      ot_id: Number(scheduleOtId),
      scheduled_start: new Date(scheduleStart).toISOString(),
      duration_minutes: Number(scheduleDurationMinutes),
      anesthesia_type: newBookingAnesthesia,
    };

    const val = validateScheduleInput(payload);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "شیڈولنگ کی تفصیلات درست نہیں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await scheduleOtBookings(selectedBookingId, payload);
      setSuccessBanner({
        en: `Booking ${res.booking_number} scheduled in ${res.ot_name} at ${res.scheduled_start}.`,
        ur: `بکنگ ${res.booking_number} کو ${res.ot_name} میں کامیابی سے شیڈول کر دیا گیا۔`,
      });
      setShowScheduleModal(false);
      setSelectedBookingId(null);
      setSlotConflict(null);
      loadData();
    } catch (err: any) {
      const explained = explainOtSchedulingError(err?.code || "OT_DOUBLE_BOOKING", err?.details);
      setErrorBanner(explained);
    } finally {
      setLoading(false);
    }
  };

  // Submit Cancellation
  const handleCancelBooking = async () => {
    if (!selectedBookingId) return;

    const val = validateBookingCancellation({ reason: cancelReason });
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "منسوخی کی وجہ درج کرنا لازمی ہے۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      await cancelOtBookings(selectedBookingId, { reason: cancelReason.trim() });
      setSuccessBanner({
        en: `Booking ${selectedBookingNumber} cancelled. Any consumables returned to inventory.`,
        ur: `بکنگ ${selectedBookingNumber} منسوخ کر دی گئی۔ سامان واپس انوینٹری میں درج ہو گیا۔`,
      });
      setShowCancelModal(false);
      setSelectedBookingId(null);
      setCancelReason("");
      loadData();
    } catch (err: any) {
      setErrorBanner(explainOtSchedulingError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Submit Theatre State Change
  const handleTheaterStateChange = async () => {
    if (!selectedTheaterForState) return;

    const val = validateTheaterState({ reason: theaterStateReason });
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "تھیٹر کی حالت تبدیل کرنے کی وجہ لکھنا لازمی ہے۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      await theaterState(selectedTheaterForState.ot_id, {
        out_of_service: theaterOutOfService,
        reason: theaterStateReason.trim(),
      });
      setSuccessBanner({
        en: `Theater ${selectedTheaterForState.name} status updated to ${
          theaterOutOfService ? "OutOfService" : "Available"
        }.`,
        ur: `تھیٹر ${selectedTheaterForState.name} کی حالت کامیابی سے تبدیل ہو گئی۔`,
      });
      setShowTheaterStateModal(false);
      setSelectedTheaterForState(null);
      setTheaterStateReason("");
      loadData();
    } catch (err: any) {
      setErrorBanner(explainOtSchedulingError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-semibold">OT Scheduling is hidden for this facility.</p>
        <p className="text-sm font-urdu">آپریشن تھیٹر شیڈولنگ اس سہولت کے لیے دستیاب نہیں ہے۔</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3">
          <button
            data-help="ot_scheduling.back_button"
            onClick={() => navigate?.("ot_board")}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            ← Back / واپسی
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📅</span>
              <span>OT Request Queue & Calendar</span>
              <span className="text-sm font-normal text-gray-500 font-urdu">
                (او ٹی شیڈولنگ اور کیلنڈر)
              </span>
            </h1>
            <p className="text-xs text-gray-500">
              Elective & emergency surgical queue, double-booking safety, and room turnover management (MSDS COP 31-33)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canRequest && isServiceActive && viewMode === "full" && (
            <button
              data-help="ot_scheduling.new_booking_button"
              onClick={() => setShowNewBookingModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition flex items-center gap-1.5 text-sm"
            >
              <span>+</span>
              <span>Request OT Slot / نئی بکنگ</span>
            </button>
          )}

          <button
            data-help="ot_scheduling.refresh_button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-medium transition"
          >
            {loading ? "Refreshing..." : "↻ Refresh / ریفریش"}
          </button>
        </div>
      </header>

      {/* Retiring / Inactive Banners */}
      {viewMode === "open_work" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm">
          <p className="text-sm text-amber-900 font-semibold">
            Service Retiring: No new surgery bookings from now on. Existing scheduled procedures may be completed.
          </p>
          <p className="text-xs text-amber-700 font-urdu">
            سروس ریٹائر ہو رہی ہے: نئی سرجری بکنگز بند ہیں۔ پہلے سے شیڈول شدہ آپریشنز مکمل کیے جا سکتے ہیں۔
          </p>
        </div>
      )}

      {!isServiceActive && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md shadow-sm">
          <p className="text-sm text-rose-900 font-semibold">
            Surgery Service Inactive: OT booking requests are temporarily disabled.
          </p>
          <p className="text-xs text-rose-700 font-urdu">
            سرجری سروس غیر فعال ہے: او ٹی بکنگ کی درخواستیں معطل ہیں۔
          </p>
        </div>
      )}

      {/* Alert Banners */}
      {errorBanner && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl shadow-sm">
          <div>
            <p className="text-sm font-semibold">{errorBanner.en}</p>
            <p className="text-xs font-urdu">{errorBanner.ur}</p>
          </div>
          <button
            data-help="ot_scheduling.dismiss_alert_button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {successBanner && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-sm">
          <div>
            <p className="text-sm font-semibold">{successBanner.en}</p>
            <p className="text-xs font-urdu">{successBanner.ur}</p>
          </div>
          <button
            data-help="ot_scheduling.dismiss_alert_button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold px-2 py-1 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          data-help="ot_scheduling.tab_calendar"
          onClick={() => setActiveTab("calendar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "calendar"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📅 Schedule Calendar / کیلنڈر
        </button>

        {canManage && (
          <button
            data-help="ot_scheduling.tab_queue"
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "queue"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>⏳ Unscheduled Queue / انتظار کی فہرست</span>
            {queueItems.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold">
                {queueItems.length}
              </span>
            )}
          </button>
        )}

        <button
          data-help="ot_scheduling.tab_bookings"
          onClick={() => setActiveTab("bookings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "bookings"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 All Bookings / تمام بکنگز
        </button>

        <button
          data-help="ot_scheduling.tab_theaters"
          onClick={() => setActiveTab("theaters")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "theaters"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🏥 Theatres & Readiness / تھیٹرز کی حالت
        </button>
      </div>

      {/* Main Content Areas */}
      <main className="flex-1 overflow-auto bg-white p-4 rounded-b-xl shadow-sm border border-gray-200">
        {/* TAB 1: CALENDAR */}
        {activeTab === "calendar" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700">Date / تاریخ:</label>
                <input
                  type="date"
                  data-help="ot_scheduling.filter_date_input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700">Filter OT / تھیٹر:</label>
                <select
                  data-help="ot_scheduling.filter_theater_select"
                  value={filterOtId ?? ""}
                  onChange={(e) => setFilterOtId(e.target.value ? Number(e.target.value) : null)}
                  className="px-2.5 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Theatres / تمام تھیٹرز</option>
                  {theatersList.map((th) => (
                    <option key={th.ot_id} value={th.ot_id}>
                      {th.name} ({th.code}) - {th.current_state}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Calendar Blocks Display */}
            {calendarBlocks.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-base font-semibold">No surgical procedures scheduled for this date.</p>
                <p className="text-xs font-urdu">اس تاریخ کے لیے کوئی سرجری شیڈول نہیں ہے۔</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calendarBlocks.map((block) => {
                  const isEmergency = block.booking_type === "Emergency" || block.booking_type === "CodeRed";
                  return (
                    <div
                      key={block.booking_id}
                      className={`p-4 rounded-xl border transition shadow-sm ${
                        isEmergency
                          ? "border-rose-300 bg-rose-50/40"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {block.ot_name}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            block.status === "Scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : block.status === "InProgress"
                              ? "bg-emerald-100 text-emerald-800 animate-pulse"
                              : block.status === "Completed"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {block.status}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-bold text-gray-900">{block.procedure_name}</h3>
                      <p className="text-xs text-gray-600">
                        Patient: <span className="font-semibold">{block.patient_name}</span> (MRN: {block.mrn})
                      </p>
                      <p className="text-xs text-gray-600">Surgeon: {block.surgeon_name}</p>

                      <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                        <span>🕒 {new Date(block.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(block.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-mono text-gray-400">#{block.booking_number}</span>
                      </div>

                      {canManage && block.status === "Scheduled" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            data-help="ot_scheduling.cancel_booking_button"
                            onClick={() => {
                              setSelectedBookingId(block.booking_id);
                              setSelectedBookingNumber(block.booking_number);
                              setShowCancelModal(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-200 transition font-medium"
                          >
                            Cancel / منسوخ
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UNSCHEDULED QUEUE */}
        {activeTab === "queue" && canManage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800">Unscheduled Surgical Requests</h2>
                <p className="text-xs text-gray-500 font-urdu">
                  انتظار کی فہرست: سرجنز کی طرف سے موصولہ درخواستیں جنہیں تھیٹر الاٹ کرنا ہے
                </p>
              </div>
            </div>

            {queueItems.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-base font-semibold">The unscheduled surgery queue is currently empty.</p>
                <p className="text-xs font-urdu">کوئی غیر شیڈول شدہ سرجری کی درخواست موجود نہیں ہے۔</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {queueItems.map((item) => (
                  <div key={item.booking_id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">
                          {item.booking_number}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            item.booking_type === "CodeRed"
                              ? "bg-rose-600 text-white animate-pulse"
                              : item.booking_type === "Emergency"
                              ? "bg-amber-500 text-white"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.booking_type} (Priority {item.priority})
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mt-1">{item.procedure_name}</h4>
                      <p className="text-xs text-gray-600">
                        Patient: <span className="font-medium">{item.patient_name}</span> (MRN: {item.mrn}) | Surgeon: {item.surgeon_name}
                      </p>
                      {item.preferred_start && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Preferred: {new Date(item.preferred_start).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        data-help="ot_scheduling.schedule_booking_button"
                        onClick={() => {
                          setSelectedBookingId(item.booking_id);
                          setSelectedBookingNumber(item.booking_number);
                          setShowScheduleModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
                      >
                        Assign Theatre & Time / شیڈول کریں
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALL BOOKINGS */}
        {activeTab === "bookings" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700">Status / صورتحال:</label>
                <select
                  data-help="ot_scheduling.filter_status_select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Statuses / تمام</option>
                  <option value="Requested">Requested</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="InProgress">InProgress</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="EmergencyHold">EmergencyHold</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  data-help="ot_scheduling.toggle_mine_only"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>My Bookings Only (سرجن کی اپنی بکنگز)</span>
              </label>
            </div>

            {/* Bookings Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-100 text-gray-800 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Booking #</th>
                    <th className="p-3">Patient / MRN</th>
                    <th className="p-3">Procedure</th>
                    <th className="p-3">Theatre</th>
                    <th className="p-3">Scheduled Slot</th>
                    <th className="p-3">Surgeon</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookingsList.map((b) => (
                    <tr key={b.booking_id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-blue-600">{b.booking_number}</td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{b.patient_name}</div>
                        <div className="text-gray-400 font-mono">{b.mrn}</div>
                      </td>
                      <td className="p-3 font-medium text-gray-900">{b.procedure_name}</td>
                      <td className="p-3">{b.ot_name ?? "Unassigned"}</td>
                      <td className="p-3">
                        {b.scheduled_start ? (
                          <span>{new Date(b.scheduled_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Queue</span>
                        )}
                      </td>
                      <td className="p-3">{b.surgeon_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: THEATRES & READINESS */}
        {activeTab === "theaters" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {theatersList.map((th) => (
                <div key={th.ot_id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{th.name}</h3>
                      <p className="text-xs text-gray-500 font-mono">Code: {th.code} | Type: {th.theater_type}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        th.current_state === "Available"
                          ? "bg-emerald-100 text-emerald-800"
                          : th.current_state === "InSurgery"
                          ? "bg-blue-100 text-blue-800 animate-pulse"
                          : th.current_state === "CleaningPrep"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {th.current_state}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    State changed: {new Date(th.state_changed_at).toLocaleString()}
                  </p>

                  {canProvision && (
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        data-help="ot_scheduling.theater_state_button"
                        onClick={() => {
                          setSelectedTheaterForState(th);
                          setTheaterOutOfService(th.current_state !== "OutOfService");
                          setShowTheaterStateModal(true);
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                      >
                        {th.current_state === "OutOfService"
                          ? "Mark Back in Service / بحال کریں"
                          : "Take Out of Service / غیر فعال کریں"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: NEW BOOKING REQUEST */}
      {showNewBookingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-bold text-gray-900">Request Surgical Slot (نئی بکنگ)</h2>
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowNewBookingModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Patient ID / مریض کا نمبر:</label>
                <input
                  type="number"
                  data-help="ot_scheduling.patient_id_input"
                  value={newBookingPatientId || ""}
                  onChange={(e) => setNewBookingPatientId(Number(e.target.value))}
                  placeholder="e.g. 1"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Procedure Name / طریقہ کار:</label>
                <input
                  type="text"
                  data-help="ot_scheduling.procedure_name_input"
                  value={newBookingProcedure}
                  onChange={(e) => setNewBookingProcedure(e.target.value)}
                  placeholder="e.g. Laparoscopic Appendectomy"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Booking Type / نوعیت:</label>
                  <select
                    data-help="ot_scheduling.booking_type_select"
                    value={newBookingType}
                    onChange={(e) => setNewBookingType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Scheduled">Scheduled (الیکٹیو)</option>
                    <option value="Emergency">Emergency (ایمرجنسی)</option>
                    <option value="CodeRed">CodeRed (کوڈ ریڈ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Anaesthesia / اینستھیزیا:</label>
                  <select
                    data-help="ot_scheduling.anesthesia_select"
                    value={newBookingAnesthesia}
                    onChange={(e) => setNewBookingAnesthesia(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="General">General</option>
                    <option value="Spinal">Spinal</option>
                    <option value="Epidural">Epidural</option>
                    <option value="Regional">Regional</option>
                    <option value="Local">Local</option>
                    <option value="Sedation">Sedation</option>
                  </select>
                </div>
              </div>

              {newBookingType !== "Scheduled" && (
                <div>
                  <label className="block text-xs font-semibold text-rose-700">
                    Emergency Justification / ہنگامی وجہ:
                  </label>
                  <input
                    type="text"
                    data-help="ot_scheduling.emergency_reason_input"
                    value={newBookingEmergencyReason}
                    onChange={(e) => setNewBookingEmergencyReason(e.target.value)}
                    placeholder="Clinical reason for urgent un-scheduled surgery"
                    className="w-full mt-1 px-3 py-2 border border-rose-300 rounded-lg text-sm bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Preferred Start Time (Optional) / مطلوبہ وقت:
                </label>
                <input
                  type="datetime-local"
                  data-help="ot_scheduling.preferred_start_input"
                  value={newBookingPreferredStart}
                  onChange={(e) => setNewBookingPreferredStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowNewBookingModal(false)}
                className="px-4 py-2 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Cancel / منسوخ
              </button>
              <button
                data-help="ot_scheduling.confirm_booking_button"
                onClick={handleCreateBooking}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm"
              >
                Submit Request / درخواست جمع کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE BOOKING */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-bold text-gray-900">
                Schedule Booking #{selectedBookingNumber} (شیڈول الاٹ کریں)
              </h2>
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Assign Theatre / تھیٹر منتخب کریں:</label>
                <select
                  data-help="ot_scheduling.slot_theater_select"
                  value={scheduleOtId || ""}
                  onChange={(e) => setScheduleOtId(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">Select Theatre</option>
                  {theatersList
                    .filter((t) => t.is_active && t.current_state !== "OutOfService")
                    .map((t) => (
                      <option key={t.ot_id} value={t.ot_id}>
                        {t.name} ({t.code}) - {t.theater_type}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Scheduled Start Time / تاریخ و وقت:</label>
                <input
                  type="datetime-local"
                  data-help="ot_scheduling.slot_start_input"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Estimated Surgery Duration (Minutes) / متوقع دورانیہ (منٹ):
                </label>
                <input
                  type="number"
                  data-help="ot_scheduling.slot_duration_input"
                  value={scheduleDurationMinutes}
                  onChange={(e) => setScheduleDurationMinutes(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  A 20-minute post-operative cleaning turnover buffer is enforced automatically (Rule 992db951e1).
                </p>
              </div>

              {/* Conflict warning & next free slot suggestion */}
              {slotConflict && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-2">
                  <p className="font-bold flex items-center gap-1 text-amber-800">
                    <span>⚠️</span>
                    <span>Slot Overlap Detected (وقت کا تصادم)</span>
                  </p>
                  <p>
                    Proposed slot overlaps with procedure &quot;{slotConflict.conflictingProcedure}&quot; or its mandatory turnover buffer.
                  </p>
                  {slotConflict.nextFreeSlot && (
                    <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                      <span>Next Free Slot: {new Date(slotConflict.nextFreeSlot).toLocaleString()}</span>
                      <button
                        data-help="ot_scheduling.use_suggested_slot_button"
                        onClick={() => {
                          const dt = new Date(slotConflict.nextFreeSlot!);
                          // Local datetime-local string
                          const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16);
                          setScheduleStart(localIso);
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition"
                      >
                        Use Free Slot / تجویز کردہ وقت لیں
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Cancel / منسوخ
              </button>
              <button
                data-help="ot_scheduling.confirm_schedule_button"
                onClick={handleScheduleBooking}
                disabled={loading || Boolean(slotConflict)}
                className={`px-5 py-2 text-white rounded-lg text-sm font-bold shadow-sm transition ${
                  slotConflict ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Confirm Schedule / شیڈول کی تصدیق کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCEL BOOKING */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-bold text-gray-900">Cancel Booking #{selectedBookingNumber}</h2>
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Scanned consumables will automatically return to inventory upon cancellation.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Cancellation Reason / منسوخی کی وجہ:</label>
              <input
                type="text"
                data-help="ot_scheduling.cancel_reason_input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Patient hemodynamically unstable, postponed"
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Keep Booking / منسوخ نہ کریں
              </button>
              <button
                data-help="ot_scheduling.confirm_cancel_button"
                onClick={handleCancelBooking}
                disabled={loading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm"
              >
                Confirm Cancel / منسوخی کی تصدیق کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: THEATRE STATE */}
      {showTheaterStateModal && selectedTheaterForState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-bold text-gray-900">
                Change Theatre Service State: {selectedTheaterForState.name}
              </h2>
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowTheaterStateModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <span className="font-semibold">Action: </span>
                {theaterOutOfService
                  ? "Marking theatre OUT OF SERVICE (Maintenance / Fumigation)"
                  : "Marking theatre AVAILABLE FOR SURGERY"}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Reason / وجہ:</label>
                <input
                  type="text"
                  data-help="ot_scheduling.theater_state_reason_input"
                  value={theaterStateReason}
                  onChange={(e) => setTheaterStateReason(e.target.value)}
                  placeholder="e.g. Laminar airflow filter maintenance"
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                data-help="ot_scheduling.close_modal_button"
                onClick={() => setShowTheaterStateModal(false)}
                className="px-4 py-2 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Cancel / منسوخ
              </button>
              <button
                data-help="ot_scheduling.confirm_state_button"
                onClick={handleTheaterStateChange}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm"
              >
                Confirm / تصدیق کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
