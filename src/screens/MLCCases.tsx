import React, { useEffect, useState, useMemo } from "react";
import {
  Empty,
  ErrorBox,
  LoadState,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  MlcCaseListOut,
  MlcCaseOut,
  MlcOpenIn,
  MlcUpdateIn,
  PoliceIntimationIn,
  EvidenceIn,
  MlcCloseIn,
  MlcCaseTypeOut,
  MlcContactOut,
  PrintOut_MlcPrintFieldsOut_,
} from "../generated/mlc_cases";
import {
  listCasesMlc,
  getCase,
  printCase,
  caseTypes,
  contacts,
} from "../generated/mlc_cases";
import {
  evaluateMlcCasesView,
  canManageMlc,
  canViewMlcRegister,
  sortMlcCases,
  validateOpenMlc,
  validateUpdateMlc,
  validatePoliceIntimation,
  validateEvidence,
  validateCloseMlc,
} from "../mlc-cases-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";

export interface MLCCasesProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialMlcId?: number;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
  screenId?: string;
}

export function MLCCases({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  initialMlcId,
  onNavigateScreen,
  onBack,
  screenId = "mlc_cases",
}: MLCCasesProps) {
  // Service view capability evaluation (rule:81b46f9cf6)
  const view = evaluateMlcCasesView(establishment, screenId);
  const canManage = canManageMlc(user);
  const canView = canViewMlcRegister(user);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<"All" | "Open" | "Closed">("All");
  const [caseTypeFilter, setCaseTypeFilter] = useState<number | "All">("All");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data states
  const [casesList, setCasesList] = useState<MlcCaseListOut[]>([]);
  const [typesList, setTypesList] = useState<MlcCaseTypeOut[]>([]);
  const [policeStations, setPoliceStations] = useState<MlcContactOut[]>([]);
  const [mlrHospitals, setMlrHospitals] = useState<MlcContactOut[]>([]);
  const [selectedCase, setSelectedCase] = useState<MlcCaseOut | null>(null);

  // Modals & Drawers
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [showIntimationModal, setShowIntimationModal] = useState<boolean>(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printPayload, setPrintPayload] = useState<PrintOut_MlcPrintFieldsOut_ | null>(null);
  const [printLoading, setPrintLoading] = useState<boolean>(false);

  // Inline Edit Findings & History
  const [isEditingFindings, setIsEditingFindings] = useState<boolean>(false);
  const [editAllegedHistory, setEditAllegedHistory] = useState<string>("");
  const [editHistoryGivenBy, setEditHistoryGivenBy] = useState<string>("");
  const [editFindings, setEditFindings] = useState<string>("");

  // MLR Settlement Form in Detail
  const [mlrStatus, setMlrStatus] = useState<"Pending" | "IssuedHere" | "Referred" | "NotRequired">("Pending");
  const [mlrNumber, setMlrNumber] = useState<string>("");
  const [mlrIssuedAt, setMlrIssuedAt] = useState<string>("");
  const [mlrReferredToId, setMlrReferredToId] = useState<number | null>(null);
  const [mlrNote, setMlrNote] = useState<string>("");

  // Case Close Form
  const [closeNote, setCloseNote] = useState<string>("");
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);

  // New Case Open Form
  const [openPatientId, setOpenPatientId] = useState<string>("");
  const [openTicketId, setOpenTicketId] = useState<string>("");
  const [openAdmissionId, setOpenAdmissionId] = useState<string>("");
  const [openCaseTypeId, setOpenCaseTypeId] = useState<number | "">("");
  const [openBroughtBy, setOpenBroughtBy] = useState<
    "Police" | "Rescue1122" | "Ambulance" | "Relatives" | "Self" | "Bystander" | "Other"
  >("Relatives");
  const [openBroughtByName, setOpenBroughtByName] = useState<string>("");
  const [openBroughtByPhone, setOpenBroughtByPhone] = useState<string>("");
  const [openAllegedHistory, setOpenAllegedHistory] = useState<string>("");
  const [openHistoryGivenBy, setOpenHistoryGivenBy] = useState<string>("");
  const [openFindings, setOpenFindings] = useState<string>("");
  const [openStationId, setOpenStationId] = useState<number | "">("");
  const [openPoliceRef, setOpenPoliceRef] = useState<string>("");
  const [openOfficer, setOpenOfficer] = useState<string>("");
  const [openFormErrors, setOpenFormErrors] = useState<Record<string, string>>({});

  // Police Intimation Form
  const [intimationStationId, setIntimationStationId] = useState<number | "">("");
  const [intimationHow, setIntimationHow] = useState<"BroughtByPolice" | "Phone" | "InPerson" | "Written">("Phone");
  const [intimationTo, setIntimationTo] = useState<string>("");
  const [intimationRef, setIntimationRef] = useState<string>("");
  const [intimationErrors, setIntimationErrors] = useState<Record<string, string>>({});

  // Evidence Form
  const [evidenceDesc, setEvidenceDesc] = useState<string>("");
  const [evidenceSeal, setEvidenceSeal] = useState<string>("");
  const [evidenceHandedTo, setEvidenceHandedTo] = useState<string>("");
  const [evidenceReceipt, setEvidenceReceipt] = useState<string>("");
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});

  // Fetch list of cases
  const { data: rawCases, loading: casesLoading, error: casesError, reload: reloadCases } = useLoad<MlcCaseListOut[]>(
    async () => {
      const q: any = {};
      if (statusFilter !== "All") q.status = statusFilter;
      if (caseTypeFilter !== "All") q.case_type_id = caseTypeFilter;
      if (overdueOnly) q.overdue = true;
      return await listCasesMlc(q);
    },
    [statusFilter, caseTypeFilter, overdueOnly, stream],
  );

  // Clinical write hook
  const write = useClinicalWrite(user, screenId, () => {
    reloadCases();
    if (selectedCase?.mlc_id) {
      handleSelectCase(selectedCase.mlc_id, false);
    }
    setShowOpenModal(false);
    setShowIntimationModal(false);
    setShowEvidenceModal(false);
    setShowCloseConfirm(false);
    setIsEditingFindings(false);
  });

  // Fetch supporting metadata: case types, police stations, MLR hospitals
  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const types = await caseTypes();
        if (active) setTypesList(types);
      } catch (e) {
        console.error("Failed to load case types:", e);
      }

      try {
        const stations = await contacts({ contact_type: "PoliceStation" });
        if (active) setPoliceStations(stations);
      } catch (e) {
        console.error("Failed to load police stations:", e);
      }

      try {
        const hospitals = await contacts({ contact_type: "MlrHospital" });
        if (active) setMlrHospitals(hospitals);
      } catch (e) {
        console.error("Failed to load MLR hospitals:", e);
      }
    }
    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  // Sync loaded cases into local state
  useEffect(() => {
    if (rawCases) {
      setCasesList(rawCases);
    }
  }, [rawCases]);

  // Load initial MLC if passed
  useEffect(() => {
    if (initialMlcId) {
      handleSelectCase(initialMlcId);
    }
  }, [initialMlcId]);

  // Realtime subscription refresh on notification.created
  useEffect(() => {
    if (stream) {
      reloadCases();
      if (selectedCase?.mlc_id) {
        handleSelectCase(selectedCase.mlc_id, false);
      }
    }
  }, [stream]);

  // Sorted and searched cases (rule:280a8e8493)
  const displayCases = useMemo(() => {
    const sorted = sortMlcCases(casesList);
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (c) =>
        c.mlc_number.toLowerCase().includes(q) ||
        c.patient_name.toLowerCase().includes(q) ||
        c.mrn.toLowerCase().includes(q) ||
        (c.police_reference && c.police_reference.toLowerCase().includes(q)) ||
        (c.police_station_name && c.police_station_name.toLowerCase().includes(q)),
    );
  }, [casesList, searchQuery]);

  // KPI calculations
  const totalCount = casesList.length;
  const openCount = casesList.filter((c) => c.status === "Open").length;
  const closedCount = casesList.filter((c) => c.status === "Closed").length;
  const overdueCount = casesList.filter((c) => c.police_intimation_overdue && c.status === "Open").length;

  // Handle case selection
  async function handleSelectCase(mlcId: number, openModal = true) {
    try {
      const fullCase = await getCase(mlcId);
      setSelectedCase(fullCase);
      // Initialize detail state
      setEditAllegedHistory(fullCase.alleged_history || "");
      setEditHistoryGivenBy(fullCase.history_given_by || "");
      setEditFindings(fullCase.examination_findings || "");
      setMlrStatus(fullCase.mlr_status || "Pending");
      setMlrNumber(fullCase.mlr_number || "");
      setMlrIssuedAt(fullCase.mlr_issued_at ? fullCase.mlr_issued_at.slice(0, 10) : "");
      setMlrReferredToId(fullCase.referred_to_id || null);
      setMlrNote(fullCase.mlr_note || "");
      setIsEditingFindings(false);
      setShowCloseConfirm(false);
      if (openModal) setShowDetailModal(true);
    } catch (err) {
      console.error("Failed to load case detail:", err);
    }
  }

  // Handle Open MLC Form Submission
  function handleOpenCaseSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pid = parseInt(openPatientId, 10);
    const ctid = typeof openCaseTypeId === "number" ? openCaseTypeId : 0;
    const psid = typeof openStationId === "number" ? openStationId : null;

    const payload: MlcOpenIn = {
      patient_id: pid,
      ticket_id: openTicketId.trim() ? parseInt(openTicketId, 10) : null,
      admission_id: openAdmissionId.trim() ? parseInt(openAdmissionId, 10) : null,
      case_type_id: ctid,
      brought_by: openBroughtBy,
      brought_by_name: openBroughtByName.trim() || null,
      brought_by_phone: openBroughtByPhone.trim() || null,
      alleged_history: openAllegedHistory.trim(),
      history_given_by: openHistoryGivenBy.trim() || null,
      examination_findings: openFindings.trim() || null,
      police_station_id: psid,
      police_reference: openPoliceRef.trim() || null,
      investigating_officer: openOfficer.trim() || null,
    };

    const errs = validateOpenMlc(payload);
    if (Object.keys(errs).length > 0) {
      setOpenFormErrors(errs);
      return;
    }
    setOpenFormErrors({});

    write.start({
      path: "/mlc/cases",
      method: "POST",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Open Medico-Legal Case", "میڈیکو لیگل کیس درج کریں"),
    });
  }

  // Handle updating alleged history and findings
  function handleUpdateFindingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCase) return;

    const payload: MlcUpdateIn = {
      alleged_history: editAllegedHistory.trim() || null,
      history_given_by: editHistoryGivenBy.trim() || null,
      examination_findings: editFindings.trim() || null,
      expected_version: selectedCase.row_version,
    };

    const errs = validateUpdateMlc(payload);
    if (Object.keys(errs).length > 0) {
      return;
    }

    write.start({
      path: `/mlc/cases/${selectedCase.mlc_id}`,
      method: "PATCH",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Update Medico-Legal Findings", "میڈیکو لیگل معائنہ محفوظ کریں"),
    });
  }

  // Handle updating MLR status
  function handleUpdateMlrSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCase) return;

    const payload: MlcUpdateIn = {
      mlr_status: mlrStatus,
      mlr_number: mlrStatus === "IssuedHere" ? mlrNumber.trim() || null : null,
      mlr_issued_at: mlrStatus === "IssuedHere" && mlrIssuedAt ? `${mlrIssuedAt}T00:00:00Z` : null,
      referred_to_id: mlrStatus === "Referred" ? mlrReferredToId : null,
      mlr_note: mlrStatus === "NotRequired" ? mlrNote.trim() || null : null,
      expected_version: selectedCase.row_version,
    };

    const errs = validateUpdateMlc(payload);
    if (Object.keys(errs).length > 0) {
      return;
    }

    write.start({
      path: `/mlc/cases/${selectedCase.mlc_id}`,
      method: "PATCH",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Save MLR Settlement", "ایم ایل آر رپورٹ کا تصفیہ محفوظ کریں"),
    });
  }

  // Handle recording Police Intimation
  function handlePoliceIntimationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCase) return;

    const psid = typeof intimationStationId === "number" ? intimationStationId : 0;
    const payload: PoliceIntimationIn = {
      police_station_id: psid,
      informed_how: intimationHow,
      informed_to: intimationTo.trim() || null,
      police_reference: intimationRef.trim() || null,
    };

    const errs = validatePoliceIntimation(payload);
    if (Object.keys(errs).length > 0) {
      setIntimationErrors(errs);
      return;
    }
    setIntimationErrors({});

    write.start({
      path: `/mlc/cases/${selectedCase.mlc_id}/police-intimation`,
      method: "POST",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Record Police Intimation", "تھانے کی اطلاع درج کریں"),
    });
  }

  // Handle adding Handed Evidence
  function handleAddEvidenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCase) return;

    const payload: EvidenceIn = {
      description: evidenceDesc.trim(),
      seal_number: evidenceSeal.trim() || null,
      handed_to: evidenceHandedTo.trim(),
      receipt_reference: evidenceReceipt.trim() || null,
    };

    const errs = validateEvidence(payload);
    if (Object.keys(errs).length > 0) {
      setEvidenceErrors(errs);
      return;
    }
    setEvidenceErrors({});

    write.start({
      path: `/mlc/cases/${selectedCase.mlc_id}/evidence`,
      method: "POST",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Record Handed Evidence", "شواہد کی حوالگی درج کریں"),
    });
  }

  // Handle Case Closure
  function handleCloseCaseSubmit() {
    if (!selectedCase) return;

    const payload: MlcCloseIn = {
      note: closeNote.trim(),
    };

    const val = validateCloseMlc(selectedCase, payload);
    if (!val.valid) {
      return;
    }

    write.start({
      path: `/mlc/cases/${selectedCase.mlc_id}/close`,
      method: "POST",
      body: payload,
      permission: "mlc.case.manage",
      protection: "idempotent",
      label: t("Close Medico-Legal Case", "میڈیکو لیگل کیس بند کریں"),
    });
  }

  // Handle Print Intimation Payload
  async function handlePrintIntimation() {
    if (!selectedCase) return;
    setPrintLoading(true);
    try {
      const payload = await printCase(selectedCase.mlc_id);
      setPrintPayload(payload);
      setShowPrintModal(true);
    } catch (e) {
      console.error("Failed to load intimation print payload:", e);
    } finally {
      setPrintLoading(false);
    }
  }

  return (
    <div className="container-fluid p-3" data-screen-id={screenId} style={{ minHeight: "100vh" }}>
      {/* Retiring / Service View Banner (rule:81b46f9cf6) */}
      {view.banner && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
          <span className="me-2" style={{ fontSize: "1.25rem" }}>⚠️</span>
          <div>
            <strong>{t("Service Notice:", "سروس کی اطلاع:")}</strong> {view.banner}
          </div>
        </div>
      )}

      {/* Screen Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            {onBack && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onBack}
                data-help="mlc_cases.btn_back"
                title={t("Back", "پیچھے")}
              >
                ← {t("Back", "واپس")}
              </button>
            )}
            <h3 className="m-0 text-primary d-flex align-items-center gap-2">
              ⚖️ {t("Medico-Legal Cases Register", "میڈیکو لیگل کیسز رجسٹر")}
            </h3>
            <span className="badge bg-secondary">
              {screenId === "mlc_cases_doctor" ? t("Doctor Workspace", "ڈاکٹر ورک اسپیس") : t("Triage Workspace", "ٹرائی ایج ورک اسپیس")}
            </span>
            <span className="badge bg-info text-dark">MSDS 15, 16, 20</span>
          </div>
          <small className="text-muted">
            {t(
              "Open and track medico-legal cases, statutory police intimation, sealed chain-of-custody evidence, and MLR settlement.",
              "میڈیکو لیگل کیسز کھولیں، تھانے کی قانونی اطلاع، سیل شدہ شواہد اور ایم ایل آر رپورٹ درج کریں۔",
            )}
          </small>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span className={`badge ${connected ? "bg-success" : "bg-warning text-dark"}`}>
            {connected ? `● ${t("Live", "براہ راست")}` : `○ ${t("Reconnecting...", "منقطع...")}`}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => reloadCases()}
            disabled={casesLoading}
            data-help="mlc_cases.btn_refresh"
          >
            🔄 {t("Refresh", "تازہ کریں")}
          </button>
          {onNavigateScreen && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onNavigateScreen("trauma_merge")}
              data-help="mlc_cases.btn_trauma"
              title={t("Register Trauma Profile", "ٹراما پروفائل بنائیں")}
            >
              🏷️ {t("Trauma Profile", "ٹراما پروفائل")}
            </button>
          )}
          {view.canCreateNew && canManage && (
            <button
              type="button"
              className="btn btn-sm btn-danger fw-bold shadow-sm"
              onClick={() => setShowOpenModal(true)}
              data-help="mlc_cases.btn_open_modal"
            >
              ➕ {t("Open Medico-Legal Case", "نیا ایم ایل سی کیس کھولیں")}
            </button>
          )}
        </div>
      </div>

      {/* KPI Tiles Bar */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-primary text-center p-2 h-100">
            <span className="text-muted small">{t("Total Registered", "کل درج کیسز")}</span>
            <h4 className="m-0 text-primary">{totalCount}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-info text-center p-2 h-100">
            <span className="text-muted small">{t("Open Cases", "کھلے کیسز")}</span>
            <h4 className="m-0 text-info">{openCount}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-secondary text-center p-2 h-100">
            <span className="text-muted small">{t("Closed Cases", "بند شدہ کیسز")}</span>
            <h4 className="m-0 text-secondary">{closedCount}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div
            className={`card shadow-sm text-center p-2 h-100 ${
              overdueCount > 0 ? "border-danger bg-danger bg-opacity-10" : "border-success"
            }`}
          >
            <span className={`small ${overdueCount > 0 ? "text-danger fw-bold" : "text-muted"}`}>
              ⚠️ {t("Police Intimation Overdue", "پولیس اطلاع کی تاخیر")}
            </span>
            <h4 className={`m-0 ${overdueCount > 0 ? "text-danger fw-bold" : "text-success"}`}>{overdueCount}</h4>
          </div>
        </div>
      </div>

      {/* Overdue Alert Banner (rule:280a8e8493) */}
      {overdueCount > 0 && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between p-2 mb-3 shadow-sm" role="alert">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.4rem" }}>🚨</span>
            <div>
              <strong>{t("STATUTORY NOTICE:", "قانونی اطلاع:")}</strong>{" "}
              {t(
                `${overdueCount} open medico-legal case(s) exceed the statutory deadline without recorded police intimation! Immediate police dispatch required.`,
                `${overdueCount} کیسز میں تھانے کو فوری اطلاع کا وقت گزر چکا ہے! فوری پولیس کو مطلع کریں۔`,
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => setOverdueOnly(!overdueOnly)}
            data-help="mlc_cases.btn_filter_overdue_toggle"
          >
            {overdueOnly ? t("Show All", "سب دیکھیں") : t("Filter Overdue", "صرف تاخیر شدہ دیکھیں")}
          </button>
        </div>
      )}

      {/* Global Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Search and Filters Controls */}
      <div className="card shadow-sm mb-3">
        <div className="card-body p-2">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={t("Search MRN, Name, MLC #, FIR...", "ایم آر این، نام، ایم ایل سی یا ایف آئی آر تلاش کریں...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-help="mlc_cases.search"
              />
            </div>
            <div className="col-6 col-md-2">
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                data-help="mlc_cases.filter_status"
              >
                <option value="All">{t("All Statuses", "تمام حالات")}</option>
                <option value="Open">{t("Open Only", "صرف کھلے")}</option>
                <option value="Closed">{t("Closed Only", "صرف بند")}</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={caseTypeFilter}
                onChange={(e) => setCaseTypeFilter(e.target.value === "All" ? "All" : parseInt(e.target.value, 10))}
                data-help="mlc_cases.filter_case_type"
              >
                <option value="All">{t("All Case Types", "تمام اقسام کے کیسز")}</option>
                {typesList.map((ct) => (
                  <option key={ct.case_type_id} value={ct.case_type_id}>
                    {ct.name} ({ct.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 d-flex align-items-center gap-2">
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="overdueOnlyToggle"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                  data-help="mlc_cases.filter_overdue"
                />
                <label className="form-check-label small text-danger fw-semibold" htmlFor="overdueOnlyToggle">
                  {t("Overdue Intimation Only", "صرف تاخیر شدہ اطلاع")}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Register Table */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
          <strong className="text-secondary">
            📋 {t("Medico-Legal Case Records", "میڈیکو لیگل کیسز کا ریکارڈ")} ({displayCases.length})
          </strong>
          {canManage && (
            <span className="small text-muted">
              {t("Authorized staff: triage nurses and doctors", "مجاز عملہ: ٹرائی ایج نرسز اور ڈاکٹرز")}
            </span>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-nowrap">
              <tr>
                <th style={{ width: "12%" }}>{t("MLC #", "ایم ایل سی نمبر")}</th>
                <th style={{ width: "20%" }}>{t("Patient (MRN)", "مریض (ایم آر این)")}</th>
                <th style={{ width: "16%" }}>{t("Case Type", "کیس کی قسم")}</th>
                <th style={{ width: "14%" }}>{t("Arrival & Brought By", "آمد اور لانے والا")}</th>
                <th style={{ width: "18%" }}>{t("Police Intimation", "پولیس اطلاع")}</th>
                <th style={{ width: "10%" }}>{t("MLR Status", "ایم ایل آر رپورٹ")}</th>
                <th style={{ width: "10%" }} className="text-end">{t("Action", "کارروائی")}</th>
              </tr>
            </thead>
            <tbody>
              {casesLoading && (
                <tr>
                  <td colSpan={7} className="text-center p-4">
                    <LoadState loading={true} error={null} retry={() => reloadCases()} />
                  </td>
                </tr>
              )}

              {Boolean(casesError) && (
                <tr>
                  <td colSpan={7} className="p-3">
                    <ErrorBox error={casesError} />
                  </td>
                </tr>
              )}

              {!casesLoading && !casesError && displayCases.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-4">
                    <Empty>
                      {t("No medico-legal cases found matching the criteria.", "اس معیار پر کوئی میڈیکو لیگل کیس نہیں ملا۔")}
                    </Empty>
                  </td>
                </tr>
              )}

              {!casesLoading &&
                !casesError &&
                displayCases.map((c) => {
                  const isOverdue = c.police_intimation_overdue && c.status === "Open";
                  return (
                    <tr
                      key={c.mlc_id}
                      className={isOverdue ? "table-danger" : c.status === "Closed" ? "table-light text-muted" : ""}
                    >
                      <td>
                        <span className="badge bg-dark fw-bold" style={{ fontSize: "0.9rem" }}>
                          {c.mlc_number}
                        </span>
                        {c.death_number && (
                          <div className="mt-1">
                            <span className="badge bg-danger" title={t("Deceased", "وفات شدہ")}>
                              ✝ {c.death_number}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{c.patient_name}</div>
                        <div className="small text-muted">
                          MRN: <code className="text-primary">{c.mrn}</code>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{c.case_type_name}</span>
                      </td>
                      <td>
                        <div className="small">{formatHospitalTime(c.arrived_at, timeZone)}</div>
                        <span className="badge bg-light text-dark border">
                          {c.brought_by}
                        </span>
                      </td>
                      <td>
                        {isOverdue ? (
                          <span className="badge bg-danger text-white">
                            ⚠️ {t("Intimation Overdue", "اطلاع میں تاخیر")}
                          </span>
                        ) : c.police_informed_at ? (
                          <div>
                            <span className="badge bg-success">
                              ✓ {t("Informed", "مطلع شدہ")}
                            </span>
                            <div className="small text-truncate" style={{ maxWidth: "160px" }}>
                              {c.police_station_name}
                            </div>
                            {c.police_reference && (
                              <div className="small text-muted">
                                Ref: <strong>{c.police_reference}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge bg-warning text-dark">
                            ○ {t("Not Informed", "غیر مطلع")}
                          </span>
                        )}
                      </td>
                      <td>
                        {c.mlr_status === "IssuedHere" && (
                          <span className="badge bg-success">{t("Issued", "جاری شدہ")}</span>
                        )}
                        {c.mlr_status === "Referred" && (
                          <span className="badge bg-info text-dark">{t("Referred", "ریفر شدہ")}</span>
                        )}
                        {c.mlr_status === "NotRequired" && (
                          <span className="badge bg-secondary">{t("Not Required", "غیر ضروری")}</span>
                        )}
                        {c.mlr_status === "Pending" && (
                          <span className="badge bg-warning text-dark">{t("Pending", "زیر التواء")}</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleSelectCase(c.mlc_id)}
                          data-help="mlc_cases.btn_view_detail"
                        >
                          👁️ {t("View / Manage", "تفصیل و کارروائی")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CASE DETAIL MODAL / DRAWER */}
      {showDetailModal && selectedCase && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              {/* Header */}
              <div className="modal-header bg-primary text-white py-2">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="modal-title m-0">
                    ⚖️ {selectedCase.mlc_number} — {selectedCase.patient_name}
                  </h5>
                  <span className={`badge ${selectedCase.status === "Open" ? "bg-success" : "bg-secondary"}`}>
                    {selectedCase.status === "Open" ? t("Open Case", "کھلا کیس") : t("Closed", "بند شدہ")}
                  </span>
                  {selectedCase.police_intimation_overdue && selectedCase.status === "Open" && (
                    <span className="badge bg-danger">⚠️ {t("Police Intimation Overdue", "پولیس اطلاع کی تاخیر")}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDetailModal(false)}
                  aria-label="Close"
                  data-help="mlc_cases.btn_close_detail_modal"
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body p-3">
                {/* Feedback banner */}
                <ClinicalWriteFeedback write={write} />

                {/* Patient Demographics & Context Banner (rule:ca37655fad) */}
                <div className="card bg-light mb-3 border-0">
                  <div className="card-body p-2">
                    <div className="row g-2 small">
                      <div className="col-6 col-md-3">
                        <span className="text-muted">MRN:</span> <strong>{selectedCase.mrn}</strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Gender / Age:", "جنس / عمر:")}</span>{" "}
                        <strong>
                          {selectedCase.gender} / {selectedCase.age_years ?? "—"} y
                        </strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">CNIC:</span> <strong>{selectedCase.cnic || "—"}</strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Guardian:", "والد یا شوہر:")}</span>{" "}
                        <strong>{selectedCase.father_or_husband_name || "—"}</strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Case Type:", "کیس کی قسم:")}</span>{" "}
                        <span className="badge bg-secondary">{selectedCase.case_type_name}</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Brought By:", "لانے والا:")}</span>{" "}
                        <strong>
                          {selectedCase.brought_by}{" "}
                          {selectedCase.brought_by_name ? `(${selectedCase.brought_by_name})` : ""}
                        </strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Arrival Time:", "آمد کا وقت:")}</span>{" "}
                        <strong>{formatHospitalTime(selectedCase.arrived_at, timeZone)}</strong>
                      </div>
                      <div className="col-6 col-md-3">
                        <span className="text-muted">{t("Created By:", "درج کنندہ:")}</span>{" "}
                        <strong>{selectedCase.created_by_name}</strong>
                      </div>
                      {selectedCase.address && (
                        <div className="col-12">
                          <span className="text-muted">{t("Address:", "پتہ:")}</span> {selectedCase.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 1: Alleged History & Findings (rule:5bc7258288) */}
                <div className="card mb-3">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <strong>📝 {t("Alleged History & Examination Findings", "بیان کردہ واقعہ و معائنہ")}</strong>
                    {selectedCase.status === "Open" && canManage && !isEditingFindings && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setIsEditingFindings(true)}
                        data-help="mlc_cases.btn_edit_findings"
                      >
                        ✏️ {t("Edit / Add Findings", "تبدیل کریں / معائنہ شامل کریں")}
                      </button>
                    )}
                  </div>
                  <div className="card-body p-3">
                    {!isEditingFindings ? (
                      <>
                        <div className="mb-2">
                          <span className="text-muted small fw-bold">
                            {t("Alleged History (in teller's exact words):", "بیان کردہ واقعہ (راوی کے اپنے الفاظ میں):")}
                          </span>
                          <div className="p-2 border rounded bg-white text-dark mt-1" style={{ whiteSpace: "pre-wrap" }}>
                            {selectedCase.alleged_history}
                          </div>
                          {selectedCase.history_given_by && (
                            <small className="text-muted">
                              {t("History narrated by:", "بیان کنندہ:")} <strong>{selectedCase.history_given_by}</strong>
                            </small>
                          )}
                        </div>

                        <div>
                          <span className="text-muted small fw-bold">
                            {t("Examination Findings:", "طبی معائنہ و چوٹوں کے نشانات:")}
                          </span>
                          <div
                            className="p-2 border rounded bg-light mt-1"
                            style={{ minHeight: "60px", whiteSpace: "pre-wrap" }}
                          >
                            {selectedCase.examination_findings || (
                              <span className="text-muted italic">
                                {t("No physical examination recorded yet. Examination may follow later.", "ابھی تک کوئی طبی معائنہ درج نہیں کیا گیا۔")}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <form onSubmit={handleUpdateFindingsSubmit}>
                        <div className="mb-2">
                          <label className="form-label small fw-bold">
                            {t("Alleged History (in teller's words):", "بیان کردہ واقعہ (راوی کے الفاظ):")}
                          </label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={3}
                            value={editAllegedHistory}
                            onChange={(e) => setEditAllegedHistory(e.target.value)}
                            data-help="mlc_cases.input_alleged_history"
                            required
                          ></textarea>
                        </div>
                        <div className="mb-2">
                          <label className="form-label small fw-bold">
                            {t("History given by:", "بیان کنندہ کا نام و رشتہ:")}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={editHistoryGivenBy}
                            onChange={(e) => setEditHistoryGivenBy(e.target.value)}
                            data-help="mlc_cases.input_history_given_by"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label small fw-bold">
                            {t("Examination Findings:", "طبی معائنہ:")}
                          </label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={4}
                            value={editFindings}
                            onChange={(e) => setEditFindings(e.target.value)}
                            data-help="mlc_cases.input_findings"
                            placeholder={t("Record injuries, lacerations, burns, contusions, or systemic findings...", "زخم، چوٹیں، نشانات یا دیگر علامات درج کریں...")}
                          ></textarea>
                        </div>
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setIsEditingFindings(false)}
                            data-help="mlc_cases.btn_cancel_findings"
                          >
                            {t("Cancel", "منسوخ")}
                          </button>
                          <button
                            type="submit"
                            className="btn btn-sm btn-primary"
                            disabled={write.busy}
                            data-help="mlc_cases.btn_save_findings"
                          >
                            💾 {t("Save Findings", "محفوظ کریں")}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {/* Section 2: Statutory Police Intimation (rule:280a8e8493 & rule:2b6e9d023c) */}
                <div className="card mb-3">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <strong className="d-flex align-items-center gap-2">
                      🚔 {t("Statutory Police Intimation", "تھانے کی قانونی اطلاع")}
                      {selectedCase.police_informed_at ? (
                        <span className="badge bg-success">✓ {t("Informed", "مطلع شدہ")}</span>
                      ) : (
                        <span className="badge bg-danger">⚠️ {t("Pending Police Intimation", "اطلاع زیر التواء")}</span>
                      )}
                    </strong>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-dark"
                        onClick={handlePrintIntimation}
                        disabled={printLoading}
                        data-help="mlc_cases.btn_print_payload"
                      >
                        🖨️ {t("Print Intimation (A4)", "اطلاع نامہ پرنٹ کریں")}
                      </button>
                      {selectedCase.status === "Open" && !selectedCase.police_informed_at && canManage && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setShowIntimationModal(true)}
                          data-help="mlc_cases.btn_inform_police"
                        >
                          📢 {t("Inform Police Station", "تھانے کو مطلع کریں")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="card-body p-3">
                    {selectedCase.police_informed_at ? (
                      <div className="row g-2 small">
                        <div className="col-12 col-md-4">
                          <span className="text-muted">{t("Police Station:", "تھانہ:")}</span>{" "}
                          <strong>{selectedCase.police_station_name}</strong>
                          {selectedCase.police_station_phone && (
                            <div className="text-muted">Tel: {selectedCase.police_station_phone}</div>
                          )}
                        </div>
                        <div className="col-12 col-md-4">
                          <span className="text-muted">{t("Informed How / At:", "ذریعہ / وقت:")}</span>{" "}
                          <strong>
                            {selectedCase.police_informed_how} ({formatHospitalTime(selectedCase.police_informed_at, timeZone)})
                          </strong>
                        </div>
                        <div className="col-12 col-md-4">
                          <span className="text-muted">{t("Officer / Reference:", "افسر / روزنامچہ یا ایف آئی آر:")}</span>{" "}
                          <strong>
                            {selectedCase.police_informed_to || "—"} / {selectedCase.police_reference || "—"}
                          </strong>
                        </div>
                        <div className="col-12">
                          <small className="text-success">
                            ✓ {t("Intimation recorded permanently and filed per medico-legal statutory code.", "قانونی ضابطے کے تحت تھانے کی اطلاع مستقل درج کی جا چکی ہے۔")}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning m-0 p-2 small">
                        <strong>⚠️ {t("Police not informed yet:", "تھانے کو ابھی اطلاع نہیں دی گئی:")}</strong>{" "}
                        {t(
                          "Hospital duty officer must notify the jurisdictional police station at once. Cases cannot be closed until police intimation is recorded.",
                          "ہسپتال عملہ فوری طور پر متعلقہ تھانے کو مطلع کرے، بصورت دیگر کیس بند نہیں کیا جا سکتا۔",
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Chain-of-Custody Evidence Handed Over (rule:2b6e9d023c) */}
                <div className="card mb-3">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <strong>📦 {t("Evidence Handed to Police (Chain of Custody)", "شواہد کی پولیس کو حوالگی")}</strong>
                    {selectedCase.status === "Open" && canManage && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowEvidenceModal(true)}
                        data-help="mlc_cases.btn_add_evidence"
                      >
                        ➕ {t("Hand Over Evidence Item", "شواہد کا اندراج کریں")}
                      </button>
                    )}
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered align-middle mb-0">
                        <thead className="table-light small">
                          <tr>
                            <th>{t("Description", "شواہد کی تفصیل")}</th>
                            <th>{t("Seal #", "سیل نمبر")}</th>
                            <th>{t("Handed To (Officer)", "حوالہ برائے افسر")}</th>
                            <th>{t("Receipt Ref", "رسید نمبر")}</th>
                            <th>{t("Handed At & By", "وقت و عملہ")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCase.evidence && selectedCase.evidence.length > 0 ? (
                            selectedCase.evidence.map((ev) => (
                              <tr key={ev.evidence_id}>
                                <td>{ev.description}</td>
                                <td>
                                  {ev.seal_number ? (
                                    <code className="text-danger fw-bold">{ev.seal_number}</code>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td><strong>{ev.handed_to}</strong></td>
                                <td>{ev.receipt_reference || "—"}</td>
                                <td className="small">
                                  {formatHospitalTime(ev.handed_at, timeZone)} ({ev.handed_by_name})
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center p-3 text-muted small">
                                {t("No physical evidence handed over yet.", "ابھی تک کوئی شواہد پولیس کے حوالے نہیں کیے گئے۔")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Section 4: Medico-Legal Report (MLR) Settlement (rule:044cdb5a52) */}
                <div className="card mb-3">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <strong>📑 {t("Medico-Legal Report (MLR) Settlement", "میڈیکو لیگل رپورٹ (ایم ایل آر) تصفیہ")}</strong>
                    <span className="badge bg-secondary">
                      {t("Current Status:", "موجودہ حالت:")} {selectedCase.mlr_status}
                    </span>
                  </div>
                  <div className="card-body p-3">
                    {selectedCase.status === "Open" && canManage ? (
                      <form onSubmit={handleUpdateMlrSubmit}>
                        <div className="row g-2 align-items-end mb-2">
                          <div className="col-12 col-md-3">
                            <label className="form-label small fw-bold">
                              {t("Report Disposition:", "رپورٹ کی نوعیت:")}
                            </label>
                            <select
                              className="form-select form-select-sm"
                              value={mlrStatus}
                              onChange={(e) => setMlrStatus(e.target.value as any)}
                              data-help="mlc_cases.select_mlr_status"
                            >
                              <option value="Pending">{t("Pending Evaluation", "زیر التواء")}</option>
                              <option value="IssuedHere">{t("Issued Here (MLR)", "ہسپتال سے جاری شدہ")}</option>
                              <option value="Referred">{t("Referred to Hospital", "دیگر ہسپتال ریفر")}</option>
                              <option value="NotRequired">{t("Not Required", "رپورٹ غیر ضروری")}</option>
                            </select>
                          </div>

                          {mlrStatus === "IssuedHere" && (
                            <>
                              <div className="col-6 col-md-3">
                                <label className="form-label small fw-bold">{t("MLR Number:", "ایم ایل آر نمبر:")}</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={mlrNumber}
                                  onChange={(e) => setMlrNumber(e.target.value)}
                                  placeholder="e.g. MLR-2026-981"
                                  data-help="mlc_cases.input_mlr_number"
                                  required
                                />
                              </div>
                              <div className="col-6 col-md-3">
                                <label className="form-label small fw-bold">{t("Issue Date:", "تاریخ اجراء:")}</label>
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  value={mlrIssuedAt}
                                  onChange={(e) => setMlrIssuedAt(e.target.value)}
                                  data-help="mlc_cases.input_mlr_issued_at"
                                  required
                                />
                              </div>
                            </>
                          )}

                          {mlrStatus === "Referred" && (
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">
                                {t("Designated MLR Referral Hospital:", "نامزد ریفرل ہسپتال:")}
                              </label>
                              <select
                                className="form-select form-select-sm"
                                value={mlrReferredToId ?? ""}
                                onChange={(e) => setMlrReferredToId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                data-help="mlc_cases.select_referred_hospital"
                                required
                              >
                                <option value="">{t("Select designated hospital...", "ہسپتال منتخب کریں...")}</option>
                                {mlrHospitals.map((h) => (
                                  <option key={h.contact_id} value={h.contact_id}>
                                    {h.name} ({h.district || ""})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {mlrStatus === "NotRequired" && (
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">
                                {t("Reason MLR Not Required:", "غیر ضروری ہونے کی وجہ:")}
                              </label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={mlrNote}
                                onChange={(e) => setMlrNote(e.target.value)}
                                placeholder={t("Clinical or statutory rationale...", "طبی یا قانونی وجہ درج کریں...")}
                                data-help="mlc_cases.input_mlr_note"
                                required
                              />
                            </div>
                          )}

                          <div className="col-12 col-md-3">
                            <button
                              type="submit"
                              className="btn btn-sm btn-outline-primary w-100"
                              disabled={write.busy}
                              data-help="mlc_cases.btn_update_mlr"
                            >
                              💾 {t("Save MLR Settlement", "ایم ایل آر تصفیہ محفوظ کریں")}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="small">
                        <div>
                          <strong>{t("Settlement:", "تصفیہ:")}</strong> {selectedCase.mlr_status}
                        </div>
                        {selectedCase.mlr_number && (
                          <div>
                            <strong>{t("MLR Number:", "نمبر:")}</strong> {selectedCase.mlr_number} (
                            {selectedCase.mlr_issued_at ? formatHospitalTime(selectedCase.mlr_issued_at, timeZone) : ""})
                          </div>
                        )}
                        {selectedCase.referred_to_name && (
                          <div>
                            <strong>{t("Referred Hospital:", "ریفر ہسپتال:")}</strong> {selectedCase.referred_to_name}
                          </div>
                        )}
                        {selectedCase.mlr_note && (
                          <div>
                            <strong>{t("Note:", "نوٹ:")}</strong> {selectedCase.mlr_note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 5: Case Closure (rule:044cdb5a52) */}
                <div className="card">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <strong>🔒 {t("Case Finalization & Closure", "کیس کی بندش")}</strong>
                    <span className={`badge ${selectedCase.status === "Closed" ? "bg-secondary" : "bg-success"}`}>
                      {selectedCase.status}
                    </span>
                  </div>
                  <div className="card-body p-3">
                    {selectedCase.status === "Closed" ? (
                      <div className="small">
                        <div className="text-success fw-bold mb-1">
                          ✓ {t("Case Closed on:", "کیس بند ہوا تاریخ:")}{" "}
                          {selectedCase.closed_at ? formatHospitalTime(selectedCase.closed_at, timeZone) : "—"} by {selectedCase.closed_by_name}
                        </div>
                        <div className="text-muted">
                          <strong>{t("Closure Note:", "اختتامی نوٹ:")}</strong> {selectedCase.closure_note}
                        </div>
                      </div>
                    ) : (
                      <>
                        {(!selectedCase.police_informed_at || selectedCase.mlr_status === "Pending") ? (
                          <div className="alert alert-warning p-2 small mb-2">
                            <strong>⚠️ {t("Cannot Close Case Yet:", "ابھی کیس بند نہیں کیا جا سکتا:")}</strong>
                            <ul className="m-0 ps-3">
                              {!selectedCase.police_informed_at && (
                                <li>{t("Statutory police intimation must be recorded first.", "تھانے کی اطلاع درج ہونا لازمی ہے۔")}</li>
                              )}
                              {selectedCase.mlr_status === "Pending" && (
                                <li>
                                  {t(
                                    "Medico-Legal Report settlement must be resolved (Issued, Referred, or Not Required).",
                                    "ایم ایل آر رپورٹ کا تصفیہ (جاری شدہ، ریفر یا غیر ضروری) ہونا لازمی ہے۔",
                                  )}
                                </li>
                              )}
                            </ul>
                          </div>
                        ) : null}

                        {!showCloseConfirm ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setShowCloseConfirm(true)}
                            disabled={!canManage || !selectedCase.police_informed_at || selectedCase.mlr_status === "Pending"}
                            data-help="mlc_cases.btn_close_case"
                          >
                            🔒 {t("Close Medico-Legal Case", "میڈیکو لیگل کیس بند کریں")}
                          </button>
                        ) : (
                          <div className="p-3 border rounded border-danger bg-danger bg-opacity-10">
                            <h6 className="text-danger fw-bold">
                              ⚠️ {t("Confirm Medico-Legal Case Closure", "کیس بند کرنے کی تصدیق")}
                            </h6>
                            <p className="small text-muted mb-2">
                              {t(
                                "Closing the case permanently locks all police intimations, history notes, and findings. No further edits will be accepted (MLC_CLOSED).",
                                "کیس بند کرنے کے بعد اس میں کوئی تبدیلی یا نیا اندراج ممکن نہیں ہوگا۔",
                              )}
                            </p>
                            <div className="mb-2">
                              <label className="form-label small fw-bold">
                                {t("Closure Clinical Note (minimum 3 characters):", "اختتامی نوٹ (کم از کم 3 حروف):")}
                              </label>
                              <textarea
                                className="form-control form-control-sm"
                                rows={2}
                                value={closeNote}
                                onChange={(e) => setCloseNote(e.target.value)}
                                placeholder={t("Record reason for closure and outcome...", "کیس کے اختتام کا حتمی نوٹ لکھیں...")}
                                data-help="mlc_cases.input_close_note"
                                required
                              ></textarea>
                            </div>
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setShowCloseConfirm(false)}
                                data-help="mlc_cases.btn_cancel_close"
                              >
                                {t("Cancel", "منسوخ")}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger fw-bold"
                                onClick={handleCloseCaseSubmit}
                                disabled={write.busy || closeNote.trim().length < 3}
                                data-help="mlc_cases.btn_confirm_close"
                              >
                                🔒 {t("Confirm & Close Case", "تصدیق اور کیس بند کریں")}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowDetailModal(false)}
                  data-help="mlc_cases.btn_footer_close_detail"
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPEN MLC MODAL DIALOG (rule:4d698e4d1b) */}
      {showOpenModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white py-2">
                <h5 className="modal-title m-0">
                  ➕ {t("Open Medico-Legal Case (POST /mlc/cases)", "نیا میڈیکو لیگل کیس درج کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowOpenModal(false)}
                  aria-label="Close"
                  data-help="mlc_cases.btn_close_open_modal"
                ></button>
              </div>

              <form onSubmit={handleOpenCaseSubmit}>
                <div className="modal-body p-3">
                  <ClinicalWriteFeedback write={write} />

                  {/* Context notice */}
                  <div className="alert alert-info p-2 small mb-3">
                    ℹ️ {t(
                      "Open MLC whenever emergency complaint matches a statutory case type. For unknown/unconscious casualties, register a temporary trauma profile first (POST /patients/trauma).",
                      "ایمرجنسی میں قانونی نوعیت کے مریضوں کا اندراج کریں۔ نا معلوم افراد کے لیے پہلے ٹراما پروفائل بنائیں!",
                    )}
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-bold">
                        {t("Patient ID:", "مریض کا آئی ڈی:")} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className={`form-control form-control-sm ${openFormErrors.patient_id ? "is-invalid" : ""}`}
                        value={openPatientId}
                        onChange={(e) => setOpenPatientId(e.target.value)}
                        placeholder="e.g. 1"
                        data-help="mlc_cases.input_patient_id"
                        required
                      />
                      {openFormErrors.patient_id && (
                        <div className="invalid-feedback">{openFormErrors.patient_id}</div>
                      )}
                    </div>

                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-bold">
                        {t("Ticket ID (optional):", "پرچی آئی ڈی:")}
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={openTicketId}
                        onChange={(e) => setOpenTicketId(e.target.value)}
                        placeholder="e.g. 10"
                        data-help="mlc_cases.input_ticket_id"
                      />
                    </div>

                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-bold">
                        {t("Admission ID (optional):", "داخلہ آئی ڈی:")}
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={openAdmissionId}
                        onChange={(e) => setOpenAdmissionId(e.target.value)}
                        placeholder="e.g. 5"
                        data-help="mlc_cases.input_admission_id"
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">
                        {t("Case Type:", "کیس کی نوعیت:")} <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select form-select-sm ${openFormErrors.case_type_id ? "is-invalid" : ""}`}
                        value={openCaseTypeId}
                        onChange={(e) => setOpenCaseTypeId(e.target.value ? parseInt(e.target.value, 10) : "")}
                        data-help="mlc_cases.select_case_type"
                        required
                      >
                        <option value="">{t("Select case type...", "کیس منتخب کریں...")}</option>
                        {typesList.map((ct) => (
                          <option key={ct.case_type_id} value={ct.case_type_id}>
                            {ct.name} ({ct.code})
                          </option>
                        ))}
                      </select>
                      {openFormErrors.case_type_id && (
                        <div className="invalid-feedback">{openFormErrors.case_type_id}</div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold">
                        {t("Brought By:", "کون لایا:")} <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={openBroughtBy}
                        onChange={(e) => setOpenBroughtBy(e.target.value as any)}
                        data-help="mlc_cases.select_brought_by"
                        required
                      >
                        <option value="Police">{t("Police", "پولیس")}</option>
                        <option value="Rescue1122">{t("Rescue 1122", "ریسکیو 1122")}</option>
                        <option value="Ambulance">{t("Ambulance", "ایمبولینس")}</option>
                        <option value="Relatives">{t("Relatives / Family", "لواحقین / فیملی")}</option>
                        <option value="Self">{t("Self", "خود آیا")}</option>
                        <option value="Bystander">{t("Bystander", "راہگیر")}</option>
                        <option value="Other">{t("Other", "دیگر")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold">
                        {t("Brought By Name:", "لانے والے کا نام:")}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={openBroughtByName}
                        onChange={(e) => setOpenBroughtByName(e.target.value)}
                        placeholder="e.g. Constable Tariq"
                        data-help="mlc_cases.input_brought_by_name"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold">
                        {t("Brought By Phone:", "رابطہ نمبر:")}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={openBroughtByPhone}
                        onChange={(e) => setOpenBroughtByPhone(e.target.value)}
                        placeholder="0300-1234567"
                        data-help="mlc_cases.input_brought_by_phone"
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Alleged History (teller's exact words):", "بیان کردہ واقعہ (راوی کے اپنے الفاظ):")} <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className={`form-control form-control-sm ${openFormErrors.alleged_history ? "is-invalid" : ""}`}
                      rows={3}
                      value={openAllegedHistory}
                      onChange={(e) => setOpenAllegedHistory(e.target.value)}
                      placeholder={t("Record exact alleged history as narrated by patient or escort...", "واقعہ کی اصل تفصیل راوی کے الفاظ میں درج کریں...")}
                      data-help="mlc_cases.input_alleged_history"
                      required
                    ></textarea>
                    {openFormErrors.alleged_history && (
                      <div className="invalid-feedback">{openFormErrors.alleged_history}</div>
                    )}
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("History Given By:", "بیان کنندہ کا نام و تعلق:")}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={openHistoryGivenBy}
                      onChange={(e) => setOpenHistoryGivenBy(e.target.value)}
                      placeholder="e.g. Patient's brother / Patient himself"
                      data-help="mlc_cases.input_history_given_by"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {t("Initial Examination Findings (optional):", "ابتدائی طبی معائنہ (اختیاری):")}
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={openFindings}
                      onChange={(e) => setOpenFindings(e.target.value)}
                      placeholder={t("Initial physical injuries or signs...", "چوٹیں یا ظاہری علامات...")}
                      data-help="mlc_cases.input_findings"
                    ></textarea>
                  </div>

                  {/* If Brought by Police -> Station is required */}
                  {openBroughtBy === "Police" && (
                    <div className="p-2 border rounded border-warning bg-warning bg-opacity-10 mb-2">
                      <div className="fw-bold text-dark small mb-1">
                        🚔 {t("Police Escort Details (Required):", "پولیس تفصیلات (لازمی):")}
                      </div>
                      <div className="row g-2">
                        <div className="col-12 col-md-4">
                          <label className="form-label small">{t("Police Station:", "تھانہ:")}</label>
                          <select
                            className={`form-select form-select-sm ${openFormErrors.police_station_id ? "is-invalid" : ""}`}
                            value={openStationId}
                            onChange={(e) => setOpenStationId(e.target.value ? parseInt(e.target.value, 10) : "")}
                            data-help="mlc_cases.select_station"
                            required
                          >
                            <option value="">{t("Select station...", "تھانہ منتخب کریں...")}</option>
                            {policeStations.map((ps) => (
                              <option key={ps.contact_id} value={ps.contact_id}>
                                {ps.name} ({ps.district || ""})
                              </option>
                            ))}
                          </select>
                          {openFormErrors.police_station_id && (
                            <div className="invalid-feedback">{openFormErrors.police_station_id}</div>
                          )}
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small">{t("Roznamcha / FIR Ref:", "روزنامچہ یا ایف آئی آر نمبر:")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={openPoliceRef}
                            onChange={(e) => setOpenPoliceRef(e.target.value)}
                            placeholder="e.g. Roznamcha 14/A"
                            data-help="mlc_cases.input_police_ref"
                          />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small">{t("Investigating Officer:", "تفتیشی افسر:")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={openOfficer}
                            onChange={(e) => setOpenOfficer(e.target.value)}
                            placeholder="e.g. SI Aslam"
                            data-help="mlc_cases.input_investigating_officer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowOpenModal(false)}
                    data-help="mlc_cases.btn_cancel_open"
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-danger fw-bold shadow-sm"
                    disabled={write.busy}
                    data-help="mlc_cases.btn_submit_open"
                  >
                    ➕ {t("Open Case", "کیس رجسٹر کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* POLICE INTIMATION MODAL (rule:280a8e8493) */}
      {showIntimationModal && selectedCase && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1070 }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white py-2">
                <h5 className="modal-title m-0">
                  🚔 {t("Record Police Intimation", "تھانے کی اطلاع درج کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowIntimationModal(false)}
                  aria-label="Close"
                  data-help="mlc_cases.btn_close_intimation_modal"
                ></button>
              </div>

              <form onSubmit={handlePoliceIntimationSubmit}>
                <div className="modal-body p-3">
                  <ClinicalWriteFeedback write={write} />

                  <p className="small text-muted mb-2">
                    {t(
                      "Record dispatch of statutory intimation to the police station. Note: Once submitted, the police intimation record is permanent and cannot be modified.",
                      "تھانے کو قانونی اطلاع درج کریں۔ یاد رہے کہ یہ اندراج مستقل ہے اور دوبارہ تبدیل نہیں کیا جا سکتا۔",
                    )}
                  </p>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Police Station:", "متعلقہ تھانہ:")} <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select form-select-sm ${intimationErrors.police_station_id ? "is-invalid" : ""}`}
                      value={intimationStationId}
                      onChange={(e) => setIntimationStationId(e.target.value ? parseInt(e.target.value, 10) : "")}
                      data-help="mlc_cases.select_station"
                      required
                    >
                      <option value="">{t("Select station from contacts...", "تھانہ منتخب کریں...")}</option>
                      {policeStations.map((ps) => (
                        <option key={ps.contact_id} value={ps.contact_id}>
                          {ps.name} ({ps.district || ""}) - {ps.phone || ""}
                        </option>
                      ))}
                    </select>
                    {intimationErrors.police_station_id && (
                      <div className="invalid-feedback">{intimationErrors.police_station_id}</div>
                    )}
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Informed How:", "اطلاع کا طریقہ کار:")} <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={intimationHow}
                      onChange={(e) => setIntimationHow(e.target.value as any)}
                      data-help="mlc_cases.select_informed_how"
                      required
                    >
                      <option value="Phone">{t("Phone Call", "فون کال")}</option>
                      <option value="InPerson">{t("In Person (Hospital Runner / Police Visit)", "بالمشافہ")}</option>
                      <option value="Written">{t("Written Intimation Letter", "تحریری مکتوب")}</option>
                      <option value="BroughtByPolice">{t("Brought By Police", "پولیس ہمراہ لائی")}</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Duty Officer Informed To:", "اطلاع موصول کنندہ ڈیوٹی افسر:")}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={intimationTo}
                      onChange={(e) => setIntimationTo(e.target.value)}
                      placeholder="e.g. Muharrar ASI Muhammad Naveed"
                      data-help="mlc_cases.input_informed_to"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {t("Police Reference (Daily Diary / Roznamcha / FIR):", "روزنامچہ / ڈی ڈی نمبر یا ایف آئی آر:")}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={intimationRef}
                      onChange={(e) => setIntimationRef(e.target.value)}
                      placeholder="e.g. Roznamcha entry # 24/B"
                      data-help="mlc_cases.input_police_ref"
                    />
                  </div>
                </div>

                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowIntimationModal(false)}
                    data-help="mlc_cases.btn_cancel_intimation"
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-danger fw-bold"
                    disabled={write.busy}
                    data-help="mlc_cases.btn_submit_intimation"
                  >
                    📢 {t("Save Intimation", "اطلاع درج کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* HAND OVER EVIDENCE MODAL (rule:2b6e9d023c) */}
      {showEvidenceModal && selectedCase && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1070 }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white py-2">
                <h5 className="modal-title m-0">
                  📦 {t("Record Handed Evidence (POST /evidence)", "شواہد کی حوالگی درج کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowEvidenceModal(false)}
                  aria-label="Close"
                  data-help="mlc_cases.btn_close_evidence_modal"
                ></button>
              </div>

              <form onSubmit={handleAddEvidenceSubmit}>
                <div className="modal-body p-3">
                  <ClinicalWriteFeedback write={write} />

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Evidence Description:", "شواہد کی تفصیل:")} <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className={`form-control form-control-sm ${evidenceErrors.description ? "is-invalid" : ""}`}
                      rows={2}
                      value={evidenceDesc}
                      onChange={(e) => setEvidenceDesc(e.target.value)}
                      placeholder={t("e.g. Clothes worn at time of incident, sealed in tamper-evident paper envelope", "مثلاً کپڑے یا دیگر شواہد جو سیل شدہ لفافے میں بند ہیں...")}
                      data-help="mlc_cases.input_evidence_desc"
                      required
                    ></textarea>
                    {evidenceErrors.description && (
                      <div className="invalid-feedback">{evidenceErrors.description}</div>
                    )}
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Tamper-Evident Seal #:", "سیل نمبر:")}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={evidenceSeal}
                      onChange={(e) => setEvidenceSeal(e.target.value)}
                      placeholder="e.g. SEAL-PK-88412"
                      data-help="mlc_cases.input_evidence_seal"
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">
                      {t("Handed To (Name, Rank, Belt #):", "وصول کنندہ پولیس اہلکار (نام، عہدہ، بیلٹ نمبر):")}{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control form-control-sm ${evidenceErrors.handed_to ? "is-invalid" : ""}`}
                      value={evidenceHandedTo}
                      onChange={(e) => setEvidenceHandedTo(e.target.value)}
                      placeholder="e.g. Head Constable Muhammad Yousaf (Belt # 1492)"
                      data-help="mlc_cases.input_evidence_handed_to"
                      required
                    />
                    {evidenceErrors.handed_to && (
                      <div className="invalid-feedback">{evidenceErrors.handed_to}</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {t("Police Receipt / Acknowledgement Ref:", "پولیس رسید یا تصدیقی نمبر:")}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={evidenceReceipt}
                      onChange={(e) => setEvidenceReceipt(e.target.value)}
                      placeholder="e.g. REC-2026-771"
                      data-help="mlc_cases.input_evidence_receipt"
                    />
                  </div>
                </div>

                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowEvidenceModal(false)}
                    data-help="mlc_cases.btn_cancel_evidence"
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary fw-bold"
                    disabled={write.busy}
                    data-help="mlc_cases.btn_submit_evidence"
                  >
                    💾 {t("Save Evidence", "شواہد محفوظ کریں")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PRINT POLICE INTIMATION PREVIEW (rule:2b6e9d023c) */}
      {showPrintModal && printPayload && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1080 }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-dark text-white py-2">
                <h5 className="modal-title m-0">
                  🖨️ {t("Police Intimation A4 Printout", "تھانے کی اطلاع کا پرنٹ آؤٹ")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowPrintModal(false)}
                  aria-label="Close"
                  data-help="mlc_cases.btn_close_print_modal"
                ></button>
              </div>

              <div className="modal-body p-4 bg-white text-dark" style={{ minHeight: "450px" }}>
                {/* Hospital Header */}
                <div className="text-center border-bottom pb-2 mb-3">
                  <h4 className="fw-bold m-0">{printPayload.fields.hospital?.name || "GOVERNMENT HOSPITAL / HEALTH FACILITY"}</h4>
                  <div className="small text-muted">
                    {printPayload.fields.hospital?.address || ""} {printPayload.fields.hospital?.phone ? `• Tel: ${printPayload.fields.hospital.phone}` : ""}
                  </div>
                  <div className="badge bg-secondary mt-1">EMERGENCY & MEDICO-LEGAL DEPARTMENT</div>
                </div>

                <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
                  <div>
                    <strong>MLC Case Number:</strong> <code className="text-danger fs-5">{printPayload.fields.case?.mlc_number}</code>
                  </div>
                  <div>
                    <strong>Date & Time:</strong> {formatHospitalTime(printPayload.fields.case?.arrived_at, timeZone)}
                  </div>
                </div>

                {/* Body Table */}
                <table className="table table-sm table-bordered mb-3">
                  <tbody>
                    <tr>
                      <th style={{ width: "25%" }}>Patient Name:</th>
                      <td style={{ width: "25%" }}>{printPayload.fields.case?.patient_name}</td>
                      <th style={{ width: "25%" }}>MRN:</th>
                      <td style={{ width: "25%" }}>{printPayload.fields.case?.mrn}</td>
                    </tr>
                    <tr>
                      <th>Age / Gender:</th>
                      <td>{printPayload.fields.case?.age_years ?? "—"} y / {printPayload.fields.case?.gender}</td>
                      <th>CNIC:</th>
                      <td>{printPayload.fields.case?.cnic || "—"}</td>
                    </tr>
                    <tr>
                      <th>Father / Husband:</th>
                      <td>{printPayload.fields.case?.father_or_husband_name || "—"}</td>
                      <th>Case Type:</th>
                      <td><strong>{printPayload.fields.case?.case_type_name}</strong></td>
                    </tr>
                    <tr>
                      <th>Brought By:</th>
                      <td>{printPayload.fields.case?.brought_by} ({printPayload.fields.case?.brought_by_name || "—"})</td>
                      <th>Contact:</th>
                      <td>{printPayload.fields.case?.brought_by_phone || "—"}</td>
                    </tr>
                    <tr>
                      <th>Target Police Station:</th>
                      <td><strong>{printPayload.fields.case?.police_station_name || "—"}</strong></td>
                      <th>Police Ref (FIR / Roznamcha):</th>
                      <td>{printPayload.fields.case?.police_reference || "—"}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Alleged History */}
                <div className="mb-3">
                  <strong>Alleged History (As Stated):</strong>
                  <div className="p-2 border rounded bg-light mt-1">
                    {printPayload.fields.case?.alleged_history}
                  </div>
                  {printPayload.fields.case?.history_given_by && (
                    <small className="text-muted">History told by: {printPayload.fields.case?.history_given_by}</small>
                  )}
                </div>

                {/* Examination findings */}
                {printPayload.fields.case?.examination_findings && (
                  <div className="mb-4">
                    <strong>Initial Medical Observations:</strong>
                    <div className="p-2 border rounded bg-light mt-1">
                      {printPayload.fields.case?.examination_findings}
                    </div>
                  </div>
                )}

                {/* Signatures Footer */}
                <div className="row mt-5 pt-4 text-center">
                  <div className="col-6">
                    <div className="border-top pt-1">
                      <strong>Medical Officer on Duty</strong>
                      <div className="small text-muted">{printPayload.fields.case?.created_by_name}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border-top pt-1">
                      <strong>Police Officer / Receiving Station</strong>
                      <div className="small text-muted">Name, Rank, Belt Number & Stamp</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowPrintModal(false)}
                  data-help="mlc_cases.btn_footer_close_print"
                >
                  {t("Close", "بند کریں")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-bold"
                  onClick={() => window.print()}
                  data-help="mlc_cases.btn_print_action"
                >
                  🖨️ {t("Print / Save PDF", "پرنٹ / محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MLCCases;
