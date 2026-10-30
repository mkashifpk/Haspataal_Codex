import { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  BloodRequestOut,
  BloodRequestDetailOut,
  BloodRequestIn,
  RequestCloseIn,
  ConsentBriefOut,
} from "../generated/blood_request";
import {
  worklistBloodRequests,
  getRequest,
  listConsents,
  listUnits,
} from "../generated/blood_request";
import {
  bloodRequestAccess,
  validateBloodRequestIn,
  canCancelBloodRequest,
  canCloseBloodRequest,
  BLOOD_COMPONENTS,
  BLOOD_URGENCIES,
  type BloodComponent,
  type BloodUrgency,
} from "../blood-request-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodRequest({
  user,
  establishment,
  connected,
  stream,
  onNavigateToConsent,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  onNavigateToConsent?: () => void;
}) {
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "blood_request",
  )?.view;
  const isServiceActive = Boolean(
    establishment.active && establishment.active.includes("blood_transfusion"),
  );
  const access = bloodRequestAccess(view, user.permissions, isServiceActive);
  const live = connected && stream === "Live";

  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"Open" | "Closed" | "Cancelled" | "All">("Open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<BloodRequestDetailOut | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BloodRequestDetailOut | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // New Request Form states
  const [patientIdInput, setPatientIdInput] = useState<string>("");
  const [admissionIdInput, setAdmissionIdInput] = useState<string>("");
  const [erVisitIdInput, setErVisitIdInput] = useState<string>("");
  const [selectedConsentId, setSelectedConsentId] = useState<string>("");
  const [component, setComponent] = useState<BloodComponent>("RedCells");
  const [unitsRequested, setUnitsRequested] = useState<number>(1);
  const [urgency, setUrgency] = useState<BloodUrgency>("Routine");
  const [indication, setIndication] = useState<string>("");
  const [uncrossmatchedNote, setUncrossmatchedNote] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const write = useClinicalWrite(user, "blood_request", () => {
    setIsAddOpen(false);
    setCloseTarget(null);
    setCancelTarget(null);
    resetForm();
    setRevision((r) => r + 1);
  });

  const resetForm = () => {
    setPatientIdInput("");
    setAdmissionIdInput("");
    setErVisitIdInput("");
    setSelectedConsentId("");
    setComponent("RedCells");
    setUnitsRequested(1);
    setUrgency("Routine");
    setIndication("");
    setUncrossmatchedNote("");
    setValidationErrors({});
    setError(undefined);
  };

  // Load blood requests worklist
  const requestsState = useLoad(
    () =>
      access.read
        ? worklistBloodRequests({
            status: statusFilter === "All" ? undefined : statusFilter,
          })
        : Promise.resolve([]),
    [revision, statusFilter, access.read],
  );

  // Load selected request detail
  const detailState = useLoad(
    () =>
      selectedRequestId && access.read
        ? getRequest(selectedRequestId)
        : Promise.resolve(null),
    [selectedRequestId, revision, access.read],
  );

  // Load transfusion consents for the selected patient
  const consentsState = useLoad(
    () => {
      const pid = patientIdInput.trim() ? Number(patientIdInput.trim()) : null;
      if (!pid || !access.read) return Promise.resolve([]);
      return listConsents({
        patient_id: pid,
        category: "Transfusion",
        status: "Given",
      });
    },
    [patientIdInput, isAddOpen, access.read],
  );

  // Real-time event listeners for blood.unit.issued and establishment.changed
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (!data) return;
      if (
        data.event_type === "blood.unit.issued" ||
        data.type === "blood.unit.issued" ||
        data.event_type === "establishment.changed" ||
        data.type === "establishment.changed"
      ) {
        setRevision((r) => r + 1);
      }
    };
    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  const requests = requestsState.data || [];
  const selectedDetail = detailState.data;
  const availableConsents = consentsState.data || [];

  // Filter requests by search query (patient name, MRN, request number)
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.patient_name.toLowerCase().includes(q) ||
      r.mrn.toLowerCase().includes(q) ||
      r.request_number.toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.write || !live || write.busy) return;

    const pid = patientIdInput.trim() ? Number(patientIdInput.trim()) : null;
    const admId = admissionIdInput.trim() ? Number(admissionIdInput.trim()) : null;
    const erId = erVisitIdInput.trim() ? Number(erVisitIdInput.trim()) : null;
    const consentId = selectedConsentId ? Number(selectedConsentId) : null;

    const validation = validateBloodRequestIn({
      patient_id: pid,
      admission_id: admId,
      er_visit_id: erId,
      component,
      units_requested: Number(unitsRequested),
      urgency,
      indication,
      consent_id: consentId,
      uncrossmatched_note: urgency === "Emergency" ? uncrossmatchedNote : null,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: BloodRequestIn = {
      admission_id: admId,
      er_visit_id: erId,
      component,
      units_requested: Number(unitsRequested),
      urgency,
      indication: indication.trim(),
      consent_id: consentId!,
      uncrossmatched_note: urgency === "Emergency" ? uncrossmatchedNote.trim() || null : null,
    };

    write.start({
      method: "POST",
      path: "/blood/requests",
      body: payload,
      permission: "blood.request",
      protection: "idempotent",
      reconcilePath: "/blood/requests",
      label: t("Request blood", "خون کی درخواست دیں"),
    });
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeTarget || !access.close || !live || write.busy) return;
    if (!closeNote.trim()) {
      setError(new Error("Please enter a closing note."));
      return;
    }

    const payload: RequestCloseIn = {
      note: closeNote.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood/requests/${closeTarget.request_id}/close`,
      body: payload,
      permission: "blood.request",
      protection: "reconcile",
      reconcilePath: `/blood/requests/${closeTarget.request_id}`,
      label: t("Close blood request", "خون کی درخواست مکمل و بند کریں"),
    });
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !access.cancel || !live || write.busy) return;
    if (!cancelReason.trim()) {
      setError(new Error("Please enter a cancellation reason."));
      return;
    }

    const payload: RequestCloseIn = {
      note: cancelReason.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood/requests/${cancelTarget.request_id}/cancel`,
      body: payload,
      permission: "blood.request",
      protection: "reconcile",
      reconcilePath: `/blood/requests/${cancelTarget.request_id}`,
      label: t("Cancel blood request", "خون کی درخواست منسوخ کریں"),
    });
  };

  return (
    <div className="container">
      <div className="bed-board-heading">
        <div>
          <h1>{t("Clinical blood requests", "خون کی طبی درخواستیں")}</h1>
          <p>
            {t(
              "The doctor's request for blood for a patient admitted now or in the emergency department, with the patient's transfusion consent of the stay, and its progress.",
              "زیر علاج یا ایمرجنسی مریض کے لیے خون کی فراہمی کی درخواست، متعلقہ باخبر رضامندی اور ترسیل کی پیشرفت۔",
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            data-help="blood_request.refresh"
            onClick={() => setRevision((r) => r + 1)}
            disabled={requestsState.loading}
          >
            {t("Refresh requests", "درخواستیں تازہ کریں")}
          </button>
          {access.write && (
            <button
              data-help="blood_request.create_open"
              className="primary"
              onClick={handleOpenAdd}
              disabled={!live || write.busy}
            >
              {t("Request blood", "خون کی نئی درخواست")}
            </button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      <ClinicalWriteFeedback write={write} onReviewed={() => setRevision((r) => r + 1)} />

      {!live && (
        <p className="notice">
          {t(
            "Connection is not live. Real-time updates paused.",
            "رابطہ تازہ نہیں ہے۔ خودکار اپ ڈیٹس معطل ہیں۔",
          )}
        </p>
      )}

      {access.isRetiring && (
        <p className="notice">
          {t(
            "No new blood requests from now on. Existing requests continue being issued and fulfilled.",
            "اب خون کی نئی درخواستیں ممنوع؛ جاری شدہ درخواستوں کی ترسیل بدستور جاری رہے گی۔",
          )}
        </p>
      )}

      {access.isRecords && (
        <p className="notice">
          {t(
            "Records only: historical blood requests, crossmatch compatibility records, and transfusions.",
            "صرف ریکارڈ: خون کی ماضی کی درخواستیں، کراس میچ ٹیسٹ اور ٹرانسفیوژن کی تفصیلات۔",
          )}
        </p>
      )}

      {!isServiceActive && (
        <p className="notice">
          {t(
            "Blood transfusion service is not active in facility settings. New blood requests cannot be created.",
            "ہسپتال کی ترتیبات میں بلڈ ٹرانسفیوژن سروس فعال نہیں ہے۔ نئی درخواستیں شروع نہیں ہو سکتیں۔",
          )}
        </p>
      )}

      {/* Filters and search bar */}
      <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <Field label={t("Status filter", "حالت کا فلٹر")}>
          <select
            data-help="blood_request.filter_status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="Open">{t("Open requests", "کھلی درخواستیں")}</option>
            <option value="Closed">{t("Closed (Fulfilled)", "مکمل شدہ / بند")}</option>
            <option value="Cancelled">{t("Cancelled", "منسوخ شدہ")}</option>
            <option value="All">{t("All requests", "تمام درخواستیں")}</option>
          </select>
        </Field>

        <Field label={t("Find patient or request #", "مریض یا درخواست تلاش کریں")}>
          <input
            data-help="blood_request.search_patient"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Filter by name, MRN, request #...", "نام، ایم آر این یا درخواست نمبر سے فلٹر کریں...")}
          />
        </Field>
      </div>

      <LoadState loading={requestsState.loading} error={requestsState.error} retry={requestsState.reload} />
      {filteredRequests.length === 0 ? (
        <Empty>{t("No blood requests found.", "خون کی کوئی درخواست موصول نہیں ہوئی۔")}</Empty>
      ) : (
          <div style={{ display: "grid", gridTemplateColumns: selectedRequestId ? "1fr 1fr" : "1fr", gap: "1rem" }}>
            {/* Requests list */}
            <div>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Request #", "درخواست نمبر")}</th>
                    <th>{t("Patient / MRN", "مریض / ایم آر این")}</th>
                    <th>{t("Component", "جزو")}</th>
                    <th>{t("Units (Issued/Req)", "یونٹس (جاری/طلب)")}</th>
                    <th>{t("Urgency", "فوری ضرورت")}</th>
                    <th>{t("Status", "حالت")}</th>
                    <th>{t("Action", "عمل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.request_id}
                      style={{
                        backgroundColor: selectedRequestId === req.request_id ? "var(--selection-bg, #f0f7ff)" : undefined,
                      }}
                    >
                      <td>
                        <strong>{req.request_number}</strong>
                      </td>
                      <td>
                        <div>{req.patient_name}</div>
                        <small>{req.mrn} {req.blood_group ? `(${req.blood_group})` : ""}</small>
                      </td>
                      <td>{req.component}</td>
                      <td>
                        <span style={{ fontWeight: req.units_issued > 0 ? "bold" : "normal" }}>
                          {req.units_issued} / {req.units_requested}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            req.urgency === "Emergency"
                              ? "badge-danger"
                              : req.urgency === "Urgent"
                              ? "badge-warning"
                              : "badge-info"
                          }`}
                        >
                          {req.urgency}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            req.status === "Open"
                              ? "badge-success"
                              : req.status === "Closed"
                              ? "badge-secondary"
                              : "badge-danger"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>
                        <button
                          data-help="blood_request.select_request"
                          onClick={() => setSelectedRequestId(req.request_id)}
                        >
                          {t("View", "تفصیل")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Request Detail Drawer */}
            {selectedRequestId && (
              <div className="card">
                <LoadState loading={detailState.loading} error={detailState.error} retry={detailState.reload} />
                {selectedDetail && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3>{selectedDetail.request_number}</h3>
                        <button
                          data-help="blood_request.dialog_close"
                          onClick={() => setSelectedRequestId(null)}
                        >
                          {t("Close", "بند کریں")}
                        </button>
                      </div>

                      <div style={{ margin: "0.5rem 0" }}>
                        <strong>{selectedDetail.patient_name}</strong> ({selectedDetail.mrn})
                        {selectedDetail.blood_group && <span> • {t("Blood Group", "بلڈ گروپ")}: {selectedDetail.blood_group}</span>}
                      </div>

                      <p>
                        <strong>{t("Component", "جزو")}:</strong> {selectedDetail.component} •{" "}
                        <strong>{t("Units Requested", "طلب شدہ یونٹس")}:</strong> {selectedDetail.units_requested} •{" "}
                        <strong>{t("Units Issued", "جاری شدہ یونٹس")}:</strong> {selectedDetail.units_issued}
                      </p>

                      <p>
                        <strong>{t("Urgency", "فوری ضرورت")}:</strong> {selectedDetail.urgency} •{" "}
                        <strong>{t("Indication", "طبی ضرورت")}:</strong> {selectedDetail.indication}
                      </p>

                      <p>
                        <strong>{t("Transfusion Consent", "رضامندی")}:</strong> {selectedDetail.consent_number}
                      </p>

                      {selectedDetail.uncrossmatched_note && (
                        <div className="notice" style={{ borderColor: "red", color: "darkred" }}>
                          <strong>{t("Emergency Uncrossmatched Note", "ہنگامی بغیر کراس میچ تصدیق")}:</strong>
                          <p>{selectedDetail.uncrossmatched_note}</p>
                        </div>
                      )}

                      <div style={{ marginTop: "1rem" }}>
                        <h4>{t("Crossmatch Compatibility Tests", "کراس میچ ٹیسٹ ریکارڈز")} ({selectedDetail.crossmatches?.length || 0})</h4>
                        {selectedDetail.crossmatches?.length === 0 ? (
                          <p style={{ color: "var(--muted, #666)" }}>
                            {t("No crossmatch tests recorded yet.", "ابھی تک کوئی کراس میچ درج نہیں ہوا۔")}
                          </p>
                        ) : (
                          <ul style={{ paddingLeft: "1.2rem" }}>
                            {selectedDetail.crossmatches.map((cm) => (
                              <li key={cm.crossmatch_id}>
                                Unit {cm.unit_number} ({cm.unit_abo} {cm.unit_rh}) →{" "}
                                <strong style={{ color: cm.result === "Compatible" ? "green" : "red" }}>
                                  {cm.result}
                                </strong>{" "}
                                ({t("Method", "طریقہ کار")}: {cm.method})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div style={{ marginTop: "1rem" }}>
                        <h4>{t("Transfusion Events", "خون لگانے کے واقعات")} ({selectedDetail.transfusions?.length || 0})</h4>
                        {selectedDetail.transfusions?.length === 0 ? (
                          <p style={{ color: "var(--muted, #666)" }}>
                            {t("No transfusions recorded yet.", "ابھی تک خون لگانے کا واقعہ درج نہیں ہوا۔")}
                          </p>
                        ) : (
                          <ul style={{ paddingLeft: "1.2rem" }}>
                            {selectedDetail.transfusions.map((tr) => (
                              <li key={tr.transfusion_id}>
                                Unit {tr.unit_number}: {tr.status}
                                <span style={{ color: "var(--muted, #666)" }}>
                                  {" "}• {tr.component} ({tr.abo} {tr.rh})
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Action buttons: Close or Cancel */}
                      {selectedDetail.status === "Open" && (
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
                          {access.close && (
                            <button
                              data-help="blood_request.close_dialog"
                              onClick={() => {
                                setCloseTarget(selectedDetail);
                                setCloseNote("");
                              }}
                              disabled={!live || write.busy}
                            >
                              {t("Close request (Fulfilled)", "درخواست مکمل و بند کریں")}
                            </button>
                          )}

                          {access.cancel && (
                            <button
                              data-help="blood_request.cancel_dialog"
                              className="danger"
                              onClick={() => {
                                const check = canCancelBloodRequest(selectedDetail);
                                if (!check.allowed) {
                                  setError(new Error(check.reason));
                                  return;
                                }
                                setCancelTarget(selectedDetail);
                                setCancelReason("");
                              }}
                              disabled={!live || write.busy}
                            >
                              {t("Cancel request", "درخواست منسوخ کریں")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                )}
              </div>
            )}
          </div>
      )}

      {/* New Blood Request Modal */}
      {isAddOpen && (
        <Modal
          title={t("Request blood for patient", "مریض کے لیے خون کی درخواست")}
          onClose={() => setIsAddOpen(false)}
        >
          <form onSubmit={handleCreateSubmit}>
            <Field
              label={t("Patient ID", "مریض کا شناختی نمبر")}
              hint={validationErrors.patient_id || t("Enter Patient ID to retrieve consent", "رضامندی معلوم کرنے کے لیے مریض آئی ڈی درج کریں")}
            >
              <input
                data-help="blood_request.patient_id"
                type="number"
                value={patientIdInput}
                onChange={(e) => {
                  setPatientIdInput(e.target.value);
                  setSelectedConsentId("");
                }}
                placeholder={t("e.g. 101", "مثلاً 101")}
                required
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field
                label={t("Admission ID (Inpatient)", "داخلہ نمبر")}
                hint={validationErrors.stay}
              >
                <input
                  data-help="blood_request.patient_id"
                  type="number"
                  value={admissionIdInput}
                  onChange={(e) => setAdmissionIdInput(e.target.value)}
                  placeholder={t("Admission ID", "داخلہ نمبر")}
                />
              </Field>

              <Field
                label={t("ER Visit ID (Emergency)", "ایمرجنسی وزٹ نمبر")}
              >
                <input
                  data-help="blood_request.patient_id"
                  type="number"
                  value={erVisitIdInput}
                  onChange={(e) => setErVisitIdInput(e.target.value)}
                  placeholder={t("ER Visit ID", "ایمرجنسی وزٹ نمبر")}
                />
              </Field>
            </div>

            {/* Transfusion Consent Selection */}
            <Field
              label={t("Patient Transfusion Consent", "مریض کی باخبر رضامندی برائے انتقال خون")}
              hint={validationErrors.consent_id || t("Pick Given consent of this stay", "اس داخلے کی باضابطہ دی گئی رضامندی منتخب کریں")}
            >
              {patientIdInput.trim() && consentsState.loading ? (
                <p>{t("Checking transfusion consents...", "رضامندی کی تصدیق کی جا رہی ہے...")}</p>
              ) : availableConsents.length > 0 ? (
                <select
                  data-help="blood_request.consent_select"
                  value={selectedConsentId}
                  onChange={(e) => setSelectedConsentId(e.target.value)}
                  required
                >
                  <option value="">{t("-- Select Given transfusion consent --", "-- منظور شدہ رضامندی منتخب کریں --")}</option>
                  {availableConsents.map((c) => (
                    <option key={c.consent_id} value={c.consent_id}>
                      {c.consent_number} ({c.status} - {c.mode})
                    </option>
                  ))}
                </select>
              ) : patientIdInput.trim() ? (
                <div className="notice" style={{ borderColor: "orange" }}>
                  <p>
                    {t(
                      "No Given transfusion consent found for this patient stay (BLOOD_CONSENT_REQUIRED).",
                      "اس مریض کے لیے انتقال خون کی باضابطہ دی گئی رضامندی موجود نہیں ہے۔",
                    )}
                  </p>
                  <button
                    data-help="blood_request.consent_link"
                    type="button"
                    onClick={() => {
                      setIsAddOpen(false);
                      if (onNavigateToConsent) onNavigateToConsent();
                    }}
                  >
                    {t("Open Doctor Consents screen", "ڈاکٹر رضامندی اسکرین پر جائیں")}
                  </button>
                </div>
              ) : (
                <p style={{ color: "var(--muted, #666)" }}>
                  {t("Enter patient ID to search for transfusion consent.", "رضامندی تلاش کرنے کے لیے مریض آئی ڈی درج کریں۔")}
                </p>
              )}
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field label={t("Blood component", "خون کا جزو")} hint={validationErrors.component}>
                <select
                  data-help="blood_request.component"
                  value={component}
                  onChange={(e) => setComponent(e.target.value as BloodComponent)}
                  required
                >
                  {BLOOD_COMPONENTS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.en} ({c.ur})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("Units requested (1-20)", "مطلوبہ یونٹس (1 تا 20)")} hint={validationErrors.units_requested}>
                <input
                  data-help="blood_request.units"
                  type="number"
                  min={1}
                  max={20}
                  value={unitsRequested}
                  onChange={(e) => setUnitsRequested(Number(e.target.value))}
                  required
                />
              </Field>
            </div>

            <Field label={t("Urgency", "فوری ضرورت")} hint={validationErrors.urgency}>
              <select
                data-help="blood_request.urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as BloodUrgency)}
                required
              >
                {BLOOD_URGENCIES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.en}
                  </option>
                ))}
              </select>
            </Field>

            {urgency === "Emergency" && (
              <Field
                label={t("Uncrossmatched blood authorization note", "بغیر کراس میچ خون کی اجازت نامہ / نوٹ")}
                hint={validationErrors.uncrossmatched_note || t("Doctor's clinical justification for uncrossmatched blood", "بغیر ٹیسٹ فوری خون جاری کرنے کا ڈاکٹر کا تحریری نوٹ")}
              >
                <textarea
                  data-help="blood_request.uncrossmatched_note"
                  rows={2}
                  value={uncrossmatchedNote}
                  onChange={(e) => setUncrossmatchedNote(e.target.value)}
                  placeholder={t("Reason authorizing uncrossmatched release in life-threatening emergency...", "ہنگامی بنیادوں پر بغیر مطابقت ٹیسٹ خون جاری کرنے کا قانونی جواز...")}
                />
              </Field>
            )}

            <Field label={t("Clinical indication", "طبی ضرورت و وجہ")} hint={validationErrors.indication}>
              <textarea
                data-help="blood_request.indication"
                rows={2}
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder={t("Document clinical reason, e.g. severe postpartum hemorrhage, acute trauma...", "خون کی ضرورت کی تفصیلی طبی وجہ درج کریں...")}
                required
              />
            </Field>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_request.submit"
                disabled={write.busy || !live || !selectedConsentId}
              >
                {t("Submit blood request", "درخواست ارسال کریں")}
              </button>
              <button
                type="button"
                data-help="blood_request.dialog_close"
                onClick={() => setIsAddOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Close Blood Request Modal */}
      {closeTarget && (
        <Modal
          title={t("Close blood request (Fulfilled)", "خون کی درخواست مکمل و بند کریں")}
          onClose={() => setCloseTarget(null)}
        >
          <form onSubmit={handleCloseSubmit}>
            <p>
              {t(
                "Closing request #",
                "درخواست نمبر بند کی جا رہی ہے: ",
              )}
              <strong>{closeTarget.request_number}</strong>
            </p>
            <Field label={t("Closing note", "بند کرنے کا نوٹ")} hint={t("e.g. transfusion completed, target Hb reached", "مثلاً ٹرانسفیوژن مکمل، ہیموگلوبن تسلی بخش")}>
              <textarea
                data-help="blood_request.close_note"
                rows={3}
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder={t("Clinical reason why no more blood is needed...", "مزید خون کی ضرورت نہ رہنے کی طبی وجہ...")}
                required
              />
            </Field>
            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_request.close_confirm"
                disabled={write.busy || !live}
              >
                {t("Confirm close request", "درخواست بند کریں")}
              </button>
              <button
                type="button"
                data-help="blood_request.dialog_close"
                onClick={() => setCloseTarget(null)}
              >
                {t("Dismiss", "واپس")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Blood Request Modal */}
      {cancelTarget && (
        <Modal
          title={t("Cancel blood request", "خون کی درخواست منسوخ کریں")}
          onClose={() => setCancelTarget(null)}
        >
          <form onSubmit={handleCancelSubmit}>
            <p style={{ color: "red" }}>
              {t(
                "Cancelling request #",
                "درخواست منسوخ کی جا رہی ہے: ",
              )}
              <strong>{cancelTarget.request_number}</strong>
            </p>
            <p style={{ fontSize: "0.9rem" }}>
              {t(
                "Requests can only be cancelled before any blood units were issued or transfused.",
                "درخواست صرف اسی صورت منسوخ ہو سکتی ہے جب کوئی یونٹ جاری نہ ہوا ہو۔",
              )}
            </p>
            <Field label={t("Cancellation reason", "منسوخی کی وجہ")}>
              <textarea
                data-help="blood_request.cancel_reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("Document reason for cancellation...", "منسوخی کی وجوہات درج کریں...")}
                required
              />
            </Field>
            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_request.cancel_confirm"
                className="danger"
                disabled={write.busy || !live}
              >
                {t("Confirm cancellation", "منسوخی کی تصدیق")}
              </button>
              <button
                type="button"
                data-help="blood_request.dialog_close"
                onClick={() => setCancelTarget(null)}
              >
                {t("Dismiss", "واپس")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
