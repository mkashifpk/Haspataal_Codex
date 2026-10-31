import { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  WardStockOut,
  DrugStockOut,
  WardIndentOut,
  WardStockRemoveIn,
  IndentIn,
  IndentLineIn,
} from "../generated/ward_indent";
import {
  wardInventory,
  searchDrugs,
  createIndent,
  getIndent,
  removeWardStock,
} from "../generated/ward_indent";
import {
  evaluateWardIndentView,
  canCreateIndent,
  canRemoveStock,
  canViewInventory,
  canViewIndent,
  canSearchDrugs,
  validateStockRemovalInput,
  validateIndentDraft,
  inspectInventoryBatch,
  explainIndentError,
  type StockRemovalReason,
  type IndentLineDraft,
} from "../ward-indent-policy";
import { ClinicalWriteFeedback, useClinicalWrite, type ClinicalCommand } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";

export interface WardIndentProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialWardId?: number;
  initialIndentId?: number;
  onNavigateScreen?: (screen: string, contextId?: number) => void;
  onBack?: () => void;
}

export function WardIndent({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  timeZone,
  initialWardId = 1,
  initialIndentId,
  onNavigateScreen,
  onBack,
}: WardIndentProps) {
  const [est, setEst] = useState<EstablishmentOut>(propEstablishment);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  const viewPolicy = evaluateWardIndentView(est);
  const permissions = {
    canCreate: canCreateIndent(user) && viewPolicy.canCreateNewIndent,
    canRemove: canRemoveStock(user) && viewPolicy.canRemoveStock,
    canViewInv: canViewInventory(user) && viewPolicy.canViewRecords,
    canViewInd: canViewIndent(user) && viewPolicy.canViewRecords,
    canSearch: canSearchDrugs(user),
  };

  // Active Tab: cabinet | create | track
  const [activeTab, setActiveTab] = useState<"cabinet" | "create" | "track">("cabinet");

  // Ward Selection
  const [wardId, setWardId] = useState<number>(initialWardId);
  const [revision, setRevision] = useState<number>(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Tab 1: Ward Cabinet Inventory
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<"all" | "usable" | "expired" | "recalled">("all");
  const [removingBatch, setRemovingBatch] = useState<WardStockOut | null>(null);
  const [removeQty, setRemoveQty] = useState<string>("1");
  const [removeReason, setRemoveReason] = useState<StockRemovalReason>("Expiry");
  const [removeNote, setRemoveNote] = useState<string>("");
  const [removeFieldErrors, setRemoveFieldErrors] = useState<Record<string, string>>({});

  // Tab 2: Indent Creation Draft
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<DrugStockOut[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [indentLines, setIndentLines] = useState<IndentLineDraft[]>([]);
  const [indentNote, setIndentNote] = useState<string>("");
  const [draftFieldErrors, setDraftFieldErrors] = useState<Record<string, string>>({});

  // Tab 3: Track Indent
  const [trackIndentId, setTrackIndentId] = useState<string>(initialIndentId ? String(initialIndentId) : "");
  const [trackedIndent, setTrackedIndent] = useState<WardIndentOut | null>(null);
  const [trackLoading, setTrackLoading] = useState<boolean>(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Clinical write controller
  const write = useClinicalWrite(user, "ward_indent", () => {
    setRevision((r) => r + 1);
  });

  // Load Ward Inventory
  const inventoryLoad = useLoad<WardStockOut[]>(
    async () => {
      if (!permissions.canViewInv) return [];
      return await wardInventory(wardId);
    },
    [wardId, revision, permissions.canViewInv]
  );

  // Real-time Event Subscription
  useEffect(() => {
    const handleServerEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{ topic?: string; payload?: unknown }>;
      const topic = custom.detail?.topic || "";

      if (topic === "approval.resolved") {
        setRealtimeNotice(
          t(
            "Indent approval decision received. Ward inventory and tracked requisitions updated.",
            "وارڈ انڈینٹ کی منظوری کا فیصلہ موصول ہوا۔ کیبنٹ اسٹاک اور درخواستیں تازہ ہو گئیں۔"
          )
        );
        setRevision((r) => r + 1);
        if (trackedIndent) {
          loadTrackedIndent(trackedIndent.indent_id);
        }
      } else if (topic === "pharmacy.recall.updated") {
        setRealtimeNotice(
          t(
            "Pharmacy batch recall notice received. Ward inventory refreshed.",
            "فارمیسی بیچ ری کال نوٹس موصول ہوا۔ وارڈ کیبنٹ اسٹاک تازہ ہو گیا ہے۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (topic === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment profile updated. Ward indent view refreshed.",
            "ادارے کی سیٹنگز تبدیل ہوئیں۔ وارڈ انڈینٹ ویو تازہ ہو گیا۔"
          )
        );
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleServerEvent);
    return () => {
      window.removeEventListener("haspataal:event", handleServerEvent);
    };
  }, [trackedIndent]);

  // Drug Search Handler
  const handleSearchDrugs = async () => {
    if (!searchQuery.trim() || !permissions.canSearch) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = await searchDrugs({ q: searchQuery.trim(), limit: 20 });
      setSearchResults(results);
    } catch (err: any) {
      setSearchError(err?.message || "Failed to search formulary drugs.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Add line to indent basket
  const handleAddDrugToIndent = (drug: DrugStockOut) => {
    const existingIndex = indentLines.findIndex((line) => line.drug_id === drug.drug_id);
    if (existingIndex >= 0) {
      const updated = [...indentLines];
      const cur = Number(updated[existingIndex].qty) || 0;
      updated[existingIndex].qty = cur + 1;
      setIndentLines(updated);
    } else {
      setIndentLines([
        ...indentLines,
        {
          drug_id: drug.drug_id,
          drug_name: `${drug.name} (${drug.form})`,
          qty: 1,
          available_stock: drug.qty_available,
        },
      ]);
    }
  };

  const handleRemoveIndentLine = (index: number) => {
    const updated = [...indentLines];
    updated.splice(index, 1);
    setIndentLines(updated);
  };

  const handleUpdateLineQty = (index: number, val: string) => {
    const updated = [...indentLines];
    updated[index].qty = val;
    setIndentLines(updated);
  };

  const handleUpdateLineNote = (index: number, val: string) => {
    const updated = [...indentLines];
    updated[index].note = val;
    setIndentLines(updated);
  };

  // Submit Indent Requisition
  const handleSubmitIndent = async () => {
    const validation = validateIndentDraft({
      ward_id: wardId,
      items: indentLines,
      note: indentNote,
    });

    if (!validation.valid) {
      setDraftFieldErrors(validation.errors);
      return;
    }
    setDraftFieldErrors({});

    const payload: IndentIn = {
      items: indentLines.map((it) => ({
        drug_id: it.drug_id,
        qty: Number(it.qty),
        note: it.note ? it.note.trim() : null,
      })),
      note: indentNote.trim() || null,
    };

    write.start({
      path: `/wards/${wardId}/indents`,
      method: "POST",
      body: payload,
      permission: "ward.indent.create",
      protection: "idempotent",
      label: t("Submit Ward Supply Indent", "وارڈ سپلائی انڈینٹ جمع کروائیں"),
    });
    setIndentLines([]);
    setIndentNote("");
  };

  // Execute Stock Removal (rule:6c0ce3ff85)
  const handleConfirmRemoval = async () => {
    if (!removingBatch) return;

    const validation = validateStockRemovalInput({
      batch_id: removingBatch.batch_id,
      qty: removeQty,
      max_qty: removingBatch.qty,
      reason: removeReason,
      note: removeNote,
    });

    if (!validation.valid) {
      setRemoveFieldErrors(validation.errors);
      return;
    }
    setRemoveFieldErrors({});

    const payload: WardStockRemoveIn = {
      batch_id: removingBatch.batch_id,
      qty: Number(removeQty),
      reason: removeReason,
      note: removeNote.trim(),
    };

    write.start({
      path: `/wards/${wardId}/inventory/remove`,
      method: "POST",
      body: payload,
      permission: "ward.indent.create",
      protection: "idempotent",
      label: t(
        `Remove Stock (${removeReason})`,
        `اسٹاک ہٹائیں (${removeReason})`
      ),
    });
    setRemovingBatch(null);
    setRemoveQty("1");
    setRemoveNote("");
    setRemoveReason("Expiry");
  };

  // Load Tracked Indent
  const loadTrackedIndent = async (idToLoad: number) => {
    if (!idToLoad || !permissions.canViewInd) return;
    setTrackLoading(true);
    setTrackError(null);
    try {
      const data = await getIndent(idToLoad);
      setTrackedIndent(data);
    } catch (err: any) {
      setTrackError(err?.message || "Failed to load indent details.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(trackIndentId);
    if (id > 0) {
      loadTrackedIndent(id);
    }
  };

  // Filter Inventory Batches
  const allStock = inventoryLoad.data || [];
  const expiredCount = allStock.filter((s) => s.is_expired).length;
  const recalledCount = allStock.filter((s) => s.is_recalled).length;
  const usableCount = allStock.filter((s) => !s.is_expired && !s.is_recalled).length;

  const filteredStock = allStock.filter((s) => {
    if (inventoryStatusFilter === "expired") return s.is_expired;
    if (inventoryStatusFilter === "recalled") return s.is_recalled;
    if (inventoryStatusFilter === "usable") return !s.is_expired && !s.is_recalled;
    return true;
  });

  return (
    <div className="ward-indent-screen container" data-help="ward_indent.root">
      {/* Header Banner */}
      <div className="screen-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="h2 mb-1" data-help="ward_indent.header">
              {t("Ward Supply Indent & Inventory", "وارڈ سپلائی انڈینٹ اور کیبنٹ اسٹاک")}
            </h1>
            <p className="text-muted mb-0">
              {t(
                "Request central pharmacy stock and manage ward-local medicine supplies (MSDS 59, 60).",
                "مرکزی فارمیسی سے اسٹاک منگوائیں اور وارڈ کیبنٹ کی ادویات کا انتظام کریں (MSDS 59, 60)۔"
              )}
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            {onBack && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                data-help="ward_indent.back"
                onClick={onBack}
              >
                {t("Back", "واپس")}
              </button>
            )}
            <span className={`badge ${connected ? "bg-success" : "bg-warning text-dark"}`}>
              {connected ? t("Realtime Live", "براہ راست فعال") : t("Offline", "آف لائن")}
            </span>
          </div>
        </div>

        {/* View Policy Retiring / Retired Banner (rule:af4d84840c) */}
        {viewPolicy.bannerMessage && (
          <div
            className={`alert ${viewPolicy.view === "open_work" ? "alert-warning" : "alert-info"} mt-3 mb-0`}
            role="alert"
            data-help="ward_indent.service_banner"
          >
            <strong>{viewPolicy.bannerMessage}</strong>
          </div>
        )}

        {/* Real-time Notice */}
        {realtimeNotice && (
          <div
            className="alert alert-info alert-dismissible fade show mt-3 mb-0 d-flex justify-content-between align-items-center"
            role="alert"
            data-help="ward_indent.realtime_notice"
          >
            <span>{realtimeNotice}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              data-help="ward_indent.btn_dismiss_realtime"
              onClick={() => setRealtimeNotice(null)}
            ></button>
          </div>
        )}
      </div>

      {/* Clinical Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Ward Selector Bar */}
      <div className="card mb-3 p-3 bg-light border">
        <div className="row g-3 align-items-center">
          <div className="col-auto">
            <label htmlFor="wardSelect" className="col-form-label fw-bold">
              {t("Ward:", "وارڈ:")}
            </label>
          </div>
          <div className="col-auto">
            <select
              id="wardSelect"
              className="form-select form-select-sm"
              data-help="ward_indent.ward_id"
              value={wardId}
              onChange={(e) => setWardId(Number(e.target.value) || 1)}
            >
              <option value={1}>{t("Ward 1 - Medical Inpatient", "وارڈ 1 - میڈیکل داخلہ")}</option>
              <option value={2}>{t("Ward 2 - Surgical Inpatient", "وارڈ 2 - سرجیکل داخلہ")}</option>
              <option value={3}>{t("Ward 3 - Pediatric Ward", "وارڈ 3 - بچوں کا وارڈ")}</option>
              <option value={4}>{t("Ward 4 - Maternity & Labour", "وارڈ 4 - زچہ و بچہ")}</option>
              <option value={5}>{t("Ward 5 - Intensive Care Unit", "وارڈ 5 - انتہائی نگہداشت (ICU)")}</option>
            </select>
          </div>
          <div className="col-auto">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-help="ward_indent.refresh_inventory"
              onClick={() => inventoryLoad.reload()}
              disabled={inventoryLoad.loading}
            >
              {inventoryLoad.loading ? t("Refreshing...", "تازہ ہو رہا ہے...") : t("Refresh Stock", "اسٹاک تازہ کریں")}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "cabinet" ? "active fw-bold" : ""}`}
            data-help="ward_indent.tab_cabinet"
            onClick={() => setActiveTab("cabinet")}
          >
            {t("Ward Medicine Cabinet", "وارڈ میڈیسن کیبنٹ")}
            {expiredCount + recalledCount > 0 && (
              <span className="badge bg-danger ms-2">{expiredCount + recalledCount} Alert</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "create" ? "active fw-bold" : ""}`}
            data-help="ward_indent.tab_create"
            onClick={() => setActiveTab("create")}
            disabled={!permissions.canCreate}
          >
            {t("Create Supply Indent", "نئی سپلائی انڈینٹ بنائیں")}
            {indentLines.length > 0 && (
              <span className="badge bg-primary ms-2">{indentLines.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "track" ? "active fw-bold" : ""}`}
            data-help="ward_indent.tab_track"
            onClick={() => setActiveTab("track")}
            disabled={!permissions.canViewInd}
          >
            {t("Track Requisition", "درخواست ٹریک کریں")}
          </button>
        </li>
      </ul>

      {/* TAB 1: WARD MEDICINE CABINET */}
      {activeTab === "cabinet" && (
        <div className="tab-pane active" data-help="ward_indent.cabinet_pane">
          {/* Critical Hazard Alert for Expired/Recalled Stock (rule:6c0ce3ff85) */}
          {(expiredCount > 0 || recalledCount > 0) && (
            <div className="alert alert-danger mb-3" role="alert" data-help="ward_indent.hazard_banner">
              <h5 className="alert-heading fw-bold">
                ⚠️ {t("CRITICAL MEDICATION SAFETY HAZARD (MSDS 59, 60)", "انتہائی اہم دوا ساز سیفٹی خطرہ (MSDS 59, 60)")}
              </h5>
              <p className="mb-0">
                {t(
                  "Expired and recalled medication batches must NEVER be administered to patients. Remove or return immediately using the removal action below.",
                  "میعاد ختم یا واپس طلب شدہ ادویات کے بیچ مریض کو ہرگز نہ دیں۔ نیچے دیے گئے ایکشن کے ذریعے انہیں فوری کیبنٹ سے ہٹائیں۔"
                )}
              </p>
            </div>
          )}

          {/* Cabinet Statistics */}
          <div className="row g-2 mb-3">
            <div className="col-md-3">
              <div className="card text-center p-2 bg-light border">
                <span className="text-muted small">{t("Total Batches", "کل بیجز")}</span>
                <span className="h4 mb-0 fw-bold">{allStock.length}</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center p-2 bg-light border">
                <span className="text-muted small">{t("Usable Stock", "قابل استعمال")}</span>
                <span className="h4 mb-0 fw-bold text-success">{usableCount}</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center p-2 bg-light border">
                <span className="text-muted small">{t("Expired Batches", "میعاد ختم")}</span>
                <span className={`h4 mb-0 fw-bold ${expiredCount > 0 ? "text-danger" : "text-muted"}`}>
                  {expiredCount}
                </span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center p-2 bg-light border">
                <span className="text-muted small">{t("Recalled Batches", "واپس طلب شدہ")}</span>
                <span className={`h4 mb-0 fw-bold ${recalledCount > 0 ? "text-danger" : "text-muted"}`}>
                  {recalledCount}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${inventoryStatusFilter === "all" ? "btn-secondary" : "btn-outline-secondary"}`}
                data-help="ward_indent.filter_status_all"
                onClick={() => setInventoryStatusFilter("all")}
              >
                {t("All Batches", "تمام بیجز")} ({allStock.length})
              </button>
              <button
                type="button"
                className={`btn ${inventoryStatusFilter === "usable" ? "btn-success" : "btn-outline-success"}`}
                data-help="ward_indent.filter_status_usable"
                onClick={() => setInventoryStatusFilter("usable")}
              >
                {t("Usable Only", "صرف قابل استعمال")} ({usableCount})
              </button>
              <button
                type="button"
                className={`btn ${inventoryStatusFilter === "expired" ? "btn-danger" : "btn-outline-danger"}`}
                data-help="ward_indent.filter_status_expired"
                onClick={() => setInventoryStatusFilter("expired")}
              >
                {t("Expired", "میعاد ختم")} ({expiredCount})
              </button>
              <button
                type="button"
                className={`btn ${inventoryStatusFilter === "recalled" ? "btn-danger" : "btn-outline-danger"}`}
                data-help="ward_indent.filter_status_recalled"
                onClick={() => setInventoryStatusFilter("recalled")}
              >
                {t("Recalled", "واپس طلب")} ({recalledCount})
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          <LoadState
            loading={inventoryLoad.loading}
            error={inventoryLoad.error ? String(inventoryLoad.error) : null}
            retry={inventoryLoad.reload}
          />

          {filteredStock.length === 0 ? (
              <Empty>
                {t(
                  "No medication batches found in this ward cabinet.",
                  "اس وارڈ کیبنٹ میں کوئی ادویات کا بیچ موجود نہیں ہے۔"
                )}
              </Empty>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>{t("Drug Name", "دوا کا نام")}</th>
                      <th>{t("Batch No", "بیچ نمبر")}</th>
                      <th>{t("Expiry Date", "میعاد ختم تاریخ")}</th>
                      <th>{t("Quantity", "تعداد")}</th>
                      <th>{t("Status / Safety Inspection", "حالت اور معائنہ")}</th>
                      <th className="text-end">{t("Actions", "کارروائی")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((stock) => {
                      const inspection = inspectInventoryBatch(stock);
                      return (
                        <tr
                          key={`${stock.drug_id}-${stock.batch_id}`}
                          className={inspection.isCritical ? "table-danger" : ""}
                        >
                          <td className="fw-bold">{stock.drug_name}</td>
                          <td>
                            <code>{stock.batch_no}</code>
                          </td>
                          <td>{stock.expiry_date}</td>
                          <td className="fw-bold">{stock.qty}</td>
                          <td>
                            <span
                              className={`badge ${
                                inspection.badgeClass === "badge-danger"
                                  ? "bg-danger"
                                  : "bg-success"
                              } mb-1 d-inline-block`}
                            >
                              {inspection.badgeLabel}
                            </span>
                            <div className="small text-muted">{inspection.clinicalInstruction}</div>
                          </td>
                          <td className="text-end">
                            {permissions.canRemove && (
                              <button
                                type="button"
                                className={`btn btn-sm ${
                                  inspection.isCritical ? "btn-danger" : "btn-outline-danger"
                                }`}
                                data-help="ward_indent.open_remove_modal"
                                onClick={() => {
                                  setRemovingBatch(stock);
                                  setRemoveQty(String(Math.min(1, stock.qty)));
                                  setRemoveReason(inspection.suggestedAction || "Expiry");
                                  setRemoveNote(
                                    stock.is_expired
                                      ? "Expired batch written off according to MSDS 59"
                                      : stock.is_recalled
                                      ? "Recalled batch returned to pharmacy according to MSDS 60"
                                      : ""
                                  );
                                  setRemoveFieldErrors({});
                                }}
                              >
                                {inspection.isCritical
                                  ? t("Write-off / Return", "رائٹ آف / واپسی")
                                  : t("Remove / Return", "ہٹائیں / واپسی")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          {/* Remove / Write-off Stock Modal (rule:6c0ce3ff85) */}
          {removingBatch && (
            <div
              className="modal show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              tabIndex={-1}
              role="dialog"
            >
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                  <div className="modal-header bg-light">
                    <h5 className="modal-title fw-bold">
                      {t("Remove Stock from Ward Cabinet", "وارڈ کیبنٹ سے اسٹاک ہٹائیں")}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      data-help="ward_indent.remove_modal_close"
                      onClick={() => setRemovingBatch(null)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="alert alert-warning py-2 mb-3">
                      <strong>{removingBatch.drug_name}</strong> (Batch: {removingBatch.batch_no})
                      <div>
                        {t("Current Ward Stock:", "وارڈ کا موجودہ اسٹاک:")}{" "}
                        <strong>{removingBatch.qty}</strong>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        {t("Removal Reason (MSDS 59, 60):", "ہٹانے کی وجہ:")}
                      </label>
                      <select
                        className={`form-select ${removeFieldErrors.reason ? "is-invalid" : ""}`}
                        data-help="ward_indent.remove_reason"
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value as StockRemovalReason)}
                      >
                        <option value="Expiry">{t("Expiry (Written Off)", "میعاد ختم (رائٹ آف)")}</option>
                        <option value="Damage">{t("Damage (Written Off)", "خراب دوا (رائٹ آف)")}</option>
                        <option value="ReturnToPharmacy">
                          {t("Return to Central Pharmacy", "مرکزی فارمیسی واپس")}
                        </option>
                      </select>
                      {removeFieldErrors.reason && (
                        <div className="invalid-feedback">{removeFieldErrors.reason}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        {t("Quantity to Remove:", "ہٹانے کی تعداد:")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={removingBatch.qty}
                        step="1"
                        className={`form-control ${removeFieldErrors.qty ? "is-invalid" : ""}`}
                        data-help="ward_indent.remove_qty"
                        value={removeQty}
                        onChange={(e) => setRemoveQty(e.target.value)}
                      />
                      {removeFieldErrors.qty && (
                        <div className="invalid-feedback">{removeFieldErrors.qty}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        {t("Action Note (Reason & Justification):", "تفصیلی نوٹ اور تصدیق:")}
                      </label>
                      <textarea
                        rows={3}
                        className={`form-control ${removeFieldErrors.note ? "is-invalid" : ""}`}
                        data-help="ward_indent.remove_note"
                        placeholder={t(
                          "Explain batch disposal, destruction, or pharmacy return protocol (min 3 chars)...",
                          "بیچ کو ضائع کرنے یا فارمیسی واپسی کی وجہ درج کریں (کم از کم 3 حروف)..."
                        )}
                        value={removeNote}
                        onChange={(e) => setRemoveNote(e.target.value)}
                      />
                      <div className="form-text">
                        {removeNote.length}/500 {t("characters", "حروف")}
                      </div>
                      {removeFieldErrors.note && (
                        <div className="invalid-feedback">{removeFieldErrors.note}</div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-help="ward_indent.remove_cancel"
                      onClick={() => setRemovingBatch(null)}
                      disabled={write.busy}
                    >
                      {t("Cancel", "منسوخ")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      data-help="ward_indent.remove_submit"
                      onClick={handleConfirmRemoval}
                      disabled={write.busy}
                    >
                      {write.busy
                        ? t("Processing...", "عمل جاری ہے...")
                        : t("Confirm Removal", "ہٹانے کی تصدیق کریں")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE SUPPLY INDENT */}
      {activeTab === "create" && (
        <div className="tab-pane active" data-help="ward_indent.create_pane">
          <div className="row g-4">
            {/* Left: Formulary Drug Search */}
            <div className="col-md-5">
              <div className="card h-100 p-3 shadow-sm border">
                <h5 className="card-title fw-bold mb-3">
                  {t("Search Hospital Formulary", "ہسپتال فارمولری میں تلاش")}
                </h5>

                <div className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t("Drug name or generic...", "دوا کا تجارتی یا عام نام...")}
                    data-help="ward_indent.search_query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchDrugs();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-help="ward_indent.search_button"
                    onClick={handleSearchDrugs}
                    disabled={searchLoading || !searchQuery.trim()}
                  >
                    {searchLoading ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                  </button>
                </div>

                {searchError && <div className="alert alert-danger py-2">{searchError}</div>}

                <div className="search-results-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {searchResults.length === 0 ? (
                    <div className="text-muted text-center py-4">
                      {t("Type a medicine name to search central stock.", "مرکزی فارمیسی اسٹاک سے ادویات تلاش کریں۔")}
                    </div>
                  ) : (
                    searchResults.map((drug) => (
                      <div
                        key={drug.drug_id}
                        className="card mb-2 p-2 border-start border-3"
                        style={{
                          borderLeftColor:
                            drug.stock_status === "InStock"
                              ? "#198754"
                              : drug.stock_status === "Low"
                              ? "#ffc107"
                              : "#dc3545",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-bold">{drug.name}</div>
                            <div className="small text-muted">
                              {drug.generic_name} • {drug.form} ({drug.unit})
                            </div>
                            <div className="mt-1">
                              <span
                                className={`badge ${
                                  drug.stock_status === "InStock"
                                    ? "bg-success"
                                    : drug.stock_status === "Low"
                                    ? "bg-warning text-dark"
                                    : "bg-secondary"
                                } me-1`}
                              >
                                {drug.stock_status}: {drug.qty_available}
                              </span>
                              {drug.high_alert_category && (
                                <span className="badge bg-danger me-1">
                                  High-Alert: {drug.high_alert_category}
                                </span>
                              )}
                              {drug.lasa_with && drug.lasa_with.length > 0 && (
                                <span className="badge bg-warning text-dark">
                                  LASA: {drug.lasa_with.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            data-help="ward_indent.add_drug_button"
                            onClick={() => handleAddDrugToIndent(drug)}
                          >
                            + {t("Add", "شامل")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Requisition Basket */}
            <div className="col-md-7">
              <div className="card h-100 p-3 shadow-sm border">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="card-title fw-bold mb-0">
                    {t("Requisition Lines (Indent Items)", "طلب کی جانے والی ادویات")}
                  </h5>
                  <span className="badge bg-primary">{indentLines.length} {t("Items", "اشیاء")}</span>
                </div>

                {draftFieldErrors.items && (
                  <div className="alert alert-danger py-2 mb-3">{draftFieldErrors.items}</div>
                )}

                {indentLines.length === 0 ? (
                  <Empty>
                    {t(
                      "No medicines added to requisition yet.",
                      "انڈینٹ میں ابھی کوئی دوا شامل نہیں کی گئی ہے۔"
                    )}
                  </Empty>
                ) : (
                  <div className="table-responsive mb-3" style={{ maxHeight: "350px", overflowY: "auto" }}>
                    <table className="table table-sm table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>{t("Drug Name", "دوا")}</th>
                          <th style={{ width: "110px" }}>{t("Quantity", "تعداد")}</th>
                          <th>{t("Clinical Note", "نوٹ")}</th>
                          <th style={{ width: "50px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {indentLines.map((line, idx) => (
                          <tr key={line.drug_id}>
                            <td>
                              <div className="fw-bold small">{line.drug_name}</div>
                              {line.available_stock !== undefined && (
                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                  Central Stock: {line.available_stock}
                                </div>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                className={`form-control form-control-sm ${
                                  draftFieldErrors[`items[${idx}].qty`] ? "is-invalid" : ""
                                }`}
                                data-help="ward_indent.item_qty"
                                value={line.qty}
                                onChange={(e) => handleUpdateLineQty(idx, e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={t("e.g. Post-op emergency stock", "مثلاً ایمرجنسی اسٹاک")}
                                data-help="ward_indent.item_note"
                                value={line.note || ""}
                                onChange={(e) => handleUpdateLineNote(idx, e.target.value)}
                              />
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm p-1"
                                data-help="ward_indent.remove_line_button"
                                onClick={() => handleRemoveIndentLine(idx)}
                                title={t("Remove item", "آئٹم ہٹائیں")}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Overall Indent Note */}
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    {t("Requisition Note (Optional):", "انڈینٹ کا عمومی نوٹ:")}
                  </label>
                  <textarea
                    rows={2}
                    className={`form-control form-control-sm ${
                      draftFieldErrors.note ? "is-invalid" : ""
                    }`}
                    placeholder={t(
                      "Optional note for pharmacy store admin regarding urgent supply needs...",
                      "فارمیسی اسٹور ایڈمن کے لیے کوئی ضروری ہدایات درج کریں..."
                    )}
                    data-help="ward_indent.indent_note"
                    value={indentNote}
                    onChange={(e) => setIndentNote(e.target.value)}
                  />
                  {draftFieldErrors.note && (
                    <div className="invalid-feedback">{draftFieldErrors.note}</div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-success fw-bold"
                    data-help="ward_indent.submit_indent"
                    onClick={handleSubmitIndent}
                    disabled={write.busy || indentLines.length === 0}
                  >
                    {write.busy
                      ? t("Submitting Indent...", "انڈینٹ بھیجا جا رہا ہے...")
                      : t("Submit Indent to Pharmacy", "فارمیسی کو انڈینٹ بھیجیں")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRACK REQUISITION */}
      {activeTab === "track" && (
        <div className="tab-pane active" data-help="ward_indent.track_pane">
          {/* Tracker Search Form */}
          <div className="card mb-3 p-3 bg-light border">
            <form onSubmit={handleTrackSubmit} className="row g-2 align-items-center">
              <div className="col-auto">
                <label htmlFor="trackInput" className="col-form-label fw-bold">
                  {t("Indent Requisition ID:", "انڈینٹ نمبر:")}
                </label>
              </div>
              <div className="col-auto">
                <input
                  id="trackInput"
                  type="number"
                  min="1"
                  className="form-control form-control-sm"
                  placeholder="e.g. 1"
                  data-help="ward_indent.track_indent_id"
                  value={trackIndentId}
                  onChange={(e) => setTrackIndentId(e.target.value)}
                />
              </div>
              <div className="col-auto">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  data-help="ward_indent.track_button"
                  disabled={trackLoading || !trackIndentId}
                >
                  {trackLoading ? t("Loading...", "لوڈ ہو رہا ہے...") : t("Track Requisition", "ٹریک کریں")}
                </button>
              </div>
            </form>
          </div>

          {trackError && <div className="alert alert-danger py-2 mb-3">{trackError}</div>}

          {/* Indent Display */}
          {trackedIndent ? (
            <div className="card p-3 shadow-sm border" data-help="ward_indent.tracked_card">
              <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-3">
                <div>
                  <h4 className="fw-bold mb-1">
                    {t("Indent #", "انڈینٹ نمبر #")}{trackedIndent.indent_id} — {trackedIndent.ward_name}
                  </h4>
                  <div className="small text-muted">
                    {t("Requested at:", "درخواست کا وقت:")}{" "}
                    {formatHospitalTime(trackedIndent.requested_at, timeZone || "Asia/Karachi")}
                  </div>
                </div>
                <div>
                  <span
                    className={`badge fs-6 ${
                      trackedIndent.status === "Approved"
                        ? "bg-success"
                        : trackedIndent.status === "PartiallyApproved"
                        ? "bg-warning text-dark"
                        : trackedIndent.status === "Pending"
                        ? "bg-primary"
                        : "bg-danger"
                    }`}
                  >
                    {trackedIndent.status}
                  </span>
                </div>
              </div>

              {trackedIndent.status === "Pending" && (
                <div className="alert alert-info py-2 mb-3">
                  <strong>ℹ️ {t("Awaiting Approval:", "منظوری کی منتظر:")}</strong>{" "}
                  {t(
                    "This supply requisition is under review by central pharmacy administration. Quantities are frozen until approved (approval.resolved).",
                    "یہ درخواست مرکزی فارمیسی ایڈمنسٹریشن کی زیرِ جائزہ ہے۔ منظوری تک تعداد منجمد رہے گی۔"
                  )}
                </div>
              )}

              {trackedIndent.note && (
                <div className="mb-3">
                  <span className="fw-bold">{t("Requisition Note:", "درخواست کا نوٹ:")}</span>{" "}
                  <span className="fst-italic">{trackedIndent.note}</span>
                </div>
              )}

              <h6 className="fw-bold mb-2">{t("Requisition Items & Approvals:", "طلب کردہ ادویات اور منظور شدہ مقدار:")}</h6>
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>{t("Drug Name", "دوا")}</th>
                      <th>{t("Requested Qty", "طلب کردہ")}</th>
                      <th>{t("Approved Qty", "منظور شدہ")}</th>
                      <th>{t("Central Stock", "مرکزی اسٹاک")}</th>
                      <th>{t("Item Note", "نوٹ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedIndent.items.map((item) => (
                      <tr key={item.ward_indent_item_id}>
                        <td className="fw-bold">{item.drug_name}</td>
                        <td>{item.qty_requested}</td>
                        <td>
                          {item.qty_approved !== null ? (
                            <span className="badge bg-success">{item.qty_approved}</span>
                          ) : (
                            <span className="text-muted">{t("Pending", "زیرِ جائزہ")}</span>
                          )}
                        </td>
                        <td>
                          {item.central_stock !== null ? (
                            item.central_stock
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>{item.note || <span className="text-muted">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Empty>
              {t(
                "No indent loaded. Enter an indent ID above to inspect approval status and central stock.",
                "کوئی انڈینٹ منتخب نہیں ہے۔ منظوری اور اسٹاک کی معلومات کے لیے اوپر انڈینٹ نمبر درج کریں۔"
              )}
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}
