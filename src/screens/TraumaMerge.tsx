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
  PatientSearchHitOut,
  MergeIn,
  PatientDetailOut,
} from "../generated/trauma_merge";
import {
  searchPatients,
  merge,
} from "../generated/trauma_merge";
import {
  evaluateTraumaMergeView,
  canSearchPatients,
  canMergePatient,
  canApproveMerge,
  compareProfilesSideBySide,
  validateMergeRequest,
  explainTraumaMergeError,
} from "../trauma-merge-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";

export interface TraumaMergeProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  initialSourcePatient?: PatientSearchHitOut;
  initialTargetPatient?: PatientSearchHitOut;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
}

export function TraumaMerge({
  user,
  establishment,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  initialSourcePatient,
  initialTargetPatient,
  onNavigateScreen,
  onBack,
}: TraumaMergeProps) {
  // View evaluation & permissions
  const viewEval = evaluateTraumaMergeView(establishment);
  const canSearch = canSearchPatients(user);
  const canMerge = canMergePatient(user) && !viewEval.isReadOnly;

  // Search states for Source profile (to be absorbed)
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceSearching, setSourceSearching] = useState(false);
  const [sourceResults, setSourceResults] = useState<PatientSearchHitOut[]>([]);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<PatientSearchHitOut | null>(
    initialSourcePatient || null
  );

  // Search states for Target profile (surviving master)
  const [targetQuery, setTargetQuery] = useState("");
  const [targetSearching, setTargetSearching] = useState(false);
  const [targetResults, setTargetResults] = useState<PatientSearchHitOut[]>([]);
  const [targetSearchError, setTargetSearchError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<PatientSearchHitOut | null>(
    initialTargetPatient || null
  );

  // Merge form inputs
  const [mergeReason, setMergeReason] = useState("");
  const [cosignerUsername, setCosignerUsername] = useState("");
  const [cosignerPassword, setCosignerPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Post-merge result
  const [mergedResult, setMergedResult] = useState<PatientDetailOut | null>(null);

  // Write controller
  const write = useClinicalWrite(user, "trauma_merge", (result: any) => {
    const detail = result?.data || result;
    setMergedResult(detail);
  });

  // Source profile search handler
  async function handleSearchSource() {
    if (!sourceQuery.trim() || sourceQuery.trim().length < 2) return;
    setSourceSearching(true);
    setSourceSearchError(null);
    try {
      const res = await searchPatients({ q: sourceQuery.trim(), limit: 10 });
      setSourceResults(res || []);
      if ((res || []).length === 0) {
        setSourceSearchError(t("No matching patient profiles found.", "کوئی مماثل مریض کا پروفائل نہیں ملا۔"));
      }
    } catch (err: any) {
      setSourceSearchError(err?.message || t("Error searching patient records.", "مریض کے ریکارڈ تلاش کرنے میں خرابی۔"));
    } finally {
      setSourceSearching(false);
    }
  }

  // Target profile search handler
  async function handleSearchTarget() {
    if (!targetQuery.trim() || targetQuery.trim().length < 2) return;
    setTargetSearching(true);
    setTargetSearchError(null);
    try {
      const res = await searchPatients({ q: targetQuery.trim(), limit: 10 });
      setTargetResults(res || []);
      if ((res || []).length === 0) {
        setTargetSearchError(t("No matching patient profiles found.", "کوئی مماثل مریض کا پروفائل نہیں ملا۔"));
      }
    } catch (err: any) {
      setTargetSearchError(err?.message || t("Error searching patient records.", "مریض کے ریکارڈ تلاش کرنے میں خرابی۔"));
    } finally {
      setTargetSearching(false);
    }
  }

  // Swap source and target
  function handleSwapProfiles() {
    const temp = selectedSource;
    setSelectedSource(selectedTarget);
    setSelectedTarget(temp);
  }

  // Reset form
  function handleReset() {
    setSelectedSource(null);
    setSelectedTarget(null);
    setSourceQuery("");
    setTargetQuery("");
    setSourceResults([]);
    setTargetResults([]);
    setMergeReason("");
    setCosignerUsername("");
    setCosignerPassword("");
    setConfirmed(false);
    setMergedResult(null);
    write.clearError();
  }

  // Validation
  const requiresCosigner = selectedSource?.registration_type === "Regular";
  const validationErrors = validateMergeRequest(
    selectedSource,
    selectedTarget,
    {
      target_patient_id: selectedTarget?.patient_id || 0,
      reason: mergeReason,
      cosigner_username: cosignerUsername,
      cosigner_password: cosignerPassword,
    }
  );
  const isValid = Object.keys(validationErrors).length === 0;
  const validationError: string | null = (Object.values(validationErrors)[0] as string) || null;

  // Profile discrepancies side by side
  const discrepancies =
    selectedSource && selectedTarget
      ? compareProfilesSideBySide(selectedSource, selectedTarget)
      : [];

  const hasIdentityConflicts = discrepancies.some(
    (d) => d.isConflict && (d.field === "Gender" || d.field === "CNIC")
  );

  // Submit Merge
  function handleSubmitMerge() {
    if (!selectedSource || !selectedTarget || !canMerge) return;
    if (!isValid) return;

    const sourceId = selectedSource.patient_id;
    const targetId = selectedTarget.patient_id;

    const mergePayload: MergeIn = {
      target_patient_id: targetId,
      reason: mergeReason.trim(),
      cosigner_username: cosignerUsername.trim() || null,
    };

    // Sensitive credentials passed via transientBody so they are zeroed out after submission
    const transientBody: Record<string, unknown> = {};
    if (cosignerPassword) {
      transientBody.cosigner_password = cosignerPassword;
    }

    write.start(
      {
        method: "POST",
        path: `/patients/${sourceId}/merge`,
        body: mergePayload,
        permission: "patient.merge",
        protection: "reconcile",
        reconcilePath: `/patients/${sourceId}`,
        label: t(
          `Merge profile #${sourceId} into master #${targetId}`,
          `پروفائل #${sourceId} کو ماسٹر #${targetId} میں ضم کریں`
        ),
      },
      undefined,
      transientBody
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            {t("Trauma Profile Merge", "ٹراما پروفائل انضمام")}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#64748b",
              margin: "4px 0 0 0",
            }}
          >
            {t(
              "Consolidate temporary trauma registrations (Unknown Male/Female) or duplicate entries into a permanent master record.",
              "عارضی ٹراما رجسٹریشن (نامعلوم مریض) یا ڈپلیکیٹ اندراجات کو مستقل ماسٹر ریکارڈ میں ضم کریں۔"
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              data-help="trauma_merge.back_button"
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {t("Back", "واپس")}
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            data-help="trauma_merge.reset_button"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {t("Reset / Clear", "ری سیٹ / نیا تلاش")}
          </button>
        </div>
      </div>

      {/* Banner Notice / Restrictive View State */}
      {viewEval.bannerNotice && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 6,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {viewEval.bannerNotice}
        </div>
      )}

      {/* Audit Trail Mandate Notice (rule:1734acddbd) */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 6,
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          fontSize: 13,
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 600 }}>{t("Audit Guarantee (MSDS AAC 15-20): ", "آڈٹ کی ضمانت: ")}</span>
        {t(
          "The source trauma record is permanently preserved for legal and clinical audit trail. All visits, admissions, prescriptions, lab results, and invoices are automatically re-associated under the master surviving record.",
          "ماخذ ٹراما ریکارڈ کو قانونی اور طبی آڈٹ کے لیے مستقل محفوظ رکھا جاتا ہے۔ تمام ملاقاتیں، داخلے، نسخے، لیب نتائج اور بل خودکار طور پر ماسٹر ریکارڈ سے منسلک ہو جائیں گے۔"
        )}
      </div>

      {/* Success Notification */}
      {mergedResult && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "#ecfdf5",
            border: "2px solid #10b981",
            color: "#065f46",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {t("Profile Merge Completed Successfully", "پروفائل کامیابی سے ضم ہو گیا")}
            </h3>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {t("Master MRN: ", "ماسٹر ایم آر این: ")}
              {mergedResult.mrn}
            </span>
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            {t(
              `Temporary profile has been absorbed into master record for ${mergedResult.full_name}. All clinical history is now consolidated under patient ID #${mergedResult.patient_id}.`,
              `عارضی پروفائل ${mergedResult.full_name} کے ماسٹر ریکارڈ میں ضم ہو چکا ہے۔ تمام طبی تاریخ اب مریض ID #${mergedResult.patient_id} کے تحت یکجا ہے۔`
            )}
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleReset}
              data-help="trauma_merge.merge_another"
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: "#059669",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("Merge Another Profile", "ایک اور پروفائل ضم کریں")}
            </button>
            {onNavigateScreen && (
              <button
                type="button"
                onClick={() => onNavigateScreen("er_board")}
                data-help="trauma_merge.go_to_er_board"
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "#ffffff",
                  color: "#065f46",
                  border: "1px solid #059669",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("Return to ER Tracking Board", "ایمرجنسی ٹریکنگ بورڈ پر واپس جائیں")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Profile Lookup & Selection Dual Panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        {/* Source Profile Panel (Being Absorbed) */}
        <div
          style={{
            border: "2px solid #cbd5e1",
            borderRadius: 8,
            padding: 16,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#b91c1c" }}>
                {t("1. Source Profile (Absorbed)", "1. ماخذ پروفائل (منسلک ہونے والا)")}
              </h2>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {t("The temporary trauma profile or duplicate being merged away", "عارضی ٹراما پروفائل یا ڈپلیکیٹ جو ختم کیا جائے گا")}
              </span>
            </div>
            {selectedSource && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background:
                    selectedSource.registration_type === "TraumaTemp"
                      ? "#fef2f2"
                      : "#f1f5f9",
                  color:
                    selectedSource.registration_type === "TraumaTemp"
                      ? "#991b1b"
                      : "#334155",
                  border: "1px solid #cbd5e1",
                }}
              >
                {selectedSource.registration_type}
              </span>
            )}
          </div>

          {!selectedSource ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder={t("Search by MRN, Name, Phone, Unknown Male/Female...", "ایم آر این، نام، فون، نامعلوم سے تلاش کریں...")}
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSource()}
                  disabled={!canSearch || sourceSearching}
                  data-help="trauma_merge.source_search_query"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchSource}
                  disabled={!canSearch || sourceSearching || sourceQuery.trim().length < 2}
                  data-help="trauma_merge.source_search_button"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {sourceSearching ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                </button>
              </div>

              {sourceSearchError && (
                <div style={{ fontSize: 12, color: "#dc2626" }}>
                  {sourceSearchError}
                </div>
              )}

              {/* Search Results List */}
              {sourceResults.length > 0 && (
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                  }}
                >
                  {sourceResults.map((patient) => (
                    <button
                      type="button"
                      key={patient.patient_id}
                      onClick={() => {
                        setSelectedSource(patient);
                        setSourceResults([]);
                      }}
                      data-help="trauma_merge.source_patient_select"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        borderLeft: "none",
                        borderRight: "none",
                        borderTop: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#ffffff",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                          {patient.full_name || patient.temp_identifier || t("Unnamed Trauma Patient", "بے نام ٹراما مریض")}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          MRN: {patient.mrn} • {patient.gender || "unknown"} • {patient.age_years ? `${patient.age_years}y` : patient.dob || "—"}
                          {patient.mobile ? ` • Phone: ${patient.mobile}` : ""}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: patient.registration_type === "TraumaTemp" ? "#fee2e2" : "#f1f5f9",
                          color: patient.registration_type === "TraumaTemp" ? "#b91c1c" : "#475569",
                          fontWeight: 600,
                        }}
                      >
                        {patient.registration_type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected Source Patient Card */
            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#991b1b" }}>
                  {selectedSource.full_name || selectedSource.temp_identifier || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  data-help="trauma_merge.change_source"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#b91c1c",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {t("Change", "تبدیل کریں")}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                <div><strong>MRN:</strong> {selectedSource.mrn} (ID: #{selectedSource.patient_id})</div>
                <div><strong>{t("Father/Husband:", "والد / شوہر:")}</strong> {selectedSource.father_or_husband_name || "—"}</div>
                <div><strong>{t("Gender / Age:", "جنس / عمر:")}</strong> {selectedSource.gender} • {selectedSource.age_years ? `${selectedSource.age_years} yrs` : "—"}</div>
                <div><strong>CNIC:</strong> {selectedSource.cnic || "—"}</div>
                <div><strong>{t("Mobile:", "موبائل:")}</strong> {selectedSource.mobile || "—"}</div>
                {selectedSource.outstanding?.has_outstanding_ar && (
                  <div style={{ color: "#b91c1c", fontWeight: 600 }}>
                    {selectedSource.outstanding.banner_text || `Outstanding: Rs. ${selectedSource.outstanding.outstanding_ar_balance}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Target Profile Panel (Master Record that Survives) */}
        <div
          style={{
            border: "2px solid #cbd5e1",
            borderRadius: 8,
            padding: 16,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#047857" }}>
                {t("2. Target Master Profile (Surviving)", "2. ہدف ماسٹر پروفائل (باقی رہنے والا)")}
              </h2>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {t("The permanent verified record that remains active", "مستقل تصدیق شدہ ریکارڈ جو فعال رہے گا")}
              </span>
            </div>
            {selectedTarget && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "#d1fae5",
                  color: "#065f46",
                  border: "1px solid #a7f3d0",
                }}
              >
                {selectedTarget.registration_type}
              </span>
            )}
          </div>

          {!selectedTarget ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder={t("Search permanent record by MRN, CNIC, Phone, Name...", "مستقل ریکارڈ ایم آر این، شناختی کارڈ، فون، نام سے تلاش کریں...")}
                  value={targetQuery}
                  onChange={(e) => setTargetQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchTarget()}
                  disabled={!canSearch || targetSearching}
                  data-help="trauma_merge.target_search_query"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchTarget}
                  disabled={!canSearch || targetSearching || targetQuery.trim().length < 2}
                  data-help="trauma_merge.target_search_button"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "#047857",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {targetSearching ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                </button>
              </div>

              {targetSearchError && (
                <div style={{ fontSize: 12, color: "#dc2626" }}>
                  {targetSearchError}
                </div>
              )}

              {/* Target Results List */}
              {targetResults.length > 0 && (
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                  }}
                >
                  {targetResults.map((patient) => (
                    <button
                      type="button"
                      key={patient.patient_id}
                      onClick={() => {
                        setSelectedTarget(patient);
                        setTargetResults([]);
                      }}
                      data-help="trauma_merge.target_patient_select"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        borderLeft: "none",
                        borderRight: "none",
                        borderTop: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#ffffff",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                          {patient.full_name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          MRN: {patient.mrn} • {patient.gender || "unknown"} • CNIC: {patient.cnic || "—"}
                          {patient.mobile ? ` • Phone: ${patient.mobile}` : ""}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#d1fae5",
                          color: "#065f46",
                          fontWeight: 600,
                        }}
                      >
                        {patient.registration_type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected Target Patient Card */
            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#065f46" }}>
                  {selectedTarget.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTarget(null)}
                  data-help="trauma_merge.change_target"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#047857",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {t("Change", "تبدیل کریں")}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                <div><strong>MRN:</strong> {selectedTarget.mrn} (ID: #{selectedTarget.patient_id})</div>
                <div><strong>{t("Father/Husband:", "والد / شوہر:")}</strong> {selectedTarget.father_or_husband_name || "—"}</div>
                <div><strong>{t("Gender / Age:", "جنس / عمر:")}</strong> {selectedTarget.gender} • {selectedTarget.age_years ? `${selectedTarget.age_years} yrs` : "—"}</div>
                <div><strong>CNIC:</strong> {selectedTarget.cnic || "—"}</div>
                <div><strong>{t("Mobile:", "موبائل:")}</strong> {selectedTarget.mobile || "—"}</div>
                {selectedTarget.photo_document_id && (
                  <div style={{ color: "#047857", fontWeight: 600, fontSize: 12 }}>
                    ✓ {t("Patient Photo On File", "مریض کی تصویر موجود ہے")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Swap Profiles Control */}
      {selectedSource && selectedTarget && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleSwapProfiles}
            data-help="trauma_merge.swap_profiles"
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⇄ {t("Swap Source & Target Direction", "ماخذ اور ہدف کی سمت تبدیل کریں")}
          </button>
        </div>
      )}

      {/* Side-by-Side Comparison & Discrepancies Table (rule:ba9b5a51e2) */}
      {selectedSource && selectedTarget && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              {t("Side-by-Side Verification (Mandatory Before Merge)", "پہلو بہ پہلو موازنہ (انضمام سے پہلے لازمی)")}
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {t("rule:ba9b5a51e2 — Full demographic reconciliation", "قاعدہ:ba9b5a51e2 — مکمل آبادیاتی تطابق")}
            </span>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569", width: "25%" }}>
                  {t("Demographic Attribute", "آبادیاتی خصوصیت")}
                </th>
                <th style={{ padding: "10px 14px", fontWeight: 600, color: "#991b1b", width: "35%" }}>
                  {t("Source Profile (Being Absorbed)", "ماخذ پروفائل (ختم ہونے والا)")}
                </th>
                <th style={{ padding: "10px 14px", fontWeight: 600, color: "#047857", width: "35%" }}>
                  {t("Surviving Master Profile", "باقی رہنے والا ماسٹر پروفائل")}
                </th>
                <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569", width: "15%" }}>
                  {t("Status", "حیثیت")}
                </th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((d, idx) => (
                <tr
                  key={d.field}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: d.isConflict ? "#fff1f2" : idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                  }}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#334155" }}>
                    {d.field}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#0f172a" }}>
                    {d.sourceValue || "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#0f172a" }}>
                    {d.targetValue || "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {d.isConflict ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#fee2e2",
                          color: "#b91c1c",
                        }}
                      >
                        {t("Conflict", "اختلاف")}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#dcfce7",
                          color: "#15803d",
                        }}
                      >
                        {t("OK / Verified", "درست")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Hard identity conflict block (rule:de91bfcdbd) */}
          {hasIdentityConflicts && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                borderTop: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong>{t("CRITICAL IDENTITY CONFLICT (rule:de91bfcdbd): ", "شدید شناختی اختلاف: ")}</strong>
              {t(
                "A gender or CNIC contradiction indicates these profiles belong to two distinct human beings. Hospital safety policy strictly prohibits overrides. If one record has a data entry error, update it first via Patient Demographics before attempting consolidation.",
                "جنس یا شناختی کارڈ کا تضاد ظاہر کرتا ہے کہ یہ دو مختلف افراد ہیں۔ ہسپتال پالیسی اوور رائیڈ کی سختی سے ممانعت کرتی ہے۔ اگر اندراج میں غلطی ہے تو پہلے اسے درست کریں۔"
              )}
            </div>
          )}
        </div>
      )}

      {/* Dual Control Co-Signer Section (rule:a0a7f261f7) */}
      {selectedSource && selectedTarget && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 16,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              {t("3. Authorization & Co-Signature (rule:a0a7f261f7)", "3. اجازت اور شریک دستخط")}
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                background: requiresCosigner ? "#fef3c7" : "#f1f5f9",
                color: requiresCosigner ? "#92400e" : "#475569",
              }}
            >
              {requiresCosigner
                ? t("Dual Control Required (Regular Profile)", "دوہری تصدیق لازمی ہے (مستقل پروفائل)")
                : t("Standard Supervisor Sign-off Optional", "معیاری ٹراما دستخط اختیاری")}
            </span>
          </div>

          {requiresCosigner && (
            <div
              style={{
                fontSize: 13,
                color: "#92400e",
                background: "#fffbeb",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #fde68a",
              }}
            >
              {t(
                "Merging a permanent (Regular) profile requires an authorized second person holding 'patient.merge.approve'. Please provide co-signer credentials below.",
                "مستقل پروفائل کو ضم کرنے کے لیے دوسرے مجاز افسر کے تصدیقی دستخط درکار ہیں۔"
              )}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                {t("Co-signer Username", "شریک تصدیق کنندہ کا یوزر نیم")}
                {requiresCosigner && <span style={{ color: "#dc2626" }}> *</span>}
              </label>
              <input
                type="text"
                placeholder={t("e.g. reception_supervisor", "مثلاً reception_supervisor")}
                value={cosignerUsername}
                onChange={(e) => setCosignerUsername(e.target.value)}
                data-help="trauma_merge.cosigner_username"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                {t("Co-signer Password", "شریک تصدیق کنندہ کا پاس ورڈ")}
                {requiresCosigner && <span style={{ color: "#dc2626" }}> *</span>}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={cosignerPassword}
                onChange={(e) => setCosignerPassword(e.target.value)}
                data-help="trauma_merge.cosigner_password"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {t("Sensitive credential; never stored or logged.", "حساس معلومات؛ کبھی محفوظ نہیں کی جاتیں۔")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Merge Reason & Final Confirmation */}
      {selectedSource && selectedTarget && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 16,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
            {t("4. Clinical Reason & Confirmation", "4. طبی وجہ اور حتمی تصدیق")}
          </h3>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              {t("Merge Justification / Audit Reason", "انضمام کا جواز / آڈٹ وجہ")}{" "}
              <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              rows={3}
              placeholder={t(
                "e.g. Patient identified via family with CNIC; temporary ER trauma registration consolidated into verified master file.",
                "مثلاً مریض کے اہل خانہ نے شناختی کارڈ سے شناخت کی؛ عارضی ٹراما پروفائل تصدیق شدہ ماسٹر فائل میں ضم کی جا رہی ہے۔"
              )}
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              data-help="trauma_merge.reason_input"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {t("Min 3 characters, max 500 characters. Recorded in indelible audit trail.", "کم از کم 3 حروف، زیادہ سے زیادہ 500 حروف۔ مستقل آڈٹ میں محفوظ ہوگا۔")}
            </span>
          </div>

          {/* Explicit Confirmation Checkbox (rule:ba9b5a51e2) */}
          <div
            style={{
              padding: 12,
              borderRadius: 6,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 13,
                color: "#1e293b",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                data-help="trauma_merge.confirm_checkbox"
                style={{ marginTop: 3 }}
              />
              <span>
                {t(
                  "I confirm that I have reviewed both profiles side-by-side. I verify that the clinical history of source record (MRN: ",
                  "میں تصدیق کرتا ہوں کہ میں نے دونوں پروفائلز کا پہلو بہ پہلو جائزہ لیا ہے۔ ماخذ ریکارڈ (ایم آر این: "
                )}
                <strong>{selectedSource.mrn}</strong>
                {t(
                  ") should be permanently unified under surviving master profile (MRN: ",
                  ") کی تمام طبی تاریخ باقی رہنے والے ماسٹر پروفائل (ایم آر این: "
                )}
                <strong>{selectedTarget.mrn}</strong>
                {t(
                  "). This consolidation is irrevocable.",
                  ") کے تحت یکجا کی جائے۔ یہ عمل ناقابل تنسیخ ہے۔"
                )}
              </span>
            </label>
          </div>

          {/* Validation Error Message */}
          {!isValid && validationError && (
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
              ⚠️ {validationError}
            </div>
          )}

          {/* Write error custom explanation */}
          {Boolean(write.error) && (
            <div
              style={{
                color: "#dc2626",
                fontSize: 13,
                padding: "8px 12px",
                background: "#fef2f2",
                borderRadius: 6,
                border: "1px solid #fecaca",
                lineHeight: 1.5,
              }}
            >
              {explainTraumaMergeError(write.error)}
            </div>
          )}

          {/* Write error / feedback */}
          <ClinicalWriteFeedback write={write} />

          {/* Submit Action Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={write.blocked}
              data-help="trauma_merge.cancel_merge"
              style={{
                padding: "10px 18px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {t("Cancel", "منسوخ")}
            </button>
            <button
              type="button"
              onClick={handleSubmitMerge}
              disabled={
                !canMerge ||
                !isValid ||
                !confirmed ||
                write.blocked ||
                hasIdentityConflicts
              }
              data-help="trauma_merge.submit_merge"
              style={{
                padding: "10px 24px",
                borderRadius: 6,
                background:
                  !canMerge || !isValid || !confirmed || write.blocked || hasIdentityConflicts
                    ? "#94a3b8"
                    : "#b91c1c",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                cursor:
                  !canMerge || !isValid || !confirmed || write.blocked || hasIdentityConflicts
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {write.busy
                ? t("Merging Profiles...", "پروفائلز ضم ہو رہے ہیں...")
                : t("Confirm & Merge Profiles", "تصدیق اور پروفائلز ضم کریں")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default TraumaMerge;
