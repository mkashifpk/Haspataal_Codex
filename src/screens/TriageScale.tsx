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
  ErTriageScaleOut,
  ErTriageLevelOut,
  ErTriageDiscriminatorOut,
  TriageSignIn,
  TriageSignUpdateIn,
  TriageLevelIn,
} from "../generated/triage_scale";
import {
  getScale,
  printScale,
} from "../generated/triage_scale";
import {
  evaluateTriageScaleView,
  canConfigureTriageScale,
  canViewTriageScale,
  validateDiscriminatorInput,
  validateLevelInput,
  formatVitalSignLimit,
  VITAL_OPTIONS,
  COMPARISON_OPTIONS,
  COLOUR_PALETTE,
} from "../triage-scale-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { call } from "../bridge";

export interface TriageScaleProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigateScreen?: (screen: string, contextId?: number) => void;
  onBack?: () => void;
}

export function TriageScale({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
  onBack,
}: TriageScaleProps) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load triage scale from server
  const scaleLoad = useLoad<ErTriageScaleOut | null>(
    async () => {
      return await getScale({ include_inactive: includeInactive });
    },
    [includeInactive]
  );

  // Write controller
  const write = useClinicalWrite(user, "triage_scale", () => {
    scaleLoad.reload();
  });

  const scaleData = scaleLoad.data;

  // Discriminator Modal State (Add or Edit)
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [editingDiscId, setEditingDiscId] = useState<number | null>(null);
  const [discLevel, setDiscLevel] = useState<number>(1);
  const [discKind, setDiscKind] = useState<"Sign" | "VitalSign">("Sign");
  const [discLabel, setDiscLabel] = useState("");
  const [discAgeGroup, setDiscAgeGroup] = useState<"All" | "Adult" | "Child">("All");
  const [discVital, setDiscVital] = useState<string>("spo2");
  const [discComparison, setDiscComparison] = useState<string>("<");
  const [discThreshold, setDiscThreshold] = useState<string>("");
  const [discSortOrder, setDiscSortOrder] = useState<number>(100);
  const [discErrors, setDiscErrors] = useState<Record<string, string>>({});

  // Level Modal State (Edit level metadata)
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [levelName, setLevelName] = useState("");
  const [levelColour, setLevelColour] = useState<string>("Red");
  const [levelTargetMinutes, setLevelTargetMinutes] = useState<number>(0);
  const [levelDesc, setLevelDesc] = useState("");
  const [levelErrors, setLevelErrors] = useState<Record<string, string>>({});

  // View Evaluation under rule:813c874c56
  const viewEval = evaluateTriageScaleView(establishment);
  const canConfig = canConfigureTriageScale(user) && viewEval.mode !== "records";
  const canView = canViewTriageScale(user) && viewEval.canShow;

  // Open modal to add new discriminator
  const handleOpenAddDisc = (level: number, kind: "Sign" | "VitalSign") => {
    setEditingDiscId(null);
    setDiscLevel(level);
    setDiscKind(kind);
    setDiscLabel("");
    setDiscAgeGroup("All");
    setDiscVital("spo2");
    setDiscComparison("<");
    setDiscThreshold("");
    setDiscSortOrder(100);
    setDiscErrors({});
    setShowDiscModal(true);
  };

  // Open modal to edit existing discriminator
  const handleOpenEditDisc = (disc: ErTriageDiscriminatorOut) => {
    setEditingDiscId(disc.discriminator_id);
    setDiscLevel(disc.level);
    setDiscKind(disc.kind);
    setDiscLabel(disc.label);
    setDiscAgeGroup(disc.age_group);
    setDiscVital(disc.vital || "spo2");
    setDiscComparison(disc.comparison || "<");
    setDiscThreshold(disc.threshold !== null ? String(disc.threshold) : "");
    setDiscSortOrder(disc.sort_order);
    setDiscErrors({});
    setShowDiscModal(true);
  };

  // Submit Add or Edit Discriminator
  const handleSubmitDisc = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateDiscriminatorInput({
      kind: discKind,
      level: discLevel,
      label: discLabel,
      age_group: discAgeGroup,
      vital: discKind === "VitalSign" ? discVital : null,
      comparison: discKind === "VitalSign" ? discComparison : null,
      threshold: discKind === "VitalSign" ? discThreshold : null,
      sort_order: discSortOrder,
    });

    if (!validation.valid) {
      setDiscErrors(validation.errors);
      return;
    }
    setDiscErrors({});

    if (editingDiscId !== null) {
      // Update existing discriminator
      const payload: TriageSignUpdateIn = {
        level: discLevel,
        kind: discKind,
        label: discLabel.trim(),
        age_group: discAgeGroup,
        vital: discKind === "VitalSign" ? (discVital as any) : null,
        comparison: discKind === "VitalSign" ? (discComparison as any) : null,
        threshold: discKind === "VitalSign" && discThreshold !== "" ? Number(discThreshold) : null,
        sort_order: discSortOrder,
      };

      write.start({
        path: `/er/triage-scale/signs/${editingDiscId}`,
        method: "PATCH",
        body: payload,
        permission: "er.triage.configure",
        protection: "idempotent",
        label: t("Update Triage Discriminator", "ٹرائیج علامت اپ ڈیٹ کریں"),
      });
    } else {
      // Add new discriminator
      const payload: TriageSignIn = {
        level: discLevel,
        kind: discKind,
        label: discLabel.trim(),
        age_group: discAgeGroup,
        vital: discKind === "VitalSign" ? (discVital as any) : null,
        comparison: discKind === "VitalSign" ? (discComparison as any) : null,
        threshold: discKind === "VitalSign" && discThreshold !== "" ? Number(discThreshold) : null,
        sort_order: discSortOrder,
      };

      write.start({
        path: `/er/triage-scale/signs`,
        method: "POST",
        body: payload,
        permission: "er.triage.configure",
        protection: "idempotent",
        label: t("Add Triage Discriminator", "نئی ٹرائیج علامت شامل کریں"),
      });
    }

    setShowDiscModal(false);
  };

  // Retire discriminator (is_active: false) under rule:023ae1126f
  const handleRetireDisc = (disc: ErTriageDiscriminatorOut) => {
    write.start({
      path: `/er/triage-scale/signs/${disc.discriminator_id}`,
      method: "PATCH",
      body: { is_active: false },
      permission: "er.triage.configure",
      protection: "idempotent",
      label: t("Retire Triage Sign", "ٹرائیج علامت غیر فعال کریں"),
    });
  };

  // Re-activate discriminator (is_active: true)
  const handleReactivateDisc = (disc: ErTriageDiscriminatorOut) => {
    write.start({
      path: `/er/triage-scale/signs/${disc.discriminator_id}`,
      method: "PATCH",
      body: { is_active: true },
      permission: "er.triage.configure",
      protection: "idempotent",
      label: t("Reactivate Triage Sign", "ٹرائیج علامت دوبارہ فعال کریں"),
    });
  };

  // Open modal to edit Level metadata
  const handleOpenEditLevel = (lvl: ErTriageLevelOut) => {
    setEditingLevel(lvl.level);
    setLevelName(lvl.name);
    setLevelColour(lvl.colour);
    setLevelTargetMinutes(lvl.target_minutes);
    setLevelDesc(lvl.description || "");
    setLevelErrors({});
    setShowLevelModal(true);
  };

  // Submit Edit Level metadata
  const handleSubmitLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLevel === null) return;

    const validation = validateLevelInput({
      name: levelName,
      colour: levelColour as any,
      target_minutes: levelTargetMinutes,
      description: levelDesc,
    });

    if (!validation.valid) {
      setLevelErrors(validation.errors);
      return;
    }
    setLevelErrors({});

    const payload: TriageLevelIn = {
      name: levelName.trim(),
      colour: levelColour as any,
      target_minutes: levelTargetMinutes,
      description: levelDesc.trim() || null,
    };

    write.start({
      path: `/er/triage-scale/levels/${editingLevel}`,
      method: "PATCH",
      body: payload,
      permission: "er.triage.configure",
      protection: "idempotent",
      label: t("Update Triage Level", "ٹرائیج لیول اپ ڈیٹ کریں"),
    });

    setShowLevelModal(false);
  };

  // Print A4 Written Algorithm (rule:156f8bf375, MSDS AAC 15 v, 18)
  const handlePrintScale = async () => {
    try {
      const payload = await printScale();
      await call("clinical-print", {
        role: "document",
        payload,
      });
      setActionNotice(t("Triage algorithm document sent to document printer.", "ٹرائیج الگورتھم پرنٹر کو بھیج دیا گیا ہے۔"));
    } catch (err: any) {
      setActionNotice(t(`Print failed: ${err?.message || "Check document printer"}`, `پرنٹ نا کام: ${err?.message}`));
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    try {
      await call("clinical-pdf", {
        path: `/er/triage-scale/pdf`,
      });
      setActionNotice(t("Triage algorithm PDF opened / downloaded.", "پی ڈی ایف کھل گیا ہے۔"));
    } catch (err: any) {
      setActionNotice(t(`PDF failed: ${err?.message}`, `پی ڈی ایف نا کام: ${err?.message}`));
    }
  };

  if (!canView) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">{t("Access Restricted", "رسائی محدود ہے")}</h4>
          <p>{t("Your role does not have authorization to view the emergency triage scale (er.visit.view required).", "آپ کے پاس ایمرجنسی ٹرائیج اسکیل دیکھنے کی اجازت نہیں ہے۔")}</p>
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary mt-2"
              data-help="triage_scale.back"
              onClick={onBack}
            >
              {t("Go Back", "واپس جائیں")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3 px-4">
      {/* Header & Breadcrumb */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          {onBack && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-help="triage_scale.back"
              onClick={onBack}
              title={t("Back to previous screen", "پچھلی سکرین پر واپس جائیں")}
            >
              ← {t("Back", "واپس")}
            </button>
          )}
          <div>
            <h3 className="h4 mb-0 fw-bold text-dark">
              {t("Emergency Triage Scale & SOP Algorithm", "ایمرجنسی ٹرائیج اسکیل اور ایس او پی الگورتھم")}
            </h3>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle me-2">
              MSDS AAC 15 v, 18
            </span>
            <small className="text-muted">
              {t("Triage levels, target response times, danger signs & vital-sign limits", "ٹرائیج درجات، ہدف کے اوقات، خطرے کی علامات اور وائٹل سائن کی حدود")}
            </small>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2">
          <div className="form-check form-switch me-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="triage-scale-inactive-toggle"
              data-help="triage_scale.toggle_inactive"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="triage-scale-inactive-toggle">
              {t("Show Retired Items", "غیر فعال اشیاء دکھائیں")}
            </label>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            data-help="triage_scale.refresh_btn"
            onClick={() => scaleLoad.reload()}
          >
            ↻ {t("Refresh", "تازہ کریں")}
          </button>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            data-help="triage_scale.print_scale_btn"
            onClick={handlePrintScale}
          >
            🖨 {t("Print A4 Algorithm", "اے 4 الگورتھم پرنٹ کریں")}
          </button>

          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            data-help="triage_scale.pdf_scale_btn"
            onClick={handleDownloadPdf}
          >
            📄 {t("Download PDF", "پی ڈی ایف ڈاؤن لوڈ")}
          </button>
        </div>
      </div>

      {/* View Mode Banner under rule:813c874c56 */}
      {viewEval.bannerText && (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <span>{viewEval.bannerText}</span>
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div className="alert alert-info alert-dismissible fade show mb-3 d-flex justify-content-between align-items-center" role="alert">
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            data-help="triage_scale.btn_dismiss_notice"
            onClick={() => setActionNotice(null)}
          ></button>
        </div>
      )}

      {/* Clinical Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Emergency Consultant Review & Annual SOP Audit Box (rule:156f8bf375) */}
      <div className="card mb-4 border-info shadow-sm">
        <div className="card-header bg-info-subtle border-info text-info-emphasis d-flex justify-content-between align-items-center py-2">
          <span className="fw-semibold">
            📋 {t("Written Triage Algorithm Approval & Annual SOP Audit (MSDS AAC 15 v, 18)", "تحریری ٹرائیج الگورتھم کی منظوری اور سالانہ ایس او پی آڈٹ")}
          </span>
          <span className="badge bg-success">
            {t("Approved Standard", "منظور شدہ معیار")}
          </span>
        </div>
        <div className="card-body py-2 small text-muted">
          <div className="row g-2">
            <div className="col-md-4">
              <strong>{t("Emergency Consultant Approval:", "کنسلٹنٹ ایمرجنسی کی منظوری:")}</strong>{" "}
              {t("Formal annual clinical review signed on official printed document.", "سرکاری پرنٹ شدہ دستاویز پر سالانہ دستخط شدہ جائزہ۔")}
            </div>
            <div className="col-md-4">
              <strong>{t("Child Threshold Age:", "بچوں کی عمر کی حد:")}</strong>{" "}
              <span className="badge bg-secondary">{scaleData?.child_age_years ?? 12} {t("Years", "سال")}</span>{" "}
              <span className="text-secondary">({t("pediatric limits apply below this", "اس سے کم عمر پر بچوں کی حدود لاگو ہیں")})</span>
            </div>
            <div className="col-md-4">
              <strong>{t("Default Triage Level:", "بنیادی ٹرائیج درجہ:")}</strong>{" "}
              <span className="badge bg-primary">Level {scaleData?.default_level ?? 4}</span>{" "}
              <span className="text-secondary">({t("when no danger sign or vital limit is triggered", "جب کوئی خطرے کی علامت یا وائٹل سائن متحرک نہ ہو")})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Loading State */}
      <LoadState
        loading={scaleLoad.loading}
        error={scaleLoad.error ? String(scaleLoad.error) : null}
        retry={scaleLoad.reload}
      />

      {scaleData && (
        <div className="row g-3">
          {scaleData.levels.map((lvl) => {
            const palette = COLOUR_PALETTE[lvl.colour] || COLOUR_PALETTE.White;
            const signsList = lvl.signs || [];
            const vitalSignsList = lvl.vital_signs || [];

            return (
              <div key={lvl.level} className="col-12">
                <div className="card shadow-sm border" style={{ borderLeftWidth: "6px", borderLeftColor: palette.bg }}>
                  {/* Level Header */}
                  <div className="card-header d-flex flex-wrap justify-content-between align-items-center py-2 bg-light">
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="badge px-3 py-2 fw-bold fs-6"
                        style={{ backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }}
                      >
                        Level {lvl.level}: {lvl.name}
                      </span>
                      <span className="badge bg-secondary-subtle text-secondary border">
                        ⏱ {lvl.target_minutes === 0 ? t("Immediate (0 min)", "فوری (0 منٹ)") : `${lvl.target_minutes} ${t("min", "منٹ")}`}
                      </span>
                      {lvl.description && (
                        <span className="text-muted small ms-2">{lvl.description}</span>
                      )}
                    </div>

                    {canConfig && (
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          data-help="triage_scale.edit_level_btn"
                          onClick={() => handleOpenEditLevel(lvl)}
                          title={t("Edit level name, colour, or target minutes", "لیول کا نام، رنگ یا ہدف کا وقت تبدیل کریں")}
                        >
                          ✏️ {t("Edit Level", "لیول ایڈٹ کریں")}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          data-help="triage_scale.add_sign_btn"
                          onClick={() => handleOpenAddDisc(lvl.level, "Sign")}
                        >
                          + {t("Add Danger Sign", "علامت شامل کریں")}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          data-help="triage_scale.add_vital_btn"
                          onClick={() => handleOpenAddDisc(lvl.level, "VitalSign")}
                        >
                          + {t("Add Vital Limit", "وائٹل حد شامل کریں")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Level Body: Danger Signs & Vital Sign Limits */}
                  <div className="card-body p-3">
                    <div className="row g-3">
                      {/* Column 1: Danger Signs (Nurse ticks) */}
                      <div className="col-md-6 border-end">
                        <h6 className="fw-bold text-dark border-bottom pb-1 mb-2 d-flex justify-content-between align-items-center">
                          <span>🚨 {t("Danger Signs (Nurse Observations)", "خطرے کی علامات (نرس مشاہدات)")}</span>
                          <span className="badge bg-light text-muted border">{signsList.length}</span>
                        </h6>

                        {signsList.length === 0 ? (
                          <div className="text-muted small py-2 fst-italic">
                            {t("No danger signs configured for this level.", "اس درجے کے لیے کوئی علامت درج نہیں ہے۔")}
                          </div>
                        ) : (
                          <ul className="list-group list-group-flush small">
                            {signsList.map((sign) => {
                              const isGreyed = !sign.is_active;
                              return (
                                <li
                                  key={sign.discriminator_id}
                                  className={`list-group-item d-flex justify-content-between align-items-center px-2 py-1 ${
                                    isGreyed ? "bg-light text-muted opacity-75" : ""
                                  }`}
                                >
                                  <div className="d-flex align-items-center gap-2">
                                    <span className={isGreyed ? "text-decoration-line-through text-muted" : "fw-medium"}>
                                      {sign.label}
                                    </span>
                                    {sign.age_group !== "All" && (
                                      <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: "0.7rem" }}>
                                        {sign.age_group}
                                      </span>
                                    )}
                                    {isGreyed && (
                                      <span className="badge bg-secondary" style={{ fontSize: "0.65rem" }}>
                                        {t("Retired", "غیر فعال")}
                                      </span>
                                    )}
                                  </div>

                                  {canConfig && (
                                    <div className="d-flex gap-1">
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm p-0 text-secondary"
                                        data-help="triage_scale.edit_discriminator_btn"
                                        onClick={() => handleOpenEditDisc(sign)}
                                        title={t("Edit", "ایڈٹ کریں")}
                                      >
                                        ✏️
                                      </button>
                                      {sign.is_active ? (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-danger ms-1"
                                          data-help="triage_scale.retire_discriminator_btn"
                                          onClick={() => handleRetireDisc(sign)}
                                          title={t("Retire this sign (rule 023ae1126f)", "علامت غیر فعال کریں")}
                                        >
                                          ✕
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-success ms-1"
                                          data-help="triage_scale.reactivate_discriminator_btn"
                                          onClick={() => handleReactivateDisc(sign)}
                                          title={t("Re-activate", "دوبارہ فعال کریں")}
                                        >
                                          ↻
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      {/* Column 2: Vital-Sign Limits (System checks) */}
                      <div className="col-md-6">
                        <h6 className="fw-bold text-dark border-bottom pb-1 mb-2 d-flex justify-content-between align-items-center">
                          <span>📊 {t("Vital-Sign Limits (Auto-evaluated)", "وائٹل سائن کی حدود (خودکار جانچ)")}</span>
                          <span className="badge bg-light text-muted border">{vitalSignsList.length}</span>
                        </h6>

                        {vitalSignsList.length === 0 ? (
                          <div className="text-muted small py-2 fst-italic">
                            {t("No vital-sign limits configured for this level.", "اس درجے کے لیے کوئی وائٹل سائن حد درج نہیں ہے۔")}
                          </div>
                        ) : (
                          <ul className="list-group list-group-flush small">
                            {vitalSignsList.map((vital) => {
                              const isGreyed = !vital.is_active;
                              return (
                                <li
                                  key={vital.discriminator_id}
                                  className={`list-group-item d-flex justify-content-between align-items-center px-2 py-1 ${
                                    isGreyed ? "bg-light text-muted opacity-75" : ""
                                  }`}
                                >
                                  <div className="d-flex align-items-center gap-2">
                                    <code className="text-primary fw-bold">
                                      {formatVitalSignLimit(vital)}
                                    </code>
                                    {vital.label && vital.label !== formatVitalSignLimit(vital) && (
                                      <span className="text-muted">({vital.label})</span>
                                    )}
                                    {vital.age_group !== "All" && (
                                      <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: "0.7rem" }}>
                                        {vital.age_group}
                                      </span>
                                    )}
                                    {isGreyed && (
                                      <span className="badge bg-secondary" style={{ fontSize: "0.65rem" }}>
                                        {t("Retired", "غیر فعال")}
                                      </span>
                                    )}
                                  </div>

                                  {canConfig && (
                                    <div className="d-flex gap-1">
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm p-0 text-secondary"
                                        data-help="triage_scale.edit_discriminator_btn"
                                        onClick={() => handleOpenEditDisc(vital)}
                                        title={t("Edit", "ایڈٹ کریں")}
                                      >
                                        ✏️
                                      </button>
                                      {vital.is_active ? (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-danger ms-1"
                                          data-help="triage_scale.retire_discriminator_btn"
                                          onClick={() => handleRetireDisc(vital)}
                                          title={t("Retire this limit (rule 023ae1126f)", "حد غیر فعال کریں")}
                                        >
                                          ✕
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-success ms-1"
                                          data-help="triage_scale.reactivate_discriminator_btn"
                                          onClick={() => handleReactivateDisc(vital)}
                                          title={t("Re-activate", "دوبارہ فعال کریں")}
                                        >
                                          ↻
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discriminator Modal (Add / Edit) */}
      {showDiscModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <form onSubmit={handleSubmitDisc}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingDiscId !== null
                      ? t("Edit Triage Discriminator", "ٹرائیج علامت تبدیل کریں")
                      : discKind === "Sign"
                      ? t("Add Danger Sign", "نئی خطرے کی علامت شامل کریں")
                      : t("Add Vital-Sign Limit", "نئی وائٹل سائن حد شامل کریں")}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-help="triage_scale.modal_close_btn"
                    onClick={() => setShowDiscModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <Field label={t("Triage Level", "ٹرائیج درجہ")}>
                        <select
                          className="form-select"
                          data-help="triage_scale.modal_level_select"
                          value={discLevel}
                          onChange={(e) => setDiscLevel(Number(e.target.value))}
                        >
                          <option value={1}>Level 1 - Resuscitation (Code Red)</option>
                          <option value={2}>Level 2 - Emergency (Orange)</option>
                          <option value={3}>Level 3 - Urgent (Yellow)</option>
                          <option value={4}>Level 4 - Semi-urgent (Green)</option>
                          <option value={5}>Level 5 - Non-urgent (Blue/White)</option>
                        </select>
                      </Field>
                      {discErrors.level && <div className="text-danger small mt-1">{discErrors.level}</div>}
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Kind", "قسم")}>
                        <select
                          className="form-select"
                          data-help="triage_scale.modal_kind_select"
                          value={discKind}
                          onChange={(e) => setDiscKind(e.target.value as "Sign" | "VitalSign")}
                        >
                          <option value="Sign">{t("Danger Sign (Nurse Ticks)", "خطرے کی علامت")}</option>
                          <option value="VitalSign">{t("Vital-Sign Limit (System Checks)", "وائٹل سائن کی حد")}</option>
                        </select>
                      </Field>
                    </div>

                    <div className="col-12">
                      <Field label={t("Label / Description", "علامت کا عنوان / تفصیل")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="triage_scale.modal_label_input"
                          value={discLabel}
                          onChange={(e) => setDiscLabel(e.target.value)}
                          placeholder={discKind === "Sign" ? "e.g., Sudden collapse, severe stridor..." : "e.g., SpO2 < 90%"}
                          required
                        />
                      </Field>
                      {discErrors.label && <div className="text-danger small mt-1">{discErrors.label}</div>}
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Applicable Age Group", "عمر کا گروپ")}>
                        <select
                          className="form-select"
                          data-help="triage_scale.modal_age_select"
                          value={discAgeGroup}
                          onChange={(e) => setDiscAgeGroup(e.target.value as any)}
                        >
                          <option value="All">{t("All Ages", "تمام عمریں")}</option>
                          <option value="Adult">{t("Adult Only (>= Child Age)", "صرف بالغ")}</option>
                          <option value="Child">{t("Child Only (< Child Age)", "صرف بچے")}</option>
                        </select>
                      </Field>
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Sort Order", "ترتیب نمبر")}>
                        <input
                          type="number"
                          className="form-control"
                          data-help="triage_scale.modal_sort_input"
                          value={discSortOrder}
                          onChange={(e) => setDiscSortOrder(Number(e.target.value))}
                          min={0}
                          max={10000}
                        />
                      </Field>
                    </div>

                    {/* VitalSign Specific Fields (rule:023ae1126f) */}
                    {discKind === "VitalSign" && (
                      <div className="col-12 p-3 bg-light border rounded mt-2">
                        <h6 className="fw-bold text-primary mb-2">
                          📐 {t("Vital-Sign Limits Parameters (rule 023ae1126f)", "وائٹل سائن کے پیرامیٹرز")}
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <Field label={t("Vital Sign", "وائٹل سائن")}>
                              <select
                                className="form-select"
                                data-help="triage_scale.modal_vital_select"
                                value={discVital}
                                onChange={(e) => setDiscVital(e.target.value)}
                              >
                                {VITAL_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.labelEn}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {discErrors.vital && <div className="text-danger small mt-1">{discErrors.vital}</div>}
                          </div>

                          <div className="col-md-4">
                            <Field label={t("Comparison", "موازنہ")}>
                              <select
                                className="form-select"
                                data-help="triage_scale.modal_comparison_select"
                                value={discComparison}
                                onChange={(e) => setDiscComparison(e.target.value)}
                              >
                                {COMPARISON_OPTIONS.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {discErrors.comparison && <div className="text-danger small mt-1">{discErrors.comparison}</div>}
                          </div>

                          <div className="col-md-4">
                            <Field label={t("Threshold Value", "حد کی ویلیو")}>
                              <input
                                type="number"
                                step="any"
                                className="form-control"
                                data-help="triage_scale.modal_threshold_input"
                                value={discThreshold}
                                onChange={(e) => setDiscThreshold(e.target.value)}
                                placeholder="e.g. 90"
                                required
                              />
                            </Field>
                            {discErrors.threshold && <div className="text-danger small mt-1">{discErrors.threshold}</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="triage_scale.modal_cancel_btn"
                    onClick={() => setShowDiscModal(false)}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="triage_scale.modal_submit_btn"
                  >
                    {t("Save Discriminator", "محفوظ کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Level Modal */}
      {showLevelModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleSubmitLevel}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    {t(`Edit Level ${editingLevel} Metadata`, `لیول ${editingLevel} ایڈٹ کریں`)}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-help="triage_scale.level_close_btn"
                    onClick={() => setShowLevelModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <Field label={t("Level Name", "لیول کا نام")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="triage_scale.level_name_input"
                          value={levelName}
                          onChange={(e) => setLevelName(e.target.value)}
                          required
                        />
                      </Field>
                      {levelErrors.name && <div className="text-danger small mt-1">{levelErrors.name}</div>}
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Colour", "رنگ")}>
                        <select
                          className="form-select"
                          data-help="triage_scale.level_colour_select"
                          value={levelColour}
                          onChange={(e) => setLevelColour(e.target.value)}
                        >
                          {Object.keys(COLOUR_PALETTE).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Target Response Time (Minutes)", "ہدف کا وقت (منٹ)")}>
                        <input
                          type="number"
                          className="form-control"
                          data-help="triage_scale.level_target_input"
                          value={levelTargetMinutes}
                          onChange={(e) => setLevelTargetMinutes(Number(e.target.value))}
                          min={0}
                          max={1440}
                          required
                        />
                      </Field>
                      <small className="text-muted">{t("0 = Immediate doctor assessment", "0 = فوری معائنہ")}</small>
                      {levelErrors.target_minutes && <div className="text-danger small mt-1">{levelErrors.target_minutes}</div>}
                    </div>

                    <div className="col-12">
                      <Field label={t("Description / Clinical Scope", "تفصیل / دائرہ کار")}>
                        <textarea
                          className="form-control"
                          rows={3}
                          data-help="triage_scale.level_desc_input"
                          value={levelDesc}
                          onChange={(e) => setLevelDesc(e.target.value)}
                        />
                      </Field>
                      {levelErrors.description && <div className="text-danger small mt-1">{levelErrors.description}</div>}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="triage_scale.level_cancel_btn"
                    onClick={() => setShowLevelModal(false)}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-help="triage_scale.level_submit_btn"
                  >
                    {t("Save Level Changes", "تبدیلیاں محفوظ کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
