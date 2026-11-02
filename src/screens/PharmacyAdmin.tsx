/**
 * Screen 135: pharmacy_admin
 * "Pharmacy inventory, formulary & procurement"
 * Workspace: `pharmacy_admin`, Position: 135, Points: 76.
 *
 * Statutory & Quality Rules:
 * - rule:b828c195cc: Batch intake: boxes × units per box and total invoice cost; the server derives unit cost.
 * - rule:f65fc1a5a8: Return to supplier (expired, near expiry, recalled, damaged, excess, wrongly supplied):
 *                    from a batch, quantity, reason, and note (recalled batch requires reason Recall and recall_id),
 *                    then print return note PDF; tracks status Returned -> Credited / Refused.
 * - rule:609bbe13b3: A new drug may be high-alert or restricted from the start; never both high-alert and OTC.
 * - ev:pharmacy.low_stock: Realtime WebSocket event to refresh low stock & inventory reads without polling.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import {
  addDrug,
  addBatch,
  adjust,
  addVendorInvoice,
  listVendorInvoices,
  lowStock,
  nearExpiry,
  profit,
  vendors,
  recordReturn,
  listReturnsPharmacyAdminSupplier,
  getReturn,
  returnNote,
  type DrugIn,
  type DrugOut,
  type BatchIn,
  type DrugBatchOut,
  type AdjustIn,
  type VendorInvoiceIn,
  type VendorInvoiceListOut,
  type LowStockOut,
  type NearExpiryOut,
  type ProfitDashboardOut,
  type VendorOut,
  type SupplierReturnIn,
  type SupplierReturnOut,
} from "../generated/pharmacy_admin";
import {
  getPharmacyAdminCapabilityView,
  validateDrugInput,
  validateBatchInput,
  validateAdjustInput,
  validateVendorInvoiceInput,
  validateSupplierReturnInput,
  PHARMACY_ADMIN_ERROR_MESSAGES,
  DRUG_FORMS,
  DRUG_SCHEDULES,
  HIGH_ALERT_CATEGORIES,
  HIGH_ALERT_CATEGORY_LABELS,
  ADJUSTMENT_REASONS,
  SUPPLIER_RETURN_REASONS,
  SUPPLIER_RETURN_REASON_LABELS,
  VENDOR_INVOICE_TYPES,
  VENDOR_INVOICE_MODULES,
  type PharmacyAdminCapabilityView,
  type DrugForm,
  type DrugSchedule,
  type HighAlertCategory,
  type AdjustmentReason,
  type SupplierReturnReason,
  type VendorInvoiceType,
  type VendorInvoiceModule,
} from "../pharmacy-admin-policy";

export interface PharmacyAdminProps {
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

type TabMode = "drugs" | "batches" | "invoices" | "returns" | "dashboards";

export const PharmacyAdmin: React.FC<PharmacyAdminProps> = ({
  user,
  establishment,
  connected = true,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
}) => {
  const capabilityView: PharmacyAdminCapabilityView = useMemo(
    () => getPharmacyAdminCapabilityView(establishment),
    [establishment]
  );

  const [activeTab, setActiveTab] = useState<TabMode>("dashboards");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data states
  const [vendorList, setVendorList] = useState<VendorOut[]>([]);
  const [invoiceList, setInvoiceList] = useState<VendorInvoiceListOut[]>([]);
  const [returnsList, setReturnsList] = useState<SupplierReturnOut[]>([]);
  const [lowStockData, setLowStockData] = useState<LowStockOut[]>([]);
  const [nearExpiryData, setNearExpiryData] = useState<NearExpiryOut[]>([]);
  const [profitData, setProfitData] = useState<ProfitDashboardOut | null>(null);

  // Filters
  const [invoiceModuleFilter, setInvoiceModuleFilter] = useState<string>("All");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("All");
  const [returnStatusFilter, setReturnStatusFilter] = useState<string>("All");
  const [profitDateFrom, setProfitDateFrom] = useState<string>("");
  const [profitDateTo, setProfitDateTo] = useState<string>("");

  // Modals
  const [showAddDrugModal, setShowAddDrugModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showAddReturnModal, setShowAddReturnModal] = useState(false);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<SupplierReturnOut | null>(null);

  // Form states: Drug
  const [drugForm, setDrugForm] = useState<DrugIn>({
    code: "",
    name: "",
    generic_name: "",
    strength: "",
    form: "Tablet",
    unit: "tablet",
    schedule: "ScheduleH",
    is_otc_allowed: false,
    barcode: "",
    low_stock_threshold: 50,
    near_expiry_alert_days: 90,
    high_alert_category: null,
    is_restricted: false,
  });

  // Form states: Batch Intake
  const [batchForm, setBatchForm] = useState<BatchIn>({
    drug_id: 1,
    batch_no: "",
    expiry_date: "",
    box_quantity: 10,
    units_per_box: 100,
    total_invoice_cost: 15000,
    retail_price: 20,
    vendor_invoice_id: null,
  });

  // Form states: Stock Adjust
  const [adjustBatchId, setAdjustBatchId] = useState<number>(1);
  const [adjustForm, setAdjustForm] = useState<AdjustIn>({
    qty: 5,
    reason: "Damage",
    note: "",
  });

  // Form states: Vendor Invoice
  const [invoiceForm, setInvoiceForm] = useState<VendorInvoiceIn>({
    vendor_id: 1,
    invoice_no: "",
    invoice_type: "Purchase",
    module: "Pharmacy",
    total_cost: 50000,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  });

  // Form states: Supplier Return
  const [returnBatchId, setReturnBatchId] = useState<number>(1);
  const [returnForm, setReturnForm] = useState<SupplierReturnIn>({
    qty: 10,
    reason: "NearExpiry",
    vendor_id: null,
    recall_id: null,
    note: "",
  });

  // Realtime subscription indicator
  const [realtimeActive, setRealtimeActive] = useState(false);

  // Permissions check
  const canManageDrugs = user.permissions.includes("pharmacy.drug.manage") || user.roles.includes("pharmacy_admin");
  const canReceiveStock = user.permissions.includes("pharmacy.stock.receive") || user.roles.includes("pharmacy_admin");
  const canAdjustStock = user.permissions.includes("pharmacy.stock.adjust") || user.roles.includes("pharmacy_admin");
  const canManageInvoices = user.permissions.includes("pharmacy.vendor_invoice.manage") || user.roles.includes("pharmacy_admin");
  const canRecordReturn = user.permissions.includes("pharmacy.supplier_return.record") || user.roles.includes("pharmacy_admin");
  const canViewDashboard = user.permissions.includes("pharmacy.dashboard.view") || user.roles.includes("pharmacy_admin");

  // Load all initial data
  const loadData = useCallback(async () => {
    if (capabilityView === "hidden") return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [vRes, invRes, retRes, lsRes, neRes, profRes] = await Promise.allSettled([
        vendors(),
        listVendorInvoices({
          module: invoiceModuleFilter === "All" ? null : invoiceModuleFilter,
          status: invoiceStatusFilter === "All" ? null : invoiceStatusFilter,
        }),
        listReturnsPharmacyAdminSupplier({
          status: returnStatusFilter === "All" ? null : (returnStatusFilter as any),
        }),
        lowStock(),
        nearExpiry(),
        profit({
          date_from: profitDateFrom || null,
          date_to: profitDateTo || null,
        }),
      ]);

      if (vRes.status === "fulfilled") setVendorList(vRes.value);
      if (invRes.status === "fulfilled") setInvoiceList(invRes.value);
      if (retRes.status === "fulfilled") setReturnsList(retRes.value);
      if (lsRes.status === "fulfilled") setLowStockData(lsRes.value);
      if (neRes.status === "fulfilled") setNearExpiryData(neRes.value);
      if (profRes.status === "fulfilled") setProfitData(profRes.value);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load pharmacy administration records.");
    } finally {
      setLoading(false);
    }
  }, [
    capabilityView,
    invoiceModuleFilter,
    invoiceStatusFilter,
    returnStatusFilter,
    profitDateFrom,
    profitDateTo,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime WebSocket subscription for pharmacy.low_stock
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).terminal?.subscribe) {
      const unsub = (window as any).terminal.subscribe("pharmacy.low_stock", () => {
        setRealtimeActive(true);
        // Refresh reads upon event without polling
        Promise.allSettled([lowStock(), nearExpiry()]).then(([ls, ne]) => {
          if (ls.status === "fulfilled") setLowStockData(ls.value);
          if (ne.status === "fulfilled") setNearExpiryData(ne.value);
        });
      });
      return () => {
        if (typeof unsub === "function") unsub();
      };
    }
  }, []);

  // Handler: Add Formulary Drug (POST /pharmacy-admin/drugs)
  const handleSaveDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateDrugInput(drugForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Drug validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await addDrug(drugForm);
      setSuccessMessage(`Drug ${drugForm.code} added to hospital formulary.`);
      setShowAddDrugModal(false);
      setDrugForm({
        code: "",
        name: "",
        generic_name: "",
        strength: "",
        form: "Tablet",
        unit: "tablet",
        schedule: "ScheduleH",
        is_otc_allowed: false,
        barcode: "",
        low_stock_threshold: 50,
        near_expiry_alert_days: 90,
        high_alert_category: null,
        is_restricted: false,
      });
      loadData();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = PHARMACY_ADMIN_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Batch Intake (POST /pharmacy-admin/batches)
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBatchInput(batchForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Batch validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await addBatch(batchForm);
      setSuccessMessage(
        `Batch ${res.batch_no} received! Total: ${res.qty_received} units. Server derived unit cost: PKR ${res.unit_cost.toFixed(2)}.`
      );
      setShowAddBatchModal(false);
      loadData();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = PHARMACY_ADMIN_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Stock Adjustment / Write-off (POST /pharmacy-admin/batches/{batch_id}/adjust)
  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAdjustInput(adjustForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Adjustment validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await adjust(adjustBatchId, adjustForm);
      setSuccessMessage(`Stock adjusted for batch ID ${adjustBatchId} (${adjustForm.reason}: ${adjustForm.qty} units).`);
      setShowAdjustModal(false);
      loadData();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = PHARMACY_ADMIN_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Record Vendor Invoice (POST /pharmacy-admin/vendor-invoices)
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateVendorInvoiceInput(invoiceForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Invoice validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await addVendorInvoice(invoiceForm);
      setSuccessMessage(`Vendor invoice ${res.invoice_no} recorded (AP created, Status: ${res.status}).`);
      setShowAddInvoiceModal(false);
      loadData();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = PHARMACY_ADMIN_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Record Supplier Return (POST /pharmacy-admin/batches/{batch_id}/supplier-returns)
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSupplierReturnInput(returnForm);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Supplier return validation failed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await recordReturn(returnBatchId, returnForm);
      setSuccessMessage(
        `Supplier return note ${res.return_number} issued for ${res.qty} units (Value: PKR ${res.value_at_cost}). Status: ${res.status}.`
      );
      setShowAddReturnModal(false);
      loadData();
    } catch (err: any) {
      const code = err.code || "VALIDATION_ERROR";
      const explanation = PHARMACY_ADMIN_ERROR_MESSAGES[code]?.en || err.message;
      setErrorMessage(explanation);
    } finally {
      setLoading(false);
    }
  };

  // Handler: View Single Return Detail (GET /pharmacy-admin/supplier-returns/{return_id})
  const handleViewReturn = async (returnId: number) => {
    setLoading(true);
    try {
      const detail = await getReturn(returnId);
      setSelectedReturnDetail(detail);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load return details.");
    } finally {
      setLoading(false);
    }
  };

  // Handler: Download/Print Return Note PDF (GET /pharmacy-admin/supplier-returns/{return_id}/pdf)
  const handleDownloadReturnPdf = async (returnId: number) => {
    setLoading(true);
    try {
      await returnNote(returnId);
      setSuccessMessage(`Supplier return voucher PDF generated for Return ID #${returnId}.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate return note PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Live derived batch values under rule:b828c195cc
  const derivedUnits = (Number(batchForm.box_quantity) || 0) * (Number(batchForm.units_per_box) || 0);
  const derivedUnitCost = derivedUnits > 0 ? (Number(batchForm.total_invoice_cost) || 0) / derivedUnits : 0;

  if (capabilityView === "hidden") {
    return (
      <div className="p-8 text-center bg-gray-100 rounded-lg border border-gray-300">
        <h2 className="text-xl font-bold text-gray-700">Pharmacy Administration Unavailable</h2>
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
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pharmacy Back Office</h1>
            <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full border border-emerald-300">
              Workspace: pharmacy_admin
            </span>
            <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full border border-blue-300">
              Capability View: {capabilityView}
            </span>
            {realtimeActive && (
              <span className="text-xs px-2.5 py-1 bg-teal-100 text-teal-800 font-semibold rounded-full border border-teal-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                Live Event: pharmacy.low_stock
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Formulary drug management, batch intake with derived unit cost (Rule b828c195cc), supplier returns (Rule f65fc1a5a8),
            and high-alert safety enforcement (Rule 609bbe13b3).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-help="pharmacy_admin.refresh_btn"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? "Refreshing..." : "↻ Refresh All"}
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
            data-help="pharmacy_admin.dismiss_error_btn"
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
            data-help="pharmacy_admin.dismiss_success_btn"
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
          data-help="pharmacy_admin.dashboards_tab"
          onClick={() => setActiveTab("dashboards")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "dashboards"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          📊 Dashboards (Low Stock, Expiry & Profit)
        </button>
        <button
          type="button"
          data-help="pharmacy_admin.drugs_tab"
          onClick={() => setActiveTab("drugs")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "drugs"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          💊 Formulary & Drugs
        </button>
        <button
          type="button"
          data-help="pharmacy_admin.batches_tab"
          onClick={() => setActiveTab("batches")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "batches"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          📦 Batch Intake & Stock Adjust
        </button>
        <button
          type="button"
          data-help="pharmacy_admin.invoices_tab"
          onClick={() => setActiveTab("invoices")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "invoices"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          🧾 Supplier Invoices & AP
        </button>
        <button
          type="button"
          data-help="pharmacy_admin.returns_tab"
          onClick={() => setActiveTab("returns")}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition ${
            activeTab === "returns"
              ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          ↩ Supplier Returns & Credits
        </button>
      </div>

      {/* TAB 1: DASHBOARDS (LOW STOCK, NEAR EXPIRY, PROFIT) */}
      {activeTab === "dashboards" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Low Stock Items</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{lowStockData.length}</div>
              <span className="text-xs text-gray-500">Items below replenishment point</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Near Expiry Batches</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{nearExpiryData.length}</div>
              <span className="text-xs text-gray-500">Batches expiring in window</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Money At Risk (Cost)</span>
              <div className="text-2xl font-black text-purple-600 mt-1">
                PKR {nearExpiryData.reduce((acc, b) => acc + (b.money_at_risk || 0), 0).toLocaleString()}
              </div>
              <span className="text-xs text-gray-500">Stock value of expiring batches</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Net Profit</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                PKR {(profitData?.totals?.profit || 0).toLocaleString()}
              </div>
              <span className="text-xs text-gray-500">
                Revenue: PKR {(profitData?.totals?.revenue || 0).toLocaleString()} | COGS: PKR {(profitData?.totals?.cogs || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Two-Column: Low Stock & Near Expiry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low-Stock Widget */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                  <span>⚠️</span> Low-Stock Replenishment Alert
                </h3>
                <span className="text-xs text-gray-500">Auto-updated on pharmacy.low_stock</span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-2 font-semibold">Code</th>
                      <th className="p-2 font-semibold">Drug Name</th>
                      <th className="p-2 font-semibold text-right">Available</th>
                      <th className="p-2 font-semibold text-right">Threshold</th>
                      <th className="p-2 font-semibold">Status</th>
                      <th className="p-2 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lowStockData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400">
                          All formulary medicines are adequately stocked.
                        </td>
                      </tr>
                    ) : (
                      lowStockData.map((item) => (
                        <tr key={item.drug_id} className="hover:bg-gray-50">
                          <td className="p-2 font-mono font-medium text-xs">{item.code}</td>
                          <td className="p-2 font-medium text-gray-800">{item.name}</td>
                          <td className="p-2 text-right font-bold text-rose-600">{item.qty_available}</td>
                          <td className="p-2 text-right text-gray-600">{item.low_stock_threshold}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded ${
                                item.stock_status === "Critical"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {item.stock_status}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              data-help="pharmacy_admin.quick_intake_btn"
                              onClick={() => {
                                setBatchForm((prev) => ({ ...prev, drug_id: item.drug_id }));
                                setShowAddBatchModal(true);
                              }}
                              className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 font-semibold"
                            >
                              + Intake
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Near-Expiry Widget */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                  <span>⏳</span> Near-Expiry Alert (Money At Risk)
                </h3>
                <span className="text-xs text-gray-500">Rule f65fc1a5a8 supplier return candidate</span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-2 font-semibold">Batch</th>
                      <th className="p-2 font-semibold">Medicine</th>
                      <th className="p-2 font-semibold">Expiry</th>
                      <th className="p-2 font-semibold text-right">Days Left</th>
                      <th className="p-2 font-semibold text-right">At Risk (PKR)</th>
                      <th className="p-2 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nearExpiryData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400">
                          No batches are currently near expiration.
                        </td>
                      </tr>
                    ) : (
                      nearExpiryData.map((item) => (
                        <tr key={item.batch_id} className="hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs font-semibold">{item.batch_no}</td>
                          <td className="p-2 font-medium text-gray-800">{item.name}</td>
                          <td className="p-2 font-mono text-xs text-rose-600">{item.expiry_date}</td>
                          <td className="p-2 text-right font-bold text-amber-700">{item.days_left}d</td>
                          <td className="p-2 text-right font-bold text-purple-700">
                            {Number(item.money_at_risk || 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              data-help="pharmacy_admin.quick_return_btn"
                              onClick={() => {
                                setReturnBatchId(item.batch_id);
                                setReturnForm((prev) => ({
                                  ...prev,
                                  qty: item.qty_available,
                                  reason: "NearExpiry",
                                }));
                                setShowAddReturnModal(true);
                              }}
                              className="px-2 py-1 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 font-semibold"
                            >
                              ↩ Return
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Profit Analytics Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                  <span>📈</span> Pharmacy Profit Dashboard (Gross Revenue − COGS = Net Profit)
                </h3>
                <p className="text-xs text-gray-500">Live analytics calculated from dispensation lines.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600">From:</label>
                <input
                  type="date"
                  data-help="pharmacy_admin.profit_date_from_input"
                  value={profitDateFrom}
                  onChange={(e) => setProfitDateFrom(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                />
                <label className="text-xs font-semibold text-gray-600">To:</label>
                <input
                  type="date"
                  data-help="pharmacy_admin.profit_date_to_input"
                  value={profitDateTo}
                  onChange={(e) => setProfitDateTo(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                />
                <button
                  type="button"
                  data-help="pharmacy_admin.apply_profit_filter_btn"
                  onClick={loadData}
                  className="px-3 py-1 bg-gray-800 text-white text-xs font-semibold rounded hover:bg-gray-900"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Revenue by Payment Mode */}
            {profitData?.by_payment_mode && profitData.by_payment_mode.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Revenue by Payment Channel</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {profitData.by_payment_mode.map((mode) => (
                    <div key={mode.payment_mode} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      <div className="text-xs font-semibold text-gray-500 truncate">{mode.payment_mode}</div>
                      <div className="text-sm font-black text-gray-800 mt-1">PKR {mode.revenue.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400">{mode.count} sales</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 10 Profitable Medicines */}
            {profitData?.top_drugs && profitData.top_drugs.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Top 10 Profitable Drugs</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {profitData.top_drugs.map((drug, idx) => (
                    <div key={idx} className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                      <div className="text-xs font-bold text-emerald-900 truncate">#{idx + 1} {drug.name}</div>
                      <div className="text-sm font-black text-emerald-700 mt-1">Profit: PKR {drug.profit.toLocaleString()}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Dispensed: {drug.qty} units</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FORMULARY & DRUGS */}
      {activeTab === "drugs" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Hospital Drug Formulary</h2>
              <p className="text-xs text-gray-500">
                Formulary catalog governed by Rule 609bbe13b3: High-alert drugs cannot be marked as OTC.
              </p>
            </div>
            {canManageDrugs && (
              <button
                type="button"
                data-help="pharmacy_admin.open_add_drug_btn"
                onClick={() => setShowAddDrugModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm"
              >
                + Add Formulary Drug
              </button>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search Medicines</label>
              <input
                type="text"
                data-help="pharmacy_admin.drug_search_input"
                placeholder="Search by code, brand name, generic name..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dispensing Schedule</label>
              <select
                data-help="pharmacy_admin.drug_schedule_filter"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="All">All Schedules</option>
                {DRUG_SCHEDULES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <label className="block text-xs font-semibold text-gray-600 mb-1">High-Alert Category</label>
              <select
                data-help="pharmacy_admin.drug_high_alert_filter"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="All">All Categories</option>
                {HIGH_ALERT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="font-semibold">Formulary Drugs Registry</p>
            <p className="text-xs text-gray-400 mt-1">
              Click &quot;+ Add Formulary Drug&quot; above to register new hospital pharmaceuticals with statutory high-alert checks (Rule 609bbe13b3).
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: BATCH INTAKE & STOCK ADJUST */}
      {activeTab === "batches" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Batch Intake & Inventory Adjustments</h2>
              <p className="text-xs text-gray-500">
                Rule b828c195cc: Batch intake takes boxes × units per box and total invoice cost; the server derives unit cost.
              </p>
            </div>
            <div className="flex gap-2">
              {canReceiveStock && (
                <button
                  type="button"
                  data-help="pharmacy_admin.open_add_batch_btn"
                  onClick={() => setShowAddBatchModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm text-sm"
                >
                  + Receive Batch
                </button>
              )}
              {canAdjustStock && (
                <button
                  type="button"
                  data-help="pharmacy_admin.open_adjust_modal_btn"
                  onClick={() => setShowAdjustModal(true)}
                  className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition shadow-sm text-sm"
                >
                  ⚠ Write Off / Adjust Batch
                </button>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-800">Batch Intake Calculation Rule (Rule b828c195cc)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-gray-600">Total Units Received:</span>
                <div className="text-lg font-bold text-indigo-700 mt-1">Boxes × Units per Box</div>
                <span className="text-gray-400">e.g. 10 boxes × 100 tablets = 1,000 units</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-gray-600">Derived Unit Cost:</span>
                <div className="text-lg font-bold text-emerald-700 mt-1">Invoice Cost ÷ Total Units</div>
                <span className="text-gray-400">Derived automatically by backend ledger</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-gray-600">Retail Markup & Margin:</span>
                <div className="text-lg font-bold text-purple-700 mt-1">Selling Price &ge; Unit Cost</div>
                <span className="text-gray-400">Enforces non-negative commercial margin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIER INVOICES & AP */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Supplier Invoices & Accounts Payable</h2>
              <p className="text-xs text-gray-500">
                Record supplier purchase invoices generating matched Accounts Payable in the finance module.
              </p>
            </div>
            {canManageInvoices && (
              <button
                type="button"
                data-help="pharmacy_admin.open_add_invoice_btn"
                onClick={() => setShowAddInvoiceModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm"
              >
                + Record Supplier Invoice
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-600 text-xs">Module:</label>
              <select
                data-help="pharmacy_admin.invoice_module_filter"
                value={invoiceModuleFilter}
                onChange={(e) => setInvoiceModuleFilter(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              >
                <option value="All">All Modules</option>
                {VENDOR_INVOICE_MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-600 text-xs">Status:</label>
              <select
                data-help="pharmacy_admin.invoice_status_filter"
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="PartiallyPaid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Vendor / Supplier</th>
                  <th className="p-3 font-semibold">Module</th>
                  <th className="p-3 font-semibold">Invoice Date</th>
                  <th className="p-3 font-semibold text-right">Total Cost</th>
                  <th className="p-3 font-semibold text-right">Paid Amount</th>
                  <th className="p-3 font-semibold text-right">Balance Due</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoiceList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">
                      No supplier invoices found matching current filters.
                    </td>
                  </tr>
                ) : (
                  invoiceList.map((inv) => (
                    <tr key={inv.vendor_invoice_id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-semibold text-indigo-700">{inv.invoice_no}</td>
                      <td className="p-3 font-medium text-gray-800">{inv.vendor_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs bg-gray-100 font-semibold rounded border border-gray-200">
                          {inv.module}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-xs font-mono">{inv.invoice_date}</td>
                      <td className="p-3 text-right font-bold">PKR {Number(inv.total_cost || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-700 font-bold">PKR {Number(inv.paid_amount || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-700 font-bold">PKR {Number(inv.balance || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            inv.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "PartiallyPaid"
                              ? "bg-blue-100 text-blue-800"
                              : inv.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPLIER RETURNS & CREDITS */}
      {activeTab === "returns" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Supplier Returns Ledger (Rule f65fc1a5a8)</h2>
              <p className="text-xs text-gray-500">
                Track return of expired, recalled, or damaged goods. Status: Returned &rarr; Credited (pays bills) or Refused.
              </p>
            </div>
            {canRecordReturn && (
              <button
                type="button"
                data-help="pharmacy_admin.open_add_return_btn"
                onClick={() => setShowAddReturnModal(true)}
                className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition shadow-sm text-sm"
              >
                + Return Batch to Supplier
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <label className="font-semibold text-gray-600 text-xs">Return Status:</label>
            <select
              data-help="pharmacy_admin.return_status_filter"
              value={returnStatusFilter}
              onChange={(e) => setReturnStatusFilter(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Returned">Returned (Awaiting Credit Note)</option>
              <option value="Credited">Credited (Confirmed by Finance)</option>
              <option value="Refused">Refused (Written Off)</option>
            </select>
          </div>

          {/* Returns Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="p-3 font-semibold">Return #</th>
                  <th className="p-3 font-semibold">Medicine & Batch</th>
                  <th className="p-3 font-semibold">Supplier</th>
                  <th className="p-3 font-semibold text-right">Return Qty</th>
                  <th className="p-3 font-semibold text-right">Value (PKR)</th>
                  <th className="p-3 font-semibold">Reason</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returnsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">
                      No supplier returns recorded.
                    </td>
                  </tr>
                ) : (
                  returnsList.map((ret) => (
                    <tr key={ret.return_id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-xs text-rose-700">{ret.return_number}</td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-800">{ret.drug_name}</div>
                        <div className="text-xs font-mono text-gray-500">Batch: {ret.batch_no}</div>
                      </td>
                      <td className="p-3 font-medium text-gray-700">{ret.vendor_name}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{ret.qty}</td>
                      <td className="p-3 text-right font-bold text-purple-700">
                        PKR {Number(ret.value_at_cost || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs bg-gray-100 font-semibold rounded border border-gray-200">
                          {ret.reason}
                        </span>
                        {ret.recall_id && (
                          <span className="ml-1 text-[10px] text-red-600 font-bold">Recall #{ret.recall_id}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            ret.status === "Credited"
                              ? "bg-emerald-100 text-emerald-800"
                              : ret.status === "Refused"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ret.status}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button
                          type="button"
                          data-help="pharmacy_admin.view_return_detail_btn"
                          onClick={() => handleViewReturn(ret.return_id)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 font-medium"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          data-help="pharmacy_admin.download_return_pdf_btn"
                          onClick={() => handleDownloadReturnPdf(ret.return_id)}
                          className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 font-medium"
                        >
                          📄 PDF Voucher
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD FORMULARY DRUG (rule:609bbe13b3) */}
      {showAddDrugModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Add Formulary Medicine</h3>
                <p className="text-xs text-gray-500">Statutory Rule 609bbe13b3: Never both High-Alert and OTC.</p>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_drug_modal_btn"
                onClick={() => setShowAddDrugModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDrug} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Drug Code *</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.drug_code_input"
                    value={drugForm.code}
                    onChange={(e) => setDrugForm({ ...drugForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. TAB-PCM-500"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.drug_name_input"
                    value={drugForm.name}
                    onChange={(e) => setDrugForm({ ...drugForm, name: e.target.value })}
                    placeholder="e.g. Panadol Extra"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.drug_generic_name_input"
                    value={drugForm.generic_name || ""}
                    onChange={(e) => setDrugForm({ ...drugForm, generic_name: e.target.value })}
                    placeholder="e.g. Paracetamol + Caffeine"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Strength</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.drug_strength_input"
                    value={drugForm.strength || ""}
                    onChange={(e) => setDrugForm({ ...drugForm, strength: e.target.value })}
                    placeholder="e.g. 500mg / 65mg"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dosage Form *</label>
                  <select
                    data-help="pharmacy_admin.drug_form_select"
                    value={drugForm.form}
                    onChange={(e) => setDrugForm({ ...drugForm, form: e.target.value as DrugForm })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {DRUG_FORMS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.drug_unit_input"
                    value={drugForm.unit || ""}
                    onChange={(e) => setDrugForm({ ...drugForm, unit: e.target.value })}
                    placeholder="e.g. tablet / vial"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dispensing Schedule *</label>
                  <select
                    data-help="pharmacy_admin.drug_schedule_select"
                    value={drugForm.schedule}
                    onChange={(e) => {
                      const sched = e.target.value as DrugSchedule;
                      setDrugForm({
                        ...drugForm,
                        schedule: sched,
                        // If moving away from OTC, reset OTC allowed
                        is_otc_allowed: sched === "OTC" ? drugForm.is_otc_allowed : false,
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {DRUG_SCHEDULES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">High-Alert Category (MSDS 56)</label>
                  <select
                    data-help="pharmacy_admin.drug_high_alert_select"
                    value={drugForm.high_alert_category || ""}
                    onChange={(e) => {
                      const val = e.target.value ? (e.target.value as HighAlertCategory) : null;
                      setDrugForm({
                        ...drugForm,
                        high_alert_category: val,
                        // If high-alert chosen, it cannot be OTC per rule:609bbe13b3
                        is_otc_allowed: val ? false : drugForm.is_otc_allowed,
                        schedule: val && drugForm.schedule === "OTC" ? "ScheduleH" : drugForm.schedule,
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    <option value="">None (Standard Medicine)</option>
                    {HIGH_ALERT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{HIGH_ALERT_CATEGORY_LABELS[c].en}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkboxes: OTC Allowed & Restricted */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-help="pharmacy_admin.drug_otc_allowed_checkbox"
                    checked={Boolean(drugForm.is_otc_allowed)}
                    disabled={drugForm.schedule !== "OTC" || Boolean(drugForm.high_alert_category)}
                    onChange={(e) => setDrugForm({ ...drugForm, is_otc_allowed: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Is OTC Allowed (Only permitted for OTC schedule without High-Alert status)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-help="pharmacy_admin.drug_restricted_checkbox"
                    checked={Boolean(drugForm.is_restricted)}
                    onChange={(e) => setDrugForm({ ...drugForm, is_restricted: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Is Restricted (Requires RestrictedPrescribing privilege, MSDS 52)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.drug_low_stock_input"
                    value={drugForm.low_stock_threshold || 50}
                    onChange={(e) => setDrugForm({ ...drugForm, low_stock_threshold: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Near Expiry Alert Days</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.drug_near_expiry_input"
                    value={drugForm.near_expiry_alert_days || 90}
                    onChange={(e) => setDrugForm({ ...drugForm, near_expiry_alert_days: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="pharmacy_admin.cancel_drug_modal_btn"
                  onClick={() => setShowAddDrugModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="pharmacy_admin.save_drug_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
                >
                  Save Drug
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH INTAKE (rule:b828c195cc) */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Receive Stock Batch</h3>
                <p className="text-xs text-gray-500">Statutory Rule b828c195cc: Boxes × units per box & invoice cost.</p>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_batch_modal_btn"
                onClick={() => setShowAddBatchModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Drug ID *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.batch_drug_id_input"
                    value={batchForm.drug_id}
                    onChange={(e) => setBatchForm({ ...batchForm, drug_id: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.batch_no_input"
                    value={batchForm.batch_no}
                    onChange={(e) => setBatchForm({ ...batchForm, batch_no: e.target.value.toUpperCase() })}
                    placeholder="e.g. BATCH-2026-X"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Date *</label>
                <input
                  type="date"
                  data-help="pharmacy_admin.batch_expiry_input"
                  value={batchForm.expiry_date}
                  onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Box Quantity *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.batch_box_qty_input"
                    value={batchForm.box_quantity}
                    onChange={(e) => setBatchForm({ ...batchForm, box_quantity: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Units per Box *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.batch_units_per_box_input"
                    value={batchForm.units_per_box}
                    onChange={(e) => setBatchForm({ ...batchForm, units_per_box: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Total Invoice Cost & Live Derived Unit Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Invoice Cost (PKR) *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.batch_total_cost_input"
                    value={batchForm.total_invoice_cost}
                    onChange={(e) => setBatchForm({ ...batchForm, total_invoice_cost: Number(e.target.value) })}
                    min="0"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-semibold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Retail Selling Price (PKR) *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.batch_retail_price_input"
                    value={batchForm.retail_price}
                    onChange={(e) => setBatchForm({ ...batchForm, retail_price: Number(e.target.value) })}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-semibold text-emerald-700"
                  />
                </div>
              </div>

              {/* Live Derived Summary Card */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex justify-between text-xs">
                <div>
                  <span className="text-gray-500">Total Units Received:</span>
                  <div className="font-bold text-gray-900 text-sm">{derivedUnits.toLocaleString()} units</div>
                </div>
                <div>
                  <span className="text-gray-500">Derived Unit Cost:</span>
                  <div className="font-bold text-indigo-800 text-sm">PKR {derivedUnitCost.toFixed(2)} / unit</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="pharmacy_admin.cancel_batch_modal_btn"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="pharmacy_admin.save_batch_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                >
                  Confirm Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK WRITE-OFF / ADJUST */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Stock Adjustment & Write-off</h3>
                <p className="text-xs text-gray-500">POST /pharmacy-admin/batches/{`{id}`}/adjust</p>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_adjust_modal_btn"
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Batch ID *</label>
                <input
                  type="number"
                  data-help="pharmacy_admin.adjust_batch_id_input"
                  value={adjustBatchId}
                  onChange={(e) => setAdjustBatchId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Adjustment Qty *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.adjust_qty_input"
                    value={adjustForm.qty}
                    onChange={(e) => setAdjustForm({ ...adjustForm, qty: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-semibold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason *</label>
                  <select
                    data-help="pharmacy_admin.adjust_reason_select"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value as AdjustmentReason })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mandatory Justification Note *</label>
                <textarea
                  data-help="pharmacy_admin.adjust_note_input"
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  placeholder="Reason for write-off, breakage, or stock variance..."
                  rows={3}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="pharmacy_admin.cancel_adjust_modal_btn"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="pharmacy_admin.save_adjust_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD VENDOR INVOICE */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Record Supplier Invoice</h3>
                <p className="text-xs text-gray-500">Creates matched Accounts Payable in the finance module.</p>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_invoice_modal_btn"
                onClick={() => setShowAddInvoiceModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier / Vendor *</label>
                <select
                  data-help="pharmacy_admin.invoice_vendor_select"
                  value={invoiceForm.vendor_id}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, vendor_id: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                >
                  {vendorList.map((v) => (
                    <option key={v.vendor_id} value={v.vendor_id}>
                      {v.name} ({v.vendor_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    data-help="pharmacy_admin.invoice_no_input"
                    value={invoiceForm.invoice_no}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_no: e.target.value })}
                    placeholder="e.g. INV-998812"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Cost (PKR) *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.invoice_total_cost_input"
                    value={invoiceForm.total_cost}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, total_cost: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-semibold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Type</label>
                  <select
                    data-help="pharmacy_admin.invoice_type_select"
                    value={invoiceForm.invoice_type || "Purchase"}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_type: e.target.value as VendorInvoiceType })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {VENDOR_INVOICE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Module</label>
                  <select
                    data-help="pharmacy_admin.invoice_module_select"
                    value={invoiceForm.module || "Pharmacy"}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, module: e.target.value as VendorInvoiceModule })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {VENDOR_INVOICE_MODULES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    data-help="pharmacy_admin.invoice_date_input"
                    value={invoiceForm.invoice_date || ""}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    data-help="pharmacy_admin.invoice_due_date_input"
                    value={invoiceForm.due_date || ""}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Terms</label>
                <textarea
                  data-help="pharmacy_admin.invoice_notes_input"
                  value={invoiceForm.notes || ""}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  placeholder="Terms, PO reference, or supplier delivery remarks..."
                  rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="pharmacy_admin.cancel_invoice_modal_btn"
                  onClick={() => setShowAddInvoiceModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="pharmacy_admin.save_invoice_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
                >
                  Record Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SUPPLIER RETURN (rule:f65fc1a5a8) */}
      {showAddReturnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Return Stock to Supplier</h3>
                <p className="text-xs text-gray-500">Statutory Rule f65fc1a5a8: Returns with Recall require recall_id.</p>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_return_modal_btn"
                onClick={() => setShowAddReturnModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReturn} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batch ID *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.return_batch_id_input"
                    value={returnBatchId}
                    onChange={(e) => setReturnBatchId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Return Quantity *</label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.return_qty_input"
                    value={returnForm.qty}
                    onChange={(e) => setReturnForm({ ...returnForm, qty: Number(e.target.value) })}
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded font-semibold text-rose-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason *</label>
                  <select
                    data-help="pharmacy_admin.return_reason_select"
                    value={returnForm.reason}
                    onChange={(e) => {
                      const reason = e.target.value as SupplierReturnReason;
                      setReturnForm({
                        ...returnForm,
                        reason,
                        recall_id: reason === "Recall" ? returnForm.recall_id : null,
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    {SUPPLIER_RETURN_REASONS.map((r) => (
                      <option key={r} value={r}>{SUPPLIER_RETURN_REASON_LABELS[r].en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Recall ID {returnForm.reason === "Recall" ? "*" : "(Only for Recall)"}
                  </label>
                  <input
                    type="number"
                    data-help="pharmacy_admin.return_recall_id_input"
                    value={returnForm.recall_id || ""}
                    disabled={returnForm.reason !== "Recall"}
                    onChange={(e) => setReturnForm({ ...returnForm, recall_id: e.target.value ? Number(e.target.value) : null })}
                    placeholder={returnForm.reason === "Recall" ? "e.g. 101" : "Disabled unless Recall"}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded disabled:bg-gray-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier (Optional, defaults to invoice supplier)</label>
                <select
                  data-help="pharmacy_admin.return_vendor_select"
                  value={returnForm.vendor_id || ""}
                  onChange={(e) => setReturnForm({ ...returnForm, vendor_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
                >
                  <option value="">Default to Batch Supplier</option>
                  {vendorList.map((v) => (
                    <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transport & Courier Note *</label>
                <textarea
                  data-help="pharmacy_admin.return_note_input"
                  value={returnForm.note}
                  onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                  placeholder="Carrier name, airway bill / consignment number, return agreement..."
                  rows={3}
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  data-help="pharmacy_admin.cancel_return_modal_btn"
                  onClick={() => setShowAddReturnModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-help="pharmacy_admin.save_return_btn"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Issue Return Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RETURN DETAILS */}
      {selectedReturnDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Return Note: {selectedReturnDetail.return_number}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    selectedReturnDetail.status === "Credited"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedReturnDetail.status === "Refused"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  Status: {selectedReturnDetail.status}
                </span>
              </div>
              <button
                type="button"
                data-help="pharmacy_admin.close_detail_modal_btn"
                onClick={() => setSelectedReturnDetail(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border">
                <div>
                  <span className="text-gray-500">Medicine:</span>
                  <div className="font-bold text-gray-800">{selectedReturnDetail.drug_name}</div>
                </div>
                <div>
                  <span className="text-gray-500">Batch Number:</span>
                  <div className="font-mono font-bold text-gray-800">{selectedReturnDetail.batch_no}</div>
                </div>
                <div>
                  <span className="text-gray-500">Return Quantity:</span>
                  <div className="font-bold text-gray-800">{selectedReturnDetail.qty} units</div>
                </div>
                <div>
                  <span className="text-gray-500">Value At Cost:</span>
                  <div className="font-bold text-purple-700">PKR {selectedReturnDetail.value_at_cost}</div>
                </div>
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <div className="font-semibold text-gray-800">{selectedReturnDetail.vendor_name}</div>
                </div>
                <div>
                  <span className="text-gray-500">Return Reason:</span>
                  <div className="font-semibold text-gray-800">{selectedReturnDetail.reason}</div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-gray-500">Transport Note:</span>
                <p className="text-xs text-gray-700 mt-0.5 bg-slate-50 p-2 rounded border">
                  {selectedReturnDetail.note}
                </p>
              </div>

              {selectedReturnDetail.status === "Credited" && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs space-y-1">
                  <div className="font-bold text-emerald-800">Confirmed Credit Note:</div>
                  <div>Credit Note No: <span className="font-mono font-semibold">{selectedReturnDetail.credit_note_no}</span></div>
                  <div>Credit Amount: <span className="font-bold">PKR {selectedReturnDetail.credit_amount}</span></div>
                  <div>Credit Left to Pay Bills: <span className="font-bold text-emerald-700">PKR {selectedReturnDetail.credit_left}</span></div>
                </div>
              )}

              {selectedReturnDetail.status === "Refused" && (
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs space-y-1">
                  <div className="font-bold text-rose-800">Refused by Supplier:</div>
                  <div>Reason: {selectedReturnDetail.decision_note || "Written off uncredited return claim."}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                data-help="pharmacy_admin.modal_download_pdf_btn"
                onClick={() => handleDownloadReturnPdf(selectedReturnDetail.return_id)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
              >
                📄 Print / Download PDF Note
              </button>
              <button
                type="button"
                data-help="pharmacy_admin.close_detail_modal_btn"
                onClick={() => setSelectedReturnDetail(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
