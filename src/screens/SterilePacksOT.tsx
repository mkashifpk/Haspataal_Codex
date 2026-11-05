import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  use as usePack,
  getPack,
  listPacks,
  PackOut,
  PackUseIn,
} from "../generated/sterile_packs_ot";
import {worklistOtClinical, type SurgicalWorklistItemOut} from '../generated/sterile_packs_ot';
import {
  getSterilePacksScreenView,
  canUsePack,
  canViewPacks,
  isPackUsable,
  validatePackUseInput,
  isPackExpiringSoon,
  isCssdRecallEvent,
  explainSterilePackError,
  ClinicalUser,
} from "../sterile-packs-policy";

interface SterilePacksOTProps {
  screenId?: string;
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const SterilePacksOT: React.FC<SterilePacksOTProps> = ({
  screenId = "sterile_packs_ot",
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;

  // Screen capability view mode (Rule 26e45f89a1 / Rule d897ee980e)
  const viewMode = useMemo(
    () => getSterilePacksScreenView(establishment, screenId),
    [establishment, screenId]
  );

  const canUse = useMemo(() => canUsePack(currentUser), [currentUser]);
  const canView = useMemo(() => canViewPacks(currentUser), [currentUser]);

  // Surgical cases queue for context
  const [bookings, setBookings] = useState<SurgicalWorklistItemOut[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [caseSearch, setCaseSearch] = useState("");

  // Packs stock & history
  const [packs, setPacks] = useState<PackOut[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [packSearch, setPackSearch] = useState("");
  const [loadingPacks, setLoadingPacks] = useState(false);

  // Active pack scanner state
  const [scanCode, setScanCode] = useState("");
  const [scannedPack, setScannedPack] = useState<PackOut | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [recordingUse, setRecordingUse] = useState(false);

  // Alerts & recalls
  const [alert, setAlert] = useState<{ type: "success" | "error" | "warning"; messageEn: string; messageUr: string } | null>(null);
  const [recallAlert, setRecallAlert] = useState<{ cycleNumber: string; messageEn: string; messageUr: string } | null>(null);

  // Selected booking record
  const selectedBooking = useMemo(
    () => bookings.find((b) => b.booking_id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  // Fetch active surgical cases
  const loadBookings = useCallback(async () => {
    try {
      const data = await worklistOtClinical();
      setBookings(data);
      if (data.length > 0 && !selectedBookingId) {
        // Default to first active InProgress or Scheduled booking
        const active = data.find((b) => b.status === "InProgress") || data[0];
        setSelectedBookingId(active.booking_id);
      }
    } catch {
      // Keep existing bookings on error
    }
  }, [selectedBookingId]);

  // Fetch sterile packs
  const loadPacks = useCallback(async () => {
    if (!canView) return;
    setLoadingPacks(true);
    try {
      const statusParam = statusFilter === "All" ? null : (statusFilter as any);
      const data = await listPacks({ status: statusParam, limit: 200 });
      setPacks(data);
    } catch (err: any) {
      const explained = explainSterilePackError(err.code || "LOAD_FAILED");
      setAlert({ type: "error", messageEn: explained.en, messageUr: explained.ur });
    } finally {
      setLoadingPacks(false);
    }
  }, [canView, statusFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  // Handle realtime events from stream (Rule 4357be8acb: cssd.cycle.updated with status Recalled)
  useEffect(() => {
    if (!stream) return;
    try {
      const event = JSON.parse(stream);
      if (event.event === "cssd.cycle.updated") {
        if (isCssdRecallEvent(event.payload)) {
          setRecallAlert({
            cycleNumber: event.payload?.cycle_number || "Unknown",
            messageEn: `CRITICAL RECALL: Sterilization load ${event.payload?.cycle_number || ""} has been RECALLED! Do NOT use any packs from this cycle (Rule 4357be8acb, MSDS IPC 92).`,
            messageUr: `اہم اطلاع: سٹرلائزیشن سائیکل ${event.payload?.cycle_number || ""} کو فوری واپس منگوا لیا گیا ہے! اس لاٹ کا کوئی پیک استعمال نہ کریں۔`,
          });
        }
        loadPacks();
      } else if (event.event === "ot.booking.updated") {
        loadBookings();
      }
    } catch {
      // Ignore unparseable stream messages
    }
  }, [stream, loadPacks, loadBookings]);

  // Handle pack lookup (GET /cssd/packs/{pack_code})
  const handleLookupPack = async (codeToLookup?: string) => {
    const code = (codeToLookup || scanCode).trim();
    if (!code) return;

    setLookingUp(true);
    setAlert(null);
    try {
      const pack = await getPack(code);
      setScannedPack(pack);
      const usability = isPackUsable(pack);
      if (!usability.usable) {
        setAlert({
          type: "error",
          messageEn: `Rule 5eabbbecca Violation: ${usability.reason}`,
          messageUr: usability.reasonUr || "یہ پیک استعمال کے قابل نہیں ہے۔",
        });
      } else if (isPackExpiringSoon(pack)) {
        setAlert({
          type: "warning",
          messageEn: `Warning: Pack ${pack.pack_code} is expiring soon (${pack.expires_on}). Use first under FEFO rules.`,
          messageUr: `انتباہ: پیک ${pack.pack_code} کی میعاد جلد ختم ہونے والی ہے (${pack.expires_on})۔`,
        });
      }
    } catch (err: any) {
      const explained = explainSterilePackError(err.code || "NOT_FOUND");
      setAlert({ type: "error", messageEn: explained.en, messageUr: explained.ur });
      setScannedPack(null);
    } finally {
      setLookingUp(false);
    }
  };

  // Handle pack use submission (POST /cssd/packs/use, Rule d8f4d7af47)
  const handleRecordUse = async () => {
    if (!scannedPack) return;

    const validation = validatePackUseInput(scannedPack.pack_code, {
      booking_id: selectedBookingId,
    });

    if (!validation.valid) {
      setAlert({
        type: "error",
        messageEn: validation.error || "Validation failed.",
        messageUr: validation.errorUr || "تصدیق ناکام ہو گئی۔",
      });
      return;
    }

    const usability = isPackUsable(scannedPack);
    if (!usability.usable) {
      setAlert({
        type: "error",
        messageEn: usability.reason || "Pack unusable.",
        messageUr: usability.reasonUr || "پیک ناقابل استعمال ہے۔",
      });
      return;
    }

    setRecordingUse(true);
    setAlert(null);
    try {
      const payload: PackUseIn = {
        pack_code: scannedPack.pack_code,
        booking_id: selectedBookingId,
      };
      const updated = await usePack(payload);
      setAlert({
        type: "success",
        messageEn: `Sterile pack ${updated.pack_code} (${updated.set_name}) recorded as opened for surgical case #${selectedBookingId} (Rule d8f4d7af47, MSDS IPC 92).`,
        messageUr: `جراثیم سے پاک پیک ${updated.pack_code} سرجری کے لیے کامیابی سے ریکارڈ ہو گیا۔`,
      });
      setScanCode("");
      setScannedPack(null);
      await loadPacks();
    } catch (err: any) {
      const explained = explainSterilePackError(err.code || "USE_FAILED");
      setAlert({ type: "error", messageEn: explained.en, messageUr: explained.ur });
    } finally {
      setRecordingUse(false);
    }
  };

  // Filtered surgical bookings list
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const query = caseSearch.toLowerCase();
      const matchSearch =
        !query ||
        b.patient_name.toLowerCase().includes(query) ||
        b.mrn.toLowerCase().includes(query) ||
        b.procedure_name.toLowerCase().includes(query) ||
        (b.ot_name && b.ot_name.toLowerCase().includes(query));
      return matchSearch;
    });
  }, [bookings, caseSearch]);

  // Filtered packs list
  const filteredPacks = useMemo(() => {
    return packs.filter((p) => {
      const query = packSearch.toLowerCase();
      const matchSearch =
        !query ||
        p.pack_code.toLowerCase().includes(query) ||
        p.set_name.toLowerCase().includes(query) ||
        p.cycle_number.toLowerCase().includes(query) ||
        (p.patient_name && p.patient_name.toLowerCase().includes(query)) ||
        (p.mrn && p.mrn.toLowerCase().includes(query));
      return matchSearch;
    });
  }, [packs, packSearch]);

  // Usability state for the currently scanned pack
  const currentPackUsability = useMemo(() => {
    if (!scannedPack) return null;
    return isPackUsable(scannedPack);
  }, [scannedPack]);

  return (
    <div className="sterile-packs-container p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header & Capability Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <span>Sterile Packs: Scan when opened</span>
            <span className="text-lg font-normal text-gray-600 font-urdu">
              (جراثیم سے پاک پیک: استعمال پر اسکین)
            </span>
          </h1>
          <p className="text-sm text-gray-500">
            MSDS IPC 91 & 92 statutory traceability: Every sterile pack opened for surgery is linked to the patient record before incision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {connected ? "● Live WebSocket" : "○ Disconnected"}
          </span>
          <button
            type="button"
            data-help="sterile_packs.refresh_button"
            onClick={() => {
              loadBookings();
              loadPacks();
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Retiring / Capability view banner (Rule 26e45f89a1) */}
      {viewMode === "open_work" && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
          <p className="text-sm text-amber-700 font-medium">
            Service Retiring: No new sterile pack sets are being processed. Open theatre cases may continue scanning existing stock.
          </p>
        </div>
      )}
      {viewMode === "records" && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-sm text-blue-700 font-medium">
            Records Mode: Service retired. Viewing historical pack usage and recall audit logs only.
          </p>
        </div>
      )}

      {/* Critical Recall Alert Banner (Rule 4357be8acb) */}
      {recallAlert && (
        <div className="bg-red-600 text-white p-4 rounded-md shadow flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-base">
              <span>⚠️ CRITICAL CSSD RECALL ALERT</span>
              <span className="text-xs bg-white text-red-700 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                Cycle #{recallAlert.cycleNumber}
              </span>
            </div>
            <p className="text-sm">{recallAlert.messageEn}</p>
            <p className="text-xs text-red-100 font-urdu">{recallAlert.messageUr}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-help="sterile_packs.recall_filter"
              onClick={() => {
                setStatusFilter("Recalled");
              }}
              className="px-3 py-1 bg-white text-red-700 text-xs font-semibold rounded hover:bg-red-50"
            >
              Filter Recalled Packs
            </button>
            <button
              type="button"
              data-help="sterile_packs.dismiss_alert"
              onClick={() => setRecallAlert(null)}
              className="text-white hover:text-red-200 text-sm font-bold px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Operation Result Alert */}
      {alert && (
        <div
          className={`p-3 rounded-md flex items-center justify-between text-sm ${
            alert.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : alert.type === "warning"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div>
            <p className="font-medium">{alert.messageEn}</p>
            <p className="font-urdu text-xs opacity-90">{alert.messageUr}</p>
          </div>
          <button
            type="button"
            data-help="sterile_packs.dismiss_alert"
            onClick={() => setAlert(null)}
            className="text-gray-500 hover:text-gray-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left Surgical Context & Right Scanner + Used Packs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Surgical Case Context (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                1. Select Theatre Case
              </h2>
              <span className="text-xs text-gray-500 font-mono">
                {filteredBookings.length} cases
              </span>
            </div>

            <div>
              <input
                type="text"
                data-help="sterile_packs.case_search"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder="Search patient, MRN, theatre..."
                className="w-full text-xs px-2.5 py-1.5 border rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredBookings.length === 0 ? (
                <div className="text-xs text-gray-500 p-3 text-center bg-gray-50 rounded">
                  No matching surgical cases.
                </div>
              ) : (
                filteredBookings.map((b) => {
                  const isSelected = b.booking_id === selectedBookingId;
                  return (
                    <button
                      key={b.booking_id}
                      type="button"
                      data-help="sterile_packs.case_select"
                      onClick={() => setSelectedBookingId(b.booking_id)}
                      className={`w-full text-left p-2.5 rounded border text-xs transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-gray-900">
                        <span>{b.patient_name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            b.status === "InProgress"
                              ? "bg-red-100 text-red-800"
                              : b.status === "Scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="text-gray-500 mt-0.5">
                        <span className="font-mono">{b.mrn}</span> • {b.ot_name || "Theatre"}
                      </div>
                      <div className="text-gray-700 font-medium truncate mt-0.5">
                        {b.procedure_name}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Patient Context Identity Banner (MSDS IPC 92) */}
          {selectedBooking ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
              <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                Active Surgical Case Target
              </div>
              <div className="text-sm font-bold text-slate-900">
                {selectedBooking.patient_name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400">MRN:</span>{" "}
                  <span className="font-mono font-medium">{selectedBooking.mrn}</span>
                </div>
                <div>
                  <span className="text-slate-400">Theatre:</span>{" "}
                  <span className="font-medium">{selectedBooking.ot_name || "Theatre"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Surgeon:</span>{" "}
                  <span className="font-medium">{selectedBooking.surgeon_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>{" "}
                  <span className="font-medium">{selectedBooking.status}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-xs">
              Select an active surgical case above to link scanned packs (Rule d8f4d7af47).
            </div>
          )}
        </div>

        {/* Right Column: Pack Scanner & Used Packs Ledger (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Scanner Card */}
          <div className="bg-white border rounded-lg shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                2. Point-of-Use Pack Scanner
              </h2>
              <span className="text-xs text-gray-500">
                Scan sterile pack label as it is opened (MSDS IPC 92)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  data-help="sterile_packs.barcode_input"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLookupPack();
                    }
                  }}
                  placeholder="Scan or enter pack barcode (e.g. PACK-2026-0001)..."
                  disabled={viewMode === "records" || !canUse}
                  className="w-full text-sm font-mono px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
              <button
                type="button"
                data-help="sterile_packs.lookup_button"
                onClick={() => handleLookupPack()}
                disabled={!scanCode.trim() || lookingUp || viewMode === "records"}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {lookingUp ? "Checking..." : "Inspect Pack"}
              </button>
            </div>

            {/* Scanned Pack Inspection Result Card */}
            {scannedPack && (
              <div
                className={`p-4 rounded-lg border text-xs space-y-3 ${
                  currentPackUsability?.usable === false
                    ? "bg-red-50 border-red-300"
                    : isPackExpiringSoon(scannedPack)
                    ? "bg-amber-50 border-amber-300"
                    : "bg-green-50 border-green-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div>
                    <span className="text-base font-bold text-gray-900">
                      {scannedPack.set_name}
                    </span>
                    <span className="ml-2 font-mono text-gray-500">
                      ({scannedPack.set_code})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        scannedPack.status === "Available"
                          ? "bg-green-200 text-green-900"
                          : scannedPack.status === "Issued"
                          ? "bg-blue-200 text-blue-900"
                          : "bg-red-200 text-red-900"
                      }`}
                    >
                      {scannedPack.status}
                    </span>
                    <button
                      type="button"
                      data-help="sterile_packs.clear_pack"
                      onClick={() => {
                        setScannedPack(null);
                        setScanCode("");
                      }}
                      className="text-gray-400 hover:text-gray-600 font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-700">
                  <div>
                    <div className="text-gray-400">Pack Barcode:</div>
                    <div className="font-mono font-bold text-sm text-gray-900">
                      {scannedPack.pack_code}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Cycle Number:</div>
                    <div className="font-mono font-medium">
                      {scannedPack.cycle_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Cycle Status:</div>
                    <div
                      className={`font-semibold ${
                        scannedPack.cycle_status === "Failed" ||
                        scannedPack.cycle_status === "Recalled"
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {scannedPack.cycle_status}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Expires On:</div>
                    <div
                      className={`font-semibold ${
                        isPackExpiringSoon(scannedPack)
                          ? "text-red-600 font-bold"
                          : "text-gray-900"
                      }`}
                    >
                      {scannedPack.expires_on}
                      {isPackExpiringSoon(scannedPack) && " ⚠️ Soon"}
                    </div>
                  </div>
                </div>

                {/* Usability Decision & Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                  <div>
                    {currentPackUsability?.usable === false ? (
                      <div className="text-red-700 font-bold flex items-center gap-1.5">
                        <span>🛑 CSSD_PACK_UNUSABLE:</span>
                        <span>{currentPackUsability.reason}</span>
                      </div>
                    ) : (
                      <div className="text-green-700 font-medium">
                        ✓ Pack is sterilized and verified for theatre use.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    data-help="sterile_packs.use_button"
                    onClick={handleRecordUse}
                    disabled={
                      !currentPackUsability?.usable ||
                      !selectedBookingId ||
                      recordingUse ||
                      viewMode === "records" ||
                      !canUse
                    }
                    className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {recordingUse ? "Recording..." : "Record Pack Opened for Surgery"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sterile Packs Stock & Usage Ledger */}
          <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                3. Sterile Packs Ledger
              </h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-help="sterile_packs.search_input"
                  value={packSearch}
                  onChange={(e) => setPackSearch(e.target.value)}
                  placeholder="Filter packs ledger..."
                  className="text-xs px-2.5 py-1 border rounded w-44"
                />
                <select
                  data-help="sterile_packs.status_filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs px-2 py-1 border rounded bg-white"
                >
                  <option value="All">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Issued">Issued</option>
                  <option value="Used">Used</option>
                  <option value="Recalled">Recalled</option>
                  <option value="Expired">Expired</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-500">
                    <th className="p-2 font-medium">Pack Code</th>
                    <th className="p-2 font-medium">Set Name</th>
                    <th className="p-2 font-medium">Cycle</th>
                    <th className="p-2 font-medium">Expires</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Patient / Case</th>
                    <th className="p-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingPacks ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">
                        Loading packs...
                      </td>
                    </tr>
                  ) : filteredPacks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">
                        No sterile packs found.
                      </td>
                    </tr>
                  ) : (
                    filteredPacks.map((p) => {
                      const expiring = isPackExpiringSoon(p);
                      return (
                        <tr
                          key={p.pack_id}
                          className={`hover:bg-gray-50 ${
                            p.status === "Recalled"
                              ? "bg-red-50"
                              : expiring
                              ? "bg-amber-50/50"
                              : ""
                          }`}
                        >
                          <td className="p-2 font-mono font-bold">{p.pack_code}</td>
                          <td className="p-2 font-medium">{p.set_name}</td>
                          <td className="p-2 font-mono">{p.cycle_number}</td>
                          <td
                            className={`p-2 ${
                              expiring ? "text-red-600 font-bold" : "text-gray-600"
                            }`}
                          >
                            {p.expires_on}
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                p.status === "Used"
                                  ? "bg-purple-100 text-purple-800"
                                  : p.status === "Available"
                                  ? "bg-green-100 text-green-800"
                                  : p.status === "Issued"
                                  ? "bg-blue-100 text-blue-800"
                                  : p.status === "Recalled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2 text-gray-600">
                            {p.patient_name ? (
                              <div>
                                <span className="font-medium text-gray-900">
                                  {p.patient_name}
                                </span>{" "}
                                <span className="font-mono text-[10px]">
                                  ({p.mrn})
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              data-help="sterile_packs.lookup_button"
                              onClick={() => {
                                setScanCode(p.pack_code);
                                handleLookupPack(p.pack_code);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
