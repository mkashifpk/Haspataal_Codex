import React, { useEffect, useState, useRef } from "react";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  AssessmentIn,
  ObstetricAssessmentOut,
  ObstetricConditionOut,
  ReferralIn,
  ReferralOut,
} from "../generated/obstetric_assessment";
import {
  assessMaternityAssessments,
  assessments,
  listConditions,
  createReferrals,
  getEstablishment,
} from "../generated/obstetric_assessment";
import {
  getObstetricAssessmentScreenView,
  isMaternityActive,
  isMaternalNutritionRequired,
  validateAssessmentInput,
  validateReferralInput,
  formatAuthorStamp,
  explainObstetricError,
} from "../obstetric-assessment-policy";
import { useClinicalWrite, ClinicalWriteFeedback, type ClinicalCommand } from "../clinical-write";
import { api } from "../bridge";

export interface ObstetricAssessmentProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  initialPatientId?: number | null;
  initialTicketId?: number | null;
  initialAdmissionId?: number | null;
  onNavigateScreen?: (screen: string) => void;
}

interface PatientSearchMatch {
  patient_id: number;
  mrn: string;
  name: string;
  gender: string;
  age_years?: number | null;
  mobile?: string | null;
}

export function ObstetricAssessment({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  initialPatientId = null,
  initialTicketId = null,
  initialAdmissionId = null,
  onNavigateScreen,
}: ObstetricAssessmentProps) {
  // Establish permissions
  const canRecord = user.permissions?.includes("maternity.record") ?? false;
  const canView = user.permissions?.includes("maternity.view") ?? false;
  const canRefer = user.permissions?.includes("referral.create") ?? false;

  // Real-time revision tracking
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Active Establishment state
  const [est, setEst] = useState<EstablishmentOut | null>(propEstablishment || null);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  // Screen view mode
  const screenView = getObstetricAssessmentScreenView(est);
  const maternityActive = isMaternityActive(est);

  // Active Tab: "new" (Assessment Form) or "history" (Past Assessments Register)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // Patient Selection State
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(initialPatientId || (initialTicketId ? 1 : null));
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchMatch | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientSearchResults, setPatientSearchResults] = useState<PatientSearchMatch[]>([]);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);

  // Visit Context
  const [ticketId, setTicketId] = useState<number | null>(initialTicketId);
  const [admissionId, setAdmissionId] = useState<number | null>(initialAdmissionId);

  // Assessment Form State (rule:064bedf875)
  // highRisk deliberate choice: null initially!
  const [highRiskChoice, setHighRiskChoice] = useState<boolean | null>(null);
  const [gestationWeeks, setGestationWeeks] = useState<string>("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [conditionNote, setConditionNote] = useState("");
  const [counselled, setCounselled] = useState(false);
  const [counsellingNote, setCounsellingNote] = useState("");
  const [plan, setPlan] = useState<"CareHere" | "Refer">("CareHere");
  const [followUp, setFollowUp] = useState("");

  // Nutritional Assessment State (rule:272b13a3e0)
  const [nutritionAssessment, setNutritionAssessment] = useState("");
  const [nutritionAdvice, setNutritionAdvice] = useState("");

  // External Referral Link State
  const [linkedReferralId, setLinkedReferralId] = useState<number | null>(null);
  const [linkedReferralNumber, setLinkedReferralNumber] = useState<string | null>(null);

  // Referral Modal State
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [refDestinationName, setRefDestinationName] = useState("");
  const [refDestinationDept, setRefDestinationDept] = useState("Obstetrics & Gynaecology");
  const [refReason, setRefReason] = useState("");
  const [refUrgency, setRefUrgency] = useState<"Routine" | "Urgent" | "Emergency">("Urgent");
  const [refSummary, setRefSummary] = useState("");
  const [refTreatment, setRefTreatment] = useState("");
  const [refTransport, setRefTransport] = useState<"Own" | "Ambulance" | "Rescue" | "WithStaff">("Ambulance");
  const [refEscortName, setRefEscortName] = useState("");
  const [refCareDuringTransfer, setRefCareDuringTransfer] = useState("");
  const [refValidationError, setRefValidationError] = useState<string | null>(null);

  // Form Validation Error
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // History Tab Filter
  const [historyHighRiskOnly, setHistoryHighRiskOnly] = useState(false);

  // Data Loading: High-Risk Conditions Catalog
  const conditionsLoad = useLoad<ObstetricConditionOut[]>(
    async () => {
      const res = await listConditions({ include_inactive: false });
      return res;
    },
    [revision]
  );

  // Data Loading: Past Assessments for selected patient
  const assessmentsLoad = useLoad<ObstetricAssessmentOut[]>(
    async () => {
      if (!selectedPatientId) return [];
      const res = await assessments({
        patient_id: selectedPatientId,
        high_risk_only: historyHighRiskOnly ? true : undefined,
        limit: 50,
      });
      return res;
    },
    [selectedPatientId, historyHighRiskOnly, revision]
  );

  // Real-time Event Subscription: establishment.changed
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      const ev = parsed.event || parsed.topic;
      if (ev === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment configuration changed. Maternity service status and catalog refreshed.",
            "ادارے کی سیٹنگز تبدیل ہوئیں۔ زچگی سروس اور شرائط کی فہرست تازہ کر دی گئی ہے۔"
          )
        );
        getEstablishment().then(setEst).catch(() => {});
        setRevision((r) => r + 1);
      }
    } catch {
      // ignore
    }
  }, [stream]);

  // Clinical write controller
  const write = useClinicalWrite(user, "obstetric_assessment", (value: any, cmd: ClinicalCommand) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/maternity/assessments")) {
      // Assessment saved successfully: reset form and switch to history
      setHighRiskChoice(null);
      setSelectedConditions([]);
      setConditionNote("");
      setCounselled(false);
      setCounsellingNote("");
      setGestationWeeks("");
      setNutritionAssessment("");
      setNutritionAdvice("");
      setFollowUp("");
      setLinkedReferralId(null);
      setLinkedReferralNumber(null);
      setFormValidationError(null);
      setActiveTab("history");
    } else if (cmd.path.includes("/referrals")) {
      // Referral created: link referral ID to assessment form
      const ref = value as ReferralOut;
      if (ref?.referral_id) {
        setLinkedReferralId(ref.referral_id);
        setLinkedReferralNumber(ref.referral_number || String(ref.referral_id));
      }
      setReferralModalOpen(false);
    }
  });

  // Patient Search Action
  const handlePatientSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patientSearchQuery.trim()) return;
    setPatientSearching(true);
    setPatientSearchError(null);
    try {
      const q = encodeURIComponent(patientSearchQuery.trim());
      const res = await api<{ data: PatientSearchMatch[] }>("GET", `/patients?q=${q}&limit=10`);
      const list = res.data || (Array.isArray(res) ? (res as any) : []);
      setPatientSearchResults(list);
      if (list.length === 0) {
        setPatientSearchError(t("No matching female patients found.", "کوئی مماثل مریضہ نہیں ملی۔"));
      }
    } catch (err: any) {
      setPatientSearchError(err?.message || "Patient search failed");
    } finally {
      setPatientSearching(false);
    }
  };

  // Select patient
  const handleSelectPatient = (p: PatientSearchMatch) => {
    setSelectedPatientId(p.patient_id);
    setSelectedPatient(p);
    setPatientSearchResults([]);
    setPatientSearchQuery("");
  };

  // Toggle high-risk condition selection
  const handleToggleCondition = (condName: string, provision: "Managed" | "Referred" | null) => {
    if (selectedConditions.includes(condName)) {
      setSelectedConditions(selectedConditions.filter((c) => c !== condName));
    } else {
      const next = [...selectedConditions, condName];
      setSelectedConditions(next);
      // If condition is Referred, automatically suggest referral plan
      if (provision === "Referred") {
        setPlan("Refer");
      }
    }
  };

  // Check if nutrition is required for this hospital and this assessment
  const nutritionMandatory = isMaternalNutritionRequired(est, highRiskChoice === true);

  // Submit Assessment
  const handleSubmitAssessment = () => {
    if (!selectedPatientId) {
      setFormValidationError(t("Please select a patient first.", "براہ کرم پہلے مریضہ کا انتخاب کریں۔"));
      return;
    }

    const payload: AssessmentIn = {
      patient_id: selectedPatientId,
      admission_id: admissionId || null,
      ticket_id: ticketId || null,
      gestation_weeks: gestationWeeks ? Number(gestationWeeks) : null,
      high_risk: highRiskChoice === true,
      conditions: highRiskChoice ? selectedConditions : undefined,
      condition_note: conditionNote.trim() ? conditionNote.trim() : null,
      counselled: counselled,
      counselling_note: counsellingNote.trim() ? counsellingNote.trim() : null,
      plan: plan,
      referral_id: plan === "Refer" ? linkedReferralId : null,
      nutrition_assessment: nutritionAssessment.trim() ? nutritionAssessment.trim() : null,
      nutrition_advice: nutritionAdvice.trim() ? nutritionAdvice.trim() : null,
      follow_up: followUp.trim() ? followUp.trim() : null,
    };

    const val = validateAssessmentInput(payload, est);
    if (!val.valid) {
      setFormValidationError(val.error || "Validation error");
      return;
    }
    setFormValidationError(null);

    write.start({
      path: "/maternity/assessments",
      method: "POST",
      body: payload,
      permission: "maternity.record",
      protection: "idempotent",
      label: t("Save Obstetric Risk Assessment", "زچگی رسک اسسمنٹ محفوظ کریں"),
    });
  };

  // Submit External Referral
  const handleSubmitReferral = () => {
    const payload: ReferralIn = {
      ticket_id: ticketId || null,
      destination_name: refDestinationName.trim() || null,
      destination_department: refDestinationDept.trim() || null,
      reason: refReason.trim(),
      urgency: refUrgency,
      clinical_summary: refSummary.trim(),
      treatment_given: refTreatment.trim() || null,
      transport: refTransport,
      escort_name: refTransport === "WithStaff" ? refEscortName.trim() : null,
      care_during_transfer: refCareDuringTransfer.trim() || null,
    };

    const val = validateReferralInput(payload);
    if (!val.valid) {
      setRefValidationError(val.error || "Validation error");
      return;
    }
    setRefValidationError(null);

    write.start({
      path: "/referrals",
      method: "POST",
      body: payload,
      permission: "referral.create",
      protection: "idempotent",
      label: t("Issue External Referral", "بیرونی ریفرل جاری کریں"),
    });
  };

  // Conditions list from load
  const conditionsCatalog = conditionsLoad.data || [];

  return (
    <section className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header and Capability Status */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <span>🤰</span>
            <span>{t("Obstetric Risk Assessment", "حمل و زچگی خطرات کا جائزہ")}</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              MSDS Cat I 26-28
            </span>
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {t(
              "Deliberate high-risk determination, standard conditions mapping, counselling notes, and Category I/II A nutritional evaluation.",
              "ہائی رسک کا باقاعدہ انتخاب، معیاری علامات، کونسلنگ نوٹس، اور کیٹیگری I/II A غذائی جائزہ۔"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {maternityActive ? (
            <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {t("Maternity Service Active", "زچگی سروس فعال ہے")}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-semibold">
              {t("Maternity Inactive (No New Work)", "زچگی سروس غیر فعال ہے")}
            </span>
          )}

          <button
            onClick={() => setRevision((r) => r + 1)}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center gap-1.5"
            data-help="obstetric_assessment.refresh_btn"
          >
            <span>🔄</span>
            <span>{t("Refresh", "تازہ کریں")}</span>
          </button>
        </div>
      </header>

      {/* Real-time Notification */}
      {realtimeNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
          <span>{realtimeNotice}</span>
          <button
            onClick={() => setRealtimeNotice(null)}
            className="font-bold hover:underline ml-2"
            data-help="obstetric_assessment.btn_dismiss_alert"
          >
            {t("Dismiss", "ختم کریں")}
          </button>
        </div>
      )}

      {/* Capability View Gates (rule:e6bd3426e5) */}
      {screenView === "open_work" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-900 dark:text-amber-200">
          <strong>{t("Notice: ", "انتباہ: ")}</strong>
          {t(
            "No new obstetric assessments from now on (Maternity service is Retiring). Earlier patient records remain available for review.",
            "اب سے نئی زچگی اسسمنٹس درج نہیں ہوں گی (زچگی سروس ریٹائر ہو رہی ہے)۔ سابقہ ریکارڈز جائزے کے لیے دستیاب ہیں۔"
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1 text-sm">
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "new"
              ? "border-purple-600 text-purple-700 dark:text-purple-300 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          data-help="obstetric_assessment.tab_new_btn"
        >
          <span>📋</span>
          <span>{t("New Risk Assessment", "نیا رسک جائزہ")}</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "history"
              ? "border-purple-600 text-purple-700 dark:text-purple-300 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          data-help="obstetric_assessment.tab_history_btn"
        >
          <span>📜</span>
          <span>{t("Patient Assessment History", "مریضہ کی سابقہ اسسمنٹس")}</span>
          {assessmentsLoad.data && assessmentsLoad.data.length > 0 && (
            <span className="px-1.5 py-0.2 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
              {assessmentsLoad.data.length}
            </span>
          )}
        </button>
      </div>

      {/* PATIENT SEARCH & BANNER */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[280px]">
            <form onSubmit={handlePatientSearch} className="flex gap-2">
              <input
                type="text"
                placeholder={t("Search female patient by MRN, Name, or Mobile...", "مریضہ کو ایم آر این، نام یا موبائل نمبر سے تلاش کریں...")}
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.patient_search_input"
              />
              <button
                type="submit"
                disabled={patientSearching}
                className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
                data-help="obstetric_assessment.patient_search_btn"
              >
                {patientSearching ? t("Searching...", "تلاش جاری...") : t("Find Patient", "مریض تلاش کریں")}
              </button>
            </form>
          </div>

          {selectedPatientId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t("Selected Patient ID:", "منتخب مریضہ:")}</span>
              <span className="font-mono bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 text-purple-900 dark:text-purple-300 font-bold">
                #{selectedPatientId} {selectedPatient?.mrn ? `(${selectedPatient.mrn})` : ""}
              </span>
              {selectedPatient?.name && (
                <span className="font-medium text-gray-900 dark:text-gray-100">{selectedPatient.name}</span>
              )}
            </div>
          )}
        </div>

        {patientSearchError && <ErrorBox error={patientSearchError} />}

        {/* Search Results Dropdown / List */}
        {patientSearchResults.length > 0 && (
          <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-2 bg-purple-50/50 dark:bg-purple-950/20 space-y-1">
            <div className="text-xs font-semibold text-purple-900 dark:text-purple-200 px-1">
              {t("Select Patient:", "مریضہ کا انتخاب کریں:")}
            </div>
            {patientSearchResults.map((p) => (
              <button
                type="button"
                key={p.patient_id}
                onClick={() => handleSelectPatient(p)}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-white dark:hover:bg-gray-900 cursor-pointer text-xs border border-transparent hover:border-purple-300 transition-colors text-left"
                data-help="obstetric_assessment.patient_search_match"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{p.mrn}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                  <span className="text-gray-500">({p.gender}, {p.age_years ? `${p.age_years}y` : "age unknown"})</span>
                </div>
                <span className="font-mono text-gray-600 dark:text-gray-400">{p.mobile || "No mobile"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: NEW RISK ASSESSMENT */}
      {activeTab === "new" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-6">
          {/* DELIBERATE HIGH RISK SELECTION (rule:064bedf875) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <span>⚖️</span>
                  <span>{t("Obstetric Risk Determination (Required)", "حمل کے خطرے کا حتمی فیصلہ (لازمی)")}</span>
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {t(
                    "Rule 064bedf875: Deliberate clinical choice required. Two buttons, neither is pre-selected.",
                    "قاعدہ 064bedf875: شعوری طبی انتخاب لازمی ہے۔ پہلے سے کوئی بٹن منتخب نہیں ہوتا۔"
                  )}
                </p>
              </div>

              {highRiskChoice === null && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-semibold">
                  {t("Selection Pending", "انتخاب باقی ہے")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setHighRiskChoice(false)}
                className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                  highRiskChoice === false
                    ? "bg-green-50 dark:bg-green-950/40 border-green-500 ring-2 ring-green-500 text-green-900 dark:text-green-200 font-bold shadow-sm"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                }`}
                data-help="obstetric_assessment.btn_standard_risk"
              >
                <span className="text-xl">🟢</span>
                <div>
                  <div className="text-sm font-bold">{t("Standard Risk (Low Risk)", "معمول کا خطرہ (نارمل)")}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
                    {t("Uncomplicated pregnancy eligible for routine antenatal care and normal delivery.", "بغیر پیچیدگی کا نارمل حمل، معمول کی اینٹی نیٹل دیکھ بھال")}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHighRiskChoice(true)}
                className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                  highRiskChoice === true
                    ? "bg-red-50 dark:bg-red-950/40 border-red-500 ring-2 ring-red-500 text-red-900 dark:text-red-200 font-bold shadow-sm"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                }`}
                data-help="obstetric_assessment.btn_high_risk"
              >
                <span className="text-xl">🔴</span>
                <div>
                  <div className="text-sm font-bold">{t("High Risk Pregnancy", "ہائی رسک زچگی (خطرے والا حمل)")}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
                    {t("One or more high-risk conditions identified. Mandates condition tagging, counselling, and nutrition.", "ایک یا زیادہ خطرات موجود۔ علامات کا انتخاب، کونسلنگ اور غذائی منصوبہ لازمی")}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* GESTATION WEEKS & VISIT CONTEXT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <Field label={t("Gestation Weeks (1–45)", "مدت حمل ہفتے (1 تا 45)")}>
              <input
                type="number"
                min={1}
                max={45}
                placeholder="e.g. 32"
                value={gestationWeeks}
                onChange={(e) => setGestationWeeks(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.gestation_weeks_input"
              />
            </Field>

            <Field label={t("OPD Ticket ID (Optional)", "او پی ڈی پرچی نمبر")}>
              <input
                type="number"
                placeholder="Ticket #"
                value={ticketId || ""}
                onChange={(e) => setTicketId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.ticket_id_input"
              />
            </Field>

            <Field label={t("Inpatient Admission ID (Optional)", "ان ڈور داخلہ نمبر")}>
              <input
                type="number"
                placeholder="Admission #"
                value={admissionId || ""}
                onChange={(e) => setAdmissionId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.admission_id_input"
              />
            </Field>
          </div>

          {/* HIGH RISK CONDITIONS SELECTION (rule:064bedf875) */}
          {highRiskChoice === true && (
            <div className="p-4 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>{t("Select Identified High-Risk Conditions (Hospital Catalog)", "شناخت شدہ ہائی رسک علامات کا انتخاب کریں")}</span>
                  </h4>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                    {t(
                      "Each condition displays whether the hospital manages it or refers it under policy. Selecting a Referred condition suggests external referral.",
                      "ہر علامت کے ساتھ ہسپتال کی پالیسی (یہاں علاج یا ریفر) واضح ہے۔ ریفر شدہ علامت چننے پر بیرونی ریفرل تجویز کیا جاتا ہے۔"
                    )}
                  </p>
                </div>

                <span className="text-xs font-bold text-red-800 dark:text-red-300">
                  {selectedConditions.length} {t("Selected", "منتخب")}
                </span>
              </div>

              {conditionsLoad.loading ? (
                <LoadState
                  loading={conditionsLoad.loading}
                  error={conditionsLoad.error}
                  retry={conditionsLoad.reload}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 bg-white dark:bg-gray-900 rounded border border-red-200 dark:border-red-800">
                  {conditionsCatalog.map((cond) => {
                    const isSelected = selectedConditions.includes(cond.name);
                    const isReferred = cond.provision === "Referred";
                    return (
                      <label
                        key={cond.condition_id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer border text-xs transition-colors ${
                          isSelected
                            ? "bg-red-50 dark:bg-red-950/60 border-red-400 font-semibold"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleCondition(cond.name, cond.provision)}
                          className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                          data-help="obstetric_assessment.condition_checkbox"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-gray-900 dark:text-gray-100">{cond.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isReferred
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                  : cond.provision === "Managed"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {cond.provision === "Managed"
                                ? t("Managed Here", "یہاں علاج")
                                : cond.provision === "Referred"
                                ? t("Referred", "ریفر")
                                : t("Undecided", "غیر طے شدہ")}
                            </span>
                          </div>
                          {isReferred && cond.referral_note && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-300 truncate mt-0.5">
                              ↳ {cond.referral_note}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <Field label={t("Clinical Condition Notes (Optional)", "طبی کیفیت کے تفصیلی نوٹس")}>
                <textarea
                  value={conditionNote}
                  onChange={(e) => setConditionNote(e.target.value)}
                  placeholder={t("Additional clinical observations or severity markers...", "مزید طبی علامات یا شدت...")}
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.condition_note_textarea"
                />
              </Field>

              {/* MANDATORY COUNSELLING NOTE (rule:064bedf875) */}
              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-red-300 dark:border-red-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={counselled}
                    onChange={(e) => setCounselled(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                    data-help="obstetric_assessment.counselled_checkbox"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {t(
                      "Patient and family informed of risk and danger signs (PHC II C p.166 mandatory)",
                      "مریضہ اور اہلخانہ کو خطرات اور ہنگامی علامات سے آگاہ و کونسل کیا گیا"
                    )}
                  </span>
                </label>

                <Field label={t("Counselling Documentation Note (Mandatory when High Risk)", "کونسلنگ کی تفصیلات (ہائی رسک کے لیے لازمی)")}>
                  <textarea
                    value={counsellingNote}
                    onChange={(e) => setCounsellingNote(e.target.value)}
                    placeholder={t("Document what was explained to the patient and attendants regarding risk, danger signs, and immediate actions...", "مریضہ اور تیمارداروں کو خطرات اور احتیاطی تدابیر سے متعلق دی گئی ہدایات درج کریں...")}
                    rows={2}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    data-help="obstetric_assessment.counselling_note_textarea"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* NUTRITIONAL ASSESSMENT (rule:272b13a3e0) */}
          <div className={`p-4 rounded-lg border space-y-3 ${
            nutritionMandatory
              ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
              : "bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <span>🥗</span>
                  <span>{t("Maternal Nutrition Assessment & Advice", "حاملہ کا غذائی جائزہ و مشورہ")}</span>
                  {nutritionMandatory && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200 font-bold">
                      {t("Mandatory (Cat I / II A)", "لازمی کیٹیگری I / II A")}
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {t(
                    "Rule 272b13a3e0: Category I & II A facilities mandate nutritional assessment and corrective advice for high-risk obstetric cases (MSDS Indicator 28).",
                    "قاعدہ 272b13a3e0: کیٹیگری I اور II A ہسپتالوں میں ہائی رسک حاملہ کے لیے غذائی جائزہ اور اصلاحی مشورہ لازمی ہے (انڈیکیٹر 28)۔"
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <Field label={t("Nutritional Status / Findings", "غذائی کیفیت و معائنہ")}>
                <textarea
                  value={nutritionAssessment}
                  onChange={(e) => setNutritionAssessment(e.target.value)}
                  placeholder={t("e.g. Weight, BMI, anaemia signs, pallor, oedema, dietary intake history...", "مثلاً وزن، بی ایم آئی، خون کی کمی کی علامات، سوجن، خوراک کی ہسٹری...")}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.nutrition_assessment_textarea"
                />
              </Field>

              <Field label={t("Nutritional Advice & Corrective Measures", "غذائی مشورہ و تدارک")}>
                <textarea
                  value={nutritionAdvice}
                  onChange={(e) => setNutritionAdvice(e.target.value)}
                  placeholder={t("Dietary plan, iron/folic acid/calcium supplements, protein intake, follow-up instructions...", "غذائی پلان، فولاد/کیلشیم سپلیمنٹس، پروٹین کا استعمال، فالو اپ...")}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.nutrition_advice_textarea"
                />
              </Field>
            </div>
          </div>

          {/* CLINICAL PLAN & REFERRAL */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <span>🎯</span>
              <span>{t("Management Plan & Referral Decision", "طبی پلان اور ریفرل کا فیصلہ")}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Field label={t("Care Plan", "نگہداشت کا پلان")}>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    data-help="obstetric_assessment.plan_select"
                  >
                    <option value="CareHere">{t("Care Here (Deliver / Manage at this facility)", "یہاں نگہداشت و علاج جاری رکھیں")}</option>
                    <option value="Refer">{t("Refer (Transfer to designated tertiary hospital)", "ریفر کریں (ٹرشری ہسپتال منتقل کریں)")}</option>
                  </select>
                </Field>

                <Field label={t("Follow-up Instructions (Optional)", "فالو اپ ہدایات")}>
                  <input
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder={t("e.g. Follow-up in 1 week or report immediately if bleeding/headache", "مثلاً ایک ہفتے بعد دوبارہ دکھائیں...")}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    data-help="obstetric_assessment.follow_up_input"
                  />
                </Field>
              </div>

              {/* EXTERNAL REFERRAL LINK BOX */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                    <span>{t("External Referral Letter (rule:064bedf875)", "بیرونی ریفرل لیٹر")}</span>
                    {linkedReferralId ? (
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] font-bold">
                        Linked #{linkedReferralNumber}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">{t("Not linked", "منسلک نہیں")}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {plan === "Refer"
                      ? t("Plan is Refer: An official external referral letter should be issued to accompany the patient.", "پلان ریفر ہے: مریضہ کے ساتھ سرکاری ریفرل لیٹر جاری کرنا ضروری ہے۔")
                      : t("If complications require higher-level tertiary management, issue an external referral.", "اگر پیچیدگیوں کی وجہ سے ٹرشری مرکز بھیجنا ہو تو ریفرل جاری کریں۔")}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRefDestinationName("");
                      setRefReason(selectedConditions.join(", ") || "High-risk pregnancy");
                      setRefSummary(counsellingNote || "Patient assessed with high obstetric risk.");
                      setReferralModalOpen(true);
                    }}
                    disabled={!canRefer}
                    className="w-full px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    data-help="obstetric_assessment.btn_open_referral_modal"
                  >
                    <span>🚑</span>
                    <span>{linkedReferralId ? t("Re-issue / Change Referral", "ریفرل تبدیل کریں") : t("Issue External Referral (POST /referrals)", "بیرونی ریفرل جاری کریں")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* VALIDATION & CLINICAL FEEDBACK */}
          {formValidationError && <ErrorBox error={formValidationError} />}
          <ClinicalWriteFeedback write={write} />

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleSubmitAssessment}
              disabled={write.busy || !canRecord || !maternityActive || screenView === "records" || screenView === "open_work"}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
              data-help="obstetric_assessment.submit_assessment_btn"
            >
              <span>💾</span>
              <span>{write.busy ? t("Saving Assessment...", "محفوظ ہو رہا ہے...") : t("Save & Sign Risk Assessment", "رسک اسسمنٹ محفوظ اور سائن کریں")}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PATIENT ASSESSMENT HISTORY (rule:962fcab00e) */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <span>📜</span>
                <span>{t("Chronological Obstetric Assessments (Append-Only)", "سابقہ زچگی اسسمنٹس (ناقابلِ تنسیخ ریکارڈ)")}</span>
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {t(
                  "Rule 962fcab00e: Past assessments are permanent clinical audit records; subsequent visits append new assessments.",
                  "قاعدہ 962fcab00e: سابقہ ریکارڈز مستقل ہیں؛ ہر نئی وزٹ پر نئی اسسمنٹ کا اضافہ ہوتا ہے۔"
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={historyHighRiskOnly}
                  onChange={(e) => setHistoryHighRiskOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                  data-help="obstetric_assessment.history_high_risk_filter"
                />
                <span>{t("High Risk Cases Only", "صرف ہائی رسک کیسز")}</span>
              </label>

              <button
                onClick={() => setRevision((r) => r + 1)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded border border-gray-300 dark:border-gray-600"
                data-help="obstetric_assessment.refresh_history_btn"
              >
                {t("Refresh History", "ہسٹری تازہ کریں")}
              </button>
            </div>
          </div>

          {!selectedPatientId ? (
            <div className="p-8 text-center text-gray-500 text-xs">
              {t("Please search and select a patient to view her obstetric assessment history.", "مریضہ کی اسسمنٹ ہسٹری دیکھنے کے لیے پہلے مریضہ تلاش کر کے منتخب کریں۔")}
            </div>
          ) : assessmentsLoad.loading ? (
            <LoadState
              loading={assessmentsLoad.loading}
              error={assessmentsLoad.error}
              retry={assessmentsLoad.reload}
            />
          ) : assessmentsLoad.error ? (
            <ErrorBox error={assessmentsLoad.error} />
          ) : !assessmentsLoad.data || assessmentsLoad.data.length === 0 ? (
            <Empty>
              {t("No past obstetric assessments recorded for this patient.", "اس مریضہ کے لیے کوئی سابقہ زچگی اسسمنٹ موجود نہیں ہے۔")}
            </Empty>
          ) : (
            <div className="space-y-3">
              {assessmentsLoad.data.map((item) => (
                <div
                  key={item.assessment_id}
                  className={`p-4 rounded-lg border text-xs space-y-2 ${
                    item.high_risk
                      ? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                        Assessment #{item.assessment_id}
                      </span>
                      {item.high_risk ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          {t("High Risk", "ہائی رسک")}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t("Standard Risk", "نارمل رسک")}
                        </span>
                      )}
                      <span className="text-gray-500">
                        {item.gestation_weeks ? `${item.gestation_weeks} weeks gestation` : "Gestation unspecified"}
                      </span>
                    </div>

                    <div className="text-gray-500 text-[11px]">
                      {new Date(item.assessed_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Conditions Tagged */}
                  {item.conditions && item.conditions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{t("Conditions:", "علامات:")}</span>
                      {item.conditions.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-200 font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Counselling Note */}
                  {item.counselling_note && (
                    <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{t("Counselling Note:", "کونسلنگ نوٹ:")} </span>
                      <span className="text-gray-900 dark:text-gray-100">{item.counselling_note}</span>
                    </div>
                  )}

                  {/* Nutritional Assessment & Advice */}
                  {(item.nutrition_assessment || item.nutrition_advice) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-purple-50/40 dark:bg-purple-950/20 p-2 rounded border border-purple-200 dark:border-purple-800 text-[11px]">
                      {item.nutrition_assessment && (
                        <div>
                          <strong className="text-purple-900 dark:text-purple-200">{t("Nutrition Status:", "غذائی کیفیت:")} </strong>
                          <span className="text-gray-800 dark:text-gray-200">{item.nutrition_assessment}</span>
                        </div>
                      )}
                      {item.nutrition_advice && (
                        <div>
                          <strong className="text-purple-900 dark:text-purple-200">{t("Nutrition Advice:", "غذائی مشورہ:")} </strong>
                          <span className="text-gray-800 dark:text-gray-200">{item.nutrition_advice}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer: Plan, Referral, and Author Stamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t("Plan:", "پلان:")} {item.plan === "CareHere" ? t("Care Here", "یہاں نگہداشت") : t("Refer", "ریفر")}</span>
                      {item.referral_number && (
                        <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">
                          [Referral #{item.referral_number}]
                        </span>
                      )}
                      {item.follow_up && (
                        <span className="text-gray-500">| {t("Follow-up:", "فالو اپ:")} {item.follow_up}</span>
                      )}
                    </div>

                    <div className="font-mono text-purple-700 dark:text-purple-400">
                      ✍️ {formatAuthorStamp(item.author_stamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: EXTERNAL REFERRAL (POST /referrals) */}
      {referralModalOpen && (
        <Modal
          title={t("Issue External Referral Letter (POST /referrals)", "بیرونی ریفرل لیٹر جاری کریں")}
          onClose={() => setReferralModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <Field label={t("Receiving Facility Destination Name", "ریفرل ہسپتال / مرکز کا نام")}>
              <input
                type="text"
                placeholder="e.g. DHQ Teaching Hospital / Tertiary Institute"
                value={refDestinationName}
                onChange={(e) => setRefDestinationName(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.ref_destination_name_input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Destination Department", "متعلقہ شعبہ")}>
                <input
                  type="text"
                  value={refDestinationDept}
                  onChange={(e) => setRefDestinationDept(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.ref_destination_dept_input"
                />
              </Field>

              <Field label={t("Urgency", "فوری ضرورت")}>
                <select
                  value={refUrgency}
                  onChange={(e) => setRefUrgency(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.ref_urgency_select"
                >
                  <option value="Routine">{t("Routine", "معمول")}</option>
                  <option value="Urgent">{t("Urgent", "ارجنٹ")}</option>
                  <option value="Emergency">{t("Emergency", "ایمرجنسی")}</option>
                </select>
              </Field>
            </div>

            <Field label={t("Reason for Referral", "ریفرل کی وجہ")}>
              <input
                type="text"
                value={refReason}
                onChange={(e) => setRefReason(e.target.value)}
                placeholder="e.g. Severe pre-eclampsia requiring ICU/NICU tertiary care"
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.ref_reason_input"
              />
            </Field>

            <Field label={t("Clinical Summary for Receiving Doctor", "وصول کنندہ ڈاکٹر کے لیے طبی خلاصہ")}>
              <textarea
                value={refSummary}
                onChange={(e) => setRefSummary(e.target.value)}
                placeholder="Document findings, gestation, high-risk conditions, vital signs, and provisional diagnosis..."
                rows={3}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.ref_summary_textarea"
              />
            </Field>

            <Field label={t("Treatment Given Prior to Transfer (Optional)", "روانگی سے قبل دی گئی ادویات")}>
              <input
                type="text"
                value={refTreatment}
                onChange={(e) => setRefTreatment(e.target.value)}
                placeholder="e.g. Magnesium sulphate loading dose 4g IV given at 10:30"
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="obstetric_assessment.ref_treatment_input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Transport Mode", "سواری کا انتظام")}>
                <select
                  value={refTransport}
                  onChange={(e) => setRefTransport(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="obstetric_assessment.ref_transport_select"
                >
                  <option value="Ambulance">{t("Hospital Ambulance", "ہسپتال ایمبولینس")}</option>
                  <option value="Rescue">{t("Rescue 1122", "ریسکیو 1122")}</option>
                  <option value="WithStaff">{t("Accompanied With Staff", "ہسپتال اسٹاف کے ساتھ")}</option>
                  <option value="Own">{t("Own Arrangement", "ذاتی سواری")}</option>
                </select>
              </Field>

              {refTransport === "WithStaff" && (
                <Field label={t("Escort Staff Name (Mandatory)", "ساتھ جانے والے عملے کا نام")}>
                  <input
                    type="text"
                    value={refEscortName}
                    onChange={(e) => setRefEscortName(e.target.value)}
                    placeholder="Staff Nurse / MO name"
                    className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    data-help="obstetric_assessment.ref_escort_name_input"
                  />
                </Field>
              )}
            </div>

            {refValidationError && <ErrorBox error={refValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setReferralModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="obstetric_assessment.btn_cancel_referral"
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                type="button"
                onClick={handleSubmitReferral}
                disabled={write.busy}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded cursor-pointer disabled:opacity-50"
                data-help="obstetric_assessment.submit_referral_btn"
              >
                {t("Generate Referral", "ریفرل جاری کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
