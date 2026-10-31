import React, { useEffect, useState } from "react";
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
  DischargeSummaryViewOut,
  DischargeSummaryOut,
  DischargeSummaryIn,
  SummaryCorrectionIn,
  IcdSearchItemOut,
  IcdTermOut,
} from "../generated/discharge_summary";
import {
  getDischargeSummary,
  saveDischargeSummary,
  signDischargeSummary,
  dischargeSummaryPrint,
  searchIcdCodes,
} from "../generated/discharge_summary";
import {
  evaluateDischargeSummaryView,
  canEditDischargeSummary,
  canSignDischargeSummary,
  canViewDischargeSummary,
  getRequiredFieldsForOutcome,
  evaluateMissingSummaryFields,
  validateSummaryCorrectionInput,
  explainDischargeSummaryError,
  type DischargeOutcome,
  type DischargeCondition,
} from "../discharge-summary-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";
import { call } from "../bridge";

export interface DischargeSummaryProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialAdmissionId?: number;
  onNavigateScreen?: (screen: string, contextId?: number) => void;
  onBack?: () => void;
}

export function DischargeSummary({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  timeZone,
  initialAdmissionId,
  onNavigateScreen,
  onBack,
}: DischargeSummaryProps) {
  const [est, setEst] = useState<EstablishmentOut>(propEstablishment);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  const viewPolicy = evaluateDischargeSummaryView(est);
  const permissions = {
    canEdit: canEditDischargeSummary(user) && viewPolicy.canDraft,
    canSign: canSignDischargeSummary(user) && viewPolicy.canSign,
    canCorrect: canEditDischargeSummary(user) && viewPolicy.canCorrect,
    canView: canViewDischargeSummary(user) && viewPolicy.canPrint,
  };

  // Admission context
  const [searchAdmissionInput, setSearchAdmissionInput] = useState<string>(
    initialAdmissionId ? String(initialAdmissionId) : ""
  );
  const [activeAdmissionId, setActiveAdmissionId] = useState<number | null>(
    initialAdmissionId || null
  );
  const [revision, setRevision] = useState<number>(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form State
  const [outcome, setOutcome] = useState<DischargeOutcome | "">("");
  const [conditionAtDischarge, setConditionAtDischarge] = useState<DischargeCondition | "">("");
  const [reasonForAdmission, setReasonForAdmission] = useState<string>("");
  const [finalDiagnosis, setFinalDiagnosis] = useState<string>("");
  const [selectedIcdCodes, setSelectedIcdCodes] = useState<string[]>([]);
  const [selectedIcdTerms, setSelectedIcdTerms] = useState<IcdTermOut[]>([]);
  const [significantFindings, setSignificantFindings] = useState<string>("");
  const [proceduresAndTreatment, setProceduresAndTreatment] = useState<string>("");
  const [responseToTreatment, setResponseToTreatment] = useState<string>("");
  const [dischargeMedications, setDischargeMedications] = useState<string>("");
  const [followUpInstructions, setFollowUpInstructions] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [receivingHospital, setReceivingHospital] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("");
  const [transferArrangements, setTransferArrangements] = useState<string>("");
  const [outcomeNote, setOutcomeNote] = useState<string>("");
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);

  // Field validation highlighting (rule:b6ad13f99c)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Correction Modal State (rule:6ac70d5b94)
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionField, setCorrectionField] = useState<string>("general");
  const [correctionText, setCorrectionText] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [correctionErrors, setCorrectionErrors] = useState<Record<string, string>>({});

  // ICD Search Modal State (rule:73f0bf7236)
  const [showIcdModal, setShowIcdModal] = useState<boolean>(false);
  const [icdQuery, setIcdQuery] = useState<string>("");
  const [icdResults, setIcdResults] = useState<IcdSearchItemOut[]>([]);
  const [icdLoading, setIcdLoading] = useState<boolean>(false);
  const [icdError, setIcdError] = useState<string | null>(null);

  // Write controller
  const write = useClinicalWrite(user, "discharge_summary", () => {
    setRevision((r) => r + 1);
  });

  // Load summary view from server
  const summaryLoad = useLoad<DischargeSummaryViewOut | null>(
    async () => {
      if (!activeAdmissionId || !permissions.canView) return null;
      return await getDischargeSummary(activeAdmissionId);
    },
    [activeAdmissionId, revision, permissions.canView]
  );

  // Sync draft data when loaded
  useEffect(() => {
    if (summaryLoad.data) {
      const { summary, suggested, missing } = summaryLoad.data;
      if (summary) {
        setOutcome(summary.outcome || "");
        setConditionAtDischarge(summary.condition_at_discharge || "");
        setReasonForAdmission(summary.reason_for_admission || "");
        setFinalDiagnosis(summary.final_diagnosis || "");
        setSelectedIcdCodes(summary.icd_codes || []);
        setSelectedIcdTerms(summary.icd_terms || []);
        setSignificantFindings(summary.significant_findings || "");
        setProceduresAndTreatment(summary.procedures_and_treatment || "");
        setResponseToTreatment(summary.response_to_treatment || "");
        setDischargeMedications(summary.discharge_medications || "");
        setFollowUpInstructions(summary.follow_up_instructions || "");
        setFollowUpDate(summary.follow_up_date || "");
        setReceivingHospital(summary.receiving_hospital || "");
        setTransferReason(summary.transfer_reason || "");
        setTransferArrangements(summary.transfer_arrangements || "");
        setOutcomeNote(summary.outcome_note || "");
        setExpectedVersion(summary.row_version);
      } else {
        // Fresh draft: if suggested has Died outcome, set it
        if (suggested?.outcome) {
          setOutcome(suggested.outcome);
        }
        setExpectedVersion(null);
      }
      setMissingFields(missing || []);
    }
  }, [summaryLoad.data]);

  // Handle Admission Search
  const handleLoadAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(searchAdmissionInput.trim());
    if (id > 0) {
      setActiveAdmissionId(id);
      setFieldErrors({});
      setMissingFields([]);
      setActionNotice(null);
    }
  };

  // Helper to construct current draft payload
  const buildDraftPayload = (): DischargeSummaryIn => {
    return {
      outcome: outcome ? (outcome as DischargeOutcome) : null,
      condition_at_discharge: conditionAtDischarge ? (conditionAtDischarge as DischargeCondition) : null,
      reason_for_admission: reasonForAdmission.trim() || null,
      final_diagnosis: finalDiagnosis.trim() || null,
      icd_codes: selectedIcdCodes,
      significant_findings: significantFindings.trim() || null,
      procedures_and_treatment: proceduresAndTreatment.trim() || null,
      response_to_treatment: responseToTreatment.trim() || null,
      discharge_medications: dischargeMedications.trim() || null,
      follow_up_instructions: followUpInstructions.trim() || null,
      follow_up_date: followUpDate || null,
      receiving_hospital: receivingHospital.trim() || null,
      transfer_reason: transferReason.trim() || null,
      transfer_arrangements: transferArrangements.trim() || null,
      outcome_note: outcomeNote.trim() || null,
      expected_version: expectedVersion,
    };
  };

  // Handle Save Draft (PUT /admissions/{admission_id}/discharge-summary)
  const handleSaveDraft = async () => {
    if (!activeAdmissionId) return;
    const payload = buildDraftPayload();

    write.start({
      path: `/admissions/${activeAdmissionId}/discharge-summary`,
      method: "PUT",
      body: payload,
      permission: "ipd.discharge.summary.edit",
      protection: "idempotent",
      label: t("Save Discharge Summary Draft", "ڈسچارج سمری کا مسودہ محفوظ کریں"),
    });
  };

  // Handle Sign (POST /admissions/{admission_id}/discharge-summary/sign)
  const handleSignSummary = async () => {
    if (!activeAdmissionId) return;

    // Client-side preflight check (rule:6ac70d5b94)
    const payload = buildDraftPayload();
    const check = evaluateMissingSummaryFields(
      payload,
      summaryLoad.data?.suggested?.outcome
    );

    if (!check.canAttemptSign) {
      setFieldErrors(check.fieldErrors);
      setMissingFields(check.missing);
      return;
    }
    setFieldErrors({});

    // First ensure draft is saved
    try {
      await saveDischargeSummary(activeAdmissionId, payload);
    } catch {
      // Proceed to sign which will report server validation if any
    }

    write.start({
      path: `/admissions/${activeAdmissionId}/discharge-summary/sign`,
      method: "POST",
      body: { expected_version: expectedVersion },
      permission: "ipd.discharge.summary.sign",
      protection: "idempotent",
      label: t("Sign and Finalize Discharge Summary", "ڈسچارج سمری پر دستخط اور تصدیق کریں"),
    });
  };

  // Handle Print A4 Summary (rule:a8b60a1d88)
  const handlePrintA4 = async () => {
    if (!activeAdmissionId) return;
    try {
      const payload = await dischargeSummaryPrint(activeAdmissionId);
      await call("clinical-print", {
        role: "document",
        payload,
      });
      setActionNotice(t("Discharge summary sent to document printer.", "ڈسچارج سمری پرنٹر کو بھیج دی گئی ہے۔"));
    } catch (err: any) {
      setActionNotice(t(`Print failed: ${err?.message || "Check document printer"}`, `پرنٹ نا کام: ${err?.message}`));
    }
  };

  // Handle Download PDF (rule:a8b60a1d88)
  const handleDownloadPdf = async () => {
    if (!activeAdmissionId) return;
    try {
      await call("clinical-pdf", {
        path: `/admissions/${activeAdmissionId}/discharge-summary/pdf`,
      });
      setActionNotice(t("PDF opened / downloaded.", "پی ڈی ایف کھل گیا ہے۔"));
    } catch (err: any) {
      setActionNotice(t(`PDF failed: ${err?.message}`, `پی ڈی ایف نا کام: ${err?.message}`));
    }
  };

  // Handle Append Correction (rule:6ac70d5b94)
  const handleConfirmCorrection = async () => {
    if (!activeAdmissionId) return;

    const validation = validateSummaryCorrectionInput({
      field: correctionField,
      correction_text: correctionText,
      correction_reason: correctionReason,
    });

    if (!validation.valid) {
      setCorrectionErrors(validation.errors);
      return;
    }
    setCorrectionErrors({});

    const payload: SummaryCorrectionIn = {
      field: correctionField as any,
      correction_text: correctionText.trim(),
      correction_reason: correctionReason.trim(),
    };

    write.start({
      path: `/admissions/${activeAdmissionId}/discharge-summary/corrections`,
      method: "POST",
      body: payload,
      permission: "ipd.discharge.summary.edit",
      protection: "idempotent",
      label: t("Add Official Summary Correction", "سرکاری تصحیح شامل کریں"),
    });

    setShowCorrectionModal(false);
    setCorrectionText("");
    setCorrectionReason("");
  };

  // Handle ICD Search (rule:73f0bf7236)
  const handleSearchIcd = async () => {
    if (!icdQuery.trim()) return;
    setIcdLoading(true);
    setIcdError(null);
    try {
      const res = await searchIcdCodes({ q: icdQuery.trim(), limit: 15 });
      setIcdResults(res.items || []);
    } catch (err: any) {
      setIcdError(err?.message || "Failed to search ICD classification.");
    } finally {
      setIcdLoading(false);
    }
  };

  const handleSelectIcdCode = (item: IcdSearchItemOut) => {
    if (!selectedIcdCodes.includes(item.code)) {
      setSelectedIcdCodes([...selectedIcdCodes, item.code]);
      setSelectedIcdTerms([
        ...selectedIcdTerms,
        {
          code: item.code,
          system: "ICD-11",
          title: item.title,
          uri: item.uri,
        },
      ]);
    }
    setShowIcdModal(false);
  };

  const handleRemoveIcdCode = (codeToRemove: string) => {
    setSelectedIcdCodes(selectedIcdCodes.filter((c) => c !== codeToRemove));
    setSelectedIcdTerms(selectedIcdTerms.filter((t) => t.code !== codeToRemove));
  };

  const currentSummary = summaryLoad.data?.summary || null;
  const currentAdmission = summaryLoad.data?.admission || null;
  const suggestions = summaryLoad.data?.suggested || null;
  const corrections = summaryLoad.data?.corrections || [];
  const isFinal = currentSummary?.status === "Final";
  const requiredFields = getRequiredFieldsForOutcome(outcome as DischargeOutcome);

  return (
    <div className="discharge-summary-screen container" data-help="discharge_summary.root">
      {/* Header */}
      <div className="screen-header mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="h2 mb-1" data-help="discharge_summary.header">
              {t("Discharge Summary & Referral Slip", "ڈسچارج سمری اور ریفرل سلپ")}
            </h1>
            <p className="text-muted mb-0">
              {t(
                "Write, sign, and print the clinical discharge summary under MSDS IMS 147 before patient leaves.",
                "مریض کی رخصتی سے قبل ایم ایس ڈی ایس آئی ایم ایس 147 کے تحت کلینیکل سمری مکمل، تصدیق اور پرنٹ کریں۔"
              )}
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            {onBack && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                data-help="discharge_summary.back"
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

        {/* View Policy Service Banner (rule:ca1992cc8d) */}
        {viewPolicy.bannerMessage && (
          <div
            className={`alert ${viewPolicy.view === "open_work" ? "alert-warning" : "alert-info"} mt-3 mb-0`}
            role="alert"
            data-help="discharge_summary.service_banner"
          >
            <strong>{viewPolicy.bannerMessage}</strong>
          </div>
        )}

        {/* Action Notice */}
        {actionNotice && (
          <div
            className="alert alert-info alert-dismissible fade show mt-2 mb-0 d-flex justify-content-between"
            role="alert"
          >
            <span>{actionNotice}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              data-help="discharge_summary.btn_dismiss_notice"
              onClick={() => setActionNotice(null)}
            ></button>
          </div>
        )}
      </div>

      {/* Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* Admission Search Card */}
      <div className="card mb-3 p-3 bg-light border">
        <form onSubmit={handleLoadAdmission} className="row g-2 align-items-center">
          <div className="col-auto">
            <label htmlFor="admSearch" className="col-form-label fw-bold">
              {t("Inpatient Admission ID:", "داخلہ نمبر:")}
            </label>
          </div>
          <div className="col-auto">
            <input
              id="admSearch"
              type="number"
              min="1"
              className="form-control form-control-sm"
              placeholder="e.g. 1"
              data-help="discharge_summary.search_admission"
              value={searchAdmissionInput}
              onChange={(e) => setSearchAdmissionInput(e.target.value)}
            />
          </div>
          <div className="col-auto">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              data-help="discharge_summary.search_btn"
              disabled={summaryLoad.loading || !searchAdmissionInput.trim()}
            >
              {summaryLoad.loading ? t("Loading...", "لوڈ ہو رہا ہے...") : t("Load Summary", "سمری کھولیں")}
            </button>
          </div>
        </form>
      </div>

      <LoadState
        loading={summaryLoad.loading}
        error={summaryLoad.error ? String(summaryLoad.error) : null}
        retry={summaryLoad.reload}
      />

      {/* Patient & Admission Context Card */}
      {currentAdmission && (
        <div className="card mb-3 p-3 shadow-sm border border-primary-subtle bg-light">
          <div className="row g-2">
            <div className="col-md-3">
              <span className="text-muted small">{t("Patient Name:", "مریض کا نام:")}</span>
              <div className="fw-bold fs-6">{currentAdmission.patient_name}</div>
            </div>
            <div className="col-md-2">
              <span className="text-muted small">{t("MRN:", "ایم آر این:")}</span>
              <div className="fw-bold">{currentAdmission.mrn}</div>
            </div>
            <div className="col-md-2">
              <span className="text-muted small">{t("Ward & Bed:", "وارڈ اور بستر:")}</span>
              <div>
                <strong>{currentAdmission.ward_name || "-"}</strong> ({currentAdmission.bed_label || "-"})
              </div>
            </div>
            <div className="col-md-3">
              <span className="text-muted small">{t("Primary Doctor:", "معالج:")}</span>
              <div>{currentAdmission.primary_doctor_name || "-"}</div>
            </div>
            <div className="col-md-2 text-end">
              <span
                className={`badge fs-6 ${
                  isFinal ? "bg-success" : "bg-warning text-dark"
                }`}
              >
                {isFinal ? t("Signed / Final", "حتمی / دستخط شدہ") : t("Draft", "مسودہ")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Signed Author Stamp Notice (MSDS IMS 147) */}
      {isFinal && currentSummary && (
        <div className="alert alert-success d-flex align-items-center mb-3 py-2">
          <div className="me-2 fs-4">🖋️</div>
          <div>
            <strong>{t("Final Clinical Record Signed:", "حتمی کلینیکل ریکارڈ تصدیق شدہ:")}</strong>{" "}
            {t("Signed by", "دستخط کنندہ")} <strong>{currentSummary.signer_name || currentSummary.created_by_name}</strong>
            {currentSummary.signer_designation ? ` (${currentSummary.signer_designation})` : ""}
            {currentSummary.signer_license ? ` [${currentSummary.signer_license}]` : ""}{" "}
            {t("at", "بوقت")}{" "}
            {formatHospitalTime(currentSummary.signed_at || currentSummary.created_at, timeZone || "Asia/Karachi")}.
            <div className="small text-muted">
              {t(
                "Permanent clinical record frozen under MSDS IMS 147. Direct edits disabled; use 'Add Correction' for addenda.",
                "مستقل کلینیکل ریکارڈ منجمد ہے۔ براہ راست تبدیلی بند ہے؛ اضافی معلومات کے لیے 'تصحیح شامل کریں' استعمال کریں۔"
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Form Warnings (rule:6ac70d5b94) */}
      {missingFields.length > 0 && !isFinal && (
        <div className="alert alert-danger py-2 mb-3">
          <strong>⚠️ {t("Required Summary Information Missing:", "لازمی معلومات نامکمل ہیں:")}</strong>
          <ul className="mb-0 small ps-3">
            {missingFields.map((f) => (
              <li key={f}>
                {f.replace(/_/g, " ").toUpperCase()} ({t("Required before signing", "دستخط سے پہلے ضروری")})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Discharge Form */}
      {activeAdmissionId && (
        <div className="card p-3 shadow-sm border mb-4">
          {/* SECTION 1: OUTCOME & CONDITION (rule:b6ad13f99c) */}
          <div className="row g-3 mb-3 border-bottom pb-3">
            <div className="col-md-6">
              <label className="form-label fw-bold">
                {t("Discharge Outcome (rule:b6ad13f99c):", "ڈسچارج کا نتیجہ:")} <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${fieldErrors.outcome ? "is-invalid" : ""}`}
                data-help="discharge_summary.outcome_select"
                value={outcome}
                disabled={isFinal || suggestions?.outcome === "Died"}
                onChange={(e) => {
                  setOutcome(e.target.value as DischargeOutcome);
                  setFieldErrors({});
                }}
              >
                <option value="">{t("-- Select Outcome First --", "-- پہلے نتیجہ منتخب کریں --")}</option>
                <option value="Home">{t("Home (Routine Discharge)", "گھر (معمول کا ڈسچارج)")}</option>
                <option value="Transferred">{t("Transferred (Referral to Another Facility)", "منتقلی (دیگر ہسپتال ریفرل)")}</option>
                <option value="LAMA">{t("LAMA (Left Against Medical Advice)", "لاما (بغیر طبی اجازت رخصت)")}</option>
                <option value="Absconded">{t("Absconded (Left Without Notice)", "بغیر بتائے فرار / لاپتہ)")}</option>
                <option value="Died">{t("Died (Inpatient Death)", "وفات (دورانِ داخلہ)")}</option>
              </select>
              {fieldErrors.outcome && <div className="invalid-feedback">{fieldErrors.outcome}</div>}
              {suggestions?.outcome === "Died" && (
                <div className="form-text text-danger">
                  {t(
                    "Death recorded on this admission. Outcome locked to Died (rule:a0859fbcc9).",
                    "اس داخلے پر موت درج ہے۔ نتیجہ 'Died' پر لاک ہے (قاعدہ a0859fbcc9)۔"
                  )}
                </div>
              )}
            </div>

            {outcome !== "Died" && outcome !== "Absconded" && (
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  {t("Condition at Discharge:", "ڈسچارج کے وقت حالت:")}{" "}
                  {requiredFields.includes("condition_at_discharge") && <span className="text-danger">*</span>}
                </label>
                <select
                  className={`form-select ${fieldErrors.condition_at_discharge ? "is-invalid" : ""}`}
                  data-help="discharge_summary.condition_select"
                  value={conditionAtDischarge}
                  disabled={isFinal}
                  onChange={(e) => setConditionAtDischarge(e.target.value as DischargeCondition)}
                >
                  <option value="">{t("-- Select Condition --", "-- حالت منتخب کریں --")}</option>
                  <option value="Recovered">{t("Recovered (مکمل صحت یاب)", "Recovered (مکمل صحت یاب)")}</option>
                  <option value="Improved">{t("Improved (بہتر)", "Improved (بہتر)")}</option>
                  <option value="Unchanged">{t("Unchanged (غیر تبدیل شدہ)", "Unchanged (غیر تبدیل شدہ)")}</option>
                  <option value="Deteriorated">{t("Deteriorated (بگڑتی ہوئی)", "Deteriorated (بگڑتی ہوئی)")}</option>
                </select>
                {fieldErrors.condition_at_discharge && (
                  <div className="invalid-feedback">{fieldErrors.condition_at_discharge}</div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: ADMISSION REASON & FINAL DIAGNOSIS */}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-bold mb-0">
                  {t("Reason for Admission:", "داخلے کی وجہ:")} <span className="text-danger">*</span>
                </label>
                {!isFinal && suggestions?.reason_for_admission && !reasonForAdmission && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    data-help="discharge_summary.suggest_admission_reason"
                    onClick={() => setReasonForAdmission(suggestions.reason_for_admission || "")}
                  >
                    + {t("Use suggestion", "تجویز کردہ درج کریں")}
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                className={`form-control form-control-sm ${
                  fieldErrors.reason_for_admission ? "is-invalid" : ""
                }`}
                data-help="discharge_summary.admission_reason_input"
                value={reasonForAdmission}
                disabled={isFinal}
                onChange={(e) => setReasonForAdmission(e.target.value)}
              />
              {fieldErrors.reason_for_admission && (
                <div className="invalid-feedback">{fieldErrors.reason_for_admission}</div>
              )}
            </div>

            <div className="col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-bold mb-0">
                  {t("Final Clinical Diagnosis:", "حتمی تشخیص:")} <span className="text-danger">*</span>
                </label>
                {!isFinal && suggestions?.final_diagnosis && !finalDiagnosis && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    data-help="discharge_summary.suggest_final_diagnosis"
                    onClick={() => setFinalDiagnosis(suggestions.final_diagnosis || "")}
                  >
                    + {t("Use suggestion", "تجویز کردہ درج کریں")}
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                className={`form-control form-control-sm ${
                  fieldErrors.final_diagnosis ? "is-invalid" : ""
                }`}
                data-help="discharge_summary.final_diagnosis_input"
                value={finalDiagnosis}
                disabled={isFinal}
                onChange={(e) => setFinalDiagnosis(e.target.value)}
              />
              {fieldErrors.final_diagnosis && (
                <div className="invalid-feedback">{fieldErrors.final_diagnosis}</div>
              )}
            </div>
          </div>

          {/* SECTION 3: ICD-11 / ICD-10 DIAGNOSIS CODES (rule:73f0bf7236) */}
          <div className="mb-3 p-2 bg-light border rounded">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">{t("ICD Diagnosis Codes (ICD-11 / ICD-10):", "آئی سی ڈی تشخیص کوڈز:")}</span>
              {!isFinal && (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  data-help="discharge_summary.open_icd_picker"
                  onClick={() => {
                    setShowIcdModal(true);
                    setIcdQuery("");
                    setIcdResults([]);
                  }}
                >
                  🔍 {t("Search ICD Code", "آئی سی ڈی کوڈ تلاش کریں")}
                </button>
              )}
            </div>

            {/* Selected ICD chips */}
            <div className="d-flex flex-wrap gap-2 mb-2">
              {selectedIcdCodes.length === 0 ? (
                <span className="text-muted small">
                  {t("No ICD codes selected.", "کوئی آئی سی ڈی کوڈ منتخب نہیں۔")}
                </span>
              ) : (
                selectedIcdCodes.map((code) => {
                  const term = selectedIcdTerms.find((t) => t.code === code);
                  return (
                    <span key={code} className="badge bg-secondary p-2 d-flex align-items-center gap-1">
                      <code>{code}</code> {term?.title ? `— ${term.title}` : ""}
                      {!isFinal && (
                        <button
                          type="button"
                          className="btn-close btn-close-white ms-1"
                          style={{ fontSize: "0.5rem" }}
                          aria-label="Remove code"
                          data-help="discharge_summary.remove_icd_chip"
                          onClick={() => handleRemoveIcdCode(code)}
                        ></button>
                      )}
                    </span>
                  );
                })
              )}
            </div>

            {/* Suggested ICD Chips (rule:73f0bf7236) */}
            {!isFinal && suggestions?.icd_terms && suggestions.icd_terms.length > 0 && (
              <div className="border-top pt-2">
                <span className="small text-muted me-2">{t("Stay Note Suggestions:", "نوٹس سے تجاویز:")}</span>
                {suggestions.icd_terms.map((term) => (
                  <button
                    key={term.code}
                    type="button"
                    className="btn btn-outline-secondary btn-sm me-1 mb-1"
                    data-help="discharge_summary.suggest_icd_chip"
                    onClick={() => {
                      if (!selectedIcdCodes.includes(term.code)) {
                        setSelectedIcdCodes([...selectedIcdCodes, term.code]);
                        setSelectedIcdTerms([...selectedIcdTerms, term]);
                      }
                    }}
                  >
                    + {term.code}: {term.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: SIGNIFICANT FINDINGS & PROCEDURES */}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-bold mb-0">
                  {t("Significant Findings (Labs & Imaging):", "اہم نتائج (لیب اور ریڈیالوجی):")}
                </label>
                {!isFinal && suggestions?.significant_findings && !significantFindings && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    data-help="discharge_summary.suggest_findings"
                    onClick={() => setSignificantFindings(suggestions.significant_findings || "")}
                  >
                    + {t("Use suggestion", "تجویز کردہ نتائج")}
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                className="form-control form-control-sm"
                data-help="discharge_summary.findings_input"
                placeholder={t("Abnormal test findings, imaging conclusions...", "اہم لیب نتائج، ایکسرے یا الٹراساؤنڈ کی رپورٹ...")}
                value={significantFindings}
                disabled={isFinal}
                onChange={(e) => setSignificantFindings(e.target.value)}
              />
            </div>

            <div className="col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-bold mb-0">
                  {t("Procedures & Inpatient Treatment:", "علاج اور سرجیکل کارروائی:")}{" "}
                  {requiredFields.includes("procedures_and_treatment") && <span className="text-danger">*</span>}
                </label>
                {!isFinal && suggestions?.procedures_and_treatment && !proceduresAndTreatment && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    data-help="discharge_summary.suggest_procedures"
                    onClick={() => setProceduresAndTreatment(suggestions.procedures_and_treatment || "")}
                  >
                    + {t("Use suggestion", "تجویز کردہ علاج")}
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                className={`form-control form-control-sm ${
                  fieldErrors.procedures_and_treatment ? "is-invalid" : ""
                }`}
                data-help="discharge_summary.procedures_input"
                placeholder={t("Operations, MAR administered doses, blood transfusions...", "آپریشن، وارڈ میں دی گئی ادویات، خون کی منتقلی...")}
                value={proceduresAndTreatment}
                disabled={isFinal}
                onChange={(e) => setProceduresAndTreatment(e.target.value)}
              />
              {fieldErrors.procedures_and_treatment && (
                <div className="invalid-feedback">{fieldErrors.procedures_and_treatment}</div>
              )}
            </div>
          </div>

          {/* Response to Treatment */}
          <div className="mb-3">
            <label className="form-label fw-bold">
              {t("Response to Inpatient Treatment:", "علاج کا ردعمل اور پیش رفت:")}
            </label>
            <textarea
              rows={2}
              className="form-control form-control-sm"
              data-help="discharge_summary.response_treatment_input"
              placeholder={t("Clinical response, fever resolution, wound healing...", "طبی بہتری، بخار کا خاتمہ، زخم کا مندمل ہونا...")}
              value={responseToTreatment}
              disabled={isFinal}
              onChange={(e) => setResponseToTreatment(e.target.value)}
            />
          </div>

          {/* SECTION 5: DISCHARGE MEDICATIONS & FOLLOW-UP (When not Died) */}
          {outcome !== "Died" && (
            <div className="row g-3 mb-3 border-top pt-3">
              <div className="col-md-6">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-bold mb-0">
                    {t("Discharge Medications (Take-Home Rx):", "رخصتی ادویات (نسخہ):")}{" "}
                    {requiredFields.includes("discharge_medications") && <span className="text-danger">*</span>}
                  </label>
                  {!isFinal && suggestions?.discharge_medications && !dischargeMedications && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0"
                      data-help="discharge_summary.suggest_medications"
                      onClick={() => setDischargeMedications(suggestions.discharge_medications || "")}
                    >
                      + {t("Use suggestion", "تجویز کردہ ادویات")}
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  className={`form-control form-control-sm ${
                    fieldErrors.discharge_medications ? "is-invalid" : ""
                  }`}
                  data-help="discharge_summary.medications_input"
                  placeholder={t(
                    "List take-home drugs, dose, route, frequency, and duration. Write 'None' if nothing prescribed...",
                    "ادویات، خوراک اور دورانیہ درج کریں۔ اگر کوئی دوا نہیں تو 'None' لکھیں..."
                  )}
                  value={dischargeMedications}
                  disabled={isFinal}
                  onChange={(e) => setDischargeMedications(e.target.value)}
                />
                {fieldErrors.discharge_medications && (
                  <div className="invalid-feedback">{fieldErrors.discharge_medications}</div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold">
                  {t("Follow-up Instructions & Date:", "فالو اپ ہدایات اور تاریخ:")}{" "}
                  {requiredFields.includes("follow_up_instructions") && <span className="text-danger">*</span>}
                </label>
                <textarea
                  rows={2}
                  className={`form-control form-control-sm mb-2 ${
                    fieldErrors.follow_up_instructions ? "is-invalid" : ""
                  }`}
                  data-help="discharge_summary.followup_instructions_input"
                  placeholder={t("Diet, activity, wound care, emergency warning signs...", "خوراک، پرہیز، زخم کی دیکھ بھال، ایمرجنسی علامات...")}
                  value={followUpInstructions}
                  disabled={isFinal}
                  onChange={(e) => setFollowUpInstructions(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control form-control-sm"
                  data-help="discharge_summary.followup_date_input"
                  value={followUpDate}
                  disabled={isFinal}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
                {fieldErrors.follow_up_instructions && (
                  <div className="invalid-feedback d-block">{fieldErrors.follow_up_instructions}</div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 6: TRANSFERRED REFERRAL SLIP FIELDS (rule:a0859fbcc9) */}
          {outcome === "Transferred" && (
            <div className="p-3 bg-light border border-info rounded mb-3">
              <h6 className="fw-bold text-primary mb-2">
                📋 {t("Transfer & Referral Slip Arrangements (rule:a0859fbcc9)", "منتقلی اور ریفرل سلپ انتظامات")}
              </h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    {t("Receiving Hospital:", "وصول کنندہ ہسپتال:")} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control form-control-sm ${
                      fieldErrors.receiving_hospital ? "is-invalid" : ""
                    }`}
                    data-help="discharge_summary.receiving_hospital_input"
                    placeholder={t("Name of receiving tertiary hospital...", "منتقلی والے ہسپتال کا نام...")}
                    value={receivingHospital}
                    disabled={isFinal}
                    onChange={(e) => setReceivingHospital(e.target.value)}
                  />
                  {fieldErrors.receiving_hospital && (
                    <div className="invalid-feedback">{fieldErrors.receiving_hospital}</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    {t("Reason for Transfer:", "منتقلی کی طبی وجہ:")} <span className="text-danger">*</span>
                  </label>
                  <textarea
                    rows={2}
                    className={`form-control form-control-sm ${
                      fieldErrors.transfer_reason ? "is-invalid" : ""
                    }`}
                    data-help="discharge_summary.transfer_reason_input"
                    placeholder={t("e.g. Higher ICU level care, neurosurgical intervention...", "مثلاً وینٹیلیٹر یا اعلیٰ سرجری کی ضرورت...")}
                    value={transferReason}
                    disabled={isFinal}
                    onChange={(e) => setTransferReason(e.target.value)}
                  />
                  {fieldErrors.transfer_reason && (
                    <div className="invalid-feedback">{fieldErrors.transfer_reason}</div>
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label fw-bold">
                    {t("Transfer Arrangements (Ambulance & Escort):", "منتقلی کے انتظامات (ایمبولینس و عملہ):")}{" "}
                    <span className="text-danger">*</span>
                  </label>
                  <textarea
                    rows={2}
                    className={`form-control form-control-sm ${
                      fieldErrors.transfer_arrangements ? "is-invalid" : ""
                    }`}
                    data-help="discharge_summary.transfer_arrangements_input"
                    placeholder={t("Ambulance type, oxygen, escort doctor/nurse, receiving handover...", "ایمبولینس کی قسم، آکسیجن، ہمراہ نرس/ڈاکٹر...")}
                    value={transferArrangements}
                    disabled={isFinal}
                    onChange={(e) => setTransferArrangements(e.target.value)}
                  />
                  {fieldErrors.transfer_arrangements && (
                    <div className="invalid-feedback">{fieldErrors.transfer_arrangements}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: LAMA / ABSCONDED OUTCOME NOTE (rule:a0859fbcc9) */}
          {(outcome === "LAMA" || outcome === "Absconded") && (
            <div className="p-3 bg-light border border-warning rounded mb-3">
              <label className="form-label fw-bold text-danger">
                {t(`Circumstances of ${outcome}:`, `${outcome} کی تفصیلی وجوہات اور حالات:`)}{" "}
                <span className="text-danger">*</span>
              </label>
              <textarea
                rows={3}
                className={`form-control form-control-sm ${
                  fieldErrors.outcome_note ? "is-invalid" : ""
                }`}
                data-help="discharge_summary.outcome_note_input"
                placeholder={t(
                  "Document refusal of treatment, risks of premature departure explained to patient/family, witnesses...",
                  "علاج سے انکار، قبل از وقت روانگی کے خطرات، مریض اور گواہوں کے بیانات درج کریں..."
                )}
                value={outcomeNote}
                disabled={isFinal}
                onChange={(e) => setOutcomeNote(e.target.value)}
              />
              {fieldErrors.outcome_note && (
                <div className="invalid-feedback">{fieldErrors.outcome_note}</div>
              )}
            </div>
          )}

          {/* ACTIONS TOOLBAR */}
          <div className="d-flex justify-content-between align-items-center border-top pt-3">
            <div>
              {isFinal ? (
                <div className="d-flex gap-2">
                  {permissions.canView && (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        data-help="discharge_summary.print_btn"
                        onClick={handlePrintA4}
                      >
                        🖨️ {outcome === "Transferred" ? t("Print Referral Slip", "ریفرل سلپ پرنٹ کریں") : t("Print A4 Summary", "سمری پرنٹ کریں")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        data-help="discharge_summary.pdf_btn"
                        onClick={handleDownloadPdf}
                      >
                        📄 {t("Download PDF", "پی ڈی ایف ڈاؤن لوڈ")}
                      </button>
                    </>
                  )}
                  {permissions.canCorrect && (
                    <button
                      type="button"
                      className="btn btn-warning"
                      data-help="discharge_summary.open_correction_modal"
                      onClick={() => {
                        setShowCorrectionModal(true);
                        setCorrectionErrors({});
                      }}
                    >
                      ✏️ {t("Add Correction", "تصحیح شامل کریں")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="d-flex gap-2">
                  {permissions.canEdit && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      data-help="discharge_summary.save_draft_btn"
                      onClick={handleSaveDraft}
                      disabled={write.busy}
                    >
                      {t("Save Draft", "مسودہ محفوظ کریں")}
                    </button>
                  )}
                  {permissions.canSign && (
                    <button
                      type="button"
                      className="btn btn-success fw-bold"
                      data-help="discharge_summary.sign_btn"
                      onClick={handleSignSummary}
                      disabled={write.busy}
                    >
                      🖋️ {write.busy ? t("Signing...", "دستخط ہو رہے ہیں...") : t("Sign & Finalize", "دستخط اور تصدیق")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPENDED CORRECTIONS AUDIT LOG (rule:6ac70d5b94) */}
      {corrections.length > 0 && (
        <div className="card p-3 shadow-sm border mb-4">
          <h5 className="fw-bold mb-3">{t("Official Corrections & Addenda (MSDS IMS 147):", "سرکاری تصحیحات کا ریکارڈ:")}</h5>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>{t("Timestamp", "وقت")}</th>
                  <th>{t("Section / Field", "سیکشن")}</th>
                  <th>{t("Correction Text", "تصحیح")}</th>
                  <th>{t("Clinical Reason", "وجہ")}</th>
                  <th>{t("Author", "معالج")}</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((corr) => (
                  <tr key={corr.correction_id}>
                    <td>{formatHospitalTime(corr.created_at, timeZone || "Asia/Karachi")}</td>
                    <td>
                      <span className="badge bg-secondary">{corr.field}</span>
                    </td>
                    <td className="fw-bold">{corr.correction_text}</td>
                    <td>{corr.correction_reason}</td>
                    <td>{corr.corrected_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CORRECTION MODAL */}
      {showCorrectionModal && (
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
                  {t("Add Official Summary Addendum / Correction", "سرکاری تصحیح شامل کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  data-help="discharge_summary.correction_close_btn"
                  onClick={() => setShowCorrectionModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">{t("Section to Correct:", "متعلقہ سیکشن:")}</label>
                  <select
                    className={`form-select ${correctionErrors.field ? "is-invalid" : ""}`}
                    data-help="discharge_summary.correction_field_select"
                    value={correctionField}
                    onChange={(e) => setCorrectionField(e.target.value)}
                  >
                    <option value="general">{t("General Addendum", "عمومی اضافہ")}</option>
                    <option value="reason_for_admission">{t("Reason for Admission", "داخلے کی وجہ")}</option>
                    <option value="final_diagnosis">{t("Final Diagnosis", "حتمی تشخیص")}</option>
                    <option value="significant_findings">{t("Significant Findings", "اہم نتائج")}</option>
                    <option value="procedures_and_treatment">{t("Procedures & Treatment", "علاج اور سرجری")}</option>
                    <option value="response_to_treatment">{t("Response to Treatment", "علاج کا ردعمل")}</option>
                    <option value="discharge_medications">{t("Discharge Medications", "رخصتی ادویات")}</option>
                    <option value="follow_up_instructions">{t("Follow-up Instructions", "فالو اپ ہدایات")}</option>
                    <option value="transfer">{t("Transfer Arrangements", "منتقلی انتظامات")}</option>
                  </select>
                  {correctionErrors.field && <div className="invalid-feedback">{correctionErrors.field}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">{t("Correction Text:", "تصحیحی عبارت:")}</label>
                  <textarea
                    rows={3}
                    className={`form-control ${correctionErrors.correction_text ? "is-invalid" : ""}`}
                    data-help="discharge_summary.correction_text_input"
                    placeholder={t("Enter factual clinical addendum...", "مستند کلینیکل اضافہ درج کریں...")}
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                  />
                  {correctionErrors.correction_text && (
                    <div className="invalid-feedback">{correctionErrors.correction_text}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">{t("Clinical Reason for Correction:", "تصحیح کی وجہ:")}</label>
                  <textarea
                    rows={2}
                    className={`form-control ${correctionErrors.correction_reason ? "is-invalid" : ""}`}
                    data-help="discharge_summary.correction_reason_input"
                    placeholder={t("e.g. Delayed histology or culture report received post-discharge...", "مثلاً ڈسچارج کے بعد ہسٹوپیتھالوجی یا کلچر رپورٹ موصول ہوئی...")}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                  />
                  {correctionErrors.correction_reason && (
                    <div className="invalid-feedback">{correctionErrors.correction_reason}</div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="discharge_summary.correction_cancel_btn"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-help="discharge_summary.correction_submit_btn"
                  onClick={handleConfirmCorrection}
                  disabled={write.busy}
                >
                  {write.busy ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Correction", "تصحیح محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ICD SEARCH MODAL (rule:73f0bf7236) */}
      {showIcdModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">
                  {t("Search ICD Diagnosis Classification", "آئی سی ڈی تشخیص تلاش کریں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  data-help="discharge_summary.icd_close_btn"
                  onClick={() => setShowIcdModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t("Diagnosis title or code...", "تشخیص کا نام یا کوڈ...")}
                    data-help="discharge_summary.icd_search_input"
                    value={icdQuery}
                    onChange={(e) => setIcdQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchIcd();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-help="discharge_summary.icd_search_btn"
                    onClick={handleSearchIcd}
                    disabled={icdLoading || !icdQuery.trim()}
                  >
                    {icdLoading ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                  </button>
                </div>

                {icdError && <div className="alert alert-danger py-2">{icdError}</div>}

                <div style={{ maxHeight: "350px", overflowY: "auto" }}>
                  {icdResults.length === 0 ? (
                    <div className="text-muted text-center py-4">
                      {t("Type a disease name (e.g. appendicitis, diabetes, pneumonia) to search.", "بیماری کا نام درج کر کے تلاش کریں۔")}
                    </div>
                  ) : (
                    <div className="list-group">
                      {icdResults.map((item) => (
                        <div
                          key={item.code}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <div className="fw-bold">{item.title}</div>
                            <div className="small text-muted">
                              <code>{item.code}</code> {item.parent_title ? `• ${item.parent_title}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            data-help="discharge_summary.icd_select_btn"
                            onClick={() => handleSelectIcdCode(item)}
                          >
                            + {t("Select", "منتخب")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
