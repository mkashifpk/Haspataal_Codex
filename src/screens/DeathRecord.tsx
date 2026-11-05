import {ConsentScanUpload} from "./ConsentScanUpload";
import {DirectoryPicker} from "../DirectoryPicker";
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
  DeathIn,
  DeathDraftIn,
  DeathViewOut,
  DeathRecordOut,
  PatientAtDeathOut,
  DeathRegisterRowOut,
  DeathCorrectionIn,
  AutopsyRequestIn,
  AutopsyReportIn,
  PrintOut_DeathPrintFieldsOut_,
} from "../generated/death_record";
import {
  recordDeath,
  getDeath,
  saveDeath,
  certifyDeath,
  correctDeath,
  deathPrint,
  requestAutopsy,
  reportAutopsy,
  cancelAutopsy,
  deathRegister,
} from "../generated/death_record";
import {
  evaluateDeathRecordView,
  canRecordDeath,
  canViewDeathRegister,
  canManageAutopsy,
  validateRecordDeath,
  determineUnderlyingCause,
  checkCertificationReadiness,
  validateDeathDraft,
  validateDeathCorrection,
  validateAutopsyRequest,
  validateAutopsyReport,
  sortDeathRegister,
  explainDeathError,
} from "../death-record-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";
import { ICDPicker } from "./ICDPicker";

export interface DeathRecordProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialDeathId?: number;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
  screenId?: string;
}

