import React, { useState, useEffect } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { LoadState, useLoad } from "../components";
import {
  staffMsdsInterviewPrep,
  plan,
  recordMock,
  listMocks,
  getMock,
  rolesMsdsInterviewPrep,
  getQuestion,
  listActions,
  departments,
  InterviewStaffOut,
  MockInterviewPlanOut,
  MockPlanQuestionOut,
  InterviewRoleOut,
  MockInterviewSummaryOut,
  MockInterviewOut,
  InterviewQuestionDetailOut,
  DepartmentOut,
  MockInterviewItemIn,
  QualityActionIn,
} from "../generated/mock_interviews";
import { listQuestions, InterviewQuestionOut } from "../generated/interview_practice";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

interface ActiveItemState {
  question_key: string;
  question: string;
  framework: "I" | "Clinic" | "IIC";
  indicator: number;
  phc_type: "Mandatory" | "Operational" | null;
  grade: "Red" | "Yellow";
  reason: string;
  result: "Met" | "PartlyMet" | "NotMet" | null;
  note: string;
  action: QualityActionIn | null;
}

export function MockInterviews({ revision, user, onOpenHelp, connected }: Props) {
  const [localRevision, setLocalRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<"conduct" | "history">("conduct");
  const [activeLang, setActiveLang] = useState<"en" | "ur">("en");

  // Permissions check
  const canConduct = user.permissions.includes("msds.interview.conduct");

  // Selection state for planning
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>("");

  // Plan loading & state
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<MockInterviewPlanOut | null>(null);

  // Active interview in-progress state
  const [inProgressItems, setInProgressItems] = useState<ActiveItemState[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [examSessionStarted, setExamSessionStarted] = useState(false);
  const [revealModelAnswer, setRevealModelAnswer] = useState(false);
  const [overallNote, setOverallNote] = useState<string>("");

  // Question detail for active question (key points, follow-ups, pitfalls)
  const [activeQuestionDetail, setActiveQuestionDetail] = useState<InterviewQuestionDetailOut | null>(null);
  const [loadingQuestionDetail, setLoadingQuestionDetail] = useState(false);

  // Swap question modal
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [availableSwapQuestions, setAvailableSwapQuestions] = useState<InterviewQuestionOut[]>([]);
  const [loadingSwapQuestions, setLoadingSwapQuestions] = useState(false);

  // Corrective action modal state
  const [editingActionForIndex, setEditingActionForIndex] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"Corrective" | "Preventive">("Corrective");
  const [actionDesc, setActionDesc] = useState<string>("");
  const [actionOwnerId, setActionOwnerId] = useState<number | null>(null);
  const [actionDeptId, setActionDeptId] = useState<number | null>(null);
  const [actionDueDate, setActionDueDate] = useState<string>("");

  // Final submission state
  const [submittingSession, setSubmittingSession] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSessionResult, setCompletedSessionResult] = useState<MockInterviewOut | null>(null);

  // History tab state
  const [historyRoleFilter, setHistoryRoleFilter] = useState<string>("ALL");
  const [historyStaffFilter, setHistoryStaffFilter] = useState<string>("ALL");
  const [selectedDetailMockId, setSelectedDetailMockId] = useState<number | null>(null);
  const [detailMock, setDetailMock] = useState<MockInterviewOut | null>(null);
  const [loadingDetailMock, setLoadingDetailMock] = useState(false);

  // 1. Load Staff List
  const staffLoad = useLoad(
    () => (canConduct ? staffMsdsInterviewPrep() : Promise.resolve([])),
    [revision, localRevision, canConduct]
  );
  const staffList = staffLoad.data || [];

  // 2. Load Roles List
  const rolesLoad = useLoad(() => rolesMsdsInterviewPrep(), [revision, localRevision]);
  const rolesList = rolesLoad.data || [];

  // 3. Load Departments List
  const deptLoad = useLoad(() => departments(), [revision, localRevision]);
  const deptsList = deptLoad.data || [];

  // 4. Load History Mocks
  const mocksLoad = useLoad(
    () =>
      listMocks({
        role: historyRoleFilter !== "ALL" ? historyRoleFilter : null,
        employee_id: historyStaffFilter !== "ALL" ? parseInt(historyStaffFilter, 10) : null,
      }),
    [revision, localRevision, historyRoleFilter, historyStaffFilter]
  );
  const mocksHistory = mocksLoad.data || [];

  // Auto-select first staff member who is not me when staffList loads
  useEffect(() => {
    if (!selectedStaffId && staffList.length > 0) {
      const eligible = staffList.find((s) => !s.is_me);
      if (eligible) {
        setSelectedStaffId(eligible.employee_id);
        if (eligible.roles && eligible.roles.length > 0) {
          setSelectedRoleCode(eligible.roles[0]);
        }
      }
    }
  }, [staffList, selectedStaffId]);

  // When staff changes, update available roles if necessary
  const handleStaffChange = (empId: number) => {
    setSelectedStaffId(empId);
    setPlanData(null);
    setExamSessionStarted(false);
    setCompletedSessionResult(null);
    const selected = staffList.find((s) => s.employee_id === empId);
    if (selected && selected.roles && selected.roles.length > 0) {
      if (!selected.roles.includes(selectedRoleCode)) {
        setSelectedRoleCode(selected.roles[0]);
      }
    }
  };

  // Generate Plan (rule:cf99be4eab)
  const handleGeneratePlan = async () => {
    if (!selectedStaffId || !selectedRoleCode) return;
    try {
      setLoadingPlan(true);
      setPlanError(null);
      setCompletedSessionResult(null);
      setExamSessionStarted(false);

      const res = await plan({
        employee_id: selectedStaffId,
        role: selectedRoleCode,
        count: 6,
        lang: activeLang,
      });

      setPlanData(res);
      setInProgressItems(
        res.questions.map((q) => ({
          question_key: q.key,
          question: q.question,
          framework: q.framework,
          indicator: q.indicator,
          phc_type: q.phc_type,
          grade: q.grade,
          reason: q.reason,
          result: null,
          note: "",
          action: null,
        }))
      );
      setActiveItemIndex(0);
    } catch (err: unknown) {
      setPlanError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPlan(false);
    }
  };

  // Load question detail whenever active question changes
  useEffect(() => {
    if (!examSessionStarted || inProgressItems.length === 0) return;
    const currentKey = inProgressItems[activeItemIndex]?.question_key;
    if (!currentKey) return;

    let active = true;
    async function loadDetail() {
      try {
        setLoadingQuestionDetail(true);
        setRevealModelAnswer(false);
        const detail = await getQuestion(currentKey, { lang: activeLang });
        if (active) setActiveQuestionDetail(detail);
      } catch (err) {
        console.error("Failed to load question detail:", err);
      } finally {
        if (active) setLoadingQuestionDetail(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [examSessionStarted, activeItemIndex, inProgressItems, activeLang]);

  // Open Swap Question Modal (rule:cf99be4eab)
  const handleOpenSwap = async (idx: number) => {
    setSwappingIndex(idx);
    try {
      setLoadingSwapQuestions(true);
      const questions = await listQuestions({
        role: selectedRoleCode || null,
        lang: activeLang,
      });
      // Filter out questions already in plan
      const existingKeys = new Set(inProgressItems.map((item) => item.question_key));
      setAvailableSwapQuestions(questions.filter((q) => !existingKeys.has(q.key)));
    } catch (err) {
      console.error("Failed to load swap questions:", err);
    } finally {
      setLoadingSwapQuestions(false);
    }
  };

  // Confirm Swap
  const handleConfirmSwap = (replacement: InterviewQuestionOut) => {
    if (swappingIndex === null) return;
    setInProgressItems((prev) => {
      const copy = [...prev];
      copy[swappingIndex] = {
        question_key: replacement.key,
        question: replacement.question,
        framework: replacement.framework,
        indicator: replacement.indicator,
        phc_type: replacement.phc_type,
        grade: replacement.grade,
        reason: t("Swapped by examiner", "جائزہ کار نے تبدیل کیا"),
        result: null,
        note: "",
        action: null,
      };
      return copy;
    });
    setSwappingIndex(null);
  };

  // Rate current question (rule:9d0ad34c4c)
  const handleSetResult = (res: "Met" | "PartlyMet" | "NotMet") => {
    setInProgressItems((prev) => {
      const copy = [...prev];
      copy[activeItemIndex].result = res;
      return copy;
    });
  };

  const handleSetNote = (val: string) => {
    setInProgressItems((prev) => {
      const copy = [...prev];
      copy[activeItemIndex].note = val;
      return copy;
    });
  };

  // Save corrective action for current question (rule:9d0ad34c4c)
  const handleSaveAction = () => {
    if (editingActionForIndex === null) return;
    if (!actionDesc.trim() || !actionOwnerId || !actionDueDate) return;

    const actionData: QualityActionIn = {
      action_type: actionType,
      description: actionDesc.trim(),
      owner_user_id: actionOwnerId,
      due_date: actionDueDate,
      department_id: actionDeptId || undefined,
    };

    setInProgressItems((prev) => {
      const copy = [...prev];
      copy[editingActionForIndex].action = actionData;
      return copy;
    });

    setEditingActionForIndex(null);
  };

  const handleRemoveAction = (idx: number) => {
    setInProgressItems((prev) => {
      const copy = [...prev];
      copy[idx].action = null;
      return copy;
    });
  };

  // Final Submit Mock Interview (rule:47e19cee10)
  const handleFinalizeMock = async () => {
    if (!selectedStaffId || !selectedRoleCode) return;

    // Validation check: all items must have a rating
    const unrated = inProgressItems.findIndex((item) => item.result === null);
    if (unrated !== -1) {
      setSubmitError(
        t(
          `Please rate Question ${unrated + 1} before saving.`,
          `براہ کرم محفوظ کرنے سے پہلے سوال ${unrated + 1} کا نتیجہ درج کریں۔`
        )
      );
      setActiveItemIndex(unrated);
      return;
    }

    // Validation check: PartlyMet and NotMet require a note
    const missingNote = inProgressItems.findIndex(
      (item) => (item.result === "PartlyMet" || item.result === "NotMet") && !item.note.trim()
    );
    if (missingNote !== -1) {
      setSubmitError(
        t(
          `A note is required for Question ${missingNote + 1} (${inProgressItems[missingNote].result}) explaining the gap in practice.`,
          `سوال ${missingNote + 1} پر وضاحت کا نوٹ درج کرنا لازمی ہے۔`
        )
      );
      setActiveItemIndex(missingNote);
      return;
    }

    try {
      setSubmittingSession(true);
      setSubmitError(null);

      const itemsPayload: MockInterviewItemIn[] = inProgressItems.map((item) => ({
        question_key: item.question_key,
        result: item.result!,
        note: item.note.trim() || null,
        action: item.action || null,
      }));

      const res = await recordMock({
        employee_id: selectedStaffId,
        role: selectedRoleCode,
        note: overallNote.trim() || null,
        items: itemsPayload,
      });

      setCompletedSessionResult(res);
      setExamSessionStarted(false);
      setPlanData(null);
      setLocalRevision((r) => r + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("MOCK_INTERVIEW_SELF")) {
        setSubmitError(t("You cannot examine yourself in a mock interview.", "آپ اپنا فرضی انٹرویو خود نہیں لے سکتے۔"));
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmittingSession(false);
    }
  };

  // Load Mock Detail for history modal
  useEffect(() => {
    if (!selectedDetailMockId) {
      setDetailMock(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      try {
        setLoadingDetailMock(true);
        const res = await getMock(selectedDetailMockId!, { lang: activeLang });
        if (active) setDetailMock(res);
      } catch (err) {
        console.error("Failed to load mock detail:", err);
      } finally {
        if (active) setLoadingDetailMock(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedDetailMockId, activeLang]);

  // Selected staff object
  const currentStaffObj = staffList.find((s) => s.employee_id === selectedStaffId);

  // Live scoring calculation: Met=1, PartlyMet=0.5, NotMet=0
  const ratedItems = inProgressItems.filter((i) => i.result !== null);
  const metCount = inProgressItems.filter((i) => i.result === "Met").length;
  const partlyCount = inProgressItems.filter((i) => i.result === "PartlyMet").length;
  const notMetCount = inProgressItems.filter((i) => i.result === "NotMet").length;
  const liveScorePct =
    inProgressItems.length > 0
      ? Math.round(((metCount * 1.0 + partlyCount * 0.5) / inProgressItems.length) * 100)
      : 0;

  return (
    <section data-screen="mock_interviews" className="mock-interviews">
      {/* Header & Main Navigation Bar */}
      <header
        className="toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #e1e4e8",
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>
            {t("Mock PHC interviews", "فرضی معائنہ انٹرویوز")}
          </h1>

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              data-help="mock_interviews.tab"
              onClick={() => setActiveTab("conduct")}
              className={`btn ${activeTab === "conduct" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "6px 12px", fontSize: "0.85rem", fontWeight: activeTab === "conduct" ? "bold" : "normal" }}
            >
              🎯 {t("Conduct interview", "انٹرویو منعقد کریں")}
            </button>
            <button
              type="button"
              data-help="mock_interviews.history"
              onClick={() => setActiveTab("history")}
              className={`btn ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "6px 12px", fontSize: "0.85rem", fontWeight: activeTab === "history" ? "bold" : "normal" }}
            >
              📋 {t("Past sessions", "سابقہ سیشنز")}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Language Switch */}
          <button
            type="button"
            data-help="mock_interviews.language"
            onClick={() => setActiveLang((l) => (l === "en" ? "ur" : "en"))}
            className="btn btn-secondary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            🌐 {activeLang === "en" ? "اردو" : "English"}
          </button>

          {/* Help Button */}
          <button
            type="button"
            data-help="mock_interviews.help"
            onClick={onOpenHelp}
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
          >
            ❓ {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* Permission Warning if not conduct-permitted */}
      {!canConduct && (
        <div
          className="card"
          style={{
            background: "#fff3cd",
            color: "#856404",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #ffeeba",
            borderRadius: "6px",
          }}
        >
          ℹ️{" "}
          {t(
            "You have view access for past mock interview rounds. Conducting mock interviews requires the msds.interview.conduct permission.",
            "آپ کے پاس سابقہ فرضی انٹرویوز کے جائزے کی اجازت ہے۔ نئے انٹرویو کے انعقاد کے لیے msds.interview.conduct اجازت درکار ہے۔"
          )}
        </div>
      )}

      {/* TAB 1: CONDUCT INTERVIEW */}
      {activeTab === "conduct" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          {/* Successful Completion Banner */}
          {completedSessionResult && (
            <div
              className="card"
              style={{
                background: "#d4edda",
                border: "1px solid #c3e6cb",
                color: "#155724",
                padding: "20px",
                borderRadius: "8px",
              }}
            >
              <h3 style={{ margin: "0 0 8px 0" }}>
                🎉 {t("Mock interview saved successfully!", "فرضی انٹرویو کامیابی سے محفوظ ہو گیا!")}
              </h3>
              <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>
                <strong>{completedSessionResult.interview_number}</strong> —{" "}
                {completedSessionResult.employee_name} ({completedSessionResult.role_name || completedSessionResult.role_code})
              </p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.9rem", marginBottom: "12px" }}>
                <span>
                  <strong>{t("Final Score:", "حتمی اسکور:")}</strong> {completedSessionResult.score_pct}%
                </span>
                <span>
                  <strong>{t("Met:", "کامیاب:")}</strong> {completedSessionResult.met}
                </span>
                <span>
                  <strong>{t("Partly Met:", "جزوی:")}</strong> {completedSessionResult.partly_met}
                </span>
                <span>
                  <strong>{t("Not Met:", "ناکام:")}</strong> {completedSessionResult.not_met}
                </span>
              </div>

              {completedSessionResult.actions && completedSessionResult.actions.length > 0 && (
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid #c3e6cb" }}>
                  <strong style={{ display: "block", marginBottom: "6px" }}>
                    📝 {t("Corrective actions registered:", "اصلاحی اقدامات درج کیے گئے:")}
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {completedSessionResult.actions.map((act) => (
                      <li key={act.action_id}>
                        <strong>{act.action_number}</strong> ({act.action_type}): {act.description} —{" "}
                        <span style={{ color: "#6c757d" }}>
                          {act.owner_name} ({t("due", "میعاد")}: {act.due_date})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  data-help="mock_interviews.plan"
                  onClick={() => setCompletedSessionResult(null)}
                  className="btn btn-primary"
                  style={{ padding: "6px 16px" }}
                >
                  ➕ {t("Conduct another mock interview", "ایک اور انٹرویو منعقد کریں")}
                </button>
              </div>
            </div>
          )}

          {/* Setup / Planning Card (when session is not active) */}
          {!examSessionStarted && !completedSessionResult && canConduct && (
            <div className="card" style={{ background: "#f8f9fa", border: "1px solid #dee2e6", padding: "20px", borderRadius: "8px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.15rem" }}>
                🎯 {t("Plan a mock PHC inspection interview", "فرضی معائنہ انٹرویو کی منصوبہ بندی")}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                {/* 1. Staff Picker (rule:cf99be4eab) */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "0.88rem" }}>
                    👤 {t("Member of staff:", "عملے کا رکن:")}
                  </label>
                  <select
                    data-help="mock_interviews.staff"
                    value={selectedStaffId || ""}
                    onChange={(e) => handleStaffChange(parseInt(e.target.value, 10))}
                    className="form-control"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
                  >
                    {staffList.map((st) => (
                      <option
                        key={st.employee_id}
                        value={st.employee_id}
                        disabled={st.is_me}
                        style={{ color: st.is_me ? "#6c757d" : "#000" }}
                      >
                        {st.full_name} ({st.emp_number}) — {st.designation} {st.is_me ? t("(You - self examination forbidden)", "(آپ - خود جائزہ ممنوع)") : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Role Picker */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "0.88rem" }}>
                    💼 {t("Role examined:", "متعلقہ کردار:")}
                  </label>
                  <select
                    data-help="mock_interviews.role"
                    value={selectedRoleCode}
                    onChange={(e) => {
                      setSelectedRoleCode(e.target.value);
                      setPlanData(null);
                    }}
                    className="form-control"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
                  >
                    {currentStaffObj?.roles && currentStaffObj.roles.length > 0 ? (
                      currentStaffObj.roles.map((r) => {
                        const roleObj = rolesList.find((ro) => ro.role === r);
                        return (
                          <option key={r} value={r}>
                            {roleObj?.name || r} ({r})
                          </option>
                        );
                      })
                    ) : (
                      rolesList.map((ro) => (
                        <option key={ro.role} value={ro.role}>
                          {ro.name} ({ro.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Action Button: Generate 6-Question Plan */}
              <div>
                <button
                  type="button"
                  data-help="mock_interviews.plan"
                  onClick={handleGeneratePlan}
                  disabled={loadingPlan || !selectedStaffId || !selectedRoleCode}
                  className="btn btn-primary"
                  style={{ padding: "8px 20px", fontWeight: "bold" }}
                >
                  {loadingPlan ? t("Generating balanced plan...", "پلان تیار ہو رہا ہے...") : t("Plan 6-question interview", "6 سوالات کا پلان بنائیں")}
                </button>
              </div>

              {planError && (
                <div style={{ marginTop: "12px", background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px" }}>
                  ⚠️ {planError}
                </div>
              )}
            </div>
          )}

          {/* Planned Questions List (Review & Swap before starting) */}
          {planData && !examSessionStarted && (
            <div className="card" style={{ background: "#ffffff", border: "1px solid #ced4da", padding: "20px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>
                    📋 {t("Planned 6-question mock interview", "منصوبہ بندی شدہ 6 سوالات")}
                  </h3>
                  <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                    {planData.employee.full_name} ({planData.employee.emp_number}) — {planData.role_name}
                  </span>
                </div>

                <button
                  type="button"
                  data-help="mock_interviews.start"
                  onClick={() => setExamSessionStarted(true)}
                  className="btn btn-primary"
                  style={{ padding: "8px 20px", fontWeight: "bold" }}
                >
                  🚀 {t("Start mock interview now", "انٹرویو سیشن شروع کریں")}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                {inProgressItems.map((item, idx) => (
                  <div
                    key={item.question_key}
                    style={{
                      border: "1px solid #e9ecef",
                      borderRadius: "6px",
                      padding: "12px",
                      background: "#fdfdfe",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ flex: "1 1 500px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "bold", color: "#495057" }}>#{idx + 1}</span>
                        <span
                          style={{
                            background: item.phc_type === "Mandatory" ? "#dc3545" : "#ffc107",
                            color: item.phc_type === "Mandatory" ? "#ffffff" : "#212529",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {item.phc_type || "MSDS"}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>{item.question_key}</span>
                        <span
                          style={{
                            background: "#e8f4fd",
                            color: "#0c5460",
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          💡 {item.reason}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: "500" }}>{item.question}</p>
                    </div>

                    <button
                      type="button"
                      data-help="mock_interviews.swap"
                      onClick={() => handleOpenSwap(idx)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                    >
                      🔄 {t("Swap question", "سوال تبدیل کریں")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE INTERVIEW IN-PROGRESS WORKFLOW (rule:5df569b294) */}
          {examSessionStarted && inProgressItems.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", maxWidth: "920px", margin: "0 auto" }}>
              {/* Top Progress & Scoring Banner */}
              <div
                className="card"
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #ced4da",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "1rem" }}>
                    {planData?.employee.full_name} ({planData?.role_name})
                  </strong>
                  <span style={{ display: "block", fontSize: "0.82rem", color: "#6c757d" }}>
                    {t(`Question ${activeItemIndex + 1} of ${inProgressItems.length}`, `سوال ${activeItemIndex + 1} از ${inProgressItems.length}`)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.9rem" }}>
                    <strong>{t("Live score:", "لائیو اسکور:")}</strong> {liveScorePct}%
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#28a745" }}>✓ {metCount} {t("Met", "کامیاب")}</span>
                  <span style={{ fontSize: "0.85rem", color: "#e65100" }}>~ {partlyCount} {t("Partly", "جزوی")}</span>
                  <span style={{ fontSize: "0.85rem", color: "#dc3545" }}>✗ {notMetCount} {t("Not Met", "ناکام")}</span>
                </div>
              </div>

              {/* Active Question Interactive Card */}
              {(() => {
                const cur = inProgressItems[activeItemIndex];
                if (!cur) return null;

                return (
                  <div
                    className="card"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #ced4da",
                      padding: "24px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Header: Badges & Indicator */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: cur.phc_type === "Mandatory" ? "#dc3545" : "#ffc107",
                          color: cur.phc_type === "Mandatory" ? "#ffffff" : "#212529",
                          fontWeight: "bold",
                          fontSize: "0.78rem",
                          padding: "3px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {cur.phc_type || "MSDS"}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: "#6c757d", fontWeight: "bold" }}>
                        Indicator #{cur.indicator} ({cur.framework}) — {cur.question_key}
                      </span>
                      <span style={{ fontSize: "0.78rem", background: "#e8f4fd", color: "#004085", padding: "2px 8px", borderRadius: "4px" }}>
                        💡 {cur.reason}
                      </span>
                    </div>

                    {/* Question Text */}
                    <h2 style={{ fontSize: "1.25rem", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                      {cur.question}
                    </h2>

                    {/* Key Points Checklist (Examiner uses to listen for compliance) */}
                    {activeQuestionDetail?.key_points && (
                      <div
                        style={{
                          background: "#fbfcfe",
                          border: "1px solid #e3e8ee",
                          padding: "14px",
                          borderRadius: "6px",
                          marginBottom: "16px",
                        }}
                      >
                        <strong style={{ display: "block", marginBottom: "8px", color: "#2d3748", fontSize: "0.88rem" }}>
                          ✓ {t("Key points surveyor expects to hear:", "اہم نکات جو معائنہ کار سننا چاہتا ہے:")}
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.88rem" }}>
                          {activeQuestionDetail.key_points.map((pt, pIdx) => (
                            <li key={pIdx} style={{ marginBottom: "4px" }}>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Hidden Model Answer Toggle (rule:5df569b294) */}
                    <div style={{ marginBottom: "20px" }}>
                      <button
                        type="button"
                        data-help="mock_interviews.reveal"
                        onClick={() => setRevealModelAnswer((r) => !r)}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                      >
                        {revealModelAnswer ? "🙈 " + t("Hide model answer", "ماڈل جواب چھپائیں") : "👁️ " + t("Reveal model answer (Examiner only)", "ماڈل جواب دیکھیں (صرف ممتحن کے لیے)")}
                      </button>

                      {revealModelAnswer && activeQuestionDetail && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "16px",
                            background: "#f0f7ff",
                            border: "1px solid #cce5ff",
                            borderRadius: "6px",
                            fontSize: "0.92rem",
                          }}
                        >
                          <strong style={{ display: "block", color: "#004085", marginBottom: "6px" }}>
                            {t("Statutory Model Answer:", "قانونی ماڈل جواب:")}
                          </strong>
                          <p style={{ margin: "0 0 10px 0" }}>{activeQuestionDetail.model_answer}</p>

                          {activeQuestionDetail.follow_ups && activeQuestionDetail.follow_ups.length > 0 && (
                            <div style={{ marginTop: "10px", fontSize: "0.84rem" }}>
                              <strong>❓ {t("The surveyor may ask next:", "معائنہ کار مزید پوچھ سکتا ہے:")}</strong>
                              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                                {activeQuestionDetail.follow_ups.map((f, fi) => (
                                  <li key={fi}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {activeQuestionDetail.pitfalls && activeQuestionDetail.pitfalls.length > 0 && (
                            <div style={{ marginTop: "8px", fontSize: "0.84rem", color: "#721c24" }}>
                              <strong>⚠️ {t("Avoid:", "احتیاط:")}</strong>
                              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                                {activeQuestionDetail.pitfalls.map((p, pi) => (
                                  <li key={pi}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scoring Evaluation (rule:9d0ad34c4c) */}
                    <div
                      style={{
                        borderTop: "1px solid #dee2e6",
                        paddingTop: "16px",
                        marginBottom: "16px",
                      }}
                    >
                      <label style={{ display: "block", fontWeight: "bold", marginBottom: "10px", fontSize: "0.9rem" }}>
                        ⚖️ {t("Evaluate staff response:", "عملے کے جواب کا جائزہ:")}
                      </label>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                        <button
                          type="button"
                          data-help="mock_interviews.rate"
                          onClick={() => handleSetResult("Met")}
                          className={`btn ${cur.result === "Met" ? "btn-primary" : "btn-secondary"}`}
                          style={{
                            flex: "1 1 120px",
                            padding: "10px",
                            fontWeight: "bold",
                            background: cur.result === "Met" ? "#28a745" : undefined,
                            borderColor: cur.result === "Met" ? "#28a745" : undefined,
                          }}
                        >
                          ✓ {t("Met", "کامیاب")}
                        </button>
                        <button
                          type="button"
                          data-help="mock_interviews.rate"
                          onClick={() => handleSetResult("PartlyMet")}
                          className={`btn ${cur.result === "PartlyMet" ? "btn-primary" : "btn-secondary"}`}
                          style={{
                            flex: "1 1 120px",
                            padding: "10px",
                            fontWeight: "bold",
                            background: cur.result === "PartlyMet" ? "#fd7e14" : undefined,
                            borderColor: cur.result === "PartlyMet" ? "#fd7e14" : undefined,
                          }}
                        >
                          ~ {t("Partly Met", "جزوی کامیاب")}
                        </button>
                        <button
                          type="button"
                          data-help="mock_interviews.rate"
                          onClick={() => handleSetResult("NotMet")}
                          className={`btn ${cur.result === "NotMet" ? "btn-primary" : "btn-secondary"}`}
                          style={{
                            flex: "1 1 120px",
                            padding: "10px",
                            fontWeight: "bold",
                            background: cur.result === "NotMet" ? "#dc3545" : undefined,
                            borderColor: cur.result === "NotMet" ? "#dc3545" : undefined,
                          }}
                        >
                          ✗ {t("Not Met", "ناکام")}
                        </button>
                      </div>

                      {/* Examiner Note (Mandatory if PartlyMet or NotMet) */}
                      <div>
                        <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "0.85rem" }}>
                          📝 {t("Examiner note & observations:", "ممتحن کا تبصرہ و مشاہدات:")}{" "}
                          {(cur.result === "PartlyMet" || cur.result === "NotMet") && (
                            <span style={{ color: "#dc3545" }}>* ({t("Required", "لازمی")})</span>
                          )}
                        </label>
                        <textarea
                          data-help="mock_interviews.note"
                          rows={2}
                          value={cur.note}
                          onChange={(e) => handleSetNote(e.target.value)}
                          placeholder={t(
                            "Record specific observations or gaps in ward practice...",
                            "وارڈ کے عملی معمولات میں موجود خلا یا مشاہدات درج کریں..."
                          )}
                          className="form-control"
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
                        />
                      </div>
                    </div>

                    {/* Corrective Action Section (rule:9d0ad34c4c) */}
                    <div style={{ borderTop: "1px solid #dee2e6", paddingTop: "14px", marginBottom: "20px" }}>
                      {cur.action ? (
                        <div
                          style={{
                            background: "#fff8e1",
                            border: "1px solid #ffe082",
                            padding: "12px",
                            borderRadius: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>
                              ⚡ {cur.action.action_type}: {cur.action.description}
                            </strong>
                            <div style={{ fontSize: "0.82rem", color: "#6c757d", marginTop: "2px" }}>
                              {t("Owner user ID:", "ذمہ دار صارف:")} {cur.action.owner_user_id} | {t("Due:", "میعاد:")} {cur.action.due_date}
                            </div>
                          </div>
                          <button
                            type="button"
                            data-help="mock_interviews.action"
                            onClick={() => handleRemoveAction(activeItemIndex)}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          >
                            ✖ {t("Remove action", "اقدام ختم کریں")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-help="mock_interviews.action"
                          onClick={() => {
                            setEditingActionForIndex(activeItemIndex);
                            setActionType("Corrective");
                            setActionDesc("");
                            setActionOwnerId(staffList.find((s) => s.user_id !== null)?.user_id || null);
                            setActionDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                        >
                          ⚡ {t("Raise corrective action for practice gap", "عملی خلا کے لیے اصلاحی اقدام درج کریں")}
                        </button>
                      )}
                    </div>

                    {/* Stepper Navigation Buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #dee2e6", paddingTop: "16px" }}>
                      <button
                        type="button"
                        data-help="mock_interviews.start"
                        onClick={() => setActiveItemIndex((i) => Math.max(0, i - 1))}
                        disabled={activeItemIndex === 0}
                        className="btn btn-secondary"
                        style={{ padding: "8px 16px" }}
                      >
                        ◀ {t("Previous question", "پچھلا سوال")}
                      </button>

                      <div style={{ display: "flex", gap: "6px" }}>
                        {inProgressItems.map((it, idx) => (
                          <button
                            key={it.question_key}
                            type="button"
                            data-help="mock_interviews.start"
                            onClick={() => setActiveItemIndex(idx)}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: activeItemIndex === idx ? "2px solid #0056b3" : "1px solid #ced4da",
                              background:
                                it.result === "Met"
                                  ? "#d4edda"
                                  : it.result === "PartlyMet"
                                  ? "#ffeeba"
                                  : it.result === "NotMet"
                                  ? "#f8d7da"
                                  : "#ffffff",
                              fontWeight: activeItemIndex === idx ? "bold" : "normal",
                              cursor: "pointer",
                            }}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>

                      {activeItemIndex < inProgressItems.length - 1 ? (
                        <button
                          type="button"
                          data-help="mock_interviews.start"
                          onClick={() => setActiveItemIndex((i) => Math.min(inProgressItems.length - 1, i + 1))}
                          className="btn btn-primary"
                          style={{ padding: "8px 16px" }}
                        >
                          {t("Next question", "اگلا سوال")} ▶
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-help="mock_interviews.save"
                          onClick={handleFinalizeMock}
                          disabled={submittingSession}
                          className="btn btn-primary"
                          style={{ padding: "8px 20px", fontWeight: "bold", background: "#28a745", borderColor: "#28a745" }}
                        >
                          💾 {submittingSession ? t("Saving mock interview...", "محفوظ ہو رہا ہے...") : t("Finalize & Save session", "انٹرویو سیشن مکمل کریں")}
                        </button>
                      )}
                    </div>

                    {submitError && (
                      <div style={{ marginTop: "12px", background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px" }}>
                        ⚠️ {submitError}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAST SESSIONS HISTORY (rule:4a2a1094dc) */}
      {activeTab === "history" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {/* History Filters */}
          <div
            className="card"
            style={{
              background: "#f8f9fa",
              border: "1px solid #dee2e6",
              padding: "14px",
              borderRadius: "6px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <label style={{ marginRight: "6px", fontSize: "0.85rem", fontWeight: "bold" }}>
                💼 {t("Role:", "کردار:")}
              </label>
              <select
                data-help="mock_interviews.history_filter"
                value={historyRoleFilter}
                onChange={(e) => setHistoryRoleFilter(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
              >
                <option value="ALL">{t("All Roles", "تمام کردار")}</option>
                {rolesList.map((ro) => (
                  <option key={ro.role} value={ro.role}>
                    {ro.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ marginRight: "6px", fontSize: "0.85rem", fontWeight: "bold" }}>
                👤 {t("Staff member:", "عملے کا رکن:")}
              </label>
              <select
                data-help="mock_interviews.history_filter"
                value={historyStaffFilter}
                onChange={(e) => setHistoryStaffFilter(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ced4da" }}
              >
                <option value="ALL">{t("All Staff", "تمام عملہ")}</option>
                {staffList.map((st) => (
                  <option key={st.employee_id} value={String(st.employee_id)}>
                    {st.full_name} ({st.emp_number})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#6c757d" }}>
              {t(`Total rounds: ${mocksHistory.length}`, `کل راؤنڈز: ${mocksHistory.length}`)}
            </div>
          </div>

          {/* History Table */}
          <LoadState loading={mocksLoad.loading} error={mocksLoad.error} retry={mocksLoad.reload} />
          {mocksLoad.data && (
            <div className="card" style={{ background: "#ffffff", border: "1px solid #dee2e6", borderRadius: "6px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>{t("Interview #", "انٹرویو نمبر")}</th>
                    <th style={{ padding: "10px" }}>{t("Staff Member", "عملہ")}</th>
                    <th style={{ padding: "10px" }}>{t("Role", "کردار")}</th>
                    <th style={{ padding: "10px" }}>{t("Date & Time", "تاریخ و وقت")}</th>
                    <th style={{ padding: "10px" }}>{t("Examiner", "ممتحن")}</th>
                    <th style={{ padding: "10px" }}>{t("Score", "اسکور")}</th>
                    <th style={{ padding: "10px" }}>{t("Breakdown", "تفصیل")}</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>{t("Action", "عمل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mocksHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "#6c757d" }}>
                        ℹ️ {t("No mock interview sessions recorded matching filters.", "فلٹر کے مطابق کوئی فرضی انٹرویو نہیں ملا۔")}
                      </td>
                    </tr>
                  ) : (
                    mocksHistory.map((m) => (
                      <tr key={m.mock_interview_id} style={{ borderBottom: "1px solid #e9ecef" }}>
                        <td style={{ padding: "10px", fontWeight: "bold" }}>{m.interview_number}</td>
                        <td style={{ padding: "10px" }}>
                          {m.employee_name} <span style={{ color: "#6c757d", fontSize: "0.8rem" }}>({m.emp_number})</span>
                        </td>
                        <td style={{ padding: "10px" }}>{m.role_name || m.role_code}</td>
                        <td style={{ padding: "10px", fontSize: "0.82rem" }}>{new Date(m.held_at).toLocaleString()}</td>
                        <td style={{ padding: "10px" }}>{m.examiner_name}</td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              background: m.score_pct >= 80 ? "#d4edda" : "#fff3cd",
                              color: m.score_pct >= 80 ? "#155724" : "#856404",
                              fontWeight: "bold",
                              padding: "2px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            {m.score_pct}%
                          </span>
                        </td>
                        <td style={{ padding: "10px", fontSize: "0.82rem" }}>
                          <span style={{ color: "#28a745" }}>{m.met}M</span> /{" "}
                          <span style={{ color: "#fd7e14" }}>{m.partly_met}P</span> /{" "}
                          <span style={{ color: "#dc3545" }}>{m.not_met}N</span>
                        </td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          <button
                            type="button"
                            data-help="mock_interviews.detail"
                            onClick={() => setSelectedDetailMockId(m.mock_interview_id)}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                          >
                            🔍 {t("Review", "جائزہ")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SWAP QUESTION MODAL */}
      {swappingIndex !== null && (
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
              maxWidth: "700px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                🔄 {t("Swap Question for Role:", "کردار کے لیے متبادل سوال:")} {selectedRoleCode}
              </h3>
              <button
                type="button"
                data-help="mock_interviews.swap"
                onClick={() => setSwappingIndex(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✖
              </button>
            </div>

            {loadingSwapQuestions ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#6c757d" }}>
                ⏳ {t("Loading alternative questions...", "متبادل سوالات لوڈ ہو رہے ہیں...")}
              </div>
            ) : availableSwapQuestions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#6c757d" }}>
                ℹ️ {t("No alternative questions found for this role.", "اس کردار کے لیے مزید متبادل سوالات دستیاب نہیں۔")}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                {availableSwapQuestions.map((q) => (
                  <div
                    key={q.key}
                    style={{
                      border: "1px solid #dee2e6",
                      padding: "10px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                        <span
                          style={{
                            background: q.phc_type === "Mandatory" ? "#dc3545" : "#ffc107",
                            color: q.phc_type === "Mandatory" ? "#ffffff" : "#212529",
                            fontSize: "0.72rem",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            fontWeight: "bold",
                          }}
                        >
                          {q.phc_type || "MSDS"}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#6c757d" }}>#{q.indicator} — {q.key}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.88rem" }}>{q.question}</p>
                    </div>

                    <button
                      type="button"
                      data-help="mock_interviews.swap"
                      onClick={() => handleConfirmSwap(q)}
                      className="btn btn-primary"
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    >
                      {t("Select", "منتخب کریں")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RAISE CORRECTIVE ACTION MODAL (rule:9d0ad34c4c) */}
      {editingActionForIndex !== null && (
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
              maxWidth: "550px",
              width: "100%",
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                ⚡ {t("Raise action for practice gap", "عملی خلا کے لیے اقدام درج کریں")}
              </h3>
              <button
                type="button"
                data-help="mock_interviews.action"
                onClick={() => setEditingActionForIndex(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✖
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Action Type:", "اقدام کی قسم:")}
                </label>
                <select
                  data-help="mock_interviews.action"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as "Corrective" | "Preventive")}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                >
                  <option value="Corrective">{t("Corrective (fix existing practice gap)", "اصلاحی (موجودہ خلا دور کریں)")}</option>
                  <option value="Preventive">{t("Preventive (prevent future deficiency)", "احتیاطی (آئندہ کمی سے بچاؤ)")}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  {t("Description of gap & remedy:", "خلا کی تفصیل و حل:")} *
                </label>
                <textarea
                  data-help="mock_interviews.action"
                  rows={3}
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder={t(
                    "e.g. Ward nurse unaware of high-alert double-check log; conduct in-service refresher",
                    "مثلاً ہائی الرٹ ادویات کے ڈبل چیک لاگ کا علم نہیں تھا؛ وارڈ ان سروس ٹریننگ کرائی جائے"
                  )}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  👤 {t("Action Owner (User ID):", "ذمہ دار افسر:")} *
                </label>
                <select
                  data-help="mock_interviews.action"
                  value={actionOwnerId || ""}
                  onChange={(e) => setActionOwnerId(parseInt(e.target.value, 10))}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                >
                  {staffList
                    .filter((s) => s.user_id !== null)
                    .map((s) => (
                      <option key={s.user_id!} value={s.user_id!}>
                        {s.full_name} ({s.designation}) — ID: {s.user_id}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  🏢 {t("Department (Optional):", "شعبہ (اختیاری):")}
                </label>
                <select
                  data-help="mock_interviews.action"
                  value={actionDeptId || ""}
                  onChange={(e) => setActionDeptId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                >
                  <option value="">{t("None / Hospital-wide", "کوئی نہیں / ہسپتال گیر")}</option>
                  {deptsList.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "4px" }}>
                  📅 {t("Due Date:", "تکمیل کی آخری تاریخ:")} *
                </label>
                <input
                  data-help="mock_interviews.action"
                  type="date"
                  value={actionDueDate}
                  onChange={(e) => setActionDueDate(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                data-help="mock_interviews.action"
                onClick={() => setEditingActionForIndex(null)}
                className="btn btn-secondary"
                style={{ padding: "6px 14px" }}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                data-help="mock_interviews.action"
                onClick={handleSaveAction}
                disabled={!actionDesc.trim() || !actionOwnerId || !actionDueDate}
                className="btn btn-primary"
                style={{ padding: "6px 16px" }}
              >
                ✓ {t("Save action", "اقدام محفوظ کریں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL FOR PAST MOCK INTERVIEW */}
      {selectedDetailMockId !== null && (
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
              maxWidth: "750px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>
                  🔍 {detailMock?.interview_number} — {detailMock?.employee_name}
                </h3>
                <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                  {detailMock?.role_name || detailMock?.role_code} | {t("Held:", "تاریخ:")} {detailMock && new Date(detailMock.held_at).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                data-help="mock_interviews.detail"
                onClick={() => setSelectedDetailMockId(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✖
              </button>
            </div>

            {loadingDetailMock ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}>
                ⏳ {t("Loading interview detail...", "تفصیلات لوڈ ہو رہی ہیں...")}
              </div>
            ) : detailMock ? (
              <div>
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px", background: "#f8f9fa", padding: "10px", borderRadius: "6px" }}>
                  <span>
                    <strong>{t("Examiner:", "ممتحن:")}</strong> {detailMock.examiner_name}
                  </span>
                  <span>
                    <strong>{t("Score:", "اسکور:")}</strong> {detailMock.score_pct}%
                  </span>
                  <span>
                    <strong>{t("Met:", "کامیاب:")}</strong> {detailMock.met}
                  </span>
                  <span>
                    <strong>{t("Partly:", "جزوی:")}</strong> {detailMock.partly_met}
                  </span>
                  <span>
                    <strong>{t("Not Met:", "ناکام:")}</strong> {detailMock.not_met}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "16px" }}>
                  {detailMock.items?.map((it, idx) => (
                    <div
                      key={it.item_id || it.question_key}
                      style={{
                        border: "1px solid #dee2e6",
                        padding: "10px",
                        borderRadius: "6px",
                        background:
                          it.result === "Met"
                            ? "#fbfdfb"
                            : it.result === "PartlyMet"
                            ? "#fffdf6"
                            : "#fff9f9",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                          #{idx + 1} {it.question_key}
                        </span>
                        <span
                          style={{
                            fontWeight: "bold",
                            color: it.result === "Met" ? "#28a745" : it.result === "PartlyMet" ? "#e65100" : "#dc3545",
                          }}
                        >
                          {it.result}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px 0", fontSize: "0.9rem" }}>{it.question}</p>
                      {it.note && (
                        <div style={{ fontSize: "0.82rem", color: "#6c757d", fontStyle: "italic" }}>
                          📝 {it.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {detailMock.actions && detailMock.actions.length > 0 && (
                  <div style={{ borderTop: "1px solid #dee2e6", paddingTop: "12px" }}>
                    <strong style={{ display: "block", marginBottom: "6px" }}>
                      ⚡ {t("Corrective actions:", "اصلاحی اقدامات:")}
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem" }}>
                      {detailMock.actions.map((act) => (
                        <li key={act.action_id}>
                          <strong>{act.action_number}</strong> ({act.action_type}): {act.description} — {act.owner_name} ({t("due", "میعاد")}: {act.due_date})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
