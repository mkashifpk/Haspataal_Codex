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
  ErVisitDetailOut,
  ErTriageScaleOut,
  ErTriageIn,
  ErStageIn,
  ErDepartIn,
  ErMedicoLegalIn,
  MlcCaseTypeOut,
  MlcOpenIn,
  PatientDocumentOut,
} from "../generated/er_visit";
import {
  getVisit,
  getScale,
  triageVisit,
  medicoLegal,
  setStage,
  depart,
  caseTypes,
  openCaseMlcCases,
  listDocumentsPatients,
  uploadDocumentPatientsDocuments,
  downloadDocumentPatientDocuments,
} from "../generated/er_visit";
import {
  evaluateErVisitView,
  canViewErVisit,
  canRecordTriage,
  canManageErVisit,
  canManageMlc,
  canUploadDocument,
  canViewDocument,
  calculateSuggestedTriageLevel,
  validateTriageInput,
  validateStageInput,
  validateDepartureInput,
  validateOutsideDocument,
  explainErVisitError,
} from "../er-visit-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";

export interface ERVisitProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialVisitId?: number;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
}

export function ERVisit({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  initialVisitId,
  onNavigateScreen,
  onBack,
}: ERVisitProps) {
  // Active visit selection state
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(
    initialVisitId ?? null
  );
  const [lookupVisitInput, setLookupVisitInput] = useState<string>(
    initialVisitId ? String(initialVisitId) : ""
  );

  // Modals visibility
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showDepartModal, setShowDepartModal] = useState(false);
  const [showMlcModal, setShowMlcModal] = useState(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Status banners & alerts
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [codeRedAlert, setCodeRedAlert] = useState<string | null>(null);

  // View Evaluation & permissions
  const viewEval = evaluateErVisitView(establishment);
  const canView = canViewErVisit(user) && viewEval.canShow;
  const canTriage = canRecordTriage(user) && !viewEval.isReadOnly;
  const canManage = canManageErVisit(user) && !viewEval.isReadOnly;
  const canMlc = canManageMlc(user) && !viewEval.isReadOnly;
  const canUploadDoc = canUploadDocument(user) && !viewEval.isReadOnly;
  const canViewDoc = canViewDocument(user);

  // Load Visit Detail
  const visitLoad = useLoad<ErVisitDetailOut | null>(
    async () => {
      if (!selectedVisitId || !canView) return null;
      const data = await getVisit(selectedVisitId);
      if (data.triage_level === 1) {
        setCodeRedAlert(
          t(
            "CRITICAL: Active Level 1 (Resuscitation / Code Red) emergency patient!",
            "اہم انتباہ: ایمرجنسی میں درجہ 1 (کوڈ ریڈ / فوری بحالی) کا مریض موجود ہے!"
          )
        );
      } else {
        setCodeRedAlert(null);
      }
      return data;
    },
    [selectedVisitId, stream]
  );

  const visit = visitLoad.data;

  // Load Triage Scale
  const scaleLoad = useLoad<ErTriageScaleOut | null>(
    async () => {
      if (!canView) return null;
      return await getScale();
    },
    [canView]
  );
  const scale = scaleLoad.data;

  // Load MLC Case Types
  const caseTypesLoad = useLoad<MlcCaseTypeOut[]>(
    async () => {
      if (!canView) return [];
      return await caseTypes();
    },
    [canView]
  );
  const mlcCaseTypes = caseTypesLoad.data || [];

  // Load Patient Documents
  const [patientDocs, setPatientDocs] = useState<PatientDocumentOut[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const loadDocuments = async (patientId: number) => {
    if (!canViewDoc) return;
    setLoadingDocs(true);
    try {
      const docs = await listDocumentsPatients(patientId);
      setPatientDocs(docs);
    } catch {
      // Ignored for presentation
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (visit?.patient_id) {
      loadDocuments(visit.patient_id);
    }
  }, [visit?.patient_id]);

  // Write controller
  const write = useClinicalWrite(user, "er_visit", () => {
    visitLoad.reload();
    if (visit?.patient_id) {
      loadDocuments(visit.patient_id);
    }
  });

  // Triage Form State
  const [triageComplaint, setTriageComplaint] = useState("");
  const [triageHeartRate, setTriageHeartRate] = useState<string>("");
  const [triageRespRate, setTriageRespRate] = useState<string>("");
  const [triageBpSys, setTriageBpSys] = useState<string>("");
  const [triageBpDia, setTriageBpDia] = useState<string>("");
  const [triageSpo2, setTriageSpo2] = useState<string>("");
  const [triageTempC, setTriageTempC] = useState<string>("");
  const [triageGcs, setTriageGcs] = useState<string>("");
  const [triagePain, setTriagePain] = useState<string>("");
  const [triageGlucose, setTriageGlucose] = useState<string>("");
  const [triageSigns, setTriageSigns] = useState<number[]>([]);
  const [triageAssignedLevel, setTriageAssignedLevel] = useState<number | null>(null);
  const [triageOverrideReason, setTriageOverrideReason] = useState("");
  const [triageIsMlc, setTriageIsMlc] = useState<boolean>(false);
  const [triageMlcTypeId, setTriageMlcTypeId] = useState<number | null>(null);
  const [triageArrivalMode, setTriageArrivalMode] = useState<
    "WalkIn" | "Ambulance" | "Rescue1122" | "Police" | "Referred" | null
  >(null);
  const [triageErrors, setTriageErrors] = useState<Record<string, string>>({});

  // Populate Triage defaults when opening modal
  const openTriageForm = () => {
    if (!visit) return;
    setTriageComplaint(visit.presenting_complaint || "");
    setTriageArrivalMode(visit.arrival_mode);
    setTriageIsMlc(visit.is_medico_legal === true);
    setTriageMlcTypeId(visit.mlc_case_type_id);
    setTriageSigns([]);
    setTriageHeartRate("");
    setTriageRespRate("");
    setTriageBpSys("");
    setTriageBpDia("");
    setTriageSpo2("");
    setTriageTempC("");
    setTriageGcs("");
    setTriagePain("");
    setTriageGlucose("");
    setTriageAssignedLevel(null);
    setTriageOverrideReason("");
    setTriageErrors({});
    setShowTriageModal(true);
  };

  // Live Suggested Triage Level Calculation (rule:b985ad38dc)
  const currentSuggestedLevel = useMemo(() => {
    if (!scale) return 5;
    const vitals = {
      heart_rate: triageHeartRate ? Number(triageHeartRate) : null,
      respiratory_rate: triageRespRate ? Number(triageRespRate) : null,
      bp_systolic: triageBpSys ? Number(triageBpSys) : null,
      bp_diastolic: triageBpDia ? Number(triageBpDia) : null,
      spo2: triageSpo2 ? Number(triageSpo2) : null,
      temp_c: triageTempC ? Number(triageTempC) : null,
      gcs: triageGcs ? Number(triageGcs) : null,
      pain_score: triagePain ? Number(triagePain) : null,
      blood_glucose: triageGlucose ? Number(triageGlucose) : null,
    };
    const res = calculateSuggestedTriageLevel(
      scale,
      visit?.age_years ?? null,
      triageSigns,
      vitals
    );
    return res.suggestedLevel;
  }, [
    scale,
    visit?.age_years,
    triageSigns,
    triageHeartRate,
    triageRespRate,
    triageBpSys,
    triageBpDia,
    triageSpo2,
    triageTempC,
    triageGcs,
    triagePain,
    triageGlucose,
  ]);

  const handleToggleSign = (discriminatorId: number) => {
    setTriageSigns((prev) =>
      prev.includes(discriminatorId)
        ? prev.filter((id) => id !== discriminatorId)
        : [...prev, discriminatorId]
    );
  };

  const handleSaveTriage = async () => {
    if (!visit) return;
    const effLevel = triageAssignedLevel ?? currentSuggestedLevel;
    const payload: ErTriageIn = {
      presenting_complaint: triageComplaint,
      heart_rate: triageHeartRate ? Number(triageHeartRate) : null,
      respiratory_rate: triageRespRate ? Number(triageRespRate) : null,
      bp_systolic: triageBpSys ? Number(triageBpSys) : null,
      bp_diastolic: triageBpDia ? Number(triageBpDia) : null,
      spo2: triageSpo2 ? Number(triageSpo2) : null,
      temp_c: triageTempC ? triageTempC : null,
      gcs: triageGcs ? Number(triageGcs) : null,
      pain_score: triagePain ? Number(triagePain) : null,
      blood_glucose: triageGlucose ? triageGlucose : null,
      signs: triageSigns,
      assigned_level: effLevel,
      override_reason: effLevel !== currentSuggestedLevel ? triageOverrideReason : null,
      is_medico_legal: triageIsMlc,
      mlc_case_type_id: triageIsMlc ? triageMlcTypeId : null,
      arrival_mode: triageArrivalMode,
    };

    const errs = validateTriageInput(payload, currentSuggestedLevel);
    if (Object.keys(errs).length > 0) {
      setTriageErrors(errs);
      return;
    }

    write.start({
      path: `/er/visits/${visit.er_visit_id}/triage`,
      method: "POST",
      body: payload,
      permission: "er.triage.record",
      protection: "idempotent",
      label: t("Record Triage Assessment", "ٹرائیج کا معائنہ درج کریں"),
    });
    setShowTriageModal(false);
    setActionNotice(t("Triage assessment successfully recorded.", "ٹرائیج کا معائنہ کامیابی سے محفوظ ہو گیا۔"));
  };

  // Stage Form State
  const [stageTarget, setStageTarget] = useState<"InTreatment" | "Observation" | "AwaitingReferral">("InTreatment");
  const [stageNote, setStageNote] = useState("");
  const [stageErrors, setStageErrors] = useState<Record<string, string>>({});

  const handleSaveStage = async () => {
    if (!visit) return;
    const payload: ErStageIn = {
      stage: stageTarget,
      note: stageNote || null,
    };
    const errs = validateStageInput(payload);
    if (Object.keys(errs).length > 0) {
      setStageErrors(errs);
      return;
    }

    write.start({
      path: `/er/visits/${visit.er_visit_id}/stage`,
      method: "POST",
      body: payload,
      permission: "er.visit.manage",
      protection: "idempotent",
      label: t("Update Patient Stage", "مریض کا مرحلہ تبدیل کریں"),
    });
    setShowStageModal(false);
    setStageNote("");
    setActionNotice(t("Patient stage updated.", "مریض کا مرحلہ اپ ڈیٹ کر دیا گیا۔"));
  };

  // Departure Form State
  const [departDisposition, setDepartDisposition] = useState<
    "Discharged" | "Referred" | "LAMA" | "DischargedOnRequest" | "LeftWithoutBeingSeen" | "Admitted"
  >("Discharged");
  const [departCondition, setDepartCondition] = useState<
    "Improved" | "Stable" | "Unchanged" | "Deteriorated" | "Critical" | null
  >("Improved");
  const [departFollowUp, setDepartFollowUp] = useState("");
  const [departReferredTo, setDepartReferredTo] = useState("");
  const [departReferralReason, setDepartReferralReason] = useState("");
  const [departStatementSignedBy, setDepartStatementSignedBy] = useState("");
  const [departAbsenceNoticedAt, setDepartAbsenceNoticedAt] = useState("");
  const [departNote, setDepartNote] = useState("");
  const [departErrors, setDepartErrors] = useState<Record<string, string>>({});

  const handleSaveDeparture = async () => {
    if (!visit) return;
    const payload: ErDepartIn = {
      disposition: departDisposition,
      condition_at_departure: departCondition,
      follow_up_advice: departFollowUp || null,
      referred_to: departReferredTo || null,
      referral_reason: departReferralReason || null,
      statement_signed_by: departStatementSignedBy || null,
      absence_noticed_at: departAbsenceNoticedAt || null,
      admission_id: visit.admission_id,
      note: departNote || null,
    };
    const errs = validateDepartureInput(payload, visit);
    if (Object.keys(errs).length > 0) {
      setDepartErrors(errs);
      return;
    }

    write.start({
      path: `/er/visits/${visit.er_visit_id}/depart`,
      method: "POST",
      body: payload,
      permission: "er.visit.manage",
      protection: "idempotent",
      label: t("Record Emergency Departure", "ایمرجنسی روانگی درج کریں"),
    });
    setShowDepartModal(false);
    setActionNotice(t("Emergency departure recorded. Visit closed.", "ایمرجنسی روانگی درج کر لی گئی۔ وزٹ مکمل۔"));
  };

  // MLC Modal State
  const [mlcCaseTypeId, setMlcCaseTypeId] = useState<number>(mlcCaseTypes[0]?.case_type_id ?? 1);
  const [mlcBroughtBy, setMlcBroughtBy] = useState<
    "Police" | "Rescue1122" | "Ambulance" | "Relatives" | "Self" | "Bystander" | "Other"
  >("Self");
  const [mlcBroughtByName, setMlcBroughtByName] = useState("");
  const [mlcBroughtByPhone, setMlcBroughtByPhone] = useState("");
  const [mlcAllegedHistory, setMlcAllegedHistory] = useState("");
  const [mlcHistoryGivenBy, setMlcHistoryGivenBy] = useState("");
  const [mlcExamFindings, setMlcExamFindings] = useState("");
  const [mlcErrors, setMlcErrors] = useState<Record<string, string>>({});

  const handleSaveMlc = async () => {
    if (!visit) return;
    if (!mlcAllegedHistory || mlcAllegedHistory.trim().length < 5) {
      setMlcErrors({ alleged_history: "Alleged history in teller's words is required." });
      return;
    }

    const payload: MlcOpenIn = {
      patient_id: visit.patient_id,
      ticket_id: visit.ticket_id,
      admission_id: visit.admission_id,
      case_type_id: mlcCaseTypeId,
      brought_by: mlcBroughtBy,
      brought_by_name: mlcBroughtByName || null,
      brought_by_phone: mlcBroughtByPhone || null,
      alleged_history: mlcAllegedHistory,
      history_given_by: mlcHistoryGivenBy || null,
      examination_findings: mlcExamFindings || null,
    };

    write.start({
      path: `/mlc/cases`,
      method: "POST",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Open Medico-Legal Case", "میڈیکو لیگل کیس درج کریں"),
    });
    setShowMlcModal(false);
    setActionNotice(t("Medico-legal case successfully opened.", "میڈیکو لیگل کیس کامیابی سے درج ہو گیا۔"));
  };

  // Outside Document Upload State
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<string>("LabReport");
  const [docFacility, setDocFacility] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  const handleUploadDoc = async () => {
    if (!visit || !docFile) return;
    const validation = validateOutsideDocument({
      title: docTitle,
      doc_type: docType,
      source_facility: docFacility,
      document_date: docDate,
      file: docFile,
    });
    if (Object.keys(validation).length > 0) {
      setDocErrors(validation);
      return;
    }

    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("doc_type", docType);
    formData.append("title", docTitle);
    formData.append("is_outside", "true");
    formData.append("source_facility", docFacility);
    formData.append("document_date", docDate);

    write.start({
      path: `/patients/${visit.patient_id}/documents`,
      method: "POST",
      body: formData,
      permission: "patient.document.upload",
      protection: "idempotent",
      label: t("Upload Outside Clinical Report", "بیرونی طبی رپورٹ اپ لوڈ کریں"),
    });
    setShowDocUploadModal(false);
    setDocFile(null);
    setDocTitle("");
    setDocFacility("");
    setActionNotice(t("Outside clinical report attached successfully.", "بیرونی طبی رپورٹ کامیابی سے منسلک ہو گئی۔"));
  };

  const handleDownloadDoc = async (documentId: number) => {
    try {
      await downloadDocumentPatientDocuments(documentId);
    } catch {
      // Ignored for presentation
    }
  };

  if (!canView) {
    return (
      <div className="container-fluid p-4">
        <ErrorBox
          error={t(
            "You do not have permission to view emergency visit details (er.visit.view required).",
            "آپ کے پاس ایمرجنسی وزٹ کی تفصیلات دیکھنے کا اختیار نہیں ہے۔"
          )}
        />
        {onBack && (
          <button
            type="button"
            className="btn btn-secondary mt-3"
            data-help="er_visit.back"
            onClick={onBack}
          >
            ← {t("Back", "واپس")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="container-fluid p-3 er-visit-container">
      {/* View Banner / Setup Mode */}
      {viewEval.bannerNotice && (
        <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center">
          <span className="me-2">⚠️</span>
          <span>{viewEval.bannerNotice}</span>
        </div>
      )}

      {/* Code Red Audio / Visual Notification */}
      {codeRedAlert && (
        <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center animate-pulse">
          <div className="d-flex align-items-center">
            <span className="fs-4 me-2">🚨</span>
            <strong className="fs-5">{codeRedAlert}</strong>
          </div>
          <button
            type="button"
            className="btn-close"
            data-help="er_visit.btn_dismiss_alert"
            onClick={() => setCodeRedAlert(null)}
          />
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div className="alert alert-info py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close"
            data-help="er_visit.btn_dismiss_notice"
            onClick={() => setActionNotice(null)}
          />
        </div>
      )}

      {/* Header & Visit Lookup Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          {onBack && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-help="er_visit.back"
              onClick={onBack}
            >
              ← {t("ER Board", "ایمرجنسی بورڈ")}
            </button>
          )}
          <h4 className="mb-0">
            {t("Emergency Visit Chart", "ایمرجنسی وزٹ چارٹ")}
            {visit && (
              <span className="badge bg-secondary ms-2 fs-6">
                {visit.er_number}
              </span>
            )}
          </h4>
        </div>

        {/* Visit selector input */}
        <div className="d-flex align-items-center gap-2">
          <label className="col-form-label-sm text-muted mb-0">
            {t("Visit ID:", "وزٹ آئی ڈی:")}
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: "120px" }}
            data-help="er_visit.input_visit_id"
            value={lookupVisitInput}
            onChange={(e) => setLookupVisitInput(e.target.value)}
            placeholder="e.g. 1"
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-help="er_visit.btn_lookup_visit"
            onClick={() => {
              const id = Number(lookupVisitInput);
              if (id > 0) setSelectedVisitId(id);
            }}
          >
            {t("Open", "کھولیں")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            data-help="er_visit.btn_refresh"
            onClick={() => visitLoad.reload()}
          >
            ↻ {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Load State */}
      <LoadState
        loading={visitLoad.loading}
        error={visitLoad.error}
        retry={() => visitLoad.reload()}
      />

      {!visit && !visitLoad.loading && (
        <Empty>
          <div className="text-center py-3">
            <h5 className="text-muted">{t("No Visit Selected", "کوئی وزٹ منتخب نہیں")}</h5>
            <p className="text-muted mb-0">
              {t(
                "Please enter an ER visit ID or select a patient from the tracking board.",
                "برائے مہربانی ایمرجنسی وزٹ آئی ڈی درج کریں یا بورڈ سے مریض منتخب کریں۔"
              )}
            </p>
          </div>
        </Empty>
      )}

      {visit && (
        <div>
          {/* Patient Info & Status Banner */}
          <div className="card mb-3 shadow-sm">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-4">
                  <h5 className="mb-1 text-primary">{visit.patient_name}</h5>
                  <div className="text-muted small">
                    <span>MRN: <strong>{visit.mrn}</strong></span> •{" "}
                    <span>
                      {visit.gender ? t(visit.gender, visit.gender) : "—"}, {visit.age_years ?? "—"} {t("yrs", "سال")}
                    </span>
                  </div>
                  <div className="small mt-1">
                    <strong>{t("Complaint:", "تکلیف:")}</strong>{" "}
                    <span className="text-dark">{visit.presenting_complaint || "—"}</span>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="small">
                    <strong>{t("Arrival Mode:", "آمد کا ذریعہ:")}</strong> {visit.arrival_mode ?? "—"}
                  </div>
                  <div className="small">
                    <strong>{t("Arrived:", "آمد کا وقت:")}</strong>{" "}
                    {formatHospitalTime(visit.arrived_at, timeZone)} (
                    {visit.minutes_in_er} {t("min in ER", "منٹ سے ایمرجنسی میں")})
                  </div>
                  <div className="small">
                    <strong>{t("Current Stage:", "موجودہ مرحلہ:")}</strong>{" "}
                    <span className="badge bg-info text-dark">{visit.stage}</span> (
                    {visit.minutes_in_stage ?? 0} {t("min", "منٹ")})
                  </div>
                </div>

                <div className="col-md-4 text-end">
                  {/* Triage Priority Badge */}
                  <div className="mb-2">
                    {visit.triage_level ? (
                      <span
                        className="badge fs-6 p-2"
                        style={{
                          backgroundColor:
                            visit.triage_colour?.toLowerCase() === "red"
                              ? "#dc3545"
                              : visit.triage_colour?.toLowerCase() === "orange"
                              ? "#fd7e14"
                              : visit.triage_colour?.toLowerCase() === "yellow"
                              ? "#ffc107"
                              : visit.triage_colour?.toLowerCase() === "green"
                              ? "#198754"
                              : "#0dcaf0",
                          color:
                            visit.triage_colour?.toLowerCase() === "yellow" ? "#000" : "#fff",
                        }}
                      >
                        Level {visit.triage_level}: {visit.triage_level_name}
                      </span>
                    ) : (
                      <span className="badge bg-warning text-dark fs-6 p-2">
                        {t("Untriaged", "غیر ٹرائیج شدہ")}
                      </span>
                    )}
                  </div>

                  {/* Overdue & Warning Badges (rule:618704df95) */}
                  <div className="d-flex flex-wrap gap-1 justify-content-end">
                    {visit.flags.includes("TriageOverdue") && (
                      <span className="badge bg-danger">Triage Overdue</span>
                    )}
                    {visit.flags.includes("DoctorOverdue") && (
                      <span className="badge bg-danger">Doctor Overdue</span>
                    )}
                    {visit.flags.includes("ObservationTooLong") && (
                      <span className="badge bg-warning text-dark">Observation Overdue</span>
                    )}
                    {visit.flags.includes("AdmissionWaitTooLong") && (
                      <span className="badge bg-warning text-dark">Admission Wait Overdue</span>
                    )}
                    {visit.flags.includes("ReferralWaitTooLong") && (
                      <span className="badge bg-warning text-dark">Referral Wait Overdue</span>
                    )}
                    {visit.flags.includes("MlcNotOpened") && (
                      <span className="badge bg-danger">MLC Not Opened</span>
                    )}
                    {visit.flags.includes("MedicoLegalUndecided") && (
                      <span className="badge bg-warning text-dark">MLC Undecided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Departed Visit Banner (rule:231e22e6bd) */}
              {visit.stage === "Departed" && (
                <div className="alert alert-secondary mt-3 mb-0 py-2 px-3 small">
                  <strong>{t("Departed Visit:", "روانہ ہو چکا:")}</strong>{" "}
                  {visit.disposition} {t("at", "بوقت")}{" "}
                  {visit.departed_at ? formatHospitalTime(visit.departed_at, timeZone) : "—"} •{" "}
                  {t("Condition:", "حالت:")} {visit.condition_at_departure || "—"} •{" "}
                  {t("Signed by:", "دستخط:")} {visit.departure_stamp?.text || "—"}
                </div>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            {canTriage && visit.stage !== "Departed" && (
              <button
                type="button"
                className="btn btn-primary"
                data-help="er_visit.btn_open_triage"
                onClick={openTriageForm}
              >
                🩺 {t("Triage Assessment", "ٹرائیج کا معائنہ")}
              </button>
            )}

            {canManage && visit.stage !== "Departed" && (
              <button
                type="button"
                className="btn btn-outline-primary"
                data-help="er_visit.btn_open_stage"
                onClick={() => {
                  setStageTarget("InTreatment");
                  setStageNote("");
                  setStageErrors({});
                  setShowStageModal(true);
                }}
              >
                ➡️ {t("Update Stage", "مرحلہ تبدیل کریں")}
              </button>
            )}

            {canManage && visit.stage !== "Departed" && (
              <button
                type="button"
                className="btn btn-outline-danger"
                data-help="er_visit.btn_open_depart"
                onClick={() => {
                  setDepartDisposition("Discharged");
                  setDepartCondition("Improved");
                  setDepartFollowUp("");
                  setDepartReferredTo("");
                  setDepartReferralReason("");
                  setDepartStatementSignedBy("");
                  setDepartAbsenceNoticedAt("");
                  setDepartNote("");
                  setDepartErrors({});
                  setShowDepartModal(true);
                }}
              >
                🚪 {t("Record Departure", "روانگی درج کریں")}
              </button>
            )}

            {canMlc && visit.stage !== "Departed" && !visit.mlc_id && (
              <button
                type="button"
                className="btn btn-outline-warning text-dark"
                data-help="er_visit.btn_open_mlc"
                onClick={() => {
                  setMlcAllegedHistory("");
                  setMlcHistoryGivenBy("");
                  setMlcExamFindings("");
                  setMlcErrors({});
                  setShowMlcModal(true);
                }}
              >
                ⚖️ {t("Open MLC Case", "میڈیکو لیگل کیس کھولیں")}
              </button>
            )}

            {canUploadDoc && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                data-help="er_visit.btn_open_doc_upload"
                onClick={() => {
                  setDocFile(null);
                  setDocTitle("");
                  setDocType("LabReport");
                  setDocFacility("");
                  setDocDate(new Date().toISOString().slice(0, 10));
                  setDocErrors({});
                  setShowDocUploadModal(true);
                }}
              >
                📎 {t("Attach Outside Report", "بیرونی رپورٹ منسلک کریں")}
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline-info"
              data-help="er_visit.btn_view_history"
              onClick={() => setShowHistoryModal(true)}
            >
              📜 {t("Care Timeline & History", "ٹائم لائن اور سابقہ ٹرائیج")}
            </button>
          </div>

          {/* Main Grid: Details, Medico-legal, Outside Documents */}
          <div className="row g-3">
            {/* Left Column: Triage & Vitals Overview */}
            <div className="col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <strong className="mb-0">
                    {t("Latest Triage & Vitals", "تازہ ترین وائٹلز اور ٹرائیج")}
                  </strong>
                  {visit.triaged_at && (
                    <span className="text-muted small">
                      {formatHospitalTime(visit.triaged_at, timeZone)}
                    </span>
                  )}
                </div>
                <div className="card-body">
                  {visit.triages.length === 0 ? (
                    <div className="text-muted py-3 text-center">
                      {t("Patient has not been triaged yet.", "مریض کا ابھی تک ٹرائیج نہیں ہوا۔")}
                    </div>
                  ) : (
                    (() => {
                      const latest = visit.triages[visit.triages.length - 1];
                      return (
                        <div>
                          <div className="row g-2 mb-3">
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("Heart Rate", "نبض")}</div>
                                <strong className="fs-5">{latest.heart_rate ?? "—"}</strong> bpm
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("Blood Pressure", "بلڈ پریشر")}</div>
                                <strong className="fs-5">
                                  {latest.bp_systolic && latest.bp_diastolic
                                    ? `${latest.bp_systolic}/${latest.bp_diastolic}`
                                    : "—"}
                                </strong>
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("SpO2", "آکسیجن")}</div>
                                <strong className="fs-5">{latest.spo2 ?? "—"}%</strong>
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("Resp Rate", "سانس کی رفتار")}</div>
                                <strong className="fs-5">{latest.respiratory_rate ?? "—"}</strong> /min
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("Temperature", "بخار")}</div>
                                <strong className="fs-5">{latest.temp_c ?? "—"}</strong> °C
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="p-2 border rounded text-center">
                                <div className="text-muted small">{t("GCS Score", "جی سی ایس")}</div>
                                <strong className="fs-5">{latest.gcs ?? "—"}</strong> /15
                              </div>
                            </div>
                          </div>

                          {/* Matched Danger Signs / Vital limits */}
                          {latest.matched.length > 0 && (
                            <div className="mb-2">
                              <strong className="small text-muted">
                                {t("Danger Signs / Triggers:", "خطرے کی علامات:")}
                              </strong>
                              <ul className="list-unstyled mt-1 mb-0 small">
                                {latest.matched.map((m, idx) => (
                                  <li key={idx} className="text-danger">
                                    • Level {m.level} [{m.kind}]: {m.label}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {latest.override_reason && (
                            <div className="alert alert-warning py-1 px-2 small mb-2">
                              <strong>{t("Clinical Override:", "کلینیکل اوور رائیڈ:")}</strong>{" "}
                              {latest.override_reason}
                            </div>
                          )}

                          <div className="text-muted small border-top pt-2 mt-2">
                            {t("Author:", "دستخط کنندہ:")} {latest.author_stamp.text}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Outside Documents & Reports (rule:794ff452da) */}
            <div className="col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <strong className="mb-0">
                    {t("Reports Brought by Patient", "مریض کی لائی گئی بیرونی رپورٹس")}
                  </strong>
                  <span className="badge bg-secondary">{patientDocs.length}</span>
                </div>
                <div className="card-body p-0">
                  {loadingDocs && <div className="p-3 text-center">{t("Loading documents...", "دستاویزات لوڈ ہو رہی ہیں...")}</div>}
                  {!loadingDocs && patientDocs.length === 0 && (
                    <div className="p-4 text-center text-muted">
                      {t("No outside reports attached.", "کوئی بیرونی رپورٹ منسلک نہیں۔")}
                    </div>
                  )}
                  {!loadingDocs && patientDocs.length > 0 && (
                    <ul className="list-group list-group-flush">
                      {patientDocs.map((doc) => (
                        <li
                          key={doc.document_id}
                          className="list-group-item d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <strong>{doc.title || doc.doc_type}</strong>
                            <div className="small text-muted">
                              {doc.is_outside ? (
                                <span className="badge bg-warning text-dark me-2">
                                  Outside: {doc.source_facility || "Unknown Facility"},{" "}
                                  {doc.document_date || "No date"}
                                </span>
                              ) : (
                                <span className="badge bg-secondary me-2">Internal</span>
                              )}
                              <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            data-help="er_visit.btn_download_doc"
                            onClick={() => handleDownloadDoc(doc.document_id)}
                          >
                            ⬇ {t("Download", "ڈاؤن لوڈ")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Triage Modal Dialog (rule:b985ad38dc, rule:bd91e95b22) */}
      {showTriageModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title">
                  {t("Emergency Triage Assessment", "ایمرجنسی ٹرائیج کا معائنہ")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.triage_close_btn"
                  onClick={() => setShowTriageModal(false)}
                />
              </div>

              <div className="modal-body">
                {/* Live Suggested Level Header */}
                <div className="alert alert-secondary d-flex justify-content-between align-items-center py-2 px-3 mb-3">
                  <div>
                    <strong>{t("Live Calculated Priority:", "حساب شدہ ترجیح:")}</strong>
                    <span className="badge bg-primary fs-6 ms-2">
                      Level {currentSuggestedLevel}
                    </span>
                  </div>
                  <small className="text-muted">
                    {t("Updated dynamically as you tick signs and enter vitals", "علامات اور وائٹلز کے مطابق خودکار تبدیلی")}
                  </small>
                </div>

                {/* Presenting Complaint & Mode */}
                <div className="row g-2 mb-3">
                  <div className="col-md-8">
                    <Field label={t("Presenting Complaint", "بیماری / شکایت")}>
                      <input
                        type="text"
                        className="form-control"
                        data-help="er_visit.triage_complaint_input"
                        value={triageComplaint}
                        onChange={(e) => setTriageComplaint(e.target.value)}
                        placeholder="e.g. Acute chest pain, shortness of breath"
                        required
                      />
                    </Field>
                    {triageErrors.presenting_complaint && (
                      <div className="text-danger small">{triageErrors.presenting_complaint}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <Field label={t("Arrival Transport", "آمد کا ذریعہ")}>
                      <select
                        className="form-select"
                        data-help="er_visit.triage_arrival_mode_select"
                        value={triageArrivalMode || "WalkIn"}
                        onChange={(e) =>
                          setTriageArrivalMode(e.target.value as any)
                        }
                      >
                        <option value="WalkIn">Walk-in</option>
                        <option value="Ambulance">Ambulance</option>
                        <option value="Rescue1122">Rescue 1122</option>
                        <option value="Police">Police</option>
                        <option value="Referred">Referred</option>
                      </select>
                    </Field>
                  </div>
                </div>

                {/* Vitals Inputs Grid */}
                <h6 className="border-bottom pb-1 text-muted">
                  {t("Quantitative Vital Signs", "وائٹل سائنز")}
                </h6>
                <div className="row g-2 mb-3">
                  <div className="col-md-3">
                    <Field label={t("Heart Rate (bpm)", "نبض")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_hr_input"
                        value={triageHeartRate}
                        onChange={(e) => setTriageHeartRate(e.target.value)}
                        placeholder="72"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Resp Rate (/min)", "سانس رفتار")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_rr_input"
                        value={triageRespRate}
                        onChange={(e) => setTriageRespRate(e.target.value)}
                        placeholder="16"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Systolic BP", "سسٹولک بی پی")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_bpsys_input"
                        value={triageBpSys}
                        onChange={(e) => setTriageBpSys(e.target.value)}
                        placeholder="120"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Diastolic BP", "ڈایاسٹولک بی پی")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_bpdia_input"
                        value={triageBpDia}
                        onChange={(e) => setTriageBpDia(e.target.value)}
                        placeholder="80"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("SpO2 (%)", "آکسیجن")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_spo2_input"
                        value={triageSpo2}
                        onChange={(e) => setTriageSpo2(e.target.value)}
                        placeholder="98"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Temp (°C)", "بخار")}>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        data-help="er_visit.triage_temp_input"
                        value={triageTempC}
                        onChange={(e) => setTriageTempC(e.target.value)}
                        placeholder="37.0"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("GCS (3-15)", "جی سی ایس")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_gcs_input"
                        value={triageGcs}
                        onChange={(e) => setTriageGcs(e.target.value)}
                        placeholder="15"
                      />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Pain Score (0-10)", "درد اسکور")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="er_visit.triage_pain_input"
                        value={triagePain}
                        onChange={(e) => setTriagePain(e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                </div>

                {/* Qualitative Danger Signs Checkboxes per Level */}
                <h6 className="border-bottom pb-1 text-muted">
                  {t("Clinical Danger Signs (Level 1 Resuscitation to Level 5)", "طبی خطرے کی علامات")}
                </h6>
                {scale?.levels.map((lvl) => (
                  <div key={lvl.level} className="mb-2 p-2 border rounded">
                    <strong style={{ color: lvl.colour === "Red" ? "#dc3545" : "#0d6efd" }}>
                      Level {lvl.level}: {lvl.name} ({lvl.target_minutes} min target)
                    </strong>
                    {lvl.signs.length === 0 ? (
                      <div className="text-muted small">{t("No qualitative signs configured.", "کوئی علامت مقرر نہیں۔")}</div>
                    ) : (
                      <div className="row g-1 mt-1">
                        {lvl.signs.map((sign) => (
                          <div key={sign.discriminator_id} className="col-md-6">
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                data-help="er_visit.triage_sign_checkbox"
                                id={`sign-${sign.discriminator_id}`}
                                checked={triageSigns.includes(sign.discriminator_id)}
                                onChange={() => handleToggleSign(sign.discriminator_id)}
                              />
                              <label
                                className="form-check-label small"
                                htmlFor={`sign-${sign.discriminator_id}`}
                              >
                                {sign.label}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Level Assignment & Override */}
                <div className="row g-2 mb-3 mt-2">
                  <div className="col-md-4">
                    <Field label={t("Assigned Triage Priority", "تفویض کردہ ترجیح")}>
                      <select
                        className="form-select"
                        data-help="er_visit.triage_level_select"
                        value={triageAssignedLevel ?? currentSuggestedLevel}
                        onChange={(e) => setTriageAssignedLevel(Number(e.target.value))}
                      >
                        <option value={1}>Level 1: Resuscitation</option>
                        <option value={2}>Level 2: Emergency</option>
                        <option value={3}>Level 3: Urgent</option>
                        <option value={4}>Level 4: Semi-urgent</option>
                        <option value={5}>Level 5: Non-urgent</option>
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-8">
                    {(triageAssignedLevel ?? currentSuggestedLevel) !== currentSuggestedLevel && (
                      <div>
                        <Field label={t("Clinical Override Reason (Mandatory)", "اوور رائیڈ کی وجہ (لازمی)")}>
                          <input
                            type="text"
                            className="form-control"
                            data-help="er_visit.triage_override_input"
                            value={triageOverrideReason}
                            onChange={(e) => setTriageOverrideReason(e.target.value)}
                            placeholder="State clinical justification for divergent priority level"
                            required
                          />
                        </Field>
                        {triageErrors.override_reason && (
                          <div className="text-danger small">{triageErrors.override_reason}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Medico-Legal Checklist (rule:50175606cd) */}
                <div className="p-3 border rounded bg-light mb-2">
                  <label className="fw-bold d-block mb-1">
                    {t("Medico-Legal Checklist (MSDS 15 ii)", "میڈیکو لیگل چیک لسٹ")}
                  </label>
                  <div className="form-check form-check-inline">
                    <input
                      type="radio"
                      className="form-check-input"
                      name="triageMlcRadio"
                      id="mlcNo"
                      data-help="er_visit.triage_mlc_no_radio"
                      checked={!triageIsMlc}
                      onChange={() => setTriageIsMlc(false)}
                    />
                    <label className="form-check-label" htmlFor="mlcNo">
                      {t("No — Ordinary Medical Emergency", "نہیں — عام طبی ایمرجنسی")}
                    </label>
                  </div>
                  <div className="form-check form-check-inline">
                    <input
                      type="radio"
                      className="form-check-input"
                      name="triageMlcRadio"
                      id="mlcYes"
                      data-help="er_visit.triage_mlc_yes_radio"
                      checked={triageIsMlc}
                      onChange={() => setTriageIsMlc(true)}
                    />
                    <label className="form-check-label text-danger fw-bold" htmlFor="mlcYes">
                      {t("Yes — Medico-Legal Case (Accident/Assault/Poison/Burns)", "ہاں — میڈیکو لیگل کیس")}
                    </label>
                  </div>

                  {triageIsMlc && (
                    <div className="mt-2">
                      <Field label={t("Select Medico-Legal Case Type", "میڈیکو لیگل کیس کی قسم")}>
                        <select
                          className="form-select"
                          data-help="er_visit.triage_mlc_type_select"
                          value={triageMlcTypeId ?? (mlcCaseTypes[0]?.case_type_id || 1)}
                          onChange={(e) => setTriageMlcTypeId(Number(e.target.value))}
                        >
                          {mlcCaseTypes.map((t) => (
                            <option key={t.case_type_id} value={t.case_type_id}>
                              {t.name} ({t.code})
                            </option>
                          ))}
                        </select>
                      </Field>
                      {triageErrors.mlc_case_type_id && (
                        <div className="text-danger small">{triageErrors.mlc_case_type_id}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.triage_cancel_btn"
                  onClick={() => setShowTriageModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-help="er_visit.triage_submit_btn"
                  onClick={handleSaveTriage}
                >
                  {t("Save Triage Assessment", "معائنہ محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Transition Modal Dialog (rule:436225bf5c) */}
      {showStageModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title">
                  {t("Update Patient Care Stage", "مریض کا مرحلہ تبدیل کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.stage_close_btn"
                  onClick={() => setShowStageModal(false)}
                />
              </div>
              <div className="modal-body">
                <Field label={t("Select Stage", "مرحلہ منتخب کریں")}>
                  <select
                    className="form-select"
                    data-help="er_visit.stage_target_select"
                    value={stageTarget}
                    onChange={(e) => setStageTarget(e.target.value as any)}
                  >
                    <option value="InTreatment">With Doctor / In Treatment</option>
                    <option value="Observation">Under ER Observation</option>
                    <option value="AwaitingReferral">Waiting for Referral Transfer</option>
                  </select>
                </Field>
                <div className="mt-3">
                  <Field label={t("Stage Notes / Destination Rationale", "تفصیل اور منتقلی کا سبب")}>
                    <textarea
                      className="form-control"
                      rows={3}
                      data-help="er_visit.stage_note_textarea"
                      value={stageNote}
                      onChange={(e) => setStageNote(e.target.value)}
                      placeholder="Specify destination facility, bed location or observation instructions"
                    />
                  </Field>
                  {stageErrors.note && (
                    <div className="text-danger small">{stageErrors.note}</div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.stage_cancel_btn"
                  onClick={() => setShowStageModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-help="er_visit.stage_submit_btn"
                  onClick={handleSaveStage}
                >
                  {t("Update Stage", "مرحلہ محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Departure Recording Modal Dialog (rule:1c52f88e02, rule:231e22e6bd) */}
      {showDepartModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title text-danger">
                  {t("Record Emergency Room Departure", "ایمرجنسی روانگی درج کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.depart_close_btn"
                  onClick={() => setShowDepartModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="alert alert-warning py-1 px-2 small mb-3">
                  ⚠️ {t("Warning: Recording departure closes the visit. Chart will become permanently read-only.", "انتباہ: روانگی کے اندراج کے بعد وزٹ مستقل طور پر بند ہو جائے گا۔")}
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <Field label={t("Disposition (MSDS 20)", "روانگی کی قسم")}>
                      <select
                        className="form-select"
                        data-help="er_visit.depart_disposition_select"
                        value={departDisposition}
                        onChange={(e) => setDepartDisposition(e.target.value as any)}
                      >
                        <option value="Discharged">Discharged Home</option>
                        <option value="Referred">Referred to Higher Facility</option>
                        <option value="LAMA">Left Against Medical Advice (LAMA)</option>
                        <option value="DischargedOnRequest">Discharged on Request</option>
                        <option value="LeftWithoutBeingSeen">Left Without Being Seen (LWBS)</option>
                        <option value="Admitted">Admitted to Hospital Ward</option>
                      </select>
                    </Field>
                    {departErrors.disposition && (
                      <div className="text-danger small">{departErrors.disposition}</div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <Field label={t("Condition at Departure", "روانگی کے وقت حالت")}>
                      <select
                        className="form-select"
                        data-help="er_visit.depart_condition_select"
                        value={departCondition ?? "Improved"}
                        onChange={(e) => setDepartCondition(e.target.value as any)}
                      >
                        <option value="Improved">Improved</option>
                        <option value="Stable">Stable</option>
                        <option value="Unchanged">Unchanged</option>
                        <option value="Deteriorated">Deteriorated</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </Field>
                    {departErrors.condition_at_departure && (
                      <div className="text-danger small">{departErrors.condition_at_departure}</div>
                    )}
                  </div>
                </div>

                {departDisposition === "Discharged" && (
                  <div className="mb-3">
                    <Field label={t("Follow-up Care & Medication Advice", "فالو اپ ہدایات")}>
                      <textarea
                        className="form-control"
                        rows={3}
                        data-help="er_visit.depart_followup_textarea"
                        value={departFollowUp}
                        onChange={(e) => setDepartFollowUp(e.target.value)}
                        placeholder="Detail post-discharge follow-up timeline and cautionary warnings"
                      />
                    </Field>
                    {departErrors.follow_up_advice && (
                      <div className="text-danger small">{departErrors.follow_up_advice}</div>
                    )}
                  </div>
                )}

                {departDisposition === "Referred" && (
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <Field label={t("Receiving Facility Name", "منتقل شدہ ہسپتال")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="er_visit.depart_referred_to_input"
                          value={departReferredTo}
                          onChange={(e) => setDepartReferredTo(e.target.value)}
                          placeholder="e.g. Mayo Hospital / Services Hospital"
                        />
                      </Field>
                      {departErrors.referred_to && (
                        <div className="text-danger small">{departErrors.referred_to}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <Field label={t("Clinical Reason for Transfer", "منتقلی کا سبب")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="er_visit.depart_referral_reason_input"
                          value={departReferralReason}
                          onChange={(e) => setDepartReferralReason(e.target.value)}
                          placeholder="e.g. Neurosurgery ICU bed required"
                        />
                      </Field>
                      {departErrors.referral_reason && (
                        <div className="text-danger small">{departErrors.referral_reason}</div>
                      )}
                    </div>
                  </div>
                )}

                {(departDisposition === "LAMA" || departDisposition === "DischargedOnRequest") && (
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <Field label={t("Statement Signed By", "بیان پر دستخط کنندہ")}>
                        <input
                          type="text"
                          className="form-control"
                          data-help="er_visit.depart_statement_input"
                          value={departStatementSignedBy}
                          onChange={(e) => setDepartStatementSignedBy(e.target.value)}
                          placeholder="Name and relationship to patient"
                        />
                      </Field>
                    </div>
                    <div className="col-md-6">
                      <Field label={t("Absence Noticed Time (if walked out)", "غیر حاضری کا وقت")}>
                        <input
                          type="datetime-local"
                          className="form-control"
                          data-help="er_visit.depart_absence_time_input"
                          value={departAbsenceNoticedAt}
                          onChange={(e) => setDepartAbsenceNoticedAt(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {departDisposition === "LeftWithoutBeingSeen" && (
                  <div className="mb-3">
                    <Field label={t("Time Absence Was Noticed", "غیر حاضری کا وقت")}>
                      <input
                        type="datetime-local"
                        className="form-control"
                        data-help="er_visit.depart_absence_lwbs_input"
                        value={departAbsenceNoticedAt}
                        onChange={(e) => setDepartAbsenceNoticedAt(e.target.value)}
                        required
                      />
                    </Field>
                    {departErrors.absence_noticed_at && (
                      <div className="text-danger small">{departErrors.absence_noticed_at}</div>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <Field label={t("Departure Note", "روانگی کے نوٹس")}>
                    <input
                      type="text"
                      className="form-control"
                      data-help="er_visit.depart_note_input"
                      value={departNote}
                      onChange={(e) => setDepartNote(e.target.value)}
                      placeholder="Optional final summary note"
                    />
                  </Field>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.depart_cancel_btn"
                  onClick={() => setShowDepartModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-help="er_visit.depart_submit_btn"
                  onClick={handleSaveDeparture}
                >
                  {t("Confirm Departure", "روانگی تصدیق کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Medico-Legal Case Modal Dialog (rule:50175606cd) */}
      {showMlcModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title text-warning text-dark">
                  {t("Open Medico-Legal Register Entry (POST /mlc/cases)", "میڈیکو لیگل اندراج")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.mlc_close_btn"
                  onClick={() => setShowMlcModal(false)}
                />
              </div>

              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <Field label={t("Case Type", "کیس کی قسم")}>
                      <select
                        className="form-select"
                        data-help="er_visit.mlc_case_type_select"
                        value={mlcCaseTypeId}
                        onChange={(e) => setMlcCaseTypeId(Number(e.target.value))}
                      >
                        {mlcCaseTypes.map((t) => (
                          <option key={t.case_type_id} value={t.case_type_id}>
                            {t.name} ({t.code})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label={t("Brought By", "لانے والا")}>
                      <select
                        className="form-select"
                        data-help="er_visit.mlc_brought_by_select"
                        value={mlcBroughtBy}
                        onChange={(e) => setMlcBroughtBy(e.target.value as any)}
                      >
                        <option value="Police">Police Escort</option>
                        <option value="Rescue1122">Rescue 1122</option>
                        <option value="Ambulance">Private Ambulance</option>
                        <option value="Relatives">Family / Relatives</option>
                        <option value="Self">Self</option>
                        <option value="Bystander">Good Samaritan / Bystander</option>
                        <option value="Other">Other</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <Field label={t("Brought By Name", "لانے والے کا نام")}>
                      <input
                        type="text"
                        className="form-control"
                        data-help="er_visit.mlc_brought_by_name_input"
                        value={mlcBroughtByName}
                        onChange={(e) => setMlcBroughtByName(e.target.value)}
                        placeholder="Officer / Relative name"
                      />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label={t("Contact Phone", "فون نمبر")}>
                      <input
                        type="tel"
                        className="form-control"
                        data-help="er_visit.mlc_brought_by_phone_input"
                        value={mlcBroughtByPhone}
                        onChange={(e) => setMlcBroughtByPhone(e.target.value)}
                        placeholder="0300-1234567"
                      />
                    </Field>
                  </div>
                </div>

                <div className="mb-3">
                  <Field label={t("Alleged History (in teller's exact words)", "بیان کردہ واقعہ")}>
                    <textarea
                      className="form-control"
                      rows={3}
                      data-help="er_visit.mlc_history_textarea"
                      value={mlcAllegedHistory}
                      onChange={(e) => setMlcAllegedHistory(e.target.value)}
                      placeholder="Record the exact account of injury or incident as narrated"
                      required
                    />
                  </Field>
                  {mlcErrors.alleged_history && (
                    <div className="text-danger small">{mlcErrors.alleged_history}</div>
                  )}
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <Field label={t("History Narrated By", "واقعہ بیان کنندہ")}>
                      <input
                        type="text"
                        className="form-control"
                        data-help="er_visit.mlc_history_given_by_input"
                        value={mlcHistoryGivenBy}
                        onChange={(e) => setMlcHistoryGivenBy(e.target.value)}
                        placeholder="Self, brother, police officer"
                      />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label={t("Initial Examination Findings", "ابتدائی طبی معائنہ")}>
                      <input
                        type="text"
                        className="form-control"
                        data-help="er_visit.mlc_exam_findings_input"
                        value={mlcExamFindings}
                        onChange={(e) => setMlcExamFindings(e.target.value)}
                        placeholder="Visible wounds, lacerations, burns"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.mlc_cancel_btn"
                  onClick={() => setShowMlcModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-warning text-dark"
                  data-help="er_visit.mlc_submit_btn"
                  onClick={handleSaveMlc}
                >
                  {t("Register MLC Case", "کیس درج کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outside Document Upload Modal (rule:7571033b1d, rule:794ff452da) */}
      {showDocUploadModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title">
                  {t("Attach Outside Patient Report", "بیرونی رپورٹ منسلک کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.doc_close_btn"
                  onClick={() => setShowDocUploadModal(false)}
                />
              </div>

              <div className="modal-body">
                <div className="mb-3">
                  <Field label={t("Report File (PDF, JPEG, or PNG up to 10MB)", "فائل منتخب کریں")}>
                    <input
                      type="file"
                      className="form-control"
                      data-help="er_visit.doc_file_input"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDocFile(file);
                      }}
                      required
                    />
                  </Field>
                  {docErrors.file && (
                    <div className="text-danger small">{docErrors.file}</div>
                  )}
                </div>

                <div className="mb-3">
                  <Field label={t("Report Title / Test Name", "رپورٹ کا عنوان")}>
                    <input
                      type="text"
                      className="form-control"
                      data-help="er_visit.doc_title_input"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g. CBC, Ultrasound Abdomen, Referral Note"
                      required
                    />
                  </Field>
                  {docErrors.title && (
                    <div className="text-danger small">{docErrors.title}</div>
                  )}
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <Field label={t("Document Type", "دستاویز کی قسم")}>
                      <select
                        className="form-select"
                        data-help="er_visit.doc_type_select"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                      >
                        <option value="LabReport">Laboratory Report</option>
                        <option value="Imaging">Radiology / Imaging</option>
                        <option value="ReferralLetter">Referral Letter</option>
                        <option value="DischargeSummary">Outside Discharge Summary</option>
                        <option value="Prescription">Prescription</option>
                        <option value="Other">Other</option>
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label={t("Document Date", "رپورٹ کی تاریخ")}>
                      <input
                        type="date"
                        className="form-control"
                        data-help="er_visit.doc_date_input"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        required
                      />
                    </Field>
                    {docErrors.document_date && (
                      <div className="text-danger small">{docErrors.document_date}</div>
                    )}
                  </div>
                </div>

                <div className="mb-2">
                  <Field label={t("Issuing Hospital / Lab (Source Facility)", "جاری کنندہ ہسپتال یا لیب")}>
                    <input
                      type="text"
                      className="form-control"
                      data-help="er_visit.doc_facility_input"
                      value={docFacility}
                      onChange={(e) => setDocFacility(e.target.value)}
                      placeholder="e.g. Shaukat Khanum, Chughtai Lab, District Hospital"
                      required
                    />
                  </Field>
                  {docErrors.source_facility && (
                    <div className="text-danger small">{docErrors.source_facility}</div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.doc_cancel_btn"
                  onClick={() => setShowDocUploadModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-help="er_visit.doc_submit_btn"
                  onClick={handleUploadDoc}
                >
                  {t("Upload Report", "اپ لوڈ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History & Timeline Modal */}
      {showHistoryModal && visit && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title">
                  {t("Care Timeline & Historic Assessments", "ٹائم لائن اور سابقہ ٹرائیج ریکارڈز")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="er_visit.history_close_btn"
                  onClick={() => setShowHistoryModal(false)}
                />
              </div>

              <div className="modal-body">
                {/* Stage Progression Logs */}
                <h6 className="border-bottom pb-1 text-muted">
                  {t("Stage Transitions", "مراحل کی تبدیلی کا لاگ")}
                </h6>
                <ul className="list-group list-group-flush mb-4 small">
                  {visit.stages.map((stg, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{stg.from_stage ?? "Start"} → {stg.to_stage}</strong>
                        {stg.note && <div className="text-muted">{stg.note}</div>}
                      </div>
                      <div className="text-end text-muted">
                        <div>{formatHospitalTime(stg.at, timeZone)}</div>
                        <small>{stg.by_name}</small>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Historic Triages with Nurse Stamps */}
                <h6 className="border-bottom pb-1 text-muted">
                  {t("Triage History with Staff Signatures", "ٹرائیج کی تاریخ اور دستخط")}
                </h6>
                {visit.triages.map((trg, i) => (
                  <div key={trg.assessment_id} className="p-3 mb-2 border rounded bg-light">
                    <div className="d-flex justify-content-between">
                      <strong className="text-primary">
                        Triage #{i + 1}: Level {trg.assigned_level} ({trg.assigned_level_name})
                      </strong>
                      <span className="text-muted small">
                        {formatHospitalTime(trg.assessed_at, timeZone)}
                      </span>
                    </div>
                    <div className="small mt-1">
                      <strong>{t("Complaint:", "تکلیف:")}</strong> {trg.presenting_complaint}
                    </div>
                    {trg.override_reason && (
                      <div className="small text-danger mt-1">
                        <strong>{t("Override:", "تبدیلی:")}</strong> {trg.override_reason}
                      </div>
                    )}
                    <div className="small text-muted border-top pt-1 mt-2">
                      {trg.author_stamp.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="er_visit.history_done_btn"
                  onClick={() => setShowHistoryModal(false)}
                >
                  {t("Done", "مکمل")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical write feedback */}
      <ClinicalWriteFeedback write={write} />
    </div>
  );
}