export function DeathRecord({
  user,
  establishment,
  connected = true,
  stream,
  timeZone,
  initialDeathId,
  onNavigateScreen,
  onBack,
  screenId = "death_record",
}: DeathRecordProps) {
  const tz = timeZone || "Asia/Karachi";

  // Service view capability evaluation (rule:81b46f9cf6)
  const view = evaluateDeathRecordView(establishment, screenId);
  const canRecord = canRecordDeath(user);
  const canView = canViewDeathRegister(user);
  const canAutopsy = canManageAutopsy(user);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [settingFilter, setSettingFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Death Detail State
  const [selectedDeathId, setSelectedDeathId] = useState<number | null>(initialDeathId || null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(Boolean(initialDeathId));

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [autopsyReqModalOpen, setAutopsyReqModalOpen] = useState(false);
  const [autopsyRepModalOpen, setAutopsyRepModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [icdPickerTarget, setIcdPickerTarget] = useState<"a" | "b" | "c" | "d" | "other" | null>(null);

  // Draft Editing State
  const [draftState, setDraftState] = useState<Partial<DeathDraftIn>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [certIncompleteErrors, setCertIncompleteErrors] = useState<string[]>([]);

  // Initial Record Form State
  const [recordForm, setRecordForm] = useState<Partial<DeathIn> & { patient_id: number }>({
    patient_id: 0,
    death_at: new Date().toISOString().slice(0, 16),
    setting: "Emergency",
    death_at_estimated: false,
    expected_death: true,
    resuscitation_attempted: false,
    terminal_event: "",
  });

  // Correction Form State
  const [correctionForm, setCorrectionForm] = useState<Partial<DeathCorrectionIn>>({
    field: "general",
    correction_text: "",
    correction_reason: "",
  });

  // Autopsy Forms
  const [autopsyDocument,setAutopsyDocument]=useState<{patient_id:number;document_id:number}>();
  const [autopsyReqForm, setAutopsyReqForm] = useState<Partial<AutopsyRequestIn>>({
    request_reasons: "",
  });
  const [autopsyRepForm, setAutopsyRepForm] = useState<Partial<AutopsyReportIn>>({
    performed_at: new Date().toISOString().slice(0, 16),
    findings: "",
    correlation: "Confirmed",
    correlation_note: "",
  });

  // Print Payload State
  const [printPayload, setPrintPayload] = useState<PrintOut_DeathPrintFieldsOut_ | null>(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  // 1. Load Death Register
  const {
    data: registerData,
    loading: registerLoading,
    error: registerError,
    reload: reloadRegister,
  } = useLoad(() => deathRegister({ limit: 100 }), []);

  // 2. Load Selected Death Details
  const [scanPending,setScanPending]=useState(false);
  const [detailData, setDetailData] = useState<DeathViewOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);

  const reloadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await getDeath(id);
      setDetailData(res);
      // Initialize draft from record
      setDraftState({
        death_at: res.death.death_at,
        death_at_estimated: res.death.death_at_estimated,
        terminal_event: res.death.terminal_event,
        resuscitation_attempted: res.death.resuscitation_attempted,
        expected_death: res.death.expected_death,
        mlc_id: res.death.mlc_id,
        cause_a: res.death.cause_a,
        cause_a_interval: res.death.cause_a_interval,
        cause_a_icd: res.death.cause_a_icd,
        cause_b: res.death.cause_b,
        cause_b_interval: res.death.cause_b_interval,
        cause_b_icd: res.death.cause_b_icd,
        cause_c: res.death.cause_c,
        cause_c_interval: res.death.cause_c_interval,
        cause_c_icd: res.death.cause_c_icd,
        cause_d: res.death.cause_d,
        cause_d_interval: res.death.cause_d_interval,
        cause_d_icd: res.death.cause_d_icd,
        other_conditions: res.death.other_conditions,
        other_conditions_icd: res.death.other_conditions_icd,
        manner: res.death.manner,
        external_cause_date: res.death.external_cause_date,
        external_cause: res.death.external_cause,
        external_cause_place: res.death.external_cause_place,
        surgery_within_4_weeks: res.death.surgery_within_4_weeks,
        surgery_date: res.death.surgery_date || res.suggested?.surgery?.surgery_date,
        surgery_reason: res.death.surgery_reason || res.suggested?.surgery?.surgery_reason,
        pregnancy_status: res.death.pregnancy_status,
        pregnancy_contributed: res.death.pregnancy_contributed,
        multiple_pregnancy: res.death.multiple_pregnancy,
        hours_survived: res.death.hours_survived,
        birth_weight_grams: res.death.birth_weight_grams,
        gestation_weeks: res.death.gestation_weeks,
        mother_age_years: res.death.mother_age_years,
        maternal_conditions: res.death.maternal_conditions,
        expected_version: res.death.row_version,
      });
      setCertIncompleteErrors([]);
    } catch (e) {
      setDetailError(e);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeathId) {
      reloadDetail(selectedDeathId);
    }
  }, [selectedDeathId]);

  // Realtime subscription for death.recorded (rule:8c2341a2ff)
  useEffect(() => {
    if (!stream) return;
    try {
      const evt = JSON.parse(stream);
      if (evt.event === "death.recorded") {
        reloadRegister();
        if (selectedDeathId && evt.payload?.death_id === selectedDeathId) {
          reloadDetail(selectedDeathId);
        }
      }
    } catch {
      // ignore
    }
  }, [stream, selectedDeathId]);

  // Clinical write hook for safe idempotent writes
  const write = useClinicalWrite(user, screenId, () => {
    reloadRegister();
    if (selectedDeathId) {
      reloadDetail(selectedDeathId);
    }
    setRecordModalOpen(false);
    setCorrectionModalOpen(false);
    setAutopsyReqModalOpen(false);
    setAutopsyRepModalOpen(false);
  });

  // Filtered & Sorted Death Register
  const sortedRegister = useMemo(() => {
    if (!registerData) return [];
    let list = registerData;
    if (settingFilter !== "ALL") {
      list = list.filter((r) => r.setting === settingFilter);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.mrn.toLowerCase().includes(q) ||
          r.patient_name.toLowerCase().includes(q) ||
          r.death_number.toLowerCase().includes(q) ||
          (r.admission_number && r.admission_number.toLowerCase().includes(q))
      );
    }
    return sortDeathRegister(list);
  }, [registerData, settingFilter, statusFilter, searchQuery]);

  // KPI Summary
  const kpis = useMemo(() => {
    const total = registerData?.length || 0;
    const drafts = registerData?.filter((r) => r.status === "Draft").length || 0;
    const certified = registerData?.filter((r) => r.status === "Certified").length || 0;
    const mlc = registerData?.filter((r) => Boolean(r.mlc_number)).length || 0;
    const autopsies = registerData?.filter((r) => Boolean(r.autopsy_status)).length || 0;
    return { total, drafts, certified, mlc, autopsies };
  }, [registerData]);

  // Underlying cause dynamic evaluation (rule:4a9cf9f9a8)
  const currentUnderlying = useMemo(() => {
    return determineUnderlyingCause(draftState);
  }, [draftState]);

  // Handle Record Death
  const handleRecordDeathSubmit = () => {
    const errs = validateRecordDeath(recordForm.patient_id, recordForm);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});
    write.start({
      path: `/patients/${recordForm.patient_id}/death`,
      method: "POST",
      body: recordForm,
      permission: "death.record",
      protection: "idempotent",
      label: `Record death for Patient #${recordForm.patient_id}`,
    });
  };

  // Handle Save Draft (PUT /deaths/{id})
  const handleSaveDraft = () => {
    if (!detailData||scanPending||write.blocked) return;
    const errs = validateDeathDraft(draftState, detailData.patient);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});
    write.start({
      path: `/deaths/${detailData.death.death_id}`,
      method: "PUT",
      body: {
        ...draftState,
        expected_version: detailData.death.row_version,
      },
      permission: "death.record",
      protection: "idempotent",
      label: `Save death certificate draft for ${detailData.death.death_number}`,
    });
  };

  // Handle Certify Death (POST /deaths/{id}/certify)
  const handleCertify = () => {
    if (!detailData) return;
    const readiness = checkCertificationReadiness(draftState, detailData.patient);
    if (!readiness.ready) {
      setCertIncompleteErrors(readiness.reasons);
      return;
    }
    setCertIncompleteErrors([]);
    write.start({
      path: `/deaths/${detailData.death.death_id}/certify`,
      method: "POST",
      body: { expected_version: detailData.death.row_version },
      permission: "death.record",
      protection: "idempotent",
      label: `Certify cause of death for ${detailData.death.death_number}`,
    });
  };

  // Handle Append Correction (POST /deaths/{id}/corrections)
  const handleAppendCorrection = () => {
    if (!detailData) return;
    const errs = validateDeathCorrection(correctionForm);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});
    write.start({
      path: `/deaths/${detailData.death.death_id}/corrections`,
      method: "POST",
      body: correctionForm,
      permission: "death.record",
      protection: "idempotent",
      label: `Append correction to certified death ${detailData.death.death_number}`,
    });
  };

  // Handle Autopsy Request
  const handleAutopsyRequestSubmit = () => {
    if (!detailData) return;
    const val = validateAutopsyRequest(autopsyReqForm, detailData.death);
    if (!val.valid) {
      setValidationErrors({ request_reasons: val.error || "Invalid request" });
      return;
    }
    setValidationErrors({});
    write.start({
      path: `/deaths/${detailData.death.death_id}/autopsy`,
      method: "POST",
      body: autopsyReqForm,
      permission: "death.record",
      protection: "idempotent",
      label: `Request clinical autopsy for ${detailData.death.death_number}`,
    });
  };

  // Handle Autopsy Report
  const handleAutopsyReportSubmit = () => {
    if (!detailData||scanPending||write.blocked) return;
    const errs = validateAutopsyReport(autopsyRepForm);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors({});
    write.start({
      path: `/deaths/${detailData.death.death_id}/autopsy/report`,
      method: "POST",
      body: {...autopsyRepForm,report_document_id:autopsyDocument?.patient_id===detailData.death.patient_id?autopsyDocument.document_id:undefined},
      permission: "death.record",
      protection: "idempotent",
      label: `Record autopsy report for ${detailData.death.death_number}`,
    });
  };

  // Handle Print Certificate Payload (rule:274cc0ed96)
  const handleOpenPrintModal = async () => {
    if (!detailData) return;
    setLoadingPrint(true);
    try {
      const p = await deathPrint(detailData.death.death_id, { document: "certificate" });
      setPrintPayload(p);
      setPrintModalOpen(true);
    } catch (e) {
      setValidationErrors({ general: explainDeathError(e) });
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <div data-write-pending={write.blocked||scanPending} className="container-fluid p-3" data-screen-id={screenId} style={{ minHeight: "100vh" }}>
      {/* Retiring / Service View Banner (rule:81b46f9cf6) */}
      {view.banner && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
          <span className="me-2" style={{ fontSize: "1.2rem" }}>⚠️</span>
          <div>{t(view.banner, "اس سروس کے تحت نئے ریکارڈ بند ہیں؛ موجودہ ریکارڈز کی تکمیل جاری ہے۔")}</div>
        </div>
      )}

      {/* Header bar */}
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
          <div className="d-flex align-items-center gap-2">
            {onBack && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onBack}
                data-help="death_record.btn_back"
              >
                ← {t("Back", "واپس")}
              </button>
            )}
            <h3 className="m-0 fw-bold">
              {t("Death record & certificate", "ڈیتھ ریکارڈ اور سرٹیفکیٹ")}
            </h3>
            <span className="badge bg-secondary">
              {t("Doctor Workspace", "ڈاکٹر ورک اسپیس")}
            </span>
            <span className="badge bg-info text-dark">MSDS 106, 154</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => reloadRegister()}
              data-help="death_record.btn_refresh"
            >
              🔄 {t("Refresh", "تازہ کریں")}
            </button>
            {view.canRecordNew && canRecord && (
              <button
                type="button"
                className="btn btn-danger btn-sm fw-bold"
                onClick={() => {
                  setValidationErrors({});
                  setRecordModalOpen(true);
                }}
                data-help="death_record.btn_open_record_modal"
              >
                + {t("Record Death", "موت کا اندراج کریں")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-2">
          <div className="card bg-light border text-center p-2 shadow-sm">
            <small className="text-muted">{t("Total Deaths", "کل اموات")}</small>
            <h4 className="m-0 fw-bold">{kpis.total}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card bg-warning bg-opacity-25 border-warning text-center p-2 shadow-sm">
            <small className="text-dark fw-bold">{t("Draft Certificates", "زیر تکمیل سرٹیفکیٹ")}</small>
            <h4 className="m-0 fw-bold text-dark">{kpis.drafts}</h4>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card bg-success bg-opacity-25 border-success text-center p-2 shadow-sm">
            <small className="text-success fw-bold">{t("Certified", "مصدقہ")}</small>
            <h4 className="m-0 fw-bold text-success">{kpis.certified}</h4>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card bg-danger bg-opacity-25 border-danger text-center p-2 shadow-sm">
            <small className="text-danger fw-bold">{t("Medico-Legal (MLC)", "میڈیکو لیگل کیسز")}</small>
            <h4 className="m-0 fw-bold text-danger">{kpis.mlc}</h4>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="card bg-primary bg-opacity-25 border-primary text-center p-2 shadow-sm">
            <small className="text-primary fw-bold">{t("Autopsies", "پوسٹ مارٹم / معائنہ")}</small>
            <h4 className="m-0 fw-bold text-primary">{kpis.autopsies}</h4>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card shadow-sm mb-3">
        <div className="card-body p-2 d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder={t("Search by MRN, Name, or Death #...", "ایم آر این، نام یا ڈیتھ نمبر سے تلاش...")}
            style={{ maxWidth: 300 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-help="death_record.search"
          />

          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 160 }}
            value={settingFilter}
            onChange={(e) => setSettingFilter(e.target.value)}
            data-help="death_record.filter_setting"
          >
            <option value="ALL">{t("All Settings", "تمام ترتیبات")}</option>
            <option value="Inpatient">{t("Inpatient (Ward)", "ان ڈور (وارڈ)")}</option>
            <option value="Emergency">{t("Emergency", "ایمرجنسی")}</option>
            <option value="Outpatient">{t("Outpatient", "او پی ڈی")}</option>
            <option value="BroughtDead">{t("Brought Dead", "مردہ لائے گئے")}</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 150 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-help="death_record.filter_status"
          >
            <option value="ALL">{t("All Statuses", "تمام حالات")}</option>
            <option value="Draft">{t("Draft only", "صرف مسودہ")}</option>
            <option value="Certified">{t("Certified only", "صرف مصدقہ")}</option>
          </select>

          <span className="ms-auto text-muted small">
            {t(`Showing ${sortedRegister.length} records`, `${sortedRegister.length} ریکارڈز موجود ہیں`)}
          </span>
        </div>
      </div>

      {/* Main Table: Death Register */}
      <div className="card shadow-sm mb-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>{t("Death #", "ڈیتھ نمبر")}</th>
                <th>{t("Patient (MRN)", "مریض (ایم آر این)")}</th>
                <th>{t("Setting", "مقام")}</th>
                <th>{t("Death Time", "وقت وفات")}</th>
                <th>{t("Underlying Cause & ICD", "بنیادی وجہ اور آئی سی ڈی")}</th>
                <th>{t("Manner", "طریقہ وفات")}</th>
                <th>{t("Status", "حالت")}</th>
                <th className="text-end">{t("Action", "کارروائی")}</th>
              </tr>
            </thead>
            <tbody>
              {registerLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <LoadState loading={true} error={null} retry={reloadRegister} />
                  </td>
                </tr>
              ) : registerError ? (
                <tr>
                  <td colSpan={8} className="py-3">
                    <ErrorBox error={registerError} />
                  </td>
                </tr>
              ) : sortedRegister.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <Empty>{t("No death records found matching the criteria.", "کوئی ڈیتھ ریکارڈ نہیں ملا۔")}</Empty>
                  </td>
                </tr>
              ) : (
                sortedRegister.map((row) => (
                  <tr
                    key={row.death_id}
                    className={selectedDeathId === row.death_id ? "table-active" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if(scanPending||write.blocked)return;
                        setSelectedDeathId(row.death_id);
                      setDetailModalOpen(true);
                    }}
                  >
                    <td>
                      <span className="fw-bold">{row.death_number}</span>
                      {row.mlc_number && (
                        <div className="badge bg-danger ms-1" style={{ fontSize: "0.65rem" }}>
                          MLC: {row.mlc_number}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="fw-bold">{row.patient_name}</div>
                      <small className="text-muted">MRN: {row.mrn}</small>
                    </td>
                    <td>
                      <span className="badge bg-secondary">{row.setting}</span>
                      {row.ward_name && <small className="d-block text-muted">{row.ward_name}</small>}
                    </td>
                    <td>
                      <div>{row.death_at ? formatHospitalTime(row.death_at, tz) : "-"}</div>
                      {row.expected_death === false && (
                        <span className="badge bg-warning text-dark" style={{ fontSize: "0.65rem" }}>
                          {t("Unexpected (Sentinel)", "غیر متوقع")}
                        </span>
                      )}
                    </td>
                    <td>
                      <div>{row.underlying_cause || <span className="text-muted">{t("Not determined", "تعین نہیں ہوا")}</span>}</div>
                      {row.underlying_icd && <span className="badge bg-light text-dark border">{row.underlying_icd}</span>}
                    </td>
                    <td>
                      <span className="badge bg-info text-dark">{row.manner || "Unknown"}</span>
                    </td>
                    <td>
                      {row.status === "Certified" ? (
                        <span className="badge bg-success">{t("Certified", "مصدقہ")}</span>
                      ) : (
                        <span className="badge bg-warning text-dark">{t("Draft", "مسودہ")}</span>
                      )}
                      {row.autopsy_status && (
                        <div className="badge bg-primary ms-1" style={{ fontSize: "0.65rem" }}>
                          Autopsy: {row.autopsy_status}
                        </div>
                      )}
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => {
                          if(scanPending||write.blocked)return;
                        setSelectedDeathId(row.death_id);
                          setDetailModalOpen(true);
                        }}
                        data-help="death_record.btn_view_certificate"
                      >
                        {row.status === "Certified" ? t("View Certificate", "سرٹیفکیٹ دیکھیں") : t("Edit Certificate", "سرٹیفکیٹ مکمل کریں")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinical Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Detail & Certificate Modal */}
      {detailModalOpen && detailData && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              {/* Modal Header */}
              <div className="modal-header d-flex justify-content-between align-items-center bg-light">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="modal-title fw-bold">
                    {t("WHO Cause-of-Death Certificate", "ڈبلیو ایچ او کاز آف ڈیتھ سرٹیفکیٹ")}: {detailData.death.death_number}
                  </h5>
                  {detailData.death.status === "Certified" ? (
                    <span className="badge bg-success">{t("Certified", "مصدقہ")}</span>
                  ) : (
                    <span className="badge bg-warning text-dark">{t("Draft", "مسودہ")}</span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleOpenPrintModal}
                    disabled={loadingPrint}
                    data-help="death_record.btn_print"
                  >
                    🖨️ {t("Print Certificate (A4)", "سرٹیفکیٹ پرنٹ کریں")}
                  </button>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDetailModalOpen(false)}
                    data-help="death_record.btn_close_detail_modal"
                  />
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-3">
                {/* Medico-Legal Hazard Banner (rule:0cf8a9f905) */}
                {detailData.death.mlc_number && (
                  <div className="alert alert-danger d-flex align-items-center mb-3 fw-bold" role="alert">
                    <span className="me-2" style={{ fontSize: "1.4rem" }}>⚖️</span>
                    <div>
                      {t(
                        `MEDICO-LEGAL DEATH (${detailData.death.mlc_number}): A medico-legal death has a post-mortem ordered by the police, not a clinical autopsy.`,
                        `میڈیکو لیگل ڈیتھ (${detailData.death.mlc_number}): پولیس کے حکم پر پوسٹ مارٹم ہوگا؛ طبی معائنہ (کلینیکل آٹوپسی) ممنوع ہے۔`
                      )}
                    </div>
                  </div>
                )}

                {/* Patient Summary Header */}
                <div className="card bg-light border mb-3">
                  <div className="card-body p-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <span className="fw-bold fs-6">{detailData.patient.full_name}</span>{" "}
                      <span className="text-muted">(MRN: {detailData.patient.mrn})</span>
                      <div className="small text-muted">
                        {t("Gender", "جنس")}: {detailData.patient.gender} | {t("Age", "عمر")}: {detailData.patient.age_at_death_years}y | CNIC: {detailData.patient.cnic || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="small">
                        <strong>{t("Died At", "وقت وفات")}:</strong> {detailData.death.death_at ? formatHospitalTime(detailData.death.death_at, tz) : "-"}
                      </div>
                      <div className="small text-muted">
                        <strong>{t("Setting", "مقام")}:</strong> {detailData.death.setting} {detailData.death.ward_name && `(${detailData.death.ward_name})`}
                      </div>
                    </div>
                    <div>
                      <div className="small">
                        <strong>{t("Pronounced by", "تصدیق کنندہ معالج")}:</strong> {detailData.death.pronounced_by_name}
                      </div>
                      <div className="small">
                        <strong>{t("Expected", "متوقع")}:</strong> {detailData.death.expected_death ? t("Yes", "ہاں") : t("No (Unexpected)", "نہیں (غیر متوقع)")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Incomplete Certification Errors Banner */}
                {certIncompleteErrors.length > 0 && (
                  <div className="alert alert-danger mb-3" role="alert">
                    <strong>{t("Cannot certify: Missing required information (DEATH_CERTIFICATE_INCOMPLETE)", "سرٹیفکیٹ کی تصدیق نہیں ہو سکتی: لازمی معلومات نامکمل ہیں")}:</strong>
                    <ul className="mb-0 mt-1 ps-3">
                      {certIncompleteErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnosis Suggestion Chips (rule:9e98e4c3ec) */}
                {detailData.death.status === "Draft" && detailData.suggested?.conditions && detailData.suggested.conditions.length > 0 && (
                  <div className="card bg-info bg-opacity-10 border-info mb-3">
                    <div className="card-body p-2">
                      <small className="fw-bold text-dark d-block mb-1">
                        💡 {t("Suggested Conditions from Inpatient/Visit Charts (Click to assign to line)", "مریض کے حالیہ علاج سے تجویز کردہ تشخیص (لائن میں شامل کرنے کے لیے کلک کریں)")}:
                      </small>
                      <div className="d-flex flex-wrap gap-1">
                        {detailData.suggested.conditions.map((cond, idx) => (
                          <div key={idx} className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-dark btn-sm text-start"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => {
                                if (!draftState.cause_a) {
                                  setDraftState({ ...draftState, cause_a: cond.text, cause_a_icd: cond.icd_codes?.[0] || "" });
                                } else if (!draftState.cause_b) {
                                  setDraftState({ ...draftState, cause_b: cond.text, cause_b_icd: cond.icd_codes?.[0] || "" });
                                } else if (!draftState.cause_c) {
                                  setDraftState({ ...draftState, cause_c: cond.text, cause_c_icd: cond.icd_codes?.[0] || "" });
                                } else if (!draftState.cause_d) {
                                  setDraftState({ ...draftState, cause_d: cond.text, cause_d_icd: cond.icd_codes?.[0] || "" });
                                } else {
                                  setDraftState({ ...draftState, other_conditions: (draftState.other_conditions ? draftState.other_conditions + "; " : "") + cond.text });
                                }
                              }}
                              data-help="death_record.btn_chip_condition"
                            >
                              + {cond.text} {cond.icd_codes?.[0] && `[${cond.icd_codes[0]}]`}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* WHO Cause of Death Form (rule:4a9cf9f9a8) */}
                <div className="card border mb-3">
                  <div className="card-header bg-light fw-bold">
                    {t("WHO Cause of Death Form: Part I (Causal Sequence)", "ڈبلیو ایچ او فارم حصہ اول: موت کا سلسلہ وار سبب")}
                  </div>
                  <div className="card-body p-3">
                    {/* Part I - Line a */}
                    <div className={`p-2 mb-2 rounded border ${currentUnderlying.line === "a" ? "border-primary bg-primary bg-opacity-10" : ""}`}>
                      <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                          <label className="form-label small fw-bold mb-1">
                            (a) {t("Direct cause / Immediate condition", "براہ راست یا فوری سبب")} <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. Acute myocardial infarction", "مثلاً ایکیوٹ مایوکارڈیل انفارکشن")}
                            value={draftState.cause_a || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_a: e.target.value })}
                            data-help="death_record.input_cause_a"
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small mb-1">{t("Interval onset to death", "آغاز سے موت کا وقفہ")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. 2 hours", "مثلاً 2 گھنٹے")}
                            value={draftState.cause_a_interval || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_a_interval: e.target.value })}
                            data-help="death_record.input_cause_a_interval"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">{t("ICD Code", "آئی سی ڈی کوڈ")}</label>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="ICD-10/11"
                              value={draftState.cause_a_icd || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, cause_a_icd: e.target.value })}
                              data-help="death_record.input_cause_a_icd"
                            />
                            {detailData.death.status !== "Certified" && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setIcdPickerTarget("a")}
                                data-help="death_record.btn_pick_icd_a"
                              >
                                🔍 {t("Pick", "منتخب")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Part I - Line b */}
                    <div className={`p-2 mb-2 rounded border ${currentUnderlying.line === "b" ? "border-primary bg-primary bg-opacity-10" : ""}`}>
                      <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                          <label className="form-label small mb-1">
                            (b) {t("Due to (or as a consequence of)", "کی وجہ سے (یا اس کے نتیجے میں)")}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. Coronary artery thrombosis", "مثلاً کرونری آرٹری تھرومبوسس")}
                            value={draftState.cause_b || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_b: e.target.value })}
                            data-help="death_record.input_cause_b"
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small mb-1">{t("Interval", "وقفہ")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. 3 days", "مثلاً 3 دن")}
                            value={draftState.cause_b_interval || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_b_interval: e.target.value })}
                            data-help="death_record.input_cause_b_interval"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">{t("ICD Code", "آئی سی ڈی کوڈ")}</label>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="ICD-10/11"
                              value={draftState.cause_b_icd || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, cause_b_icd: e.target.value })}
                              data-help="death_record.input_cause_b_icd"
                            />
                            {detailData.death.status !== "Certified" && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setIcdPickerTarget("b")}
                                data-help="death_record.btn_pick_icd_b"
                              >
                                🔍 {t("Pick", "منتخب")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Part I - Line c */}
                    <div className={`p-2 mb-2 rounded border ${currentUnderlying.line === "c" ? "border-primary bg-primary bg-opacity-10" : ""}`}>
                      <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                          <label className="form-label small mb-1">
                            (c) {t("Due to (or as a consequence of)", "کی وجہ سے (یا اس کے نتیجے میں)")}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. Atherosclerotic heart disease", "مثلاً ایتھیروسکلروٹک ہارٹ ڈیزیز")}
                            value={draftState.cause_c || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_c: e.target.value })}
                            data-help="death_record.input_cause_c"
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small mb-1">{t("Interval", "وقفہ")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. 5 years", "مثلاً 5 سال")}
                            value={draftState.cause_c_interval || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_c_interval: e.target.value })}
                            data-help="death_record.input_cause_c_interval"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">{t("ICD Code", "آئی سی ڈی کوڈ")}</label>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="ICD-10/11"
                              value={draftState.cause_c_icd || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, cause_c_icd: e.target.value })}
                              data-help="death_record.input_cause_c_icd"
                            />
                            {detailData.death.status !== "Certified" && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setIcdPickerTarget("c")}
                                data-help="death_record.btn_pick_icd_c"
                              >
                                🔍 {t("Pick", "منتخب")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Part I - Line d */}
                    <div className={`p-2 mb-2 rounded border ${currentUnderlying.line === "d" ? "border-primary bg-primary bg-opacity-10" : ""}`}>
                      <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                          <label className="form-label small mb-1">
                            (d) {t("Due to (or as a consequence of)", "کی وجہ سے (یا اس کے نتیجے میں)")}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. Diabetes mellitus type 2", "مثلاً ذیابیطس ٹائپ 2")}
                            value={draftState.cause_d || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_d: e.target.value })}
                            data-help="death_record.input_cause_d"
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small mb-1">{t("Interval", "وقفہ")}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("e.g. 10 years", "مثلاً 10 سال")}
                            value={draftState.cause_d_interval || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, cause_d_interval: e.target.value })}
                            data-help="death_record.input_cause_d_interval"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">{t("ICD Code", "آئی سی ڈی کوڈ")}</label>
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="ICD-10/11"
                              value={draftState.cause_d_icd || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, cause_d_icd: e.target.value })}
                              data-help="death_record.input_cause_d_icd"
                            />
                            {detailData.death.status !== "Certified" && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setIcdPickerTarget("d")}
                                data-help="death_record.btn_pick_icd_d"
                              >
                                🔍 {t("Pick", "منتخب")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Underlying cause indicator */}
                    {currentUnderlying.cause && (
                      <div className="alert alert-primary py-2 px-3 mb-0 small d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{t("Underlying Cause of Death (WHO lowest line)", "بنیادی وجہ وفات (سب سے نچلی لائن)")}:</strong>{" "}
                          <span>{currentUnderlying.cause}</span> {currentUnderlying.icd && `[${currentUnderlying.icd}]`}
                        </div>
                        <span className="badge bg-primary">Part I ({currentUnderlying.line})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Part II: Contributing Conditions */}
                <div className="card border mb-3">
                  <div className="card-header bg-light fw-bold small">
                    {t("WHO Form: Part II (Other Significant Conditions)", "ڈبلیو ایچ او فارم حصہ دوم: دیگر اہم معاون حالات")}
                  </div>
                  <div className="card-body p-2">
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder={t("Other significant conditions contributing to death but not related to the disease or condition causing it...", "دیگر اہم معاون بیماریاں جو موت کا سبب بنیں لیکن براہ راست بنیادی بیماری سے منسلک نہ ہوں...")}
                      value={draftState.other_conditions || ""}
                      disabled={detailData.death.status === "Certified"}
                      onChange={(e) => setDraftState({ ...draftState, other_conditions: e.target.value })}
                      data-help="death_record.input_other_conditions"
                    />
                  </div>
                </div>

                {/* Manner of Death & External Causes */}
                <div className="card border mb-3">
                  <div className="card-header bg-light fw-bold small">
                    {t("Manner of Death & External Causes", "طریقہ وفات اور خارجی اسباب")}
                  </div>
                  <div className="card-body p-3">
                    <div className="row g-2 mb-2">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1">
                          {t("Manner of Death", "طریقہ وفات")} <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={draftState.manner || ""}
                          disabled={detailData.death.status === "Certified"}
                          onChange={(e) => setDraftState({ ...draftState, manner: (e.target.value || null) as any })}
                          data-help="death_record.select_manner"
                        >
                          <option value="">{t("-- Select Manner --", "-- طریقہ وفات چنیں --")}</option>
                          <option value="Disease">{t("Disease (Natural)", "طبعی بیماری")}</option>
                          <option value="Accident">{t("Accident", "حادثہ")}</option>
                          <option value="IntentionalSelfHarm">{t("Intentional Self Harm (Suicide)", "خودکشی")}</option>
                          <option value="Assault">{t("Assault (Homicide)", "تشدد / قتل")}</option>
                          <option value="LegalIntervention">{t("Legal Intervention", "قانونی کارروائی")}</option>
                          <option value="War">{t("War Operations", "جنگی حالات")}</option>
                          <option value="PendingInvestigation">{t("Pending Investigation", "زیر تفتیش")}</option>
                          <option value="CouldNotBeDetermined">{t("Could Not Be Determined", "تعین ناممکن")}</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1">
                          {t("Expected vs Unexpected Death", "متوقع یا غیر متوقع موت")} <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={draftState.expected_death === undefined ? "" : draftState.expected_death ? "true" : "false"}
                          disabled={detailData.death.status === "Certified"}
                          onChange={(e) => setDraftState({ ...draftState, expected_death: e.target.value === "true" })}
                          data-help="death_record.select_expected_death"
                        >
                          <option value="true">{t("Expected Death", "متوقع وفات")}</option>
                          <option value="false">{t("Unexpected Death (Triggers Sentinel Review)", "غیر متوقع وفات (سینٹینیل جائزہ)")}</option>
                        </select>
                      </div>
                    </div>

                    {/* External Cause Fields (for violent manner) */}
                    {["Accident", "IntentionalSelfHarm", "Assault", "LegalIntervention", "War"].includes(draftState.manner || "") && (
                      <div className="card bg-warning bg-opacity-10 border-warning p-2 mt-2">
                        <small className="fw-bold text-dark mb-1 d-block">
                          {t("External Cause of Injury / Poisoning Required", "چوٹ یا زہر خورانی کی بیرونی وجہ لازمی ہے")}:
                        </small>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={t("Describe how injury occurred or substance ingested...", "حادثے یا چوٹ کی نوعیت یا زہر خورانی کی تفصیل...")}
                              value={draftState.external_cause || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, external_cause: e.target.value })}
                              data-help="death_record.input_external_cause"
                            />
                          </div>
                          <div className="col-md-3">
                            <select
                              className="form-select form-select-sm"
                              value={draftState.external_cause_place || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, external_cause_place: (e.target.value || null) as any })}
                              data-help="death_record.select_external_cause_place"
                            >
                              <option value="Home">{t("Home", "گھر")}</option>
                              <option value="StreetOrHighway">{t("Street / Highway", "سڑک / ہائی وے")}</option>
                              <option value="TradeOrServiceArea">{t("Trade / Service Area", "کاروباری علاقہ")}</option>
                              <option value="IndustrialOrConstruction">{t("Industrial / Construction", "صنعتی مقام")}</option>
                              <option value="Farm">{t("Farm / Agricultural", "کھیت / زرعی رقبہ")}</option>
                              <option value="Other">{t("Other", "دیگر")}</option>
                              <option value="Unknown">{t("Unknown", "نامعلوم")}</option>
                            </select>
                          </div>
                          <div className="col-md-3">
                            <input
                              type="date"
                              className="form-control form-control-sm"
                              value={draftState.external_cause_date || ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, external_cause_date: e.target.value })}
                              data-help="death_record.input_external_cause_date"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Surgery, Pregnancy, and Infant Sections */}
                <div className="row g-3 mb-3">
                  {/* Surgery within 4 weeks */}
                  <div className="col-md-4">
                    <div className="card border h-100 p-2">
                      <small className="fw-bold mb-1">{t("Surgery in Last 4 Weeks", "گزشتہ 4 ہفتوں میں سرجری")}:</small>
                      <select
                        className="form-select form-select-sm mb-1"
                        value={draftState.surgery_within_4_weeks === undefined ? "" : draftState.surgery_within_4_weeks ? "true" : "false"}
                        disabled={detailData.death.status === "Certified"}
                        onChange={(e) => setDraftState({ ...draftState, surgery_within_4_weeks: e.target.value === "true" })}
                        data-help="death_record.select_surgery_within_4_weeks"
                      >
                        <option value="false">{t("No Surgery", "کوئی سرجری نہیں")}</option>
                        <option value="true">{t("Yes, underwent surgery", "ہاں، سرجری ہوئی")}</option>
                      </select>
                      {draftState.surgery_within_4_weeks && (
                        <>
                          <input
                            type="date"
                            className="form-control form-control-sm mb-1"
                            value={draftState.surgery_date || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, surgery_date: e.target.value })}
                            data-help="death_record.input_surgery_date"
                          />
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={t("Surgery reason...", "سرجری کی وجہ...")}
                            value={draftState.surgery_reason || ""}
                            disabled={detailData.death.status === "Certified"}
                            onChange={(e) => setDraftState({ ...draftState, surgery_reason: e.target.value })}
                            data-help="death_record.input_surgery_reason"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pregnancy Section (for females 10-54) */}
                  {detailData.patient.pregnancy_applies && (
                    <div className="col-md-4">
                      <div className="card border h-100 p-2">
                        <small className="fw-bold mb-1 text-primary">{t("Pregnancy Status (Females 10-54)", "حمل کی کیفیت")}:</small>
                        <select
                          className="form-select form-select-sm mb-1"
                          value={draftState.pregnancy_status || ""}
                          disabled={detailData.death.status === "Certified"}
                          onChange={(e) => setDraftState({ ...draftState, pregnancy_status: (e.target.value || null) as any })}
                          data-help="death_record.select_pregnancy_status"
                        >
                          <option value="">{t("-- Select Pregnancy Status --", "-- کیفیت منتخب کریں --")}</option>
                          <option value="NotPregnant">{t("Not Pregnant", "حاملہ نہیں")}</option>
                          <option value="AtDeath">{t("Pregnant at Death", "وفات کے وقت حاملہ")}</option>
                          <option value="Within42Days">{t("Delivered within 42 days", "42 دن کے اندر ولادت")}</option>
                          <option value="Within1Year">{t("Delivered within 1 year", "1 سال کے اندر ولادت")}</option>
                          <option value="Unknown">{t("Unknown", "نامعلوم")}</option>
                        </select>
                        <select
                          className="form-select form-select-sm"
                          value={draftState.pregnancy_contributed || "No"}
                          disabled={detailData.death.status === "Certified"}
                          onChange={(e) => setDraftState({ ...draftState, pregnancy_contributed: (e.target.value || null) as any })}
                          data-help="death_record.select_pregnancy_contributed"
                        >
                          <option value="No">{t("Did not contribute to death", "موت کا سبب نہیں بنا")}</option>
                          <option value="Yes">{t("Contributed to death", "موت کا سبب بنا")}</option>
                          <option value="Unknown">{t("Unknown contribution", "نامعلوم")}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Perinatal / Infant Section (for infants under 1y) */}
                  {detailData.patient.infant_applies && (
                    <div className="col-md-4">
                      <div className="card border h-100 p-2">
                        <small className="fw-bold mb-1 text-info">{t("Perinatal & Infant Details", "شیر خوار کی تفصیلات")}:</small>
                        <div className="row g-1">
                          <div className="col-6">
                            <input
                              type="number"
                              className="form-control form-control-sm mb-1"
                              placeholder={t("Birth Wt (g)", "وزن پیدائش")}
                              value={draftState.birth_weight_grams ?? ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, birth_weight_grams: e.target.value ? Number(e.target.value) : null })}
                              data-help="death_record.input_birth_weight"
                            />
                          </div>
                          <div className="col-6">
                            <input
                              type="number"
                              className="form-control form-control-sm mb-1"
                              placeholder={t("Gestation (wks)", "مدت حمل")}
                              value={draftState.gestation_weeks ?? ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, gestation_weeks: e.target.value ? Number(e.target.value) : null })}
                              data-help="death_record.input_gestation_weeks"
                            />
                          </div>
                          <div className="col-6">
                            <input
                              type="number"
                              className="form-control form-control-sm mb-1"
                              placeholder={t("Hours survived", "زندہ رہنے کا وقت")}
                              value={draftState.hours_survived ?? ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, hours_survived: e.target.value ? Number(e.target.value) : null })}
                              data-help="death_record.input_hours_survived"
                            />
                          </div>
                          <div className="col-6">
                            <input
                              type="number"
                              className="form-control form-control-sm mb-1"
                              placeholder={t("Mother age", "ماں کی عمر")}
                              value={draftState.mother_age_years ?? ""}
                              disabled={detailData.death.status === "Certified"}
                              onChange={(e) => setDraftState({ ...draftState, mother_age_years: e.target.value ? Number(e.target.value) : null })}
                              data-help="death_record.input_mother_age"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Certification Stamp & Post-Certification Corrections */}
                {detailData.death.status === "Certified" ? (
                  <div className="card bg-success bg-opacity-10 border-success mb-3 p-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="fw-bold text-success mb-1">
                          ✓ {t("Certified Cause of Death", "مصدقہ سبب وفات")}
                        </h6>
                        <div className="small">
                          <strong>{t("Certified by", "مصدقہ معالج")}:</strong> {detailData.death.certifier_name} ({detailData.death.certifier_license || "PMDC Registered"})
                        </div>
                        <div className="small text-muted">
                          {detailData.death.certified_at ? formatHospitalTime(detailData.death.certified_at, tz) : "-"}
                        </div>
                      </div>
                      {canRecord && (
                        <button
                          type="button"
                          className="btn btn-warning btn-sm fw-bold"
                          onClick={() => {
                            setValidationErrors({});
                            setCorrectionForm({ field: "general", correction_text: "", correction_reason: "" });
                            setCorrectionModalOpen(true);
                          }}
                          data-help="death_record.btn_open_correction"
                        >
                          ✏️ {t("Add Correction", "درستگی کا اندراج کریں")}
                        </button>
                      )}
                    </div>

                    {/* Corrections History Table */}
                    {detailData.corrections && detailData.corrections.length > 0 && (
                      <div className="mt-3">
                        <small className="fw-bold d-block mb-1">{t("Correction History (Audit Log)", "درستگیوں کا باضابطہ ریکارڈ")}:</small>
                        <table className="table table-sm table-bordered bg-white mb-0" style={{ fontSize: "0.8rem" }}>
                          <thead>
                            <tr className="table-light">
                              <th>{t("Field", "شعبہ")}</th>
                              <th>{t("Correction", "درستگی")}</th>
                              <th>{t("Reason", "وجہ")}</th>
                              <th>{t("Doctor", "معالج")}</th>
                              <th>{t("Timestamp", "وقت")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.corrections.map((corr) => (
                              <tr key={corr.correction_id}>
                                <td><span className="badge bg-secondary">{corr.field}</span></td>
                                <td>{corr.correction_text}</td>
                                <td>{corr.correction_reason}</td>
                                <td>{corr.corrected_by_name}</td>
                                <td>{corr.created_at ? formatHospitalTime(corr.created_at, tz) : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Action Buttons for Draft */
                  <div className="card bg-light border p-3 d-flex flex-row justify-content-between align-items-center mb-3">
                    <div className="text-muted small">
                      {t("Save work frequently. All mandatory sections must be completed before certification.", "کام کو محفوظ کرتے رہیں۔ تصدیق سے قبل تمام لازمی خانے پر کرنا ضروری ہے۔")}
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={handleSaveDraft}
                        disabled={write.busy}
                        data-help="death_record.btn_save_draft"
                      >
                        💾 {t("Save Draft", "مسودہ محفوظ کریں")}
                      </button>
                      {canRecord && (
                        <button
                          type="button"
                          className="btn btn-success fw-bold"
                          onClick={handleCertify}
                          disabled={write.busy}
                          data-help="death_record.btn_certify"
                        >
                          ✓ {t("Certify Cause of Death", "سبب وفات کی باضابطہ تصدیق کریں")}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Clinical Autopsy Management (MSDS 154) */}
                {!detailData.death.mlc_number && (
                  <div className="card border mb-3">
                    <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
                      <span className="fw-bold small">{t("Clinical Autopsy (MSDS 154)", "کلینیکل آٹوپسی (طبی جائزہ)")}</span>
                      {detailData.autopsy ? (
                        <span className="badge bg-primary">
                          {t("Status", "حالت")}: {detailData.autopsy.status}
                        </span>
                      ) : (
                        canAutopsy && (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => {
                              setValidationErrors({});
                              setAutopsyReqForm({ request_reasons: "" });
                              setAutopsyReqModalOpen(true);
                            }}
                            data-help="death_record.btn_open_autopsy_req"
                          >
                            + {t("Request Clinical Autopsy", "طبی آٹوپسی کی درخواست کریں")}
                          </button>
                        )
                      )}
                    </div>
                    {detailData.autopsy && (
                      <div className="card-body p-3">
                        <div className="row g-2 mb-2">
                          <div className="col-md-6">
                            <small className="text-muted d-block">{t("Requested by", "درخواست کنندہ")}:</small>
                            <span className="fw-bold">{detailData.autopsy.requested_by_name}</span>{" "}
                            <small className="text-muted">({detailData.autopsy.requested_at ? formatHospitalTime(detailData.autopsy.requested_at, tz) : "-"})</small>
                            <div className="small mt-1">
                              <strong>{t("Reasons", "وجوہات")}:</strong> {detailData.autopsy.request_reasons}
                            </div>
                          </div>
                          <div className="col-md-6">
                            {detailData.autopsy.status === "Reported" ? (
                              <div className="bg-light p-2 rounded border">
                                <span className="badge bg-success mb-1">{detailData.autopsy.correlation}</span>
                                <div className="small"><strong>{t("Findings", "نتائج")}:</strong> {detailData.autopsy.findings}</div>
                                <div className="small text-muted">{detailData.autopsy.correlation_note}</div>
                              </div>
                            ) : (
                              canAutopsy && (
                                <div className="d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-success btn-sm"
                                    onClick={() => {
                                      setValidationErrors({});
                                      setAutopsyRepModalOpen(true);
                                    }}
                                    data-help="death_record.btn_open_autopsy_rep"
                                  >
                                    📝 {t("Record Autopsy Report", "آٹوپسی رپورٹ درج کریں")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => {
                                      const reason = window.prompt("Reason for cancelling autopsy:");
                                      if (reason) {
                                        write.start({
                                          path: `/deaths/${detailData.death.death_id}/autopsy/cancel`,
                                          method: "POST",
                                          body: { reason },
                                          permission: "death.record",
                                          protection: "idempotent",
                                          label: "Cancel autopsy request",
                                        });
                                      }
                                    }}
                                    data-help="death_record.btn_cancel_autopsy"
                                  >
                                    {t("Cancel Autopsy", "منسوخ کریں")}
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDetailModalOpen(false)}
                  data-help="death_record.btn_footer_close"
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Death Modal */}
      {recordModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  {t("Record Patient Death", "مریض کی وفات کا اندراج")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setRecordModalOpen(false)}
                  data-help="death_record.btn_close_record_modal"
                />
              </div>
              <div className="modal-body p-3">
                {validationErrors.patient_id && <div className="text-danger small mb-2">{validationErrors.patient_id}</div>}
                {validationErrors.death_at && <div className="text-danger small mb-2">{validationErrors.death_at}</div>}
                {validationErrors.setting && <div className="text-danger small mb-2">{validationErrors.setting}</div>}
                {validationErrors.arrived_at && <div className="text-danger small mb-2">{validationErrors.arrived_at}</div>}

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    {t("Patient ID (System ID)", "مریض کا شناختی نمبر")} <span className="text-danger">*</span>
                  </label>
                  <DirectoryPicker
                    className="form-control form-control-sm"
                    value={recordForm.patient_id || ""}
                    onChange={(e) => setRecordForm({ ...recordForm, patient_id: Number(e.target.value) })}
                    data-help="death_record.input_patient_id"
                   path="/patients/search" idField="patient_id" search />
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    {t("Date & Time of Death", "تاریخ اور وقت وفات")} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control form-control-sm"
                    value={recordForm.death_at || ""}
                    onChange={(e) => setRecordForm({ ...recordForm, death_at: e.target.value })}
                    data-help="death_record.input_death_at"
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    {t("Clinical Setting", "مقام وفات")} <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={recordForm.setting || "Emergency"}
                    onChange={(e) => setRecordForm({ ...recordForm, setting: e.target.value as any })}
                    data-help="death_record.select_setting"
                  >
                    <option value="Emergency">{t("Emergency Department", "ایمرجنسی ڈیپارٹمنٹ")}</option>
                    <option value="Inpatient">{t("Inpatient (Admitted Ward)", "ان ڈور (وارڈ میں داخل)")}</option>
                    <option value="Outpatient">{t("Outpatient (OPD Clinic)", "او پی ڈی کلینک")}</option>
                    <option value="BroughtDead">{t("Brought Dead (Mortuary Intake)", "مردہ حالت میں لایا گیا")}</option>
                  </select>
                </div>

                {recordForm.setting === "BroughtDead" && (
                  <div className="mb-2">
                    <label className="form-label small fw-bold mb-1">
                      {t("Body Arrival Time at Hospital", "ہسپتال پہنچنے کا وقت")} <span className="text-danger">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="form-control form-control-sm"
                      value={recordForm.arrived_at || ""}
                      onChange={(e) => setRecordForm({ ...recordForm, arrived_at: e.target.value })}
                      data-help="death_record.input_arrived_at"
                    />
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">{t("Nature of Death", "موت کی نوعیت")}</label>
                  <select
                    className="form-select form-select-sm"
                    value={recordForm.expected_death ? "true" : "false"}
                    onChange={(e) => setRecordForm({ ...recordForm, expected_death: e.target.value === "true" })}
                    data-help="death_record.select_record_expected"
                  >
                    <option value="true">{t("Expected Death", "متوقع وفات")}</option>
                    <option value="false">{t("Unexpected Death (Triggers Sentinel Alert)", "غیر متوقع وفات")}</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1">{t("Terminal Event", "آخری واقعہ / کیفیت")}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t("e.g. Asystole, refractory ventricular fibrillation", "مثلاً کارڈیو ریسپائریٹری اریسٹ")}
                    value={recordForm.terminal_event || ""}
                    onChange={(e) => setRecordForm({ ...recordForm, terminal_event: e.target.value })}
                    data-help="death_record.input_terminal_event"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRecordModalOpen(false)}
                  data-help="death_record.btn_cancel_record"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold"
                  onClick={handleRecordDeathSubmit}
                  disabled={write.busy}
                  data-help="death_record.btn_submit_record"
                >
                  {t("Declare & Record Death", "موت کا باضابطہ اعلان و اندراج کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Append Correction Modal */}
      {correctionModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title fw-bold text-dark">
                  {t("Append Correction to Certified Death", "مصدقہ ریکارڈ میں درستگی کا اضافہ")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCorrectionModalOpen(false)}
                  data-help="death_record.btn_close_correction"
                />
              </div>
              <div className="modal-body p-3">
                {validationErrors.correction_text && <div className="text-danger small mb-2">{validationErrors.correction_text}</div>}
                {validationErrors.correction_reason && <div className="text-danger small mb-2">{validationErrors.correction_reason}</div>}

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">{t("Section to Correct", "درستگی کا شعبہ")}</label>
                  <select
                    className="form-select form-select-sm"
                    value={correctionForm.field || "general"}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, field: e.target.value as any })}
                    data-help="death_record.select_correction_field"
                  >
                    <option value="cause">{t("Cause of Death", "سبب وفات")}</option>
                    <option value="time">{t("Time of Death", "وقت وفات")}</option>
                    <option value="manner">{t("Manner of Death", "طریقہ وفات")}</option>
                    <option value="external_cause">{t("External Cause", "خارجی اسباب")}</option>
                    <option value="surgery">{t("Recent Surgery", "حالیہ سرجری")}</option>
                    <option value="pregnancy">{t("Pregnancy Information", "حمل کی معلومات")}</option>
                    <option value="infant">{t("Infant / Perinatal", "شیر خوار کی تفصیلات")}</option>
                    <option value="general">{t("General Correction", "عمومی درستگی")}</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">
                    {t("Correction Text", "درستگی کی تفصیل")} <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    placeholder={t("State the factual correction clearly...", "درست معلومات واضح انداز میں درج کریں...")}
                    value={correctionForm.correction_text || ""}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, correction_text: e.target.value })}
                    data-help="death_record.input_correction_text"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">
                    {t("Factual Reason for Correction", "درستگی کی باضابطہ وجہ")} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t("e.g. Subsequent toxicology report or magistrate inquest order", "مثلاً بعد ازاں موصولہ لیب رپورٹ یا عدالتی حکم...")}
                    value={correctionForm.correction_reason || ""}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, correction_reason: e.target.value })}
                    data-help="death_record.input_correction_reason"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCorrectionModalOpen(false)}
                  data-help="death_record.btn_cancel_correction"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-warning btn-sm fw-bold"
                  onClick={handleAppendCorrection}
                  disabled={write.busy}
                  data-help="death_record.btn_submit_correction"
                >
                  {t("Append Immutable Correction", "درستگی ریکارڈ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autopsy Request Modal */}
      {autopsyReqModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  {t("Request Clinical Autopsy (MSDS 154)", "کلینیکل آٹوپسی کی باضابطہ درخواست")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setAutopsyReqModalOpen(false)}
                  data-help="death_record.btn_close_autopsy_req"
                />
              </div>
              <div className="modal-body p-3">
                {validationErrors.request_reasons && <div className="text-danger small mb-2">{validationErrors.request_reasons}</div>}
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">
                    {t("Clinico-pathological Correlation Reasons", "طبی و پیتھالوجیکل تقابل کی وجوہات")} <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder={t("Explain clinical doubts or questions the post-mortem examination should answer...", "طبی شکوک و سوالات جن کی تصدیق پوسٹ مارٹم سے درکار ہے...")}
                    value={autopsyReqForm.request_reasons || ""}
                    onChange={(e) => setAutopsyReqForm({ ...autopsyReqForm, request_reasons: e.target.value })}
                    data-help="death_record.input_autopsy_reasons"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAutopsyReqModalOpen(false)}
                  data-help="death_record.btn_cancel_autopsy_req"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm fw-bold"
                  onClick={handleAutopsyRequestSubmit}
                  disabled={write.busy}
                  data-help="death_record.btn_submit_autopsy_req"
                >
                  {t("Submit Autopsy Request", "درخواست جمع کرائیں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autopsy Report Modal */}
      {autopsyRepModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">
                  {t("Record Autopsy Report", "آٹوپسی رپورٹ کا اندراج")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {if(!scanPending&&!write.blocked)setAutopsyRepModalOpen(false);}}
                  data-help="death_record.btn_close_autopsy_rep"
                />
              </div>
              <div className="modal-body p-3">
      {detailData&&user.permissions.includes('patient.document.upload')&&<ConsentScanUpload key={detailData.death.patient_id} patientId={detailData.death.patient_id} consentNumber={detailData.death.death_number} docType="AutopsyReport" disabled={write.blocked} onPending={setScanPending} onUploaded={v=>setAutopsyDocument({patient_id:v.patient_id,document_id:v.document_id})}/>}
      {autopsyDocument?.patient_id===detailData?.death.patient_id&&<p>{t('This patient’s scan is uploaded and will be attached when you confirm the report.','اس مریض کی اسکین اپ لوڈ ہے؛ رپورٹ کی تصدیق پر منسلک ہو گی۔')}</p>}
                {validationErrors.performed_at && <div className="text-danger small mb-2">{validationErrors.performed_at}</div>}
                {validationErrors.findings && <div className="text-danger small mb-2">{validationErrors.findings}</div>}
                {validationErrors.correlation && <div className="text-danger small mb-2">{validationErrors.correlation}</div>}
                {validationErrors.correlation_note && <div className="text-danger small mb-2">{validationErrors.correlation_note}</div>}

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">{t("Performed At", "وقت معائنہ")}</label>
                  <input
                    type="datetime-local"
                    className="form-control form-control-sm"
                    value={autopsyRepForm.performed_at || ""}
                    onChange={(e) => setAutopsyRepForm({ ...autopsyRepForm, performed_at: e.target.value })}
                    data-help="death_record.input_autopsy_performed_at"
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">{t("Correlation Outcome", "نتائج کا تقابل")}</label>
                  <select
                    className="form-select form-select-sm"
                    value={autopsyRepForm.correlation || "Confirmed"}
                    onChange={(e) => setAutopsyRepForm({ ...autopsyRepForm, correlation: e.target.value as any })}
                    data-help="death_record.select_autopsy_correlation"
                  >
                    <option value="Confirmed">{t("Confirmed (Clinical diagnosis verified)", "تصدیق شدہ (طبی تشخیص درست تھی)")}</option>
                    <option value="MinorDiscrepancy">{t("Minor Discrepancy", "معمولی فرق")}</option>
                    <option value="MajorDiscrepancy">{t("Major Discrepancy", "نمایاں / بڑا فرق")}</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-bold mb-1">{t("Pathological Findings", "پیتھالوجیکل نتائج")}</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    placeholder={t("Detailed gross and microscopic autopsy findings...", "پوسٹ مارٹم کے تفصیلی نتائج...")}
                    value={autopsyRepForm.findings || ""}
                    onChange={(e) => setAutopsyRepForm({ ...autopsyRepForm, findings: e.target.value })}
                    data-help="death_record.input_autopsy_findings"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">{t("Correlation Note", "تقابلی نوٹ")}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t("How findings bear on the certified cause of death...", "یہ نتائج سبب وفات پر کیسے اثر انداز ہوتے ہیں...")}
                    value={autopsyRepForm.correlation_note || ""}
                    onChange={(e) => setAutopsyRepForm({ ...autopsyRepForm, correlation_note: e.target.value })}
                    data-help="death_record.input_autopsy_correlation_note"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {if(!scanPending&&!write.blocked)setAutopsyRepModalOpen(false);}}
                  data-help="death_record.btn_cancel_autopsy_rep"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm fw-bold"
                  onClick={handleAutopsyReportSubmit}
                  disabled={write.blocked||scanPending}
                  data-help="death_record.btn_submit_autopsy_rep"
                >
                  {t("Submit Autopsy Report", "رپورٹ جمع کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ICD Picker Modal */}
      {icdPickerTarget && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h6 className="modal-title fw-bold">
                  {t(`Select ICD Code for Line (${icdPickerTarget.toUpperCase()})`, `آئی سی ڈی کوڈ منتخب کریں`)}
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIcdPickerTarget(null)}
                  data-help="death_record.btn_close_icd_picker"
                />
              </div>
              <div className="modal-body p-3">
                <ICDPicker
                  onPick={(code, term) => {
                    const title = term.title || "";
                    if (icdPickerTarget === "a") {
                      setDraftState((prev) => ({
                        ...prev,
                        cause_a_icd: code,
                        cause_a: prev.cause_a ? prev.cause_a : title,
                      }));
                    } else if (icdPickerTarget === "b") {
                      setDraftState((prev) => ({
                        ...prev,
                        cause_b_icd: code,
                        cause_b: prev.cause_b ? prev.cause_b : title,
                      }));
                    } else if (icdPickerTarget === "c") {
                      setDraftState((prev) => ({
                        ...prev,
                        cause_c_icd: code,
                        cause_c: prev.cause_c ? prev.cause_c : title,
                      }));
                    } else if (icdPickerTarget === "d") {
                      setDraftState((prev) => ({
                        ...prev,
                        cause_d_icd: code,
                        cause_d: prev.cause_d ? prev.cause_d : title,
                      }));
                    }
                    setIcdPickerTarget(null);
                  }}
                />
              </div>
              <div className="modal-footer bg-light py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIcdPickerTarget(null)}
                  data-help="death_record.btn_dismiss_icd_picker"
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal (rule:274cc0ed96) */}
      {printModalOpen && printPayload && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">
                  {t("Print Preview: Death Certificate (A4)", "پیش منظر: ڈیتھ سرٹیفکیٹ (اے 4)")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setPrintModalOpen(false)}
                  data-help="death_record.btn_close_print_modal"
                />
              </div>
              <div className="modal-body p-4 bg-white" style={{ fontFamily: "serif" }}>
                {/* Official Letterhead */}
                <div className="text-center border-bottom pb-3 mb-3">
                  <h4 className="fw-bold m-0">{printPayload.fields.hospital.name}</h4>
                  <div className="small text-muted">{printPayload.fields.hospital.address} | Phone: {printPayload.fields.hospital.phone}</div>
                  {printPayload.fields.hospital.phc_number && (
                    <div className="badge bg-secondary mt-1">PHC Reg: {printPayload.fields.hospital.phc_number}</div>
                  )}
                  <h5 className="fw-bold text-uppercase mt-3 mb-1" style={{ letterSpacing: 1 }}>
                    {t("Medical Certificate of Cause of Death", "میڈیکل سرٹیفکیٹ آف کاز آف ڈیتھ")}
                  </h5>
                  <div className="small text-muted">{printPayload.fields.certificate_number}</div>
                </div>

                {/* Deceased Demographics */}
                <div className="row g-2 mb-3 small border-bottom pb-2">
                  <div className="col-6">
                    <strong>{t("Deceased Name", "نام متوفی")}:</strong> {printPayload.fields.patient.full_name}
                  </div>
                  <div className="col-6">
                    <strong>MRN:</strong> {printPayload.fields.patient.mrn}
                  </div>
                  <div className="col-6">
                    <strong>{t("Age / Gender", "عمر / جنس")}:</strong> {printPayload.fields.patient.age_at_death_years}y / {printPayload.fields.patient.gender}
                  </div>
                  <div className="col-6">
                    <strong>CNIC:</strong> {printPayload.fields.patient.cnic || "N/A"}
                  </div>
                  <div className="col-6">
                    <strong>{t("Date & Time of Death", "تاریخ و وقت وفات")}:</strong> {printPayload.fields.death.death_at ? formatHospitalTime(printPayload.fields.death.death_at, tz) : "-"}
                  </div>
                  <div className="col-6">
                    <strong>{t("Manner of Death", "طریقہ وفات")}:</strong> {printPayload.fields.death.manner || "Unknown"}
                  </div>
                </div>

                {/* WHO Form Tables */}
                <h6 className="fw-bold border-bottom pb-1 mb-2">{t("Cause of Death (WHO International Standard)", "سبب وفات (بین الاقوامی معیار)")}</h6>
                <table className="table table-sm table-bordered mb-3 small">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "15%" }}>{t("Part", "حصہ")}</th>
                      <th style={{ width: "55%" }}>{t("Conditions Leading to Death", "بیماری یا کیفیت")}</th>
                      <th style={{ width: "15%" }}>{t("Interval", "وقفہ")}</th>
                      <th style={{ width: "15%" }}>{t("ICD", "کوڈ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Part I (a)</strong></td>
                      <td>{printPayload.fields.death.cause_a || "-"}</td>
                      <td>{printPayload.fields.death.cause_a_interval || "-"}</td>
                      <td>{printPayload.fields.death.cause_a_icd || "-"}</td>
                    </tr>
                    <tr>
                      <td><strong>Part I (b)</strong></td>
                      <td>{printPayload.fields.death.cause_b || "-"}</td>
                      <td>{printPayload.fields.death.cause_b_interval || "-"}</td>
                      <td>{printPayload.fields.death.cause_b_icd || "-"}</td>
                    </tr>
                    <tr>
                      <td><strong>Part I (c)</strong></td>
                      <td>{printPayload.fields.death.cause_c || "-"}</td>
                      <td>{printPayload.fields.death.cause_c_interval || "-"}</td>
                      <td>{printPayload.fields.death.cause_c_icd || "-"}</td>
                    </tr>
                    <tr>
                      <td><strong>Part I (d)</strong></td>
                      <td>{printPayload.fields.death.cause_d || "-"}</td>
                      <td>{printPayload.fields.death.cause_d_interval || "-"}</td>
                      <td>{printPayload.fields.death.cause_d_icd || "-"}</td>
                    </tr>
                    <tr className="table-light">
                      <td><strong>Part II</strong></td>
                      <td colSpan={3}>{printPayload.fields.death.other_conditions || t("None recorded", "کوئی اضافی بیماری درج نہیں")}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Underlying Cause Summary */}
                <div className="p-2 bg-light border rounded mb-4 small">
                  <strong>{t("Certified Underlying Cause", "بنیادی وجہ وفات")}:</strong> {printPayload.fields.death.underlying_cause || "Not determined"} {printPayload.fields.death.underlying_icd && `[${printPayload.fields.death.underlying_icd}]`}
                </div>

                {/* Certifier Stamp */}
                <div className="row g-2 mt-4 pt-3 border-top">
                  <div className="col-6">
                    <div className="small text-muted">{printPayload.fields.hospital.issue_line || "Official Certificate of the Government of Punjab"}</div>
                  </div>
                  <div className="col-6 text-end">
                    <div className="fw-bold">{printPayload.fields.death.certifier_name || printPayload.fields.death.pronounced_by_name}</div>
                    <div className="small text-muted">{printPayload.fields.death.certifier_designation || "Medical Officer / Attending Physician"}</div>
                    <div className="small text-muted">{printPayload.fields.death.certifier_license ? `PMDC: ${printPayload.fields.death.certifier_license}` : "PMDC Registered"}</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPrintModalOpen(false)}
                  data-help="death_record.btn_footer_close_print"
                >
                  {t("Close", "بند کریں")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  data-help="death_record.btn_print_action"
                >
                  🖨️ {t("Print / Save as PDF", "پرنٹ کریں / پی ڈی ایف محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeathRecord;
