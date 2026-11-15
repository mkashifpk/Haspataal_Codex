import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  listQuestions,
  getQuestion,
  setHospitalAnswer,
  rolesMsdsInterviewPrep,
  pocketGuide,
  pocketGuidePayload,
  listIndicators,
  InterviewQuestionOut,
  InterviewQuestionDetailOut,
  InterviewRoleOut,
  InterviewPocketGuideOut,
  IndicatorOut,
  HospitalAnswerIn,
  InterviewFactOut,
} from "../generated/interview_bank";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

export function InterviewBank({ revision, user, onOpenHelp, connected }: Props) {
  const [localRevision, setLocalRevision] = useState(0);
  const [activeLang, setActiveLang] = useState<"en" | "ur">("en");

  // Permissions check
  const canManage = user.permissions.includes("msds.interview.manage");

  // Filters state
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | "Mandatory" | "Operational">("ALL");
  const [searchText, setSearchText] = useState<string>("");
  const [mineOnly, setMineOnly] = useState<boolean>(false);

  // Selected question detail state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailLang, setDetailLang] = useState<"en" | "ur">("en");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editLang, setEditLang] = useState<"en" | "ur">("en");

  // Editor form state
  const [editModelAnswer, setEditModelAnswer] = useState<string>("");
  const [editKeyPoints, setEditKeyPoints] = useState<string[]>([]);
  const [newKeyPointText, setNewKeyPointText] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<boolean>(false);

  // Not applicable modal state
  const [showNotApplicableModal, setShowNotApplicableModal] = useState<boolean>(false);
  const [notApplicableReason, setNotApplicableReason] = useState<string>("");
  const [savingApplicable, setSavingApplicable] = useState<boolean>(false);
  const [applicableError, setApplicableError] = useState<string | null>(null);

  // Pocket guide export preview modal state
  const [showPocketGuideModal, setShowPocketGuideModal] = useState<boolean>(false);
  const [guideData, setGuideData] = useState<InterviewPocketGuideOut | null>(null);
  const [loadingGuide, setLoadingGuide] = useState<boolean>(false);

  // Load auxiliary data: roles and indicators
  const rolesLoad = useLoad(
    () => rolesMsdsInterviewPrep(),
    [localRevision, revision]
  );
  const rolesList: InterviewRoleOut[] = rolesLoad.data || [];

  const indicatorsLoad = useLoad(
    () => listIndicators(),
    [localRevision, revision]
  );
  const indicatorsList: IndicatorOut[] = indicatorsLoad.data || [];

  // Extract unique chapters/areas from indicators or questions
  const distinctAreas = Array.from(
    new Set(indicatorsList.map((ind) => ind.area || ind.area_name).filter(Boolean))
  );

  // Load question bank list
  const questionsLoad = useLoad(
    () =>
      listQuestions({
        role: selectedRole !== "ALL" ? selectedRole : undefined,
        area: selectedArea !== "ALL" ? selectedArea : undefined,
        phc_type: selectedType !== "ALL" ? selectedType : undefined,
        search: searchText.trim() ? searchText.trim() : undefined,
        mine: mineOnly ? true : undefined,
        lang: activeLang,
      }),
    [localRevision, revision, selectedRole, selectedArea, selectedType, searchText, mineOnly, activeLang]
  );
  const questionsList: InterviewQuestionOut[] = questionsLoad.data || [];

  // Load selected question detail
  const detailLoad = useLoad(
    () => (selectedKey ? getQuestion(selectedKey, { lang: detailLang }) : Promise.resolve(null)),
    [selectedKey, detailLang, localRevision, revision]
  );
  const questionDetail: InterviewQuestionDetailOut | null = detailLoad.data ?? null;

  // Sync editor fields when entering edit mode or when detail changes
  useEffect(() => {
    if (questionDetail) {
      setEditModelAnswer(questionDetail.model_answer || "");
      setEditKeyPoints(questionDetail.key_points ? [...questionDetail.key_points] : []);
      setEditNote(questionDetail.hospital_version?.note || "");
      setNotApplicableReason(questionDetail.not_applicable_reason || "");
      setVersionConflict(false);
      setEditError(null);
    }
  }, [questionDetail, isEditing]);

  // Handle switching editor language
  const handleSwitchEditorLang = (lang: "en" | "ur") => {
    setEditLang(lang);
    setDetailLang(lang);
  };

  // Add key point
  const handleAddKeyPoint = () => {
    if (!newKeyPointText.trim()) return;
    if (editKeyPoints.length >= 12) return;
    setEditKeyPoints([...editKeyPoints, newKeyPointText.trim()]);
    setNewKeyPointText("");
  };

  // Remove key point
  const handleRemoveKeyPoint = (idx: number) => {
    setEditKeyPoints(editKeyPoints.filter((_, i) => i !== idx));
  };

  // Handle saving hospital adaptation
  const handleSaveHospitalAnswer = async () => {
    if (!selectedKey || !questionDetail) return;
    setSavingEdit(true);
    setEditError(null);
    setVersionConflict(false);

    try {
      const payload: HospitalAnswerIn = {
        lang: editLang,
        model_answer: editModelAnswer.trim() ? editModelAnswer.trim() : null,
        key_points: editKeyPoints.length > 0 ? editKeyPoints : null,
        applicable: questionDetail.applicable,
        not_applicable_reason: questionDetail.not_applicable_reason,
        note: editNote.trim() ? editNote.trim() : null,
        expected_version: questionDetail.hospital_version?.row_version ?? null,
      };

      await setHospitalAnswer(selectedKey, payload);
      setIsEditing(false);
      setLocalRevision((r) => r + 1);
    } catch (err: any) {
      if (err?.code === "VERSION_CONFLICT") {
        setVersionConflict(true);
      } else {
        setEditError(err?.message || t("Failed to save hospital answer.", "ہسپتال کا جواب محفوظ کرنے میں ناکامی۔"));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle reverting to standard text
  const handleResetToStandard = async () => {
    if (!selectedKey || !questionDetail) return;
    setSavingEdit(true);
    setEditError(null);
    setVersionConflict(false);

    try {
      const payload: HospitalAnswerIn = {
        lang: editLang,
        model_answer: null,
        key_points: null,
        applicable: questionDetail.applicable,
        not_applicable_reason: questionDetail.not_applicable_reason,
        note: editNote.trim() ? editNote.trim() : null,
        expected_version: questionDetail.hospital_version?.row_version ?? null,
      };

      await setHospitalAnswer(selectedKey, payload);
      setIsEditing(false);
      setLocalRevision((r) => r + 1);
    } catch (err: any) {
      if (err?.code === "VERSION_CONFLICT") {
        setVersionConflict(true);
      } else {
        setEditError(err?.message || t("Failed to reset standard text.", "معیاری متن پر واپس لانے میں ناکامی۔"));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle toggling applicable status
  const handleToggleApplicable = async (markApplicable: boolean) => {
    if (!selectedKey || !questionDetail) return;
    if (!markApplicable && !notApplicableReason.trim()) {
      setApplicableError(t("A reason is required to mark not applicable.", "غیر متعلقہ قرار دینے کے لیے وجہ لازمی ہے۔"));
      return;
    }

    setSavingApplicable(true);
    setApplicableError(null);

    try {
      const payload: HospitalAnswerIn = {
        lang: editLang,
        model_answer: questionDetail.model_answer,
        key_points: questionDetail.key_points,
        applicable: markApplicable,
        not_applicable_reason: markApplicable ? null : notApplicableReason.trim(),
        note: questionDetail.hospital_version?.note,
        expected_version: questionDetail.hospital_version?.row_version ?? null,
      };

      await setHospitalAnswer(selectedKey, payload);
      setShowNotApplicableModal(false);
      setLocalRevision((r) => r + 1);
    } catch (err: any) {
      setApplicableError(err?.message || t("Failed to update applicability.", "متعلقہ حیثیت تبدیل کرنے میں ناکامی۔"));
    } finally {
      setSavingApplicable(false);
    }
  };

  // Handle exporting pocket guide PDF
  const handleExportPdf = async () => {
    try {
      const roleParam = selectedRole !== "ALL" ? selectedRole : undefined;
      await pocketGuide({ role: roleParam });
    } catch (err: any) {
      console.error("PDF export error", err);
    }
  };

  // Handle opening terminal pocket guide preview
  const handleOpenPocketGuidePreview = async () => {
    setLoadingGuide(true);
    setShowPocketGuideModal(true);
    try {
      const roleParam = selectedRole !== "ALL" ? selectedRole : undefined;
      const res = await pocketGuidePayload({ role: roleParam, lang: activeLang });
      setGuideData(res);
    } catch (err: any) {
      console.error("Pocket guide payload error", err);
    } finally {
      setLoadingGuide(false);
    }
  };

  return (
    <div
      data-screen="interview_bank"
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
            {t("PHC interview questions and model answers", "پی ایچ سی انٹرویو سوالات اور نمونہ جوابات")}
          </h1>
          <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
            {t(
              "Statutory inspection questions, hospital SOP adaptations, and staff pocket guides.",
              "قانونی معائنہ کے سوالات، ہسپتال ایس او پی سے موافقت اور عملے کی پاکٹ گائیڈز۔"
            )}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Language Switch */}
          <button
            type="button"
            data-help="interview_bank.language"
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

          {/* Export PDF Pocket Guide */}
          <button
            type="button"
            data-help="interview_bank.export"
            onClick={handleExportPdf}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #198754",
              background: "#198754",
              color: "#fff",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            📄 {t("Pocket Guide (PDF)", "پاکٹ گائیڈ (پی ڈی ایف)")}
          </button>

          {/* Terminal Print Preview Pocket Guide */}
          <button
            type="button"
            data-help="interview_bank.export"
            onClick={handleOpenPocketGuidePreview}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid #0d6efd",
              background: "#0d6efd",
              color: "#fff",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            🖨️ {t("Pocket Guide Printout", "پاکٹ گائیڈ پرنٹ")}
          </button>

          {/* F1 Help */}
          <button
            type="button"
            data-help="interview_bank.help"
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

      {/* Statutory Guidance Banner (rule:6fa3c8d9db) */}
      <div
        style={{
          background: "#e7f5ea",
          border: "1px solid #c3e6cb",
          borderRadius: "6px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "0.88rem",
          color: "#155724",
          lineHeight: "1.4",
        }}
      >
        💡{" "}
        <strong>
          {t(
            "Review every answer with department heads before staff rehearse:",
            "عملے کے مشق کرنے سے پہلے ہر جواب کا شعبہ سربراہان کے ساتھ جائزہ لیں:"
          )}
        </strong>{" "}
        {t(
          "The bank's standard answers are a starting baseline compiled from MSDS, WHO guidelines, PNRA radiation safety, DRAP pharmacy standards, and the Hospital Waste Management Rules. Adapt them to your approved hospital SOPs using 'Edit / Adapt to SOP'.",
          "اس بینک کے معیاری جوابات بنیادی رہنمائی ہیں جو ایم ایس ڈی ایس، ڈبلیو ایچ او، پی این آر اے، ڈریپ اور ویسٹ مینجمنٹ قوانین سے تیار کیے گئے ہیں۔ 'ایس او پی کے مطابق ترمیم' کے ذریعے انہیں اپنے ہسپتال کے منظور شدہ ایس او پیز کے مطابق ڈھالیں۔"
        )}
      </div>

      {/* Filter Toolbar (rule:40ac4c3bd2) */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          background: "#f8f9fa",
          padding: "12px",
          borderRadius: "6px",
          border: "1px solid #dee2e6",
          marginBottom: "16px",
          alignItems: "center",
        }}
      >
        {/* Role Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
            👥 {t("Target Role:", "ہدف کردار:")}
          </label>
          <select
            data-help="interview_bank.filter"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value="ALL">{t("All Roles", "تمام کردار")}</option>
            {rolesList.map((ro) => (
              <option key={ro.role} value={ro.role}>
                {ro.name} ({ro.questions} {t("Q's", "سوالات")})
              </option>
            ))}
          </select>
        </div>

        {/* Chapter / Area Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
            📑 {t("Chapter / Area:", "باب / شعبہ:")}
          </label>
          <select
            data-help="interview_bank.filter"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value="ALL">{t("All Chapters", "تمام ابواب")}</option>
            {distinctAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* PHC Type Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
            🏷️ {t("Compliance Type:", "معیار کی قسم:")}
          </label>
          <select
            data-help="interview_bank.filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value="ALL">{t("All Types (Mandatory & Operational)", "تمام اقسام (لازمی اور عملی)")}</option>
            <option value="Mandatory">{t("Mandatory Only (Red)", "صرف لازمی (سرخ)")}</option>
            <option value="Operational">{t("Operational Only (Yellow)", "صرف عملی (پیلا)")}</option>
          </select>
        </div>

        {/* Search Filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "180px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
            🔍 {t("Search Questions / Words:", "سوالات یا الفاظ تلاش کریں:")}
          </label>
          <input
            type="text"
            data-help="interview_bank.search"
            placeholder={t("Type keywords...", "الفاظ لکھیں...")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ced4da" }}
          />
        </div>

        {/* My Questions Only Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "18px" }}>
          <input
            type="checkbox"
            id="mine_only_chk"
            data-help="interview_bank.filter"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
          <label htmlFor="mine_only_chk" style={{ fontSize: "0.85rem", cursor: "pointer", fontWeight: "bold" }}>
            {t("My role questions only", "صرف میرے کردار کے سوالات")}
          </label>
        </div>
      </div>

      {/* Main Questions List Table */}
      <div style={{ flex: 1, border: "1px solid #dee2e6", borderRadius: "6px", overflowY: "auto", background: "#fff" }}>
        <LoadState
          loading={questionsLoad.loading}
          error={questionsLoad.error}
          retry={() => setLocalRevision((r) => r + 1)}
        />

        {!questionsLoad.loading && !questionsLoad.error && questionsList.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "#6c757d" }}>
            <h3>{t("No PHC interview questions match filters", "کوئی سوال فلٹر پر پورا نہیں اترتا")}</h3>
            <p style={{ fontSize: "0.9rem" }}>
              {t("Try clearing search keywords or choosing 'All Roles'.", "تلاش کے الفاظ ہٹا کر یا تمام کردار منتخب کر کے دیکھیں۔")}
            </p>
          </div>
        )}

        {!questionsLoad.loading && !questionsLoad.error && questionsList.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
            <thead style={{ background: "#f1f3f5", position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: "10px", width: "100px" }}>{t("Key", "کوڈ")}</th>
                <th style={{ padding: "10px", width: "130px" }}>{t("Indicator / Category", "اشاریہ / زمرہ")}</th>
                <th style={{ padding: "10px", width: "110px" }}>{t("PHC Type", "پی ایچ سی قسم")}</th>
                <th style={{ padding: "10px", width: "140px" }}>{t("Chapter", "باب")}</th>
                <th style={{ padding: "10px", width: "140px" }}>{t("Whom to Ask", "کس سے پوچھیں")}</th>
                <th style={{ padding: "10px" }}>{t("Surveyor's Question", "معائنہ کار کا سوال")}</th>
                <th style={{ padding: "10px", width: "100px", textAlign: "center" }}>{t("Adapted", "موافق")}</th>
                <th style={{ padding: "10px", width: "120px", textAlign: "center" }}>{t("Status", "حیثیت")}</th>
                <th style={{ padding: "10px", width: "90px", textAlign: "center" }}>{t("Action", "عمل")}</th>
              </tr>
            </thead>
            <tbody>
              {questionsList.map((q) => {
                const isSelected = selectedKey === q.key;
                const isMandatory = q.phc_type === "Mandatory" || q.grade === "Red";
                const isOperational = q.phc_type === "Operational" || q.grade === "Yellow";

                return (
                  <tr
                    key={q.key}
                    style={{
                      borderBottom: "1px solid #dee2e6",
                      background: isSelected ? "#e7f1ff" : !q.applicable ? "#f8f9fa" : "transparent",
                      opacity: !q.applicable ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: "10px", fontFamily: "monospace", fontWeight: "bold" }}>{q.key}</td>
                    <td style={{ padding: "10px" }}>
                      <strong>#{q.indicator}</strong>
                      {q.indicators_in_category && q.indicators_in_category.length > 0 && (
                        <span style={{ fontSize: "0.78rem", color: "#6c757d", display: "block" }}>
                          Cat {q.category}: #{q.indicators_in_category.join(", #")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {isMandatory && (
                        <span
                          style={{
                            background: "#f8d7da",
                            color: "#842029",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            fontSize: "0.78rem",
                          }}
                        >
                          🔴 {t("Mandatory", "لازمی")}
                        </span>
                      )}
                      {isOperational && !isMandatory && (
                        <span
                          style={{
                            background: "#fff3cd",
                            color: "#664d03",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            fontSize: "0.78rem",
                          }}
                        >
                          🟡 {t("Operational", "عملی")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px" }}>{q.area_name || q.area}</td>
                    <td style={{ padding: "10px", fontSize: "0.82rem" }}>{q.ask}</td>
                    <td style={{ padding: "10px", fontWeight: isSelected ? "bold" : "normal" }}>
                      {q.question}
                      {q.beyond_filter && (
                        <span style={{ fontSize: "0.75rem", color: "#6c757d", display: "block" }}>
                          ⚠️ {t("Common oral question beyond written evidence", "تحریری ثبوت سے ہٹ کر زبانی سوال")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {q.adapted ? (
                        <span style={{ color: "#198754", fontWeight: "bold", fontSize: "1.1rem" }}>✓</span>
                      ) : (
                        <span style={{ color: "#adb5bd" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {!q.applicable ? (
                        <span
                          style={{
                            background: "#6c757d",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          {t("Not applicable", "غیر متعلقہ")}
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#d1e7dd",
                            color: "#0f5132",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          {t("Active", "فعال")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <button
                        type="button"
                        data-help="interview_bank.open"
                        onClick={() => {
                          setSelectedKey(q.key);
                          setIsEditing(false);
                        }}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #0d6efd",
                          background: isSelected ? "#0d6efd" : "#fff",
                          color: isSelected ? "#fff" : "#0d6efd",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "0.8rem",
                        }}
                      >
                        {isSelected ? t("Viewing", "زیر نظر") : t("View", "دیکھیں")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Question Detail Drawer / Modal (rule:58cce04636, rule:e0f43b83c5, rule:bed4b7ed12, rule:56eb23d078) */}
      {selectedKey && (
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
          {/* Drawer Header */}
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
                <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "1.1rem" }}>{selectedKey}</span>
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
                {!questionDetail?.applicable && (
                  <span
                    style={{
                      background: "#6c757d",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                    }}
                  >
                    {t("Not applicable here", "یہاں غیر متعلقہ")}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                #{questionDetail?.indicator} · {questionDetail?.area_name || questionDetail?.area}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* Language Switch within detail drawer (rule:56eb23d078) */}
              <button
                type="button"
                data-help="interview_bank.language"
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

              {/* Close Drawer Button */}
              <button
                type="button"
                data-help="interview_bank.close"
                onClick={() => {
                  setSelectedKey(null);
                  setIsEditing(false);
                }}
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
            <LoadState loading={detailLoad.loading} error={detailLoad.error} retry={() => setLocalRevision((r) => r + 1)} />

            {questionDetail && (
              <>
                {/* Language mismatch alert (rule:56eb23d078) */}
                {questionDetail.adapted_languages &&
                  questionDetail.adapted_languages.length === 1 && (
                    <div
                      style={{
                        background: "#fff3cd",
                        border: "1px solid #ffeeba",
                        color: "#856404",
                        padding: "8px 12px",
                        borderRadius: "4px",
                        marginBottom: "12px",
                        fontSize: "0.82rem",
                      }}
                    >
                      ⚠️{" "}
                      {questionDetail.adapted_languages.includes("en")
                        ? t("Adapted in English only: adapt the Urdu too", "صرف انگریزی میں موافق ہے: اردو میں بھی موافق بنائیں")
                        : t("Adapted in Urdu only: adapt the English too", "صرف اردو میں موافق ہے: انگریزی میں بھی موافق بنائیں")}
                    </div>
                  )}

                {/* Not applicable warning if marked (rule:bed4b7ed12) */}
                {!questionDetail.applicable && (
                  <div
                    style={{
                      background: "#f8d7da",
                      border: "1px solid #f5c2c7",
                      color: "#842029",
                      padding: "10px",
                      borderRadius: "6px",
                      marginBottom: "16px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <strong>🚫 {t("Not applicable here:", "یہاں غیر متعلقہ:")}</strong>{" "}
                    {questionDetail.not_applicable_reason || t("Excluded for this hospital profile.", "اس ہسپتال کے لیے خارج کیا گیا۔")}
                  </div>
                )}

                {/* Question Text */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "0.8rem", color: "#6c757d", fontWeight: "bold" }}>
                    ❓ {t("Question:", "سوال:")}
                  </label>
                  <p style={{ margin: "4px 0 0", fontSize: "1rem", fontWeight: "bold", lineHeight: "1.4" }}>
                    {questionDetail.question}
                  </p>
                  {questionDetail.variants && questionDetail.variants.length > 0 && (
                    <div style={{ marginTop: "6px", fontSize: "0.82rem", color: "#495057" }}>
                      <em>{t("Also asked as:", "یوں بھی پوچھا جاتا ہے:")}</em>{" "}
                      {questionDetail.variants.join(" / ")}
                    </div>
                  )}
                </div>

                {/* Surveyor Context */}
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    background: "#f8f9fa",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "0.82rem",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <strong>{t("Ask:", "مخاطب:")}</strong> {questionDetail.ask}
                  </div>
                  <div>
                    <strong>{t("Requirement:", "شرط:")}</strong> #{questionDetail.requirement}
                  </div>
                </div>

                {/* Mode Switch: View vs Edit */}
                {!isEditing ? (
                  <>
                    {/* Action Toolbar */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                      {canManage && (
                        <button
                          type="button"
                          data-help="interview_bank.edit"
                          onClick={() => {
                            setIsEditing(true);
                            setEditLang(detailLang);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "1px solid #0d6efd",
                            background: "#0d6efd",
                            color: "#fff",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                          }}
                        >
                          ✏️ {t("Edit / Adapt to Hospital SOP", "ہسپتال ایس او پی کے مطابق ترمیم")}
                        </button>
                      )}

                      {canManage && questionDetail.applicable && (
                        <button
                          type="button"
                          data-help="interview_bank.applicable_toggle"
                          onClick={() => setShowNotApplicableModal(true)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "1px solid #dc3545",
                            background: "#fff",
                            color: "#dc3545",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          🚫 {t("Mark Not Applicable Here", "یہاں غیر متعلقہ قرار دیں")}
                        </button>
                      )}

                      {canManage && !questionDetail.applicable && (
                        <button
                          type="button"
                          data-help="interview_bank.applicable_toggle"
                          onClick={() => handleToggleApplicable(true)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: "1px solid #198754",
                            background: "#198754",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          ✅ {t("Restore to Applicable", "دوبارہ متعلقہ بنائیں")}
                        </button>
                      )}
                    </div>

                    {/* Standard Answer with {{placeholders}} & Filled Live Facts (rule:58cce04636) */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                          📖 {t("Model Answer (Rehearsed by Staff):", "ماڈل جواب (جو عملہ مشق کرتا ہے):")}
                        </label>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: questionDetail.answer_source === "Hospital" ? "#d1e7dd" : "#e2e3e5",
                            color: questionDetail.answer_source === "Hospital" ? "#0f5132" : "#41464b",
                            fontWeight: "bold",
                          }}
                        >
                          {questionDetail.answer_source === "Hospital"
                            ? t("Hospital SOP Adapted", "ہسپتال ایس او پی کے مطابق")
                            : t("Standard Baseline", "معیاری بنیادی متن")}
                        </span>
                      </div>

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

                      {/* Display Template with {{placeholders}} for comparison */}
                      {questionDetail.standard_answer && (
                        <details style={{ marginTop: "8px", fontSize: "0.8rem", color: "#6c757d" }}>
                          <summary data-help="interview_bank.open" style={{ cursor: "pointer" }}>
                            {t("Show template with {{placeholders}}", "سانچہ برائے {{پلیس ہولڈرز}} دیکھیں")}
                          </summary>
                          <div style={{ marginTop: "4px", padding: "8px", background: "#f1f3f5", borderRadius: "4px", fontFamily: "monospace" }}>
                            {questionDetail.standard_answer}
                          </div>
                        </details>
                      )}
                    </div>

                    {/* Live Hospital Facts Injected into Answer (rule:58cce04636) */}
                    {questionDetail.facts && questionDetail.facts.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "0.82rem", fontWeight: "bold", color: "#495057" }}>
                          🏢 {t("Hospital Setting Facts Injected:", "ہسپتال کی ترتیبات سے شامل حقائق:")}
                        </label>
                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {questionDetail.facts.map((fact: InterviewFactOut) => (
                            <div
                              key={fact.key}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 10px",
                                background: fact.set ? "#e7f5ea" : "#fff3cd",
                                border: fact.set ? "1px solid #c3e6cb" : "1px solid #ffeeba",
                                borderRadius: "4px",
                                fontSize: "0.82rem",
                              }}
                            >
                              <div>
                                <strong>{fact.label}:</strong> {fact.value || `[${t("Not configured yet", "ابھی درج نہیں")}]`}
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                                {t("Set at:", "مقام:")} {fact.where}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {/* Follow-ups ("The surveyor may ask next") */}
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

                    {/* Pitfalls to Avoid */}
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

                    {/* What to Show the Surveyor */}
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

                    {/* Pedagogical Notice */}
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
                ) : (
                  /* Edit / Adapt Form (rule:e0f43b83c5) */
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {/* Concurrency Error Banner */}
                    {versionConflict && (
                      <div
                        style={{
                          background: "#f8d7da",
                          border: "1px solid #f5c2c7",
                          color: "#842029",
                          padding: "10px",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                        }}
                      >
                        ⚠️ {t("The record was changed by someone else; reload and try again.", "یہ ریکارڈ کسی اور نے تبدیل کر دیا ہے؛ دوبارہ لوڈ کر کے کوشش کریں۔")}
                        <button
                          type="button"
                          data-help="interview_bank.save"
                          onClick={() => setLocalRevision((r) => r + 1)}
                          style={{
                            display: "block",
                            marginTop: "6px",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "#842029",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          🔄 {t("Reload latest record", "تازہ ترین ریکارڈ لوڈ کریں")}
                        </button>
                      </div>
                    )}

                    {editError && (
                      <div style={{ color: "#dc3545", fontSize: "0.85rem" }}>❌ {editError}</div>
                    )}

                    {/* Editor Language Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                        🌐 {t("Adapting Language:", "ترمیم کی زبان:")}
                      </label>
                      <button
                        type="button"
                        data-help="interview_bank.language"
                        onClick={() => handleSwitchEditorLang("en")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: editLang === "en" ? "2px solid #0d6efd" : "1px solid #ced4da",
                          background: editLang === "en" ? "#e7f1ff" : "#fff",
                          fontWeight: editLang === "en" ? "bold" : "normal",
                          cursor: "pointer",
                        }}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        data-help="interview_bank.language"
                        onClick={() => handleSwitchEditorLang("ur")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: editLang === "ur" ? "2px solid #0d6efd" : "1px solid #ced4da",
                          background: editLang === "ur" ? "#e7f1ff" : "#fff",
                          fontWeight: editLang === "ur" ? "bold" : "normal",
                          cursor: "pointer",
                        }}
                      >
                        اردو
                      </button>
                    </div>

                    {/* Model Answer Input */}
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                        📝 {t("Model Answer in Hospital SOP's Words:", "ہسپتال کے ایس او پی کے مطابق ماڈل جواب:")}
                      </label>
                      <span style={{ fontSize: "0.75rem", color: "#6c757d", display: "block", marginBottom: "4px" }}>
                        {t(
                          "Keep {{placeholders}} like {{hospital_name}} to inject live records. 10 to 4000 characters.",
                          "زندہ ریکارڈ شامل کرنے کے لیے {{placeholders}} برقرار رکھیں۔ 10 سے 4000 حروف۔"
                        )}
                      </span>
                      <textarea
                        data-help="interview_bank.answer"
                        rows={6}
                        value={editModelAnswer}
                        onChange={(e) => setEditModelAnswer(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ced4da",
                          fontSize: "0.9rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* Key Points Checklist Editor */}
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                        ✅ {t("Key Points (Self-Check & Mock Interview Criteria):", "اہم نکات (چیک لسٹ معیار):")}
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "6px" }}>
                        {editKeyPoints.map((kp, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.85rem", width: "20px" }}>{idx + 1}.</span>
                            <input
                              type="text"
                              data-help="interview_bank.key_points"
                              value={kp}
                              onChange={(e) => {
                                const copy = [...editKeyPoints];
                                copy[idx] = e.target.value;
                                setEditKeyPoints(copy);
                              }}
                              style={{ flex: 1, padding: "4px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
                            />
                            <button
                              type="button"
                              data-help="interview_bank.key_points"
                              onClick={() => handleRemoveKeyPoint(idx)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid #dc3545",
                                background: "#fff",
                                color: "#dc3545",
                                cursor: "pointer",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {editKeyPoints.length < 12 && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            type="text"
                            data-help="interview_bank.key_points"
                            placeholder={t("Add a new key point...", "نیا اہم نکتہ لکھیں...")}
                            value={newKeyPointText}
                            onChange={(e) => setNewKeyPointText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddKeyPoint();
                              }
                            }}
                            style={{ flex: 1, padding: "6px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
                          />
                          <button
                            type="button"
                            data-help="interview_bank.key_points"
                            onClick={handleAddKeyPoint}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "4px",
                              border: "1px solid #198754",
                              background: "#198754",
                              color: "#fff",
                              cursor: "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            + {t("Add", "شامل کریں")}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Note & SOP Reference */}
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                        📌 {t("Note & Hospital SOP Reference:", "ایس او پی کا حوالہ اور تبصرہ:")}
                      </label>
                      <input
                        type="text"
                        data-help="interview_bank.note"
                        placeholder={t("e.g. Approved under Hospital SOP #IPC-04 by Medical Superintendent", "مثلاً منظور شدہ برائے ہسپتال ایس او پی نمبر 4")}
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Editor Action Buttons */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        data-help="interview_bank.save"
                        disabled={savingEdit}
                        onClick={handleSaveHospitalAnswer}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "4px",
                          border: "none",
                          background: "#0d6efd",
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        💾 {savingEdit ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Hospital Version", "ہسپتال کا نسخہ محفوظ کریں")}
                      </button>

                      <button
                        type="button"
                        data-help="interview_bank.reset"
                        disabled={savingEdit}
                        onClick={handleResetToStandard}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "4px",
                          border: "1px solid #6c757d",
                          background: "#fff",
                          color: "#6c757d",
                          cursor: "pointer",
                        }}
                      >
                        ↩️ {t("Back to the standard text", "معیاری متن پر واپس جائیں")}
                      </button>

                      <button
                        type="button"
                        data-help="interview_bank.close"
                        onClick={() => setIsEditing(false)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "4px",
                          border: "1px solid #ced4da",
                          background: "#f8f9fa",
                          cursor: "pointer",
                        }}
                      >
                        {t("Cancel", "منسوخ")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mark Not Applicable Modal (rule:bed4b7ed12) */}
      {showNotApplicableModal && (
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
              width: "480px",
              maxWidth: "90vw",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "1.15rem" }}>
              🚫 {t("Mark Question as Not Applicable Here", "سوال کو یہاں غیر متعلقہ قرار دیں")}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#6c757d", margin: "0 0 12px" }}>
              {t(
                "Marking a question as not applicable removes it from staff rehearsal decks, pocket guides, and readiness calculations. A statutory justification reason is required.",
                "کسی سوال کو غیر متعلقہ قرار دینے سے یہ عملے کی مشق، پاکٹ گائیڈز اور تیاری کے حساب سے خارج ہو جائے گا۔ قانونی جواز کی وجہ لکھنا لازمی ہے۔"
              )}
            </p>

            {applicableError && (
              <div style={{ color: "#dc3545", fontSize: "0.85rem", marginBottom: "8px" }}>❌ {applicableError}</div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                {t("Reason (e.g. No imaging department / No blood bank):", "وجہ (مثلاً کوئی امیجنگ یا بلڈ بینک شعبہ موجود نہیں):")}
              </label>
              <textarea
                data-help="interview_bank.applicable_reason"
                rows={3}
                placeholder={t("Explain why this indicator does not apply to this hospital...", "وضاحت کریں کہ یہ معیار اس ہسپتال پر کیوں لاگو نہیں ہوتا...")}
                value={notApplicableReason}
                onChange={(e) => setNotApplicableReason(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                data-help="interview_bank.close"
                onClick={() => setShowNotApplicableModal(false)}
                style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ced4da", background: "#f8f9fa", cursor: "pointer" }}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                data-help="interview_bank.applicable_toggle"
                disabled={savingApplicable}
                onClick={() => handleToggleApplicable(false)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "4px",
                  border: "none",
                  background: "#dc3545",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {savingApplicable ? t("Excluding...", "خارج ہو رہا ہے...") : t("Confirm Not Applicable", "غیر متعلقہ کی تصدیق کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pocket Guide Printout Modal */}
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
                🖨️ {t("Staff Pocket Guide Printout Preview", "عملہ پاکٹ گائیڈ پرنٹ پیش منظر")}
              </h3>
              <button
                type="button"
                data-help="interview_bank.close"
                onClick={() => setShowPocketGuideModal(false)}
                style={{ border: "none", background: "transparent", fontSize: "1.1rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px", background: "#f8f9fa", borderRadius: "4px" }}>
              {loadingGuide ? (
                <div style={{ textAlign: "center", padding: "20px" }}>{t("Loading pocket guide...", "لوڈ ہو رہا ہے...")}</div>
              ) : guideData ? (
                <div>
                  <div style={{ borderBottom: "1px solid #dee2e6", paddingBottom: "8px", marginBottom: "8px" }}>
                    <strong>{guideData.title}</strong>
                    <div style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                      {guideData.role_name} · {guideData.questions?.length} {t("Questions", "سوالات")}
                    </div>
                  </div>
                  {guideData.questions?.map((gq, idx) => (
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
                data-help="interview_bank.close"
                onClick={() => setShowPocketGuideModal(false)}
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
