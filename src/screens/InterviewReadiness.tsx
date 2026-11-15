import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  readiness,
  rolesMsdsInterviewPrep,
  getQuestion,
  listMocks,
  getMock,
  pocketGuide,
  pocketGuidePayload,
  InterviewReadinessOut,
  RoleReadinessOut,
  WeakQuestionOut,
  InterviewFactOut,
  OneLanguageAnswerOut,
  InterviewQuestionDetailOut,
  InterviewPocketGuideOut,
  MockInterviewSummaryOut,
  MockInterviewOut,
  InterviewRoleOut,
} from "../generated/interview_readiness";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
  screenId?: string;
};

export function InterviewReadiness({
  revision,
  user,
  onOpenHelp,
  connected,
  screenId = "interview_readiness",
}: Props) {
  const [localRevision, setLocalRevision] = useState(0);
  const [activeLang, setActiveLang] = useState<"en" | "ur">("en");

  // Selected role filter
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  // Expanded role state (for not_started staff and pocket guides)
  const [expandedRoleCode, setExpandedRoleCode] = useState<string | null>(null);

  // Question detail drawer state
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
  const [detailLang, setDetailLang] = useState<"en" | "ur">("en");

  // Mock interviews drawer state
  const [showMockModal, setShowMockModal] = useState<boolean>(false);
  const [selectedMockId, setSelectedMockId] = useState<number | null>(null);
  const [mockDetail, setMockDetail] = useState<MockInterviewOut | null>(null);
  const [loadingMockDetail, setLoadingMockDetail] = useState<boolean>(false);

  // Pocket guide modal state
  const [showPocketGuideModal, setShowPocketGuideModal] = useState<boolean>(false);
  const [activeGuideData, setActiveGuideData] = useState<InterviewPocketGuideOut | null>(null);
  const [loadingGuide, setLoadingGuide] = useState<boolean>(false);

  // Load readiness metrics (rule:4f0c4808ac, rule:206b6c29dd)
  const readinessLoad = useLoad(
    () =>
      readiness({
        role: selectedRoleFilter !== "ALL" ? selectedRoleFilter : undefined,
        lang: activeLang,
      }),
    [localRevision, revision, selectedRoleFilter, activeLang]
  );
  const readinessData: InterviewReadinessOut | null = readinessLoad.data ?? null;

  // Load roles list for filter
  const rolesLoad = useLoad(
    () => rolesMsdsInterviewPrep(),
    [localRevision, revision]
  );
  const rolesList: InterviewRoleOut[] = rolesLoad.data || [];

  // Load selected question detail
  const questionLoad = useLoad(
    () =>
      selectedQuestionKey
        ? getQuestion(selectedQuestionKey, { lang: detailLang })
        : Promise.resolve(null),
    [selectedQuestionKey, detailLang, localRevision, revision]
  );
  const questionDetail: InterviewQuestionDetailOut | null = questionLoad.data ?? null;

  // Load mock interviews history
  const mocksLoad = useLoad(
    () => (showMockModal ? listMocks({ limit: 30 }) : Promise.resolve([])),
    [showMockModal, localRevision, revision]
  );
  const mockSessions: MockInterviewSummaryOut[] = mocksLoad.data || [];

  // Open mock interview detail
  const handleOpenMockDetail = async (id: number) => {
    setSelectedMockId(id);
    setLoadingMockDetail(true);
    try {
      const res = await getMock(id, { lang: activeLang });
      setMockDetail(res);
    } catch (e) {
      console.error("Failed to load mock detail", e);
    } finally {
      setLoadingMockDetail(false);
    }
  };

  // Download PDF pocket guide for a role
  const handleDownloadPocketGuidePdf = async (roleCode: string) => {
    try {
      await pocketGuide({ role: roleCode });
    } catch (err: any) {
      console.error("Failed to download pocket guide PDF", err);
    }
  };

  // View terminal print pocket guide for a role
  const handleViewPocketGuidePrint = async (roleCode: string) => {
    setLoadingGuide(true);
    setShowPocketGuideModal(true);
    try {
      const res = await pocketGuidePayload({ role: roleCode, lang: activeLang });
      setActiveGuideData(res);
    } catch (err: any) {
      console.error("Failed to load pocket guide payload", err);
    } finally {
      setLoadingGuide(false);
    }
  };

  return (
    <div
      data-screen={screenId}
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
      {/* Screen Header */}
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
            {screenId === "interview_readiness_owner"
              ? t("PHC interview readiness", "پی ایچ سی انٹرویو تیاری")
              : t("PHC inspection interview readiness", "پی ایچ سی معائنہ انٹرویو تیاری")}
          </h1>
          <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
            {t(
              "Role-by-role interview preparation, weakest questions, unconfigured hospital facts, and mock interview scores.",
              "کردار کے لحاظ سے تیاری، کمزور ترین سوالات، غیر درج شدہ حقائق اور فرضی انٹرویو اسکورز۔"
            )}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Language Switch */}
          <button
            type="button"
            data-help={
              screenId === "interview_readiness_owner"
                ? "interview_readiness_owner.language"
                : "interview_readiness.language"
            }
            onClick={() => setActiveLang(activeLang === "en" ? "ur" : "en")}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              background: "#f8f9fa",
              fontWeight: "bold",
            }}
          >
            🌐 {activeLang === "en" ? "اردو" : "English"}
          </button>

          {/* Past Mock Sessions Button */}
          <button
            type="button"
            data-help={
              screenId === "interview_readiness_owner"
                ? "interview_readiness_owner.mock_review"
                : "interview_readiness.mock_review"
            }
            onClick={() => setShowMockModal(true)}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #0d6efd",
              background: "#0d6efd",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            📋 {t("Mock Sessions History", "فرضی انٹرویو ہسٹری")}
          </button>

          {/* F1 Help */}
          <button
            type="button"
            data-help={
              screenId === "interview_readiness_owner"
                ? "interview_readiness_owner.help"
                : "interview_readiness.help"
            }
            onClick={onOpenHelp}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              background: "#f8f9fa",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ❓ {t("Help (F1)", "مدد (F1)")}
          </button>
        </div>
      </div>

      <LoadState
        loading={readinessLoad.loading}
        error={readinessLoad.error}
        retry={() => setLocalRevision((r) => r + 1)}
      />

      {readinessData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Unconfigured Hospital Facts Banner (rule:f0e42c923c) */}
          {readinessData.facts_not_set && readinessData.facts_not_set.length > 0 && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                borderRadius: "6px",
                padding: "12px",
                color: "#856404",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "0.95rem", marginBottom: "6px" }}>
                ⚠️ {t("Hospital Setting Facts Not Configured Yet:", "ہسپتال کی ترتیبات کے غیر درج شدہ حقائق:")}
              </div>
              <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
                {t(
                  "The interview answers quote the following hospital settings that are not set yet. Staff will rehearse bracketed prompts instead of your real hospital values until configured:",
                  "انٹرویو کے جوابات میں درج ذیل ترتیبات کا حوالہ موجود ہے جو ابھی درج نہیں ہوئیں۔ عملہ اصل معلومات کے بجائے بریکٹ والی ہدایات مشق کرے گا جب تک کہ یہ درج نہ ہوں:"
                )}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {readinessData.facts_not_set.map((fact: InterviewFactOut) => (
                  <button
                    key={fact.key}
                    type="button"
                    data-help={
                      screenId === "interview_readiness_owner"
                        ? "interview_readiness_owner.fact_link"
                        : "interview_readiness.fact_link"
                    }
                    style={{
                      padding: "6px 10px",
                      background: "#fff",
                      border: "1px solid #e0a800",
                      borderRadius: "4px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.82rem",
                    }}
                  >
                    <strong>{fact.label}</strong> ({fact.key})
                    <span style={{ display: "block", color: "#6c757d", fontSize: "0.75rem" }}>
                      📍 {t("Configure at:", "ترتیب دیں:")} {fact.where}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Adapted in One Language Only Alerts (rule:dce07d68a4) */}
          {readinessData.adapted_in_one_language && readinessData.adapted_in_one_language.length > 0 && (
            <div
              style={{
                background: "#cfe2ff",
                border: "1px solid #b6d4fe",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#084298",
                fontSize: "0.85rem",
              }}
            >
              <strong>
                🌐 {t("Single-Language Hospital Adaptations Pending Counterpart:", "ایک زبان میں موافق شدہ جوابات جن کا ترجمہ باقی ہے:")}
              </strong>
              <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {readinessData.adapted_in_one_language.map((item: OneLanguageAnswerOut) => {
                  const adaptedLang = item.adapted_languages && item.adapted_languages[0];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-help={
                        screenId === "interview_readiness_owner"
                          ? "interview_readiness_owner.adapt_link"
                          : "interview_readiness.adapt_link"
                      }
                      onClick={() => {
                        setSelectedQuestionKey(item.key);
                        setDetailLang(adaptedLang === "en" ? "ur" : "en");
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "#fff",
                        border: "1px solid #9ec5fe",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.key} (
                      {adaptedLang === "en"
                        ? t("Adapted in English: adapt Urdu", "انگریزی میں مکمل: اردو باقی")
                        : t("Adapted in Urdu: adapt English", "اردو میں مکمل: انگریزی باقی")}
                      )
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Metric Tiles (rule:4f0c4808ac) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {/* Total Staff */}
            <div style={{ background: "#f8f9fa", padding: "14px", borderRadius: "6px", border: "1px solid #dee2e6" }}>
              <div style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                👥 {t("Active Staff", "فعال عملہ")}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: "4px" }}>
                {readinessData.totals.staff}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#6c757d" }}>
                {t("Total personnel holding clinical roles", "طبی کردار رکھنے والے کل ملازمین")}
              </div>
            </div>

            {/* Staff Started */}
            <div style={{ background: "#f8f9fa", padding: "14px", borderRadius: "6px", border: "1px solid #dee2e6" }}>
              <div style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                🏃 {t("Started Rehearsals", "مشق شروع کر دی")}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: "4px", color: "#0d6efd" }}>
                {readinessData.totals.started}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#6c757d" }}>
                {readinessData.totals.staff > 0
                  ? `${Math.round((readinessData.totals.started / readinessData.totals.staff) * 100)}% ${t("of staff engaged", "عملے کی شرکت")}`
                  : "—"}
              </div>
            </div>

            {/* Overall Interview Readiness % */}
            <div style={{ background: "#e7f5ea", padding: "14px", borderRadius: "6px", border: "1px solid #c3e6cb" }}>
              <div style={{ fontSize: "0.8rem", color: "#155724", fontWeight: "bold" }}>
                🎯 {t("Interview Readiness", "انٹرویو تیاری کی شرح")}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: "4px", color: "#198754" }}>
                {readinessData.totals.ready_pct}%
              </div>
              <div style={{ fontSize: "0.78rem", color: "#155724" }}>
                {t("Average questions rated 'Knew'", "سوالات جن پر 'معلوم تھا' ریٹنگ ہوئی")}
              </div>
            </div>

            {/* Mock Interviews (90 Days) */}
            <div style={{ background: "#f8f9fa", padding: "14px", borderRadius: "6px", border: "1px solid #dee2e6" }}>
              <div style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                📋 {t("Mock Sessions (90d)", "فرضی سیشنز (90 دن)")}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: "4px" }}>
                {readinessData.totals.mock_interviews}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#6c757d" }}>
                {t("Formal rounds conducted by supervisors", "نگرانوں کے زیر اہتمام منعقدہ راؤنڈز")}
              </div>
            </div>

            {/* Average Mock Score */}
            <div style={{ background: "#f8f9fa", padding: "14px", borderRadius: "6px", border: "1px solid #dee2e6" }}>
              <div style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                ⭐ {t("Avg Mock Score", "اوسط فرضی اسکور")}
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "bold",
                  marginTop: "4px",
                  color:
                    readinessData.totals.mock_score_pct !== null && readinessData.totals.mock_score_pct >= 80
                      ? "#198754"
                      : "#664d03",
                }}
              >
                {readinessData.totals.mock_score_pct !== null ? `${readinessData.totals.mock_score_pct}%` : "—"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#6c757d" }}>
                {t("Judged against statutory key points", "قانونی اہم نکات کے معیار پر جانچے گئے")}
              </div>
            </div>
          </div>

          {/* Role Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8f9fa",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #dee2e6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                🔍 {t("Filter by Role:", "کردار کے لحاظ سے فلٹر کریں:")}
              </label>
              <select
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.filter"
                    : "interview_readiness.filter"
                }
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
              >
                <option value="ALL">{t("All Roles", "تمام کردار")}</option>
                {rolesList.map((ro) => (
                  <option key={ro.role} value={ro.role}>
                    {ro.name} ({ro.questions} {t("Questions", "سوالات")})
                  </option>
                ))}
              </select>
            </div>

            <span style={{ fontSize: "0.82rem", color: "#6c757d" }}>
              {readinessData.roles.length} {t("Roles Tracked", "کردار زیر نگرانی")}
            </span>
          </div>

          {/* Role Readiness Breakdown Table (rule:4f0c4808ac) */}
          <div style={{ border: "1px solid #dee2e6", borderRadius: "6px", background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: "12px", background: "#f1f3f5", borderBottom: "1px solid #dee2e6", fontWeight: "bold" }}>
              📊 {t("Readiness by Hospital Role", "ہسپتال کے کردار کے لحاظ سے تیاری")}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
              <thead style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                <tr>
                  <th style={{ padding: "10px" }}>{t("Role", "کردار")}</th>
                  <th style={{ padding: "10px", width: "90px", textAlign: "center" }}>{t("Staff", "عملہ")}</th>
                  <th style={{ padding: "10px", width: "90px", textAlign: "center" }}>{t("Started", "مشق شروع")}</th>
                  <th style={{ padding: "10px", width: "240px" }}>{t("Readiness %", "تیاری کی شرح")}</th>
                  <th style={{ padding: "10px", width: "120px", textAlign: "center" }}>{t("Mock Score", "فرضی اسکور")}</th>
                  <th style={{ padding: "10px", width: "140px", textAlign: "center" }}>{t("Pocket Guide", "پاکٹ گائیڈ")}</th>
                </tr>
              </thead>
              <tbody>
                {readinessData.roles.map((rr: RoleReadinessOut) => {
                  const isExpanded = expandedRoleCode === rr.role;
                  const barColor = rr.ready_pct >= 80 ? "#198754" : rr.ready_pct >= 50 ? "#ffc107" : "#dc3545";

                  return (
                    <React.Fragment key={rr.role}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid #dee2e6",
                          background: isExpanded ? "#f8f9fa" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px" }}>
                          <button
                            type="button"
                            data-help={
                              screenId === "interview_readiness_owner"
                                ? "interview_readiness_owner.role_expand"
                                : "interview_readiness.role_expand"
                            }
                            onClick={() => setExpandedRoleCode(isExpanded ? null : rr.role)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              padding: 0,
                              fontWeight: "bold",
                              fontSize: "0.9rem",
                              color: "#0d6efd",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>{isExpanded ? "▼" : "▶"}</span>
                            {rr.name}
                          </button>
                          <span style={{ fontSize: "0.75rem", color: "#6c757d", display: "block", marginLeft: "18px" }}>
                            {rr.questions} {t("statutory questions assigned", "قانونی سوالات تفویض شدہ")}
                          </span>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold" }}>{rr.staff}</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          {rr.started} / {rr.staff}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                flex: 1,
                                height: "12px",
                                background: "#e9ecef",
                                borderRadius: "6px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, rr.ready_pct))}%`,
                                  height: "100%",
                                  background: barColor,
                                  borderRadius: "6px",
                                }}
                              />
                            </div>
                            <span style={{ width: "42px", fontWeight: "bold", fontSize: "0.82rem", textAlign: "right" }}>
                              {rr.ready_pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          {rr.mock_score_pct !== null ? (
                            <span
                              style={{
                                fontWeight: "bold",
                                color: rr.mock_score_pct >= 80 ? "#198754" : "#664d03",
                              }}
                            >
                              {rr.mock_score_pct}% ({rr.mock_interviews})
                            </span>
                          ) : (
                            <span style={{ color: "#adb5bd" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button
                              type="button"
                              data-help={
                                screenId === "interview_readiness_owner"
                                  ? "interview_readiness_owner.pocket_pdf"
                                  : "interview_readiness.pocket_pdf"
                              }
                              onClick={() => handleDownloadPocketGuidePdf(rr.role)}
                              title={t("Download English PDF Pocket Guide", "انگریزی پی ڈی ایف پاکٹ گائیڈ")}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid #198754",
                                background: "#fff",
                                color: "#198754",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                              }}
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              data-help={
                                screenId === "interview_readiness_owner"
                                  ? "interview_readiness_owner.pocket_print"
                                  : "interview_readiness.pocket_print"
                              }
                              onClick={() => handleViewPocketGuidePrint(rr.role)}
                              title={t("Preview Pocket Guide Terminal Layout", "پاکٹ گائیڈ پرنٹ پیش منظر")}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid #0d6efd",
                                background: "#fff",
                                color: "#0d6efd",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                              }}
                            >
                              🖨️
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row showing not_started staff names (rule:4f0c4808ac) */}
                      {isExpanded && (
                        <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
                          <td colSpan={6} style={{ padding: "10px 16px 14px 34px" }}>
                            <div style={{ fontSize: "0.82rem" }}>
                              <strong>⚠️ {t("Staff Not Started Yet:", "عملہ جس نے ابھی مشق شروع نہیں کی:")}</strong>
                              {rr.not_started && rr.not_started.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                                  {rr.not_started.map((name, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        background: "#fff",
                                        border: "1px solid #ced4da",
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      👤 {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ marginLeft: "8px", color: "#198754", fontWeight: "bold" }}>
                                  ✓ {t("All staff in this role have started rehearsals!", "اس کردار کے تمام عملے نے مشق شروع کر دی ہے!")}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Weakest Questions Coaching Block (rule:d840631a31) */}
          <div style={{ border: "1px solid #dee2e6", borderRadius: "6px", background: "#fff", overflow: "hidden" }}>
            <div
              style={{
                padding: "12px",
                background: "#fcf8e3",
                borderBottom: "1px solid #faebcc",
                color: "#8a6d3b",
                fontWeight: "bold",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                🎯 {t("10 Questions Staff Know Least (Morning Huddle Coaching Priorities):", "10 سوالات جن میں عملہ کمزور ہے (صبح کی میٹنگ کے ترجیحی نکات):")}
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>
                {t("Click any question to view model answer and coaching points", "ماڈل جواب دیکھنے کے لیے سوال پر کلک کریں")}
              </span>
            </div>

            <div style={{ padding: "8px" }}>
              {readinessData.weakest && readinessData.weakest.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {readinessData.weakest.map((wq: WeakQuestionOut, idx: number) => {
                    const isMandatory = wq.phc_type === "Mandatory" || wq.grade === "Red";

                    return (
                      <button
                        key={wq.key}
                        type="button"
                        data-help={
                          screenId === "interview_readiness_owner"
                            ? "interview_readiness_owner.weak_question"
                            : "interview_readiness.weak_question"
                        }
                        onClick={() => setSelectedQuestionKey(wq.key)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "10px",
                          background: "#fdfdfe",
                          border: "1px solid #e9ecef",
                          borderRadius: "4px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontWeight: "bold", color: "#6c757d", width: "20px" }}>{idx + 1}.</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "0.85rem" }}>
                              {wq.key}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>#{wq.indicator}</span>
                            {isMandatory && (
                              <span
                                style={{
                                  background: "#f8d7da",
                                  color: "#842029",
                                  padding: "1px 6px",
                                  borderRadius: "10px",
                                  fontSize: "0.72rem",
                                  fontWeight: "bold",
                                }}
                              >
                                🔴 {t("Mandatory", "لازمی")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.88rem", fontWeight: "bold", color: "#212529" }}>{wq.question}</div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", textAlign: "right" }}>
                          <div>
                            <span style={{ display: "block", color: "#dc3545", fontWeight: "bold" }}>
                              {wq.did_not_know}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#6c757d" }}>{t("Didn't know", "معلوم نہ تھا")}</span>
                          </div>
                          <div>
                            <span style={{ display: "block", color: "#ffc107", fontWeight: "bold" }}>
                              {wq.partly}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#6c757d" }}>{t("Partly", "جزوی")}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px", color: "#6c757d" }}>
                  {t("No weak question patterns detected yet.", "ابھی تک کوئی کمزور سوال ریکارڈ نہیں ہوا۔")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Detail Drawer (rule:d840631a31) */}
      {selectedQuestionKey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "550px",
            maxWidth: "95vw",
            background: "#fff",
            boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: detailLang === "ur" ? "Noto Nastaliq Urdu, sans-serif" : "inherit",
            direction: detailLang === "ur" ? "rtl" : "ltr",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px",
              background: "#f8f9fa",
              borderBottom: "1px solid #dee2e6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "1.1rem" }}>
                  {selectedQuestionKey}
                </span>
                {questionDetail?.phc_type === "Mandatory" && (
                  <span
                    style={{
                      background: "#f8d7da",
                      color: "#842029",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                    }}
                  >
                    🔴 {t("Mandatory", "لازمی")}
                  </span>
                )}
                {questionDetail?.phc_type === "Operational" && (
                  <span
                    style={{
                      background: "#fff3cd",
                      color: "#664d03",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                    }}
                  >
                    🟡 {t("Operational", "عملی")}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                #{questionDetail?.indicator} · {questionDetail?.area_name || questionDetail?.area}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.language"
                    : "interview_readiness.language"
                }
                onClick={() => setDetailLang(detailLang === "en" ? "ur" : "en")}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ced4da",
                  background: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                🌐 {detailLang === "en" ? "اردو" : "English"}
              </button>

              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.close"
                    : "interview_readiness.close"
                }
                onClick={() => setSelectedQuestionKey(null)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ced4da",
                  background: "#fff",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <LoadState
              loading={questionLoad.loading}
              error={questionLoad.error}
              retry={() => setLocalRevision((r) => r + 1)}
            />

            {questionDetail && (
              <>
                {/* Question */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                    ❓ {t("Question:", "سوال:")}
                  </label>
                  <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: "bold", lineHeight: "1.4" }}>
                    {questionDetail.question}
                  </p>
                </div>

                {/* Model Answer */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                    📖 {t("Model Answer (Rehearsed by Staff):", "ماڈل جواب (جو عملہ مشق کرتا ہے):")}
                  </label>
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "12px",
                      background: "#f8f9fa",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      lineHeight: "1.5",
                      fontSize: "0.92rem",
                    }}
                  >
                    {questionDetail.model_answer}
                  </div>
                </div>

                {/* Key Points Checklist */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                    ✅ {t("Key Points Checklist:", "اہم نکات کی چیک لسٹ:")}
                  </label>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.88rem", lineHeight: "1.4" }}>
                    {questionDetail.key_points?.map((pt, i) => (
                      <li key={i} style={{ marginBottom: "4px" }}>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Follow ups */}
                {questionDetail.follow_ups && questionDetail.follow_ups.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#0d6efd" }}>
                      🔜 {t("The surveyor may ask next:", "معائنہ کار آگے یہ پوچھ سکتا ہے:")}
                    </label>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.85rem", color: "#495057" }}>
                      {questionDetail.follow_ups.map((fu, i) => (
                        <li key={i}>{fu}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pitfalls */}
                {questionDetail.pitfalls && questionDetail.pitfalls.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#dc3545" }}>
                      ⚠️ {t("Avoid (Pitfalls):", "احتیاط (غلطیوں سے بچیں):")}
                    </label>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.85rem", color: "#842029" }}>
                      {questionDetail.pitfalls.map((pf, i) => (
                        <li key={i}>{pf}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Show me */}
                {questionDetail.show_me && questionDetail.show_me.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#198754" }}>
                      📂 {t("Be ready to show:", "دکھانے کے لیے تیار رکھیں:")}
                    </label>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.85rem", color: "#0f5132" }}>
                      {questionDetail.show_me.map((sm, i) => (
                        <li key={i}>{sm}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notice */}
                <div
                  style={{
                    padding: "10px",
                    background: "#fff3cd",
                    border: "1px solid #ffeeba",
                    borderRadius: "4px",
                    fontSize: "0.82rem",
                    color: "#856404",
                    fontStyle: "italic",
                  }}
                >
                  📢 {questionDetail.notice}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pocket Guide Terminal Preview Modal */}
      {showPocketGuideModal && (
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
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "20px",
              width: "600px",
              maxWidth: "92vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                🖨️ {t("Pocket Guide Printout Preview", "پاکٹ گائیڈ پرنٹ پیش منظر")}
              </h3>
              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.close"
                    : "interview_readiness.close"
                }
                onClick={() => setShowPocketGuideModal(false)}
                style={{ border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px", background: "#f8f9fa", borderRadius: "4px" }}>
              {loadingGuide ? (
                <div style={{ textAlign: "center", padding: "20px" }}>{t("Loading pocket guide...", "لوڈ ہو رہا ہے...")}</div>
              ) : activeGuideData ? (
                <div>
                  <div style={{ borderBottom: "1px solid #dee2e6", paddingBottom: "8px", marginBottom: "8px" }}>
                    <strong>{activeGuideData.title}</strong>
                    <div style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                      {activeGuideData.role_name} · {activeGuideData.questions?.length} {t("Questions", "سوالات")}
                    </div>
                  </div>
                  {activeGuideData.questions?.map((gq, idx) => (
                    <div key={idx} style={{ marginBottom: "12px", borderBottom: "1px dashed #ced4da", paddingBottom: "8px" }}>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                        {idx + 1}. {gq.question}
                      </div>
                      <div style={{ fontSize: "0.85rem", marginTop: "4px", color: "#198754" }}>
                        <strong>{t("Answer:", "جواب:")}</strong> {gq.model_answer}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#6c757d" }}>{t("No guide data available.", "کوئی ڈیٹا دستیاب نہیں۔")}</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.close"
                    : "interview_readiness.close"
                }
                onClick={() => setShowPocketGuideModal(false)}
                style={{ padding: "6px 14px", borderRadius: "4px", border: "1px solid #ced4da", background: "#f8f9fa", cursor: "pointer" }}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock Interviews History Modal */}
      {showMockModal && (
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
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "20px",
              width: "750px",
              maxWidth: "94vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                📋 {t("Mock Interview Sessions History", "فرضی انٹرویو سیشنز ہسٹری")}
              </h3>
              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.close"
                    : "interview_readiness.close"
                }
                onClick={() => {
                  setShowMockModal(false);
                  setSelectedMockId(null);
                  setMockDetail(null);
                }}
                style={{ border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {!selectedMockId ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                    <tr>
                      <th style={{ padding: "8px" }}>{t("Interview #", "انٹرویو نمبر")}</th>
                      <th style={{ padding: "8px" }}>{t("Staff Member", "عملے کا رکن")}</th>
                      <th style={{ padding: "8px" }}>{t("Role", "کردار")}</th>
                      <th style={{ padding: "8px" }}>{t("Examiner", "ممتحن")}</th>
                      <th style={{ padding: "8px" }}>{t("Date", "تاریخ")}</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>{t("Action", "عمل")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockSessions.map((ms: MockInterviewSummaryOut) => (
                      <tr key={ms.mock_interview_id} style={{ borderBottom: "1px solid #dee2e6" }}>
                        <td style={{ padding: "8px", fontWeight: "bold" }}>{ms.interview_number}</td>
                        <td style={{ padding: "8px" }}>{ms.employee_name} ({ms.emp_number})</td>
                        <td style={{ padding: "8px" }}>{ms.role_name || ms.role_code}</td>
                        <td style={{ padding: "8px" }}>{ms.examiner_name}</td>
                        <td style={{ padding: "8px", fontSize: "0.78rem" }}>{new Date(ms.held_at).toLocaleDateString()}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            type="button"
                            data-help={
                              screenId === "interview_readiness_owner"
                                ? "interview_readiness_owner.mock_review"
                                : "interview_readiness.mock_review"
                            }
                            onClick={() => handleOpenMockDetail(ms.mock_interview_id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "1px solid #0d6efd",
                              background: "#fff",
                              color: "#0d6efd",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                            }}
                          >
                            {t("View", "دیکھیں")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div>
                  <button
                    type="button"
                    data-help={
                      screenId === "interview_readiness_owner"
                        ? "interview_readiness_owner.mock_review"
                        : "interview_readiness.mock_review"
                    }
                    onClick={() => {
                      setSelectedMockId(null);
                      setMockDetail(null);
                    }}
                    style={{
                      marginBottom: "10px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ced4da",
                      background: "#f8f9fa",
                      cursor: "pointer",
                    }}
                  >
                    ← {t("Back to sessions list", "واپس فہرست پر")}
                  </button>

                  {loadingMockDetail ? (
                    <div style={{ textAlign: "center", padding: "20px" }}>{t("Loading session details...", "لوڈ ہو رہا ہے...")}</div>
                  ) : mockDetail ? (
                    <div style={{ padding: "8px" }}>
                      <div style={{ marginBottom: "12px" }}>
                        <strong>{mockDetail.interview_number}</strong> — {mockDetail.employee_name} ({mockDetail.role_name || mockDetail.role_code})
                        <div style={{ fontSize: "0.82rem", color: "#6c757d" }}>
                          {t("Examiner:", "ممتحن:")} {mockDetail.examiner_name} | {new Date(mockDetail.held_at).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {mockDetail.items?.map((item, idx) => (
                          <div key={idx} style={{ padding: "8px", background: "#f8f9fa", borderRadius: "4px", border: "1px solid #dee2e6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                                {idx + 1}. {item.question}
                              </span>
                              <span
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: item.result === "Met" ? "#d1e7dd" : item.result === "PartlyMet" ? "#fff3cd" : "#f8d7da",
                                  color: item.result === "Met" ? "#0f5132" : item.result === "PartlyMet" ? "#664d03" : "#842029",
                                }}
                              >
                                {item.result}
                              </span>
                            </div>
                            {item.note && (
                              <div style={{ fontSize: "0.8rem", color: "#495057", marginTop: "4px" }}>
                                <em>{t("Examiner Note:", "ممتحن کا تبصرہ:")}</em> {item.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="button"
                data-help={
                  screenId === "interview_readiness_owner"
                    ? "interview_readiness_owner.close"
                    : "interview_readiness.close"
                }
                onClick={() => {
                  setShowMockModal(false);
                  setSelectedMockId(null);
                  setMockDetail(null);
                }}
                style={{ padding: "6px 14px", borderRadius: "4px", border: "1px solid #ced4da", background: "#f8f9fa", cursor: "pointer" }}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
