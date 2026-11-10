import { LoadState, useLoad } from "../components";
import { bilingual as t } from "../i18n";
import {canReadDirectory} from "../DirectoryPicker";
import {DirectoryPicker} from "../DirectoryPicker";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  listWo,
  getWo,
  assignOpsWorkOrders,
  startOpsWorkOrders,
  completeOpsWorkOrders,
  cancelOpsWorkOrders,
  assets as fetchAssetsList,
  createAsset,
  updateAsset,
  categories as fetchCategoriesList,
  utilityLogs as fetchUtilityLogsList,
  logUtility,
  feed as fetchFacilityFeed,
  lookupStaff,
  markCleaned,
  bedMatrix,
  clearStage,
  type WorkOrderListItemOut,
  type WorkOrderOut,
  type AssetOut,
  type UtilityCategoryOut,
  type UtilityLogListItemOut,
  type FacilityScanOut,
  type StaffLookupOut,
} from "../generated/ops_console";
import {
  getOpsConsoleCapabilityView,
  canClearOpsDischargeStage,
  evaluatePayableRouting,
  validateAssignForm,
  validateCompleteForm,
  validateCancelForm,
  validateAssetForm,
  validateUtilityForm,
  formatWorkOrderStatusBadge,
  formatWorkOrderPriorityBadge,
  formatPayableStatusBadge,
  OPS_CONSOLE_ERROR_MESSAGES,
  type SessionInfo,
  type Establishment,
} from "../ops-console-policy";

export interface OpsConsoleProps {
  token?: string;
  lang?: "en" | "ur";
  establishment?: any;
  user?: {
    user_id?: number;
    employee_id?: number | null;
    username?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
  };
  userPermissions?: string[];
  currentUserRole?: string;
  currentEmployeeId?: number | null;
  connected?: boolean;
  session?: SessionInfo | null;
  onNavigateHome?: () => void;
}

