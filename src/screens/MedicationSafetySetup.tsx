/**
 * Screen 136: medication_safety_setup
 * "High-alert and look-alike medicines"
 * Workspace: `pharmacy_admin`, Position: 136, Points: 54.
 *
 * Statutory & Quality Rules:
 * - rule:a8dc0017ab: Flag from the formulary search: high_alert_category (null clears it; never on an OTC medicine)
 *                    and is_restricted. Pair look-alikes with a note on how to tell them apart; retire a pair with is_active false.
 * - rule:6da5fd1c68: Print the list again after every change and replace it at the nursing stations and the pharmacy.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  highAlertList,
  highAlertPdf,
  setDrugFlags,
  addPair,
  updatePair,
  policyPdfMedicationSafety,
  searchDrugs,
  type HighAlertListOut,
  type SafetyDrugOut,
  type LasaPairOut,
  type DrugSafetyIn,
  type LasaPairIn,
  type LasaPairUpdateIn,
  type DrugStockOut,
} from "../generated/medication_safety_setup";
import {
  getMedicationSafetySetupCapabilityView,
  validateDrugSafetyPatch,
  validateLasaPairInput,
  validateLasaPairUpdate,
  MEDICATION_SAFETY_ERROR_MESSAGES,
  HIGH_ALERT_CATEGORIES,
  HIGH_ALERT_CATEGORY_LABELS,
  type MedicationSafetyCapabilityView,
  type HighAlertCategory,
} from "../medication-safety-setup-policy";

export interface MedicationSafetySetupProps {
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

type SafetyTab = "high_alert" | "lasa" | "search";

export const MedicationSafetySetup: React.FC<MedicationSafetySetupProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: MedicationSafetyCapabilityView = useMemo(
    () => getMedicationSafetySetupCapabilityView(establishment),
    [establishment]
  );

  const [activeTab, setActiveTab] = useState<SafetyTab>("high_alert");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data states
  const [safetyData, setSafetyData] = useState<HighAlertListOut | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DrugStockOut[]>([]);

  // Modals
  const [showAddPairModal, setShowAddPairModal] = useState(false);
  const [selectedPairToEdit, setSelectedPairToEdit] = useState<LasaPairOut | null>(null);
  const [selectedDrugToFlag, setSelectedDrugToFlag] = useState<DrugStockOut | SafetyDrugOut | null>(null);

  // Form states: New LASA Pair
  const [newPairForm, setNewPairForm] = useState<LasaPairIn>({
    drug_id: 1,
    other_drug_id: 2,
    note: "",
  });

  // Form states: Edit LASA Pair
  const [editPairForm, setEditPairForm] = useState<LasaPairUpdateIn>({
    note: "",
    is_active: true,
  });

  // Form states: Drug Safety Flags
  const [drugFlagsForm, setDrugFlagsForm] = useState<DrugSafetyIn>({
    high_alert_category: null,
    is_restricted: false,
    expected_version: null,
  });

  // Permissions
  const canConfigure =
    user.permissions.includes("medication.safety.configure") ||
    user.roles.includes("pharmacy_admin");

  // Load High-Alert List
  const loadSafetyList = useCallback(async () => {
    if (capabilityView === "hidden") return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await highAlertList();
      setSafetyData(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load medication safety lists.");
    } finally {
      setLoading(false);
    }
  }, [capabilityView]);

  useEffect(() => {
    loadSafetyList();
  }, [loadSafetyList]);

  // Handle Search Formulary Drugs
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await searchDrugs({ q: searchQuery.trim() || undefined, limit: 30 });
      setSearchResults(res);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to search formulary medicines.");
    } finally {
      setLoading(false);
    }
  };

  // Download High-Alert PDF (rule:6da5fd1c68)
  const handleDownloadHighAlertPdf = async () => {
    setLoading(true);
    try {
      await highAlertPdf();
      setSuccessMessage("High-Alert List PDF generated for ward nursing stations and pharmacy (Rule 6da5fd1c68).");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate High-Alert PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Download Safety Policy PDF
  const handleDownloadPolicyPdf = async () => {
    setLoading(true);
    try {
      await policyPdfMedicationSafety();
      setSuccessMessage("Hospital Medication Safety Policy document downloaded.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate Policy PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Add LASA Pair (POST /medication-safety/lasa-pairs)
  const handleSavePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLasaPairInput(newPairForm, safetyData?.lasa_pairs);
    if (!validation.valid) {
      setErrorMessage(validation.error || "LASA pair validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await addPair(newPairForm);
      setSuccessMessage(
        `Look-alike pair created: ${res.drug_name} paired with ${res.other_drug_name} (Rule a8dc0017ab).`
      );
      setShowAddPairModal(false);
      setNewPairForm({ drug_id: 1, other_drug_id: 2, note: "" });
      loadSafetyList();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = MEDICATION_SAFETY_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Edit / Retire LASA Pair (PATCH /medication-safety/lasa-pairs/{pair_id})
  const handleSaveEditPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPairToEdit) return;
    const validation = validateLasaPairUpdate(editPairForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "LASA pair update validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await updatePair(selectedPairToEdit.pair_id, {
        note: editPairForm.note,
        is_active: editPairForm.is_active,
        expected_version: selectedPairToEdit.row_version,
      });
      setSuccessMessage(
        `LASA pair #${res.pair_id} updated (Active: ${res.is_active ? "Yes" : "Retired"}).`
      );
      setSelectedPairToEdit(null);
      loadSafetyList();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = MEDICATION_SAFETY_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Quick toggle retire LASA pair
  const handleTogglePairActive = async (pair: LasaPairOut) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const newActive = !pair.is_active;
      await updatePair(pair.pair_id, {
        is_active: newActive,
        expected_version: pair.row_version,
      });
      setSuccessMessage(`LASA pair #${pair.pair_id} ${newActive ? "reactivated" : "retired per Rule a8dc0017ab"}.`);
      loadSafetyList();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update pair status.");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Set Medicine Safety Flags (PATCH /medication-safety/drugs/{drug_id})
  const handleSaveDrugFlags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrugToFlag) return;
    const validation = validateDrugSafetyPatch(
      drugFlagsForm,
      selectedDrugToFlag.schedule,
      selectedDrugToFlag.is_otc_allowed
    );
    if (!validation.valid) {
      setErrorMessage(validation.error || "Drug safety validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await setDrugFlags(selectedDrugToFlag.drug_id, {
        high_alert_category: drugFlagsForm.high_alert_category,
        is_restricted: drugFlagsForm.is_restricted,
        expected_version: "row_version" in selectedDrugToFlag ? selectedDrugToFlag.row_version : null,
      });
      setSuccessMessage(
        `Safety flags updated for ${res.name}: High-Alert: ${res.high_alert_category || "None"}, Restricted: ${
          res.is_restricted ? "Yes" : "No"
        } (Rule a8dc0017ab).`
      );
      setSelectedDrugToFlag(null);
      loadSafetyList();
      if (searchResults.length > 0) handleSearch();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = MEDICATION_SAFETY_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  if (capabilityView === "hidden") {
    return (
      <div className="p-8 text-center bg-gray-100 rounded-lg border border-gray-300">
        <h2 className="text-xl font-bold text-gray-700">Medication Safety Setup Hidden</h2>
        <p className="text-gray-500 mt-2">
          This service is hidden according to the current hospital establishment configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-800 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              High-Alert &amp; Look-Alike Medicines
            </h1>
            <span className="text-xs px-2.5 py-1 bg-rose-100 text-rose-800 font-semibold rounded-full border border-rose-300">
              MSDS 56 &amp; 52
            </span>
            <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full border border-blue-300">
              Capability View: {capabilityView}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Governance of High-Alert categories (Rule a8dc0017ab), Restricted prescribing privileges, LASA pairs with distinction notes,
            and mandatory station printouts (Rule 6da5fd1c68).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-help="medication_safety_setup.download_high_alert_pdf_btn"
            onClick={handleDownloadHighAlertPdf}
            disabled={loading}
            className="px-3 py-2 bg-rose-600 text-white font-semibold text-xs rounded-lg hover:bg-rose-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
          >
            <span>🖨</span> Print High-Alert List PDF
          </button>
          <button
            type="button"
            data-help="medication_safety_setup.download_policy_pdf_btn"
            onClick={handleDownloadPolicyPdf}
            disabled={loading}
            className="px-3 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
          >
            <span>📄</span> Policy PDF
          </button>
          <button
            type="button"
            data-help="medication_safety_setup.refresh_btn"
            onClick={loadSafetyList}
            disabled={loading}
            className="px-3 py-2 bg-gray-800 text-white font-semibold text-xs rounded-lg hover:bg-gray-900 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Error & Success Notification Banners */}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-red-600 font-bold">Error:</span>
            <span className="text-red-800 text-sm">{errorMessage}</span>
          </div>
          <button
            type="button"
            data-help="medication_safety_setup.dismiss_error_btn"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-emerald-600 font-bold">Success:</span>
            <span className="text-emerald-800 text-sm">{successMessage}</span>
          </div>
          <button
            type="button"
            data-help="medication_safety_setup.dismiss_success_btn"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 rounded-t-xl gap-2 shadow-sm">
        <button
          type="button"
          data-help="medication_safety_setup.high_alert_tab"
          onClick={() => setActiveTab("high_alert")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "high_alert"
              ? "border-rose-600 text-rose-700 bg-rose-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          🚨 High-Alert &amp; Restricted Registry
        </button>
        <button
          type="button"
          data-help="medication_safety_setup.lasa_tab"
          onClick={() => setActiveTab("lasa")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "lasa"
              ? "border-rose-600 text-rose-700 bg-rose-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          👥 Look-Alike / Sound-Alike (LASA) Pairs
        </button>
        <button
          type="button"
          data-help="medication_safety_setup.search_tab"
          onClick={() => setActiveTab("search")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "search"
              ? "border-rose-600 text-rose-700 bg-rose-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          🔍 Formulary Safety Search &amp; Flagging
        </button>
      </div>

      {/* TAB 1: HIGH-ALERT MEDICINES & RESTRICTED LIST */}
      {activeTab === "high_alert" && (
        <div className="space-y-6">
          {/* Statutory Rule Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex justify-between items-center">
            <div>
              <span className="font-bold">Statutory Rule 6da5fd1c68 &amp; MSDS 56 ii:</span>
              <p className="mt-0.5 text-amber-800">
                Replace printed High-Alert lists at all nursing stations, OT rooms, and pharmacy dispensing counters whenever this registry is modified.
              </p>
            </div>
            <button
              type="button"
              data-help="medication_safety_setup.banner_print_btn"
              onClick={handleDownloadHighAlertPdf}
              className="px-3 py-1.5 bg-amber-700 text-white font-semibold rounded hover:bg-amber-800 shrink-0"
            >
              Print Current Version
            </button>
          </div>

          {/* High-Alert Categories Worklist */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🛡</span> High-Alert Medication Categories ({safetyData?.categories?.length || 0})
            </h2>

            {safetyData?.categories?.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-400">
                No high-alert medications currently registered in hospital formulary.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {safetyData?.categories?.map((cat) => (
                  <div key={cat.category} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                        <h3 className="font-bold text-sm text-gray-900">{cat.label}</h3>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200">
                        {cat.drugs.length} medicines
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto text-xs">
                      {cat.drugs.map((drug) => (
                        <div key={drug.drug_id} className="py-2 flex justify-between items-center hover:bg-gray-50 px-1 rounded">
                          <div>
                            <div className="font-bold text-gray-800">{drug.name}</div>
                            <div className="text-[11px] text-gray-500 font-mono">
                              {drug.strength || ""} {drug.form} ({drug.schedule})
                            </div>
                          </div>
                          {canConfigure && (
                            <button
                              type="button"
                              data-help="medication_safety_setup.edit_drug_flag_btn"
                              onClick={() => {
                                setSelectedDrugToFlag(drug);
                                setDrugFlagsForm({
                                  high_alert_category: drug.high_alert_category,
                                  is_restricted: drug.is_restricted,
                                  expected_version: drug.row_version,
                                });
                              }}
                              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded border border-gray-300"
                            >
                              Edit Flags
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Restricted Prescribing Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>🔒</span> Restricted Prescribing Medicines (MSDS 52)
              </h2>
              <span className="text-xs px-2.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-full border border-purple-300">
                {safetyData?.restricted?.length || 0} restricted
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Medicines that can only be prescribed by clinicians holding the specific RestrictedPrescribing clinical privilege.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {safetyData?.restricted?.map((drug) => (
                <div key={drug.drug_id} className="p-3 bg-purple-50/50 rounded-lg border border-purple-200 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-purple-900">{drug.name}</div>
                    <div className="text-[11px] text-gray-500">{drug.strength || ""} {drug.form}</div>
                  </div>
                  {canConfigure && (
                    <button
                      type="button"
                      data-help="medication_safety_setup.edit_restricted_flag_btn"
                      onClick={() => {
                        setSelectedDrugToFlag(drug);
                        setDrugFlagsForm({
                          high_alert_category: drug.high_alert_category,
                          is_restricted: drug.is_restricted,
                          expected_version: drug.row_version,
                        });
                      }}
                      className="px-2 py-1 bg-white hover:bg-purple-100 text-purple-700 font-semibold rounded border border-purple-300"
                    >
                      Configure
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOOK-ALIKE / SOUND-ALIKE (LASA) PAIRS */}
      {activeTab === "lasa" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Look-Alike / Sound-Alike (LASA) Safety Pairs</h2>
              <p className="text-xs text-gray-500">
                Rule a8dc0017ab: Pair look-alikes with a distinction note on how to tell them apart; retire a pair with is_active false.
              </p>
            </div>
            {canConfigure && (
              <button
                type="button"
                data-help="medication_safety_setup.open_add_pair_btn"
                onClick={() => setShowAddPairModal(true)}
                className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition shadow-sm text-sm"
              >
                + Pair Look-Alike Medicines
              </button>
            )}
          </div>

          {/* LASA Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="p-3 font-semibold">Primary Medicine</th>
                  <th className="p-3 font-semibold">Look-Alike / Sound-Alike Partner</th>
                  <th className="p-3 font-semibold">Distinction &amp; Differentiation Note</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!safetyData?.lasa_pairs || safetyData.lasa_pairs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400">
                      No Look-Alike / Sound-Alike pairs configured.
                    </td>
                  </tr>
                ) : (
                  safetyData.lasa_pairs.map((pair) => (
                    <tr key={pair.pair_id} className={`hover:bg-gray-50 ${!pair.is_active ? "opacity-60 bg-gray-50" : ""}`}>
                      <td className="p-3 font-semibold text-gray-900">
                        {pair.drug_name}
                        {pair.drug_strength && <span className="ml-1 text-xs text-gray-500">({pair.drug_strength})</span>}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {pair.other_drug_name}
                        {pair.other_drug_strength && (
                          <span className="ml-1 text-xs text-gray-500">({pair.other_drug_strength})</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-700 max-w-xs">{pair.note}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            pair.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {pair.is_active ? "Active" : "Retired"}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-2">
                        {canConfigure && (
                          <>
                            <button
                              type="button"
                              data-help="medication_safety_setup.open_edit_pair_btn"
                              onClick={() => {
                                setSelectedPairToEdit(pair);
                                setEditPairForm({
                                  note: pair.note,
                                  is_active: pair.is_active,
                                });
                              }}
                              className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 font-medium"
                            >
                              Edit Note
                            </button>
                            <button
                              type="button"
                              data-help="medication_safety_setup.toggle_pair_active_btn"
                              onClick={() => handleTogglePairActive(pair)}
                              className={`px-2 py-1 text-xs font-medium rounded border ${
                                pair.is_active
                                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              {pair.is_active ? "Retire" : "Reactivate"}
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

      {/* TAB 3: FORMULARY SEARCH & FLAGGING */}
      {activeTab === "search" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Formulary Safety Search &amp; Flagging</h2>
            <p className="text-xs text-gray-500">
              Query formulary drugs with live stock colour, and configure High-Alert or Restricted flags under Rule a8dc0017ab.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              data-help="medication_safety_setup.search_input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicine by brand name, generic molecule, or code..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="submit"
              data-help="medication_safety_setup.search_btn"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm shadow-sm"
            >
              Search Drugs
            </button>
          </form>

          {/* Search Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Medicine Name</th>
                  <th className="p-3 font-semibold">Form &amp; Strength</th>
                  <th className="p-3 font-semibold">Schedule</th>
                  <th className="p-3 font-semibold">Stock Status</th>
                  <th className="p-3 font-semibold">Safety Flags</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-400">
                      {searchQuery ? "No medicines matched search query." : "Enter a search term above to inspect and configure safety flags."}
                    </td>
                  </tr>
                ) : (
                  searchResults.map((drug) => (
                    <tr key={drug.drug_id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-medium text-xs">{drug.code}</td>
                      <td className="p-3 font-semibold text-gray-900">
                        {drug.name}
                        {drug.generic_name && <div className="text-xs text-gray-500 font-normal">{drug.generic_name}</div>}
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {drug.strength || ""} {drug.form}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold text-gray-700">{drug.schedule}</span>
                        {drug.is_otc_allowed && <span className="ml-1 text-[10px] text-emerald-600 font-bold">(OTC Allowed)</span>}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            drug.stock_status === "InStock"
                              ? "bg-emerald-100 text-emerald-800"
                              : drug.stock_status === "Low"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {drug.stock_status} ({drug.qty_available})
                        </span>
                      </td>
                      <td className="p-3 text-xs space-y-1">
                        {drug.high_alert_category ? (
                          <div className="font-bold text-rose-700 flex items-center gap-1">
                            <span>🚨</span> {drug.high_alert_category}
                          </div>
                        ) : (
                          <div className="text-gray-400">Standard</div>
                        )}
                        {drug.is_restricted && (
                          <div className="font-bold text-purple-700">🔒 Restricted Prescribing</div>
                        )}
                        {drug.lasa_with && drug.lasa_with.length > 0 && (
                          <div className="text-[11px] text-amber-700 font-medium">
                            LASA with: {drug.lasa_with.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {canConfigure && (
                          <button
                            type="button"
                            data-help="medication_safety_setup.open_flag_modal_btn"
                            onClick={() => {
                              setSelectedDrugToFlag(drug);
                              setDrugFlagsForm({
                                high_alert_category: drug.high_alert_category,
                                is_restricted: drug.is_restricted,
                                expected_version: null,
                              });
                            }}
                            className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 font-semibold text-xs"
                          >
                            Configure Safety
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

      {/* MODAL: ADD LASA PAIR */}
      {showAddPairModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Pair Look-Alike / Sound-Alike Medicines</h3>
                <p className="text-xs text-gray-500">Statutory Rule a8dc0017ab: Distinguish look-alikes with clear guidance.</p>
              </div>
              <button
                type="button"
                data-help="medication_safety_setup.close_pair_modal_btn"
                onClick={() => setShowAddPairModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePair} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Drug ID *</label>
                  <input
                    type="number"
                    data-help="medication_safety_setup.pair_drug_id_input"
                    value={newPairForm.drug_id}
                    onChange={(e) => setNewPairForm({ ...newPairForm, drug_id: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Look-Alike Drug ID *</label>
                  <input
                    type="number"
                    data-help="medication_safety_setup.pair_other_drug_id_input"
                    value={newPairForm.other_drug_id}
                    onChange={(e) => setNewPairForm({ ...newPairForm, other_drug_id: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Distinction Note &amp; Staff Differentiation Guidance *
                </label>
                <textarea
                  data-help="medication_safety_setup.pair_note_input"
                  value={newPairForm.note}
                  onChange={(e) => setNewPairForm({ ...newPairForm, note: e.target.value })}
                  placeholder="Explain packaging visual differences, Tall Man lettering (e.g. DOPamine vs DoBUTamine), or dosage forms..."
                  rows={3}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="medication_safety_setup.cancel_pair_modal_btn"
                  onClick={() => setShowAddPairModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="medication_safety_setup.save_pair_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Save LASA Pair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LASA PAIR */}
      {selectedPairToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Edit Look-Alike Pair #{selectedPairToEdit.pair_id}</h3>
                <p className="text-xs text-gray-500">{selectedPairToEdit.drug_name} &amp; {selectedPairToEdit.other_drug_name}</p>
              </div>
              <button
                type="button"
                data-help="medication_safety_setup.close_edit_pair_modal_btn"
                onClick={() => setSelectedPairToEdit(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPair} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Distinction Note *</label>
                <textarea
                  data-help="medication_safety_setup.edit_pair_note_input"
                  value={editPairForm.note || ""}
                  onChange={(e) => setEditPairForm({ ...editPairForm, note: e.target.value })}
                  rows={3}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-help="medication_safety_setup.edit_pair_active_checkbox"
                    checked={Boolean(editPairForm.is_active)}
                    onChange={(e) => setEditPairForm({ ...editPairForm, is_active: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">Pair Active (Uncheck to retire per Rule a8dc0017ab)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="medication_safety_setup.cancel_edit_pair_modal_btn"
                  onClick={() => setSelectedPairToEdit(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="medication_safety_setup.save_edit_pair_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                >
                  Update Pair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE DRUG SAFETY FLAGS (rule:a8dc0017ab) */}
      {selectedDrugToFlag && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Configure Safety Flags: {selectedDrugToFlag.name}</h3>
                <p className="text-xs text-gray-500">
                  Code: {selectedDrugToFlag.code} | Schedule: {selectedDrugToFlag.schedule}
                </p>
              </div>
              <button
                type="button"
                data-help="medication_safety_setup.close_flag_modal_btn"
                onClick={() => setSelectedDrugToFlag(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDrugFlags} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">High-Alert Category (MSDS 56)</label>
                <select
                  data-help="medication_safety_setup.flag_category_select"
                  value={drugFlagsForm.high_alert_category || ""}
                  disabled={selectedDrugToFlag.schedule === "OTC" || selectedDrugToFlag.is_otc_allowed}
                  onChange={(e) => {
                    const val = e.target.value ? (e.target.value as HighAlertCategory) : null;
                    setDrugFlagsForm({ ...drugFlagsForm, high_alert_category: val });
                  }}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white disabled:bg-gray-100"
                >
                  <option value="">None (Clear High-Alert Status - Rule a8dc0017ab)</option>
                  {HIGH_ALERT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{HIGH_ALERT_CATEGORY_LABELS[c].en}</option>
                  ))}
                </select>
                {(selectedDrugToFlag.schedule === "OTC" || selectedDrugToFlag.is_otc_allowed) && (
                  <p className="text-xs text-rose-600 mt-1 font-semibold">
                    ⚠ Statutory Rule a8dc0017ab: A high-alert category can never be assigned to an OTC medicine.
                  </p>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-help="medication_safety_setup.flag_restricted_checkbox"
                    checked={Boolean(drugFlagsForm.is_restricted)}
                    onChange={(e) => setDrugFlagsForm({ ...drugFlagsForm, is_restricted: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Restricted Prescribing (Requires RestrictedPrescribing privilege, MSDS 52)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="medication_safety_setup.cancel_flag_modal_btn"
                  onClick={() => setSelectedDrugToFlag(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="medication_safety_setup.save_flag_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Save Safety Flags
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
