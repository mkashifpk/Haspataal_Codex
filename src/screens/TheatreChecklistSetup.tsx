import React, { useEffect, useState, useMemo, useCallback } from "react";
import { bilingual as t } from "../i18n";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  ChecklistItemOut,
  ChecklistItemIn,
  ChecklistItemUpdateIn,
} from "../generated/theatre_checklist_setup";
import {
  listChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  theatrePolicyPdf,
  listPrivileges,
} from "../generated/theatre_checklist_setup";
import {
  evaluateChecklistSetupView,
  canConfigureChecklist,
  canViewChecklist,
  canViewTheatrePolicy,
  sortChecklistItems,
  validateChecklistItemIn,
  validateChecklistItemUpdate,
  explainChecklistSetupError,
  PHASE_CONFIG,
  type ChecklistPhase,
  type ClinicalUser,
} from "../theatre-checklist-policy";

export interface TheatreChecklistSetupProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
}

export function TheatreChecklistSetup({
  user,
  establishment,
  connected = true,
  stream,
  timeZone,
  onNavigateScreen,
  onBack,
}: TheatreChecklistSetupProps) {
  // Service view capability (Rule: 9c5c94d2a1)
  const viewInfo = useMemo(() => evaluateChecklistSetupView(establishment), [establishment]);
  const userCanConfigure = useMemo(() => canConfigureChecklist(user), [user]);
  const userCanView = useMemo(() => canViewChecklist(user), [user]);
  const userCanViewPolicy = useMemo(() => canViewTheatrePolicy(user), [user]);

  // Main state
  const [items, setItems] = useState<ChecklistItemOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<{ en: string; ur: string; actionEn?: string; actionUr?: string } | null>(null);

  // Tab: "All" | "SignIn" | "TimeOut" | "SignOut" | "Recovery"
  const [activeTab, setActiveTab] = useState<string>("All");

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addPhase, setAddPhase] = useState<ChecklistPhase>("SignIn");
  const [addPrompt, setAddPrompt] = useState<string>("");
  const [addKind, setAddKind] = useState<"Confirm" | "Question">("Confirm");
  const [addAllowNa, setAddAllowNa] = useState<boolean>(false);
  const [addNoteWhen, setAddNoteWhen] = useState<string>("");
  const [addReference, setAddReference] = useState<string>("");
  const [addSortOrder, setAddSortOrder] = useState<number>(10);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState<boolean>(false);

  // Edit Item Modal
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ChecklistItemOut | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [editKind, setEditKind] = useState<"Confirm" | "Question">("Confirm");
  const [editAllowNa, setEditAllowNa] = useState<boolean>(false);
  const [editNoteWhen, setEditNoteWhen] = useState<string>("");
  const [editReference, setEditReference] = useState<string>("");
  const [editSortOrder, setEditSortOrder] = useState<number>(10);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  // Theatre Policy PDF Modal
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [policyLoading, setPolicyLoading] = useState<boolean>(false);

  // Success notifications
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Load Checklist Items
  const loadChecklist = useCallback(async () => {
    if (!userCanView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listChecklistItems({
        include_inactive: includeInactive,
      });
      setItems(data || []);
    } catch (err: unknown) {
      const explained = explainChecklistSetupError(err);
      setErrorMsg({
        en: explained.message,
        ur: explained.messageUr,
        actionEn: explained.action,
        actionUr: explained.actionUr,
      });
    } finally {
      setLoading(false);
    }
  }, [userCanView, includeInactive]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  // Filter items by phase and search query
  const displayedItems = useMemo(() => {
    let filtered = items;
    if (activeTab !== "All" && activeTab !== "Recovery") {
      filtered = filtered.filter((i) => i.phase === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (i) =>
          i.prompt.toLowerCase().includes(q) ||
          (i.reference && i.reference.toLowerCase().includes(q))
      );
    }
    return sortChecklistItems(filtered);
  }, [items, activeTab, searchQuery]);

  // Phase item counts
  const phaseCounts = useMemo(() => {
    let signIn = 0;
    let timeOut = 0;
    let signOut = 0;
    let activeTotal = 0;

    for (const item of items) {
      if (item.is_active) {
        activeTotal++;
        if (item.phase === "SignIn") signIn++;
        else if (item.phase === "TimeOut") timeOut++;
        else if (item.phase === "SignOut") signOut++;
      }
    }

    return { signIn, timeOut, signOut, activeTotal, total: items.length };
  }, [items]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const defaultPhase: ChecklistPhase =
      activeTab === "SignIn" || activeTab === "TimeOut" || activeTab === "SignOut"
        ? (activeTab as ChecklistPhase)
        : "SignIn";
    setAddPhase(defaultPhase);
    setAddPrompt("");
    setAddKind("Confirm");
    setAddAllowNa(false);
    setAddNoteWhen("");
    setAddReference("");
    setAddSortOrder((phaseCounts.activeTotal + 1) * 10);
    setAddErrors({});
    setShowAddModal(true);
  };

  // Submit Add Item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ChecklistItemIn = {
      phase: addPhase,
      prompt: addPrompt.trim(),
      kind: addKind,
      allow_na: addAllowNa,
      note_when: addNoteWhen ? (addNoteWhen as "Yes" | "No") : null,
      reference: addReference.trim() || null,
      sort_order: Number(addSortOrder),
    };

    const val = validateChecklistItemIn(payload);
    if (!val.valid) {
      setAddErrors(val.errors);
      return;
    }

    setAddSubmitting(true);
    setAddErrors({});
    try {
      await addChecklistItem(payload);
      setShowAddModal(false);
      setSuccessBanner({
        en: `Checklist item added to "${PHASE_CONFIG[addPhase].en}" successfully.`,
        ur: `چیک لسٹ آئٹم "${PHASE_CONFIG[addPhase].ur}" میں کامیابی سے شامل ہو گیا۔`,
      });
      await loadChecklist();
    } catch (err: unknown) {
      const explained = explainChecklistSetupError(err);
      setAddErrors({
        submit: `${explained.message} (${explained.action})`,
      });
    } finally {
      setAddSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ChecklistItemOut) => {
    setEditingItem(item);
    setEditPrompt(item.prompt);
    setEditKind(item.kind);
    setEditAllowNa(item.allow_na);
    setEditNoteWhen(item.note_when || "");
    setEditReference(item.reference || "");
    setEditSortOrder(item.sort_order);
    setEditIsActive(item.is_active);
    setEditErrors({});
    setShowEditModal(true);
  };

  // Submit Edit Item
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const payload: ChecklistItemUpdateIn = {
      prompt: editPrompt.trim(),
      kind: editKind,
      allow_na: editAllowNa,
      note_when: editNoteWhen ? (editNoteWhen as "Yes" | "No") : null,
      reference: editReference.trim() || null,
      sort_order: Number(editSortOrder),
      is_active: editIsActive,
      expected_version: editingItem.row_version,
    };

    const val = validateChecklistItemUpdate(payload);
    if (!val.valid) {
      setEditErrors(val.errors);
      return;
    }

    setEditSubmitting(true);
    setEditErrors({});
    try {
      await updateChecklistItem(editingItem.item_id, payload);
      setShowEditModal(false);
      setSuccessBanner({
        en: `Checklist item #${editingItem.item_id} updated successfully.`,
        ur: `چیک لسٹ آئٹم #${editingItem.item_id} میں ترامیم محفوظ ہو گئیں۔`,
      });
      await loadChecklist();
    } catch (err: unknown) {
      const explained = explainChecklistSetupError(err);
      setEditErrors({
        submit: `${explained.message} (${explained.action})`,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  // Quick Retire / Reactivate (Rule: dfc29fbd11)
  const handleToggleActive = async (item: ChecklistItemOut) => {
    try {
      await updateChecklistItem(item.item_id, {
        is_active: !item.is_active,
        expected_version: item.row_version,
      });
      setSuccessBanner({
        en: item.is_active
          ? `Checklist item #${item.item_id} retired. Past pauses retain historical text (Rule dfc29fbd11).`
          : `Checklist item #${item.item_id} reactivated.`,
        ur: item.is_active
          ? `چیک لسٹ آئٹم #${item.item_id} ریٹائر کر دیا گیا۔ سابقہ جراحی ریکارڈز محفوظ رہیں گے۔`
          : `چیک لسٹ آئٹم #${item.item_id} دوبارہ فعال کر دیا گیا۔`,
      });
      await loadChecklist();
    } catch (err: unknown) {
      const explained = explainChecklistSetupError(err);
      setErrorMsg({
        en: explained.message,
        ur: explained.messageUr,
        actionEn: explained.action,
        actionUr: explained.actionUr,
      });
    }
  };

  // View Theatre Policy PDF (Rule: db51912b86)
  const handleViewPolicy = async () => {
    setShowPolicyModal(true);
    setPolicyLoading(true);
    try {
      await theatrePolicyPdf();
    } catch {
      // Ignored for presentation
    } finally {
      setPolicyLoading(false);
    }
  };

  return (
    <div className="workspace-screen theatre-checklist-setup-screen">
      {/* Capability notice banner (Rule: 9c5c94d2a1) */}
      {viewInfo.banner && (
        <div className={`notice notice-${viewInfo.view === "records" ? "info" : "warning"}`} role="alert">
          <strong>{viewInfo.banner}</strong>
        </div>
      )}

      {/* Success alert */}
      {successBanner && (
        <div className="notice notice-success" role="status">
          <p>{t(successBanner.en, successBanner.ur)}</p>
          <button
            type="button"
            className="btn-link"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss success notice"
            data-help="theatre_checklist_setup.dismiss_success"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="notice notice-danger" role="alert">
          <p>
            <strong>{t(errorMsg.en, errorMsg.ur)}</strong>
          </p>
          {errorMsg.actionEn && (
            <p className="notice-subtext">{t(errorMsg.actionEn, errorMsg.actionUr || "")}</p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="screen-header">
        <div className="title-area">
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary back-button"
              onClick={onBack}
              data-help="theatre_checklist_setup.back_button"
            >
              ← {t("Back", "واپس")}
            </button>
          )}
          <h1>{t("Surgical Safety Checklist & Theatre Policy", "سرجیکل سیفٹی چیک لسٹ اور تھیٹر پالیسی")}</h1>
          <p className="subtitle">
            {t(
              "WHO surgical safety checklist phases (Sign In, Time Out, Sign Out), recovery criteria, and theatre policy (MSDS COP 31, 39, 41, 44).",
              "ڈبلیو ایچ او سرجیکل سیفٹی چیک لسٹ کے مراحل (سائن اِن، ٹائم آؤٹ، سائن آؤٹ)، ریکوری کے معیارات اور آپریشن تھیٹر پالیسی۔"
            )}
          </p>
        </div>

        <div className="header-actions">
          {userCanViewPolicy && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleViewPolicy}
              data-help="theatre_checklist_setup.theatre_policy_button"
            >
              📄 {t("Theatre Policy (PDF)", "تھیٹر پالیسی (پی ڈی ایف)")}
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={loadChecklist}
            disabled={loading}
            data-help="theatre_checklist_setup.refresh_button"
          >
            🔄 {t("Refresh", "تازہ کریں")}
          </button>

          {userCanConfigure && viewInfo.canConfigure && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              data-help="theatre_checklist_setup.add_item_button"
            >
              ➕ {t("Add Checklist Item", "نیا آئٹم شامل کریں")}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-container">
        <button
          type="button"
          className={`tab-btn ${activeTab === "All" ? "active" : ""}`}
          onClick={() => setActiveTab("All")}
          data-help="theatre_checklist_setup.tab_all"
        >
          {t("All Checklist Items", "تمام چیک لسٹ آئٹمز")} ({phaseCounts.activeTotal})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "SignIn" ? "active" : ""}`}
          onClick={() => setActiveTab("SignIn")}
          data-help="theatre_checklist_setup.tab_signin"
        >
          {t("1. Sign In", "1. سائن اِن")} ({phaseCounts.signIn})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "TimeOut" ? "active" : ""}`}
          onClick={() => setActiveTab("TimeOut")}
          data-help="theatre_checklist_setup.tab_timeout"
        >
          {t("2. Time Out", "2. ٹائم آؤٹ")} ({phaseCounts.timeOut})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "SignOut" ? "active" : ""}`}
          onClick={() => setActiveTab("SignOut")}
          data-help="theatre_checklist_setup.tab_signout"
        >
          {t("3. Sign Out", "3. سائن آؤٹ")} ({phaseCounts.signOut})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "Recovery" ? "active" : ""}`}
          onClick={() => setActiveTab("Recovery")}
          data-help="theatre_checklist_setup.tab_recovery"
        >
          ⚙️ {t("Recovery Criteria Settings", "ریکوری معیارات و سیٹنگز")}
        </button>
      </div>

      {/* Recovery Criteria Tab View (Rule: e7c038dc17) */}
      {activeTab === "Recovery" ? (
        <div className="recovery-criteria-panel">
          <div className="notice notice-info">
            <strong>{t("Statutory Recovery Standards (Rule e7c038dc17)", "قانونی ریکوری معیارات")}</strong>:{" "}
            {t(
              "Post-anaesthesia care and discharge criteria are governed by hospital settings (PUT /admin/settings/{key}). Patients must meet minimum recovery criteria before being discharged back to wards.",
              "اینستھیزیا کے بعد بحالی اور وارڈ واپسی کے لیے ہسپتال سیٹنگز کے تحت طے شدہ کم از کم ریکوری معیار پر پورا اترنا لازمی ہے۔"
            )}
          </div>

          <div className="criteria-grid">
            <div className="criteria-card">
              <div className="criteria-header">
                <h3>{t("Minimum Aldrete Recovery Score", "کم از کم ایلڈریٹ اسکور")}</h3>
                <code>ot_recovery_min_score</code>
              </div>
              <p className="criteria-value">9 / 10</p>
              <p className="criteria-desc">
                {t(
                  "Activity, respiration, circulation, consciousness, and O2 saturation. Score >= 9 required for discharge to ward.",
                  "حرکت، سانس، دورانِ خون، ہوش اور آکسیجن۔ وارڈ بھیجنے کے لیے 9 یا اس سے زیادہ اسکور لازمی ہے۔"
                )}
              </p>
            </div>

            <div className="criteria-card">
              <div className="criteria-header">
                <h3>{t("Maximum Permissible Pain Score", "درد کی زیادہ سے زیادہ حد")}</h3>
                <code>ot_recovery_max_pain</code>
              </div>
              <p className="criteria-value">&le; 2 / 10</p>
              <p className="criteria-desc">
                {t(
                  "Visual analogue scale (VAS). Post-operative pain must be controlled at 2 or below before discharge.",
                  "درد کا اسکیل۔ وارڈ منتقلی سے پہلے مریض کا درد 2 یا اس سے کم ہونا لازمی ہے۔"
                )}
              </p>
            </div>

            <div className="criteria-card">
              <div className="criteria-header">
                <h3>{t("Recovery Vital Signs Interval", "ریکوری میں علامات کا وقفہ")}</h3>
                <code>ot_recovery_obs_minutes</code>
              </div>
              <p className="criteria-value">15 {t("min", "منٹ")}</p>
              <p className="criteria-desc">
                {t(
                  "Vital signs (BP, pulse, respiration, SpO2, Aldrete score) must be monitored at least every 15 minutes in recovery.",
                  "ریکوری روم میں ہر 15 منٹ بعد مریض کی نبض، بلڈ پریشر، سانس اور ہوش کا معائنہ لازمی ہے۔"
                )}
              </p>
            </div>

            <div className="criteria-card">
              <div className="criteria-header">
                <h3>{t("Maximum Recovery Room Stay", "ریکوری روم میں قیام کی زیادہ سے زیادہ حد")}</h3>
                <code>ot_recovery_max_minutes</code>
              </div>
              <p className="criteria-value">120 {t("min", "منٹ")}</p>
              <p className="criteria-desc">
                {t(
                  "Patients remaining in recovery longer than 120 minutes trigger escalation for extended monitoring.",
                  "اگر مریض 120 منٹ سے زیادہ ریکوری میں رہے تو خصوصی معائنے اور الرٹ کا عمل شروع ہوتا ہے۔"
                )}
              </p>
            </div>

            <div className="criteria-card">
              <div className="criteria-header">
                <h3>{t("Intraoperative Anaesthesia Chart Interval", "اینستھیزیا چارٹ کا وقفہ")}</h3>
                <code>ot_anaesthesia_chart_minutes</code>
              </div>
              <p className="criteria-value">5 {t("min", "منٹ")}</p>
              <p className="criteria-desc">
                {t(
                  "During surgery, anaesthetists chart physiological parameters and agent administration every 5 minutes.",
                  "سرجری کے دوران اینستھیٹسٹ ہر 5 منٹ بعد مریض کی علامات اور گیسز کا چارٹ تیار کرتا ہے۔"
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Phase Banner */}
          {activeTab !== "All" && (
            <div className={`phase-info-banner ${PHASE_CONFIG[activeTab as ChecklistPhase].badgeClass}`}>
              <div className="phase-timing">
                ⏱️ {PHASE_CONFIG[activeTab as ChecklistPhase].timingEn} (
                {PHASE_CONFIG[activeTab as ChecklistPhase].timingUr})
              </div>
              <div className="phase-desc">
                {t(
                  PHASE_CONFIG[activeTab as ChecklistPhase].descriptionEn,
                  PHASE_CONFIG[activeTab as ChecklistPhase].descriptionUr
                )}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="search-group">
              <label htmlFor="checklist-search" className="sr-only">
                {t("Search checklist prompt", "چیک لسٹ سوال تلاش کریں")}
              </label>
              <input
                id="checklist-search"
                type="search"
                className="form-control"
                placeholder={t(
                  "Search checklist prompt or reference (e.g. consent, pulse oximeter, MSDS 44)...",
                  "چیک لسٹ سوال یا ریفرنس سے تلاش کریں (مثلاً consent, pulse oximeter, MSDS 44)..."
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-help="theatre_checklist_setup.search_input"
              />
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  data-help="theatre_checklist_setup.include_inactive"
                />
                {t("Include retired items", "ریٹائر شدہ آئٹمز بھی دکھائیں")} (Rule dfc29fbd11)
              </label>
            </div>
          </div>

          {/* Items Table */}
          <div className="table-container">
            {loading ? (
              <div className="loading-state" role="status">
                <div className="spinner" />
                <p>{t("Loading surgical safety checklist items...", "سرجیکل سیفٹی چیک لسٹ لوڈ ہو رہی ہے...")}</p>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="empty-state">
                <p>
                  {t(
                    "No surgical safety checklist items match the current filter.",
                    "موجودہ فلٹر کے تحت کوئی چیک لسٹ آئٹم نہیں ملا۔"
                  )}
                </p>
                {userCanConfigure && viewInfo.canConfigure && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleOpenAddModal}
                    data-help="theatre_checklist_setup.add_item_button"
                  >
                    ➕ {t("Add New Item", "نیا آئٹم شامل کریں")}
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover checklist-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>{t("Order", "ترتیب")}</th>
                      <th style={{ width: "110px" }}>{t("Phase", "مرحلہ")}</th>
                      <th>{t("Checklist Prompt / Question", "سوال یا تصدیقی عبارت")}</th>
                      <th style={{ width: "130px" }}>{t("Type", "قسم")}</th>
                      <th style={{ width: "130px" }}>{t("Condition", "شرائط")}</th>
                      <th style={{ width: "120px" }}>{t("Reference", "ریفرنس")}</th>
                      <th style={{ width: "90px" }}>{t("Status", "حالت")}</th>
                      <th style={{ width: "160px" }}>{t("Actions", "اقدامات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedItems.map((item) => (
                      <tr
                        key={item.item_id}
                        className={!item.is_active ? "row-retired" : ""}
                      >
                        <td>
                          <code>#{item.sort_order}</code>
                        </td>
                        <td>
                          <span className={`badge ${PHASE_CONFIG[item.phase].badgeClass}`}>
                            {PHASE_CONFIG[item.phase].en}
                          </span>
                        </td>
                        <td className="prompt-cell">
                          <strong>{item.prompt}</strong>
                        </td>
                        <td>
                          <span className={`badge ${item.kind === "Confirm" ? "badge-info" : "badge-secondary"}`}>
                            {item.kind === "Confirm" ? t("Confirmation", "تصدیق") : t("Question", "سوال")}
                          </span>
                        </td>
                        <td>
                          {item.allow_na && (
                            <span className="badge badge-light" title={t("May be marked not applicable", "غیر متعلقہ بھی ہو سکتا ہے")}>
                              {t("Allow N/A", "N/A مجاز")}
                            </span>
                          )}
                          {item.note_when && (
                            <span className="badge badge-warning" title={t(`Note required when answered ${item.note_when}`, `${item.note_when} پر نوٹ لازمی`)}>
                              {t(`Note if ${item.note_when}`, `نوٹ اگر ${item.note_when}`)}
                            </span>
                          )}
                        </td>
                        <td>
                          {item.reference ? (
                            <code>{item.reference}</code>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${item.is_active ? "badge-success" : "badge-danger"}`}>
                            {item.is_active ? t("Active", "فعال") : t("Retired", "ریٹائر")}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {userCanConfigure && !viewInfo.isReadOnly && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => handleOpenEditModal(item)}
                                data-help="theatre_checklist_setup.edit_item_button"
                                title={t("Edit checklist prompt, ordering, or condition", "ترتیب یا سوال میں ترمیم کریں")}
                              >
                                ✏️ {t("Edit", "ترمیم")}
                              </button>

                              <button
                                type="button"
                                className={`btn btn-sm ${item.is_active ? "btn-warning-outline" : "btn-success-outline"}`}
                                onClick={() => handleToggleActive(item)}
                                data-help="theatre_checklist_setup.toggle_active_button"
                                title={
                                  item.is_active
                                    ? t("Retire item (Rule dfc29fbd11)", "آئٹم ریٹائر کریں")
                                    : t("Reactivate item", "آئٹم دوبارہ فعال کریں")
                                }
                              >
                                {item.is_active ? t("Retire", "ریٹائر") : t("Activate", "فعال")}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>{t("Add Surgical Safety Checklist Item", "نیا سرجیکل سیفٹی چیک لسٹ آئٹم شامل کریں")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowAddModal(false)}
                data-help="theatre_checklist_setup.add_cancel_button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {addErrors.submit && (
                  <div className="notice notice-danger" role="alert">
                    {addErrors.submit}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="add-phase">
                    {t("Checklist Phase", "چیک لسٹ کا مرحلہ")} <span className="required">*</span>
                  </label>
                  <select
                    id="add-phase"
                    className="form-control"
                    value={addPhase}
                    onChange={(e) => setAddPhase(e.target.value as ChecklistPhase)}
                    data-help="theatre_checklist_setup.add_phase_select"
                  >
                    <option value="SignIn">
                      1. Sign In ({t("Before induction of anaesthesia", "بے ہوشی سے پہلے")})
                    </option>
                    <option value="TimeOut">
                      2. Time Out ({t("Before skin incision", "چیرا لگانے سے پہلے")})
                    </option>
                    <option value="SignOut">
                      3. Sign Out ({t("Before leaving operating theatre", "تھیٹر چھوڑنے سے پہلے")})
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="add-prompt">
                    {t("Checklist Prompt / Question Text", "سوال یا تصدیقی عبارت")} <span className="required">*</span>
                  </label>
                  <textarea
                    id="add-prompt"
                    rows={3}
                    className={`form-control ${addErrors.prompt ? "is-invalid" : ""}`}
                    placeholder={t(
                      "Enter exact safety question or confirmation step (e.g. Has the patient confirmed identity, procedure and consent?)...",
                      "حفاظتی تصدیق یا سوال درج کریں (مثلاً کیا مریض نے اپنی شناخت، آپریشن اور رضامندی کی تصدیق کر دی ہے؟)..."
                    )}
                    value={addPrompt}
                    onChange={(e) => setAddPrompt(e.target.value)}
                    data-help="theatre_checklist_setup.add_prompt_input"
                  />
                  {addErrors.prompt && <div className="invalid-feedback">{addErrors.prompt}</div>}
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="add-kind">
                      {t("Response Kind", "جواب کی نوعیت")}
                    </label>
                    <select
                      id="add-kind"
                      className="form-control"
                      value={addKind}
                      onChange={(e) => setAddKind(e.target.value as "Confirm" | "Question")}
                      data-help="theatre_checklist_setup.add_kind_select"
                    >
                      <option value="Confirm">{t("Confirm (Yes / Confirmed)", "تصدیقی (ہاں / تصدیق شدہ)")}</option>
                      <option value="Question">{t("Question (Yes or No)", "سوال (ہاں یا نہیں)")}</option>
                    </select>
                  </div>

                  <div className="form-group col-md-6">
                    <label htmlFor="add-note-when">
                      {t("Require Note When Answer Is", "نوٹ کس جواب پر لازمی ہے")}
                    </label>
                    <select
                      id="add-note-when"
                      className="form-control"
                      value={addNoteWhen}
                      onChange={(e) => setAddNoteWhen(e.target.value)}
                      data-help="theatre_checklist_setup.add_note_when_select"
                    >
                      <option value="">{t("None (No note mandated)", "کوئی نہیں")}</option>
                      <option value="Yes">{t("Yes (Mandatory note when answered Yes)", "ہاں پر نوٹ لازمی")}</option>
                      <option value="No">{t("No (Mandatory note when answered No)", "نہیں پر نوٹ لازمی")}</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="add-reference">
                      {t("Reference Standard / Guideline", "ریفرنس یا گائیڈ لائن")}
                    </label>
                    <input
                      id="add-reference"
                      type="text"
                      className="form-control"
                      placeholder={t("e.g. MSDS 44 i, WHO SSC 2009", "مثلاً MSDS 44 i, WHO SSC 2009")}
                      value={addReference}
                      onChange={(e) => setAddReference(e.target.value)}
                      data-help="theatre_checklist_setup.add_reference_input"
                    />
                  </div>

                  <div className="form-group col-md-6">
                    <label htmlFor="add-sort-order">
                      {t("Sort Order Number", "ترتیب نمبر")}
                    </label>
                    <input
                      id="add-sort-order"
                      type="number"
                      min={1}
                      step={10}
                      className="form-control"
                      value={addSortOrder}
                      onChange={(e) => setAddSortOrder(Number(e.target.value))}
                      data-help="theatre_checklist_setup.add_sort_order_input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={addAllowNa}
                      onChange={(e) => setAddAllowNa(e.target.checked)}
                      data-help="theatre_checklist_setup.add_allow_na_checkbox"
                    />
                    {t(
                      "Allow 'Not Applicable' (e.g. for bilateral site marking on midline incisions)",
                      "'غیر متعلقہ' (N/A) کی اجازت دیں (مثلاً وسطی چیرے میں سائیڈ مارکنگ غیر متعلقہ ہوتی ہے)"
                    )}
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  data-help="theatre_checklist_setup.add_cancel_button"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addSubmitting}
                  data-help="theatre_checklist_setup.add_submit_button"
                >
                  {addSubmitting ? t("Adding...", "شامل ہو رہا ہے...") : t("Add Item", "آئٹم شامل کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>
                {t("Edit Safety Checklist Item", "چیک لسٹ آئٹم میں ترمیم")}: #{editingItem.item_id} (
                {PHASE_CONFIG[editingItem.phase].en})
              </h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowEditModal(false)}
                data-help="theatre_checklist_setup.edit_cancel_button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editErrors.submit && (
                  <div className="notice notice-danger" role="alert">
                    {editErrors.submit}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="edit-prompt">
                    {t("Checklist Prompt / Question Text", "سوال یا تصدیقی عبارت")} <span className="required">*</span>
                  </label>
                  <textarea
                    id="edit-prompt"
                    rows={3}
                    className={`form-control ${editErrors.prompt ? "is-invalid" : ""}`}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    data-help="theatre_checklist_setup.edit_prompt_input"
                  />
                  {editErrors.prompt && <div className="invalid-feedback">{editErrors.prompt}</div>}
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="edit-kind">
                      {t("Response Kind", "جواب کی نوعیت")}
                    </label>
                    <select
                      id="edit-kind"
                      className="form-control"
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as "Confirm" | "Question")}
                      data-help="theatre_checklist_setup.edit_kind_select"
                    >
                      <option value="Confirm">{t("Confirm (Yes / Confirmed)", "تصدیقی")}</option>
                      <option value="Question">{t("Question (Yes or No)", "سوال")}</option>
                    </select>
                  </div>

                  <div className="form-group col-md-6">
                    <label htmlFor="edit-note-when">
                      {t("Require Note When Answer Is", "نوٹ کس جواب پر لازمی ہے")}
                    </label>
                    <select
                      id="edit-note-when"
                      className="form-control"
                      value={editNoteWhen}
                      onChange={(e) => setEditNoteWhen(e.target.value)}
                      data-help="theatre_checklist_setup.edit_note_when_select"
                    >
                      <option value="">{t("None", "کوئی نہیں")}</option>
                      <option value="Yes">{t("Yes", "ہاں پر لازمی")}</option>
                      <option value="No">{t("No", "نہیں پر لازمی")}</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="edit-reference">
                      {t("Reference Standard / Guideline", "ریفرنس یا گائیڈ لائن")}
                    </label>
                    <input
                      id="edit-reference"
                      type="text"
                      className="form-control"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      data-help="theatre_checklist_setup.edit_reference_input"
                    />
                  </div>

                  <div className="form-group col-md-6">
                    <label htmlFor="edit-sort-order">
                      {t("Sort Order Number", "ترتیب نمبر")}
                    </label>
                    <input
                      id="edit-sort-order"
                      type="number"
                      min={1}
                      step={10}
                      className="form-control"
                      value={editSortOrder}
                      onChange={(e) => setEditSortOrder(Number(e.target.value))}
                      data-help="theatre_checklist_setup.edit_sort_order_input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editAllowNa}
                      onChange={(e) => setEditAllowNa(e.target.checked)}
                      data-help="theatre_checklist_setup.edit_allow_na_checkbox"
                    />
                    {t("Allow 'Not Applicable' (Allow N/A)", "'غیر متعلقہ' (N/A) کی اجازت دیں")}
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      data-help="theatre_checklist_setup.edit_active_checkbox"
                    />
                    <strong>{t("Active (included in live surgical safety checklists)", "فعال (سرجیکل چیک لسٹ میں شامل)")}</strong>
                  </label>
                  <small className="form-text text-muted">
                    {t(
                      "Retire items by unchecking this rather than deleting (Rule dfc29fbd11). Completed surgeries retain original questions.",
                      "آئٹم کو ختم کرنے کے بجائے ان چیک کر کے ریٹائر کریں۔ سابقہ جراحی ریکارڈز محفوظ رہیں گے۔"
                    )}
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  data-help="theatre_checklist_setup.edit_cancel_button"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting}
                  data-help="theatre_checklist_setup.edit_submit_button"
                >
                  {editSubmitting ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Changes", "تبدیلیاں محفوظ کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Theatre Policy PDF Modal (Rule: db51912b86) */}
      {showPolicyModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h2>{t("Hospital Operating Theatre Policy (PDF)", "ہسپتال آپریشن تھیٹر پالیسی (پی ڈی ایف)")}</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowPolicyModal(false)}
                data-help="theatre_checklist_setup.pdf_modal_close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body pdf-preview-body">
              {policyLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>{t("Fetching theatre policy PDF...", "تھیٹر پالیسی حاصل کی جا رہی ہے...")}</p>
                </div>
              ) : (
                <div className="pdf-info-card">
                  <p>
                    {t(
                      "The written Operating Theatre policy document includes the approved Surgical Safety Checklist, post-anaesthesia recovery criteria, and clinical privilege requirements (MSDS COP 31, 39, 41, 44). Print for Medical Director signature and annual committee review.",
                      "تحریری آپریشن تھیٹر پالیسی دستاویز میں منظور شدہ سرجیکل سیفٹی چیک لسٹ، اینستھیزیا کے بعد ریکوری کے معیارات اور کلینیکل اختیارات کے تقاضے شامل ہیں۔ میڈیکل ڈائریکٹر کے دستخط اور سالانہ جائزے کے لیے پرنٹ کریں۔"
                    )}
                  </p>
                  <p className="subtext">
                    <code>GET /api/v1/ot/theatre-policy/pdf</code> (Rule db51912b86)
                  </p>
                  <div className="pdf-actions">
                    <a
                      href="/api/v1/ot/theatre-policy/pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      data-help="theatre_checklist_setup.pdf_download_link"
                    >
                      📥 {t("Open / Download Theatre Policy PDF", "تھیٹر پالیسی پی ڈی ایف کھولیں / ڈاؤن لوڈ کریں")}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPolicyModal(false)}
                data-help="theatre_checklist_setup.pdf_modal_close"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default TheatreChecklistSetup;