export const OpsConsole: React.FC<OpsConsoleProps> = ({
  user,
  userPermissions,
  currentUserRole,
  establishment,
  session,
  onNavigateHome,
}) => {
  const sessionInfo: SessionInfo | null = useMemo(() => {
    if (session) return session;
    if (user) {
      return {
        user_id: user.user_id,
        employee_id: user.employee_id,
        username: user.username || "",
        roles: user.roles || [],
        permissions: user.permissions ?? userPermissions ?? [],
      } as SessionInfo;
    }
    return null;
  }, [session, user, userPermissions, currentUserRole]);

  const capability = useMemo(
    () => getOpsConsoleCapabilityView(sessionInfo, establishment),
    [sessionInfo, establishment]
  );

  // Active Pane Tab: 1 = Work Orders, 2 = Assets & Utilities, 3 = Live Feed & Staff Lookup
  const [activePane, setActivePane] = useState<1 | 2 | 3>(1);

  // Data States
  const [workOrders, setWorkOrders] = useState<WorkOrderListItemOut[]>([]);
  const [selectedWo, setSelectedWo] = useState<WorkOrderOut | null>(null);
  const [assetsList, setAssetsList] = useState<AssetOut[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetOut | null>(null);
  const [utilityCats, setUtilityCats] = useState<UtilityCategoryOut[]>([]);
  const [utilityLogsList, setUtilityLogsList] = useState<UtilityLogListItemOut[]>([]);
  const [facilityScans, setFacilityScans] = useState<FacilityScanOut[]>([]);
  const [staffResults, setStaffResults] = useState<StaffLookupOut[]>([]);

  // Loading & Feedback
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [woStatusFilter, setWoStatusFilter] = useState<string>("All");
  const [woPriorityFilter, setWoPriorityFilter] = useState<string>("All");
  const [woSearch, setWoSearch] = useState<string>("");
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");

  // Modals
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignWoId, setAssignWoId] = useState<number | null>(null);
  const [assignType, setAssignType] = useState<"employee" | "vendor">("employee");
  const [assignEmpId, setAssignEmpId] = useState<string>("");
  const [assignVendorId, setAssignVendorId] = useState<string>("");
  const [assignCost, setAssignCost] = useState<string>("");
  const [assignNote, setAssignNote] = useState<string>("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const [showStartModal, setShowStartModal] = useState<boolean>(false);
  const [startWoId, setStartWoId] = useState<number | null>(null);
  const [startNote, setStartNote] = useState<string>("");

  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [completeWoId, setCompleteWoId] = useState<number | null>(null);
  const [completeCost, setCompleteCost] = useState<string>("");
  const [completeNote, setCompleteNote] = useState<string>("");
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelWoId, setCancelWoId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [assetTag, setAssetTag] = useState<string>("");
  const [assetName, setAssetName] = useState<string>("");
  const [assetCategory, setAssetCategory] = useState<string>("");
  const [assetLocation, setAssetLocation] = useState<string>("");
  const [assetSerial, setAssetSerial] = useState<string>("");
  const [assetCost, setAssetCost] = useState<string>("");
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});

  const [showUtilityModal, setShowUtilityModal] = useState<boolean>(false);
  const [utilCategoryId, setUtilCategoryId] = useState<string>("");
  const [utilVendorId, setUtilVendorId] = useState<string>("");
  const [utilPeriod, setUtilPeriod] = useState<string>("");
  const [utilCost, setUtilCost] = useState<string>("");
  const [utilQty, setUtilQty] = useState<string>("");
  const [utilRef, setUtilRef] = useState<string>("");
  const [utilErrors, setUtilErrors] = useState<Record<string, string>>({});

  const [showCleanBedModal, setShowCleanBedModal] = useState<boolean>(false);
  const [cleanBedId, setCleanBedId] = useState<string>("");
  const [cleanEmpId, setCleanEmpId] = useState<string>("");

  const [showClearDischargeModal, setShowClearDischargeModal] = useState<boolean>(false);
  const [dischargeAdmissionId, setDischargeAdmissionId] = useState<string>("");
  const [dischargeStage, setDischargeStage] = useState<"BillingSettlement" | "NursingMARVerification" | "OpsCleaning" | "PharmacyClearance">("OpsCleaning");
  const [dischargeNote, setDischargeNote] = useState<string>("");
  const matrix = useLoad(() => showCleanBedModal || showClearDischargeModal ? bedMatrix({include_beds:true}) : Promise.resolve(null), [showCleanBedModal, showClearDischargeModal]);
  const matrixBeds = matrix.loading || matrix.error ? [] : matrix.data?.beds ?? [];
  const cleaningBeds = matrixBeds.filter(bed => bed.current_state === "Cleaning" || bed.current_state === "Dirty");
  const dischargeBeds = matrixBeds.filter(bed => bed.admission_id !== null && bed.admission_status === "DischargeInProgress");
  const bedLabel = (wardId: number, bed: string) => [matrix.data?.wards.find(ward => ward.ward_id === wardId)?.name, bed].filter(Boolean).join(" · ");


  useEffect(() => {
    if (!capability.canClearDischarge || !canClearOpsDischargeStage(sessionInfo, dischargeStage)) {
      const allowed = (["OpsCleaning", "PharmacyClearance", "NursingMARVerification", "BillingSettlement"] as const)
        .find(stage => canClearOpsDischargeStage(sessionInfo, stage));
      if (allowed) setDischargeStage(allowed);
    }
  }, [sessionInfo, dischargeStage]);

  // Load Work Orders
  const loadWorkOrders = useCallback(async () => {
    if (capability.mode === "hidden") return;
    if (!sessionInfo?.permissions?.some(p => ["ops.workorder.report", "ops.workorder.manage"].includes(p))) { setWorkOrders([]); return; }
    try {
      const q: any = {};
      if (woStatusFilter !== "All") q.status = woStatusFilter;
      if (woPriorityFilter !== "All") q.priority = woPriorityFilter;
      const data = await listWo(q);
      setWorkOrders(data || []);
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to load work orders";
      setError(msg);
    }
  }, [capability.mode, sessionInfo, woStatusFilter, woPriorityFilter]);

  // Load Assets & Utilities
  const loadAssetsAndUtilities = useCallback(async () => {
    if (capability.mode === "hidden") return;
    try {
      const [assetsData, catsData, logsData] = await Promise.all([
        canReadDirectory("/ops/assets",sessionInfo?.permissions??[]) ? fetchAssetsList() : Promise.resolve([]),
        capability.canRecordUtilities || capability.canViewFeed ? fetchCategoriesList() : Promise.resolve([]),
        capability.canRecordUtilities || capability.canViewFeed ? fetchUtilityLogsList() : Promise.resolve([]),
      ]);
      setAssetsList(assetsData || []);
      setUtilityCats(catsData || []);
      setUtilityLogsList(logsData || []);
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to load assets & utilities";
      setError(msg);
    }
  }, [capability.mode, capability.canRecordUtilities, capability.canViewFeed, sessionInfo]);

  // Load Live Feed
  const loadFeed = useCallback(async () => {
    if (!capability.canViewFeed) { setFacilityScans([]); return; }
    try {
      const scans = await fetchFacilityFeed({ limit: 50 });
      setFacilityScans(scans || []);
    } catch (err: any) {
      setError(err?.message || "Facility feed could not be loaded. Refresh to retry.");
    }
  }, [capability.canViewFeed]);

  // Initial Load
  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadWorkOrders(), loadAssetsAndUtilities(), loadFeed()]);
    setLoading(false);
  }, [loadWorkOrders, loadAssetsAndUtilities, loadFeed]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Drilldown Work Order
  const handleSelectWo = async (woId: number) => {
    try {
      const full = await getWo(woId);
      setSelectedWo(full);
    } catch (err: any) {
      setError(err?.message || "Failed to load work order detail");
    }
  };

  // Assign Work Order
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignWoId) return;
    const empId = assignType === "employee" ? Number(assignEmpId) : null;
    const venId = assignType === "vendor" ? Number(assignVendorId) : null;
    const validation = validateAssignForm(empId, venId, assignCost);
    if (!validation.valid) {
      setAssignError(validation.error || "Invalid assignment");
      return;
    }
    setSubmitting(true);
    setAssignError(null);
    try {
      const updated = await assignOpsWorkOrders(assignWoId, {
        employee_id: empId,
        vendor_id: venId,
        estimated_cost: assignCost ? Number(assignCost) : null,
        note: assignNote || null,
      });
      setShowAssignModal(false);
      setSuccessMessage(`Work order ${updated.wo_number} successfully assigned.`);
      setSelectedWo(updated);
      await loadWorkOrders();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to assign work order";
      setAssignError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Start Work Order
  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startWoId) return;
    setSubmitting(true);
    try {
      const updated = await startOpsWorkOrders(startWoId, { note: startNote || null });
      setShowStartModal(false);
      setSuccessMessage(`Work order ${updated.wo_number} marked as In Progress.`);
      setSelectedWo(updated);
      await loadWorkOrders();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to start work order";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Complete Work Order (Rule a7fc19b5fc)
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeWoId) return;
    const validation = validateCompleteForm(completeCost);
    if (!validation.valid) {
      setCompleteError(validation.error || "Invalid cost");
      return;
    }
    setSubmitting(true);
    setCompleteError(null);
    try {
      const updated = await completeOpsWorkOrders(completeWoId, {
        final_cost: completeCost ? Number(completeCost) : null,
        note: completeNote || null,
      });
      setShowCompleteModal(false);
      const routing = evaluatePayableRouting(updated.assigned_vendor_id, updated.final_cost);
      setSuccessMessage(
        `Work order ${updated.wo_number} marked Complete. ${routing.routesToAp ? "Contractor payment request routed to AP." : ""}`
      );
      setSelectedWo(updated);
      await loadWorkOrders();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to complete work order";
      setCompleteError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Work Order
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelWoId) return;
    const validation = validateCancelForm(cancelReason);
    if (!validation.valid) {
      setCancelError(validation.error || "Invalid reason");
      return;
    }
    setSubmitting(true);
    setCancelError(null);
    try {
      const updated = await cancelOpsWorkOrders(cancelWoId, { reason: cancelReason.trim() });
      setShowCancelModal(false);
      setSuccessMessage(`Work order ${updated.wo_number} was cancelled.`);
      setSelectedWo(updated);
      await loadWorkOrders();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to cancel work order";
      setCancelError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Register / Update Asset
  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAssetForm(assetTag, assetName, assetCategory);
    if (!validation.valid) {
      setAssetErrors(validation.errors);
      return;
    }
    setSubmitting(true);
    setAssetErrors({});
    try {
      if (editingAssetId) {
        const updated = await updateAsset(editingAssetId, {
          asset_tag: assetTag.trim(),
          name: assetName.trim(),
          category: assetCategory.trim(),
          location: assetLocation.trim() || null,
          serial_no: assetSerial.trim() || null,
          purchase_cost: assetCost ? Number(assetCost) : null,
        });
        setSuccessMessage(`Asset ${updated.asset_tag} (${updated.name}) updated.`);
      } else {
        const created = await createAsset({
          asset_tag: assetTag.trim(),
          name: assetName.trim(),
          category: assetCategory.trim(),
          location: assetLocation.trim() || null,
          serial_no: assetSerial.trim() || null,
          purchase_cost: assetCost ? Number(assetCost) : null,
        });
        setSuccessMessage(`Asset ${created.asset_tag} registered successfully.`);
      }
      setShowAssetModal(false);
      setEditingAssetId(null);
      await loadAssetsAndUtilities();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to save asset";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Log Utility Bill
  const handleUtilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const catId = Number(utilCategoryId);
    const venId = Number(utilVendorId);
    const validation = validateUtilityForm(catId, venId, utilPeriod, utilCost);
    if (!validation.valid) {
      setUtilErrors(validation.errors);
      return;
    }
    setSubmitting(true);
    setUtilErrors({});
    try {
      const res = await logUtility({
        category_id: catId,
        vendor_id: venId,
        billing_period: utilPeriod.trim(),
        cost: Number(utilCost),
        qty: utilQty ? Number(utilQty) : null,
        bill_reference: utilRef.trim() || null,
      });
      setShowUtilityModal(false);
      setSuccessMessage(`Utility log created (#${res.utility_log_id}) for Rs. ${Number(res.cost).toLocaleString()} -> AP request pending.`);
      await loadAssetsAndUtilities();
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to log utility bill";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Bed Cleaned
  const handleMarkCleanedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bedId = Number(cleanBedId);
    if (!cleaningBeds.some(bed => bed.bed_id === bedId)) return;
    setSubmitting(true);
    try {
      const res = await markCleaned(bedId, {
        cleaned_by_employee_id: cleanEmpId ? Number(cleanEmpId) : null,
      });
      setShowCleanBedModal(false);
      setCleanBedId("");
      setCleanEmpId("");
      setSuccessMessage(`Bed #${res.bed_id} marked Cleaned and available for new admissions.`);
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to mark bed cleaned";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Clear Discharge Stage
  const handleClearDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canClearOpsDischargeStage(sessionInfo, dischargeStage)) {
      setError("Your current permissions do not allow this clearance stage.");
      return;
    }
    const admId = Number(dischargeAdmissionId);
    if (!dischargeBeds.some(bed => bed.admission_id === admId)) return;
    setSubmitting(true);
    try {
      await clearStage(admId, dischargeStage, { note: dischargeNote || null });
      setShowClearDischargeModal(false);
      setDischargeAdmissionId("");
      setDischargeNote("");
      setSuccessMessage(`Discharge stage '${dischargeStage}' cleared for admission #${admId}.`);
    } catch (err: any) {
      const msg = OPS_CONSOLE_ERROR_MESSAGES[err?.code]?.en || err?.message || "Failed to clear discharge stage";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Staff Lookup Search
  const handleStaffSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffSearchQuery.trim()) return;
    try {
      const list = await lookupStaff({ q: staffSearchQuery.trim() });
      setStaffResults(list || []);
    } catch (err: any) {
      setError(err?.message || "Staff search failed");
    }
  };

  // Filtered Work Orders
  const filteredWo = useMemo(() => {
    return workOrders.filter((wo) => {
      if (woSearch.trim()) {
        const q = woSearch.toLowerCase();
        return (
          wo.wo_number.toLowerCase().includes(q) ||
          wo.description.toLowerCase().includes(q) ||
          (wo.location_text && wo.location_text.toLowerCase().includes(q)) ||
          wo.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workOrders, woSearch]);

  if (capability.mode === "hidden") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center" data-help="ops_console.view_forbidden">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-amber-900 mb-2">Access Restricted / رسائی محدود ہے</h2>
          <p className="text-amber-700 text-sm mb-4">
            {capability.reason || "You do not have permission to access facility operations console."}
          </p>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-sm"
              data-help="ops_console.btn_back_home"
            >
              Return to Home / ہوم پر واپس جائیں
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6" data-help="ops_console.screen_container">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight" data-help="ops_console.title_header">
              Facility Operations Console
            </h1>
            <span className="text-sm font-medium text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
              آپریشنز اور دیکھ بھال
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold uppercase">
              {capability.mode === "full" ? "Admin Mode" : "View-Only"}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1" data-help="ops_console.subtitle_text">
            Facility command center: work orders triage, asset tracking, utility overheads, discharge turnover & live badge scans.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {capability.canManageAssets && (
            <button
              onClick={() => {
                setEditingAssetId(null);
                setAssetTag("");
                setAssetName("");
                setAssetCategory("Biomedical");
                setAssetLocation("");
                setAssetSerial("");
                setAssetCost("");
                setShowAssetModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm"
              data-help="ops_console.btn_register_asset"
            >
              + Register Asset
            </button>
          )}

          {capability.canRecordUtilities && (
            <button
              onClick={() => {
                setUtilCategoryId(utilityCats[0]?.category_id ? String(utilityCats[0].category_id) : "");
                setUtilVendorId("1");
                setUtilPeriod(new Date().toISOString().slice(0, 7));
                setUtilCost("");
                setUtilQty("");
                setUtilRef("");
                setShowUtilityModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm"
              data-help="ops_console.btn_log_utility"
            >
              + Log Utility Bill
            </button>
          )}

          {capability.canMarkBedCleaned && (
            <button
              onClick={() => setShowCleanBedModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm"
              data-help="ops_console.btn_open_clean_bed"
            >
              ✓ Clean Bed
            </button>
          )}

          {capability.canClearDischarge && (
            <button
              onClick={() => setShowClearDischargeModal(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-sm"
              data-help="ops_console.btn_open_clear_discharge"
            >
              Clear Discharge
            </button>
          )}

          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-semibold shadow-sm"
            data-help="ops_console.btn_refresh"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-xs flex justify-between items-center" data-help="ops_console.banner_error">
          <div>
            <strong>Error: </strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 font-bold ml-4" data-help="ops_console.btn_dismiss_alert">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex justify-between items-center" data-help="ops_console.banner_success">
          <div>
            <strong>Success: </strong>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 font-bold ml-4" data-help="ops_console.btn_dismiss_alert">
            ✕
          </button>
        </div>
      )}

      {/* 3 PANES NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 mb-5 bg-white rounded-t-lg px-2 pt-2 shadow-xs">
        <button
          onClick={() => setActivePane(1)}
          className={`px-4 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activePane === 1
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          data-help="ops_console.tab_pane_work_orders"
        >
          <span>🛠</span> Pane 1: Work Orders & Triage ({workOrders.length})
        </button>

        <button
          onClick={() => setActivePane(2)}
          className={`px-4 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activePane === 2
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          data-help="ops_console.tab_pane_assets_utilities"
        >
          <span>🏢</span> Pane 2: Assets & Overhead Utilities
        </button>

        <button
          onClick={() => setActivePane(3)}
          className={`px-4 py-2 text-xs md:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activePane === 3
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          data-help="ops_console.tab_pane_live_feed"
        >
          <span>📡</span> Pane 3: Live Facility Feed & Staff Lookup
        </button>
      </div>

      {/* PANE 1: WORK ORDERS & MAINTENANCE QUEUE */}
      {activePane === 1 && (
        <div className="space-y-4" data-help="ops_console.pane_work_orders">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-500 font-semibold uppercase">Status:</span>
              {["All", "Reported", "Assigned", "InProgress", "Completed", "PendingPayment", "Paid"].map((st) => (
                <button
                  key={st}
                  onClick={() => setWoStatusFilter(st)}
                  className={`px-2.5 py-1 rounded font-semibold ${
                    woStatusFilter === st ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-help="ops_console.filter_wo_status"
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={woPriorityFilter}
                onChange={(e) => setWoPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500"
                data-help="ops_console.select_wo_priority"
              >
                <option value="All">All Priorities</option>
                <option value="Emergency">🚨 Emergency Only</option>
                <option value="High">High</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
              </select>

              <input
                type="text"
                placeholder="Search work orders..."
                value={woSearch}
                onChange={(e) => setWoSearch(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs w-48 focus:ring-2 focus:ring-indigo-500"
                data-help="ops_console.input_search_wo"
              />
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left">WO #</th>
                    <th className="px-3 py-2.5 text-left">Priority / ترجیح</th>
                    <th className="px-3 py-2.5 text-left">Category & Description</th>
                    <th className="px-3 py-2.5 text-left">Location</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left">Assigned / Vendor</th>
                    <th className="px-3 py-2.5 text-right">Cost (Rs.)</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWo.map((wo) => {
                    const stBadge = formatWorkOrderStatusBadge(wo.status);
                    const prioBadge = formatWorkOrderPriorityBadge(wo.priority);
                    return (
                      <tr key={wo.work_order_id} className="hover:bg-slate-50/80 transition-colors" data-help="ops_console.row_work_order">
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                          {wo.wo_number}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            style={{ color: prioBadge.color, backgroundColor: prioBadge.bg }}
                            className="px-2 py-0.5 rounded text-[11px] font-bold"
                          >
                            {prioBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-xs">
                          <strong className="text-slate-800 block">{wo.category}</strong>
                          <span className="text-slate-600 truncate block">{wo.description}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {wo.location_text || wo.ward_name || "General"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            style={{ color: stBadge.color, backgroundColor: stBadge.bg }}
                            className="px-2 py-0.5 rounded text-[11px] font-bold"
                          >
                            {stBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {wo.vendor_name ? `🏢 ${wo.vendor_name}` : wo.assigned_employee_name ? `👤 ${wo.assigned_employee_name}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {wo.final_cost ? `Rs. ${Number(wo.final_cost).toLocaleString()}` : wo.estimated_cost ? `~Rs. ${Number(wo.estimated_cost).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleSelectWo(wo.work_order_id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                            data-help="ops_console.btn_view_wo"
                          >
                            Details
                          </button>

                          {capability.canManageWorkOrders && wo.status === "Reported" && (
                            <button
                              onClick={() => {
                                setAssignWoId(wo.work_order_id);
                                setAssignCost(wo.estimated_cost ? String(wo.estimated_cost) : "");
                                setShowAssignModal(true);
                              }}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold"
                              data-help="ops_console.btn_assign_wo"
                            >
                              Assign
                            </button>
                          )}

                          {capability.canManageWorkOrders && wo.status === "Assigned" && (
                            <button
                              onClick={() => {
                                setStartWoId(wo.work_order_id);
                                setShowStartModal(true);
                              }}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-semibold"
                              data-help="ops_console.btn_start_wo"
                            >
                              Start
                            </button>
                          )}

                          {capability.canManageWorkOrders && wo.status === "InProgress" && (
                            <button
                              onClick={() => {
                                setCompleteWoId(wo.work_order_id);
                                setCompleteCost(wo.estimated_cost ? String(wo.estimated_cost) : "");
                                setShowCompleteModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold"
                              data-help="ops_console.btn_complete_wo"
                            >
                              Complete
                            </button>
                          )}

                          {capability.canManageWorkOrders && (wo.status === "Reported" || wo.status === "Assigned") && (
                            <button
                              onClick={() => {
                                setCancelWoId(wo.work_order_id);
                                setShowCancelModal(true);
                              }}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[11px] font-semibold"
                              data-help="ops_console.btn_cancel_wo"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWo.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No work orders matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drilldown Drawer for Selected Work Order */}
          {selectedWo && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm" data-help="ops_console.wo_detail_card">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{selectedWo.wo_number}</h3>
                  <span className="text-xs text-slate-500">({selectedWo.category})</span>
                  {(() => {
                    const b = formatWorkOrderStatusBadge(selectedWo.status);
                    return (
                      <span style={{ color: b.color, backgroundColor: b.bg }} className="px-2 py-0.5 rounded text-[11px] font-bold">
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedWo(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                  data-help="ops_console.btn_close_wo_detail"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">Reported By</span>
                  <strong className="text-slate-800">{selectedWo.reported_by_name}</strong>
                  <span className="text-slate-400 block">{new Date(selectedWo.reported_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Location / Ward</span>
                  <span className="text-slate-800">{selectedWo.location_text || selectedWo.ward_name || "General"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Assigned Resource</span>
                  <span className="text-slate-800">
                    {selectedWo.vendor_name ? `Contractor: ${selectedWo.vendor_name}` : selectedWo.assigned_employee_name ? `Staff: ${selectedWo.assigned_employee_name}` : "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Accounts Payable Status (Rule a7fc19b5fc)</span>
                  {(() => {
                    const pb = formatPayableStatusBadge(selectedWo.payable_status);
                    return (
                      <span style={{ color: pb.color, backgroundColor: pb.bg }} className="px-1.5 py-0.5 rounded text-[10px] font-bold inline-block">
                        {pb.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Statutory Note on AP queue */}
              {selectedWo.assigned_vendor_id && selectedWo.final_cost && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900 mb-3" data-help="ops_console.banner_ap_rule">
                  <strong>Statutory Rule (rule:a7fc19b5fc): </strong>
                  Ops raised contractor payment request of Rs. {Number(selectedWo.final_cost).toLocaleString()} → Routed to Accountant&apos;s AP queue. Ops staff can never settle funds directly.
                </div>
              )}

              {/* History Timeline */}
              {selectedWo.history && selectedWo.history.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">Status History Timeline:</span>
                  <div className="flex gap-2 flex-wrap">
                    {selectedWo.history.map((h, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {h.from_status || "New"} → <strong>{h.to_status}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PANE 2: ASSETS & OVERHEAD UTILITIES */}
      {activePane === 2 && (
        <div className="space-y-6" data-help="ops_console.pane_assets_utilities">
          {/* Section A: Assets Directory */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Hospital Equipment & Asset Monitor</h3>
                <span className="text-xs text-slate-500">Directory of physical equipment, biomedical tools & scheduled maintenance</span>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                Total Assets: {assetsList.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Tag / ٹیگ</th>
                    <th className="px-3 py-2 text-left">Name / نام</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Serial No</th>
                    <th className="px-3 py-2 text-right">Cost (Rs.)</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assetsList.map((asset) => (
                    <tr key={asset.asset_id} className="hover:bg-slate-50/80" data-help="ops_console.row_asset">
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">{asset.asset_tag}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{asset.name}</td>
                      <td className="px-3 py-2 text-slate-600">{asset.category}</td>
                      <td className="px-3 py-2 text-slate-600">{asset.location || "—"}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{asset.serial_no || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {asset.purchase_cost != null ? `Rs. ${Number(asset.purchase_cost).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {capability.canManageAssets && (
                          <button
                            onClick={() => {
                              setEditingAssetId(asset.asset_id);
                              setAssetTag(asset.asset_tag);
                              setAssetName(asset.name);
                              setAssetCategory(asset.category);
                              setAssetLocation(asset.location || "");
                              setAssetSerial(asset.serial_no || "");
                              setAssetCost(asset.purchase_cost != null ? String(asset.purchase_cost) : "");
                              setShowAssetModal(true);
                            }}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                            data-help="ops_console.btn_edit_asset"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assetsList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        No hospital assets registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Overhead Utility Bills */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Utility Overhead Bills (Electricity, Diesel, Oxygen, Water)</h3>
                <span className="text-xs text-slate-500">Overhead logs link directly to Accounts Payable for disbursement</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Category / شعبہ</th>
                    <th className="px-3 py-2 text-left">Vendor / کمپنی</th>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-left">Bill Ref</th>
                    <th className="px-3 py-2 text-right">Cost (Rs.)</th>
                    <th className="px-3 py-2 text-center">AP Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {utilityLogsList.map((log) => {
                    const pb = formatPayableStatusBadge(log.payable_status);
                    return (
                      <tr key={log.utility_log_id} className="hover:bg-slate-50/80" data-help="ops_console.row_utility_log">
                        <td className="px-3 py-2 font-medium text-slate-900">{log.category_name}</td>
                        <td className="px-3 py-2 text-slate-700">{log.vendor_name}</td>
                        <td className="px-3 py-2 text-slate-600">{log.billing_period}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{log.bill_reference || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                          Rs. {Number(log.cost).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span style={{ color: pb.color, backgroundColor: pb.bg }} className="px-2 py-0.5 rounded text-[10px] font-bold">
                            {pb.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {utilityLogsList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        No utility bills logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PANE 3: LIVE FACILITY FEED & STAFF LOOKUP */}
      {activePane === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-help="ops_console.pane_live_feed">
          {/* Left Column: Live Badge Feed */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Live Facility Badge Scans</h3>
                <span className="text-xs text-slate-500">Realtime access control events across doors and checkpoints</span>
              </div>
              <button
                onClick={loadFeed}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
                data-help="ops_console.btn_refresh_feed"
              >
                ↻ Poll Feed
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {facilityScans.map((scan) => (
                <div key={scan.scan_id} className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-xs" data-help="ops_console.item_feed_scan">
                  <div>
                    <strong className="text-slate-800 block">{scan.employee_name || `Badge #${scan.badge_code}`}</strong>
                    <span className="text-slate-500">{scan.station_label || "Checkpoint Door"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-indigo-700 block">{scan.outcome}</span>
                    <span className="text-[10px] text-slate-400">{new Date(scan.scanned_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
              {facilityScans.length === 0 && (
                <p className="text-center text-slate-400 py-8 text-xs">No badge scans recorded in the active horizon.</p>
              )}
            </div>
          </div>

          {/* Right Column: Staff Lookup */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-base font-bold text-slate-900">Staff Lookup Directory</h3>
              <span className="text-xs text-slate-500">Query active staff badge facts and designations</span>
            </div>

            <form onSubmit={handleStaffSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search staff name or badge..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500"
                data-help="ops_console.input_search_staff"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                data-help="ops_console.btn_search_staff"
              >
                Search
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {staffResults.map((s) => (
                <div key={s.employee_id} className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-xs" data-help="ops_console.item_staff_result">
                  <div>
                    <strong className="text-slate-900 block">{s.full_name}</strong>
                    <span className="text-slate-500">{s.designation} • {s.department_name || "General"}</span>
                  </div>
                  <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                    {s.emp_number}
                  </span>
                </div>
              ))}
              {staffResults.length === 0 && staffSearchQuery && (
                <p className="text-center text-slate-400 py-6 text-xs">No staff found matching query.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_assign">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">Assign Work Order</h3>
            {assignError && <p className="mb-3 text-red-600 font-semibold">{assignError}</p>}
            <form onSubmit={handleAssignSubmit} className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assignType"
                    checked={assignType === "employee"}
                    onChange={() => setAssignType("employee")}
                    data-help="ops_console.radio_assign_emp"
                  />
                  <span>Internal Staff</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="assignType"
                    checked={assignType === "vendor"}
                    onChange={() => setAssignType("vendor")}
                    data-help="ops_console.radio_assign_vendor"
                  />
                  <span>External Contractor</span>
                </label>
              </div>

              {assignType === "employee" ? (
                <div>
                  <label className="block font-semibold mb-1">Staff member *</label>
                  <DirectoryPicker
                    value={assignEmpId}
                    onChange={(e) => setAssignEmpId(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_assign_emp_id"
                    required
                   path="/staff/lookup" idField="employee_id" search />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold mb-1">Contractor / provider *</label>
                  <DirectoryPicker
                    value={assignVendorId}
                    onChange={(e) => setAssignVendorId(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_assign_vendor_id"
                    required
                   path="/finance/vendors?vendor_type=Contractor" idField="vendor_id" />
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Estimated Cost (Rs.)</label>
                <input
                  type="number"
                  value={assignCost}
                  onChange={(e) => setAssignCost(e.target.value)}
                  placeholder="e.g. 3000"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_assign_cost"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Assignment Note</label>
                <textarea
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Instructions for technician"
                  rows={2}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_assign_note"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_assign"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_assign"
                >
                  {submitting ? "Saving..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* START MODAL */}
      {showStartModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_start">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">Mark Work In Progress</h3>
            <form onSubmit={handleStartSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Technician Note (Optional)</label>
                <input
                  type="text"
                  value={startNote}
                  onChange={(e) => setStartNote(e.target.value)}
                  placeholder="e.g. Parts acquired, repair initiated"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_start_note"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_start"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_start"
                >
                  Start Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_complete">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-emerald-900 mb-2">Mark Work Order Complete</h3>
            <p className="text-slate-500 mb-3">
              Completing external vendor work automatically creates a payment request in Accounts Payable queue (Rule a7fc19b5fc).
            </p>
            {completeError && <p className="mb-2 text-red-600 font-semibold">{completeError}</p>}
            <form onSubmit={handleCompleteSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Final Invoiced Cost (Rs.)</label>
                <input
                  type="number"
                  value={completeCost}
                  onChange={(e) => setCompleteCost(e.target.value)}
                  placeholder="Defaults to estimate if blank"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_complete_cost"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Completion Summary</label>
                <textarea
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder="e.g. Replacement valve installed, tested without leaks"
                  rows={2}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_complete_note"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_complete"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_complete"
                >
                  Complete Job & Route to AP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_cancel">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-red-900 mb-2">Cancel Work Order</h3>
            {cancelError && <p className="mb-2 text-red-600 font-semibold">{cancelError}</p>}
            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Cancellation Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Min 3 characters"
                  rows={2}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_cancel_reason"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_cancel"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_cancel"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET MODAL */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_asset">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              {editingAssetId ? "Update Hospital Asset" : "Register New Equipment / Asset"}
            </h3>
            <form onSubmit={handleAssetSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Asset Tag * (e.g. BIO-2026-001)</label>
                <input
                  type="text"
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_asset_tag"
                  required
                />
                {assetErrors.asset_tag && <p className="text-red-600 mt-0.5">{assetErrors.asset_tag}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Asset Name *</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Anaesthesia Machine Fabius"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_asset_name"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Category *</label>
                <select
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.select_asset_category"
                >
                  <option value="Biomedical">Biomedical</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="IT">IT Hardware</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="General">General Facility</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={assetLocation}
                    onChange={(e) => setAssetLocation(e.target.value)}
                    placeholder="OT 1"
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_asset_location"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={assetSerial}
                    onChange={(e) => setAssetSerial(e.target.value)}
                    placeholder="SN-12345"
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_asset_serial"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Purchase Cost (Rs.)</label>
                <input
                  type="number"
                  value={assetCost}
                  onChange={(e) => setAssetCost(e.target.value)}
                  placeholder="e.g. 850000"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_asset_cost"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssetModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_asset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_asset"
                >
                  {submitting ? "Saving..." : "Save Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UTILITY MODAL */}
      {showUtilityModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_utility">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">Log Overhead Utility Bill</h3>
            <p className="text-slate-500 mb-3">Logs expense to General Ledger and routes to AP for payment approval.</p>
            <form onSubmit={handleUtilitySubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Utility Category *</label>
                <select
                  value={utilCategoryId}
                  onChange={(e) => setUtilCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.select_util_category"
                >
                  {utilityCats.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.name} ({cat.unit || "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Contractor / provider *</label>
                  <DirectoryPicker
                    value={utilVendorId}
                    onChange={(e) => setUtilVendorId(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_util_vendor"
                    required
                   path="/finance/vendors?vendor_type=UtilityProvider" idField="vendor_id" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Billing Period *</label>
                  <input
                    type="text"
                    value={utilPeriod}
                    onChange={(e) => setUtilPeriod(e.target.value)}
                    placeholder="2026-09"
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_util_period"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Cost * (Rs.)</label>
                  <input
                    type="number"
                    value={utilCost}
                    onChange={(e) => setUtilCost(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_util_cost"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Quantity (Units)</label>
                  <input
                    type="number"
                    value={utilQty}
                    onChange={(e) => setUtilQty(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full px-3 py-1.5 border rounded"
                    data-help="ops_console.input_util_qty"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Bill Reference Number</label>
                <input
                  type="text"
                  value={utilRef}
                  onChange={(e) => setUtilRef(e.target.value)}
                  placeholder="e.g. LESCO-987654321"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_util_ref"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUtilityModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_util"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_util"
                >
                  {submitting ? "Logging..." : "Log Bill to AP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLEAN BED MODAL */}
      {showCleanBedModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_clean_bed">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">Confirm Bed Cleaned</h3>
            <form onSubmit={handleMarkCleanedSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">{t("Ward and bed", "وارڈ اور بستر")}</label>
                <LoadState {...matrix} retry={matrix.reload} />
                <select value={cleanBedId} onChange={e => setCleanBedId(e.target.value)} required
                  className="w-full px-3 py-1.5 border rounded" data-help="ops_console.input_clean_bed_id"
                  disabled={matrix.loading || Boolean(matrix.error)}>
                  <option value="">{t("Choose a bed awaiting cleaning", "صفائی کا منتظر بستر چنیں")}</option>
                  {cleaningBeds.map(bed => <option key={bed.bed_id} value={bed.bed_id ?? ""}>{bedLabel(bed.ward_id, bed.label)}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Housekeeping Staff ID (Optional)</label>
                <DirectoryPicker
                  value={cleanEmpId}
                  onChange={(e) => setCleanEmpId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_clean_emp_id"
                 path="/staff/lookup" idField="employee_id" search />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCleanBedModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_clean_bed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_clean_bed"
                >
                  Confirm Cleaned
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLEAR DISCHARGE STAGE MODAL */}
      {showClearDischargeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-help="ops_console.modal_clear_discharge">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">Clear Discharge Stage</h3>
            <form onSubmit={handleClearDischargeSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">{t("Ward and bed", "وارڈ اور بستر")}</label>
                <LoadState {...matrix} retry={matrix.reload} />
                <select value={dischargeAdmissionId} onChange={e => setDischargeAdmissionId(e.target.value)} required
                  className="w-full px-3 py-1.5 border rounded" data-help="ops_console.input_discharge_adm_id"
                  disabled={matrix.loading || Boolean(matrix.error)}>
                  <option value="">{t("Choose a bed with discharge in progress", "جاری ڈسچارج والا بستر چنیں")}</option>
                  {dischargeBeds.map(bed => <option key={bed.bed_id} value={bed.admission_id ?? ""}>{bedLabel(bed.ward_id, bed.label)}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Clearance Stage</label>
                <select
                  value={dischargeStage}
                  onChange={(e) => setDischargeStage(e.target.value as any)}
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.select_discharge_stage"
                >
                  <option value="OpsCleaning" disabled={!canClearOpsDischargeStage(sessionInfo, "OpsCleaning")}>OpsCleaning / صفائی و دیکھ بھال</option>
                  <option value="PharmacyClearance" disabled={!canClearOpsDischargeStage(sessionInfo, "PharmacyClearance")}>PharmacyClearance / فارمیسی ادویات واپسی</option>
                  <option value="NursingMARVerification" disabled={!canClearOpsDischargeStage(sessionInfo, "NursingMARVerification")}>NursingMARVerification / نرسنگ تصدیق</option>
                  <option value="BillingSettlement" disabled={!canClearOpsDischargeStage(sessionInfo, "BillingSettlement")}>BillingSettlement / بلنگ کلیئرنس</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Audited Note</label>
                <input
                  type="text"
                  value={dischargeNote}
                  onChange={(e) => setDischargeNote(e.target.value)}
                  placeholder="e.g. Room inspected, all keys returned"
                  className="w-full px-3 py-1.5 border rounded"
                  data-help="ops_console.input_discharge_note"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearDischargeModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded"
                  data-help="ops_console.btn_close_discharge"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded font-semibold"
                  data-help="ops_console.btn_submit_discharge"
                >
                  Clear Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const OpsConsoleScreen = OpsConsole;
export default OpsConsole;
