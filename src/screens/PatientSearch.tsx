import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../i18n";
import * as pts from "../generated/patient_search";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
} from "../components";

const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
] as const;
const GENDERS = [
  { value: "male", label: "Male", labelUr: "مرد" },
  { value: "female", label: "Female", labelUr: "عورت" },
  { value: "other", label: "Other", labelUr: "دیگر" },
  { value: "unknown", label: "Unknown", labelUr: "نامعلوم" },
] as const;

export function PatientSearch({
  user,
  revision,
}: {
  user: any;
  revision: number;
}) {
  const canSearch =
    user?.permissions?.includes("patient.search") ||
    user?.permissions?.includes("patient.view");
  const canUpdate = user?.permissions?.includes("patient.update");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<unknown>();
  const [results, setResults] = useState<pts.PatientSearchHitOut[]>([]);
  const [searched, setSearched] = useState(false);

  // Selected patient & details
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [patient, setPatient] = useState<pts.PatientDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<unknown>();

  const selection = useRef<number | null>(null);
  const detailGeneration = useRef(0);
  const financialGeneration = useRef(0);
  const searchGeneration = useRef(0);
  const [editBase, setEditBase] = useState<pts.PatientDetailOut | null>(null);
  const [financialError, setFinancialError] = useState<unknown>();

  // Financial summary
  const [financials, setFinancials] = useState<pts.FinancialSummaryOut | null>(
    null,
  );
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);

  // Edit demographics modal
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<unknown>();
  const [versionConflict, setVersionConflict] = useState(false);

  // Edit form state
  const [formName, setFormName] = useState("");
  const [formGender, setFormGender] = useState<
    "male" | "female" | "other" | "unknown"
  >("unknown");
  const [formDob, setFormDob] = useState("");
  const [formAgeYears, setFormAgeYears] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formCnic, setFormCnic] = useState("");
  const [formFatherHusband, setFormFatherHusband] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formEmergencyName, setFormEmergencyName] = useState("");
  const [formEmergencyPhone, setFormEmergencyPhone] = useState("");
  const [formBloodGroup, setFormBloodGroup] = useState<string>("");
  const [formAllergies, setFormAllergies] = useState("");
  const [formBillingCat, setFormBillingCat] = useState<"Cash" | "Panel">(
    "Cash",
  );
  const [formPanelId, setFormPanelId] = useState("");
  const [formPanelMemberNo, setFormPanelMemberNo] = useState("");
  const [formUpgradeRegular, setFormUpgradeRegular] = useState(false);

  // Debounce search input (250ms per rule:5c7aabbadf)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string) => {
    const generation = ++searchGeneration.current;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(undefined);
    try {
      const hits = await pts.search({ q: trimmed, limit: 20 });
      if (generation !== searchGeneration.current) return;
      setResults(hits);
      setSearched(true);
    } catch (e) {
      if (generation === searchGeneration.current) setSearchError(e);
    } finally {
      if (generation === searchGeneration.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    ++searchGeneration.current;
    setSearching(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!query || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      void performSearch(query);
    }, 250);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, performSearch, revision]);

  // Handle barcode scanner (Enter key)
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      void performSearch(query);
    }
  }

  // Load single patient detail
  const loadPatientDetail = useCallback(async (id: number) => {
    const generation = ++detailGeneration.current;
    setLoadingDetail(true);
    setPatient(null);
    setDetailError(undefined);
    try {
      const p = await pts.getPatient(id);
      if (generation !== detailGeneration.current || selection.current !== id)
        return;
      setPatient(p);
    } catch (e) {
      if (generation === detailGeneration.current) setDetailError(e);
    } finally {
      if (generation === detailGeneration.current) setLoadingDetail(false);
    }
  }, []);

  // Load financial summary
  const loadFinancials = useCallback(async (id: number) => {
    const generation = ++financialGeneration.current;
    setLoadingFinancials(true);
    setFinancials(null);
    setFinancialError(undefined);
    try {
      const fin = await pts.financialSummary(id);
      if (
        generation !== financialGeneration.current ||
        selection.current !== id
      )
        return;
      setFinancials(fin);
    } catch (e) {
      if (generation === financialGeneration.current) setFinancialError(e);
    } finally {
      if (generation === financialGeneration.current)
        setLoadingFinancials(false);
    }
  }, []);

  function handleSelectPatient(p: pts.PatientSearchHitOut) {
    selection.current = p.patient_id;
    setSelectedId(p.patient_id);
    setShowFinancials(false);
    void loadPatientDetail(p.patient_id);
    void loadFinancials(p.patient_id);
  }

  // Realtime subscription for patient.merged
  useEffect(() => {
    if (!window.terminal) return;
    return window.terminal.subscribe((e) => {
      if (e.type === "event" && e.event_type === "patient.merged") {
        if (query.trim().length >= 2) {
          void performSearch(query);
        }
        if (selectedId) {
          void loadPatientDetail(selectedId);
          void loadFinancials(selectedId);
        }
      }
    });
  }, [query, selectedId, performSearch, loadPatientDetail, loadFinancials]);

  // Open edit modal and populate form
  function openEditModal(fresh?: pts.PatientDetailOut) {
    const source = fresh || patient;
    if (!source) return;
    const record = source;
    setEditBase(record);
    setFormName(record.full_name || "");
    setFormGender(record.gender || "unknown");
    setFormDob(record.dob || "");
    setFormAgeYears(record.age_years !== null ? String(record.age_years) : "");
    setFormMobile(record.mobile || "");
    setFormCnic(record.cnic || "");
    setFormFatherHusband(record.father_or_husband_name || "");
    setFormAddress(record.address || "");
    setFormEmergencyName(record.emergency_contact_name || "");
    setFormEmergencyPhone(record.emergency_contact_phone || "");
    setFormBloodGroup(record.blood_group || "");
    setFormAllergies(record.allergies || "");
    setFormBillingCat(record.billing_category || "Cash");
    setFormPanelId(record.panel_id !== null ? String(record.panel_id) : "");
    setFormPanelMemberNo(record.panel_member_no || "");
    setFormUpgradeRegular(false);
    setEditError(undefined);
    setVersionConflict(false);
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBase || versionConflict || editBusy) return;
    const patient = editBase;
    setEditBusy(true);
    setEditError(undefined);
    setVersionConflict(false);

    const body: pts.PatientUpdate = {
      expected_version: patient.row_version,
      full_name: formName || null,
      gender: formGender,
      dob: formDob || null,
      age_years: formAgeYears ? parseInt(formAgeYears, 10) : null,
      mobile: formMobile || null,
      cnic: formCnic || null,
      father_or_husband_name: formFatherHusband || null,
      address: formAddress || null,
      emergency_contact_name: formEmergencyName || null,
      emergency_contact_phone: formEmergencyPhone || null,
      blood_group: (formBloodGroup as any) || null,
      allergies: formAllergies || null,
      billing_category: formBillingCat,
      panel_id: formPanelId ? parseInt(formPanelId, 10) : null,
      panel_member_no: formPanelMemberNo || null,
      upgrade_to_regular: formUpgradeRegular,
    };

    try {
      const updated = await pts.updatePatient(patient.patient_id, body);
      setPatient(updated);
      setEditOpen(false);
      // Also update search results entry if present
      setResults((prev) =>
        prev.map((r) =>
          r.patient_id === updated.patient_id ? { ...r, ...updated } : r,
        ),
      );
    } catch (err: any) {
      setEditError(err);
      if (err?.response?.error?.code === "VERSION_CONFLICT") {
        setVersionConflict(true);
        // Keep the original version and draft until the user explicitly reloads.
      }
    } finally {
      setEditBusy(false);
    }
  }

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null) return "₨ 0.00";
    return `₨ ${Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (!canSearch) {
    return (
      <div className="card" role="alert">
        <h2>{tr("Access denied")}</h2>
        <p className="muted">
          {tr(
            "Your account does not have permission to search or view patient records.",
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{tr("RECEPTION & FRONT DESK")}</span>
          <h1>{tr("Patient search")}</h1>
          <p className="muted">
            {tr(
              "Find returning patients by MRN, mobile, CNIC or name; show outstanding dues banner.",
            )}
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <section className="card" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tr(
                "Type patient name, phone, CNIC, or MRN (barcode scanner + Enter)…",
              )}
              aria-label={tr("Patient search query")}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => void performSearch(query)}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? tr("Searching…") : tr("Search")}
          </button>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearched(false);
                selection.current = null;
                ++detailGeneration.current;
                ++financialGeneration.current;
                ++searchGeneration.current;
                setLoadingDetail(false);
                setLoadingFinancials(false);
                setFinancials(null);
                setFinancialError(undefined);
                setSelectedId(null);
                setPatient(null);
              }}
            >
              {tr("Clear")}
            </button>
          )}
        </div>
        {query.trim().length > 0 && query.trim().length < 2 && (
          <small className="muted" style={{ display: "block", marginTop: 8 }}>
            {tr(
              "Enter at least 2 characters to search (MRN barcode types automatically).",
            )}
          </small>
        )}
      </section>

      <ErrorBox error={searchError} />

      {/* Main Split Layout: Search Results (Left) & Selected Patient Details (Right) */}
      <div className="split patient-search-layout">
        {/* Left Column: Search Results */}
        <section className="card patient-results">
          <div className="patient-results-heading">
            <h3>{tr("Search results")}</h3>
            {searched && (
              <span className="fine muted">
                {results.length}{" "}
                {results.length === 1 ? tr("match") : tr("matches")}
              </span>
            )}
          </div>

          {searching && (
            <p className="muted fine">
              {tr("Searching the hospital records…")}
            </p>
          )}

          {!searching && searched && results.length === 0 && (
            <Empty>
              {tr(
                "No patients match this query. Check the MRN, mobile or spelling, or register a new patient.",
              )}
            </Empty>
          )}

          {!searching && !searched && query.trim().length === 0 && (
            <div
              className="card muted"
              style={{ textAlign: "center", padding: "30px 20px" }}
            >
              <p>
                {tr(
                  "Search as you type (250 ms debounce). Or scan an MRN barcode with a handheld scanner.",
                )}
              </p>
            </div>
          )}

          <div className="results-list">
            {results.map((hit) => {
              const isSelected = selectedId === hit.patient_id;
              return (
                <div
                  key={hit.patient_id}
                  className={`card patient-result ${isSelected ? "selected-hit" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectPatient(hit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSelectPatient(hit)
                  }
                >
                  {/* Outstanding AR banner */}
                  {hit.outstanding?.has_outstanding_ar && (
                    <div
                      style={{
                        background: "#ba2525",
                        color: "#fff",
                        padding: "4px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 4,
                        marginBottom: 8,
                      }}
                    >
                      {hit.outstanding.banner_text || tr("OUTSTANDING DUES")}
                    </div>
                  )}

                  {/* MLC Banner */}
                  {hit.mlc_numbers && hit.mlc_numbers.length > 0 && (
                    <div
                      style={{
                        background: "#d9381e",
                        color: "#fff",
                        padding: "3px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        marginBottom: 6,
                      }}
                    >
                      {tr("MEDICO-LEGAL CASE")}: {hit.mlc_numbers.join(", ")}
                    </div>
                  )}

                  {/* Deceased Banner */}
                  {hit.is_deceased && (
                    <div
                      style={{
                        background: "#333",
                        color: "#fff",
                        padding: "3px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        marginBottom: 6,
                      }}
                    >
                      {tr("DECEASED")}{" "}
                      {hit.death_at ? `(${formatDateTime(hit.death_at)})` : ""}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 16 }}>
                        {hit.full_name}
                      </h4>
                      <span
                        className="fine"
                        style={{ fontWeight: 600, color: "var(--accent)" }}
                      >
                        {hit.mrn}
                      </span>
                    </div>
                    <span className="badge">{tr(hit.registration_type)}</span>
                  </div>

                  <p className="fine muted" style={{ margin: "6px 0 0" }}>
                    {hit.gender && <span>{tr(hit.gender)} · </span>}
                    {hit.age_years !== null && (
                      <span>
                        {hit.age_years} {tr("years")} ·{" "}
                      </span>
                    )}
                    {hit.mobile && <span>{hit.mobile}</span>}
                    {hit.cnic && <span> · {hit.cnic}</span>}
                  </p>

                  {hit.billing_category === "Panel" && (
                    <span
                      className="fine muted"
                      style={{ display: "block", marginTop: 4 }}
                    >
                      {tr("Panel")}: {hit.panel_name || "—"} (
                      {hit.panel_member_no || "—"})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Selected Patient Profile */}
        <div>
          {loadingDetail && (
            <p className="muted">{tr("Loading patient profile…")}</p>
          )}

          <ErrorBox error={detailError} />

          {!loadingDetail && !patient && (
            <div
              className="card muted"
              style={{ textAlign: "center", padding: "40px 20px" }}
            >
              <p>
                {tr(
                  "Select a patient from the search results to inspect their details, dues, and demographics.",
                )}
              </p>
            </div>
          )}

          {!loadingDetail && patient && (
            <article className="card" style={{ margin: 0 }}>
              {/* Outstanding Dues Banner (Red, Prominent - rule:30c67b70d7) */}
              {patient.outstanding?.has_outstanding_ar && (
                <div
                  className="banner-alert"
                  style={{
                    background: "#ba2525",
                    color: "#fff",
                    padding: "10px 14px",
                    fontWeight: 700,
                    borderRadius: 6,
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  role="alert"
                >
                  <span>
                    {patient.outstanding.banner_text ||
                      tr("OUTSTANDING BALANCE")}
                  </span>
                  <span>
                    {formatMoney(patient.outstanding.outstanding_ar_balance)}
                  </span>
                </div>
              )}

              {/* Medico-Legal Banner (rule:abc016fdd8 / MSDS 154) */}
              {patient.mlc_numbers && patient.mlc_numbers.length > 0 && (
                <div
                  style={{
                    background: "#d9381e",
                    color: "#fff",
                    padding: "8px 12px",
                    fontWeight: 700,
                    borderRadius: 6,
                    marginBottom: 12,
                  }}
                  role="alert"
                >
                  ⚠ {tr("MEDICO-LEGAL RECORD")} (MSDS 154) — MLC #:{" "}
                  {patient.mlc_numbers.join(", ")}
                </div>
              )}

              {/* Deceased Banner (rule:abc016fdd8) */}
              {patient.is_deceased && (
                <div
                  style={{
                    background: "#222",
                    color: "#f5f5f5",
                    padding: "8px 12px",
                    fontWeight: 700,
                    borderRadius: 6,
                    marginBottom: 12,
                    borderLeft: "6px solid #ba2525",
                  }}
                  role="alert"
                >
                  ☠ {tr("PATIENT DECEASED")}{" "}
                  {patient.death_at
                    ? `— ${formatDateTime(patient.death_at)}`
                    : ""}
                  <small
                    style={{ display: "block", fontWeight: 400, marginTop: 4 }}
                  >
                    {tr(
                      "No new visits or clinical orders may be started for a deceased patient.",
                    )}
                  </small>
                </div>
              )}

              {/* Merged Profiles Notice (rule:fd66e16ee9) */}
              {patient.merged_profiles &&
                patient.merged_profiles.length > 0 && (
                  <div className="notice" style={{ marginBottom: 16 }}>
                    <strong>{tr("Merged Profiles")}:</strong>
                    <p className="fine" style={{ margin: "4px 0" }}>
                      {tr(
                        "This master record includes identities merged from:",
                      )}
                    </p>
                    <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                      {patient.merged_profiles.map((mp) => (
                        <li key={mp.patient_id} className="fine">
                          <strong>{mp.mrn}</strong> — {mp.full_name} (
                          {tr(mp.registration_type)})
                          {mp.temp_identifier && ` · ${mp.temp_identifier}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Profile Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <span className="eyebrow">{patient.mrn}</span>
                  <h2 style={{ margin: "4px 0 6px" }}>{patient.full_name}</h2>
                  {patient.father_or_husband_name && (
                    <p className="fine muted" style={{ margin: 0 }}>
                      {tr("S/O, D/O, W/O")}: {patient.father_or_husband_name}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge">{tr(patient.registration_type)}</span>
                  {canUpdate && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => openEditModal()}
                    >
                      {tr("Edit demographics")}
                    </button>
                  )}
                </div>
              </div>

              {/* Core Identifiers & Demographics */}
              <dl className="details" style={{ margin: "20px 0" }}>
                <div>
                  <dt>{tr("Gender")}</dt>
                  <dd>
                    {patient.gender ? tr(patient.gender) : tr("Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Age / DOB")}</dt>
                  <dd>
                    {patient.dob
                      ? patient.dob
                      : patient.age_years !== null
                        ? `${patient.age_years} ${tr("years")}`
                        : tr("Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Mobile phone")}</dt>
                  <dd dir="ltr">{patient.mobile || tr("Not recorded")}</dd>
                </div>
                <div>
                  <dt>{tr("CNIC")}</dt>
                  <dd dir="ltr">{patient.cnic || tr("Not recorded")}</dd>
                </div>
                <div>
                  <dt>{tr("Blood group")}</dt>
                  <dd>{patient.blood_group || tr("Not recorded")}</dd>
                </div>
                <div>
                  <dt>{tr("Allergies")}</dt>
                  <dd>
                    {patient.allergies ? (
                      <span style={{ color: "#ba2525", fontWeight: 600 }}>
                        {patient.allergies}
                      </span>
                    ) : (
                      <span className="muted">{tr("Not recorded")}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Billing category")}</dt>
                  <dd>
                    {tr(patient.billing_category)}
                    {patient.billing_category === "Panel" && (
                      <span>
                        {" "}
                        · {patient.panel_name || "Panel"} (
                        {patient.panel_member_no || "—"})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Address")}</dt>
                  <dd>{patient.address || tr("Not recorded")}</dd>
                </div>
                <div>
                  <dt>{tr("Emergency contact")}</dt>
                  <dd>
                    {patient.emergency_contact_name || tr("Not recorded")}
                    {patient.emergency_contact_phone &&
                      ` (${patient.emergency_contact_phone})`}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Registered on")}</dt>
                  <dd>{formatDateTime(patient.created_at)}</dd>
                </div>
              </dl>

              {/* Toggle Financial Summary */}
              <div
                style={{
                  marginTop: 24,
                  borderTop: "1px solid var(--line)",
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3>{tr("Financials & Dues")}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinancials(!showFinancials);
                      if (!financials && selectedId)
                        void loadFinancials(selectedId);
                    }}
                  >
                    {showFinancials
                      ? tr("Hide dues & invoices")
                      : tr("View dues & invoices")}
                  </button>
                </div>

                {showFinancials && (
                  <div style={{ marginTop: 16 }}>
                    <ErrorBox error={financialError} />
                    {!!financialError && (
                      <button
                        onClick={() =>
                          selectedId && void loadFinancials(selectedId)
                        }
                      >
                        {tr("Retry")}
                      </button>
                    )}
                    {loadingFinancials && (
                      <p className="fine muted">
                        {tr("Loading financial summary…")}
                      </p>
                    )}

                    {financials && (
                      <>
                        {/* Receivables Table */}
                        <h4 style={{ margin: "12px 0 6px" }}>
                          {tr("Accounts Receivable (Dues)")}
                        </h4>
                        {financials.receivables.length === 0 ? (
                          <p className="fine muted">
                            {tr(
                              "No outstanding accounts receivable for this patient.",
                            )}
                          </p>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    borderBottom: "2px solid var(--line)",
                                    textAlign: "start",
                                  }}
                                >
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Invoice #")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Type")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Status")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "end",
                                    }}
                                  >
                                    {tr("Amount due")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "end",
                                    }}
                                  >
                                    {tr("Balance")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {financials.receivables.map((ar) => (
                                  <tr
                                    key={ar.ar_id}
                                    style={{
                                      borderBottom: "1px solid var(--line)",
                                    }}
                                  >
                                    <td
                                      style={{ padding: "6px 8px" }}
                                      className="fine"
                                    >
                                      {ar.invoice_no}
                                    </td>
                                    <td
                                      style={{ padding: "6px 8px" }}
                                      className="fine"
                                    >
                                      {tr(ar.invoice_type)}
                                    </td>
                                    <td style={{ padding: "6px 8px" }}>
                                      <span className="badge">
                                        {tr(ar.status)}
                                      </span>
                                    </td>
                                    <td
                                      style={{
                                        padding: "6px 8px",
                                        textAlign: "end",
                                      }}
                                      className="fine"
                                    >
                                      {formatMoney(ar.amount_due)}
                                    </td>
                                    <td
                                      style={{
                                        padding: "6px 8px",
                                        textAlign: "end",
                                        fontWeight: 600,
                                        color: "#ba2525",
                                      }}
                                    >
                                      {formatMoney(ar.balance)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Recent Invoices Table */}
                        <h4 style={{ margin: "16px 0 6px" }}>
                          {tr("Recent Invoices")}
                        </h4>
                        {financials.recent_invoices.length === 0 ? (
                          <p className="fine muted">
                            {tr("No recent invoices recorded.")}
                          </p>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    borderBottom: "2px solid var(--line)",
                                    textAlign: "start",
                                  }}
                                >
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Invoice #")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Type")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "start",
                                    }}
                                  >
                                    {tr("Status")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "end",
                                    }}
                                  >
                                    {tr("Net payable")}
                                  </th>
                                  <th
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "end",
                                    }}
                                  >
                                    {tr("Paid")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {financials.recent_invoices
                                  .slice(0, 10)
                                  .map((inv) => (
                                    <tr
                                      key={inv.invoice_id}
                                      style={{
                                        borderBottom: "1px solid var(--line)",
                                      }}
                                    >
                                      <td
                                        style={{ padding: "6px 8px" }}
                                        className="fine"
                                      >
                                        {inv.invoice_no}
                                      </td>
                                      <td
                                        style={{ padding: "6px 8px" }}
                                        className="fine"
                                      >
                                        {tr(inv.invoice_type)}
                                      </td>
                                      <td style={{ padding: "6px 8px" }}>
                                        <span className="badge">
                                          {tr(inv.status)}
                                        </span>
                                      </td>
                                      <td
                                        style={{
                                          padding: "6px 8px",
                                          textAlign: "end",
                                        }}
                                        className="fine"
                                      >
                                        {formatMoney(inv.net_payable)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "6px 8px",
                                          textAlign: "end",
                                        }}
                                        className="fine"
                                      >
                                        {formatMoney(inv.amount_paid)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      </div>

      {/* Edit Demographics Modal */}
      {editOpen && (
        <Modal
          title={tr("Edit patient demographics")}
          onClose={() => setEditOpen(false)}
        >
          {versionConflict && (
            <div className="error" role="alert" style={{ marginBottom: 12 }}>
              <strong>{tr("VERSION CONFLICT")}</strong>
              <p className="fine">
                {tr(
                  "This patient record was updated by another terminal. Your draft has been preserved. Discard it and reload the latest record before editing again.",
                )}
              </p>
            </div>
          )}

          {versionConflict && (
            <button
              type="button"
              disabled={editBusy}
              onClick={async () => {
                if (!editBase) return;
                setEditBusy(true);
                try {
                  const fresh = await pts.getPatient(editBase.patient_id);
                  setPatient(fresh);
                  openEditModal(fresh);
                } catch (error) {
                  setEditError(error);
                } finally {
                  setEditBusy(false);
                }
              }}
            >
              {tr("Discard draft and reload latest record")}
            </button>
          )}
          <ErrorBox error={editError} />

          <form onSubmit={handleSaveEdit}>
            <div className="form-grid">
              <Field
                label={tr("Full name")}
                hint={tr("Patient's official name")}
              >
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={editBusy}
                  aria-label={tr("Full name")}
                />
              </Field>

              <Field label={tr("Father / Husband name")}>
                <input
                  type="text"
                  value={formFatherHusband}
                  onChange={(e) => setFormFatherHusband(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Gender")}>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as any)}
                  disabled={editBusy}
                  aria-label={tr("Gender")}
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {tr(g.label)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={tr("Age (Years)")}>
                <input
                  type="number"
                  min="0"
                  max="150"
                  value={formAgeYears}
                  onChange={(e) => setFormAgeYears(e.target.value)}
                  disabled={editBusy}
                  placeholder="e.g. 35"
                />
              </Field>

              <Field label={tr("Date of birth")}>
                <input
                  type="date"
                  value={formDob}
                  onChange={(e) => setFormDob(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Mobile phone")} hint={tr("e.g. 03001234567")}>
                <input
                  type="tel"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  disabled={editBusy}
                  pattern="^\+?[0-9][0-9 -]{6,19}$"
                />
              </Field>

              <Field label={tr("CNIC")} hint={tr("e.g. 35202-1234567-1")}>
                <input
                  type="text"
                  value={formCnic}
                  onChange={(e) => setFormCnic(e.target.value)}
                  disabled={editBusy}
                  placeholder="35202-1234567-1"
                />
              </Field>

              <Field label={tr("Blood group")}>
                <select
                  value={formBloodGroup}
                  onChange={(e) => setFormBloodGroup(e.target.value)}
                  disabled={editBusy}
                >
                  <option value="">{tr("Not recorded")}</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={tr("Allergies")}
                hint={tr("Known drug/food allergies")}
              >
                <input
                  type="text"
                  value={formAllergies}
                  onChange={(e) => setFormAllergies(e.target.value)}
                  disabled={editBusy}
                  placeholder={tr("Leave blank if none recorded")}
                />
              </Field>

              <Field label={tr("Billing category")}>
                <select
                  value={formBillingCat}
                  onChange={(e) => setFormBillingCat(e.target.value as any)}
                  disabled={editBusy}
                >
                  <option value="Cash">{tr("Cash")}</option>
                  <option value="Panel">{tr("Panel")}</option>
                </select>
              </Field>

              {formBillingCat === "Panel" && (
                <>
                  <Field label={tr("Panel ID")}>
                    <input
                      type="number"
                      value={formPanelId}
                      onChange={(e) => setFormPanelId(e.target.value)}
                      disabled={editBusy}
                    />
                  </Field>
                  <Field label={tr("Panel Member #")}>
                    <input
                      type="text"
                      value={formPanelMemberNo}
                      onChange={(e) => setFormPanelMemberNo(e.target.value)}
                      disabled={editBusy}
                    />
                  </Field>
                </>
              )}

              <Field label={tr("Address")}>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Emergency contact name")}>
                <input
                  type="text"
                  value={formEmergencyName}
                  onChange={(e) => setFormEmergencyName(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Emergency contact phone")}>
                <input
                  type="tel"
                  value={formEmergencyPhone}
                  onChange={(e) => setFormEmergencyPhone(e.target.value)}
                  disabled={editBusy}
                />
              </Field>
            </div>

            {patient?.registration_type === "LabOnly" && (
              <label className="check" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={formUpgradeRegular}
                  onChange={(e) => setFormUpgradeRegular(e.target.checked)}
                  disabled={editBusy}
                />
                <span>{tr("Upgrade from LabOnly to Regular patient")}</span>
              </label>
            )}

            <div className="actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditOpen(false)}
              >
                {tr("Cancel")}
              </button>
              <button
                type="submit"
                className="primary"
                disabled={editBusy || versionConflict}
              >
                {editBusy ? tr("Saving…") : tr("Save changes")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
