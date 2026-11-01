import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  OtBookingDetailOut,
  BookingConsumableOut,
  ConsumableIn,
  startOtBookings,
  addConsumable,
  reverseConsumable,
  completeSurgery,
  completeCleaning,
  getBooking,
} from "../generated/ot_intraop";
import { listBookings, OtBookingListItemOut } from "../generated/ot_consumables_nurse";
import {
  getOtIntraopScreenView,
  canManageBookings,
  canRecordConsumables,
  canViewBookings,
  canStartSurgery,
  canCompleteSurgery,
  canCompleteCleaning,
  canAddConsumables,
  validateConsumableScan,
  validateReversalReason,
  canReverseConsumable,
  explainOtIntraopError,
  ClinicalUser,
} from "../ot-intraop-policy";

interface OTIntraopProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const OTIntraop: React.FC<OTIntraopProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getOtIntraopScreenView(establishment);
  const canManage = canManageBookings(currentUser);
  const canRecord = canRecordConsumables(currentUser);
  const canView = canViewBookings(currentUser);

  // Cases queue state
  const [bookings, setBookings] = useState<OtBookingListItemOut[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [bookingDetail, setBookingDetail] = useState<OtBookingDetailOut | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading & Action states
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [submittingScan, setSubmittingScan] = useState<boolean>(false);
  const [submittingReversal, setSubmittingReversal] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ title: string; detail: string; action: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Scan input mode: "barcode" (pharmacy stock) vs "custom" (vendor implant)
  const [scanMode, setScanMode] = useState<"barcode" | "custom">("barcode");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [descriptionInput, setDescriptionInput] = useState<string>("");
  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [unitRetailInput, setUnitRetailInput] = useState<string>("");

  // Reversal modal state (Rule f228c617bd)
  const [reversingItem, setReversingItem] = useState<BookingConsumableOut | null>(null);
  const [reversalReason, setReversalReason] = useState<string>("");
  const [reversalError, setReversalError] = useState<string | null>(null);

  // Fetch surgical cases list
  const fetchBookings = useCallback(async () => {
    if (!canView) return;
    setLoadingList(true);
    setErrorBanner(null);
    try {
      const qStatus = filterStatus === "ALL" ? null : (filterStatus as any);
      const data = await listBookings({ status: qStatus, limit: 100 });
      setBookings(data || []);

      if (data && data.length > 0) {
        if (!selectedBookingId || !data.some((b) => b.booking_id === selectedBookingId)) {
          setSelectedBookingId(data[0].booking_id);
        }
      } else {
        setSelectedBookingId(null);
        setBookingDetail(null);
      }
    } catch (err: any) {
      const explained = explainOtIntraopError(err?.code || "VALIDATION_ERROR", "en");
      setErrorBanner(explained);
    } finally {
      setLoadingList(false);
    }
  }, [canView, filterStatus, selectedBookingId]);

  // Fetch booking detail
  const fetchBookingDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setErrorBanner(null);
    try {
      const detail = await getBooking(id);
      setBookingDetail(detail);
    } catch (err: any) {
      const explained = explainOtIntraopError(err?.code || "VALIDATION_ERROR", "en");
      setErrorBanner(explained);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchBookings();
  }, [filterStatus]);

  // Load detail whenever selectedBookingId changes
  useEffect(() => {
    if (selectedBookingId) {
      fetchBookingDetail(selectedBookingId);
    } else {
      setBookingDetail(null);
    }
  }, [selectedBookingId, fetchBookingDetail]);

  // Realtime synchronization on ot.booking.updated
  useEffect(() => {
    if (stream && stream.includes("ot.booking.updated")) {
      fetchBookings();
      if (selectedBookingId) {
        fetchBookingDetail(selectedBookingId);
      }
    }
  }, [stream, fetchBookings, fetchBookingDetail, selectedBookingId]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter(
      (b) =>
        b.patient_name.toLowerCase().includes(q) ||
        b.mrn.toLowerCase().includes(q) ||
        b.procedure_name.toLowerCase().includes(q) ||
        b.booking_number.toLowerCase().includes(q) ||
        (b.ot_name && b.ot_name.toLowerCase().includes(q))
    );
  }, [bookings, searchQuery]);

  // Lifecycle action: Start Surgery (POST /ot/bookings/{id}/start)
  const handleStartSurgery = async () => {
    if (!selectedBookingId || !canManage) return;
    setActionInProgress("start");
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const updated = await startOtBookings(selectedBookingId);
      setBookingDetail(updated);
      setSuccessBanner(`Patient marked In-Surgery (🔴 InProgress). Theatre is actively occupied.`);
      await fetchBookings();
    } catch (err: any) {
      setErrorBanner(explainOtIntraopError(err?.code || "OT_BOOKING_STATE_INVALID", "en"));
    } finally {
      setActionInProgress(null);
    }
  };

  // Lifecycle action: Complete Surgery (POST /ot/bookings/{id}/complete-surgery)
  const handleCompleteSurgery = async () => {
    if (!selectedBookingId || !canManage) return;
    setActionInProgress("complete_surgery");
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const updated = await completeSurgery(selectedBookingId);
      setBookingDetail(updated);
      setSuccessBanner(`Surgery completed. Theatre moved to Cleaning-Prep (🟡 Cleaning).`);
      await fetchBookings();
    } catch (err: any) {
      setErrorBanner(explainOtIntraopError(err?.code || "OT_CHECKLIST_INCOMPLETE", "en"));
    } finally {
      setActionInProgress(null);
    }
  };

  // Lifecycle action: Complete Cleaning (POST /ot/bookings/{id}/complete-cleaning)
  const handleCompleteCleaning = async () => {
    if (!selectedBookingId || !canManage) return;
    setActionInProgress("complete_cleaning");
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const updated = await completeCleaning(selectedBookingId);
      setBookingDetail(updated);
      setSuccessBanner(`Theatre cleaning completed. Theatre restored to Available (🟢 Available).`);
      await fetchBookings();
    } catch (err: any) {
      setErrorBanner(explainOtIntraopError(err?.code || "OT_BOOKING_STATE_INVALID", "en"));
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle consumable scan submission
  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedBookingId || !canRecord) return;

    if (!canAddConsumables(bookingDetail?.status)) {
      setErrorBanner(explainOtIntraopError("OT_BOOKING_NOT_ACTIVE", "en"));
      return;
    }

    const payload: ConsumableIn = {
      qty: Number(qtyInput) || 1,
    };

    if (scanMode === "barcode") {
      if (!barcodeInput.trim()) {
        setErrorBanner({
          title: "Barcode Required",
          detail: "Please scan or enter an item barcode.",
          action: "Focus barcode field and trigger handheld scanner.",
        });
        return;
      }
      payload.barcode = barcodeInput.trim();
    } else {
      if (!descriptionInput.trim()) {
        setErrorBanner({
          title: "Description Required",
          detail: "Please provide a description for the non-stock implant or consumable.",
          action: "Type implant name, size, and specifications.",
        });
        return;
      }
      payload.description = descriptionInput.trim();
      if (unitCostInput.trim()) payload.unit_cost = Number(unitCostInput);
      if (unitRetailInput.trim()) payload.unit_retail = Number(unitRetailInput);
    }

    const valResult = validateConsumableScan(payload);
    if (!valResult.valid) {
      setErrorBanner({
        title: "Validation Error",
        detail: valResult.error || "Invalid consumable input.",
        action: "Review item quantity and identification.",
      });
      return;
    }

    setSubmittingScan(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      await addConsumable(selectedBookingId, payload);
      setSuccessBanner(
        scanMode === "barcode"
          ? `Consumable item (Barcode: ${barcodeInput}) scanned successfully.`
          : `Implant item "${descriptionInput}" recorded successfully.`
      );
      setBarcodeInput("");
      setDescriptionInput("");
      setUnitCostInput("");
      setUnitRetailInput("");
      setQtyInput("1");
      await fetchBookingDetail(selectedBookingId);
    } catch (err: any) {
      setErrorBanner(explainOtIntraopError(err?.code || "VALIDATION_ERROR", "en"));
    } finally {
      setSubmittingScan(false);
    }
  };

  // Reversal modal handling (Rule f228c617bd)
  const handleOpenReversal = (item: BookingConsumableOut) => {
    setReversingItem(item);
    setReversalReason("");
    setReversalError(null);
  };

  const handleCloseReversal = () => {
    setReversingItem(null);
    setReversalReason("");
    setReversalError(null);
  };

  const handleConfirmReversal = async () => {
    if (!reversingItem || !canRecord) return;

    const valReason = validateReversalReason({ reason: reversalReason });
    if (!valReason.valid) {
      setReversalError(valReason.error || "A valid reversal reason is required (min 3 chars).");
      return;
    }

    setSubmittingReversal(true);
    setReversalError(null);

    try {
      await reverseConsumable(reversingItem.ot_consumable_id, { reason: reversalReason.trim() });
      setSuccessBanner(`Consumable item reversed successfully. Mirrored reversal record added.`);
      handleCloseReversal();
      if (selectedBookingId) {
        await fetchBookingDetail(selectedBookingId);
      }
    } catch (err: any) {
      setReversalError(explainOtIntraopError(err?.code || "OT_CONSUMABLE_REVERSAL_INVALID", "en").detail);
    } finally {
      setSubmittingReversal(false);
    }
  };

  // Consumables summary metrics
  const consumableSummary = useMemo(() => {
    if (!bookingDetail?.consumables) {
      return { totalCount: 0, activeCount: 0, reversedCount: 0, totalRevenue: 0 };
    }
    const items = bookingDetail.consumables;
    const totalCount = items.length;
    const activeCount = items.filter((i) => !i.is_reversal && !i.is_reversed).length;
    const reversedCount = items.filter((i) => i.is_reversed).length;
    const totalRevenue = items.reduce((sum, item) => sum + (item.line_revenue || 0), 0);
    return { totalCount, activeCount, reversedCount, totalRevenue };
  }, [bookingDetail]);

  if (!canView) {
    return (
      <div className="p-6 bg-red-50 text-red-800 rounded-lg max-w-2xl mx-auto my-8 border border-red-200">
        <h2 className="text-xl font-bold mb-2">Access Denied / رسائی ممنوع ہے</h2>
        <p className="mb-4">
          You do not have permission to view Intra-operative theatre records. This screen requires the{" "}
          <code className="bg-red-100 px-1 py-0.5 rounded font-mono">ot_admin</code> or{" "}
          <code className="bg-red-100 px-1 py-0.5 rounded font-mono">ot_nurse</code> role.
        </p>
      </div>
    );
  }

  return (
    <div className="ot-intraop-container p-4 max-w-7xl mx-auto space-y-6">
      {/* Capability / View Mode Banners (Rule 23588c8fc8) */}
      {viewMode === "open_work" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-800 flex justify-between items-center rounded shadow-sm">
          <div>
            <span className="font-bold">Notice / اطلاع: </span>
            <span>No new surgical work from now on. The surgical service is retiring. Open cases may still be completed, cleaned, and reversed.</span>
          </div>
          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-1 rounded font-semibold uppercase">Retiring</span>
        </div>
      )}

      {viewMode === "records" && (
        <div className="bg-slate-100 border-l-4 border-slate-500 p-4 text-slate-800 flex justify-between items-center rounded shadow-sm">
          <div>
            <span className="font-bold">Records Only / صرف سابقہ ریکارڈز: </span>
            <span>Surgery service is retired. Viewing historical intra-op records only. Starting surgeries is disabled.</span>
          </div>
          <span className="text-xs bg-slate-200 text-slate-900 px-2 py-1 rounded font-semibold uppercase">Records</span>
        </div>
      )}

      {viewMode === "setup" && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-blue-800 flex justify-between items-center rounded shadow-sm">
          <div>
            <span className="font-bold">Service Setup Required: </span>
            <span>Surgical service is preparing. Configure theatre settings in Facility Settings before managing operations.</span>
          </div>
          <button
            type="button"
            data-help="ot_intraop.setup_link"
            onClick={() => navigate?.("settings")}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Facility Settings
          </button>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Intra-Op Consumables & Surgery Management</h1>
            <span className="text-sm bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-medium">
              او ٹی ایڈمن - سرجری اور سامان
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Operative lifecycle control (Start Surgery, Complete Surgery, Clean Theater), barcode consumables scanning, and mistake reversals (Rule f228c617bd).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-help="ot_intraop.refresh_btn"
            onClick={() => {
              fetchBookings();
              if (selectedBookingId) fetchBookingDetail(selectedBookingId);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh / تازہ کریں
          </button>

          <button
            type="button"
            data-help="ot_intraop.checklist_nav_btn"
            onClick={() => navigate?.("safety_checklist_admin")}
            className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium rounded-md shadow-sm border border-indigo-200"
          >
            Safety Checklist
          </button>

          <button
            type="button"
            data-help="ot_intraop.status_board_btn"
            onClick={() => navigate?.("ot_board")}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md shadow-sm"
          >
            OT Status Board
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorBanner && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-900 rounded shadow-sm">
          <div className="font-bold flex items-center justify-between">
            <span>{errorBanner.title}</span>
            <button
              type="button"
              data-help="ot_intraop.dismiss_alert"
              onClick={() => setErrorBanner(null)}
              className="text-red-700 hover:text-red-900 text-sm"
            >
              ✕ Dismiss
            </button>
          </div>
          <p className="text-sm mt-1">{errorBanner.detail}</p>
          <p className="text-xs text-red-700 mt-1 italic font-medium">{errorBanner.action}</p>
        </div>
      )}

      {successBanner && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 rounded shadow-sm flex items-center justify-between">
          <span className="text-sm font-medium">{successBanner}</span>
          <button
            type="button"
            data-help="ot_intraop.dismiss_alert"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left Column (Bookings Queue) & Right Column (Lifecycle & Consumables) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Surgical Bookings Queue (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-800">Theatre Worklist / شیڈول کیسز</h2>
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {filteredBookings.length} cases
            </span>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div>
              <label htmlFor="filter_status_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                Filter by Status:
              </label>
              <select
                id="filter_status_intraop"
                data-help="ot_intraop.filter_status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses / تمام مراحل</option>
                <option value="Scheduled">Scheduled / شیڈول شدہ</option>
                <option value="InProgress">In Progress / جاری سرجری</option>
                <option value="Cleaning">Cleaning / صفائی</option>
                <option value="Completed">Completed / مکمل شدہ</option>
                <option value="EmergencyHold">Emergency Hold</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                data-help="ot_intraop.search_input"
                placeholder="Search patient, MRN, procedure, OT room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Bookings Queue */}
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {loadingList ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading surgical bookings...</div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 border border-dashed rounded-md">
                No surgical cases found matching filters.
              </div>
            ) : (
              filteredBookings.map((b) => {
                const isSelected = b.booking_id === selectedBookingId;
                return (
                  <div
                    key={b.booking_id}
                    onClick={() => setSelectedBookingId(b.booking_id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {b.patient_name}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          b.status === "InProgress"
                            ? "bg-red-100 text-red-800 animate-pulse"
                            : b.status === "Scheduled"
                            ? "bg-blue-100 text-blue-800"
                            : b.status === "Cleaning"
                            ? "bg-amber-100 text-amber-800"
                            : b.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 line-clamp-1">{b.procedure_name}</div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>MRN: {b.mrn}</span>
                      <span className="font-medium text-gray-700">{b.ot_name || "OT Unassigned"}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Surgeon: {b.surgeon_name}</span>
                      <span>{b.booking_number}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Case Lifecycle Management & Consumables (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedBookingId ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center text-gray-500">
              <h3 className="text-lg font-medium text-gray-800 mb-2">No Surgical Case Selected</h3>
              <p className="text-sm">Please select an operative booking from the queue to manage lifecycle stages or record consumables.</p>
            </div>
          ) : loadingDetail ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center text-gray-500">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Loading Operative Record...</h3>
              <p className="text-sm">Fetching booking details, consumables log, and theatre status.</p>
            </div>
          ) : bookingDetail ? (
            <>
              {/* Patient Identity & Case Banner */}
              <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-4 bg-gradient-to-r from-indigo-50/40 to-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          bookingDetail.status === "InProgress"
                            ? "bg-red-100 text-red-800"
                            : bookingDetail.status === "Scheduled"
                            ? "bg-blue-100 text-blue-800"
                            : bookingDetail.status === "Cleaning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {bookingDetail.status === "InProgress"
                          ? "🔴 In-Surgery"
                          : bookingDetail.status === "Scheduled"
                          ? "🔵 Scheduled"
                          : bookingDetail.status === "Cleaning"
                          ? "🟡 Cleaning-Prep"
                          : `🟢 ${bookingDetail.status}`}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{bookingDetail.booking_number}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{bookingDetail.patient_name}</h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      MRN: <strong className="font-mono">{bookingDetail.mrn}</strong> • Suite:{" "}
                      <strong>{bookingDetail.ot_name || "Unassigned"}</strong> • Type:{" "}
                      <strong>{bookingDetail.booking_type}</strong>
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:pl-4 border-indigo-100">
                    <div className="text-xs text-gray-500">Primary Surgeon</div>
                    <div className="text-sm font-semibold text-gray-900">{bookingDetail.surgeon_name}</div>
                    <div className="text-xs text-indigo-700 font-medium mt-1 truncate max-w-xs">
                      {bookingDetail.procedure_name}
                    </div>
                  </div>
                </div>

                {/* Surgical Lifecycle Action Stepper Controls */}
                <div className="mt-4 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    {bookingDetail.status === "Scheduled" && (
                      <span>Patient arrived in theatre. Click <strong>Start Surgery</strong> when incision pause begins.</span>
                    )}
                    {bookingDetail.status === "InProgress" && (
                      <span>Surgery active. Scan consumables below. Click <strong>Complete Surgery</strong> when Sign Out finishes.</span>
                    )}
                    {bookingDetail.status === "Cleaning" && (
                      <span>Theatre decontaminated and prepared. Click <strong>Complete Cleaning</strong> to release theatre.</span>
                    )}
                    {bookingDetail.status === "Completed" && (
                      <span>Surgery and cleaning finalized. Record is closed.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Stage 1: Start Surgery */}
                    {canStartSurgery(bookingDetail.status) && viewMode !== "records" && (
                      <button
                        type="button"
                        data-help="ot_intraop.start_surgery_btn"
                        onClick={handleStartSurgery}
                        disabled={!canManage || actionInProgress === "start"}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold shadow hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionInProgress === "start" ? "Starting..." : "Start Surgery / سرجری شروع کریں"}
                      </button>
                    )}

                    {/* Stage 2: Complete Surgery */}
                    {canCompleteSurgery(bookingDetail.status) && viewMode !== "records" && (
                      <button
                        type="button"
                        data-help="ot_intraop.complete_surgery_btn"
                        onClick={handleCompleteSurgery}
                        disabled={!canManage || actionInProgress === "complete_surgery"}
                        className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-semibold shadow hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionInProgress === "complete_surgery"
                          ? "Completing..."
                          : "Complete Surgery / سرجری مکمل کریں"}
                      </button>
                    )}

                    {/* Stage 3: Complete Cleaning */}
                    {canCompleteCleaning(bookingDetail.status) && viewMode !== "records" && (
                      <button
                        type="button"
                        data-help="ot_intraop.complete_cleaning_btn"
                        onClick={handleCompleteCleaning}
                        disabled={!canManage || actionInProgress === "complete_cleaning"}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold shadow hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionInProgress === "complete_cleaning"
                          ? "Cleaning..."
                          : "Complete Cleaning / صفائی مکمل کریں"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Consumables Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wider">Total Scanned</div>
                  <div className="text-lg font-bold text-gray-900">{consumableSummary.totalCount}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-[11px] text-emerald-600 uppercase tracking-wider">Active Items</div>
                  <div className="text-lg font-bold text-emerald-700">{consumableSummary.activeCount}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-[11px] text-amber-600 uppercase tracking-wider">Reversals</div>
                  <div className="text-lg font-bold text-amber-700">{consumableSummary.reversedCount}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-[11px] text-indigo-600 uppercase tracking-wider">Consumables Total</div>
                  <div className="text-lg font-bold text-indigo-800">
                    PKR {consumableSummary.totalRevenue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Consumable Scan Form (Enabled while InProgress) */}
              {viewMode !== "records" && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        Scan Consumable into Surgery / سامان کا اندراج
                      </h3>
                      {!canAddConsumables(bookingDetail.status) && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                          Scanning active only during InProgress stage
                        </span>
                      )}
                    </div>

                    <div className="inline-flex rounded-md shadow-sm" role="group">
                      <button
                        type="button"
                        data-help="ot_intraop.scan_mode_barcode"
                        onClick={() => setScanMode("barcode")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-l-md border ${
                          scanMode === "barcode"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Barcode Scan (Pharmacy Stock)
                      </button>
                      <button
                        type="button"
                        data-help="ot_intraop.scan_mode_custom"
                        onClick={() => setScanMode("custom")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-r-md border-t border-b border-r ${
                          scanMode === "custom"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Vendor Implant / Non-Stock
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleScanSubmit} className="space-y-4">
                    {scanMode === "barcode" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div className="sm:col-span-3">
                          <label htmlFor="barcode_input_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Scan Lot Barcode (FEFO):
                          </label>
                          <input
                            id="barcode_input_intraop"
                            type="text"
                            data-help="ot_intraop.barcode_input"
                            placeholder="Scan or enter item barcode (e.g. LOT-1001-MED)..."
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            autoFocus
                            className="w-full text-sm font-mono border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label htmlFor="qty_input_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity:
                          </label>
                          <input
                            id="qty_input_intraop"
                            type="number"
                            min="1"
                            data-help="ot_intraop.qty_input"
                            value={qtyInput}
                            onChange={(e) => setQtyInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
                        <div className="sm:col-span-3">
                          <label htmlFor="desc_input_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Implant / Consumable Description:
                          </label>
                          <input
                            id="desc_input_intraop"
                            type="text"
                            data-help="ot_intraop.description_input"
                            placeholder="e.g. Bone Plate 3.5mm / Dacron Patch..."
                            value={descriptionInput}
                            onChange={(e) => setDescriptionInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label htmlFor="qty_custom_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity:
                          </label>
                          <input
                            id="qty_custom_intraop"
                            type="number"
                            min="1"
                            data-help="ot_intraop.qty_input"
                            value={qtyInput}
                            onChange={(e) => setQtyInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label htmlFor="unit_cost_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Unit Cost (PKR):
                          </label>
                          <input
                            id="unit_cost_intraop"
                            type="number"
                            min="0"
                            step="any"
                            data-help="ot_intraop.unit_cost_input"
                            placeholder="Cost"
                            value={unitCostInput}
                            onChange={(e) => setUnitCostInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label htmlFor="unit_retail_intraop" className="block text-xs font-medium text-gray-700 mb-1">
                            Unit Retail (PKR):
                          </label>
                          <input
                            id="unit_retail_intraop"
                            type="number"
                            min="0"
                            step="any"
                            data-help="ot_intraop.unit_retail_input"
                            placeholder="Retail"
                            value={unitRetailInput}
                            onChange={(e) => setUnitRetailInput(e.target.value)}
                            disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-gray-500">
                        {scanMode === "barcode"
                          ? "Scanned lot automatically deducts pharmacy stock and attaches to patient surgery billing."
                          : "Vendor implant recorded with acquisition cost and patient charge."}
                      </p>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          data-help="ot_intraop.clear_form_btn"
                          onClick={() => {
                            setBarcodeInput("");
                            setDescriptionInput("");
                            setUnitCostInput("");
                            setUnitRetailInput("");
                            setQtyInput("1");
                          }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded hover:bg-gray-50"
                        >
                          Clear
                        </button>

                        <button
                          type="submit"
                          data-help="ot_intraop.scan_submit_btn"
                          disabled={!canAddConsumables(bookingDetail.status) || submittingScan || !canRecord}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold shadow hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {submittingScan ? "Recording..." : "Record Scan / اندراج کریں"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Scanned Consumables Table */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    Scanned Consumables & Implants / اسکین شدہ سامان
                  </h3>
                  <span className="text-xs text-gray-500">
                    Rule f228c617bd: Mistaken scans are reversed (never deleted).
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Item / Description</th>
                        <th className="px-4 py-3">Batch / Lot</th>
                        <th className="px-3 py-3 text-right">Qty</th>
                        <th className="px-3 py-3 text-right">Cost (PKR)</th>
                        <th className="px-3 py-3 text-right">Revenue (PKR)</th>
                        <th className="px-4 py-3">Scanned By</th>
                        <th className="px-3 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {!bookingDetail.consumables || bookingDetail.consumables.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                            No consumables or implants recorded for this case yet.
                          </td>
                        </tr>
                      ) : (
                        bookingDetail.consumables.map((item) => {
                          const isEligibleForReversal = canReverseConsumable(item);
                          const isReversalRow = item.is_reversal;
                          const isReversedOriginal = item.is_reversed;

                          return (
                            <tr
                              key={item.ot_consumable_id}
                              className={`transition-colors ${
                                isReversalRow
                                  ? "bg-red-50/50 text-red-900"
                                  : isReversedOriginal
                                  ? "bg-gray-50/80 text-gray-400 line-through"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.description}</div>
                                {item.drug_code && (
                                  <div className="text-[10px] text-gray-500 font-mono">
                                    Code: {item.drug_code}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                                {item.batch_no || "N/A"}
                              </td>

                              <td className="px-3 py-3 text-right font-semibold">
                                {item.qty}
                              </td>

                              <td className="px-3 py-3 text-right text-gray-600">
                                {item.line_cost?.toLocaleString() || "0"}
                              </td>

                              <td className="px-3 py-3 text-right text-indigo-800 font-medium">
                                {item.line_revenue?.toLocaleString() || "0"}
                              </td>

                              <td className="px-4 py-3 text-gray-600">
                                <div>{item.scanned_by_name || `Staff #${item.scanned_by}`}</div>
                                <div className="text-[10px] text-gray-400">
                                  {new Date(item.scanned_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </td>

                              <td className="px-3 py-3 text-center">
                                {isReversalRow ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                    Reversal Row
                                  </span>
                                ) : isReversedOriginal ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Reversed
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Active
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center">
                                {isEligibleForReversal ? (
                                  <button
                                    type="button"
                                    data-help="ot_intraop.reverse_btn"
                                    onClick={() => handleOpenReversal(item)}
                                    disabled={!canAddConsumables(bookingDetail.status) || !canRecord}
                                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Reverse Scan / منسوخ
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">Immutable</span>
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
            </>
          ) : null}
        </div>
      </div>

      {/* Statutory Mistaken Scan Reversal Modal (Rule f228c617bd) */}
      {reversingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Reverse Mistaken Consumable Scan
              </h3>
              <button
                type="button"
                data-help="ot_intraop.reverse_cancel_btn"
                onClick={handleCloseReversal}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-amber-800 text-xs">
              <strong>Statutory Audit Requirement (Rule f228c617bd):</strong>
              <p className="mt-0.5">
                Mistaken scans are reversed with an explanatory reason and mirrored in the audit trail. Records are never deleted.
              </p>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-semibold text-gray-600">Item:</span> {reversingItem.description}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Quantity: {reversingItem.qty}</span>
                <span>Batch: {reversingItem.batch_no || "N/A"}</span>
              </div>
            </div>

            {reversalError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded">
                {reversalError}
              </div>
            )}

            <div>
              <label htmlFor="reversal_reason_intraop" className="block text-xs font-semibold text-gray-700 mb-1">
                Mandatory Reversal Reason / منسوخی کی وجہ:
              </label>
              <textarea
                id="reversal_reason_intraop"
                data-help="ot_intraop.reverse_reason_input"
                rows={3}
                placeholder="e.g. Scanned wrong tray barcode; Suture package dropped prior to opening..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400">Minimum 3 characters, maximum 1000 characters.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                data-help="ot_intraop.reverse_cancel_btn"
                onClick={handleCloseReversal}
                disabled={submittingReversal}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel / منسوخ کریں
              </button>
              <button
                type="button"
                data-help="ot_intraop.reverse_confirm_btn"
                onClick={handleConfirmReversal}
                disabled={submittingReversal || !reversalReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold shadow hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {submittingReversal ? "Processing..." : "Confirm Reversal / تصدیق کریں"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OTIntraop;
