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
  MedicationWorklistItemOut,
  HighAlertListOut,
  HighAlertCategoryOut,
  SafetyDrugOut,
  LasaPairOut,
} from "../generated/medication_safety_ward";
import {
  safetyWorklist,
  highAlertList,
  highAlertPdf,
  policyPdfMedicationSafety,
} from "../generated/medication_safety_ward";
import {
  getMedicationSafetyWardScreenView,
  isInpatientActive,
  calculateSafetyWorklistCounts,
  filterSafetyWorklist,
  SAFETY_KINDS_META,
  HIGH_ALERT_CATEGORY_NOTES,
  type SafetyItemKind,
} from "../medication-safety-ward-policy";
import { api, call } from "../bridge";

export interface MedicationSafetyWardProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  initialWardId?: number | null;
  onNavigateScreen?: (screen: string) => void;
}

interface WardOption {
  ward_id: number;
  name: string;
}

export function MedicationSafetyWard({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  initialWardId = null,
  onNavigateScreen,
}: MedicationSafetyWardProps) {
  // Permissions check
  const canViewSafety =
    (user.permissions?.includes("medication.safety.view") ?? false) ||
    (user.permissions?.includes("patient.wristband.print") ?? false);

  // Real-time revision tracking
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Active Establishment state
  const [est, setEst] = useState<EstablishmentOut | null>(propEstablishment || null);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  // Screen view mode
  const screenView = getMedicationSafetyWardScreenView(est);
  const inpatientActive = isInpatientActive(est);

  // Active Tab: "worklist" or "high_alert" (rule:b9e1768945, rule:a810f77980)
  const [activeTab, setActiveTab] = useState<"worklist" | "high_alert">("worklist");

  // Filters State
  const [selectedWardId, setSelectedWardId] = useState<number | null>(initialWardId);
  const [selectedKind, setSelectedKind] = useState<SafetyItemKind | "All">("All");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Wards List State
  const [wardsList, setWardsList] = useState<WardOption[]>([]);
  useEffect(() => {
    async function loadWards() {
      try {
        const res = await api<any>("GET", "/wards?limit=50");
        const list = res.data || (Array.isArray(res) ? res : []);
        setWardsList(
          list.map((w: any) => ({
            ward_id: w.ward_id,
            name: w.name || `Ward #${w.ward_id}`,
          }))
        );
      } catch {
        // Fallback default
        setWardsList([
          { ward_id: 1, name: "General Female Ward" },
          { ward_id: 2, name: "General Male Ward" },
          { ward_id: 3, name: "Intensive Care Unit" },
        ]);
      }
    }
    loadWards();
  }, []);

  // Load Safety Worklist (rule:b9e1768945)
  const worklistLoad = useLoad<MedicationWorklistItemOut[]>(async () => {
    const q: { ward_id?: number | null } = {};
    if (selectedWardId) {
      q.ward_id = selectedWardId;
    }
    return await safetyWorklist(q);
  }, [selectedWardId, revision]);

  const rawWorklist = worklistLoad.data || [];
  const counts = calculateSafetyWorklistCounts(rawWorklist);
  const filteredWorklist = filterSafetyWorklist(rawWorklist, {
    wardId: selectedWardId,
    kind: selectedKind,
    overdueOnly,
    searchQuery,
  });

  // Load High-Alert and LASA List (rule:a810f77980)
  const highAlertLoad = useLoad<HighAlertListOut>(async () => {
    return await highAlertList();
  }, [revision]);

  const highAlertData = highAlertLoad.data;

  // Real-time Event Subscription
  useEffect(() => {
    const handleServerEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{ topic?: string; payload?: any }>;
      const topic = customEv.detail?.topic || "";

      if (topic === "medication.order.updated") {
        setRealtimeNotice(
          t(
            "Medication orders updated. Safety worklist refreshed.",
            "ادویات کے آرڈرز تبدیل ہوئے۔ سیفٹی لسٹ تازہ کر دی گئی ہے۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (topic === "pharmacy.recall.updated") {
        setRealtimeNotice(
          t(
            "Pharmacy recall updated. High alert items refreshed.",
            "فارمیسی ری کال جاری ہوئی۔ سیفٹی بورڈ تازہ کر دیا گیا ہے۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (topic === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment profile updated. Medication safety view refreshed.",
            "ادارے کی سیٹنگز تبدیل ہوئیں۔ سیفٹی ویو تازہ کر دیا گیا ہے۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (topic.startsWith("system.") || topic.startsWith("notification.")) {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleServerEvent);
    return () => {
      window.removeEventListener("haspataal:event", handleServerEvent);
    };
  }, []);

  // Download High-Alert PDF (rule:a810f77980, MSDS 56 ii)
  const handleDownloadHighAlertPdf = async () => {
    setDownloadNotice(null);
    try {
      await call("clinical-pdf", {
        path: "/medication-safety/high-alert-list/pdf",
      });
      setDownloadNotice(
        t(
          "High-alert medicines list PDF saved. Display prominently at the nursing station (MSDS 56 ii).",
          "ہائی الرٹ ادویات کی فہرست پی ڈی ایف محفوظ ہو گئی۔ نرسنگ اسٹیشن پر نمایاں آویزاں کریں۔"
        )
      );
    } catch {
      try {
        await highAlertPdf();
        setDownloadNotice(
          t(
            "High-alert medicines list PDF dispatched. Display at nursing station (MSDS 56 ii).",
            "ہائی الرٹ ادویات کی فہرست پی ڈی ایف موصول ہو گئی۔ نرسنگ اسٹیشن پر آویزاں کریں۔"
          )
        );
      } catch (err: any) {
        setDownloadNotice(
          t("Failed to download High-Alert PDF: ", "ہائی الرٹ پی ڈی ایف ڈاؤنلوڈ نہ ہو سکی: ") +
            (err?.message || "Error")
        );
      }
    }
  };

  // Download Written Medication Policy PDF (MSDS 56)
  const handleDownloadPolicyPdf = async () => {
    setDownloadNotice(null);
    try {
      await call("clinical-pdf", {
        path: "/medication-safety/policy/pdf",
      });
      setDownloadNotice(
        t(
          "Hospital medication safety policy PDF saved. Available for clinical staff review.",
          "ہسپتال میڈیکیشن سیفٹی پالیسی پی ڈی ایف محفوظ ہو گئی۔ طبی عملے کے مطالعہ کے لیے دستیاب ہے۔"
        )
      );
    } catch {
      try {
        await policyPdfMedicationSafety();
        setDownloadNotice(
          t(
            "Hospital medication safety policy PDF generated.",
            "ہسپتال میڈیکیشن سیفٹی پالیسی پی ڈی ایف تیار ہو گئی۔"
          )
        );
      } catch (err: any) {
        setDownloadNotice(
          t("Failed to download Medication Policy PDF: ", "میڈیکیشن پالیسی پی ڈی ایف ڈاؤنلوڈ نہ ہو سکی: ") +
            (err?.message || "Error")
        );
      }
    }
  };

  return (
    <div className="medication-safety-ward-container" style={{ padding: "1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>{t("Ward Medication Safety Board", "وارڈ میڈیکیشن سیفٹی بورڈ")}</span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                background: screenView === "full" ? "#dcfce7" : screenView === "open_work" ? "#fef3c7" : "#f3f4f6",
                color: screenView === "full" ? "#166534" : screenView === "open_work" ? "#92400e" : "#374151",
              }}
            >
              {screenView.toUpperCase()}
            </span>
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            {t(
              "PHC MSDS MOM 51-71: High-alert medicines, look-alike sound-alike pairs, and proactive safety worklist",
              "پنجاب ہیلتھ کیئر کمیشن معیارات: ہائی الرٹ ادویات، ملتی جلتی ادویات، اور ادویاتی حفاظتی امور کی فہرست"
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            data-help="medication_safety_ward.btn_print_high_alert"
            onClick={handleDownloadHighAlertPdf}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: "4px",
              border: "1px solid #dc2626",
              background: "#fef2f2",
              color: "#b91c1c",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span>🖨️</span>
            <span>{t("Print High-Alert List PDF", "ہائی الرٹ لسٹ پرنٹ")}</span>
          </button>

          <button
            type="button"
            data-help="medication_safety_ward.btn_download_policy"
            onClick={handleDownloadPolicyPdf}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <span>📄</span>
            <span>{t("Medication Policy PDF", "میڈیکیشن پالیسی پی ڈی ایف")}</span>
          </button>

          <button
            type="button"
            data-help="medication_safety_ward.btn_refresh"
            onClick={() => setRevision((r) => r + 1)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Retiring / Capability Notices */}
      {screenView === "open_work" && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            color: "#92400e",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <strong>{t("Inpatient Service Retiring: ", "ان پیشنٹ سروس ختم کی جا رہی ہے: ")}</strong>
          {t(
            "No new inpatient work from now on. Active medication safety actions for admitted patients continue.",
            "اب نیا داخلہ نہیں ہوگا۔ موجودہ داخل مریضوں کی ادویاتی حفاظت کا عمل جاری رہے گا۔"
          )}
        </div>
      )}

      {downloadNotice && (
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "6px",
            color: "#166534",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{downloadNotice}</span>
          <button
            type="button"
            data-help="medication_safety_ward.btn_dismiss_download"
            onClick={() => setDownloadNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#166534" }}
          >
            ×
          </button>
        </div>
      )}

      {realtimeNotice && (
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            color: "#1e40af",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{realtimeNotice}</span>
          <button
            type="button"
            data-help="medication_safety_ward.btn_dismiss_realtime"
            onClick={() => setRealtimeNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#1e40af" }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Summary Tiles (rule:b9e1768945) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          onClick={() => {
            setActiveTab("worklist");
            setSelectedKind("All");
            setOverdueOnly(false);
          }}
          style={{
            padding: "0.75rem 1rem",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{t("Total Safety Items", "کل سیفٹی امور")}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>{counts.Total}</div>
        </div>

        <div
          onClick={() => {
            setActiveTab("worklist");
            setOverdueOnly(true);
          }}
          style={{
            padding: "0.75rem 1rem",
            background: counts.Overdue > 0 ? "#fef2f2" : "#fff",
            border: counts.Overdue > 0 ? "1px solid #fecaca" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: counts.Overdue > 0 ? "#991b1b" : "#6b7280" }}>
            {t("Overdue Actions", "میعاد ختم امور")}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: counts.Overdue > 0 ? "#dc2626" : "#111827" }}>
            {counts.Overdue}
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("worklist");
            setSelectedKind("NoWristband");
          }}
          style={{
            padding: "0.75rem 1rem",
            background: "#fff",
            border: selectedKind === "NoWristband" ? "2px solid #b45309" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#b45309" }}>{t("Missing Wristbands", "کلائی بینڈ غائب")}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#b45309" }}>{counts.NoWristband}</div>
        </div>

        <div
          onClick={() => {
            setActiveTab("worklist");
            setSelectedKind("VerbalOrderToCountersign");
          }}
          style={{
            padding: "0.75rem 1rem",
            background: "#fff",
            border: selectedKind === "VerbalOrderToCountersign" ? "2px solid #c2410c" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#c2410c" }}>{t("Unsigned Verbal Orders", "غیر تصدیق شدہ زبانی")}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c2410c" }}>{counts.VerbalOrderToCountersign}</div>
        </div>

        <div
          onClick={() => {
            setActiveTab("worklist");
            setSelectedKind("QueryOpen");
          }}
          style={{
            padding: "0.75rem 1rem",
            background: "#fff",
            border: selectedKind === "QueryOpen" ? "2px solid #4338ca" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#4338ca" }}>{t("Open Queries", "فارمیسی سوالات")}</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#4338ca" }}>{counts.QueryOpen}</div>
        </div>
      </div>

      {/* Main Tabs Header */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e5e7eb", marginBottom: "1.5rem" }}>
        <button
          type="button"
          data-help="medication_safety_ward.tab_worklist"
          onClick={() => setActiveTab("worklist")}
          style={{
            padding: "0.75rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "worklist" ? "3px solid #2563eb" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "worklist" ? 700 : 500,
            color: activeTab === "worklist" ? "#2563eb" : "#4b5563",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          {t("Safety Worklist", "حفاظتی فہرست")} ({counts.Total})
        </button>

        <button
          type="button"
          data-help="medication_safety_ward.tab_high_alert"
          onClick={() => setActiveTab("high_alert")}
          style={{
            padding: "0.75rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "high_alert" ? "3px solid #2563eb" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "high_alert" ? 700 : 500,
            color: activeTab === "high_alert" ? "#2563eb" : "#4b5563",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          {t("High-Alert & LASA Reference Board", "ہائی الرٹ اور ملتی جلتی ادویات بورڈ")}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SAFETY WORKLIST (rule:b9e1768945)                                   */}
      {/* ========================================================================= */}
      {activeTab === "worklist" && (
        <div>
          {/* Worklist Filter Controls */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              background: "#f9fafb",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              marginBottom: "1rem",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("Filter by Ward", "وارڈ کے مطابق فلٹر")}
              </label>
              <select
                data-help="medication_safety_ward.select_ward"
                value={selectedWardId || ""}
                onChange={(e) => setSelectedWardId(e.target.value ? Number(e.target.value) : null)}
                style={{ padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff", minWidth: "180px" }}
              >
                <option value="">{t("All Wards & Emergency", "تمام وارڈز اور ایمرجنسی")}</option>
                {wardsList.map((w) => (
                  <option key={w.ward_id} value={w.ward_id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("Safety Category", "حفاظتی کیٹیگری")}
              </label>
              <select
                data-help="medication_safety_ward.select_kind"
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value as any)}
                style={{ padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff" }}
              >
                <option value="All">{t("All Categories", "تمام کیٹیگریز")}</option>
                {Object.entries(SAFETY_KINDS_META).map(([k, meta]) => (
                  <option key={k} value={k}>
                    {meta.icon} {meta.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                {t("Search Patient / Bed", "مریض یا بستر تلاش کریں")}
              </label>
              <input
                type="text"
                data-help="medication_safety_ward.input_search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("Filter by name, MRN, bed or title...", "نام، ایم آر این، بستر یا عنوان سے فلٹر...")}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
              />
            </div>

            <div style={{ paddingBottom: "0.25rem" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: overdueOnly ? "#dc2626" : "#374151",
                }}
              >
                <input
                  type="checkbox"
                  data-help="medication_safety_ward.checkbox_overdue_only"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                />
                {t("Show Overdue Actions Only", "صرف میعاد ختم امور دکھائیں")}
              </label>
            </div>
          </div>

          {/* Worklist Items Feed */}
          {worklistLoad.loading ? (
            <LoadState
              loading={worklistLoad.loading}
              error={worklistLoad.error}
              retry={worklistLoad.reload}
            />
          ) : worklistLoad.error ? (
            <ErrorBox error={worklistLoad.error} />
          ) : filteredWorklist.length === 0 ? (
            <Empty>
              {t(
                "No medication safety items pending for the selected filters. Great clinical practice!",
                "منتخب فلٹرز میں کوئی سیفٹی الرٹ موجود نہیں۔ زبردست طبی دیکھ بھال!"
              )}
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filteredWorklist.map((item, index) => {
                const meta = SAFETY_KINDS_META[item.kind] || {
                  labelEn: item.kind,
                  labelUr: item.kind,
                  icon: "⚠️",
                  color: "#374151",
                  bgLight: "#f9fafb",
                  borderColor: "#e5e7eb",
                };

                return (
                  <div
                    key={index}
                    style={{
                      background: "#fff",
                      border: `1px solid ${item.is_overdue ? "#fca5a5" : meta.borderColor}`,
                      borderLeft: `4px solid ${item.is_overdue ? "#dc2626" : meta.color}`,
                      borderRadius: "6px",
                      padding: "1rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                          <span
                            style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: meta.bgLight,
                              color: meta.color,
                            }}
                          >
                            {meta.icon} {meta.labelEn}
                          </span>

                          {item.is_overdue && (
                            <span
                              style={{
                                padding: "0.15rem 0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: "#fee2e2",
                                color: "#b91c1c",
                              }}
                            >
                              🚨 {t("OVERDUE", "میعاد ختم")}
                            </span>
                          )}

                          <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>
                            {item.title}
                          </span>
                        </div>

                        {item.detail && (
                          <div style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: "0.5rem" }}>
                            {item.detail}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8rem", color: "#6b7280" }}>
                          {item.patient_name && (
                            <div>
                              <strong>{t("Patient: ", "مریض: ")}</strong>
                              {item.patient_name} ({item.mrn})
                            </div>
                          )}

                          {item.ward_name && (
                            <div>
                              <strong>{t("Location: ", "مقام: ")}</strong>
                              {item.ward_name} {item.bed_label ? `— Bed ${item.bed_label}` : ""}
                            </div>
                          )}

                          {item.due_at && (
                            <div>
                              <strong>{t("Due: ", "مقررہ وقت: ")}</strong>
                              {new Date(item.due_at).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Navigation Shortcut Button */}
                      {meta.targetScreen && onNavigateScreen && (
                        <button
                          type="button"
                          data-help="medication_safety_ward.btn_action_shortcut"
                          onClick={() => onNavigateScreen(meta.targetScreen!)}
                          style={{
                            padding: "0.45rem 0.85rem",
                            borderRadius: "4px",
                            border: `1px solid ${meta.color}`,
                            background: meta.bgLight,
                            color: meta.color,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t("Take Action →", "اقدام کریں →")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HIGH-ALERT & LASA REFERENCE BOARD (rule:a810f77980, MSDS 56 ii)    */}
      {/* ========================================================================= */}
      {activeTab === "high_alert" && (
        <div>
          <div
            style={{
              padding: "1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#991b1b",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
            }}
          >
            <strong>{t("MSDS Standard 56 ii Mandate: ", "پی ایچ سی معیار 56 ii لازمی تقاضا: ")}</strong>
            {t(
              "High-alert medicines bear a heightened risk of causing significant patient harm when used in error. Dual independent nurse check is required upon dispensing and administration. Look-alike sound-alike (LASA) pairs must never be stored adjacent to one another.",
              "ہائی الرٹ ادویات میں غلطی کی صورت میں مریض کو شدید نقصان کا خطرہ ہوتا ہے۔ دوا دیتے وقت دو آزاد نرسوں کی تصدیق لازمی ہے۔ ملتی جلتی ادویات کو کیبنٹ میں اکٹھا نہ رکھیں۔"
            )}
          </div>

          {highAlertLoad.loading ? (
            <LoadState
              loading={highAlertLoad.loading}
              error={highAlertLoad.error}
              retry={highAlertLoad.reload}
            />
          ) : highAlertLoad.error ? (
            <ErrorBox error={highAlertLoad.error} />
          ) : !highAlertData ? (
            <Empty>{t("No high-alert formulary data available.", "ہائی الرٹ ادویات کا ڈیٹا دستیاب نہیں۔")}</Empty>
          ) : (
            <div>
              {/* High-Alert Categories Section */}
              <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#111827" }}>
                {t("1. High-Alert Medication Categories", "1۔ ہائی الرٹ ادویات کے زمرے")}
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "2rem" }}>
                {highAlertData.categories.map((cat) => {
                  const hazard = HIGH_ALERT_CATEGORY_NOTES[cat.category];

                  return (
                    <div
                      key={cat.category}
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem 1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1rem", color: "#dc2626" }}>
                            ⚠️ {cat.label}
                          </h3>
                          {hazard && (
                            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
                              {t(hazard.en, hazard.ur)}
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: "12px",
                            background: "#fee2e2",
                            color: "#991b1b",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {cat.drugs.length} {t("drugs", "ادویات")}
                        </span>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>
                              <th style={{ padding: "0.4rem 0.5rem" }}>{t("Code", "کوڈ")}</th>
                              <th style={{ padding: "0.4rem 0.5rem" }}>{t("Drug Name", "دوا کا نام")}</th>
                              <th style={{ padding: "0.4rem 0.5rem" }}>{t("Form", "شکل")}</th>
                              <th style={{ padding: "0.4rem 0.5rem" }}>{t("Schedule", "شیڈول")}</th>
                              <th style={{ padding: "0.4rem 0.5rem" }}>{t("LASA Warning", "ملتی جلتی دوا")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.drugs.map((drug) => (
                              <tr key={drug.drug_id} style={{ borderBottom: "1px solid #f9fafb" }}>
                                <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600, color: "#374151" }}>{drug.code}</td>
                                <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>{drug.name}</td>
                                <td style={{ padding: "0.4rem 0.5rem", color: "#6b7280" }}>{drug.form}</td>
                                <td style={{ padding: "0.4rem 0.5rem" }}>
                                  <span style={{ padding: "0.1rem 0.4rem", borderRadius: "3px", background: "#f3f4f6", fontSize: "0.75rem" }}>
                                    {drug.schedule}
                                  </span>
                                </td>
                                <td style={{ padding: "0.4rem 0.5rem" }}>
                                  {drug.lasa_with && drug.lasa_with.length > 0 ? (
                                    <span style={{ color: "#d97706", fontWeight: 600 }}>
                                      ⚡ {drug.lasa_with.join(", ")}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#9ca3af" }}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Look-Alike Sound-Alike (LASA) Pairs Section */}
              <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#111827" }}>
                {t("2. Look-Alike Sound-Alike (LASA) Pairs & Separation Protocols", "2۔ ملتی جلتی ادویات (LASA) اور علیحدگی کا طریقہ کار")}
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                {highAlertData.lasa_pairs.map((pair) => (
                  <div
                    key={pair.pair_id}
                    style={{
                      background: "#fff",
                      border: "1px solid #fde68a",
                      borderRadius: "8px",
                      padding: "1rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 700, color: "#b45309", fontSize: "0.85rem" }}>
                        ⚡ {t("LASA Match Pair", "ملتی جلتی جوڑی")}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>ID: {pair.pair_id}</span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: "0.5rem",
                        alignItems: "center",
                        background: "#fefce8",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div style={{ textAlign: "center", fontWeight: 600, fontSize: "0.9rem" }}>
                        {pair.drug_name}
                      </div>
                      <div style={{ color: "#b45309", fontWeight: 700, fontSize: "1.1rem" }}>⇄</div>
                      <div style={{ textAlign: "center", fontWeight: 600, fontSize: "0.9rem" }}>
                        {pair.other_drug_name}
                      </div>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "#451a03", lineHeight: 1.4 }}>
                      <strong>{t("Clinical Distinction Protocol: ", "طبی فرق اور علیحدگی کی ہدایات: ")}</strong>
                      {pair.note}
                    </div>
                  </div>
                ))}
              </div>

              {/* Restricted Prescribing Medicines */}
              {highAlertData.restricted.length > 0 && (
                <div>
                  <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#111827" }}>
                    {t("3. Restricted Prescribing Medicines", "3۔ مخصوص اجازت نامے کی حامل ادویات")}
                  </h2>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem" }}>
                    <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#6b7280" }}>
                      {t(
                        "These medications may only be prescribed by clinicians with verified restricted prescribing privileges.",
                        "یہ ادویات صرف مخصوص اجازت رکھنے والے ماہر ڈاکٹر ہی تجویز کر سکتے ہیں۔"
                      )}
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #f3f4f6", color: "#6b7280", textAlign: "left" }}>
                          <th style={{ padding: "0.4rem" }}>{t("Code", "کوڈ")}</th>
                          <th style={{ padding: "0.4rem" }}>{t("Name", "نام")}</th>
                          <th style={{ padding: "0.4rem" }}>{t("Form", "شکل")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {highAlertData.restricted.map((r) => (
                          <tr key={r.drug_id} style={{ borderBottom: "1px solid #f9fafb" }}>
                            <td style={{ padding: "0.4rem", fontWeight: 600 }}>{r.code}</td>
                            <td style={{ padding: "0.4rem" }}>{r.name}</td>
                            <td style={{ padding: "0.4rem", color: "#6b7280" }}>{r.form}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
