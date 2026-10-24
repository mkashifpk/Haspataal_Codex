import { useEffect, useRef, useState } from "react";
import { StaffPicker } from "../StaffPicker";
import { api, ApiError } from "../bridge";
import { ErrorBox, Field, LoadState, useLoad } from "../components";
import * as registration from "../generated/registration";
import * as patients from "../generated/patient_search";
import { RegistrationDocuments } from "./RegistrationDocuments";
import { RegistrationActions } from "./RegistrationActions";
import { tr, bilingual as t } from "../i18n";
import { writeAttempt, canRetryWrite, definiteWriteRefusal, type WriteAttempt } from "../write-attempt";

type Mode = "new" | "returning";

export function Registration({
  user,
  revision,
}: {
  user: { permissions: string[] };
  revision: number;
}) {
  const permitted = user.permissions.includes("opd.ticket.create");
  const canSearch =
    user.permissions.includes("patient.search") &&
    user.permissions.includes("patient.view");
  const catalog = useLoad(
    () => registration.serviceCatalog({ category: "OPD" }),
    [revision],
  );
  const panels = useLoad(
    () =>
      api<{ panel_id: number; name: string; is_active: boolean }[]>(
        "GET",
        "/finance/panels",
      ),
    [],
  );
  const establishment = useLoad(
    () => api<{ active: string[] }>("GET", "/establishment"),
    [revision],
  );
  const dashboard = useLoad(
    () =>
      user.permissions.includes("opd.queue.view")
        ? registration.receptionDashboard()
        : Promise.resolve(null),
    [revision],
  );
  const [extras, setExtras] = useState<Partial<registration.PatientCreate>>({});
  const [billing, setBilling] = useState<"Cash" | "Panel">("Cash");
  const [panelId, setPanelId] = useState("");
  const [member, setMember] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState<"Cash" | "Card" | "BankTransfer">(
    "Cash",
  );
  const [payReference, setPayReference] = useState("");
  const [bypass, setBypass] = useState(false);
  const [override, setOverride] = useState("");
  const [onlyPatient, setOnlyPatient] = useState(false);
  const [patientRecord, setPatientRecord] =
    useState<registration.PatientDetailOut>();
  const [generation, setGeneration] = useState(0);
  const [resume, setResume] = useState("");
  const [mode, setMode] = useState<Mode>("new");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<unknown>();
  const [hits, setHits] = useState<patients.PatientSearchHitOut[]>([]);
  const [selected, setSelected] = useState<patients.PatientDetailOut>();
  const [selectionError, setSelectionError] = useState<unknown>();
  const selectionGeneration = useRef(0);
  const searchGeneration = useRef(0);
  const [name, setName] = useState("");
  const [gender, setGender] =
    useState<registration.PatientCreate["gender"]>("unknown");
  const [age, setAge] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [cnic, setCnic] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [source, setSource] =
    useState<registration.RegistrationIn["source"]>("WalkIn");
  const [busy, setBusy] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [documentsPending, setDocumentsPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const referenceField =
    error instanceof ApiError &&
    error.response.error?.code === "REFERENCE_NOT_FOUND"
      ? error.response.error.details?.field
      : undefined;
  const [result, setResult] = useState<registration.RegistrationOut>();
  const contextId =
    result?.patient_id || patientRecord?.patient_id || selected?.patient_id;
  const context = useLoad(
    () => (contextId ? patients.getPatient(contextId) : Promise.resolve(null)),
    [contextId, revision],
  );
  const [uncertain, setUncertain] = useState(false);
  const pendingPatient = useRef<WriteAttempt<registration.PatientCreate> | null>(null);
  const pendingBody = useRef<WriteAttempt<registration.RegistrationIn> | null>(null);
  const registrationFlight = useRef(false);

  useEffect(() => {
    const generation = ++searchGeneration.current;
    setHits([]);
    setSearchError(undefined);
    if (mode !== "returning" || query.trim().length < 2 || !canSearch) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await patients.search({ q: query.trim(), limit: 20 });
        if (generation === searchGeneration.current) setHits(found);
      } catch (cause) {
        if (generation === searchGeneration.current) setSearchError(cause);
      } finally {
        if (generation === searchGeneration.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [mode, query, canSearch, revision]);

  async function selectPatient(id: number) {
    const generation = ++selectionGeneration.current;
    setSelected(undefined);
    setSelectionError(undefined);
    try {
      const detail = await patients.getPatient(id);
      if (generation === selectionGeneration.current) setSelected(detail);
    } catch (cause) {
      if (generation === selectionGeneration.current) setSelectionError(cause);
    }
  }

  async function issue(body: registration.RegistrationIn) {
    if (registrationFlight.current) return;
    const attempt = pendingBody.current || writeAttempt(body);
    pendingBody.current = attempt;
    if (!canRetryWrite(attempt)) {
      setError(new Error("The original request is outside the safe retry window. Ask IT to reconcile it; do not register or pay again."));
      setUncertain(true);
      return;
    }
    registrationFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const created = await api<registration.RegistrationOut>("POST", "/reception/registrations", attempt.body, {key:attempt.key});
      pendingBody.current = null;
      setUncertain(false);
      setResult(created);
    } catch (cause) {
      setError(cause);
      const refused = definiteWriteRefusal(cause);
      if (refused) pendingBody.current = null;
      setUncertain(!refused);
    } finally {
      registrationFlight.current = false;
      setBusy(false);
    }
  }

  async function savePatient(body: registration.PatientCreate) {
    if (registrationFlight.current) return;
    const attempt = pendingPatient.current || writeAttempt(body);
    pendingPatient.current = attempt;
    if (!canRetryWrite(attempt)) {
      setError(new Error("The original request is outside the safe retry window. Ask IT to reconcile it; do not register or pay again."));
      setUncertain(true);
      return;
    }
    registrationFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      setPatientRecord(await api<registration.PatientDetailOut>("POST", "/patients", attempt.body, {key:attempt.key}));
      pendingPatient.current = null;
      setUncertain(false);
    } catch (cause) {
      setError(cause);
      const refused = definiteWriteRefusal(cause);
      if (refused) pendingPatient.current = null;
      setUncertain(!refused);
    } finally {
      registrationFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selected) void selectPatient(selected.patient_id);
  }, [revision]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (registrationFlight.current || busy || result || patientRecord || uncertain || !permitted) return;
    if (
      source === "Emergency" &&
      !establishment.data?.active.includes("emergency_department")
    ) {
      setError(
        new Error(
          "The emergency service is not active. Refresh facility services before starting emergency work.",
        ),
      );
      return;
    }
    const service = catalog.data?.find(
      (item) => item.service_id === Number(serviceId) && item.is_active,
    );
    if (!service && !onlyPatient) {
      setError(
        new Error("Choose an active OPD service from the hospital catalog."),
      );
      return;
    }
    if (mode === "returning" && !selected) {
      setError(
        new Error(
          "Select a returning patient from the hospital search results.",
        ),
      );
      return;
    }
    if (mode === "new" && !dob && !age) {
      setError(new Error("Enter a date of birth or age in years."));
      return;
    }
    if (
      mode === "returning" &&
      (selected?.is_deceased || selected?.registration_type === "Merged")
    ) {
      setError(
        new Error(
          "This patient record cannot start a new visit. Check the current master record.",
        ),
      );
      return;
    }
    if (mode === "new" && billing === "Panel" && !panelId) {
      setError(new Error("Choose a panel for panel billing."));
      return;
    }
    if (onlyPatient && mode === "new") {
      await savePatient({
        ...extras,
        full_name: name.trim(),
        gender,
        mobile: mobile.trim(),
        ...(dob ? { dob } : { age_years: Number(age) }),
        ...(cnic.trim() ? { cnic: cnic.trim() } : {}),
        billing_category: billing,
        ...(billing === "Panel"
          ? { panel_id: Number(panelId), panel_member_no: member || null }
          : {}),
      });
      return;
    }
    const body: registration.RegistrationIn = {
      ...(mode === "new"
        ? {
            new_patient: {
              ...extras,
              full_name: name.trim(),
              gender,
              mobile: mobile.trim(),
              ...(dob ? { dob } : { age_years: Number(age) }),
              ...(cnic.trim() ? { cnic: cnic.trim() } : {}),
              billing_category: billing,
              ...(billing === "Panel"
                ? { panel_id: Number(panelId), panel_member_no: member || null }
                : {}),
            },
          }
        : { patient_id: selected!.patient_id }),
      service_id: service!.service_id,
      doctor_id: service!.doctor_id,
      department_id: service!.department_id,
      source,
      discount_amount: discount,
      ...(Number(discount) > 0 ? { discount_reason: discountReason } : {}),
      ...(payNow
        ? {
            payment: {
              method: payMethod,
              ...(payReference ? { reference_no: payReference } : {}),
            },
          }
        : {}),
      ...(source === "Emergency" ? { emergency_bypass: bypass } : {}),
      ...(override.trim() ? { ar_override_reason: override.trim() } : {}),
    };
    pendingBody.current = writeAttempt(body);
    await issue(body);
  }

  function resetDraft() {
    if (document.querySelector('[data-write-pending="true"]')) return;
    if (
      document.querySelector('[data-unsaved="true"]') &&
      !window.confirm("Discard optional files that have not been uploaded?")
    )
      return;
    setResult(undefined);
    setPatientRecord(undefined);
    setGeneration((n) => n + 1);
    setName("");
    setGender("unknown");
    setAge("");
    setDob("");
    setMobile("");
    setCnic("");
    setExtras({});
    setBilling("Cash");
    setPanelId("");
    setMember("");
    setDiscount("0");
    setDiscountReason("");
    setPayNow(false);
    setPayReference("");
    setBypass(false);
    setOverride("");
    setSource("WalkIn");
    setSelected(undefined);
    setQuery("");
    setServiceId("");
    setOnlyPatient(false);
    setMode("new");
    setError(undefined);
    setUncertain(false);
    pendingBody.current = null;
    pendingPatient.current = null;
  }
  if (!permitted)
    return (
      <div className="card" role="alert">
        <h2>{tr("Access denied")}</h2>
        <p>{tr("Your account cannot issue OPD slips.")}</p>
      </div>
    );
  const activeServices = catalog.data?.filter((item) => item.is_active) || [];
  const refusal = error instanceof ApiError ? error.response.error : undefined;
  const ceiling = refusal?.code === "DISCOUNT_CEILING_EXCEEDED" ? refusal.details : undefined;
  const rawMaximum = ceiling?.max_amount;
  const maximumDiscount = typeof rawMaximum === "number" ? rawMaximum
    : typeof rawMaximum === "string" && /^\d+(\.\d+)?$/.test(rawMaximum) ? Number(rawMaximum) : undefined;
  const draftDiscount = maximumDiscount !== undefined && Number.isFinite(maximumDiscount) && maximumDiscount >= 0 ? maximumDiscount : 0;
  const dues = refusal?.code === "AR_OUTSTANDING_BLOCK" ? refusal.details?.outstanding as {banner_text?:unknown} | undefined : undefined;

  return (
    <div
      data-write-pending={busy || uncertain || actionPending}
      data-unsaved={!result && !patientRecord && !!(name || mobile || query)}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{tr("RECEPTION")}</span>
          <h1>{tr("New registration + OPD slip")}</h1>
          <p className="muted">
            {tr(
              "Register the patient, issue an OPD slip, collect payment, and print. Photos and outside reports are optional.",
            )}
          </p>
        </div>
      </div>
      {!result && !patientRecord && !busy && !uncertain && (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(undefined);
            try {
              const ticket = await api<registration.OpdTicketDetailOut>(
                "GET",
                `/opd-tickets/by-number/${encodeURIComponent(resume.trim())}`,
              );
              const payload = await registration.printPayload(ticket.ticket_id);
              setResult({
                ...ticket,
                payment: null,
                queue_entry_created: !!ticket.queue,
                print_payload: payload,
              });
            } catch (cause) {
              setError(cause);
            }
          }}
        >
          <Field label={tr("Open an existing OPD slip")}>
            <input data-help="registration.intake"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="OPD-2026-000003"
              required
            />
          </Field>
          <button data-help="registration.intake">{tr("Open ticket")}</button>
        </form>
      )}
      {patientRecord && (
        <section className="card" role="status">
          <h2>{tr("Patient registered")}</h2>
          <strong>
            {patientRecord.full_name} · {patientRecord.mrn}
          </strong>
          <p>{tr("No OPD visit was issued.")}</p>
          <button data-help="registration.intake" disabled={documentsPending} onClick={resetDraft}>
            {tr("Start another registration")}
          </button>
        </section>
      )}
      {result ? (
        <section className="card" role="status">
          <h2>{tr("OPD slip issued")}</h2>
          <dl className="details">
            <div>
              <dt>{tr("Patient")}</dt>
              <dd>
                {result.patient_name} · {result.mrn}
              </dd>
            </div>
            <div>
              <dt>{tr("Ticket")}</dt>
              <dd>{result.ticket_number}</dd>
            </div>
            <div>
              <dt>{tr("Doctor / department")}</dt>
              <dd>{result.doctor_name || result.department_name || "—"}</dd>
            </div>
            <div>
              <dt>{tr("Amount due")}</dt>
              <dd>
                {result.invoice?.balance_due ?? result.net_payable ?? "—"}
              </dd>
            </div>
            <div>
              <dt>{tr("Payment")}</dt>
              <dd>{result.payment_status}</dd>
            </div>
            <div>
              <dt>{tr("Queue")}</dt>
              <dd>
                {result.queue_entry_created
                  ? result.queue?.token_no
                  : tr("Not queued until payment")}
              </dd>
            </div>
          </dl>
          <p className="muted">
            {tr(
              "Use this ticket for payment, approvals and reprinting. Do not register the same visit again.",
            )}
          </p>
          <button data-help="registration.intake"
            type="button"
            disabled={actionPending || documentsPending}
            onClick={resetDraft}
          >
            {tr("Start another registration")}
          </button>
        </section>
      ) : (
        !patientRecord && (
          <form className="card" onSubmit={(event) => void submit(event)}>
            <fieldset
              disabled={busy || uncertain}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              <div className="actions">
                <button data-help="registration.intake"
                  type="button"
                  className={mode === "new" ? "primary" : ""}
                  onClick={() => {
                    setMode("new");
                    setSelected(undefined);
                  }}
                >
                  {tr("New patient")}
                </button>
                <button data-help="registration.intake"
                  type="button"
                  className={mode === "returning" ? "primary" : ""}
                  disabled={!canSearch}
                  onClick={() => {
                    setMode("returning");
                    setOnlyPatient(false);
                  }}
                >
                  {tr("Returning patient")}
                </button>
              </div>
              {mode === "new" ? (
                <div className="form-grid">
                  <Field label={tr("Full name")}>
                    <input data-help="registration.intake"
                      aria-label={tr("Full name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={200}
                    />
                  </Field>
                  <Field label={tr("Gender")}>
                    <select data-help="registration.intake"
                      aria-label={tr("Gender")}
                      value={gender}
                      onChange={(e) =>
                        setGender(
                          e.target
                            .value as registration.PatientCreate["gender"],
                        )
                      }
                    >
                      {["unknown", "male", "female", "other"].map((value) => (
                        <option key={value} value={value}>
                          {tr(value)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={tr("Age in years")}
                    hint={tr("Enter age or date of birth.")}
                  >
                    <input data-help="registration.intake"
                      aria-label={tr("Age in years")}
                      type="number"
                      min="0"
                      max="150"
                      value={age}
                      onChange={(e) => {
                        setAge(e.target.value);
                        if (e.target.value) setDob("");
                      }}
                    />
                  </Field>
                  <Field label={tr("Date of birth")}>
                    <input data-help="registration.intake"
                      aria-label={tr("Date of birth")}
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        if (e.target.value) setAge("");
                      }}
                    />
                  </Field>
                  <Field label={tr("Mobile")}>
                    <input data-help="registration.intake"
                      aria-label={tr("Mobile")}
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                      pattern="\+?[0-9][0-9 -]{6,19}"
                    />
                  </Field>
                  <Field label={tr("CNIC (optional)")}>
                    <input data-help="registration.intake"
                      aria-label={tr("CNIC (optional)")}
                      value={cnic}
                      onChange={(e) => setCnic(e.target.value)}
                      pattern="[0-9]{5}-?[0-9]{7}-?[0-9]"
                    />
                  </Field>
                </div>
              ) : (
                <>
                  <Field
                    label={tr("Search patient")}
                    hint={tr(
                      "Search by name, MRN, mobile, or CNIC. Check identity before selecting.",
                    )}
                  >
                    <input data-help="registration.intake"
                      type="search"
                      aria-label={tr("Search patient")}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSelected(undefined);
                        ++selectionGeneration.current;
                      }}
                    />
                  </Field>
                  {searching && (
                    <p role="status">{tr("Searching the hospital records…")}</p>
                  )}
                  <ErrorBox error={searchError} />
                  <ErrorBox error={selectionError} />
                  {query.length >= 2 &&
                    !searching &&
                    !searchError &&
                    hits.length === 0 && (
                      <p>
                        {tr(
                          "No matching patients. Check spelling or register a new patient.",
                        )}
                      </p>
                    )}
                  {hits.length > 0 && (
                    <div className="results-list registration-results">
                      {hits.map((hit) => (
                        <button data-help="registration.intake"
                          type="button"
                          key={hit.patient_id}
                          aria-pressed={selected?.patient_id === hit.patient_id}
                          onClick={() => void selectPatient(hit.patient_id)}
                        >
                          <strong>{hit.full_name}</strong>
                          <span>
                            <bdi>{hit.mrn}</bdi> ·{" "}
                            <bdi>{hit.mobile || "—"}</bdi>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selected && (
                    <div className="notice">
                      <strong>
                        {selected.full_name} · {selected.mrn}
                      </strong>
                      <p>
                        {selected.mobile || tr("No mobile recorded")} ·{" "}
                        {selected.gender} ·{" "}
                        {selected.dob ||
                          `${selected.age_years ?? "—"} ${tr("years")}`}
                      </p>
                      <p>
                        {tr("Allergies")}:{" "}
                        {selected.allergies || tr("Not recorded")} ·{" "}
                        {tr("Blood group")}:{" "}
                        {selected.blood_group || tr("Not recorded")}
                      </p>
                      {!!selected.mlc_numbers.length && (
                        <p role="alert">
                          {tr("Medico-legal case")}:{" "}
                          {selected.mlc_numbers.join(", ")}
                        </p>
                      )}
                      {selected.outstanding.has_outstanding_ar && (
                        <p role="alert">
                          {selected.outstanding.banner_text ||
                            `${tr("Outstanding dues")}: ${selected.outstanding.outstanding_ar_balance}`}
                        </p>
                      )}
                      {selected.is_deceased && (
                        <p role="alert">
                          {tr("Deceased patient — cannot issue a new visit.")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {mode === "new" && (
                <>
                  <div className="form-grid">
                    {(
                      [
                        [
                          "father_or_husband_name",
                          "Father / husband name",
                          200,
                        ],
                        ["address", "Address", 500],
                        [
                          "emergency_contact_name",
                          "Emergency contact name",
                          200,
                        ],
                        [
                          "emergency_contact_phone",
                          "Emergency contact phone",
                          30,
                        ],
                        [
                          "allergies",
                          "Allergies (not recorded if blank)",
                          1000,
                        ],
                      ] as const
                    ).map(([field, label, max]) => (
                      <Field key={field} label={tr(label)}>
                        <input data-help="registration.intake"
                          value={String(extras[field] || "")}
                          maxLength={max}
                          onChange={(e) =>
                            setExtras((x) => ({
                              ...x,
                              [field]: e.target.value || null,
                            }))
                          }
                        />
                      </Field>
                    ))}
                    <Field label={tr("Blood group")}>
                      <select data-help="registration.intake"
                        aria-label={tr("Blood group")}
                        value={extras.blood_group || ""}
                        onChange={(e) =>
                          setExtras((x) => ({
                            ...x,
                            blood_group: (e.target.value ||
                              null) as registration.PatientCreate["blood_group"],
                          }))
                        }
                      >
                        <option value="">{tr("Not recorded")}</option>
                        {[
                          "A+",
                          "A-",
                          "B+",
                          "B-",
                          "AB+",
                          "AB-",
                          "O+",
                          "O-",
                          "Unknown",
                        ].map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={tr("Billing category")}>
                      <select data-help="registration.intake"
                        aria-label={tr("Billing category")}
                        value={billing}
                        onChange={(e) =>
                          setBilling(e.target.value as typeof billing)
                        }
                      >
                        <option>Cash</option>
                        <option>Panel</option>
                      </select>
                    </Field>
                    {billing === "Panel" && (
                      <>
                        <LoadState {...panels} retry={panels.reload} />
                        {!panels.loading &&
                          !panels.error &&
                          !panels.data?.some((p) => p.is_active) && (
                            <p role="status">
                              {tr(
                                "No active panels are configured. Ask billing administration to add one, or choose Cash billing.",
                              )}
                            </p>
                          )}
                        <Field label={tr("Panel")}>
                          <select data-help="registration.intake"
                            aria-label={tr("Panel")}
                            required
                            value={panelId}
                            onChange={(e) => setPanelId(e.target.value)}
                          >
                            <option value="">{tr("Choose a panel")}</option>
                            {panels.data
                              ?.filter((p) => p.is_active)
                              .map((p) => (
                                <option value={p.panel_id} key={p.panel_id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label={tr("Panel member number")}>
                          <input data-help="registration.intake"
                            value={member}
                            maxLength={50}
                            onChange={(e) => setMember(e.target.value)}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                  <StaffPicker
                    label={tr("Staff member (payroll link)")}
                    value={extras.linked_employee_id}
                    invalid={referenceField === "linked_employee_id"}
                    onSelect={(id) => {
                      setExtras((x) => ({ ...x, linked_employee_id: id }));
                      if (referenceField === "linked_employee_id")
                        setError(undefined);
                    }}
                  />
                  <label>
                    <input data-help="registration.intake"
                      type="checkbox"
                      checked={onlyPatient}
                      disabled={!user.permissions.includes("patient.create")}
                      onChange={(e) => setOnlyPatient(e.target.checked)}
                    />
                    {tr("Patient record only — no OPD visit")}
                  </label>
                </>
              )}
              {!onlyPatient && (
                <>
                  <LoadState {...catalog} retry={catalog.reload} />
                  <div className="form-grid">
                    <Field label={tr("OPD service")}>
                      <select data-help="registration.intake"
                        aria-label={tr("OPD service")}
                        aria-invalid={[
                          "service_id",
                          "doctor_id",
                          "department_id",
                        ].includes(String(referenceField))}
                        required
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                      >
                        <option value="">{tr("Choose a service")}</option>
                        {activeServices.map((item) => (
                          <option key={item.service_id} value={item.service_id}>
                            {item.name} · {item.default_price}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={tr("Visit source")}>
                      <select data-help="registration.intake"
                        aria-label={tr("Visit source")}
                        value={source}
                        onChange={(e) =>
                          setSource(
                            e.target
                              .value as registration.RegistrationIn["source"],
                          )
                        }
                      >
                        <option value="WalkIn">{tr("Walk in")}</option>
                        <option value="ReturnVisit">
                          {tr("Return visit")}
                        </option>
                        <option value="Referred">{tr("Referred")}</option>
                        {establishment.data?.active.includes(
                          "emergency_department",
                        ) && (
                          <option value="Emergency">{tr("Emergency")}</option>
                        )}
                      </select>
                    </Field>
                  </div>
                  {activeServices.length === 0 &&
                    !catalog.loading &&
                    !catalog.error && (
                      <p role="status">
                        {tr(
                          "No active OPD services are available. Ask billing administration to configure one.",
                        )}
                      </p>
                    )}
                  <div className="form-grid">
                    <Field label={tr("Discount amount")}>
                      <input data-help="registration.intake"
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </Field>
                    <Field label={tr("Discount reason")}>
                      <input data-help="registration.intake"
                        value={discountReason}
                        maxLength={300}
                        required={Number(discount) > 0}
                        onChange={(e) => setDiscountReason(e.target.value)}
                      />
                    </Field>
                  </div>
                  {source === "Emergency" && (
                    <label>
                      <input data-help="registration.intake"
                        type="checkbox"
                        checked={bypass}
                        onChange={(e) => setBypass(e.target.checked)}
                      />
                      {tr(
                        "Emergency bypass: do not delay the queue for payment or outstanding dues",
                      )}
                    </label>
                  )}
                  {user.permissions.includes("opd.ticket.ar_override") && (
                    <Field label={tr("Outstanding dues override reason")}>
                      <input data-help="registration.intake"
                        maxLength={300}
                        value={override}
                        onChange={(e) => setOverride(e.target.value)}
                      />
                    </Field>
                  )}
                  <label>
                    <input data-help="registration.intake"
                      type="checkbox"
                      checked={payNow}
                      disabled={
                        !user.permissions.includes("finance.payment.collect")
                      }
                      onChange={(e) => setPayNow(e.target.checked)}
                    />
                    {tr("Collect full payment now")}
                  </label>
                  {payNow && (
                    <div className="form-grid">
                      <Field label={tr("Payment method")}>
                        <select data-help="registration.intake"
                          value={payMethod}
                          onChange={(e) =>
                            setPayMethod(e.target.value as typeof payMethod)
                          }
                        >
                          {["Cash", "Card", "BankTransfer"].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label={tr("Card / bank reference")}>
                        <input data-help="registration.intake"
                          required={payMethod !== "Cash"}
                          maxLength={60}
                          value={payReference}
                          onChange={(e) => setPayReference(e.target.value)}
                        />
                      </Field>
                    </div>
                  )}
                  <LoadState {...establishment} retry={establishment.reload} />
                </>
              )}
            </fieldset>
            <ErrorBox error={error} />
            {ceiling && (
              <aside className="notice" role="alert">
                <p>{t("Discount limit returned by the server", "سرور کی بتائی ہوئی رعایت کی حد")}: <bdi>{String(ceiling.max_pct ?? "—")}%</bdi> · <bdi>{rawMaximum == null ? "—" : String(rawMaximum)}</bdi></p>
                <p>{t("For a larger concession, issue an unpaid slip within your limit, then use Request VIP waiver in Payment, approval and printing. An eligible approver decides the requested percentage. Preparing the draft does not register, collect money or submit a waiver.", "زیادہ رعایت کے لیے اپنی حد کے اندر غیر ادا پرچی جاری کریں، پھر ادائیگی، منظوری اور پرنٹ میں وی آئی پی رعایت مانگیں۔ مجاز فرد درخواست کی شرح کا فیصلہ کرے گا۔ مسودہ تیار کرنے سے رجسٹریشن، وصولی یا رعایت کی درخواست نہیں ہوتی۔")}</p>
                <button type="button" data-help="registration.intake" disabled={busy || uncertain} onClick={() => {setDiscount(String(draftDiscount));setPayNow(false);}}>
                  {maximumDiscount === undefined ? t("Prepare unpaid slip with no discount", "بغیر رعایت غیر ادا پرچی تیار کریں") : t("Prepare unpaid slip within my limit", "اپنی حد کے اندر غیر ادا پرچی تیار کریں")}
                </button>
              </aside>
            )}
            {typeof dues?.banner_text === "string" && <p className="error" role="alert">{dues.banner_text}</p>}
            {uncertain && (
              <p role="alert">
                {tr(
                  "The server answer was lost or failed. Retry the same registration to confirm its outcome; do not start a new one.",
                )}
              </p>
            )}
            <div className="actions">
              <button data-help="registration.intake"
                type="submit"
                className="primary"
                disabled={
                  busy ||
                  catalog.loading ||
                  !!catalog.error ||
                  (!onlyPatient && !serviceId) ||
                  uncertain ||
                  (mode === "returning" && !selected)
                }
              >
                {busy
                  ? tr("Issuing…")
                  : onlyPatient
                    ? tr("Register patient only")
                    : payNow
                      ? tr("Register and collect payment")
                      : tr("Issue unpaid OPD slip")}
              </button>
              {uncertain && (pendingBody.current || pendingPatient.current) && (
                <button data-help="registration.intake"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    pendingPatient.current
                      ? void savePatient(pendingPatient.current.body)
                      : void issue(pendingBody.current!.body)
                  }
                >
                  {tr("Retry same registration")}
                </button>
              )}
            </div>
          </form>
        )
      )}
      {result && (
        <RegistrationActions
          key={result.ticket_id}
          ticketId={result.ticket_id}
          permissions={user.permissions}
          revision={revision}
          onPending={setActionPending}
          onTicket={(ticket) =>
            setResult((current) =>
              current
                ? { ...current, ...ticket, queue_entry_created: !!ticket.queue }
                : current,
            )
          }
        />
      )}
      {(result || patientRecord) && (
        <section className="card">
          <h2>{tr("Patient identity")}</h2>
          <LoadState {...context} retry={context.reload} />
          {context.data && (
            <>
              <strong>
                {context.data.full_name} · {context.data.mrn}
              </strong>
              <p>
                {context.data.gender} ·{" "}
                {context.data.dob ||
                  `${context.data.age_years ?? "—"} ${tr("years")}`}
              </p>
              <p>
                {tr("Allergies")}:{" "}
                {context.data.allergies || tr("Not recorded")} ·{" "}
                {tr("Blood group")}:{" "}
                {context.data.blood_group || tr("Not recorded")}
              </p>
              {context.data.is_deceased && (
                <p role="alert">
                  {tr("Deceased patient — cannot issue a new visit.")}
                </p>
              )}
              {!!context.data.mlc_numbers.length && (
                <p role="alert">
                  {tr("Medico-legal case")}:{" "}
                  {context.data.mlc_numbers.join(", ")}
                </p>
              )}
              {context.data.outstanding.banner_text && (
                <p role="alert">{context.data.outstanding.banner_text}</p>
              )}
            </>
          )}
        </section>
      )}
      <RegistrationDocuments
        key={`${generation}-${mode}-${selected?.patient_id || "new"}`}
        patientId={
          result?.patient_id ||
          patientRecord?.patient_id ||
          selected?.patient_id
        }
        photoId={
          context.data?.photo_document_id ||
          patientRecord?.photo_document_id ||
          selected?.photo_document_id
        }
        permissions={user.permissions}
        onPending={setDocumentsPending}
        onChanged={context.reload}
      />
      {dashboard.data && (
        <section className="card">
          <h2>{tr("Live OPD queues")}</h2>
          {dashboard.data.queues.length === 0 && (
            <p>{tr("No patients are currently queued.")}</p>
          )}
          {dashboard.data.queues.map((q) => (
            <p key={q.queue_group}>
              {q.doctor_name || q.department_name} · {tr("Waiting")}:{" "}
              {q.waiting} · {tr("In consultation")}: {q.in_consultation}
            </p>
          ))}
        </section>
      )}
      {user.permissions.includes("opd.queue.view") && (
        <LoadState {...dashboard} retry={dashboard.reload} />
      )}
    </div>
  );
}
