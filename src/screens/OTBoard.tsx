import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import { TheaterBoardOut, statusBoard } from "../generated/ot_board";
import {
  getOtBoardScreenView,
  isSurgeryActive,
  canViewOtStatus,
  getStateBadgeInfo,
  sortTheatersForBoard,
  formatDurationMinutes,
  explainOtBoardError,
  ClinicalUser,
} from "../ot-board-policy";

interface OTBoardProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const OTBoard: React.FC<OTBoardProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getOtBoardScreenView(establishment);
  const isServiceActive = isSurgeryActive(establishment);
  const canView = canViewOtStatus(currentUser);

  const [theaters, setTheaters] = useState<TheaterBoardOut[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [viewLayout, setViewLayout] = useState<"grid" | "table">("grid");

  // Filters
  const [filterState, setFilterState] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Inspect modal
  const [selectedTheater, setSelectedTheater] = useState<TheaterBoardOut | null>(null);

  // Fetch board data
  const loadData = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setErrorBanner(null);

    try {
      const data = await statusBoard();
      setTheaters(data);
    } catch (err: any) {
      console.error("Failed to load OT status board", err);
      setErrorBanner(explainOtBoardError(err?.code || "NETWORK_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for realtime updates: ot.status.updated
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      if (parsed.event === "ot.status.updated") {
        loadData();
      }
    } catch {
      // Ignore non-json stream frames
    }
  }, [stream, loadData]);

  // Unique theatre types for dropdown
  const theaterTypes = useMemo(() => {
    const set = new Set<string>();
    theaters.forEach((t) => {
      if (t.theater_type) set.add(t.theater_type);
    });
    return Array.from(set).sort();
  }, [theaters]);

  // Filtered and sorted theatres
  const filteredTheaters = useMemo(() => {
    let list = sortTheatersForBoard(theaters);

    if (filterState) {
      list = list.filter((t) => t.current_state === filterState);
    }
    if (filterType) {
      list = list.filter((t) => t.theater_type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          (t.active_procedure && t.active_procedure.toLowerCase().includes(q)) ||
          (t.next_procedure && t.next_procedure.toLowerCase().includes(q))
      );
    }

    return list;
  }, [theaters, filterState, filterType, searchQuery]);

  // Counts for summary pills
  const counts = useMemo(() => {
    return {
      total: theaters.length,
      inSurgery: theaters.filter((t) => t.current_state === "InSurgery").length,
      available: theaters.filter((t) => t.current_state === "Available").length,
      cleaning: theaters.filter((t) => t.current_state === "CleaningPrep").length,
      emergencyHold: theaters.filter((t) => t.current_state === "EmergencyHold").length,
      outOfService: theaters.filter((t) => t.current_state === "OutOfService").length,
    };
  }, [theaters]);

  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-semibold">OT Status Board is not available for this facility.</p>
        <p className="text-sm font-urdu">آپریشن تھیٹر سٹیٹس بورڈ اس ہسپتال کے لیے فعال نہیں ہے۔</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 space-y-4 font-sans">
      {/* Top Header - Airport Flight Display Board Style */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/90 border border-slate-700 p-4 rounded-xl shadow-lg backdrop-blur">
        <div className="flex items-center space-x-3">
          <button
            data-help="ot_board.back_button"
            onClick={() => navigate?.("ot_scheduling")}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition font-medium border border-slate-600"
          >
            ← Back / واپسی
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h1 className="text-xl font-bold tracking-wide uppercase text-amber-400">
                Live Operating Theatre Status Board
              </h1>
              <span className="text-sm font-normal text-slate-300 font-urdu">
                (براہ راست آپریشن تھیٹر سٹیٹس بورڈ)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time theatre readiness, active procedures, and turnover timeline (Rule 01511e9050 - Privacy protected, no patient names)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            data-help="ot_board.toggle_view_mode"
            onClick={() => setViewLayout((prev) => (prev === "grid" ? "table" : "grid"))}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium border border-slate-600 transition flex items-center gap-1.5"
          >
            <span>{viewLayout === "grid" ? "☰ Table View" : "☵ Grid View"}</span>
          </button>

          <button
            data-help="ot_board.refresh_button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow transition flex items-center gap-1"
          >
            {loading ? "Updating..." : "↻ Refresh / ریفریش"}
          </button>
        </div>
      </header>

      {/* Retiring / Service Inactive Banner */}
      {viewMode === "open_work" && (
        <div className="bg-amber-900/60 border border-amber-600 text-amber-200 p-3 rounded-lg text-xs flex justify-between items-center">
          <span>Notice: Surgery service is retiring. Existing surgical procedures may be monitored and completed.</span>
          <span className="font-urdu">سروس ریٹائر ہو رہی ہے: صرف پہلے سے جاری سرجریز کی نگرانی ممکن ہے۔</span>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="bg-rose-900/80 border border-rose-600 text-rose-200 p-3 rounded-lg text-xs flex justify-between items-center">
          <div>
            <p className="font-semibold">{errorBanner.en}</p>
            <p className="font-urdu text-[11px]">{errorBanner.ur}</p>
          </div>
          <button
            data-help="ot_board.dismiss_alert_button"
            onClick={() => setErrorBanner(null)}
            className="px-2 py-0.5 text-rose-300 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Counters (Airport Board Banner) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">TOTAL SUITES</div>
            <div className="text-xl font-mono font-bold text-slate-100">{counts.total}</div>
          </div>
          <span className="text-lg">🏥</span>
        </div>

        <div className="bg-slate-800/80 border border-rose-900/50 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-rose-400 font-medium">🔴 IN SURGERY</div>
            <div className="text-xl font-mono font-bold text-rose-400">{counts.inSurgery}</div>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
        </div>

        <div className="bg-slate-800/80 border border-emerald-900/50 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-400 font-medium">🟢 AVAILABLE</div>
            <div className="text-xl font-mono font-bold text-emerald-400">{counts.available}</div>
          </div>
          <span className="text-lg">✅</span>
        </div>

        <div className="bg-slate-800/80 border border-amber-900/50 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-amber-400 font-medium">🟡 CLEANING-PREP</div>
            <div className="text-xl font-mono font-bold text-amber-400">{counts.cleaning}</div>
          </div>
          <span className="text-lg">🧹</span>
        </div>

        <div className="bg-slate-800/80 border border-orange-900/50 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-orange-400 font-medium">⚠️ EMERGENCY HOLD</div>
            <div className="text-xl font-mono font-bold text-orange-400">{counts.emergencyHold}</div>
          </div>
          <span className="text-lg">🚨</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">⚪ OUT OF SERVICE</div>
            <div className="text-xl font-mono font-bold text-slate-400">{counts.outOfService}</div>
          </div>
          <span className="text-lg">🔧</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800/70 p-3 rounded-xl border border-slate-700">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 font-medium">Search / تلاش:</label>
          <input
            type="text"
            data-help="ot_board.search_input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Room name, procedure..."
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 font-medium">Status / حالت:</label>
          <select
            data-help="ot_board.filter_state_select"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">All States / تمام</option>
            <option value="InSurgery">🔴 In-Surgery</option>
            <option value="Available">🟢 Available</option>
            <option value="CleaningPrep">🟡 Cleaning-Prep</option>
            <option value="EmergencyHold">⚠️ Emergency Hold</option>
            <option value="OutOfService">⚪ Out of Service</option>
          </select>
        </div>

        {theaterTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300 font-medium">Type / قسم:</label>
            <select
              data-help="ot_board.filter_type_select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">All Types / تمام اقسام</option>
              {theaterTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Board Content */}
      <main className="flex-1 overflow-auto">
        {filteredTheaters.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-16 text-center text-slate-400">
            <p className="text-base font-semibold">No operating theatres found matching the selected filters.</p>
            <p className="text-xs font-urdu mt-1">منتخب فلٹرز کے مطابق کوئی آپریشن تھیٹر دستیاب نہیں ہے۔</p>
          </div>
        ) : viewLayout === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTheaters.map((th) => {
              const badge = getStateBadgeInfo(th.current_state);
              const isInSurgery = th.current_state === "InSurgery";
              const isEmergency = th.current_state === "EmergencyHold";

              return (
                <div
                  key={th.ot_id}
                  className={`flex flex-col justify-between p-4 rounded-2xl border transition-all shadow-md bg-slate-800/90 ${
                    isInSurgery
                      ? "border-rose-500/80 shadow-rose-950/40"
                      : isEmergency
                      ? "border-orange-500/80 shadow-orange-950/40"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div>
                    {/* Header: Suite Name and Status Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-slate-100 tracking-wide">{th.name}</h3>
                          <span className="font-mono text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                            {th.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{th.theater_type}</span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${badge.badgeClass}`}
                        >
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-urdu mt-0.5">{badge.labelUr}</span>
                      </div>
                    </div>

                    {/* Active Case Section */}
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                        Current Case (موجودہ کیس)
                      </div>

                      {th.active_procedure ? (
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
                          <div className="text-xs font-bold text-amber-300 flex items-start gap-1">
                            <span>⚡</span>
                            <span>{th.active_procedure}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                            <span>
                              Start:{" "}
                              {th.actual_start
                                ? new Date(th.actual_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "Pending"}
                            </span>
                            {th.actual_start && (
                              <span className="text-amber-400 font-mono font-medium">
                                {formatDurationMinutes(th.actual_start)}
                              </span>
                            )}
                          </div>

                          {th.expected_end && (
                            <div className="text-[11px] text-slate-400">
                              Est. Finish:{" "}
                              <span className="text-slate-200 font-mono">
                                {new Date(th.expected_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-900/40 rounded-xl text-center text-xs text-slate-500 italic">
                          No active procedure in room
                        </div>
                      )}
                    </div>

                    {/* Next Scheduled Case */}
                    <div className="mt-3 space-y-1">
                      <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                        Next Up (اگلا آپریشن)
                      </div>
                      {th.next_procedure ? (
                        <div className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                          <span className="font-medium truncate max-w-[180px]">{th.next_procedure}</span>
                          {th.next_start && (
                            <span className="text-[11px] font-mono text-blue-400">
                              {new Date(th.next_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">None scheduled</div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Changed: {new Date(th.state_changed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      data-help="ot_board.inspect_theater_button"
                      onClick={() => setSelectedTheater(th)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-medium transition text-xs"
                    >
                      Inspect / معائنہ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW (Airport Style Departure Board) */
          <div className="overflow-x-auto bg-slate-800/90 border border-slate-700 rounded-2xl shadow">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Theatre Suite</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Active Case & Surgeon</th>
                  <th className="p-3">Start / Elapsed</th>
                  <th className="p-3">Est. End</th>
                  <th className="p-3">Next Case</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredTheaters.map((th) => {
                  const badge = getStateBadgeInfo(th.current_state);
                  return (
                    <tr key={th.ot_id} className="hover:bg-slate-750/50">
                      <td className="p-3 font-bold text-slate-100">
                        <div>{th.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {th.code} ({th.theater_type})
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${badge.badgeClass}`}
                        >
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        {th.active_procedure ? (
                          <span className="font-semibold text-amber-300">{th.active_procedure}</span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        {th.actual_start ? (
                          <div>
                            <div>{new Date(th.actual_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            <div className="text-amber-400 text-[10px]">{formatDurationMinutes(th.actual_start)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        {th.expected_end ? (
                          new Date(th.expected_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {th.next_procedure ? (
                          <div>
                            <div className="font-medium text-slate-200">{th.next_procedure}</div>
                            {th.next_start && (
                              <div className="text-[10px] font-mono text-blue-400">
                                {new Date(th.next_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          data-help="ot_board.inspect_theater_button"
                          onClick={() => setSelectedTheater(th)}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* INSPECT MODAL */}
      {selectedTheater && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-850 bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-700 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{selectedTheater.name}</h2>
                <p className="text-xs text-slate-400 font-mono">
                  Code: {selectedTheater.code} | Type: {selectedTheater.theater_type}
                </p>
              </div>
              <button
                data-help="ot_board.close_modal_button"
                onClick={() => setSelectedTheater(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-700">
                <span className="text-slate-400">Current Room State:</span>
                <span className={`px-2 py-0.5 rounded-full border ${getStateBadgeInfo(selectedTheater.current_state).badgeClass}`}>
                  {getStateBadgeInfo(selectedTheater.current_state).icon} {selectedTheater.current_state}
                </span>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-2">
                <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Active Surgical Case
                </div>
                {selectedTheater.active_procedure ? (
                  <>
                    <div className="text-sm font-bold text-amber-300">{selectedTheater.active_procedure}</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400 pt-1 border-t border-slate-800">
                      <div>
                        <span>Actual Start: </span>
                        <span className="font-mono text-slate-200">
                          {selectedTheater.actual_start
                            ? new Date(selectedTheater.actual_start).toLocaleTimeString()
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span>Expected End: </span>
                        <span className="font-mono text-slate-200">
                          {selectedTheater.expected_end
                            ? new Date(selectedTheater.expected_end).toLocaleTimeString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 italic">No procedure currently in progress.</p>
                )}
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1">
                <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Next Scheduled Case
                </div>
                {selectedTheater.next_procedure ? (
                  <div className="flex justify-between items-center text-slate-200">
                    <span className="font-medium">{selectedTheater.next_procedure}</span>
                    <span className="font-mono text-blue-400">
                      {selectedTheater.next_start ? new Date(selectedTheater.next_start).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No upcoming procedure scheduled today.</p>
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center italic">
                Airport-style status display: Patient names are withheld from public display boards per MSDS COP 31 & Rule 01511e9050.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-700">
              <button
                data-help="ot_board.close_modal_button"
                onClick={() => setSelectedTheater(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Close / بند کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
