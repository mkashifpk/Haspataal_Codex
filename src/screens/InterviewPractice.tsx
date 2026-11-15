import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import { call } from "../bridge";
import {
  myDeck,
  getQuestion,
  rehearse,
  myProgress,
  listQuestions,
  rolesMsdsInterviewPrep,
  pocketGuide,
  pocketGuidePayload,
  getMock,
  InterviewDeckOut,
  InterviewQuestionOut,
  InterviewQuestionDetailOut,
  InterviewProgressOut,
  InterviewRoleOut,
  MockInterviewOut,
} from "../generated/interview_practice";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

export function InterviewPractice({ revision, user, onOpenHelp, connected }: Props) {
  const [localRevision, setLocalRevision] = useState(0);
  const [activeLang, setActiveLang] = useState<"en" | "ur">("en");

  // Active question key & detail
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = useState<InterviewQuestionDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Variant index
  const [variantIndex, setVariantIndex] = useState<number>(0);

  // Flashcard reveal state
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [recordingRehearsal, setRecordingRehearsal] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Sub-views / Modals
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [selectedMockId, setSelectedMockId] = useState<number | null>(null);
  const [mockDetail, setMockDetail] = useState<MockInterviewOut | null>(null);
  const [loadingMock, setLoadingMock] = useState(false);

  // Browse filters
  const [browseRole, setBrowseRole] = useState<string>("ALL");
  const [browseArea, setBrowseArea] = useState<string>("ALL");
  const [browseSearch, setBrowseSearch] = useState<string>("");
  const [browseMineOnly, setBrowseMineOnly] = useState<boolean>(true);
  const [browseQuestionsList, setBrowseQuestionsList] = useState<InterviewQuestionOut[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  // Pocket guide export
  const [exportingPocketGuide, setExportingPocketGuide] = useState(false);
  const [pocketGuideNotice, setPocketGuideNotice] = useState<string | null>(null);

  // 1. Load Practice Deck
  const deckLoad = useLoad(
    () => myDeck({ lang: activeLang }),
    [revision, localRevision, activeLang]
  );
  const deck = deckLoad.data;

  // 2. Load Progress Summary
  const progressLoad = useLoad(
    () => myProgress({ lang: activeLang }),
    [revision, localRevision, activeLang]
  );
  const progress = progressLoad.data;

  // 3. Load Available Roles
  const rolesLoad = useLoad(() => rolesMsdsInterviewPrep(), [revision, localRevision]);
  const roles = rolesLoad.data || [];

  // When deck loads, if no question is selected, pick Question of the Day or first Due card
  useEffect(() => {
    if (!deck) return;
    if (!selectedQuestionKey) {
      if (deck.question_of_the_day) {
        setSelectedQuestionKey(deck.question_of_the_day.key);
      } else if (deck.due && deck.due.length > 0) {
        setSelectedQuestionKey(deck.due[0].key);
      }
    }
  }, [deck, selectedQuestionKey]);

  // Load Question Detail when selectedQuestionKey or activeLang changes
  useEffect(() => {
    if (!selectedQuestionKey) {
      setQuestionDetail(null);
      return;
    }
    let active = true;
    async function fetchDetail() {
      try {
        setLoadingDetail(true);
        setDetailError(null);
        setVariantIndex(0);
        setAnswerRevealed(false);
        const res = await getQuestion(selectedQuestionKey!, { lang: activeLang });
        if (active) {
          setQuestionDetail(res);
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : String(err);
          // rule:4a0279ed53: INTERVIEW_QUESTION_NOT_APPLICABLE: drop card and refresh deck
          if (msg.includes("INTERVIEW_QUESTION_NOT_APPLICABLE")) {
            setSelectedQuestionKey(null);
            setLocalRevision((r) => r + 1);
          } else {
            setDetailError(msg);
          }
        }
      } finally {
        if (active) setLoadingDetail(false);
      }
    }
    fetchDetail();
    return () => {
      active = false;
    };
  }, [selectedQuestionKey, activeLang, localRevision]);

  // Load Browse Questions
  useEffect(() => {
    if (!showBrowseModal) return;
    let active = true;
    async function fetchBrowse() {
      try {
        setLoadingBrowse(true);
        const res = await listQuestions({
          role: browseRole !== "ALL" ? browseRole : null,
          area: browseArea !== "ALL" ? browseArea : null,
          search: browseSearch.trim() || null,
          mine: browseMineOnly,
          lang: activeLang,
        });
        if (active) setBrowseQuestionsList(res);
      } catch (err) {
        console.error("Failed to load browse questions:", err);
      } finally {
        if (active) setLoadingBrowse(false);
      }
    }
    const timer = setTimeout(fetchBrowse, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showBrowseModal, browseRole, browseArea, browseSearch, browseMineOnly, activeLang, localRevision]);

  // Load Mock Interview Detail
  useEffect(() => {
    if (!selectedMockId) {
      setMockDetail(null);
      return;
    }
    let active = true;
    async function fetchMock() {
      try {
        setLoadingMock(true);
        const res = await getMock(selectedMockId!, { lang: activeLang });
        if (active) setMockDetail(res);
      } catch (err) {
        console.error("Failed to load mock interview detail:", err);
      } finally {
        if (active) setLoadingMock(false);
      }
    }
    fetchMock();
    return () => {
      active = false;
    };
  }, [selectedMockId, activeLang]);

  // Handle Rehearsal Rating (Knew / Partly / DidNotKnow)
  const handleRating = async (rating: "Knew" | "Partly" | "DidNotKnow") => {
    if (!selectedQuestionKey) return;
    try {
      setRecordingRehearsal(true);
      setFeedbackNotice(null);
      const res = await rehearse({
        question_key: selectedQuestionKey,
        rating,
      });

      setFeedbackNotice(
        rating === "Knew"
          ? t(`Recorded: Knew. Due again on ${res.next_due}`, `درج: یاد تھا۔ اگلی مشق: ${res.next_due}`)
          : rating === "Partly"
          ? t(`Recorded: Partly. Due again on ${res.next_due}`, `درج: جزوی یاد تھا۔ اگلی مشق: ${res.next_due}`)
          : t(`Recorded: Didn't know. Due again tomorrow (${res.next_due})`, `درج: یاد نہیں تھا۔ کل دوبارہ مشق (${res.next_due})`)
      );

      // Advance to next due card from deck
      if (deck?.due && deck.due.length > 0) {
        const remaining = deck.due.filter((d) => d.key !== selectedQuestionKey);
        if (remaining.length > 0) {
          setSelectedQuestionKey(remaining[0].key);
        } else {
          setLocalRevision((r) => r + 1);
        }
      } else {
        setLocalRevision((r) => r + 1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("INTERVIEW_QUESTION_NOT_APPLICABLE")) {
        setSelectedQuestionKey(null);
        setLocalRevision((r) => r + 1);
      } else {
        setDetailError(msg);
      }
    } finally {
      setRecordingRehearsal(false);
    }
  };

  // Export Pocket Guide (rule:e7e8d9750a)
  const handleDownloadPocketGuide = async (lang: "en" | "ur") => {
    try {
      setExportingPocketGuide(true);
      setPocketGuideNotice(null);
      if (lang === "en") {
        await call("clinical-pdf", {
          path: "/msds/interview-prep/pocket-guide/pdf",
          preview: false,
        });
        setPocketGuideNotice(t("English pocket guide PDF saved.", "انگریزی پاکٹ گائیڈ پی ڈی ایف محفوظ ہو گئی۔"));
      } else {
        // Urdu pocket guide payload for terminal print
        const payload = await pocketGuidePayload({ lang: "ur" });
        window.print();
        setPocketGuideNotice(
          payload
            ? t("Urdu pocket guide printed.", "اردو پاکٹ گائیڈ پرنٹ کی گئی۔")
            : t("Pocket guide prepared.", "پاکٹ گائیڈ تیار کی گئی۔")
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPocketGuideNotice(msg);
    } finally {
      setExportingPocketGuide(false);
    }
  };

  // Cycle question variant
  const handleNextVariant = () => {
    if (!questionDetail?.variants || questionDetail.variants.length === 0) return;
    setVariantIndex((prev) => (prev + 1) % (questionDetail.variants.length + 1));
  };

  const isUrdu = activeLang === "ur";
  const displayedQuestion =
    variantIndex === 0
      ? questionDetail?.question
      : questionDetail?.variants?.[variantIndex - 1] || questionDetail?.question;

  return (
    <section data-screen="interview_practice" className="interview-practice">
      {/* Top Header & Toolbar */}
      <header
        className="toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          borderBottom: "1px solid #e1e4e8",
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            {t("PHC inspection interview practice", "پنجاب ہیلتھ کیئر کمیشن معائنہ انٹرویو مشق")}
          </h1>

          {/* Quick Metrics Chips */}
          {progress && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  background: progress.ready_pct >= 80 ? "#d4edda" : "#fff3cd",
                  color: progress.ready_pct >= 80 ? "#155724" : "#856404",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "0.82rem",
                  fontWeight: "bold",
                }}
              >
                🎯 {progress.ready_pct}% {t("Ready", "تیار")}
              </span>
              <span
                style={{
                  background: "#e7f1ff",
                  color: "#004085",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "0.82rem",
                  fontWeight: "bold",
                }}
              >
                🔥 {progress.streak_days} {t("day streak", "دن مسلسل")}
              </span>
              {deck?.counts && (
                <span
                  style={{
                    background: deck.counts.due > 0 ? "#f8d7da" : "#e2e3e5",
                    color: deck.counts.due > 0 ? "#721c24" : "#383d41",
                    padding: "3px 8px",
                    borderRadius: "12px",
                    fontSize: "0.82rem",
                  }}
                >
                  ⏳ {deck.counts.due} {t("due today", "آج باقی")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Progress & Mocks Button */}
          <button
            type="button"
            className="secondary"
            data-help="interview_practice.progress"
            onClick={() => setShowProgressModal(true)}
          >
            📊 {t("My Progress & Mocks", "میری پیش رفت اور موک ٹیسٹ")}
          </button>

          {/* Browse All Questions */}
          <button
            type="button"
            className="secondary"
            data-help="interview_practice.browse"
            onClick={() => setShowBrowseModal(true)}
          >
            📚 {t("Browse Bank", "سوالات بینک")}
          </button>

          {/* Pocket Guide PDF Button */}
          <button
            type="button"
            className="secondary"
            data-help="interview_practice.pocket_guide"
            disabled={exportingPocketGuide || !connected}
            onClick={() => handleDownloadPocketGuide(activeLang)}
            title={t("Export pocket-sized role interview guide", "ملازم کی پاکٹ انٹرویو گائیڈ برآمد کریں")}
          >
            📄 {t("Pocket Guide", "پاکٹ گائیڈ")} ({activeLang === "ur" ? "اردو" : "PDF"})
          </button>

          {/* Refresh Deck */}
          <button
            type="button"
            className="secondary"
            data-help="interview_practice.filter"
            onClick={() => setLocalRevision((r) => r + 1)}
            disabled={!connected}
          >
            {t("Refresh", "تازہ کریں")}
          </button>

          {/* Help */}
          <button
            type="button"
            data-help="interview_practice.help"
            onClick={onOpenHelp}
          >
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Pocket Guide Export Notice */}
      {pocketGuideNotice && (
        <div
          style={{
            background: "#d4edda",
            color: "#155724",
            padding: "8px 14px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "0.85rem",
          }}
        >
          ℹ️ {pocketGuideNotice}
        </div>
      )}

      {/* Question of the Day Banner (rule:822b1b2a4c) */}
      {deck?.question_of_the_day && selectedQuestionKey !== deck.question_of_the_day.key && (
        <div
          className="card"
          style={{
            background: "#fff9db",
            border: "1px solid #ffe066",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#f08c00", textTransform: "uppercase" }}>
              🌟 {t("Question of the Day", "آج کا سوال")}
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#212529", marginTop: "2px" }}>
              {deck.question_of_the_day.question}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#868e96", marginTop: "4px" }}>
              {deck.question_of_the_day.area_name} • {t("MSDS Indicator", "ایم ایس ڈی ایس انڈیکیٹر")}{" "}
              {deck.question_of_the_day.indicators_in_category.join(", ")}
            </div>
          </div>
          <button
            type="button"
            data-help="interview_practice.practice"
            onClick={() => setSelectedQuestionKey(deck.question_of_the_day!.key)}
            style={{ fontWeight: "bold" }}
          >
            🎯 {t("Practise Question", "یہ سوال حل کریں")}
          </button>
        </div>
      )}

      {/* Main Flashcard Container */}
      <LoadState loading={deckLoad.loading} error={deckLoad.error} retry={deckLoad.reload} />
      {deckLoad.data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
            {loadingDetail ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}>
                ⏳ {t("Loading interview flashcard...", "انٹرویو کارڈ لوڈ ہو رہا ہے...")}
              </div>
            ) : detailError ? (
              <div style={{ background: "#f8d7da", color: "#721c24", padding: "16px", borderRadius: "6px" }}>
                ⚠️ {detailError}
              </div>
            ) : !questionDetail ? (
              <div
                className="card"
                style={{ textAlign: "center", padding: "40px", background: "#f8f9fa", borderRadius: "8px" }}
              >
                <h3>🎉 {t("All questions rehearsed for today!", "آج کے تمام سوالات مکمل ہو چکے ہیں!")}</h3>
                <p style={{ color: "#6c757d", fontSize: "0.9rem" }}>
                  {t(
                    "You are up to date. You can browse the question bank or review prior mock interviews.",
                    "آپ کی تیاری مکمل ہے۔ مزید سوالات دیکھنے کے لیے سوالات بینک کھولیں۔"
                  )}
                </p>
                <button
                  type="button"
                  data-help="interview_practice.browse"
                  onClick={() => setShowBrowseModal(true)}
                  style={{ marginTop: "10px" }}
                >
                  📚 {t("Browse Question Bank", "سوالات بینک کھولیں")}
                </button>
              </div>
            ) : (
              /* Active Flashcard Card */
              <div
                className="card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #ced4da",
                  borderRadius: "8px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  padding: "20px 24px",
                }}
              >
                {/* Card Meta Badges & Language Switch (rule:2c6098a537, rule:d62517f7ac) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    borderBottom: "1px solid #f1f3f5",
                    paddingBottom: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Area Badge */}
                    <span
                      style={{
                        background: "#e9ecef",
                        color: "#495057",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                      }}
                    >
                      {questionDetail.area} ({questionDetail.area_name})
                    </span>

                    {/* Indicator Badge */}
                    {questionDetail.indicators_in_category.length > 0 && (
                      <span
                        style={{
                          background: "#e7f1ff",
                          color: "#004085",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                        }}
                      >
                        MSDS {questionDetail.indicators_in_category.join(", ")}
                      </span>
                    )}

                    {/* PHC Type (Mandatory red / Operational yellow) */}
                    {questionDetail.phc_type && (
                      <span
                        style={{
                          background: questionDetail.phc_type === "Mandatory" ? "#dc3545" : "#ffc107",
                          color: questionDetail.phc_type === "Mandatory" ? "#ffffff" : "#212529",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                        }}
                      >
                        {questionDetail.phc_type}
                      </span>
                    )}

                    {/* Adapted to SOP badge */}
                    {questionDetail.adapted && (
                      <span
                        style={{
                          background: "#d1ecf1",
                          color: "#0c5460",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                        }}
                      >
                        ✓ {t("Adapted to our SOP", "ہسپتال ایس او پی کے مطابق")}
                      </span>
                    )}

                    {/* Draft translation badge */}
                    {questionDetail.text_status === "Draft" && (
                      <span
                        style={{
                          background: "#ffeeba",
                          color: "#856404",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontStyle: "italic",
                        }}
                      >
                        {t("Draft translation", "ترجمہ مسودہ")}
                      </span>
                    )}
                  </div>

                  {/* Language Switch Button (rule:d62517f7ac) */}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="secondary"
                      data-help="interview_practice.language"
                      onClick={() => setActiveLang((prev) => (prev === "en" ? "ur" : "en"))}
                      style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                    >
                      🌐 {activeLang === "en" ? "اردو میں دیکھیں" : "View in English"}
                    </button>
                  </div>
                </div>

                {/* Question Section */}
                <div
                  style={{
                    marginBottom: "20px",
                    direction: isUrdu ? "rtl" : "ltr",
                    fontFamily: isUrdu ? "'Noto Nastaliq Urdu', serif" : "inherit",
                    lineHeight: isUrdu ? 1.8 : 1.5,
                  }}
                >
                  <div style={{ fontSize: "0.82rem", color: "#6c757d", marginBottom: "4px" }}>
                    {t("The surveyor asks:", "معائنہ کار کا سوال:")}
                  </div>
                  <h2
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "1.25rem",
                      color: "#1c2833",
                      fontWeight: "700",
                    }}
                  >
                    {displayedQuestion}
                  </h2>

                  {/* English reference when in Urdu mode (rule:d62517f7ac) */}
                  {isUrdu && questionDetail.question_en && (
                    <div
                      style={{
                        direction: "ltr",
                        fontSize: "0.82rem",
                        color: "#6c757d",
                        fontStyle: "italic",
                        marginTop: "4px",
                      }}
                    >
                      English reference: "{questionDetail.question_en}"
                    </div>
                  )}

                  {/* Cycle Variants (rule:9433c2daf8) */}
                  {questionDetail.variants && questionDetail.variants.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <button
                        type="button"
                        className="secondary"
                        data-help="interview_practice.variant"
                        onClick={handleNextVariant}
                        style={{ fontSize: "0.78rem", padding: "2px 8px" }}
                      >
                        🔄 {t("Ask it differently", "دوسرے انداز میں پوچھیں")}{" "}
                        {variantIndex > 0 ? `(${variantIndex}/${questionDetail.variants.length})` : ""}
                      </button>
                    </div>
                  )}
                </div>

                {/* Reveal Answer / Action Zone */}
                {!answerRevealed ? (
                  <div
                    style={{
                      background: "#f8f9fa",
                      border: "1px dashed #ced4da",
                      borderRadius: "6px",
                      padding: "24px",
                      textAlign: "center",
                      marginTop: "16px",
                    }}
                  >
                    <p style={{ margin: "0 0 14px 0", fontSize: "0.9rem", color: "#495057" }}>
                      {t(
                        "Answer aloud or in your head first, then reveal the model answer and key points to verify.",
                        "پہلے خود بول کر یا ذہن میں جواب دیں، پھر ماڈل جواب اور اہم نکات دیکھنے کے لیے کلک کریں۔"
                      )}
                    </p>
                    <button
                      type="button"
                      data-help="interview_practice.reveal"
                      onClick={() => setAnswerRevealed(true)}
                      style={{ fontSize: "1rem", padding: "8px 24px", fontWeight: "bold" }}
                    >
                      👁️ {t("Show the Answer", "جواب ظاہر کریں")}
                    </button>
                  </div>
                ) : (
                  /* Revealed Model Answer & Key Points (rule:9433c2daf8, rule:31689f4042) */
                  <div
                    style={{
                      marginTop: "16px",
                      borderTop: "2px solid #e9ecef",
                      paddingTop: "16px",
                      direction: isUrdu ? "rtl" : "ltr",
                      fontFamily: isUrdu ? "'Noto Nastaliq Urdu', serif" : "inherit",
                    }}
                  >
                    {/* Model Answer Box */}
                    <div
                      style={{
                        background: "#f0f7ff",
                        borderLeft: `4px solid #0056b3`,
                        borderRight: isUrdu ? `4px solid #0056b3` : "none",
                        padding: "14px 18px",
                        borderRadius: "4px",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "0.85rem",
                          color: "#004085",
                          marginBottom: "6px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>📘 {t("Model Answer (What to say):", "ماڈل جواب (کیا کہنا چاہیے):")}</span>
                        <span style={{ fontSize: "0.75rem", color: "#6c757d", fontWeight: "normal" }}>
                          {questionDetail.answer_source === "Hospital"
                            ? t("Hospital SOP Answer", "ہسپتال کا طریقہ کار")
                            : t("Standard Bank Answer", "معیاری جواب")}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.95rem", lineHeight: isUrdu ? 1.8 : 1.5, color: "#212529" }}>
                        {questionDetail.model_answer}
                      </div>

                      {/* Notice: Gap to fix, not a line to learn (rule:31689f4042) */}
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "8px",
                          borderTop: "1px solid #d0e2ff",
                          fontSize: "0.8rem",
                          color: "#856404",
                          fontStyle: "italic",
                        }}
                      >
                        💡{" "}
                        {questionDetail.notice ||
                          t(
                            "If a key point is not true on your ward, tell your in-charge: it is a gap to fix, not a line to learn.",
                            "اگر کوئی بات آپ کے وارڈ پر درست نہیں ہے تو اپنے انچارج کو بتائیں: یہ درست کرنے کی کمی ہے، یاد کرنے کی لائن نہیں۔"
                          )}
                      </div>
                    </div>

                    {/* Key Points Checklist (rule:9433c2daf8) */}
                    {questionDetail.key_points && questionDetail.key_points.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#343a40", marginBottom: "6px" }}>
                          📋 {t("Key Points to Cover:", "لازمی اہم نکات:")}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: isUrdu ? "0" : "20px", paddingRight: isUrdu ? "20px" : "0" }}>
                          {questionDetail.key_points.map((pt, idx) => (
                            <li key={idx} style={{ fontSize: "0.88rem", marginBottom: "4px", color: "#495057" }}>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Follow-ups ("The surveyor may ask next") */}
                    {questionDetail.follow_ups && questionDetail.follow_ups.length > 0 && (
                      <div style={{ marginBottom: "14px", background: "#fdfdfe", border: "1px solid #e9ecef", borderRadius: "4px", padding: "10px 14px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#495057", marginBottom: "4px" }}>
                          🔍 {t("The surveyor may ask next:", "معائنہ کار آگے یہ پوچھ سکتا ہے:")}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: isUrdu ? "0" : "18px", paddingRight: isUrdu ? "18px" : "0", fontSize: "0.82rem", color: "#6c757d" }}>
                          {questionDetail.follow_ups.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pitfalls ("Avoid") */}
                    {questionDetail.pitfalls && questionDetail.pitfalls.length > 0 && (
                      <div style={{ marginBottom: "14px", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "4px", padding: "10px 14px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#c53030", marginBottom: "4px" }}>
                          ⚠️ {t("Avoid (Common Pitfalls):", "ان غلطیوں سے بچیں:")}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: isUrdu ? "0" : "18px", paddingRight: isUrdu ? "18px" : "0", fontSize: "0.82rem", color: "#742a2a" }}>
                          {questionDetail.pitfalls.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Be Ready to Show */}
                    {questionDetail.show_me && questionDetail.show_me.length > 0 && (
                      <div style={{ marginBottom: "16px", background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: "4px", padding: "10px 14px" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#22543d", marginBottom: "4px" }}>
                          📂 {t("Be ready to show:", "دکھانے کے لیے تیار رکھیں:")}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: isUrdu ? "0" : "18px", paddingRight: isUrdu ? "18px" : "0", fontSize: "0.82rem", color: "#276749" }}>
                          {questionDetail.show_me.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evidencing Documents Links */}
                    {questionDetail.documents && questionDetail.documents.length > 0 && (
                      <div style={{ marginBottom: "16px", fontSize: "0.82rem" }}>
                        <strong>{t("Evidencing Documents:", "معاون دستاویزات:")}</strong>{" "}
                        {questionDetail.documents.map((d) => (
                          <span key={d.key} style={{ marginRight: "8px" }}>
                            📄 {d.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rating Action Buttons (rule:9433c2daf8) */}
                    <div
                      style={{
                        background: "#f8f9fa",
                        border: "1px solid #dee2e6",
                        borderRadius: "6px",
                        padding: "16px",
                        marginTop: "20px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#343a40", marginBottom: "10px" }}>
                        {t("How well did you know this answer?", "آپ کو یہ جواب کتنا معلوم تھا؟")}
                      </div>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                        {/* Knew */}
                        <button
                          type="button"
                          data-help="interview_practice.rating"
                          onClick={() => handleRating("Knew")}
                          disabled={recordingRehearsal || !connected}
                          style={{
                            background: "#28a745",
                            color: "#ffffff",
                            padding: "8px 20px",
                            fontWeight: "bold",
                            borderRadius: "4px",
                          }}
                        >
                          ✅ {t("Knew", "معلوم تھا")}
                        </button>

                        {/* Partly */}
                        <button
                          type="button"
                          data-help="interview_practice.rating"
                          onClick={() => handleRating("Partly")}
                          disabled={recordingRehearsal || !connected}
                          style={{
                            background: "#ffc107",
                            color: "#212529",
                            padding: "8px 20px",
                            fontWeight: "bold",
                            borderRadius: "4px",
                          }}
                        >
                          ⚠️ {t("Partly", "جزوی معلوم تھا")}
                        </button>

                        {/* Didn't know */}
                        <button
                          type="button"
                          data-help="interview_practice.rating"
                          onClick={() => handleRating("DidNotKnow")}
                          disabled={recordingRehearsal || !connected}
                          style={{
                            background: "#dc3545",
                            color: "#ffffff",
                            padding: "8px 20px",
                            fontWeight: "bold",
                            borderRadius: "4px",
                          }}
                        >
                          ❌ {t("Didn't know", "معلوم نہیں تھا")}
                        </button>
                      </div>

                      {feedbackNotice && (
                        <div style={{ marginTop: "10px", fontSize: "0.85rem", color: "#004085" }}>
                          {feedbackNotice}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* Progress & Mocks Modal */}
      {showProgressModal && (
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
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                📊 {t("My Inspection Interview Progress", "میری انٹرویو پیش رفت")}
              </h2>
              <button
                type="button"
                className="secondary"
                data-help="interview_practice.progress"
                onClick={() => setShowProgressModal(false)}
                style={{ fontSize: "0.85rem", padding: "4px 8px" }}
              >
                ✕ {t("Close", "بند کریں")}
              </button>
            </div>

            {progress && (
              <>
                {/* Metric Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>{t("Readiness", "تیاری")}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: progress.ready_pct >= 80 ? "#28a745" : "#e65100" }}>
                      {progress.ready_pct}%
                    </div>
                  </div>
                  <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>{t("Streak", "تسلسل")}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#0056b3" }}>
                      🔥 {progress.streak_days} {t("days", "دن")}
                    </div>
                  </div>
                  <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>{t("Knew", "مکمل معلوم")}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#28a745" }}>
                      {progress.knew}
                    </div>
                  </div>
                  <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>{t("Partly", "جزوی")}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#ffc107" }}>
                      {progress.partly}
                    </div>
                  </div>
                  <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>{t("Didn't know", "معلوم نہیں")}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#dc3545" }}>
                      {progress.did_not_know}
                    </div>
                  </div>
                </div>

                {/* Chapter Progress Breakdown Table */}
                <h3 style={{ fontSize: "1rem", margin: "16px 0 8px 0" }}>
                  {t("Readiness by Chapter / Area:", "ابواب کے لحاظ سے تیاری:")}
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "16px" }}>
                  <thead>
                    <tr style={{ background: "#e9ecef", textAlign: "left" }}>
                      <th style={{ padding: "6px 10px" }}>{t("Area", "شعبہ")}</th>
                      <th style={{ padding: "6px 10px" }}>{t("Questions", "سوالات")}</th>
                      <th style={{ padding: "6px 10px" }}>{t("Knew", "یاد")}</th>
                      <th style={{ padding: "6px 10px" }}>{t("Partly", "جزوی")}</th>
                      <th style={{ padding: "6px 10px" }}>{t("Did Not Know", "نامعلوم")}</th>
                      <th style={{ padding: "6px 10px" }}>{t("Pending", "باقی")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.areas.map((a) => (
                      <tr key={a.area} style={{ borderBottom: "1px solid #f1f3f5" }}>
                        <td style={{ padding: "6px 10px" }}>
                          <strong>{a.area}</strong> — {a.area_name}
                        </td>
                        <td style={{ padding: "6px 10px" }}>{a.questions}</td>
                        <td style={{ padding: "6px 10px", color: "#28a745" }}>{a.knew}</td>
                        <td style={{ padding: "6px 10px", color: "#e65100" }}>{a.partly}</td>
                        <td style={{ padding: "6px 10px", color: "#dc3545" }}>{a.did_not_know}</td>
                        <td style={{ padding: "6px 10px", color: "#6c757d" }}>{a.not_rehearsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Last Mock Interview Card */}
                {progress.last_mock_interview && (
                  <div
                    style={{
                      background: "#f0f7ff",
                      border: "1px solid #cce5ff",
                      borderRadius: "6px",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#004085" }}>
                        📝 {t("Latest Mock Interview", "حالیہ موک انٹرویو")}: {progress.last_mock_interview.interview_number}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#495057", marginTop: "2px" }}>
                        {t("Examiner:", "معائنہ کار:")} {progress.last_mock_interview.examiner_name} •{" "}
                        {t("Score:", "اسکور:")}{" "}
                        <strong style={{ color: progress.last_mock_interview.score_pct >= 80 ? "#28a745" : "#e65100" }}>
                          {progress.last_mock_interview.score_pct}%
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      data-help="interview_practice.mock"
                      onClick={() => setSelectedMockId(progress.last_mock_interview!.mock_interview_id)}
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    >
                      👁️ {t("View Details", "تفصیلات دیکھیں")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Browse Question Bank Modal */}
      {showBrowseModal && (
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
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                📚 {t("Browse PHC Interview Question Bank", "سوالات بینک برائے معائنہ")}
              </h2>
              <button
                type="button"
                className="secondary"
                data-help="interview_practice.browse"
                onClick={() => setShowBrowseModal(false)}
                style={{ fontSize: "0.85rem", padding: "4px 8px" }}
              >
                ✕ {t("Close", "بند کریں")}
              </button>
            </div>

            {/* Filter Toolbar */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
              {/* Role filter */}
              <select
                data-help="interview_practice.filter"
                value={browseRole}
                onChange={(e) => setBrowseRole(e.target.value)}
                style={{ padding: "4px 8px", fontSize: "0.85rem", borderRadius: "4px" }}
              >
                <option value="ALL">{t("All Roles", "تمام شعبہ جات")}</option>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.name} ({r.questions})
                  </option>
                ))}
              </select>

              {/* Area filter */}
              <select
                data-help="interview_practice.filter"
                value={browseArea}
                onChange={(e) => setBrowseArea(e.target.value)}
                style={{ padding: "4px 8px", fontSize: "0.85rem", borderRadius: "4px" }}
              >
                <option value="ALL">{t("All Areas", "تمام ابواب")}</option>
                {["ROM", "AAC", "COP", "MOM", "PRE", "IPC", "CQI", "FMS", "HRM", "IMS"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              {/* Search text input */}
              <input
                type="text"
                data-help="interview_practice.filter"
                placeholder={t("Search questions...", "سوال تلاش کریں...")}
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                style={{ padding: "4px 8px", fontSize: "0.85rem", borderRadius: "4px", flex: "1 1 180px" }}
              />

              {/* Mine only checkbox */}
              <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="checkbox"
                  data-help="interview_practice.filter"
                  checked={browseMineOnly}
                  onChange={(e) => setBrowseMineOnly(e.target.checked)}
                />
                {t("My role only", "صرف میرے کردار کے سوالات")}
              </label>
            </div>

            {/* Questions Table */}
            {loadingBrowse ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#6c757d" }}>
                ⏳ {t("Loading questions...", "سوالات لوڈ ہو رہے ہیں...")}
              </div>
            ) : browseQuestionsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#6c757d" }}>
                {t("No questions matched the filters.", "کوئی سوال نہیں ملا۔")}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#e9ecef", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>{t("Indicator", "انڈیکیٹر")}</th>
                    <th style={{ padding: "6px 8px" }}>{t("Question", "سوال")}</th>
                    <th style={{ padding: "6px 8px" }}>{t("Rating", "درجہ")}</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("Action", "عمل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {browseQuestionsList.map((q) => (
                    <tr key={q.key} style={{ borderBottom: "1px solid #f1f3f5" }}>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: "bold", color: "#004085" }}>{q.area}</span>{" "}
                        <span style={{ color: "#6c757d" }}>({q.indicators_in_category.join(", ")})</span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <div>{q.question}</div>
                        {q.phc_type && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              background: q.phc_type === "Mandatory" ? "#dc3545" : "#ffc107",
                              color: q.phc_type === "Mandatory" ? "#ffffff" : "#212529",
                              padding: "1px 4px",
                              borderRadius: "3px",
                              marginRight: "4px",
                            }}
                          >
                            {q.phc_type}
                          </span>
                        )}
                        {q.adapted && (
                          <span style={{ fontSize: "0.72rem", color: "#0c5460" }}>
                            • {t("Adapted", "ترمیم شدہ")}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {q.my_rating === "Knew" ? (
                          <span style={{ color: "#28a745", fontWeight: "bold" }}>✅ Knew</span>
                        ) : q.my_rating === "Partly" ? (
                          <span style={{ color: "#e65100", fontWeight: "bold" }}>⚠️ Partly</span>
                        ) : q.my_rating === "DidNotKnow" ? (
                          <span style={{ color: "#dc3545", fontWeight: "bold" }}>❌ Didn't know</span>
                        ) : (
                          <span style={{ color: "#adb5bd" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          data-help="interview_practice.practice"
                          onClick={() => {
                            setSelectedQuestionKey(q.key);
                            setShowBrowseModal(false);
                          }}
                          style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                        >
                          🎯 {t("Practise", "مشق کریں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Mock Interview Detail Modal */}
      {selectedMockId && (
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
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              maxWidth: "750px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                📝 {t("Mock Interview Round:", "موک انٹرویو راؤنڈ:")} {mockDetail?.interview_number}
              </h3>
              <button
                type="button"
                className="secondary"
                data-help="interview_practice.mock"
                onClick={() => setSelectedMockId(null)}
                style={{ fontSize: "0.8rem", padding: "2px 6px" }}
              >
                ✕
              </button>
            </div>

            {loadingMock ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#6c757d" }}>
                ⏳ {t("Loading mock interview...", "موک انٹرویو لوڈ ہو رہا ہے...")}
              </div>
            ) : mockDetail ? (
              <div>
                <div style={{ fontSize: "0.85rem", color: "#495057", marginBottom: "10px" }}>
                  <strong>{t("Candidate:", "امیدوار:")}</strong> {mockDetail.employee_name} ({mockDetail.role_name || mockDetail.role_code}) •{" "}
                  <strong>{t("Examiner:", "ممتحن:")}</strong> {mockDetail.examiner_name} •{" "}
                  <strong>{t("Score:", "اسکور:")}</strong> {mockDetail.score_pct}% ({mockDetail.met} {t("met", "کامیاب")}, {mockDetail.partly_met} {t("partly", "جزوی")}, {mockDetail.not_met} {t("not met", "ناکام")})
                </div>

                <div style={{ borderTop: "1px solid #dee2e6", paddingTop: "10px" }}>
                  {mockDetail.items?.map((item) => (
                    <div key={item.item_id || item.question_key} style={{ padding: "8px 0", borderBottom: "1px solid #f1f3f5", fontSize: "0.82rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>{item.question}</strong>
                        <span
                          style={{
                            fontWeight: "bold",
                            color: item.result === "Met" ? "#28a745" : item.result === "PartlyMet" ? "#e65100" : "#dc3545",
                          }}
                        >
                          {item.result}
                        </span>
                      </div>
                      {item.note && (
                        <div style={{ color: "#6c757d", fontStyle: "italic", marginTop: "2px" }}>
                          Notes: {item.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
