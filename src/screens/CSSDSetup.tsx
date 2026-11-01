import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  SetTypeOut,
  SetTypeIn,
  SetTypeUpdateIn,
  SterilizerOut,
  SterilizerIn,
  SterilizerUpdateIn,
  SterilizationCycleOut,
  SterilizationCycleDetailOut,
  AssetMonitorOut,
  listSetTypes,
  createSetType,
  updateSetType,
  listSterilizers,
  createSterilizer,
  updateSterilizer,
  listCyclesCssd,
  getCycleCssdCycles,
  recall,
  procedurePdf,
  logPdf,
  assets,
} from "../generated/cssd_setup";
import {
  getCssdSetupScreenView,
  canManageCssd,
  canViewCssd,
  canViewOpsAssets,
  validateSetTypeIn,
  validateSterilizerIn,
  validateLoadRecall,
  explainCssdError,
  PACKAGING_PRESETS,
  ClinicalUser,
} from "../cssd-setup-policy";

interface CSSDSetupProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  onNavigate?: (screenId: string) => void;
}

type TabType = "sets" | "sterilizers" | "recalls" | "documents";

export const CSSDSetup: React.FC<CSSDSetupProps> = ({
  establishment,
  currentUser,
  onNavigate,
}) => {
  const viewMode = getCssdSetupScreenView(establishment);
  const isManager = canManageCssd(currentUser);
  const canView = canViewCssd(currentUser);
  const canViewAssetsFlag = canViewOpsAssets(currentUser);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("sets");

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ en: string; ur: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data States
  const [setTypes, setSetTypes] = useState<SetTypeOut[]>([]);
  const [sterilizers, setSterilizers] = useState<SterilizerOut[]>([]);
  const [cycles, setCycles] = useState<SterilizationCycleOut[]>([]);
  const [opsAssets, setOpsAssets] = useState<AssetMonitorOut[]>([]);

  // Filter States for Sets
  const [searchSets, setSearchSets] = useState<string>("");
  const [filterSetKind, setFilterSetKind] = useState<string>("all");
  const [filterSetMethod, setFilterSetMethod] = useState<string>("all");
  const [showRetiredSets, setShowRetiredSets] = useState<boolean>(false);

  // Filter States for Sterilizers
  const [searchSterilizers, setSearchSterilizers] = useState<string>("");
  const [showRetiredSterilizers, setShowRetiredSterilizers] = useState<boolean>(false);

  // Filter States for Cycles
  const [filterCycleType, setFilterCycleType] = useState<string>("all");
  const [filterCycleStatus, setFilterCycleStatus] = useState<string>("all");
  const [searchCycleNumber, setSearchCycleNumber] = useState<string>("");

  // Modals
  const [isAddSetModalOpen, setIsAddSetModalOpen] = useState<boolean>(false);
  const [editingSet, setEditingSet] = useState<SetTypeOut | null>(null);
  const [setFormInput, setSetFormInput] = useState<SetTypeIn>({
    code: "",
    name: "",
    kind: "InstrumentSet",
    method: "Steam",
    shelf_life_days: 180,
    contains_implant: false,
  });
  const [setFormErrors, setSetFormErrors] = useState<Record<string, string>>({});

  const [isAddSterilizerModalOpen, setIsAddSterilizerModalOpen] = useState<boolean>(false);
  const [editingSterilizer, setEditingSterilizer] = useState<SterilizerOut | null>(null);
  const [sterilizerFormInput, setSterilizerFormInput] = useState<SterilizerIn>({
    name: "",
    method: "Steam",
    asset_id: null,
    location: "",
  });
  const [sterilizerFormErrors, setSterilizerFormErrors] = useState<Record<string, string>>({});

  // Cycle Detail & Recall
  const [selectedCycleDetail, setSelectedCycleDetail] = useState<SterilizationCycleDetailOut | null>(null);
  const [isCycleDetailLoading, setIsCycleDetailLoading] = useState<boolean>(false);
  const [recallingCycle, setRecallingCycle] = useState<SterilizationCycleOut | null>(null);
  const [recallReason, setRecallReason] = useState<string>("");
  const [recallResult, setRecallResult] = useState<SterilizationCycleDetailOut | null>(null);

  // Document Dates
  const [logDateFrom, setLogDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [logDateTo, setLogDateTo] = useState<string>(new Date().toISOString().slice(0, 10));

  // Load initial data
  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const [fetchedSets, fetchedSterilizers, fetchedCycles] = await Promise.all([
        listSetTypes({ active_only: !showRetiredSets }),
        listSterilizers({ active_only: !showRetiredSterilizers }),
        listCyclesCssd({ limit: 50 }),
      ]);
      setSetTypes(fetchedSets);
      setSterilizers(fetchedSterilizers);
      setCycles(fetchedCycles);

      if (canViewAssetsFlag) {
        try {
          const fetchedAssets = await assets();
          setOpsAssets(fetchedAssets);
        } catch {
          // Non-blocking asset fetch
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "FETCH_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  }, [canView, showRetiredSets, showRetiredSterilizers, canViewAssetsFlag]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set Type Creation
  const handleOpenAddSet = () => {
    setEditingSet(null);
    setSetFormInput({
      code: "",
      name: "",
      kind: "InstrumentSet",
      method: "Steam",
      shelf_life_days: PACKAGING_PRESETS.InstrumentSet.defaultDays,
      contains_implant: false,
    });
    setSetFormErrors({});
    setIsAddSetModalOpen(true);
  };

  const handleOpenEditSet = (set: SetTypeOut) => {
    setEditingSet(set);
    setSetFormInput({
      code: set.code,
      name: set.name,
      kind: set.kind,
      method: set.method,
      shelf_life_days: set.shelf_life_days,
      contains_implant: set.contains_implant,
    });
    setSetFormErrors({});
    setIsAddSetModalOpen(true);
  };

  const handleSaveSet = async () => {
    const validation = validateSetTypeIn(setFormInput);
    if (!validation.valid) {
      setSetFormErrors(validation.errors);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      if (editingSet) {
        const updatePayload: SetTypeUpdateIn = {
          name: setFormInput.name,
          shelf_life_days: setFormInput.shelf_life_days,
          contains_implant: setFormInput.contains_implant,
          is_active: editingSet.is_active,
          expected_version: editingSet.row_version,
        };
        await updateSetType(editingSet.set_type_id, updatePayload);
        setSuccessMessage(`Set "${setFormInput.name}" updated successfully.`);
      } else {
        await createSetType(setFormInput);
        setSuccessMessage(`Set "${setFormInput.name}" added successfully.`);
      }
      setIsAddSetModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "VALIDATION_ERROR";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRetireSet = async (set: SetTypeOut) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await updateSetType(set.set_type_id, {
        is_active: !set.is_active,
        expected_version: set.row_version,
      });
      setSuccessMessage(
        set.is_active
          ? `Set "${set.name}" retired under Rule 494306e208.`
          : `Set "${set.name}" reactivated.`
      );
      fetchData();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "UPDATE_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  // Sterilizer Creation
  const handleOpenAddSterilizer = () => {
    setEditingSterilizer(null);
    setSterilizerFormInput({
      name: "",
      method: "Steam",
      asset_id: null,
      location: "",
    });
    setSterilizerFormErrors({});
    setIsAddSterilizerModalOpen(true);
  };

  const handleOpenEditSterilizer = (st: SterilizerOut) => {
    setEditingSterilizer(st);
    setSterilizerFormInput({
      name: st.name,
      method: st.method,
      asset_id: st.asset_id,
      location: st.location ?? "",
    });
    setSterilizerFormErrors({});
    setIsAddSterilizerModalOpen(true);
  };

  const handleSaveSterilizer = async () => {
    const validation = validateSterilizerIn(sterilizerFormInput);
    if (!validation.valid) {
      setSterilizerFormErrors(validation.errors);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      if (editingSterilizer) {
        const updatePayload: SterilizerUpdateIn = {
          name: sterilizerFormInput.name,
          asset_id: sterilizerFormInput.asset_id,
          location: sterilizerFormInput.location,
          is_active: editingSterilizer.is_active,
          expected_version: editingSterilizer.row_version,
        };
        await updateSterilizer(editingSterilizer.sterilizer_id, updatePayload);
        setSuccessMessage(`Sterilizer "${sterilizerFormInput.name}" updated successfully.`);
      } else {
        await createSterilizer(sterilizerFormInput);
        setSuccessMessage(`Sterilizer "${sterilizerFormInput.name}" registered successfully.`);
      }
      setIsAddSterilizerModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "STERILIZER_ERROR";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  // View Cycle Details
  const handleOpenCycleDetails = async (cycleId: number) => {
    setIsCycleDetailLoading(true);
    try {
      const detail = await getCycleCssdCycles(cycleId);
      setSelectedCycleDetail(detail);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "FETCH_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setIsCycleDetailLoading(false);
    }
  };

  // Load Recall
  const handleOpenRecallModal = (c: SterilizationCycleOut) => {
    setRecallingCycle(c);
    setRecallReason("");
    setRecallResult(null);
  };

  const handleConfirmRecall = async () => {
    if (!recallingCycle) return;
    const validation = validateLoadRecall(recallReason, recallingCycle);
    if (!validation.valid) {
      setErrorMessage({ en: validation.error!, ur: validation.error! });
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const detail = await recall(recallingCycle.cycle_id, { reason: recallReason });
      setRecallResult(detail);
      setSuccessMessage(
        `Load ${recallingCycle.cycle_number} recalled under MSDS IPC 92. ${detail.patients_exposed?.length ?? 0} patients exposed.`
      );
      fetchData();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "RECALL_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  // Download Documents
  const handleDownloadProcedure = async () => {
    setLoading(true);
    try {
      await procedurePdf();
      setSuccessMessage("CSSD sterilization and recall procedure (PDF) retrieved.");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "DOWNLOAD_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLog = async () => {
    if (!logDateFrom || !logDateTo) return;
    setLoading(true);
    try {
      await logPdf({ date_from: logDateFrom, date_to: logDateTo });
      setSuccessMessage(`CSSD sterilization log for ${logDateFrom} to ${logDateTo} retrieved.`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "DOWNLOAD_FAILED";
      setErrorMessage(explainCssdError(code));
    } finally {
      setLoading(false);
    }
  };

  // Filtered Sets
  const filteredSets = useMemo(() => {
    return setTypes.filter((s) => {
      if (!showRetiredSets && !s.is_active) return false;
      if (filterSetKind !== "all" && s.kind !== filterSetKind) return false;
      if (filterSetMethod !== "all" && s.method !== filterSetMethod) return false;
      if (searchSets) {
        const query = searchSets.toLowerCase();
        const matchesCode = s.code.toLowerCase().includes(query);
        const matchesName = s.name.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }
      return true;
    });
  }, [setTypes, showRetiredSets, filterSetKind, filterSetMethod, searchSets]);

  // Filtered Sterilizers
  const filteredSterilizers = useMemo(() => {
    return sterilizers.filter((st) => {
      if (!showRetiredSterilizers && !st.is_active) return false;
      if (searchSterilizers) {
        const query = searchSterilizers.toLowerCase();
        const matchesName = st.name.toLowerCase().includes(query);
        const matchesLoc = st.location?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesLoc) return false;
      }
      return true;
    });
  }, [sterilizers, showRetiredSterilizers, searchSterilizers]);

  // Filtered Cycles
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      if (filterCycleType !== "all" && c.cycle_type !== filterCycleType) return false;
      if (filterCycleStatus !== "all" && c.status !== filterCycleStatus) return false;
      if (searchCycleNumber) {
        const query = searchCycleNumber.toLowerCase();
        if (!c.cycle_number.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [cycles, filterCycleType, filterCycleStatus, searchCycleNumber]);

  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold mb-2">CSSD Service Not Available</h2>
        <p>The CSSD sterile supply service is not configured or enabled for this facility.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Retiring / Records Notice Banner */}
      {viewMode === "open_work" && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 rounded shadow-sm">
          <p className="font-semibold">
            Service Retiring: No new set types, sterilizers, or cycle recalls from now on.
          </p>
          <p className="text-sm">
            Existing released packs and active cycle records remain available for historical audit and inspection.
          </p>
        </div>
      )}
      {viewMode === "records" && (
        <div className="bg-gray-100 border-l-4 border-gray-500 text-gray-800 p-4 rounded shadow-sm">
          <p className="font-semibold">Records View: Historical CSSD records and audit logs only.</p>
          <p className="text-sm">New master entries and load operations are disabled.</p>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>Sterile Supply: Sets, Sterilizers & Recalls</span>
            <span className="text-sm px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
              MSDS IPC 90-92
            </span>
          </h1>
          <p className="text-sm text-gray-600">
            Master instrument sets, packaging shelf life, autoclave registers, biological recall management, and statutory policy documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-help="cssd_setup.refresh_button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 disabled:opacity-50"
          >
            <span>↻ Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded flex items-start justify-between">
          <div>
            <p className="font-medium">{errorMessage.en}</p>
            <p className="text-sm font-nastaliq text-right mt-1" dir="rtl">
              {errorMessage.ur}
            </p>
          </div>
          <button
            data-help="cssd_setup.dismiss_alert_button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 text-sm font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded flex items-center justify-between">
          <p className="text-sm font-medium">{successMessage}</p>
          <button
            data-help="cssd_setup.dismiss_alert_button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800 text-sm font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-1">
        <button
          data-help="cssd_setup.tab_sets"
          onClick={() => setActiveTab("sets")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "sets"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Sets & Packs Catalog ({setTypes.length})
        </button>
        <button
          data-help="cssd_setup.tab_sterilizers"
          onClick={() => setActiveTab("sterilizers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "sterilizers"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Sterilizers & Autoclaves ({sterilizers.length})
        </button>
        <button
          data-help="cssd_setup.tab_recalls"
          onClick={() => setActiveTab("recalls")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "recalls"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Cycle Inspection & Recall ({cycles.length})
        </button>
        <button
          data-help="cssd_setup.tab_documents"
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "documents"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Procedure & Audit Logs (PDF)
        </button>
      </div>

      {/* TAB 1: SETS & PACKS */}
      {activeTab === "sets" && (
        <div className="space-y-4">
          {/* Action and Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                data-help="cssd_setup.search_sets_input"
                type="text"
                placeholder="Search by code or name..."
                value={searchSets}
                onChange={(e) => setSearchSets(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm w-60 bg-white"
              />
              <select
                data-help="cssd_setup.filter_kind_select"
                value={filterSetKind}
                onChange={(e) => setFilterSetKind(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm bg-white"
              >
                <option value="all">All Packaging Kinds</option>
                <option value="InstrumentSet">Instrument Set</option>
                <option value="Pack">Pack / SMS Wrap</option>
                <option value="Linen">Linen Wrap</option>
                <option value="Single">Single Pouch</option>
              </select>
              <select
                data-help="cssd_setup.filter_method_select"
                value={filterSetMethod}
                onChange={(e) => setFilterSetMethod(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm bg-white"
              >
                <option value="all">All Sterilization Methods</option>
                <option value="Steam">Steam Autoclave</option>
                <option value="EthyleneOxide">Ethylene Oxide (EtO)</option>
                <option value="Plasma">Hydrogen Peroxide Plasma</option>
                <option value="DryHeat">Dry Heat</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  data-help="cssd_setup.toggle_retired_sets"
                  type="checkbox"
                  checked={showRetiredSets}
                  onChange={(e) => setShowRetiredSets(e.target.checked)}
                />
                Show Retired Sets
              </label>
            </div>

            {isManager && viewMode === "full" && (
              <button
                data-help="cssd_setup.add_set_button"
                onClick={handleOpenAddSet}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm whitespace-nowrap"
              >
                + Add Set or Pack
              </button>
            )}
          </div>

          {/* Sets Table */}
          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Set / Pack Name</th>
                  <th className="px-4 py-3 text-left">Kind</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Shelf Life</th>
                  <th className="px-4 py-3 text-left">Implant</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No sterile set types found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSets.map((s) => (
                    <tr key={s.set_type_id} className={!s.is_active ? "bg-gray-50 opacity-75" : ""}>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{s.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {s.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {s.method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-700">{s.shelf_life_days}</span> days
                      </td>
                      <td className="px-4 py-3">
                        {s.contains_implant ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            BI Mandatory
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.is_active ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                            Retired (dfc)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {isManager && viewMode === "full" && (
                          <>
                            <button
                              data-help="cssd_setup.edit_set_button"
                              onClick={() => handleOpenEditSet(s)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              Edit
                            </button>
                            <button
                              data-help="cssd_setup.retire_set_button"
                              onClick={() => handleToggleRetireSet(s)}
                              className={`text-xs font-medium ${
                                s.is_active
                                  ? "text-red-600 hover:text-red-800"
                                  : "text-green-600 hover:text-green-800"
                              }`}
                            >
                              {s.is_active ? "Retire" : "Reactivate"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STERILIZERS & AUTOCLAVES */}
      {activeTab === "sterilizers" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                data-help="cssd_setup.search_sterilizers_input"
                type="text"
                placeholder="Search sterilizers or location..."
                value={searchSterilizers}
                onChange={(e) => setSearchSterilizers(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm w-60 bg-white"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  data-help="cssd_setup.toggle_retired_sterilizers"
                  type="checkbox"
                  checked={showRetiredSterilizers}
                  onChange={(e) => setShowRetiredSterilizers(e.target.checked)}
                />
                Show Retired Sterilizers
              </label>
            </div>

            {isManager && viewMode === "full" && (
              <button
                data-help="cssd_setup.add_sterilizer_button"
                onClick={handleOpenAddSterilizer}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm whitespace-nowrap"
              >
                + Register Autoclave / Sterilizer
              </button>
            )}
          </div>

          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Sterilizer Name</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Location / Room</th>
                  <th className="px-4 py-3 text-left">Linked Asset Tag</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSterilizers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No sterilizers or autoclaves registered yet.
                    </td>
                  </tr>
                ) : (
                  filteredSterilizers.map((st) => (
                    <tr key={st.sterilizer_id} className={!st.is_active ? "bg-gray-50 opacity-75" : ""}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{st.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {st.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{st.location || "CSSD Main"}</td>
                      <td className="px-4 py-3">
                        {st.asset_tag ? (
                          <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 rounded border text-gray-700">
                            {st.asset_tag}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {st.is_active ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                            Retired
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isManager && viewMode === "full" && (
                          <button
                            data-help="cssd_setup.edit_sterilizer_button"
                            onClick={() => handleOpenEditSterilizer(st)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CYCLES & RECALL */}
      {activeTab === "recalls" && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border flex flex-wrap items-center gap-3">
            <input
              data-help="cssd_setup.cycle_search_input"
              type="text"
              placeholder="Search by cycle number..."
              value={searchCycleNumber}
              onChange={(e) => setSearchCycleNumber(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm w-52 bg-white"
            />
            <select
              data-help="cssd_setup.filter_cycle_type_select"
              value={filterCycleType}
              onChange={(e) => setFilterCycleType(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm bg-white"
            >
              <option value="all">All Cycle Types</option>
              <option value="Load">Load (Packs)</option>
              <option value="BiologicalTest">Biological Test (Spore Indicator)</option>
              <option value="BowieDick">Bowie-Dick Test</option>
              <option value="LeakTest">Vacuum Leak Test</option>
            </select>
            <select
              data-help="cssd_setup.filter_cycle_status_select"
              value={filterCycleStatus}
              onChange={(e) => setFilterCycleStatus(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="Running">Running</option>
              <option value="Quarantined">Quarantined</option>
              <option value="Released">Released</option>
              <option value="Failed">Failed</option>
              <option value="Recalled">Recalled (IPC 92)</option>
            </select>
          </div>

          <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Cycle Number</th>
                  <th className="px-4 py-3 text-left">Sterilizer</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Started At</th>
                  <th className="px-4 py-3 text-left">Mechanical / Chemical</th>
                  <th className="px-4 py-3 text-left">Biological Indicator</th>
                  <th className="px-4 py-3 text-left">Packs</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCycles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      No sterilization cycles matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredCycles.map((c) => (
                    <tr key={c.cycle_id} className={c.status === "Recalled" ? "bg-red-50" : ""}>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">{c.cycle_number}</td>
                      <td className="px-4 py-3 text-gray-700">{c.sterilizer_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {c.cycle_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {new Date(c.started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span
                            className={
                              c.mechanical_pass
                                ? "text-green-700 font-semibold"
                                : "text-red-700 font-semibold"
                            }
                          >
                            Mech: {c.mechanical_pass ? "Pass" : "Fail"}
                          </span>
                          <span>|</span>
                          <span
                            className={
                              c.chemical_result === "Pass"
                                ? "text-green-700"
                                : c.chemical_result === "Fail"
                                ? "text-red-700"
                                : "text-gray-400"
                            }
                          >
                            Chem: {c.chemical_result ?? "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.biological_result === "Pass" && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                            BI: Pass
                          </span>
                        )}
                        {c.biological_result === "Fail" && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                            BI: FAIL
                          </span>
                        )}
                        {c.biological_result === "Pending" && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            BI: Incubating
                          </span>
                        )}
                        {(!c.biological_result || c.biological_result === "NotUsed") && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{c.packs}</td>
                      <td className="px-4 py-3">
                        {c.status === "Released" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                            Released
                          </span>
                        )}
                        {c.status === "Quarantined" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                            Quarantined
                          </span>
                        )}
                        {c.status === "Recalled" && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                            RECALLED (IPC 92)
                          </span>
                        )}
                        {c.status === "Failed" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                        {c.status === "Running" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                            Running
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          data-help="cssd_setup.view_cycle_button"
                          onClick={() => handleOpenCycleDetails(c.cycle_id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Details & Packs
                        </button>
                        {isManager && viewMode === "full" && c.status === "Released" && (
                          <button
                            data-help="cssd_setup.initiate_recall_button"
                            onClick={() => handleOpenRecallModal(c)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                          >
                            Recall Load
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS & LOGS */}
      {activeTab === "documents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Procedure Card */}
          <div className="bg-white border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-base">
              CSSD Sterilization, Validation & Recall Procedure (PDF)
            </h3>
            <p className="text-sm text-gray-600">
              Formal standard operating procedure covering pre-cleaning, packaging, biological monitoring, autoclave validation cycles, and breakdown recall protocol for Infection Prevention Committee approval.
            </p>
            <div className="pt-2">
              <button
                data-help="cssd_setup.download_procedure_button"
                onClick={handleDownloadProcedure}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Download Policy Document (PDF)
              </button>
            </div>
          </div>

          {/* Audit Log Card */}
          <div className="bg-white border rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-base">
              Sterilization Audit Log for Period (PDF)
            </h3>
            <p className="text-sm text-gray-600">
              Audit log of all sterilization cycles, machine parameters (temperature, pressure, hold time), chemical/biological indicator results, and operators for committee inspection.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
                <input
                  data-help="cssd_setup.log_date_from_input"
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
                <input
                  data-help="cssd_setup.log_date_to_input"
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  className="px-2.5 py-1.5 border rounded text-sm"
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                data-help="cssd_setup.download_log_button"
                onClick={handleDownloadLog}
                disabled={loading || !logDateFrom || !logDateTo}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Download Sterilization Log (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Set Type */}
      {isAddSetModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editingSet ? `Edit Sterile Set: ${editingSet.code}` : "Add New Sterile Set / Pack"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Set Code <span className="text-red-500">*</span>
                </label>
                <input
                  data-help="cssd_setup.set_code_input"
                  type="text"
                  placeholder="e.g. MAJ-LAP-01"
                  disabled={!!editingSet}
                  value={setFormInput.code}
                  onChange={(e) =>
                    setSetFormInput((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  className="w-full px-3 py-1.5 border rounded text-sm font-mono"
                />
                {setFormErrors.code && (
                  <p className="text-xs text-red-600 mt-0.5">{setFormErrors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Set / Pack Name <span className="text-red-500">*</span>
                </label>
                <input
                  data-help="cssd_setup.set_name_input"
                  type="text"
                  placeholder="e.g. Major Laparotomy Instrument Set"
                  value={setFormInput.name}
                  onChange={(e) => setSetFormInput((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-1.5 border rounded text-sm"
                />
                {setFormErrors.name && (
                  <p className="text-xs text-red-600 mt-0.5">{setFormErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Packaging Kind <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-help="cssd_setup.set_kind_select"
                    value={setFormInput.kind}
                    onChange={(e) => {
                      const kind = e.target.value as "InstrumentSet" | "Pack" | "Linen" | "Single";
                      setSetFormInput((prev) => ({
                        ...prev,
                        kind,
                        shelf_life_days: PACKAGING_PRESETS[kind].defaultDays,
                      }));
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="InstrumentSet">Instrument Set (Container)</option>
                    <option value="Pack">Pack (SMS / Paper Wrap)</option>
                    <option value="Linen">Linen (Cotton Wrap)</option>
                    <option value="Single">Single (Heat-sealed Pouch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Sterilization Method
                  </label>
                  <select
                    data-help="cssd_setup.set_method_select"
                    value={setFormInput.method}
                    onChange={(e) =>
                      setSetFormInput((prev) => ({
                        ...prev,
                        method: e.target.value as "Steam" | "EthyleneOxide" | "Plasma" | "DryHeat",
                      }))
                    }
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="Steam">Steam Autoclave</option>
                    <option value="EthyleneOxide">Ethylene Oxide (EtO)</option>
                    <option value="Plasma">Hydrogen Peroxide Plasma</option>
                    <option value="DryHeat">Dry Heat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Shelf Life (Days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-help="cssd_setup.set_shelf_life_input"
                    type="number"
                    min="1"
                    max="730"
                    value={setFormInput.shelf_life_days}
                    onChange={(e) =>
                      setSetFormInput((prev) => ({
                        ...prev,
                        shelf_life_days: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-full px-3 py-1.5 border rounded text-sm font-mono"
                  />
                  {setFormErrors.shelf_life_days && (
                    <p className="text-xs text-red-600 mt-0.5">{setFormErrors.shelf_life_days}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Packaging Preset
                  </label>
                  <select
                    data-help="cssd_setup.set_preset_select"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val) setSetFormInput((prev) => ({ ...prev, shelf_life_days: val }));
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm bg-gray-50"
                  >
                    <option value="">Choose preset...</option>
                    <option value="30">Linen Wrap: 30 days</option>
                    <option value="60">Single Pouch: 60 days</option>
                    <option value="90">SMS Double Wrap: 90 days</option>
                    <option value="180">Rigid Container: 180 days</option>
                    <option value="365">Filter Container: 365 days</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-2.5 rounded border border-amber-200">
                  <input
                    data-help="cssd_setup.set_implant_checkbox"
                    type="checkbox"
                    checked={setFormInput.contains_implant}
                    onChange={(e) =>
                      setSetFormInput((prev) => ({ ...prev, contains_implant: e.target.checked }))
                    }
                  />
                  <span className="text-xs text-amber-900 font-medium">
                    This set contains surgical implants (MSDS IPC 91: load release strictly contingent on passing biological indicator).
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                data-help="cssd_setup.cancel_set_button"
                onClick={() => setIsAddSetModalOpen(false)}
                className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                data-help="cssd_setup.save_set_button"
                onClick={handleSaveSet}
                disabled={loading}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {editingSet ? "Update Set" : "Add Set"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Sterilizer */}
      {isAddSterilizerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editingSterilizer
                ? `Edit Sterilizer: ${editingSterilizer.name}`
                : "Register New Sterilizer / Autoclave"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sterilizer Name / ID <span className="text-red-500">*</span>
                </label>
                <input
                  data-help="cssd_setup.sterilizer_name_input"
                  type="text"
                  placeholder="e.g. Autoclave 1 - Clean Room"
                  value={sterilizerFormInput.name}
                  onChange={(e) =>
                    setSterilizerFormInput((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 border rounded text-sm"
                />
                {sterilizerFormErrors.name && (
                  <p className="text-xs text-red-600 mt-0.5">{sterilizerFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Method <span className="text-red-500">*</span>
                </label>
                <select
                  data-help="cssd_setup.sterilizer_method_select"
                  value={sterilizerFormInput.method}
                  onChange={(e) =>
                    setSterilizerFormInput((prev) => ({
                      ...prev,
                      method: e.target.value as "Steam" | "EthyleneOxide" | "Plasma" | "DryHeat",
                    }))
                  }
                  className="w-full px-3 py-1.5 border rounded text-sm"
                >
                  <option value="Steam">Steam Autoclave</option>
                  <option value="EthyleneOxide">Ethylene Oxide (EtO)</option>
                  <option value="Plasma">Hydrogen Peroxide Plasma</option>
                  <option value="DryHeat">Dry Heat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Location / Bay
                </label>
                <input
                  data-help="cssd_setup.sterilizer_location_input"
                  type="text"
                  placeholder="e.g. CSSD Decontamination Area / Bay 2"
                  value={sterilizerFormInput.location ?? ""}
                  onChange={(e) =>
                    setSterilizerFormInput((prev) => ({ ...prev, location: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 border rounded text-sm"
                />
              </div>

              {canViewAssetsFlag && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Link Medical Equipment Asset (GET /ops/assets)
                  </label>
                  <select
                    data-help="cssd_setup.sterilizer_asset_select"
                    value={sterilizerFormInput.asset_id ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? parseInt(e.target.value, 10) : null;
                      setSterilizerFormInput((prev) => ({ ...prev, asset_id: id }));
                    }}
                    className="w-full px-3 py-1.5 border rounded text-sm"
                  >
                    <option value="">No asset linked (or select from register)...</option>
                    {opsAssets.map((a) => (
                      <option key={a.asset_id} value={a.asset_id}>
                        {a.asset_tag} - {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                data-help="cssd_setup.cancel_sterilizer_button"
                onClick={() => setIsAddSterilizerModalOpen(false)}
                className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                data-help="cssd_setup.save_sterilizer_button"
                onClick={handleSaveSterilizer}
                disabled={loading}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {editingSterilizer ? "Update Sterilizer" : "Save Sterilizer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cycle Details & Exposed Packs */}
      {selectedCycleDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Cycle Details: {selectedCycleDetail.cycle_number}
                </h2>
                <p className="text-xs text-gray-500">
                  Sterilizer: {selectedCycleDetail.sterilizer_name} | Started:{" "}
                  {new Date(selectedCycleDetail.started_at).toLocaleString()}
                </p>
              </div>
              <button
                data-help="cssd_setup.close_cycle_modal_button"
                onClick={() => setSelectedCycleDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Cycle Parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded text-xs">
              <div>
                <span className="text-gray-500 block">Temperature:</span>
                <span className="font-semibold text-gray-800">
                  {selectedCycleDetail.temperature_c ?? "-"} °C
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Pressure:</span>
                <span className="font-semibold text-gray-800">
                  {selectedCycleDetail.pressure_kpa ?? "-"} kPa
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Exposure Time:</span>
                <span className="font-semibold text-gray-800">
                  {selectedCycleDetail.exposure_minutes ?? "-"} min
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Operator:</span>
                <span className="font-semibold text-gray-800">
                  {selectedCycleDetail.operator_name}
                </span>
              </div>
            </div>

            {/* Biological Indicator Candidate Loads */}
            {selectedCycleDetail.recall_candidates &&
              selectedCycleDetail.recall_candidates.length > 0 && (
                <div className="bg-red-50 border border-red-300 p-3 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold text-red-900 uppercase">
                    Failed Biological Test: Loads at Risk of Breakdown (MSDS IPC 92)
                  </h4>
                  <p className="text-xs text-red-700">
                    The following loads were released on this sterilizer since its last passed biological indicator and must be reviewed for recall:
                  </p>
                  <div className="space-y-1">
                    {selectedCycleDetail.recall_candidates.map((rc) => (
                      <div
                        key={rc.cycle_id}
                        className="flex items-center justify-between bg-white p-2 rounded border border-red-200 text-xs"
                      >
                        <span className="font-mono font-bold">{rc.cycle_number}</span>
                        <span>{rc.packs} packs</span>
                        <span className="text-gray-500">
                          {new Date(rc.started_at).toLocaleString()}
                        </span>
                        {rc.status === "Released" && isManager && (
                          <button
                            data-help="cssd_setup.initiate_recall_button"
                            onClick={() => {
                              setSelectedCycleDetail(null);
                              handleOpenRecallModal(rc);
                            }}
                            className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold"
                          >
                            Recall Load
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Exposed Patients Banner if Recalled */}
            {selectedCycleDetail.patients_exposed &&
              selectedCycleDetail.patients_exposed.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 uppercase">
                    Exposed Patients Requiring Clinical Follow-up:
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCycleDetail.patients_exposed.map((mrn) => (
                      <span
                        key={mrn}
                        className="font-mono text-xs px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold"
                      >
                        {mrn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Packs in Load */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">
                Packs Sterilized in this Cycle ({selectedCycleDetail.pack_list?.length ?? 0})
              </h4>
              <div className="border rounded max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Pack Code</th>
                      <th className="px-3 py-2 text-left">Set Name</th>
                      <th className="px-3 py-2 text-left">Expires On</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Issued / Used Location</th>
                      <th className="px-3 py-2 text-left">Patient MRN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {!selectedCycleDetail.pack_list ||
                    selectedCycleDetail.pack_list.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                          No packs registered in this cycle.
                        </td>
                      </tr>
                    ) : (
                      selectedCycleDetail.pack_list.map((p) => (
                        <tr key={p.pack_id} className={p.status === "Recalled" ? "bg-red-50" : ""}>
                          <td className="px-3 py-2 font-mono font-bold">{p.pack_code}</td>
                          <td className="px-3 py-2">{p.set_name}</td>
                          <td className="px-3 py-2">{p.expires_on}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                p.status === "Recalled"
                                  ? "bg-red-600 text-white"
                                  : p.status === "Used"
                                  ? "bg-purple-100 text-purple-800"
                                  : p.status === "Available"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {p.issued_to_ot_name ?? p.issued_to_ward_name ?? "-"}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-800">
                            {p.mrn ?? "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                data-help="cssd_setup.close_cycle_modal_button"
                onClick={() => setSelectedCycleDetail(null)}
                className="px-4 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Recall Load */}
      {recallingCycle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-red-600 text-2xl font-bold">⚠️</div>
              <div>
                <h3 className="text-base font-bold text-red-900">
                  Recall Released Load: {recallingCycle.cycle_number}
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Rule dc520ffa20 & MSDS IPC 92: A breakdown or biological spore test failure requires immediate recall of all packs from this load.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Clinical Reason for Recall <span className="text-red-500">*</span>
              </label>
              <textarea
                data-help="cssd_setup.recall_reason_input"
                rows={3}
                placeholder="Explain the biological indicator positive, physical abort, or packaging integrity failure..."
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                data-help="cssd_setup.cancel_recall_button"
                onClick={() => setRecallingCycle(null)}
                className="px-4 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                data-help="cssd_setup.confirm_recall_button"
                onClick={handleConfirmRecall}
                disabled={loading || !recallReason.trim()}
                className="px-4 py-1.5 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Load Recall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
