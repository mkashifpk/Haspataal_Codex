import { useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  CodeRedIn,
  CodeRedOut,
  TraumaCreate,
  AdmissionDetailOut,
} from "../generated/code_red";
import {
  codeRed,
  arrived,
  trauma,
} from "../generated/code_red";
import {
  evaluateCodeRedView,
  canTriggerCodeRed,
  canConfirmArrival,
  canCreateTrauma,
  validateCodeRedInput,
  validateTraumaInput,
  explainCodeRedError,
} from "../code-red-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";

export interface CodeRedProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialErVisitId?: number;
  initialPatientId?: number;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
}

export function CodeRed({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  initialErVisitId,
  initialPatientId,
  onNavigateScreen,
  onBack,
}: CodeRedProps) {
  // View evaluation & permissions
  const viewEval = evaluateCodeRedView(establishment);
  const canTrigger = canTriggerCodeRed(user) && viewEval.canStartNewWork;
  const canArrive = canConfirmArrival(user) && !viewEval.isReadOnly;
  const canTrauma = canCreateTrauma(user) && viewEval.canStartNewWork;

  // Active Code Red admissions tracked locally / from current session
  const [activeCodeReds, setActiveCodeReds] = useState<CodeRedOut[]>([]);
  const [incomingBroadcast, setIncomingBroadcast] = useState<{
    admission_number: string;
    patient_name: string;
    ward_name: string;
    needs_ot: boolean;
    eta_minutes: number | null;
    message: string;
  } | null>(null);

  // Status & feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Write controller
  const write = useClinicalWrite(user, "code_red", () => {
    // Action completed
  });

  // Code Red Form State
  const [isKnownPatient, setIsKnownPatient] = useState<boolean>(
    initialPatientId ? true : false
  );
  const [patientIdInput, setPatientIdInput] = useState<string>(
    initialPatientId ? String(initialPatientId) : ""
  );
  const [tempIdInput, setTempIdInput] = useState<string>("Unknown Male 1");
  const [genderInput, setGenderInput] = useState<"male" | "female" | "other" | "unknown">("male");
  const [approxAgeInput, setApproxAgeInput] = useState<string>("30");
  const [wardTypeInput, setWardTypeInput] = useState<"ICU" | "CCU" | "Emergency" | "Surgical" | "General">("Emergency");
  const [wardIdInput, setWardIdInput] = useState<string>("");
  const [needsOtInput, setNeedsOtInput] = useState<boolean>(false);
  const [otIdInput, setOtIdInput] = useState<string>("");
  const [procedureInput, setProcedureInput] = useState<string>("");
  const [etaInput, setEtaInput] = useState<string>("5");
  const [notesInput, setNotesInput] = useState<string>("");
  const [erVisitIdInput, setErVisitIdInput] = useState<string>(
    initialErVisitId ? String(initialErVisitId) : ""
  );
  const [isMlcInput, setIsMlcInput] = useState<boolean>(false);
  const [mlcTypeIdInput, setMlcTypeIdInput] = useState<string>("1");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Quick Trauma Modal
  const [showTraumaModal, setShowTraumaModal] = useState(false);
  const [modalTempId, setModalTempId] = useState("");
  const [modalGender, setModalGender] = useState<"male" | "female" | "other" | "unknown">("male");
  const [modalAge, setModalAge] = useState("");
  const [traumaErrors, setTraumaErrors] = useState<Record<string, string>>({});

  // Submit Code Red
  const handleTriggerCodeRed = async () => {
    const payload: CodeRedIn = {
      patient_id: isKnownPatient && patientIdInput ? Number(patientIdInput) : null,
      temp_identifier: !isKnownPatient && tempIdInput ? tempIdInput : null,
      gender: !isKnownPatient ? genderInput : undefined,
      approx_age_years: !isKnownPatient && approxAgeInput ? Number(approxAgeInput) : null,
      ward_type: wardTypeInput,
      ward_id: wardIdInput ? Number(wardIdInput) : null,
      needs_ot: viewEval.canOfferSurgery ? needsOtInput : false,
      ot_id: needsOtInput && otIdInput ? Number(otIdInput) : null,
      procedure_name: needsOtInput && procedureInput ? procedureInput : null,
      eta_minutes: etaInput ? Number(etaInput) : null,
      notes: notesInput || null,
      er_visit_id: erVisitIdInput ? Number(erVisitIdInput) : null,
      is_medico_legal: isMlcInput,
      mlc_case_type_id: isMlcInput && mlcTypeIdInput ? Number(mlcTypeIdInput) : null,
    };

    const errs = validateCodeRedInput(payload, viewEval);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      write.start({
        path: "/admissions/code-red",
        method: "POST",
        body: payload,
        permission: "ipd.admission.code_red",
        protection: "idempotent",
        label: t("Activate Emergency Code Red Admission", "کوڈ ریڈ ہنگامی داخلہ فعال کریں"),
      });

      // Optimistically create tracking item
      const newCodeRed: CodeRedOut = {
        admission_id: Date.now(),
        admission_number: `ADM-${Date.now().toString().slice(-6)}`,
        patient_id: payload.patient_id ?? 9999,
        photo_document_id: null,
        mrn: payload.patient_id ? `MRN-${payload.patient_id}` : `TRM-${Date.now().toString().slice(-4)}`,
        patient_name: isKnownPatient ? `Patient #${payload.patient_id}` : (tempIdInput || "Unknown Trauma Patient"),
        gender: payload.gender ?? null,
        age_years: payload.approx_age_years ?? null,
        requested_ward_id: null,
        requested_ward_name: wardTypeInput,
        ward_id: null,
        ward_name: wardTypeInput,
        bed_id: null,
        bed_label: null,
        primary_doctor_id: user.permissions?.includes("ipd.doctor.care") ? user.user_id : null,
        primary_doctor_name: user.permissions?.includes("ipd.doctor.care") ? `Doctor #${user.user_id}` : null,
        admission_type: "CodeRed",
        status: "CodeRedActive",
        billing_category: "Cash",
        panel_id: null,
        is_billing_confirmed: false,
        is_billing_deferred: true,
        is_overflow: false,
        overflow_reason: null,
        eta_minutes: payload.eta_minutes ?? 5,
        source_ticket_id: null,
        admission_reason: null,
        provisional_diagnosis: null,
        initial_care_plan: null,
        details_stamp: null,
        admission_notes: payload.notes || null,
        requested_at: new Date().toISOString(),
        reserved_at: null,
        admitted_at: new Date().toISOString(),
        discharge_initiated_at: null,
        discharged_at: null,
        row_version: 1,
        discharge: { stages: [], blocked_on: null, started: false, complete: false },
        invoice: null,
        alert_message: `CODE RED: Critical resuscitation intake to ${wardTypeInput}!`,
        ot_booking: payload.needs_ot
          ? {
              booking_id: Date.now(),
              ot_id: payload.ot_id ?? 1,
              ot_name: "Emergency Theatre",
              hold_until: new Date(Date.now() + 3600000).toISOString(),
            }
          : null,
      };

      setActiveCodeReds((prev) => [newCodeRed, ...prev]);
      setIncomingBroadcast({
        admission_number: newCodeRed.admission_number,
        patient_name: newCodeRed.patient_name,
        ward_name: newCodeRed.ward_name || "Emergency",
        needs_ot: !!newCodeRed.ot_booking,
        eta_minutes: payload.eta_minutes ?? 5,
        message: `CODE RED: Incoming critical resuscitation to ${newCodeRed.ward_name || "Emergency"}!`,
      });

      setActionNotice(
        t(
          `Code Red ${newCodeRed.admission_number} activated! Resuscitation team alerted.`,
          `کوڈ ریڈ داخلہ نمبر ${newCodeRed.admission_number} فعال کر دیا گیا!`
        )
      );
    } catch (err) {
      setActionNotice(explainCodeRedError(err));
    }
  };

  // Confirm Patient Arrived (CodeRedActive -> Admitted)
  const handleConfirmArrival = async (admissionId: number) => {
    try {
      write.start({
        path: `/admissions/${admissionId}/arrived`,
        method: "POST",
        permission: "ipd.admission.arrive",
        protection: "idempotent",
        label: t("Confirm Code Red Patient Arrival", "مریض کی آمد کی تصدیق کریں"),
      });

      setActiveCodeReds((prev) =>
        prev.map((a) =>
          a.admission_id === admissionId
            ? { ...a, status: "Admitted" }
            : a
        )
      );
      setActionNotice(t("Patient arrival confirmed. Status updated to Admitted.", "مریض کی آمد کی تصدیق ہو گئی۔"));
    } catch (err) {
      setActionNotice(explainCodeRedError(err));
    }
  };

  // Create Trauma Profile
  const handleCreateTrauma = async () => {
    const payload: TraumaCreate = {
      temp_identifier: modalTempId,
      gender: modalGender,
      approx_age_years: modalAge ? Number(modalAge) : null,
    };
    const errs = validateTraumaInput(payload);
    if (Object.keys(errs).length > 0) {
      setTraumaErrors(errs);
      return;
    }

    try {
      write.start({
        path: "/patients/trauma",
        method: "POST",
        body: payload,
        permission: "ipd.admission.code_red",
        protection: "idempotent",
        label: t("Create Temporary Trauma Profile", "عارضی ٹراما پروفائل بنائیں"),
      });

      setTempIdInput(modalTempId);
      setGenderInput(modalGender);
      setApproxAgeInput(modalAge);
      setIsKnownPatient(false);
      setShowTraumaModal(false);
      setActionNotice(t(`Trauma profile '${modalTempId}' created and selected.`, "عارضی ٹراما پروفائل تیار ہو گیا۔"));
    } catch (err) {
      setActionNotice(explainCodeRedError(err));
    }
  };

  if (!viewEval.canShow) {
    return (
      <div className="container-fluid p-4">
        <ErrorBox
          error={t(
            "Code Red admission is not available in the current facility service configuration.",
            "موجودہ سہولت کی سروس کنفیگریشن میں کوڈ ریڈ دستیاب نہیں ہے۔"
          )}
        />
        {onBack && (
          <button
            type="button"
            className="btn btn-secondary mt-3"
            data-help="code_red.back"
            onClick={onBack}
          >
            ← {t("Back", "واپس")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="container-fluid p-3 code-red-container">
      {/* Full-screen / Top Red Strobe Broadcast Banner (rule:77b021933d, rule:3eafe672a6) */}
      {incomingBroadcast && (
        <div
          className="alert alert-danger p-3 mb-3 border-4 border-danger shadow-lg animate-pulse"
          style={{ backgroundColor: "#ffdddd", borderLeft: "8px solid #dc3545" }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <span className="fs-1 animate-bounce">🚨</span>
              <div>
                <h4 className="text-danger fw-bold mb-1">
                  {t("CODE RED INCOMING RESUSCITATION ALERT", "کوڈ ریڈ: ہنگامی بحالی کا فوری الرٹ")}
                </h4>
                <div className="fs-6">
                  <strong>{incomingBroadcast.patient_name}</strong> •{" "}
                  {t("Admission:", "داخلہ نمبر:")} <strong>{incomingBroadcast.admission_number}</strong> •{" "}
                  {t("Destination:", "منزل:")} <strong>{incomingBroadcast.ward_name}</strong> •{" "}
                  {t("ETA:", "آمد:")} <strong>{incomingBroadcast.eta_minutes ?? 5} {t("min", "منٹ")}</strong>
                  {incomingBroadcast.needs_ot && (
                    <span className="badge bg-danger ms-2 fs-6">
                      ⚠️ {t("OT HOLD REQUIRED", "تھیٹر ریزرو درکار")}
                    </span>
                  )}
                </div>
                <div className="text-muted small mt-1">{incomingBroadcast.message}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-danger fw-bold"
              data-help="code_red.btn_acknowledge_alert"
              onClick={() => setIncomingBroadcast(null)}
            >
              ✓ {t("Acknowledge", "وصول کیا")}
            </button>
          </div>
        </div>
      )}

      {/* Service Warning Banner */}
      {viewEval.bannerNotice && (
        <div className="alert alert-warning py-2 px-3 mb-3">
          ⚠️ {viewEval.bannerNotice}
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div className="alert alert-info py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close"
            data-help="code_red.btn_dismiss_notice"
            onClick={() => setActionNotice(null)}
          />
        </div>
      )}

      {/* Header Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          {onBack && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              data-help="code_red.back"
              onClick={onBack}
            >
              ← {t("Back", "واپس")}
            </button>
          )}
          <h4 className="mb-0 text-danger fw-bold">
            🚨 {t("Code Red: Emergency Resuscitation Admission", "کوڈ ریڈ: ہنگامی بحالی داخلہ")}
          </h4>
        </div>

        <div className="d-flex gap-2">
          {canTrauma && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              data-help="code_red.btn_open_trauma_modal"
              onClick={() => {
                setModalTempId(`Unknown ${genderInput === "female" ? "Female" : "Male"} ${Date.now().toString().slice(-3)}`);
                setModalGender(genderInput);
                setModalAge(approxAgeInput);
                setTraumaErrors({});
                setShowTraumaModal(true);
              }}
            >
              + {t("New Trauma Identity", "نیا ٹراما شناختی ریکارڈ")}
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="row g-3">
        {/* Left Column: Code Red Activation Panel */}
        <div className="col-lg-7">
          <div className="card shadow-sm border-danger border-2 h-100">
            <div className="card-header bg-danger text-white py-2 d-flex justify-content-between align-items-center">
              <strong className="fs-6">
                ⚡ {t("One-Click Emergency Resuscitation Intake (MSDS 18)", "فوری ایمرجنسی داخلہ فارم")}
              </strong>
              <span className="badge bg-light text-danger">Priority Level 1</span>
            </div>

            <div className="card-body">
              {/* Demographics / Billing Non-blocking Notice (rule:79df75a537, rule:ddc33f8c02) */}
              <div className="alert alert-light border py-1 px-2 small mb-3 text-muted">
                ℹ️ <strong>Clinical Rule:</strong> Never blocked by billing, CNIC, or photo. Billing is deferred, never waived. Medical reason & diagnosis are documented after stabilization.
              </div>

              {/* Patient Identity Selector */}
              <div className="mb-3">
                <label className="fw-bold d-block mb-1">
                  {t("Patient Identity", "مریض کی شناخت")}
                </label>
                <div className="form-check form-check-inline">
                  <input
                    type="radio"
                    className="form-check-input"
                    name="patientIdentityRadio"
                    id="radioTrauma"
                    data-help="code_red.radio_trauma"
                    checked={!isKnownPatient}
                    onChange={() => setIsKnownPatient(false)}
                  />
                  <label className="form-check-label fw-bold text-danger" htmlFor="radioTrauma">
                    {t("Unidentified / Emergency Trauma Patient", "نامعلوم یا بے ہوش ایمرجنسی مریض")}
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    type="radio"
                    className="form-check-input"
                    name="patientIdentityRadio"
                    id="radioKnown"
                    data-help="code_red.radio_known"
                    checked={isKnownPatient}
                    onChange={() => setIsKnownPatient(true)}
                  />
                  <label className="form-check-label" htmlFor="radioKnown">
                    {t("Known Patient (Existing MRN/ID)", "شناخت شدہ مریض (موجودہ شناختی نمبر)")}
                  </label>
                </div>
              </div>

              {/* Known Patient Input */}
              {isKnownPatient ? (
                <div className="mb-3">
                  <Field label={t("Patient ID (MRN)", "مریض کا آئی ڈی نمبر")}>
                    <input
                      type="number"
                      className="form-control"
                      data-help="code_red.input_patient_id"
                      value={patientIdInput}
                      onChange={(e) => setPatientIdInput(e.target.value)}
                      placeholder="e.g. 101"
                      required
                    />
                  </Field>
                  {formErrors.patient && (
                    <div className="text-danger small">{formErrors.patient}</div>
                  )}
                </div>
              ) : (
                /* Unidentified Trauma Patient Details */
                <div className="row g-2 mb-3 p-2 bg-light rounded border">
                  <div className="col-md-5">
                    <Field label={t("Temporary Identifier", "عارضی شناختی نام")}>
                      <input
                        type="text"
                        className="form-control"
                        data-help="code_red.input_temp_id"
                        value={tempIdInput}
                        onChange={(e) => setTempIdInput(e.target.value)}
                        placeholder="Unknown Male 1"
                        required
                      />
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label={t("Perceived Gender", "ظاہری جنس")}>
                      <select
                        className="form-select"
                        data-help="code_red.select_gender"
                        value={genderInput}
                        onChange={(e) => setGenderInput(e.target.value as any)}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t("Approx Age", "تخمینہ عمر")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="code_red.input_approx_age"
                        value={approxAgeInput}
                        onChange={(e) => setApproxAgeInput(e.target.value)}
                        placeholder="30"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Destination Ward / Type */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <Field label={t("Destination Ward Type", "منزل وارڈ کی قسم")}>
                    <select
                      className="form-select"
                      data-help="code_red.select_ward_type"
                      value={wardTypeInput}
                      onChange={(e) => setWardTypeInput(e.target.value as any)}
                    >
                      <option value="Emergency">Emergency Resuscitation Bay</option>
                      <option value="ICU">Intensive Care Unit (ICU)</option>
                      <option value="CCU">Coronary Care Unit (CCU)</option>
                      <option value="Surgical">Surgical Emergency Ward</option>
                      <option value="General">General Medical Ward</option>
                    </select>
                  </Field>
                </div>

                <div className="col-md-6">
                  <Field label={t("Arrival ETA (Minutes)", "متوقع آمد (منٹ)")}>
                    <input
                      type="number"
                      className="form-control"
                      data-help="code_red.input_eta"
                      value={etaInput}
                      onChange={(e) => setEtaInput(e.target.value)}
                      placeholder="5"
                    />
                  </Field>
                </div>
              </div>

              {/* Emergency Surgery Theatre Hold (rule:45f4e0ca60) */}
              {viewEval.canOfferSurgery && (
                <div className="p-3 mb-3 border rounded bg-light">
                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="needsOtSwitch"
                      data-help="code_red.switch_needs_ot"
                      checked={needsOtInput}
                      onChange={(e) => setNeedsOtInput(e.target.checked)}
                    />
                    <label className="form-check-label fw-bold text-danger" htmlFor="needsOtSwitch">
                      🔪 {t("Emergency Operating Theatre Hold (Hold OT)", "ہنگامی آپریشن تھیٹر ہولڈ (او ٹی ریزرو کریں)")}
                    </label>
                  </div>
                  {needsOtInput && (
                    <div className="row g-2 mt-2">
                      <div className="col-md-6">
                        <Field label={t("Emergency Procedure Name", "ہنگامی پروسیجر")}>
                          <input
                            type="text"
                            className="form-control"
                            data-help="code_red.input_procedure"
                            value={procedureInput}
                            onChange={(e) => setProcedureInput(e.target.value)}
                            placeholder="e.g. Exploratory Laparotomy / Craniotomy"
                          />
                        </Field>
                      </div>
                      <div className="col-md-6">
                        <Field label={t("Specific OT ID (Optional)", "مخصوص تھیٹر نمبر")}>
                          <input
                            type="number"
                            className="form-control"
                            data-help="code_red.input_ot_id"
                            value={otIdInput}
                            onChange={(e) => setOtIdInput(e.target.value)}
                            placeholder="1"
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Medico-Legal Flag (rule:2d008ab65a) */}
              <div className="p-2 mb-3 border rounded">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="isMlcCheck"
                    data-help="code_red.check_is_mlc"
                    checked={isMlcInput}
                    onChange={(e) => setIsMlcInput(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold text-warning text-dark" htmlFor="isMlcCheck">
                    ⚖️ {t("Suspected Medico-Legal Case (Accident, Assault, Poisoning)", "میڈیکو لیگل کیس")}
                  </label>
                </div>
                {isMlcInput && (
                  <div className="mt-2">
                    <Field label={t("MLC Case Type ID", "کیس کی قسم")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="code_red.input_mlc_type"
                        value={mlcTypeIdInput}
                        onChange={(e) => setMlcTypeIdInput(e.target.value)}
                        placeholder="1 (RTA)"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Clinical Handover Notes for Destination Team */}
              <div className="mb-3">
                <Field label={t("Handover Notes for Receiving Team", "وصول کنندہ عملے کے لیے ہدایات")}>
                  <textarea
                    className="form-control"
                    rows={3}
                    data-help="code_red.textarea_notes"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Brief injury details, pre-hospital airway intervention, or active CPR in progress"
                  />
                </Field>
              </div>

              {/* Big Red Button */}
              <div className="d-grid mt-4">
                <button
                  type="button"
                  className="btn btn-danger btn-lg fw-bold py-3 fs-5 shadow"
                  data-help="code_red.btn_trigger_code_red"
                  disabled={!canTrigger}
                  onClick={handleTriggerCodeRed}
                >
                  🚨 {t("ACTIVATE CODE RED NOW", "کوڈ ریڈ فوری فعال کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Code Red Admissions Monitor */}
        <div className="col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <strong className="mb-0">
                {t("Active Resuscitation Admissions", "زیر نگرانی کوڈ ریڈ داخلے")}
              </strong>
              <span className="badge bg-danger">{activeCodeReds.length}</span>
            </div>

            <div className="card-body p-0">
              {activeCodeReds.length === 0 ? (
                <Empty>
                  <div className="text-center py-4">
                    <div className="fs-3 mb-2">🛡️</div>
                    <h6 className="text-muted">{t("No Active Code Red Admissions", "کوئی فعال کوڈ ریڈ داخلہ نہیں")}</h6>
                    <small className="text-muted">
                      {t("Incoming emergency resuscitation admissions appear here.", "ہنگامی مریضوں کی آمد کی فہرست یہاں ظاہر ہوگی۔")}
                    </small>
                  </div>
                </Empty>
              ) : (
                <ul className="list-group list-group-flush">
                  {activeCodeReds.map((cr) => (
                    <li key={cr.admission_id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div>
                          <strong className="fs-6 text-danger">{cr.patient_name}</strong>
                          <div className="small text-muted">
                            MRN: <strong>{cr.mrn}</strong> • {cr.admission_number}
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            cr.status === "Admitted"
                              ? "bg-success"
                              : "bg-danger animate-pulse"
                          }`}
                        >
                          {cr.status}
                        </span>
                      </div>

                      <div className="small mb-2">
                        <div>
                          <strong>{t("Destination:", "منزل:")}</strong> {cr.ward_name}
                        </div>
                        <div>
                          <strong>{t("Doctor Status:", "ڈاکٹر اسٹیٹس:")}</strong>{" "}
                          {cr.primary_doctor_name ? (
                            <span className="text-success">{cr.primary_doctor_name}</span>
                          ) : (
                            <span className="text-warning text-dark fw-bold">Doctor: waiting</span>
                          )}
                        </div>
                        <div>
                          <strong>{t("Billing:", "بلنگ:")}</strong>{" "}
                          <span className="badge bg-secondary">Deferred (Not Waived)</span>
                        </div>
                        {cr.ot_booking && (
                          <div className="text-danger fw-bold mt-1">
                            🔪 OT Hold: {cr.ot_booking.ot_name}
                          </div>
                        )}
                      </div>

                      {canArrive && cr.status === "CodeRedActive" && (
                        <div className="d-grid mt-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            data-help="code_red.btn_confirm_arrived"
                            onClick={() => handleConfirmArrival(cr.admission_id)}
                          >
                            ✓ {t("Confirm Patient Arrived in Bay", "مریض کی آمد کی تصدیق کریں")}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Trauma Registration Modal */}
      {showTraumaModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-header-title text-danger">
                  {t("Create Emergency Trauma Identity", "عارضی ٹراما پروفائل بنائیں")}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-help="code_red.trauma_close_btn"
                  onClick={() => setShowTraumaModal(false)}
                />
              </div>

              <div className="modal-body">
                <div className="mb-3">
                  <Field label={t("Temporary Identifier", "عارضی شناختی نام")}>
                    <input
                      type="text"
                      className="form-control"
                      data-help="code_red.trauma_temp_id_input"
                      value={modalTempId}
                      onChange={(e) => setModalTempId(e.target.value)}
                      placeholder="Unknown Male 1"
                      required
                    />
                  </Field>
                  {traumaErrors.temp_identifier && (
                    <div className="text-danger small">{traumaErrors.temp_identifier}</div>
                  )}
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <Field label={t("Perceived Gender", "جنس")}>
                      <select
                        className="form-select"
                        data-help="code_red.trauma_gender_select"
                        value={modalGender}
                        onChange={(e) => setModalGender(e.target.value as any)}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label={t("Estimated Age (Years)", "تخمینہ عمر")}>
                      <input
                        type="number"
                        className="form-control"
                        data-help="code_red.trauma_age_input"
                        value={modalAge}
                        onChange={(e) => setModalAge(e.target.value)}
                        placeholder="35"
                      />
                    </Field>
                    {traumaErrors.approx_age_years && (
                      <div className="text-danger small">{traumaErrors.approx_age_years}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-help="code_red.trauma_cancel_btn"
                  onClick={() => setShowTraumaModal(false)}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-help="code_red.trauma_submit_btn"
                  onClick={handleCreateTrauma}
                >
                  {t("Create & Select Profile", "پروفائل بنائیں اور منتخب کریں")}
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
