import { useEffect, useState } from "react";
import {
  Empty,
  ErrorBox,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  CriticalResultOut,
  CriticalResultDetailOut,
} from "../generated/critical_results_ward";
import {
  listCritical,
  getCritical,
} from "../generated/critical_results_ward";
import {
  criticalResultsWardAccess,
  getCriticalStatusBadge,
} from "../critical-results-ward-policy";

export interface CriticalResultsWardProps {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
  initialAdmissionId?: number;
  screenId?: "critical_results_ward" | "critical_results_er" | string;
}

export function CriticalResultsWard({
  user,
  connected,
  stream,
  establishment,
  timeZone,
  initialAdmissionId,
  screenId = "critical_results_ward",
}: CriticalResultsWardProps) {
  const isEr = screenId === "critical_results_er";
  const screenView =
    establishment.views.screens.find(
      (s) => s.screen_id === screenId,
    )?.view || "full";

  const access = criticalResultsWardAccess(user.permissions, screenView);

  const [tick, setTick] = useState(0);
  const [openOnly, setOpenOnly] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<"All" | "Lab" | "Imaging">("All");
  const [admissionFilter, setAdmissionFilter] = useState<string>(
    initialAdmissionId ? String(initialAdmissionId) : "",
  );
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  // Load critical results list
  const resultsState = useLoad(
    async () => {
      if (!access.canView) return [];
      const admissionIdNum = admissionFilter.trim()
        ? parseInt(admissionFilter.trim(), 10)
        : null;
      return listCritical({
        open_only: openOnly,
        source: sourceFilter === "All" ? null : sourceFilter,
        admission_id: admissionIdNum && !isNaN(admissionIdNum) ? admissionIdNum : null,
        limit: 100,
      });
    },
    [access.canView, openOnly, sourceFilter, admissionFilter, tick],
  );

  // Load detail record when a result is selected
  const detailState = useLoad(
    async () => {
      if (!selectedResultId || !access.canView) return null;
      return getCritical(selectedResultId);
    },
    [selectedResultId, access.canView],
  );

  // Realtime event listener for critical_result.updated and system notifications
  useEffect(() => {
    if (!connected) return;
    const handleEvent = (e: CustomEvent) => {
      const topic = e.detail?.topic || "";
      if (
        topic === "critical_result.updated" ||
        topic.startsWith("session.") ||
        topic.startsWith("system.") ||
        topic === "notification.created"
      ) {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("haspataal:event" as any, handleEvent);
    return () => window.removeEventListener("haspataal:event" as any, handleEvent);
  }, [connected]);

  const items = resultsState.data || [];
  const overdueCount = items.filter((i) => i.is_overdue && i.status !== "Acknowledged").length;

  if (access.isDenied) {
    return (
      <section className="critical-results-screen" aria-labelledby="screen-title">
        <h1 id="screen-title">
          {t("Critical results of my patients", "میرے مریضوں کے ہنگامی نتائج")}
        </h1>
        <ErrorBox
          error={t(
            "You do not have permission to view inpatient critical diagnostic results.",
            "آپ کے پاس داخل مریضوں کے ہنگامی تشخیصی نتائج دیکھنے کی اجازت نہیں ہے۔",
          )}
        />
      </section>
    );
  }

  return (
    <section className="critical-results-screen" aria-labelledby="screen-title">
      <header className="screen-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 id="screen-title">
              {t("Critical results of my patients", "میرے مریضوں کے ہنگامی نتائج")}
            </h1>
            <p className="screen-purpose">
              {t(
                "See the critical results of the patients in the ward or the department, and who was told.",
                "وارڈ یا شعبے کے مریضوں کے ہنگامی نتائج اور ان کی اطلاع کی تفصیلات دیکھیں۔",
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            data-help="crit_ward.refresh"
            onClick={() => setTick((t) => t + 1)}
            title={t("Refresh critical results", "تازہ کریں")}
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>

        {access.isRetiring && (
          <div className="banner banner-warning" role="alert">
            <strong>
              {t(
                "No new critical results from now on",
                "اب سے نئے ہنگامی نتائج موصول نہیں ہوں گے",
              )}
            </strong>{" "}
            —{" "}
            {isEr
              ? t(
                  "Emergency department service is retiring; finalize open communications only.",
                  "ایمرجنسی سروس ریٹائر ہو رہی ہے؛ صرف کھلی ہوئی اطلاعات مکمل کریں۔",
                )
              : t(
                  "Inpatient service is retiring; finalize open communications only.",
                  "ان ڈور سروس ریٹائر ہو رہی ہے؛ صرف کھلی ہوئی اطلاعات مکمل کریں۔",
                )}
          </div>
        )}

        {access.isRecordsOnly && (
          <div className="banner banner-info" role="status">
            <strong>
              {t("Records Only Mode", "صرف ریکارڈز موڈ")}
            </strong>{" "}
            —{" "}
            {isEr
              ? t(
                  "Emergency department service is retired. Critical results are displayed in read-only mode.",
                  "ایمرجنسی سروس ریٹائر ہو چکی ہے۔ ہنگامی نتائج صرف مطالعہ کے لیے ہیں۔",
                )
              : t(
                  "Inpatient service is retired. Critical results are displayed in read-only mode.",
                  "ان ڈور سروس ریٹائر ہو چکی ہے۔ ہنگامی نتائج صرف مطالعہ کے لیے ہیں۔",
                )}
          </div>
        )}

        {/* Read-back policy alert per rule:abc8a2c23d */}
        <div
          className="alert alert-warning"
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "0.75rem",
            borderRadius: "6px",
            marginTop: "0.5rem",
            fontSize: "0.88rem",
            color: "#92400e",
          }}
        >
          <strong>⚠️ {t("Clinical Nursing Hand-off Policy (rule:abc8a2c23d)", "طبی نرسنگ پروٹوکول (اصول abc8a2c23d)")}:</strong>{" "}
          {isEr
            ? t(
                "When the lab or radiology phones the emergency department with a critical result, the triage nurse must read the values back and immediately notify the emergency physician.",
                "جب لیب یا ریڈیالوجی ایمرجنسی کو ہنگامی نتیجہ فون کرے، نرس کو نتائج واپس پڑھ کر سنانے ہوں گے اور فوری ایمرجنسی معالج کو بتانا ہوگا۔",
              )
            : t(
                "When the lab or radiology phones the ward with a critical result, the nurse must read the values back and immediately notify the treating doctor.",
                "جب لیب یا ریڈیالوجی وارڈ کو ہنگامی نتیجہ فون کرے، نرس کو نتائج واپس پڑھ کر سنانے ہوں گے اور فوری معالج کو بتانا ہوگا۔",
              )}
        </div>

        {overdueCount > 0 && (
          <div
            className="alert alert-danger"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: "0.75rem",
              borderRadius: "6px",
              marginTop: "0.5rem",
              fontSize: "0.9rem",
              color: "#991b1b",
              fontWeight: "bold",
            }}
          >
            🚨 {t("URGENT ATTENTION", "فوری توجہ")}: {overdueCount}{" "}
            {t(
              "critical result(s) are OVERDUE for clinician communication or doctor action!",
              "ہنگامی نتائج ڈاکٹر کو مطلع کرنے میں تاخیر کا شکار ہیں!",
            )}
          </div>
        )}
      </header>

      {/* Filter Toolbar */}
      <div
        className="filter-bar card"
        style={{
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          padding: "0.75rem",
          borderRadius: "6px",
          marginTop: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.9rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            data-help="crit_ward.filter_open"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          <strong>{t("Open / Communicating only", "صرف کھلے اور زیر اطلاع")}</strong>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
          <label htmlFor="source-select">{t("Source", "ذریعہ")}:</label>
          <select
            id="source-select"
            data-help="crit_ward.filter_source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            style={{ padding: "4px 8px" }}
          >
            <option value="All">{t("All Sources (Lab & Imaging)", "تمام ذرائع (لیب و ایکسرے)")}</option>
            <option value="Lab">{t("Laboratory Only", "صرف لیبارٹری")}</option>
            <option value="Imaging">{t("Imaging / Radiology Only", "صرف عکس نگاری")}</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
          <label htmlFor="admission-filter-input">{t("Admission ID", "داخلہ نمبر")}:</label>
          <input
            id="admission-filter-input"
            type="number"
            placeholder={t("Filter stay...", "داخلہ فلٹر...")}
            data-help="crit_ward.admission_input"
            value={admissionFilter}
            onChange={(e) => setAdmissionFilter(e.target.value)}
            style={{ width: "120px", padding: "4px 8px" }}
          />
          {admissionFilter && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-help="crit_ward.admission_clear"
              onClick={() => setAdmissionFilter("")}
            >
              {t("Clear", "صاف")}
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div style={{ marginTop: "1rem" }}>
        <LoadState
          loading={resultsState.loading}
          error={resultsState.error}
          retry={resultsState.reload}
        />

        {!resultsState.loading && items.length === 0 && (
          <Empty>
            {t(
              "No critical diagnostic results found matching current filters.",
              "موجودہ شرائط کے مطابق کوئی ہنگامی تشخیصی نتائج نہیں ملے۔",
            )}
          </Empty>
        )}

        {items.length > 0 && (
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", background: "#f1f5f9" }}>
                  <th style={{ padding: "8px" }}>{t("Result ID / Source", "نتیجہ نمبر / ذریعہ")}</th>
                  <th style={{ padding: "8px" }}>{t("Patient & Bed", "مریض اور بستر")}</th>
                  <th style={{ padding: "8px" }}>{t("Critical Finding", "ہنگامی نتیجہ")}</th>
                  <th style={{ padding: "8px" }}>{t("Status & Overdue", "حیثیت اور تاخیر")}</th>
                  <th style={{ padding: "8px" }}>{t("Requester Doctor", "معالج")}</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>{t("Details", "تفصیل")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const badge = getCriticalStatusBadge(item.status, item.is_overdue);
                  const isOverdue = item.is_overdue && item.status !== "Acknowledged";
                  return (
                    <tr
                      key={`crit-${item.critical_result_id}`}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: isOverdue ? "#fff1f2" : "transparent",
                      }}
                    >
                      <td style={{ padding: "8px" }}>
                        <strong>{item.critical_number}</strong>
                        <div>
                          <span
                            className="badge"
                            style={{
                              padding: "1px 6px",
                              borderRadius: "3px",
                              fontSize: "0.75rem",
                              background: item.source === "Lab" ? "#dbeafe" : "#fae8ff",
                              color: item.source === "Lab" ? "#1e40af" : "#86198f",
                            }}
                          >
                            {item.source}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "8px" }}>
                        <strong>{item.patient_name}</strong>
                        <div style={{ fontSize: "0.8rem", color: "#555" }}>
                          MRN: {item.mrn}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                          {t("Ward", "وارڈ")}: {item.ward_name || "N/A"} | {t("Bed", "بستر")}: {item.bed_label || "N/A"}
                        </div>
                        {item.admission_number && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {item.admission_number}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: "bold", color: "#b91c1c" }}>
                          {item.test_name}
                        </div>
                        <div style={{ marginTop: "2px", color: "#1e293b", fontSize: "0.85rem" }}>
                          {item.finding}
                        </div>
                        {item.notifiable_disease && (
                          <div style={{ marginTop: "4px" }}>
                            <span className="badge badge-warning" style={{ background: "#fef3c7", color: "#b45309", padding: "1px 5px", fontSize: "0.75rem" }}>
                              🔔 {t("Notifiable", "قابل اطلاع")}: {item.notifiable_disease}
                            </span>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px" }}>
                        <div>
                          <span
                            className="badge"
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: "bold",
                              fontSize: "0.75rem",
                              background:
                                badge.tone === "danger"
                                  ? "#ef4444"
                                  : badge.tone === "warning"
                                    ? "#f59e0b"
                                    : badge.tone === "info"
                                      ? "#0284c7"
                                      : "#10b981",
                              color: "#fff",
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        {isOverdue && (
                          <div style={{ color: "#dc2626", fontWeight: "bold", fontSize: "0.75rem", marginTop: "3px" }}>
                            🚨 {t("OVERDUE", "تاخیر شدہ")}
                          </div>
                        )}
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                          {t("Reported", "رپورٹ")}: {new Date(item.reported_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      <td style={{ padding: "8px" }}>
                        <div>{item.requester_doctor_name || t("Unassigned", "غیر متعین")}</div>
                        {item.acknowledged_by_name && (
                          <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "2px" }}>
                            ✓ {t("Acknowledged by", "تسلیم کنندہ")}: {item.acknowledged_by_name}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "8px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          data-help="crit_ward.view_detail"
                          onClick={() => setSelectedResultId(item.critical_result_id)}
                        >
                          {t("Details & Log", "تفصیل و ریکارڈ")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Critical Result Details & Communication Log Modal */}
      {selectedResultId && (
        <Modal
          title={`${t("Critical Result Detail", "ہنگامی نتیجہ کی تفصیل")} #${selectedResultId}`}
          onClose={() => setSelectedResultId(null)}
        >
          <div>
            <LoadState
              loading={detailState.loading}
              error={detailState.error}
              retry={detailState.reload}
            />

            {detailState.data && (
              <div className="critical-detail-view" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.88rem" }}>
                    <div><strong>{t("Critical ID", "نمبر")}:</strong> {detailState.data.critical_number}</div>
                    <div><strong>{t("Source", "ذریعہ")}:</strong> {detailState.data.source}</div>
                    <div><strong>{t("Patient", "مریض")}:</strong> {detailState.data.patient_name} ({detailState.data.mrn})</div>
                    <div><strong>{t("Ward / Bed", "وارڈ / بستر")}:</strong> {detailState.data.ward_name || "N/A"} / {detailState.data.bed_label || "N/A"}</div>
                    <div><strong>{t("Test Name", "ٹیسٹ")}:</strong> {detailState.data.test_name}</div>
                    <div><strong>{t("Status", "حیثیت")}:</strong> {detailState.data.status}</div>
                    <div><strong>{t("Reported By", "رپورٹ کنندہ")}:</strong> {detailState.data.reported_by_name}</div>
                    <div><strong>{t("Requester Doctor", "معالج")}:</strong> {detailState.data.requester_doctor_name || "N/A"}</div>
                  </div>

                  <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "4px" }}>
                    <div style={{ fontSize: "0.8rem", color: "#991b1b", fontWeight: "bold" }}>{t("CRITICAL FINDING / VALUES", "ہنگامی نتیجہ / قدریں")}:</div>
                    <div style={{ fontSize: "1rem", fontWeight: "bold", color: "#b91c1c", marginTop: "2px" }}>
                      {detailState.data.finding}
                    </div>
                  </div>
                </div>

                {/* Communication Log */}
                <div>
                  <h3 style={{ fontSize: "1rem", margin: "0 0 0.5rem 0" }}>
                    {t("Communication Log (Who was told)", "اطلاع کا ریکارڈ (کس کو بتایا گیا)")}
                  </h3>
                  {detailState.data.communications.length === 0 ? (
                    <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>
                      {t("No communications recorded yet. Result is Open awaiting notification.", "ابھی تک کوئی اطلاع ریکارڈ نہیں ہوئی۔ نتیجہ کھلا ہے اور اطلاع کا منتظر ہے۔")}
                    </div>
                  ) : (
                    <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #cbd5e1", background: "#f8fafc", textAlign: "left" }}>
                          <th style={{ padding: "6px" }}>{t("Time", "وقت")}</th>
                          <th style={{ padding: "6px" }}>{t("Informed By", "مطلع کنندہ")}</th>
                          <th style={{ padding: "6px" }}>{t("Recipient", "وصول کنندہ")}</th>
                          <th style={{ padding: "6px" }}>{t("Means", "ذریعہ")}</th>
                          <th style={{ padding: "6px" }}>{t("Read Back?", "پڑھ کر سنایا؟")}</th>
                          <th style={{ padding: "6px" }}>{t("Notes", "نوٹس")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailState.data.communications.map((c) => (
                          <tr key={`comm-${c.communication_id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "6px" }}>{new Date(c.informed_at).toLocaleString()}</td>
                            <td style={{ padding: "6px" }}>{c.informed_by_name}</td>
                            <td style={{ padding: "6px" }}>
                              <strong>{c.recipient_name}</strong>
                              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.recipient_role}</div>
                            </td>
                            <td style={{ padding: "6px" }}>{c.means}</td>
                            <td style={{ padding: "6px" }}>
                              {c.read_back ? (
                                <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓ {t("Yes", "ہاں")}</span>
                              ) : (
                                <span style={{ color: "#dc2626" }}>✗ {t("No", "نہیں")}</span>
                              )}
                            </td>
                            <td style={{ padding: "6px", color: "#475569" }}>{c.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Doctor Acknowledgement & Action Taken */}
                {detailState.data.acknowledged_at && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "6px" }}>
                    <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#166534" }}>
                      ✓ {t("Doctor Acknowledgement", "ڈاکٹر کی تصدیق")}
                    </h3>
                    <div style={{ fontSize: "0.85rem", color: "#15803d" }}>
                      <div><strong>{t("Acknowledged By", "تصدیق کنندہ")}:</strong> {detailState.data.acknowledged_by_name}</div>
                      <div><strong>{t("Time", "وقت")}:</strong> {new Date(detailState.data.acknowledged_at).toLocaleString()}</div>
                      {detailState.data.action_taken && (
                        <div style={{ marginTop: "4px" }}>
                          <strong>{t("Action Taken", "کی گئی کارروائی")}:</strong> {detailState.data.action_taken}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-help="crit_ward.close_detail"
                    onClick={() => setSelectedResultId(null)}
                  >
                    {t("Close", "بند کریں")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
