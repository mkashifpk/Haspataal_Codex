import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad, ErrorBox } from "../components";
import {
  listTreatingDoctors,
  getTreatingDoctor,
  changeTreatingDoctor,
  lookupStaff,
  TreatingDoctorRowOut,
  TreatingDoctorOut,
  DoctorChangeOut,
  StaffLookupOut,
} from "../generated/treating_doctors";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

export function TreatingDoctors({ revision, user, onOpenHelp, connected }: Props) {
  const [localRevision, setLocalRevision] = useState(0);
  const [activeLang, setActiveLang] = useState<"en" | "ur">("en");

  // Filters (rule:c30bccd4b9)
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [waitingOnly, setWaitingOnly] = useState<boolean>(false);

  // Reassignment Modal State (rule:381ef4f081)
  const [reassignAdmission, setReassignAdmission] = useState<TreatingDoctorRowOut | null>(null);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState<string>("");
  const [selectedTargetDoctor, setSelectedTargetDoctor] = useState<StaffLookupOut | null>(null);
  const [reassignReason, setReassignReason] = useState<string>("");
  const [submittingReassign, setSubmittingReassign] = useState<boolean>(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // History Drawer State (rule:3254739ac0)
  const [historyAdmissionId, setHistoryAdmissionId] = useState<number | null>(null);

  // Permissions (q:permissions)
  const canReassign =
    user.permissions.includes("ipd.admission.reassign") ||
    user.permissions.includes("ipd.admission.request");

  // Live Admissions Load (ep:GET /ipd/treating-doctors)
  const admissionsLoad = useLoad(
    () =>
      listTreatingDoctors({
        doctor_id: selectedDoctorId,
        waiting: waitingOnly ? true : undefined,
      }),
    [localRevision, revision, selectedDoctorId, waitingOnly]
  );
  const admissions: TreatingDoctorRowOut[] = admissionsLoad.data || [];

  // Doctor lookup for reassignment (ep:GET /staff/lookup)
  const doctorSearchLoad = useLoad(
    () =>
      doctorSearchQuery.trim().length >= 2
        ? lookupStaff({ q: doctorSearchQuery.trim(), license_type: "PMDC", limit: 20 })
        : Promise.resolve([]),
    [doctorSearchQuery]
  );
  const candidateDoctors: StaffLookupOut[] = doctorSearchLoad.data || [];

  // History Load (ep:GET /admissions/{admission_id}/treating-doctor)
  const historyLoad = useLoad(
    () => (historyAdmissionId ? getTreatingDoctor(historyAdmissionId) : Promise.resolve(null)),
    [historyAdmissionId, localRevision, revision]
  );
  const historyData: TreatingDoctorOut | null = historyLoad.data ?? null;

  // Realtime subscription (ev:admission.doctor_changed)
  useEffect(() => {
    const handleDoctorChanged = () => {
      setLocalRevision((r) => r + 1);
    };
    window.addEventListener("admission.doctor_changed", handleDoctorChanged);
    return () => {
      window.removeEventListener("admission.doctor_changed", handleDoctorChanged);
    };
  }, []);

  // Sort rows: Code Reds without doctor first in amber (rule:c30bccd4b9)
  const sortedAdmissions = [...admissions].sort((a, b) => {
    const aCodeRedWaiting = a.admission_type === "CodeRed" && a.primary_doctor_id === null;
    const bCodeRedWaiting = b.admission_type === "CodeRed" && b.primary_doctor_id === null;
    if (aCodeRedWaiting && !bCodeRedWaiting) return -1;
    if (!aCodeRedWaiting && bCodeRedWaiting) return 1;
    const aWaiting = a.primary_doctor_id === null;
    const bWaiting = b.primary_doctor_id === null;
    if (aWaiting && !bWaiting) return -1;
    if (!aWaiting && bWaiting) return 1;
    return a.admission_number.localeCompare(b.admission_number);
  });

  // Calculate metrics
  const totalInpatients = admissions.length;
  const waitingDoctorCount = admissions.filter((a) => a.primary_doctor_id === null).length;
  const codeRedWaitingCount = admissions.filter(
    (a) => a.admission_type === "CodeRed" && a.primary_doctor_id === null
  ).length;

  // Doctor List for filtering (extracted from current admissions)
  const doctorFilterOptions = Array.from(
    new Map(
      admissions
        .filter((a) => a.primary_doctor_id !== null && a.primary_doctor_name !== null)
        .map((a) => [a.primary_doctor_id!, a.primary_doctor_name!])
    ).entries()
  );

  // Handle Submit Reassignment (rule:381ef4f081)
  const handlePerformReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignAdmission || !selectedTargetDoctor) {
      setReassignError(t("Please select a target doctor.", "براہ کرم نیا معالج منتخب کریں۔"));
      return;
    }
    if (!reassignReason.trim() || reassignReason.trim().length < 3) {
      setReassignError(
        t(
          "A documented reason is mandatory for the medico-legal record.",
          "میڈیکو لیگل ریکارڈ کے لیے وجہ لکھنا لازمی ہے۔"
        )
      );
      return;
    }
    if (selectedTargetDoctor.employee_id === reassignAdmission.primary_doctor_id) {
      setReassignError(
        t(
          "Selected doctor is already the treating doctor.",
          "منتخب ڈاکٹر پہلے ہی اس مریض کے معالج ہیں۔"
        )
      );
      return;
    }

    setSubmittingReassign(true);
    setReassignError(null);
    try {
      await changeTreatingDoctor(reassignAdmission.admission_id, {
        doctor_id: selectedTargetDoctor.employee_id,
        reason: reassignReason.trim(),
      });
      setReassignAdmission(null);
      setSelectedTargetDoctor(null);
      setDoctorSearchQuery("");
      setReassignReason("");
      setLocalRevision((r) => r + 1);
    } catch (err: any) {
      setReassignError(err?.message || String(err));
    } finally {
      setSubmittingReassign(false);
    }
  };

  return (
    <div
      data-screen="treating_doctors"
      style={{
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflowY: "auto",
        fontFamily: activeLang === "ur" ? "Noto Nastaliq Urdu, sans-serif" : "inherit",
        direction: activeLang === "ur" ? "rtl" : "ltr",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid #dee2e6",
          paddingBottom: "12px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
            {t("Treating doctors", "زیر علاج مریضوں کے معالجین")}
          </h1>
          <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
            {t(
              "Executive oversight of live inpatient doctor coverage, Code Red escalations, and handover audit trail.",
              "داخل مریضوں کی ڈاکٹر کوریج، ایمرجنسی کوڈ ریڈ الرٹ اور معالج کی تبدیلی کا آڈٹ ٹریل۔"
            )}
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Toggle Language */}
          <button
            type="button"
            data-help="treating_doctors.language"
            onClick={() => setActiveLang((l) => (l === "en" ? "ur" : "en"))}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #6c757d",
              background: "#fff",
              fontSize: "0.85rem",
            }}
          >
            🌐 {activeLang === "en" ? "اردو (Urdu)" : "English"}
          </button>

          {/* Refresh */}
          <button
            type="button"
            data-help="treating_doctors.refresh"
            onClick={() => setLocalRevision((r) => r + 1)}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #0d6efd",
              background: "#0d6efd",
              color: "#fff",
              fontSize: "0.85rem",
            }}
          >
            🔄 {t("Refresh", "تازہ کریں")}
          </button>

          {/* Help */}
          <button
            type="button"
            data-help="treating_doctors.help"
            onClick={onOpenHelp}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #198754",
              background: "#198754",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "bold",
            }}
          >
            ❓ {t("Help (F1)", "مدد (F1)")}
          </button>
        </div>
      </div>

      {/* Code Red Alert Banner (rule:c30bccd4b9) */}
      {codeRedWaitingCount > 0 && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffe69c",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "16px",
            color: "#664d03",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>⚠️</span>
          <div>
            <strong>
              {t(
                `${codeRedWaitingCount} Code Red admission(s) urgently waiting for a treating doctor!`,
                `${codeRedWaitingCount} کوڈ ریڈ داخلے فوری طور پر معالج کے منتظر ہیں!`
              )}
            </strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>
              {t(
                "Immediate doctor assignment is required for emergency clinical handover.",
                "ہنگامی طبی دیکھ بھال کے لیے فوری طور پر معالج تفویض کریں۔"
              )}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Summary Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            background: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#6c757d", textTransform: "uppercase" }}>
            {t("Total Inpatients", "کل داخل مریض")}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#212529", marginTop: "4px" }}>
            {totalInpatients}
          </div>
        </div>

        <div
          style={{
            background: waitingDoctorCount > 0 ? "#fff3cd" : "#f8f9fa",
            border: `1px solid ${waitingDoctorCount > 0 ? "#ffe69c" : "#dee2e6"}`,
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#6c757d", textTransform: "uppercase" }}>
            {t("Waiting for Doctor", "ڈاکٹر کے منتظر")}
          </div>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: waitingDoctorCount > 0 ? "#b02a37" : "#198754",
              marginTop: "4px",
            }}
          >
            {waitingDoctorCount}
          </div>
        </div>

        <div
          style={{
            background: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "6px",
            padding: "12px",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#6c757d", textTransform: "uppercase" }}>
            {t("Assigned Coverage Rate", "ڈاکٹر کوریج شرح")}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0d6efd", marginTop: "4px" }}>
            {totalInpatients > 0
              ? `${Math.round(((totalInpatients - waitingDoctorCount) / totalInpatients) * 100)}%`
              : "100%"}
          </div>
        </div>
      </div>

      {/* Filter Toolbar (rule:c30bccd4b9) */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "#fff",
          padding: "12px",
          borderRadius: "6px",
          border: "1px solid #dee2e6",
        }}
      >
        {/* Doctor Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
            {t("Filter by Doctor:", "ڈاکٹر کے لحاظ سے فلٹر:")}
          </label>
          <select
            data-help="treating_doctors.filter_doctor"
            value={selectedDoctorId ?? ""}
            onChange={(e) =>
              setSelectedDoctorId(e.target.value ? Number(e.target.value) : null)
            }
            style={{
              padding: "6px 10px",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              fontSize: "0.85rem",
            }}
          >
            <option value="">{t("All Doctors", "تمام معالجین")}</option>
            {doctorFilterOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Waiting Only Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "bold",
            }}
          >
            <input
              type="checkbox"
              data-help="treating_doctors.filter_waiting"
              checked={waitingOnly}
              onChange={(e) => setWaitingOnly(e.target.checked)}
            />
            {t("Show Waiting for Doctor only", "صرف بغیر ڈاکٹر کے داخلے دکھائیں")}
          </label>
        </div>
      </div>

      {/* Main Table (rule:c30bccd4b9: No clinical records or diagnoses shown) */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <LoadState loading={admissionsLoad.loading} error={admissionsLoad.error} retry={admissionsLoad.reload} />
        <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6", textAlign: "left" }}>
                <th style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                  {t("Admission", "داخلہ نمبر")}
                </th>
                <th style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                  {t("Patient & MRN", "مریض اور ایم آر این")}
                </th>
                <th style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                  {t("Ward & Bed", "وارڈ اور بیڈ")}
                </th>
                <th style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                  {t("Treating Doctor", "زیر علاج معالج")}
                </th>
                <th style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                  {t("Assigned Since", "تعیناتی کا وقت")}
                </th>
                <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "center" }}>
                  {t("Actions", "اقدامات")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAdmissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "#6c757d",
                      fontStyle: "italic",
                    }}
                  >
                    {t("No inpatient admissions match the selected filter.", "کوئی داخل مریض فلٹر کے مطابق نہیں ملا۔")}
                  </td>
                </tr>
              ) : (
                sortedAdmissions.map((row) => {
                  const isCodeRedWaiting =
                    row.admission_type === "CodeRed" && row.primary_doctor_id === null;
                  const isWaiting = row.primary_doctor_id === null;

                  return (
                    <tr
                      key={row.admission_id}
                      style={{
                        background: isCodeRedWaiting
                          ? "#fff3cd"
                          : isWaiting
                          ? "#fff9e6"
                          : "inherit",
                        borderBottom: "1px solid #dee2e6",
                      }}
                    >
                      {/* Admission */}
                      <td style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                        <div style={{ fontWeight: "bold" }}>{row.admission_number}</div>
                        <div style={{ marginTop: "4px" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background:
                                row.admission_type === "CodeRed"
                                  ? "#dc3545"
                                  : row.admission_type === "Emergency"
                                  ? "#fd7e14"
                                  : "#6c757d",
                              color: "#fff",
                              fontWeight: "bold",
                            }}
                          >
                            {row.admission_type}
                          </span>
                        </div>
                      </td>

                      {/* Patient & MRN */}
                      <td style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                        <div style={{ fontWeight: "bold" }}>{row.patient_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                          MRN: {row.mrn}
                        </div>
                      </td>

                      {/* Ward & Bed */}
                      <td style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                        <div>{row.ward_name || t("Unassigned Ward", "غیر معین وارڈ")}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                          {row.bed_label ? `Bed: ${row.bed_label}` : t("No Bed", "کوئی بیڈ نہیں")}
                        </div>
                      </td>

                      {/* Treating Doctor */}
                      <td style={{ padding: "10px", border: "1px solid #dee2e6" }}>
                        {row.primary_doctor_id ? (
                          <div style={{ fontWeight: "bold", color: "#0d6efd" }}>
                            👨‍⚕️ {row.primary_doctor_name}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontWeight: "bold",
                              color: "#b02a37",
                              background: "#f8d7da",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            ⚠️ {t("Waiting for Doctor", "ڈاکٹر کے منتظر")}
                          </div>
                        )}
                      </td>

                      {/* Assigned Since */}
                      <td style={{ padding: "10px", border: "1px solid #dee2e6", color: "#495057" }}>
                        {row.doctor_since
                          ? new Date(row.doctor_since).toLocaleString()
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          padding: "10px",
                          border: "1px solid #dee2e6",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          {/* Reassign Button (rule:381ef4f081) */}
                          <button
                            type="button"
                            data-help="treating_doctors.reassign"
                            disabled={!canReassign}
                            onClick={() => {
                              setReassignAdmission(row);
                              setSelectedTargetDoctor(null);
                              setDoctorSearchQuery("");
                              setReassignReason("");
                              setReassignError(null);
                            }}
                            style={{
                              padding: "4px 10px",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "1px solid #0d6efd",
                              background: canReassign ? "#0d6efd" : "#e9ecef",
                              color: canReassign ? "#fff" : "#6c757d",
                              cursor: canReassign ? "pointer" : "not-allowed",
                            }}
                          >
                            🔄 {t("Reassign", "تبدیل کریں")}
                          </button>

                          {/* History Button (rule:3254739ac0) */}
                          <button
                            type="button"
                            data-help="treating_doctors.history"
                            onClick={() => setHistoryAdmissionId(row.admission_id)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "1px solid #6c757d",
                              background: "#fff",
                              color: "#495057",
                              cursor: "pointer",
                            }}
                          >
                            📜 {t("History", "ہسٹری")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {/* Reassign Modal (rule:381ef4f081) */}
      {reassignAdmission && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "540px",
              width: "90%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                borderBottom: "1px solid #dee2e6",
                paddingBottom: "8px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                {t("Reassign Treating Doctor", "مریض کا معالج تبدیل کریں")}
              </h2>
              <button
                type="button"
                data-help="treating_doctors.close"
                onClick={() => setReassignAdmission(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "12px", fontSize: "0.85rem" }}>
              <div>
                <strong>{t("Admission:", "داخلہ:")}</strong> {reassignAdmission.admission_number} (
                {reassignAdmission.patient_name} - MRN: {reassignAdmission.mrn})
              </div>
              <div style={{ marginTop: "4px" }}>
                <strong>{t("Current Doctor:", "موجودہ معالج:")}</strong>{" "}
                {reassignAdmission.primary_doctor_name || t("None (Unassigned)", "کوئی نہیں")}
              </div>
            </div>

            {reassignError && (
              <div
                style={{
                  background: "#f8d7da",
                  color: "#842029",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  fontSize: "0.85rem",
                }}
              >
                ⚠️ {reassignError}
              </div>
            )}

            <form onSubmit={handlePerformReassign}>
              {/* Doctor Search Field */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Search Target Doctor (PMDC registered):", "نیا معالج تلاش کریں (پی ایم ڈی سی رجسٹرڈ):")}
                </label>
                <input
                  type="text"
                  data-help="treating_doctors.doctor_search"
                  placeholder={t("Type doctor name or designation...", "ڈاکٹر کا نام یا عہدہ لکھیں...")}
                  value={doctorSearchQuery}
                  onChange={(e) => {
                    setDoctorSearchQuery(e.target.value);
                    setSelectedTargetDoctor(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ced4da",
                    boxSizing: "border-box",
                    fontSize: "0.85rem",
                  }}
                />

                {/* Candidate list */}
                {doctorSearchQuery.trim().length >= 2 && !selectedTargetDoctor && (
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      marginTop: "4px",
                      background: "#fff",
                    }}
                  >
                    {candidateDoctors.length === 0 ? (
                      <div style={{ padding: "8px", fontSize: "0.8rem", color: "#6c757d" }}>
                        {t("No PMDC registered doctors found.", "کوئی رجسٹرڈ ڈاکٹر نہیں ملا۔")}
                      </div>
                    ) : (
                      candidateDoctors.map((doc) => (
                        <div
                          key={doc.employee_id}
                          onClick={() => {
                            setSelectedTargetDoctor(doc);
                            setDoctorSearchQuery(doc.full_name);
                          }}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f8f9fa",
                            fontSize: "0.85rem",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e9ecef")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                        >
                          <strong>{doc.full_name}</strong> — {doc.designation} (
                          {doc.registration || "PMDC"})
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedTargetDoctor && (
                  <div
                    style={{
                      marginTop: "6px",
                      background: "#e8f4fd",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      color: "#0c5460",
                    }}
                  >
                    ✓ {t("Selected:", "منتخب شدہ:")} <strong>{selectedTargetDoctor.full_name}</strong> (
                    {selectedTargetDoctor.registration || "PMDC"})
                  </div>
                )}
              </div>

              {/* Mandatory Reason */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Reason for Reassignment (Medico-Legal Record):", "تبدیلی کی وجہ (میڈیکو لیگل ریکارڈ):")}
                </label>
                <textarea
                  data-help="treating_doctors.reason"
                  rows={3}
                  placeholder={t(
                    "Document reason e.g. doctor leave coverage, clinical specialization transfer...",
                    "وجہ درج کریں مثلا چھٹی، خصوصی معائنے کی منتقلی وغیرہ..."
                  )}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ced4da",
                    boxSizing: "border-box",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  data-help="treating_doctors.close"
                  onClick={() => setReassignAdmission(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #6c757d",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  data-help="treating_doctors.submit_reassign"
                  disabled={submittingReassign || !selectedTargetDoctor || !reassignReason.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #0d6efd",
                    background: submittingReassign ? "#6c757d" : "#0d6efd",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: submittingReassign ? "not-allowed" : "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {submittingReassign ? t("Reassigning...", "تبدیل ہو رہا ہے...") : t("Confirm Reassignment", "تبدیلی کی تصدیق کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer (rule:3254739ac0) */}
      {historyAdmissionId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: activeLang === "ur" ? "auto" : 0,
            left: activeLang === "ur" ? 0 : "auto",
            bottom: 0,
            width: "480px",
            maxWidth: "90%",
            background: "#fff",
            boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #dee2e6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              📜 {t("Treating Doctor History", "معالج کی تاریخ")}
            </h2>
            <button
              type="button"
              data-help="treating_doctors.close"
              onClick={() => setHistoryAdmissionId(null)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <LoadState loading={historyLoad.loading} error={historyLoad.error} retry={historyLoad.reload} />
            {historyData && (
                <div>
                  <div
                    style={{
                      marginBottom: "16px",
                      padding: "12px",
                      background: "#f8f9fa",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <strong>{t("Admission:", "داخلہ:")}</strong> {historyData.admission_number}
                    </div>
                    <div>
                      <strong>{t("Patient:", "مریض:")}</strong> {historyData.patient_name} (MRN:{" "}
                      {historyData.mrn})
                    </div>
                    <div>
                      <strong>{t("Current Doctor:", "موجودہ معالج:")}</strong>{" "}
                      {historyData.primary_doctor_name || t("None", "کوئی نہیں")}
                    </div>
                  </div>

                  <h3 style={{ fontSize: "0.95rem", marginBottom: "8px" }}>
                    {t("Audit Trail of Changes (Oldest First)", "تبدیلیوں کا آڈٹ ٹریل")}
                  </h3>

                  {(!historyData.changes || historyData.changes.length === 0) ? (
                    <div style={{ color: "#6c757d", fontStyle: "italic", fontSize: "0.85rem" }}>
                      {t("No doctor changes recorded for this admission.", "اس داخلے کے لیے کوئی تبدیلی ریکارڈ نہیں ہے۔")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {historyData.changes.map((change) => (
                        <div
                          key={change.change_id}
                          style={{
                            border: "1px solid #dee2e6",
                            borderRadius: "6px",
                            padding: "12px",
                            background: "#fff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                background:
                                  change.kind === "TakeOver"
                                    ? "#cfe2ff"
                                    : change.kind === "Handover"
                                    ? "#d1e7dd"
                                    : "#e2d9f3",
                                color:
                                  change.kind === "TakeOver"
                                    ? "#084298"
                                    : change.kind === "Handover"
                                    ? "#0f5132"
                                    : "#432874",
                              }}
                            >
                              {change.kind}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                              {new Date(change.changed_at).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
                            {change.from_doctor_name ? (
                              <span>
                                {change.from_doctor_name} ➔ <strong>{change.to_doctor_name}</strong>
                              </span>
                            ) : (
                              <span>
                                ➔ <strong>{change.to_doctor_name}</strong> ({t("Initial Assignment", "پہلی تعیناتی")})
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: "0.8rem", color: "#495057", marginBottom: "4px" }}>
                            <strong>{t("Reason:", "وجہ:")}</strong> {change.reason}
                          </div>

                          <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                            {t("Recorded by:", "درج کنندہ:")} {change.changed_by_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
