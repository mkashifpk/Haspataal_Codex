import {DirectoryPicker} from "../DirectoryPicker";
/**
 * Screen 138: pharmacy_storage_log
 * "Medicine storage log"
 * Workspace: `pharmacy_admin`, Position: 138, Points: 51.
 *
 * Statutory & Quality Rules:
 * - rule:09925ecb70: Record: storage_area (pick from areas already used, or type a new one: keep one spelling per place),
 *                    kind (Room / Refrigerator / Freezer / ColdChainBox), the ward for a ward cupboard, temperature,
 *                    humidity (optional), own limits only for a place with its own range (a vaccine box). The limits of
 *                    the kind come from settings (pharmacy_room_*_c, pharmacy_fridge_*_c, pharmacy_freezer_*_c).
 * - rule:e66d8b92db: Out of range: the form demands action_taken (STORAGE_CHECK_ACTION_REQUIRED); show the row red;
 *                    the event pharmacy.storage.out_of_range reaches the pharmacists at once.
 * - rule:ac70d74fb1: Summary tiles per area: readings, out of range, lowest, highest, days with both readings of the day
 *                    (expected checks_per_day = 2); a day with one reading or none is a gap to explain to the surveyor.
 * - rule:1b0e847e97: Print the register for the period the surveyor asks (PDF). Ward nurses record their own ward's
 *                    cupboard and refrigerator from the ward screens with the same POST.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  listStorageChecks,
  storageSummary,
  recordStorageCheck,
  storageRegisterPdf,
  type StorageCheckOut,
  type StorageSummaryOut,
  type StorageCheckIn,
  type StorageAreaSummaryOut,
} from "../generated/pharmacy_storage_log";
import {
  getPharmacyStorageLogCapabilityView,
  validateStorageCheckInput,
  resolveStorageLimits,
  STORAGE_LOG_ERROR_MESSAGES,
  STORAGE_KINDS,
  STORAGE_KIND_LABELS,
  DEFAULT_STORAGE_RANGES,
  type PharmacyStorageLogCapabilityView,
  type StorageKind,
} from "../pharmacy-storage-log-policy";

export interface PharmacyStorageLogProps {
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

type TabMode = "log_table" | "surveyor_summary";

export const PharmacyStorageLog: React.FC<PharmacyStorageLogProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: PharmacyStorageLogCapabilityView = useMemo(
    () => getPharmacyStorageLogCapabilityView(establishment),
    [establishment]
  );

  const canRecord = useMemo(
    () =>
      user.permissions.includes("pharmacy.storage.record") ||
      user.roles.some((r) =>
        ["head_nurse", "pharmacist", "pharmacy_admin", "ward_nurse"].includes(r)
      ),
    [user]
  );

  const canView = useMemo(
    () =>
      user.permissions.some((p) =>
        ["pharmacy.stock.view", "medication.safety.view", "pharmacy.storage.record"].includes(p)
      ) ||
      canRecord ||
      user.roles.some((r) =>
        [
          "anaesthetist",
          "clinic_director",
          "clinical_specialist",
          "doctor",
          "head_nurse",
          "hospital_admin",
          "hospital_director",
          "ot_nurse",
          "owner",
          "pharmacist",
          "pharmacy_admin",
          "quality_officer",
          "surgeon",
          "triage_nurse",
          "ward_nurse",
        ].includes(r)
      ),
    [user, canRecord]
  );

  const [activeTab, setActiveTab] = useState<TabMode>("log_table");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [outOfRangeOnly, setOutOfRangeOnly] = useState<boolean>(false);

  // Data states
  const [checks, setChecks] = useState<StorageCheckOut[]>([]);
  const [summaryData, setSummaryData] = useState<StorageSummaryOut | null>(null);

  // Record modal state
  const [isRecording, setIsRecording] = useState(false);
  const [useCustomLimits, setUseCustomLimits] = useState(false);
  const [recordForm, setRecordForm] = useState<Partial<StorageCheckIn>>({
    storage_area: "",
    storage_kind: "Refrigerator",
    ward_id: null,
    temperature_c: "",
    humidity_pct: "",
    min_c: "",
    max_c: "",
    action_taken: "",
  });

  const translateApiError = useCallback((err: any): string => {
    if (!err) return "Unknown error occurred.";
    const code = err.code || (err.message && err.message.toUpperCase()) || "";
    if (STORAGE_LOG_ERROR_MESSAGES[code]) {
      return `${STORAGE_LOG_ERROR_MESSAGES[code].en} (${STORAGE_LOG_ERROR_MESSAGES[code].ur})`;
    }
    return err.message || String(err);
  }, []);

  // Fetch log readings
  const fetchChecks = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await listStorageChecks({
        date_from: dateFrom || null,
        date_to: dateTo || null,
        storage_area: areaFilter.trim() || null,
        out_of_range_only: outOfRangeOnly || undefined,
      });
      setChecks(data);
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canView, dateFrom, dateTo, areaFilter, outOfRangeOnly, translateApiError]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!canView) return;
    try {
      const data = await storageSummary({
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setSummaryData(data);
    } catch (err: any) {
      console.error("Storage summary error:", err);
    }
  }, [canView, dateFrom, dateTo]);

  // Initial load
  useEffect(() => {
    fetchChecks();
    fetchSummary();
  }, [fetchChecks, fetchSummary]);

  // Realtime subscription: pharmacy.storage.out_of_range
  useEffect(() => {
    const term = (window as any).terminal;
    if (!term || typeof term.subscribe !== "function") return;

    const unsubscribe = term.subscribe(
      "pharmacy.storage.out_of_range",
      (event: { storage_area?: string; temperature_c?: number }) => {
        setErrorMessage(
          `Alert: Out-of-range temperature (${event.temperature_c}°C) recorded for ${event.storage_area || "storage area"}.`
        );
        fetchChecks();
        fetchSummary();
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [fetchChecks, fetchSummary]);

  // Live limits calculation for the active record form
  const activeLimits = useMemo(() => {
    return resolveStorageLimits(
      (recordForm.storage_kind as StorageKind) || "Refrigerator",
      useCustomLimits ? recordForm.min_c : null,
      useCustomLimits ? recordForm.max_c : null,
      summaryData?.ranges || DEFAULT_STORAGE_RANGES
    );
  }, [recordForm.storage_kind, useCustomLimits, recordForm.min_c, recordForm.max_c, summaryData?.ranges]);

  const liveTempNum = Number(recordForm.temperature_c);
  const isLiveOutOfRange =
    recordForm.temperature_c !== "" &&
    !isNaN(liveTempNum) &&
    (liveTempNum < activeLimits.min_c || liveTempNum > activeLimits.max_c);

  // Distinct known storage areas for autocompletion / dropdown
  const knownAreas = useMemo(() => {
    const set = new Set<string>();
    checks.forEach((c) => {
      if (c.storage_area) set.add(c.storage_area);
    });
    if (summaryData?.areas) {
      summaryData.areas.forEach((a) => {
        if (a.storage_area) set.add(a.storage_area);
      });
    }
    return Array.from(set).sort();
  }, [checks, summaryData]);

  // Handle form submission
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRecord) return;

    const payload: StorageCheckIn = {
      storage_area: recordForm.storage_area!.trim(),
      storage_kind: recordForm.storage_kind as StorageKind,
      ward_id: recordForm.ward_id ? Number(recordForm.ward_id) : null,
      temperature_c: Number(recordForm.temperature_c),
      humidity_pct:
        recordForm.humidity_pct !== undefined && recordForm.humidity_pct !== null && recordForm.humidity_pct !== ""
          ? Number(recordForm.humidity_pct)
          : null,
      min_c: useCustomLimits && recordForm.min_c !== "" ? Number(recordForm.min_c) : null,
      max_c: useCustomLimits && recordForm.max_c !== "" ? Number(recordForm.max_c) : null,
      action_taken: recordForm.action_taken?.trim() || null,
    };

    const validation = validateStorageCheckInput(payload, summaryData?.ranges || DEFAULT_STORAGE_RANGES);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      setErrorMessage(firstError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await recordStorageCheck(payload);
      setSuccessMessage(
        `Reading saved: ${result.storage_area} at ${result.temperature_c}°C (${
          result.within_range ? "Within Range" : "Out of Range - Action Logged"
        }).`
      );
      setIsRecording(false);
      setRecordForm({
        storage_area: "",
        storage_kind: "Refrigerator",
        ward_id: null,
        temperature_c: "",
        humidity_pct: "",
        min_c: "",
        max_c: "",
        action_taken: "",
      });
      setUseCustomLimits(false);
      await fetchChecks();
      await fetchSummary();
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // PDF Download
  const handleDownloadPdf = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await storageRegisterPdf({
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setSuccessMessage("Surveyor storage register PDF generated successfully (MSDS MOM 58).");
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Capability View Handling
  if (capabilityView === "hidden") {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="font-semibold text-lg">Medicine storage log is hidden</p>
        <p className="text-sm">Not configured for this facility profile.</p>
      </div>
    );
  }

  const isRecordsOnly = capabilityView === "records";
  const isOpenWorkOnly = capabilityView === "open_work";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-screen="pharmacy_storage_log">
      {/* Capability View Notices */}
      {isOpenWorkOnly && (
        <div className="bg-amber-500/10 border border-amber-500 text-amber-900 dark:text-amber-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              Service Dispensing is Retiring: No new storage checks from now on
            </p>
            <p className="text-xs">
              اب سے درجہ حرارت کا نیا اندراج نہیں ہوگا؛ صرف سابقہ ریکارڈز اور ان کے آڈٹ دستیاب ہیں۔
            </p>
          </div>
        </div>
      )}

      {isRecordsOnly && (
        <div className="bg-blue-500/10 border border-blue-500 text-blue-900 dark:text-blue-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Records Only Mode (صرف ریکارڈز)</p>
            <p className="text-xs">Historical storage temperature register and surveyor compliance logs.</p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Medicine Storage Log & Temperature Monitoring
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            کولڈ چین، ریفریجریٹر و اسٹورز کا درجہ حرارت اور سرویئر رجسٹر (MSDS MOM 58)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRecord && !isRecordsOnly && !isOpenWorkOnly && (
            <button
              type="button"
              onClick={() => setIsRecording(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-md shadow-sm transition flex items-center gap-2 text-sm"
              data-help="pharmacy_storage_log.open_record_modal_btn"
            >
              <span>+ Record Check</span>
              <span className="text-xs opacity-80">(درجہ حرارت کا اندراج)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-md shadow-sm transition text-xs flex items-center gap-1"
            data-help="pharmacy_storage_log.download_register_pdf_btn"
          >
            <span>📄 Print Register PDF</span>
            <span className="opacity-80">(MSDS MOM 58)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchChecks();
              fetchSummary();
            }}
            disabled={loading}
            className="border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm transition"
            data-help="pharmacy_storage_log.refresh_btn"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="font-bold ml-4"
            data-help="pharmacy_storage_log.dismiss_error_btn"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-700 dark:text-emerald-300 p-4 rounded-md text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="font-bold ml-4"
            data-help="pharmacy_storage_log.dismiss_success_btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab("log_table")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === "log_table"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="pharmacy_storage_log.tab_log_table_btn"
        >
          Storage Checks Log ({checks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("surveyor_summary")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === "surveyor_summary"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="pharmacy_storage_log.tab_surveyor_summary_btn"
        >
          Surveyor Compliance Summary
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700 dark:text-gray-300">From Date:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-2 py-1 dark:bg-gray-800"
            data-help="pharmacy_storage_log.filter_date_from_input"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-700 dark:text-gray-300">To Date:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-2 py-1 dark:bg-gray-800"
            data-help="pharmacy_storage_log.filter_date_to_input"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Storage Area:</span>
          <input
            type="text"
            placeholder="Filter by name..."
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="border rounded px-2 py-1 w-full dark:bg-gray-800"
            data-help="pharmacy_storage_log.filter_area_input"
          />
        </div>

        <label className="flex items-center gap-1.5 font-semibold text-red-600 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={outOfRangeOnly}
            onChange={(e) => setOutOfRangeOnly(e.target.checked)}
            data-help="pharmacy_storage_log.filter_out_of_range_checkbox"
          />
          <span>Out of Range Only (صرف انحراف)</span>
        </label>
      </div>

      {/* TAB 1: LOG TABLE */}
      {activeTab === "log_table" && (
        <div className="space-y-4">
          {checks.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-lg text-gray-500">
              <p className="font-medium">No storage temperature readings found for the selected period.</p>
              <p className="text-xs mt-1">
                Click &quot;+ Record Check&quot; above to log the morning or evening routine temperature reading.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-left">
                  <tr>
                    <th className="px-3.5 py-3 font-semibold">Timestamp</th>
                    <th className="px-3.5 py-3 font-semibold">Storage Area</th>
                    <th className="px-3.5 py-3 font-semibold">Kind</th>
                    <th className="px-3.5 py-3 font-semibold">Ward / Location</th>
                    <th className="px-3.5 py-3 font-semibold text-right">Temp (°C)</th>
                    <th className="px-3.5 py-3 font-semibold text-center">Permitted Limits</th>
                    <th className="px-3.5 py-3 font-semibold text-right">Humidity</th>
                    <th className="px-3.5 py-3 font-semibold text-center">Status</th>
                    <th className="px-3.5 py-3 font-semibold">Action Taken (Out of Range)</th>
                    <th className="px-3.5 py-3 font-semibold text-right">Checked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {checks.map((c) => {
                    const isAlert = !c.within_range;
                    return (
                      <tr
                        key={c.check_id}
                        className={`transition ${
                          isAlert
                            ? "bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200 font-medium"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono">
                          {new Date(c.recorded_at).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold">{c.storage_area}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="px-2 py-0.5 rounded text-[11px] border bg-gray-100 dark:bg-gray-800">
                            {c.storage_kind}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-600 dark:text-gray-400">
                          {c.ward_name || "Main Pharmacy"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-sm">
                          <span
                            className={
                              isAlert ? "text-red-600 dark:text-red-400 font-black" : "text-emerald-700"
                            }
                          >
                            {c.temperature_c.toFixed(1)}°C
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono text-[11px] text-gray-500">
                          {c.min_c.toFixed(1)}°C – {c.max_c.toFixed(1)}°C
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono">
                          {c.humidity_pct !== null ? `${c.humidity_pct.toFixed(0)}%` : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.within_range
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                            }`}
                          >
                            {c.within_range ? "Within Range" : "OUT OF RANGE"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 max-w-xs truncate">
                          {c.action_taken ? (
                            <span className="text-red-700 dark:text-red-300 font-medium">
                              {c.action_taken}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-gray-500">
                          {c.recorded_by_name}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SURVEYOR COMPLIANCE SUMMARY */}
      {activeTab === "surveyor_summary" && (
        <div className="space-y-6">
          {summaryData && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Surveyor Register Audit Summary (MSDS MOM 58)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Period: {summaryData.date_from} to {summaryData.date_to} ({summaryData.days} days).
                    Routine required: {summaryData.checks_per_day} checks per day (Morning & Evening).
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="border rounded px-3 py-1 bg-gray-50 dark:bg-gray-900/40 text-center">
                    <div className="text-[10px] text-gray-500">Total Checks</div>
                    <div className="text-base font-bold text-gray-900 dark:text-white">
                      {summaryData.checks}
                    </div>
                  </div>
                  <div className="border rounded px-3 py-1 bg-gray-50 dark:bg-gray-900/40 text-center">
                    <div className="text-[10px] text-gray-500">Out of Range</div>
                    <div
                      className={`text-base font-bold ${
                        summaryData.out_of_range > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {summaryData.out_of_range}
                    </div>
                  </div>
                </div>
              </div>

              {/* Standard Thresholds in force */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-gray-50 dark:bg-gray-900/30 p-3 rounded">
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Room Target:</span>{" "}
                  {summaryData.ranges.room_min}°C – {summaryData.ranges.room_max}°C
                </div>
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Refrigerator Target:</span>{" "}
                  {summaryData.ranges.fridge_min}°C – {summaryData.ranges.fridge_max}°C
                </div>
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Freezer Target:</span>{" "}
                  {summaryData.ranges.freezer_min}°C – {summaryData.ranges.freezer_max}°C
                </div>
              </div>
            </div>
          )}

          {/* Area Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaryData?.areas?.map((a, i) => {
              const complianceGap = a.days_complete < summaryData.days;
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                        {a.storage_area}
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {a.storage_kind} | {a.ward_name || "Main Pharmacy"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.out_of_range > 0
                          ? "bg-red-100 text-red-800 border border-red-300"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {a.out_of_range > 0 ? `${a.out_of_range} Deviations` : "Zero Deviations"}
                    </span>
                  </div>

                  {/* Temperature extremes */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-gray-900/40 p-2 rounded">
                    <div>
                      <span className="text-gray-500 text-[10px]">Lowest Seen</span>
                      <div className="font-bold text-blue-600">{a.min_seen.toFixed(1)}°C</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px]">Highest Seen</span>
                      <div className="font-bold text-rose-600">{a.max_seen.toFixed(1)}°C</div>
                    </div>
                  </div>

                  {/* Routine Compliance */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Full Routine Days:</span>
                      <span className="font-bold">
                        {a.days_complete} of {summaryData.days} days
                      </span>
                    </div>

                    {complianceGap ? (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded">
                        ⚠ Survey Gap: {summaryData.days - a.days_complete} day(s) missed full 2x daily check.
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-1 rounded text-center">
                        ✓ 100% Full Routine Complete
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-400 border-t pt-2">
                    Last check: {new Date(a.last_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: RECORD STORAGE CHECK */}
      {isRecording && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Record Storage Temperature Reading
                </h3>
                <p className="text-xs text-gray-500">
                  MSDS MOM 58: روزانہ دو بار درجہ حرارت و نمی کا اندراج (Rule rule:09925ecb70)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecording(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
                data-help="pharmacy_storage_log.close_record_modal_btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-3 text-xs">
              {/* Storage Area */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Storage Area Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pharmacy Main Refrigerator 1 or Ward 4 Cupboard"
                  list="known_areas_list"
                  value={recordForm.storage_area || ""}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, storage_area: e.target.value }))}
                  className="w-full border rounded px-3 py-1.5 dark:bg-gray-800"
                  data-help="pharmacy_storage_log.storage_area_input"
                />
                <datalist id="known_areas_list">
                  {knownAreas.map((area, i) => (
                    <option key={i} value={area} />
                  ))}
                </datalist>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Keep exact same spelling per place for consistency in surveyor register.
                </p>
              </div>

              {/* Kind & Ward */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Storage Kind *
                  </label>
                  <select
                    value={recordForm.storage_kind || "Refrigerator"}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, storage_kind: e.target.value as StorageKind }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 dark:bg-gray-800"
                    data-help="pharmacy_storage_log.storage_kind_select"
                  >
                    {STORAGE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k} - {STORAGE_KIND_LABELS[k].en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ward ID (Null for Pharmacy)
                  </label>
                  <DirectoryPicker
                    value={recordForm.ward_id || ""}
                    onChange={(e) =>
                      setRecordForm((prev) => ({
                        ...prev,
                        ward_id: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full border rounded px-3 py-1.5 dark:bg-gray-800"
                    data-help="pharmacy_storage_log.ward_id_input"
                   path="/beds/matrix?include_beds=false" idField="ward_id" list="wards" />
                </div>
              </div>

              {/* Temperature & Humidity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Temperature (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    value={recordForm.temperature_c}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, temperature_c: e.target.value }))}
                    className="w-full border rounded px-3 py-1.5 dark:bg-gray-800 font-mono"
                    data-help="pharmacy_storage_log.temperature_input"
                  />
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Target range: {activeLimits.min_c}°C to {activeLimits.max_c}°C
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Humidity (% optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 55"
                    value={recordForm.humidity_pct || ""}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, humidity_pct: e.target.value }))}
                    className="w-full border rounded px-3 py-1.5 dark:bg-gray-800 font-mono"
                    data-help="pharmacy_storage_log.humidity_input"
                  />
                </div>
              </div>

              {/* Custom Limits toggle */}
              <div className="border-t pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={useCustomLimits}
                    onChange={(e) => setUseCustomLimits(e.target.checked)}
                    data-help="pharmacy_storage_log.custom_limits_checkbox"
                  />
                  <span className="font-medium">
                    Place has own custom limits (e.g. specialized vaccine transport box)
                  </span>
                </label>

                {useCustomLimits && (
                  <div className="grid grid-cols-2 gap-3 mt-2 bg-gray-50 dark:bg-gray-800/40 p-2 rounded">
                    <div>
                      <label className="block text-[11px] text-gray-500">Custom Min Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 2.0"
                        value={recordForm.min_c || ""}
                        onChange={(e) => setRecordForm((prev) => ({ ...prev, min_c: e.target.value }))}
                        className="w-full border rounded px-2 py-1 dark:bg-gray-800 text-xs"
                        data-help="pharmacy_storage_log.custom_min_input"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500">Custom Max Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 8.0"
                        value={recordForm.max_c || ""}
                        onChange={(e) => setRecordForm((prev) => ({ ...prev, max_c: e.target.value }))}
                        className="w-full border rounded px-2 py-1 dark:bg-gray-800 text-xs"
                        data-help="pharmacy_storage_log.custom_max_input"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Out of Range Warning & Mandatory Action Taken */}
              {isLiveOutOfRange && (
                <div className="border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 rounded space-y-2">
                  <div className="text-red-800 dark:text-red-300 font-bold flex items-center gap-1.5">
                    <span>⚠ OUT OF RANGE READING:</span>
                    <span>
                      {liveTempNum}°C is outside {activeLimits.min_c}°C – {activeLimits.max_c}°C
                    </span>
                  </div>
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    Rule rule:e66d8b92db requires recording the remedial action taken (STORAGE_CHECK_ACTION_REQUIRED).
                  </p>
                  <div>
                    <label className="block font-semibold text-red-800 dark:text-red-300 mb-1">
                      Action Taken *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Thermostat adjusted, backup generator started, or cold packs replaced..."
                      value={recordForm.action_taken || ""}
                      onChange={(e) => setRecordForm((prev) => ({ ...prev, action_taken: e.target.value }))}
                      className="w-full border border-red-300 rounded px-2.5 py-1.5 dark:bg-gray-800 text-xs"
                      data-help="pharmacy_storage_log.action_taken_input"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsRecording(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="pharmacy_storage_log.cancel_record_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded shadow transition"
                  data-help="pharmacy_storage_log.submit_record_btn"
                >
                  {loading ? "Saving..." : "Save Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyStorageLog;
