import {DirectoryPicker} from "../DirectoryPicker";
/**
 * Screen 137: drug_recalls
 * "Batch recalls"
 * Workspace: `pharmacy_admin`, Position: 137, Points: 63.
 *
 * Statutory & Quality Rules:
 * - rule:fe2af7a43c: Open: the medicine, the batches (from GET /drugs/{drug_id}/stock-status, or all_batches),
 *                    the source and reference (the DRAP alert), the class, the reason, contact_patients.
 *                    The batches are blocked at once everywhere; the wards and the pharmacy are alerted.
 * - rule:6e16f97bd1: Detail: per batch what is left in the pharmacy and on each ward and what was dispensed,
 *                    given and used in theatre; the people who received it with their phone numbers.
 *                    'Remove stock' writes off every unit left (the note: returned to the supplier or destroyed).
 *                    Record each contact (Contacted, Unreachable, NotNeeded with a note).
 * - rule:2b020bd53b: Close when can_close (RECALL_NOT_COMPLETE shows what is left). Opened by mistake: Cancel
 *                    (the batches are released).
 * - rule:0bdb1f574d: Exists for the service dispensing (work): show it as GET /establishment views.screens says
 *                    for screen_id drug_recalls (full; open_work: without its new work, with the banner
 *                    "No new ... from now on"; records: history and corrections only; setup: only from Facility settings;
 *                    hidden: in no menu), after login and again on establishment.changed. Never decide it from the
 *                    profile's category.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  listRecalls,
  getRecall,
  openRecall,
  removeRecalledStock,
  recordContact,
  closeRecall,
  cancelRecall,
  stockStatus,
  type RecallOut,
  type RecallDetailOut,
  type RecallIn,
  type MedicationReasonIn,
  type DrugStockDetailOut,
  type RecallPatientOut,
} from "../generated/drug_recalls";
import {
  getDrugRecallsCapabilityView,
  validateOpenRecallInput,
  validateRemoveStockInput,
  validateRecordContactInput,
  validateCloseRecallInput,
  validateCancelRecallInput,
  DRUG_RECALL_ERROR_MESSAGES,
  RECALL_SOURCES,
  RECALL_SOURCE_LABELS,
  RECALL_CLASSES,
  RECALL_CLASS_LABELS,
  PATIENT_CONTACT_OUTCOME_LABELS,
  type DrugRecallsCapabilityView,
  type RecallSource,
  type RecallClass,
  type RecallStatus,
  type PatientContactOutcome,
} from "../drug-recalls-policy";

export interface DrugRecallsProps {
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

type TabMode = "recalls_list" | "recall_detail";

export const DrugRecalls: React.FC<DrugRecallsProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: DrugRecallsCapabilityView = useMemo(
    () => getDrugRecallsCapabilityView(establishment),
    [establishment]
  );

  const canManage = useMemo(
    () =>
      user.permissions.includes("pharmacy.recall.manage") ||
      user.roles.includes("pharmacy_admin"),
    [user]
  );

  const canView = useMemo(
    () =>
      user.permissions.includes("pharmacy.recall.view") ||
      canManage ||
      user.roles.some((r) =>
        [
          "clinic_director",
          "hospital_admin",
          "hospital_director",
          "owner",
          "pharmacist",
          "pharmacy_admin",
          "quality_officer",
        ].includes(r)
      ),
    [user, canManage]
  );

  const [activeTab, setActiveTab] = useState<TabMode>("recalls_list");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Recalls register list
  const [recalls, setRecalls] = useState<RecallOut[]>([]);
  const [statusFilter, setStatusFilter] = useState<RecallStatus | "All">("All");

  // Selected recall detail
  const [selectedRecallId, setSelectedRecallId] = useState<number | null>(null);
  const [selectedRecall, setSelectedRecall] = useState<RecallDetailOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Open recall modal state
  const [isOpeningRecall, setIsOpeningRecall] = useState(false);
  const [drugLookupId, setDrugLookupId] = useState<string>("");
  const [drugStockDetail, setDrugStockDetail] = useState<DrugStockDetailOut | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [openRecallForm, setOpenRecallForm] = useState<Partial<RecallIn>>({
    source: "DRAP",
    recall_class: "ClassI",
    reason: "",
    reference: "",
    contact_patients: true,
    all_batches: false,
    batch_ids: [],
  });

  // Action modals
  const [isRemovingStock, setIsRemovingStock] = useState(false);
  const [removeStockNote, setRemoveStockNote] = useState("");

  const [isClosingRecall, setIsClosingRecall] = useState(false);
  const [closingNote, setClosingNote] = useState("");

  const [isCancellingRecall, setIsCancellingRecall] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [selectedPatientContact, setSelectedPatientContact] = useState<RecallPatientOut | null>(null);
  const [patientContactOutcome, setPatientContactOutcome] = useState<"Contacted" | "Unreachable" | "NotNeeded">("Contacted");
  const [patientContactNote, setPatientContactNote] = useState("");

  const translateApiError = useCallback((err: any): string => {
    if (!err) return "Unknown error occurred.";
    const code = err.code || (err.message && err.message.toUpperCase()) || "";
    if (DRUG_RECALL_ERROR_MESSAGES[code]) {
      return `${DRUG_RECALL_ERROR_MESSAGES[code].en} (${DRUG_RECALL_ERROR_MESSAGES[code].ur})`;
    }
    return err.message || String(err);
  }, []);

  // Fetch register
  const fetchRecalls = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const query = statusFilter === "All" ? undefined : { status: statusFilter };
      const data = await listRecalls(query);
      setRecalls(data);
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canView, statusFilter, translateApiError]);

  // Fetch single detail
  const fetchRecallDetail = useCallback(
    async (recallId: number) => {
      setDetailLoading(true);
      setErrorMessage(null);
      try {
        const detail = await getRecall(recallId);
        setSelectedRecall(detail);
        setSelectedRecallId(recallId);
      } catch (err: any) {
        setErrorMessage(translateApiError(err));
      } finally {
        setDetailLoading(false);
      }
    },
    [translateApiError]
  );

  // Initial load
  useEffect(() => {
    fetchRecalls();
  }, [fetchRecalls]);

  // Realtime subscription
  useEffect(() => {
    const term = (window as any).terminal;
    if (!term || typeof term.subscribe !== "function") return;

    const unsubscribe = term.subscribe(
      "pharmacy.recall.updated",
      (event: { recall_id?: number }) => {
        fetchRecalls();
        if (selectedRecallId && event.recall_id === selectedRecallId) {
          fetchRecallDetail(selectedRecallId);
        }
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [fetchRecalls, fetchRecallDetail, selectedRecallId]);

  // Drug stock inspection for opening a recall
  const handleLookupDrugStock = async () => {
    const idNum = parseInt(drugLookupId.trim(), 10);
    if (isNaN(idNum) || idNum <= 0) {
      setErrorMessage("Please enter a valid numeric Drug ID to inspect active stock.");
      return;
    }
    setLookupLoading(true);
    setErrorMessage(null);
    try {
      const detail = await stockStatus(idNum);
      setDrugStockDetail(detail);
      setOpenRecallForm((prev) => ({
        ...prev,
        drug_id: detail.drug_id,
        batch_ids: [],
      }));
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleToggleBatchSelection = (batchId: number) => {
    setOpenRecallForm((prev) => {
      const current = prev.batch_ids || [];
      if (current.includes(batchId)) {
        return { ...prev, batch_ids: current.filter((id) => id !== batchId) };
      } else {
        return { ...prev, batch_ids: [...current, batchId] };
      }
    });
  };

  const handleOpenRecallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const validation = validateOpenRecallInput(openRecallForm);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      setErrorMessage(firstError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const payload: RecallIn = {
        drug_id: openRecallForm.drug_id!,
        batch_ids: openRecallForm.all_batches ? null : openRecallForm.batch_ids,
        all_batches: openRecallForm.all_batches ?? false,
        source: openRecallForm.source as RecallSource,
        reference: openRecallForm.reference?.trim() || null,
        recall_class: openRecallForm.recall_class as RecallClass,
        reason: openRecallForm.reason!.trim(),
        contact_patients: openRecallForm.contact_patients ?? true,
      };

      const result = await openRecall(payload);
      setSuccessMessage(
        `Recall campaign opened successfully! Reference: ${result.recall_number}. Quarantined ${result.stock_left} units.`
      );
      setIsOpeningRecall(false);
      setDrugStockDetail(null);
      setDrugLookupId("");
      await fetchRecalls();
      setSelectedRecall(result);
      setSelectedRecallId(result.recall_id);
      setActiveTab("recall_detail");
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Stock removal
  const handleRemoveStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecallId || !canManage) return;

    const validation = validateRemoveStockInput({ note: removeStockNote });
    if (!validation.valid) {
      setErrorMessage(validation.errors.note);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const updated = await removeRecalledStock(selectedRecallId, { note: removeStockNote.trim() });
      setSelectedRecall(updated);
      setIsRemovingStock(false);
      setRemoveStockNote("");
      setSuccessMessage("Quarantined stock successfully removed / written off.");
      await fetchRecalls();
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Patient contact
  const handleRecordContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecallId || !selectedPatientContact || !canManage) return;

    const validation = validateRecordContactInput({
      outcome: patientContactOutcome,
      note: patientContactNote,
    });
    if (!validation.valid) {
      setErrorMessage(validation.errors.note || validation.errors.outcome);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const updated = await recordContact(
        selectedRecallId,
        selectedPatientContact.recall_patient_id,
        {
          outcome: patientContactOutcome,
          note: patientContactNote.trim(),
        }
      );
      setSelectedRecall(updated);
      setSelectedPatientContact(null);
      setPatientContactNote("");
      setSuccessMessage("Patient contact audit outcome recorded successfully.");
      await fetchRecalls();
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Close recall
  const handleCloseRecallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecall || !canManage) return;

    const validation = validateCloseRecallInput(selectedRecall, { note: closingNote });
    if (!validation.valid) {
      setErrorMessage(
        validation.errors.stock_left ||
          validation.errors.patients_to_contact ||
          validation.errors.note
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const updated = await closeRecall(selectedRecall.recall_id, { note: closingNote.trim() });
      setSelectedRecall(updated);
      setIsClosingRecall(false);
      setClosingNote("");
      setSuccessMessage(`Recall ${updated.recall_number} has been closed.`);
      await fetchRecalls();
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Cancel recall
  const handleCancelRecallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecall || !canManage) return;

    const validation = validateCancelRecallInput(selectedRecall, { reason: cancelReason });
    if (!validation.valid) {
      setErrorMessage(validation.errors.reason || validation.errors.status);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const updated = await cancelRecall(selectedRecall.recall_id, { reason: cancelReason.trim() });
      setSelectedRecall(updated);
      setIsCancellingRecall(false);
      setCancelReason("");
      setSuccessMessage(`Recall ${updated.recall_number} has been cancelled; batches released.`);
      await fetchRecalls();
    } catch (err: any) {
      setErrorMessage(translateApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Capability banner
  if (capabilityView === "hidden") {
    return (
      <div
        className="p-6 text-center text-gray-500"
      >
        <p className="font-semibold text-lg">Dispensing service is hidden</p>
        <p className="text-sm">Batch recalls are not available for this facility profile.</p>
      </div>
    );
  }

  const isRecordsOnly = capabilityView === "records";
  const isOpenWorkOnly = capabilityView === "open_work";

  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6"
      data-screen="drug_recalls"
    >
      {/* Capability View Notices */}
      {isOpenWorkOnly && (
        <div
          className="bg-amber-500/10 border border-amber-500 text-amber-900 dark:text-amber-200 px-4 py-3 rounded-lg flex items-center justify-between"
        >
          <div>
            <p className="font-semibold text-sm">
              Service Dispensing is Retiring: No new recalls from now on
            </p>
            <p className="text-xs">
              اب سے کوئی نئی دوا واپس نہیں بلائی جائے گی۔ صرف موجودہ اوپن مہمات مکمل یا درست کی جا سکتی ہیں۔
            </p>
          </div>
        </div>
      )}

      {isRecordsOnly && (
        <div
          className="bg-blue-500/10 border border-blue-500 text-blue-900 dark:text-blue-200 px-4 py-3 rounded-lg flex items-center justify-between"
        >
          <div>
            <p className="font-semibold text-sm">Records Only Mode (صرف ریکارڈز)</p>
            <p className="text-xs">Historical drug recall campaign audit ledger and patient contact logs.</p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            Batch Recalls & Quarantine Management
          </h1>
          <p
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            ادویات کی تنسیخ، قرنطینہ مہم اور متاثرہ مریضوں سے ہنگامی رابطہ (MSDS MOM 59)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManage && !isRecordsOnly && !isOpenWorkOnly && (
            <button
              type="button"
              onClick={() => setIsOpeningRecall(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-md shadow-sm transition flex items-center gap-2"
              data-help="drug_recalls.open_recall_btn"
            >
              <span>+ Open Recall Campaign</span>
              <span className="text-xs opacity-80">(نئی واپسی مہم)</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchRecalls}
            disabled={loading}
            className="border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm transition"
            data-help="drug_recalls.refresh_btn"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div
          className="bg-red-500/10 border border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md text-sm flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="font-bold ml-4"
            data-help="drug_recalls.dismiss_error_btn"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="bg-emerald-500/10 border border-emerald-500 text-emerald-700 dark:text-emerald-300 p-4 rounded-md text-sm flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="font-bold ml-4"
            data-help="drug_recalls.dismiss_success_btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab("recalls_list")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
            activeTab === "recalls_list"
              ? "border-red-600 text-red-600 dark:text-red-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="drug_recalls.tab_list_btn"
        >
          Recalls Register ({recalls.length})
        </button>
        {selectedRecall && (
          <button
            type="button"
            onClick={() => setActiveTab("recall_detail")}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition ${
              activeTab === "recall_detail"
                ? "border-red-600 text-red-600 dark:text-red-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            data-help="drug_recalls.tab_detail_btn"
          >
            Campaign Details: {selectedRecall.recall_number}
          </button>
        )}
      </div>

      {/* TAB 1: RECALLS LIST */}
      {activeTab === "recalls_list" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter Status:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("All")}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  statusFilter === "All"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100"
                }`}
                data-help="drug_recalls.filter_all_btn"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("Open")}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  statusFilter === "Open"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100"
                }`}
                data-help="drug_recalls.filter_open_btn"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("Closed")}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  statusFilter === "Closed"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100"
                }`}
                data-help="drug_recalls.filter_closed_btn"
              >
                Closed
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("Cancelled")}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  statusFilter === "Cancelled"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100"
                }`}
                data-help="drug_recalls.filter_cancelled_btn"
              >
                Cancelled
              </button>
            </div>
          </div>

          {/* Table */}
          {recalls.length === 0 ? (
            <div
              className="p-8 text-center border-2 border-dashed rounded-lg text-gray-500"
            >
              <p className="font-medium">No drug recall campaigns found.</p>
              <p className="text-sm mt-1">
                Use the &quot;Open Recall Campaign&quot; button above when a DRAP alert or defect notice is received.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table
                className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm"
              >
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Recall #</th>
                    <th className="px-4 py-3 font-semibold">Medicine / Code</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Source & Ref</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Stock Left</th>
                    <th className="px-4 py-3 font-semibold text-center">To Contact</th>
                    <th className="px-4 py-3 font-semibold">Opened</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {recalls.map((r) => {
                    const isSelected = selectedRecallId === r.recall_id;
                    return (
                      <tr
                        key={r.recall_id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${
                          isSelected ? "bg-red-50/50 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                          {r.recall_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {r.drug_name}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{r.drug_code}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.recall_class === "ClassI"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300"
                                : r.recall_class === "ClassII"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300"
                            }`}
                          >
                            {r.recall_class}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-medium text-gray-900 dark:text-white">{r.source}</div>
                          {r.reference && (
                            <div className="text-gray-500 truncate max-w-xs">{r.reference}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.status === "Open"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : r.status === "Closed"
                                ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${
                              r.stock_left > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"
                            }`}
                          >
                            {r.stock_left}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${
                              r.patients_to_contact > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-gray-500"
                            }`}
                          >
                            {r.patients_to_contact}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <div>{new Date(r.opened_at).toLocaleDateString()}</div>
                          <div>{r.opened_by_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              fetchRecallDetail(r.recall_id);
                              setActiveTab("recall_detail");
                            }}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 font-medium text-xs border border-red-200 dark:border-red-900/50 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            data-help="drug_recalls.view_detail_btn"
                          >
                            View & Manage →
                          </button>
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

      {/* TAB 2: RECALL DETAIL & WORKLISTS */}
      {activeTab === "recall_detail" && selectedRecall && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2
                    className="text-xl font-bold font-mono text-gray-900 dark:text-white"
                  >
                    {selectedRecall.recall_number}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedRecall.status === "Open"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : selectedRecall.status === "Closed"
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                    }`}
                  >
                    {selectedRecall.status}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedRecall.recall_class === "ClassI"
                        ? "bg-red-100 text-red-800 border border-red-300"
                        : selectedRecall.recall_class === "ClassII"
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-blue-100 text-blue-800 border border-blue-300"
                    }`}
                  >
                    {selectedRecall.recall_class}
                  </span>
                </div>
                <div className="text-base font-semibold text-gray-900 dark:text-white mt-1">
                  {selectedRecall.drug_name}
                  <span className="text-xs font-mono text-gray-500 ml-2">
                    ({selectedRecall.drug_code})
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Source: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedRecall.source}</span>
                  {selectedRecall.reference && (
                    <> | Reference: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedRecall.reference}</span></>
                  )}
                  {" | "}Opened at: {new Date(selectedRecall.opened_at).toLocaleString()} by {selectedRecall.opened_by_name}
                </div>
              </div>

              {/* Status & Closure Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {canManage && selectedRecall.status === "Open" && !isRecordsOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRemovingStock(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-sm transition"
                      data-help="drug_recalls.remove_stock_btn"
                    >
                      Remove Stock (اسٹاک خارج کریں)
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsClosingRecall(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-sm transition"
                      data-help="drug_recalls.close_recall_btn"
                    >
                      Close Recall (مہم بند کریں)
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCancellingRecall(true)}
                      className="border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-medium px-3 py-1.5 rounded transition"
                      data-help="drug_recalls.cancel_recall_btn"
                    >
                      Cancel (غلطی سے منسوخ)
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Reason Card */}
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 rounded text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-red-800 dark:text-red-300">Recall Reason / Defect: </span>
              {selectedRecall.reason}
            </div>

            {/* Metrics summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/40">
                <div className="text-xs text-gray-500">Quarantined Stock Left</div>
                <div className={`text-xl font-bold ${selectedRecall.stock_left > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {selectedRecall.stock_left} units
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/40">
                <div className="text-xs text-gray-500">Patients To Contact</div>
                <div className={`text-xl font-bold ${selectedRecall.patients_to_contact > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selectedRecall.patients_to_contact} remaining
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/40">
                <div className="text-xs text-gray-500">Stock Removed Audit</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {selectedRecall.stock_removed_at
                    ? new Date(selectedRecall.stock_removed_at).toLocaleDateString()
                    : "Pending"}
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/40">
                <div className="text-xs text-gray-500">Ready To Close?</div>
                <div className={`text-sm font-bold ${selectedRecall.can_close ? "text-emerald-600" : "text-gray-500"}`}>
                  {selectedRecall.can_close ? "✓ Yes (Ready)" : "No (Stock/Contacts Left)"}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Batches Under Recall */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b font-semibold text-gray-900 dark:text-white flex justify-between items-center">
              <span>Recalled Batches Audit ({selectedRecall.batches.length})</span>
              <span className="text-xs font-normal text-gray-500">
                متاثرہ بیجز کی تفاصیل اور تقسیم کاری
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Batch No</th>
                    <th className="px-3 py-2 text-left">Expiry</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right font-bold text-red-600">Left Pharmacy</th>
                    <th className="px-3 py-2 text-right font-bold text-amber-600">Left Wards</th>
                    <th className="px-3 py-2 text-right">Dispensed</th>
                    <th className="px-3 py-2 text-right">Administered</th>
                    <th className="px-3 py-2 text-right">Theatre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {selectedRecall.batches.map((b) => (
                    <tr key={b.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">
                        {b.batch_no}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{b.expiry_date}</td>
                      <td className="px-3 py-2 text-right">{b.qty_received}</td>
                      <td className="px-3 py-2 text-right font-bold text-red-600">
                        {b.pharmacy_qty}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-amber-600">
                        {b.ward_qty}
                      </td>
                      <td className="px-3 py-2 text-right">{b.dispensed_qty}</td>
                      <td className="px-3 py-2 text-right">{b.administered_qty}</td>
                      <td className="px-3 py-2 text-right">{b.theatre_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Ward Stock Breakdown */}
          {selectedRecall.ward_stock && selectedRecall.ward_stock.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-amber-50 dark:bg-amber-950/20 px-4 py-3 border-b font-semibold text-amber-900 dark:text-amber-200 flex justify-between items-center">
                <span>Wards Holding Recalled Stock ({selectedRecall.ward_stock.length})</span>
                <span className="text-xs font-normal text-amber-700">
                  وارڈز کے پاس موجود بقایا بیجز (فوراً واپس منگوائیں)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Ward Name</th>
                      <th className="px-3 py-2 text-left">Batch No</th>
                      <th className="px-3 py-2 text-right font-bold text-red-600">Quantity In Ward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {selectedRecall.ward_stock.map((ws, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {ws.ward_name}
                        </td>
                        <td className="px-3 py-2 font-mono">{ws.batch_no}</td>
                        <td className="px-3 py-2 text-right font-bold text-red-600">{ws.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Patients To Contact */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b font-semibold text-gray-900 dark:text-white flex justify-between items-center">
              <span>Patients Contact Roster ({selectedRecall.patients.length})</span>
              <span className="text-xs font-normal text-gray-500">
                متاثرہ بیج حاصل کرنے والے مریض اور ان سے ٹیلی فونک رابطہ لاگ
              </span>
            </div>
            {selectedRecall.patients.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                No patients received units from these batches, or contact_patients was not enabled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Patient / Recipient</th>
                      <th className="px-3 py-2 text-left">MRN / Contact</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Source Encounter</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Clinical Audit Note</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {selectedRecall.patients.map((p) => (
                      <tr key={p.recall_patient_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {p.patient_name || p.walkin_name || "Unknown Patient"}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <div>{p.mrn || "No MRN"}</div>
                          <div className="text-gray-500">{p.mobile || p.walkin_mobile || "No Mobile"}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{p.quantity}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {p.sources && p.sources.length > 0 ? (
                            <div>
                              {p.sources.map((s, idx) => (
                                <span key={idx} className="block text-[11px]">
                                  {s.kind} #{s.id} ({s.qty} units on {new Date(s.at).toLocaleDateString()})
                                </span>
                              ))}
                            </div>
                          ) : (
                            "Direct dispensation"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              p.outcome === "ToContact"
                                ? "bg-amber-100 text-amber-800"
                                : p.outcome === "Contacted"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.outcome === "Unreachable"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {p.outcome}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                          {p.note || "No audit note entered"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canManage && selectedRecall.status === "Open" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPatientContact(p);
                                setPatientContactOutcome(
                                  p.outcome === "Unreachable" ? "Unreachable" : p.outcome === "NotNeeded" ? "NotNeeded" : "Contacted"
                                );
                                setPatientContactNote(p.note || "");
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition"
                              data-help="drug_recalls.record_contact_btn"
                            >
                              Record Contact →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: OPEN RECALL CAMPAIGN */}
      {isOpeningRecall && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Open Batch Recall Campaign
                </h3>
                <p className="text-xs text-gray-500">
                  دوا کی فوری تنسیخ، قرنطینہ مہم اور وارڈز کو ہنگامی الرٹ (Rule rule:fe2af7a43c)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpeningRecall(false);
                  setDrugStockDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg"
                data-help="drug_recalls.close_open_modal_btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenRecallSubmit} className="space-y-4">
              {/* Step 1: Drug ID lookup */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Drug ID (Formulary Medicine) *
                </label>
                <div className="flex gap-2">
                  <DirectoryPicker
                    value={drugLookupId}
                    onChange={(e) => setDrugLookupId(e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm dark:bg-gray-800"
                    data-help="drug_recalls.lookup_drug_id_input"
                   path="/drugs/search" idField="drug_id" search />
                  <button
                    type="button"
                    onClick={handleLookupDrugStock}
                    disabled={lookupLoading}
                    className="bg-gray-700 hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded transition"
                    data-help="drug_recalls.inspect_stock_btn"
                  >
                    {lookupLoading ? "Inspecting..." : "Inspect Stock"}
                  </button>
                </div>

                {drugStockDetail && (
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded border text-xs space-y-1">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {drugStockDetail.name}{" "}
                      <span className="font-mono text-gray-500">({drugStockDetail.code})</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-300">
                      Form: {drugStockDetail.form} | Available Stock: {drugStockDetail.qty_available} {drugStockDetail.unit}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Batch Selection */}
              {drugStockDetail && (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Recalled Batches *
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-red-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={openRecallForm.all_batches || false}
                        onChange={(e) =>
                          setOpenRecallForm((prev) => ({
                            ...prev,
                            all_batches: e.target.checked,
                            batch_ids: e.target.checked ? [] : prev.batch_ids,
                          }))
                        }
                        data-help="drug_recalls.all_batches_checkbox"
                      />
                      Recall All Batches (تمام بیجز)
                    </label>
                  </div>

                  {!openRecallForm.all_batches && (
                    <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                      {drugStockDetail.batches.length === 0 ? (
                        <p className="text-xs text-gray-500">No active batches in stock for this medicine.</p>
                      ) : (
                        drugStockDetail.batches.map((b) => (
                          <label
                            key={b.batch_id}
                            className="flex items-center justify-between p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={(openRecallForm.batch_ids || []).includes(b.batch_id)}
                                onChange={() => handleToggleBatchSelection(b.batch_id)}
                                data-help="drug_recalls.batch_select_checkbox"
                              />
                              <span className="font-mono font-bold">{b.batch_no}</span>
                              <span className="text-gray-500">(Exp: {b.expiry_date})</span>
                            </div>
                            <span className="text-gray-600 dark:text-gray-300">
                              Qty: {b.qty_available}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Source & Class */}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Alert Source *
                  </label>
                  <select
                    value={openRecallForm.source || "DRAP"}
                    onChange={(e) =>
                      setOpenRecallForm((prev) => ({ ...prev, source: e.target.value as RecallSource }))
                    }
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs dark:bg-gray-800"
                    data-help="drug_recalls.source_select"
                  >
                    {RECALL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s} - {RECALL_SOURCE_LABELS[s].en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Statutory Recall Class *
                  </label>
                  <select
                    value={openRecallForm.recall_class || "ClassI"}
                    onChange={(e) =>
                      setOpenRecallForm((prev) => ({ ...prev, recall_class: e.target.value as RecallClass }))
                    }
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs dark:bg-gray-800"
                    data-help="drug_recalls.class_select"
                  >
                    {RECALL_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c} - {RECALL_CLASS_LABELS[c].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Alert Reference / Letter No
                </label>
                <input
                  type="text"
                  placeholder="e.g. DRAP-AL-2026-887 or Manufacturer Ref"
                  value={openRecallForm.reference || ""}
                  onChange={(e) => setOpenRecallForm((prev) => ({ ...prev, reference: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.reference_input"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Defect Description & Recall Reason *
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain why this batch is being quarantined and recalled..."
                  value={openRecallForm.reason || ""}
                  onChange={(e) => setOpenRecallForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.reason_input"
                />
              </div>

              {/* Contact Patients Checkbox */}
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openRecallForm.contact_patients ?? true}
                    onChange={(e) =>
                      setOpenRecallForm((prev) => ({ ...prev, contact_patients: e.target.checked }))
                    }
                    data-help="drug_recalls.contact_patients_checkbox"
                  />
                  <span>
                    Contact all patients who received this batch (مریضوں سے رابطہ لاگ مرتب کریں)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpeningRecall(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="drug_recalls.cancel_open_modal_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !openRecallForm.drug_id}
                  className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow transition"
                  data-help="drug_recalls.submit_open_modal_btn"
                >
                  {loading ? "Opening..." : "Confirm & Open Recall"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REMOVE STOCK */}
      {isRemovingStock && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Remove Quarantined Stock (اسٹاک تلف یا واپس کریں)
            </h3>
            <p className="text-xs text-gray-500">
              Rule rule:6e16f97bd1: Writes off every remaining unit across pharmacy and hospital wards.
            </p>

            <form onSubmit={handleRemoveStockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Disposal / Return Note *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Returned to supplier for credit, or incinerated as per hospital hazardous waste protocol..."
                  value={removeStockNote}
                  onChange={(e) => setRemoveStockNote(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.remove_stock_note_input"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsRemovingStock(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="drug_recalls.dismiss_remove_stock_modal_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded shadow transition"
                  data-help="drug_recalls.submit_remove_stock_btn"
                >
                  {loading ? "Processing..." : "Write Off & Remove"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PATIENT CONTACT */}
      {selectedPatientContact && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Record Patient Contact Audit
            </h3>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Recipient: <span className="font-bold">{selectedPatientContact.patient_name || selectedPatientContact.walkin_name}</span> | Phone: {selectedPatientContact.mobile || selectedPatientContact.walkin_mobile || "N/A"}
            </div>

            <form onSubmit={handleRecordContactSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Outcome *
                </label>
                <select
                  value={patientContactOutcome}
                  onChange={(e) => setPatientContactOutcome(e.target.value as "Contacted" | "Unreachable" | "NotNeeded")}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.contact_outcome_select"
                >
                  {(["Contacted", "Unreachable", "NotNeeded"] as const).map((o) => (
                    <option key={o} value={o}>
                      {o} - {PATIENT_CONTACT_OUTCOME_LABELS[o].en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Discussion / Clinical Note *
                </label>
                <textarea
                  rows={3}
                  placeholder="Details of conversation with patient or reason unreachable..."
                  value={patientContactNote}
                  onChange={(e) => setPatientContactNote(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.contact_note_input"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPatientContact(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="drug_recalls.dismiss_contact_modal_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition"
                  data-help="drug_recalls.submit_contact_btn"
                >
                  {loading ? "Saving..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE RECALL */}
      {isClosingRecall && selectedRecall && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Close Drug Recall Campaign
            </h3>
            <p className="text-xs text-gray-500">
              Rule rule:2b020bd53b: Confirms that all recalled batches were quarantined/removed and contacts completed.
            </p>

            {!selectedRecall.can_close && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs p-3 rounded">
                Notice: The server indicates some stock or patient contacts may still be pending. If submitted,
                it may return RECALL_NOT_COMPLETE.
              </div>
            )}

            <form onSubmit={handleCloseRecallSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Closing Audit Note *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. All stock removed and 100% of affected patients contacted or accounted for..."
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.closing_note_input"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsClosingRecall(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="drug_recalls.dismiss_close_modal_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded shadow transition"
                  data-help="drug_recalls.submit_close_btn"
                >
                  {loading ? "Closing..." : "Confirm Closure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL RECALL */}
      {isCancellingRecall && selectedRecall && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Cancel Recall Campaign (Opened by Mistake)
            </h3>
            <p className="text-xs text-gray-500">
              Rule rule:2b020bd53b: Cancels the recall and releases the quarantined batches everywhere.
            </p>

            <form onSubmit={handleCancelRecallSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this recall was opened by mistake..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-xs dark:bg-gray-800"
                  data-help="drug_recalls.cancel_reason_input"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsCancellingRecall(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 border rounded"
                  data-help="drug_recalls.dismiss_cancel_modal_btn"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium rounded shadow transition"
                  data-help="drug_recalls.submit_cancel_btn"
                >
                  {loading ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrugRecalls;
