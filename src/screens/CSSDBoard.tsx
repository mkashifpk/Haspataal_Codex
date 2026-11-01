import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  SterilizationCycleIn,
  LoadLineIn,
  SterilizationCycleOut,
  SterilizationCycleDetailOut,
  CycleResultsIn,
  PrintOut_CssdLabelsFieldsOut_,
  SetTypeOut,
  SterilizerOut,
  startCycle,
  listCyclesCssd,
  getCycleCssdCycles,
  recordResults,
  labels,
  listSetTypes,
  listSterilizers,
  logPdf,
} from "../generated/cssd_board";
import {
  getCssdBoardScreenView,
  isCssdActive,
  canOperateCssd,
  canManageCssd,
  canViewCssd,
  canPrintLabels,
  validateCycleStart,
  validateCycleResults,
  isBowieDickRequired,
  explainCssdBoardError,
  sortCyclesBoardOrder,
  getCompatibleSetTypes,
  ClinicalUser,
} from "../cssd-board-policy";

interface CSSDBoardProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const CSSDBoard: React.FC<CSSDBoardProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getCssdBoardScreenView(establishment);
  const isServiceActive = isCssdActive(establishment);
  const canOperate = canOperateCssd(currentUser);
  const canManage = canManageCssd(currentUser);
  const canView = canViewCssd(currentUser);
  const canPrint = canPrintLabels(currentUser);

  // Data states
  const [cycles, setCycles] = useState<SterilizationCycleOut[]>([]);
  const [sterilizers, setSterilizers] = useState<SterilizerOut[]>([]);
  const [setTypes, setSetTypes] = useState<SetTypeOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<{ en: string; ur: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter states
  const [filterSterilizer, setFilterSterilizer] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"board" | "log">("board");

  // Log export date filters
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [logDateFrom, setLogDateFrom] = useState<string>(todayStr);
  const [logDateTo, setLogDateTo] = useState<string>(todayStr);
  const [downloadingLog, setDownloadingLog] = useState<boolean>(false);

  // Start Cycle Modal state
  const [showStartModal, setShowStartModal] = useState<boolean>(false);
  const [startSterilizerId, setStartSterilizerId] = useState<number | null>(null);
  const [startCycleType, setStartCycleType] = useState<"Load" | "BowieDick" | "LeakTest" | "BiologicalTest">("Load");
  const [loadPacks, setLoadPacks] = useState<Array<{ set_type_id: number; count: number }>>([]);
  const [selectedSetTypeId, setSelectedSetTypeId] = useState<number | null>(null);
  const [selectedSetCount, setSelectedSetCount] = useState<number>(1);
  const [startSubmitting, setStartSubmitting] = useState<boolean>(false);
  const [startErrors, setStartErrors] = useState<string[]>([]);

  // Record Results Modal state
  const [showResultsModal, setShowResultsModal] = useState<boolean>(false);
  const [targetCycle, setTargetCycle] = useState<SterilizationCycleOut | null>(null);
  const [resTemp, setResTemp] = useState<string>("134");
  const [resPressure, setResPressure] = useState<string>("210");
  const [resExposure, setResExposure] = useState<string>("4");
  const [resMechanical, setResMechanical] = useState<boolean>(true);
  const [resChemical, setResChemical] = useState<"Pass" | "Fail">("Pass");
  const [resBiological, setResBiological] = useState<"Pending" | "Pass" | "Fail" | "NotUsed">("NotUsed");
  const [resFailureNote, setResFailureNote] = useState<string>("");
  const [resultsSubmitting, setResultsSubmitting] = useState<boolean>(false);
  const [resultsErrors, setResultsErrors] = useState<string[]>([]);

  // Cycle Details Modal state
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [cycleDetail, setCycleDetail] = useState<SterilizationCycleDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Labels Print Preview Modal state
  const [labelData, setLabelData] = useState<PrintOut_CssdLabelsFieldsOut_ | null>(null);
  const [loadingLabels, setLoadingLabels] = useState<boolean>(false);

  // Load initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cyclesData, sterilizersData, setsData] = await Promise.all([
        listCyclesCssd({ limit: 200 }),
        listSterilizers({ active_only: false }),
        listSetTypes({ active_only: false }),
      ]);
      setCycles(cyclesData || []);
      setSterilizers(sterilizersData || []);
      setSetTypes(setsData || []);
    } catch (err: any) {
      const code = err?.code || "FETCH_FAILED";
      setErrorMsg(explainCssdBoardError(code));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime update listener
  useEffect(() => {
    if (!stream) return;
    try {
      const ev = JSON.parse(stream);
      if (ev?.topic === "cssd.cycle.updated" || ev?.type === "cssd.cycle.updated") {
        fetchData();
        if (selectedCycleId && ev?.payload?.cycle_id === selectedCycleId) {
          getCycleCssdCycles(selectedCycleId).then(setCycleDetail).catch(() => {});
        }
      }
    } catch {}
  }, [stream, fetchData, selectedCycleId]);

  // Filtered & sorted cycles (Running and Quarantined pinned at top per rule:b48c7fa7a8)
  const displayedCycles = useMemo(() => {
    let list = [...cycles];
    if (filterSterilizer) {
      const sid = parseInt(filterSterilizer, 10);
      list = list.filter((c) => c.sterilizer_id === sid);
    }
    if (filterStatus) {
      list = list.filter((c) => c.status === filterStatus);
    }
    if (filterType) {
      list = list.filter((c) => c.cycle_type === filterType);
    }
    return sortCyclesBoardOrder(list);
  }, [cycles, filterSterilizer, filterStatus, filterType]);

  // Compatible sets for start modal
  const compatibleSets = useMemo(() => {
    return getCompatibleSetTypes(startSterilizerId, sterilizers, setTypes);
  }, [startSterilizerId, sterilizers, setTypes]);

  // Handle open Start Cycle modal
  const handleOpenStartModal = () => {
    setStartErrors([]);
    const defaultSterilizer = sterilizers.find((s) => s.is_active);
    setStartSterilizerId(defaultSterilizer ? defaultSterilizer.sterilizer_id : null);
    setStartCycleType("Load");
    setLoadPacks([]);
    setSelectedSetTypeId(null);
    setSelectedSetCount(1);
    setShowStartModal(true);
  };

  // Add pack to load
  const handleAddPack = () => {
    if (!selectedSetTypeId) return;
    const count = Math.max(1, selectedSetCount);
    const existingIndex = loadPacks.findIndex((p) => p.set_type_id === selectedSetTypeId);
    if (existingIndex >= 0) {
      const updated = [...loadPacks];
      updated[existingIndex].count += count;
      setLoadPacks(updated);
    } else {
      setLoadPacks([...loadPacks, { set_type_id: selectedSetTypeId, count }]);
    }
    setSelectedSetCount(1);
  };

  // Remove pack from load
  const handleRemovePack = (setTypeId: number) => {
    setLoadPacks(loadPacks.filter((p) => p.set_type_id !== setTypeId));
  };

  // Submit Start Cycle (POST /cssd/cycles)
  const handleConfirmStartCycle = async () => {
    setStartErrors([]);
    const validation = validateCycleStart({
      sterilizer_id: startSterilizerId,
      cycle_type: startCycleType,
      packs: loadPacks,
      sterilizers,
      setTypes,
    });

    if (!validation.valid) {
      setStartErrors(validation.errors);
      return;
    }

    setStartSubmitting(true);
    try {
      const payload: SterilizationCycleIn = {
        sterilizer_id: startSterilizerId!,
        cycle_type: startCycleType,
        ...(startCycleType === "Load" ? { packs: loadPacks } : {}),
      };

      const result = await startCycle(payload);
      setSuccessMsg(`Cycle ${result.cycle_number} started successfully.`);
      setShowStartModal(false);
      await fetchData();

      // If Load cycle with packs, immediately fetch and show pack labels (rule:9a5570e2a6)
      if (startCycleType === "Load" && result.packs > 0) {
        handlePrintLabels(result.cycle_id);
      }
    } catch (err: any) {
      const code = err?.code || "START_FAILED";
      setStartErrors([explainCssdBoardError(code).en]);
    } finally {
      setStartSubmitting(false);
    }
  };

  // Open Record Results modal
  const handleOpenResultsModal = (cycle: SterilizationCycleOut) => {
    setTargetCycle(cycle);
    setResultsErrors([]);
    setResFailureNote("");

    if (cycle.status === "Quarantined") {
      setResBiological("Pass");
    } else {
      // Default standard parameters for steam
      if (cycle.method === "Steam") {
        setResTemp("134");
        setResPressure("210");
        setResExposure("4");
      } else if (cycle.method === "Plasma") {
        setResTemp("55");
        setResPressure("10");
        setResExposure("45");
      } else {
        setResTemp("121");
        setResPressure("105");
        setResExposure("20");
      }
      setResMechanical(true);
      setResChemical("Pass");
      setResBiological(cycle.cycle_type === "BiologicalTest" ? "Pending" : "NotUsed");
    }

    setShowResultsModal(true);
  };

  // Submit Record Results (POST /cssd/cycles/{id}/results)
  const handleConfirmResults = async () => {
    if (!targetCycle) return;
    setResultsErrors([]);

    const validation = validateCycleResults({
      temperature_c: targetCycle.status === "Quarantined" ? null : parseFloat(resTemp),
      pressure_kpa: targetCycle.status === "Quarantined" ? null : parseFloat(resPressure),
      exposure_minutes: targetCycle.status === "Quarantined" ? null : parseFloat(resExposure),
      mechanical_pass: targetCycle.status === "Quarantined" ? null : resMechanical,
      chemical_result: targetCycle.status === "Quarantined" ? null : resChemical,
      biological_result: resBiological,
      failure_note: resFailureNote,
      cycleStatus: targetCycle.status as "Running" | "Quarantined",
    });

    if (!validation.valid) {
      setResultsErrors(validation.errors);
      return;
    }

    setResultsSubmitting(true);
    try {
      const payload: CycleResultsIn =
        targetCycle.status === "Quarantined"
          ? {
              biological_result: resBiological,
              ...(resBiological === "Fail" ? { failure_note: resFailureNote.trim() } : {}),
            }
          : {
              temperature_c: parseFloat(resTemp),
              pressure_kpa: parseFloat(resPressure),
              exposure_minutes: parseFloat(resExposure),
              mechanical_pass: resMechanical,
              chemical_result: resChemical,
              biological_result: resBiological,
              ...(resFailureNote.trim() ? { failure_note: resFailureNote.trim() } : {}),
            };

      const res = await recordResults(targetCycle.cycle_id, payload);
      setSuccessMsg(`Cycle ${res.cycle_number} results recorded: status is now ${res.status}.`);
      setShowResultsModal(false);
      setTargetCycle(null);
      await fetchData();
    } catch (err: any) {
      const code = err?.code || "RESULTS_FAILED";
      setResultsErrors([explainCssdBoardError(code).en]);
    } finally {
      setResultsSubmitting(false);
    }
  };

  // View Cycle Details (GET /cssd/cycles/{id})
  const handleViewCycle = async (cycleId: number) => {
    setSelectedCycleId(cycleId);
    setLoadingDetail(true);
    try {
      const detail = await getCycleCssdCycles(cycleId);
      setCycleDetail(detail);
    } catch (err: any) {
      const code = err?.code || "FETCH_DETAIL_FAILED";
      setErrorMsg(explainCssdBoardError(code));
    } finally {
      setLoadingDetail(false);
    }
  };

  // Print Labels (GET /cssd/cycles/{id}/labels)
  const handlePrintLabels = async (cycleId: number) => {
    setLoadingLabels(true);
    try {
      const data = await labels(cycleId);
      setLabelData(data);
    } catch (err: any) {
      const code = err?.code || "PRINT_LABELS_FAILED";
      setErrorMsg(explainCssdBoardError(code));
    } finally {
      setLoadingLabels(false);
    }
  };

  // Download Log PDF (GET /cssd/log/pdf)
  const handleDownloadLog = async () => {
    if (!logDateFrom || !logDateTo) return;
    setDownloadingLog(true);
    try {
      await logPdf({ date_from: logDateFrom, date_to: logDateTo });
      setSuccessMsg(`Sterilization log for ${logDateFrom} to ${logDateTo} generated.`);
    } catch (err: any) {
      const code = err?.code || "DOWNLOAD_FAILED";
      setErrorMsg(explainCssdBoardError(code));
    } finally {
      setDownloadingLog(false);
    }
  };

  // Gating banner for capability states
  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">
          CSSD Service Inactive
        </h2>
        <p className="text-gray-500 mt-2">
          The Sterile Supply (CSSD) service is not enabled for this facility profile.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 overflow-y-auto">
      {/* Capability View Mode Notice Banners */}
      {viewMode === "open_work" && (
        <div className="mb-4 p-3 bg-amber-100 border border-amber-400 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200 rounded flex justify-between items-center">
          <div>
            <strong>Retiring Service:</strong> No new work from now on. You may view and record results for in-flight cycles, but starting new cycles is disabled.
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-amber-200 dark:bg-amber-800 rounded">
            Open Work Only
          </span>
        </div>
      )}

      {viewMode === "records" && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-800 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-200 rounded flex justify-between items-center">
          <div>
            <strong>Records Mode:</strong> CSSD is retired. Historical cycles and audit logs are available for review.
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded">
            Records
          </span>
        </div>
      )}

      {/* Global Alerts */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200 rounded flex justify-between items-center">
          <div>
            <div>{errorMsg.en}</div>
            <div className="text-sm font-urdu mt-1" dir="rtl">{errorMsg.ur}</div>
          </div>
          <button
            data-help="cssd_board.dismiss_alert_button"
            onClick={() => setErrorMsg(null)}
            className="px-2 py-1 text-sm bg-red-200 hover:bg-red-300 dark:bg-red-800 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200 rounded flex justify-between items-center">
          <div>{successMsg}</div>
          <button
            data-help="cssd_board.dismiss_alert_button"
            onClick={() => setSuccessMsg(null)}
            className="px-2 py-1 text-sm bg-green-200 hover:bg-green-300 dark:bg-green-800 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <header className="flex flex-wrap justify-between items-center pb-4 mb-4 border-b border-gray-300 dark:border-gray-700 gap-2">
        <div className="flex items-center gap-3">
          {navigate && (
            <button
              data-help="cssd_board.back_button"
              onClick={() => navigate("cssd_setup")}
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition"
            >
              ← Setup & Recalls
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sterilization Board</h1>
            <p className="text-sm text-gray-500 font-urdu" dir="rtl">
              سٹرلائزیشن بورڈ: روزانہ ٹیسٹ، لوڈز اور پیک لیبلز
            </p>
          </div>
        </div>

        {/* View Tabs & Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            data-help="cssd_board.tab_board"
            onClick={() => setActiveTab("board")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition ${
              activeTab === "board"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
            }`}
          >
            Active Board
          </button>
          <button
            data-help="cssd_board.tab_log"
            onClick={() => setActiveTab("log")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition ${
              activeTab === "log"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
            }`}
          >
            Audit Log & PDF
          </button>
          <button
            data-help="cssd_board.refresh_button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          {/* Start Cycle button offered only while CSSD is Active (rule:0bdd7f9ba6) */}
          {canOperate && isServiceActive && viewMode === "full" && (
            <button
              data-help="cssd_board.start_cycle_button"
              onClick={handleOpenStartModal}
              className="px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition flex items-center gap-1 shadow-sm"
            >
              <span>+</span> Start Cycle
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "board" ? (
        <div className="space-y-6">
          {/* Sterilizer Readiness Overview Cards */}
          <section className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold mb-3 flex items-center justify-between">
              <span>Sterilizer Chambers & Morning Bowie-Dick Status (MSDS IPC 90)</span>
              <span className="text-xs text-gray-500 font-normal">
                Steam sterilizers require passing Bowie-Dick daily test before steam load release
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {sterilizers.map((st) => {
                const bdNeeded = st.method === "Steam" && isBowieDickRequired(st.sterilizer_id, cycles);
                const activeRunning = cycles.filter(
                  (c) => c.sterilizer_id === st.sterilizer_id && (c.status === "Running" || c.status === "Quarantined")
                );

                return (
                  <div
                    key={st.sterilizer_id}
                    className={`p-3 rounded border text-sm flex flex-col justify-between ${
                      !st.is_active
                        ? "bg-gray-50 border-gray-300 opacity-60 dark:bg-gray-900"
                        : bdNeeded
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                        : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">{st.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono">
                          {st.method}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        Location: {st.location || "Bay 1"} {st.asset_tag ? `• ${st.asset_tag}` : ""}
                      </div>

                      {st.method === "Steam" ? (
                        <div className="text-xs mt-1">
                          {bdNeeded ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                              ⚠️ Bowie-Dick Test Required Today
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              ✓ Bowie-Dick Passed Today
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">Method: Chemical/Plasma (BI gated)</div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/50 flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                      <span>Active Loads: {activeRunning.length}</span>
                      {canOperate && isServiceActive && viewMode === "full" && bdNeeded && (
                        <button
                          data-help="cssd_board.start_cycle_button"
                          onClick={() => {
                            setStartSterilizerId(st.sterilizer_id);
                            setStartCycleType("BowieDick");
                            setLoadPacks([]);
                            setShowStartModal(true);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          Run Bowie-Dick
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>

            <select
              data-help="cssd_board.filter_sterilizer_select"
              value={filterSterilizer}
              onChange={(e) => setFilterSterilizer(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1 bg-white dark:bg-gray-700"
            >
              <option value="">All Sterilizers</option>
              {sterilizers.map((s) => (
                <option key={s.sterilizer_id} value={s.sterilizer_id}>
                  {s.name} ({s.method})
                </option>
              ))}
            </select>

            <select
              data-help="cssd_board.filter_status_select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1 bg-white dark:bg-gray-700"
            >
              <option value="">All Statuses</option>
              <option value="Running">Running (Active)</option>
              <option value="Quarantined">Quarantined (BI Pending)</option>
              <option value="Released">Released</option>
              <option value="Failed">Failed</option>
              <option value="Recalled">Recalled</option>
            </select>

            <select
              data-help="cssd_board.filter_type_select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1 bg-white dark:bg-gray-700"
            >
              <option value="">All Cycle Types</option>
              <option value="Load">Load (Sets & Packs)</option>
              <option value="BowieDick">Bowie-Dick Test</option>
              <option value="LeakTest">Chamber Leak Test</option>
              <option value="BiologicalTest">Biological Indicator Test</option>
            </select>

            <div className="ml-auto text-xs text-gray-500">
              Showing {displayedCycles.length} of {cycles.length} cycles (Running & Quarantined pinned top)
            </div>
          </div>

          {/* Cycles Board Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-3">Cycle #</th>
                    <th className="p-3">Sterilizer</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Packs</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Started At</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Indicators</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {displayedCycles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">
                        {loading ? "Loading sterilization cycles..." : "No cycles found matching the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    displayedCycles.map((c) => {
                      const isPinned = c.status === "Running" || c.status === "Quarantined";
                      return (
                        <tr
                          key={c.cycle_id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition ${
                            isPinned ? "bg-blue-50/40 dark:bg-blue-950/20 font-medium" : ""
                          }`}
                        >
                          <td className="p-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {c.cycle_number}
                          </td>
                          <td className="p-3">
                            <div>{c.sterilizer_name}</div>
                            <div className="text-xs text-gray-500">{c.method}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700">
                              {c.cycle_type}
                            </span>
                          </td>
                          <td className="p-3">
                            {c.cycle_type === "Load" ? (
                              <span className="font-semibold">{c.packs} packs</span>
                            ) : (
                              <span className="text-gray-400 text-xs">Test (no packs)</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                c.status === "Running"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 animate-pulse"
                                  : c.status === "Quarantined"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                                  : c.status === "Released"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                                  : c.status === "Failed"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-500">
                            {c.started_at.replace("T", " ").slice(0, 16)}
                          </td>
                          <td className="p-3 text-xs">{c.operator_name}</td>
                          <td className="p-3 text-xs">
                            {c.status === "Running" ? (
                              <span className="text-gray-400 italic">In progress</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div>
                                  Mech: {c.mechanical_pass ? "Pass" : c.mechanical_pass === false ? "Fail" : "-"}
                                </div>
                                <div>Chem: {c.chemical_result || "-"}</div>
                                <div>Bio: {c.biological_result || "-"}</div>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              data-help="cssd_board.view_cycle_button"
                              onClick={() => handleViewCycle(c.cycle_id)}
                              className="px-2.5 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition"
                            >
                              Details
                            </button>

                            {canPrint && c.packs > 0 && (
                              <button
                                data-help="cssd_board.print_labels_button"
                                onClick={() => handlePrintLabels(c.cycle_id)}
                                className="px-2.5 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded transition"
                              >
                                Labels
                              </button>
                            )}

                            {canOperate && (c.status === "Running" || c.status === "Quarantined") && (
                              <button
                                data-help="cssd_board.record_results_button"
                                onClick={() => handleOpenResultsModal(c)}
                                className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                              >
                                {c.status === "Quarantined" ? "Read BI Result" : "Record Results"}
                              </button>
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
        </div>
      ) : (
        /* Audit Log & PDF Export Section */
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-2xl space-y-4">
          <div>
            <h2 className="text-lg font-bold">Sterilization Period Log Export (MSDS IPC 90)</h2>
            <p className="text-sm text-gray-500 font-urdu mt-1" dir="rtl">
              نس بندی کا آڈٹ لاگ پی ڈی ایف حاصل کریں برائے معائنہ اور انفیکشن کنٹرول ریکارڈز
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold mb-1">Date From</label>
              <input
                type="date"
                data-help="cssd_board.log_date_from_input"
                value={logDateFrom}
                onChange={(e) => setLogDateFrom(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Date To</label>
              <input
                type="date"
                data-help="cssd_board.log_date_to_input"
                value={logDateTo}
                onChange={(e) => setLogDateTo(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              data-help="cssd_board.download_log_button"
              onClick={handleDownloadLog}
              disabled={downloadingLog || !logDateFrom || !logDateTo}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition shadow-sm"
            >
              {downloadingLog ? "Generating PDF..." : "Download Sterilization Log (PDF)"}
            </button>
          </div>
        </section>
      )}

      {/* MODAL 1: Start Cycle Modal (POST /cssd/cycles) */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Start Sterilization Cycle</h3>
              <button
                data-help="cssd_board.start_cancel_button"
                onClick={() => setShowStartModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {startErrors.length > 0 && (
              <div className="p-3 bg-red-100 text-red-800 rounded text-sm space-y-1">
                {startErrors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {/* Sterilizer selection */}
              <div>
                <label className="block text-xs font-semibold mb-1">Sterilizer / Autoclave *</label>
                <select
                  data-help="cssd_board.sterilizer_select"
                  value={startSterilizerId ?? ""}
                  onChange={(e) => {
                    const sid = parseInt(e.target.value, 10);
                    setStartSterilizerId(isNaN(sid) ? null : sid);
                    setLoadPacks([]);
                  }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                >
                  <option value="">-- Select Sterilizer --</option>
                  {sterilizers
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.sterilizer_id} value={s.sterilizer_id}>
                        {s.name} ({s.method}) - Bay: {s.location || "Bay 1"}
                      </option>
                    ))}
                </select>
              </div>

              {/* Cycle type selection */}
              <div>
                <label className="block text-xs font-semibold mb-1">Cycle Type *</label>
                <select
                  data-help="cssd_board.cycle_type_select"
                  value={startCycleType}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    setStartCycleType(t);
                    if (t !== "Load") setLoadPacks([]);
                  }}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                >
                  <option value="Load">Load (Clinical Instrument Sets & Packs)</option>
                  <option value="BowieDick">Bowie-Dick Test (Morning Chamber Air Removal)</option>
                  <option value="LeakTest">Chamber Vacuum Leak Rate Test</option>
                  <option value="BiologicalTest">Weekly / Implant Biological Indicator Test</option>
                </select>
              </div>

              {/* Warning if Bowie-Dick required on steam sterilizer */}
              {startCycleType === "Load" &&
                startSterilizerId &&
                sterilizers.find((s) => s.sterilizer_id === startSterilizerId)?.method === "Steam" &&
                isBowieDickRequired(startSterilizerId, cycles) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded">
                    <strong>Notice (Rule 2e3fcc57c7):</strong> Bowie-Dick test has not passed today for this steam sterilizer. The load can be started, but cannot be released until the Bowie-Dick test passes.
                  </div>
                )}

              {/* Pack list builder for Load cycles */}
              {startCycleType === "Load" ? (
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-sm font-semibold">Load Packs & Sets (Compatible Method: {sterilizers.find(s=>s.sterilizer_id===startSterilizerId)?.method || "Any"})</div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">Instrument Set / Pack</label>
                      <select
                        data-help="cssd_board.add_set_select"
                        value={selectedSetTypeId ?? ""}
                        onChange={(e) => {
                          const sid = parseInt(e.target.value, 10);
                          setSelectedSetTypeId(isNaN(sid) ? null : sid);
                        }}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-700"
                      >
                        <option value="">-- Choose Set --</option>
                        {compatibleSets.map((st) => (
                          <option key={st.set_type_id} value={st.set_type_id}>
                            {st.code} - {st.name} ({st.kind}) {st.contains_implant ? "★ IMPLANT" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20">
                      <label className="block text-xs font-medium mb-1">Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        data-help="cssd_board.add_set_count_input"
                        value={selectedSetCount}
                        onChange={(e) => setSelectedSetCount(parseInt(e.target.value, 10) || 1)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-700"
                      />
                    </div>

                    <button
                      type="button"
                      data-help="cssd_board.add_pack_button"
                      onClick={handleAddPack}
                      disabled={!selectedSetTypeId}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                    >
                      Add
                    </button>
                  </div>

                  {/* Table of added packs */}
                  <div className="border rounded max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="p-2 text-left">Set Name</th>
                          <th className="p-2 text-center">Count</th>
                          <th className="p-2 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {loadPacks.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-gray-400">
                              No packs added yet. Add at least one set to start this load.
                            </td>
                          </tr>
                        ) : (
                          loadPacks.map((item) => {
                            const setType = setTypes.find((s) => s.set_type_id === item.set_type_id);
                            return (
                              <tr key={item.set_type_id}>
                                <td className="p-2">
                                  {setType?.name || `Set #${item.set_type_id}`}{" "}
                                  {setType?.contains_implant && (
                                    <span className="text-purple-600 font-semibold">[Implant]</span>
                                  )}
                                </td>
                                <td className="p-2 text-center font-bold">{item.count}</td>
                                <td className="p-2 text-right">
                                  <button
                                    type="button"
                                    data-help="cssd_board.remove_pack_button"
                                    onClick={() => handleRemovePack(item.set_type_id)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Remove
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
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-300">
                  <strong>Test Cycle:</strong> Air-removal tests (Bowie-Dick) and biological spore tests are run with an empty chamber or specialized test packs. No clinical packs are loaded into this cycle.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                data-help="cssd_board.start_cancel_button"
                onClick={() => setShowStartModal(false)}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                data-help="cssd_board.start_confirm_button"
                onClick={handleConfirmStartCycle}
                disabled={startSubmitting || !startSterilizerId}
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded transition"
              >
                {startSubmitting ? "Starting..." : "Confirm & Start Cycle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Results Modal (POST /cssd/cycles/{id}/results) */}
      {showResultsModal && targetCycle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">
                  {targetCycle.status === "Quarantined" ? "Read Biological Indicator" : "Record Cycle Results"}
                </h3>
                <div className="text-xs text-gray-500 font-mono">
                  Cycle: {targetCycle.cycle_number} • Sterilizer: {targetCycle.sterilizer_name} ({targetCycle.method})
                </div>
              </div>
              <button
                data-help="cssd_board.results_cancel_button"
                onClick={() => {
                  setShowResultsModal(false);
                  setTargetCycle(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {resultsErrors.length > 0 && (
              <div className="p-3 bg-red-100 text-red-800 rounded text-sm space-y-1">
                {resultsErrors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}

            {targetCycle.status === "Quarantined" ? (
              /* Quarantined Cycle: reading biological spore indicator */
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded text-xs text-purple-900 dark:text-purple-200">
                  <strong>Biological Quarantine Active:</strong> This cycle is quarantined awaiting the biological incubator reading (Geobacillus stearothermophilus / Bacillus atrophaeus). Record Pass to release, or Fail to trigger recall candidates.
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Biological Indicator Result *</label>
                  <select
                    data-help="cssd_board.biological_result_select"
                    value={resBiological}
                    onChange={(e) => setResBiological(e.target.value as any)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                  >
                    <option value="Pass">Pass (No growth observed - Release Load)</option>
                    <option value="Fail">Fail (Spore growth observed - Reject Load)</option>
                  </select>
                </div>

                {resBiological === "Fail" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-red-600">
                      Failure Reason & Action Note *
                    </label>
                    <textarea
                      rows={3}
                      data-help="cssd_board.failure_note_textarea"
                      value={resFailureNote}
                      onChange={(e) => setResFailureNote(e.target.value)}
                      placeholder="Describe vial test results, incubator log, and quarantine measures..."
                      className="w-full text-sm border border-red-300 rounded p-2 bg-white dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Running Cycle: Recording physical parameters and chemical/mechanical indicators */
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Temperature (°C) *</label>
                    <input
                      type="number"
                      step="0.5"
                      data-help="cssd_board.temperature_input"
                      value={resTemp}
                      onChange={(e) => setResTemp(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Pressure (kPa) *</label>
                    <input
                      type="number"
                      step="1"
                      data-help="cssd_board.pressure_input"
                      value={resPressure}
                      onChange={(e) => setResPressure(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Exposure (min) *</label>
                    <input
                      type="number"
                      step="0.5"
                      data-help="cssd_board.exposure_minutes_input"
                      value={resExposure}
                      onChange={(e) => setResExposure(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Mechanical Chart/Display *</label>
                    <select
                      data-help="cssd_board.mechanical_pass_select"
                      value={resMechanical ? "true" : "false"}
                      onChange={(e) => setResMechanical(e.target.value === "true")}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                    >
                      <option value="true">Pass (Graph/Display OK)</option>
                      <option value="false">Fail (Cycle aborted/interrupted)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Chemical Indicator *</label>
                    <select
                      data-help="cssd_board.chemical_result_select"
                      value={resChemical}
                      onChange={(e) => setResChemical(e.target.value as any)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                    >
                      <option value="Pass">Pass (Complete Color Change)</option>
                      <option value="Fail">Fail (Incomplete/Failed Strip)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Biological Indicator *</label>
                  <select
                    data-help="cssd_board.biological_result_select"
                    value={resBiological}
                    onChange={(e) => setResBiological(e.target.value as any)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700"
                  >
                    <option value="NotUsed">Not Used (Routine non-implant load)</option>
                    <option value="Pending">Pending (Quarantined until incubator read)</option>
                    <option value="Pass">Pass (Rapid readout available)</option>
                    <option value="Fail">Fail (Spore growth detected)</option>
                  </select>
                  <span className="text-xs text-gray-500">
                    * If load contains implants, selecting Pending will keep packs Quarantined per MSDS IPC 91.
                  </span>
                </div>

                {(!resMechanical || resChemical === "Fail" || resBiological === "Fail") && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-red-600">
                      Failure Note & Corrective Action *
                    </label>
                    <textarea
                      rows={3}
                      data-help="cssd_board.failure_note_textarea"
                      value={resFailureNote}
                      onChange={(e) => setResFailureNote(e.target.value)}
                      placeholder="Explain failure reason (temperature drop, indicator fail). Packs will be marked Failed and sent for reprocessing."
                      className="w-full text-sm border border-red-300 rounded p-2 bg-white dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                data-help="cssd_board.results_cancel_button"
                onClick={() => {
                  setShowResultsModal(false);
                  setTargetCycle(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                data-help="cssd_board.results_confirm_button"
                onClick={handleConfirmResults}
                disabled={resultsSubmitting}
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded transition"
              >
                {resultsSubmitting ? "Saving..." : "Record & Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cycle Details Modal (GET /cssd/cycles/{id}) */}
      {selectedCycleId && cycleDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">Cycle Details: {cycleDetail.cycle_number}</h3>
                <div className="text-xs text-gray-500">
                  {cycleDetail.sterilizer_name} ({cycleDetail.method}) • Status: {cycleDetail.status}
                </div>
              </div>
              <button
                data-help="cssd_board.close_cycle_modal_button"
                onClick={() => {
                  setSelectedCycleId(null);
                  setCycleDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Parameter summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded text-xs">
              <div>
                <span className="text-gray-500 block">Temperature:</span>
                <span className="font-semibold">{cycleDetail.temperature_c ? `${cycleDetail.temperature_c} °C` : "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Pressure:</span>
                <span className="font-semibold">{cycleDetail.pressure_kpa ? `${cycleDetail.pressure_kpa} kPa` : "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Exposure Time:</span>
                <span className="font-semibold">{cycleDetail.exposure_minutes ? `${cycleDetail.exposure_minutes} min` : "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Mechanical:</span>
                <span className="font-semibold">{cycleDetail.mechanical_pass ? "Pass" : cycleDetail.mechanical_pass === false ? "Fail" : "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Chemical:</span>
                <span className="font-semibold">{cycleDetail.chemical_result || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Biological:</span>
                <span className="font-semibold">{cycleDetail.biological_result || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Operator:</span>
                <span className="font-semibold">{cycleDetail.operator_name}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Started At:</span>
                <span className="font-semibold">{cycleDetail.started_at.replace("T", " ").slice(0, 16)}</span>
              </div>
            </div>

            {/* Failure or Recall Notice */}
            {cycleDetail.failure_note && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                <strong>Failure Note:</strong> {cycleDetail.failure_note}
              </div>
            )}

            {/* Recall candidates notice per rule:b48c7fa7a8 */}
            {cycleDetail.recall_candidates && cycleDetail.recall_candidates.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded space-y-2">
                <div className="font-bold flex items-center gap-1">
                  ⚠️ Recall Candidates (MSDS IPC 92):
                </div>
                <div>
                  This biological test failed. The following loads from this sterilizer released since the last passed biological test are potential recall candidates:
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {cycleDetail.recall_candidates.map((rc) => (
                    <li key={rc.cycle_id} className="font-mono">
                      {rc.cycle_number} ({rc.started_at.slice(0, 10)}) - {rc.packs} packs
                    </li>
                  ))}
                </ul>
                {navigate && (
                  <button
                    data-help="cssd_board.back_button"
                    onClick={() => {
                      setSelectedCycleId(null);
                      setCycleDetail(null);
                      navigate("cssd_setup");
                    }}
                    className="mt-2 text-xs font-semibold text-blue-700 underline"
                  >
                    Go to CSSD Setup & Recalls to initiate recall →
                  </button>
                )}
              </div>
            )}

            {/* Exposed Patients Notice */}
            {cycleDetail.patients_exposed && cycleDetail.patients_exposed.length > 0 && (
              <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded">
                <strong>Patients Exposed (Surveillance MRNs):</strong>{" "}
                {cycleDetail.patients_exposed.join(", ")}
              </div>
            )}

            {/* Pack list table */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold">Packs in Cycle ({cycleDetail.pack_list?.length || 0})</h4>
                {canPrint && cycleDetail.packs > 0 && (
                  <button
                    data-help="cssd_board.print_labels_button"
                    onClick={() => handlePrintLabels(cycleDetail.cycle_id)}
                    className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Print Pack Labels
                  </button>
                )}
              </div>

              <div className="border rounded max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="p-2">Pack Code</th>
                      <th className="p-2">Set Name</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Expires On</th>
                      <th className="p-2">Patient/Ward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!cycleDetail.pack_list || cycleDetail.pack_list.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-gray-400">
                          No packs in this cycle.
                        </td>
                      </tr>
                    ) : (
                      cycleDetail.pack_list.map((p) => (
                        <tr key={p.pack_id}>
                          <td className="p-2 font-mono font-medium">{p.pack_code}</td>
                          <td className="p-2">{p.set_name}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 font-semibold">
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2">{p.expires_on}</td>
                          <td className="p-2 text-gray-500">
                            {p.mrn ? `MRN: ${p.mrn}` : p.issued_to_ward_name || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end border-t pt-3">
              <button
                data-help="cssd_board.close_cycle_modal_button"
                onClick={() => {
                  setSelectedCycleId(null);
                  setCycleDetail(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Labels Print Preview */}
      {labelData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">Pack Labels (50mm Label Printer)</h3>
                <div className="text-xs text-gray-500">
                  Cycle: {labelData.fields.cycle_number} • Sterilizer: {labelData.fields.sterilizer_name}
                </div>
              </div>
              <button
                data-help="cssd_board.print_labels_button"
                onClick={() => setLabelData(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              {labelData.fields.labels.map((lbl, idx) => (
                <div
                  key={idx}
                  className="p-3 border-2 border-dashed border-gray-400 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-xs space-y-1 shadow-sm"
                >
                  <div className="font-bold text-sm">{lbl.set_name}</div>
                  <div className="flex justify-between">
                    <span>Pack: {lbl.pack_code}</span>
                    <span>Cycle: {lbl.cycle_number}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Sterilized: {lbl.sterilized_on}</span>
                    <span className="font-bold text-red-600 dark:text-red-400">Exp: {lbl.expires_on}</span>
                  </div>
                  {lbl.barcode_svg && (
                    <div
                      className="py-1 flex justify-center"
                      dangerouslySetInnerHTML={{ __html: lbl.barcode_svg }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-xs text-gray-500">
                Total labels: {labelData.fields.labels.length}
              </span>
              <div className="flex gap-2">
                <button
                  data-help="cssd_board.print_labels_button"
                  onClick={() => setLabelData(null)}
                  className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded"
                >
                  Close
                </button>
                <button
                  data-help="cssd_board.print_labels_button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                >
                  Print to Label Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
