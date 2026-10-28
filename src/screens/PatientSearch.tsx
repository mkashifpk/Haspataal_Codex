import { useCallback, useEffect, useRef, useState } from "react";
import { tr, bilingual as t } from "../i18n";
import { isDuplicatePatient, patientErrorCode, patientEditNeedsReconcile } from "../patient-errors";
import { resolvePatientMaster } from "../patient-profile";
import { PatientSearchMatch } from "../patient-search-match";
import * as pts from "../generated/patient_search";
import { api } from "../bridge";
import { formatHospitalTime } from "../hospital-time";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
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
  timeZone,
  currency,
}: {
  user: any;
  revision: number;
  timeZone?: string;
  currency?: string;
}) {
  const canSearch = user?.permissions?.includes("patient.search");
  const canView = user?.permissions?.includes("patient.view");
  const canUpdate = user?.permissions?.includes("patient.update");
  const panels = useLoad(() => canUpdate ? api<{panel_id:number;name:string;is_active:boolean}[]>("GET", "/finance/panels") : Promise.resolve([]), [canUpdate]);

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
  const editIdentity = useRef<number | null>(null);
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
  const [latestEdit, setLatestEdit] = useState<pts.PatientDetailOut | null>(null);
  const editFlight = useRef(false);
  const [editDirty, setEditDirty] = useState(false);
  function closeEdit() {
    if (editFlight.current) return;
    if (editDirty && !window.confirm(tr("Discard patient demographic changes?"))) return;
    setEditOpen(false);
    editIdentity.current = null;
    setEditDirty(false);
  }

  // Edit form state
  const [formName, setFormName] = useState("");
  const [formGender, setFormGender] = useState<
    "male" | "female" | "other" | "unknown"
  >("unknown");
  const [formDob, setFormDob] = useState("");
  const [formAgeYears, setFormAgeYears] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formCnic, setFormCnic] = useState("");
  const [formUpmrn, setFormUpmrn] = useState("");
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
    if (!canSearch) return;
    const generation = ++searchGeneration.current;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setResults([]);
    setSearchError(undefined);
    try {
      const hits = await pts.searchPatients({ q: trimmed, limit: 20 });
      if (generation !== searchGeneration.current) return;
      setResults(hits);
      setSearched(true);
    } catch (e) {
      if (generation === searchGeneration.current) setSearchError(e);
    } finally {
      if (generation === searchGeneration.current) setSearching(false);
    }
  }, [canSearch]);

  useEffect(() => {
    ++searchGeneration.current;
    setSearching(false);
    setResults([]);
    setSearchError(undefined);
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

  const loadPatientDetail = useCallback(async (id: number) => {
    const generation = ++detailGeneration.current;
    const current = () => generation === detailGeneration.current && selection.current === id;
    setLoadingDetail(true);
    setPatient(null);
    setDetailError(undefined);
    try {
      const record = await resolvePatientMaster(id, pts.getPatient, current);
      if (!record || !current()) return;
      if (record.patient_id !== id) {
        selection.current = record.patient_id;
        setSelectedId(record.patient_id);
        void loadFinancials(record.patient_id);
      }
      if (editIdentity.current !== null && editIdentity.current !== record.patient_id) {
        setVersionConflict(true);
        setLatestEdit(null);
        setEditError(new Error("This profile was merged. Read the current master record before making further changes. Your draft is preserved."));
      }
      setPatient(record);
    } catch (error) {
      if (current()) {
        setDetailError(error);
        if (editIdentity.current !== null) {
          setVersionConflict(true);
          setLatestEdit(null);
          setEditError(error);
        }
      }
    } finally {
      if (generation === detailGeneration.current) setLoadingDetail(false);
    }
  }, [loadFinancials]);

  function handleSelectPatient(p: pts.PatientSearchHitOut) {
    if (!canView) return;
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
      if ((e.type === "event" && ["patient.merged", "death.recorded"].includes(e.event_type)) || (e.type === "stream" && e.resync)) {
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
    editIdentity.current = record.patient_id;
    setFormName(record.full_name || "");
    setFormGender(record.gender || "unknown");
    setFormDob(record.dob || "");
    setFormAgeYears(record.age_years !== null ? String(record.age_years) : "");
    setFormMobile(record.mobile || "");
    setFormCnic(record.cnic || "");
    setFormUpmrn(record.upmrn || "");
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
    setLatestEdit(null);
    setEditDirty(false);
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBase || versionConflict || editFlight.current || !canUpdate || !canSaveEdit) return;
    editFlight.current = true;
    const patient = editBase;
    setEditBusy(true);
    setEditError(undefined);
    setVersionConflict(false);

    const body: pts.PatientUpdate = {
      expected_version: patient.row_version,
      full_name: formName.trim(),
      gender: formGender,
      dob: formDob || null,
      age_years: formAgeYears ? parseInt(formAgeYears, 10) : null,
      mobile: formMobile || null,
      cnic: formCnic || null,
      upmrn: formUpmrn.trim() || null,
      father_or_husband_name: formFatherHusband || null,
      address: formAddress || null,
      emergency_contact_name: formEmergencyName || null,
      emergency_contact_phone: formEmergencyPhone || null,
      blood_group: (formBloodGroup as any) || null,
      allergies: formAllergies || null,
      billing_category: formBillingCat,
      panel_id: formPanelId ? parseInt(formPanelId, 10) : null,
      panel_member_no: formPanelMemberNo || null,
      ...(formUpgradeRegular ? { upgrade_to_regular: true } : {}),
    };

    // PATCH only changed fields; do not erase unedited server data.
    for (const key of Object.keys(body) as (keyof pts.PatientUpdate)[]) {
      if (key !== "expected_version" && key !== "upgrade_to_regular" &&
          body[key] === (patient as any)[key]) delete body[key];
    }

    try {
      const updated = await pts.updatePatient(patient.patient_id, body);
      setPatient(updated);
      setEditOpen(false);
      editIdentity.current = null;
      setEditDirty(false);
      // Also update search results entry if present
      setResults((prev) =>
        prev.map((r) =>
          r.patient_id === updated.patient_id ? { ...r, ...updated } : r,
        ),
      );
    } catch (err: any) {
      setEditError(err);
      setVersionConflict(patientEditNeedsReconcile(err));
      // A transition refusal never silently upgrades a different registration type.
      if (patientErrorCode(err) === "PATIENT_TYPE_TRANSITION_INVALID") setFormUpgradeRegular(false);
    } finally {
      editFlight.current = false;
      setEditBusy(false);
    }
  }

  const canSaveEdit = !!patient && !loadingDetail && patient.patient_id === editBase?.patient_id && patient.registration_type !== "Merged" && !patient.merged_into_id;

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return (currency ? currency + " " : "") + String(val);
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return timeZone ? formatHospitalTime(iso, timeZone) : tr("Hospital timezone unavailable");
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
    <div data-help="patients.profile" data-write-pending={editBusy}>
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
      <section className="card" data-help="patients.lookup" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input data-help="patients.lookup"
              type="search"
              maxLength={100}
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
          <button data-help="patients.lookup"
            type="button"
            className="primary"
            onClick={() => void performSearch(query)}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? tr("Searching…") : tr("Search")}
          </button>
          {query && (
            <button data-help="patients.lookup"
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
      {!canView && <p>{tr("Profile access requires patient.view permission. Ask your supervisor.")}</p>}

      {/* Main Split Layout: Search Results (Left) & Selected Patient Details (Right) */}
      <div className="split patient-search-layout">
        {/* Left Column: Search Results */}
        <section className="card patient-results" data-help="patients.profile">
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
                  aria-disabled={!canView}
                  tabIndex={canView ? 0 : -1}
                  onKeyDown={(e) =>
                    ["Enter", " "].includes(e.key) && (e.preventDefault(), handleSelectPatient(hit))
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
                      <PatientSearchMatch hit={hit} />
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
                    <button data-help="patients.profile"
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
                  <dt>{t("UPMRN", "یونیورسل مریض نمبر")}</dt>
                  <dd dir="ltr">{patient.upmrn || tr("Not recorded")}</dd>
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
                  <button data-help="patients.profile"
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
                      <button data-help="patients.profile"
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
          onClose={closeEdit}
          closable={!editBusy}
        >
          {versionConflict && (
            <div className="error" role="alert" style={{ marginBottom: 12 }}>
              <strong>{tr("Review current record")}</strong>
              <p className="fine">
                {tr(
                  "The save result needs review. Your draft is preserved. Read the current record before another save; a lost reply may already have saved the change.",
                )}
              </p>
            </div>
          )}

          {versionConflict && (
            <button data-help="patients.edit"
              type="button"
              disabled={editBusy}
              onClick={async () => {
                if (!editBase) return;
                setEditBusy(true);
                try {
                  const fresh = await resolvePatientMaster(editBase.patient_id, pts.getPatient);
                  if (fresh) setLatestEdit(fresh);
                } catch (error) {
                  setEditError(error);
                } finally {
                  setEditBusy(false);
                }
              }}
            >
              {tr("Read current record")}
            </button>
          )}
          {latestEdit && <div data-help="patients.edit">
            <Details value={latestEdit} />
            <button data-help="patients.edit" type="button" onClick={() => { ++detailGeneration.current; selection.current = latestEdit.patient_id; setSelectedId(latestEdit.patient_id); setPatient(latestEdit); void loadFinancials(latestEdit.patient_id); openEditModal(latestEdit); }}>
              {tr("Discard draft and reload latest record")}
            </button>
          </div>}
          {isDuplicatePatient(editError) ? <p className="error" role="alert">{t("This patient is already registered: search for them instead", "یہ مریض پہلے سے رجسٹرڈ ہے: دوبارہ اندراج کے بجائے اسے تلاش کریں")} <bdi>{patientErrorCode(editError)}</bdi></p> : patientErrorCode(editError) === "PATIENT_TYPE_TRANSITION_INVALID" ? <p className="error" role="alert">{t("Only lab-only or trauma profiles can become regular patients. Review the registration type before saving again.", "صرف لیب یا ٹراما پروفائل کو مستقل مریض بنایا جا سکتا ہے۔ دوبارہ محفوظ کرنے سے پہلے اندراج کی قسم دیکھیں۔")} <bdi>PATIENT_TYPE_TRANSITION_INVALID</bdi></p> : <ErrorBox error={editError} />}

          <form data-help="patients.edit" onSubmit={handleSaveEdit} data-unsaved={editDirty || editBusy} onChange={() => setEditDirty(true)}>
            <div className="form-grid">
              <Field
                label={tr("Full name")}
                hint={tr("Patient's official name")}
              >
                <input data-field="full_name" data-help="patients.edit"
                  type="text"
                  required
                  maxLength={200}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={editBusy}
                  aria-label={tr("Full name")}
                />
              </Field>

              <Field label={tr("Father / Husband name")}>
                <input data-field="father_or_husband_name" data-help="patients.edit"
                  type="text"
                  value={formFatherHusband}
                  onChange={(e) => setFormFatherHusband(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Gender")}>
                <select data-field="gender" data-help="patients.edit"
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
                <input data-field="age_years" data-help="patients.edit"
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
                <input data-field="dob" data-help="patients.edit"
                  type="date"
                  value={formDob}
                  onChange={(e) => setFormDob(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Mobile phone")} hint={tr("e.g. 03001234567")}>
                <input data-field="mobile" data-help="patients.edit"
                  type="tel"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  disabled={editBusy}
                  pattern="^\+?[0-9][0-9 -]{6,19}$"
                />
              </Field>

              <Field label={tr("CNIC")} hint={tr("e.g. 35202-1234567-1")}>
                <input data-field="cnic" data-help="patients.edit"
                  type="text"
                  value={formCnic}
                  pattern="[0-9]{5}-?[0-9]{7}-?[0-9]"
                  onChange={(e) => setFormCnic(e.target.value)}
                  disabled={editBusy}
                  placeholder="35202-1234567-1"
                />
              </Field>

              <Field label={t("UPMRN (optional)", "یونیورسل مریض نمبر (اختیاری)")} hint={t("Enter only an issued Universal Patient Medical Record Number.", "صرف پہلے سے جاری کردہ یونیورسل مریض نمبر درج کریں۔")}>
                <input data-field="upmrn" data-help="patients.edit" aria-label={t("UPMRN (optional)", "یونیورسل مریض نمبر (اختیاری)")} dir="ltr" value={formUpmrn} onChange={e => setFormUpmrn(e.target.value)} disabled={editBusy} maxLength={40} pattern={"[A-Za-z0-9][A-Za-z0-9\\/\\-]{3,39}"} />
              </Field>

              <Field label={tr("Blood group")}>
                <select data-field="blood_group" data-help="patients.edit"
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
                <input data-field="allergies" data-help="patients.edit"
                  type="text"
                  value={formAllergies}
                  onChange={(e) => setFormAllergies(e.target.value)}
                  disabled={editBusy}
                  placeholder={tr("Leave blank if none recorded")}
                />
              </Field>

              <Field label={tr("Billing category")}>
                <select data-field="billing_category" data-help="patients.edit"
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
                    <select data-field="panel_id" data-help="patients.edit"
                      required
                      value={formPanelId}
                      onChange={(e) => setFormPanelId(e.target.value)}
                      disabled={editBusy || panels.loading || !!panels.error}
                    >
                      <option value="">{tr("Select panel")}</option>
                      {formPanelId && !panels.data?.some(p => String(p.panel_id) === formPanelId) && <option value={formPanelId}>{editBase?.panel_name || formPanelId}</option>}
                      {panels.data?.filter(p=>p.is_active || String(p.panel_id)===formPanelId).map(p=><option key={p.panel_id} value={p.panel_id}>{p.name}</option>)}
                    </select>
                    <LoadState {...panels} retry={panels.reload}/>
                  </Field>
                  <Field label={tr("Panel Member #")}>
                    <input data-field="panel_member_no" data-help="patients.edit"
                      type="text"
                      value={formPanelMemberNo}
                      onChange={(e) => setFormPanelMemberNo(e.target.value)}
                      disabled={editBusy}
                    />
                  </Field>
                </>
              )}

              <Field label={tr("Address")}>
                <input data-field="address" data-help="patients.edit"
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Emergency contact name")}>
                <input data-field="emergency_contact_name" data-help="patients.edit"
                  type="text"
                  value={formEmergencyName}
                  onChange={(e) => setFormEmergencyName(e.target.value)}
                  disabled={editBusy}
                />
              </Field>

              <Field label={tr("Emergency contact phone")}>
                <input data-field="emergency_contact_phone" data-help="patients.edit"
                  type="tel"
                  value={formEmergencyPhone}
                  onChange={(e) => setFormEmergencyPhone(e.target.value)}
                  disabled={editBusy}
                />
              </Field>
            </div>

            {patient?.registration_type === "LabOnly" && (
              <label className="check" style={{ marginTop: 12 }}>
                <input data-help="patients.edit"
                  type="checkbox"
                  checked={formUpgradeRegular}
                  onChange={(e) => setFormUpgradeRegular(e.target.checked)}
                  disabled={editBusy}
                />
                <span>{tr("Upgrade from LabOnly to Regular patient")}</span>
              </label>
            )}

            <div className="actions" style={{ marginTop: 20 }}>
              <button data-help="patients.edit"
                type="button"
                disabled={editBusy}
                onClick={closeEdit}
              >
                {tr("Cancel")}
              </button>
              <button data-help="patients.edit"
                type="submit"
                className="primary"
                disabled={editBusy || versionConflict || !canSaveEdit}
              >
                {editBusy ? tr("Saving…") : tr("Save changes")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
