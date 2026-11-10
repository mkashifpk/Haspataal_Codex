import {DirectoryPicker} from "../DirectoryPicker";
import { useEffect, useState, useMemo } from "react";
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
  ErBoardOut,
  ErVisitOut,
  ErOnDutyOut,
  ErVisitDetailOut,
  ErArrivalIn,
  TraumaCreate,
  PatientDetailOut,
} from "../generated/er_board";
import {
  board,
  onDuty,
  registerErVisits,
  getVisit,
  trauma,
} from "../generated/er_board";
import {
  evaluateErBoardView,
  canViewErBoard,
  canRegisterErArrival,
  canCreateTrauma,
  validateErArrivalInput,
  validateTraumaInput,
  explainErBoardError,
  ARRIVAL_MODES,
  ER_FLAG_CONFIG,
  TRIAGE_COLOUR_MAP,
} from "../er-board-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";

export interface ERBoardProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigateScreen?: (screen: string, contextId?: number) => void;
  onBack?: () => void;
  screenId?: string;
}

export function ERBoard({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigateScreen,
  onBack,
  screenId = "er_board",
}: ERBoardProps) {
  // Action notifications & alerts
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [codeRedAlert, setCodeRedAlert] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [stageFilter, setStageFilter] = useState<string>("All");

  // Side panel state (on duty staff & on call consultants)
  const [showDutyPanel, setShowDutyPanel] = useState(false);
  const [dutyData, setDutyData] = useState<ErOnDutyOut | null>(null);

  // Modals state
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showTraumaModal, setShowTraumaModal] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [visitDetail, setVisitDetail] = useState<ErVisitDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Arrival form state
  const [arrivalPatientId, setArrivalPatientId] = useState<string>("");
  const [arrivalMode, setArrivalMode] = useState<string>("WalkIn");
  const [arrivalReferredFrom, setArrivalReferredFrom] = useState("");
  const [arrivalComplaint, setArrivalComplaint] = useState("");
  const [arrivalTicketId, setArrivalTicketId] = useState<string>("");
  const [arrivalErrors, setArrivalErrors] = useState<Record<string, string>>({});

  // Trauma form state
  const [traumaTempId, setTraumaTempId] = useState("");
  const [traumaGender, setTraumaGender] = useState<"male" | "female" | "other" | "unknown">("male");
  const [traumaAge, setTraumaAge] = useState<string>("");
  const [traumaErrors, setTraumaErrors] = useState<Record<string, string>>({});

  // View Evaluation under rule:9501947a0e & capability gating under rule:141986b356
  const viewEval = evaluateErBoardView(establishment, screenId);
  const canView = canViewErBoard(user) && viewEval.canShow;
  const canRegister = canRegisterErArrival(user) && viewEval.canStartNewWork;
  const canTrauma = canCreateTrauma(user) && viewEval.canStartNewWork;

  // Board Data Loading
  const boardLoad = useLoad<ErBoardOut | null>(
    async () => {
      const data = await board();
      // Check for Code Red patients to alert (rule:bdb901deb2)
      const hasCodeRed = data.visits.some((v) => v.triage_level === 1);
      if (hasCodeRed) {
        setCodeRedAlert(
          t(
            "CRITICAL: Active Level 1 (Resuscitation / Code Red) patient in the Emergency Room!",
            "اہم انتباہ: ایمرجنسی روم میں درجہ 1 (کوڈ ریڈ / فوری بحالی) کا مریض موجود ہے!"
          )
        );
      } else {
        setCodeRedAlert(null);
      }
      return data;
    },
    [stream]
  );

  // Write controller
  const write = useClinicalWrite(user, screenId, () => {
    boardLoad.reload();
  });

  // Load On-Duty Staff & Consultants when drawer is toggled (rule:21a063e488)
  useEffect(() => {
    if (showDutyPanel) {
      onDuty()
        .then((data) => setDutyData(data))
        .catch((err) => {
          setActionNotice(t(`Failed to load on-duty roster: ${err?.message}`, `ڈیوٹی روسٹر لوڈ نا کام: ${err?.message}`));
        });
    }
  }, [showDutyPanel]);

  // Load Visit Detail when selected
  const handleOpenVisitDetail = async (visitId: number) => {
    setSelectedVisitId(visitId);
    setLoadingDetail(true);
    try {
      const det = await getVisit(visitId);
      setVisitDetail(det);
    } catch (err: any) {
      setActionNotice(t(`Could not load visit #${visitId}: ${err?.message}`, `وزٹ تفصیل لوڈ نا کام: ${err?.message}`));
    } finally {
      setLoadingDetail(false);
    }
  };

  // Submit New Arrival (rule:74958f2576)
  const handleSubmitArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(arrivalPatientId);
    const validation = validateErArrivalInput({
      patient_id: pid,
      arrival_mode: arrivalMode,
      referred_from: arrivalReferredFrom,
      presenting_complaint: arrivalComplaint,
    });

    if (!validation.valid) {
      setArrivalErrors(validation.errors);
      return;
    }
    setArrivalErrors({});

    const body: ErArrivalIn = {
      patient_id: pid,
      arrival_mode: arrivalMode as any,
      referred_from: arrivalMode === "Referred" ? arrivalReferredFrom.trim() : null,
      presenting_complaint: arrivalComplaint.trim() || null,
      ticket_id: arrivalTicketId ? Number(arrivalTicketId) : null,
    };

    write.start({
      path: "/er/visits",
      method: "POST",
      body,
      permission: "er.visit.register",
      protection: "idempotent",
      label: t("Register ER Patient Arrival", "ایمرجنسی آمد کا اندراج کریں"),
    });

    setShowArrivalModal(false);
  };

  // Submit Trauma Profile Creation (rule:74958f2576)
  const handleSubmitTrauma = async (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = traumaAge ? Number(traumaAge) : undefined;
    const validation = validateTraumaInput({
      temp_identifier: traumaTempId,
      gender: traumaGender,
      approx_age_years: ageNum,
    });

    if (!validation.valid) {
      setTraumaErrors(validation.errors);
      return;
    }
    setTraumaErrors({});

    try {
      const body: TraumaCreate = {
        temp_identifier: traumaTempId.trim() || null,
        gender: traumaGender,
        approx_age_years: ageNum,
      };

      const result = await trauma(body);
      setActionNotice(
        t(
          `Trauma Profile Created: ${result.full_name} (${result.mrn}). Pre-filling arrival registration.`,
          `ٹراما پروفائل بن گئی: ${result.full_name} (${result.mrn})۔`
        )
      );

      // Prepopulate arrival form with newly created trauma patient_id
      setArrivalPatientId(String(result.patient_id));
      setShowTraumaModal(false);
      setShowArrivalModal(true);
    } catch (err: any) {
      const explained = explainErBoardError(err);
      setTraumaErrors({ form: explained.message });
    }
  };

  // Filtered visits
  const filteredVisits = useMemo(() => {
    if (!boardLoad.data?.visits) return [];
    return boardLoad.data.visits.filter((v) => {
      // Level filter
      if (levelFilter !== "All") {
        if (levelFilter === "Untriaged" && v.triage_level !== null) return false;
        if (levelFilter !== "Untriaged" && String(v.triage_level) !== levelFilter) return false;
      }
      // Stage filter
      if (stageFilter !== "All" && v.stage !== stageFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.patient_name.toLowerCase().includes(q);
        const matchesMrn = v.mrn.toLowerCase().includes(q);
        const matchesEr = v.er_number.toLowerCase().includes(q);
        const matchesComplaint = (v.presenting_complaint || "").toLowerCase().includes(q);
        if (!matchesName && !matchesMrn && !matchesEr && !matchesComplaint) return false;
      }
      return true;
    });
  }, [boardLoad.data, levelFilter, stageFilter, searchQuery]);

  if (!canView) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">{t("Access Restricted", "رسائی محدود ہے")}</h4>
          <p>
            {t(
              "Your role does not have authorization to view the Emergency Department board (er.visit.view required).",
              "آپ کے پاس ایمرجنسی روم بورڈ دیکھنے کی اجازت نہیں ہے۔"
            )}
          </p>
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary mt-2"
              data-help="er_board.back"
              onClick={onBack}
            >
              {t("Go Back", "واپس جائیں")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const boardData = boardLoad.data;

  return (
    <div className="container-fluid py-3 px-4">
      {/* Header & Controls */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          {onBack && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-help="er_board.back"
              onClick={onBack}
              title={t("Back to previous screen", "پچھلی سکرین پر واپس جائیں")}
            >
              ← {t("Back", "واپس")}
            </button>
          )}
          <div>
            <h3 className="h4 mb-0 fw-bold text-danger d-flex align-items-center gap-2">
              🚨 {screenId === "er_board_doctor"
                ? t("Emergency Room Board (Doctor)", "ایمرجنسی روم ٹریکنگ بورڈ (ڈاکٹر)")
                : t("Emergency Room Tracking Board", "ایمرجنسی روم ٹریکنگ بورڈ")}
            </h3>
            <span className="badge bg-danger text-white me-2">MSDS AAC 15-20</span>
            <small className="text-muted">
              {t(
                "Real-time triage levels, waiting targets, danger flags & duty roster",
                "ریئل ٹائم ٹرائیج درجات، ہدف کے اوقات، خطرے کے انتباہات اور ڈیوٹی روسٹر"
              )}
            </small>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="d-flex align-items-center gap-2">
          {canTrauma && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              data-help="er_board.btn_open_trauma_modal"
              onClick={() => {
                setTraumaTempId("");
                setTraumaGender("male");
                setTraumaAge("");
                setTraumaErrors({});
                setShowTraumaModal(true);
              }}
            >
              + {t("Quick Trauma Profile", "نئی ٹراما پروفائل")}
            </button>
          )}

          {canRegister && (
            <button
              type="button"
              className="btn btn-danger btn-sm fw-semibold"
              data-help="er_board.btn_open_arrival_modal"
              onClick={() => {
                setArrivalPatientId("");
                setArrivalMode("WalkIn");
                setArrivalReferredFrom("");
                setArrivalComplaint("");
                setArrivalTicketId("");
                setArrivalErrors({});
                setShowArrivalModal(true);
              }}
            >
              + {t("Register Arrival", "آمد کا اندراج")}
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            data-help="er_board.btn_toggle_duty_panel"
            onClick={() => setShowDutyPanel(!showDutyPanel)}
          >
            👥 {t("Staff On Duty / On Call", "ڈیوٹی و آن کال عملہ")}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            data-help="er_board.btn_refresh"
            onClick={() => boardLoad.reload()}
          >
            ↻ {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Code Red High-Priority Banner (rule:bdb901deb2) */}
      {codeRedAlert && (
        <div
          className="alert alert-danger py-2 mb-3 d-flex align-items-center justify-content-between shadow-sm animate-pulse border-danger"
          role="alert"
        >
          <div className="d-flex align-items-center gap-2 fw-bold fs-6">
            <span className="fs-5">🚨</span>
            <span>{codeRedAlert}</span>
          </div>
          <span className="badge bg-danger fs-6 text-uppercase">{t("Immediate Attention", "فوری توجہ")}</span>
        </div>
      )}

      {/* Retiring / Service View Banner (rule:9501947a0e) */}
      {viewEval.bannerText && (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <span>{viewEval.bannerText}</span>
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div
          className="alert alert-info alert-dismissible fade show mb-3 d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            data-help="er_board.btn_dismiss_notice"
            onClick={() => setActionNotice(null)}
          ></button>
        </div>
      )}

      {/* Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Summary KPI Header Tiles (rule:618704df95) */}
      {boardData && (
        <div className="row g-2 mb-3">
          {/* Total In ER */}
          <div className="col-6 col-md-2">
            <div className="card shadow-sm border p-2 text-center bg-light">
              <span className="text-muted small">{t("Total in ER", "کل مریض")}</span>
              <div className="fs-4 fw-bold text-dark">{boardData.visits.length}</div>
            </div>
          </div>

          {/* Level 1: Resuscitation */}
          <div className="col-6 col-md-2">
            <div className="card shadow-sm border p-2 text-center" style={{ backgroundColor: "#dc354515", borderColor: "#dc3545" }}>
              <span className="small text-danger fw-bold">{t("Level 1 (Red)", "درجہ 1 (سرخ)")}</span>
              <div className="fs-4 fw-bold text-danger">
                {boardData.by_level.find((l) => l.level === 1)?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Level 2: Emergency */}
          <div className="col-6 col-md-2">
            <div className="card shadow-sm border p-2 text-center" style={{ backgroundColor: "#fd7e1415", borderColor: "#fd7e14" }}>
              <span className="small text-warning fw-bold">{t("Level 2 (Orange)", "درجہ 2 (نارنجی)")}</span>
              <div className="fs-4 fw-bold" style={{ color: "#fd7e14" }}>
                {boardData.by_level.find((l) => l.level === 2)?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Level 3: Urgent */}
          <div className="col-6 col-md-2">
            <div className="card shadow-sm border p-2 text-center" style={{ backgroundColor: "#ffc10715", borderColor: "#ffc107" }}>
              <span className="small text-dark fw-bold">{t("Level 3 (Yellow)", "درجہ 3 (پیلا)")}</span>
              <div className="fs-4 fw-bold text-dark">
                {boardData.by_level.find((l) => l.level === 3)?.count ?? 0}
              </div>
            </div>
          </div>

          {/* Level 4 & 5 */}
          <div className="col-6 col-md-2">
            <div className="card shadow-sm border p-2 text-center" style={{ backgroundColor: "#19875415", borderColor: "#198754" }}>
              <span className="small text-success fw-bold">{t("Level 4 / 5 (Green/Blue)", "درجہ 4 / 5")}</span>
              <div className="fs-4 fw-bold text-success">
                {(boardData.by_level.find((l) => l.level === 4)?.count ?? 0) +
                  (boardData.by_level.find((l) => l.level === 5)?.count ?? 0)}
              </div>
            </div>
          </div>

          {/* Target Overdue */}
          <div className="col-6 col-md-2">
            <div className={`card shadow-sm border p-2 text-center ${boardData.overdue > 0 ? "bg-danger text-white" : "bg-light"}`}>
              <span className={`small ${boardData.overdue > 0 ? "text-white fw-bold" : "text-muted"}`}>
                ⏱ {t("Target Overdue", "ہدف سے زائد وقت")}
              </span>
              <div className="fs-4 fw-bold">{boardData.overdue}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card shadow-sm border p-2 mb-3 bg-light">
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder={t("Search by Patient Name, MRN, or ER #...", "مریض کا نام، ایم آر این یا داخلہ نمبر تلاش کریں...")}
              data-help="er_board.input_search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text">{t("Triage Level", "ٹرائیج درجہ")}</span>
              <select
                className="form-select form-select-sm"
                data-help="er_board.select_level_filter"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <option value="All">{t("All Levels", "تمام درجات")}</option>
                <option value="Untriaged">{t("Untriaged First", "غیر درجہ بند")}</option>
                <option value="1">Level 1 - Resuscitation (Red)</option>
                <option value="2">Level 2 - Emergency (Orange)</option>
                <option value="3">Level 3 - Urgent (Yellow)</option>
                <option value="4">Level 4 - Semi-urgent (Green)</option>
                <option value="5">Level 5 - Non-urgent (Blue)</option>
              </select>
            </div>
          </div>

          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text">{t("Stage", "مرحلہ")}</span>
              <select
                className="form-select form-select-sm"
                data-help="er_board.select_stage_filter"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="All">{t("All Stages", "تمام مراحل")}</option>
                <option value="Arrived">{t("Arrived (Untriaged)", "پہنچے ہوئے")}</option>
                <option value="Triaged">{t("Triaged", "ٹرائیج شدہ")}</option>
                <option value="InTreatment">{t("In Treatment", "زیر علاج")}</option>
                <option value="Observation">{t("Observation", "زیر مشاہدہ")}</option>
                <option value="AwaitingAdmission">{t("Awaiting Admission", "داخلہ کے منتظر")}</option>
                <option value="AwaitingBed">{t("Awaiting Bed", "بستر کے منتظر")}</option>
                <option value="AwaitingReferral">{t("Awaiting Referral", "ریفرل کے منتظر")}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Board Table */}
      <LoadState
        loading={boardLoad.loading}
        error={boardLoad.error ? String(boardLoad.error) : null}
        retry={boardLoad.reload}
      />

      {boardData && (
        <div className="table-responsive shadow-sm border rounded bg-white">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-secondary small">
              <tr>
                <th style={{ width: "120px" }}>{t("Priority", "ترجیح")}</th>
                <th>{t("Patient / MRN", "مریض / ایم آر این")}</th>
                <th>{t("Arrival Mode / Time", "آمد کا وقت اور ذریعہ")}</th>
                <th>{t("Complaint", "طبی شکایت")}</th>
                <th>{t("Current Stage", "موجودہ مرحلہ")}</th>
                <th>{t("Waits", "انتظار کا وقت")}</th>
                <th>{t("Clinical Flags", "انتباہی جھنڈے")}</th>
                <th>{t("Doctor / Duty", "ڈاکٹر")}</th>
                <th className="text-end" style={{ width: "160px" }}>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted fst-italic">
                    {t("No active ER patients matching filter criteria.", "کوئی مریض موجود نہیں ہے۔")}
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => {
                  const palette = v.triage_colour
                    ? TRIAGE_COLOUR_MAP[v.triage_colour] || TRIAGE_COLOUR_MAP.White
                    : TRIAGE_COLOUR_MAP.White;

                  return (
                    <tr
                      key={v.er_visit_id}
                      style={{
                        borderLeft: `5px solid ${palette.bg}`,
                        backgroundColor: v.triage_level === 1 ? "#dc354508" : undefined,
                      }}
                    >
                      {/* Priority Level */}
                      <td>
                        {v.triage_level ? (
                          <span
                            className="badge px-2 py-1 fw-bold"
                            style={{ backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }}
                          >
                            L{v.triage_level}: {v.triage_level_name || v.triage_colour}
                          </span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-dark border">
                            {t("Untriaged", "غیر درجہ بند")}
                          </span>
                        )}
                      </td>

                      {/* Patient Name & MRN */}
                      <td>
                        <div className="fw-bold text-dark">{v.patient_name}</div>
                        <div className="small text-muted">
                          <span>{v.mrn}</span> · <span>{v.er_number}</span> ·{" "}
                          <span>{v.gender || "-"}, {v.age_years ?? "?"}y</span>
                        </div>
                        {v.admission_number && (
                          <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: "0.7rem" }}>
                            IPD: {v.admission_number}
                          </span>
                        )}
                      </td>

                      {/* Arrival Mode & Time */}
                      <td className="small">
                        <span className="badge bg-light text-dark border me-1">
                          {v.arrival_mode || "WalkIn"}
                        </span>
                        <div className="text-muted">{formatHospitalTime(v.arrived_at, timeZone)}</div>
                        {v.referred_from && (
                          <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                            {t("Ref:", "ریفرل:")} {v.referred_from}
                          </div>
                        )}
                      </td>

                      {/* Complaint */}
                      <td className="small text-muted" style={{ maxWidth: "200px" }}>
                        <div className="text-truncate" title={v.presenting_complaint || "-"}>
                          {v.presenting_complaint || "-"}
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td>
                        <span className="badge bg-secondary-subtle text-secondary border">
                          {v.stage}
                        </span>
                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                          {v.minutes_in_stage ?? 0} {t("min in stage", "منٹ")}
                        </div>
                      </td>

                      {/* Waits */}
                      <td className="small">
                        <div className="fw-semibold">
                          {v.minutes_in_er} {t("min in ER", "منٹ کل")}
                        </div>
                        {v.triage_target_minutes !== null && (
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            Target: {v.triage_target_minutes} min
                          </div>
                        )}
                      </td>

                      {/* Flags & MLC (rule:618704df95) */}
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {v.flags.map((flag) => {
                            const cfg = ER_FLAG_CONFIG[flag] || {
                              labelEn: flag,
                              labelUr: flag,
                              badgeClass: "bg-secondary text-white",
                            };
                            return (
                              <span
                                key={flag}
                                className={`badge ${cfg.badgeClass}`}
                                style={{ fontSize: "0.68rem" }}
                              >
                                {cfg.labelEn}
                              </span>
                            );
                          })}
                          {v.is_medico_legal && (
                            <span className="badge bg-dark text-white fw-bold" style={{ fontSize: "0.68rem" }}>
                              ⚖️ MLC #{v.mlc_number || "Open"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Doctor / Attending */}
                      <td className="small">
                        {v.seen_by_name ? (
                          <div className="fw-medium text-dark">{v.seen_by_name}</div>
                        ) : (
                          <span className="text-danger fw-semibold">
                            ⏱ {t("Awaiting Doctor", "ڈاکٹر کے منتظر")}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm py-0 px-2"
                            data-help="er_board.btn_view_visit"
                            onClick={() => handleOpenVisitDetail(v.er_visit_id)}
                            title={t("View full visit timeline and stages", "مکمل وزٹ اور مراحل دیکھیں")}
                          >
                            👁
                          </button>

                          {onNavigateScreen && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm py-0 px-2"
                              data-help="er_board.btn_triage_visit"
                              onClick={() => onNavigateScreen(screenId === "er_board_doctor" ? "er_visit_doctor" : "er_visit", v.er_visit_id)}
                              title={t("Open clinical triage and treatment chart", "طبی معائنہ اور ٹرائیج چارٹ کھولیں")}
                            >
                              🩺 {t("Chart", "چارٹ")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff On Duty / On Call Side Drawer (rule:21a063e488, MSDS 17 iii) */}
      {showDutyPanel && (
        <div
          className="offcanvas offcanvas-end show"
          tabIndex={-1}
          style={{ visibility: "visible", width: "420px", backgroundColor: "#fdfdfd" }}
        >
          <div className="offcanvas-header bg-primary text-white py-2">
            <h5 className="offcanvas-title h6 mb-0">
              👥 {t("Emergency Staff On Duty & On Call (MSDS 17 iii)", "ایمرجنسی عملہ اور آن کال کنسلٹنٹس")}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-help="er_board.duty_close_btn"
              onClick={() => setShowDutyPanel(false)}
            ></button>
          </div>
          <div className="offcanvas-body p-3">
            {dutyData ? (
              <div>
                {/* On Duty Staff */}
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2">
                  🏥 {t("Staff On Duty Now", "موجودہ ڈیوٹی عملہ")} ({dutyData.on_duty.length})
                </h6>
                {dutyData.on_duty.length === 0 ? (
                  <div className="text-muted small py-2">{t("No rostered staff recorded on duty.", "کوئی عملہ درج نہیں ہے۔")}</div>
                ) : (
                  <ul className="list-group list-group-flush small mb-3">
                    {dutyData.on_duty.map((st) => (
                      <li key={st.roster_id} className="list-group-item px-2 py-1">
                        <div className="fw-bold text-dark">{st.full_name}</div>
                        <div className="text-muted">
                          <span>{st.designation}</span> · <span>{st.staff_category}</span>
                        </div>
                        <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                          Shift: {st.shift_name} ({st.starts_at} - {st.ends_at})
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* On Call Consultants */}
                <h6 className="fw-bold text-danger border-bottom pb-1 mb-2 mt-3">
                  📞 {t("Consultants On Call", "آن کال کنسلٹنٹس")} ({dutyData.on_call.length})
                </h6>
                {dutyData.on_call.length === 0 ? (
                  <div className="text-muted small py-2">{t("No consultants registered on call.", "کوئی کنسلٹنٹ درج نہیں ہے۔")}</div>
                ) : (
                  <ul className="list-group list-group-flush small">
                    {dutyData.on_call.map((cl) => (
                      <li key={cl.roster_id} className="list-group-item px-2 py-2 bg-light border rounded mb-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-bold text-dark">{cl.full_name}</span>
                          <span className="badge bg-danger text-white">{cl.specialty || "Specialist"}</span>
                        </div>
                        <div className="text-muted small">{cl.designation}</div>
                        {cl.mobile && (
                          <div className="mt-1">
                            <span className="fw-semibold text-primary">📞 {cl.mobile}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-muted">{t("Loading on-duty roster...", "ڈیوٹی روسٹر لوڈ ہو رہا ہے...")}</div>
            )}
          </div>
        </div>
      )}

      {/* Register New Arrival Modal (rule:74958f2576) */}
      {showArrivalModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleSubmitArrival}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    🚨 {t("Register Emergency Arrival", "ایمرجنسی مریض کی آمد کا اندراج")}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-help="er_board.arrival_close_btn"
                    onClick={() => setShowArrivalModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <Field label={t("Patient ID", "مریض کا آئی ڈی")}>
                        <div className="input-group">
                          <DirectoryPicker
                            className="form-control"
                            data-help="er_board.arrival_patient_id_input"
                            value={arrivalPatientId}
                            onChange={(e) => setArrivalPatientId(e.target.value)}
                            required
                           path="/patients/search" idField="patient_id" search />
                          {canTrauma && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              data-help="er_board.btn_open_trauma_modal"
                              onClick={() => {
                                setShowArrivalModal(false);
                                setShowTraumaModal(true);
                              }}
                            >
                              + {t("Unknown Trauma", "نامعلوم ٹراما")}
                            </button>
                          )}
                        </div>
                      </Field>
                      {arrivalErrors.patient_id && (
                        <div className="text-danger small mt-1">{arrivalErrors.patient_id}</div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Arrival Mode", "آمد کا ذریعہ")}>
                        <select
                          className="form-select"
                          data-help="er_board.arrival_mode_select"
                          value={arrivalMode}
                          onChange={(e) => setArrivalMode(e.target.value)}
                        >
                          {ARRIVAL_MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.labelEn}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    {arrivalMode === "Referred" && (
                      <div className="col-md-6">
                        <Field label={t("Referred From Hospital", "بھیجنے والا ہسپتال")}>
                          <input
                            type="text"
                            className="form-control"
                            data-help="er_board.arrival_referred_from_input"
                            value={arrivalReferredFrom}
                            onChange={(e) => setArrivalReferredFrom(e.target.value)}
                            placeholder="e.g. DHQ Hospital..."
                          />
                        </Field>
                      </div>
                    )}

                    <div className="col-12">
                      <Field label={t("Presenting Complaint", "ابتدائی طبی شکایت")}>
                        <textarea
                          className="form-control"
                          rows={2}
                          data-help="er_board.arrival_complaint_input"
                          value={arrivalComplaint}
                          onChange={(e) => setArrivalComplaint(e.target.value)}
                          placeholder="e.g. Acute shortness of breath, chest pain..."
                        />
                      </Field>
                      {arrivalErrors.presenting_complaint && (
                        <div className="text-danger small mt-1">{arrivalErrors.presenting_complaint}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <Field label={t("Emergency Ticket ID (Optional)", "ایمرجنسی ٹکٹ نمبر (اختیاری)")}>
                        <input
                          type="number"
                          className="form-control"
                          data-help="er_board.arrival_ticket_id_input"
                          value={arrivalTicketId}
                          onChange={(e) => setArrivalTicketId(e.target.value)}
                          placeholder={t("Ticket issued later joins visit automatically", "بعد میں جاری ہونے والا ٹکٹ خود بخود جڑ جاتا ہے")}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="er_board.arrival_cancel_btn"
                    onClick={() => setShowArrivalModal(false)}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    data-help="er_board.arrival_submit_btn"
                  >
                    {t("Confirm Arrival", "آمد درج کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Trauma Profile Creation Modal (rule:74958f2576) */}
      {showTraumaModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleSubmitTrauma}>
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">
                    🚨 {t("New Unknown Trauma Profile", "نامعلوم ٹراما ایمرجنسی پروفائل")}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    data-help="er_board.trauma_close_btn"
                    onClick={() => setShowTraumaModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    {t(
                      "Creates temporary trauma record ('Unknown Male 1') for unidentified/unconscious emergency arrivals. Later merged into permanent master record (decision 61).",
                      "بے ہوش یا نامعلوم مریض کے لیے عارضی ٹراما پروفائل بنائیں، جسے بعد میں مستقل ریکارڈ کے ساتھ ضم کیا جا سکے گا۔"
                    )}
                  </p>

                  {traumaErrors.form && (
                    <div className="alert alert-danger py-2 small">{traumaErrors.form}</div>
                  )}

                  <div className="row g-3">
                    <div className="col-12">
                      <Field label={t("Temporary Identifier", "عارضی شناخت")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="er_board.trauma_temp_id_input"
                          value={traumaTempId}
                          onChange={(e) => setTraumaTempId(e.target.value)}
                          placeholder="e.g. Unknown Male 1 (auto-generated if blank)"
                        />
                      </Field>
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Estimated Gender", "جنس")}>
                        <select
                          className="form-select"
                          data-help="er_board.trauma_gender_select"
                          value={traumaGender}
                          onChange={(e) => setTraumaGender(e.target.value as any)}
                        >
                          <option value="male">{t("Male", "مرد")}</option>
                          <option value="female">{t("Female", "عورت")}</option>
                          <option value="other">{t("Other", "دیگر")}</option>
                          <option value="unknown">{t("Unknown", "نامعلوم")}</option>
                        </select>
                      </Field>
                    </div>

                    <div className="col-md-6">
                      <Field label={t("Approximate Age (Years)", "تخمینہ عمر (سال)")}>
                        <input
                          type="number"
                          className="form-control"
                          data-help="er_board.trauma_age_input"
                          value={traumaAge}
                          onChange={(e) => setTraumaAge(e.target.value)}
                          placeholder="e.g. 35"
                          min={0}
                          max={130}
                        />
                      </Field>
                      {traumaErrors.approx_age_years && (
                        <div className="text-danger small mt-1">{traumaErrors.approx_age_years}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="er_board.trauma_cancel_btn"
                    onClick={() => setShowTraumaModal(false)}
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    data-help="er_board.trauma_submit_btn"
                  >
                    {t("Create Trauma Patient", "ٹراما مریض بنائیں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Visit Detail Modal */}
      {selectedVisitId && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  📋 {t("ER Visit Details", "ایمرجنسی وزٹ تفصیل")} #{selectedVisitId}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_board.detail_close_btn"
                  onClick={() => setSelectedVisitId(null)}
                ></button>
              </div>
              <div className="modal-body">
                {loadingDetail ? (
                  <div className="text-center py-4 text-muted">{t("Loading visit details...", "تفصیل لوڈ ہو رہی ہے...")}</div>
                ) : visitDetail ? (
                  <div>
                    {/* Patient Banner */}
                    <div className="p-3 bg-light rounded border mb-3">
                      <div className="row g-2">
                        <div className="col-md-4">
                          <span className="text-muted small">{t("Patient:", "مریض:")}</span>
                          <div className="fw-bold fs-6">{visitDetail.patient_name}</div>
                          <div className="small text-muted">{visitDetail.mrn} · {visitDetail.gender}, {visitDetail.age_years}y</div>
                        </div>
                        <div className="col-md-4">
                          <span className="text-muted small">{t("ER Register Number:", "ایمرجنسی رجسٹریشن نمبر:")}</span>
                          <div className="fw-bold">{visitDetail.er_number}</div>
                          <div className="small text-muted">Arrival: {formatHospitalTime(visitDetail.arrived_at, timeZone)}</div>
                        </div>
                        <div className="col-md-4">
                          <span className="text-muted small">{t("Current Stage:", "موجودہ مرحلہ:")}</span>
                          <div>
                            <span className="badge bg-primary fs-6">{visitDetail.stage}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Triage Assessments */}
                    <h6 className="fw-bold text-dark border-bottom pb-1 mb-2">
                      🩺 {t("Triage History & Danger Signs", "ٹرائیج تاریخچہ اور خطرے کی علامات")}
                    </h6>
                    {visitDetail.triages.length === 0 ? (
                      <div className="text-muted small py-2 fst-italic">
                        {t("Not yet triaged.", "ابھی ٹرائیج نہیں ہوا۔")}
                      </div>
                    ) : (
                      <div className="list-group mb-3">
                        {visitDetail.triages.map((trg) => (
                          <div key={trg.assessment_id} className="list-group-item p-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="badge bg-danger fs-6">
                                Level {trg.assigned_level}: {trg.assigned_level_name} ({trg.assigned_colour})
                              </span>
                              <small className="text-muted">
                                {formatHospitalTime(trg.assessed_at, timeZone)}
                              </small>
                            </div>
                            <div className="small text-muted mb-1">
                              <strong>{t("Complaint:", "شکایت:")}</strong> {trg.presenting_complaint}
                            </div>
                            {trg.matched.length > 0 && (
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {trg.matched.map((m, idx) => (
                                  <span key={idx} className="badge bg-danger-subtle text-danger border" style={{ fontSize: "0.7rem" }}>
                                    🚨 {m.label} ({m.kind})
                                  </span>
                                ))}
                              </div>
                            )}
                            {trg.author_stamp && (
                              <div className="text-secondary small mt-2 pt-1 border-top" style={{ fontSize: "0.75rem" }}>
                                ✍️ {trg.author_stamp.text}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stage Timeline Log */}
                    <h6 className="fw-bold text-dark border-bottom pb-1 mb-2">
                      ⏱ {t("Stage Transition Log", "مراحل کا ٹائم لائن لاگ")}
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered small">
                        <thead className="table-light">
                          <tr>
                            <th>{t("From Stage", "پچھلا مرحلہ")}</th>
                            <th>{t("To Stage", "نیا مرحلہ")}</th>
                            <th>{t("Timestamp", "وقت")}</th>
                            <th>{t("Staff", "عملہ")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitDetail.stages.map((stg, i) => (
                            <tr key={i}>
                              <td>{stg.from_stage || "-"}</td>
                              <td className="fw-bold">{stg.to_stage}</td>
                              <td>{formatHospitalTime(stg.at, timeZone)}</td>
                              <td>{stg.by_name || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  data-help="er_board.detail_done_btn"
                  onClick={() => setSelectedVisitId(null)}
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
