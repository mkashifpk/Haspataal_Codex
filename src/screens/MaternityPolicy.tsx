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
  ObstetricConditionOut,
  ConditionIn,
  ConditionPatch,
  ObstetricCommunicationOut,
  ObstetricCommunicationIn,
} from "../generated/maternity_policy";
import {
  listConditions,
  addCondition,
  updateCondition,
  noticeMaternityHighRiskPdf,
  listCommunications,
  recordCommunication,
  getEstablishment,
} from "../generated/maternity_policy";
import {
  getMaternityPolicyScreenView,
  isMaternityActive,
  evaluateConditionsReadiness,
  evaluateCommunicationsCompliance,
  validateConditionPatch,
  validateConditionCreate,
  validateCommunicationCreate,
  explainMaternityPolicyError,
} from "../maternity-policy-policy";
import { useClinicalWrite, ClinicalWriteFeedback, type ClinicalCommand } from "../clinical-write";
import { call } from "../bridge";

export function MaternityPolicy({
  user,
  establishment,
  connected,
  stream,
}: {
  user: ClinicalUser & { username?: string; roles?: string[]; registration?: string | null; designation?: string | null };
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
}) {
  const view = getMaternityPolicyScreenView(establishment);
  const maternityRunning = isMaternityActive(establishment);

  // Permissions: maternity.policy.manage (write), maternity.view or msds.view (read)
  const canManage = user.permissions?.includes("maternity.policy.manage") ?? false;
  const canView =
    canManage ||
    (user.permissions?.includes("maternity.view") ?? false) ||
    (user.permissions?.includes("msds.view") ?? false);

  const [activeTab, setActiveTab] = useState<"conditions" | "notice" | "communications">("conditions");
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Tab 1: Conditions filters
  const [provisionFilter, setProvisionFilter] = useState<"All" | "Undecided" | "Managed" | "Referred">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  // Tab 3: Communications filter
  const [audienceFilter, setAudienceFilter] = useState<"All" | "OwnPatients" | "Referrers">("All");

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [targetCondition, setTargetCondition] = useState<ObstetricConditionOut | null>(null);
  const [editProvision, setEditProvision] = useState<"Managed" | "Referred">("Managed");
  const [editReferralNote, setEditReferralNote] = useState("");
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(100);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addProvision, setAddProvision] = useState<"Undecided" | "Managed" | "Referred">("Undecided");
  const [addReferralNote, setAddReferralNote] = useState("");
  const [addSortOrder, setAddSortOrder] = useState<number>(100);
  const [addValidationError, setAddValidationError] = useState<string | null>(null);

  const [commModalOpen, setCommModalOpen] = useState(false);
  const [commDate, setCommDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [commAudience, setCommAudience] = useState<"OwnPatients" | "Referrers">("OwnPatients");
  const [commMeans, setCommMeans] = useState<"Board" | "Banner" | "Brochure" | "Website" | "Letter" | "Meeting" | "Other">("Board");
  const [commRecipients, setCommRecipients] = useState("");
  const [commSummary, setCommSummary] = useState("");
  const [commValidationError, setCommValidationError] = useState<string | null>(null);

  // Notice download/print state
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  // Write controller
  const write = useClinicalWrite(user, "maternity_policy", (value: any, cmd: ClinicalCommand) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/high-risk-conditions")) {
      setEditModalOpen(false);
      setAddModalOpen(false);
      setTargetCondition(null);
    } else if (cmd.path.includes("/communications")) {
      setCommModalOpen(false);
      setCommRecipients("");
      setCommSummary("");
    }
  });

  // Real-time Event Subscription: establishment.changed
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      const ev = parsed.event || parsed.topic;
      if (ev === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment configuration or services changed. Policy worklists refreshed.",
            "ہسپتال کی ترتیبات یا خدمات تبدیل ہو گئیں۔ پالیسی فہرست تازہ کر دی گئی۔"
          )
        );
        setRevision((r) => r + 1);
      }
    } catch {
      // Non-json stream line
    }
  }, [stream]);

  // Load Conditions
  const conditionsLoad = useLoad(
    async () => {
      if (!canView) return [];
      const res = await listConditions({ include_inactive: includeInactive });
      return res;
    },
    [canView, includeInactive, revision]
  );

  const conditions = (conditionsLoad.data as ObstetricConditionOut[] | undefined) || [];

  // Load Communications
  const communicationsLoad = useLoad(
    async () => {
      if (!canView) return [];
      const res = await listCommunications({ limit: 100 });
      return res;
    },
    [canView, revision]
  );

  const communications = (communicationsLoad.data as ObstetricCommunicationOut[] | undefined) || [];

  // Readiness and compliance evaluations
  const readiness = evaluateConditionsReadiness(conditions);
  const compliance = evaluateCommunicationsCompliance(communications);

  // Filter conditions
  const filteredConditions = conditions.filter((c) => {
    if (provisionFilter === "Undecided" && c.provision !== null) return false;
    if (provisionFilter === "Managed" && c.provision !== "Managed") return false;
    if (provisionFilter === "Referred" && c.provision !== "Referred") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchNote = (c.referral_note || "").toLowerCase().includes(q);
      if (!matchName && !matchNote) return false;
    }
    return true;
  });

  // Filter communications
  const filteredCommunications = communications.filter((comm) => {
    if (audienceFilter !== "All" && comm.audience !== audienceFilter) return false;
    return true;
  });

  // Modal open handlers
  const handleOpenEdit = (c: ObstetricConditionOut) => {
    setTargetCondition(c);
    setEditProvision(c.provision === "Referred" ? "Referred" : "Managed");
    setEditReferralNote(c.referral_note || "");
    setEditName(c.name);
    setEditSortOrder(c.sort_order);
    setEditValidationError(null);
    setEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setAddName("");
    setAddProvision("Undecided");
    setAddReferralNote("");
    setAddSortOrder(100);
    setAddValidationError(null);
    setAddModalOpen(true);
  };

  const handleOpenComm = () => {
    setCommDate(new Date().toISOString().slice(0, 10));
    setCommAudience("OwnPatients");
    setCommMeans("Board");
    setCommRecipients("");
    setCommSummary("");
    setCommValidationError(null);
    setCommModalOpen(true);
  };

  // Submit Decide / Edit Condition (PATCH /maternity/high-risk-conditions/{id})
  const handleSubmitEdit = async () => {
    if (!targetCondition) return;
    const patch: ConditionPatch = {
      expected_version: targetCondition.row_version,
      provision: editProvision,
      referral_note: editProvision === "Referred" ? editReferralNote.trim() : null,
      name: !targetCondition.from_manual && editName.trim() !== targetCondition.name ? editName.trim() : undefined,
      sort_order: editSortOrder !== targetCondition.sort_order ? editSortOrder : undefined,
    };

    const val = validateConditionPatch(patch);
    if (!val.valid) {
      setEditValidationError(val.error || "Validation error");
      return;
    }

    write.start({
      path: `/maternity/high-risk-conditions/${targetCondition.condition_id}`,
      method: "PATCH",
      body: patch,
      permission: "maternity.policy.manage",
      protection: "idempotent",
      label: t("Update High-Risk Condition Decision", "ہائی رسک کیس کا فیصلہ محفوظ کریں"),
    });
  };

  // Toggle active status (Retire / Reactivate)
  const handleToggleActive = (c: ObstetricConditionOut) => {
    if (!canManage) return;
    const patch: ConditionPatch = {
      expected_version: c.row_version,
      is_active: !c.is_active,
    };
    write.start({
      path: `/maternity/high-risk-conditions/${c.condition_id}`,
      method: "PATCH",
      body: patch,
      permission: "maternity.policy.manage",
      protection: "idempotent",
      label: t("Toggle Condition Status", "حالت تبدیل کریں"),
    });
  };

  // Submit Add Condition (POST /maternity/high-risk-conditions)
  const handleSubmitAdd = async () => {
    const payload: ConditionIn = {
      name: addName.trim(),
      provision: addProvision === "Undecided" ? null : addProvision,
      referral_note: addProvision === "Referred" ? addReferralNote.trim() : null,
      sort_order: addSortOrder,
    };

    const val = validateConditionCreate(payload);
    if (!val.valid) {
      setAddValidationError(val.error || "Validation error");
      return;
    }

    write.start({
      path: `/maternity/high-risk-conditions`,
      method: "POST",
      body: payload,
      permission: "maternity.policy.manage",
      protection: "idempotent",
      label: t("Add High-Risk Condition", "نیا ہائی رسک کیس شامل کریں"),
    });
  };

  // Submit Record Communication (POST /maternity/communications)
  const handleSubmitComm = async () => {
    const payload: ObstetricCommunicationIn = {
      communicated_on: commDate,
      audience: commAudience,
      means: commMeans,
      recipients: commMeans === "Letter" || commMeans === "Meeting" ? commRecipients.trim() : (commRecipients.trim() || null),
      summary: commSummary.trim(),
    };

    const val = validateCommunicationCreate(payload);
    if (!val.valid) {
      setCommValidationError(val.error || "Validation error");
      return;
    }

    write.start({
      path: `/maternity/communications`,
      method: "POST",
      body: payload,
      permission: "maternity.policy.manage",
      protection: "idempotent",
      label: t("Record Stakeholder Communication", "اسٹیک ہولڈر رابطہ درج کریں"),
    });
  };

  // Handle PDF notice download / print
  const handleDownloadNoticePdf = async () => {
    setPdfBusy(true);
    setPdfMessage(null);
    try {
      if (window.terminal) {
        const res = await call<{ saved?: boolean; opened?: boolean }>("clinical-pdf", {
          path: "/maternity/high-risk-notice/pdf",
          preview: true,
        });
        setPdfMessage(
          res.opened
            ? t("Notice PDF opened in viewer.", "نوٹس پی ڈی ایف ویور میں کھل گئی۔")
            : t("Notice PDF saved successfully.", "نوٹس پی ڈی ایف محفوظ ہو گئی۔")
        );
      } else {
        await noticeMaternityHighRiskPdf();
        setPdfMessage(t("Notice PDF fetched.", "نوٹس پی ڈی ایف حاصل کر لی گئی۔"));
      }
    } catch (err) {
      setPdfMessage(t("Failed to download notice PDF.", "پی ڈی ایف ڈاؤن لوڈ کرنے میں ناکامی۔"));
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrintNotice = async () => {
    setPdfBusy(true);
    setPdfMessage(null);
    try {
      if (window.terminal) {
        await call("clinical-pdf", {
          path: "/maternity/high-risk-notice/pdf",
          preview: false,
        });
        setPdfMessage(t("Notice sent to terminal document printer.", "نوٹس پرنٹر کو بھیج دیا گیا۔"));
      } else {
        setPdfMessage(t("Terminal printing is only supported in desktop app.", "پرنٹنگ صرف ڈیسک ٹاپ ٹرمینل میں دستیاب ہے۔"));
      }
    } catch (err) {
      setPdfMessage(t("Printer failed.", "پرنٹ کرنے میں ناکامی۔"));
    } finally {
      setPdfBusy(false);
    }
  };

  if (!canView) {
    return (
      <Empty>
        {t(
          "You do not have permission to view High-Risk Pregnancy Policy (maternity.policy.manage or maternity.view or msds.view required).",
          "آپ کو زیادہ خطرے والی حمل کی پالیسی دیکھنے کی اجازت نہیں ہے۔"
        )}
      </Empty>
    );
  }

  return (
    <section className="space-y-4" data-help-screen="maternity_policy">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
              {t("Quality & Safety / MSDS", "کوالٹی و سیفٹی / ایم ایس ڈی ایس")}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
              maternityRunning
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {maternityRunning
                ? t("Maternity Service Active", "زچگی سروس فعال ہے")
                : t("Maternity Service Inactive (Referral Only)", "زچگی سروس غیر فعال ہے (صرف حوالہ)")}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {t("High-Risk Pregnancy: Our Policy", "ہائی رسک حمل: ہسپتال کی پالیسی")}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t(
              "PHC MSDS Cat I 26, II A 87, II B & II C 66: High-risk obstetric list, public waiting area notice, and stakeholder communications. Kept whether or not maternity service is running.",
              "پی ایچ سی ایم ایس ڈی ایس: ہائی رسک زچگی کیسز کی فہرست، عوامی نوٹس، اور مریضوں و معالجین سے رابطہ۔"
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRevision((r) => r + 1)}
            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            data-help="maternity_policy.refresh"
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Realtime Notification Banner */}
      {realtimeNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-xs flex items-center justify-between text-blue-900 dark:text-blue-200">
          <span>{realtimeNotice}</span>
          <button
            onClick={() => setRealtimeNotice(null)}
            className="font-bold underline text-blue-700 dark:text-blue-300 ml-4 cursor-pointer"
            data-help="maternity_policy.btn_dismiss_alert"
          >
            {t("Dismiss", "ہٹائیں")}
          </button>
        </div>
      )}

      {/* Overview & Compliance Status Cards (rule:7ac44a354a, rule:1e04f5eed7) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conditions Decision Readiness Card */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("Service Activation Readiness", "سروس ایکٹیویشن کی تیاری")}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                readiness.canActivateMaternity
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {readiness.canActivateMaternity
                ? t("All Cases Decided", "تمام کیسز کا فیصلہ ہو گیا")
                : t(`${readiness.undecidedCount} Undecided Cases`, `${readiness.undecidedCount} غیر طے شدہ کیسز`)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t("Total Active:", "کل فعال:")} </span>
              <span className="font-bold">{readiness.activeCount}</span>
            </div>
            <div>
              <span className="text-green-600 dark:text-green-400 font-semibold">{t("Managed Here:", "یہاں زیر علاج:")} </span>
              <span className="font-bold">{readiness.managedCount}</span>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">{t("Referred:", "ریفر کردہ:")} </span>
              <span className="font-bold">{readiness.referredCount}</span>
            </div>
          </div>

          {!readiness.canActivateMaternity && (
            <div className="text-xs p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <span>
                {t(
                  "Rule 7ac44a354a: All high-risk cases must be decided before maternity service can be switched on in Facility Settings.",
                  "قاعدہ: زچگی سروس شروع کرنے سے پہلے تمام ہائی رسک کیسز کا فیصلہ لازمی ہے۔"
                )}
              </span>
              <button
                onClick={() => {
                  setActiveTab("conditions");
                  setProvisionFilter("Undecided");
                }}
                className="px-2 py-1 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold rounded cursor-pointer whitespace-nowrap ml-2"
                data-help="maternity_policy.btn_show_undecided_shortcut"
              >
                {t("Review Undecided", "غیر طے شدہ دیکھیں")}
              </button>
            </div>
          )}
        </div>

        {/* Stakeholder Communications Compliance Card (rule:1e04f5eed7) */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("MSDS Stakeholder Communications", "اسٹیک ہولڈر مواصلت")}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                compliance.status === "FullyMet"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : compliance.status === "PartiallyMet"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {compliance.status === "FullyMet"
                ? t("Indicator Fully Met", "انڈیکیٹر مکمل ہے")
                : compliance.status === "PartiallyMet"
                ? t("Indicator Partially Met", "انڈیکیٹر جزوی ہے")
                : t("Indicator Not Met", "انڈیکیٹر نامکمل ہے")}
            </span>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-300">
            {compliance.statusExplanation}
          </p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className={compliance.hasOwnPatients ? "text-green-600" : "text-gray-400"}>
              {compliance.hasOwnPatients ? "✓ " : "✗ "}
              {t("Patients Told (Board/Banner/Brochure/Website)", "مریضوں کو آگاہی")}
            </span>
            <span className={compliance.hasReferrers ? "text-green-600" : "text-amber-600"}>
              {compliance.hasReferrers ? "✓ " : "✗ "}
              {t("Referrers Told (Letters/Meetings)", "ریفررز کو آگاہی (خطوط/میٹنگز)")}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2">
        <button
          onClick={() => setActiveTab("conditions")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === "conditions"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          data-help="maternity_policy.tab_conditions"
        >
          {t("1. High-Risk Conditions Catalog", "۱. ہائی رسک کیسز کی فہرست")} ({conditions.length})
        </button>

        <button
          onClick={() => setActiveTab("notice")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === "notice"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          data-help="maternity_policy.tab_notice"
        >
          {t("2. Public Notice & Display PDF", "۲. عوامی نوٹس و پی ڈی ایف")}
        </button>

        <button
          onClick={() => setActiveTab("communications")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === "communications"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          data-help="maternity_policy.tab_communications"
        >
          {t("3. Stakeholder Communications Log", "۳. اسٹیک ہولڈر مواصلاتی لاگ")} ({communications.length})
        </button>
      </div>

      {/* TAB 1: CONDITIONS CATALOG */}
      {activeTab === "conditions" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-gray-700 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">{t("Provision:", "فیصلہ:")}</span>
                <select
                  value={provisionFilter}
                  onChange={(e) => setProvisionFilter(e.target.value as any)}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="maternity_policy.filter_provision"
                >
                  <option value="All">{t("All Provisions", "تمام فیصلوں کے مطابق")}</option>
                  <option value="Undecided">{t("Undecided Only", "صرف غیر طے شدہ")}</option>
                  <option value="Managed">{t("Managed Here", "یہاں زیر علاج")}</option>
                  <option value="Referred">{t("Referred", "ریفر کردہ")}</option>
                </select>
              </div>

              <input
                type="text"
                placeholder={t("Search conditions or referral destinations...", "کیس یا ریفرل ہسپتال تلاش کریں...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-64"
                data-help="maternity_policy.search_conditions_input"
              />

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  data-help="maternity_policy.toggle_include_inactive"
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t("Include Inactive / Retired", "غیر فعال و ریٹائرڈ شامل کریں")}
                </span>
              </label>
            </div>

            {canManage && (
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded cursor-pointer"
                data-help="maternity_policy.btn_add_condition"
              >
                {t("+ Add Condition", "+ نیا کیس شامل کریں")}
              </button>
            )}
          </div>

          <LoadState
            loading={conditionsLoad.loading}
            error={conditionsLoad.error}
            retry={conditionsLoad.reload}
          />

          {!conditionsLoad.loading && filteredConditions.length === 0 && (
            <Empty>{t("No high-risk conditions match your filter.", "کوئی کیس نہیں ملا۔")}</Empty>
          )}

          {!conditionsLoad.loading && filteredConditions.length > 0 && (
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700/50 uppercase text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5 w-12 text-center">{t("#", "نمبر")}</th>
                    <th className="p-2.5">{t("High-Risk Obstetric Condition", "ہائی رسک زچگی کیس")}</th>
                    <th className="p-2.5">{t("Provision", "ہسپتال کا فیصلہ")}</th>
                    <th className="p-2.5">{t("Referral Destination / Note", "ریفرل ہسپتال کی تفصیل")}</th>
                    <th className="p-2.5 w-24 text-center">{t("Status", "حیثیت")}</th>
                    {canManage && <th className="p-2.5 w-36 text-center">{t("Actions", "کارروائی")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredConditions.map((cond) => {
                    const isUndecided = cond.provision === null || cond.provision === undefined;
                    return (
                      <tr
                        key={cond.condition_id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                          !cond.is_active ? "opacity-60 bg-gray-50/50" : ""
                        }`}
                      >
                        <td className="p-2.5 text-center text-gray-400 font-mono">{cond.sort_order}</td>
                        <td className="p-2.5 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{cond.name}</span>
                            {cond.from_manual && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold">
                                {t("PHC Manual", "پی ایچ سی مینوئل")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          {isUndecided ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              {t("Undecided", "غیر طے شدہ")}
                            </span>
                          ) : cond.provision === "Managed" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                              {t("Managed Here", "یہاں زیر علاج")}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              {t("Referred", "ریفر کردہ")}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-gray-600 dark:text-gray-300">
                          {cond.provision === "Referred" ? (
                            cond.referral_note || <span className="text-red-500 font-semibold">{t("Missing destination note", "ریفرل کی جگہ درج نہیں")}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {cond.is_active ? (
                            <span className="text-green-600 font-semibold text-[11px]">{t("Active", "فعال")}</span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">{t("Retired", "ریٹائرڈ")}</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(cond)}
                                className={`px-2 py-1 rounded font-medium text-[11px] cursor-pointer ${
                                  isUndecided
                                    ? "bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                    : "border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                                data-help="maternity_policy.btn_edit_condition"
                              >
                                {isUndecided ? t("Decide", "فیصلہ کریں") : t("Edit", "ترمیم")}
                              </button>

                              <button
                                onClick={() => handleToggleActive(cond)}
                                className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                                title={cond.is_active ? "Retire condition" : "Reactivate condition"}
                                data-help="maternity_policy.btn_toggle_active"
                              >
                                {cond.is_active ? t("Retire", "ریٹائر") : t("Reactivate", "بحال")}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PUBLIC NOTICE & PDF DISPLAY (rule:b7a7a7f1e6) */}
      {activeTab === "notice" && (
        <div className="space-y-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded text-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-bold text-purple-900 dark:text-purple-200">
                {t(
                  "Mandatory Display Notice (Rule b7a7a7f1e6, MSDS Cat I 26, II C 66):",
                  "لازمی آویزاں نوٹس:"
                )}
              </span>
              <p className="text-purple-800 dark:text-purple-300 mt-0.5">
                {t(
                  "Display this notice prominently at the main entrance and in the antenatal waiting area. Reprint it whenever high-risk decisions or referral agreements change.",
                  "اس نوٹس کو مرکزی دروازے اور اینٹی نیٹل ویٹنگ ایریا میں نمایاں آویزاں کریں۔"
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadNoticePdf}
                disabled={pdfBusy}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded text-xs cursor-pointer disabled:opacity-50"
                data-help="maternity_policy.btn_download_pdf"
              >
                {pdfBusy ? t("Downloading...", "ڈاؤن لوڈ جاری...") : t("Download Official PDF", "سرکاری پی ڈی ایف ڈاؤن لوڈ")}
              </button>

              <button
                onClick={handlePrintNotice}
                disabled={pdfBusy}
                className="px-3 py-1.5 border border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 font-medium rounded text-xs cursor-pointer disabled:opacity-50"
                data-help="maternity_policy.btn_print_notice"
              >
                {t("Print Notice", "نوٹس پرنٹ کریں")}
              </button>
            </div>
          </div>

          {pdfMessage && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded border border-blue-200 dark:border-blue-700">
              {pdfMessage}
            </div>
          )}

          {/* Rendered Live Preview of the Public Notice */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-lg shadow border-2 border-gray-300 dark:border-gray-700 max-w-3xl mx-auto space-y-6 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="text-center border-b pb-4 border-gray-200 dark:border-gray-700">
              <span className="text-xs uppercase font-bold tracking-widest text-gray-500">
                {t("Punjab Healthcare Commission — MSDS Standard Notice", "پنجاب ہیلتھ کیئر کمیشن — معیاری نوٹس")}
              </span>
              <h2 className="text-lg font-extrabold mt-1">
                {t("HIGH-RISK PREGNANCY POLICY & PATIENT GUIDANCE", "زیادہ خطرے والی حمل کی پالیسی و رہنمائی")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("For Display at Hospital Main Entrance and Antenatal Clinic Waiting Area", "مرکزی داخلہ اور اینٹی نیٹل کلینک کے انتظار گاہ میں آویزاں کرنے کے لیے")}
              </p>
            </div>

            {/* Service Status Message */}
            {!maternityRunning ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded text-xs text-red-900 dark:text-red-200 space-y-1">
                <span className="font-bold text-sm">
                  {t("NOTICE: NO ROUTINE OR HIGH-RISK MATERNITY CARE PROVIDED HERE", "انتباہ: اس ہسپتال میں زچگی سروس فراہم نہیں کی جاتی")}
                </span>
                <p>
                  {t(
                    "This facility does not operate a maternity unit or labour room. All patients presenting with pregnancy complications are immediately stabilized and referred to the designated tertiary facilities listed below.",
                    "اس ہسپتال میں لیبر روم یا زچگی یونٹ موجود نہیں ہے۔ تمام مریضوں کو فوری طور پر نیچے درج ہسپتالوں میں منتقل کیا جاتا ہے۔"
                  )}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded text-xs text-green-900 dark:text-green-200">
                <span className="font-bold">
                  {t("MATERNITY SERVICE ACTIVE", "زچگی سروس فعال ہے")}
                </span>
                <p className="mt-0.5">
                  {t(
                    "This hospital provides care for designated obstetric conditions. Cases beyond our authorized clinical scope are referred according to approved protocols.",
                    "یہ ہسپتال مخصوص زچگی کیسز کا علاج کرتا ہے، جبکہ پیچیدہ کیسز کو پروٹوکول کے مطابق ریفر کیا جاتا ہے۔"
                  )}
                </p>
              </div>
            )}

            {/* Managed Conditions Section */}
            {maternityRunning && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-green-800 dark:text-green-400 uppercase tracking-wide border-b pb-1">
                  {t("1. High-Risk Conditions Managed at this Hospital", "۱. وہ کیسز جن کا علاج اس ہسپتال میں کیا جاتا ہے")}
                </h3>
                {conditions.filter((c) => c.is_active && c.provision === "Managed").length === 0 ? (
                  <p className="text-xs text-gray-500 italic">{t("None currently authorized.", "فی الحال کوئی نہیں۔")}</p>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {conditions
                      .filter((c) => c.is_active && c.provision === "Managed")
                      .map((c) => (
                        <li key={c.condition_id} className="flex items-center gap-2">
                          <span className="text-green-600 font-bold">✓</span>
                          <span>{c.name}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {/* Referred Conditions Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wide border-b pb-1">
                {maternityRunning
                  ? t("2. High-Risk Conditions Referred to Other Facilities", "۲. وہ کیسز جنہیں دیگر ہسپتالوں میں ریفر کیا جاتا ہے")
                  : t("Designated Referral Destinations for High-Risk Cases", "ہائی رسک کیسز کے لیے ریفرل ہسپتال")}
              </h3>
              <div className="space-y-2 text-xs">
                {conditions
                  .filter((c) => c.is_active && (c.provision === "Referred" || !maternityRunning))
                  .map((c) => (
                    <div
                      key={c.condition_id}
                      className="p-2.5 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">
                        {c.referral_note || t("Designated tertiary referral facility", "مجاز ٹرشری ہسپتال")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-[10px] text-gray-500">
              <span>{t("Issued by Quality Management & Clinical Governance", "کوالٹی مینجمنٹ و کلینیکل گورننس کی جانب سے جاری کردہ")}</span>
              <span>{t("Punjab Healthcare Commission Act 2010", "پنجاب ہیلتھ کیئر کمیشن ایکٹ ۲۰۱۰")}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAKEHOLDER COMMUNICATIONS (rule:1e04f5eed7) */}
      {activeTab === "communications" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded border border-gray-200 dark:border-gray-700 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{t("Audience Filter:", "مخاطبین:")}</span>
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value as any)}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="maternity_policy.filter_audience"
              >
                <option value="All">{t("All Stakeholders", "تمام مخاطبین")}</option>
                <option value="OwnPatients">{t("Own Patients Only", "صرف اپنے مریض")}</option>
                <option value="Referrers">{t("Referring Practitioners & Facilities", "ریفرنگ ڈاکٹرز و مراکز")}</option>
              </select>
            </div>

            {canManage && (
              <button
                onClick={handleOpenComm}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded cursor-pointer"
                data-help="maternity_policy.btn_record_communication"
              >
                {t("+ Record Communication", "+ رابطہ درج کریں")}
              </button>
            )}
          </div>

          <LoadState
            loading={communicationsLoad.loading}
            error={communicationsLoad.error}
            retry={communicationsLoad.reload}
          />

          {!communicationsLoad.loading && filteredCommunications.length === 0 && (
            <Empty>
              {t(
                "No stakeholder communications recorded yet. Use '+ Record Communication' to log patient notices and referrer letters.",
                "ابھی تک کوئی رابطہ درج نہیں ہوا۔ نیا رابطہ درج کریں۔"
              )}
            </Empty>
          )}

          {!communicationsLoad.loading && filteredCommunications.length > 0 && (
            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700/50 uppercase text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5 w-28">{t("Date", "تاریخ")}</th>
                    <th className="p-2.5 w-28">{t("Audience", "مخاطب")}</th>
                    <th className="p-2.5 w-24">{t("Means", "ذریعہ")}</th>
                    <th className="p-2.5">{t("Recipients / Target", "وصول کنندگان")}</th>
                    <th className="p-2.5">{t("Summary of Communication", "خلاصہ")}</th>
                    <th className="p-2.5">{t("Recorded By", "اندراج کنندہ")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCommunications.map((comm) => (
                    <tr key={comm.communication_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="p-2.5 whitespace-nowrap font-mono">{comm.communicated_on}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            comm.audience === "OwnPatients"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {comm.audience === "OwnPatients"
                            ? t("Own Patients", "اپنے مریض")
                            : t("Referrers", "ریفرنگ مراکز")}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium">{comm.means}</td>
                      <td className="p-2.5 text-gray-600 dark:text-gray-300">{comm.recipients || "—"}</td>
                      <td className="p-2.5 font-medium text-gray-900 dark:text-white">{comm.summary}</td>
                      <td className="p-2.5 text-gray-500 dark:text-gray-400">
                        {comm.author_stamp?.text || comm.author_stamp?.name || `Staff ${comm.recorded_by}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: DECIDE / EDIT CONDITION (rule:585417c0ea) */}
      {editModalOpen && targetCondition && (
        <Modal
          title={t(
            targetCondition.provision ? "Update Condition Decision" : "Decide High-Risk Obstetric Condition",
            targetCondition.provision ? "کیس کے فیصلے میں ترمیم" : "ہائی رسک کیس کا فیصلہ کریں"
          )}
          onClose={() => setEditModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-gray-500">{t("Condition Name:", "کیس کا نام:")} </span>
              <span className="font-bold text-gray-900 dark:text-white">{targetCondition.name}</span>
              {targetCondition.from_manual && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                  {t("PHC Standard Manual Example", "پی ایچ سی معیاری مینوئل مثال")}
                </span>
              )}
            </div>

            {!targetCondition.from_manual && (
              <Field label={t("Edit Condition Name", "کیس کے نام میں ترمیم")}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="maternity_policy.condition_name_input"
                />
              </Field>
            )}

            <Field label={t("Hospital Clinical Provision", "ہسپتال کا طبی فیصلہ")}>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editProvision"
                    value="Managed"
                    checked={editProvision === "Managed"}
                    onChange={() => setEditProvision("Managed")}
                    data-help="maternity_policy.radio_provision_managed"
                  />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {t("Managed Here", "یہاں زیر علاج رکھیں")}
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editProvision"
                    value="Referred"
                    checked={editProvision === "Referred"}
                    onChange={() => setEditProvision("Referred")}
                    data-help="maternity_policy.radio_provision_referred"
                  />
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {t("Referred (Specify Destination)", "ریفر کریں (ہسپتال درج کریں)")}
                  </span>
                </label>
              </div>
            </Field>

            {editProvision === "Referred" && (
              <Field label={t("Referral Destination & Note", "ریفرل ہسپتال اور وضاحت")}>
                <textarea
                  value={editReferralNote}
                  onChange={(e) => setEditReferralNote(e.target.value)}
                  placeholder="e.g. DHQ Hospital, labour room, 24 h; or Lady Willingdon Hospital"
                  rows={2}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="maternity_policy.condition_referral_note_textarea"
                />
              </Field>
            )}

            <Field label={t("Display Sort Order", "ترتیب نمبر")}>
              <input
                type="number"
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.condition_sort_order_input"
              />
            </Field>

            {editValidationError && <ErrorBox error={editValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="maternity_policy.btn_cancel_edit_condition"
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                onClick={handleSubmitEdit}
                disabled={write.busy}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded cursor-pointer disabled:opacity-50"
                data-help="maternity_policy.submit_edit_condition_btn"
              >
                {t("Save Decision", "فیصلہ محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD CONDITION */}
      {addModalOpen && (
        <Modal
          title={t("Add Custom High-Risk Condition", "نیا ہائی رسک کیس شامل کریں")}
          onClose={() => setAddModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <Field label={t("Condition Name", "کیس کا نام")}>
              <input
                type="text"
                placeholder="e.g. Gestational Diabetes Mellitus with complications"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.add_name_input"
              />
            </Field>

            <Field label={t("Initial Decision / Provision", "ابتدائی فیصلہ")}>
              <select
                value={addProvision}
                onChange={(e) => setAddProvision(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.add_provision_select"
              >
                <option value="Undecided">{t("Undecided (Decide later)", "غیر طے شدہ")}</option>
                <option value="Managed">{t("Managed Here", "یہاں زیر علاج رکھیں")}</option>
                <option value="Referred">{t("Referred", "ریفر کریں")}</option>
              </select>
            </Field>

            {addProvision === "Referred" && (
              <Field label={t("Referral Destination", "ریفرل ہسپتال")}>
                <textarea
                  value={addReferralNote}
                  onChange={(e) => setAddReferralNote(e.target.value)}
                  placeholder="Specify destination facility..."
                  rows={2}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="maternity_policy.add_referral_note_textarea"
                />
              </Field>
            )}

            <Field label={t("Display Sort Order", "ترتیب نمبر")}>
              <input
                type="number"
                value={addSortOrder}
                onChange={(e) => setAddSortOrder(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.add_sort_order_input"
              />
            </Field>

            {addValidationError && <ErrorBox error={addValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="maternity_policy.btn_cancel_add_condition"
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                onClick={handleSubmitAdd}
                disabled={write.busy}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded cursor-pointer disabled:opacity-50"
                data-help="maternity_policy.submit_add_condition_btn"
              >
                {t("Add to Catalog", "فہرست میں شامل کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: RECORD COMMUNICATION (rule:1e04f5eed7) */}
      {commModalOpen && (
        <Modal
          title={t("Record Stakeholder Communication", "اسٹیک ہولڈر رابطہ درج کریں")}
          onClose={() => setCommModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <Field label={t("Communication Date", "رابطہ کی تاریخ")}>
              <input
                type="date"
                value={commDate}
                onChange={(e) => setCommDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.comm_date_input"
              />
            </Field>

            <Field label={t("Target Audience", "مخاطبین")}>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="commAudience"
                    value="OwnPatients"
                    checked={commAudience === "OwnPatients"}
                    onChange={() => setCommAudience("OwnPatients")}
                    data-help="maternity_policy.radio_audience_patients"
                  />
                  <span>{t("Own Patients", "ہسپتال کے اپنے مریض")}</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="commAudience"
                    value="Referrers"
                    checked={commAudience === "Referrers"}
                    onChange={() => setCommAudience("Referrers")}
                    data-help="maternity_policy.radio_audience_referrers"
                  />
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {t("Referrers (Practitioners & Facilities)", "ریفرنگ ڈاکٹرز و مراکز")}
                  </span>
                </label>
              </div>
            </Field>

            <Field label={t("Communication Means", "ذریعہ")}>
              <select
                value={commMeans}
                onChange={(e) => setCommMeans(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.comm_means_select"
              >
                <option value="Board">{t("Display Board (Entrance / Waiting Area)", "ڈسپلے بورڈ")}</option>
                <option value="Banner">{t("Banner", "بینر")}</option>
                <option value="Brochure">{t("Printed Brochure / Pamphlet", "بروشر / پمفلٹ")}</option>
                <option value="Website">{t("Hospital Website Notice", "ویب سائٹ نوٹس")}</option>
                <option value="Letter">{t("Formal Letter (Names Recipients)", "باضابطہ خط")}</option>
                <option value="Meeting">{t("Stakeholder Coordination Meeting", "کوارڈینیشن میٹنگ")}</option>
                <option value="Other">{t("Other Means", "دیگر")}</option>
              </select>
            </Field>

            {(commMeans === "Letter" || commMeans === "Meeting" || commAudience === "Referrers") && (
              <Field label={t("Recipients (To Whom)", "وصول کنندگان کے نام")}>
                <input
                  type="text"
                  placeholder="e.g. Dr Saima Clinic, Kot Lakhpat; RHC Raiwind Medical Officers"
                  value={commRecipients}
                  onChange={(e) => setCommRecipients(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="maternity_policy.comm_recipients_input"
                />
              </Field>
            )}

            <Field label={t("Summary of Communication", "رابطہ کا خلاصہ")}>
              <textarea
                value={commSummary}
                onChange={(e) => setCommSummary(e.target.value)}
                placeholder="Describe what clinical services and referral arrangements were communicated..."
                rows={3}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="maternity_policy.comm_summary_textarea"
              />
            </Field>

            {commValidationError && <ErrorBox error={commValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setCommModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="maternity_policy.btn_cancel_comm"
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                onClick={handleSubmitComm}
                disabled={write.busy}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded cursor-pointer disabled:opacity-50"
                data-help="maternity_policy.submit_comm_btn"
              >
                {t("Record Communication", "رابطہ محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
