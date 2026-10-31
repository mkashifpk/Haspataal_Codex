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
  AdmissionTransferOut,
  BedMatrixOut,
  BedMatrixBedOut,
} from "../generated/ward_transfer";
import {
  transfer,
  listTransfers,
  bedMatrix,
} from "../generated/ward_transfer";
import {
  getAdmission,
  type AdmissionDetailOut,
} from "../generated/doctor_inpatients";
import {
  getWardTransferScreenView,
  wardTransferAccess,
  filterAvailableBeds,
  groupWardsSummary,
  validateTransferInput,
  formatDailyRate,
  formatRateDifference,
  explainTransferError,
  QUICK_TRANSFER_REASONS,
} from "../ward-transfer-policy";
import { ClinicalWriteFeedback, useClinicalWrite, type ClinicalCommand } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";

export interface WardTransferProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialAdmissionId?: number;
  onNavigateScreen?: (screen: string, contextId?: number) => void;
  onBack?: () => void;
}

export function WardTransfer({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  timeZone,
  initialAdmissionId,
  onNavigateScreen,
  onBack,
}: WardTransferProps) {
  // Establishment state
  const [est, setEst] = useState<EstablishmentOut>(propEstablishment);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  // Screen view & permissions
  const screenView = getWardTransferScreenView(est);
  const access = wardTransferAccess(user.permissions || [], screenView);

  // Revisions & realtime notifications
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Active Admission selection
  const [admissionIdInput, setAdmissionIdInput] = useState<string>(
    initialAdmissionId ? String(initialAdmissionId) : "",
  );
  const [activeAdmissionId, setActiveAdmissionId] = useState<number | null>(
    initialAdmissionId || null,
  );

  // Form state
  const [wardFilter, setWardFilter] = useState<number | "all">("all");
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [transferReason, setTransferReason] = useState<string>("");
  const [wristbandChecked, setWristbandChecked] = useState<boolean>(false);
  const [handoverChecked, setHandoverChecked] = useState<boolean>(false);
  const [chartChecked, setChartChecked] = useState<boolean>(false);
  const [clientErrors, setClientErrors] = useState<{ bed_id?: string; reason?: string }>({});
  const [lastTransferResult, setLastTransferResult] = useState<AdmissionTransferOut | null>(null);

  // Active view tab: "transfer" | "history" | "matrix"
  const [activeTab, setActiveTab] = useState<"transfer" | "history" | "matrix">("transfer");

  // Load Admission Details
  const admissionLoad = useLoad<AdmissionDetailOut | null>(async () => {
    if (!activeAdmissionId) return null;
    return await getAdmission(activeAdmissionId);
  }, [activeAdmissionId, revision]);

  const currentAdmission = admissionLoad.data;

  // Load Bed Matrix (rule:e867f67863)
  const matrixLoad = useLoad<BedMatrixOut>(async () => {
    return await bedMatrix({ include_beds: true });
  }, [revision]);

  const matrixData = matrixLoad.data;

  // Load Transfer History for current admission
  const transfersLoad = useLoad<AdmissionTransferOut[]>(async () => {
    if (!activeAdmissionId) return [];
    return await listTransfers(activeAdmissionId);
  }, [activeAdmissionId, revision]);

  const transferHistory = transfersLoad.data || [];

  // Real-time Event Subscription (admission.transferred, bed.state_changed, establishment.changed)
  useEffect(() => {
    const handleServerEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{ topic?: string; payload?: unknown }>;
      const topic = customEv.detail?.topic || "";

      if (topic === "admission.transferred") {
        setRealtimeNotice(
          t(
            "Inpatient transfer completed. Bed matrix and moves updated.",
            "مریض کی منتقلی مکمل ہوئی۔ بیڈ میٹرکس اور ریکارڈ تازہ ہو گیا۔",
          ),
        );
        setRevision((r) => r + 1);
      } else if (topic === "bed.state_changed") {
        setRealtimeNotice(
          t(
            "Bed state changed. Matrix refreshed.",
            "بستر کی حالت تبدیل ہوئی۔ میٹرکس تازہ کر دیا گیا۔",
          ),
        );
        setRevision((r) => r + 1);
      } else if (topic === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment profile updated. View refreshed.",
            "ادارے کی ترتیبات تبدیل ہوئیں۔ ویو تازہ کر دیا گیا۔",
          ),
        );
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleServerEvent);
    return () => {
      window.removeEventListener("haspataal:event", handleServerEvent);
    };
  }, []);

  // Filter available beds from live matrix
  const availableBeds = filterAvailableBeds(
    matrixData,
    currentAdmission?.bed_id,
    wardFilter,
  );

  const selectedBed = matrixData?.beds?.find((b) => b.bed_id === selectedBedId);
  const selectedWard = matrixData?.wards.find((w) => w.ward_id === selectedBed?.ward_id);

  // Safe Clinical Write Hook
  const write = useClinicalWrite(user, "ward_transfer", (value: unknown, cmd: ClinicalCommand) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/transfer")) {
      setLastTransferResult(value as AdmissionTransferOut);
      setSelectedBedId(null);
      setTransferReason("");
      setWristbandChecked(false);
      setHandoverChecked(false);
      setChartChecked(false);
    }
  });

  // Handle Admission Search / Load
  const handleLoadAdmission = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = parseInt(admissionIdInput.trim(), 10);
    if (!isNaN(id) && id > 0) {
      setActiveAdmissionId(id);
      setSelectedBedId(null);
      setTransferReason("");
      setLastTransferResult(null);
      setClientErrors({});
    }
  };

  // Handle Bed Selection
  const handleSelectBed = (bed: BedMatrixBedOut) => {
    setSelectedBedId(bed.bed_id);
    setClientErrors((prev) => ({ ...prev, bed_id: undefined }));
  };

  // Handle Quick Reason Selection
  const handleQuickReason = (reasonText: string) => {
    setTransferReason(reasonText);
    setClientErrors((prev) => ({ ...prev, reason: undefined }));
  };

  // Handle Submit Transfer (MSDS PRE 79, rule:e867f67863)
  const handleSubmitTransfer = async () => {
    if (!activeAdmissionId) return;

    // Validate inputs
    const validation = validateTransferInput({
      bed_id: selectedBedId,
      reason: transferReason,
      current_bed_id: currentAdmission?.bed_id,
    });

    if (!validation.valid) {
      setClientErrors(validation.errors);
      return;
    }

    if (!wristbandChecked || !handoverChecked || !chartChecked) {
      setClientErrors({
        reason: t(
          "Complete all handover safety checks (wristband, SBAR clinical handover, and chart transfer) before moving the patient.",
          "مریض کو منتقل کرنے سے قبل تمام حفاظتی اقدامات (رسٹ بینڈ، ایس بی اے آر ہینڈ اوور اور چارٹ) مکمل کریں۔",
        ),
      });
      return;
    }

    setClientErrors({});

    write.start({
      path: `/admissions/${activeAdmissionId}/transfer`,
      method: "POST",
      body: {
        bed_id: selectedBedId!,
        reason: transferReason.trim(),
      },
      permission: "ipd.admission.transfer",
      protection: "reconcile",
      label: t("Transfer patient to new bed", "مریض کو نئے بستر پر منتقل کریں"),
    });
  };

  return (
    <section className="screen-container ward-transfer-screen">
      {/* Header */}
      <header className="screen-header">
        <div className="header-title-row">
          <div>
            <h1>{t("Move a Patient to Another Bed or Ward", "مریض کو دوسرے بستر یا وارڈ میں منتقل کریں")}</h1>
            <p className="screen-subtitle">
              {t(
                "Move an inpatient (to and from the ICU) with clinical reason. When bed tariff changes, family is informed of the new estimate (MSDS PRE 79).",
                "طبی وجوہات کی بنا پر مریض کو دوسرے بستر یا وارڈ (بشمول آئی سی یو) منتقل کریں۔ ٹیرف تبدیلی کی صورت میں فیملی کو نئے تخمینہ سے آگاہ کیا جاتا ہے (ایم ایس ڈی ایس پی آر ای 79)۔",
              )}
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              data-help="ward_transfer.btn_back"
              className="btn btn-secondary"
              onClick={onBack}
            >
              {t("← Back", "← واپس")}
            </button>
          )}
        </div>

        {/* Capability / Screen View Notices (rule:d136cb7db9) */}
        {access.isRetiring && (
          <div className="alert-banner alert-warning" role="alert">
            <strong>{t("Service Retiring Notice:", "سروس ختم ہونے کا نوٹس:")}</strong>{" "}
            {t(
              "No new patient transfers from now on (Inpatient service is Retiring). Existing admitted patients and moves remain visible.",
              "اب سے نئے مریضوں کی منتقلی ممکن نہیں ہے (ان پیشنٹ سروس بند کی جا رہی ہے)۔ پہلے سے موجود منتقلیوں کا ریکارڈ دیکھا جا سکتا ہے۔",
            )}
          </div>
        )}

        {access.isReadOnly && (
          <div className="alert-banner alert-info" role="alert">
            <strong>{t("Records Only:", "صرف ریکارڈ:")}</strong>{" "}
            {t(
              "Inpatient service is Retired. Bed matrix and transfer records are in read-only mode.",
              "ان پیشنٹ سروس ریٹائر ہو چکی ہے۔ بیڈ میٹرکس اور منتقلی کے ریکارڈ صرف مطالعے کے لیے دستیاب ہیں۔",
            )}
          </div>
        )}

        {/* Real-time Event Notice */}
        {realtimeNotice && (
          <div className="alert-banner alert-info dismissible" role="status">
            <span>{realtimeNotice}</span>
            <button
              type="button"
              data-help="ward_transfer.btn_dismiss_realtime"
              className="btn-link"
              onClick={() => setRealtimeNotice(null)}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Admission Selection Bar */}
      <div className="card admission-selector-card">
        <form onSubmit={handleLoadAdmission} className="admission-selector-form">
          <div className="form-group inline-group">
            <label htmlFor="admission-id-input">
              {t("Inpatient Admission ID / MRN:", "مریض کا داخلہ نمبر / ایم آر این:")}
            </label>
            <input
              id="admission-id-input"
              type="number"
              min="1"
              data-help="ward_transfer.search_admission"
              placeholder={t("e.g. 1", "مثلاً 1")}
              value={admissionIdInput}
              onChange={(e) => setAdmissionIdInput(e.target.value)}
              className="input-field"
            />
            <button
              type="submit"
              data-help="ward_transfer.search_btn"
              className="btn btn-primary"
            >
              {t("Load Inpatient Chart", "مریض کا چارٹ کھولیں")}
            </button>
          </div>
        </form>

        {/* Selected Inpatient Patient Context Banner */}
        {activeAdmissionId && (
          <div className="admission-context-wrapper">
            <LoadState
              loading={admissionLoad.loading}
              error={admissionLoad.error ? String(admissionLoad.error) : null}
              retry={admissionLoad.reload}
            />

            {currentAdmission && (
              <div className="patient-banner card-highlight">
                <div className="patient-banner-grid">
                  <div>
                    <span className="label-text">{t("Patient Name:", "مریض کا نام:")}</span>
                    <strong className="value-text">{currentAdmission.patient_name}</strong>
                  </div>
                  <div>
                    <span className="label-text">{t("MRN:", "ایم آر این:")}</span>
                    <strong className="value-text">{currentAdmission.mrn}</strong>
                  </div>
                  <div>
                    <span className="label-text">{t("Age / Gender:", "عمر / جنس:")}</span>
                    <span className="value-text">
                      {currentAdmission.age_years ? `${currentAdmission.age_years}y` : "—"} /{" "}
                      {currentAdmission.gender || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="label-text">{t("Admission Status:", "داخلے کی حالت:")}</span>
                    <span className={`badge badge-${currentAdmission.status.toLowerCase()}`}>
                      {currentAdmission.status}
                    </span>
                  </div>
                  <div>
                    <span className="label-text">{t("Current Bed:", "موجودہ بستر:")}</span>
                    <strong className="value-text text-accent">
                      {currentAdmission.ward_name || t("No Ward", "کوئی وارڈ نہیں")} —{" "}
                      {currentAdmission.bed_label || t("No Bed", "کوئی بستر نہیں")}
                    </strong>
                  </div>
                  <div>
                    <span className="label-text">{t("Billing Category:", "بلنگ کی قسم:")}</span>
                    <span className="value-text">{currentAdmission.billing_category}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <nav className="tabs-nav" aria-label="Ward Transfer Tabs">
        <button
          type="button"
          data-help="ward_transfer.tab_transfer"
          className={`tab-btn ${activeTab === "transfer" ? "active" : ""}`}
          onClick={() => setActiveTab("transfer")}
        >
          {t("Transfer to New Bed", "نئے بستر پر منتقلی")}
        </button>
        <button
          type="button"
          data-help="ward_transfer.tab_history"
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          {t("Transfer History", "منتقلی کی تاریخ")}{" "}
          {transferHistory.length > 0 && `(${transferHistory.length})`}
        </button>
        <button
          type="button"
          data-help="ward_transfer.tab_matrix"
          className={`tab-btn ${activeTab === "matrix" ? "active" : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          {t("Bed Matrix Overview", "بیڈ میٹرکس جائزہ")}
        </button>
      </nav>

      {/* TAB 1: Transfer to New Bed */}
      {activeTab === "transfer" && (
        <div className="tab-pane transfer-pane">
          {!activeAdmissionId ? (
            <Empty>
              {t(
                "Enter an Admission ID above to select an inpatient for transfer.",
                "مریض کو منتقل کرنے کے لیے اوپر داخلہ نمبر درج کریں۔",
              )}
            </Empty>
          ) : !currentAdmission ? (
            <Empty>
              {t("Inpatient admission not found.", "مریض کے داخلے کا ریکارڈ نہیں ملا۔")}
            </Empty>
          ) : !access.canTransfer ? (
            <div className="alert-banner alert-warning">
              {t(
                "You do not have permission to transfer patients ('ipd.admission.transfer' required). Admissions officers and head nurses can perform transfers.",
                "آپ کے پاس مریض منتقل کرنے کی اجازت نہیں ہے (داخلہ افسر یا ہیڈ نرس کی اجازت درکار ہے)۔",
              )}
            </div>
          ) : (
            <div className="transfer-work-grid">
              {/* Left Column: Live Bed Selection from Matrix (rule:e867f67863) */}
              <div className="card bed-selection-card">
                <div className="card-header-row">
                  <h3>{t("1. Select Available Destination Bed", "1. نیا دستیاب بستر منتخب کریں")}</h3>
                  <button
                    type="button"
                    data-help="ward_transfer.refresh_matrix"
                    className="btn btn-sm btn-outline"
                    onClick={() => setRevision((r) => r + 1)}
                  >
                    {t("↻ Refresh Beds", "↻ بستر ریفریش کریں")}
                  </button>
                </div>

                {/* Ward Filter */}
                <div className="filter-row">
                  <label htmlFor="ward-filter-select">
                    {t("Filter by Ward:", "وارڈ کے لحاظ سے فلٹر:")}
                  </label>
                  <select
                    id="ward-filter-select"
                    data-help="ward_transfer.ward_filter"
                    value={wardFilter === "all" ? "all" : String(wardFilter)}
                    onChange={(e) =>
                      setWardFilter(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
                    }
                    className="select-field"
                  >
                    <option value="all">{t("All Wards", "تمام وارڈز")}</option>
                    {matrixData?.wards.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.name} ({w.available} {t("available", "دستیاب")})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Available Beds Grid */}
                <div className="available-beds-container">
                  <LoadState
                    loading={matrixLoad.loading}
                    error={matrixLoad.error ? String(matrixLoad.error) : null}
                    retry={matrixLoad.reload}
                  />

                  {availableBeds.length === 0 ? (
                    <Empty>
                      {t(
                        "No available beds found in the selected ward. Choose another ward or check bed cleaning status.",
                        "منتخب وارڈ میں کوئی بستر دستیاب نہیں۔ دوسرا وارڈ منتخب کریں یا صفائی کی حالت دیکھیں۔",
                      )}
                    </Empty>
                  ) : (
                    <div className="bed-cards-grid">
                      {availableBeds.map((bed) => {
                        const ward = matrixData?.wards.find((w) => w.ward_id === bed.ward_id);
                        const isSelected = selectedBedId === bed.bed_id;

                        return (
                          <div
                            key={bed.bed_id}
                            className={`bed-card ${isSelected ? "selected-bed" : ""}`}
                            onClick={() => handleSelectBed(bed)}
                          >
                            <div className="bed-card-header">
                              <span className="bed-label">{bed.label}</span>
                              <span className="badge badge-success">
                                {t("Available", "دستیاب")}
                              </span>
                            </div>
                            <div className="bed-card-body">
                              <div className="bed-ward-name">{ward?.name || `Ward ${bed.ward_id}`}</div>
                              <div className="bed-ward-type">{ward?.ward_type}</div>
                              {ward?.gender_restriction && ward.gender_restriction !== "any" && (
                                <div className="gender-restriction-badge">
                                  {ward.gender_restriction === "female"
                                    ? t("Female Only", "صرف خواتین")
                                    : t("Male Only", "صرف مرد")}
                                </div>
                              )}
                            </div>
                            <div className="bed-card-footer">
                              <button
                                type="button"
                                data-help="ward_transfer.bed_select"
                                className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectBed(bed);
                                }}
                              >
                                {isSelected ? t("✓ Selected", "✓ منتخب شدہ") : t("Select Bed", "منتخب کریں")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {clientErrors.bed_id && (
                  <p className="field-error-text">{clientErrors.bed_id}</p>
                )}
              </div>

              {/* Right Column: Transfer Form and Handover Checklist */}
              <div className="card transfer-details-card">
                <h3>{t("2. Clinical Handover & Transfer Details", "2. کلینیکل ہینڈ اوور اور منتقلی کی تفصیلات")}</h3>

                {/* Selected Destination Bed Overview */}
                <div className="destination-bed-summary">
                  <div className="summary-row">
                    <span className="label-text">{t("Current Bed:", "موجودہ بستر:")}</span>
                    <strong className="value-text">
                      {currentAdmission.ward_name} ({currentAdmission.bed_label})
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span className="label-text">{t("Destination Bed:", "منزل کا بستر:")}</span>
                    <strong className={`value-text ${selectedBed ? "text-success" : "text-muted"}`}>
                      {selectedBed
                        ? `${selectedWard?.name} (${selectedBed.label})`
                        : t("Not selected", "منتخب نہیں کیا گیا")}
                    </strong>
                  </div>

                  {/* Tariff & Rate Notice (rule:dfe411b7e9, MSDS PRE 79) */}
                  {selectedBed && (
                    <div className="rate-notice-banner alert-info">
                      <div className="rate-icon">💳</div>
                      <div className="rate-content">
                        <strong>{t("Tariff & Rate Review (MSDS PRE 79):", "ٹیرف اور ریٹ جائزہ:")}</strong>
                        <p>
                          {t(
                            "If the daily bed charge differs between wards (e.g. ICU vs General Ward), the system flags rate_changed and alerts estimate staff to explain the revised estimate to the family.",
                            "اگر وارڈز کے درمیان یومیہ چارجز مختلف ہوں (مثلاً آئی سی یو اور جنرل وارڈ)، تو سسٹم نیا تخمینہ فیملی کو سمجھانے کی ہدایت جاری کرتا ہے۔",
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Reason Templates */}
                <div className="quick-reasons-section">
                  <label className="section-label">
                    {t("Quick Clinical Reasons (Click to pre-fill):", "فوری طبی وجوہات (کلک کرکے درج کریں):")}
                  </label>
                  <div className="quick-reason-buttons">
                    {QUICK_TRANSFER_REASONS.map((qr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        data-help="ward_transfer.quick_reason"
                        className="btn btn-sm btn-chip"
                        onClick={() => handleQuickReason(qr.reason)}
                      >
                        {t(qr.labelEn, qr.labelUr)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clinical Reason Textarea */}
                <div className="form-group">
                  <label htmlFor="transfer-reason-input">
                    {t("Clinical Reason for Transfer * (min 5 characters):", "منتقلی کی طبی وجہ * (کم از کم 5 حروف):")}
                  </label>
                  <textarea
                    id="transfer-reason-input"
                    data-help="ward_transfer.reason_input"
                    rows={3}
                    placeholder={t(
                      "Enter detailed medical reason (e.g. Respiratory failure, needs ventilation in the ICU)",
                      "طبی وجوہات درج کریں (مثلاً سانس کی تکلیف، آئی سی یو وینٹیلیشن کی ضرورت)",
                    )}
                    value={transferReason}
                    onChange={(e) => {
                      setTransferReason(e.target.value);
                      if (clientErrors.reason) {
                        setClientErrors((prev) => ({ ...prev, reason: undefined }));
                      }
                    }}
                    className="textarea-field"
                  />
                  <div className="char-count">
                    {transferReason.length} / 2000 {t("characters", "حروف")}
                  </div>
                  {clientErrors.reason && (
                    <p className="field-error-text">{clientErrors.reason}</p>
                  )}
                </div>

                {/* Handover Safety Checklist */}
                <div className="checklist-section">
                  <h4 className="checklist-title">
                    {t("Clinical Handover Checklist (MSDS PRE 79 / PHC):", "کلینیکل ہینڈ اوور چیک لسٹ:")}
                  </h4>
                  <div className="checkbox-row">
                    <input
                      type="checkbox"
                      id="check-wristband"
                      data-help="ward_transfer.check_wristband"
                      checked={wristbandChecked}
                      onChange={(e) => setWristbandChecked(e.target.checked)}
                    />
                    <label htmlFor="check-wristband">
                      {t(
                        "Patient identity verified with wristband barcode at bedside",
                        "بیڈ سائیڈ پر مریض کے رسٹ بینڈ سے شناخت کی تصدیق کی گئی",
                      )}
                    </label>
                  </div>
                  <div className="checkbox-row">
                    <input
                      type="checkbox"
                      id="check-handover"
                      data-help="ward_transfer.check_handover"
                      checked={handoverChecked}
                      onChange={(e) => setHandoverChecked(e.target.checked)}
                    />
                    <label htmlFor="check-handover">
                      {t(
                        "Receiving ward nurse notified and SBAR clinical handover completed",
                        "وصول کرنے والی وارڈ نرس کو مطلع کر دیا گیا اور ایس بی اے آر ہینڈ اوور مکمل ہے",
                      )}
                    </label>
                  </div>
                  <div className="checkbox-row">
                    <input
                      type="checkbox"
                      id="check-chart"
                      data-help="ward_transfer.check_chart"
                      checked={chartChecked}
                      onChange={(e) => setChartChecked(e.target.checked)}
                    />
                    <label htmlFor="check-chart">
                      {t(
                        "Physical patient chart, MAR, and own medicines accompany patient",
                        "مریض کا طبعی چارٹ، ادویات کا ریکارڈ اور ذاتی ادویات ہمراہ ہیں",
                      )}
                    </label>
                  </div>
                </div>

                {/* Safe Write Feedback */}
                <ClinicalWriteFeedback write={write} />

                {/* Rate Changed Post-Transfer Banner (rule:dfe411b7e9) */}
                {lastTransferResult && (
                  <div className="card-success transfer-result-card">
                    <h4>{t("✓ Transfer Completed Successfully", "✓ منتقلی کامیابی سے مکمل ہو گئی")}</h4>
                    <p>
                      {t(
                        `Patient moved from ${lastTransferResult.from_ward_name} (${lastTransferResult.from_bed_label}) to ${lastTransferResult.to_ward_name} (${lastTransferResult.to_bed_label}) by ${lastTransferResult.transferred_by_name}.`,
                        `مریض کو ${lastTransferResult.from_ward_name} (${lastTransferResult.from_bed_label}) سے ${lastTransferResult.to_ward_name} (${lastTransferResult.to_bed_label}) منتقل کر دیا گیا بذریعہ ${lastTransferResult.transferred_by_name}۔`,
                      )}
                    </p>

                    {lastTransferResult.rate_changed && (
                      <div className="alert-banner alert-warning rate-changed-alert">
                        <strong>
                          {t("⚠ Tariff / Rate Changed (MSDS PRE 79):", "⚠ بستر کا ٹیرف / ریٹ تبدیل ہو گیا:")}
                        </strong>
                        <p>
                          {t(
                            `Daily bed charge changed from ${formatDailyRate(lastTransferResult.from_daily_rate)} to ${formatDailyRate(lastTransferResult.to_daily_rate)}. Advise admissions / billing counselor to explain the updated Cost Estimate to the patient's family (Reason: ChangeOfWard, Transfer #${lastTransferResult.transfer_id}).`,
                            `یومیہ بیڈ چارج ${formatDailyRate(lastTransferResult.from_daily_rate)} سے تبدیل ہو کر ${formatDailyRate(lastTransferResult.to_daily_rate)} ہو گیا۔ فیملی کو نیا تخمینہ لاگت سمجھانے کے لیے ایڈمیشن/بلنگ ڈیسک سے رابطہ کریں۔`,
                          )}
                        </p>
                        {onNavigateScreen && (
                          <button
                            type="button"
                            data-help="ward_transfer.open_cost_estimates"
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              onNavigateScreen("cost_estimates_admissions", lastTransferResult.transfer_id)
                            }
                          >
                            {t("Open Cost Estimates →", "لاگت کا تخمینہ کھولیں →")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Transfer Button */}
                <div className="form-actions">
                  <button
                    type="button"
                    data-help="ward_transfer.submit_transfer"
                    className="btn btn-primary btn-lg"
                    disabled={!selectedBedId || write.busy}
                    onClick={handleSubmitTransfer}
                  >
                    {write.busy
                      ? t("Transferring Patient...", "مریض کو منتقل کیا جا رہا ہے...")
                      : t("Confirm Ward Transfer", "وارڈ منتقلی کی تصدیق کریں")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Transfer History */}
      {activeTab === "history" && (
        <div className="tab-pane history-pane">
          {!activeAdmissionId ? (
            <Empty>
              {t("Enter an Admission ID to view transfer history.", "منتقلی کی تاریخ دیکھنے کے لیے داخلہ نمبر درج کریں۔")}
            </Empty>
          ) : (
            <div className="card">
              <div className="card-header-row">
                <h3>{t("Moves of This Admission (GET /admissions/{id}/transfers)", "اس داخلے کی منتقلیوں کی تاریخ")}</h3>
                <button
                  type="button"
                  data-help="ward_transfer.btn_refresh_history"
                  className="btn btn-sm btn-outline"
                  onClick={() => setRevision((r) => r + 1)}
                >
                  {t("↻ Refresh", "↻ تازہ کریں")}
                </button>
              </div>

              <LoadState
                loading={transfersLoad.loading}
                error={transfersLoad.error ? String(transfersLoad.error) : null}
                retry={transfersLoad.reload}
              />

              {transferHistory.length === 0 ? (
                <Empty>
                  {t(
                    "No transfers recorded for this inpatient stay yet. The patient is in their initial allocated bed.",
                    "اس داخلے کے دوران ابھی تک کوئی منتقلی نہیں ہوئی۔ مریض اپنے اصل الاٹ کردہ بستر پر ہے۔",
                  )}
                </Empty>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("Transfer #", "منتقلی نمبر")}</th>
                        <th>{t("Date & Time", "تاریخ اور وقت")}</th>
                        <th>{t("From Ward / Bed", "پہلا وارڈ / بستر")}</th>
                        <th>{t("To Ward / Bed", "نیا وارڈ / بستر")}</th>
                        <th>{t("Clinical Reason", "طبی وجہ")}</th>
                        <th>{t("Daily Rate", "یومیہ ریٹ")}</th>
                        <th>{t("Rate Changed?", "ریٹ تبدیل ہوا؟")}</th>
                        <th>{t("Transferred By", "منتقل کنندہ")}</th>
                        <th>{t("Estimate Status", "تخمینہ کی حالت")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferHistory.map((tr) => (
                        <tr key={tr.transfer_id}>
                          <td>#{tr.transfer_id}</td>
                          <td>{formatHospitalTime(tr.transferred_at, timeZone || "Asia/Karachi")}</td>
                          <td>
                            {tr.from_ward_name} ({tr.from_bed_label})
                          </td>
                          <td>
                            <strong>
                              {tr.to_ward_name} ({tr.to_bed_label})
                            </strong>
                          </td>
                          <td>{tr.reason}</td>
                          <td>
                            {formatDailyRate(tr.from_daily_rate)} → {formatDailyRate(tr.to_daily_rate)}
                          </td>
                          <td>
                            {tr.rate_changed ? (
                              <span className="badge badge-warning">
                                {t("Rate Changed", "ریٹ تبدیل ہوا")}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">
                                {t("No Change", "تبدیلی نہیں")}
                              </span>
                            )}
                          </td>
                          <td>{tr.transferred_by_name}</td>
                          <td>
                            {tr.estimate_explained ? (
                              <span className="badge badge-success">
                                {t("Explained", "سمجھا دیا گیا")}
                              </span>
                            ) : tr.rate_changed ? (
                              <div className="estimate-action-cell">
                                <span className="badge badge-danger">
                                  {t("Pending Explanation", "توضیح باقی ہے")}
                                </span>
                                {onNavigateScreen && (
                                  <button
                                    type="button"
                                    data-help="ward_transfer.btn_explain_history"
                                    className="btn btn-xs btn-outline"
                                    onClick={() =>
                                      onNavigateScreen("cost_estimates_admissions", tr.transfer_id)
                                    }
                                  >
                                    {t("Explain", "توضیح کریں")}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Bed Matrix Overview */}
      {activeTab === "matrix" && (
        <div className="tab-pane matrix-pane">
          <div className="card">
            <div className="card-header-row">
              <h3>{t("Hospital Bed Matrix Overview (GET /beds/matrix)", "ہسپتال بیڈ میٹرکس کا جائزہ")}</h3>
              <button
                type="button"
                data-help="ward_transfer.refresh_matrix"
                className="btn btn-sm btn-outline"
                onClick={() => setRevision((r) => r + 1)}
              >
                {t("↻ Refresh Matrix", "↻ میٹرکس ریفریش کریں")}
              </button>
            </div>

            <LoadState
              loading={matrixLoad.loading}
              error={matrixLoad.error ? String(matrixLoad.error) : null}
              retry={matrixLoad.reload}
            />

            {matrixData && (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("Ward Code", "وارڈ کوڈ")}</th>
                      <th>{t("Ward Name", "وارڈ کا نام")}</th>
                      <th>{t("Type", "قسم")}</th>
                      <th>{t("Gender", "جنس")}</th>
                      <th>{t("Total Beds", "کل بستر")}</th>
                      <th>{t("Available", "دستیاب")}</th>
                      <th>{t("Occupied", "زیر استعمال")}</th>
                      <th>{t("Reserved", "محفوظ")}</th>
                      <th>{t("Cleaning / Turnover", "صفائی کے مرحلے میں")}</th>
                      <th>{t("Out of Service", "ناکارہ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.wards.map((w) => (
                      <tr key={w.ward_id}>
                        <td>{w.code}</td>
                        <td>
                          <strong>{w.name}</strong>
                        </td>
                        <td>{w.ward_type}</td>
                        <td>{w.gender_restriction}</td>
                        <td>{w.total_beds}</td>
                        <td>
                          <span className={`badge ${w.available > 0 ? "badge-success" : "badge-neutral"}`}>
                            {w.available}
                          </span>
                        </td>
                        <td>{w.occupied}</td>
                        <td>{w.reserved}</td>
                        <td>{w.turnover}</td>
                        <td>{w.out_of_service}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
