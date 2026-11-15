import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  getReadiness,
  getProfile,
  listDocumentsFacilityCompliance,
  listAssessments,
  assessMsdsSelfAssessments,
  ReadinessOut,
  ReadinessIndicatorOut,
  ReadinessAreaOut,
  SelfAssessmentOut,
  MsdsProfileOut,
  ComplianceDocumentOut,
  DocumentCheckOut,
} from "../generated/msds_readiness";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
  screenId?: string;
};

type FrameworkCategory = "Clinic" | "IIC" | "IIB" | "IIA" | "I";

export function MsdsReadiness({ revision, user, onOpenHelp, connected, screenId = "msds_readiness" }: Props) {
  // Category state (defaults to IIB or loaded from profile)
  const [selectedCategory, setSelectedCategory] = useState<FrameworkCategory>("IIB");
  const [localRevision, setLocalRevision] = useState(0);

  // Load profile, readiness data, and compliance documents
  const profileLoad = useLoad(() => getProfile(), [revision, localRevision]);
  const readinessLoad = useLoad(
    () => getReadiness({ category: selectedCategory }),
    [selectedCategory, revision, localRevision]
  );
  const complianceDocsLoad = useLoad(
    () => listDocumentsFacilityCompliance(),
    [revision, localRevision]
  );

  // Filtering & Search states
  const [areaFilter, setAreaFilter] = useState<string>("ALL");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [coverageFilter, setCoverageFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Chapter collapse state: map of area -> boolean (true = expanded)
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});

  // Assessment Modal state
  const [assessingIndicator, setAssessingIndicator] = useState<ReadinessIndicatorOut | null>(null);
  const [assessStatus, setAssessStatus] = useState<"Compliant" | "PartlyCompliant" | "NotCompliant" | "NotApplicable">("Compliant");
  const [assessScore, setAssessScore] = useState<string>("");
  const [assessNote, setAssessNote] = useState<string>("");
  const [assessDocId, setAssessDocId] = useState<string>("");
  const [assessError, setAssessError] = useState<string | null>(null);
  const [savingAssess, setSavingAssess] = useState(false);

  // History Modal state
  const [historyIndicator, setHistoryIndicator] = useState<ReadinessIndicatorOut | null>(null);
  const [historyList, setHistoryList] = useState<SelfAssessmentOut[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canAssess =
    user.permissions.includes("msds.assess") ||
    user.permissions.includes("all");

  const readiness: ReadinessOut | null = readinessLoad.data || null;
  const profile: MsdsProfileOut | null = profileLoad.data || null;
  const complianceDocs: ComplianceDocumentOut[] = complianceDocsLoad.data || [];

  // Toggle single area expansion
  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => ({
      ...prev,
      [area]: prev[area] !== undefined ? !prev[area] : false, // Default is expanded if not in map
    }));
  };

  const isAreaExpanded = (area: string) => {
    return expandedAreas[area] !== undefined ? expandedAreas[area] : true;
  };

  const expandAll = (areas: ReadinessAreaOut[]) => {
    const next: Record<string, boolean> = {};
    for (const a of areas) next[a.area] = true;
    setExpandedAreas(next);
  };

  const collapseAll = (areas: ReadinessAreaOut[]) => {
    const next: Record<string, boolean> = {};
    for (const a of areas) next[a.area] = false;
    setExpandedAreas(next);
  };

  // Open assess modal
  const openAssessModal = (ind: ReadinessIndicatorOut) => {
    setAssessingIndicator(ind);
    setAssessStatus(ind.self_assessment?.status || "Compliant");
    setAssessScore(ind.self_assessment?.score !== null && ind.self_assessment?.score !== undefined ? String(ind.self_assessment.score) : "");
    setAssessNote(ind.self_assessment?.note || "");
    setAssessDocId(ind.self_assessment?.evidence_document_id ? String(ind.self_assessment.evidence_document_id) : "");
    setAssessError(null);
  };

  // Submit assessment
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessingIndicator) return;

    // Rule: note required unless Compliant (rule:54ce092188)
    if (assessStatus !== "Compliant" && !assessNote.trim()) {
      setAssessError(
        t(
          "A justification note is required unless the status is Compliant.",
          "صرف مکمل مطابقت کی صورت کے علاوہ وضاحتی نوٹ درج کرنا لازمی ہے۔"
        )
      );
      return;
    }

    let parsedScore: number | null = null;
    if (assessScore.trim() !== "") {
      const num = parseInt(assessScore.trim(), 10);
      if (isNaN(num) || num < 0 || num > 10) {
        setAssessError(
          t("Score must be an integer between 0 and 10, or leave blank.", "سکور 0 سے 10 کے درمیان ہونا چاہیے یا خالی چھوڑیں۔")
        );
        return;
      }
      parsedScore = num;
    }

    try {
      setSavingAssess(true);
      setAssessError(null);
      await assessMsdsSelfAssessments({
        category: selectedCategory,
        indicator: assessingIndicator.number,
        status: assessStatus,
        score: parsedScore,
        note: assessNote.trim() || null,
        evidence_document_id: assessDocId ? parseInt(assessDocId, 10) : null,
      });

      setAssessingIndicator(null);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssessError(msg);
    } finally {
      setSavingAssess(false);
    }
  };

  // Open history modal
  const openHistoryModal = async (ind: ReadinessIndicatorOut) => {
    setHistoryIndicator(ind);
    setLoadingHistory(true);
    try {
      const list = await listAssessments({
        category: selectedCategory,
        indicator: ind.number,
        limit: 50,
      });
      setHistoryList(list);
    } catch (err) {
      console.error("Failed to load assessments history:", err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper map for document checks
  const documentMap = new Map<string, DocumentCheckOut>();
  if (readiness?.documents) {
    for (const d of readiness.documents) {
      documentMap.set(d.key, d);
    }
  }

  // Filter indicators
  const allIndicators = readiness?.indicators || [];
  const filteredIndicators = allIndicators.filter((ind) => {
    if (areaFilter !== "ALL" && ind.area !== areaFilter) return false;
    if (stateFilter !== "ALL" && ind.state !== stateFilter) return false;
    if (coverageFilter !== "ALL" && ind.coverage !== coverageFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = String(ind.number).includes(q);
      const matchLabel = ind.label.toLowerCase().includes(q);
      const matchArea = ind.area.toLowerCase().includes(q);
      const matchReason = ind.reason.toLowerCase().includes(q);
      if (!matchNum && !matchLabel && !matchArea && !matchReason) return false;
    }
    return true;
  });

  // Group filtered indicators by area
  const areasInOrder = readiness?.areas || [];

  return (
    <section data-screen={screenId}>
      {/* Top Toolbar */}
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>
            {t("PHC inspection: readiness and self-assessment", "پنجاب ہیلتھ کیئر کمیشن معائنہ: تیاری اور خود تشخیص")}
          </h1>
          {/* Category selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label htmlFor="category-select" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
              {t("Framework Category:", "کیٹیگری فریم ورک:")}
            </label>
            <select
              id="category-select"
              data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FrameworkCategory)}
              style={{ padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}
            >
              <option value="Clinic">{t("Clinic (GP / Specialist)", "کلینک (جنرل پریکٹیشنر / ماہر)")}</option>
              <option value="IIC">{t("Category II C", "کیٹیگری 2 سی")}</option>
              <option value="IIB">{t("Category II B", "کیٹیگری 2 بی")}</option>
              <option value="IIA">{t("Category II A", "کیٹیگری 2 اے")}</option>
              <option value="I">{t("Category I", "کیٹیگری 1")}</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="secondary"
            data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
            onClick={() => setLocalRevision((r) => r + 1)}
            disabled={!connected}
          >
            {t("Refresh", "تازہ کریں")}
          </button>
          <button
            type="button"
            data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.help" : "msds_readiness.help"}
            onClick={onOpenHelp}
          >
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Profile & Category Details Banner */}
      {profile && (
        <div
          className="card"
          style={{
            background: "#f0f7ff",
            padding: "10px 14px",
            marginBottom: "12px",
            borderLeft: "4px solid #0056b3",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <strong>{t("Hospital Licence Status:", "لائسنس کی صورتحال:")} </strong>
            <span>
              {profile.category_label || selectedCategory} • {t("Reg No:", "رجسٹریشن نمبر:")}{" "}
              <code>{profile.registration_number || t("Not registered", "غیر اندراج شدہ")}</code>
            </span>
            {profile.suggestion && (
              <span style={{ marginLeft: "12px", color: "#495057" }}>
                ({profile.suggestion.beds} {t("inpatient beds set up", "داخل مریض بستر")})
              </span>
            )}
          </div>
          {readiness?.edition && (
            <div style={{ fontSize: "0.85rem", color: "#6c757d", fontStyle: "italic" }}>
              {readiness.edition}
            </div>
          )}
        </div>
      )}

      {/* Loading & Error States */}
      <LoadState {...readinessLoad} retry={readinessLoad.reload} />

      {readiness && (
        <>
          {/* Header Summary Tiles & Score Section (rule:f7c0207991) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            {/* Ready */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #28a745",
                background: "#f4faf4",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#28a745" }}>
                {readiness.summary.ready}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#155724" }}>
                {t("Ready", "مکمل تیار")}
              </div>
            </article>

            {/* Attention */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #ffc107",
                background: "#fffdf3",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#d39e00" }}>
                {readiness.summary.attention}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#856404" }}>
                {t("Attention", "توجہ طلب")}
              </div>
            </article>

            {/* NotReady */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #dc3545",
                background: "#fdf4f4",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#dc3545" }}>
                {readiness.summary.not_ready}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#721c24" }}>
                {t("Not Ready", "غیر تیار")}
              </div>
            </article>

            {/* To Assess */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #6c757d",
                background: "#f8f9fa",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#6c757d" }}>
                {readiness.summary.self_assess}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#383d41" }}>
                {t("To Assess", "خود تشخیص طلب")}
              </div>
            </article>

            {/* Not Applicable */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #adb5bd",
                background: "#f8f9fa",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#6c757d" }}>
                {readiness.summary.not_applicable}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#6c757d", textDecoration: "line-through" }}>
                {t("Not Applicable", "غیر لاگو")}
              </div>
            </article>

            {/* Readiness Percentage (rule:f7c0207991) */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #007bff",
                background: "#f0f7ff",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#007bff" }}>
                {readiness.summary.ready_pct !== null ? `${readiness.summary.ready_pct}%` : "—"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#495057", lineHeight: "1.2" }}>
                <strong>{t("Readiness", "تیاری")}</strong>
                <br />
                <em>{t("Haspataal's estimate, not the PHC score", "ہسپتال کا تخمینہ، پی ایچ سی کا حتمی سکور نہیں")}</em>
              </div>
            </article>

            {/* Points & Score Summary (rule:f7c0207991) */}
            <article
              className="card"
              style={{
                textAlign: "center",
                padding: "10px",
                borderTop: "4px solid #6f42c1",
                background: "#f8f4fd",
              }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#6f42c1" }}>
                {readiness.score.points} / {readiness.score.max_points}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#495057", lineHeight: "1.2" }}>
                <strong>{t("Hospital Score", "ہسپتال کا خود تشخیصی سکور")}</strong>
                <br />
                {readiness.score.unscored > 0 && (
                  <span style={{ color: "#d9534f" }}>
                    {readiness.score.unscored} {t("unscored (not assessed)", "غیر تشخیصی")}
                  </span>
                )}
              </div>
            </article>
          </div>

          {/* Thresholds Alert Banner if known (rule:f7c0207991) */}
          {readiness.score.thresholds_known &&
            (readiness.score.red_below.length > 0 || readiness.score.yellow_below.length > 0) && (
              <div
                className="card"
                style={{
                  background: "#fff3cd",
                  border: "1px solid #ffeeba",
                  padding: "10px 14px",
                  marginBottom: "12px",
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <strong>{t("Statutory Minimum Threshold Warning:", "لازمی کم از کم حد کی وارننگ:")}</strong>
                {readiness.score.red_below.length > 0 && (
                  <span style={{ color: "#721c24", fontWeight: "bold" }}>
                    🔴 {t("Red indicators below 10:", "سرخ انڈیکیٹرز 10 سے کم:")}{" "}
                    {readiness.score.red_below.map((n) => `#${n}`).join(", ")}
                  </span>
                )}
                {readiness.score.yellow_below.length > 0 && (
                  <span style={{ color: "#856404", fontWeight: "bold" }}>
                    🟡 {t("Yellow indicators below 8:", "پیلے انڈیکیٹرز 8 سے کم:")}{" "}
                    {readiness.score.yellow_below.map((n) => `#${n}`).join(", ")}
                  </span>
                )}
              </div>
            )}

          {/* Rating Basis Notice (rule:56f7762ae8) */}
          <div
            className="card"
            style={{
              background: "#e9ecef",
              padding: "10px 14px",
              marginBottom: "14px",
              fontSize: "0.85rem",
              lineHeight: "1.4",
              borderLeft: "4px solid #6c757d",
            }}
          >
            <strong>{t("Rating basis notice:", "درجہ بندی کی بنیاد کا نوٹس:")} </strong>
            {readiness.rating_basis_text ||
              t(
                "The coverage badges are the vendor's self-assessment. Each row shows 'check on site' when on_site_evidence is needed; such a row turns green only after the hospital's own assessment says Compliant.",
                "کوریج بیجز سافٹ ویئر فراہم کنندہ کی خود تشخیص ہیں۔ اگر موقع پر معائنہ درکار ہو تو متعلقہ قطار صرف ہسپتال کی خود تشخیص میں مطابقت درج کرنے کے بعد ہی سبز ہوگی۔"
              )}
          </div>

          {/* Filters Bar (rule:e9f5dda82e) */}
          <div
            className="toolbar"
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              background: "#f8f9fa",
              padding: "8px 12px",
              borderRadius: "4px",
              marginBottom: "14px",
            }}
          >
            {/* Search */}
            <div style={{ flex: 1, minWidth: "180px" }}>
              <input
                type="search"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
                placeholder={t("Search by # or keyword...", "نمبر یا لفظ سے تلاش کریں...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "5px 8px" }}
              />
            </div>

            {/* Chapter/Area Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{t("Chapter:", "باب:")}</label>
              <select
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">{t("All Chapters", "تمام ابواب")}</option>
                {areasInOrder.map((a) => (
                  <option key={a.area} value={a.area}>
                    {a.area} — {a.name} ({a.indicators})
                  </option>
                ))}
              </select>
            </div>

            {/* State Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{t("State:", "حالت:")}</label>
              <select
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">{t("All States", "تمام حالتیں")}</option>
                <option value="Ready">{t("Ready (Green)", "مکمل تیار (سبز)")}</option>
                <option value="Attention">{t("Attention (Amber)", "توجہ طلب (پیلے)")}</option>
                <option value="NotReady">{t("Not Ready (Red)", "غیر تیار (سرخ)")}</option>
                <option value="SelfAssess">{t("Self Assess (Grey)", "خود تشخیص (سرمئی)")}</option>
                <option value="NotApplicable">{t("Not Applicable (Struck)", "غیر لاگو (خط کشیدہ)")}</option>
              </select>
            </div>

            {/* Coverage Filter (rule:e9f5dda82e) */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{t("Coverage:", "کوریج:")}</label>
              <select
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.filter" : "msds_readiness.filter"}
                value={coverageFilter}
                onChange={(e) => setCoverageFilter(e.target.value)}
                style={{ padding: "4px 8px" }}
              >
                <option value="ALL">{t("All Coverage", "تمام کوریج")}</option>
                <option value="OverDelivers">{t("OverDelivers", "اضافی سہولت")}</option>
                <option value="Delivers">{t("Delivers", "مکمل سہولت")}</option>
                <option value="Partly">{t("Partly", "جزوی سہولت")}</option>
                <option value="NotYet">{t("NotYet", "ابھی نہیں")}</option>
                <option value="Outside">{t("Outside (On-site matters)", "موقع پر معائنہ (بیرونی)")}</option>
              </select>
            </div>

            {/* Expand / Collapse All (rule:e09256dde2) */}
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.chapter" : "msds_readiness.chapter"}
                style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                onClick={() => expandAll(areasInOrder)}
              >
                {t("Expand All", "سب کھولیں")}
              </button>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.chapter" : "msds_readiness.chapter"}
                style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                onClick={() => collapseAll(areasInOrder)}
              >
                {t("Collapse All", "سب بند کریں")}
              </button>
            </div>
          </div>

          {/* Collapsible Area/Chapter Blocks (rule:e09256dde2) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {areasInOrder.map((area) => {
              const indicatorsInThisArea = filteredIndicators.filter((i) => i.area === area.area);
              if (areaFilter !== "ALL" && areaFilter !== area.area) return null;
              if (indicatorsInThisArea.length === 0 && (stateFilter !== "ALL" || coverageFilter !== "ALL" || searchQuery)) {
                return null;
              }

              const expanded = isAreaExpanded(area.area);

              return (
                <div
                  key={area.area}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    border: "1px solid #ced4da",
                  }}
                >
                  {/* Chapter Header */}
                  <div
                    onClick={() => toggleArea(area.area)}
                    style={{
                      background: "#e9ecef",
                      padding: "10px 14px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                        {expanded ? "▼" : "►"}
                      </span>
                      <strong style={{ fontSize: "1rem" }}>
                        {area.area} — {area.name}
                      </strong>
                      <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                        ({indicatorsInThisArea.length} / {area.indicators} {t("indicators", "انڈیکیٹرز")})
                      </span>
                    </div>

                    {/* Area Count Badges */}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {area.ready > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#28a745", color: "#fff", fontSize: "0.75rem", padding: "2px 6px" }}
                        >
                          {area.ready} {t("Ready", "تیار")}
                        </span>
                      )}
                      {area.attention > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#ffc107", color: "#212529", fontSize: "0.75rem", padding: "2px 6px" }}
                        >
                          {area.attention} {t("Attention", "توجہ")}
                        </span>
                      )}
                      {area.not_ready > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#dc3545", color: "#fff", fontSize: "0.75rem", padding: "2px 6px" }}
                        >
                          {area.not_ready} {t("Not Ready", "غیر تیار")}
                        </span>
                      )}
                      {area.self_assess > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#6c757d", color: "#fff", fontSize: "0.75rem", padding: "2px 6px" }}
                        >
                          {area.self_assess} {t("To Assess", "تشخیص")}
                        </span>
                      )}
                      {area.not_applicable > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#e2e3e5", color: "#6c757d", fontSize: "0.75rem", padding: "2px 6px" }}
                        >
                          {area.not_applicable} {t("N/A", "لاگو نہیں")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indicators Table inside Chapter */}
                  {expanded && (
                    <div className="table-container" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6", textAlign: "left" }}>
                            <th style={{ padding: "8px 10px", width: "50px" }}>{t("#", "نمبر")}</th>
                            <th style={{ padding: "8px 10px", width: "35%" }}>
                              {t("Indicator Details", "انڈیکیٹر کی تفصیلات")}
                              <div style={{ fontSize: "0.7rem", color: "#6c757d", fontWeight: "normal" }}>
                                {t("see PHC manual for exact wording", "حتمی الفاظ کے لیے پی ایچ سی مینوئل دیکھیں")}
                              </div>
                            </th>
                            <th style={{ padding: "8px 10px", width: "12%" }}>{t("Coverage", "کوریج")}</th>
                            <th style={{ padding: "8px 10px", width: "15%" }}>{t("State & Reason", "حالت اور وجہ")}</th>
                            <th style={{ padding: "8px 10px", width: "18%" }}>{t("Latest Assessment", "تازہ ترین تشخیص")}</th>
                            <th style={{ padding: "8px 10px", textAlign: "right", width: "120px" }}>{t("Actions", "اقدامات")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indicatorsInThisArea.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: "center", padding: "16px", color: "#6c757d" }}>
                                {t("No indicators match current filters in this chapter.", "اس باب میں موجودہ فلٹرز کے مطابق کوئی انڈیکیٹر نہیں۔")}
                              </td>
                            </tr>
                          ) : (
                            indicatorsInThisArea.map((ind) => {
                              // Check unmeasured status (rule:16b35cb18c)
                              const hasDocs = ind.documents && ind.documents.length > 0;
                              const allDocsUnmeasured =
                                hasDocs &&
                                ind.documents.every((docKey) => {
                                  const docCheck = documentMap.get(docKey);
                                  return docCheck ? docCheck.measured === false : false;
                                });

                              // State badge styling (rule:e9f5dda82e)
                              let stateBg = "#6c757d";
                              let stateColor = "#fff";
                              if (ind.state === "Ready") {
                                stateBg = "#28a745";
                              } else if (ind.state === "Attention") {
                                stateBg = "#ffc107";
                                stateColor = "#212529";
                              } else if (ind.state === "NotReady") {
                                stateBg = "#dc3545";
                              } else if (ind.state === "SelfAssess") {
                                stateBg = "#6c757d";
                              } else if (ind.state === "NotApplicable") {
                                stateBg = "#e2e3e5";
                                stateColor = "#6c757d";
                              }

                              const isStruck = ind.state === "NotApplicable";

                              return (
                                <tr
                                  key={ind.number}
                                  style={{
                                    borderBottom: "1px solid #e9ecef",
                                    textDecoration: isStruck ? "line-through" : "none",
                                    background: isStruck ? "#fafafa" : "#fff",
                                  }}
                                >
                                  {/* Number & Grade */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                                    <div style={{ fontWeight: "bold" }}>#{ind.number}</div>
                                    {ind.grade === "Red" && (
                                      <span
                                        className="badge"
                                        style={{ background: "#dc3545", color: "#fff", fontSize: "0.65rem", padding: "1px 4px" }}
                                        title={t("Red grade: 10 points required", "سرخ گریڈ: 10 نمبر درکار")}
                                      >
                                        {t("Red (10)", "سرخ (10)")}
                                      </span>
                                    )}
                                    {ind.grade === "Yellow" && (
                                      <span
                                        className="badge"
                                        style={{ background: "#ffc107", color: "#212529", fontSize: "0.65rem", padding: "1px 4px" }}
                                        title={t("Yellow grade: at least 8 points required", "پیلا گریڈ: کم از کم 8 نمبر درکار")}
                                      >
                                        {t("Yellow (8)", "پیلا (8)")}
                                      </span>
                                    )}
                                  </td>

                                  {/* Label, Notes, On-Site & Document Check (rule:e09256dde2, rule:56f7762ae8, rule:16b35cb18c) */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                                    <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                                      {ind.label}
                                    </div>
                                    {ind.note && (
                                      <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "3px" }}>
                                        {ind.note}
                                      </div>
                                    )}

                                    {/* On-site evidence badge (rule:56f7762ae8) */}
                                    {ind.on_site_evidence === "needed" && (
                                      <div style={{ marginTop: "4px" }}>
                                        <span
                                          className="badge"
                                          style={{
                                            background: "#e7f1ff",
                                            color: "#004085",
                                            border: "1px solid #b8daff",
                                            fontSize: "0.75rem",
                                            padding: "2px 6px",
                                            borderRadius: "3px",
                                          }}
                                          title={t(
                                            "Check on site: surveyor verifies display/equipment/procedure. Turns green only after hospital's assessment says Compliant.",
                                            "موقع پر معائنہ: معائنہ کار موقع پر تصدیق کرتا ہے۔ صرف خود تشخیص میں مطابقت درج کرنے پر سبز ہوگا۔"
                                          )}
                                        >
                                          🔍 {t("Check on site", "موقع پر تصدیق")}
                                        </span>
                                      </div>
                                    )}

                                    {/* Unmeasured documents notice (rule:16b35cb18c) */}
                                    {allDocsUnmeasured && (
                                      <div style={{ marginTop: "4px" }}>
                                        <span
                                          className="badge"
                                          style={{
                                            background: "#fff3cd",
                                            color: "#856404",
                                            border: "1px solid #ffeeba",
                                            fontSize: "0.75rem",
                                            padding: "2px 6px",
                                            borderRadius: "3px",
                                          }}
                                          title={t(
                                            "Not measured: check a sample. Turns green only after hospital's assessment says Compliant.",
                                            "غیر پیمائش شدہ: نمونہ چیک کریں۔ صرف خود تشخیص میں مطابقت پر سبز ہوگا۔"
                                          )}
                                        >
                                          ⚠️ {t("Not measured: check a sample", "غیر پیمائش شدہ: نمونہ چیک کریں")}
                                        </span>
                                      </div>
                                    )}

                                    {/* Inspection Pack Documents links (rule:3a45ca760e) */}
                                    {ind.documents && ind.documents.length > 0 && (
                                      <div style={{ marginTop: "5px", display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.7rem", color: "#6c757d" }}>
                                          {t("Documents:", "دستاویزات:")}
                                        </span>
                                        {ind.documents.map((dKey) => {
                                          const check = documentMap.get(dKey);
                                          return (
                                            <span
                                              key={dKey}
                                              className="badge"
                                              style={{
                                                background: "#f1f3f5",
                                                color: "#333",
                                                fontSize: "0.7rem",
                                                border: "1px solid #ced4da",
                                                padding: "1px 5px",
                                                borderRadius: "3px",
                                              }}
                                              title={check ? `${check.title}: ${check.detail} (${check.state})` : dKey}
                                            >
                                              📄 {check?.title || dKey}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>

                                  {/* Coverage Badge */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                                    <span
                                      className="badge"
                                      style={{
                                        background: ind.coverage === "Outside" ? "#6c757d" : "#e9ecef",
                                        color: ind.coverage === "Outside" ? "#fff" : "#212529",
                                        fontSize: "0.75rem",
                                        padding: "2px 6px",
                                      }}
                                    >
                                      {ind.coverage}
                                    </span>
                                    <div style={{ fontSize: "0.7rem", color: "#6c757d", marginTop: "3px" }}>
                                      {t("Software:", "سافٹ ویئر:")} {ind.software}
                                    </div>
                                  </td>

                                  {/* State & Reason (rule:e9f5dda82e) */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                                    <span
                                      className="badge"
                                      style={{
                                        background: stateBg,
                                        color: stateColor,
                                        fontSize: "0.8rem",
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {ind.state}
                                    </span>
                                    {ind.reason && (
                                      <div style={{ fontSize: "0.8rem", color: "#495057", marginTop: "4px" }}>
                                        {ind.reason}
                                      </div>
                                    )}
                                  </td>

                                  {/* Latest Assessment Details */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                                    {ind.self_assessment ? (
                                      <div style={{ fontSize: "0.8rem" }}>
                                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                          <strong>{ind.self_assessment.status}</strong>
                                          {ind.self_assessment.score !== null && (
                                            <span style={{ fontWeight: "bold", color: "#007bff" }}>
                                              ({ind.self_assessment.score}/10)
                                            </span>
                                          )}
                                        </div>
                                        {ind.self_assessment.note && (
                                          <div style={{ color: "#555", marginTop: "2px", fontStyle: "italic" }}>
                                            "{ind.self_assessment.note}"
                                          </div>
                                        )}
                                        {ind.self_assessment.evidence_document_title && (
                                          <div style={{ color: "#28a745", fontSize: "0.75rem", marginTop: "2px" }}>
                                            📎 {ind.self_assessment.evidence_document_title}
                                          </div>
                                        )}
                                        <div style={{ color: "#6c757d", fontSize: "0.7rem", marginTop: "2px" }}>
                                          {ind.self_assessment.assessed_by_name} •{" "}
                                          {new Date(ind.self_assessment.assessed_at).toLocaleDateString()}
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: "#adb5bd", fontSize: "0.8rem" }}>
                                        {t("Not yet assessed", "ابھی تک تشخیص نہیں ہوئی")}
                                      </span>
                                    )}
                                  </td>

                                  {/* Row Actions (rule:54ce092188) */}
                                  <td style={{ padding: "8px 10px", verticalAlign: "top", textAlign: "right" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                                      <button
                                        type="button"
                                        data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                                        disabled={!canAssess || !connected}
                                        style={{ fontSize: "0.8rem", padding: "3px 8px", minWidth: "75px" }}
                                        onClick={() => openAssessModal(ind)}
                                      >
                                        {t("Assess", "تشخیص")}
                                      </button>
                                      <button
                                        type="button"
                                        className="secondary"
                                        data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                                        style={{ fontSize: "0.75rem", padding: "2px 6px", minWidth: "75px" }}
                                        onClick={() => openHistoryModal(ind)}
                                      >
                                        {t("History", "تاریخچہ")}
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
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Assessment Action Modal (rule:54ce092188) */}
      {assessingIndicator && (
        <div
          role="dialog"
          aria-modal="true"
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
            padding: "16px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "20px",
              borderRadius: "6px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                {t("Record Self-Assessment", "خود تشخیصی اندراج")} — #{assessingIndicator.number}
              </h2>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                onClick={() => setAssessingIndicator(null)}
                style={{ fontSize: "1.1rem", padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 12px 0", color: "#495057", fontSize: "0.9rem" }}>
              <strong>{assessingIndicator.area}:</strong> {assessingIndicator.label}
            </p>

            {assessError && (
              <div
                style={{
                  background: "#f8d7da",
                  color: "#721c24",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  fontSize: "0.85rem",
                }}
              >
                {assessError}
              </div>
            )}

            <form onSubmit={handleSaveAssessment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Status Picker */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.9rem" }}>
                  {t("Assessment Status:", "تشخیصی حالت:")}
                </label>
                <select
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  value={assessStatus}
                  onChange={(e) => setAssessStatus(e.target.value as typeof assessStatus)}
                  style={{ width: "100%", padding: "6px 8px" }}
                  required
                >
                  <option value="Compliant">{t("Compliant (Fully Met)", "مطابق (مکمل پورا)")}</option>
                  <option value="PartlyCompliant">{t("Partly Compliant (Partially Met)", "جزوی مطابق (جزوی پورا)")}</option>
                  <option value="NotCompliant">{t("Not Compliant (Not Met)", "غیر مطابق (پورا نہیں ہوا)")}</option>
                  <option value="NotApplicable">{t("Not Applicable (Service not provided)", "غیر لاگو (سہولت موجود نہیں)")}</option>
                </select>
              </div>

              {/* Score Input (0-10 or blank) (rule:54ce092188) */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.9rem" }}>
                  {t("Score (0 – 10, optional):", "نمبر (0 سے 10، اختیاری):")}
                </label>
                <input
                  type="number"
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  min="0"
                  max="10"
                  placeholder={t("Blank means unscored (never zero)", "خالی کا مطلب غیر تشخیصی ہے (صفر نہیں)")}
                  value={assessScore}
                  onChange={(e) => setAssessScore(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px" }}
                />
                <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                  {t(
                    "Framework standard: Red indicator requires 10; Yellow indicator requires 8+. Leave blank if unscored.",
                    "فریم ورک معیار: سرخ انڈیکیٹر کے لیے 10 نمبر؛ پیلے انڈیکیٹر کے لیے کم از کم 8 نمبر درکار ہیں۔ بغیر سکور خالی چھوڑیں۔"
                  )}
                </span>
              </div>

              {/* Justification Note (rule:54ce092188) */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.9rem" }}>
                  {t("Assessment Note / Justification:", "تشخیصی نوٹ / جواز:")}
                  {assessStatus !== "Compliant" && (
                    <span style={{ color: "#dc3545", marginLeft: "4px" }}>* ({t("Required", "لازمی")})</span>
                  )}
                </label>
                <textarea
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  rows={3}
                  placeholder={
                    assessStatus === "Compliant"
                      ? t("Optional comments or remarks...", "اختیاری ریمارکس...")
                      : t("Mandatory: explain what is missing, gap remediation, or why not applicable...", "لازمی: وضاحت کریں کہ کیا کمی ہے، اصلاحی منصوبہ، یا کیوں لاگو نہیں ہوتا...")
                  }
                  value={assessNote}
                  onChange={(e) => setAssessNote(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px" }}
                  required={assessStatus !== "Compliant"}
                />
              </div>

              {/* Evidence Document Scan Link (rule:54ce092188) */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.9rem" }}>
                  {t("Compliance Document Scan / Evidence:", "تعمیل دستاویز اسکین / ثبوت:")}
                </label>
                <select
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  value={assessDocId}
                  onChange={(e) => setAssessDocId(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px" }}
                >
                  <option value="">{t("— None / No linked scan —", "— کوئی اسکین منسلک نہیں —")}</option>
                  {complianceDocs.map((cd) => (
                    <option key={cd.document_id} value={cd.document_id}>
                      [{cd.category}] {cd.title} ({cd.authority || t("Internal", "اندرونی")})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                  {t(
                    "Evidence document scan from the statutory compliance register (GET /facility/compliance-documents).",
                    "قانونی تعمیل رجسٹر سے منسلک دستاویز کا اسکین۔"
                  )}
                </span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="secondary"
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  onClick={() => setAssessingIndicator(null)}
                  disabled={savingAssess}
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="submit"
                  data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                  disabled={savingAssess || !connected}
                >
                  {savingAssess ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Assessment", "تشخیص محفوظ کریں")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyIndicator && (
        <div
          role="dialog"
          aria-modal="true"
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
            padding: "16px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "650px",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "20px",
              borderRadius: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                {t("Assessment History", "تشخیص کی تاریخ")} — #{historyIndicator.number}
              </h2>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                onClick={() => setHistoryIndicator(null)}
                style={{ fontSize: "1.1rem", padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 12px 0", color: "#495057", fontSize: "0.9rem" }}>
              <strong>{historyIndicator.area}:</strong> {historyIndicator.label}
            </p>

            {loadingHistory ? (
              <p style={{ textAlign: "center", padding: "16px" }}>{t("Loading history...", "لوڈ ہو رہا ہے...")}</p>
            ) : historyList.length === 0 ? (
              <p style={{ textAlign: "center", padding: "16px", color: "#6c757d" }}>
                {t("No prior self-assessments recorded for this indicator.", "اس انڈیکیٹر کے لیے کوئی سابقہ خود تشخیص ریکارڈ نہیں ہے۔")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {historyList.map((h) => (
                  <div
                    key={h.assessment_id}
                    style={{
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      padding: "10px",
                      background: "#fdfdfd",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold" }}>
                        {h.status} {h.score !== null && `(${h.score}/10)`}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                        {new Date(h.assessed_at).toLocaleString()}
                      </span>
                    </div>
                    {h.note && (
                      <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "#333", fontStyle: "italic" }}>
                        "{h.note}"
                      </p>
                    )}
                    {h.evidence_document_title && (
                      <div style={{ fontSize: "0.8rem", color: "#28a745", marginTop: "4px" }}>
                        📎 {t("Evidence Document:", "ثبوتی دستاویز:")} {h.evidence_document_title}
                      </div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#6c757d", marginTop: "4px" }}>
                      {t("Assessed by:", "تشخیص کنندہ:")} {h.assessed_by_name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                type="button"
                className="secondary"
                data-help={screenId === "msds_readiness_owner" ? "msds_readiness_owner.assess" : "msds_readiness.assess"}
                onClick={() => setHistoryIndicator(null)}
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
